// ============================================
// ComposeYogi — Recording Manager
// Coordinates recorder, engine, and stores
// ============================================

import * as Tone from 'tone';
import { v4 as uuidv4 } from 'uuid';
import { createLogger } from '@/lib/logger';

const logger = createLogger('Recording');
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
}

/**
 * Clear all audio takes from memory
 * Used when switching projects
 */
export function clearAudioTakes(): void {
    audioTakesMap.clear();
}

// ============================================
// Recording Manager Class
// ============================================

/**
 * Wall-clock time as a fixed 24-hour HH:MM:SS string.
 *
 * Deliberately not toLocaleTimeString(): that reads the browser's locale, not
 * the app's, so the same project could carry clip names in two different time
 * formats depending on which machine recorded them — and the name is saved
 * data, not a label re-rendered per viewer.
 */
function clockTime(date: Date): string {
    const pad = (value: number) => String(value).padStart(2, '0');
    return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

class RecordingManager {
    private session: RecordingSession | null = null;
    private onComplete: RecordingCompleteCallback | null = null;
    private clipLabel = 'Recording';
    private countInTimeoutId: ReturnType<typeof setTimeout> | null = null;
    /** Settles the count-in's promise — false when it was abandoned. */
    private countInResolve: ((completed: boolean) => void) | null = null;

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
        onComplete?: RecordingCompleteCallback,
        /** Translated word the recorded clip is named after, e.g. "Recording". */
        clipLabel: string = 'Recording'
    ): Promise<void> {
        if (this.session?.isActive) {
            console.warn('[RecordingManager] Already recording');
            return;
        }

        this.onComplete = onComplete || null;
        this.clipLabel = clipLabel;

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
        const countInDuration = countInBars > 0
            ? audioEngine.barToSeconds(countInBars) * 1000
            : 0;

        // Tell the arrangement what is about to happen, before it happens: this
        // is what the count-in overlay and the pulsing region are drawn from,
        // and both need to exist during the count-in, not after it.
        usePlaybackStore.getState().setRecordingSession({
            trackId,
            startBar,
            countInEndsAt: countInBars > 0 ? performance.now() + countInDuration : null,
            countInBeats: countInBars * project.timeSignature[0],
        });

        if (countInBars > 0) {
            usePlaybackStore.getState().setCountingIn(true);

            // Click it. The count-in shipped in Sprint 2.1 and has been silent
            // ever since for the default settings — the metronome is off by
            // default, and even switched on it is a transport loop that cannot
            // run during pre-roll. PRD §9 lists the metronome ON among the
            // recording defaults; this is that, scoped to the count-in, where a
            // click cannot bleed into the take.
            audioEngine.playCountIn(
                countInBars * project.timeSignature[0],
                60 / audioEngine.getBpm(),
                project.timeSignature[0],
                playbackState.metronomeVolume
            );

            // A lead-in only exists if there is music before the punch point.
            // Recording from the top — the default — puts `startBar - countInBars`
            // at a negative bar, and a transport parked at a negative time is not
            // a count-in, it is a wrong answer. There the count-in is pre-roll:
            // the clock runs, the transport waits. Which is why the overlay
            // counts on the wall clock and not on transport position.
            const countInStartBar = startBar - countInBars;
            if (countInStartBar >= 0) {
                audioEngine.play(audioEngine.barToSeconds(countInStartBar));
            }

            const completed = await new Promise<boolean>((resolve) => {
                this.countInResolve = resolve;
                this.countInTimeoutId = setTimeout(() => {
                    this.countInTimeoutId = null;
                    this.countInResolve = null;
                    usePlaybackStore.getState().setCountingIn(false);
                    resolve(true);
                }, countInDuration);
            });

            // Stopped while it was counting. Nothing has been captured, so
            // there is nothing to finish — just leave.
            if (!completed) return;
        }

        // Update store state FIRST (so UI shows recording state)
        usePlaybackStore.getState().startRecording();

        // Start playback FIRST if not already playing (this ensures transport is running)
        // `startBar`, not 0: it already accounts for the loop, and hitting record
        // with the playhead at bar 8 recorded from the top of the song.
        if (!playbackRefs.isPlayingRef.current) {
            audioEngine.play(audioEngine.barToSeconds(startBar));
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

        // The bar above is the one the transport actually reports, which is not
        // always the one we asked for. The region has to be drawn where the take
        // lands, not where it was requested, so the session is replaced rather
        // than left holding the estimate. The count-in is over by now, too.
        usePlaybackStore.getState().setRecordingSession({
            trackId,
            startBar,
            countInEndsAt: null,
            countInBeats: 0,
        });

        logger.info('Recording started', { trackId, startBar, startTime });

        // Start the recorder with the ACTUAL transport time
        await audioRecorder.start(startTime, (segment) => {
            this.handleRecordingComplete(segment);
        });

    }

    /**
     * Abandon a count-in that is still running.
     *
     * Settles the promise `startRecording` is parked on, so it returns instead
     * of going on to open the recorder — the count-in used to be uncancellable
     * for exactly that reason: every stop path guarded on `this.session`, which
     * does not exist until *after* the count-in, so the timeout always fired and
     * a take always began.
     */
    private abortCountIn(): boolean {
        if (this.countInTimeoutId === null) return false;

        clearTimeout(this.countInTimeoutId);
        this.countInTimeoutId = null;
        audioEngine.stopCountIn();
        usePlaybackStore.getState().setCountingIn(false);

        const resolve = this.countInResolve;
        this.countInResolve = null;
        resolve?.(false);
        return true;
    }

    /** A count-in is running, or a take is. Either way there is something to stop. */
    isPending(): boolean {
        return this.countInTimeoutId !== null || this.session?.isActive === true;
    }

    /**
     * Stop the current recording
     */
    async stopRecording(): Promise<RecordedSegment | null> {
        // Still counting in: no session, no audio, nothing to keep.
        if (this.abortCountIn() && !this.session?.isActive) {
            audioEngine.stop();
            this.onComplete = null;
            usePlaybackStore.getState().stopRecording();
            usePlaybackStore.getState().stop();
            logger.info('Count-in cancelled before recording began');
            return null;
        }
        if (!this.session?.isActive) {
            return null;
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

        logger.info('Recording stopped', { duration: segment?.duration });

        return segment;
    }

    /**
     * Cancel the current recording (discard data)
     */
    async cancelRecording(): Promise<void> {
        if (!this.isPending()) {
            return;
        }

        this.abortCountIn();
        this.session = null;
        this.onComplete = null;

        // Stop recorder without processing
        await audioRecorder.stop();
        usePlaybackStore.getState().stopRecording();

    }

    // ========================================
    // Private Methods
    // ========================================

    private handleRecordingComplete(segment: RecordedSegment): void {

        if (!this.session) {
            console.warn('[RecordingManager] No session when handling recording complete');
            return;
        }

        const { trackId, startBar } = this.session;

        const projectStore = useProjectStore.getState();
        const project = projectStore.project;

        if (!project) {
            console.error('[RecordingManager] No project when completing recording');
            return;
        }

        // Calculate clip length in bars (use exact duration for audio clips)
        const durationInBars = audioEngine.secondsToBar(segment.duration);
        // Use exact fractional bars for audio clips so visual width matches audio duration
        const lengthBars = Math.max(0.25, durationInBars);

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
            // A take is performed against this transport, so its source tempo is
            // not a guess — it is the tempo that was playing. Stamping it now
            // means Stretch to BPM still knows it after the song is retempoed,
            // which is exactly when the inference would have stopped working.
            sourceBpm: project.bpm,
            name: `${this.clipLabel} ${clockTime(new Date())}`,
        });

        // Notify callback
        if (this.onComplete) {
            this.onComplete(clip, take);
        }

        // Clear session
        this.session = null;
        this.onComplete = null;

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
