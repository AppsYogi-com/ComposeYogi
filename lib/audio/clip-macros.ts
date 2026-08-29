// ============================================
// ComposeYogi — Clip Macros
// ============================================
//
// "One slider = many DSP changes" (docs/design.md). Six per-clip controls that
// each move several lower-level parameters at once, so a beginner can shape a
// part without knowing what a filter cutoff is.
//
// Everything here is a pure number-to-number mapping. That is deliberate: these
// are musical decisions, and musical decisions that live in pure functions can
// be argued with in a test instead of by ear. lib/audio/scheduler.ts turns the
// results into Tone nodes and note events, and because BOTH the live and the
// offline path go through that one module, a macro sounds the same in the
// export as it does in playback by construction.
//
// Two invariants hold this together:
//
//   1. The default value of every macro is neutral. A clip nobody has touched
//      must build exactly the graph it built before macros existed — same nodes,
//      same notes — or shipping this feature would silently re-mix every project
//      already saved on someone's machine.
//
//   2. Humanize is random-sounding but never random. Real randomness would make
//      an export differ from the playback the user approved, which is the one
//      guarantee the audio engine makes. The jitter is hashed from the note's
//      own identity instead, so it is stable across renders, reloads and
//      machines.

import type { Clip, Note } from '@/types';

// ============================================
// Ranges and neutral values
// ============================================

/**
 * The value at which each macro does nothing at all.
 *
 * Energy and Brightness are bipolar — they cut as well as boost, so their
 * neutral sits at the centre of the slider. Groove, Space, Humanize and
 * Transpose are unipolar: there is no such thing as "less than straight" or
 * "drier than dry", so zero is neutral and the whole slider does something.
 *
 * `addClip` stamps these onto new clips, so the two can never drift apart.
 */
export const MACRO_NEUTRAL = {
    energy: 50,
    groove: 0,
    brightness: 50,
    space: 0,
    humanize: 0,
    transpose: 0,
} as const;

/** Semitones a clip can be shifted in either direction. */
export const TRANSPOSE_RANGE = 24;

export interface ClipMacros {
    energy: number;
    groove: number;
    brightness: number;
    space: number;
    humanize: number;
    transpose: number;
}

/** A clip's macros with every absent value filled in with its neutral. */
export function readClipMacros(clip: Clip): ClipMacros {
    return {
        energy: clip.energy ?? MACRO_NEUTRAL.energy,
        groove: clip.groove ?? MACRO_NEUTRAL.groove,
        brightness: clip.brightness ?? MACRO_NEUTRAL.brightness,
        space: clip.space ?? MACRO_NEUTRAL.space,
        humanize: clip.humanize ?? MACRO_NEUTRAL.humanize,
        transpose: clip.transpose ?? MACRO_NEUTRAL.transpose,
    };
}

/** True when a clip's macros ask for nothing — no extra nodes, no note changes. */
export function isNeutral(macros: ClipMacros): boolean {
    return (
        macros.energy === MACRO_NEUTRAL.energy &&
        macros.groove === MACRO_NEUTRAL.groove &&
        macros.brightness === MACRO_NEUTRAL.brightness &&
        macros.space === MACRO_NEUTRAL.space &&
        macros.humanize === MACRO_NEUTRAL.humanize &&
        macros.transpose === MACRO_NEUTRAL.transpose
    );
}

function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
}

// ============================================
// Energy → how hard the part is played
// ============================================

/**
 * Multiplier applied to every note's velocity: half strength at 0, unchanged at
 * 50, half again as hard at 100.
 *
 * Velocity is not just loudness — most presets open their filter and shorten
 * their attack as it rises — so scaling it makes a part sound played harder
 * rather than merely turned up, which is the difference a gain stage cannot
 * make.
 */
export function energyVelocityScale(energy: number): number {
    return 0.5 + clamp(energy, 0, 100) / 100;
}

// ============================================
// Energy + Brightness → one tone tilt
// ============================================

/**
 * How far Energy leans on the tone control, relative to Brightness.
 *
 * Energy is meant to move several things at once, and playing harder really
 * does open up a sound. Feeding it into the same filter as Brightness — rather
 * than giving it a filter of its own — is what keeps two macros from stacking
 * two filters and colouring the signal twice.
 */
const ENERGY_TONE_WEIGHT = 0.5;

/** Below this the filter would be inaudible, and a node not built is a node that cannot colour the signal. */
const TILT_EPSILON = 0.5;

