// ============================================
// ComposeYogi — General MIDI Percussion
// ============================================
//
// Which drum a pitch is. The counterpart to `pitch.ts`: that module says what a
// pitch is *called*, and on a drum track the answer is not "C3" but "Hi-Mid
// Tom", because a kit lane's notes are General MIDI percussion slots rather
// than positions on a scale.
//
// It lives here because it is a **musical fact**, and this repo has now been
// bitten three times by musical facts that lived in a component:
//
//   - `SCALE_INTERVALS` was private inside `PianoRoll.tsx`, so Harmonic Minor
//     highlighted natural minor.
//   - The octave was computed by a bare division in two places, so the app was
//     an octave out and offered a C1 that was really 16.35 Hz. (Written out,
//     that expression would trip the guard in `tests/music.test.ts` that now
//     stops it coming back — see `pitch.ts`.)
//   - This map was private inside `DrumSequencer.tsx` — while the six sampler
//     kits carried their own copy in *note names* and `demo-templates.ts` a
//     third in a seven-entry literal. **Two of those three disagreed**, by a
//     whole octave, and the disagreement was audible: every kick in the app
//     played an open hi-hat. See `synth-presets.ts`.
//
// Imports nothing but a type, so it is testable and cannot drag Tone into a
// unit test.
//
// The order of `GM_PERCUSSION` is the drum sequencer's row order — grouped the
// way a kit is laid out (kicks, snares, toms, hats, cymbals, then hand
// percussion) rather than by pitch, because a drummer reads a kit, not a
// keyboard. `drumSoundForPitch` is what everything else should use.

import type { DrumFamily } from '@/lib/design/tokens';

/** The lowest and highest pitch General MIDI assigns a percussion sound. */
export const GM_PERCUSSION_LOW = 35;
export const GM_PERCUSSION_HIGH = 81;

export interface DrumSound {
    /** Stable slug. The key callers name a pitch by, so no one writes 36 twice. */
    id: string;
    name: string;
    /** Three characters, for a lane rail or a key too narrow for the name. */
    shortName: string;
    pitch: number;
    /** Kit family — drives the lane colour via `DRUM_BG`. See `lib/design/tokens.ts`. */
    family: DrumFamily;
}

/**
 * Every General MIDI percussion sound, in kit order.
 *
 * `as const satisfies` rather than a plain annotation: the `satisfies` half
 * type-checks each entry, and the `const` half is what lets `DrumSoundId` be the
 * union of the ids actually written here — so `DRUM_PITCH.kick` is checked by
 * the compiler and a typo is a build failure rather than an `undefined` pitch
 * that silently plays nothing.
 */
