// ============================================
// ComposeYogi — MP3 Encoder
// Encode AudioBuffer to MP3 using lamejs
// ============================================

import lamejs from 'lamejs';

// ============================================
// Types
// ============================================

export type Mp3Quality = 128 | 192 | 320;

export interface Mp3EncoderOptions {
    quality?: Mp3Quality;
    onProgress?: (progress: number) => void;
}

// ============================================
// MP3 Encoding
// ============================================

/**
 * Convert an AudioBuffer to MP3 Blob
 * Uses lamejs for pure JavaScript MP3 encoding
 */
export async function encodeAudioBufferToMp3(
    audioBuffer: AudioBuffer,
    options: Mp3EncoderOptions = {}
): Promise<Blob> {
    const { quality = 192, onProgress } = options;

    const numChannels = audioBuffer.numberOfChannels;
    const sampleRate = audioBuffer.sampleRate;
    const samples = audioBuffer.length;

    // Create MP3 encoder
    const mp3Encoder = new lamejs.Mp3Encoder(numChannels, sampleRate, quality);

    // Get audio data
    const leftChannel = audioBuffer.getChannelData(0);
    const rightChannel = numChannels > 1 ? audioBuffer.getChannelData(1) : leftChannel;

    // Convert Float32 to Int16 (MP3 requires 16-bit samples)
    const leftInt16 = floatTo16BitPCM(leftChannel);
    const rightInt16 = floatTo16BitPCM(rightChannel);

    // Encode in chunks to allow progress updates and prevent UI blocking
    const mp3Data: Int8Array[] = [];
    const chunkSize = 1152; // MP3 frame size
    const totalChunks = Math.ceil(samples / chunkSize);

    for (let i = 0; i < samples; i += chunkSize) {
        const leftChunk = leftInt16.subarray(i, Math.min(i + chunkSize, samples));
        const rightChunk = rightInt16.subarray(i, Math.min(i + chunkSize, samples));

        let mp3buf: Int8Array;
        if (numChannels === 1) {
            mp3buf = mp3Encoder.encodeBuffer(leftChunk);
        } else {
            mp3buf = mp3Encoder.encodeBuffer(leftChunk, rightChunk);
        }

        if (mp3buf.length > 0) {
            mp3Data.push(mp3buf);
        }

        // Report progress
        if (onProgress) {
            const currentChunk = Math.floor(i / chunkSize);
            const progress = Math.round((currentChunk / totalChunks) * 100);
            onProgress(progress);
        }

        // Yield to event loop every 100 chunks to keep UI responsive
        if ((i / chunkSize) % 100 === 0) {
            await new Promise(resolve => setTimeout(resolve, 0));
        }
    }

    // Flush remaining data
    const mp3End = mp3Encoder.flush();
    if (mp3End.length > 0) {
        mp3Data.push(mp3End);
    }

    onProgress?.(100);

    // Combine all chunks into single Blob
    // Cast to BlobPart[] for TypeScript compatibility
    return new Blob(mp3Data as BlobPart[], { type: 'audio/mp3' });
}

/**
 * Convert Float32Array to Int16Array for MP3 encoding
 */
function floatTo16BitPCM(float32Array: Float32Array): Int16Array {
    const int16Array = new Int16Array(float32Array.length);
    for (let i = 0; i < float32Array.length; i++) {
        // Clamp to -1 to 1 range
        const sample = Math.max(-1, Math.min(1, float32Array[i]));
        // Convert to 16-bit integer
        int16Array[i] = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
    }
    return int16Array;
}

// ============================================
// Quality Presets
// ============================================

export const MP3_QUALITY_PRESETS = {
    128: { label: 'Standard (128 kbps)', description: 'Good for voice, smaller files' },
    192: { label: 'High (192 kbps)', description: 'Balanced quality and size' },
    320: { label: 'Maximum (320 kbps)', description: 'Best quality, larger files' },
} as const;
