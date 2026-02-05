import { useRef, useEffect } from 'react';
import * as THREE from 'three';
import { WarpMath } from '../../core/WarpMath';

interface WarpCanvasProps {
    videoSource: string | null;
    grid: { x: number; y: number }[][];
    rows: number;
    cols: number;
    width: number;
    height: number;
    recordingTrigger?: number;
}

export function WarpCanvas({ videoSource, grid, rows, cols, width, height, recordingTrigger }: WarpCanvasProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
    const sceneRef = useRef<THREE.Scene | null>(null);
    const cameraRef = useRef<THREE.OrthographicCamera | null>(null);
    const meshRef = useRef<THREE.Mesh | null>(null);
    const textureRef = useRef<THREE.VideoTexture | null>(null);
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const frameIdRef = useRef<number>(0);

    // Initialize Three.js
    useEffect(() => {
        if (!containerRef.current) return;

        // Renderer
        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true }); // preserverDrawingBuffer true for recording later
        renderer.setSize(width, height);
        renderer.setPixelRatio(window.devicePixelRatio);
        containerRef.current.appendChild(renderer.domElement);
        rendererRef.current = renderer;

        // Scene
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x000000); // Black background
        sceneRef.current = scene;

        // Camera
        const camera = new THREE.OrthographicCamera(0, width, 0, height, 0.1, 1000);
        camera.position.z = 10;
        camera.updateProjectionMatrix();
        cameraRef.current = camera;
        scene.add(camera);

        // Plane Mesh (32x32 segments for smooth warp)
        const geometry = new THREE.PlaneGeometry(width, height, 32, 32);

        // Correct UVs (Standard GL: Origin Bottom-Left. Video Texture: Top-Left usually needs flipping or specific handling)
        // Three.js VideoTexture usually works fine with standard Plane UVs if map.flipY is defaults. 
        // But Sala_1 inverted V. Let's start with standard and see.
        // Actually, let's copy Sala_1's UV logic to be safe to match their WarpMath expectations.
        const uvAttribute = geometry.attributes.uv;
        const gridX = 32;
        const gridY = 32;
        for (let i = 0; i < uvAttribute.count; i++) {
            const ix = i % (gridX + 1);
            const iy = Math.floor(i / (gridX + 1));
            const u = ix / gridX;
            const v = 1 - (iy / gridY); // Invert Y
            uvAttribute.setXY(i, u, v);
        }
        uvAttribute.needsUpdate = true;

        const material = new THREE.MeshBasicMaterial({ color: 0xffffff });
        const mesh = new THREE.Mesh(geometry, material);
        scene.add(mesh);
        meshRef.current = mesh;

        // Animation Loop
        const animate = () => {
            frameIdRef.current = requestAnimationFrame(animate);
            renderer.render(scene, camera);
        };
        animate();

        return () => {
            cancelAnimationFrame(frameIdRef.current);
            renderer.dispose();
            if (containerRef.current) {
                containerRef.current.innerHTML = '';
            }
        };
    }, []); // Run once on mount (or when container changes, but here empty deps is safer for init)

    // Handle Resize
    useEffect(() => {
        if (!rendererRef.current || !cameraRef.current || !meshRef.current) return;

        rendererRef.current.setSize(width, height);
        cameraRef.current.right = width;
        cameraRef.current.bottom = height;
        cameraRef.current.updateProjectionMatrix();

        // We might need to recreate geometry if size changes drastically or just scale. 
        // But since we modify vertices manually in Warp, we will update them anyway in the Grid effect.
    }, [width, height]);


    // Handle Video Source
    useEffect(() => {
        if (!meshRef.current || !videoSource) return;

        const loadVideo = async () => {
            const video = document.createElement('video');
            video.crossOrigin = 'anonymous';
            video.src = videoSource;
            video.loop = true;
            video.muted = true;
            video.playsInline = true;
            await video.play();

            videoRef.current = video;

            const texture = new THREE.VideoTexture(video);
            texture.colorSpace = THREE.SRGBColorSpace;
            texture.minFilter = THREE.LinearFilter;
            texture.magFilter = THREE.LinearFilter;

            textureRef.current = texture;
            (meshRef.current!.material as THREE.MeshBasicMaterial).map = texture;
            (meshRef.current!.material as THREE.MeshBasicMaterial).needsUpdate = true;
        };

        loadVideo();

        return () => {
            if (textureRef.current) textureRef.current.dispose();
            if (videoRef.current) videoRef.current.pause();
        }
    }, [videoSource]);

    // Handle Scan/Restart Trigger
    useEffect(() => {
        if (recordingTrigger && recordingTrigger > 0 && videoRef.current) {
            videoRef.current.currentTime = 0;
            videoRef.current.play().catch(console.error);
        }
    }, [recordingTrigger]);

    // Handle Warp Update
    useEffect(() => {
        if (!meshRef.current || !rendererRef.current) return;

        const mesh = meshRef.current;
        const geometry = mesh.geometry;
        const positions = geometry.attributes.position;

        // Ensure geometry matches current size logic if needed, but we used initial width/height.
        // If width/height changes, we should ideally re-init geometry. 
        // For now assume width/height passed to this component is the "Render Size".

        const meshSegsX = 32;
        const meshSegsY = 32;

        for (let iy = 0; iy <= meshSegsY; iy++) {
            const v = iy / meshSegsY; // 0..1
            for (let ix = 0; ix <= meshSegsX; ix++) {
                const u = ix / meshSegsX; // 0..1

                // Interpolate using the provided grid (which should be in normalized coords or similar)
                // Sala_1 code used `normPoints`. We expect `grid` to be passed as Normalized (0..1) coords for simplicity in this new specific app.
                // Or we adapt. Let's assume `grid` contains normalized coordinates x,y in [0,1].

                const posNorm = WarpMath.interpolate(u, v, grid, cols, rows, 'bicubic');

                const idx = iy * (meshSegsX + 1) + ix;
                positions.setXYZ(idx, posNorm.x * width, posNorm.y * height, 0);
            }
        }

        positions.needsUpdate = true;

    }, [grid, rows, cols, width, height]);

    return <div ref={containerRef} className="w-full h-full" />;
}
