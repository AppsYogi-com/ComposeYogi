// ============================================
// ComposeYogi — Stretch to BPM Tests
// ============================================
//
// The arithmetic is four lines long, which is exactly why it is worth pinning:
// every one of those lines is a place where a reciprocal can be inverted and
// the result still looks plausible. A loop played at 0.75x instead of 1.33x is
// in tempo with nothing, but it is in tempo with nothing *smoothly*, and the
// only thing that catches it is a test that knows what a bar is.

import { describe, expect, it } from 'vitest';

import {
    MAX_SOURCE_BPM,
    MIN_SOURCE_BPM,
    MAX_STRETCH_RATE,
    MIN_STRETCH_RATE,
    clampSourceBpm,
    inferSourceBpm,
    lengthBarsAt,
    resolveSourceBpm,
    semitoneShift,
    stretchRate,
} from '@/lib/audio/stretch';

import { makeClip } from './fixtures';

/** One bar of 4/4 at 90 BPM, to the millisecond: 4 beats x 60/90. */
const BAR_AT_90 = 8 / 3;
const BAR_AT_120 = 2;

describe('inferSourceBpm', () => {
    it('recovers the tempo a clip was created at', () => {
        // Every audio clip in the app gets lengthBars from its duration at the
        // project tempo of that moment, so this inverts a real relationship
        // rather than guessing: 2.667s of audio called one bar is 90 BPM.
        expect(inferSourceBpm(1, BAR_AT_90, 4)).toBeCloseTo(90, 6);
        expect(inferSourceBpm(4, BAR_AT_120 * 4, 4)).toBeCloseTo(120, 6);
    });

    it('follows the time signature', () => {
        // A "bar" is only four beats in 4/4. Reading beatsPerBar as a constant
        // would put every clip in a 3/4 or 7/8 project at the wrong tempo.
        expect(inferSourceBpm(1, 2, 3)).toBeCloseTo(90, 6);
        expect(inferSourceBpm(1, 2, 4)).toBeCloseTo(120, 6);
    });

    it('returns null rather than a plausible-looking zero', () => {
        // A clip still loading has no duration, and the caller has to be able
        // to tell "I do not know" from "the answer is nothing".
        expect(inferSourceBpm(1, 0, 4)).toBeNull();
        expect(inferSourceBpm(0, 4, 4)).toBeNull();
        expect(inferSourceBpm(1, 4, 0)).toBeNull();
        expect(inferSourceBpm(1, Number.NaN, 4)).toBeNull();
    });

    it('clamps an absurd inference into the believable range', () => {
        // A 20ms blip called four bars implies thousands of BPM. Clamping keeps
        // the derived rate finite; the editor lets the user correct it.
        expect(inferSourceBpm(4, 0.02, 4)).toBe(MAX_SOURCE_BPM);
        expect(inferSourceBpm(0.25, 600, 4)).toBe(MIN_SOURCE_BPM);
    });
});

describe('clampSourceBpm', () => {
    it('holds the range the project tempo itself uses', () => {
        expect(clampSourceBpm(500)).toBe(MAX_SOURCE_BPM);
        expect(clampSourceBpm(1)).toBe(MIN_SOURCE_BPM);
        expect(clampSourceBpm(-90)).toBe(MIN_SOURCE_BPM);
        expect(clampSourceBpm(90)).toBe(90);
    });

    it('turns a non-number into the floor, not into NaN', () => {
        // An empty numeric input reads as NaN, and NaN propagated into a
        // playbackRate silences the clip with no error anywhere.
        expect(clampSourceBpm(Number.NaN)).toBe(MIN_SOURCE_BPM);
    });
});

describe('resolveSourceBpm', () => {
    it('prefers what the clip stores over what can be inferred', () => {
        // A loop imported with its tempo written on it knows better than the
        // arithmetic, which only ever recovers the project's own tempo.
        const clip = makeClip({ sourceBpm: 174, lengthBars: 1 });
        expect(resolveSourceBpm(clip, BAR_AT_90, 4)).toBe(174);
    });

    it('falls back to the inference when nothing is stored', () => {
        expect(resolveSourceBpm(makeClip({ lengthBars: 1 }), BAR_AT_90, 4)).toBeCloseTo(90, 6);
    });

    it('ignores a stored tempo that cannot be one', () => {
        // Zero survives `?? ` and would divide the project tempo by nothing.
        expect(resolveSourceBpm(makeClip({ sourceBpm: 0, lengthBars: 1 }), BAR_AT_90, 4))
            .toBeCloseTo(90, 6);
    });
});

