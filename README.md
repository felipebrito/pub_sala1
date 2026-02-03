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

## Technology Stack

- **Core**: React 18 + TypeScript + Vite
- **3D Engine**: Three.js (WebGL)
- **Styling**: Tailwind CSS
- **Icons**: Lucide React

## Architecture

### `ThreeRenderer.ts`
The core rendering engine. Replaces standard DOM manipulation with a WebGL context.
- Manages 3 parallel Three.js `Scenes` and `Renderers`.
- Implements `VideoTexture` streaming.
- **Warping Logic**: Directly manipulates the vertex positions of a high-density 32x32 `PlaneGeometry`. Uses `WarpMath.ts` to calculate smooth curves between control points.
- **Input Mapping**: Manipulates UV coordinates of the mesh to "slice" the video texture.

### `WarpMath.ts`
Mathematical helper library.
- Provides **Bilinear** and **Bicubic (Catmull-Rom)** interpolation algorithms to map sparse control points (e.g., 2x2 corners) to a dense mesh surface.

## Getting Started

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Run Development Server**
   ```bash
   npm run dev
   ```

3. **Open in Browser**
   Interact with the UI at `http://localhost:5173`.

## Controls

- **Projectors (Left Sidebar)**: Select P1, P2, or P3 to adjust settings.
- **Warping**: Drag the orange corners on the projector preview to warp the output.
- **Input Mapping**: Use the sliders in the sidebar to choose which part of the video this projector displays.
- **Video Source**: Select from test videos or enter a custom URL.

## License

MIT
