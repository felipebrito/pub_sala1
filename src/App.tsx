import { useState, useEffect, useRef, useCallback } from 'react'
import { ThreeRenderer } from './core/ThreeRenderer'
import { TEST_VIDEOS } from './constants/videos';
import { Play, Pause, Grid3X3, MousePointer2, ExternalLink, RotateCcw } from 'lucide-react'

// Types
interface Point { x: number; y: number }
interface Crop { x: number, y: number, width: number, height: number }
interface EdgeBlendConfig { left: number; right: number; top: number; bottom: number; gamma: number; }
interface ProjectorConfig {
    grid: Point[][]; // [rows][cols]
    rows: number;
    cols: number;
    crop: Crop;
    edgeBlend: EdgeBlendConfig;
    mode: 'linear' | 'bicubic'; // visualization/interaction mode: linear=Quad (2x2), bicubic=Bezier (Handles)
    flipH?: boolean;
    flipV?: boolean;
    masks?: { id: string; points: Point[] }[];
}

// Helper: Equidistant Grid
const createDefaultGrid = (rows: number, cols: number, width = 360, height = 202): Point[][] => {
    const grid: Point[][] = [];
    for (let r = 0; r < rows; r++) {
        const row: Point[] = [];
        for (let c = 0; c < cols; c++) {
            row.push({
                x: (c / (cols - 1)) * width,
                y: (r / (rows - 1)) * height
            });
        }
        grid.push(row);
    }
    return grid;
};

// Auto-calculate internal points (P11, P12, P21, P22) for a 4x4 grid using Linear Coons Patch approximation
// to ensure the surface follows the Bezier edges smoothly without manual internal controls.
const calculateInternalPoints = (grid: Point[][]): Point[][] => {
    if (grid.length !== 4 || grid[0].length !== 4) return grid;

    // Indices
    // 00 01 02 03
    // 10 11 12 13
    // 20 21 22 23
    // 30 31 32 33

    const newGrid = grid.map(row => row.map(p => ({ ...p })));

    // We need to solve for 11, 12, 21, 22 based on the boundary.
    // Simple approach: Bilinear interpolation of the opposing boundaries.

    for (let i = 1; i <= 2; i++) {
        for (let j = 1; j <= 2; j++) {
            const u = j / 3;
            const v = i / 3;

            // Ruled surface approximations
            // L_c(u, v) = (1-v)*P(u, 0) + v*P(u, 1)  <-- Vertical linear interpolation between Top and Bottom Curves
            // But P(u,0) is point on top curve. We don't have the curve function, just control points.
            // Actually, for 4x4 Bezier, the inner points *define* the surface.
            // To make it "well behaved" like a Coons patch, we can interpolate.

            // Simplest heuristic: Average of horizontal and vertical linear interpolations of control points
            const left = newGrid[i][0];
            const right = newGrid[i][3];
            const top = newGrid[0][j];
            const bottom = newGrid[3][j];

            // Linearly interpolate row i
            const lx = left.x + (right.x - left.x) * (j / 3);
            const ly = left.y + (right.y - left.y) * (j / 3);

            // Linearly interpolate col j
            const cx = top.x + (bottom.x - top.x) * (i / 3);
            const cy = top.y + (bottom.y - top.y) * (i / 3);

            newGrid[i][j].x = (lx + cx) / 2;
            newGrid[i][j].y = (ly + cy) / 2;
        }
    }
    return newGrid;
};

// Default Config
// Default Config
const DEFAULT_CONFIGS = (): ProjectorConfig[] => [0, 1, 2].map(i => ({
    rows: 2,
    cols: 2,
    grid: createDefaultGrid(2, 2),
    mode: 'linear', // Default to Quad
    crop: {
        x: i * (1 / 3),
        y: 0,
        width: 1 / 3,
        height: 1
    },
    edgeBlend: { left: 0, right: 0, top: 0, bottom: 0, gamma: 1.0 }
}));

// PROJECT MEDIA: Add your local files here (place them in public/videos/)
const LOCAL_VIDEOS: { title: string; filename: string }[] = [
    // Example: { title: 'My Video', filename: 'myvideo.mp4' }
    // { title: 'Dinosaur Animation', filename: 'dino.mp4' },
];

