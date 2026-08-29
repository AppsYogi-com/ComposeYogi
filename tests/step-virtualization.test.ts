// ============================================
// ComposeYogi — Step Virtualization Tests
// ============================================
//
// The bug these exist to prevent: the drum grid used to render
// `Math.min(totalSteps, 64)`, so a sixteen-bar pattern had cells for its first
// four bars and nothing for the rest. Those hits still played and Clear All
// still deleted them, which made the editor a window onto a quarter of a
// pattern it could nevertheless erase entirely.
//
// The property that matters is coverage: every step must be reachable by
// scrolling. A range that is merely "big enough for the screen" is not enough —
// it has to sweep the whole pattern as the viewport moves.

import { describe, expect, it } from 'vitest';

import { getVisibleStepRange, stepIndices } from '@/hooks/useVisibleSteps';

const STEP_WIDTH = 28;

/** A sixteen-bar 4/4 pattern at sixteenth-note resolution. */
const SIXTEEN_BARS = 16 * 4 * 4;

describe('getVisibleStepRange', () => {
    it('covers a screenful plus a buffer either side', () => {
        const range = getVisibleStepRange(SIXTEEN_BARS, STEP_WIDTH, {
            scrollX: 28 * 40,
            width: 28 * 20,
        });

        // 20 steps on screen, one screen of buffer each side.
        expect(range.start).toBe(20);
        expect(range.end).toBe(80);
    });

    it('never starts before the first step', () => {
        const range = getVisibleStepRange(SIXTEEN_BARS, STEP_WIDTH, { scrollX: 0, width: 560 });
        expect(range.start).toBe(0);
    });

    it('never runs past the last step', () => {
        const range = getVisibleStepRange(SIXTEEN_BARS, STEP_WIDTH, {
            scrollX: SIXTEEN_BARS * STEP_WIDTH,
            width: 560,
        });
        expect(range.end).toBeLessThanOrEqual(SIXTEEN_BARS);
        expect(range.start).toBeLessThanOrEqual(range.end);
    });

    it('renders a screenful, not the whole pattern, before measurement', () => {
        // The clip virtualizer renders everything while unmeasured. Doing that
        // here would mount ~12,000 buttons for a frame.
        const range = getVisibleStepRange(SIXTEEN_BARS, STEP_WIDTH, { scrollX: 0, width: 0 });
        expect(range.end).toBe(64);
        expect(range.end).toBeLessThan(SIXTEEN_BARS);
    });

    it('handles an empty pattern', () => {
        expect(getVisibleStepRange(0, STEP_WIDTH, { scrollX: 0, width: 560 })).toEqual({
            start: 0,
            end: 0,
        });
    });

    it('mounts far fewer cells than the pattern holds', () => {
        const range = getVisibleStepRange(SIXTEEN_BARS, STEP_WIDTH, { scrollX: 0, width: 800 });
        const mounted = range.end - range.start;
        expect(mounted).toBeLessThan(SIXTEEN_BARS / 2);
    });

    // The regression that matters: the old cap failed exactly here.
    it('reaches every step in the pattern as the viewport sweeps across', () => {
        const width = 800;
        const seen = new Set<number>();

        for (let scrollX = 0; scrollX <= SIXTEEN_BARS * STEP_WIDTH; scrollX += width / 2) {
            for (const step of stepIndices(getVisibleStepRange(SIXTEEN_BARS, STEP_WIDTH, { scrollX, width }))) {
                seen.add(step);
            }
        }

        expect(seen.size).toBe(SIXTEEN_BARS);
        expect(Math.max(...seen)).toBe(SIXTEEN_BARS - 1);
    });

    it('keeps the last step reachable at the far end of the scroll', () => {
        const width = 800;
        const maxScroll = SIXTEEN_BARS * STEP_WIDTH - width;
        const range = getVisibleStepRange(SIXTEEN_BARS, STEP_WIDTH, { scrollX: maxScroll, width });
        expect(range.end).toBe(SIXTEEN_BARS);
    });
});

describe('stepIndices', () => {
    it('lists the steps in a range, excluding the end', () => {
        expect(stepIndices({ start: 4, end: 8 })).toEqual([4, 5, 6, 7]);
    });

    it('is empty for an empty range', () => {
        expect(stepIndices({ start: 12, end: 12 })).toEqual([]);
    });
});
