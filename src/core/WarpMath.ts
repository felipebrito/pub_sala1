// Helper to calculate smooth interpolation for grid warping

export class WarpMath {
    /**
     * Interpolates a grid of control points to find a position at (u, v)
     * using Bicubic (Cubic-Hermite mostly) or Bilinear interpolation.
     */
    static interpolate(
        u: number,
        v: number,
        grid: { x: number, y: number }[][], // [rows][cols]
        gridCols: number,
        gridRows: number
    ): { x: number, y: number } {

        // Map 0..1 (u,v) to Grid Coordinates
        // e.g. if 3x3 grid (indices 0, 1, 2), u=0.5 corresponds to index 1.0
        const x = u * (gridCols - 1);
        const y = v * (gridRows - 1);

        // For simple 2x2 (Corner Pin), use Bilinear (Linear Straight Edges)
        if (gridCols === 2 && gridRows === 2) {
            return this.bilinear(u, v, grid);
        }

        // For N > 2, use Cubic Spline for smooth curves
        // Using Catmull-Rom logic simplified for Grid
        return this.bicubic(x, y, grid, gridCols, gridRows);
    }

    private static bilinear(u: number, v: number, grid: { x: number, y: number }[][]) {
        const tl = grid[0][0];
        const tr = grid[0][1];
        const bl = grid[1][0];
        const br = grid[1][1];

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
