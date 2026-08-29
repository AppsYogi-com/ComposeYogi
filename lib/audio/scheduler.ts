// ============================================
// ComposeYogi — Shared Scheduling Core
// The single source of truth for "how a clip becomes sound"
// ============================================
//
// Both the live path (lib/audio/playout.ts) and the offline export path
// (lib/audio/offline-renderer.ts) build their signal graphs and schedule their
// notes through THIS module. Any change to timing, instrument resolution,
// effect construction or mix gating belongs here — that is what guarantees
// "the export sounds exactly like the playback".
//
// The two callers differ only in:
//   - which Transport they schedule against (global vs. the Tone.Offline one)
//   - whether the nodes are long-lived (live) or thrown away after render
// Everything else is shared.

import * as Tone from 'tone';

import { createLogger } from '@/lib/logger';
import { getAudioTake } from './recording-manager';
import { createSynthFromPreset, waitForSynthReady, type SynthType } from './synth-presets';

import type { AudioTake, Clip, Project, Track, TrackEffect } from '@/types';

const logger = createLogger('Scheduler');

// ============================================
// Types
// ============================================

/**
 * Both `Tone.getTransport()` and the transport handed to a `Tone.Offline`
 * callback are `TransportClass` instances, so the scheduling code is identical.
 */
export type SchedulerTransport = ReturnType<typeof Tone.getTransport>;

/** Everything the note/clip schedulers need to know about the song. */
export interface SchedulerContext {
    transport: SchedulerTransport;
    bpm: number;
    beatsPerBar: number;
}

export interface ScheduledMidiClip {
    synth: SynthType;
    eventIds: number[];
}

// ============================================
// Master Chain Constants
// ============================================

/**
 * Headroom applied before the master limiter. Live and offline use the same
 * values so a mix that peaks in the app peaks identically in the export.
 */
export const MASTER_GAIN = 0.8;
export const MASTER_LIMITER_THRESHOLD_DB = -1;

/** Ramp time for live mixer moves — long enough to avoid zipper noise. */
export const PARAM_RAMP_SECONDS = 0.05;

// ============================================
// Timing
// ============================================

export function barsToSeconds(bars: number, bpm: number, beatsPerBar: number = 4): number {
    const secondsPerBeat = 60 / bpm;
    return bars * beatsPerBar * secondsPerBeat;
}

export function beatsToSeconds(beats: number, bpm: number): number {
    return (beats / bpm) * 60;
}

export function secondsToBars(seconds: number, bpm: number, beatsPerBar: number = 4): number {
    const secondsPerBeat = 60 / bpm;
    return seconds / (secondsPerBeat * beatsPerBar);
}

/** Last bar occupied by any clip — the musical length of the project. */
export function projectEndBar(project: Project): number {
    return project.clips.reduce(
        (max, clip) => Math.max(max, clip.startBar + clip.lengthBars),
        0
    );
}

// ============================================
// Mix Gating (solo / mute) — ONE definition
// ============================================

/**
 * Solo is exclusive: if any track is soloed, only soloed tracks are heard.
 * An explicitly muted track stays silent even when it is soloed, matching
 * every hardware and software mixer.
 */
export function isTrackAudible(track: Track, allTracks: Track[]): boolean {
    if (track.muted) return false;
    const anySoloed = allTracks.some((t) => t.solo);
    return anySoloed ? Boolean(track.solo) : true;
}

/** Final linear gain for a track, accounting for its fader plus solo/mute. */
export function effectiveTrackGain(track: Track, allTracks: Track[]): number {
    return isTrackAudible(track, allTracks) ? track.volume : 0;
}

// ============================================
// Render Plan
// ============================================
//
// What gets scheduled, where, and how loud — computed once and consumed by both
// the live and offline paths. Sharing the *primitives* stops the two from
// drifting on how a note is played; sharing the plan stops them drifting on
// which notes get played at all.

export type RenderClipKind = 'audio' | 'midi';

export interface PlannedClip {
    clipId: string;
    trackId: string;
    kind: RenderClipKind;
    startSeconds: number;
    /** False when the clip is on a muted or non-soloed track. */
    audible: boolean;
}

export interface PlannedTrack {
    trackId: string;
    /** Fader value after solo/mute resolution — 0 means silent. */
    gain: number;
    pan: number;
    audible: boolean;
    /** Effects that will actually be built (bypassed ones are excluded). */
    activeEffects: TrackEffect[];
}

export interface RenderPlan {
    bpm: number;
    beatsPerBar: number;
    /** Musical length in seconds, excluding any export tail. */
    durationSeconds: number;
    tracks: PlannedTrack[];
    clips: PlannedClip[];
}

/** Clips with no sound to make (empty notes, no take) are left out of the plan. */
function plannedClipKind(clip: Clip): RenderClipKind | null {
    if (clip.type === 'audio') {
        return clip.activeTakeId ? 'audio' : null;
    }
    if (clip.type === 'midi' || clip.type === 'drum') {
        return clip.notes?.length ? 'midi' : null;
    }
    return null;
}

