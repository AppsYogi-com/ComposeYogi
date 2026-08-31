// ============================================
// ComposeYogi — What Should Be Sounding
// ============================================
//
// The bookkeeping between "a key went down" and "tell the synth". Keys held,
// the sustain pedal, and the arithmetic of which of those actually stops a
// note — extracted from the live voice so it can be tested, because it is the
// part where being wrong produces a **stuck note**, and a stuck note is the one
// bug in this feature that a user cannot work around without reloading.
//
// Imports nothing, for the reason every other pure module here imports
// nothing: Tone cannot be constructed under vitest, so anything that touches it
// cannot be tested at all.
//
// The rules it encodes, each of which is a real hardware behaviour:
//
// - A key already down does not re-attack. Key repeat fires at ~30 Hz and a
//   sticky MIDI key does the same; a synth re-attacked that often is a buzz.
// - **A key released under the pedal keeps sounding**, and is released when the
//   pedal lifts. That is what a sustain pedal is.
// - **A key still held when the pedal lifts keeps sounding.** This is the one
//   that is easy to get wrong: lifting the pedal releases what the pedal was
//   holding, not everything.
// - Re-pressing a pitch that the pedal is holding takes it back off the pedal,
//   so letting go after that releases it normally rather than leaving it
//   stranded until the next pedal lift.

/** What the caller must do to the synth after a call. */
export interface NoteAction {
    /** Attack these pitches. */
    attack: number[];
    /** Release these pitches. */
    release: number[];
}

const NOTHING: NoteAction = Object.freeze({ attack: [], release: [] });

export class NoteBook {
    /**
     * Keys physically down, oldest first.
     *
     * Order matters and a `Set` would lose it: a monophonic voice has to fall
     * back to the note *below* when the top key is released, and "hold C, add
     * E, release C, E keeps sounding" is the single most obvious way a keyboard
     * feels broken when it is wrong.
     */
    private down: number[] = [];

    /**
     * Pitches whose key is up but which the pedal is still holding.
     *
     * **Disjoint from `down`, by construction**, and that is load-bearing: a
     * pitch enters here only on release (which removes it from `down`) and
     * leaves on press (which is the first thing `press` does). The first draft
     * filtered one set against the other in two places to defend the invariant
     * — and mutation testing showed both filters were unreachable *and* that
     * they masked each other, so a bug in `press` changed no observable
     * behaviour at all. The filters are gone; the invariant is stated here and
     * pinned by the tests for duplicate output and for a note stranded on the
     * pedal.
     */
    private pedalled = new Set<number>();

    private pedal = false;

    // ========================================
    // Queries
    // ========================================

    /** Everything sounding — keys down plus whatever the pedal is holding. */
    sounding(): number[] {
        return [...this.down, ...this.pedalled];
    }

    /** Keys physically down, in press order. The monophonic fallback reads this. */
    heldKeys(): readonly number[] {
        return this.down;
    }

    isPedalDown(): boolean {
        return this.pedal;
    }

    // ========================================
    // Transitions
    // ========================================

    /** A key went down. */
    press(pitch: number): NoteAction {
        if (this.down.includes(pitch)) return NOTHING;

        // Taking a pitch back off the pedal: it is a real key press again, so
        // releasing it later releases it, rather than stranding it until the
        // pedal happens to lift.
        this.pedalled.delete(pitch);
        this.down.push(pitch);
        return { attack: [pitch], release: [] };
    }

    /** A key came up. */
    release(pitch: number): NoteAction {
        const index = this.down.indexOf(pitch);
        if (index === -1) return NOTHING;
        this.down.splice(index, 1);

        if (this.pedal) {
            this.pedalled.add(pitch);
            return NOTHING;
        }
        return { attack: [], release: [pitch] };
    }

    /**
     * The sustain pedal moved.
     *
     * Pressing it does nothing audible — it only changes what a later key
     * release means. Lifting it releases what it was holding, and **only** that:
     * a key still down keeps sounding, which is the whole point of holding it.
     */
    setPedal(down: boolean): NoteAction {
        // No "did it change?" guard here. There was one, and mutation testing
        // showed it unreachable: `pedalled` only gains entries while the pedal
        // is down and is emptied when it lifts, so a repeated message in either
        // direction already produces an empty action. The guard that *is* worth
        // having is a render guard, and it lives at the call site in
        // `live-play.ts`, where a continuous pedal's stream of CC values would
        // otherwise re-render the keyboard fifty times a second.
        this.pedal = down;
        if (down) return NOTHING;

        const release = [...this.pedalled];
        this.pedalled.clear();
        return { attack: [], release };
    }

    /**
     * Everything off.
     *
     * The pedal is lifted too. MIDI's All Notes Off (CC 123) leaves the pedal
     * where it was, but this is a *panic* — it is reached from a stuck note, a
     * window that lost focus, or a cable pulled mid-chord, and leaving a latched
     * pedal behind means the next note played sticks as well.
     */
    clear(): NoteAction {
        const release = this.sounding();
        this.down = [];
        this.pedalled.clear();
        this.pedal = false;
        return { attack: [], release };
    }
}
