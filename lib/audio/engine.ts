// ============================================
// ComposeYogi — Audio Engine
// Tone.js Transport wrapper for DAW playback
// ============================================

import * as Tone from 'tone';
import { playbackRefs } from '@/lib/store/playback';
import { createLogger } from '@/lib/logger';

const logger = createLogger('AudioEngine');

/**
 * Scheduling headroom for the count-in click. Web Audio will not play a note
 * scheduled at or behind the write cursor, and the first click of a count-in is
 * the one that matters most.
 */
const LOOKAHEAD_SECONDS = 0.05;

/** Release tail of one click, so disposal never truncates the last beat. */
const CLICK_TAIL_SECONDS = 0.3;

// ============================================
// Types
// ============================================

interface _AudioEngineConfig {
    bpm: number;
    timeSignature: [number, number];
    loopStart: number;  // bars
    loopEnd: number;    // bars
    loopEnabled: boolean;
}

interface ScheduledEvent {
    id: string;
    type: 'note' | 'audio';
    startTime: number;  // Tone.js time format
    duration?: number;
    dispose: () => void;
}

// ============================================
// Audio Engine Class
// ============================================

class AudioEngine {
    private isInitialized = false;
    private scheduledEvents: Map<string, ScheduledEvent> = new Map();
    private metronome: Tone.Synth | null = null;
    private metronomeLoop: Tone.Loop | null = null;
    /** Its own voice, so cancelling a count-in can dispose it mid-flight. */
    private countInSynth: Tone.Synth | null = null;
    /** Audio-context time the count-in ends; the transport click waits it out. */
    private countInUntil = 0;
    private countInDisposeId: ReturnType<typeof setTimeout> | null = null;
    private onBeatCallback: ((bar: number, beat: number) => void) | null = null;

    // ============================================
    // Initialization
    // ============================================

    async initialize(): Promise<void> {
        if (this.isInitialized) return;

        // Start audio context on user interaction
        await Tone.start();

        // Deliberately does NOT set bpm or timeSignature. It used to stamp
        // 120 / 4-4 here, which silently overwrote the open project's tempo on
        // the first user gesture — and since the compose page only re-applied
        // the project's tempo when `isAudioReady` flipped, everything depended
        // on that one re-run landing after this. secondsToBar() reads the
        // transport, and the arrangement sizes every audio clip with it, so
        // whenever the ordering slipped a dropped sample was measured against
        // 120 regardless of the song. The project owns the tempo; the engine
        // just plays at it.

        // Create metronome synth
        this.metronome = new Tone.Synth({
            oscillator: { type: 'triangle' },
            envelope: {
                attack: 0.001,
                decay: 0.1,
                sustain: 0,
                release: 0.1,
            },
        }).toDestination();

        this.metronome.volume.value = -10;

        this.isInitialized = true;
        logger.info('Initialized successfully');
    }

    isReady(): boolean {
        return this.isInitialized;
    }

    // ============================================
    // Transport Controls
    // ============================================

    play(startTime?: number): void {
        if (!this.isInitialized) {
            logger.warn('Cannot play - engine not initialized');
            return;
        }

        const transport = Tone.getTransport();

        // Use provided startTime, or the current ref position (set by seek), or transport position
        const playFromTime = startTime ?? playbackRefs.currentTimeRef.current ?? transport.seconds;

        // Store sync points for playhead animation
        playbackRefs.playbackStartTimeRef.current = Tone.getContext().currentTime;
        playbackRefs.audioStartPositionRef.current = playFromTime;
        playbackRefs.isPlayingRef.current = true;

        // Set transport position before starting
        transport.seconds = playFromTime;
        transport.start();
    }

    pause(): void {
        const transport = Tone.getTransport();
        transport.pause();
        playbackRefs.isPlayingRef.current = false;
        playbackRefs.currentTimeRef.current = transport.seconds;
    }

    stop(): void {
        const transport = Tone.getTransport();
        transport.stop();
        transport.seconds = 0;
        playbackRefs.isPlayingRef.current = false;
        playbackRefs.currentTimeRef.current = 0;
    }

    seek(timeInSeconds: number): void {
        const transport = Tone.getTransport();

        transport.seconds = Math.max(0, timeInSeconds);
        playbackRefs.currentTimeRef.current = transport.seconds;

        if (playbackRefs.isPlayingRef.current) {
            playbackRefs.playbackStartTimeRef.current = Tone.getContext().currentTime;
            playbackRefs.audioStartPositionRef.current = transport.seconds;
        }
    }

    seekToBar(bar: number): void {
        const timeInSeconds = this.barToSeconds(bar);
        this.seek(timeInSeconds);
    }

