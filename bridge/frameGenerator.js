/**
 * Frame Generator
 * Creates RGB pixel data patterns for a 1D strip.
 */
export class FrameGenerator {
    constructor(pixelCount) {
        this.pixelCount = pixelCount;
        this.chaseIndex = 0;
    }

    /**
     * Corner test: Pixel 1 Red, Pixel 180 Blue
     */
    createCornerTest() {
        const data = new Uint8Array(this.pixelCount * 3);
        // Pixel 1 (index 0) = Red
        data[0] = 255;
        data[1] = 0;
        data[2] = 0;

        // Pixel 180 (index 179) = Blue
        const lastIdx = (this.pixelCount - 1) * 3;
        data[lastIdx] = 0;
        data[lastIdx + 1] = 0;
        data[lastIdx + 2] = 255;

        return data;
    }

    /**
     * Linear RGB Gradient along the strip
     */
    createGradient() {
        const data = new Uint8Array(this.pixelCount * 3);
        for (let i = 0; i < this.pixelCount; i++) {
            const ratio = i / (this.pixelCount - 1);
            data[i * 3] = Math.round(255 * (1 - ratio)); // Red fades out
            data[i * 3 + 1] = Math.round(255 * ratio);   // Green fades in
            data[i * 3 + 2] = Math.round(255 * Math.sin(ratio * Math.PI)); // Blue peak in middle
        }
        return data;
    }

    /**
     * Simple Chase: Single white pixel moving along the strip
     */
    createChase() {
        const data = new Uint8Array(this.pixelCount * 3);
        const idx = Math.floor(this.chaseIndex) % this.pixelCount;

        data[idx * 3] = 255;
        data[idx * 3 + 1] = 255;
        data[idx * 3 + 2] = 255;

        this.chaseIndex = (this.chaseIndex + 0.5) % this.pixelCount; // Speed adjustment
        return data;
    }
}
