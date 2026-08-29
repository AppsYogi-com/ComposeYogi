// ============================================
// ComposeYogi — Music Theory Tests
// ============================================
//
// Two things are being held down here.
//
// The scale tests exist because the app shipped with three disagreeing answers
// to "what scales are there": the type had nine, the Inspector offered thirteen,
// and the interval table knew nine — a different nine. Choosing Harmonic Minor
// therefore highlighted natural minor and said nothing about it. Nothing threw,
// which is why it survived. Every test below is a way for those lists to be
// caught disagreeing again.
//
// The snap tests are arithmetic, and arithmetic is exactly what a triplet grid
// gets wrong: three notes in the space of two is easy to write as 1/3 of a beat
// and be a hair out over a bar.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
    NOTE_NAMES,
    SCALE_IDS,
    SCALE_INTERVALS,
    SNAP_BEATS,
    SNAP_VALUES,
    STRAIGHT_SNAP_VALUES,
    TRIPLET_SNAP_VALUES,
    VIBES,
    matchVibe,
    scalePitchClasses,
    snapStepBeats,
    snapToGrid,
    vibeById,
} from '@/lib/music';

import type { MusicalScale, SnapValue } from '@/types';

const messages = JSON.parse(
    readFileSync(join(__dirname, '..', 'messages', 'en.json'), 'utf8')
) as { scales: Record<string, string>; vibes: Record<string, string> };

/**
 * Every scale, as values rather than types. A type-level check cannot run at
 * runtime, and this list is what the exhaustiveness tests compare against.
 */
const ALL_SCALES: MusicalScale[] = [
    'major', 'minor', 'harmonicMinor', 'melodicMinor',
    'dorian', 'phrygian', 'lydian', 'mixolydian', 'locrian',
    'pentatonicMajor', 'pentatonicMinor', 'blues', 'chromatic',
];

const ALL_SNAP_VALUES: SnapValue[] = [
    'off', '1', '1/2', '1/4', '1/8', '1/16', '1/32', '1/4T', '1/8T', '1/16T',
];

// ============================================
// Scales
// ============================================

describe('every scale is complete', () => {
    it('covers the whole type — the test list is not stale', () => {
        // Guards the lists below: a scale added to MusicalScale but not to
        // ALL_SCALES would make every test here pass without checking it.
        expect(Object.keys(SCALE_INTERVALS).sort()).toEqual([...ALL_SCALES].sort());
    });

    it('has intervals', () => {
        for (const scale of ALL_SCALES) {
            expect(SCALE_INTERVALS[scale], `${scale} has no intervals`).toBeTruthy();
            expect(SCALE_INTERVALS[scale].length).toBeGreaterThan(0);
        }
    });

    it('has a place in the picker', () => {
        // The original bug in reverse: a scale the type knows about that no
        // picker offers is unreachable, which is what `pentatonic` was.
        const missing = ALL_SCALES.filter((scale) => !(SCALE_IDS as readonly string[]).includes(scale));
        expect(missing, 'add it to SCALE_IDS or it cannot be chosen').toEqual([]);
    });

    it('has an English name', () => {
        // `pentatonic` had none, so choosing it would have rendered the literal
        // key path "scales.pentatonic" into the toolbar.
        const missing = ALL_SCALES.filter((scale) => !messages.scales[scale]);
        expect(missing, 'add it to messages/{en,es}.json under `scales`').toEqual([]);
    });

    it('is a set of ascending semitones inside one octave', () => {
        for (const scale of ALL_SCALES) {
            const intervals = SCALE_INTERVALS[scale];
            expect(intervals[0], `${scale} does not start on its root`).toBe(0);
            expect(Math.max(...intervals), `${scale} leaves the octave`).toBeLessThan(12);
            expect(Math.min(...intervals), `${scale} has a negative interval`).toBeGreaterThanOrEqual(0);

            const ascending = intervals.every((n, i) => i === 0 || n > intervals[i - 1]);
            expect(ascending, `${scale} is not in ascending order`).toBe(true);
            expect(new Set(intervals).size, `${scale} repeats an interval`).toBe(intervals.length);
        }
    });
});

describe('scalePitchClasses', () => {
    it('roots the scale on the chosen key', () => {
        expect([...scalePitchClasses('C', 'major')].sort((a, b) => a - b))
            .toEqual([0, 2, 4, 5, 7, 9, 11]);
        // A minor is C major's relative — same notes, different root.
        expect([...scalePitchClasses('A', 'minor')].sort((a, b) => a - b))
            .toEqual([0, 2, 4, 5, 7, 9, 11]);
    });

    it('wraps past B rather than running off the end', () => {
        const classes = scalePitchClasses('A#', 'major');
        expect([...classes].every((pc) => pc >= 0 && pc < 12)).toBe(true);
        expect(classes.size).toBe(7);
    });

    it('admits every note under chromatic and rejects none', () => {
        expect(scalePitchClasses('F', 'chromatic').size).toBe(12);
    });

    it('names notes so that NOTE_NAMES[pitch % 12] is the note', () => {
        expect(NOTE_NAMES[60 % 12]).toBe('C');   // middle C
        expect(NOTE_NAMES[69 % 12]).toBe('A');   // A440
    });
});

// ============================================
// Vibes
// ============================================

