import { useEffect, useRef, useState, useCallback } from 'react';

/**
 * Hook to connect to the Lumina Mapper LED Bridge via WebSocket.
 */
export const useLedBridge = (url: string = 'ws://localhost:3002') => {
    const [isConnected, setIsConnected] = useState(false);
    const [lastMessage, setLastMessage] = useState<any>(null);
    const wsRef = useRef<WebSocket | null>(null);
    const reconnectTimeoutRef = useRef<number | null>(null);

    const connect = useCallback(() => {
        if (wsRef.current?.readyState === WebSocket.OPEN) return;

        const ws = new WebSocket(url);
        // Do NOT set binaryType to arraybuffer globally if we want to receive text too.
        // Or handle blob/arraybuffer conversion.
        // Default is blob for binary, string for text.
        // Ideally we keep binaryType default (blob) and converting or check type.
        // BUT existing code expects arraybuffer.
        // Let's set it to 'arraybuffer' and decode text manually if needed OR check data type.
        // Actually, if we set binaryType='arraybuffer', text frames might arrive as ArrayBuffer? No, text frames stay text?
        // Let's test. Standard WebSocket: binaryType affects binary frames. Text frames are still strings.
        ws.binaryType = 'arraybuffer';

        ws.onopen = () => {
            console.log('[useLedBridge] Connected to Bridge');
            setIsConnected(true);
        };

        ws.onmessage = async (event) => {
            let msgData = event.data;

            // Handle Blob/ArrayBuffer for text frames if binaryType is 'arraybuffer'
            if (msgData instanceof ArrayBuffer) {
                // Try to detect if it's JSON (starts with { and ends with })
                // This is a naive check but useful if we mix binary/text
                const text = new TextDecoder().decode(msgData);
                if (text.startsWith('{') && text.endsWith('}')) {
                    msgData = text;
                }
            } else if (msgData instanceof Blob) {
                msgData = await msgData.text();
            }

            if (typeof msgData === 'string') {
                try {
                    const json = JSON.parse(msgData);
                    setLastMessage(json);
                } catch (e) {
                    // Not JSON? Maybe debugging text?
                    console.log('[Bridge MSG]', msgData);
                }
            } else {
                // Real Binary (Pixel Data?) - Ignore
            }
        };

        ws.onclose = () => {
            console.log('[useLedBridge] Disconnected. Retrying in 3s...');
            setIsConnected(false);
            wsRef.current = null;
            reconnectTimeoutRef.current = window.setTimeout(connect, 3000);
        };

        ws.onerror = (err) => {
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

    const sendJson = useCallback((data: any) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify(data));
            return true;
        }
        return false;
    }, []);

    return { isConnected, sendData, sendJson, lastMessage };
};

