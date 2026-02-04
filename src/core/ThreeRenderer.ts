
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
    private textureA: THREE.VideoTexture | null = null;
    private textureB: THREE.VideoTexture | null = null;
    private animationId: number | null = null;

    // Masking Resources (Per Projector)
    private maskCanvases: HTMLCanvasElement[] = [];
    private maskContexts: CanvasRenderingContext2D[] = [];
    private maskTextures: THREE.CanvasTexture[] = [];

    // Cache for Auto-Resize Logic
    private cache: (StateCache | null)[] = [null, null, null];

    // Video Elements (for direct pixel sampling)
    private videoA: HTMLVideoElement | null = null;
    private videoB: HTMLVideoElement | null = null;

    // Internal sampling assets
    private samplingCanvas: HTMLCanvasElement;
    private samplingCtx: CanvasRenderingContext2D | null;

    constructor(targets: InitOptions[]) {
        // Init sampling canvas
        this.samplingCanvas = document.createElement('canvas');
        this.samplingCtx = this.samplingCanvas.getContext('2d', { willReadFrequently: true });

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

            const material = new EdgeBlendMaterial();
            if (this.textureA) material.map = this.textureA;

            const mesh = new THREE.Mesh(geometry, material);
            scene.add(mesh);
            this.meshes[index] = mesh;
        });

        this.animate();
    }

    public setVideos(videoA: HTMLVideoElement | null, videoB: HTMLVideoElement | null) {
        // Handle Video A
        if (videoA && (!this.textureA || this.textureA.image !== videoA)) {
            if (this.textureA) this.textureA.dispose();
            console.log('[ThreeRenderer] Setting Video A:', videoA.currentSrc);
            // Ensure CORS is set before texture creation to avoid SecurityError
            if (videoA.crossOrigin !== 'anonymous') videoA.crossOrigin = 'anonymous';
            this.textureA = new THREE.VideoTexture(videoA);
            this.textureA.colorSpace = THREE.SRGBColorSpace;
            this.textureA.minFilter = THREE.LinearFilter;
            this.textureA.magFilter = THREE.LinearFilter;
        }

        // Handle Video B
        if (videoB && (!this.textureB || this.textureB.image !== videoB)) {
            if (this.textureB) this.textureB.dispose();
            console.log('[ThreeRenderer] Setting Video B:', videoB.currentSrc);
            // Ensure CORS is set before texture creation
            if (videoB.crossOrigin !== 'anonymous') videoB.crossOrigin = 'anonymous';
            this.textureB = new THREE.VideoTexture(videoB);
            this.textureB.colorSpace = THREE.SRGBColorSpace;
            this.textureB.minFilter = THREE.LinearFilter;
            this.textureB.magFilter = THREE.LinearFilter;
        }

        this.videoA = videoA;
        this.videoB = videoB;

        // Update Meshes
        this.meshes.forEach(mesh => {
            if (mesh) {
                const material = mesh.material as EdgeBlendMaterial;
                if (this.textureA) material.map = this.textureA;
                if (this.textureB) material.map2 = this.textureB;
                material.needsUpdate = true;
            }
        });
    }

    public setCrossfade(mix: number) {
        this.meshes.forEach(mesh => {
            if (mesh) {
                const material = mesh.material as EdgeBlendMaterial;
                material.mixVideo = mix;
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

    public resize(index: number, width: number, height: number) {
        const renderer = this.renderers[index];
        const camera = this.cameras[index];
        const mesh = this.meshes[index];
        if (!renderer || !camera || !mesh) return;

        renderer.setSize(width, height);
        camera.right = width;
        camera.bottom = height;
        camera.updateProjectionMatrix();

        // Re-apply warp with new dimensions
        const state = this.cache[index];
        if (state) {
            this.updateGridWarp(index, state.grid, state.rows, state.cols, state.mode);
        }
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
                const uMin = crop.x;
                const uMax = crop.x + crop.width;
                const vMin = crop.y;
                const vMax = crop.y + crop.height;
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

    private isDisposed = false;

    private animate = () => {
        if (this.isDisposed) return;
        this.animationId = requestAnimationFrame(this.animate);

        // Update Textures
        // Note: VideoTexture generally handles this, but explicit update helps with hot-swapping sources
        // if (this.textureA) this.textureA.needsUpdate = true; // VideoTexture handles this internally usually
        // if (this.textureB) this.textureB.needsUpdate = true;

        for (let i = 0; i < 3; i++) {
            const renderer = this.renderers[i];
            const camera = this.cameras[i];
            const scene = this.scenes[i];

            if (renderer && scene && camera) {
                // Resize check if needed? No, resize handled by event.
                renderer.render(scene, camera);
            }
        }
    }

    /**
     * Samples a horizontal line of pixels from the specified renderer.
     * Returns an RGB Uint8Array of size [count * 3].
     */
    public samplePixels(index: number, count: number): Uint8Array | null {
        const renderer = this.renderers[index];
        if (!renderer) return null;

        const gl = renderer.getContext();
        const width = gl.drawingBufferWidth;
        const height = gl.drawingBufferHeight;

        // Sample middle row
        const y = Math.floor(height / 2);

        // We only read the exact pixels we need to resample later, 
        // or a full row if it's easier. A full row is safer for aliasing.
        const rowData = new Uint8Array(width * 4);
        gl.readPixels(0, y, width, 1, gl.RGBA, gl.UNSIGNED_BYTE, rowData);

        const result = new Uint8Array(count * 3);
        const step = width / count;

        for (let i = 0; i < count; i++) {
            const sampleX = Math.floor(i * step);
            const sourceIdx = sampleX * 4;
            result[i * 3] = rowData[sourceIdx];     // R
            result[i * 3 + 1] = rowData[sourceIdx + 1]; // G
            result[i * 3 + 2] = rowData[sourceIdx + 2]; // B
        }

        return result;
    }

    /**
     * Samples a specific row of pixels directly from source videos with high-quality averaging.
     * Use this to get the "Clean" signal without warp/crop distortion.
     * @param count Target pixel count (usually 180 for LEDs)
     * @param lineIndex 1-based line number (e.g., 1 to 1081)
     * @param mix Crossfade value (0 = Idle, 1 = Main)
     */
    public sampleMixedSource(count: number, lineIndex: number, mix: number): Uint8Array | null {
        if (!this.samplingCtx) return null;

        if (this.samplingCanvas.width !== count) {
            this.samplingCanvas.width = count;
            this.samplingCanvas.height = 1;
        }

        this.samplingCtx.clearRect(0, 0, count, 1);
        this.samplingCtx.imageSmoothingEnabled = true;
        this.samplingCtx.imageSmoothingQuality = 'high';

        const windowHeight = 10;

        // Draw Video A (Idle)
        if (this.videoA && this.videoA.readyState >= 2 && mix < 1.0) {
            const h = this.videoA.videoHeight;
            const y = Math.min(Math.max(0, lineIndex - 5), h - windowHeight);
            this.samplingCtx.globalAlpha = 1.0 - mix;
            this.samplingCtx.drawImage(
                this.videoA,
                0, y, this.videoA.videoWidth, windowHeight,
                0, 0, count, 1
            );
        }

        // Draw Video B (Main)
        if (this.videoB && this.videoB.readyState >= 2 && mix > 0.0) {
            const h = this.videoB.videoHeight;
            const y = Math.min(Math.max(0, lineIndex - 5), h - windowHeight);
            this.samplingCtx.globalAlpha = mix;
            this.samplingCtx.globalCompositeOperation = 'lighter';
            this.samplingCtx.drawImage(
                this.videoB,
                0, y, this.videoB.videoWidth, windowHeight,
                0, 0, count, 1
            );
            this.samplingCtx.globalCompositeOperation = 'source-over';
        }

        this.samplingCtx.globalAlpha = 1.0;
        return this._pixelDataFromCanvas(count);
    }

    /**
     * Samples a specific row of pixels from a single video source with averaging.
     */
    public sampleVideo(type: 'idle' | 'main', count: number, lineIndex: number): Uint8Array | null {
        const video = type === 'idle' ? this.videoA : this.videoB;
        if (!video || video.readyState < 2 || !this.samplingCtx) return null;

        if (this.samplingCanvas.width !== count) {
            this.samplingCanvas.width = count;
            this.samplingCanvas.height = 1;
        }

        this.samplingCtx.clearRect(0, 0, count, 1);
        this.samplingCtx.imageSmoothingEnabled = true;
        this.samplingCtx.imageSmoothingQuality = 'high';

        const windowHeight = 10;
        const y = Math.min(Math.max(0, lineIndex - 5), video.videoHeight - windowHeight);

        this.samplingCtx.drawImage(video, 0, y, video.videoWidth, windowHeight, 0, 0, count, 1);
        return this._pixelDataFromCanvas(count);
    }

    private _pixelDataFromCanvas(count: number): Uint8Array {
        const rowData = this.samplingCtx!.getImageData(0, 0, count, 1).data;
        const result = new Uint8Array(count * 3);
        for (let i = 0; i < count; i++) {
            const idx = i * 4;
            result[i * 3] = rowData[idx];
            result[i * 3 + 1] = rowData[idx + 1];
            result[i * 3 + 2] = rowData[idx + 2];
        }
        return result;
    }

    public dispose() {
        this.isDisposed = true;
        if (this.animationId) cancelAnimationFrame(this.animationId);

        this.renderers.forEach(r => {
            if (r) {
                // r.forceContextLoss(); // Optional: force context loss if needed
                r.dispose();
                if (r.domElement && r.domElement.parentElement) {
                    r.domElement.parentElement.removeChild(r.domElement);
                }
            }
        });

        this.meshes.forEach(m => {
            if (m) {
                m.geometry.dispose();
                (m.material as THREE.Material).dispose();
            }
        });

        if (this.textureA) this.textureA.dispose();
        if (this.textureB) this.textureB.dispose();

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
