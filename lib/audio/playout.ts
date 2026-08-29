// ============================================
// ComposeYogi — Audio Playout System
// Schedules clips to Tone.js Transport
// ============================================
//
// The live half of the engine. All of the musical decisions — timing,
// instrument resolution, effect construction, solo/mute gating — live in
// lib/audio/scheduler.ts and are shared with the offline export renderer, so
// what you hear here is what gets rendered on export.

import * as Tone from 'tone';

import { createLogger } from '@/lib/logger';
import {
    MASTER_GAIN,
    MASTER_LIMITER_THRESHOLD_DB,
    PARAM_RAMP_SECONDS,
    buildEffectChain,
    buildRenderPlan,
    effectiveTrackGain,
    isTrackAudible,
    releaseSynth,
    scheduleAudioClip,
    scheduleMidiClip,
} from './scheduler';

import type { RenderClipKind, RenderPlan } from './scheduler';
import type { Clip, Project, Track, TrackEffect } from '@/types';
import type { SynthType } from './synth-presets';

const logger = createLogger('Playout');

// ============================================
// Types
// ============================================

interface ScheduledClip {
    clipId: string;
    player: Tone.Player | SynthType | null;
    eventIds: number[];
    startBar: number;
    lengthBars: number;
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
    private masterLimiter: Tone.Limiter | null = null;
    private analyser: Tone.Analyser | null = null;
    private trackGains: Map<string, Tone.Gain> = new Map();
    private trackPanners: Map<string, Tone.Panner> = new Map();
    private trackEntries: Map<string, Tone.Gain> = new Map();
    private trackEffects: Map<string, Tone.ToneAudioNode[]> = new Map();

    // Version counter to prevent concurrent scheduleProject races
    private scheduleVersion = 0;
    // Per-track counter for the same reason on async effect-chain rebuilds
    private effectsVersion: Map<string, number> = new Map();

    // ========================================
    // Initialization
    // ========================================

    async initialize(): Promise<void> {
        if (this.state.isLoaded) return;

        // Master chain mirrors the offline renderer exactly:
        //   masterGain (headroom) -> limiter -> analyser -> destination
        this.analyser = new Tone.Analyser('fft', 256);
        this.masterLimiter = new Tone.Limiter(MASTER_LIMITER_THRESHOLD_DB);
        this.masterGain = new Tone.Gain(MASTER_GAIN);

        this.masterGain.connect(this.masterLimiter);
        this.masterLimiter.connect(this.analyser);
        this.analyser.toDestination();

        this.state.isLoaded = true;
        logger.info('Initialized audio routing');
    }

    dispose(): void {
        this.clearAllScheduled();

        this.trackEffects.forEach((nodes) => nodes.forEach((node) => node.dispose()));
        this.trackEntries.forEach((entry) => entry.dispose());
        this.trackGains.forEach((gain) => gain.dispose());
        this.trackPanners.forEach((panner) => panner.dispose());
        this.masterGain?.dispose();
        this.masterLimiter?.dispose();
        this.analyser?.dispose();

        this.trackEffects.clear();
        this.trackEntries.clear();
        this.trackGains.clear();
        this.trackPanners.clear();
        this.effectsVersion.clear();
        this.state.audioBuffers.clear();
        this.state.scheduledClips.clear();
        this.masterGain = null;
        this.masterLimiter = null;
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
            gain = new Tone.Gain(track.volume ?? 0.8);

            // Default chain: entry -> gain -> panner -> master
            entry.connect(gain);
            gain.connect(panner);
            panner.connect(this.masterGain);

            this.trackEntries.set(track.id, entry);
            this.trackGains.set(track.id, gain);
            this.trackPanners.set(track.id, panner);

            if (track.effects && track.effects.length > 0) {
                void this.rebuildTrackEffects(track.id, track.effects);
            }
        }

