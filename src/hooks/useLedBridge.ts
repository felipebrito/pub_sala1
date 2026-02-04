import { useEffect, useRef, useState, useCallback } from 'react';

/**
 * Hook to connect to the Lumina Mapper LED Bridge via WebSocket.
 */
export const useLedBridge = (url: string = 'ws://localhost:8080') => {
    const [isConnected, setIsConnected] = useState(false);
    const wsRef = useRef<WebSocket | null>(null);
    const reconnectTimeoutRef = useRef<number | null>(null);

    const connect = useCallback(() => {
        if (wsRef.current?.readyState === WebSocket.OPEN) return;

        const ws = new WebSocket(url);
        ws.binaryType = 'arraybuffer';

        ws.onopen = () => {
            console.log('[useLedBridge] Connected to Bridge');
            setIsConnected(true);
        };

        ws.onclose = () => {
            console.log('[useLedBridge] Disconnected. Retrying in 3s...');
            setIsConnected(false);
            wsRef.current = null;
            reconnectTimeoutRef.current = window.setTimeout(connect, 3000);
        };

        ws.onerror = (err) => {
            // Error logged by browser usually
            ws.close();
        };

        wsRef.current = ws;
    }, [url]);

    useEffect(() => {
        connect();
        return () => {
            if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
            if (wsRef.current) {
                wsRef.current.onclose = null; // Prevent reconnect on intentional close
                wsRef.current.close();
            }
        };
    }, [connect]);

    const sendData = useCallback((data: Uint8Array) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(data);
            return true;
        }
        return false;
    }, []);

    return { isConnected, sendData };
};
