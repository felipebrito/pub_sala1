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

- **Projectors**: Select P1, P2, or P3.
- **Warp Modes**: 
  - **Quad**: Standard 4-corner perspective correction (Linear).
  - **Bezier**: Advanced warping with control handles for curved surfaces (Bicubic).
- **Interaction**:
  - **Drag**: Move control points.
  - **Shift/Ctrl + Click**: Select multiple points to move them together.
- **Input Mapping**: Crop specific regions of the source video.

## Roadmap & Changelog

### ✅ Completed
- [x] **Core Engine rewrite**: Transitioned to unified `ProjectorConfig` state.
- [x] **High-Performance Mesh**: 32x32 vertex grid for smooth distortions.
- [x] **Advanced Warping Modes**:
  - **Linear (Quad)**: 2x2 Grid with straight edges.
  - **Bicubic (Bezier)**: 4x4 Grid approximation with intelligent control handles.
- [x] **Coons Patch Math**: Auto-calculation of internal surface points for perfect curves.
- [x] **Enhanced UI/UX**:
  - Multi-selection of points (Shift/Ctrl + Click).
  - Visual feedback for handles vs corners.

### 🚧 Upcoming / Planned
- [ ] **Edge Blending**: Soft gradient masking for overlapping projectors.
- [ ] **Custom Grid density**: Manual N x N grid controls.
- [ ] **Preset Management**: Export/Import configurations to JSON.
- [ ] **Masking**: Ability to draw black masks to hide unwanted areas.

## License

MIT
