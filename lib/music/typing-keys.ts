// ============================================
// ComposeYogi — Musical Typing Layout
// ============================================
//
// The computer keyboard as a piano: which key is which note, and how far the
// two rows can be shifted before they leave the range the piano roll draws.
//
// It imports only `pitch.ts`, which is arithmetic and note names — the same
// reason `count-in.ts` and `instrument-spec.ts` import nothing. Everything
// downstream of a keypress needs Tone or a DOM listener, neither of which
// exists under vitest, so this is the only part of live playing a unit test can
// reach. The arithmetic that decides *which note sounds* lives here rather than
// in the event handler.
//
// The layout is the two-row one every tracker and Ableton use, and it is two
// rows because one is not an octave: the home row alone gives seven white keys
// and five black, and the top C that closes an octave has nowhere to go.

import { octaveFirstPitch } from './pitch';

/** Semitones above the row's C, by the key that plays them. */
type Row = Record<string, number>;

/**
 * The lower row — `z` is C, and `,` is the C an octave above it.
 *
 * The black keys sit on the row above their white neighbours (`s` between `z`
 * and `x`), which is what makes the layout readable as a keyboard rather than
 * as a list: the gap where `f` would be is the gap between E and F.
 */
const LOWER_ROW: Row = {
    z: 0, s: 1, x: 2, d: 3, c: 4, v: 5, g: 6, b: 7, h: 8, n: 9, j: 10, m: 11, ',': 12,
};

/**
 * The upper row, an octave above — `q` is C, `i` is the C above it.
 *
 * `q` therefore plays the same note as `,`. That overlap is deliberate and is
 * how the layout is drawn everywhere else: each row is a complete C-to-C
 * octave, and the seam between them is a note you can reach with either hand.
 */
const UPPER_ROW: Row = {
    q: 12, 2: 13, w: 14, 3: 15, e: 16, r: 17, 5: 18, t: 19, 6: 20, y: 21, 7: 22, u: 23, i: 24,
};

/** Every typing key, in the order a keyboard draws them (low note to high). */
export const TYPING_KEYS: readonly string[] = [
    ...Object.entries(LOWER_ROW).sort((a, b) => a[1] - b[1]).map(([key]) => key),
    ...Object.entries(UPPER_ROW).sort((a, b) => a[1] - b[1]).map(([key]) => key),
];

const OFFSETS: Row = { ...LOWER_ROW, ...UPPER_ROW };

/** Semitones from the low C to the high one. Two octaves, both ends inclusive. */
export const TYPING_SPAN_SEMITONES = 24;

/**
 * The octaves the rows may be shifted between, in scientific pitch notation —
 * so `3` means the C3 an online piano means, at 130.81 Hz.
 *
 * Neither end is arbitrary. The floor is `LOWEST_PITCH`: below C1 is C0 at
 * 16.35 Hz, under the bottom of human hearing and far under what a laptop can
 * reproduce, and it used to be offered — labelled "C1", which is how a working
 * synth got called pathetic. The ceiling is what the drawn keyboard holds. The
 * board is a fixed C1–C7 and does not scroll, because a keyboard that moves
 * when you transpose is what made three versions of this feel broken — so the
 * board is sized to hold the highest window rather than the window being cut to
 * fit the board. That was tried, at 1 to 4, and it quietly cost the top octave. A base above that would put
 * letters on keys that are not on the screen, which is a silent failure of
 * exactly the kind this codebase keeps finding: the note is in the clip, it
 * sounds on playback, and it is nowhere to be seen.
 */
export const TYPING_OCTAVE_MIN = 1;
export const TYPING_OCTAVE_MAX = 5;

/**
 * Where the rows start unshifted.
 *
 * 3 puts the lower row at C3–B3 and the upper at C4–C5, so **middle C is the
 * seam** — the note `,` and `q` share, under both hands. A bassline is one shift
 * down and a lead is one up.
 */
export const TYPING_OCTAVE_DEFAULT = 3;

