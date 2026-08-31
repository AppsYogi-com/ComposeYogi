// ============================================
// ComposeYogi — Sampled Drum Kits
// ============================================
//
// The six `Tone.Sampler` kits as **plain data**, for the reason
// `preset-specs.ts` exists: Tone cannot be constructed under vitest, so
// anything that touches it cannot be tested at all. A kit written as six
// near-identical factories is a sound nothing can check.
//
// What that cost, and it is the whole reason this file exists: the kits shipped
// keyed by **note name** from v1.0 until Sprint 8.7.6i, an octave below the
// pitches everything else writes, so every kick played an open hi-hat. Then the
// fix for it — moving `perc-shaker.wav` off the ride slot — survived a
// deliberate revert with all 636 tests green, because nothing anywhere could
// see what a kit mapped. Data can be tested; a closure cannot.
//
// Two rules are enforced in `tests/music.test.ts`:
//
//   - **A sample only goes in a slot of its own family.** `SAMPLE_FAMILY` says
//     what each file actually is, `GM_PERCUSSION` says what each slot wants, and
//     a shaker in the ride slot is the exact mismatch that guard catches. It is
//     also why no kit maps a ride: the only sustained cymbal here is a hi-hat,
//     and filing `hihat-open.wav` under Ride Cymbal 1 would be the same lie in
//     the other direction. An unmapped slot repitches off its nearest
//     neighbour, which after the shaker moved is a cymbal.
//   - **Every file named here exists on disk.** A missing WAV is a 404 and a
//     silent slot at runtime, and nothing else would notice.
//
// Measured after the move: 32 of the 47 slots now resolve to a sample of their
// own family, and every cymbal picks up the open hi-hat — which is a cymbal,
// whatever the lane-colour taxonomy calls it. **One slot still crosses:** Ride
// Cymbal 2 (59) sits closer to Maracas (70) than to the open hat (46), so it
// gets the shaker. There is no cymbal sample to give it, and mapping the hi-hat
// into a ride slot is the rule above. It is the content gap showing through,
// not a mapping to fix.

import { DRUM_PITCH, type DrumSoundId } from '@/lib/music/percussion';

import type { DrumFamily } from '@/lib/design/tokens';

export interface DrumKit {
    /** Folder the samples live in, under `public/`. */
    baseUrl: string;
    /** Tone's release time, in seconds. Shorter reads as a tighter kit. */
    release: number;
    /** Which file plays which General MIDI slot. */
    samples: Partial<Record<DrumSoundId, string>>;
}

/**
 * What each sample actually is.
 *
 * Not derivable from the file name: `perc-rim.wav` is a side stick, which is a
 * **snare** sound — it is the rim of the snare drum — while `perc-shaker.wav`
 * is hand percussion. The `perc-` prefix says where they were filed, not what
 * they are.
 */
export const SAMPLE_FAMILY: Record<string, DrumFamily> = {
    'kick-808.wav': 'kick',
    'kick-deep.wav': 'kick',
    'kick-punchy.wav': 'kick',
    'kick-sub.wav': 'kick',
    'snare-crisp.wav': 'snare',
    'snare-punchy.wav': 'snare',
    'snare-lofi.wav': 'snare',
    'snare-clap.wav': 'snare',
    'perc-rim.wav': 'snare',
    'hihat-closed.wav': 'hat',
    'hihat-pedal.wav': 'hat',
    'hihat-open.wav': 'hat',
    'perc-shaker.wav': 'perc',
};

const DRUMS = '/samples/drums/';
const DRUMS_PUNCHY = '/samples/drums-punchy/';

/**
 * The kits.
 *
 * `Record<…, DrumKit>` over the six sampler ids, so adding a sampler preset
 * without a kit fails to compile rather than falling back to silence.
 */
export const DRUM_KITS: Record<
    'drum-sampler' | 'punchy-kit' | '808-kit' | 'acoustic-kit' | 'lofi-kit' | 'electronic-kit',
    DrumKit
