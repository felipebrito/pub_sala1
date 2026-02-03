import * as THREE from 'three';
import { WarpMath } from './WarpMath';

export interface RendererTarget {
    index: number;
    container: HTMLElement;
}

export class ThreeRenderer {
    private renderers: (THREE.WebGLRenderer | null)[] = [null, null, null];
    private scenes: (THREE.Scene | null)[] = [null, null, null];
    private cameras: (THREE.OrthographicCamera | null)[] = [null, null, null];
    private meshes: (THREE.Mesh | null)[] = [null, null, null];

    private texture: THREE.VideoTexture | null = null;
    private animationId: number | null = null;

    // Display dimensions (Virtual Canvas Resolution)
    // If fullscreen, we might want to adapt? 
    // Usually mapping software keeps internal resolution fixed (e.g. 1920x1080) and scales CSS.
    // Here we use fixed small resolution for preview (360x202) but for Output we might want full res?
    // User requested "Fullscreen".
    // If we use Fixed Resolution geometry, the "Warping" logic operates on that resolution.
    // If output window is 1920x1080, we should render at that resolution or scale up?
    // For now, let's keep the logic consistent: 
    // The renderer uses clientWidth/clientHeight of the container. 

    constructor(targets: RendererTarget[]) {
        targets.forEach(({ index, container }) => {
            const width = container.clientWidth;
            const height = container.clientHeight;

            // 1. Setup Renderer
            const renderer = new THREE.WebGLRenderer({
                antialias: true,
                alpha: true
            });
            renderer.setSize(width, height);
            renderer.setPixelRatio(window.devicePixelRatio);

            container.appendChild(renderer.domElement);
            this.renderers[index] = renderer;

            // 2. Setup Scene
            const scene = new THREE.Scene();
            scene.background = new THREE.Color(0x000000); // Black background for output
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
            const geometry = new THREE.PlaneGeometry(width, height, gridX, gridY);

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

            const material = new THREE.MeshBasicMaterial({
                color: 0xffffff,
                side: THREE.DoubleSide,
                map: null
            });

            const mesh = new THREE.Mesh(geometry, material);
            scene.add(mesh);
            this.meshes[index] = mesh;

            // Resize handler for this specific container
            const onResize = () => {
                const w = container.clientWidth;
                const h = container.clientHeight;
                renderer.setSize(w, h);
                camera.right = w;
                camera.top = h;
                camera.updateProjectionMatrix();
                // Note: Geometry is NOT resized automatically, warping points are relative to absolute Resolution.
                // If we resize window, we stretch the canvas.
            };
            window.addEventListener('resize', onResize);
        });

        this.animate();
    }

    public setVideo(video: HTMLVideoElement) {
        if (this.texture) this.texture.dispose();

        console.log('[ThreeRenderer] Setting new video texture');
        this.texture = new THREE.VideoTexture(video);
        this.texture.colorSpace = THREE.SRGBColorSpace;
        this.texture.minFilter = THREE.LinearFilter;
        this.texture.magFilter = THREE.LinearFilter;

        this.meshes.forEach(mesh => {
            if (mesh) {
                const material = mesh.material as THREE.MeshBasicMaterial;
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
        if (!mesh) return;

        const geometry = mesh.geometry;
        const positions = geometry.attributes.position;
        const width = (geometry as any).parameters.width;
        const height = (geometry as any).parameters.height;

        // Scale factor: Points come in Preview coordinates (360x202).
        // If we are in Output mode (FullHD), we must scale points up.
        // HACK: We assume input points are normalized 0..1 relative to Preview (360x202),
        // OR we just normalize them now.
        // The points from App.tsx are PIXELS (0..360, 0..202).
        // We need to map them to CURRENT Renderer Size.

        // Let's normalize points based on PREVIEW_WIDTH/HEIGHT constants (360, 202)
        // defined in the App logic, and remap to current geometry width/height.
        const PREVIEW_WIDTH = 360;
        const PREVIEW_HEIGHT = 202;

        // However, for simplicity now, let's just pass the raw points to WarpMath 
        // and hope WarpMath handles it?
        // No, WarpMath.interpolate returns a coordinate in the same space as input points (Pixels).
        // If mesh is 1920x1080 but points are 0..360, warping will be tiny in top left corner.

        // FIX: Normalize points before passing to Interpolator?
        // Or Normalize output of interpolate?
        // Best: Normalize Control Points.

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
    }

    private animate = () => {
        this.animationId = requestAnimationFrame(this.animate);
        for (let i = 0; i < 3; i++) {
            if (this.renderers[i] && this.scenes[i] && this.cameras[i]) {
                this.renderers[i]!.render(this.scenes[i]!, this.cameras[i]!);
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
    }
}
