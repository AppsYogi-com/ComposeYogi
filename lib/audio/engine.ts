// ============================================
// ComposeYogi — Audio Engine
// Tone.js Transport wrapper for DAW playback
// ============================================

import * as Tone from 'tone';
import { playbackRefs } from '@/lib/store/playback';

// ============================================
// Types
// ============================================

interface AudioEngineConfig {
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
    private onBeatCallback: ((bar: number, beat: number) => void) | null = null;

    // ============================================
    // Initialization
    // ============================================

    async initialize(): Promise<void> {
        if (this.isInitialized) return;

        // Start audio context on user interaction
        await Tone.start();

        // Configure default settings
        Tone.getTransport().bpm.value = 120;
        Tone.getTransport().timeSignature = [4, 4];

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
        console.log('[AudioEngine] Initialized');
    }

    isReady(): boolean {
        return this.isInitialized;
    }

    // ============================================
    // Transport Controls
    // ============================================

    play(startTime?: number): void {
        if (!this.isInitialized) {
            console.warn('[AudioEngine] Not initialized');
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
        console.log('[AudioEngine] Paused at', transport.seconds);
    }

    stop(): void {
        const transport = Tone.getTransport();
        transport.stop();
        transport.seconds = 0;
        playbackRefs.isPlayingRef.current = false;
        playbackRefs.currentTimeRef.current = 0;
        console.log('[AudioEngine] Stopped');
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
        const transport = Tone.getTransport();
        const timeInSeconds = this.barToSeconds(bar);
        this.seek(timeInSeconds);
    }

    // ============================================
    // Configuration
    // ============================================

    setBpm(bpm: number): void {
        const clampedBpm = Math.max(20, Math.min(300, bpm));
        Tone.getTransport().bpm.value = clampedBpm;
        console.log('[AudioEngine] BPM set to', clampedBpm);
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

        console.log('[AudioEngine] Loop', enabled ? 'enabled' : 'disabled');
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
        console.log('[AudioEngine] Metronome started');
    }

    stopMetronome(): void {
        if (this.metronomeLoop) {
            this.metronomeLoop.stop();
            this.metronomeLoop.dispose();
            this.metronomeLoop = null;
        }
        this.metronomeRunning = false;
        console.log('[AudioEngine] Metronome stopped');
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
        console.log('[AudioEngine] Cleared all scheduled events');
    }

    // ============================================
    // Cleanup
    // ============================================

    dispose(): void {
        this.stop();
        this.stopMetronome();
        this.clearAllScheduledEvents();

        if (this.metronome) {
            this.metronome.dispose();
            this.metronome = null;
        }

        this.isInitialized = false;
        console.log('[AudioEngine] Disposed');
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
