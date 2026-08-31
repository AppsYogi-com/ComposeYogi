// ============================================
// ComposeYogi — A Played Performance Becomes a Clip
// ============================================
//
// What was pressed, when, turned into the notes of a MIDI clip. The third of
// the import-nothing modules, and for the same reason: this is the part of live
// recording that a unit test can reach, and it is the part where being subtly
// wrong produces a clip that looks plausible and is not what anyone played.
//
// Time arrives here in transport seconds and leaves in beats, because that is
// the boundary the codebase draws — bars and beats in state, seconds in Tone.

/** One key, pressed at a transport time and released at another. */
export interface PerformedNote {
    pitch: number;
    /** 0–127, as played. */
    velocity: number;
    /** Transport seconds when the key went down. */
    startSeconds: number;
    /**
     * Transport seconds when it came up, or null while it is still held.
     *
     * Null is not a placeholder for "unknown" — it is the state a note is
     * genuinely in when the user stops recording with a key still down, which
     * is what happens every time somebody ends on a held chord. `closeHeldNotes`
     * is what stops those notes from being dropped.
     */
    endSeconds: number | null;
}

/** A note as the project stores it, minus the id the store mints. */
export interface DraftNote {
    pitch: number;
    startBeat: number;
    duration: number;
    velocity: number;
}

/**
 * The shortest note a take may contain, in beats.
 *
 * A key pressed and released inside one animation frame is a real staccato hit
 * and has to survive as one; without a floor it becomes a zero-length note,
 * which the piano roll cannot draw and the scheduler triggers with no duration.
 * A 64th note is short enough to still read as staccato at any tempo.
 */
export const MIN_NOTE_BEATS = 1 / 16;

/**
 * Close every note still held, at the moment recording stopped.
 *
 * Called by the recorder on stop rather than folded into the conversion below,
 * because the two have different information: only the recorder knows when the
 * take ended, and only it knows that the ending is a stop rather than a gap.
 */
export function closeHeldNotes(notes: PerformedNote[], endSeconds: number): PerformedNote[] {
    return notes.map((note) =>
        note.endSeconds === null ? { ...note, endSeconds } : note
    );
}

/**
 * A performance as clip notes, relative to the take's start.
 *
 * Nothing is quantized. A performance is a performance; snapping it to the grid
 * is an edit, the app has no quantize command to undo it with, and the whole
 * point of the north star — *this felt like a real studio* — is that what you
 * played is what you get.
 *
 * Nothing is latency-compensated either, which is the opposite of what audio
 * recording does and is right for the same reason. An audio take is compensated
 * because the microphone hears the player *after* the sound leaves the
 * speakers; a played note is stamped at the instant the key goes down, which is
 * already the moment the player meant.
 */
export function notesFromPerformance(
    notes: PerformedNote[],
    startSeconds: number,
    bpm: number
): DraftNote[] {
    if (!Number.isFinite(bpm) || bpm <= 0) return [];
    const secondsPerBeat = 60 / bpm;

    return notes
        .filter((note) => note.endSeconds !== null)
        .map((note) => {
            // Clamped at zero: a note whose key went down during the count-in
            // belongs at the top of the clip, not at a negative beat the clip
            // has no room for.
            const startBeat = Math.max(0, (note.startSeconds - startSeconds) / secondsPerBeat);
            const rawDuration = ((note.endSeconds as number) - note.startSeconds) / secondsPerBeat;

            return {
                pitch: Math.round(note.pitch),
                startBeat,
                duration: Math.max(MIN_NOTE_BEATS, rawDuration),
                velocity: Math.min(127, Math.max(1, Math.round(note.velocity))),
            };
        })
        .sort((a, b) => a.startBeat - b.startBeat || a.pitch - b.pitch);
}

/**
 * How many bars the clip needs to hold what was played.
 *
 * Whole bars, because a MIDI clip's length is what the arrangement draws and a
 * clip ending three-quarters of the way through a bar reads as a mistake. Never
 * less than one — an empty take, or one containing a single grace note, is
 * still a clip somebody has to be able to see and grab.
 */
export function clipBarsForNotes(notes: DraftNote[], beatsPerBar: number): number {
    if (!Number.isFinite(beatsPerBar) || beatsPerBar <= 0) return 1;

    let lastBeat = 0;
    for (const note of notes) lastBeat = Math.max(lastBeat, note.startBeat + note.duration);

    return Math.max(1, Math.ceil(lastBeat / beatsPerBar));
}