    // ============================================
    // Configuration
    // ============================================

    setBpm(bpm: number): void {
        const clampedBpm = Math.max(20, Math.min(300, bpm));
        Tone.getTransport().bpm.value = clampedBpm;
    }

    getBpm(): number {
        return Tone.getTransport().bpm.value;
    }

    setTimeSignature(numerator: number, denominator: number): void {
        Tone.getTransport().timeSignature = [numerator, denominator];
    }

    setLoop(enabled: boolean, startBar?: number, endBar?: number): void {
        const transport = Tone.getTransport();
        transport.loop = enabled;

        if (enabled && startBar !== undefined && endBar !== undefined) {
            transport.loopStart = this.barToSeconds(startBar);
            transport.loopEnd = this.barToSeconds(endBar);
        }

    }

    // ============================================
    // Metronome
    // ============================================

    private metronomeRunning = false;

    startMetronome(volume: number = 0.7): void {
        if (!this.metronome || this.metronomeRunning) return;

        // Set volume (convert 0-1 to dB)
        this.metronome.volume.value = Tone.gainToDb(volume) - 6;

        // Create metronome loop
        this.metronomeLoop = new Tone.Loop((time) => {
            const transport = Tone.getTransport();

            // Only play if transport is actually running
            if (transport.state !== 'started') return;

            // A lead-in count-in runs the transport, so this loop and
            // playCountIn() would both click the same beats. The count-in owns
            // them; this waits until it is done.
            if (time < this.countInUntil) return;

            const position = transport.position.toString();
            const [bar, beat] = position.split(':').map(Number);

            // Accent on beat 1
            const freq = beat === 0 ? 1000 : 800;
            this.metronome?.triggerAttackRelease(freq, '32n', time);

            // Callback for UI updates
            if (this.onBeatCallback) {
                this.onBeatCallback(bar, beat);
            }
        }, '4n');

        this.metronomeLoop.start(0);
        this.metronomeRunning = true;
    }

    stopMetronome(): void {
        if (this.metronomeLoop) {
            this.metronomeLoop.stop();
            this.metronomeLoop.dispose();
            this.metronomeLoop = null;
        }
        this.metronomeRunning = false;
    }

    /**
     * Click the count-in, on the audio clock rather than the transport.
     *
     * The transport cannot be the source here. The metronome loop is a
     * `Tone.Loop` that returns unless the transport is running, and the default
     * count-in — record from the top of an empty song — is *pre-roll*: the
     * transport deliberately waits at bar 0 while the count-in happens (see
     * recording-manager). So the one count-in nearly every first-time user hears
     * is the one the transport can never click. Scheduling against
     * `context.currentTime` covers pre-roll and lead-in identically.
     *
     * Unconditional, and not gated on `metronomeEnabled`: a count-in you cannot
     * hear is not a count-in. It stops before the take begins, so it can never
     * bleed into a recording made on speakers — which is exactly why the
     * metronome *during* the take stays the user's choice.
     *
     * @returns the audio-context time the count-in ends.
     */
    playCountIn(beats: number, secondsPerBeat: number, beatsPerBar: number, volume = 0.7): number {
        this.stopCountIn();
        if (!this.isInitialized || beats <= 0 || secondsPerBeat <= 0) return 0;

        // Volume in the constructor, not assigned afterwards. Setting
        // `.volume.value` on a freshly built Synth does not reach its own first
        // note: measured, the "1" of every count-in came out at 0.97 against
        // 0.38 for every beat after it — the one beat that has to be right,
        // 8dB loud.
        this.countInSynth = new Tone.Synth({
            volume: Tone.gainToDb(volume) - 6,
            oscillator: { type: 'triangle' },
            envelope: { attack: 0.001, decay: 0.1, sustain: 0, release: 0.1 },
        }).toDestination();

        // A beat of lookahead. Scheduling the first click at `currentTime` puts
        // it at or behind the write cursor, so it either arrives late or is
        // dropped — and the beat it would be dropping is the "1".
        const start = Tone.getContext().currentTime + LOOKAHEAD_SECONDS;
        for (let beat = 0; beat < beats; beat++) {
            const accent = beat % beatsPerBar === 0;
            this.countInSynth.triggerAttackRelease(
                accent ? 1000 : 800,
                '32n',
                start + beat * secondsPerBeat
            );
        }

        this.countInUntil = start + beats * secondsPerBeat;

        // Clean up after the last click's release has rung out. Disposing on
        // the beat itself would cut the "1" short — the one click that has to
        // land properly.
        const lifetimeMs = (this.countInUntil - Tone.getContext().currentTime + CLICK_TAIL_SECONDS) * 1000;
        this.countInDisposeId = setTimeout(() => {
            this.countInDisposeId = null;
            this.stopCountIn();
        }, lifetimeMs);

        return this.countInUntil;
    }

