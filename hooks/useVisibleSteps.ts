// ============================================
// ComposeYogi — Step Virtualization
// ============================================
//
// The drum grid is one button per drum sound per step. At sixteenth-note
// resolution a sixteen-bar clip is 256 steps, and with the full General MIDI
// percussion map that is close to twelve thousand buttons — enough to make
// mounting the editor visibly slow.
//
// The editor used to avoid that by rendering `Math.min(totalSteps, 64)`, which
// is not a limit on what is drawn so much as a limit on what exists: three
// quarters of a sixteen-bar pattern had no cells at all. Those notes still
// played, because the scheduler reads the clip rather than the grid, and Clear
// All still deleted them — so the editor showed a quarter of a pattern it could
// nonetheless erase in full.
//
// The fix is the same one the arrangement already uses for clips: keep every
// step, mount only the ones on screen.

import { useMemo } from 'react';

import type { Viewport } from './useVisibleClips';

/** Extra viewport widths mounted on each side, so scrolling never shows a gap. */
const BUFFER_SCREENS = 1;

/**
 * Steps rendered before the container has been measured.
 *
 * The clip virtualizer renders everything while unmeasured, which is safe for
 * a few hundred clips. Here the same choice would mount twelve thousand buttons
 * for one frame, so an unmeasured grid gets a screenful instead and widens on
 * the first measurement.
 */
const UNMEASURED_STEPS = 64;

/** A half-open range of step indices: `start` renders, `end` does not. */
export interface StepRange {
    start: number;
    end: number;
}

/**
 * Which step columns are worth mounting.
 *
 * Clamped to the pattern, so the range can always be iterated directly, and
 * never inverted even for a container scrolled past its own content.
 */
export function getVisibleStepRange(
    totalSteps: number,
    stepWidth: number,
    viewport: Viewport
): StepRange {
    if (totalSteps <= 0) return { start: 0, end: 0 };
    if (stepWidth <= 0 || viewport.width <= 0) {
        return { start: 0, end: Math.min(totalSteps, UNMEASURED_STEPS) };
    }

    const buffer = viewport.width * BUFFER_SCREENS;
    const first = Math.floor((viewport.scrollX - buffer) / stepWidth);
    const last = Math.ceil((viewport.scrollX + viewport.width + buffer) / stepWidth);

    const start = Math.min(Math.max(0, first), totalSteps);
    const end = Math.max(start, Math.min(totalSteps, last));
    return { start, end };
}

/** Memoized `getVisibleStepRange`, for use in a component render. */
export function useVisibleStepRange(
    totalSteps: number,
    stepWidth: number,
    viewport: Viewport
): StepRange {
    return useMemo(
        () => getVisibleStepRange(totalSteps, stepWidth, viewport),
        [totalSteps, stepWidth, viewport.scrollX, viewport.width]
    );
}

/** The step indices in a range, ready to map over. */
export function stepIndices(range: StepRange): number[] {
    return Array.from({ length: range.end - range.start }, (_, i) => range.start + i);
}
