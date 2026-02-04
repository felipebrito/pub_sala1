
import * as THREE from 'three';
import { WarpMath } from './WarpMath';
import { EdgeBlendMaterial } from './EdgeBlendMaterial';

interface InitOptions {
    index: number;
    container: HTMLElement;
}

interface StateCache {
    grid: { x: number; y: number }[][];
    rows: number;
    cols: number;
    mode: 'linear' | 'bicubic';
    width: number;
    height: number;
}

export class ThreeRenderer {
    private renderers: (THREE.WebGLRenderer | null)[] = [null, null, null];
    private scenes: (THREE.Scene | null)[] = [null, null, null];
    private cameras: (THREE.OrthographicCamera | null)[] = [null, null, null];
    private meshes: (THREE.Mesh | null)[] = [null, null, null];

    private texture: THREE.VideoTexture | null = null;
    private animationId: number | null = null;

    // Cache for Auto-Resize Logic
    private cache: (StateCache | null)[] = [null, null, null];

    constructor(targets: InitOptions[]) {
        targets.forEach(({ index, container }) => {
            const width = container.clientWidth;
            const height = container.clientHeight;

            // 1. Setup Renderer
            const renderer = new THREE.WebGLRenderer({
                antialias: true,
                alpha: true
            });
            renderer.setSize(width, height);
            renderer.domElement.style.width = '100%';
            renderer.domElement.style.height = '100%';
            renderer.setPixelRatio(window.devicePixelRatio);

            container.appendChild(renderer.domElement);
            this.renderers[index] = renderer;

            // 2. Setup Scene
            const scene = new THREE.Scene();
            scene.background = new THREE.Color(0x000000);
            this.scenes[index] = scene;

            // 3. Setup Camera
            const camera = new THREE.OrthographicCamera(
                0, width,
                0, height,
                0.1, 1000
            );
            camera.position.z = 10;
            camera.updateProjectionMatrix();
            this.cameras[index] = camera;

            // 4. Create Warping Mesh (High Density 32x32)
            const gridX = 32;
            const gridY = 32;
            const geometry = new THREE.PlaneGeometry(width > 0 ? width : 100, height > 0 ? height : 100, gridX, gridY);

            // Initial UV Mapping Logic (Slicing 1/3 per projector)
            const uvAttribute = geometry.attributes.uv;
            const sliceWidth = 1.0 / 3.0;
            const uMin = index * sliceWidth;
            const uMax = (index + 1) * sliceWidth;

            for (let iy = 0; iy <= gridY; iy++) {
                const v = 1 - (iy / gridY); // V goes 1..0
                for (let ix = 0; ix <= gridX; ix++) {
                    const uLocal = ix / gridX; // 0..1
                    const uGlobal = uMin + uLocal * (uMax - uMin);

                    const idx = iy * (gridX + 1) + ix;
                    uvAttribute.setXY(idx, uGlobal, v);
                }
            }

            uvAttribute.needsUpdate = true;

            const material = new EdgeBlendMaterial();
            if (this.texture) material.map = this.texture;

            const mesh = new THREE.Mesh(geometry, material);
            scene.add(mesh);
            this.meshes[index] = mesh;

            // Note: We removed the explicit "resize" event listener.
            // We now handle resize in the animate loop for robustness.
        });

        this.animate();
    }

    public setVideo(video: HTMLVideoElement) {
        if (!video) return;
        if (this.texture) this.texture.dispose();

        console.log('[ThreeRenderer] Setting new video texture:', video.currentSrc);
        this.texture = new THREE.VideoTexture(video);
        this.texture.colorSpace = THREE.SRGBColorSpace;
        this.texture.minFilter = THREE.LinearFilter;
        this.texture.magFilter = THREE.LinearFilter;

        this.meshes.forEach(mesh => {
            if (mesh) {
                const material = mesh.material as EdgeBlendMaterial;
                material.map = this.texture;
                // ShaderMaterial doesn't have .color property
                material.needsUpdate = true;
            }
        });
    }