    /**
     * Silence a count-in that was abandoned partway through.
     *
     * Everything not yet rendered stops. One click can still get through: Tone
     * runs a 0.1s lookAhead over a ~5ms base latency, and audio already written
     * cannot be unwritten. Measured — cancelling mid-gap silences it completely;
     * cancelling within a click's lookahead lets that one click sound.
     */
    stopCountIn(): void {
        if (this.countInDisposeId) {
            clearTimeout(this.countInDisposeId);
            this.countInDisposeId = null;
        }
        if (this.countInSynth) {
            this.countInSynth.dispose();
            this.countInSynth = null;
        }
        this.countInUntil = 0;
    }

    setMetronomeVolume(volume: number): void {
        if (this.metronome) {
            this.metronome.volume.value = Tone.gainToDb(volume) - 6;
        }
    }

    onBeat(callback: (bar: number, beat: number) => void): void {
        this.onBeatCallback = callback;
    }

    // ============================================
    // Time Utilities
    // ============================================

    getCurrentTime(): number {
        if (playbackRefs.isPlayingRef.current) {
            // Use transport.seconds directly - it handles looping automatically
            const transport = Tone.getTransport();
            return transport.seconds;
        }
        return playbackRefs.currentTimeRef.current;
    }

    getCurrentBar(): number {
        return this.secondsToBar(this.getCurrentTime());
    }

    getCurrentBeat(): number {
        const transport = Tone.getTransport();
        const position = transport.position.toString();
        const parts = position.split(':');
        return parts.length > 1 ? parseInt(parts[1], 10) : 0;
    }

    barToSeconds(bar: number): number {
        const bpm = this.getBpm();
        const beatsPerBar = Tone.getTransport().timeSignature as number;
        const secondsPerBeat = 60 / bpm;
        return bar * beatsPerBar * secondsPerBeat;
    }

    secondsToBar(seconds: number): number {
        const bpm = this.getBpm();
        const beatsPerBar = Tone.getTransport().timeSignature as number;
        const secondsPerBeat = 60 / bpm;
        return seconds / (beatsPerBar * secondsPerBeat);
    }

    beatsToSeconds(beats: number): number {
        const bpm = this.getBpm();
        return (beats * 60) / bpm;
    }

    secondsToBeats(seconds: number): number {
        const bpm = this.getBpm();
        return (seconds * bpm) / 60;
    }

    // ============================================
    // Scheduling (for clips)
    // ============================================

    scheduleNote(
        id: string,
        synth: Tone.Synth | Tone.PolySynth,
        note: string | number,
        startTime: number,
        duration: number,
        velocity: number = 0.8
    ): void {
        const transport = Tone.getTransport();

        const eventId = transport.schedule((time) => {
            synth.triggerAttackRelease(
                note,
                this.beatsToSeconds(duration),
                time,
                velocity
            );
        }, startTime);

        this.scheduledEvents.set(id, {
            id,
            type: 'note',
            startTime,
            duration,
            dispose: () => transport.clear(eventId),
        });
    }

    scheduleAudio(
        id: string,
        player: Tone.Player,
        startTime: number,
        offset: number = 0,
        duration?: number
    ): void {
        const transport = Tone.getTransport();

        const eventId = transport.schedule((time) => {
            player.start(time, offset, duration);
        }, startTime);

        this.scheduledEvents.set(id, {
            id,
            type: 'audio',
            startTime,
            dispose: () => {
                transport.clear(eventId);
                player.stop();
            },
        });
    }

    clearScheduledEvent(id: string): void {
        const event = this.scheduledEvents.get(id);
        if (event) {
            event.dispose();
            this.scheduledEvents.delete(id);
        }
    }

    clearAllScheduledEvents(): void {
        this.scheduledEvents.forEach((event) => event.dispose());
        this.scheduledEvents.clear();
    }

    // ============================================
    // Cleanup
    // ============================================

    dispose(): void {
        this.stop();
        this.stopMetronome();
        this.stopCountIn();
        this.clearAllScheduledEvents();

        if (this.metronome) {
            this.metronome.dispose();
            this.metronome = null;
        }

        this.isInitialized = false;
    }
}

// ============================================
// Singleton Export
// ============================================

export const audioEngine = new AudioEngine();

// ============================================
// React Hook for Engine Access
// ============================================

export function useAudioEngine() {
    return audioEngine;
}
