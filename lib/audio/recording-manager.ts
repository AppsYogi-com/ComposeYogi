// ============================================
// ComposeYogi — Recording Manager
// Coordinates recorder, engine, and stores
// ============================================

import * as Tone from 'tone';
import { v4 as uuidv4 } from 'uuid';
import { audioRecorder, RecordedSegment, LoopBoundaries } from './recorder';
import { audioEngine } from './engine';
import { latencyCalibrator } from './latency-calibration';
import { useProjectStore } from '@/lib/store/project';
import { usePlaybackStore, playbackRefs } from '@/lib/store/playback';
import { autosaveManager } from '@/lib/persistence';
import type { Clip, AudioTake, PeaksCache } from '@/types';

// ============================================
// Types
// ============================================

interface RecordingSession {
    trackId: string;
    startBar: number;
    startTime: number;
    isActive: boolean;
}

type RecordingCompleteCallback = (clip: Clip, take: AudioTake) => void;

// ============================================
// Audio Takes Storage (in-memory, will be persisted to IndexedDB)
// ============================================

const audioTakesMap = new Map<string, AudioTake>();

export function getAudioTake(takeId: string): AudioTake | undefined {
    return audioTakesMap.get(takeId);
}

export function getAllAudioTakes(): AudioTake[] {
    return Array.from(audioTakesMap.values());
}

export function deleteAudioTake(takeId: string): void {
    audioTakesMap.delete(takeId);
}

/**
 * Register an audio take in the in-memory cache
 * Used when loading from IndexedDB
 */
export function registerAudioTake(take: AudioTake): void {
    audioTakesMap.set(take.id, take);
    console.log('[RecordingManager] Registered audio take:', take.id);
}

/**
 * Clear all audio takes from memory
 * Used when switching projects
 */
export function clearAudioTakes(): void {
    audioTakesMap.clear();
    console.log('[RecordingManager] Cleared all audio takes');
}

// ============================================
// Recording Manager Class
// ============================================

class RecordingManager {
    private session: RecordingSession | null = null;
    private onComplete: RecordingCompleteCallback | null = null;
    private countInTimeoutId: ReturnType<typeof setTimeout> | null = null;

    // ========================================
    // Initialization
    // ========================================

    async initialize(): Promise<void> {
        // Initialize recorder with calibrated latency
        const latencyResult = latencyCalibrator.getStoredResult();
        const latencyOffset = latencyResult?.totalLatencyMs
            ? latencyResult.totalLatencyMs / 1000
            : 0;

        await audioRecorder.initialize({
            latencyOffset,
            fadeInDuration: 0.005,
            fadeOutDuration: 0.01,
        });

        console.log('[RecordingManager] Initialized with latency offset:', latencyOffset);
    }

    // ========================================
    // Recording Controls
    // ========================================

    /**
     * Start recording on an armed track
     * @param trackId The track to record to
     * @param countInBars Number of bars to count in (0 for immediate)
     * @param onComplete Callback when recording is complete
     */
    async startRecording(
        trackId: string,
        countInBars: number = 0,
        onComplete?: RecordingCompleteCallback
    ): Promise<void> {
        if (this.session?.isActive) {
            console.warn('[RecordingManager] Already recording');
            return;
        }

        this.onComplete = onComplete || null;

        // Get loop boundaries from playback store
        const playbackState = usePlaybackStore.getState();
        const project = useProjectStore.getState().project;

        if (!project) {
            throw new Error('No project loaded');
        }

        // Set loop boundaries for auto-trim
        if (playbackState.loopEnabled) {
            const loopBoundaries: LoopBoundaries = {
                startTime: audioEngine.barToSeconds(playbackState.loopStartBar),
                endTime: audioEngine.barToSeconds(playbackState.loopEndBar),
                enabled: true,
            };
            audioRecorder.setLoopBoundaries(loopBoundaries);
        } else {
            audioRecorder.setLoopBoundaries(null);
        }

        // Determine start position
        let startBar = playbackState.loopEnabled
            ? playbackState.loopStartBar
            : audioEngine.secondsToBar(audioEngine.getCurrentTime());

        // Handle count-in
        if (countInBars > 0) {
            usePlaybackStore.getState().setCountingIn(true);

            // Start playback from count-in position
            const countInStartBar = startBar - countInBars;
            audioEngine.play(audioEngine.barToSeconds(countInStartBar));

            // Wait for count-in to complete
            const countInDuration = audioEngine.barToSeconds(countInBars) * 1000;

            await new Promise<void>((resolve) => {
                this.countInTimeoutId = setTimeout(() => {
                    usePlaybackStore.getState().setCountingIn(false);
                    resolve();
                }, countInDuration);
            });
        }

        // Update store state FIRST (so UI shows recording state)
        usePlaybackStore.getState().startRecording();

        // Start playback FIRST if not already playing (this ensures transport is running)
        if (!playbackRefs.isPlayingRef.current) {
            const initialPosition = playbackState.loopEnabled
                ? audioEngine.barToSeconds(playbackState.loopStartBar)
                : 0;
            audioEngine.play(initialPosition);
        }

        // Small delay to ensure transport has started
        await new Promise(resolve => setTimeout(resolve, 50));

        // NOW capture the actual start time from the running transport
        const startTime = Tone.getTransport().seconds;
        startBar = audioEngine.secondsToBar(startTime);

        this.session = {
            trackId,
            startBar,
            startTime,
            isActive: true,
        };

        // Start the recorder with the ACTUAL transport time
        await audioRecorder.start(startTime, (segment) => {
            this.handleRecordingComplete(segment);
        });

        console.log('[RecordingManager] Recording started on track', trackId, 'at time', startTime, 'bar', startBar);
    }

