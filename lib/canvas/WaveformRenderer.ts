// ============================================
// ComposeYogi — Waveform Renderer
// Canvas-based audio visualization
// ============================================

export interface WaveformConfig {
    width: number;
    height: number;
    color: string;
    backgroundColor?: string;
    // Position within the timeline
    startX: number;
    clipWidth: number;
}

export interface WaveformPeaks {
    min: Float32Array;
    max: Float32Array;
    length: number;
}

// ============================================
// Peaks Cache Manager
// ============================================

export class PeaksCacheManager {
    private cache: Map<string, Map<number, WaveformPeaks>> = new Map();

    /**
     * Get cached peaks for a specific zoom level
     */
    getPeaks(audioId: string, samplesPerPixel: number): WaveformPeaks | null {
        const audioCache = this.cache.get(audioId);
        if (!audioCache) return null;
        return audioCache.get(samplesPerPixel) || null;
    }

    /**
     * Store peaks for a specific zoom level
     */
    setPeaks(audioId: string, samplesPerPixel: number, peaks: WaveformPeaks): void {
        let audioCache = this.cache.get(audioId);
        if (!audioCache) {
            audioCache = new Map();
            this.cache.set(audioId, audioCache);
        }
        audioCache.set(samplesPerPixel, peaks);
    }

    /**
     * Check if peaks exist for zoom level
     */
    hasPeaks(audioId: string, samplesPerPixel: number): boolean {
        const audioCache = this.cache.get(audioId);
        return audioCache?.has(samplesPerPixel) || false;
    }

    /**
     * Clear cache for specific audio
     */
    clearAudio(audioId: string): void {
        this.cache.delete(audioId);
    }

    /**
     * Clear entire cache
     */
    clear(): void {
        this.cache.clear();
    }
}

// ============================================
// Waveform Renderer Class
// ============================================

export class WaveformRenderer {
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    private dpr: number;
    private peaksCache: PeaksCacheManager;

    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            throw new Error('Failed to get 2D context');
        }
        this.ctx = ctx;
        this.dpr = window.devicePixelRatio || 1;
        this.peaksCache = new PeaksCacheManager();
    }

    // ========================================
    // Canvas Setup
    // ========================================

    resize(width: number, height: number): void {
        this.canvas.width = width * this.dpr;
        this.canvas.height = height * this.dpr;
        this.canvas.style.width = `${width}px`;
        this.canvas.style.height = `${height}px`;
        this.ctx.scale(this.dpr, this.dpr);
    }

    clear(): void {
        this.ctx.clearRect(0, 0, this.canvas.width / this.dpr, this.canvas.height / this.dpr);
    }

    // ========================================
    // Peaks Calculation
    // ========================================

    /**
     * Calculate peaks from AudioBuffer
     */
    calculatePeaks(audioBuffer: AudioBuffer, samplesPerPixel: number): WaveformPeaks {
        const channelData = audioBuffer.getChannelData(0); // Use first channel
        const numPeaks = Math.ceil(channelData.length / samplesPerPixel);

        const min = new Float32Array(numPeaks);
        const max = new Float32Array(numPeaks);

        for (let i = 0; i < numPeaks; i++) {
            const start = i * samplesPerPixel;
            const end = Math.min(start + samplesPerPixel, channelData.length);

            let peakMin = Infinity;
            let peakMax = -Infinity;

            for (let j = start; j < end; j++) {
                const sample = channelData[j];
                if (sample < peakMin) peakMin = sample;
                if (sample > peakMax) peakMax = sample;
            }

            min[i] = peakMin === Infinity ? 0 : peakMin;
            max[i] = peakMax === -Infinity ? 0 : peakMax;
        }

        return { min, max, length: numPeaks };
    }

    /**
     * Get or calculate peaks with caching
     */
    getPeaksForZoom(
        audioId: string,
        audioBuffer: AudioBuffer,
        samplesPerPixel: number
    ): WaveformPeaks {
        // Check cache first
        const cached = this.peaksCache.getPeaks(audioId, samplesPerPixel);
        if (cached) return cached;

        // Calculate and cache
        const peaks = this.calculatePeaks(audioBuffer, samplesPerPixel);
        this.peaksCache.setPeaks(audioId, samplesPerPixel, peaks);
        return peaks;
    }

    // ========================================
    // Rendering
    // ========================================

    /**
     * Render waveform from peaks data
     */
    renderPeaks(
        peaks: WaveformPeaks,
        config: WaveformConfig
    ): void {
        const { height, color, backgroundColor, startX, clipWidth } = config;
        const centerY = height / 2;
        const amplitude = height / 2 - 2; // Leave 2px padding

        // Draw background if specified
        if (backgroundColor) {
            this.ctx.fillStyle = backgroundColor;
            this.ctx.fillRect(startX, 0, clipWidth, height);
        }

        // Draw waveform
        this.ctx.fillStyle = color;
        this.ctx.beginPath();

        // Calculate which peaks to render based on clip width
        const peaksToRender = Math.min(peaks.length, clipWidth);

        // Draw top half (max values)
        for (let i = 0; i < peaksToRender; i++) {
            const x = startX + i;
            const y = centerY - peaks.max[i] * amplitude;

            if (i === 0) {
                this.ctx.moveTo(x, y);
            } else {
                this.ctx.lineTo(x, y);
            }
        }

        // Draw bottom half (min values) - going backwards
        for (let i = peaksToRender - 1; i >= 0; i--) {
            const x = startX + i;
            const y = centerY - peaks.min[i] * amplitude;
            this.ctx.lineTo(x, y);
        }

        this.ctx.closePath();
        this.ctx.fill();
    }

    /**
     * Render waveform directly from AudioBuffer
     */
    renderAudioBuffer(
        audioId: string,
        audioBuffer: AudioBuffer,
        config: WaveformConfig,
        pixelsPerSecond: number
    ): void {
        // Calculate samples per pixel based on zoom
        const samplesPerPixel = Math.ceil(audioBuffer.sampleRate / pixelsPerSecond);

        // Get peaks (cached or calculated)
        const peaks = this.getPeaksForZoom(audioId, audioBuffer, samplesPerPixel);

        // Render
        this.renderPeaks(peaks, config);
    }

    /**
     * Render a simple rectangle placeholder (for clips without audio data)
     */
    renderPlaceholder(
        x: number,
        y: number,
        width: number,
        height: number,
        color: string
    ): void {
        this.ctx.fillStyle = color;
        this.ctx.globalAlpha = 0.3;
        this.ctx.fillRect(x, y, width, height);
        this.ctx.globalAlpha = 1;
    }

    // ========================================
    // Cache Management
    // ========================================

    clearCache(audioId?: string): void {
        if (audioId) {
            this.peaksCache.clearAudio(audioId);
        } else {
            this.peaksCache.clear();
        }
    }
}

// ============================================
// Factory Function
// ============================================

export function createWaveformRenderer(canvas: HTMLCanvasElement): WaveformRenderer {
    return new WaveformRenderer(canvas);
}
