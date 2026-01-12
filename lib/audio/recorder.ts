// ============================================
// ComposeYogi — Audio Recorder
// MediaRecorder API for input capture
// ============================================

import * as Tone from 'tone';

// ============================================
// Types
// ============================================

export interface RecordingOptions {
    /** Sample rate (default: 44100) */
    sampleRate?: number;
    /** Number of channels (default: 2) */
    channels?: number;
    /** Target bits per second (default: 192000) */
    audioBitsPerSecond?: number;
    /** Input latency offset in seconds */
    latencyOffset?: number;
    /** Fade in duration in seconds (default: 0.005) */
    fadeInDuration?: number;
    /** Fade out duration in seconds (default: 0.01) */
    fadeOutDuration?: number;
}

export interface RecordedSegment {
    /** Raw audio blob */
    blob: Blob;
    /** Audio data as Uint8Array (for IndexedDB storage) */
    audioData: Uint8Array;
    /** AudioBuffer for processing */
    audioBuffer: AudioBuffer;
    /** Start time in project (seconds) */
    startTime: number;
    /** Duration in seconds */
    duration: number;
    /** Sample rate */
    sampleRate: number;
    /** MIME type */
    mimeType: string;
}

export interface LoopBoundaries {
    /** Loop start in seconds */
    startTime: number;
    /** Loop end in seconds */
    endTime: number;
    /** Whether loop is enabled */
    enabled: boolean;
}

type RecorderState = 'inactive' | 'recording' | 'paused';
type RecorderCallback = (segment: RecordedSegment) => void;

// ============================================
// Supported MIME types (in preference order)
// ============================================

const PREFERRED_MIME_TYPES = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/ogg',
    'audio/mp4',
];

function getSupportedMimeType(): string {
    for (const mimeType of PREFERRED_MIME_TYPES) {
        if (MediaRecorder.isTypeSupported(mimeType)) {
            return mimeType;
        }
    }
    return ''; // Let browser choose
}

// ============================================
// Audio Recorder Class
// ============================================

class AudioRecorder {
    private mediaRecorder: MediaRecorder | null = null;
    private audioStream: MediaStream | null = null;
    private chunks: Blob[] = [];
    private state: RecorderState = 'inactive';
    private startTime: number = 0;
    private mimeType: string = '';
    private options: RecordingOptions = {};
    private onRecordingComplete: RecorderCallback | null = null;
    private loopBoundaries: LoopBoundaries | null = null;

    // Latency calibration
    private inputLatency: number = 0;
    private outputLatency: number = 0;

    // ========================================
    // Initialization
    // ========================================

