// ============================================
// ComposeYogi — Audio Playout System
// Schedules clips to Tone.js Transport
// ============================================

import * as Tone from 'tone';
import type { Clip, Project, Track, AudioTake } from '@/types';
import { getAudioTake } from './recording-manager';
import { createSynthFromPreset, type SynthType } from './synth-presets';

// ============================================
// Types
// ============================================

interface ScheduledClip {
    clipId: string;
    player: Tone.Player | SynthType | null;
    startBar: number;
    lengthBars: number;
    events: Tone.ToneEvent[];
}

interface PlayoutState {
    isLoaded: boolean;
    scheduledClips: Map<string, ScheduledClip>;
    audioBuffers: Map<string, Tone.ToneAudioBuffer>;
    latencyCompensationMs: number;
}

// ============================================
// Playout Manager
// ============================================

class PlayoutManager {
    private state: PlayoutState = {
        isLoaded: false,
        scheduledClips: new Map(),
        audioBuffers: new Map(),
        latencyCompensationMs: 0,
    };

    private masterGain: Tone.Gain | null = null;
    private analyser: Tone.Analyser | null = null;
    private trackGains: Map<string, Tone.Gain> = new Map();
    private trackPanners: Map<string, Tone.Panner> = new Map();

    // ========================================
    // Initialization
    // ========================================

    async initialize(): Promise<void> {
        if (this.state.isLoaded) return;

        // Create analyser for visualization
        this.analyser = new Tone.Analyser('fft', 256);

        // Create master gain and connect through analyser
        this.masterGain = new Tone.Gain(1);
        this.masterGain.connect(this.analyser);
        this.analyser.toDestination();

        this.state.isLoaded = true;
    }

    dispose(): void {
        this.clearAllScheduled();

        this.trackGains.forEach((gain) => gain.dispose());
        this.trackPanners.forEach((panner) => panner.dispose());
        this.masterGain?.dispose();
        this.analyser?.dispose();

        this.trackGains.clear();
        this.trackPanners.clear();
        this.state.audioBuffers.clear();
        this.state.scheduledClips.clear();
        this.masterGain = null;
        this.analyser = null;
        this.state.isLoaded = false;
    }

    // ========================================
    // Track Signal Chain
    // ========================================

    private getOrCreateTrackChain(track: Track): { gain: Tone.Gain; panner: Tone.Panner } {
        if (!this.masterGain) {
            throw new Error('PlayoutManager not initialized');
        }

        let gain = this.trackGains.get(track.id);
        let panner = this.trackPanners.get(track.id);

        if (!gain || !panner) {
            panner = new Tone.Panner(track.pan || 0);
            gain = new Tone.Gain(track.volume || 0.8);

            // Chain: source -> gain -> panner -> master
            gain.connect(panner);
            panner.connect(this.masterGain);

            this.trackGains.set(track.id, gain);
            this.trackPanners.set(track.id, panner);
        }

        return { gain, panner };
    }

    /**
     * Get the analyser node for visualization
     */
    getAnalyser(): Tone.Analyser | null {
        return this.analyser;
    }

    updateTrackVolume(trackId: string, volume: number): void {
        const gain = this.trackGains.get(trackId);
        if (gain) {
            gain.gain.rampTo(volume, 0.05);
        }
    }

    updateTrackPan(trackId: string, pan: number): void {
        const panner = this.trackPanners.get(trackId);
        if (panner) {
            panner.pan.rampTo(pan, 0.05);
        }
    }

    updateTrackMute(trackId: string, muted: boolean): void {
        const gain = this.trackGains.get(trackId);
        if (gain) {
            gain.gain.rampTo(muted ? 0 : 1, 0.01);
        }
    }

    // ========================================
    // Audio Buffer Management
    // ========================================

    async loadAudioBuffer(audioUrl: string): Promise<Tone.ToneAudioBuffer> {
        const existing = this.state.audioBuffers.get(audioUrl);
        if (existing) return existing;

        const buffer = await Tone.ToneAudioBuffer.fromUrl(audioUrl);
        this.state.audioBuffers.set(audioUrl, buffer);
        return buffer;
    }

    unloadAudioBuffer(audioUrl: string): void {
        const buffer = this.state.audioBuffers.get(audioUrl);
        if (buffer) {
            buffer.dispose();
            this.state.audioBuffers.delete(audioUrl);
        }
    }

    // ========================================
    // Clip Scheduling
    // ========================================

