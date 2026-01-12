// ============================================
// ComposeYogi — Latency Calibration
// Automatic loopback detection for latency compensation
// ============================================

import * as Tone from 'tone';

// ============================================
// Types
// ============================================

export interface LatencyCalibrationResult {
    /** Detected round-trip latency in milliseconds */
    roundTripLatencyMs: number;
    /** Input latency estimate in milliseconds */
    inputLatencyMs: number;
    /** Output latency estimate in milliseconds */
    outputLatencyMs: number;
    /** Total latency for recording offset (input + output) */
    totalLatencyMs: number;
    /** Confidence level (0-1) */
    confidence: number;
    /** Number of successful samples */
    sampleCount: number;
    /** Whether calibration was successful */
    success: boolean;
    /** Error message if failed */
    error?: string;
}

export interface CalibrationProgress {
    /** Current step (1-based) */
    step: number;
    /** Total steps */
    totalSteps: number;
    /** Current phase description */
    phase: string;
    /** Progress percentage (0-100) */
    percentage: number;
}

type ProgressCallback = (progress: CalibrationProgress) => void;

// ============================================
// Constants
// ============================================

const CLICK_FREQUENCY = 1000; // Hz
const CLICK_DURATION = 0.005; // 5ms
const CLICK_INTERVAL = 0.5; // seconds between clicks
const NUM_SAMPLES = 5; // Number of measurements
const DETECTION_THRESHOLD = 0.1; // Amplitude threshold for detection
const MAX_LATENCY_MS = 500; // Maximum expected latency
const STORAGE_KEY = 'composeyogi_latency_calibration';

// ============================================
// Latency Calibrator Class
// ============================================

class LatencyCalibrator {
    private isCalibrating: boolean = false;
    private audioContext: AudioContext | null = null;
    private oscillator: OscillatorNode | null = null;
    private gainNode: GainNode | null = null;
    private analyser: AnalyserNode | null = null;
    private mediaStream: MediaStream | null = null;
    private inputNode: MediaStreamAudioSourceNode | null = null;
    private storedResult: LatencyCalibrationResult | null = null;

    // ========================================
    // Main Calibration Method
    // ========================================

    async calibrate(onProgress?: ProgressCallback): Promise<LatencyCalibrationResult> {
        if (this.isCalibrating) {
            return {
                roundTripLatencyMs: 0,
                inputLatencyMs: 0,
                outputLatencyMs: 0,
                totalLatencyMs: 0,
                confidence: 0,
                sampleCount: 0,
                success: false,
                error: 'Calibration already in progress',
            };
        }

        this.isCalibrating = true;
        const measurements: number[] = [];

        try {
            // Phase 1: Setup
            onProgress?.({
                step: 1,
                totalSteps: NUM_SAMPLES + 2,
                phase: 'Setting up audio...',
                percentage: 0,
            });

            await this.setupAudio();

            // Phase 2: Measurements
            for (let i = 0; i < NUM_SAMPLES; i++) {
                onProgress?.({
                    step: i + 2,
                    totalSteps: NUM_SAMPLES + 2,
                    phase: `Measuring latency (${i + 1}/${NUM_SAMPLES})...`,
                    percentage: ((i + 1) / (NUM_SAMPLES + 2)) * 100,
                });

                const latency = await this.measureRoundTrip();
                if (latency > 0 && latency < MAX_LATENCY_MS) {
                    measurements.push(latency);
                }

                // Wait between measurements
                await this.delay(CLICK_INTERVAL * 1000);
            }

            // Phase 3: Calculate results
            onProgress?.({
                step: NUM_SAMPLES + 2,
                totalSteps: NUM_SAMPLES + 2,
                phase: 'Calculating results...',
                percentage: 100,
            });

            return this.calculateResults(measurements);
        } catch (error) {
            return {
                roundTripLatencyMs: 0,
                inputLatencyMs: 0,
                outputLatencyMs: 0,
                totalLatencyMs: 0,
                confidence: 0,
                sampleCount: 0,
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        } finally {
            this.cleanup();
            this.isCalibrating = false;
        }
    }

    // ========================================
    // Audio Setup
    // ========================================

    private async setupAudio(): Promise<void> {
        // Get microphone access
        this.mediaStream = await navigator.mediaDevices.getUserMedia({
            audio: {
                echoCancellation: false,
                noiseSuppression: false,
                autoGainControl: false,
            },
        });

        // Create audio context
        this.audioContext = new AudioContext();

        // Create output chain: oscillator -> gain -> destination
        this.oscillator = this.audioContext.createOscillator();
        this.gainNode = this.audioContext.createGain();
        this.oscillator.type = 'sine';
        this.oscillator.frequency.value = CLICK_FREQUENCY;
        this.gainNode.gain.value = 0; // Start silent
        this.oscillator.connect(this.gainNode);
        this.gainNode.connect(this.audioContext.destination);
        this.oscillator.start();

        // Create input chain: microphone -> analyser
        this.inputNode = this.audioContext.createMediaStreamSource(this.mediaStream);
        this.analyser = this.audioContext.createAnalyser();
        this.analyser.fftSize = 256;
        this.inputNode.connect(this.analyser);
    }

    // ========================================
    // Measurement
    // ========================================

    private async measureRoundTrip(): Promise<number> {
        if (!this.audioContext || !this.gainNode || !this.analyser) {
            throw new Error('Audio not initialized');
        }

        const bufferLength = this.analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength) as Uint8Array<ArrayBuffer>;

        // Record start time
        const startTime = performance.now();

        // Play click
        const now = this.audioContext.currentTime;
        this.gainNode.gain.setValueAtTime(0.5, now);
        this.gainNode.gain.setValueAtTime(0, now + CLICK_DURATION);

        // Wait for click to be detected
        const detectionTime = await this.waitForDetection(dataArray, bufferLength, startTime);

        if (detectionTime === 0) {
            return 0; // Detection failed
        }

        return detectionTime - startTime;
    }