        return { input: entry, gain, panner };
    }

    public updateTrackEffects(trackId: string, effects: TrackEffect[]): void {
        void this.rebuildTrackEffects(trackId, effects);
    }

    /**
     * Rebuild a track's insert chain. Async because a Reverb has to generate its
     * impulse response first; a per-track version guard drops the result of a
     * rebuild that a newer one has already superseded.
     */
    private async rebuildTrackEffects(trackId: string, effects: TrackEffect[]): Promise<void> {
        const entry = this.trackEntries.get(trackId);
        const gain = this.trackGains.get(trackId);
        if (!entry || !gain) return;

        const version = (this.effectsVersion.get(trackId) || 0) + 1;
        this.effectsVersion.set(trackId, version);

        const previousNodes = this.trackEffects.get(trackId) || [];
        entry.disconnect();

        const nodes = await buildEffectChain(effects, entry, gain);

        if (this.effectsVersion.get(trackId) !== version) {
            // A newer rebuild won the race — throw away what we just built.
            nodes.forEach((node) => node.dispose());
            return;
        }

        previousNodes.forEach((node) => node.dispose());
        this.trackEffects.set(trackId, nodes);
    }

    /**
     * Get the analyser node for visualization
     */
    getAnalyser(): Tone.Analyser | null {
        return this.analyser;
    }

    // ========================================
    // Live Mixer Parameters
    // ========================================
    //
    // These ramp existing nodes instead of rescheduling the project, so moving
    // a fader or hitting solo is instant and never interrupts playback.

    updateTrackVolume(trackId: string, volume: number): void {
        this.trackGains.get(trackId)?.gain.rampTo(volume, PARAM_RAMP_SECONDS);
    }

    updateTrackPan(trackId: string, pan: number): void {
        this.trackPanners.get(trackId)?.pan.rampTo(pan, PARAM_RAMP_SECONDS);
    }

    /**
     * Apply the whole mixer state — fader, pan, mute and solo — for every track.
     * Solo is exclusive, so it can only be resolved with the full track list.
     */
    applyMixState(tracks: Track[]): void {
        for (const track of tracks) {
            this.updateTrackVolume(track.id, effectiveTrackGain(track, tracks));
            this.updateTrackPan(track.id, track.pan);
        }
    }

    /**
     * Solo/mute changes. Clips stay scheduled — only the gains move — so
     * toggling solo mid-playback is sample-accurate and free.
     */
    updateSoloState(tracks: Track[]): void {
        for (const track of tracks) {
            this.updateTrackVolume(track.id, effectiveTrackGain(track, tracks));
        }
    }

    /** True when this track would currently be heard, given solo/mute. */
    isTrackAudible(track: Track, tracks: Track[]): boolean {
        return isTrackAudible(track, tracks);
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

    async scheduleClip(clip: Clip, track: Track, project: Project): Promise<void> {
        const plan = buildRenderPlan(project);
        const planned = plan.clips.find((c) => c.clipId === clip.id);
        if (!planned) {
            // Nothing to play (no take, no notes) — make sure any previous
            // schedule for this clip is gone and stop there.
            this.unscheduleClip(clip.id);
            return;
        }

        await this.schedulePlannedClip(clip, track, planned.kind, planned.startSeconds, plan);
    }

    private async schedulePlannedClip(
        clip: Clip,
        track: Track,
        kind: RenderClipKind,
        startSeconds: number,
        plan: RenderPlan
    ): Promise<void> {
        this.unscheduleClip(clip.id);

        const chain = this.getOrCreateTrackChain(track);
        const scheduled: ScheduledClip = {
            clipId: clip.id,
            player: null,
            eventIds: [],
            startBar: clip.startBar,
            lengthBars: clip.lengthBars,
        };

        if (kind === 'audio') {
            scheduled.player = await scheduleAudioClip(clip, chain.input, startSeconds);
        } else {
            const result = await scheduleMidiClip(clip, track, chain.input, startSeconds, {
                transport: Tone.getTransport(),
                bpm: plan.bpm,
                beatsPerBar: plan.beatsPerBar,
            });
            if (result) {
                scheduled.player = result.synth;
                scheduled.eventIds = result.eventIds;
            }
        }

        this.state.scheduledClips.set(clip.id, scheduled);
    }

    unscheduleClip(clipId: string): void {
        const scheduled = this.state.scheduledClips.get(clipId);
        if (!scheduled) return;

        const transport = Tone.getTransport();
        scheduled.eventIds.forEach((eventId) => transport.clear(eventId));

        if (scheduled.player) {
            try {
                if (scheduled.player instanceof Tone.Player) {
                    // Unsync before stopping: a synced Player checks the
                    // Transport on stop and can throw once detached.
                    scheduled.player.unsync();
                    scheduled.player.stop();
                } else {
                    releaseSynth(scheduled.player);
                }
            } catch (error) {
                logger.warn('Error stopping clip player', { clipId, error });
            } finally {
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

    /**
     * Schedule every clip in the project.
     *
     * Muted and non-soloed tracks are scheduled too — their audibility is a
     * gain value, not a scheduling decision — so mixer moves never require a
     * reschedule and mute/solo respond instantly.
     */
    async scheduleProject(project: Project): Promise<void> {
        // Increment version to invalidate any in-flight scheduling
        const version = ++this.scheduleVersion;
        logger.debug('Scheduling project', {
            clips: project.clips.length,
            tracks: project.tracks.length,
            version,
        });

        this.clearAllScheduled();

        // The plan resolves which clips play, when, and at what gain. The
        // offline exporter renders from the identical plan.
        const plan = buildRenderPlan(project);
        const clipsById = new Map(project.clips.map((c) => [c.id, c]));
        const tracksById = new Map(project.tracks.map((t) => [t.id, t]));

        for (const planned of plan.clips) {
            // Abort if a newer scheduleProject call has started
            if (this.scheduleVersion !== version) {
                logger.debug('Aborting stale schedule', { version, current: this.scheduleVersion });
                return;
            }

            const clip = clipsById.get(planned.clipId);
            const track = tracksById.get(planned.trackId);
            if (!clip || !track) continue;

            await this.schedulePlannedClip(clip, track, planned.kind, planned.startSeconds, plan);
        }

        if (this.scheduleVersion !== version) {
            logger.debug('Aborting stale schedule (post-clips)', { version, current: this.scheduleVersion });
            return;
        }

        for (const track of project.tracks) {
            this.getOrCreateTrackChain(track);
        }
        this.applyMixState(project.tracks);
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
