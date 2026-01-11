// ============================================
// ComposeYogi — Grid Renderer
// Canvas-based time grid with beat markers
// ============================================

export interface GridConfig {
    bpm: number;
    timeSignature: [number, number];
    pixelsPerBeat: number;
    trackHeight: number;
    trackCount: number;
    scrollX: number;
    scrollY: number;
    viewportWidth: number;
    viewportHeight: number;
}

export interface GridColors {
    background: string;
    barLine: string;
    beatLine: string;
    subBeatLine: string;
    trackDivider: string;
}

const DEFAULT_COLORS: GridColors = {
    background: '#1a1a1a',
    barLine: '#444444',
    beatLine: '#333333',
    subBeatLine: '#252525',
    trackDivider: '#2a2a2a',
};

// ============================================
// Grid Renderer Class
// ============================================

export class GridRenderer {
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    private colors: GridColors;
    private dpr: number;

    constructor(canvas: HTMLCanvasElement, colors: Partial<GridColors> = {}) {
        this.canvas = canvas;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            throw new Error('Failed to get 2D context');
        }
        this.ctx = ctx;
        this.colors = { ...DEFAULT_COLORS, ...colors };
        this.dpr = window.devicePixelRatio || 1;
    }

    // ========================================
    // Canvas Setup
    // ========================================

    /**
     * Resize canvas to match container with device pixel ratio
     */
    resize(width: number, height: number): void {
        this.canvas.width = width * this.dpr;
        this.canvas.height = height * this.dpr;
        this.canvas.style.width = `${width}px`;
        this.canvas.style.height = `${height}px`;
        this.ctx.scale(this.dpr, this.dpr);
    }

    /**
     * Clear the canvas
     */
    clear(): void {
        this.ctx.fillStyle = this.colors.background;
        this.ctx.fillRect(0, 0, this.canvas.width / this.dpr, this.canvas.height / this.dpr);
    }

    // ========================================
    // Grid Rendering
    // ========================================

    /**
     * Render the complete grid
     */
    render(config: GridConfig): void {
        this.clear();
        this.renderVerticalLines(config);
        this.renderHorizontalLines(config);
    }

    /**
     * Render vertical grid lines (bars, beats, sub-beats)
     */
    private renderVerticalLines(config: GridConfig): void {
        const { pixelsPerBeat, timeSignature, scrollX, viewportWidth } = config;
        const [beatsPerBar] = timeSignature;

        // Calculate visible range
        const startBeat = Math.floor(scrollX / pixelsPerBeat);
        const endBeat = Math.ceil((scrollX + viewportWidth) / pixelsPerBeat) + 1;

        // Determine sub-beat division based on zoom level
        const subDivision = this.getSubDivision(pixelsPerBeat);

        this.ctx.lineWidth = 1;

        for (let beat = startBeat; beat <= endBeat; beat++) {
            const x = beat * pixelsPerBeat - scrollX;

            // Skip if outside viewport
            if (x < -1 || x > viewportWidth + 1) continue;

            const isBarLine = beat % beatsPerBar === 0;
            const isBeatLine = !isBarLine;

            if (isBarLine) {
                // Bar line (brightest)
                this.ctx.strokeStyle = this.colors.barLine;
                this.ctx.lineWidth = 1;
                this.drawVerticalLine(x, 0, config.viewportHeight);
            } else if (isBeatLine) {
                // Beat line
                this.ctx.strokeStyle = this.colors.beatLine;
                this.ctx.lineWidth = 1;
                this.drawVerticalLine(x, 0, config.viewportHeight);
            }

            // Sub-beat lines (if zoomed in enough)
            if (subDivision > 1 && pixelsPerBeat > 40) {
                const subBeatWidth = pixelsPerBeat / subDivision;
                this.ctx.strokeStyle = this.colors.subBeatLine;
                this.ctx.lineWidth = 1;

                for (let sub = 1; sub < subDivision; sub++) {
                    const subX = x + sub * subBeatWidth;
                    if (subX >= 0 && subX <= viewportWidth) {
                        this.drawVerticalLine(subX, 0, config.viewportHeight);
                    }
                }
            }
        }
    }

    /**
     * Render horizontal track divider lines
     */
    private renderHorizontalLines(config: GridConfig): void {
        const { trackHeight, trackCount, scrollY, viewportHeight } = config;

        this.ctx.strokeStyle = this.colors.trackDivider;
        this.ctx.lineWidth = 1;

        // Calculate visible track range
        const startTrack = Math.floor(scrollY / trackHeight);
        const endTrack = Math.min(trackCount, Math.ceil((scrollY + viewportHeight) / trackHeight) + 1);

        for (let track = startTrack; track <= endTrack; track++) {
            const y = track * trackHeight - scrollY;
            if (y >= -1 && y <= viewportHeight + 1) {
                this.drawHorizontalLine(0, y, config.viewportWidth);
            }
        }
    }

    // ========================================
    // Drawing Helpers
    // ========================================

    private drawVerticalLine(x: number, y1: number, y2: number): void {
        // Snap to pixel for crisp lines
        const snappedX = Math.round(x) + 0.5;
        this.ctx.beginPath();
        this.ctx.moveTo(snappedX, y1);
        this.ctx.lineTo(snappedX, y2);
        this.ctx.stroke();
    }

    private drawHorizontalLine(x1: number, y: number, x2: number): void {
        // Snap to pixel for crisp lines
        const snappedY = Math.round(y) + 0.5;
        this.ctx.beginPath();
        this.ctx.moveTo(x1, snappedY);
        this.ctx.lineTo(x2, snappedY);
        this.ctx.stroke();
    }

    /**
     * Determine sub-beat division based on zoom level
     */
    private getSubDivision(pixelsPerBeat: number): number {
        if (pixelsPerBeat >= 120) return 4; // 16th notes
        if (pixelsPerBeat >= 60) return 2;  // 8th notes
        return 1; // No sub-division
    }

    // ========================================
    // Configuration
    // ========================================

    setColors(colors: Partial<GridColors>): void {
        this.colors = { ...this.colors, ...colors };
    }

    getColors(): GridColors {
        return { ...this.colors };
    }
}

// ============================================
// Factory Function
// ============================================

export function createGridRenderer(
    canvas: HTMLCanvasElement,
    colors?: Partial<GridColors>
): GridRenderer {
    return new GridRenderer(canvas, colors);
}
