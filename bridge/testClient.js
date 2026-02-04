import { WebSocket } from 'ws';

const WS_URL = 'ws://localhost:8080';
const ws = new WebSocket(WS_URL);

ws.on('open', () => {
    console.log('Connected to Lumina Bridge');

    // Send a pure magenta frame every 33ms
    setInterval(() => {
        const data = new Uint8Array(180 * 3);
        for (let i = 0; i < 180; i++) {
            data[i * 3] = 255;   // R
            data[i * 3 + 1] = 0; // G
            data[i * 3 + 2] = 255; // B
        }
        ws.send(data);
    }, 33);
});

ws.on('error', (err) => {
    console.error('WS Error:', err.message);
});

ws.on('close', () => {
    console.log('Disconnected from bridge');
});
