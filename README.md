# Lumina Mapper

Professional multi-projector mapping application for **3x 1920x1080 outputs** with real-time warping and edge blending.

![Lumina Mapper Interface](https://img.shields.io/badge/Status-Phase%201.1%20Complete-success)
![Version](https://img.shields.io/badge/Version-0.1.0-blue)

## 🎯 Features

### Phase 1: Control Interface ✅
- **3 Independent Projector Canvases** - Side-by-side preview (360x202px each)
- **Real-time Warping** - 4-corner mesh deformation per projector
- **Interactive Handles** - Drag-and-drop corner adjustment
- **Auto-save Warping** - LocalStorage persistence
- **Projector Selection** - Quick switching between P1, P2, P3

### Phase 2: Output System (Planned)
- Fullscreen multi-monitor output
- Synchronized video playback across 3 projectors
- UV mapping for seamless video distribution
- Edge blending with adjustable overlap
- BroadcastChannel sync

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build
```

Access the interface at **http://localhost:5173**

## 🎨 Interface

- **Sidebar**: Projector selection (P1/P2/P3), tools, reset
- **Main Viewport**: 3 monitors side-by-side with warping handles
- **Corner Pins**: Clockwise order (TL → TR → BR → BL)

## 🔧 Technical Stack

- **PixiJS v7** - GPU-accelerated rendering
- **React + TypeScript** - UI framework
- **Vite** - Build tool
- **Tailwind CSS** - Styling

## 📐 Warping System

Each projector has a **10x10 mesh grid** with bilinear interpolation. Corner pins:
- **Point 0**: Top-Left
- **Point 1**: Top-Right
- **Point 2**: Bottom-Right
- **Point 3**: Bottom-Left

Warping data is automatically saved to `localStorage` and restored on page load.

## 🗺️ Roadmap

### Phase 1 (Current)
- [x] Basic 3-monitor layout
- [x] Corner pin warping
- [x] Warping persistence
- [ ] Video integration
- [ ] Advanced editing tools

### Phase 2 (Planned)
- [ ] Fullscreen output windows
- [ ] Multi-monitor positioning
- [ ] Video synchronization
- [ ] Edge blending

### Advanced Features (Future)
- [ ] Bezier curve warping
- [ ] Variable grid density
- [ ] Individual corner selection
- [ ] Keyboard nudge (arrow keys)
- [ ] Export/Import JSON configs

## 📦 Project Structure

```
src/
├── core/
│   └── PixiRenderer.ts    # PixiJS rendering engine
├── App.tsx                 # Main React component
└── index.css              # Global styles
```

## 🎛️ Usage

1. **Select Projector** - Click P1, P2, or P3 in sidebar
2. **Adjust Corners** - Drag orange handles to warp
3. **Reset** - Click "Reset All Warping" to restore defaults
4. **Auto-save** - Changes persist automatically

## 📄 License

MIT License - Felipe Brito © 2026

---

**Built for PUC Sala 1 - Professional Projection Mapping**
