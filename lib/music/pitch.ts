// ============================================
// ComposeYogi — What a Pitch Is Called, and Where It Sounds
// ============================================
//
// One place that turns a MIDI pitch number into a name and a frequency, because
// there were three and they disagreed — the same disease `scales.ts` was written
// to cure, in a different organ.
//
// **The app called every note an octave too high.** `PianoRoll`'s key column and
// the live keyboard both named a pitch `Math.floor(pitch / 12)`, so MIDI 60
// — middle C, the C every instrument and every other piece of software on earth
// calls C4 — was drawn as "C5". `PianoRoll.noteName`, four hundred lines from
// its own key column, already subtracted the one and got it right, so the note
// under the cursor and the key beside it reported different names.
//
// It was not only cosmetic. The live keyboard offered to go down to a key it
// labelled **C1**, which was MIDI 12 — that is **C0, 16.35 Hz**, an octave below
// the lowest note on a piano and below what a laptop speaker or a pair of
// earbuds can reproduce at all. Someone comparing our C1 against an online
// piano's C1 hears 16 Hz of speaker distortion against a real 32.7 Hz note, and
// concludes the synth is broken. The synth was fine; the label was a lie and the
// range was an octave too low.
//
// Imports nothing but the note names, for the reason every pure module here
// imports nothing: this is the arithmetic, and the arithmetic is what a test can
// reach.

import { NOTE_NAMES } from './scales';

// ============================================
// The range the app plays in
// ============================================
//
// C1–B7. Seven octaves, and the same seven a full-size 88-key piano spends
// almost all of its time in — it adds A0/A#0/B0 below and C8 above, three notes
// and one note that a browser DAW's on-screen keyboard has no room for.
//
// The floor is the important end. Below C1 is C0 at 16.35 Hz, which is under the
// 20 Hz bottom of human hearing and far under anything a laptop reproduces: a
// key that produces cone travel and no pitch. Offering it is offering a broken
// note.

/** C1 — 32.70 Hz, the lowest note the app will play. */
export const LOWEST_PITCH = 24;

/** B7 — 3951.07 Hz. */
export const HIGHEST_PITCH = 107;

/** MIDI 60. Here so the name of the thing appears somewhere in the source. */
export const MIDDLE_C = 60;

/** How many octaves `LOWEST_PITCH`–`HIGHEST_PITCH` spans. */
export const PITCH_OCTAVES = (HIGHEST_PITCH + 1 - LOWEST_PITCH) / 12;

// ============================================
// Naming
// ============================================

/**
 * The octave number in scientific pitch notation, where middle C (60) is C4.
 *
 * The `- 1` is the whole point and is what three places in this app were
 * missing. MIDI 0 is C**-1**, so the octave of a pitch is `floor(pitch / 12) - 1`
 * and never `floor(pitch / 12)`.
 */
export function pitchOctave(pitch: number): number {
    return Math.floor(pitch / 12) - 1;
}

/** `60` → `"C4"`. The one name for a pitch anywhere in the app. */
export function pitchName(pitch: number): string {
    return `${NOTE_NAMES[((pitch % 12) + 12) % 12]}${pitchOctave(pitch)}`;
}

/** The first pitch of a scientific octave: `4` → `60`. */
export function octaveFirstPitch(octave: number): number {
    return (octave + 1) * 12;
}

// ============================================
// Sounding
// ============================================

/**
 * Equal temperament at A4 = 440 Hz — the same arithmetic Tone.js applies when
 * it is handed a MIDI number, restated here so a test can check a claim about
 * what a note *sounds like* without constructing Tone, which vitest cannot do.
 */
export function pitchFrequency(pitch: number): number {
    return 440 * Math.pow(2, (pitch - 69) / 12);
}

/**
 * Whether a pitch is one this app will draw and play.
 *
 * Not a clamp: something outside the range is a bug at the call site, and
 * silently moving it an octave is how a wrong note becomes a mystery.
 */
export function isPlayablePitch(pitch: number): boolean {
    return Number.isInteger(pitch) && pitch >= LOWEST_PITCH && pitch <= HIGHEST_PITCH;
}
