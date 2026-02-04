import { CONFIG } from './config.js';
import { ArtnetSender } from './artnetSender.js';
import { FrameGenerator } from './frameGenerator.js';

const sender = new ArtnetSender(CONFIG.TARGET_IP, CONFIG.PORT);
const generator = new FrameGenerator(CONFIG.PIXEL_COUNT);

let frameCount = 0;
let lastLogTime = Date.now();
let currentPattern = 'gradient'; // gradient, corner, chase

/**
 * Main Loop
 */
function tick() {
    // 1. Generate frame data (180 pixels * 3 channels = 540 bytes)
    let pixelData;
    if (currentPattern === 'gradient') {
        pixelData = generator.createGradient();
    } else if (currentPattern === 'corner') {
        pixelData = generator.createCornerTest();
    } else {
        pixelData = generator.createChase();
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
    const now = Date.now();
    if (now % 15000 < 5000) currentPattern = 'corner';
    else if (now % 15000 < 10000) currentPattern = 'gradient';
    else currentPattern = 'chase';

    // 5. Logging
    if (now - lastLogTime >= 1000) {
        const fps = frameCount;
        process.stdout.write(`\r[Lumina Bridge] FPS: ${fps} | Pattern: ${currentPattern} | U0: ${u0Data.length}b | U1: ${u1Data.length}b   `);
        frameCount = 0;
        lastLogTime = now;
    }
}

console.log('--- Lumina Mapper Bridge (Milestone 0) ---');
console.log(`Target: ${CONFIG.TARGET_IP}:${CONFIG.PORT}`);
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
