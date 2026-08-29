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
import {
    energyVelocityScale,
    humanizeOffset,
    humanizeSeed,
    isNeutral,
    readClipMacros,
    resolveVelocity,
    spaceSpec,
    swingDelayBeats,
    toneFilterSpec,
    toneTilt,
    transposedPitch,
} from './clip-macros';
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
    /** Per-clip macro nodes, for the caller to dispose alongside the synth. */
    macroNodes: Tone.ToneAudioNode[];
}

export interface ScheduledAudioClip {
    player: Tone.Player | null;
    /** Per-clip macro nodes, for the caller to dispose alongside the player. */
    macroNodes: Tone.ToneAudioNode[];
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
// Clip Macros — per-clip DSP
// ============================================
//
// The track chain is shared by everything on the track, so a macro that
// belongs to one clip cannot live there: two clips on the same track have to
// be able to sound different. These nodes sit between the clip's own source
// and the track entry.
//
// A clip whose macros are all neutral gets no nodes at all and connects
// straight to the track, exactly as it did before macros existed. That is not
// only an optimisation — every clip saved before this feature shipped holds
// the neutral values, and they must keep sounding the way their author left
// them.

/** Where a clip's source connects, plus whatever was created to get it there. */
export interface ClipMacroChain {
    input: Tone.ToneAudioNode;
    nodes: Tone.ToneAudioNode[];
}

/**
 * Wire `[tone filter] → [reverb] → destination` for one clip's macros.
 *
 * Async for the same reason the track effect chain is: a Reverb has to
 * generate its impulse response before it passes signal, and not waiting is
 * what makes the first bars render dry.
 */
export async function buildClipMacroChain(
    clip: Clip,
    destination: Tone.ToneAudioNode
): Promise<ClipMacroChain> {
    const macros = readClipMacros(clip);
    if (isNeutral(macros)) return { input: destination, nodes: [] };

    const nodes: Tone.ToneAudioNode[] = [];

    const filter = toneFilterSpec(toneTilt(macros.brightness, macros.energy));
    if (filter) {
        nodes.push(new Tone.Filter({
            type: filter.type,
            frequency: filter.frequency,
            gain: filter.gain,
        }));
    }

    const space = spaceSpec(macros.space);
    if (space) {
        const reverb = new Tone.Reverb({
            decay: space.decay,
            preDelay: space.preDelay,
            wet: space.wet,
        });
        await reverb.generate();
        nodes.push(reverb);
    }

    if (nodes.length === 0) return { input: destination, nodes: [] };

    for (let i = 0; i < nodes.length - 1; i++) {
        nodes[i].connect(nodes[i + 1]);
    }
    nodes[nodes.length - 1].connect(destination);

    return { input: nodes[0], nodes };
}

/** Dispose a macro chain's nodes. Safe on the neutral (empty) chain. */
export function disposeMacroNodes(nodes: Tone.ToneAudioNode[]): void {
    for (const node of nodes) {
        try {
            node.dispose();
        } catch (error) {
            logger.warn('Error disposing clip macro node', { error });
        }
    }
}

// ============================================
// Note Planning — macros applied to notes
// ============================================

/** One note, fully resolved: nothing left to decide at trigger time. */
export interface PlannedNote {
    pitch: number;
    /** Absolute transport time in seconds. */
    timeSeconds: number;
    durationSeconds: number;
    /** Normalised 0–1, ready for `triggerAttackRelease`. */
    velocity: number;
}

/**
 * Turn a clip's notes into the events that will actually be played, with
 * Transpose, Groove, Humanize and Energy already folded in.
 *
 * Kept separate from the scheduling itself so the musical result can be
 * asserted in a test without an audio context — and so the live and offline
 * paths cannot possibly compute it differently, because neither computes it.
 *
 * Sorted by time: the monophonic stagger below numbers notes within a chord,
 * and jitter can reorder them, so the order has to be decided here rather than
 * inherited from however the array happened to be built.
 */
export function planClipNotes(clip: Clip, startSeconds: number, bpm: number): PlannedNote[] {
    if (!clip.notes?.length) return [];

    const macros = readClipMacros(clip);
    const energyScale = energyVelocityScale(macros.energy);
    const planned: PlannedNote[] = [];

    clip.notes.forEach((note, index) => {
        const pitch = transposedPitch(note.pitch, macros.transpose);
        if (pitch === null) return; // transposed off the keyboard

        const jitter = humanizeOffset(macros.humanize, humanizeSeed(clip.id, note, index));
        const beat =
            note.startBeat + swingDelayBeats(macros.groove, note.startBeat) + jitter.timingBeats;

        planned.push({
            pitch,
            // Humanize can pull a note earlier than the clip starts; the
            // transport has no negative time to schedule it at.
            timeSeconds: Math.max(0, startSeconds + beatsToSeconds(beat, bpm)),
            durationSeconds: beatsToSeconds(note.duration, bpm),
            velocity: resolveVelocity(note.velocity, energyScale, jitter.velocity) / 127,
        });
    });

    return planned.sort((a, b) => a.timeSeconds - b.timeSeconds);
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

const NOTHING_SCHEDULED: ScheduledAudioClip = { player: null, macroNodes: [] };

/**
 * Schedule one audio clip through its macro chain.
 *
 * Only the DSP macros reach a recording: Transpose, Groove and Humanize are
 * note-level ideas, and there are no notes here to move. Making them act on
 * audio means time-stretching and pitch-shifting a buffer, which is its own
 * piece of work (Sprint 8.7.4) rather than a variation on this one.
 *
 * Returns null for the player when there is nothing to play — a missing take,
 * a clip trimmed away to nothing, a decode failure.
 */
export async function scheduleAudioClip(
    clip: Clip,
    destination: Tone.ToneAudioNode,
    startSeconds: number
): Promise<ScheduledAudioClip> {
    if (!clip.activeTakeId) return NOTHING_SCHEDULED;

    const take = getAudioTake(clip.activeTakeId);
    if (!take) {
        logger.warn('AudioTake not found', { clipId: clip.id, takeId: clip.activeTakeId });
        return NOTHING_SCHEDULED;
    }

    const chain = await buildClipMacroChain(clip, destination);

    try {
        const buffer = await decodeTakeToBuffer(take);
        const player = new Tone.Player(buffer);

        player.connect(chain.input);
        player.fadeIn = clip.fadeIn || 0;
        player.fadeOut = clip.fadeOut || 0;

        const playDuration = clipPlayDuration(clip, buffer.duration);
        if (playDuration <= 0) {
            player.dispose();
            disposeMacroNodes(chain.nodes);
            return NOTHING_SCHEDULED;
        }

        player.sync();
        player.start(startSeconds, clip.trimStart || 0, playDuration);

        return { player, macroNodes: chain.nodes };
    } catch (error) {
        logger.error('Failed to schedule audio clip', { clipId: clip.id, error });
        disposeMacroNodes(chain.nodes);
        return NOTHING_SCHEDULED;
    }
}

// ============================================
// MIDI / Drum Clips
// ============================================

/**
 * Group planned notes by start time so monophonic instruments can be given a
 * tiny stagger instead of swallowing simultaneous notes.
 */
function groupNotesByTime(notes: PlannedNote[]): Map<number, PlannedNote[]> {
    const byTime = new Map<number, PlannedNote[]>();

    for (const note of notes) {
        // Quantize the key to 0.1ms so float drift doesn't split a chord.
        const timeKey = Math.round(note.timeSeconds * 10000) / 10000;

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
 *
 * The notes have already been resolved by `planClipNotes`, so nothing musical
 * is decided here — this walks a finished list and books it. Returns the synth,
 * the transport event ids and the macro nodes so the caller can tear all three
 * down together.
 */
export async function scheduleMidiClip(
    clip: Clip,
    track: Track,
    destination: Tone.ToneAudioNode,
    startSeconds: number,
    context: SchedulerContext
): Promise<ScheduledMidiClip | null> {
    if (!clip.notes?.length) return null;

    const planned = planClipNotes(clip, startSeconds, context.bpm);
    if (planned.length === 0) return null; // e.g. transposed clean off the keyboard

    const chain = await buildClipMacroChain(clip, destination);
    const synth = createSynthForClip(clip, track);
    synth.connect(chain.input);

    // Samplers load their buffers asynchronously — playing before they are
    // ready is silent, which is why both paths wait here.
    await waitForSynthReady(synth);

    const isPolyphonic = synth instanceof Tone.PolySynth || synth instanceof Tone.Sampler;
    const eventIds: number[] = [];

    for (const [timeKey, notes] of groupNotesByTime(planned)) {
        notes.forEach((note, index) => {
            // Monophonic voices get a 1ms stagger so a chord still articulates.
            const scheduledTime = timeKey + (isPolyphonic ? 0 : index * 0.001);

            const eventId = context.transport.schedule((time) => {
                if (synth instanceof Tone.NoiseSynth) {
                    // NoiseSynth has no pitch — duration and velocity only.
                    synth.triggerAttackRelease(note.durationSeconds, time, note.velocity);
                } else {
                    synth.triggerAttackRelease(
                        Tone.Frequency(note.pitch, 'midi').toFrequency(),
                        note.durationSeconds,
                        time,
                        note.velocity
                    );
                }
            }, scheduledTime);

            eventIds.push(eventId);
        });
    }

    return { synth, eventIds, macroNodes: chain.nodes };
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
