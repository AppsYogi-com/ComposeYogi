// ============================================
// ComposeYogi — Count-In
// ============================================

import { describe, it, expect } from 'vitest';

import { countInProgress } from '@/lib/audio/count-in';

// Two bars of 4/4 at 120bpm: 8 beats, half a second each, four seconds total.
const BPM = 120;
const TOTAL = 8;
const BEAT_MS = 500;
const ENDS_AT = 10_000;
const at = (msBeforeEnd: number) => ENDS_AT - msBeforeEnd;

describe('the count-in reads down to one, then stops', () => {
    it('shows every beat of the count-in and never more', () => {
        expect(countInProgress(at(TOTAL * BEAT_MS), ENDS_AT, TOTAL, BPM).beatsRemaining).toBe(8);
    });

    it('holds each number for its whole beat', () => {
        // Rounding up is what makes the last beat read "1" for the whole of it
        // rather than flicking to 0 the moment it starts.
        expect(countInProgress(at(BEAT_MS), ENDS_AT, TOTAL, BPM).beatsRemaining).toBe(1);
        expect(countInProgress(at(BEAT_MS - 1), ENDS_AT, TOTAL, BPM).beatsRemaining).toBe(1);
        expect(countInProgress(at(1), ENDS_AT, TOTAL, BPM).beatsRemaining).toBe(1);
    });

    it('reaches zero exactly when recording starts', () => {
        expect(countInProgress(ENDS_AT, ENDS_AT, TOTAL, BPM).beatsRemaining).toBe(0);
        expect(countInProgress(ENDS_AT, ENDS_AT, TOTAL, BPM).progress).toBe(1);
    });

    it('counts down one beat at a time', () => {
        const seen = Array.from({ length: TOTAL }, (_, i) =>
            countInProgress(at((TOTAL - i) * BEAT_MS - 1), ENDS_AT, TOTAL, BPM).beatsRemaining
        );
        expect(seen).toEqual([8, 7, 6, 5, 4, 3, 2, 1]);
    });
});

describe('the pips track the beats', () => {
    it('lights one more pip per beat', () => {
        const lit = Array.from({ length: TOTAL }, (_, i) =>
            countInProgress(at((TOTAL - i) * BEAT_MS - 1), ENDS_AT, TOTAL, BPM).beatsElapsed
        );
        expect(lit).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    });

    it('never lights more pips than there are beats', () => {
        expect(countInProgress(ENDS_AT + 5_000, ENDS_AT, TOTAL, BPM).beatsElapsed).toBe(TOTAL);
    });
});

describe('a clock read outside the count-in still reads', () => {
    it('clamps a frame that arrives before the count-in began', () => {
        // The store is written and the first frame drawn in the same tick, so
        // this is a rounding accident rather than a real state — but a "9" on a
        // count-in of 8 would be visible, and a ninth pip would not exist.
        const early = countInProgress(at(TOTAL * BEAT_MS + 400), ENDS_AT, TOTAL, BPM);
        expect(early.beatsRemaining).toBe(TOTAL);
        expect(early.progress).toBe(0);
    });

    it('clamps a frame that arrives after recording started', () => {
        const late = countInProgress(ENDS_AT + 400, ENDS_AT, TOTAL, BPM);
        expect(late.beatsRemaining).toBe(0);
        expect(late.progress).toBe(1);
    });
});

describe('degenerate input produces a finished count-in, not NaN', () => {
    it('survives a count-in of no beats', () => {
        expect(countInProgress(0, 1_000, 0, BPM)).toEqual({
            beatsRemaining: 0,
            beatsElapsed: 0,
            progress: 1,
        });
    });

    it('survives a tempo that is not one', () => {
        // Zero needs no guard — 60/0 is Infinity, so the beats left divide down
        // to nothing on their own. A negative tempo is the case that bites: it
        // makes seconds-per-beat negative, and the countdown then runs *past*
        // zero into -1, -2, with more pips lit than the count-in has beats.
        for (const bpm of [0, -120]) {
            const result = countInProgress(0, 1_000, TOTAL, bpm);
            expect(result.beatsRemaining, `bpm ${bpm}`).toBe(0);
            expect(result.beatsElapsed, `bpm ${bpm}`).toBeLessThanOrEqual(TOTAL);
            expect(Number.isFinite(result.progress), `bpm ${bpm}`).toBe(true);
        }
    });
});

describe('the countdown follows the tempo, not the bar count', () => {
    it('runs twice as long at half the tempo', () => {
        // 60bpm: one second a beat, so one beat before the end is 1000ms out.
        expect(countInProgress(ENDS_AT - 999, ENDS_AT, TOTAL, 60).beatsRemaining).toBe(1);
        expect(countInProgress(ENDS_AT - 1_001, ENDS_AT, TOTAL, 60).beatsRemaining).toBe(2);
    });

    it('counts the beats a 3/4 count-in actually has', () => {
        // Two bars of 3/4 is six beats — the pips have to agree with the metre,
        // not assume four.
        const six = countInProgress(at(6 * BEAT_MS), ENDS_AT, 6, BPM);
        expect(six.beatsRemaining).toBe(6);
        expect(six.beatsElapsed).toBe(0);
    });
});
