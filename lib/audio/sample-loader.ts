// ============================================
// Audio Utilities for Loading Samples
// ============================================

import { v4 as uuidv4 } from 'uuid';
import { registerAudioTake } from './recording-manager';
import { loadUserSample } from '@/lib/persistence/db';
import type { AudioTake, PeaksCache } from '@/types';
import { autosaveManager } from '@/lib/persistence';

/**
 * Fetches an audio file from a URL and registers it as an AudioTake
 * suitable for drag-and-drop sample loading.
 */
export async function loadSampleAsAudioTake(url: string, name: string, clipId: string = ''): Promise<AudioTake> {
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
        const audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer.slice(0)); // Decode a copy

        // 4. Create raw Uint8Array for storage (simulating a "recording")
        // Note: Ideally we store the original compressed file to save space, but
        // the current generic AudioTake structure expects `audioData` as Uint8Array.
        // For short one-shots, storing the original bytes is fine.
        const rawBytes = new Uint8Array(arrayBuffer);

        // 5. Create AudioTake
        const take: AudioTake = {
            id: uuidv4(),
            clipId: clipId,
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


        return take;
    } catch (error) {
        console.error(`[AudioUtils] Error loading sample ${name}:`, error);
        throw error;
    }
}

/**
 * Loads a user-imported sample from IndexedDB and registers it as an AudioTake
 * for use on the timeline.
 */
export async function loadUserSampleAsAudioTake(
    userSampleId: string,
    clipId: string = ''
): Promise<AudioTake> {
    try {
        // 1. Load user sample from IndexedDB
        const userSample = await loadUserSample(userSampleId);
        if (!userSample) {
            throw new Error(`User sample not found: ${userSampleId}`);
        }

        // 2. Create AudioTake from user sample data
        const take: AudioTake = {
            id: uuidv4(),
            clipId: clipId,
            audioData: userSample.audioData,
            sampleRate: userSample.sampleRate,
            duration: userSample.duration,
            peaks: userSample.peaks, // Reuse pre-generated peaks
            createdAt: Date.now(),
        };

        // 3. Register in memory
        registerAudioTake(take);

        // 4. Persist to IndexedDB
        await autosaveManager.saveAudioTakeImmediate(take);

        return take;
    } catch (error) {
        console.error(`[AudioUtils] Error loading user sample ${userSampleId}:`, error);
        throw error;
    }
}
