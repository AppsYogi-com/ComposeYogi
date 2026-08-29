// ============================================
// ComposeYogi — Keys, Scales & Vibes
// ============================================
//
// One source for what a scale *is*. Before this file the answer was split three
// ways and the three disagreed: `MusicalScale` in types listed nine scales,
// `SCALES` in lib/utils offered thirteen in the Inspector, and `SCALE_INTERVALS`
// inside PianoRoll.tsx knew intervals for the first nine. Picking "Harmonic
// Minor" therefore stored a value the type said could not exist and highlighted
// natural minor instead, silently — and `pentatonic`, the one value only the
// type knew about, had no entry in either list and no translation.
//
// Everything below is keyed by `MusicalScale`, so a scale added to the type
// without intervals, a name, or a place in the picker fails the build.

import type { MusicalKey, MusicalScale, VibeId } from '@/types';

// ============================================
// Notes
// ============================================

/** Chromatic note names, indexed so that `NOTE_NAMES[pitch % 12]` is the name. */
export const NOTE_NAMES = [
    'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B',
] as const satisfies readonly MusicalKey[];

// ============================================
// Scales
// ============================================

/**
 * Semitones above the root, ascending.
 *
 * `Record<MusicalScale, …>` rather than a lookup with a fallback: a missing
 * scale used to mean "highlight natural minor and say nothing", which is the
 * kind of wrong that reads as the app being broken at music rather than at code.
 */
export const SCALE_INTERVALS: Record<MusicalScale, readonly number[]> = {
    major: [0, 2, 4, 5, 7, 9, 11],
    minor: [0, 2, 3, 5, 7, 8, 10],
    harmonicMinor: [0, 2, 3, 5, 7, 8, 11],
    melodicMinor: [0, 2, 3, 5, 7, 9, 11],
    dorian: [0, 2, 3, 5, 7, 9, 10],
    phrygian: [0, 1, 3, 5, 7, 8, 10],
    lydian: [0, 2, 4, 6, 7, 9, 11],
    mixolydian: [0, 2, 4, 5, 7, 9, 10],
    locrian: [0, 1, 3, 5, 6, 8, 10],
    pentatonicMajor: [0, 2, 4, 7, 9],
    pentatonicMinor: [0, 3, 5, 7, 10],
    blues: [0, 3, 5, 6, 7, 10],
    chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
};

/** Order the Inspector's scale picker lists them in — familiar first. */
export const SCALE_IDS = [
    'major', 'minor', 'harmonicMinor', 'melodicMinor',
    'dorian', 'phrygian', 'lydian', 'mixolydian', 'locrian',
    'pentatonicMajor', 'pentatonicMinor', 'blues', 'chromatic',
] as const satisfies readonly MusicalScale[];

/** Pitch classes (0-11) that belong to a key + scale. */
export function scalePitchClasses(key: MusicalKey, scale: MusicalScale): Set<number> {
    const root = NOTE_NAMES.indexOf(key);
    return new Set(SCALE_INTERVALS[scale].map((interval) => (root + interval) % 12));
}

// ============================================
// Vibes
// ============================================

/**
 * A vibe is a key and a scale under a word a beginner already knows.
 *
 * design.md asks the transport for a "vibe-based selector" rather than the
 * thirteen mode names, and the reason is the north star: someone who has never
 * heard of Phrygian still knows what "Dark" means. The Inspector keeps the
 * literal key and scale for anyone who wants them, so this hides the vocabulary
 * without hiding the control — the whole progressive-disclosure idea in one
 * widget.
 *
 * The keys are chosen as much as the scales. A vibe that always landed on C
 * would make every project sound like every other project, and the ones here
 * are where the style actually sits: E for blues and phrygian (guitar), A for
 * the lo-fi minor modes, C for plain major.
 */
export interface Vibe {
    id: VibeId;
    key: MusicalKey;
    scale: MusicalScale;
}

export const VIBES: readonly Vibe[] = [
    { id: 'chill', key: 'A', scale: 'dorian' },          // minor with a natural 6 — melancholy, not gloom
    { id: 'happy', key: 'C', scale: 'major' },
    { id: 'sad', key: 'A', scale: 'minor' },
    { id: 'dark', key: 'E', scale: 'phrygian' },         // the flat 2 is the darkest common mode
    { id: 'dreamy', key: 'F', scale: 'lydian' },         // the sharp 4 is the "wonder" interval
    { id: 'epic', key: 'D', scale: 'harmonicMinor' },    // the augmented 2nd, cinematic and a little exotic
    { id: 'funky', key: 'E', scale: 'mixolydian' },      // flat 7 — dominant-7 territory
    { id: 'bluesy', key: 'E', scale: 'blues' },
    { id: 'playful', key: 'G', scale: 'pentatonicMajor' }, // no half-steps: nothing you play can clash
];

/**
 * The vibe a project is currently sitting on, or null if the user has moved off
 * one in the Inspector.
 *
 * Null is a real answer, not a failure. Falling back to the first vibe would
 * put a label on the transport that the piano roll then contradicts.
 */
export function matchVibe(key: MusicalKey, scale: MusicalScale): Vibe | null {
    return VIBES.find((vibe) => vibe.key === key && vibe.scale === scale) ?? null;
}

export function vibeById(id: VibeId): Vibe | undefined {
    return VIBES.find((vibe) => vibe.id === id);
}