export function buildRenderPlan(project: Project): RenderPlan {
    const beatsPerBar = project.timeSignature[0];
    const bpm = project.bpm;

    const tracks: PlannedTrack[] = project.tracks.map((track) => ({
        trackId: track.id,
        gain: effectiveTrackGain(track, project.tracks),
        pan: track.pan,
        audible: isTrackAudible(track, project.tracks),
        activeEffects: (track.effects || []).filter((effect) => effect.active),
    }));

    const trackById = new Map(tracks.map((t) => [t.trackId, t]));

    const clips: PlannedClip[] = [];
    for (const clip of project.clips) {
        const kind = plannedClipKind(clip);
        if (!kind) continue;

        const plannedTrack = trackById.get(clip.trackId);
        if (!plannedTrack) continue; // orphaned clip, no track to play it on

        clips.push({
            clipId: clip.id,
            trackId: clip.trackId,
            kind,
            startSeconds: barsToSeconds(clip.startBar, bpm, beatsPerBar),
            audible: plannedTrack.audible,
        });
    }

    return {
        bpm,
        beatsPerBar,
        durationSeconds: barsToSeconds(projectEndBar(project), bpm, beatsPerBar),
        tracks,
        clips,
    };
}

// ============================================
// Instrument Resolution
// ============================================

/**
 * Fallback instrument when a track carries no explicit preset — chosen from the
 * track's musical role (its color) so a new track still makes a sensible sound.
 */