/**
 * The first pitch of a typing octave — `3` → MIDI 48, which is C3 at 130.81 Hz.
 *
 * It used to be `octave * 12`, matching the piano roll's key column, and the
 * comment here defended that: a typed C4 must land on the key the editor calls
 * C4. The premise was right and the shared answer was wrong — the key column
 * was an octave out, so both halves of the app agreed with each other and
 * disagreed with every instrument, every tuner and every other DAW. Both now go
 * through `octaveFirstPitch`.
 */
export function octaveBasePitch(octave: number): number {
    return octaveFirstPitch(clampTypingOctave(octave));
}

/** Hold the octave inside the range the piano roll can draw. */
export function clampTypingOctave(octave: number): number {
    if (!Number.isFinite(octave)) return TYPING_OCTAVE_DEFAULT;
    return Math.min(TYPING_OCTAVE_MAX, Math.max(TYPING_OCTAVE_MIN, Math.round(octave)));
}

/**
 * The MIDI pitch a key plays at a given octave, or null if it plays nothing.
 *
 * Case-folded, because `event.key` is uppercase whenever shift is down and a
 * shifted `z` is still the same physical key. Modifier combinations are the
 * caller's problem — a `mod+z` must reach undo, not play a C.
 */
export function pitchForKey(key: string, octave: number): number | null {
    const offset = OFFSETS[key.toLowerCase()];
    if (offset === undefined) return null;
    return octaveBasePitch(octave) + offset;
}

/** Whether a key plays a note at all. Independent of octave. */
export function isTypingKey(key: string): boolean {
    return OFFSETS[key.toLowerCase()] !== undefined;
}

/** The key that plays a pitch at this octave, or null if none does. */
export function keyForPitch(pitch: number, octave: number): string | null {
    const offset = pitch - octaveBasePitch(octave);
    if (offset < 0 || offset > TYPING_SPAN_SEMITONES) return null;

    // The lower row wins the seam: `,` and `q` are the same note, and the hand
    // already on the lower row is the one that got there.
    for (const [key, value] of Object.entries(LOWER_ROW)) if (value === offset) return key;
    for (const [key, value] of Object.entries(UPPER_ROW)) if (value === offset) return key;
    return null;
}

/**
 * Every key that plays a pitch, low row first.
 *
 * Almost always one. The exception is the seam — `,` and `q` are the same note
 * — and it is the whole reason this exists beside `keyForPitch`: the drawn
 * keyboard prints what plays each key, and printing only `,` there says the
 * upper row starts an octave higher than it does. One key with two letters on
 * it is the honest drawing, and it is also the only place a player can *see*
 * that the two rows overlap.
 */
export function keysForPitch(pitch: number, octave: number): string[] {
    const offset = pitch - octaveBasePitch(octave);
    if (offset < 0 || offset > TYPING_SPAN_SEMITONES) return [];

    const found: string[] = [];
    for (const [key, value] of Object.entries(LOWER_ROW)) if (value === offset) found.push(key);
    for (const [key, value] of Object.entries(UPPER_ROW)) if (value === offset) found.push(key);
    return found;
}

const BLACK_PITCH_CLASSES = new Set([1, 3, 6, 8, 10]);

/** Whether a pitch is a black key — what the on-screen keyboard is drawn from. */
export function isBlackKey(pitch: number): boolean {
    return BLACK_PITCH_CLASSES.has(((pitch % 12) + 12) % 12);
}

/**
 * Every key of the typing keyboard at one octave, low to high.
 *
 * The seam note appears once, from the lower row, so the strip draws 25 keys
 * rather than 26 with two of them lit by the same note.
 */
export function typingKeyboard(octave: number): { pitch: number; key: string; black: boolean }[] {
    const base = octaveBasePitch(octave);
    const keys: { pitch: number; key: string; black: boolean }[] = [];

    for (let offset = 0; offset <= TYPING_SPAN_SEMITONES; offset++) {
        const pitch = base + offset;
        const key = keyForPitch(pitch, octave);
        if (key) keys.push({ pitch, key, black: isBlackKey(pitch) });
    }

    return keys;
}