    public updateGridWarp(
        index: number,
        points: { x: number; y: number }[][],
        rows: number,
        cols: number,
        mode: 'linear' | 'bicubic' = 'bicubic'
    ) {
        const mesh = this.meshes[index];
        const renderer = this.renderers[index];
        if (!mesh || !renderer) return;

        const width = renderer.domElement.clientWidth;
        const height = renderer.domElement.clientHeight;

        // Cache state for auto-resize, even if current size is 0
        this.cache[index] = {
            grid: points, rows, cols, mode,
            width, height
        };

        if (width === 0 || height === 0) return;

        const geometry = mesh.geometry;
        const positions = geometry.attributes.position;

        // Scale factor: Points come in Preview coordinates (360x202).
        const PREVIEW_WIDTH = 360;
        const PREVIEW_HEIGHT = 202;

        const normPoints = points.map(row => row.map(p => ({
            x: p.x / PREVIEW_WIDTH,
            y: p.y / PREVIEW_HEIGHT
        })));

        const meshSegsX = 32;
        const meshSegsY = 32;

        for (let iy = 0; iy <= meshSegsY; iy++) {
            const v = iy / meshSegsY; // 0..1
            for (let ix = 0; ix <= meshSegsX; ix++) {
                const u = ix / meshSegsX; // 0..1

                // Interpolate using NORMALIZED coords (result is 0..1)
                const posNorm = WarpMath.interpolate(u, v, normPoints, cols, rows, mode);

                // Scale to actual mesh size
                const idx = iy * (meshSegsX + 1) + ix;
                positions.setXYZ(idx, posNorm.x * width, posNorm.y * height, 0);
            }
        }

        positions.needsUpdate = true;
    }

    public updateInputCrop(index: number, crop: { x: number, y: number, width: number, height: number }) {
        const mesh = this.meshes[index];
        if (!mesh) return;

        const geometry = mesh.geometry;
        const uvAttribute = geometry.attributes.uv;

        const uMin = crop.x;
        const uMax = crop.x + crop.width;

        const vMin = crop.y; // Assuming uniform expects raw crop values
        const vMax = crop.y + crop.height; // Assuming uniform expects raw crop values

        const vTop = 1 - crop.y;
        const vBottom = 1 - (crop.y + crop.height);

        const gridX = 32;
        const gridY = 32;

        for (let iy = 0; iy <= gridY; iy++) {
            const vParam = iy / gridY; // 0 (top) to 1 (bottom)
            const v = vTop + (vBottom - vTop) * vParam;

            for (let ix = 0; ix <= gridX; ix++) {
                const uParam = ix / gridX;
                const u = uMin + (uMax - uMin) * uParam;

                const idx = iy * (gridX + 1) + ix;
                uvAttribute.setXY(idx, u, v);
            }
        }

        uvAttribute.needsUpdate = true;

        // Update Shader Crop Info
        if (mesh) {
            const mat = mesh.material as EdgeBlendMaterial;
            if (mat.uniforms && mat.uniforms.cropInfo) {
                mat.uniforms.cropInfo.value.set(uMin, uMax, vMin, vMax);
            }
        }
    }

    public updateEdgeBlend(index: number, blend: { left: number, right: number, top: number, bottom: number, gamma?: number }) {
        const mesh = this.meshes[index];
        if (!mesh) return;
        const mat = mesh.material as EdgeBlendMaterial;

        if (mat.uniforms) {
            mat.uniforms.blendLeft.value = blend.left;
            mat.uniforms.blendRight.value = blend.right;
            mat.uniforms.blendTop.value = blend.top;
            mat.uniforms.blendBottom.value = blend.bottom;
            if (blend.gamma !== undefined) mat.uniforms.gamma.value = blend.gamma;
        }
    }

    private animate = () => {
        this.animationId = requestAnimationFrame(this.animate);

        for (let i = 0; i < 3; i++) {
            const renderer = this.renderers[i];
            const camera = this.cameras[i];
            const scene = this.scenes[i];

            if (renderer && scene && camera) {
                // Auto-Resize Logic
                const currentW = renderer.domElement.clientWidth;
                const currentH = renderer.domElement.clientHeight;
                const cached = this.cache[i];

                if (cached && (currentW !== cached.width || currentH !== cached.height)) {
                    if (currentW > 0 && currentH > 0) {
                        // console.log(`[ThreeRenderer] Resizing Projector ${ i } to ${ currentW }x${ currentH } `);
                        renderer.setSize(currentW, currentH, false);
                        camera.right = currentW;
                        camera.bottom = currentH;
                        camera.top = 0;
                        camera.updateProjectionMatrix();

                        // Force warp update with new dimensions
                        this.updateGridWarp(i, cached.grid, cached.rows, cached.cols, cached.mode);
                    }
                }

                renderer.render(scene, camera);
            }
        }
    }

    public dispose() {
        if (this.animationId) cancelAnimationFrame(this.animationId);

        this.renderers.forEach(r => {
            if (r?.domElement.parentElement) {
                r.domElement.parentElement.removeChild(r.domElement);
            }
            r?.dispose();
        });

        if (this.texture) this.texture.dispose();

        this.meshes.forEach(m => {
            m?.geometry.dispose();
            (m?.material as THREE.Material)?.dispose();
        });

        this.renderers = [null, null, null];
        this.scenes = [null, null, null];
        this.meshes = [null, null, null];
        this.cache = [null, null, null];
    }
}
