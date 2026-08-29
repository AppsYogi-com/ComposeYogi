// ============================================
// ComposeYogi — Clip Virtualization
// ============================================
//
// A long arrangement can hold hundreds of clips, but only a screenful is ever
// visible. Mounting the rest costs layout, paint and — because each audio clip
// renders a waveform — real work per frame. These hooks narrow the list to
// what the viewport can actually show, plus a buffer either side so scrolling
// never reveals an empty lane before React catches up.

import { useEffect, useMemo, useRef, useState } from 'react';

import type { Clip } from '@/types';

/** Extra viewport widths rendered on each side of the visible range. */
const BUFFER_SCREENS = 1;

/**
 * Lanes with fewer clips than this are passed straight through. The cost being
 * avoided is *mounting* clips, so the bar is low: visiting a dozen array
 * elements is orders of magnitude cheaper than rendering a dozen waveforms.
 */
const MIN_CLIPS_TO_VIRTUALIZE = 8;

export interface Viewport {
    /** Horizontal scroll offset of the timeline, in pixels. */
    scrollX: number;
    /** Visible width of the scroll container, in pixels. */
    width: number;
}

/**
 * Track a scroll container's visible width, keeping it correct across window
 * resizes and panel open/close (which change the width without a scroll event).
 */
export function useViewportWidth(
    containerRef: React.RefObject<HTMLElement | null>
): number {
    const [width, setWidth] = useState(0);

    useEffect(() => {
        const element = containerRef.current;
        if (!element) return;

        setWidth(element.clientWidth);

        // ResizeObserver catches panel toggles and window resizes alike.
        if (typeof ResizeObserver === 'undefined') return;

        const observer = new ResizeObserver((entries) => {
            const entry = entries[0];
            if (entry) setWidth(entry.contentRect.width);
        });
        observer.observe(element);

        return () => observer.disconnect();
    }, [containerRef]);

    return width;
}

/**
 * Pixel range that should be rendered: the viewport plus a buffer each side.
 * Returns null when the width is unknown (first paint) so callers render
 * everything rather than nothing.
 */
export function getRenderRange(viewport: Viewport): { start: number; end: number } | null {
    if (viewport.width <= 0) return null;

    const buffer = viewport.width * BUFFER_SCREENS;
    return {
        start: Math.max(0, viewport.scrollX - buffer),
        end: viewport.scrollX + viewport.width + buffer,
    };
}

/** True when a clip's horizontal extent overlaps the render range. */
export function isClipInRange(
    clip: Clip,
    pixelsPerBar: number,
    range: { start: number; end: number }
): boolean {
    const left = clip.startBar * pixelsPerBar;
    const right = left + clip.lengthBars * pixelsPerBar;
    return right >= range.start && left <= range.end;
}

/**
 * Filter clips down to those worth mounting. Returns the input array unchanged
 * whenever nothing would be dropped, so React can skip the lane entirely.
 */
export function selectVisibleClips(
    clips: Clip[],
    pixelsPerBar: number,
    viewport: Viewport
): Clip[] {
    if (clips.length < MIN_CLIPS_TO_VIRTUALIZE) return clips;

    const range = getRenderRange(viewport);
    if (!range) return clips;

    // If the render range already spans everything this lane holds, filtering
    // would return the same list — hand back the original array so React sees
    // an unchanged reference and skips the reconcile entirely.
    let laneStart = Infinity;
    let laneEnd = -Infinity;
    for (const clip of clips) {
        const left = clip.startBar * pixelsPerBar;
        if (left < laneStart) laneStart = left;
        const right = left + clip.lengthBars * pixelsPerBar;
        if (right > laneEnd) laneEnd = right;
    }
    if (laneStart >= range.start && laneEnd <= range.end) return clips;

    return clips.filter((clip) => isClipInRange(clip, pixelsPerBar, range));
}

/**
 * Memoized clip virtualization for one track lane.
 *
 * The scroll offset is quantized before it reaches the memo so that ordinary
 * scrolling recomputes the visible set only when the viewport has moved far
 * enough to change it — not on every pixel.
 */
export function useVisibleClips(
    clips: Clip[],
    pixelsPerBar: number,
    viewport: Viewport
): Clip[] {
    // Quantize to a quarter viewport: still well inside the one-screen buffer,
    // so a clip is always mounted before it can scroll into view.
    const step = Math.max(1, Math.round(viewport.width / 4));
    const quantizedScrollX = Math.floor(viewport.scrollX / step) * step;

    return useMemo(
        () => selectVisibleClips(clips, pixelsPerBar, { scrollX: quantizedScrollX, width: viewport.width }),
        [clips, pixelsPerBar, quantizedScrollX, viewport.width]
    );
}

/**
 * Read a scroll container's live scrollLeft into React state, throttled to one
 * update per animation frame so a fast scroll cannot outrun rendering.
 */
export function useThrottledScrollX(initial = 0): [number, (value: number) => void] {
    const [scrollX, setScrollX] = useState(initial);
    const pending = useRef<number | null>(null);
    const frame = useRef<number | null>(null);

    useEffect(() => () => {
        if (frame.current !== null) cancelAnimationFrame(frame.current);
    }, []);

    const push = (value: number) => {
        pending.current = value;
        if (frame.current !== null) return;

        frame.current = requestAnimationFrame(() => {
            frame.current = null;
            if (pending.current !== null) setScrollX(pending.current);
        });
    };

    return [scrollX, push];
}
