// ============================================
// ComposeYogi — Clip Virtualization Tests
// ============================================

import { describe, expect, it } from 'vitest';

import { getRenderRange, isClipInRange, selectVisibleClips } from '@/hooks/useVisibleClips';

import { makeClip } from './fixtures';

const PIXELS_PER_BAR = 80;

/** n clips laid end to end, four bars each. */
function laneOfClips(count: number) {
    return Array.from({ length: count }, (_, i) =>
        makeClip({ id: `clip-${i}`, startBar: i * 4, lengthBars: 4 })
    );
}

describe('getRenderRange', () => {
    it('extends one viewport width either side of what is on screen', () => {
        expect(getRenderRange({ scrollX: 1000, width: 800 })).toEqual({
            start: 200,   // 1000 - 800
            end: 2600,    // 1000 + 800 + 800
        });
    });

    it('never starts before the beginning of the timeline', () => {
        expect(getRenderRange({ scrollX: 0, width: 800 })?.start).toBe(0);
    });

    it('is unknown before the container has been measured', () => {
        expect(getRenderRange({ scrollX: 0, width: 0 })).toBeNull();
    });
});

describe('isClipInRange', () => {
    const range = { start: 1000, end: 2000 };

    it('includes a clip fully inside the range', () => {
        const clip = makeClip({ startBar: 15, lengthBars: 4 }); // 1200–1520px
        expect(isClipInRange(clip, PIXELS_PER_BAR, range)).toBe(true);
    });

    it('includes a clip that only overlaps at an edge', () => {
        const spansStart = makeClip({ startBar: 10, lengthBars: 4 });  // 800–1120px
        const spansEnd = makeClip({ startBar: 24, lengthBars: 4 });    // 1920–2240px
        expect(isClipInRange(spansStart, PIXELS_PER_BAR, range)).toBe(true);
        expect(isClipInRange(spansEnd, PIXELS_PER_BAR, range)).toBe(true);
    });

    it('includes a long clip that straddles the whole range', () => {
        const long = makeClip({ startBar: 0, lengthBars: 64 }); // 0–5120px
        expect(isClipInRange(long, PIXELS_PER_BAR, range)).toBe(true);
    });

    it('excludes clips entirely before or after', () => {
        const before = makeClip({ startBar: 0, lengthBars: 4 });   // 0–320px
        const after = makeClip({ startBar: 40, lengthBars: 4 });   // 3200–3520px
        expect(isClipInRange(before, PIXELS_PER_BAR, range)).toBe(false);
        expect(isClipInRange(after, PIXELS_PER_BAR, range)).toBe(false);
    });
});

describe('selectVisibleClips', () => {
    it('leaves a handful of clips alone — the filter would cost more than it saves', () => {
        const clips = laneOfClips(4);
        expect(selectVisibleClips(clips, PIXELS_PER_BAR, { scrollX: 100_000, width: 800 })).toBe(clips);
    });

    it('returns the same array when the render range already covers the lane', () => {
        // Identity matters: an unchanged reference lets React skip the lane.
        const clips = laneOfClips(10); // 0-3200px
        expect(selectVisibleClips(clips, PIXELS_PER_BAR, { scrollX: 0, width: 3000 })).toBe(clips);
    });

    it('virtualizes a lane whose clips run past the render range', () => {
        const clips = laneOfClips(16); // 16 clips over 5120px
        const visible = selectVisibleClips(clips, PIXELS_PER_BAR, { scrollX: 0, width: 800 });
        expect(visible.length).toBeLessThan(clips.length);
    });

    it('renders everything until the container has been measured', () => {
        const clips = laneOfClips(200);
        expect(selectVisibleClips(clips, PIXELS_PER_BAR, { scrollX: 0, width: 0 })).toBe(clips);
    });

    it('mounts only a screenful-plus-buffer of a 200-clip project', () => {
        const clips = laneOfClips(200); // 64,000px of timeline
        const visible = selectVisibleClips(clips, PIXELS_PER_BAR, { scrollX: 20_000, width: 800 });

        // 2400px of render range over 320px clips: a handful, not 200.
        expect(visible.length).toBeLessThan(15);
        expect(visible.length).toBeGreaterThan(0);
    });

    it('keeps every clip the viewport can actually see', () => {
        const clips = laneOfClips(200);
        const viewport = { scrollX: 20_000, width: 800 };
        const visible = new Set(
            selectVisibleClips(clips, PIXELS_PER_BAR, viewport).map((c) => c.id)
        );

        // Anything overlapping the on-screen window must have been kept.
        const onScreen = clips.filter((clip) =>
            isClipInRange(clip, PIXELS_PER_BAR, {
                start: viewport.scrollX,
                end: viewport.scrollX + viewport.width,
            })
        );

        expect(onScreen.length).toBeGreaterThan(0);
        for (const clip of onScreen) {
            expect(visible.has(clip.id)).toBe(true);
        }
    });

    it('covers the whole timeline as the viewport sweeps across it', () => {
        const clips = laneOfClips(200);
        const seen = new Set<string>();

        for (let scrollX = 0; scrollX <= 64_000; scrollX += 400) {
            for (const clip of selectVisibleClips(clips, PIXELS_PER_BAR, { scrollX, width: 800 })) {
                seen.add(clip.id);
            }
        }

        // Scrolling end to end must reveal every clip — none may be skipped.
        expect(seen.size).toBe(clips.length);
    });
});
