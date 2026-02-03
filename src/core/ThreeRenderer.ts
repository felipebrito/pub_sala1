import * as THREE from 'three';
import { WarpMath } from './WarpMath';

export class ThreeRenderer {
    private renderers: THREE.WebGLRenderer[] = [];
    private scenes: THREE.Scene[] = [];
    private cameras: THREE.OrthographicCamera[] = [];
    private meshes: THREE.Mesh[] = [];
    private texture: THREE.VideoTexture | null = null;
    private animationId: number | null = null;

    // Display dimensions
    private readonly width = 360;
    private readonly height = 202;

    constructor(container1: HTMLElement, container2: HTMLElement, container3: HTMLElement) {
        const containers = [container1, container2, container3];

        containers.forEach((container, i) => {
            // 1. Setup Renderer
            const renderer = new THREE.WebGLRenderer({
                antialias: true,
                alpha: true
            });
            renderer.setSize(this.width, this.height);
            renderer.setPixelRatio(window.devicePixelRatio);
            container.appendChild(renderer.domElement);
            this.renderers.push(renderer);

            // 2. Setup Scene
            const scene = new THREE.Scene();
            scene.background = new THREE.Color(0x1a1a1a);
            this.scenes.push(scene);

            // 3. Setup Camera
            const camera = new THREE.OrthographicCamera(
                0, this.width,
                0, this.height,
                0.1, 1000
            );
            camera.position.z = 10;
            camera.updateProjectionMatrix();
            this.cameras.push(camera);

            // 4. Create Warping Mesh (High Density 32x32)
            const gridX = 32;
            const gridY = 32;
            const geometry = new THREE.PlaneGeometry(this.width, this.height, gridX, gridY);

            // Initial UV Mapping Logic (Slicing 1/3 per projector)
            const uvAttribute = geometry.attributes.uv;
            const sliceWidth = 1.0 / 3.0;
            const uMin = i * sliceWidth;
            const uMax = (i + 1) * sliceWidth;

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
            this.meshes.push(mesh);
        });

        this.animate();
    }

    public setVideo(video: HTMLVideoElement) {
        console.log('[ThreeRenderer] Setting video...');
        this.texture = new THREE.VideoTexture(video);
        this.texture.colorSpace = THREE.SRGBColorSpace;
        this.texture.minFilter = THREE.LinearFilter;
        this.texture.magFilter = THREE.LinearFilter;

        this.meshes.forEach(mesh => {
            const material = mesh.material as THREE.MeshBasicMaterial;
            material.map = this.texture;
            material.needsUpdate = true;
        });
        console.log('[ThreeRenderer] Video texture applied');
    }

    public updateWarping(index: number, points: { x: number; y: number }[]) {
        if (!this.meshes[index]) return;

        // Convert 4 Corner Points to 2x2 Grid for Interpolation
        // Input: [TL, TR, BR, BL] (Clockwise)
        // Grid needs: [[TL, TR], [BL, BR]]
        // Note: Our points[3] is BL (Clockwise order: TL, TR, BR, BL) implies points[2] is BR.
        // Wait, check DEFAULT_WARP order in App.tsx:
        // 0:TL, 1:TR, 2:BR, 3:BL.
        // So Grid Row 1 (Bottom) is [BL, BR] -> [points[3], points[2]].

        const grid = [
            [points[0], points[1]], // Top Row
            [points[3], points[2]]  // Bottom Row
        ];

        this.updateGridWarp(index, grid, 2, 2);
    }

    public updateGridWarp(index: number, points: { x: number; y: number }[][], rows: number, cols: number) {
        if (!this.meshes[index]) return;

        const mesh = this.meshes[index];
        const geometry = mesh.geometry;
        const positions = geometry.attributes.position;

        const meshSegsX = 32; // Must match constructor
        const meshSegsY = 32;

        for (let iy = 0; iy <= meshSegsY; iy++) {
            const v = iy / meshSegsY; // 0..1
            for (let ix = 0; ix <= meshSegsX; ix++) {
                const u = ix / meshSegsX; // 0..1

                // Interpolate using Spline/Bilinear logic
                const pos = WarpMath.interpolate(u, v, points, cols, rows);

                const idx = iy * (meshSegsX + 1) + ix;
                positions.setXYZ(idx, pos.x, pos.y, 0);
            }
        }

        positions.needsUpdate = true;
    }

    public updateInputCrop(index: number, crop: { x: number, y: number, width: number, height: number }) {
        if (!this.meshes[index]) return;

        const mesh = this.meshes[index];
        const geometry = mesh.geometry;
        const uvAttribute = geometry.attributes.uv;

        const uMin = crop.x;
        const uMax = crop.x + crop.width;

        // V=1 is Top, V=0 is Bottom
        const vTop = 1 - crop.y;
        const vBottom = 1 - (crop.y + crop.height);

        const gridX = 32;
        const gridY = 32;

        for (let iy = 0; iy <= gridY; iy++) {
            const vParam = iy / gridY; // 0 (top line) to 1 (bottom line)

            // Interpolate V
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
            this.renderers[i].render(this.scenes[i], this.cameras[i]);
        }
    }

    public dispose() {
        if (this.animationId) cancelAnimationFrame(this.animationId);

        this.renderers.forEach(r => {
            r.domElement.remove();
            r.dispose();
        });

        if (this.texture) this.texture.dispose();

        this.meshes.forEach(m => {
            m.geometry.dispose();
            (m.material as THREE.Material).dispose();
        });

        this.renderers = [];
        this.scenes = [];
        this.meshes = [];
    }
}