> = {
    // The default kit — the one every demo template plays.
    'drum-sampler': {
        baseUrl: DRUMS,
        release: 0.5,
        samples: {
            acousticBassDrum: 'kick-808.wav',
            kick: 'kick-deep.wav',
            sideStick: 'perc-rim.wav',
            snare: 'snare-crisp.wav',
            handClap: 'snare-clap.wav',
            electricSnare: 'snare-clap.wav',
            closedHat: 'hihat-closed.wav',
            pedalHat: 'hihat-pedal.wav',
            openHat: 'hihat-open.wav',
            maracas: 'perc-shaker.wav',
        },
    },

    // Tight attack, and the only kit with its own sample folder.
    'punchy-kit': {
        baseUrl: DRUMS_PUNCHY,
        release: 0.3,
        samples: {
            acousticBassDrum: 'kick-sub.wav',
            kick: 'kick-punchy.wav',
            sideStick: 'perc-rim.wav',
            snare: 'snare-punchy.wav',
            handClap: 'snare-clap.wav',
            electricSnare: 'snare-clap.wav',
            closedHat: 'hihat-closed.wav',
            pedalHat: 'hihat-pedal.wav',
            openHat: 'hihat-open.wav',
            maracas: 'perc-shaker.wav',
        },
    },

    // Deep sub kick, clap for a snare.
    '808-kit': {
        baseUrl: DRUMS,
        release: 0.5,
        samples: {
            acousticBassDrum: 'kick-808.wav',
            kick: 'kick-808.wav',
            sideStick: 'perc-rim.wav',
            snare: 'snare-clap.wav',
            handClap: 'snare-clap.wav',
            electricSnare: 'snare-clap.wav',
            closedHat: 'hihat-closed.wav',
            pedalHat: 'hihat-pedal.wav',
            openHat: 'hihat-open.wav',
            maracas: 'perc-shaker.wav',
        },
    },

    'acoustic-kit': {
        baseUrl: DRUMS,
        release: 0.5,
        samples: {
            acousticBassDrum: 'kick-punchy.wav',
            kick: 'kick-deep.wav',
            sideStick: 'perc-rim.wav',
            snare: 'snare-crisp.wav',
            handClap: 'snare-clap.wav',
            electricSnare: 'snare-crisp.wav',
            closedHat: 'hihat-closed.wav',
            pedalHat: 'hihat-pedal.wav',
            openHat: 'hihat-open.wav',
            maracas: 'perc-shaker.wav',
        },
    },

    'lofi-kit': {
        baseUrl: DRUMS,
        release: 0.3,
        samples: {
            acousticBassDrum: 'kick-deep.wav',
            kick: 'kick-deep.wav',
            sideStick: 'perc-rim.wav',
            snare: 'snare-lofi.wav',
            handClap: 'snare-clap.wav',
            electricSnare: 'snare-clap.wav',
            // The pedal sample on the closed hat, deliberately: muted is the point.
            closedHat: 'hihat-pedal.wav',
            pedalHat: 'hihat-pedal.wav',
            openHat: 'hihat-open.wav',
            maracas: 'perc-shaker.wav',
        },
    },

    'electronic-kit': {
        baseUrl: DRUMS,
        release: 0.4,
        samples: {
            acousticBassDrum: 'kick-808.wav',
            kick: 'kick-punchy.wav',
            sideStick: 'perc-rim.wav',
            snare: 'snare-clap.wav',
            handClap: 'snare-clap.wav',
            electricSnare: 'snare-crisp.wav',
            closedHat: 'hihat-closed.wav',
            pedalHat: 'hihat-pedal.wav',
            openHat: 'hihat-open.wav',
            maracas: 'perc-shaker.wav',
        },
    },
};

/**
 * The sampler kits.
 *
 * `createKit` in `synth-presets.ts` takes this, which is what ties the two
 * together: a preset naming a kit that is not here does not compile, and a kit
 * here that no preset builds is dead code a reader can see. There is
 * deliberately no `DrumKitId extends SynthPresetId` alias — a conditional type
 * assigned to nothing checks nothing, and this repo has enough guards that only
 * look like guards.
 */
export type DrumKitId = keyof typeof DRUM_KITS;

/**
 * A kit's slots as the MIDI numbers `Tone.Sampler` wants.
 *
 * **Numbers, never note names.** `SamplesMap` takes `[midi: number]` as a
 * first-class key; a note name is an octave trap, and this app fell in it for
 * its whole life. See `percussion.ts`.
 */
export function kitUrls(kit: DrumKit): Record<number, string> {
    const urls: Record<number, string> = {};
    for (const [slot, file] of Object.entries(kit.samples)) {
        urls[DRUM_PITCH[slot as DrumSoundId]] = file;
    }
    return urls;
}
