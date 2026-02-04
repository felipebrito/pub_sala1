
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

    // Masking Resources (Per Projector)
    private maskCanvases: HTMLCanvasElement[] = [];
    private maskContexts: CanvasRenderingContext2D[] = [];
    private maskTextures: THREE.CanvasTexture[] = [];

    // Cache for Auto-Resize Logic
    private cache: (StateCache | null)[] = [null, null, null];

    constructor(targets: InitOptions[]) {
        targets.forEach(({ index, container }) => {
            const width = container.clientWidth;
            const height = container.clientHeight;

            // 1. Setup Renderer
            const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
            renderer.setSize(width, height);
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
            const geometry = new THREE.PlaneGeometry(width, height, 32, 32);

            // Fix UVs to cover full texture initially (inverted Y for standard GL mapping)
            const uvAttribute = geometry.attributes.uv;
            const gridX = 32;
            const gridY = 32;
            for (let i = 0; i < uvAttribute.count; i++) {
                const ix = i % (gridX + 1);
                const iy = Math.floor(i / (gridX + 1));
                const u = ix / gridX;
                const v = 1 - (iy / gridY); // Standard UV (Bottom-Left=0,0)
                uvAttribute.setXY(i, u, v);
            }

            uvAttribute.needsUpdate = true;

            // Setup Masking Canvas
            const mCanvas = document.createElement('canvas');
            mCanvas.width = 1024;
            mCanvas.height = 576; // 16:9 aspect
            const mCtx = mCanvas.getContext('2d', { willReadFrequently: true })!;

            // Default White (Visible)
            mCtx.fillStyle = 'white';
            mCtx.fillRect(0, 0, 1024, 576);

            const mTexture = new THREE.CanvasTexture(mCanvas);
            mTexture.minFilter = THREE.LinearFilter;
            mTexture.magFilter = THREE.LinearFilter;
            mTexture.colorSpace = THREE.NoColorSpace;

            this.maskCanvases[index] = mCanvas;
            this.maskContexts[index] = mCtx;
            this.maskTextures[index] = mTexture;

            const material = new EdgeBlendMaterial();
            // Bind Mask Texture
            if (material.uniforms.maskMap) material.uniforms.maskMap.value = mTexture;

            if (this.texture) material.map = this.texture;

            const mesh = new THREE.Mesh(geometry, material);
            scene.add(mesh);
            this.meshes[index] = mesh;
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
        // Make sure texture is available to all shaders
        this.meshes.forEach(mesh => {
            if (mesh) {
                const material = mesh.material as EdgeBlendMaterial;
                material.map = this.texture;
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

        // Cache state for auto-resize
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
                const posNorm = WarpMath.interpolate(u, v, normPoints, cols, rows, mode);
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

        // Invert Y for V (Standard GL: Bottom-Left origin)
        // If crop.y is Top (0), and height is 1. (0 to 1).
        // we want v from 1 to 0. (Top to Bottom).
        const vTop = 1 - crop.y;
        const vBottom = 1 - (crop.y + crop.height);

        const gridX = 32;
        const gridY = 32;

        for (let iy = 0; iy <= gridY; iy++) {
            const vParam = iy / gridY; // 0 (top) to 1 (bottom) in geometry
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
                // Pass raw UV bounds? No, pass U range and V range.
                // Shader calculates local UV.
                // We pass Umin, Umax, Vmin, Vmax (in standard 0..1 space).
                // Actually Vmin, Vmax should be the bounds in 0..1 texture space?
                // Our V goes from vTop (1) to vBottom (0).
                // Let's pass ( uMin, uMax, vBottom, vTop ).
                mat.uniforms.cropInfo.value.set(uMin, uMax, vBottom, vTop);
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

    public resize(index: number, width: number, height: number) {
        const renderer = this.renderers[index];
        const camera = this.cameras[index];
        if (!renderer || !camera) return;

        renderer.setSize(width, height);

        // Update Ortho Camera View Volume
        // 0, width, 0, height.
        camera.right = width;
        camera.bottom = height;
        camera.updateProjectionMatrix();

        // Re-apply Warp with new dimensions
        const cache = this.cache[index];
        if (cache) {
            cache.width = width;
            cache.height = height;
            // Force re-calculation
            this.updateGridWarp(index, cache.grid, cache.rows, cache.cols, cache.mode);
        }
    }

    public updateMasks(index: number, masks: { x: number, y: number }[][]) {
        const ctx = this.maskContexts[index];
        const canvas = this.maskCanvases[index];
        const texture = this.maskTextures[index];
        if (!ctx || !canvas || !texture) return;

        // Reset to White (Visible)
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Draw Masks (Black)
        ctx.fillStyle = 'black';
        ctx.beginPath();

        masks.forEach(points => {
            if (points.length < 3) return;
            // Scale from Preview (360x202) to Canvas (1024x576)
            const scaleX = canvas.width / 360;
            const scaleY = canvas.height / 202;

            ctx.moveTo(points[0].x * scaleX, points[0].y * scaleY);
            for (let i = 1; i < points.length; i++) {
                ctx.lineTo(points[i].x * scaleX, points[i].y * scaleY);
            }
            ctx.closePath();
            ctx.fill();
        });

        texture.needsUpdate = true;
    }

    private animate = () => {
        this.animationId = requestAnimationFrame(this.animate);

        for (let i = 0; i < 3; i++) {
            const renderer = this.renderers[i];
            const camera = this.cameras[i];
            const scene = this.scenes[i];

            if (renderer && scene && camera) {
                renderer.render(scene, camera);
            }
        }
    }

    public dispose() {
        if (this.animationId) cancelAnimationFrame(this.animationId);
        this.renderers.forEach(r => r?.dispose());
        this.meshes.forEach(m => {
            if (m) {
                m.geometry.dispose();
                (m.material as THREE.Material).dispose();
            }
        });
        this.renderers = [null, null, null];
        this.scenes = [null, null, null];
        this.meshes = [null, null, null];
        this.cache = [null, null, null];
        this.maskCanvases = [];
        this.maskContexts = [];
        this.maskTextures.forEach(t => t.dispose());
        this.maskTextures = [];
    }
}