describe('stretchRate', () => {
    const oneBarAt90 = makeClip({ type: 'audio', lengthBars: 1, sourceBpm: 90 });

    it('is 1 when the clip is not stretched', () => {
        expect(stretchRate(oneBarAt90, BAR_AT_90, 120, 4)).toBe(1);
    });

    it('speeds a slow loop up to the project tempo', () => {
        const clip = { ...oneBarAt90, stretchToBpm: true };
        // 90 -> 120 is faster, so the rate is above 1. Getting this backwards
        // is the single easiest mistake in the whole feature.
        expect(stretchRate(clip, BAR_AT_90, 120, 4)).toBeCloseTo(120 / 90, 10);
        expect(stretchRate(clip, BAR_AT_90, 120, 4)).toBeGreaterThan(1);
    });

    it('slows a fast loop down', () => {
        const clip = { ...oneBarAt90, sourceBpm: 174, stretchToBpm: true };
        expect(stretchRate(clip, BAR_AT_90, 87, 4)).toBeCloseTo(0.5, 10);
    });

    it('is exactly 1 when the loop is already in tempo', () => {
        // Switching stretching on must be silent for a clip recorded in this
        // project at this tempo, or the toggle would re-pitch everything the
        // first time anyone tried it.
        const clip = { ...oneBarAt90, sourceBpm: 120, stretchToBpm: true };
        expect(stretchRate(clip, BAR_AT_120, 120, 4)).toBe(1);
    });

    it('leaves a clip alone when there is no tempo to work from', () => {
        // A wrong rate is worse than no rate: it is audible, and it is silent
        // about being a guess.
        const clip = makeClip({ type: 'audio', stretchToBpm: true, lengthBars: 0 });
        expect(stretchRate(clip, 0, 120, 4)).toBe(1);
    });

    it('survives a nonsense project tempo', () => {
        const clip = { ...oneBarAt90, stretchToBpm: true };
        expect(stretchRate(clip, BAR_AT_90, 0, 4)).toBe(1);
        expect(stretchRate(clip, BAR_AT_90, Number.NaN, 4)).toBe(1);
    });

    it('clamps a corrupt stored tempo instead of handing Tone an impossible rate', () => {
        const clip = { ...oneBarAt90, sourceBpm: 0.0001, stretchToBpm: true };
        const rate = stretchRate(clip, BAR_AT_90, 300, 4);
        expect(rate).toBeLessThanOrEqual(MAX_STRETCH_RATE);
        expect(rate).toBeGreaterThanOrEqual(MIN_STRETCH_RATE);
    });
});

describe('semitoneShift', () => {
    it('reports the repitch the resampling costs', () => {
        // The whole price of the v1 approach. 90 -> 120 is nearly a fourth, and
        // the editor prints this so nobody discovers it by ear.
        expect(semitoneShift(2)).toBeCloseTo(12, 10);
        expect(semitoneShift(0.5)).toBeCloseTo(-12, 10);
        expect(semitoneShift(120 / 90)).toBeCloseTo(4.98, 2);
    });

    it('is silent about a clip that is not moving', () => {
        expect(semitoneShift(1)).toBe(0);
    });

    it('does not return -Infinity for a broken rate', () => {
        expect(semitoneShift(0)).toBe(0);
        expect(semitoneShift(-1)).toBe(0);
    });
});

describe('lengthBarsAt', () => {
    it('measures the same audio differently at different tempos', () => {
        expect(lengthBarsAt(BAR_AT_90, 90, 4)).toBeCloseTo(1, 10);
        expect(lengthBarsAt(BAR_AT_90, 120, 4)).toBeCloseTo(4 / 3, 10);
    });

    it('round-trips against inferSourceBpm', () => {
        // The two are inverses, and a sign error in either shows up here.
        const bars = lengthBarsAt(BAR_AT_90, 90, 4);
        expect(inferSourceBpm(bars, BAR_AT_90, 4)).toBeCloseTo(90, 8);
    });

    it('gives a stretched clip a length that does not move with the song', () => {
        // The property the whole feature rests on: with stretching on, a clip's
        // bar count has no project tempo in it, so taking the song from 120 to
        // 140 leaves the rectangle on screen telling the truth. Without it, the
        // seconds are fixed and the true length drifts while the drawing does
        // not — which is the bug this closes.
        const sourceSeconds = BAR_AT_90;
        const stretched = lengthBarsAt(sourceSeconds, 90, 4);

        for (const projectBpm of [60, 120, 140, 200]) {
            const rate = stretchRate(
                makeClip({ stretchToBpm: true, sourceBpm: 90, lengthBars: stretched }),
                sourceSeconds,
                projectBpm,
                4
            );
            const soundingSeconds = sourceSeconds / rate;
            expect(lengthBarsAt(soundingSeconds, projectBpm, 4)).toBeCloseTo(stretched, 8);
        }
    });

    it('is zero rather than Infinity for a clip with no audio', () => {
        expect(lengthBarsAt(0, 120, 4)).toBe(0);
        expect(lengthBarsAt(4, 0, 4)).toBe(0);
        expect(lengthBarsAt(4, 120, 0)).toBe(0);
    });
});