const OutputWindow = ({ index }: { index: number }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasWrapperRef = useRef<HTMLDivElement>(null);
    // Dual Video Refs for Output
    const idleVideoRef = useRef<HTMLVideoElement>(null);
    const mainVideoRef = useRef<HTMLVideoElement>(null);

    const rendererRef = useRef<ThreeRenderer | null>(null);
    const [config, setConfig] = useState<ProjectorConfig | null>(null);
    const [isFs, setIsFs] = useState(false);
    const [aspectLock, setAspectLock] = useState(false);

    // Initial Setup
    useEffect(() => {
        const onFs = () => setIsFs(!!document.fullscreenElement);
        document.addEventListener('fullscreenchange', onFs);
        if (!canvasWrapperRef.current) return;

        // Hide cursor setup
        let timeout: any;
        const onMove = () => {
            document.body.style.cursor = 'default';
            clearTimeout(timeout);
            timeout = setTimeout(() => document.body.style.cursor = 'none', 3000);
        };
        window.addEventListener('mousemove', onMove);

        // Shortcuts 'F' and 'A'
        const onKey = (e: KeyboardEvent) => {
            const k = e.key.toLowerCase();
            if (k === 'f') {
                if (!document.fullscreenElement) {
                    containerRef.current?.requestFullscreen().catch(e => console.error(e));
                } else {
                    document.exitFullscreen().catch(e => console.error(e));
                }
            }
            if (k === 'a') {
                setAspectLock(prev => !prev);
            }
        };
        window.addEventListener('keydown', onKey);

        // Init Renderer targetting wrapper
        const r = new ThreeRenderer([{ index, container: canvasWrapperRef.current }]);
        rendererRef.current = r;

        // Sync Function for Config
        const syncConfig = () => {
            const str = localStorage.getItem('lumina-config-v4');
            if (str) {
                try {
                    const configs: ProjectorConfig[] = JSON.parse(str);
                    const conf = configs[index];
                    if (conf) {
                        setConfig(conf);
                        r.updateInputCrop(index, conf.crop);
                        r.updateGridWarp(index, conf.grid, conf.rows, conf.cols, conf.mode);
                        if (conf.edgeBlend) r.updateEdgeBlend(index, conf.edgeBlend);
                    }
                } catch (e) { console.error('Config parse error', e); }
            }
        };

        syncConfig();
        window.addEventListener('storage', syncConfig);

        return () => {
            r.dispose();
            rendererRef.current = null;
            window.removeEventListener('storage', syncConfig);
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('keydown', onKey);
            document.removeEventListener('fullscreenchange', onFs);
        }
    }, [index]);

    // Handle Resize keep warp correct
    useEffect(() => {
        const handleResize = () => {
            if (rendererRef.current && canvasWrapperRef.current) {
                // Resize Renderer to match Wrapper (which is 100% of window)
                const w = window.innerWidth;
                const h = window.innerHeight;
                // rendererRef.current.resize(index, w, h); // Auto-resize in animate loop now
            }
        };
        handleResize();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [index]);

    // Sync Slave (Updated for Dual Video)
    useEffect(() => {
        const channel = new BroadcastChannel('lumina_sync');
        channel.postMessage({ type: 'HELLO' });
        channel.onmessage = (e) => {
            if (e.data.type === 'SYNC') {
                const { idleSrc, mainSrc, idleTime, mainTime, idlePaused, mainPaused, mix } = e.data;

                // Sync Videos
                if (idleVideoRef.current) {
                    const v = idleVideoRef.current;
                    if (idleSrc && v.src !== new URL(idleSrc, window.location.href).href) v.src = idleSrc;
                    if (Math.abs(v.currentTime - idleTime) > 0.3) v.currentTime = idleTime;
                    if (idlePaused && !v.paused) v.pause();
                    if (!idlePaused && v.paused) v.play().catch(() => { });
                }

                if (mainVideoRef.current) {
                    const v = mainVideoRef.current;
                    if (mainSrc && v.src !== new URL(mainSrc, window.location.href).href) v.src = mainSrc;
                    if (Math.abs(v.currentTime - mainTime) > 0.3) v.currentTime = mainTime;
                    if (mainPaused && !v.paused) v.pause();
                    if (!mainPaused && v.paused) v.play().catch(() => { });
                }

                // Sync Mix
                if (rendererRef.current) {
                    rendererRef.current.setCrossfade(mix);
                }
            }
        };
        return () => channel.close();
    }, []);

    // Ensure Renderer has video references
    useEffect(() => {
        if (rendererRef.current && idleVideoRef.current && mainVideoRef.current) {
            // Init with whatever is there, logic inside setVideos handles updates
            // But we need to make sure they are set at least once
            const updateVideos = () => {
                rendererRef.current?.setVideos(idleVideoRef.current, mainVideoRef.current);
            };
            // Retry a few times or wait for load?
            // Since they are fixed refs, we can just set them.
            updateVideos();

            // Also add listeners to update when metadata loads if needed, but setVideos logic checks image reference
            idleVideoRef.current.addEventListener('canplay', updateVideos);
            mainVideoRef.current.addEventListener('canplay', updateVideos);
            return () => {
                idleVideoRef.current?.removeEventListener('canplay', updateVideos);
                mainVideoRef.current?.removeEventListener('canplay', updateVideos);
            }
        }
    }, []);

    return (
        <div
            ref={containerRef}
            className="fixed inset-0 bg-black overflow-hidden cursor-default z-[9999] flex items-center justify-center"
            onClick={() => {
                if (!document.fullscreenElement) {
                    containerRef.current?.requestFullscreen().catch(e => console.error(e));
                }
            }}
        >
            <div
                ref={canvasWrapperRef}
                style={{
                    ...(aspectLock ? {
                        width: '100%',
                        height: '100%',
                        maxWidth: '177.78vh',
                        maxHeight: '56.25vw',
                        aspectRatio: '16/9',
                        position: 'relative'
                    } : {
                        width: '100%',
                        height: '100%',
                        position: 'absolute',
                        inset: 0
                    }),
                    transform: config ? `scale(${config.flipH ? -1 : 1}, ${config.flipV ? -1 : 1})` : 'none'
                }}
            />

            {/* Hidden Video Elements for Output */}
            <video ref={idleVideoRef} crossOrigin="anonymous" loop muted playsInline style={{ position: 'absolute', width: '1px', height: '1px', opacity: 0.01, pointerEvents: 'none' }} />
            <video ref={mainVideoRef} crossOrigin="anonymous" muted playsInline style={{ position: 'absolute', width: '1px', height: '1px', opacity: 0.01, pointerEvents: 'none' }} />

            <div className="absolute top-4 left-4 text-white/50 text-xs font-mono opacity-50 select-none z-50 pointer-events-none mix-blend-difference">
                OUTPUT {index + 1} {aspectLock && '[16:9 LOCKED]'}
            </div>

            {!isFs && (
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        containerRef.current?.requestFullscreen();
                    }}
                    className="absolute bottom-10 right-10 bg-white/10 hover:bg-white/30 text-white/80 px-6 py-3 rounded-full font-bold backdrop-blur transition-all border border-white/10 z-50"
                >
                    ⤢ Enter Fullscreen
                </button>
            )}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-0 animate-[fadeOut_5s_forwards] delay-1000">
                <div className="bg-black/50 text-white px-4 py-2 rounded text-sm font-bold backdrop-blur">
                    Double Click or 'F' (Fullscreen) | 'A' (Aspect Ratio)
                </div>
            </div>
        </div>
    );
};

