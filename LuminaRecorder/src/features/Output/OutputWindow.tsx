import { useState } from 'react';
import { WarpCanvas } from '../WarpEditor/WarpCanvas';
import type { WarpState } from '../../App';
import { useWarpReceiver } from '../../hooks/useWarpBroadcast';
import { useElementSize } from '../../hooks/useElementSize';

export function OutputWindow() {
    const [videoSource, setVideoSource] = useState<string | null>(null);
    const [warpState, setWarpState] = useState<WarpState>({
        rows: 2,
        cols: 2,
        grid: [[{ x: 0, y: 0 }, { x: 1, y: 0 }], [{ x: 0, y: 1 }, { x: 1, y: 1 }]] // Default to Corner Pin
    });

    useWarpReceiver((source: string | null, state: WarpState) => {
        // Only update if changed to avoid unnecessary re-renders
        if (source !== videoSource) setVideoSource(source);
        // Deep compare grid? For now just set it.
        setWarpState(state);
    }, () => {
        window.close();
    });

    // Output window should fill the screen
    const { ref, width, height } = useElementSize();

    return (
        <div ref={ref} className="w-screen h-screen bg-black overflow-hidden relative flex items-center justify-center">
            <WarpCanvas
                videoSource={videoSource}
                grid={warpState.grid}
                rows={warpState.rows}
                cols={warpState.cols}
                width={width}
                height={height}
            />
        </div>
    );
}
