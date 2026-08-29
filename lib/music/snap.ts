// ============================================
// ComposeYogi — Grid Snapping
// ============================================
//
// The grid you edit against, shared by the arrangement timeline and the piano
// roll. Both used to carry their own idea of it: the piano roll had six straight
// divisions in a local `useState`, and the timeline hard-coded one beat with no
// control at all. Neither could do triplets, which is most of a shuffle, a
// swung hi-hat, or a 6/8 feel — whole genres you simply could not enter.
//
// Everything here is in beats, where a beat is a quarter note. Bars are a
// timeline concern and the conversion happens there, because a bar is only four
// beats in 4/4 and this module has no opinion about time signatures.

import type { SnapValue } from '@/types';

/** A triplet fits three notes where two would go. */
const TRIPLET = 2 / 3;

/**
 * Snap resolutions in beats. `off` is 0, meaning "do not quantise" — see
 * `snapToGrid`, which treats it as the identity rather than dividing by zero.
 */
export const SNAP_BEATS: Record<SnapValue, number> = {
    'off': 0,
    '1': 4,             // whole note
    '1/2': 2,
    '1/4': 1,           // one beat
    '1/8': 0.5,
    '1/16': 0.25,
    '1/32': 0.125,
    '1/4T': 1 * TRIPLET,
    '1/8T': 0.5 * TRIPLET,
    '1/16T': 0.25 * TRIPLET,
};

/** Straight divisions, coarse to fine — the order both pickers list them in. */
export const STRAIGHT_SNAP_VALUES = [
    '1', '1/2', '1/4', '1/8', '1/16', '1/32',
] as const satisfies readonly SnapValue[];

/** Triplet divisions, listed as their own group so the picker stays scannable. */
export const TRIPLET_SNAP_VALUES = [
    '1/4T', '1/8T', '1/16T',
] as const satisfies readonly SnapValue[];

/** Every value, in picker order. `off` leads: it is the escape hatch. */
export const SNAP_VALUES = [
    'off', ...STRAIGHT_SNAP_VALUES, ...TRIPLET_SNAP_VALUES,
] as const satisfies readonly SnapValue[];

/**
 * Round a musical position onto the grid.
 *
 * With snapping off the value is returned untouched, which is the point of the
 * setting: a note nudged deliberately off the grid must survive being dragged.
 */
export function snapToGrid(valueInBeats: number, snap: SnapValue): number {
    const step = SNAP_BEATS[snap];
    if (step <= 0) return valueInBeats;
    return Math.round(valueInBeats / step) * step;
}

/**
 * The smallest musically meaningful step at this resolution, in beats.
 *
 * Callers that need a minimum length (a freshly drawn note, the shortest a clip
 * may be resized to) cannot use 0, so snapping off falls back to the finest
 * straight division rather than to nothing.
 */
export function snapStepBeats(snap: SnapValue): number {
    const step = SNAP_BEATS[snap];
    return step > 0 ? step : SNAP_BEATS['1/32'];
}
