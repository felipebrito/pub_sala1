import { useState, useEffect, useRef, useCallback } from 'react'
import { ThreeRenderer } from './core/ThreeRenderer'
import { TEST_VIDEOS } from './constants/videos';
import { Play, Pause, Grid3X3, MousePointer2, ExternalLink, RotateCcw } from 'lucide-react'

// Types
interface Point { x: number; y: number }
interface Crop { x: number, y: number, width: number, height: number }
interface EdgeBlendConfig { left: number; right: number; top: number; bottom: number; gamma: number; }
interface Mask { id: string; points: Point[] }
interface ProjectorConfig {
    grid: Point[][]; // [rows][cols]
    rows: number;
    cols: number;
    crop: Crop;
    edgeBlend: EdgeBlendConfig;
    masks: Mask[];
    mode: 'linear' | 'bicubic'; // visualization/interaction mode: linear=Quad (2x2), bicubic=Bezier (Handles)
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
    edgeBlend: { left: 0, right: 0, top: 0, bottom: 0, gamma: 1.0 },
    masks: []
}));

const OutputWindow = ({ index }: { index: number }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasWrapperRef = useRef<HTMLDivElement>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
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

        // Sync Function
        const sync = () => {
            const str = localStorage.getItem('lumina-config-v3');
            if (str) {
                try {
                    const configs: ProjectorConfig[] = JSON.parse(str);
                    const conf = configs[index];
                    if (conf) {
                        setConfig(conf);
                        r.updateInputCrop(index, conf.crop);
                        r.updateGridWarp(index, conf.grid, conf.rows, conf.cols, conf.mode);
                    }
                } catch (e) { console.error('Config parse error', e); }
            }

            const vUrl = localStorage.getItem('lumina-video-url');
            if (vUrl && videoRef.current) {
                if (videoRef.current.src !== vUrl && vUrl !== '') {
                    videoRef.current.src = vUrl;
                    videoRef.current.load();
                } else if (vUrl !== '' && videoRef.current.paused) {
                    videoRef.current.play().catch(() => { });
                }
            }
        };

        sync();
        window.addEventListener('storage', sync);

        return () => {
            r.dispose();
            rendererRef.current = null;
            window.removeEventListener('storage', sync);
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('keydown', onKey);
            document.removeEventListener('fullscreenchange', onFs);
        }
    }, [index]);

    // Handle Resize keep warp correct
    useEffect(() => {
        const handleResize = () => {
            if (rendererRef.current && config) {
                // Wait for layout update
                requestAnimationFrame(() => {
                    rendererRef.current?.updateGridWarp(index, config.grid, config.rows, config.cols, config.mode);
                });
            }
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [config, index, aspectLock]); // Dep on aspectLock to re-warp on toggle

    // Sync Slave
    useEffect(() => {
        const channel = new BroadcastChannel('lumina_sync');
        channel.postMessage({ type: 'HELLO' });
        channel.onmessage = (e) => {
            if (e.data.type === 'SYNC' && videoRef.current) {
                const { time, paused } = e.data;
                const v = videoRef.current;
                // Only sync if significant drift
                if (Math.abs(v.currentTime - time) > 0.3) {
                    v.currentTime = time;
                }
                if (paused && !v.paused) v.pause();
                if (!paused && v.paused) v.play().catch(() => { });
            }
        };
        return () => channel.close();
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
                style={aspectLock ? {
                    width: '100%',
                    height: '100%',
                    maxWidth: '177.78vh', // 16:9 aspect ratio (16/9 * 100vh)
                    maxHeight: '56.25vw', // 16:9 aspect ratio (9/16 * 100vw)
                    aspectRatio: '16/9',
                    position: 'relative'
                } : {
                    width: '100%',
                    height: '100%',
                    position: 'absolute',
                    inset: 0
                }}
            />

            <video
                ref={videoRef}
                crossOrigin="anonymous"
                loop
                muted
                playsInline
                autoPlay
                onTimeUpdate={(e) => {
                    // Sync time display if needed? No, output window purely renders.
                    // But if we want to debug seek:
                    // console.log(e.currentTarget.currentTime);
                }}
                onCanPlay={() => {
                    if (videoRef.current && rendererRef.current) {
                        videoRef.current.play().catch(e => console.warn(e));
                        rendererRef.current.setVideo(videoRef.current);
                    }
                }}
                style={{ position: 'absolute', width: '1px', height: '1px', opacity: 0.01, pointerEvents: 'none' }}
            />

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
            const saved = localStorage.getItem('lumina-config-v5'); // v5 for Masks
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
    const [videoUrl, setVideoUrl] = useState(() => localStorage.getItem('lumina-video-url') || '');

    // Playlist State
    const [idleVideoUrl, setIdleVideoUrl] = useState<string>('');
    const [mainVideoUrl, setMainVideoUrl] = useState<string>('');
    const [playbackState, setPlaybackState] = useState<'IDLE' | 'MAIN'>('IDLE');
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);

    // Refs
    const rendererRef = useRef<ThreeRenderer | null>(null);
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const containerRefs = [useRef<HTMLDivElement>(null), useRef<HTMLDivElement>(null), useRef<HTMLDivElement>(null)];
    // We use a REF for selection to ensure Drag/Move has latest without re-attaching listeners constantly
    const selectionRef = useRef<{ r: number, c: number }[]>([]);
    useEffect(() => { selectionRef.current = selectedPoints }, [selectedPoints]);

    // Sync Master
    const broadcastSync = () => {
        const channel = new BroadcastChannel('lumina_sync');
        if (videoRef.current) {
            channel.postMessage({
                type: 'SYNC',
                time: videoRef.current.currentTime,
                paused: videoRef.current.paused,
                src: videoRef.current.src
            });
        }
        channel.close();
    };

    useEffect(() => {
        const channel = new BroadcastChannel('lumina_sync');
        channel.onmessage = (e) => { if (e.data.type === 'HELLO') broadcastSync(); };
        const interval = setInterval(broadcastSync, 1000);
        return () => { clearInterval(interval); channel.close(); };
    }, []);

    // --- Effects ---

    // 1. Initialize Renderer
    useEffect(() => {
        if (containerRefs[0].current && containerRefs[1].current && containerRefs[2].current && !rendererRef.current) {
            rendererRef.current = new ThreeRenderer([
                { index: 0, container: containerRefs[0].current! },
                { index: 1, container: containerRefs[1].current! },
                { index: 2, container: containerRefs[2].current! }
            ]);

            // Initial Push
            projectors.forEach((proj, i) => {
                rendererRef.current?.updateInputCrop(i, proj.crop);
                rendererRef.current?.updateGridWarp(i, proj.grid, proj.rows, proj.cols, proj.mode);
            });
        }
        return () => {
            rendererRef.current?.dispose();
            rendererRef.current = null;
        };
    }, []);

    // 2. Sync Projectors Projectors -> Renderer    // Auto-Save
    useEffect(() => {
        localStorage.setItem('lumina-config-v4', JSON.stringify(projectors));

        if (!rendererRef.current) return;

        projectors.forEach((proj, i) => {
            rendererRef.current?.updateInputCrop(i, proj.crop);
            rendererRef.current?.updateGridWarp(i, proj.grid, proj.rows, proj.cols, proj.mode);
        });
    }, [projectors]);

    // 3. Video Handling
    useEffect(() => {
        localStorage.setItem('lumina-video-url', videoUrl);
        if (!videoUrl || !videoRef.current || !rendererRef.current) return;

        const video = videoRef.current;
        video.src = videoUrl;
        video.crossOrigin = 'anonymous';

        const handleCanPlay = () => {
            if (video.videoWidth === 0) return;
            rendererRef.current?.setVideo(video);
            video.play().then(() => setIsPlaying(true)).catch(console.error);
        };

        video.addEventListener('canplay', handleCanPlay);
        return () => video.removeEventListener('canplay', handleCanPlay);
    }, [videoUrl]);

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

    const togglePlayback = () => {
        if (!videoRef.current) return;
        isPlaying ? videoRef.current.pause() : videoRef.current.play();
        setIsPlaying(!isPlaying);
    };

    const loadVideo = () => {
        const url = prompt('Enter video URL:');
        if (url) setVideoUrl(url);
    };

    return (
        <div className="flex h-screen bg-[#0a0e1a] text-slate-300">
            <video
                ref={videoRef}
                onPlay={broadcastSync}
                onPause={broadcastSync}
                onSeeked={broadcastSync}
                onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
                onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
                onEnded={() => {
                    if (playbackState === 'MAIN') {
                        // Main finished -> Back to Idle
                        if (idleVideoUrl) {
                            setVideoUrl(idleVideoUrl);
                            setPlaybackState('IDLE');
                            setTimeout(() => {
                                if (videoRef.current) {
                                    videoRef.current.loop = true;
                                    videoRef.current.play();
                                }
                            }, 50);
                        } else {
                            setIsPlaying(false);
                        }
                    }
                }}
                style={{ position: 'absolute', width: '1px', height: '1px', opacity: 0.01, pointerEvents: 'none' }}
                playsInline autoPlay muted loop
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
                                    <span>{Math.round(projectors[selectedProjector].edgeBlend[side as keyof EdgeBlendConfig] * 100)}%</span>
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

                {/* Masking Toolbar */}
                <div className="p-3 bg-white/5 rounded border border-white/5 space-y-3">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex justify-between items-center">
                        Masking Tool
                        {activeTool === 'mask' && <span className="text-amber-500 text-[10px] animate-pulse">ACTIVE</span>}
                    </h3>
                    <div className="flex gap-2">
                        <button
                            onClick={() => {
                                setActiveTool(prev => prev === 'mask' ? 'move' : 'mask');
                                setDrawingMask([]);
                            }}
                            className={`flex-1 py-2 text-xs font-bold rounded flex items-center justify-center gap-2 ${activeTool === 'mask' ? 'bg-amber-500 text-black' : 'bg-slate-700 hover:bg-slate-600'}`}
                        >
                            {activeTool === 'mask' ? 'Finish / Exit' : 'Draw Mask'}
                        </button>
                        {drawingMask.length > 2 && (
                            <button
                                onClick={() => {
                                    // Save Mask
                                    const newMask: Mask = { id: crypto.randomUUID(), points: drawingMask };
                                    const newConfigs = [...projectors];
                                    newConfigs[selectedProjector].masks = [...(newConfigs[selectedProjector].masks || []), newMask];
                                    setProjectors(newConfigs);
                                    setDrawingMask([]);
                                }}
                                className="bg-green-600 hover:bg-green-500 text-white px-3 rounded"
                            >
                                Save
                            </button>
                        )}
                        <button
                            onClick={() => {
                                if (confirm('Clear all masks for this projector?')) {
                                    const newConfigs = [...projectors];
                                    newConfigs[selectedProjector].masks = [];
                                    setProjectors(newConfigs);
                                }
                            }}
                            className="bg-red-900/50 hover:bg-red-900 text-white px-3 rounded"
                            title="Clear All Masks"
                        >
                            ×
                        </button>
                    </div>
                    <div className="text-[10px] text-slate-500 leading-tight">
                        {activeTool === 'mask'
                            ? 'Click on the preview to add points. Click "Save" to close the shape.'
                            : 'Click "Draw Mask" to start creating blackout polygons.'}
                    </div>
                </div>

                {/* Video Playlist & Player */}
                <div className="p-3 bg-white/5 rounded border border-white/5 space-y-4">
                    <h2 className="text-xs font-bold text-slate-500 uppercase flex justify-between">
                        Playlist Control
                        <span className={`text-[10px] px-2 rounded ${playbackState === 'IDLE' ? 'bg-slate-700' : 'bg-red-600 text-white animate-pulse'}`}>
                            {playbackState}
                        </span>
                    </h2>

                    {/* IDLE SLOT */}
                    <div>
                        <div className="text-[10px] text-slate-400 uppercase mb-1">Idle Loop (Background)</div>
                        <div className="flex gap-2">
                            <input
                                type="file"
                                accept="video/*"
                                className="hidden"
                                id="idle-upload"
                                onChange={(e) => {
                                    if (e.target.files?.[0]) setIdleVideoUrl(URL.createObjectURL(e.target.files[0]));
                                }}
                            />
                            <label htmlFor="idle-upload" className="bg-slate-700 hover:bg-slate-600 px-3 py-1 rounded text-xs cursor-pointer truncate flex-1 text-center">
                                {idleVideoUrl ? 'Change Idle File' : 'Select Idle Video...'}
                            </label>
                            {idleVideoUrl && <button onClick={() => setIdleVideoUrl('')} className="text-red-500 hover:text-red-400">×</button>}
                        </div>
                    </div>

                    {/* MAIN SLOT */}
                    <div>
                        <div className="text-[10px] text-slate-400 uppercase mb-1">Main Content (One-Shot)</div>
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
                                {mainVideoUrl ? 'Change Main File' : 'Select Main Video...'}
                            </label>
                            {mainVideoUrl && <button onClick={() => setMainVideoUrl('')} className="text-red-500 hover:text-red-400">×</button>}
                        </div>
                    </div>

                    {/* TRANSPORT */}
                    <div className="pt-2 border-t border-white/5">
                        <div className="flex gap-2 mb-2">
                            <button
                                onClick={() => {
                                    // Trigger Main Video
                                    if (!mainVideoUrl) return alert('No Main Video selected');
                                    setVideoUrl(mainVideoUrl);
                                    setPlaybackState('MAIN');
                                    setTimeout(() => {
                                        if (videoRef.current) {
                                            videoRef.current.loop = false;
                                            videoRef.current.currentTime = 0;
                                            videoRef.current.play();
                                            setIsPlaying(true);
                                        }
                                    }, 100);
                                }}
                                disabled={!mainVideoUrl}
                                className={`flex-1 py-3 font-bold rounded flex flex-col items-center justify-center ${playbackState === 'MAIN' ? 'bg-red-600 text-white shadow-[0_0_15px_rgba(220,38,38,0.5)]' : 'bg-slate-700 hover:bg-white/10'}`}
                            >
                                <span className="text-sm">PLAY MAIN</span>
                            </button>

                            <button
                                onClick={() => {
                                    // Force Idle
                                    if (!idleVideoUrl) return alert('No Idle Video selected');
                                    setVideoUrl(idleVideoUrl);
                                    setPlaybackState('IDLE');
                                    setTimeout(() => {
                                        if (videoRef.current) {
                                            videoRef.current.loop = true;
                                            videoRef.current.play();
                                            setIsPlaying(true);
                                        }
                                    }, 100);
                                }}
                                disabled={!idleVideoUrl}
                                className={`w-20 py-3 font-bold rounded flex flex-col items-center justify-center ${playbackState === 'IDLE' ? 'bg-green-600 text-white' : 'bg-slate-700 hover:bg-white/10'}`}
                            >
                                <span className="text-[10px]">BACK TO</span>
                                <span className="text-sm">IDLE</span>
                            </button>
                        </div>

                        {/* Seek Bar & Controls */}
                        <div className="bg-black/30 p-2 rounded">
                            <input
                                type="range" min="0" max={duration || 1} step="0.1"
                                value={currentTime}
                                onMouseDown={() => { /* Pause for seek? Optional */ }}
                                onChange={(e) => {
                                    const t = parseFloat(e.target.value);
                                    setCurrentTime(t);
                                    if (videoRef.current) videoRef.current.currentTime = t;
                                }}
                                className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-500 mb-2"
                            />
                            <div className="flex justify-between items-center text-xs">
                                <span>{new Date(currentTime * 1000).toISOString().substr(14, 5)}</span>
                                <div className="flex gap-2">
                                    <button onClick={togglePlayback} className="hover:text-white text-slate-400">
                                        {isPlaying ? <Pause size={16} /> : <Play size={16} />}
                                    </button>
                                    <button onClick={() => {
                                        if (videoRef.current) videoRef.current.currentTime = 0;
                                    }} className="hover:text-white text-slate-400">
                                        <RotateCcw size={16} />
                                    </button>
                                </div>
                                <span>{new Date(duration * 1000).toISOString().substr(14, 5)}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </aside>

            {/* Main Viewport */}
            < main className="flex-1 flex items-center justify-center p-8 bg-gradient-to-b from-transparent to-black/20 overflow-hidden select-none" >
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
