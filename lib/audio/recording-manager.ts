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
import { livePlayEngine } from './live-play';
import { clipBarsForNotes, notesFromPerformance, type PerformedNote } from './midi-take';
import { useProjectStore } from '@/lib/store/project';
import { usePlaybackStore, playbackRefs } from '@/lib/store/playback';
import { autosaveManager } from '@/lib/persistence';
import type { Clip, AudioTake, Note, PeaksCache, TrackType } from '@/types';

// ============================================
// Types
// ============================================

/**
 * What a take is capturing.
 *
 * `audio` opens the microphone; `midi` opens nothing at all and remembers what
 * was played instead. The distinction is taken from the armed track's type
 * rather than from a setting, because a MIDI track has nothing to record from a
 * microphone and an audio track has no instrument to play — there is only ever
 * one right answer, and asking would be asking the user to restate it.
 *
 * It also decides whether the browser asks for the microphone at all. Arming a
 * MIDI track and pressing record used to be impossible; making it possible
 * without this branch would have raised a mic permission prompt to record
 * something no microphone is involved in.
 */
type RecordingMode = 'audio' | 'midi';

interface RecordingSession {
    trackId: string;
    mode: RecordingMode;
    startBar: number;
    startTime: number;
    isActive: boolean;
}

/** Audio tracks record audio; MIDI and drum tracks record what was played. */
function modeForTrackType(type: TrackType): RecordingMode {
    return type === 'audio' ? 'audio' : 'midi';
}

/** `take` is null for a MIDI take — there is no audio to hand back, only notes. */
type RecordingCompleteCallback = (clip: Clip, take: AudioTake | null) => void;

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

        const track = project.tracks.find((t) => t.id === trackId);
        if (!track) {
            throw new Error('Armed track is not in the project');
        }
        const mode = modeForTrackType(track.type);

        // Set loop boundaries for auto-trim
        if (mode === 'audio' && playbackState.loopEnabled) {
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
            mode,
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

        logger.info('Recording started', { trackId, mode, startBar, startTime });

        if (mode === 'midi') {
            // Nothing to open and nothing to await: the notes are already
            // arriving at the live voice, and this only starts remembering them.
            // Started *after* the transport, so the first note is stamped
            // against a clock that is running.
            livePlayEngine.startCapture();
            return;
        }

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
            livePlayEngine.cancelCapture();
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

        if (this.session.mode === 'midi') {
            // Read the performance *before* stopping the transport: held notes
            // are closed at the transport's current position, and a transport
            // already stopped and rewound reports 0, which would give every
            // note still down a negative duration.
            this.handlePerformanceComplete(livePlayEngine.stopCapture());

            audioEngine.stop();
            usePlaybackStore.getState().stopRecording();
            usePlaybackStore.getState().stop();
            return null;
        }

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

        const mode = this.session?.mode ?? 'audio';

        this.abortCountIn();
        this.session = null;
        this.onComplete = null;

        // Stop recorder without processing
        livePlayEngine.cancelCapture();
        if (mode === 'audio') await audioRecorder.stop();
        usePlaybackStore.getState().stopRecording();

    }

    // ========================================
    // Private Methods
    // ========================================

    /**
     * A performance becomes a clip.
     *
     * The MIDI counterpart of `handleRecordingComplete`, and deliberately its
     * sibling rather than a branch inside it: the two share a session and a
     * start bar and nothing else — one writes an ArrayBuffer to IndexedDB and
     * the other writes notes into the project, and folding them together would
     * mean a function whose every line is inside an `if`.
     *
     * Nothing is quantized and nothing is latency-compensated — see
     * `midi-take.ts`, which is where both decisions are argued.
     */
    private handlePerformanceComplete(performed: PerformedNote[]): void {
        if (!this.session) {
            logger.warn('No session when completing a performance');
            return;
        }

        const { trackId, startBar, startTime } = this.session;
        this.session = null;

        const projectStore = useProjectStore.getState();
        const project = projectStore.project;
        if (!project) {
            logger.error('No project when completing a performance');
            this.onComplete = null;
            return;
        }

        const notes = notesFromPerformance(performed, startTime, project.bpm);

        // Played nothing, so nothing is left behind. An empty clip would be a
        // silent rectangle the user has to notice and delete, which is a worse
        // outcome than the take simply not having happened.
        if (notes.length === 0) {
            logger.info('Performance captured no notes — no clip created');
            this.onComplete = null;
            return;
        }

        const track = project.tracks.find((t) => t.id === trackId);
        const clipType = track?.type === 'drum' ? 'drum' : 'midi';
        const lengthBars = clipBarsForNotes(notes, project.timeSignature[0]);

        const clip = projectStore.addClip(
            trackId,
            clipType,
            Math.max(0, Math.floor(startBar)),
            lengthBars
        );

        // One update rather than a call per note: `addNote` writes the store —
        // and a zundo history entry — each time, so a thirty-note take would be
        // thirty undos deep and thirty renders long.
        projectStore.updateClip(clip.id, {
            notes: notes.map((note): Note => ({ id: uuidv4(), ...note })),
            name: `${this.clipLabel} ${clockTime(new Date())}`,
        });

        logger.info('Performance recorded', { trackId, notes: notes.length, lengthBars });

        this.onComplete?.(clip, null);
        this.onComplete = null;
    }

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