export function createSynthForTrack(track: Track): SynthType {
    if (track.instrumentPreset) {
        return createSynthFromPreset(track.instrumentPreset);
    }

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

/** Resolution order: clip preset → track preset → track-color fallback. */
export function createSynthForClip(clip: Clip, track: Track): SynthType {
    return clip.instrumentPreset
        ? createSynthFromPreset(clip.instrumentPreset)
        : createSynthForTrack(track);
}

// ============================================
// Effects
// ============================================

/**
 * Build one effect node. Async because a Reverb must generate its impulse
 * response before it passes signal — awaiting it here is what stops the first
 * bars of a reverbed track from rendering dry.
 */
export async function createEffectNode(effect: TrackEffect): Promise<Tone.ToneAudioNode | null> {
    try {
        switch (effect.type) {
            case 'reverb': {
                const reverb = new Tone.Reverb({
                    decay: effect.params.decay ?? 1.5,
                    preDelay: effect.params.preDelay ?? 0.01,
                    wet: effect.params.wet ?? 0.5,
                });
                await reverb.generate();
                return reverb;
            }
            case 'delay':
                return new Tone.FeedbackDelay({
                    delayTime: effect.params.delayTime ?? 0.25,
                    feedback: effect.params.feedback ?? 0.5,
                    wet: effect.params.wet ?? 0.5,
                });
            case 'distortion':
                return new Tone.Distortion({
                    distortion: effect.params.distortion ?? 0.4,
                    wet: effect.params.wet ?? 0.5,
                });
            case 'filter':
                return new Tone.Filter({
                    frequency: effect.params.frequency ?? 1000,
                    type: effect.params.filterType ?? effect.params.type ?? 'lowpass',
                    Q: effect.params.Q ?? 1,
                });
            case 'compression':
                return new Tone.Compressor({
                    threshold: effect.params.threshold ?? -30,
                    ratio: effect.params.ratio ?? 12,
                });
            default:
                return null;
        }
    } catch (error) {
        logger.error('Failed to create effect node', { type: effect.type, error });
        return null;
    }
}

/**
 * Wire `entry → [active effects…] → output` and return the created nodes so the
 * caller can dispose them. Inactive effects are skipped in both paths — an FX
 * bypass has to mean the same thing live and on export.
 */
export async function buildEffectChain(
    effects: TrackEffect[] | undefined,
    entry: Tone.ToneAudioNode,
    output: Tone.ToneAudioNode
): Promise<Tone.ToneAudioNode[]> {
    const active = (effects || []).filter((effect) => effect.active);

    if (active.length === 0) {
        entry.connect(output);
        return [];
    }

    const nodes: Tone.ToneAudioNode[] = [];
    let current: Tone.ToneAudioNode = entry;

    for (const effect of active) {
        const node = await createEffectNode(effect);
        if (node) {
            current.connect(node);
            current = node;
            nodes.push(node);
        }
    }

    current.connect(output);
    return nodes;
}

// ============================================
// Audio Clips
// ============================================

/** Decode a stored take's WAV bytes into a buffer on the *current* Tone context. */
export async function decodeTakeToBuffer(take: AudioTake): Promise<Tone.ToneAudioBuffer> {
    // Copy into a fresh ArrayBuffer: decodeAudioData detaches the buffer it is
    // given, and the take's bytes are reused for peaks and persistence.
    const arrayBuffer = new ArrayBuffer(take.audioData.byteLength);
    new Uint8Array(arrayBuffer).set(take.audioData);

    const audioBuffer = await Tone.getContext().rawContext.decodeAudioData(arrayBuffer);
    return new Tone.ToneAudioBuffer(audioBuffer);
}

/** Portion of a take that actually sounds, after trim handles. */
export function clipPlayDuration(clip: Clip, sourceDuration: number): number {
    const trimStart = clip.trimStart || 0;
    const trimEnd = clip.trimEnd || 0;
    return Math.max(0, sourceDuration - trimStart - trimEnd);
}

/**
 * Schedule one audio clip. Returns the transport-synced Player, or null when
 * there is nothing to play (missing take, fully trimmed away, decode failure).
 */
export async function scheduleAudioClip(
    clip: Clip,
    destination: Tone.ToneAudioNode,
    startSeconds: number
): Promise<Tone.Player | null> {
    if (!clip.activeTakeId) return null;

    const take = getAudioTake(clip.activeTakeId);
    if (!take) {
        logger.warn('AudioTake not found', { clipId: clip.id, takeId: clip.activeTakeId });
        return null;
    }

    try {
        const buffer = await decodeTakeToBuffer(take);
        const player = new Tone.Player(buffer);

        player.connect(destination);
        player.fadeIn = clip.fadeIn || 0;
        player.fadeOut = clip.fadeOut || 0;

        const playDuration = clipPlayDuration(clip, buffer.duration);
        if (playDuration <= 0) {
            player.dispose();
            return null;
        }

        player.sync();
        player.start(startSeconds, clip.trimStart || 0, playDuration);

        return player;
    } catch (error) {
        logger.error('Failed to schedule audio clip', { clipId: clip.id, error });
        return null;
    }
}

// ============================================
// MIDI / Drum Clips
// ============================================

/**
 * Group a clip's notes by absolute start time so monophonic instruments can be
 * given a tiny stagger instead of swallowing simultaneous notes.
 */
function groupNotesByTime(
    clip: Clip,
    startSeconds: number,
    bpm: number
): Map<number, NonNullable<Clip['notes']>> {
    const byTime = new Map<number, NonNullable<Clip['notes']>>();

    for (const note of clip.notes || []) {
        const absoluteTime = startSeconds + beatsToSeconds(note.startBeat, bpm);
        // Quantize the key to 0.1ms so float drift doesn't split a chord.
        const timeKey = Math.round(absoluteTime * 10000) / 10000;

        const existing = byTime.get(timeKey);
        if (existing) {
            existing.push(note);
        } else {
            byTime.set(timeKey, [note]);
        }
    }

    return byTime;
}

/**
 * Schedule one MIDI or drum clip onto the given transport.
 * Returns the synth plus the transport event ids so the caller can tear down.
 */
export async function scheduleMidiClip(
    clip: Clip,
    track: Track,
    destination: Tone.ToneAudioNode,
    startSeconds: number,
    context: SchedulerContext
): Promise<ScheduledMidiClip | null> {
    if (!clip.notes?.length) return null;

    const synth = createSynthForClip(clip, track);
    synth.connect(destination);

    // Samplers load their buffers asynchronously — playing before they are
    // ready is silent, which is why both paths wait here.
    await waitForSynthReady(synth);

    const isPolyphonic = synth instanceof Tone.PolySynth || synth instanceof Tone.Sampler;
    const notesByTime = groupNotesByTime(clip, startSeconds, context.bpm);
    const eventIds: number[] = [];

    for (const [timeKey, notes] of notesByTime) {
        notes.forEach((note, index) => {
            const durationSeconds = beatsToSeconds(note.duration, context.bpm);
            // Monophonic voices get a 1ms stagger so a chord still articulates.
            const scheduledTime = timeKey + (isPolyphonic ? 0 : index * 0.001);
            const velocity = note.velocity / 127;

            const eventId = context.transport.schedule((time) => {
                if (synth instanceof Tone.NoiseSynth) {
                    // NoiseSynth has no pitch — duration and velocity only.
                    synth.triggerAttackRelease(durationSeconds, time, velocity);
                } else {
                    synth.triggerAttackRelease(
                        Tone.Frequency(note.pitch, 'midi').toFrequency(),
                        durationSeconds,
                        time,
                        velocity
                    );
                }
            }, scheduledTime);

            eventIds.push(eventId);
        });
    }

    return { synth, eventIds };
}

// ============================================
// Teardown
// ============================================

/**
 * Release a voice before disposing it. Dropping a sounding synth without a
 * release leaves a hanging note in the graph until GC.
 */
export function releaseSynth(synth: SynthType): void {
    try {
        if (synth instanceof Tone.PolySynth || synth instanceof Tone.Sampler) {
            synth.releaseAll();
        } else {
            synth.triggerRelease();
        }
    } catch (error) {
        logger.warn('Error releasing synth', { error });
    }
}
