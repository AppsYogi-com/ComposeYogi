// ============================================
// ComposeYogi — Drawn Keyboard Geometry
// ============================================
//
// How big the on-screen piano is, what is printed on each key, and where the
// typed letters sit. Pure arithmetic — it imports only `pitch.ts`,
// `typing-keys.ts` and `percussion.ts`, all three arithmetic or data — so the
// part that decides what a keyboard looks like is the part a unit test can
// reach. The component that renders it needs a layout engine and a
// ResizeObserver and cannot be tested at all.
//
// The keycaps have **two languages**, chosen by `KeyboardVoicing`. On a melodic
// track a key is a note, so it is labelled `C3`, `D`, `E`. On a drum track it is
// not: those pitches are General MIDI percussion slots, so the key at 48 is a
// Hi-Mid Tom and the one at 42 is a closed hi-hat. Drawing note names over a kit
// was shipped, and it meant the default live keyboard — every demo template
// opens with Drums — was labelled with notes the track could not play.
//
// ============================================
// The keyboard does not move. Ever.
// ============================================
//
// This is the whole design, and getting it wrong is what made three versions of
// this feel broken. The first drew exactly the 25 keys the letters reach. The
// second grew to fill the window, up to all 84 keys the app can play. The third
// centred a 3–4 octave window on the typing range — and that one was the worst,
// because shifting the octave moved **two things at once**: the lit block slid,
// *and* the drawn range slid under it, by a different amount, at the ends by no
// amount at all. Every octave change was a different animation. "The screen
// flicks… the slider moves… this whole UI is shitty as fuck" is exactly right,
// and it is not a rendering bug — it is what the layout was asked to do.
//
// A real keyboard is a fixed object. You do not get more keys by making the
// window bigger, and the keys do not slide when you transpose. So:
//
//   - The drawn range is **C1–C7, always**. 43 white keys, 73 in total — the
//     size of a stage piano.
//   - The typing octave can be 1 to 5, so every window position (C1–C3 through
//     C5–C7) lies inside that range with nothing to scroll to. **The board is
//     sized to hold the window, never the other way round**: the first attempt
//     at a fixed board cut the octave range to 1–4 so that 36 keys would do,
//     and the cost was the top octave silently disappearing.
//   - Shifting the octave changes which keys are lit and which letters are
//     printed. **No key ever changes size or position.** React re-renders the
//     same 61 buttons in the same places, so there is no reflow to see.
//
// The width only decides how big the keys are, never how many.

import { drumCapLabel, drumSoundForPitch } from './percussion';
import { pitchName } from './pitch';
import {
    TYPING_SPAN_SEMITONES,
    isBlackKey,
    keysForPitch,
    octaveBasePitch,
} from './typing-keys';

// ============================================
// The instrument
// ============================================

/** C1 — 32.70 Hz. */
export const KEYBOARD_LOW_PITCH = 24;

/** C7 — 2093.00 Hz. */
export const KEYBOARD_HIGH_PITCH = 96;

/** 43 white keys and 30 black: a 73-key board, the size of a stage piano. */
export const WHITE_KEY_COUNT = 43;

// ============================================
// Key sizes
// ============================================
//
// Measured from the on-screen pianos people compare this against, on a 1512px
// page: musicca.com draws 37 x 190 white keys (5.1 : 1) and virtualpiano.net
// 35 x 210 (6.0 : 1). Both are pages that can spend the height; this is a strip
// docked under an arrangement, and 4.6 is as far as it goes before the keyboard
// starts costing tracks.

const WHITE_ASPECT = 4.6;

/**
 * The widest a white key gets — and it is `MAX_WHITE_HEIGHT / WHITE_ASPECT`, not
 * a number of its own.
 *
 * Capping the height alone does not work: on a wide bar the keys grow sideways
 * until the height cap bites and the aspect quietly falls back to 4 : 1, which
 * was measured at 46 x 184. Capping the width at the aspect instead means the
 * board stops growing and the leftover becomes margin — which is what both
 * reference keyboards do. Neither fills its page.
 */
