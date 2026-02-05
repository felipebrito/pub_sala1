import { useEffect, useRef, useCallback } from 'react';
import type { WarpState } from '../App';

type BroadcastMessage =
    | { type: 'SYNC_STATE'; payload: { videoSource: string | null; warpState: WarpState } }
    | { type: 'REQUEST_SYNC' }
    | { type: 'CLOSE_WINDOW' };

const CHANNEL_NAME = 'lumina_recorder_channel';

export function useWarpBroadcast() {
    const channelRef = useRef<BroadcastChannel | null>(null);

    useEffect(() => {
        channelRef.current = new BroadcastChannel(CHANNEL_NAME);
        return () => {
            channelRef.current?.close();
        };
    }, []);

    const sendMessage = useCallback((message: BroadcastMessage) => {
        channelRef.current?.postMessage(message);
    }, []);

    return { sendMessage, channel: channelRef.current };
}

export function useWarpReceiver(
    onStateReceived: (videoSource: string | null, warpState: WarpState) => void,
    onClose?: () => void
) {
    useEffect(() => {
        const channel = new BroadcastChannel(CHANNEL_NAME);

        channel.onmessage = (event) => {
            const message = event.data as BroadcastMessage;
            if (message.type === 'SYNC_STATE') {
                onStateReceived(message.payload.videoSource, message.payload.warpState);
            } else if (message.type === 'CLOSE_WINDOW' && onClose) {
                onClose();
            }
        };

        // Request initial state when mounting output window
        channel.postMessage({ type: 'REQUEST_SYNC' });

        return () => channel.close();
    }, [onStateReceived, onClose]);
}
