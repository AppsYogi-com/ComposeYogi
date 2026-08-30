// ============================================
// ComposeYogi — Count-In
// The arithmetic behind "Recording in 3…2…1…"
// ============================================

/**
 * A count-in's progress at one instant, in the terms the overlay draws.
 *
 * Measured on the **wall clock**, deliberately, not on the transport. A
 * count-in that begins before bar 0 — the default: record from the start of an
 * empty song with two bars of count-in — has no transport position to read,
 * because the transport cannot run backwards into music that does not exist.
 * Pre-roll and lead-in are two different things to the transport and the same
 * thing to the person waiting to sing, so the clock they share is the one this
 * measures.
 */
export interface CountInProgress {
    /**
     * The number on screen: whole beats left, rounded up, so the last beat
     * reads "1" for its whole duration and only reaches 0 when recording
     * actually starts.
     */
    beatsRemaining: number;
    /** Whole beats gone — how many pips are lit. */
    beatsElapsed: number;
    /** 0–1 through the whole count-in, for anything that wants it continuous. */
    progress: number;
}

/**
 * Where a count-in has got to.
 *
 * @param nowMs        `performance.now()` at the moment being drawn.
 * @param endsAtMs     `performance.now()` at which recording begins.
 * @param totalBeats   Beats in the whole count-in (bars × beats per bar).
 * @param bpm          The project tempo the count-in is being played at.
 */
export function countInProgress(
    nowMs: number,
    endsAtMs: number,
    totalBeats: number,
    bpm: number
): CountInProgress {
    // A zero-length count-in is over before it starts, and a zero tempo is not
    // a tempo. Both would otherwise divide by zero and put NaN on screen.
    if (totalBeats <= 0 || bpm <= 0) {
        return { beatsRemaining: 0, beatsElapsed: 0, progress: 1 };
    }

    const secondsPerBeat = 60 / bpm;
    const secondsLeft = Math.max(0, (endsAtMs - nowMs) / 1000);

    // Clamped at both ends: a clock read a frame early must not show more beats
    // than the count-in has, and one read late must not show fewer than none.
    const beatsLeftExact = Math.min(totalBeats, secondsLeft / secondsPerBeat);
    const beatsRemaining = Math.ceil(beatsLeftExact);

    return {
        beatsRemaining,
        beatsElapsed: totalBeats - beatsRemaining,
        progress: (totalBeats - beatsLeftExact) / totalBeats,
    };
}