    async initialize(options: RecordingOptions = {}): Promise<void> {
        this.options = {
            sampleRate: 44100,
            channels: 2,
            audioBitsPerSecond: 192000,
            latencyOffset: 0,
            fadeInDuration: 0.005,  // 5ms default
            fadeOutDuration: 0.01,  // 10ms default
            ...options,
        };

        // Request microphone permission
        try {
            this.audioStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: false, // Disable for recording instruments
                    noiseSuppression: false,
                    autoGainControl: false,
                    sampleRate: this.options.sampleRate,
                    channelCount: this.options.channels,
                },
            });
        } catch (error) {
            console.error('Failed to get audio input:', error);
            throw new Error('Microphone access denied or unavailable');
        }

        this.mimeType = getSupportedMimeType();
    }

    async dispose(): Promise<void> {
        await this.stop();

        if (this.audioStream) {
            this.audioStream.getTracks().forEach((track) => track.stop());
            this.audioStream = null;
        }

        this.mediaRecorder = null;
        this.state = 'inactive';
    }

    // ========================================
    // Recording Control
    // ========================================

    /**
     * Set loop boundaries for auto-trimming
     */
    setLoopBoundaries(boundaries: LoopBoundaries | null): void {
        this.loopBoundaries = boundaries;
    }

    async start(projectTime: number, onComplete?: RecorderCallback): Promise<void> {
        if (!this.audioStream) {
            throw new Error('Recorder not initialized');
        }

        if (this.state === 'recording') {
            return;
        }

        // Ensure any old MediaRecorder is fully cleaned up
        if (this.mediaRecorder) {
            this.mediaRecorder.ondataavailable = null;
            this.mediaRecorder.onstop = null;
            this.mediaRecorder.onstart = null;
            this.mediaRecorder = null;
        }

        // Reset state for new recording
        this.chunks = [];
        this.startTime = 0;
        this.onRecordingComplete = onComplete || null;

        // Create NEW MediaRecorder
        this.mediaRecorder = new MediaRecorder(this.audioStream, {
            mimeType: this.mimeType,
            audioBitsPerSecond: this.options.audioBitsPerSecond,
        });

        // Handle data chunks
        this.mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                this.chunks.push(event.data);
            }
        };

        // Handle recording stop
        this.mediaRecorder.onstop = () => {
            this.finalizeRecording();
        };

        // Wait for recording to actually start before capturing time
        await new Promise<void>((resolve) => {
            this.mediaRecorder!.onstart = () => {
                // Capture the ACTUAL time when MediaRecorder starts
                // This is when audio capture truly begins
                this.startTime = Tone.getTransport().seconds - (this.options.latencyOffset || 0);
                resolve();
            };

            // Start recording with timeslice for chunked data
            this.mediaRecorder!.start(1000); // 1 second chunks
        });

        this.state = 'recording';
    }

    async pause(): Promise<void> {
        if (this.state !== 'recording' || !this.mediaRecorder) {
            return;
        }

        this.mediaRecorder.pause();
        this.state = 'paused';
    }

    async resume(): Promise<void> {
        if (this.state !== 'paused' || !this.mediaRecorder) {
            return;
        }

        this.mediaRecorder.resume();
        this.state = 'recording';
    }

    async stop(): Promise<RecordedSegment | null> {
        if (this.state === 'inactive' || !this.mediaRecorder) {
            return null;
        }


        return new Promise((resolve) => {
            this.mediaRecorder!.onstop = async () => {
                const segment = await this.finalizeRecording();
                resolve(segment);
            };

            this.mediaRecorder!.stop();
            this.state = 'inactive';
        });
    }

    private async finalizeRecording(): Promise<RecordedSegment | null> {
        if (this.chunks.length === 0) {
            console.warn('[Recorder] No audio chunks recorded');
            this.state = 'inactive';
            return null;
        }

        try {
            const blob = new Blob(this.chunks, { type: this.mimeType || 'audio/webm' });

            // Convert blob to AudioBuffer for processing
            let audioBuffer = await this.blobToAudioBuffer(blob);

            // Use the ACTUAL AudioBuffer duration - this is the true length of recorded audio
            // NOT the transport time which can be out of sync
            let duration = audioBuffer.duration;
            let adjustedStartTime = this.startTime;


            // Apply latency offset to start time
            const latencyOffset = this.options.latencyOffset || 0;
            if (latencyOffset > 0) {
                adjustedStartTime = this.startTime - latencyOffset;
            }

            // Auto-trim to loop boundaries if enabled
            if (this.loopBoundaries?.enabled) {
                const trimResult = await this.trimToLoop(
                    audioBuffer,
                    adjustedStartTime,
                    this.loopBoundaries
                );
                audioBuffer = trimResult.buffer;
                adjustedStartTime = trimResult.startTime;
                duration = trimResult.duration;
            }

            // Apply fade-in and fade-out to prevent clicks
            audioBuffer = this.applyFades(audioBuffer);

            // Convert to Uint8Array for IndexedDB storage
            const audioData = await this.audioBufferToUint8Array(audioBuffer);

            const segment: RecordedSegment = {
                blob,
                audioData,
                audioBuffer,
                startTime: adjustedStartTime,
                duration,
                sampleRate: audioBuffer.sampleRate,
                mimeType: this.mimeType || 'audio/webm',
            };

            this.state = 'inactive';
            this.chunks = [];

            // Notify callback
            if (this.onRecordingComplete) {
                this.onRecordingComplete(segment);
            }

            return segment;
        } catch (error) {
            console.error('[Recorder] Error finalizing recording:', error);
            this.state = 'inactive';
            this.chunks = [];
            return null;
        }
    }

    // ========================================
    // Audio Processing
    // ========================================

    /**
     * Trim audio buffer to loop boundaries
     */
    private async trimToLoop(
        buffer: AudioBuffer,
        startTime: number,
        loop: LoopBoundaries
    ): Promise<{ buffer: AudioBuffer; startTime: number; duration: number }> {
        const sampleRate = buffer.sampleRate;
        const loopStartSample = Math.max(0, Math.floor((loop.startTime - startTime) * sampleRate));
        const loopEndSample = Math.min(
            buffer.length,
            Math.floor((loop.endTime - startTime) * sampleRate)
        );

        // If recording started before loop, trim the beginning
        // If recording extends past loop, trim the end
        const trimStart = Math.max(0, loopStartSample);
        const trimEnd = Math.min(buffer.length, loopEndSample);
        const trimLength = trimEnd - trimStart;

        if (trimLength <= 0) {
            // Return original if trim would result in empty buffer
            return {
                buffer,
                startTime: Math.max(startTime, loop.startTime),
                duration: buffer.duration,
            };
        }

        // Create trimmed buffer
        const ctx = Tone.getContext().rawContext;
        const trimmedBuffer = ctx.createBuffer(
            buffer.numberOfChannels,
            trimLength,
            sampleRate
        );

        for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
            const sourceData = buffer.getChannelData(channel);
            const destData = trimmedBuffer.getChannelData(channel);
            for (let i = 0; i < trimLength; i++) {
                destData[i] = sourceData[trimStart + i];
            }
        }

        // Adjust start time if we trimmed the beginning
        const newStartTime = startTime + trimStart / sampleRate;

        return {
            buffer: trimmedBuffer,
            startTime: Math.max(newStartTime, loop.startTime),
            duration: trimLength / sampleRate,
        };
    }

    /**
     * Trim audio buffer to specified duration
     */
    private trimAudioBuffer(buffer: AudioBuffer, startSeconds: number, durationSeconds: number): AudioBuffer {
        const sampleRate = buffer.sampleRate;
        const startSample = Math.floor(startSeconds * sampleRate);
        const numSamples = Math.floor(durationSeconds * sampleRate);
        const endSample = Math.min(startSample + numSamples, buffer.length);
        const actualLength = endSample - startSample;

        if (actualLength <= 0) {
            return buffer;
        }

        const ctx = Tone.getContext().rawContext;
        const trimmedBuffer = ctx.createBuffer(
            buffer.numberOfChannels,
            actualLength,
            sampleRate
        );

        for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
            const sourceData = buffer.getChannelData(channel);
            const destData = trimmedBuffer.getChannelData(channel);
            for (let i = 0; i < actualLength; i++) {
                destData[i] = sourceData[startSample + i];
            }
        }

        return trimmedBuffer;
    }

    /**
     * Apply fade-in and fade-out to prevent clicks
     */
    private applyFades(buffer: AudioBuffer): AudioBuffer {
        const fadeInSamples = Math.floor(
            (this.options.fadeInDuration || 0.005) * buffer.sampleRate
        );
        const fadeOutSamples = Math.floor(
            (this.options.fadeOutDuration || 0.01) * buffer.sampleRate
        );

        // Create a copy to avoid mutating original
        const ctx = Tone.getContext().rawContext;
        const fadedBuffer = ctx.createBuffer(
            buffer.numberOfChannels,
            buffer.length,
            buffer.sampleRate
        );

        for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
            const sourceData = buffer.getChannelData(channel);
            const destData = fadedBuffer.getChannelData(channel);

            for (let i = 0; i < buffer.length; i++) {
                let sample = sourceData[i];

                // Apply fade-in (equal power curve)
                if (i < fadeInSamples) {
                    const fadeProgress = i / fadeInSamples;
                    sample *= Math.sin(fadeProgress * Math.PI * 0.5);
                }

                // Apply fade-out (equal power curve)
                const samplesFromEnd = buffer.length - 1 - i;
                if (samplesFromEnd < fadeOutSamples) {
                    const fadeProgress = samplesFromEnd / fadeOutSamples;
                    sample *= Math.sin(fadeProgress * Math.PI * 0.5);
                }

                destData[i] = sample;
            }
        }

        return fadedBuffer;
    }

    /**
     * Convert AudioBuffer to Uint8Array (WAV format) for IndexedDB storage
     */
    private async audioBufferToUint8Array(buffer: AudioBuffer): Promise<Uint8Array> {
        const numChannels = buffer.numberOfChannels;
        const sampleRate = buffer.sampleRate;
        const bitsPerSample = 16;
        const bytesPerSample = bitsPerSample / 8;
        const blockAlign = numChannels * bytesPerSample;
        const byteRate = sampleRate * blockAlign;
        const dataSize = buffer.length * blockAlign;
        const headerSize = 44;
        const totalSize = headerSize + dataSize;

        const arrayBuffer = new ArrayBuffer(totalSize);
        const view = new DataView(arrayBuffer);

        // WAV header
        this.writeString(view, 0, 'RIFF');
        view.setUint32(4, totalSize - 8, true);
        this.writeString(view, 8, 'WAVE');
        this.writeString(view, 12, 'fmt ');
        view.setUint32(16, 16, true); // fmt chunk size
        view.setUint16(20, 1, true); // PCM format
        view.setUint16(22, numChannels, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, byteRate, true);
        view.setUint16(32, blockAlign, true);
        view.setUint16(34, bitsPerSample, true);
        this.writeString(view, 36, 'data');
        view.setUint32(40, dataSize, true);

        // Interleave audio data
        const offset = headerSize;
        const channelData: Float32Array[] = [];
        for (let ch = 0; ch < numChannels; ch++) {
            channelData.push(buffer.getChannelData(ch));
        }

        for (let i = 0; i < buffer.length; i++) {
            for (let ch = 0; ch < numChannels; ch++) {
                const sample = Math.max(-1, Math.min(1, channelData[ch][i]));
                const int16 = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
                view.setInt16(offset + (i * numChannels + ch) * bytesPerSample, int16, true);
            }
        }

        return new Uint8Array(arrayBuffer);
    }

    private writeString(view: DataView, offset: number, str: string): void {
        for (let i = 0; i < str.length; i++) {
            view.setUint8(offset + i, str.charCodeAt(i));
        }
    }

    // ========================================
    // Latency Calibration
    // ========================================

    setLatencyOffset(offset: number): void {
        this.options.latencyOffset = offset;
    }

    async calibrateLatency(): Promise<number> {
        // This would use loopback detection for accurate calibration
        // For now, return a reasonable default
        try {
            const ctx = Tone.getContext().rawContext as AudioContext;
            const baseLatency = ctx.baseLatency ?? 0;
            const outputLatency = ctx.outputLatency ?? 0;

            this.inputLatency = baseLatency;
            this.outputLatency = outputLatency;

            return baseLatency + outputLatency;
        } catch {
            return 0;
        }
    }

    getLatencyInfo(): { input: number; output: number; total: number } {
        return {
            input: this.inputLatency,
            output: this.outputLatency,
            total: this.inputLatency + this.outputLatency,
        };
    }

    // ========================================
    // Utilities
    // ========================================

    getState(): RecorderState {
        return this.state;
    }

    isRecording(): boolean {
        return this.state === 'recording';
    }

    isPaused(): boolean {
        return this.state === 'paused';
    }

    hasPermission(): boolean {
        return this.audioStream !== null;
    }

    /**
     * Convert recorded blob to AudioBuffer for waveform display
     */
    async blobToAudioBuffer(blob: Blob): Promise<AudioBuffer> {
        const arrayBuffer = await blob.arrayBuffer();
        const audioContext = Tone.getContext().rawContext;
        return audioContext.decodeAudioData(arrayBuffer);
    }

    /**
     * Convert recorded blob to a playable URL
     */
    blobToUrl(blob: Blob): string {
        return URL.createObjectURL(blob);
    }

    /**
     * Revoke a blob URL to free memory
     */
    revokeUrl(url: string): void {
        URL.revokeObjectURL(url);
    }

    /**
     * Get input devices for device selection
     */
    static async getInputDevices(): Promise<MediaDeviceInfo[]> {
        const devices = await navigator.mediaDevices.enumerateDevices();
        return devices.filter((device) => device.kind === 'audioinput');
    }

    /**
     * Check if recording is supported
     */
    static isSupported(): boolean {
        return (
            typeof MediaRecorder !== 'undefined' &&
            typeof navigator.mediaDevices !== 'undefined' &&
            typeof navigator.mediaDevices.getUserMedia === 'function'
        );
    }
}

// ============================================
// Singleton Export
// ============================================

export const audioRecorder = new AudioRecorder();