    /**
     * Convert bars to seconds based on BPM and time signature
     */
    private barsToSeconds(bars: number, bpm: number, beatsPerBar: number = 4): number {
        const beatsPerSecond = bpm / 60;
        const secondsPerBeat = 1 / beatsPerSecond;
        const totalBeats = bars * beatsPerBar;
        return totalBeats * secondsPerBeat;
    }

    /**
     * Convert beats to seconds
     */
    private beatsToSeconds(beats: number, bpm: number): number {
        return (beats / bpm) * 60;
    }

    async scheduleClip(clip: Clip, track: Track, project: Project): Promise<void> {
        // Remove any existing schedule for this clip
        this.unscheduleClip(clip.id);

        const { gain } = this.getOrCreateTrackChain(track);
        const scheduled: ScheduledClip = {
            clipId: clip.id,
            player: null,
            startBar: clip.startBar,
            lengthBars: clip.lengthBars,
            events: [],
        };

        const beatsPerBar = project.timeSignature[0];

        if (clip.type === 'audio' && clip.activeTakeId) {
            // Schedule audio clip from AudioTake
            await this.scheduleAudioClip(clip, track, gain, scheduled, project);
        } else if ((clip.type === 'midi' || clip.type === 'drum') && clip.notes) {
            // Schedule MIDI/Drum clip
            this.scheduleMidiClip(clip, track, gain, scheduled, project);
        }

        this.state.scheduledClips.set(clip.id, scheduled);
    }

    /**
     * Schedule an audio clip using its AudioTake data
     */
    private async scheduleAudioClip(
        clip: Clip,
        track: Track,
        destination: Tone.Gain,
        scheduled: ScheduledClip,
        project: Project
    ): Promise<void> {
        if (!clip.activeTakeId) {
            console.warn('[PlayoutManager] No activeTakeId for clip:', clip.id);
            return;
        }

        // Get the audio take data
        const take = getAudioTake(clip.activeTakeId);
        if (!take) {
            console.warn('[PlayoutManager] AudioTake not found:', clip.activeTakeId);
            return;
        }

        console.log('[PlayoutManager] Loading audio take:', take.id, 'size:', take.audioData.length, 'bytes');

        try {
            // Convert WAV Uint8Array back to AudioBuffer
            const audioBuffer = await this.uint8ArrayToAudioBuffer(take.audioData, take.sampleRate);
            console.log('[PlayoutManager] Decoded audio buffer:', audioBuffer.duration, 'seconds,', audioBuffer.numberOfChannels, 'channels');

            // Create Tone.js buffer from AudioBuffer
            const toneBuffer = new Tone.ToneAudioBuffer(audioBuffer);

            // Create player and set it to sync with transport
            const player = new Tone.Player(toneBuffer);
            player.sync(); // Sync to transport
            player.connect(destination);

            // Calculate start time in seconds
            const bpm = project.bpm;
            const beatsPerBar = project.timeSignature[0];
            const clipStartSeconds = this.barsToSeconds(clip.startBar, bpm, beatsPerBar);

            // Schedule the player to start at the clip position
            // Using sync() + start(time) schedules relative to transport
            player.start(clipStartSeconds);

            scheduled.player = player;
            console.log('[PlayoutManager] Scheduled audio clip:', clip.id, 'at', clipStartSeconds, 'seconds (bar', clip.startBar, ')');
        } catch (error) {
            console.error('[PlayoutManager] Failed to schedule audio clip:', error);
        }
    }

    /**
     * Convert WAV Uint8Array back to AudioBuffer
     */
    private async uint8ArrayToAudioBuffer(data: Uint8Array, sampleRate: number): Promise<AudioBuffer> {
        const audioContext = Tone.getContext().rawContext;

        // Create a proper ArrayBuffer copy from the Uint8Array
        const arrayBuffer = new ArrayBuffer(data.byteLength);
        new Uint8Array(arrayBuffer).set(data);

        return audioContext.decodeAudioData(arrayBuffer);
    }

