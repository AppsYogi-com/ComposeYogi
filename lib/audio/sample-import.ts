// ============================================
// ComposeYogi — Sample Import
// Import and process user audio files
// ============================================

import { v4 as uuidv4 } from 'uuid';
import { createLogger } from '@/lib/logger';
import { saveUserSample, listUserSamples, deleteUserSample, loadUserSample } from '@/lib/persistence/db';
import type { UserSample, PeaksCache } from '@/types';

const log = createLogger('SampleImport');

// ============================================
// Constants
// ============================================

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const SUPPORTED_FORMATS = [
    'audio/wav',
    'audio/wave',
    'audio/x-wav',
    'audio/mp3',
    'audio/mpeg',
    'audio/ogg',
    'audio/flac',
    'audio/x-flac',
    'audio/mp4',
    'audio/x-m4a',
    'audio/aac',
];

const SUPPORTED_EXTENSIONS = ['.wav', '.mp3', '.ogg', '.flac', '.m4a', '.aac'];

// ============================================
// Validation
// ============================================

export interface ValidationResult {
    valid: boolean;
    error?: string;
}

export function validateAudioFile(file: File): ValidationResult {
    // Check file size
    if (file.size > MAX_FILE_SIZE) {
        return {
            valid: false,
            error: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB`,
        };
    }

    // Check MIME type
    const mimeValid = SUPPORTED_FORMATS.some(
        (format) => file.type.toLowerCase() === format || file.type.toLowerCase().startsWith(format.split('/')[0])
    );

    // Check extension as fallback
    const extension = '.' + file.name.split('.').pop()?.toLowerCase();
    const extValid = SUPPORTED_EXTENSIONS.includes(extension);

    if (!mimeValid && !extValid) {
        return {
            valid: false,
            error: `Unsupported format. Supported: ${SUPPORTED_EXTENSIONS.join(', ')}`,
        };
    }

    return { valid: true };
}

// ============================================
// Import Functions
// ============================================

export interface ImportProgress {
    stage: 'reading' | 'decoding' | 'processing' | 'saving';
    progress: number;
}

export interface ImportOptions {
    onProgress?: (progress: ImportProgress) => void;
}

/**
 * Import an audio file into the user's sample library
 */
export async function importAudioFile(
    file: File,
    options: ImportOptions = {}
): Promise<UserSample> {
    const { onProgress } = options;

    log.info('Importing audio file', { name: file.name, size: file.size, type: file.type });

    // Validate file
    const validation = validateAudioFile(file);
    if (!validation.valid) {
        throw new Error(validation.error);
    }

    // Stage 1: Read file as ArrayBuffer
    onProgress?.({ stage: 'reading', progress: 0 });
    const arrayBuffer = await file.arrayBuffer();
    onProgress?.({ stage: 'reading', progress: 100 });

    // Stage 2: Decode audio
    onProgress?.({ stage: 'decoding', progress: 0 });
    const audioContext = new AudioContext();
    let audioBuffer: AudioBuffer;

    try {
        audioBuffer = await audioContext.decodeAudioData(arrayBuffer.slice(0));
    } catch (_error) {
        audioContext.close();
        throw new Error('Failed to decode audio file. The file may be corrupted or in an unsupported format.');
    }

    onProgress?.({ stage: 'decoding', progress: 100 });

    // Stage 3: Generate peaks for waveform visualization
    onProgress?.({ stage: 'processing', progress: 0 });
    const peaks = generatePeaks(audioBuffer, (p) => {
        onProgress?.({ stage: 'processing', progress: p });
    });

    // Close audio context
    audioContext.close();

    // Stage 4: Save to IndexedDB
    onProgress?.({ stage: 'saving', progress: 0 });

    const sample: UserSample = {
        id: uuidv4(),
        name: file.name.replace(/\.[^/.]+$/, ''), // Remove extension
        fileName: file.name,
        mimeType: file.type || 'audio/unknown',
        fileSize: file.size,
        audioData: new Uint8Array(arrayBuffer),
        sampleRate: audioBuffer.sampleRate,
        duration: audioBuffer.duration,
        peaks,
        createdAt: Date.now(),
    };

    await saveUserSample(sample);
    onProgress?.({ stage: 'saving', progress: 100 });

    log.info('Audio file imported successfully', {
        id: sample.id,
        name: sample.name,
        duration: sample.duration,
        sampleRate: sample.sampleRate,
    });

    return sample;
}

/**
 * Import multiple audio files
 */
export async function importAudioFiles(
    files: FileList | File[],
    options: ImportOptions = {}
): Promise<{ successful: UserSample[]; failed: { file: File; error: string }[] }> {
    const successful: UserSample[] = [];
    const failed: { file: File; error: string }[] = [];

    const fileArray = Array.from(files);

    for (let i = 0; i < fileArray.length; i++) {
        const file = fileArray[i];
        try {
            const sample = await importAudioFile(file, {
                onProgress: options.onProgress
                    ? (p) => options.onProgress?.({
                        ...p,
                        progress: (i / fileArray.length) * 100 + (p.progress / fileArray.length),
                    })
                    : undefined,
            });
            successful.push(sample);
        } catch (error) {
            failed.push({
                file,
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            log.error('Failed to import file', { name: file.name, error });
        }
    }

    return { successful, failed };
}

// ============================================
// Peak Generation
// ============================================

/**
 * Generate multi-resolution peaks for waveform visualization
 */
function generatePeaks(
    audioBuffer: AudioBuffer,
    onProgress?: (progress: number) => void
): PeaksCache {
    const channelData = audioBuffer.getChannelData(0); // Use first channel
    const samples = channelData.length;

    // Generate peaks at multiple zoom levels (samples per pixel)
    const zoomLevels = [64, 128, 256, 512, 1024, 2048, 4096];
    const peaks: PeaksCache = {};

    for (let levelIdx = 0; levelIdx < zoomLevels.length; levelIdx++) {
        const samplesPerPixel = zoomLevels[levelIdx];
        const numPeaks = Math.ceil(samples / samplesPerPixel);

        const min = new Float32Array(numPeaks);
        const max = new Float32Array(numPeaks);

        for (let i = 0; i < numPeaks; i++) {
            const start = i * samplesPerPixel;
            const end = Math.min(start + samplesPerPixel, samples);

            let minVal = 1;
            let maxVal = -1;

            for (let j = start; j < end; j++) {
                const val = channelData[j];
                if (val < minVal) minVal = val;
                if (val > maxVal) maxVal = val;
            }

            min[i] = minVal;
            max[i] = maxVal;
        }

        peaks[samplesPerPixel] = { min, max };

        // Report progress
        onProgress?.(Math.round(((levelIdx + 1) / zoomLevels.length) * 100));
    }

    return peaks;
}

// ============================================
// Sample Retrieval
// ============================================

/**
 * Get all user-imported samples
 */
export async function getUserSamples(): Promise<UserSample[]> {
    return listUserSamples();
}

/**
 * Get a single user sample by ID
 */
export async function getUserSample(sampleId: string): Promise<UserSample | null> {
    return loadUserSample(sampleId);
}

/**
 * Delete a user sample
 */
export async function removeUserSample(sampleId: string): Promise<void> {
    await deleteUserSample(sampleId);
    log.info('User sample removed', { id: sampleId });
}

/**
 * Get AudioBuffer from a user sample
 */
export async function getUserSampleAudioBuffer(sampleId: string): Promise<AudioBuffer | null> {
    const sample = await loadUserSample(sampleId);
    if (!sample) return null;

    const audioContext = new AudioContext();
    try {
        // Create a copy of the ArrayBuffer for decoding
        const bufferCopy = sample.audioData.slice().buffer as ArrayBuffer;
        const audioBuffer = await audioContext.decodeAudioData(bufferCopy);
        return audioBuffer;
    } finally {
        audioContext.close();
    }
}

/**
 * Create an object URL for audio playback preview
 */
export function createSamplePreviewUrl(sample: UserSample): string {
    const blob = new Blob([sample.audioData.buffer as ArrayBuffer], { type: sample.mimeType });
    return URL.createObjectURL(blob);
}

// ============================================
// Export constants for UI
// ============================================

export { MAX_FILE_SIZE, SUPPORTED_FORMATS, SUPPORTED_EXTENSIONS };