export default function App() {
    const params = new URLSearchParams(window.location.search);
    const outIdx = params.get('output');
    if (outIdx !== null) return <OutputWindow index={parseInt(outIdx)} />;
    // --- State ---
    const loadConfig = (): ProjectorConfig[] => {
        try {
            const saved = localStorage.getItem('lumina-config-v4'); // v3 for new props
            if (saved) return JSON.parse(saved);
        } catch (e) {
            console.error(e);
        }
        return DEFAULT_CONFIGS();
    };

    const [projectors, setProjectors] = useState<ProjectorConfig[]>(loadConfig);
    const [selectedProjector, setSelectedProjector] = useState(0);
    const [selectedPoints, setSelectedPoints] = useState<{ r: number, c: number }[]>([]);

    // Masking State
    const [activeTool, setActiveTool] = useState<'move' | 'mask'>('move');
    const [drawingMask, setDrawingMask] = useState<Point[]>([]);

    // Video State
    const [isPlaying, setIsPlaying] = useState(false);

    // Hardcoded Fixed Videos
    useEffect(() => {
        // Initialize with fixed videos if not set
        setIdleVideoUrl('/videos/idle_loop.mp4');
        setMainVideoUrl('/videos/main_content.mp4');
    }, []);

    // Playlist State (Idle + Main)
    const [idleVideoUrl, setIdleVideoUrl] = useState<string>('');
    const [mainVideoUrl, setMainVideoUrl] = useState<string>('');
    const [playbackState, setPlaybackState] = useState<'IDLE' | 'MAIN' | 'TRANSITION'>('IDLE');
    const [mixValue, setMixValue] = useState(0); // 0 = Idle, 1 = Main

    // Refs
    const rendererRef = useRef<ThreeRenderer | null>(null);
    const idleVideoRef = useRef<HTMLVideoElement | null>(null);
    const mainVideoRef = useRef<HTMLVideoElement | null>(null);
    const containerRefs = [useRef<HTMLDivElement>(null), useRef<HTMLDivElement>(null), useRef<HTMLDivElement>(null)];

    // We use a REF for selection to ensure Drag/Move has latest without re-attaching listeners constantly
    const selectionRef = useRef<{ r: number, c: number }[]>([]);
    useEffect(() => { selectionRef.current = selectedPoints }, [selectedPoints]);

    // Crossfade Logic
    const fadeTo = (target: 'IDLE' | 'MAIN') => {
        const start = performance.now();
        const duration = 2000; // 2 seconds fade
        const startMix = target === 'MAIN' ? 0 : 1;
        const endMix = target === 'MAIN' ? 1 : 0;

        // Ensure target video is playing
        if (target === 'MAIN' && mainVideoRef.current) {
            mainVideoRef.current.currentTime = 0;
            mainVideoRef.current.play().catch(console.error);
        } else if (target === 'IDLE' && idleVideoRef.current) {
            idleVideoRef.current.play().catch(console.error);
        }

        setPlaybackState('TRANSITION');

        const animate = (time: number) => {
            const elapsed = time - start;
            const progress = Math.min(elapsed / duration, 1);

            // Ease in-out
            const ease = progress < .5 ? 2 * progress * progress : -1 + (4 - 2 * progress) * progress;

            const currentMix = startMix + (endMix - startMix) * ease;
            setMixValue(currentMix);
            rendererRef.current?.setCrossfade(currentMix);

            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                setMixValue(endMix);
                setPlaybackState(target);
                // If went back to IDLE, pause MAIN
                if (target === 'IDLE' && mainVideoRef.current) {
                    mainVideoRef.current.pause();
                }
            }
        };
        requestAnimationFrame(animate);
    };

    // Keyboard Shortcuts for Trigger
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            // Space or 'T' to trigger Main
            if ((e.code === 'Space' || e.key.toLowerCase() === 't') && playbackState === 'IDLE') {
                console.log("Triggering Main Content");
                fadeTo('MAIN');
            }
            // 'I' to force back to Idle
            if (e.key.toLowerCase() === 'i' && playbackState === 'MAIN') {
                console.log("Forcing Return to Idle");
                fadeTo('IDLE');
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [playbackState]);

    // Sync Master (Dual Video)
    const broadcastSync = () => {
        const channel = new BroadcastChannel('lumina_sync');
        channel.postMessage({
            type: 'SYNC',
            idleSrc: idleVideoRef.current?.src || '',
            mainSrc: mainVideoRef.current?.src || '',
            idleTime: idleVideoRef.current?.currentTime || 0,
            mainTime: mainVideoRef.current?.currentTime || 0,
            idlePaused: idleVideoRef.current?.paused || false,
            mainPaused: mainVideoRef.current?.paused || false,
            mix: mixValue
        });
        channel.close();
    };

    useEffect(() => {
        const channel = new BroadcastChannel('lumina_sync');
        channel.onmessage = (e) => { if (e.data.type === 'HELLO') broadcastSync(); };
        const interval = setInterval(broadcastSync, 500); // Sync more frequently for mix
        return () => { clearInterval(interval); channel.close(); };
    }, [mixValue]);

    // 3. Video Handling - Update Renderer with current Refs
    useEffect(() => {
        if (!rendererRef.current) return;
        rendererRef.current.setVideos(idleVideoRef.current, mainVideoRef.current);
    }, [idleVideoUrl, mainVideoUrl]);

    // Auto-Return to Idle when Main ends
    useEffect(() => {
        const mainInfo = mainVideoRef.current;
        if (!mainInfo) return;

        const onEnd = () => {
            console.log("Main Content Ended. Returning to Idle...");
            fadeTo('IDLE');
        };
        mainInfo.addEventListener('ended', onEnd);
        return () => mainInfo.removeEventListener('ended', onEnd);
    }, []);

    // --- Logic ---

    const updateProjector = (index: number, updater: (prev: ProjectorConfig) => ProjectorConfig) => {
        setProjectors(prev => {
            const next = [...prev];
            next[index] = updater(next[index]);
            return next;
        });
    };

    const setMode = (mode: 'linear' | 'bicubic') => {
        updateProjector(selectedProjector, prev => {
            let newRows = prev.rows;
            let newCols = prev.cols;
            let newGrid = prev.grid;

            if (mode === 'bicubic') {
                // Swithing to Bezier: Upgrade to 4x4 if not already compatible
                if (prev.rows < 4) {
                    newRows = 4;
                    newCols = 4;
                    // Resample simple 2x2 or 3x3 to 4x4 linear initial state
                    newGrid = createDefaultGrid(4, 4);
                    // ideally we should preserve corners, but reset is safer for now to avoid complexity
                }
            } else {
                // Switching to Quad: Downgrade to 2x2
                newRows = 2;
                newCols = 2;
                newGrid = createDefaultGrid(2, 2);
            }

            return {
                ...prev,
                mode,
                rows: newRows,
                cols: newCols,
                grid: newGrid
            };
        });
        setSelectedPoints([]); // Clear selection
    };

    const updateCrop = (field: keyof Crop, value: number) => {
        updateProjector(selectedProjector, prev => ({
            ...prev,
            crop: { ...prev.crop, [field]: value }
        }));
    };

    const handleDragStart = (projIdx: number, rStart: number, cStart: number, e: React.MouseEvent) => {
        e.preventDefault();

        // 1. Update Selection
        let newSelection = [...selectedPoints];
        const isSelected = newSelection.find(p => p.r === rStart && p.c === cStart);

        if (e.shiftKey || e.ctrlKey) {
            if (isSelected) newSelection = newSelection.filter(p => p.r !== rStart || p.c !== cStart);
            else newSelection.push({ r: rStart, c: cStart });
        } else {
            if (!isSelected) newSelection = [{ r: rStart, c: cStart }];
        }

        setSelectedPoints(newSelection);
        selectionRef.current = newSelection;

        // 2. Drag
        const onMove = (m: MouseEvent) => {
            const dx = m.movementX;
            const dy = m.movementY;

            setProjectors(prev => {
                const next = [...prev];
                const active = next[projIdx];
                let newGrid = active.grid.map(row => row.map(pt => ({ ...pt })));

                // If moving a CORNER in Bezier mode, we must also move its adjacent handles
                // to maintain their relative position to the corner.
                const corners = [
                    { r: 0, c: 0 }, { r: 0, c: 3 },
                    { r: 3, c: 0 }, { r: 3, c: 3 }
                ];

                selectionRef.current.forEach(pt => {
                    const isCorner = active.mode === 'bicubic' && corners.some(c => c.r === pt.r && c.c === pt.c);

                    // Move the point itself
                    if (newGrid[pt.r] && newGrid[pt.r][pt.c]) {
                        newGrid[pt.r][pt.c].x += dx;
                        newGrid[pt.r][pt.c].y += dy;
                    }

                    // Move Handles relative to corner if corner moved
                    if (isCorner) {
                        // Find neighbors (handles)
                        // Top-Left (0,0) -> (0,1) and (1,0)
                        if (pt.r === 0 && pt.c === 0) { newGrid[0][1].x += dx; newGrid[0][1].y += dy; newGrid[1][0].x += dx; newGrid[1][0].y += dy; }
                        // Top-Right (0,3) -> (0,2) and (1,3)
                        if (pt.r === 0 && pt.c === 3) { newGrid[0][2].x += dx; newGrid[0][2].y += dy; newGrid[1][3].x += dx; newGrid[1][3].y += dy; }
                        // Bottom-Left (3,0) -> (2,0) and (3,1)
                        if (pt.r === 3 && pt.c === 0) { newGrid[2][0].x += dx; newGrid[2][0].y += dy; newGrid[3][1].x += dx; newGrid[3][1].y += dy; }
                        // Bottom-Right (3,3) -> (2,3) and (3,2)
                        if (pt.r === 3 && pt.c === 3) { newGrid[2][3].x += dx; newGrid[2][3].y += dy; newGrid[3][2].x += dx; newGrid[3][2].y += dy; }
                    }
                });

                // Recalculate internal points for Bezier smoothing
                if (active.mode === 'bicubic') {
                    newGrid = calculateInternalPoints(newGrid);
                }

                next[projIdx] = { ...active, grid: newGrid };
                return next;
            });
        };

        const onUp = () => {
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
        };

        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
    };

    return (
        <div className="flex h-screen bg-[#0a0e1a] text-slate-300">
            {/* Hidden Videos for Controller */}
            <video
                ref={idleVideoRef}
                src={idleVideoUrl}
                loop
                muted
                playsInline
                onPlay={broadcastSync} onPause={broadcastSync}
                style={{ position: 'absolute', width: '1px', height: '1px', opacity: 0.01, pointerEvents: 'none' }}
            />
            <video
                ref={mainVideoRef}
                src={mainVideoUrl}
                muted
                playsInline
                onPlay={broadcastSync} onPause={broadcastSync}
                style={{ position: 'absolute', width: '1px', height: '1px', opacity: 0.01, pointerEvents: 'none' }}
            />

            <aside className="w-64 bg-[#0f1419] border-r border-white/10 p-6 flex flex-col gap-6 overflow-y-auto z-10 shrink-0">
                <div>
                    <h1 className="text-xl font-bold text-white mb-1">Lumina Mapper</h1>
                    <div className="text-xs text-slate-600">3 x 1920x1080 Projectors</div>
                </div>

                {/* Projectors Selection */}
                <div>
                    <h2 className="text-xs font-bold text-slate-500 uppercase mb-3">Projectors</h2>
                    {projectors.map((_, i) => (
                        <button
                            key={i}
                            onClick={() => setSelectedProjector(i)}
                            className={`w-full text-left px-3 py-2 rounded-lg mb-1 transition-colors text-sm ${selectedProjector === i
                                ? 'bg-amber-500 text-black font-bold'
                                : 'hover:bg-white/5'
                                }`}
                        >
                            <div className="flex justify-between items-center w-full">
                                <span>{i === 0 ? 'P1 (Left)' : i === 1 ? 'P2 (Center)' : 'P3 (Right)'}</span>
                                <div
                                    className="p-1.5 hover:bg-white/20 rounded cursor-pointer text-slate-400 hover:text-white"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        window.open(`/?output=${i}`, `P${i + 1}`, 'width=1280,height=720,menubar=no,toolbar=no,location=no,status=no');
                                    }}
                                    title="Open Output Window"
                                >
                                    <ExternalLink size={14} />
                                </div>
                            </div>
                        </button>
                    ))}
                </div>

                {/* Mode Control */}
                <div>
                    <h2 className="text-xs font-bold text-slate-500 uppercase mb-2">Warp Mode</h2>
                    <div className="flex bg-slate-800 rounded p-1">
                        {(['linear', 'bicubic'] as const).map(mode => (
                            <button
                                key={mode}
                                onClick={() => setMode(mode)}
                                className={`flex-1 py-1.5 text-xs uppercase font-bold rounded ${projectors[selectedProjector].mode === mode
                                    ? 'bg-amber-500 text-black shadow'
                                    : 'text-slate-500 hover:text-slate-300'
                                    }`}
                            >
                                {mode === 'linear' ? 'Quad' : 'Bezier'}
                            </button>
                        ))}
                    </div>
                    <div className="text-[10px] text-slate-600 mt-2">
                        {projectors[selectedProjector].mode === 'linear'
                            ? 'Simple 4-corner perspective warp.'
                            : 'Advanced Bezier warp with control handles.'}
                    </div>
                </div>

                {/* Input Mapping */}
                <div className="p-3 bg-white/5 rounded border border-white/5 space-y-3">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                        Input Mapping
                    </h3>

                    <div className="space-y-3">
                        {['x', 'width', 'y', 'height'].map(field => (
                            <div key={field}>
                                <div className="flex justify-between text-[10px] mb-1 uppercase">
                                    <span className="text-slate-500">{field}</span>
                                    <span>{Math.round(projectors[selectedProjector].crop[field as keyof Crop] * 100)}%</span>
                                </div>
                                <input
                                    type="range" min={field.includes('width') || field.includes('height') ? 0.01 : 0} max="1" step="0.001"
                                    value={projectors[selectedProjector].crop[field as keyof Crop]}
                                    onChange={(e) => updateCrop(field as keyof Crop, parseFloat(e.target.value))}
                                    className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
                                />
                            </div>
                        ))}

                        <div className="flex gap-4 pt-2">
                            <label className="flex items-center gap-2 text-[10px] text-slate-400 uppercase cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={projectors[selectedProjector].flipH || false}
                                    onChange={(e) => {
                                        const newConfigs = [...projectors];
                                        newConfigs[selectedProjector].flipH = e.target.checked;
                                        setProjectors(newConfigs);
                                    }}
                                    className="accent-amber-500"
                                />
                                Flip H
                            </label>
                            <label className="flex items-center gap-2 text-[10px] text-slate-400 uppercase cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={projectors[selectedProjector].flipV || false}
                                    onChange={(e) => {
                                        const newConfigs = [...projectors];
                                        newConfigs[selectedProjector].flipV = e.target.checked;
                                        setProjectors(newConfigs);
                                    }}
                                    className="accent-amber-500"
                                />
                                Flip V
                            </label>
                        </div>
                    </div>
                </div>

                {/* Edge Blending */}
                <div className="p-3 bg-white/5 rounded border border-white/5 space-y-3">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                        Edge Blending
                    </h3>
                    <div className="space-y-3">
                        {['left', 'right', 'top', 'bottom'].map(side => (
                            <div key={side}>
                                <div className="flex justify-between text-[10px] mb-1 uppercase">
                                    <span className="text-slate-500">{side}</span>
                                    <span>{Math.round((projectors[selectedProjector].edgeBlend[side as keyof EdgeBlendConfig] as number) * 100)}%</span>
                                </div>
                                <input
                                    type="range" min="0" max="0.5" step="0.01"
                                    value={projectors[selectedProjector].edgeBlend[side as keyof EdgeBlendConfig]}
                                    onChange={(e) => {
                                        const newConfigs = [...projectors];
                                        newConfigs[selectedProjector].edgeBlend = {
                                            ...newConfigs[selectedProjector].edgeBlend,
                                            [side]: parseFloat(e.target.value)
                                        };
                                        const r = rendererRef.current;
                                        if (r) {
                                            r.updateEdgeBlend(selectedProjector, newConfigs[selectedProjector].edgeBlend);
                                        }
                                        setProjectors(newConfigs);
                                    }}
                                    className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
                                />
                            </div>
                        ))}

                        {/* Gamma Slider */}
                        <div>
                            <div className="flex justify-between text-[10px] mb-1 uppercase">
                                <span className="text-slate-500">Smoothness (Gamma)</span>
                                <span>{projectors[selectedProjector].edgeBlend.gamma || 1.0}</span>
                            </div>
                            <input
                                type="range" min="0.1" max="4.0" step="0.1"
                                value={projectors[selectedProjector].edgeBlend.gamma || 1.0}
                                onChange={(e) => {
                                    const newConfigs = [...projectors];
                                    const val = parseFloat(e.target.value);
                                    newConfigs[selectedProjector].edgeBlend = {
                                        ...newConfigs[selectedProjector].edgeBlend,
                                        gamma: val
                                    };
                                    const r = rendererRef.current;
                                    if (r) {
                                        r.updateEdgeBlend(selectedProjector, newConfigs[selectedProjector].edgeBlend);
                                    }
                                    setProjectors(newConfigs);
                                }}
                                className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
                            />
                        </div>
                    </div>
                </div>

                {/* Playlist Status */}
                <div className="p-3 bg-white/5 rounded border border-white/5 space-y-4">
                    <h2 className="text-xs font-bold text-slate-500 uppercase flex justify-between">
                        Playback Status
                    </h2>
                    <div className="text-sm font-mono text-center py-2 bg-black/20 rounded">
                        STATE: <span className={playbackState === 'MAIN' ? 'text-red-500' : 'text-green-500'}>{playbackState}</span>
                    </div>
                    <div className="text-[10px] text-slate-500">
                        Mix Value: {mixValue.toFixed(2)}
                    </div>

                    {/* Manual Trigger */}
                    <button
                        onClick={() => fadeTo('MAIN')}
                        disabled={playbackState !== 'IDLE'}
                        className={`w-full py-3 font-bold rounded flex flex-col items-center justify-center ${playbackState !== 'IDLE' ? 'bg-slate-800 text-slate-500' : 'bg-red-600 text-white hover:bg-red-500'}`}
                    >
                        <span className="text-sm">TRIGGER MAIN (SPACE)</span>
                    </button>
                    <button
                        onClick={() => fadeTo('IDLE')}
                        disabled={playbackState === 'IDLE'}
                        className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-xs text-slate-400 rounded"
                    >
                        Force Return to Idle
                    </button>
                </div>

                {/* Playlist Control */}
                <div className="p-3 bg-white/5 rounded border border-white/5 space-y-4">
                    <h2 className="text-xs font-bold text-slate-500 uppercase flex justify-between">
                        Playlist Control
                        <span className={`text-[10px] px-2 rounded ${playbackState === 'IDLE' ? 'bg-slate-700' : 'bg-red-600 text-white animate-pulse'}`}>
                            {playbackState}
                        </span>
                    </h2>

                    {/* IDLE SLOT */}
                    <div className="space-y-2">
                        <div className="text-[10px] text-slate-400 uppercase mb-1">Idle Loop (Background)</div>
                        {/* Test Videos Dropdown */}
                        <select
                            value=""
                            onChange={(e) => {
                                if (e.target.value) {
                                    setIdleVideoUrl(e.target.value);
                                    // playVideo(e.target.value, 'IDLE'); // Removed
                                    if (idleVideoRef.current) {
                                        idleVideoRef.current.src = e.target.value;
                                        idleVideoRef.current.loop = true;
                                        idleVideoRef.current.play().catch(console.error);
                                    }
                                }
                            }}
                            className="w-full bg-slate-800 text-white px-2 py-1 rounded text-xs border border-slate-700 hover:border-slate-600"
                        >
                            <option value="">Select Video...</option>
                            {LOCAL_VIDEOS.length > 0 && <optgroup label="Local Project (/public/videos)">
                                {LOCAL_VIDEOS.map((v, i) => (
                                    <option key={`local-${i}`} value={`/videos/${v.filename}`}>{v.title}</option>
                                ))}
                            </optgroup>}
                            <optgroup label="Remote Tests">
                                {TEST_VIDEOS.map((video, i) => (
                                    <option key={i} value={video.url}>{video.title}</option>
                                ))}
                            </optgroup>
                        </select>
                        {/* Upload */}
                        <div className="flex gap-2">
                            <input
                                type="file"
                                accept="video/*"
                                className="hidden"
                                id="idle-upload"
                                onChange={(e) => {
                                    if (e.target.files?.[0]) {
                                        const url = URL.createObjectURL(e.target.files[0]);
                                        setIdleVideoUrl(url);
                                        // playVideo(url, 'IDLE'); // Removed
                                        if (idleVideoRef.current) {
                                            idleVideoRef.current.src = url;
                                            idleVideoRef.current.loop = true;
                                            idleVideoRef.current.play().catch(console.error);
                                        }
                                    }
                                }}
                            />
                            <label htmlFor="idle-upload" className="bg-slate-700 hover:bg-slate-600 px-3 py-1 rounded text-xs cursor-pointer truncate flex-1 text-center">
                                {idleVideoUrl ? 'Upload Local File' : 'Upload Local File...'}
                            </label>
                            {idleVideoUrl && <button onClick={() => setIdleVideoUrl('')} className="text-red-500 hover:text-red-400">×</button>}
                        </div>
                        <div className="text-[9px] text-slate-600 text-center">
                            * Uploads are preview-only. Use /public/videos for Sync.
                        </div>
                    </div>
                </div>

                {/* MAIN SLOT */}
                <div className="space-y-2">
                    <div className="text-[10px] text-slate-400 uppercase mb-1">Main Content (One-Shot)</div>
                    {/* Dropdown */}
                    <select
                        value=""
                        onChange={(e) => {
                            if (e.target.value) setMainVideoUrl(e.target.value);
                        }}
                        className="w-full bg-slate-800 text-white px-2 py-1 rounded text-xs border border-slate-700 hover:border-slate-600"
                    >
                        <option value="">Select Video...</option>
                        {LOCAL_VIDEOS.length > 0 && <optgroup label="Local Project (/public/videos)">
                            {LOCAL_VIDEOS.map((v, i) => (
                                <option key={`local-${i}`} value={`/videos/${v.filename}`}>{v.title}</option>
                            ))}
                        </optgroup>}
                        <optgroup label="Remote Tests">
                            {TEST_VIDEOS.map((video, i) => (
                                <option key={i} value={video.url}>{video.title}</option>
                            ))}
                        </optgroup>
                    </select>
                    {/* Upload */}
                    <div className="flex gap-2">
                        <input
                            type="file"
                            accept="video/*"
                            className="hidden"
                            id="main-upload"
                            onChange={(e) => {
                                if (e.target.files?.[0]) setMainVideoUrl(URL.createObjectURL(e.target.files[0]));
                            }}
                        />
                        <label htmlFor="main-upload" className="bg-slate-700 hover:bg-slate-600 px-3 py-1 rounded text-xs cursor-pointer truncate flex-1 text-center">
                            {mainVideoUrl ? 'Upload Local File' : 'Upload Local File...'}
                        </label>
                        {mainVideoUrl && <button onClick={() => setMainVideoUrl('')} className="text-red-500 hover:text-red-400">×</button>}
                    </div>
                </div>

                {/* PLAY BUTTONS */}
                <div className="flex gap-2 pt-2 border-t border-white/5">
                    <button
                        onClick={() => {
                            if (!mainVideoUrl) return alert('No Main Video selected');
                            // setMainVideoUrl(mainVideoUrl); // Redundant
                            // playVideo(mainVideoUrl, 'MAIN'); // Removed
                            fadeTo('MAIN');
                            // if (videoRef.current) videoRef.current.currentTime = 0; // Removed
                        }}
                        disabled={!mainVideoUrl}
                        className={`flex-1 py-3 font-bold rounded flex flex-col items-center justify-center ${playbackState === 'MAIN' ? 'bg-red-600 text-white shadow-[0_0_15px_rgba(220,38,38,0.5)]' : 'bg-slate-700 hover:bg-white/10'}`}
                    >
                        <span className="text-sm">PLAY MAIN</span>
                    </button>

                    <button
                        onClick={() => {
                            if (!idleVideoUrl) return alert('No Idle Video selected');
                            // playVideo(idleVideoUrl, 'IDLE'); // Removed
                            fadeTo('IDLE');
                        }}
                        disabled={!idleVideoUrl}
                        className="flex-1 py-3 bg-slate-700 hover:bg-white/10 font-bold rounded flex flex-col items-center justify-center"
                    >
                        <span className="text-sm">BACK TO IDLE</span>
                    </button>
                </div>

            </aside>

            {/* Main Viewport */}
            <main className="flex-1 flex items-center justify-center p-8 bg-gradient-to-b from-transparent to-black/20 overflow-hidden select-none" >
                <div className="flex flex-row gap-4 transform scale-90 origin-center">
                    {projectors.map((config, i) => (
                        <div key={i} className="relative group">
                            {/* Header */}
                            <div className="text-xs text-slate-500 mb-2 font-bold uppercase tracking-wider flex justify-between pointer-events-none">
                                <span>P{i + 1}</span>
                                <span className={i === selectedProjector ? 'text-amber-500' : ''}>
                                    {config.mode === 'linear' ? 'Quad' : 'Bezier'}
                                </span>
                            </div>

                            {/* Canvas Container */}
                            <div
                                ref={containerRefs[i]}
                                className={`rounded-sm overflow-hidden shadow-2xl ring-1 relative bg-black transition-all ${selectedProjector === i ? 'ring-amber-500/50 shadow-amber-500/10' : 'ring-white/10'
                                    }`}
                                style={{ width: '360px', height: '202px' }}
                                onMouseDown={() => setSelectedProjector(i)}
                            />

                            {/* SVG Overlay */}
                            <svg className="absolute top-6 left-0 overflow-visible" width="360" height="202">
                                <g opacity={selectedProjector === i ? 1 : 0.3} className="transition-opacity duration-300">

                                    {/* --- BEZIER VISUALIZATION --- */}
                                    {config.mode === 'bicubic' && config.rows === 4 && (
                                        <>
                                            {/* Handle Lines */}
                                            {/* Top Corners */}
                                            <line x1={config.grid[0][0].x} y1={config.grid[0][0].y} x2={config.grid[0][1].x} y2={config.grid[0][1].y} stroke="#60a5fa" strokeWidth="1" opacity="0.5" />
                                            <line x1={config.grid[0][0].x} y1={config.grid[0][0].y} x2={config.grid[1][0].x} y2={config.grid[1][0].y} stroke="#60a5fa" strokeWidth="1" opacity="0.5" />

                                            <line x1={config.grid[0][3].x} y1={config.grid[0][3].y} x2={config.grid[0][2].x} y2={config.grid[0][2].y} stroke="#60a5fa" strokeWidth="1" opacity="0.5" />
                                            <line x1={config.grid[0][3].x} y1={config.grid[0][3].y} x2={config.grid[1][3].x} y2={config.grid[1][3].y} stroke="#60a5fa" strokeWidth="1" opacity="0.5" />

                                            {/* Bottom Corners */}
                                            <line x1={config.grid[3][0].x} y1={config.grid[3][0].y} x2={config.grid[3][1].x} y2={config.grid[3][1].y} stroke="#60a5fa" strokeWidth="1" opacity="0.5" />
                                            <line x1={config.grid[3][0].x} y1={config.grid[3][0].y} x2={config.grid[2][0].x} y2={config.grid[2][0].y} stroke="#60a5fa" strokeWidth="1" opacity="0.5" />

                                            <line x1={config.grid[3][3].x} y1={config.grid[3][3].y} x2={config.grid[3][2].x} y2={config.grid[3][2].y} stroke="#60a5fa" strokeWidth="1" opacity="0.5" />
                                            <line x1={config.grid[3][3].x} y1={config.grid[3][3].y} x2={config.grid[2][3].x} y2={config.grid[2][3].y} stroke="#60a5fa" strokeWidth="1" opacity="0.5" />

                                            {/* Draw Control Points (Corners + Handles) */}
                                            {config.grid.map((row, r) => row.map((pt, c) => {
                                                // Ignore internal points (rows 1-2, cols 1-2)
                                                if (r > 0 && r < 3 && c > 0 && c < 3) return null;

                                                const isCorner = (r === 0 || r === 3) && (c === 0 || c === 3);
                                                const isSelected = selectedPoints.some(p => p.r === r && p.c === c);

                                                return (
                                                    <g
                                                        key={`${r}-${c}`}
                                                        style={{ cursor: isCorner ? 'move' : 'crosshair' }}
                                                        onMouseDown={(e) => handleDragStart(i, r, c, e)}
                                                    >
                                                        <circle cx={pt.x} cy={pt.y} r="15" fill="transparent" />
                                                        <circle
                                                            cx={pt.x} cy={pt.y} r={isCorner ? 5 : 3}
                                                            fill={isSelected ? '#fff' : (isCorner ? '#f59e0b' : '#60a5fa')}
                                                            stroke="#000" strokeWidth="1"
                                                        />
                                                    </g>
                                                )
                                            }))}
                                        </>
                                    )}

                                    {/* --- LINEAR (QUAD) VISUALIZATION --- */}
                                    {config.mode === 'linear' && (
                                        <>
                                            <polygon
                                                points={`${config.grid[0][0].x},${config.grid[0][0].y} ${config.grid[0][1].x},${config.grid[0][1].y} ${config.grid[1][1].x},${config.grid[1][1].y} ${config.grid[1][0].x},${config.grid[1][0].y}`}
                                                fill="none" stroke="#f59e0b" strokeWidth="2" opacity="0.5"
                                            />
                                            {config.grid.map((row, r) => row.map((pt, c) => {
                                                const isSelected = selectedPoints.some(p => p.r === r && p.c === c);
                                                return (
                                                    <g
                                                        key={`${r}-${c}`}
                                                        style={{ cursor: 'move' }}
                                                        onMouseDown={(e) => handleDragStart(i, r, c, e)}
                                                    >
                                                        <circle cx={pt.x} cy={pt.y} r="15" fill="transparent" />
                                                        <circle
                                                            cx={pt.x} cy={pt.y} r="6"
                                                            fill={isSelected ? '#fff' : '#f59e0b'}
                                                            stroke="#000" strokeWidth="1"
                                                        />
                                                    </g>
                                                )
                                            }))}
                                        </>
                                    )}

                                </g>
                            </svg>
                        </div>
                    ))}
                </div>
            </main >
        </div >
    );
}
