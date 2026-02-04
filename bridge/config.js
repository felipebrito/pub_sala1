export const CONFIG = {
    // LED Strip configuration
    PIXEL_COUNT: 180,
    CHANNELS_PER_PIXEL: 3, // RGB

    // Art-Net configuration
    TARGET_IP: '255.255.255.255', // Broadcast for easier discovery
    PORT: 6454,

    // WebSocket configuration
    WS_PORT: 8080,

    // Universe mapping
    // Universe 0: pixels 1-170 (510 channels)
    // Universe 1: pixels 171-180 (30 channels)
    UNIVERSES: [
        { id: 0, pixelRange: [0, 170], channelCount: 510 },
        { id: 1, pixelRange: [170, 180], channelCount: 30 }
    ],

    // Timing
    FPS: 30,
    TICK_INTERVAL: 1000 / 30
};
