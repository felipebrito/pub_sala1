import { SerialSender } from './serialSender.js';
import { FrameGenerator } from './frameGenerator.js';
import { CONFIG } from './config.js';
import { WebSocketServer } from 'ws';

import { SerialPort } from 'serialport';

// Force null to wait for user selection
const SERIAL_PORT = null; // process.env.SERIAL_PORT || null;
const sender = new SerialSender(SERIAL_PORT, 115200);
const generator = new FrameGenerator(CONFIG.PIXEL_COUNT);

// WebSocket Server
const wss = new WebSocketServer({ port: CONFIG.WS_PORT });
let lastWsData = null;
let lastWsTime = 0;

wss.on('connection', (ws) => {
    console.log(`\n[WS] Client connected. Total clients: ${wss.clients.size}`);

    // Auto-send ports
    SerialPort.list().then(ports => {
        ws.send(JSON.stringify({ type: 'PORTS_LIST', ports }));
    }).catch(err => console.error('[Bridge] Error listing ports:', err));

    ws.on('message', async (data) => {
        // Expecting binary data (Uint8Array of 540 bytes)
        if (data instanceof Buffer || data instanceof Uint8Array) {
            lastWsData = new Uint8Array(data);
            lastWsTime = Date.now();
        } else {
            // Handle Command Messages (JSON)
            try {
                const msg = JSON.parse(data);
                if (msg.type === 'GET_PORTS') {
                    // Send list of ports
                    console.log('[Bridge] Requesting ports list...');
                    const ports = await SerialPort.list();
                    console.log(`[Bridge] Found ${ports.length} ports.`);
                    ws.send(JSON.stringify({ type: 'PORTS_LIST', ports }));
                }
                if (msg.type === 'SET_PORT') {
                    console.log(`[Bridge] Switching to port: ${msg.port}`);
                    sender.close();
                    sender.portPath = msg.port;
                    sender.connect();
                    // Confirm back
                    ws.send(JSON.stringify({ type: 'PORT_SET', port: msg.port }));
                }
            } catch (e) {
                // Ignore non-json or binary
            }
        }
    });

    ws.on('close', () => {
        console.log(`\n[WS] Client disconnected. Total clients: ${wss.clients.size}`);
    });
});

let frameCount = 0;
let lastLogTime = Date.now();
// let currentPattern = 'gradient';

/**
 * Main Loop
 */
function tick() {
    const now = Date.now();

    // 1. Determine data source: real data (WebSocket) or synthetic (Patterns)
    let pixelData;
    const dataTimeout = 1000; // 1 second timeout

    if (lastWsData && (now - lastWsTime < dataTimeout)) {
        pixelData = lastWsData;
    } else {
        // IDLE: Send Black (0)
        pixelData = new Uint8Array(CONFIG.PIXEL_COUNT * 3).fill(0);
    }

    // 3. Send via Serial (Adalight)
    // Flatten universes or just send raw pixel data directly if it fits in one go
    // For Adalight with ESP, we typically send the whole buffer at once if receiving side supports it.
    // Our ESP firmware supports varying lengths, up to NUM_LEDS.

    // Combine if splitting was only for ArtNet universe limits
    // Adalight limit is usually high (limited by baudrate/fps)
    sender.send(pixelData);

    frameCount++;

    // 5. Logging
    if (now - lastLogTime >= 1000) {
        const fps = frameCount;
        const hasSource = (lastWsData && (now - lastWsTime < dataTimeout));
        const source = hasSource ? 'WS' : 'Idle';
        const status = hasSource ? 'Streaming' : 'Black';
        process.stdout.write(`\r[Lumina Bridge] FPS: ${fps} | Src: ${source} | Status: ${status} | Bytes: ${pixelData.length}   `);
        frameCount = 0;
        lastLogTime = now;
    }
}

console.log('--- Lumina Mapper Bridge (Milestone 1) ---');
console.log(`Serial Port: ${SERIAL_PORT}`);
console.log(`WebSocket: ws://localhost:${CONFIG.WS_PORT}`);
console.log(`Pixels: ${CONFIG.PIXEL_COUNT} (180)`);
console.log(`Protocol: Adalight (Serial)`);
console.log('------------------------------------------');

setInterval(tick, CONFIG.TICK_INTERVAL);

// Handle exit
process.on('SIGINT', () => {
    console.log('\nClosing bridge...');
    sender.close();
    process.exit();
});