/** Darkest the lowpass closes to, in Hz, at full cut. */
const TILT_MIN_CUTOFF_HZ = 300;
/** Cutoff that counts as fully open — above the top of human hearing. */
const TILT_OPEN_CUTOFF_HZ = 20000;
/** Corner of the high shelf used to brighten. */
const TILT_SHELF_HZ = 2200;
/** Loudest the high shelf lifts, in dB, at full boost. */
const TILT_MAX_SHELF_DB = 12;

/**
 * Combined tone position from Brightness and Energy, as -50 (dark) … +50 (bright).
 */
export function toneTilt(brightness: number, energy: number): number {
    const fromBrightness = clamp(brightness, 0, 100) - MACRO_NEUTRAL.brightness;
    const fromEnergy = (clamp(energy, 0, 100) - MACRO_NEUTRAL.energy) * ENERGY_TONE_WEIGHT;
    return clamp(fromBrightness + fromEnergy, -50, 50);
}

export interface ToneFilterSpec {
    type: 'lowpass' | 'highshelf';
    frequency: number;
    /** Shelf lift in dB; always 0 for the lowpass. */
    gain: number;
}

/**
 * The filter a tilt asks for, or null when it asks for nothing.
 *
 * Darkening sweeps a lowpass down logarithmically, because pitch is
 * logarithmic and a linear sweep would spend most of its travel in the top
 * octave where nothing much lives. Brightening lifts a high shelf instead — a
 * lowpass cannot add what the source never had.
 */
export function toneFilterSpec(tilt: number): ToneFilterSpec | null {
    if (Math.abs(tilt) < TILT_EPSILON) return null;

    if (tilt < 0) {
        const depth = Math.min(1, -tilt / 50);
        const ratio = TILT_MIN_CUTOFF_HZ / TILT_OPEN_CUTOFF_HZ;
        return {
            type: 'lowpass',
            frequency: TILT_OPEN_CUTOFF_HZ * Math.pow(ratio, depth),
            gain: 0,
        };
    }

    return {
        type: 'highshelf',
        frequency: TILT_SHELF_HZ,
        gain: (Math.min(1, tilt / 50)) * TILT_MAX_SHELF_DB,
    };
}

// ============================================
// Space → ambience
// ============================================

/** Wet level at Space 100. A send mixed past this stops sounding like a room and starts sounding like a mistake. */
const SPACE_MAX_WET = 0.6;
const SPACE_MIN_DECAY_S = 0.6;
const SPACE_MAX_DECAY_S = 4;

export interface SpaceSpec {
    wet: number;
    decay: number;
    preDelay: number;
}

/**
 * Reverb for a clip, or null at neutral.
 *
 * Wet level and decay rise together: a small amount reads as a tight room, a
 * large amount as a hall. Moving only the wet level would just make a short
 * room louder, which sounds like a mixing error rather than a bigger space.
 */
export function spaceSpec(space: number): SpaceSpec | null {
    const amount = clamp(space, 0, 100) / 100;
    if (amount <= 0) return null;

    return {
        wet: amount * SPACE_MAX_WET,
        decay: SPACE_MIN_DECAY_S + amount * (SPACE_MAX_DECAY_S - SPACE_MIN_DECAY_S),
        preDelay: 0.01,
    };
}

// ============================================
// Groove → swing
// ============================================

/** Swing is applied on the sixteenth-note grid, which is what the drum sequencer draws. */
export const SWING_GRID_BEATS = 0.25;

/** How close to the grid a note has to sit before swing claims it. */
const SWING_GRID_TOLERANCE = 0.01;

/**
 * How late an off-beat note is pushed, in beats.
 *
 * Swing delays every other sixteenth and leaves the ones on the beat alone —
 * that uneven long-short pairing is the whole effect. At full groove the
 * off-beat lands a third of a sixteenth late, which is the triplet feel a
 * shuffle is built on; anything beyond that stops sounding swung and starts
 * sounding wrong.
 *
 * Notes that are not on the grid are left where the player put them. Somebody
 * who dragged a note off the grid on purpose does not want a macro tidying it
 * to somewhere else.
 */
/**
 * The swing a clip actually plays with: the project's, plus its own Groove.
 *
 * Additive, and clamped to the same 0-100 the macro already spans. The
 * alternative — a clip's Groove *overriding* the project's — reads better on
 * paper but cannot work with the field that shipped: Groove's neutral is 0, so
 * "override" would make every untouched clip on a swung project snap back to
 * straight, and the global control would do nothing until you visited every
 * clip. Additive means the project sets a floor and a clip can push past it,
 * which is how the two controls are described in the UI.
 *
 * The cost, stated plainly: a clip cannot be *straighter* than the project.
 * Making that possible needs a bipolar Groove or a per-clip opt-out, and either
 * one changes the meaning of a value already saved on people's machines.
 */
