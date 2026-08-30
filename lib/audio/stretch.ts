// ============================================
// ComposeYogi — Stretch to BPM (v1: playbackRate)
// ============================================
//
// A loop made at 90 BPM dropped into a 120 BPM project is not in time with
// anything. Every DAW answers this the same way, and the honest v1 answer is
// the oldest one: play the tape faster. `playbackRate` resamples, so the audio
// speeds up *and* pitches up together, exactly like a turntable. That is a real
// musical cost, not a rounding error — 90 → 120 is nearly five semitones — so
// the UI states the shift rather than hiding it, and true time-stretching
// (WASM, pitch preserved) is tracked as its own piece of work in Phase 2.5.
//
// Why a clip needs a *source* tempo at all, when it already knows how long it
// is: `lengthBars` is written from the audio's duration at whatever the project
// tempo happened to be when the clip was created, so it measures seconds, not
// music. A one-bar loop at 90 BPM dropped into a 120 BPM project is stored as
// 1.33 bars. Deriving the rate from `lengthBars` would therefore always give
// 1.0 — a no-op for precisely the case the feature exists to fix.
//
// The payoff is that a stretched clip's bar length stops depending on tempo:
//
//     lengthBars = sourceSeconds at sourceBpm
//
// has no project tempo in it. Change the song from 120 to 140 and a stretched
// clip still occupies the bars it draws. An unstretched one does not — its
// seconds are fixed, so its true length in bars moves while the rectangle on
// screen stays put. That silent disagreement is what this closes.

import type { Clip } from '@/types';

// ============================================
// Ranges
// ============================================

/**
 * Believable source tempos. The same range the project's own BPM is clamped to
 * (`setBpm`), because a clip's source tempo is a tempo like any other — and
 * because the two together bound the rate below.
 */
export const MIN_SOURCE_BPM = 20;
export const MAX_SOURCE_BPM = 300;

/**
 * Hard safety clamp on the resampling ratio.
 *
 * Two clamped tempos can only ever produce 20/300 … 300/20, so this is not
 * reachable through the UI — it exists so that a corrupt or hand-edited
 * `sourceBpm` (a zero, a negative, a NaN) degrades to a strange-sounding clip
 * rather than an AudioParam the browser refuses.
 */
export const MIN_STRETCH_RATE = 1 / 16;
export const MAX_STRETCH_RATE = 16;

/**
 * Repitch past this reads as a different instrument rather than the same one in
 * a new tempo, so the editor marks it. An octave is generous on purpose: the
 * point is to warn, not to forbid — vinyl-speed abuse is a technique.
 */
export const REPITCH_WARN_SEMITONES = 12;

// ============================================
// Source tempo
// ============================================

function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}

/** A number that can be used as a tempo — finite and above zero. */
function isUsableBpm(value: number | undefined): value is number {
    return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

/** Clamp a user-entered or imported source tempo into the believable range. */
export function clampSourceBpm(bpm: number): number {
    if (!Number.isFinite(bpm)) return MIN_SOURCE_BPM;
    return clamp(bpm, MIN_SOURCE_BPM, MAX_SOURCE_BPM);
}

/**
 * The tempo at which this clip's audio would exactly fill the bars it claims.
 *
 * Every audio clip in the app is created with `lengthBars` derived from its
 * duration at the project tempo of that moment — a recording, a dropped sample,
 * a trim in the waveform editor all do this. So for anything made here the
 * answer is the tempo the project was at, which is the right guess and needs
 * nothing stored. It is only a guess, though: a loop imported from elsewhere
 * knows its own tempo and should say so.
 *
 * Returns null when there is nothing to infer from, so the caller decides what
 * to do about it instead of receiving a plausible-looking zero.
 */
export function inferSourceBpm(
    lengthBars: number,
    sourceSeconds: number,
    beatsPerBar: number
): number | null {
    if (!(lengthBars > 0) || !(sourceSeconds > 0) || !(beatsPerBar > 0)) return null;

    const beats = lengthBars * beatsPerBar;
    return clampSourceBpm((beats * 60) / sourceSeconds);
}

/**
 * The source tempo to actually use: what the clip stores, or the inference.
 *
 * Kept separate from `inferSourceBpm` so the editor can show the user which of
 * the two they are looking at — an inferred tempo is a suggestion they may need
 * to correct, a stored one is theirs.
 */
export function resolveSourceBpm(
    clip: Pick<Clip, 'sourceBpm' | 'lengthBars'>,
    sourceSeconds: number,
    beatsPerBar: number
): number | null {
    if (isUsableBpm(clip.sourceBpm)) return clampSourceBpm(clip.sourceBpm);
    return inferSourceBpm(clip.lengthBars, sourceSeconds, beatsPerBar);
}

// ============================================
// Rate
// ============================================

/**
 * Resampling ratio for one clip. 1 means "play it as recorded" and is the
 * answer whenever stretching is off, unrequested, or impossible — a clip with
 * no usable source tempo is left alone rather than guessed at, because a wrong
 * rate is worse than no rate.
 */
export function stretchRate(
    clip: Pick<Clip, 'stretchToBpm' | 'sourceBpm' | 'lengthBars'>,
    sourceSeconds: number,
    projectBpm: number,
    beatsPerBar: number
): number {
    if (!clip.stretchToBpm) return 1;
    if (!isUsableBpm(projectBpm)) return 1;

    const sourceBpm = resolveSourceBpm(clip, sourceSeconds, beatsPerBar);
    if (sourceBpm === null) return 1;

    return clamp(projectBpm / sourceBpm, MIN_STRETCH_RATE, MAX_STRETCH_RATE);
}

/**
 * How far the resampling moves the pitch, in semitones. Positive is sharp.
 *
 * This is the whole cost of the v1 approach expressed as one number, which is
 * why it is a function here and not a formula inlined in the editor: it is a
 * musical fact about the clip, and the editor's job is only to print it.
 */
export function semitoneShift(rate: number): number {
    if (!(rate > 0)) return 0;
    return 12 * Math.log2(rate);
}

// ============================================
// Length
// ============================================

/**
 * How many bars `sourceSeconds` of audio occupies at a given tempo.
 *
 * Called with the *source* tempo it answers the interesting question — the
 * musical length of a stretched clip, and the value `lengthBars` should be set
 * to when stretching is switched on. Note what is not in that: the project
 * tempo. That is the point. Once written it stays correct at every tempo the
 * song is ever taken to, because the rate absorbs the difference.
 *
 * Called with the *project* tempo it answers the un-stretched question instead,
 * which is the length to restore when stretching is switched off.
 */
export function lengthBarsAt(
    sourceSeconds: number,
    bpm: number,
    beatsPerBar: number
): number {
    if (!(sourceSeconds > 0) || !isUsableBpm(bpm) || !(beatsPerBar > 0)) return 0;
    return (sourceSeconds * bpm) / (60 * beatsPerBar);
}