export const GM_PERCUSSION = [
    // Kicks (35-36)
    { id: 'acousticBassDrum', name: 'Acoustic Bass Drum', shortName: 'BD1', pitch: 35, family: 'kick' },
    { id: 'kick', name: 'Bass Drum 1', shortName: 'BD2', pitch: 36, family: 'kick' },

    // Snares & Rim (37-40)
    { id: 'sideStick', name: 'Side Stick', shortName: 'STK', pitch: 37, family: 'snare' },
    { id: 'snare', name: 'Acoustic Snare', shortName: 'SN1', pitch: 38, family: 'snare' },
    { id: 'handClap', name: 'Hand Clap', shortName: 'CLP', pitch: 39, family: 'snare' },
    { id: 'electricSnare', name: 'Electric Snare', shortName: 'SN2', pitch: 40, family: 'snare' },

    // Toms (41, 43, 45, 47, 48, 50)
    { id: 'lowFloorTom', name: 'Low Floor Tom', shortName: 'LFT', pitch: 41, family: 'tom' },
    { id: 'highFloorTom', name: 'High Floor Tom', shortName: 'HFT', pitch: 43, family: 'tom' },
    { id: 'lowTom', name: 'Low Tom', shortName: 'LTM', pitch: 45, family: 'tom' },
    { id: 'lowMidTom', name: 'Low-Mid Tom', shortName: 'LMT', pitch: 47, family: 'tom' },
    { id: 'hiMidTom', name: 'Hi-Mid Tom', shortName: 'HMT', pitch: 48, family: 'tom' },
    { id: 'highTom', name: 'High Tom', shortName: 'HTM', pitch: 50, family: 'tom' },

    // Hi-Hats (42, 44, 46)
    { id: 'closedHat', name: 'Closed Hi-Hat', shortName: 'CHH', pitch: 42, family: 'hat' },
    { id: 'pedalHat', name: 'Pedal Hi-Hat', shortName: 'PHH', pitch: 44, family: 'hat' },
    { id: 'openHat', name: 'Open Hi-Hat', shortName: 'OHH', pitch: 46, family: 'hat' },

    // Cymbals (49, 51, 52, 53, 55, 57, 59)
    { id: 'crash', name: 'Crash Cymbal 1', shortName: 'CR1', pitch: 49, family: 'cymbal' },
    { id: 'ride', name: 'Ride Cymbal 1', shortName: 'RD1', pitch: 51, family: 'cymbal' },
    { id: 'chineseCymbal', name: 'Chinese Cymbal', shortName: 'CHN', pitch: 52, family: 'cymbal' },
    { id: 'rideBell', name: 'Ride Bell', shortName: 'RBL', pitch: 53, family: 'cymbal' },
    { id: 'splashCymbal', name: 'Splash Cymbal', shortName: 'SPL', pitch: 55, family: 'cymbal' },
    { id: 'crash2', name: 'Crash Cymbal 2', shortName: 'CR2', pitch: 57, family: 'cymbal' },
    { id: 'ride2', name: 'Ride Cymbal 2', shortName: 'RD2', pitch: 59, family: 'cymbal' },

    // Latin - Bongos & Congas (60-64)
    { id: 'hiBongo', name: 'Hi Bongo', shortName: 'HBG', pitch: 60, family: 'perc' },
    { id: 'lowBongo', name: 'Low Bongo', shortName: 'LBG', pitch: 61, family: 'perc' },
    { id: 'muteHiConga', name: 'Mute Hi Conga', shortName: 'MHC', pitch: 62, family: 'perc' },
    { id: 'openHiConga', name: 'Open Hi Conga', shortName: 'OHC', pitch: 63, family: 'perc' },
    { id: 'lowConga', name: 'Low Conga', shortName: 'LCG', pitch: 64, family: 'perc' },

    // Latin - Timbales (65-66)
    { id: 'highTimbale', name: 'High Timbale', shortName: 'HTB', pitch: 65, family: 'perc' },
    { id: 'lowTimbale', name: 'Low Timbale', shortName: 'LTB', pitch: 66, family: 'perc' },

    // Latin - Agogo & Bells (67-68, 56, 58)
    { id: 'highAgogo', name: 'High Agogo', shortName: 'HAG', pitch: 67, family: 'perc' },
    { id: 'lowAgogo', name: 'Low Agogo', shortName: 'LAG', pitch: 68, family: 'perc' },
    { id: 'cowbell', name: 'Cowbell', shortName: 'COW', pitch: 56, family: 'perc' },
    // 58 was simply missing while this list lived in the sequencer, which is how
    // a "full GM percussion set" comment sat above 46 of the 47 slots.
    { id: 'vibraslap', name: 'Vibraslap', shortName: 'VBS', pitch: 58, family: 'perc' },

    // Shakers & Tambourine (54, 69-71)
    { id: 'tambourine', name: 'Tambourine', shortName: 'TMB', pitch: 54, family: 'perc' },
    { id: 'cabasa', name: 'Cabasa', shortName: 'CAB', pitch: 69, family: 'perc' },
    { id: 'maracas', name: 'Maracas', shortName: 'MRC', pitch: 70, family: 'perc' },
    { id: 'shortWhistle', name: 'Short Whistle', shortName: 'SWH', pitch: 71, family: 'perc' },

    // More Percussion (72-81)
    { id: 'longWhistle', name: 'Long Whistle', shortName: 'LWH', pitch: 72, family: 'perc' },
    { id: 'shortGuiro', name: 'Short Guiro', shortName: 'SGU', pitch: 73, family: 'perc' },
    { id: 'longGuiro', name: 'Long Guiro', shortName: 'LGU', pitch: 74, family: 'perc' },
    { id: 'claves', name: 'Claves', shortName: 'CLV', pitch: 75, family: 'perc' },
    { id: 'hiWoodBlock', name: 'Hi Wood Block', shortName: 'HWB', pitch: 76, family: 'perc' },
    { id: 'lowWoodBlock', name: 'Low Wood Block', shortName: 'LWB', pitch: 77, family: 'perc' },
    { id: 'muteCuica', name: 'Mute Cuica', shortName: 'MCU', pitch: 78, family: 'perc' },
    { id: 'openCuica', name: 'Open Cuica', shortName: 'OCU', pitch: 79, family: 'perc' },
    { id: 'muteTriangle', name: 'Mute Triangle', shortName: 'MTR', pitch: 80, family: 'perc' },
    { id: 'openTriangle', name: 'Open Triangle', shortName: 'OTR', pitch: 81, family: 'perc' },
] as const satisfies readonly DrumSound[];

