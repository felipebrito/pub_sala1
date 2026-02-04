# Lumina Mapper

**Web-based Video Mapping Software** built with React, Three.js, and Vite.
Simulates a professional projection mapping workflow directly in the browser.

![Lumina Mapper](https://github.com/user-attachments/assets/placeholder.png)

## Features

- **Multi-Projector Support**: Controls 3 independent projector outputs (Virtual Canvas).
- **Advanced Warping**: 
  - Quad-corner pinning for keystone correction.
  - **High-Density Mesh Interpolation (32x32)**: Uses bicubic mathematical interpolation to prevent texture distortion (zig-zag artifacts) during heavy warping.
- **Input Mapping (Slicing)**: 
  - Dynamic input cropping per projector.
  - Select specific regions of a source video (e.g., Left 1/3, Center 1/3) for each output.
  - Adjustable X, Y, Width, and Height sliders.
- **Video Reference**:
  - Background "Ghost Video" reference (Optional) or clean output mode.
  - Optimized VideoTexture handling via Three.js.
  - Auto-play and loop management.
- **LED Bridge (Art-Net)**:
  - Real-time 1D Pixel Sampling from the WebGL canvas.
  - Art-Net (DMX) output over UDP (Broadcast).
  - Standalone Node.js bridge for hardware integration (ESP32/WLED/Resolume).

## Technology Stack

- **Frontend**: React 18 + TypeScript + Vite + Three.js
- **Bridge**: Node.js + `dgram` (UDP) + `ws` (WebSockets)
- **Protocols**: Art-Net (ArtDMX), WebSocket (Binary)

## Architecture

### `ThreeRenderer.ts`
The core rendering engine. Replaces standard DOM manipulation with a WebGL context.
- Manages 3 parallel Three.js `Scenes` and `Renderers`.
- Implements `VideoTexture` streaming.
- **Warping Logic**: Directly manipulates the vertex positions of a high-density 32x32 `PlaneGeometry`. Uses `WarpMath.ts` to calculate smooth curves between control points.
- **Input Mapping**: Manipulates UV coordinates of the mesh to "slice" the video texture.
- **Pixel Sampling**: Captures RGB data from the canvas at 30 FPS for LED synchronization.

### LED Bridge (`/bridge`)
A standalone Node.js service that acts as a middleware between the browser and the LED hardware.
- **WebSocket Server**: Receives binary pixel data from the browser.
- **Art-Net Sender**: Packs data into ArtDMX packets and broadcasts them to the network (Port 6454).
- **Fallback Generator**: Sends test patterns (corners, gradient, chase) when the browser is disconnected.

## Getting Started

1. **Install Dependencies**
   ```bash
   npm install && cd bridge && npm install
   ```

2. **Run the Bridge (For LEDs)**
   ```bash
   cd bridge
   node index.js
   ```

3. **Run Development Server**
   ```bash
   npm run dev
   ```

4. **Open in Browser**
   Interact with the UI at `http://localhost:5173`. Toggle **BROADCASTING** in the sidebar to send data to the LEDs.

## Roadmap & Changelog

### ✅ Completed
- [x] **Core Engine rewrite**: Transitioned to unified `ProjectorConfig` state.
- [x] **Advanced Warping Modes**: Linear (Quad) and Bicubic (Bezier) 4x4.
- [x] **LED Bridge Protocol**:
    - [x] Node.js Middleware (WS to Art-Net).
    - [x] Browser sampling logic (30 FPS).
    - [x] Multi-universe support (180+ pixels).
- [x] **Dual Video Engine**: Smooth crossfading between "Idle" and "Main" loops.

### 🚧 Upcoming / Planned
- [ ] **Edge Blending**: Soft gradient masking for overlapping projectors.
- [ ] **Custom Grid density**: Manual N x N grid controls.
- [ ] **Preset Management**: Export/Import configurations to JSON.
- [ ] **Masking**: Ability to draw black masks to hide unwanted areas.

## License

MIT
