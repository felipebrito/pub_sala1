import { CONFIG } from './config.js';
import { ArtnetSender } from './artnetSender.js';
import { FrameGenerator } from './frameGenerator.js';
import { WebSocketServer } from 'ws';

const sender = new ArtnetSender(CONFIG.TARGET_IP, CONFIG.PORT);
const generator = new FrameGenerator(CONFIG.PIXEL_COUNT);

// WebSocket Server
const wss = new WebSocketServer({ port: CONFIG.WS_PORT });
let lastWsData = null;
let lastWsTime = 0;

wss.on('connection', (ws) => {
    console.log(`\n[WS] Client connected. Total clients: ${wss.clients.size}`);

    ws.on('message', (data) => {
        // Expecting binary data (Uint8Array of 540 bytes)
        if (data instanceof Buffer || data instanceof Uint8Array) {
            lastWsData = new Uint8Array(data);
            lastWsTime = Date.now();
        }
    });

    ws.on('close', () => {
        console.log(`\n[WS] Client disconnected. Total clients: ${wss.clients.size}`);
    });
});

let frameCount = 0;
let lastLogTime = Date.now();
let currentPattern = 'gradient'; // gradient, corner, chase

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
        // Fallback to patterns
        if (currentPattern === 'gradient') {
            pixelData = generator.createGradient();
        } else if (currentPattern === 'corner') {
            pixelData = generator.createCornerTest();
        } else {
            pixelData = generator.createChase();
        }
    }

    // 2. Split into universes
    // Universe 0: 170 pixels (510 channels)
    const u0Data = pixelData.slice(0, 510);
    // Universe 1: 10 pixels (30 channels)
    const u1Data = pixelData.slice(510, 540);

    // 3. Send via Art-Net
    sender.send(0, u0Data);
    sender.send(1, u1Data);

    frameCount++;

    // 4. Pattern switching logic (demo purposes)
    if (now % 15000 < 5000) currentPattern = 'corner';
    else if (now % 15000 < 10000) currentPattern = 'gradient';
    else currentPattern = 'chase';

    // 5. Logging
    if (now - lastLogTime >= 1000) {
        const fps = frameCount;
        const source = (lastWsData && (now - lastWsTime < dataTimeout)) ? 'WS' : 'Ptr';
        process.stdout.write(`\r[Lumina Bridge] FPS: ${fps} | Src: ${source} | Pattern: ${currentPattern} | U0: ${u0Data.length}b | U1: ${u1Data.length}b   `);
        frameCount = 0;
        lastLogTime = now;
    }
}

console.log('--- Lumina Mapper Bridge (Milestone 1) ---');
console.log(`Target: ${CONFIG.TARGET_IP}:${CONFIG.PORT}`);
console.log(`WebSocket: ws://localhost:${CONFIG.WS_PORT}`);
console.log(`Pixels: ${CONFIG.PIXEL_COUNT} (180)`);
console.log(`Universes: 0 (510 ch), 1 (30 ch)`);
console.log('------------------------------------------');

setInterval(tick, CONFIG.TICK_INTERVAL);

// Handle exit
process.on('SIGINT', () => {
    console.log('\nClosing bridge...');
    sender.close();
    process.exit();
});
