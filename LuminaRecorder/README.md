# Lumina Recorder

A specialized web application for creating frame-perfect, distorted video loops for projection mapping.

![Lumina Recorder](../media/recorder-ui.png)

## Overview

Lumina Recorder is designed to solve the challenge of preparing content for physical projection surfaces (like curved walls or specific architectural features) without needing complex mapping software at playback time. It allows you to:

1.  **Load** a standard video loop.
2.  **Warp** it using a Bezier/Quad grid to fit your physical surface.
3.  **Record** the pre-distorted output as a new video file.
4.  **Play** the resulting file on any standard media player (VLC, QuickTime, BrightSign, etc.) and it will perfectly align with your projection.

## Features

-   **Drag & Drop Loading**: Supports MP4, WebM, and MOV formats.
-   **Advanced Warp Engine**:
    -   2x2 (Corner Pin), 3x3 (Bezier), or Custom Grid resolutions.
    -   Real-time WebGL distortion using `three.js`.
    -   Bicubic interpolation for smooth curves.
-   **Frame-Perfect Recording**:
    -   Automatically synchronizes recording start/stop with video playback.
    -   Captures exact duration to ensure seamless looping.
    -   Records at 60 FPS (hardware dependent).
-   **Smart Conversion**:
    -   Records raw high-quality streams (WebM/VP9).
    -   **Auto-Converts to MP4 (H.264)** using in-browser FFmpeg (WASM) for maximum compatibility.
    -   Falls back gracefully if hardware limits are reached.

## Tech Stack

-   **Framework**: React 19 + Vite
-   **Language**: TypeScript
-   **Graphics**: Three.js + React Three Fiber
-   **Styling**: TailwindCSS
-   **Video Processing**:
    -   `MediaRecorder` API (Capture)
    -   `@ffmpeg/ffmpeg` (WASM Conversion)

## Getting Started

### Prerequisites

-   Node.js (v18 or higher)
-   npm

### Installation

1.  Navigate to the project directory:
    ```bash
    cd LuminaRecorder
    ```
2.  Install dependencies:
    ```bash
    npm install
    ```

### Running Locally

 Start the development server:
 ```bash
 npm run dev
 ```
 Open `http://localhost:5173` in your browser (Chrome is recommended for best `MediaRecorder` support).

### Building for Production

To create a static build:
```bash
npm run build
```
The output will be in the `dist/` directory.

## Workflow

1.  **Load Video**: Drop your source video file.
2.  **Adjust Distortion**: Use the grid points to map the video to your surface. Double-click points to reset them.
3.  **Record**: Click "Start Recording". The app will play the video once and capture the output.
4.  **Save**: Download the final `.mp4` file.