export function effectiveGroove(projectSwing: number | undefined, clipGroove: number): number {
    return clamp(clamp(projectSwing ?? 0, 0, 100) + clamp(clipGroove, 0, 100), 0, 100);
}

export function swingDelayBeats(groove: number, startBeat: number): number {
    const amount = clamp(groove, 0, 100) / 100;
    if (amount <= 0) return 0;

    const step = startBeat / SWING_GRID_BEATS;
    const nearest = Math.round(step);
    if (Math.abs(step - nearest) > SWING_GRID_TOLERANCE) return 0;
    if (nearest % 2 === 0) return 0;

    return amount * (SWING_GRID_BEATS / 3);
}

// ============================================
// Humanize → jitter that is not random
// ============================================

/** Widest timing spread at full humanize: ±0.03 beats, or ±15ms at 120bpm. */
const HUMANIZE_MAX_TIMING_BEATS = 0.03;
/** Widest velocity spread at full humanize, out of 127. */
const HUMANIZE_MAX_VELOCITY = 20;

/**
 * A stable number in [0, 1) derived from a string — FNV-1a over the full
 * 32-bit word.
 *
 * The property that matters is that near-identical seeds land far apart:
 * consecutive notes differ in one or two characters, and a hash that carried
 * that similarity through would turn the jitter into a ramp — a drummer
 * drifting steadily late rather than one playing loosely.
 *
 * Using the whole word rather than its low bits is what buys that. FNV's weak
 * avalanche is a low-bit problem, so a mask would need a finalizer; a divide
 * by 2^32 does not. Measured on real seed shapes (sequential steps, chords at
 * one beat, uuid note ids) this shows no autocorrelation worth a mixing step.
 */
export function hashUnitInterval(seed: string): number {
    let h = 2166136261;
    for (let i = 0; i < seed.length; i++) {
        h ^= seed.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return (h >>> 0) / 4294967296;
}

/** The same hash mapped to [-1, 1). */
function hashSigned(seed: string): number {
    return hashUnitInterval(seed) * 2 - 1;
}

export interface HumanizeOffset {
    /** Beats to shift the note by; may be negative. */
    timingBeats: number;
    /** Velocity to add, in MIDI units; may be negative. */
    velocity: number;
}

/**
 * Per-note timing and velocity wobble.
 *
 * Seeded from the note itself rather than a random source, so the same clip
 * humanizes identically every time it is scheduled. Without that an export
 * would be a different performance from the playback that was approved — and
 * two exports of the same project would differ from each other.
 *
 * Timing and velocity use separate seeds; sharing one would tie "late" to
 * "quiet" on every note, which is a pattern rather than a performance.
 */
export function humanizeOffset(humanize: number, seed: string): HumanizeOffset {
    const amount = clamp(humanize, 0, 100) / 100;
    if (amount <= 0) return { timingBeats: 0, velocity: 0 };

    return {
        timingBeats: hashSigned(`${seed}:time`) * amount * HUMANIZE_MAX_TIMING_BEATS,
        velocity: hashSigned(`${seed}:vel`) * amount * HUMANIZE_MAX_VELOCITY,
    };
}

/** Identity a note's jitter is derived from — stable across reloads and machines. */
export function humanizeSeed(clipId: string, note: Note, index: number): string {
    return `${clipId}:${note.id || index}:${note.pitch}:${note.startBeat}`;
}

// ============================================
// Transpose
// ============================================

/**
 * A note's pitch after transposition, or null when it falls off the keyboard.
 *
 * Out-of-range notes are dropped rather than clamped. Clamping would hold a
 * note at the edge of the range while the rest of the part moved, turning a
 * transposition into a wrong note — audibly broken in a way silence is not.
 */
export function transposedPitch(pitch: number, transpose: number): number | null {
    const shifted = pitch + transpose;
    if (shifted < 0 || shifted > 127) return null;
    return shifted;
}

// ============================================
// Velocity
// ============================================

/**
 * Final velocity for a note once Energy has scaled it and Humanize has nudged
 * it. Floored at 1 rather than 0: a velocity-0 note is a note-off in MIDI, and
 * a part turned all the way down should still be a part, only quiet.
 */
export function resolveVelocity(
    velocity: number,
    energyScale: number,
    humanizeVelocity: number
): number {
    return clamp(Math.round(velocity * energyScale + humanizeVelocity), 1, 127);
}
