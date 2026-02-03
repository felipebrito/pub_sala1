// Helper to calculate smooth interpolation for grid warping

export class WarpMath {
    /**
     * Interpolates a grid of control points to find a position at (u, v)
     * using Bicubic (Cubic-Hermite mostly) or Bilinear interpolation.
     */
    /**
     * Interpolates a grid of control points to find a position at (u, v)
     * using Bicubic (smooth) or Bilinear (linear/folded) interpolation.
     */
    static interpolate(
        u: number,
        v: number,
        grid: { x: number, y: number }[][], // [rows][cols]
        gridCols: number,
        gridRows: number,
        mode: 'linear' | 'bicubic' = 'bicubic'
    ): { x: number, y: number } {
        // Force bilinear for 2x2 grids as cubic requires more context to be useful, 
        // essentially identical for 2x2 but safer to stick to bilinear.
        if (gridCols === 2 && gridRows === 2) {
            return this.bilinear(u, v, grid);
        }

        const x = u * (gridCols - 1);
        const y = v * (gridRows - 1);

        if (mode === 'linear') {
            return this.bilinearPatch(x, y, grid, gridCols, gridRows);
        }

        return this.bicubic(x, y, grid, gridCols, gridRows);
    }

    // Standard 2x2 bilinear (0..1)
    private static bilinear(u: number, v: number, grid: { x: number, y: number }[][]) {
        const tl = grid[0][0];
        const tr = grid[0][1];
        const bl = grid[1][0];
        const br = grid[1][1];

        return this.lerp2d(tl, tr, bl, br, u, v);
    }

    // Patch Bilinear: finds the specific grid cell (quad) we are in and interpolates within it
    private static bilinearPatch(x: number, y: number, grid: { x: number, y: number }[][], cols: number, rows: number) {
        // Indices of the cell
        let c = Math.floor(x);
        let r = Math.floor(y);

        // Clamp to last valid cell
        if (c >= cols - 1) c = cols - 2;
        if (r >= rows - 1) r = rows - 2;

        // Local UV (0..1) within the cell
        const u = x - c;
        const v = y - r;

        const tl = grid[r][c];
        const tr = grid[r][c + 1];
        const bl = grid[r + 1][c];
        const br = grid[r + 1][c + 1];

        return this.lerp2d(tl, tr, bl, br, u, v);
    }

    private static lerp2d(tl: any, tr: any, bl: any, br: any, u: number, v: number) {
        const topX = tl.x * (1 - u) + tr.x * u;
        const topY = tl.y * (1 - u) + tr.y * u;
        const botX = bl.x * (1 - u) + br.x * u;
        const botY = bl.y * (1 - u) + br.y * u;

        return {
            x: topX * (1 - v) + botX * v,
            y: topY * (1 - v) + botY * v
        };
    }

    // Evaluate cubic polynomial p(t)
    private static cubic(p0: number, p1: number, p2: number, p3: number, t: number): number {
        const v0 = p2 - p0;
        const v1 = 2 * p0 - 5 * p1 + 4 * p2 - p3;
        const v2 = -p0 + 3 * p1 - 3 * p2 + p3;
        return 0.5 * (2 * p1 + (v0) * t + (v1) * t * t + (v2) * t * t * t);
    }

    private static bicubic(x: number, y: number, grid: { x: number, y: number }[][], cols: number, rows: number) {
        // Integer part
        const xi = Math.floor(x);
        const yi = Math.floor(y);

        // Fractional part
        const tx = x - xi;
        const ty = y - yi;

        // Get 4x4 neighborhood for Catmull-Rom
        // We need points i-1, i, i+1, i+2
        const getPt = (c: number, r: number) => {
            // Clamp to edges
            c = Math.max(0, Math.min(cols - 1, c));
            r = Math.max(0, Math.min(rows - 1, r));
            return grid[r][c];
        };

        // Interpolate X rows first
        const yResults = [];
        for (let r = yi - 1; r <= yi + 2; r++) {
            const p0 = getPt(xi - 1, r);
            const p1 = getPt(xi, r);
            const p2 = getPt(xi + 1, r);
            const p3 = getPt(xi + 2, r);

            yResults.push({
                x: this.cubic(p0.x, p1.x, p2.x, p3.x, tx),
                y: this.cubic(p0.y, p1.y, p2.y, p3.y, tx)
            });
        }

        // Interpolate Y
        return {
            x: this.cubic(yResults[0].x, yResults[1].x, yResults[2].x, yResults[3].x, ty),
            y: this.cubic(yResults[0].y, yResults[1].y, yResults[2].y, yResults[3].y, ty)
        };
    }
}