describe('vibes', () => {
    it('resolve to a real key and a real scale', () => {
        for (const vibe of VIBES) {
            expect(NOTE_NAMES, `${vibe.id} has an unknown key`).toContain(vibe.key);
            expect(ALL_SCALES, `${vibe.id} has an unknown scale`).toContain(vibe.scale);
        }
    });

    it('have an English name', () => {
        const missing = VIBES.filter((vibe) => !messages.vibes[vibe.id]);
        expect(missing.map((v) => v.id)).toEqual([]);
    });

    it('never share a key and scale', () => {
        // matchVibe returns the first hit, so two vibes on the same pair would
        // make the transport label whichever one was declared first — the
        // control would silently disagree with the click that set it.
        const pairs = VIBES.map((v) => `${v.key} ${v.scale}`);
        expect(new Set(pairs).size).toBe(VIBES.length);
    });

    it('round-trip through matchVibe', () => {
        for (const vibe of VIBES) {
            expect(matchVibe(vibe.key, vibe.scale)?.id).toBe(vibe.id);
        }
    });

    it('report no match rather than guessing', () => {
        // C locrian is nobody's vibe. Falling back to the first one would put a
        // label on the transport that the piano roll then contradicts.
        expect(matchVibe('C', 'locrian')).toBeNull();
    });

    it('look up by id, and refuse an id that is not one', () => {
        expect(vibeById('chill')?.scale).toBe('dorian');
        // @ts-expect-error — the guard is for values arriving from storage
        expect(vibeById('nonsense')).toBeUndefined();
    });
});

// ============================================
// Snap
// ============================================

describe('snap resolutions', () => {
    it('cover the whole type — the test list is not stale', () => {
        expect(Object.keys(SNAP_BEATS).sort()).toEqual([...ALL_SNAP_VALUES].sort());
    });

    it('are all offered by the picker exactly once', () => {
        expect([...SNAP_VALUES].sort()).toEqual([...ALL_SNAP_VALUES].sort());
        expect(new Set(SNAP_VALUES).size).toBe(SNAP_VALUES.length);
    });

    it('halve at each straight division, with a quarter note worth one beat', () => {
        expect(SNAP_BEATS['1/4']).toBe(1);
        for (let i = 1; i < STRAIGHT_SNAP_VALUES.length; i++) {
            expect(SNAP_BEATS[STRAIGHT_SNAP_VALUES[i]])
                .toBeCloseTo(SNAP_BEATS[STRAIGHT_SNAP_VALUES[i - 1]] / 2, 10);
        }
    });

    it('fit three triplets into the space of two straight notes', () => {
        const pairs = [['1/4T', '1/4'], ['1/8T', '1/8'], ['1/16T', '1/16']] as const;
        for (const [triplet, straight] of pairs) {
            expect(SNAP_BEATS[triplet] * 3, `${triplet} does not fill two ${straight}`)
                .toBeCloseTo(SNAP_BEATS[straight] * 2, 10);
        }
    });

    it('lands three eighth-note triplets exactly on the next beat', () => {
        // The arithmetic a naive 1/3 gets wrong: three of them must reach 1.0
        // exactly, or a triplet figure drifts a little further off every bar.
        expect(SNAP_BEATS['1/8T'] * 3).toBeCloseTo(1, 12);
        expect(SNAP_BEATS['1/16T'] * 6).toBeCloseTo(1, 12);
    });

    it('offers every division in one group or the other', () => {
        const grouped = [...STRAIGHT_SNAP_VALUES, ...TRIPLET_SNAP_VALUES, 'off'];
        expect([...grouped].sort()).toEqual([...ALL_SNAP_VALUES].sort());
    });
});

describe('snapToGrid', () => {
    it('rounds to the nearest division', () => {
        expect(snapToGrid(0.3, '1/4')).toBe(0);
        expect(snapToGrid(0.6, '1/4')).toBe(1);
        expect(snapToGrid(1.3, '1/8')).toBeCloseTo(1.5, 10);
    });

    it('leaves a value alone when snapping is off', () => {
        // The point of the setting: a note nudged deliberately off the grid has
        // to survive being dragged.
        expect(snapToGrid(1.234, 'off')).toBe(1.234);
        expect(snapToGrid(-0.5, 'off')).toBe(-0.5);
    });

    it('puts an off-beat eighth on the triplet grid', () => {
        // 0.5 of a beat is nearer the second eighth-triplet (0.666…) than the
        // first (0.333…) only by a hair — this is the rounding that decides
        // whether a shuffle lands.
        expect(snapToGrid(0.5, '1/8T')).toBeCloseTo(2 / 3, 10);
        expect(snapToGrid(0.3, '1/8T')).toBeCloseTo(1 / 3, 10);
    });

    it('does not drift over a bar of triplets', () => {
        for (let i = 0; i <= 12; i++) {
            const exact = i * SNAP_BEATS['1/8T'];
            expect(snapToGrid(exact + 0.001, '1/8T')).toBeCloseTo(exact, 9);
        }
    });
});

describe('snapStepBeats', () => {
    it('is the snap resolution when snapping is on', () => {
        expect(snapStepBeats('1/16')).toBe(0.25);
        expect(snapStepBeats('1/8T')).toBeCloseTo(1 / 3, 10);
    });

    it('is never zero, so a new note always has a length', () => {
        // Drawing at snap=off used to be the trap: the raw value is 0, and a
        // note of no length is silent and unclickable.
        for (const snap of ALL_SNAP_VALUES) {
            expect(snapStepBeats(snap), `${snap} yields a zero-length note`).toBeGreaterThan(0);
        }
    });
});
