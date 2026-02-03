import { useState, useEffect, useRef, useCallback } from 'react'
import { PixiRenderer } from './core/PixiRenderer'
import { TEST_VIDEOS } from './constants/videos';
import { Play, Pause } from 'lucide-react'

interface Point { x: number; y: number }

// Default warp points in LOCAL monitor coordinates (360x202 - CLOCKWISE: TL, TR, BR, BL)
const DEFAULT_WARP = (): Point[] => [
    { x: 0, y: 0 },           // Top-left
    { x: 360, y: 0 },         // Top-right  
    { x: 360, y: 202 },       // Bottom-right (clockwise)
    { x: 0, y: 202 }          // Bottom-left
];

export default function App() {
    // Load saved video URL from localStorage
    const loadVideoUrl = (): string => {
        try {
            return localStorage.getItem('lumina-video-url') || '';
        } catch (e) {
            return '';
        }
    };

    const [isPlaying, setIsPlaying] = useState(false);
    const [videoUrl, setVideoUrl] = useState(loadVideoUrl);

    // Load saved warping from localStorage or use defaults
    const loadWarpPoints = (): Point[][] => {
        try {
            const saved = localStorage.getItem('lumina-warping');
            if (saved) {
                return JSON.parse(saved);
            }
        } catch (e) {
            console.error('Failed to load warping:', e);
        }
        return [DEFAULT_WARP(), DEFAULT_WARP(), DEFAULT_WARP()];
    };

    const [warpPoints, setWarpPoints] = useState<Point[][]>(loadWarpPoints);
    const [selectedProjector, setSelectedProjector] = useState(0);

    const rendererRef = useRef<PixiRenderer | null>(null);
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const container1Ref = useRef<HTMLDivElement>(null);
    const container2Ref = useRef<HTMLDivElement>(null);
    const container3Ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (container1Ref.current && container2Ref.current && container3Ref.current && !rendererRef.current) {
            rendererRef.current = new PixiRenderer(
                container1Ref.current,
                container2Ref.current,
                container3Ref.current
            );
        }
        return () => {
            rendererRef.current?.dispose();
            rendererRef.current = null;
        };
    }, []);

    // Auto-save video URL to localStorage
    useEffect(() => {
        try {
            if (videoUrl) {
                localStorage.setItem('lumina-video-url', videoUrl);
            }
        } catch (e) {
            console.error('Failed to save video URL:', e);
        }
    }, [videoUrl]);

    // Auto-save warping to localStorage whenever it changes
    useEffect(() => {
        try {
            localStorage.setItem('lumina-warping', JSON.stringify(warpPoints));
        } catch (e) {
            console.error('Failed to save warping:', e);
        }
    }, [warpPoints]);

    useEffect(() => {
        if (rendererRef.current) {
            warpPoints.forEach((points, i) => rendererRef.current?.updateWarping(i, points));
        }
    }, [warpPoints]);

    // Load and apply video when URL changes
    useEffect(() => {
        if (!videoUrl || !videoRef.current || !rendererRef.current) return;

        const video = videoRef.current;
        video.src = videoUrl;
        video.loop = true;
        video.muted = true; // Auto-play requires muted
        video.crossOrigin = 'anonymous';

        video.addEventListener('loadeddata', () => {
            if (rendererRef.current) {
                rendererRef.current.setVideo(video);
            }
        });

        return () => {
            video.pause();
            video.src = '';
        };
    }, [videoUrl]);

    const updatePoint = useCallback((projIdx: number, pointIdx: number, delta: Point) => {
        setWarpPoints(prev => {
            const next = [...prev];
            next[projIdx] = [...next[projIdx]];
            next[projIdx][pointIdx] = {
                x: next[projIdx][pointIdx].x + delta.x,
                y: next[projIdx][pointIdx].y + delta.y
            };
            return next;
        });
    }, []);

    const resetWarping = () => {
        setWarpPoints([DEFAULT_WARP(), DEFAULT_WARP(), DEFAULT_WARP()]);
    };

    const togglePlayback = () => {
        if (!videoRef.current) return;

        if (isPlaying) {
            videoRef.current.pause();
        } else {
            videoRef.current.play();
        }
        setIsPlaying(!isPlaying);
    };

    const loadVideo = () => {
        const url = prompt('Enter video URL (direct link to mp4, webm, etc):');
        if (url) {
            setVideoUrl(url);
        }
    };

    return (
        <div className="flex h-screen bg-[#0a0e1a] text-slate-300">
            {/* Hidden video element */}
            <video ref={videoRef} style={{ display: 'none' }} playsInline />

            {/* Sidebar */}
            <aside className="w-64 bg-[#0f1419] border-r border-white/10 p-6 flex flex-col gap-6">
                <div>
                    <h1 className="text-xl font-bold text-white mb-1">Lumina Mapper</h1>
                    <div className="text-xs text-slate-600">3 x 1920x1080 Projectors</div>
                </div>

                <div>
                    <h2 className="text-xs font-bold text-slate-500 uppercase mb-3">Projectors</h2>
                    {['P1 (Left)', 'P2 (Center)', 'P3 (Right)'].map((name, i) => (
                        <button
                            key={i}
                            onClick={() => setSelectedProjector(i)}
                            className={`w-full text-left px-3 py-2 rounded-lg mb-1 transition-colors text-sm ${selectedProjector === i
                                ? 'bg-amber-500 text-black font-bold'
                                : 'hover:bg-white/5'
                                }`}
                        >
                            {name}
                        </button>
                    ))}
                </div>

                <div>
                    <h2 className="text-xs font-bold text-slate-500 uppercase mb-3">Video</h2>
                    <select
                        value={videoUrl}
                        onChange={(e) => setVideoUrl(e.target.value)}
                        className="w-full bg-slate-800 text-white px-3 py-2 rounded-lg text-sm mb-2 border border-slate-700 hover:border-slate-600 focus:border-blue-500 focus:outline-none"
                    >
                        <option value="">Select test video...</option>
                        {TEST_VIDEOS.map((video, i) => (
                            <option key={i} value={video.url}>
                                {video.title}
                            </option>
                        ))}
                    </select>
                    {videoUrl && (
                        <div className="text-xs text-slate-500 mb-2">
                            {TEST_VIDEOS.find(v => v.url === videoUrl)?.description || 'Custom URL'}
                        </div>
                    )}
                    <button
                        onClick={loadVideo}
                        className="w-full bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg transition-colors text-sm mb-2"
                    >
                        Custom URL...
                    </button>
                </div>

                <div>
                    <h2 className="text-xs font-bold text-slate-500 uppercase mb-3">Tools</h2>
                    <button
                        onClick={resetWarping}
                        className="w-full bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg transition-colors text-sm"
                    >
                        Reset All Warping
                    </button>
                    {videoUrl && (
                        <div className="mt-3 text-xs text-slate-500 break-all">
                            Video: {videoUrl.substring(0, 40)}...
                        </div>
                    )}
                </div>

                <div className="mt-auto">
                    <div className="text-xs text-slate-600">
                        Phase 1.1 - Monitor Layout
                    </div>
                </div>
            </aside>

            {/* Main Viewport - 3 Monitors Side by Side */}
            <main className="flex-1 flex items-center justify-center p-8 bg-gradient-to-b from-transparent to-black/20">
                <div className="flex flex-row gap-4">
                    {/* Monitor 1 */}
                    <div className="relative">
                        <div className="text-xs text-slate-500 mb-2 font-bold">P1 - Left (1920x1080)</div>
                        <div
                            ref={container1Ref}
                            className="rounded-lg overflow-hidden shadow-2xl ring-1 ring-white/20 relative"
                            style={{ width: '360px', height: '202px', backgroundColor: '#000' }}
                        />

                        {/* SVG Overlay for Monitor 1 */}
                        <svg
                            className="absolute top-6 left-0 pointer-events-none"
                            width="360"
                            height="202"
                            style={{ pointerEvents: 'none' }}
                        >
                            <g opacity={selectedProjector === 0 ? 1 : 0.3}>
                                <polygon
                                    points={warpPoints[0].map(p => `${p.x},${p.y}`).join(' ')}
                                    fill="none"
                                    stroke={selectedProjector === 0 ? '#f59e0b' : '#60a5fa'}
                                    strokeWidth="2"
                                    strokeDasharray={selectedProjector === 0 ? '8,4' : '0'}
                                />
                                {warpPoints[0].map((pt, ptIdx) => (
                                    <g
                                        key={ptIdx}
                                        style={{ pointerEvents: 'auto', cursor: 'move' }}
                                        onMouseDown={(e) => {
                                            e.preventDefault();
                                            const onMove = (m: MouseEvent) => {
                                                updatePoint(0, ptIdx, { x: m.movementX, y: m.movementY });
                                            };
                                            const onUp = () => {
                                                window.removeEventListener('mousemove', onMove);
                                                window.removeEventListener('mouseup', onUp);
                                            };
                                            window.addEventListener('mousemove', onMove);
                                            window.addEventListener('mouseup', onUp);
                                        }}
                                    >
                                        <circle cx={pt.x} cy={pt.y} r="15" fill="transparent" className="hover:fill-amber-500/20" />
                                        <circle cx={pt.x} cy={pt.y} r="6" fill="#f59e0b" stroke="#000" strokeWidth="2" />
                                        <circle cx={pt.x} cy={pt.y} r="2" fill="#fff" />
                                    </g>
                                ))}
                            </g>
                        </svg>
                    </div>

                    {/* Monitor 2 */}
                    <div className="relative">
                        <div className="text-xs text-slate-500 mb-2 font-bold">P2 - Center (1920x1080)</div>
                        <div
                            ref={container2Ref}
                            className="rounded-lg overflow-hidden shadow-2xl ring-1 ring-white/20 relative"
                            style={{ width: '360px', height: '202px', backgroundColor: '#000' }}
                        />

                        <svg
                            className="absolute top-6 left-0 pointer-events-none"
                            width="360"
                            height="202"
                            style={{ pointerEvents: 'none' }}
                        >
                            <g opacity={selectedProjector === 1 ? 1 : 0.3}>
                                <polygon
                                    points={warpPoints[1].map(p => `${p.x},${p.y}`).join(' ')}
                                    fill="none"
                                    stroke={selectedProjector === 1 ? '#f59e0b' : '#60a5fa'}
                                    strokeWidth="2"
                                    strokeDasharray={selectedProjector === 1 ? '8,4' : '0'}
                                />
                                {warpPoints[1].map((pt, ptIdx) => (
                                    <g
                                        key={ptIdx}
                                        style={{ pointerEvents: 'auto', cursor: 'move' }}
                                        onMouseDown={(e) => {
                                            e.preventDefault();
                                            const onMove = (m: MouseEvent) => {
                                                updatePoint(1, ptIdx, { x: m.movementX, y: m.movementY });
                                            };
                                            const onUp = () => {
                                                window.removeEventListener('mousemove', onMove);
                                                window.removeEventListener('mouseup', onUp);
                                            };
                                            window.addEventListener('mousemove', onMove);
                                            window.addEventListener('mouseup', onUp);
                                        }}
                                    >
                                        <circle cx={pt.x} cy={pt.y} r="15" fill="transparent" className="hover:fill-amber-500/20" />
                                        <circle cx={pt.x} cy={pt.y} r="6" fill="#f59e0b" stroke="#000" strokeWidth="2" />
                                        <circle cx={pt.x} cy={pt.y} r="2" fill="#fff" />
                                    </g>
                                ))}
                            </g>
                        </svg>
                    </div>

                    {/* Monitor 3 */}
                    <div className="relative">
                        <div className="text-xs text-slate-500 mb-2 font-bold">P3 - Right (1920x1080)</div>
                        <div
                            ref={container3Ref}
                            className="rounded-lg overflow-hidden shadow-2xl ring-1 ring-white/20 relative"
                            style={{ width: '360px', height: '202px', backgroundColor: '#000' }}
                        />

                        <svg
                            className="absolute top-6 left-0 pointer-events-none"
                            width="360"
                            height="202"
                            style={{ pointerEvents: 'none' }}
                        >
                            <g opacity={selectedProjector === 2 ? 1 : 0.3}>
                                <polygon
                                    points={warpPoints[2].map(p => `${p.x},${p.y}`).join(' ')}
                                    fill="none"
                                    stroke={selectedProjector === 2 ? '#f59e0b' : '#60a5fa'}
                                    strokeWidth="2"
                                    strokeDasharray={selectedProjector === 2 ? '8,4' : '0'}
                                />
                                {warpPoints[2].map((pt, ptIdx) => (
                                    <g
                                        key={ptIdx}
                                        style={{ pointerEvents: 'auto', cursor: 'move' }}
                                        onMouseDown={(e) => {
                                            e.preventDefault();
                                            const onMove = (m: MouseEvent) => {
                                                updatePoint(2, ptIdx, { x: m.movementX, y: m.movementY });
                                            };
                                            const onUp = () => {
                                                window.removeEventListener('mousemove', onMove);
                                                window.removeEventListener('mouseup', onUp);
                                            };
                                            window.addEventListener('mousemove', onMove);
                                            window.addEventListener('mouseup', onUp);
                                        }}
                                    >
                                        <circle cx={pt.x} cy={pt.y} r="15" fill="transparent" className="hover:fill-amber-500/20" />
                                        <circle cx={pt.x} cy={pt.y} r="6" fill="#f59e0b" stroke="#000" strokeWidth="2" />
                                        <circle cx={pt.x} cy={pt.y} r="2" fill="#fff" />
                                    </g>
                                ))}
                            </g>
                        </svg>
                    </div>
                </div>
            </main>
        </div>
    )
}