/** The slug of every sound above — a union, so a call site's typo cannot compile. */
export type DrumSoundId = (typeof GM_PERCUSSION)[number]['id'];

/**
 * A sound's pitch, by name.
 *
 * This is what a sampler's URL map and a template's pattern should be keyed by.
 * **Never a note name**: `C1` is MIDI 24 in the scientific notation Tone parses,
 * and every kit in this app spent six months claiming it was 36.
 */
export const DRUM_PITCH = Object.fromEntries(
    GM_PERCUSSION.map((sound) => [sound.id, sound.pitch])
) as Record<DrumSoundId, number>;

/**
 * Two-character caps for the drums that land on a black key.
 *
 * A black key is 60% of a white one — 14px when the whites are 23, which is
 * every laptop with both side panels open — and a three-character cap at the
 * bottom of the type scale measures 17px. It was clipping at both ends: "CR1"
 * and "RD1" lost a quarter of their outer glyphs, which on a strip that has
 * already been rejected three times for looking unfinished is not a detail.
 *
 * So a black key gets two characters. **Predictably two**, not "three when they
 * fit" — a cap that grows and shrinks as you drag a panel is worse than a short
 * one, and the widths this has to survive run from 11px to 23px.
 *
 * The first two characters of the short name, except where that would collide
 * with another black-key drum. Both collisions are real and both are here; the
 * test derives the required set rather than trusting this list.
 */
const BLACK_KEY_CAPS: Partial<Record<DrumSoundId, string>> = {
    openHiConga: 'OC',  // 'OH' belongs to the open hi-hat
    claves: 'CV',       // 'CL' belongs to the hand clap
};

/**
 * What to print on a key: three characters on a white one, two on a black.
 *
 * `black` rather than a width, because the caller that has the width is the one
 * that cannot be unit-tested. The two key shapes have a fixed ratio, so the
 * shape is the width, and this stays arithmetic a test can reach.
 */
export function drumCapLabel(sound: DrumSound, black: boolean): string {
    if (!black) return sound.shortName;
    // The cast is the one place `DrumSound.id` widens to `string` — the
    // interface cannot name `DrumSoundId` without a cycle, since that union is
    // derived from the array that satisfies this interface. The keys of
    // `BLACK_KEY_CAPS` are still checked, and the test proves the set is exactly
    // the collisions that need one.
    return BLACK_KEY_CAPS[sound.id as DrumSoundId] ?? sound.shortName.slice(0, 2);
}

const BY_PITCH = new Map<number, DrumSound>(
    GM_PERCUSSION.map((sound) => [sound.pitch, sound])
);

/** The drum at a pitch, or `null` outside General MIDI's percussion range. */
export function drumSoundForPitch(pitch: number): DrumSound | null {
    return BY_PITCH.get(pitch) ?? null;
}

/**
 * The drums a 25-key typing window reaches, named at both ends.
 *
 * The live bar's readout on a kit. `C3–C5` is a true statement about pitch and
 * a meaningless one about a drum kit — it sat above keys reading BD2 and CHH,
 * which is two languages in one bar. This is the same information in the
 * keyboard's own language.
 *
 * Both ends are the first and last *mapped* drum in the window, not the window's
 * own end pitches: a window can start below 35 or run past 81, and `—` at one
 * end would say the range is open when it is not. GM's 35–81 overlaps every
 * window the typing octaves allow, so there is always an answer.
 */
export function drumWindowRange(low: number, high: number): { from: string; to: string } | null {
    const inside = GM_PERCUSSION
        .filter((sound) => sound.pitch >= low && sound.pitch <= high)
        .sort((a, b) => a.pitch - b.pitch);
    if (!inside.length) return null;
    return { from: inside[0].shortName, to: inside[inside.length - 1].shortName };
}
