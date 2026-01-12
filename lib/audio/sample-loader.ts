// ============================================
// Audio Utilities for Loading Samples
// ============================================

import { v4 as uuidv4 } from 'uuid';
import { registerAudioTake } from './recording-manager';
import type { AudioTake, PeaksCache } from '@/types';
import { autosaveManager } from '@/lib/persistence';

/**
 * Fetches an audio file from a URL and registers it as an AudioTake
 * suitable for drag-and-drop sample loading.
 */
export async function loadSampleAsAudioTake(url: string, name: string): Promise<AudioTake> {
    try {
        // 1. Fetch the file
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to fetch sample: ${response.statusText}`);
        }

        // 2. Get array buffer
        const arrayBuffer = await response.arrayBuffer();

        // 3. Decode to get metadata (duration, sample rate)
        // We use a temporary AudioContext just for decoding if Tone isn't ready,
        // but typically Tone is initialized by now.
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer.slice(0)); // Decode a copy

        // 4. Create raw Uint8Array for storage (simulating a "recording")
        // Note: Ideally we store the original compressed file to save space, but
        // the current generic AudioTake structure expects `audioData` as Uint8Array.
        // For short one-shots, storing the original bytes is fine.
        const rawBytes = new Uint8Array(arrayBuffer);

        // 5. Create AudioTake
        const take: AudioTake = {
            id: uuidv4(),
            clipId: '', // Will be assigned by the caller (TrackLane)
            audioData: rawBytes,
            sampleRate: audioBuffer.sampleRate,
            duration: audioBuffer.duration,
            peaks: {} as PeaksCache, // Will be generated on demand
            createdAt: Date.now(),
        };

        // 6. Register in memory
        registerAudioTake(take);

        // 7. Persist to IndexedDB
        // We do this immediately so it survives refresh
        await autosaveManager.saveAudioTakeImmediate(take);

        console.log(`[AudioUtils] Loaded sample "${name}" as take ${take.id} (${take.duration.toFixed(2)}s)`);

        return take;
    } catch (error) {
        console.error(`[AudioUtils] Error loading sample ${name}:`, error);
        throw error;
    }
}