export const MAX_WHITE_WIDTH = 38;

/**
 * The aspect is a **band**, not an exact ratio: never stubbier than 4.6, never
 * thinner than a real piano.
 *
 * A fixed board on a laptop gives narrow keys — 43 of them across 1012px is 23
 * each — and 23 x 4.6 is 106px tall, which is stubbier than the version this
 * replaced and the wrong direction when the complaint was stubby keys. So the
 * minimum height pushes back up. But a floor alone goes too far the other way:
 * held at 150 on a 20px key that is 7.5 : 1, thinner than any keyboard ever
 * built. `MAX_ASPECT` is an actual piano's 6.5, so the keys can only ever be
 * between musicca.com's 5.1 and the real thing.
 */
const MIN_WHITE_HEIGHT = 150;
const MAX_WHITE_HEIGHT = 175;
const MAX_ASPECT = 6.5;

/** A real piano: 13.7mm on 23mm, and 62% of the length. */
const BLACK_WIDTH_RATIO = 13.7 / 23;
const BLACK_HEIGHT_RATIO = 0.62;

/** How far a pressed key sinks. */
export const KEY_PRESS_TRAVEL = 3;

/** The strip above the keys — a piano's fallboard, and where the rail sits. */
export const RAIL_HEIGHT = 6;

// ============================================
// Shapes
// ============================================

/**
 * What the track under the keyboard plays, and therefore what the keys say.
 *
 * Not `boolean`: "is it a drum" reads at the call site as a flag about the
 * geometry, which none of this is — the board is the same 73 keys either way.
 * What changes is the *language on the keycaps*, and there is a real chance of a
 * third one (a scale-aware melodic voicing that dims out-of-key notes is an open
 * product question), which a boolean would have to be replaced to allow.
 */
export type KeyboardVoicing = 'melodic' | 'kit';

export interface DrawnKey {
    pitch: number;
    black: boolean;
    /** Left edge within the board, before centring. Fixed for the life of the bar. */
    x: number;
    width: number;
    height: number;
    /** The computer keys that play it — empty outside the typing window. */
    typed: string[];
    /**
     * What is printed on the key.
     *
     * Melodic: `C3` on a C, `D` on the rest, nothing on a black key. Kit: the
     * drum's three-letter short name, **including on the black keys** — GM puts
     * the closed hat on F#, the open hat on A# and the ride on D#, so a kit
     * keyboard that only labels the whites leaves out the hats.
     */
    label: string | null;
    /**
     * The key's accessible name — `pitchName` on a melodic track, the drum's
     * full name on a kit.
     *
     * A kit key's pitch name is not merely unhelpful, it is **wrong**: nothing
     * about pitch 48 on a drum track is a C, it is a Hi-Mid Tom, and a screen
     * reader announcing "C3" describes a note the track cannot play.
     */
    name: string;
    /** Whether a letter reaches it. Everything else is dimmed. */
    inWindow: boolean;
}

export interface KeyboardLayout {
    keys: DrawnKey[];
    whiteWidth: number;
    whiteHeight: number;
    /** Width of the board. */
    width: number;
    /** What the container must reserve, press travel and fallboard included. */
    height: number;
    /** Left pad that centres the board in its container. */
    offsetX: number;
    /** The typing window's rail, in the same coordinates as `x`. */
    windowX: number;
    windowWidth: number;
}

const clamp = (value: number, low: number, high: number) =>
    Math.min(high, Math.max(low, value));

// ============================================
// The layout
// ============================================

/**
 * Every key to draw, at the size the container allows.
 *
 * Widths are whole pixels: a 28.37px key rendered thirty-six times puts every
 * key edge on a different sub-pixel, which at any device pixel ratio draws some
 * separators dark and some invisible. The rounding leftover joins the centring
 * margin.
 *
 * There is deliberately **no minimum width**. A floor is a promise this cannot
 * keep — the board is a fixed 36 white keys, so at 400px they are 11px each —
 * and a keyboard wider than its container is one whose right-hand keys are
 * clipped off the screen. Thin keys at an absurd width are ugly; missing ones
 * are wrong.
 */
