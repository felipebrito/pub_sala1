# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased] - 2026-02-05

### Added
- **Advanced Test Patterns**: Implemented professional-grade GLSL calibration patterns to replace basic ones.
    - **Pro Grid**: Fine adjustment grid with crosshairs, major/minor subdivisions, and aspect ratio diagonals.
    - **Focus Pattern**: High-frequency checkerboard and concentric rings for sharpness testing.
    - **Overlap Guide**: Visual guide highlighting blend zones (Red/Blue/Green) based on projector settings.
    - **Metric**: UV coordinate visualization with 10% markers.
- **Persistence**: Canvas/Total Resolution settings now persist to `localStorage`, preserving the 5006px width setup across reloads.
- **Layout Presets UI**: Moved Layout Presets to the top of the sidebar for easier access.
- **Firmware Link**: Added a settings gear icon in the LED Bridge section linking to the firmware configuration page.

### Changed
- **Test Patterns UI**: Updated the Test Patterns selector with new icons and labels (Pro Grid, Focus, Overlap, Metric).
- **Preset Application**: Removed confirmation dialog for "Apply Layout Preset" to make switching faster.
- **Shader Logic**: Refrewrote `EdgeBlendMaterial.ts` fragment shader to support new modular pattern functions and fixed syntax errors.

### Fixed
- Fixed critical syntax error in `EdgeBlendMaterial.ts` that caused shader compilation failure (unexpected backticks in comments).