    private scheduleMidiClip(
        clip: Clip,
        track: Track,
        destination: Tone.Gain,
        scheduled: ScheduledClip,
        project: Project
    ): void {
        if (!clip.notes?.length) {
            console.log('[PlayoutManager] Skipping MIDI clip with no notes:', clip.id);
            return;
        }

        // Create synth based on track type
        const synth = this.createSynthForTrack(track);
        synth.connect(destination);

        const bpm = project.bpm;
        const beatsPerBar = project.timeSignature[0];

        // Convert clip start from bars to seconds
        const clipStartSeconds = this.barsToSeconds(clip.startBar, bpm, beatsPerBar);

        console.log('[PlayoutManager] Scheduling MIDI clip:', clip.id, 'with', clip.notes.length, 'notes at bar', clip.startBar, '(', clipStartSeconds, 's)');

        // Schedule each note using Transport.schedule for proper sync
        for (const note of clip.notes) {
            // Note's startBeat is relative to clip start
            const noteOffsetSeconds = this.beatsToSeconds(note.startBeat, bpm);
            const absoluteTime = clipStartSeconds + noteOffsetSeconds;
            const noteDurationSeconds = this.beatsToSeconds(note.duration, bpm);

            // Use Transport.schedule for proper transport sync
            const eventId = Tone.getTransport().schedule((time) => {
                console.log('[PlayoutManager] Triggering note:', note.pitch, 'at', time);
                synth.triggerAttackRelease(
                    Tone.Frequency(note.pitch, 'midi').toFrequency(),
                    noteDurationSeconds,
                    time,
                    note.velocity / 127
                );
            }, absoluteTime);

            // Create a dummy event to track disposal
            const event = {
                stop: () => { },
                dispose: () => {
                    Tone.getTransport().clear(eventId);
                },
            } as Tone.ToneEvent;
            scheduled.events.push(event);
        }

        scheduled.player = synth;
    }

    private createSynthForTrack(track: Track): SynthType {
        // First, check if track has a specific instrument preset
        if (track.instrumentPreset) {
            return createSynthFromPreset(track.instrumentPreset);
        }

        // Fallback: Use track color to determine synth type
        // This provides sensible defaults based on musical role
        switch (track.color) {
            case 'bass':
                return createSynthFromPreset('synth-bass');
            case 'keys':
                return createSynthFromPreset('electric-piano');
            case 'melody':
                return createSynthFromPreset('saw-lead');
            case 'drums':
                return createSynthFromPreset('drum-synth');
            case 'fx':
                return createSynthFromPreset('warm-pad');
            case 'vocals':
            default:
                return createSynthFromPreset('basic-synth');
        }
    }

    unscheduleClip(clipId: string): void {
        const scheduled = this.state.scheduledClips.get(clipId);
        if (!scheduled) return;

        // Stop and dispose events
        scheduled.events.forEach((event) => {
            event.stop();
            event.dispose();
        });

        // Unsync and dispose player/synth
        if (scheduled.player) {
            if (scheduled.player instanceof Tone.Player) {
                scheduled.player.unsync();
            }
            scheduled.player.dispose();
        }

        this.state.scheduledClips.delete(clipId);
    }

    clearAllScheduled(): void {
        this.state.scheduledClips.forEach((_, clipId) => {
            this.unscheduleClip(clipId);
        });
    }

    // ========================================
    // Project Scheduling
    // ========================================

    async scheduleProject(project: Project): Promise<void> {
        console.log('[PlayoutManager] Scheduling project with', project.clips.length, 'clips');

        // Clear existing schedules
        this.clearAllScheduled();

        // Schedule all clips
        for (const clip of project.clips) {
            const track = project.tracks.find((t) => t.id === clip.trackId);
            console.log('[PlayoutManager] Processing clip:', clip.id, 'type:', clip.type, 'track:', track?.name, 'muted:', track?.muted);
            if (track && !track.muted) {
                await this.scheduleClip(clip, track, project);
            }
        }

        // Update track volumes and pans
        for (const track of project.tracks) {
            this.getOrCreateTrackChain(track);
            this.updateTrackVolume(track.id, track.muted ? 0 : track.volume);
            this.updateTrackPan(track.id, track.pan);
        }
    }

    // ========================================
    // Solo Management
    // ========================================

    updateSoloState(tracks: Track[]): void {
        const hasSoloedTrack = tracks.some((t) => t.solo);

        for (const track of tracks) {
            const shouldPlay = !hasSoloedTrack || track.solo;
            this.updateTrackMute(track.id, track.muted || (hasSoloedTrack && !track.solo));
        }
    }

    // ========================================
    // Getters
    // ========================================

    isLoaded(): boolean {
        return this.state.isLoaded;
    }

    getScheduledClipIds(): string[] {
        return Array.from(this.state.scheduledClips.keys());
    }

    // ========================================
    // Latency Compensation
    // ========================================

    setLatencyCompensation(ms: number): void {
        this.state.latencyCompensationMs = ms;
    }

    getLatencyCompensation(): number {
        return this.state.latencyCompensationMs;
    }

    /**
     * Get the latency compensation in seconds
     */
    getLatencyCompensationSeconds(): number {
        return this.state.latencyCompensationMs / 1000;
    }
}

// ============================================
// Singleton Export
// ============================================

export const playoutManager = new PlayoutManager();