export function keyboardLayout(
    typingOctave: number,
    available: number,
    voicing: KeyboardVoicing = 'melodic'
): KeyboardLayout {
    const width = Number.isFinite(available) ? Math.max(0, available) : 0;

    const whiteWidth = clamp(Math.floor(width / WHITE_KEY_COUNT), 1, MAX_WHITE_WIDTH);
    const whiteHeight = Math.round(Math.min(
        clamp(whiteWidth * WHITE_ASPECT, MIN_WHITE_HEIGHT, MAX_WHITE_HEIGHT),
        whiteWidth * MAX_ASPECT
    ));
    const blackWidth = Math.round(whiteWidth * BLACK_WIDTH_RATIO);
    const blackHeight = Math.round(whiteHeight * BLACK_HEIGHT_RATIO);

    const windowLow = octaveBasePitch(typingOctave);
    const windowHigh = windowLow + TYPING_SPAN_SEMITONES;

    const keys: DrawnKey[] = [];
    let whitesBelow = 0;

    const drum = voicing === 'kit';

    for (let pitch = KEYBOARD_LOW_PITCH; pitch <= KEYBOARD_HIGH_PITCH; pitch++) {
        const black = isBlackKey(pitch);
        const note = pitchName(pitch);
        // `null` on a kit outside GM's 35–81, and that is the honest answer: an
        // unlabelled key on a kit board is one the map has no sound for. It is
        // still playable — the sampler repitches its nearest neighbour — but
        // naming it would be inventing a drum.
        const sound = drum ? drumSoundForPitch(pitch) : null;

        keys.push({
            pitch,
            black,
            // A black key straddles the seam between the two white keys it sits
            // between, and `whitesBelow` is exactly where that seam is.
            x: black
                ? whitesBelow * whiteWidth - blackWidth / 2
                : whitesBelow * whiteWidth,
            width: black ? blackWidth : whiteWidth,
            height: black ? blackHeight : whiteHeight,
            typed: keysForPitch(pitch, typingOctave),
            // Every white key named, the way both reference keyboards do it, so
            // the player is never counting up from a distant C. The octave
            // number rides on the C alone — on all seven it is noise.
            // Two characters on a black key, three on a white — a black key is
            // 60% of a white one and a three-character cap does not fit it.
            label: drum
                ? (sound ? drumCapLabel(sound, black) : null)
                : black ? null : (pitch % 12 === 0 ? note : note.slice(0, -1)),
            name: sound?.name ?? note,
            inWindow: pitch >= windowLow && pitch <= windowHigh,
        });

        if (!black) whitesBelow++;
    }

    const boardWidth = WHITE_KEY_COUNT * whiteWidth;

    // Both ends of the window are a C, so both are white and both are the full
    // key width — no need to hunt for the edge of a black key.
    const lowKey = keys.find((key) => key.pitch === windowLow);
    const highKey = keys.find((key) => key.pitch === windowHigh);
    const windowX = lowKey?.x ?? 0;
    const windowEnd = highKey ? highKey.x + highKey.width : boardWidth;

    return {
        keys,
        whiteWidth,
        whiteHeight,
        width: boardWidth,
        // The press travel lives inside the reserved height on purpose. A box
        // sized to exactly the key height has no slack in the block axis, and
        // `overflow-x: auto` forces `overflow-y: auto` with it, so one pixel of
        // overflow raises a scrollbar that narrows the box and re-centres the
        // keyboard under the cursor. That was the layout shift on click.
        height: RAIL_HEIGHT + whiteHeight + KEY_PRESS_TRAVEL,
        offsetX: Math.max(0, Math.round((width - boardWidth) / 2)),
        windowX,
        windowWidth: Math.max(0, windowEnd - windowX),
    };
}
