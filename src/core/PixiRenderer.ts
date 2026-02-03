import * as PIXI from 'pixi.js';

export class PixiRenderer {
    private apps: PIXI.Application[] = [];
    private meshes: PIXI.SimplePlane[] = [];
    public containers: HTMLElement[] = [];

    constructor(container1: HTMLElement, container2: HTMLElement, container3: HTMLElement) {
        this.containers = [container1, container2, container3];

        // Create 3 separate PixiJS applications, one per monitor
        // Each is 1920x1080 internally, scaled down to 360x202 for display
        const displayWidth = 360;
        const displayHeight = 202;

        [container1, container2, container3].forEach((container, i) => {
            const app = new PIXI.Application({
                width: displayWidth,
                height: displayHeight,
                backgroundColor: 0x1a1a1a,
                antialias: true,
                resolution: window.devicePixelRatio || 1,
            });

            container.appendChild(app.view as HTMLCanvasElement);
            this.apps.push(app);

            // Create mesh for warping (10x10 grid)
            const mesh = new PIXI.SimplePlane(PIXI.Texture.WHITE, 10, 10);
            mesh.width = displayWidth;
            mesh.height = displayHeight;
            mesh.tint = 0x333333;

            app.stage.addChild(mesh);
            this.meshes.push(mesh);

            // Border to simulate monitor frame
            const border = new PIXI.Graphics();
            border.lineStyle(2, 0x666666, 1);
            border.drawRect(0, 0, displayWidth, displayHeight);
            app.stage.addChild(border);

            // Label
            const labels = ['P1 (Left)', 'P2 (Center)', 'P3 (Right)'];
            const text = new PIXI.Text(labels[i], {
                fontSize: 24,
                fill: 0x888888,
                fontWeight: 'bold'
            });
            text.x = displayWidth / 2 - text.width / 2;
            text.y = displayHeight / 2 - text.height / 2;
            text.alpha = 0.3;
            app.stage.addChild(text);
        });
    }

    public setVideo(video: HTMLVideoElement) {
        const baseTexture = PIXI.BaseTexture.from(video, {
            resourceOptions: {
                autoPlay: false,
            }
        });
        const videoTexture = new PIXI.Texture(baseTexture);

        this.meshes.forEach((mesh, i) => {
            mesh.texture = videoTexture;
            mesh.tint = 0xFFFFFF; // Remove gray tint when video is loaded

            // UV mapping: each monitor sees 1/3 of the video
            // P1: 0-0.33, P2: 0.33-0.66, P3: 0.66-1.0
            const buffer = mesh.geometry.getBuffer('aTextureCoord');
            const uvs = buffer.data as unknown as Float32Array;

            const uStart = i * 0.33333;
            const uEnd = (i + 1) * 0.33333;

            for (let j = 0; j < uvs.length; j += 2) {
                const u = uvs[j];
                uvs[j] = uStart + u * (uEnd - uStart);
            }
            buffer.update();
        });

        // Update video texture on each frame
        this.apps.forEach(app => {
            app.ticker.add(() => {
                if (baseTexture.valid) {
                    baseTexture.update();
                }
            });
        });
    }

    public updateWarping(index: number, points: { x: number; y: number }[]) {
        const mesh = this.meshes[index];
        if (!mesh) return;

        const buffer = mesh.geometry.getBuffer('aVertexPosition');
        const vertices = buffer.data as unknown as Float32Array;
        // CLOCKWISE order: TL, TR, BR, BL
        const [tl, tr, br, bl] = points;

        // Points are in local coordinates (0-360, 0-202)
        // Apply bilinear interpolation for 10x10 grid
        for (let iy = 0; iy <= 10; iy++) {
            for (let ix = 0; ix <= 10; ix++) {
                const idx = (iy * 11 + ix) * 2;
                const u = ix / 10;
                const v = iy / 10;

                const topX = tl.x * (1 - u) + tr.x * u;
                const topY = tl.y * (1 - u) + tr.y * u;
                const botX = bl.x * (1 - u) + br.x * u;
                const botY = bl.y * (1 - u) + br.y * u;

                vertices[idx] = topX * (1 - v) + botX * v;
                vertices[idx + 1] = topY * (1 - v) + botY * v;
            }
        }
        buffer.update();
    }

    public dispose() {
        this.apps.forEach(app => app.destroy(true, { children: true, texture: true, baseTexture: true }));
    }
}