    private waitForDetection(
        dataArray: Uint8Array<ArrayBuffer>,
        bufferLength: number,
        startTime: number
    ): Promise<number> {
        return new Promise((resolve) => {
            const maxWaitTime = MAX_LATENCY_MS + 100;
            const checkInterval = 1; // Check every 1ms

            const check = () => {
                const elapsed = performance.now() - startTime;

                if (elapsed > maxWaitTime) {
                    resolve(0); // Timeout
                    return;
                }

                this.analyser!.getByteTimeDomainData(dataArray);

                // Check for signal above threshold
                let maxAmplitude = 0;
                for (let i = 0; i < bufferLength; i++) {
                    const amplitude = Math.abs(dataArray[i] - 128) / 128;
                    maxAmplitude = Math.max(maxAmplitude, amplitude);
                }

                if (maxAmplitude > DETECTION_THRESHOLD) {
                    resolve(performance.now());
                    return;
                }

                setTimeout(check, checkInterval);
            };

            // Start checking after a short delay
            setTimeout(check, 5);
        });
    }

    // ========================================
    // Results Calculation
    // ========================================

    private calculateResults(measurements: number[]): LatencyCalibrationResult {
        if (measurements.length === 0) {
            return {
                roundTripLatencyMs: 0,
                inputLatencyMs: 0,
                outputLatencyMs: 0,
                totalLatencyMs: 0,
                confidence: 0,
                sampleCount: 0,
                success: false,
                error: 'No valid measurements detected. Please check your audio setup.',
            };
        }

        // Remove outliers (measurements more than 2 std devs from mean)
        const mean = measurements.reduce((a, b) => a + b, 0) / measurements.length;
        const stdDev = Math.sqrt(
            measurements.reduce((sum, m) => sum + Math.pow(m - mean, 2), 0) / measurements.length
        );
        const filtered = measurements.filter(
            (m) => Math.abs(m - mean) <= 2 * stdDev
        );

        if (filtered.length === 0) {
            return {
                roundTripLatencyMs: mean,
                inputLatencyMs: mean / 2,
                outputLatencyMs: mean / 2,
                totalLatencyMs: mean,
                confidence: 0.3,
                sampleCount: measurements.length,
                success: true,
            };
        }

        // Calculate final values from filtered measurements
        const finalMean = filtered.reduce((a, b) => a + b, 0) / filtered.length;
        const finalStdDev = Math.sqrt(
            filtered.reduce((sum, m) => sum + Math.pow(m - finalMean, 2), 0) / filtered.length
        );

        // Confidence based on consistency and sample count
        const consistencyScore = 1 - Math.min(finalStdDev / finalMean, 0.5) * 2;
        const sampleScore = Math.min(filtered.length / NUM_SAMPLES, 1);
        const confidence = consistencyScore * 0.7 + sampleScore * 0.3;

        const result: LatencyCalibrationResult = {
            roundTripLatencyMs: Math.round(finalMean),
            inputLatencyMs: Math.round(finalMean / 2),
            outputLatencyMs: Math.round(finalMean / 2),
            totalLatencyMs: Math.round(finalMean),
            confidence: Math.round(confidence * 100) / 100,
            sampleCount: filtered.length,
            success: true,
        };

        // Store the result
        this.storeResult(result);

        return result;
    }