    /**
     * Stop the current recording
     */
    async stopRecording(): Promise<RecordedSegment | null> {
        if (!this.session?.isActive) {
            return null;
        }

        // Clear count-in timeout if still running
        if (this.countInTimeoutId) {
            clearTimeout(this.countInTimeoutId);
            this.countInTimeoutId = null;
            usePlaybackStore.getState().setCountingIn(false);
        }

        // DON'T mark session as inactive yet - handleRecordingComplete needs it
        // The session will be cleared by handleRecordingComplete after creating the clip

        // Stop recorder - this returns the segment and triggers the callback
        // which calls handleRecordingComplete
        const segment = await audioRecorder.stop();

        // Stop the transport/playback
        audioEngine.stop();

        // Update store state
        usePlaybackStore.getState().stopRecording();
        usePlaybackStore.getState().stop(); // Also reset playback state and playhead

        console.log('[RecordingManager] Recording stopped');

        return segment;
    }

    /**
     * Cancel the current recording (discard data)
     */
    async cancelRecording(): Promise<void> {
        if (!this.session?.isActive) {
            return;
        }

        // Clear count-in timeout
        if (this.countInTimeoutId) {
            clearTimeout(this.countInTimeoutId);
            this.countInTimeoutId = null;
            usePlaybackStore.getState().setCountingIn(false);
        }

        this.session = null;
        this.onComplete = null;

        // Stop recorder without processing
        await audioRecorder.stop();
        usePlaybackStore.getState().stopRecording();

        console.log('[RecordingManager] Recording cancelled');
    }

    // ========================================
    // Private Methods
    // ========================================

    private handleRecordingComplete(segment: RecordedSegment): void {
        console.log('[RecordingManager] handleRecordingComplete called');

        if (!this.session) {
            console.warn('[RecordingManager] No session when handling recording complete');
            return;
        }

        const { trackId, startBar } = this.session;
        console.log('[RecordingManager] Creating clip for track', trackId, 'at bar', startBar);

        const projectStore = useProjectStore.getState();
        const project = projectStore.project;

        if (!project) {
            console.error('[RecordingManager] No project when completing recording');
            return;
        }

        // Calculate clip length in bars (round up to nearest bar)
        const durationInBars = audioEngine.secondsToBar(segment.duration);
        const lengthBars = Math.max(1, Math.ceil(durationInBars));
        console.log('[RecordingManager] segment.duration:', segment.duration, 'durationInBars:', durationInBars, 'lengthBars:', lengthBars);

        // Create Clip via store method
        const clip = projectStore.addClip(trackId, 'audio', Math.max(0, Math.floor(startBar)), lengthBars);

        // Create AudioTake
        const take: AudioTake = {
            id: uuidv4(),
            clipId: clip.id,
            audioData: segment.audioData,
            sampleRate: segment.sampleRate,
            duration: segment.duration,
            peaks: {} as PeaksCache, // Will be generated by waveform worker
            createdAt: Date.now(),
        };

        // Store the audio take
        audioTakesMap.set(take.id, take);

        // Save to IndexedDB for persistence
        autosaveManager.saveAudioTakeImmediate(take).catch((err) => {
            console.error('[RecordingManager] Failed to save audio take to IndexedDB:', err);
        });

        // Update the clip with the take reference
        projectStore.updateClip(clip.id, {
            audioTakeIds: [take.id],
            activeTakeId: take.id,
            name: `Recording ${new Date().toLocaleTimeString()}`,
        });

        // Notify callback
        if (this.onComplete) {
            this.onComplete(clip, take);
        }

        // Clear session
        this.session = null;
        this.onComplete = null;

        console.log('[RecordingManager] Created clip', clip.id, 'with take', take.id);
    }

    // ========================================
    // State Queries
    // ========================================

    isRecording(): boolean {
        return this.session?.isActive ?? false;
    }

    getSession(): RecordingSession | null {
        return this.session;
    }

    hasPermission(): boolean {
        return audioRecorder.hasPermission();
    }

    // ========================================
    // Latency Management
    // ========================================

    updateLatencyOffset(offsetMs: number): void {
        audioRecorder.setLatencyOffset(offsetMs / 1000);
        console.log('[RecordingManager] Updated latency offset:', offsetMs, 'ms');
    }

    // ========================================
    // Cleanup
    // ========================================

    async dispose(): Promise<void> {
        await this.cancelRecording();
        await audioRecorder.dispose();
    }
}

// ============================================
// Singleton Export
// ============================================

export const recordingManager = new RecordingManager();
