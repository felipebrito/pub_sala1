import { useState, useEffect, useRef } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { useElementSize } from '../../hooks/useElementSize';
import { WarpCanvas } from './WarpCanvas';
import { cn } from '../../utils';
import { RotateCcw, ExternalLink } from 'lucide-react';
import type { WarpState } from '../../App';
import { useWarpBroadcast } from '../../hooks/useWarpBroadcast';

interface WarpEditorProps {
    onNext: () => void;
    onBack: () => void;
    videoSource: string | null;
    warpState: WarpState;
    setWarpState: Dispatch<SetStateAction<WarpState>>;
}

const createGrid = (rows: number, cols: number) => {
    const grid = [];
    for (let r = 0; r < rows; r++) {
        const row = [];
        for (let c = 0; c < cols; c++) {
            row.push({ x: c / (cols - 1), y: r / (rows - 1) });
        }
        grid.push(row);
    }
    return grid;
};

export function WarpEditor({ onNext, onBack, videoSource, warpState, setWarpState }: WarpEditorProps) {
    const { ref: containerRef, element: containerElement, width, height } = useElementSize();
    const [activePoint, setActivePoint] = useState<{ r: number, c: number } | null>(null); // For keyboard & visual selection
    const dragTargetRef = useRef<{ r: number, c: number } | null>(null); // For Mouse Dragging
    const { sendMessage, channel } = useWarpBroadcast();

    // Default to 2x2
    useEffect(() => {
        if (!warpState.grid || warpState.grid.length === 0) {
            setWarpState({
                rows: 2,
                cols: 2,
                grid: createGrid(2, 2)
            });
        }
    }, []);

    // Broadcast
    useEffect(() => {
        sendMessage({ type: 'SYNC_STATE', payload: { videoSource, warpState } });
    }, [videoSource, warpState, sendMessage]);

    // Sync Listener
    useEffect(() => {
        if (!channel) return;
        channel.onmessage = (event) => {
            if (event.data.type === 'REQUEST_SYNC') {
                sendMessage({ type: 'SYNC_STATE', payload: { videoSource, warpState } });
            }
        };
    }, [channel, videoSource, warpState, sendMessage]);

    // KEYBOARD CONTROLS
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Select Corners 1-4
            if (['1', '2', '3', '4'].includes(e.key)) {
                if (warpState.rows !== 2 || warpState.cols !== 2) return; // Only for 2x2 as requested
                const map: Record<string, { r: number, c: number }> = {
                    '1': { r: 0, c: 0 }, // TL
                    '2': { r: 0, c: 1 }, // TR
                    '3': { r: 1, c: 0 }, // BL
                    '4': { r: 1, c: 1 }, // BR
                };
                setActivePoint(map[e.key]);
            }

            // Move with Arrows
            if (activePoint && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
                e.preventDefault();
                const step = e.shiftKey ? 0.05 : 0.005; // Shift for faster movement
                let dx = 0;
                let dy = 0;

                if (e.key === 'ArrowLeft') dx = -step;
                if (e.key === 'ArrowRight') dx = step;
                if (e.key === 'ArrowUp') dy = -step;
                if (e.key === 'ArrowDown') dy = step;

                setWarpState(prev => ({
                    ...prev,
                    grid: prev.grid.map((row, r) => {
                        if (r !== activePoint.r) return row;
                        return row.map((p, c) => {
                            if (c !== activePoint.c) return p;
                            return {
                                x: Math.max(0, Math.min(1, p.x + dx)),
                                y: Math.max(0, Math.min(1, p.y + dy))
                            };
                        });
                    })
                }));
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [activePoint, warpState.rows, warpState.cols]);


    // MOUSE / TOUCH DRAG Handlers (Direct Element Capture)
    const handlePointerMove = (e: React.PointerEvent) => {
        if (!dragTargetRef.current || !containerElement) return;
        e.preventDefault();

        const rect = containerElement.getBoundingClientRect();
        const w = rect.width;
        const h = rect.height;

        if (w === 0 || h === 0) return;

        let x = (e.clientX - rect.left) / w;
        let y = (e.clientY - rect.top) / h;

        x = Math.max(0, Math.min(1, x));
        y = Math.max(0, Math.min(1, y));

        const target = dragTargetRef.current;

        setWarpState(prev => ({
            ...prev,
            grid: prev.grid.map((row, r) => {
                if (r !== target.r) return row;
                return row.map((p, c) => {
                    if (c !== target.c) return p;
                    return { x, y };
                });
            })
        }));
    };

    const handlePointerUp = (e: React.PointerEvent) => {
        if (dragTargetRef.current) {
            console.log('Drag End');
            dragTargetRef.current = null;
            try {
                e.currentTarget.releasePointerCapture(e.pointerId);
            } catch (err) {
                // Ignore if lost
            }
        }
    };

    const handlePointerCancel = () => {
        if (dragTargetRef.current) {
            console.warn('Drag Canceled');
            dragTargetRef.current = null;
        }
    };

    const handleContainerPointerDown = (e: React.PointerEvent) => {
        if (!containerElement) return;

        // Measure immediately to ensure valid dimensions
        const rect = containerElement.getBoundingClientRect();
        const w = rect.width;
        const h = rect.height;

        if (w === 0 || h === 0) {
            console.warn('PointerDown: Element has 0 size, cannot interact.');
            return;
        }

        const clickX = (e.clientX - rect.left) / w;
        const clickY = (e.clientY - rect.top) / h;

        // Radius in normalized coords (approx 30px for better touch)
        const hitRadiusX = 30 / w;
        const hitRadiusY = 30 / h;

        let closest: any = null;

        warpState.grid.forEach((row, r) => {
            row.forEach((p, c) => {
                const dx = Math.abs(p.x - clickX);
                const dy = Math.abs(p.y - clickY);
                if (dx < hitRadiusX && dy < hitRadiusY) {
                    const dist = dx * dx + dy * dy;
                    if (!closest || dist < closest.dist) {
                        closest = { r, c, dist };
                    }
                }
            });
        });

        if (closest) {
            const hit = closest as { r: number, c: number };
            console.log('Drag Start', hit.r, hit.c);
            e.preventDefault();
            e.currentTarget.setPointerCapture(e.pointerId);

            const target = { r: hit.r, c: hit.c };
            dragTargetRef.current = target;
            setActivePoint(target); // Sync visual selection
        }
    };

    const updateGridSize = (r: number, c: number) => {
        setWarpState({
            rows: r,
            cols: c,
            grid: createGrid(r, c)
        });
        setActivePoint(null);
    };

    const resetGrid = () => {
        setWarpState({
            ...warpState,
            grid: createGrid(warpState.rows, warpState.cols)
        });
    };

    const openOutputWindow = () => {
        window.open('?window=output', 'LuminaOutput', 'width=800,height=600');
    };

    if (!warpState.grid || warpState.grid.length === 0) return null;

    return (
        <div className="flex h-full flex-col">
            {/* Top Toolbar */}
            <div className="flex items-center justify-between px-8 py-4 bg-surface border-b border-surface/50 shadow-md">
                <div className="flex gap-4 items-center">
                    <span className="text-slate-400 font-medium font-mono text-sm uppercase tracking-wider">Grid Resolution</span>
                    <select
                        value={warpState.rows}
                        onChange={(e) => updateGridSize(parseInt(e.target.value), parseInt(e.target.value))}
                        className="bg-background text-slate-200 border border-slate-700 rounded-md px-3 py-1.5 focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all"
                    >
                        <option value={2}>2x2 (Corner Pin)</option>
                        <option value={3}>3x3 (Bezier)</option>
                        <option value={4}>4x4 (Detailed)</option>
                        <option value={5}>5x5 (High Res)</option>
                    </select>
                    <button
                        onClick={resetGrid}
                        className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-md text-sm transition-colors border border-slate-700"
                    >
                        <RotateCcw className="w-4 h-4" /> Reset
                    </button>
                    <div className="w-px h-6 bg-slate-700 mx-2" />
                    <button
                        onClick={openOutputWindow}
                        className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-primary/20 text-primary hover:text-primary rounded-md text-sm transition-colors border border-primary/30"
                    >
                        <ExternalLink className="w-4 h-4" /> Open Projector Window
                    </button>
                </div>

                <div className="flex gap-4">
                    <button onClick={onBack} className="px-4 py-2 text-slate-400 hover:text-white transition-colors font-medium">Back</button>
                    <button
                        onClick={onNext}
                        className="px-6 py-2 bg-primary hover:bg-amber-400 text-black rounded-lg font-bold shadow-lg shadow-primary/20 transition-all hover:scale-105 active:scale-95"
                    >
                        Next Step
                    </button>
                </div>
            </div>

            {/* Main Workspace */}
            <div className="flex-1 bg-black relative flex items-center justify-center p-8">
                <p className="absolute top-4 left-1/2 -translate-x-1/2 text-slate-500 text-sm select-none pointer-events-none">
                    Shortcuts: [1-2-3-4] to select corners • Arrows to move • Shift+Arrows for big steps
                </p>

                <div
                    ref={containerRef}
                    className="relative aspect-video w-full max-w-6xl shadow-2xl border border-neutral-800 cursor-crosshair touch-none select-none"
                    onPointerDown={handleContainerPointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onPointerCancel={handlePointerCancel}
                    onPointerLeave={handlePointerUp} // Also stop on leave if not captured (captured prevents leave, but safety first)
                    onContextMenu={(e) => e.preventDefault()}
                >
                    <div className="pointer-events-none w-full h-full">
                        <WarpCanvas
                            videoSource={videoSource}
                            grid={warpState.grid}
                            rows={warpState.rows}
                            cols={warpState.cols}
                            width={width}
                            height={height}
                        />
                    </div>

                    {/* SVG Overlay */}
                    <svg className="absolute inset-0 w-full h-full pointer-events-none">
                        {width > 0 && height > 0 && warpState.grid.map((row, r) => {
                            const pathData = row.reduce((acc, p, i) => {
                                const px = p.x * width;
                                const py = p.y * height;
                                return acc + (i === 0 ? `M ${px} ${py}` : ` L ${px} ${py}`);
                            }, "");
                            return <path key={`row-${r}`} d={pathData} stroke="rgba(245, 158, 11, 0.6)" strokeWidth="1.5" fill="none" />;
                        })}
                        {width > 0 && height > 0 && Array.from({ length: warpState.cols }).map((_, c) => {
                            const pathData = warpState.grid.reduce((acc, row, r) => {
                                const p = row[c];
                                const px = p.x * width;
                                const py = p.y * height;
                                return acc + (r === 0 ? `M ${px} ${py}` : ` L ${px} ${py}`);
                            }, "");
                            return <path key={`col-${c}`} d={pathData} stroke="rgba(245, 158, 11, 0.6)" strokeWidth="1.5" fill="none" />;
                        })}
                    </svg>

                    {/* Visual Points (Non-interactive, interactions handled by container) */}
                    {warpState.grid.map((row, r) => row.map((p, c) => (
                        <div
                            key={`${r}-${c}`}
                            className={cn(
                                "absolute w-5 h-5 -ml-2.5 -mt-2.5 rounded-full border-2 transition-transform shadow-lg pointer-events-none",
                                activePoint?.r === r && activePoint?.c === c
                                    ? "bg-primary border-white scale-125 shadow-primary/50"
                                    : "bg-surface border-primary"
                            )}
                            style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%` }}
                        />
                    )))}
                </div>
            </div>
        </div>
    );
}