    // ========================================
    // Cleanup
    // ========================================

    private cleanup(): void {
        this.oscillator?.stop();
        this.oscillator?.disconnect();
        this.gainNode?.disconnect();
        this.analyser?.disconnect();
        this.inputNode?.disconnect();

        if (this.mediaStream) {
            this.mediaStream.getTracks().forEach((track) => track.stop());
        }

        this.audioContext?.close();

        this.oscillator = null;
        this.gainNode = null;
        this.analyser = null;
        this.inputNode = null;
        this.mediaStream = null;
        this.audioContext = null;
    }

    // ========================================
    // Utilities
    // ========================================

    private delay(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    isRunning(): boolean {
        return this.isCalibrating;
    }

    /**
     * Store calibration result (persists to localStorage)
     */
    storeResult(result: LatencyCalibrationResult): void {
        this.storedResult = result;
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(result));
        } catch (e) {
            console.warn('[LatencyCalibrator] Failed to persist result:', e);
        }
    }

    /**
     * Get stored calibration result
     */
    getStoredResult(): LatencyCalibrationResult | null {
        if (this.storedResult) {
            return this.storedResult;
        }

        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                this.storedResult = JSON.parse(stored);
                return this.storedResult;
            }
        } catch (e) {
            console.warn('[LatencyCalibrator] Failed to read stored result:', e);
        }

        return null;
    }

    /**
     * Clear stored calibration result
     */
    clearStoredResult(): void {
        this.storedResult = null;
        try {
            localStorage.removeItem(STORAGE_KEY);
        } catch (_e) {
            // Ignore
        }
    }

    /**
     * Set manual latency offset (when calibration isn't possible)
     */
    setManualLatency(latencyMs: number): LatencyCalibrationResult {
        const result: LatencyCalibrationResult = {
            roundTripLatencyMs: latencyMs,
            inputLatencyMs: latencyMs / 2,
            outputLatencyMs: latencyMs / 2,
            totalLatencyMs: latencyMs,
            confidence: 1,
            sampleCount: 0,
            success: true,
        };
        this.storeResult(result);
        return result;
    }

    /**
     * Get system-reported latency (less accurate but instant)
     */
    static getSystemLatency(): { baseLatency: number; outputLatency: number } {
        try {
            const ctx = Tone.getContext().rawContext as AudioContext;
            return {
                baseLatency: (ctx.baseLatency ?? 0) * 1000, // Convert to ms
                outputLatency: (ctx.outputLatency ?? 0) * 1000,
            };
        } catch {
            return { baseLatency: 0, outputLatency: 0 };
        }
    }

    /**
     * Check if calibration is supported
     */
    static isSupported(): boolean {
        return (
            typeof AudioContext !== 'undefined' &&
            typeof navigator.mediaDevices !== 'undefined' &&
            typeof navigator.mediaDevices.getUserMedia === 'function'
        );
    }
}

// ============================================
// Singleton Export
// ============================================

export const latencyCalibrator = new LatencyCalibrator();
