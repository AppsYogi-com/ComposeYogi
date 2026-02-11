// ============================================
// ComposeYogi — Audio Playout System
// Schedules clips to Tone.js Transport
// ============================================

import * as Tone from 'tone';
import type { Clip, Project, Track, TrackEffect } from '@/types';
import { createLogger } from '@/lib/logger';

const logger = createLogger('Playout');
import { getAudioTake } from './recording-manager';
import { createSynthFromPreset, waitForSynthReady, type SynthType } from './synth-presets';

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
    private trackEntries: Map<string, Tone.Gain> = new Map();
    private trackEffects: Map<string, Tone.ToneAudioNode[]> = new Map();

    // Version counter to prevent concurrent scheduleProject races
    private scheduleVersion = 0;

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
        logger.info('Initialized audio routing');
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

    private getOrCreateTrackChain(track: Track): { input: Tone.Gain; gain: Tone.Gain; panner: Tone.Panner } {
        if (!this.masterGain) {
            throw new Error('PlayoutManager not initialized');
        }

        let entry = this.trackEntries.get(track.id);
        let gain = this.trackGains.get(track.id);
        let panner = this.trackPanners.get(track.id);

        if (!entry || !gain || !panner) {
            entry = new Tone.Gain(1);
            panner = new Tone.Panner(track.pan || 0);
            gain = new Tone.Gain(track.volume || 0.8);

            // Default Chain: entry -> gain -> panner -> master
            entry.connect(gain);
            gain.connect(panner);
            panner.connect(this.masterGain);

            this.trackEntries.set(track.id, entry);
            this.trackGains.set(track.id, gain);
            this.trackPanners.set(track.id, panner);

            // Initialize effects if present
            if (track.effects && track.effects.length > 0) {
                this.rebuildTrackEffects(track.id, track.effects);
            }
        }

        return { input: entry, gain, panner };
    }

    public updateTrackEffects(trackId: string, effects: TrackEffect[]): void {
        this.rebuildTrackEffects(trackId, effects);
    }

    private rebuildTrackEffects(trackId: string, effects: TrackEffect[]): void {
        const entry = this.trackEntries.get(trackId);
        const gain = this.trackGains.get(trackId);

        if (!entry || !gain) return;

        // Dispose old effects
        const oldEffects = this.trackEffects.get(trackId);
        if (oldEffects) {
            oldEffects.forEach(node => node.dispose());
        }

        // Always disconnect entry from whatever it was connected to
        entry.disconnect();

        if (!effects || effects.length === 0) {
            // No effects: entry -> gain
            entry.connect(gain);
            this.trackEffects.set(trackId, []);
            return;
        }

        // Build new chain
        const effectNodes: Tone.ToneAudioNode[] = [];
        let currentNode: Tone.ToneAudioNode = entry;

        effects.forEach(effect => {
            const node = this.createEffectNode(effect);
            if (node) {
                currentNode.connect(node);
                currentNode = node;
                effectNodes.push(node);
            }
        });

        currentNode.connect(gain);
        this.trackEffects.set(trackId, effectNodes);
    }

    private createEffectNode(effect: TrackEffect): Tone.ToneAudioNode | null {
        try {
            switch (effect.type) {
                case 'reverb':
                    const rev = new Tone.Reverb({
                        decay: effect.params.decay || 1.5,
                        preDelay: 0.01,
                        wet: effect.params.wet || 0.5
                    });
                    // rev.generate(); // Tone v14.8+ auto-generates on connect/start usually, but manual call is safe
                    // Calling generate() helps ensure silent impulse generation
                    void rev.generate();
                    return rev;
                case 'delay':
                    return new Tone.FeedbackDelay({
                        delayTime: effect.params.delayTime || 0.25,
                        feedback: effect.params.feedback || 0.5,
                        wet: effect.params.wet || 0.5
                    });
                case 'distortion':
                    return new Tone.Distortion({
                        distortion: effect.params.distortion || 0.4,
                        wet: effect.params.wet || 0.5
                    });
                case 'filter':
                    return new Tone.Filter({
                        frequency: effect.params.frequency || 1000,
                        type: effect.params.filterType || 'lowpass',
                        Q: effect.params.Q || 1
                    });
                case 'compression':
                    return new Tone.Compressor({
                        threshold: effect.params.threshold || -30,
                        ratio: effect.params.ratio || 12
                    });
                default:
                    return null;
            }
        } catch (e) {
            console.error('Error creating effect:', e);
            return null;
        }
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

        // Get track entry point (effects -> volume -> pan)
        const chain = this.getOrCreateTrackChain(track);
        const scheduled: ScheduledClip = {
            clipId: clip.id,
            player: null,
            startBar: clip.startBar,
            lengthBars: clip.lengthBars,
            events: [],
        };

        const _beatsPerBar = project.timeSignature[0];

        if (clip.type === 'audio' && clip.activeTakeId) {
            // Schedule audio clip from AudioTake
            await this.scheduleAudioClip(clip, track, chain.input, scheduled, project);
        } else if ((clip.type === 'midi' || clip.type === 'drum') && clip.notes) {
            // Schedule MIDI/Drum clip
            await this.scheduleMidiClip(clip, track, chain.input, scheduled, project);
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


        try {
            // Convert WAV Uint8Array back to AudioBuffer
            const audioBuffer = await this.uint8ArrayToAudioBuffer(take.audioData, take.sampleRate);

            // Create Tone.js buffer from AudioBuffer
            const toneBuffer = new Tone.ToneAudioBuffer(audioBuffer);

            // Create player and set it to sync with transport
            const player = new Tone.Player(toneBuffer);
            player.sync(); // Sync to transport
            player.connect(destination);

            // Apply fades (Tone.Player supports simple curves)
            player.fadeIn = clip.fadeIn || 0;
            player.fadeOut = clip.fadeOut || 0;

            // Calculate start time in seconds
            const bpm = project.bpm;
            const beatsPerBar = project.timeSignature[0];
            const clipStartSeconds = this.barsToSeconds(clip.startBar, bpm, beatsPerBar);

            // Calculate trim/duration
            const trimStart = clip.trimStart || 0;
            const trimEnd = clip.trimEnd || 0;
            const sourceDuration = toneBuffer.duration;
            const playDuration = Math.max(0, sourceDuration - trimStart - trimEnd);

            // Schedule the player to start at the clip position
            // using sync() + start(startTime, offset, duration)
            if (playDuration > 0) {
                player.start(clipStartSeconds, trimStart, playDuration);
            }

            scheduled.player = player;
        } catch (error) {
            console.error('[PlayoutManager] Failed to schedule audio clip:', error);
        }
    }

    /**
     * Convert WAV Uint8Array back to AudioBuffer
     */
    private async uint8ArrayToAudioBuffer(data: Uint8Array, _sampleRate: number): Promise<AudioBuffer> {
        const audioContext = Tone.getContext().rawContext;

        // Create a proper ArrayBuffer copy from the Uint8Array
        const arrayBuffer = new ArrayBuffer(data.byteLength);
        new Uint8Array(arrayBuffer).set(data);

        return audioContext.decodeAudioData(arrayBuffer);
    }

    private async scheduleMidiClip(
        clip: Clip,
        track: Track,
        destination: Tone.Gain,
        scheduled: ScheduledClip,
        project: Project
    ): Promise<void> {
        if (!clip.notes?.length) {
            return;
        }

        // Create synth: prefer clip-level instrument, fall back to track
        const synth = clip.instrumentPreset
            ? createSynthFromPreset(clip.instrumentPreset)
            : this.createSynthForTrack(track);
        synth.connect(destination);

        // Wait for synth to be ready (important for Sampler which loads async)
        await waitForSynthReady(synth);

        const bpm = project.bpm;
        const beatsPerBar = project.timeSignature[0];

        // Convert clip start from bars to seconds
        const clipStartSeconds = this.barsToSeconds(clip.startBar, bpm, beatsPerBar);


        // Check if synth is polyphonic (PolySynth and Sampler can handle multiple notes at same time)
        const isPolyphonic = synth instanceof Tone.PolySynth || synth instanceof Tone.Sampler;

        // Group notes by start time to handle concurrent notes for monophonic synths
        const notesByTime = new Map<number, typeof clip.notes>();
        for (const note of clip.notes) {
            const noteOffsetSeconds = this.beatsToSeconds(note.startBeat, bpm);
            const absoluteTime = clipStartSeconds + noteOffsetSeconds;
            // Round to avoid floating point issues
            const timeKey = Math.round(absoluteTime * 10000) / 10000;

            if (!notesByTime.has(timeKey)) {
                notesByTime.set(timeKey, []);
            }
            notesByTime.get(timeKey)!.push(note);
        }

        // Schedule notes, adding tiny offsets for monophonic synths with concurrent notes
        for (const [timeKey, notes] of notesByTime) {
            notes.forEach((note, index) => {
                const noteDurationSeconds = this.beatsToSeconds(note.duration, bpm);
                // For monophonic synths, add 1ms offset for each concurrent note
                const offset = isPolyphonic ? 0 : index * 0.001;
                const scheduledTime = timeKey + offset;

                // Use Transport.schedule for proper transport sync
                const eventId = Tone.getTransport().schedule((time) => {
                    synth.triggerAttackRelease(
                        Tone.Frequency(note.pitch, 'midi').toFrequency(),
                        noteDurationSeconds,
                        time,
                        note.velocity / 127
                    );
                }, scheduledTime);

                // Create a dummy event to track disposal
                const event = {
                    stop: () => { },
                    dispose: () => {
                        Tone.getTransport().clear(eventId);
                    },
                } as Tone.ToneEvent;
                scheduled.events.push(event);
            });
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
            try {
                if (scheduled.player instanceof Tone.Player) {
                    // Unsync first to detach from Transport checks that can cause RangeErrors
                    scheduled.player.unsync();
                    scheduled.player.stop();
                } else if (scheduled.player instanceof Tone.PolySynth) {
                    scheduled.player.releaseAll();
                } else if (scheduled.player instanceof Tone.Sampler) {
                    scheduled.player.releaseAll();
                } else if (scheduled.player instanceof Tone.MonoSynth || scheduled.player instanceof Tone.MembraneSynth) {
                    scheduled.player.triggerRelease();
                }
            } catch (error) {
                console.warn('[PlayoutManager] Error stopping clip player:', error);
            } finally {
                // Always dispose to ensure disconnect
                scheduled.player.dispose();
            }
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
        // Increment version to invalidate any in-flight scheduling
        const version = ++this.scheduleVersion;
        logger.debug('Scheduling project', { clips: project.clips.length, tracks: project.tracks.length, version });

        // Clear existing schedules
        this.clearAllScheduled();

        // Schedule all clips, checking version after each async op
        for (const clip of project.clips) {
            // Abort if a newer scheduleProject call has started
            if (this.scheduleVersion !== version) {
                logger.debug('Aborting stale schedule', { version, current: this.scheduleVersion });
                return;
            }
            const track = project.tracks.find((t) => t.id === clip.trackId);
            if (track && !track.muted) {
                await this.scheduleClip(clip, track, project);
            }
        }

        // Final check before applying track settings
        if (this.scheduleVersion !== version) {
            logger.debug('Aborting stale schedule (post-clips)', { version, current: this.scheduleVersion });
            return;
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
            const _shouldPlay = !hasSoloedTrack || track.solo;
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
