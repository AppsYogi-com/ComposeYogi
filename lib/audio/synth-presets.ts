// ============================================
// ComposeYogi — Synth Presets
// ============================================
//
// The instrument library: 64 presets, and the construction of a Tone voice from
// a spec.
//
// The 52 melodic presets are built from `preset-specs.ts` rather than from
// hand-written factories. They used to be factories — one `createX()` per
// preset, each constructing a Tone node and returning it — which made the
// library's *sound* unreadable to the rest of the app: "start from the Electric
// Piano" is not implementable when the Electric Piano is a closure. Writing
// specs alongside the factories would have been a second source of truth for 52
// sounds, drifting the first time anyone edited one, so the factories are gone.
//
// The 12 drum kits stay bespoke: Samplers, MembraneSynths and a NoiseSynth are a
// different construction with a different parameter space, and a custom drum kit
// is a different feature (a kit is a mapping of pieces, not a voice).
//
// This file knows nothing about custom instruments — see `custom-instruments.ts`.
// User content is resolved one layer up, in the scheduler, so the built-in
// library never imports IndexedDB-backed state.

import * as Tone from 'tone';

import { voiceOptions } from './instrument-spec';
import { PRESET_SPECS } from './preset-specs';

import type { InstrumentSpec, InstrumentVoice } from '@/types';

// ============================================
// Types
// ============================================

// Union type for all synths we might create
export type SynthType = Tone.PolySynth | Tone.MonoSynth | Tone.MembraneSynth | Tone.NoiseSynth | Tone.Sampler;

/**
 * A constructed instrument, ready to schedule.
 *
 * `synth` and `output` are separate because a custom instrument's Brightness is
 * a filter node *after* the voice: the scheduler triggers notes on `synth` (and
 * branches on its class for polyphony and pitch), but must connect `output`, or
 * the filter is built, wired to nothing, and silently bypassed. For every
 * built-in the two are the same object.
 */
export interface ResolvedInstrument {
    synth: SynthType;
    /** Where the instrument's audio leaves. Connect this, never `synth`. */
    output: Tone.ToneAudioNode;
    /** Extra nodes the caller must dispose alongside the synth. */
    nodes: Tone.ToneAudioNode[];
}

export interface SynthPreset {
    id: string;
    name: string;
    category: 'synth' | 'keys' | 'bass' | 'pad' | 'lead' | 'drums' | 'idiophones' | 'plucked-strings' | 'bowed-strings' | 'wind';
    createSynth: () => SynthType;
}

// ============================================
// Voices
// ============================================

/**
 * The four Tone classes a spec's `voice` can name.
 *
 * Every melodic preset in the library is a PolySynth wrapping one of these, so
 * this map plus `voiceOptions()` is the whole of how a sound gets built. Get an
 * entry wrong and thirteen instruments change character at once while every
 * options test still passes — which is why the golden fixture records the voice
 * name alongside the options, and the test checks both.
 */
const VOICE_CONSTRUCTORS = {
    synth: Tone.Synth,
    monosynth: Tone.MonoSynth,
    fmsynth: Tone.FMSynth,
    amsynth: Tone.AMSynth,
} as const satisfies Record<InstrumentVoice, unknown>;

/**
 * Build a voice from a spec — the only place a melodic instrument is
 * constructed, whether it is one of the 52 built-ins or something a user made.
 *
 * Falls back to a plain synth on a null spec rather than throwing. That branch
 * is unreachable (`tests/instrument-spec.test.ts` proves every customizable
 * preset has one) but a missing sound is a recoverable disappointment and a
 * throw here would take the whole schedule down with it.
 */
export function createVoice(spec: InstrumentSpec | null | undefined): Tone.PolySynth {
    if (!spec) return new Tone.PolySynth(Tone.Synth);

    const voice = VOICE_CONSTRUCTORS[spec.voice] ?? Tone.Synth;
    // Tone's PolySynth generic cannot express "one of these four", and the
    // options shape genuinely differs per voice. The pairing is what the golden
    // test checks, so the cast is asserting something that is verified.
    const synth = new Tone.PolySynth(
        voice as typeof Tone.Synth,
        voiceOptions(spec) as ConstructorParameters<typeof Tone.Synth>[0]
    );

    if (spec.level !== 0) synth.volume.value = spec.level;
    return synth;
}

/** A built-in preset's `createSynth`, resolved from its spec at call time. */
const fromSpec = (presetId: string) => (): SynthType =>
    createVoice((PRESET_SPECS as Record<string, InstrumentSpec | null>)[presetId]);

// ============================================
// Synth Factory Functions
// ============================================

// Drum Sampler - Maps GM drum pitches to actual samples
// GM Drum mapping: 36=kick, 38=snare, 42=closed hat, 46=open hat, 37=rim, 39=clap
const createDrumSampler = (): Tone.Sampler => {
    const sampler = new Tone.Sampler({
        urls: {
            // Kicks (GM: 35-36)
            C1: 'kick-deep.wav',      // 36 - Kick
            B0: 'kick-808.wav',       // 35 - Acoustic Bass Drum
            // Snares (GM: 38-40)
            D1: 'snare-crisp.wav',    // 38 - Snare
            E1: 'snare-clap.wav',     // 40 - Electric Snare / Clap
            // Rim (GM: 37)
            'C#1': 'perc-rim.wav',    // 37 - Side Stick
            // Hi-hats (GM: 42, 44, 46)
            'F#1': 'hihat-closed.wav', // 42 - Closed Hi-Hat
            'G#1': 'hihat-pedal.wav',  // 44 - Pedal Hi-Hat
            'A#1': 'hihat-open.wav',   // 46 - Open Hi-Hat
            // Shaker
            'D#2': 'perc-shaker.wav',  // 51 - Ride Cymbal (using shaker)
        },
        baseUrl: '/samples/drums/',
        release: 0.5,
    });
    return sampler;
};

// Punchy Drum - Fully synthesized punchy kit with its own unique samples
const createPunchyKit = (): Tone.Sampler => {
    return new Tone.Sampler({
        urls: {
            C1: 'kick-punchy.wav',     // 36 - Kick (tight punchy)
            B0: 'kick-sub.wav',        // 35 - Bass Drum (sub)
            D1: 'snare-punchy.wav',    // 38 - Snare (punchy)
            E1: 'snare-clap.wav',      // 40 - Clap
            'C#1': 'perc-rim.wav',     // 37 - Rim shot
            'F#1': 'hihat-closed.wav', // 42 - Closed Hi-Hat
            'G#1': 'hihat-pedal.wav',  // 44 - Pedal Hi-Hat
            'A#1': 'hihat-open.wav',   // 46 - Open Hi-Hat
            'D#2': 'perc-shaker.wav',  // 51 - Shaker
        },
        baseUrl: '/samples/drums-punchy/',
        release: 0.3,
    });
};

// 808 Kit - Deep sub kick, clap snare, tight hats
const create808Kit = (): Tone.Sampler => {
    return new Tone.Sampler({
        urls: {
            C1: 'kick-808.wav',       // 36 - Kick (808)
            B0: 'kick-808.wav',       // 35 - Bass Drum
            D1: 'snare-clap.wav',     // 38 - Snare (clap)
            E1: 'snare-clap.wav',     // 40 - Electric Snare
            'C#1': 'perc-rim.wav',    // 37 - Side Stick
            'F#1': 'hihat-closed.wav', // 42 - Closed Hi-Hat
            'G#1': 'hihat-pedal.wav',  // 44 - Pedal Hi-Hat
            'A#1': 'hihat-open.wav',   // 46 - Open Hi-Hat
            'D#2': 'perc-shaker.wav',  // 51
        },
        baseUrl: '/samples/drums/',
        release: 0.5,
    });
};

// Acoustic Kit - Natural, punchy acoustic sounds
const createAcousticKit = (): Tone.Sampler => {
    return new Tone.Sampler({
        urls: {
            C1: 'kick-deep.wav',       // 36 - Kick (deep acoustic)
            B0: 'kick-punchy.wav',     // 35 - Bass Drum (punchy)
            D1: 'snare-crisp.wav',     // 38 - Snare (crisp acoustic)
            E1: 'snare-crisp.wav',     // 40 - Electric Snare
            'C#1': 'perc-rim.wav',     // 37 - Side Stick
            'F#1': 'hihat-closed.wav', // 42 - Closed Hi-Hat
            'G#1': 'hihat-pedal.wav',  // 44 - Pedal Hi-Hat
            'A#1': 'hihat-open.wav',   // 46 - Open Hi-Hat
            'D#2': 'perc-shaker.wav',  // 51
        },
        baseUrl: '/samples/drums/',
        release: 0.5,
    });
};

// Lo-Fi Kit - Muted, dusty character
const createLoFiKit = (): Tone.Sampler => {
    return new Tone.Sampler({
        urls: {
            C1: 'kick-deep.wav',       // 36 - Kick (muffled deep)
            B0: 'kick-deep.wav',       // 35 - Bass Drum
            D1: 'snare-lofi.wav',      // 38 - Snare (lo-fi)
            E1: 'snare-clap.wav',      // 40 - Clap
            'C#1': 'perc-rim.wav',     // 37 - Side Stick
            'F#1': 'hihat-pedal.wav',  // 42 - Closed Hi-Hat (muted pedal)
            'G#1': 'hihat-pedal.wav',  // 44 - Pedal Hi-Hat
            'A#1': 'hihat-open.wav',   // 46 - Open Hi-Hat
            'D#2': 'perc-shaker.wav',  // 51
        },
        baseUrl: '/samples/drums/',
        release: 0.3,
    });
};

// Electronic Kit - Punchy, tight, modern
const createElectronicKit = (): Tone.Sampler => {
    return new Tone.Sampler({
        urls: {
            C1: 'kick-punchy.wav',     // 36 - Kick (punchy)
            B0: 'kick-808.wav',        // 35 - Bass Drum (808 sub)
            D1: 'snare-clap.wav',      // 38 - Snare (clap)
            E1: 'snare-crisp.wav',     // 40 - Electric Snare
            'C#1': 'perc-rim.wav',     // 37 - Side Stick
            'F#1': 'hihat-closed.wav', // 42 - Closed Hi-Hat
            'G#1': 'hihat-pedal.wav',  // 44 - Pedal Hi-Hat
            'A#1': 'hihat-open.wav',   // 46 - Open Hi-Hat
            'D#2': 'perc-shaker.wav',  // 51
        },
        baseUrl: '/samples/drums/',
        release: 0.4,
    });
};

/**
 * Wait for a synth to be ready (mainly for Sampler which loads async)
 */
export async function waitForSynthReady(synth: SynthType): Promise<void> {
    if (synth instanceof Tone.Sampler) {
        // Wait for all buffers to load
        await Tone.loaded();
    }
    // Other synth types are ready immediately
}

// ============================================
// Mallet / Pitched Percussion
// ============================================

// ============================================
// Plucked Strings
// ============================================

// ============================================
// Bowed Strings
// ============================================

// ============================================
// Woodwinds
// ============================================

// ============================================
// Brass
// ============================================

// Synth Drum Kit — punchier, more tonal variety than Classic Drum
const createSynthDrumKit = (): Tone.MembraneSynth => {
    return new Tone.MembraneSynth({
        pitchDecay: 0.08,
        octaves: 6,
        oscillator: { type: 'triangle' },
        envelope: {
            attack: 0.001,
            decay: 0.25,
            sustain: 0,
            release: 0.08,
        },
    });
};

// Legacy drum synth for fallback (simpler, no samples needed)
const createDrumSynth = (): Tone.MembraneSynth => {
    return new Tone.MembraneSynth({
        pitchDecay: 0.05,
        octaves: 4,
        oscillator: { type: 'sine' },
        envelope: {
            attack: 0.001,
            decay: 0.4,
            sustain: 0,
            release: 0.1,
        },
    });
};

// Bongos — high-pitched pair of hand drums, short tonal decay
const createBongos = (): Tone.MembraneSynth => {
    return new Tone.MembraneSynth({
        pitchDecay: 0.03,
        octaves: 3,
        oscillator: { type: 'sine' },
        envelope: {
            attack: 0.001,
            decay: 0.15,
            sustain: 0,
            release: 0.05,
        },
    });
};

// Wooden Block — sharp, clicky percussive crack
const createWoodenBlock = (): Tone.MembraneSynth => {
    return new Tone.MembraneSynth({
        pitchDecay: 0.008,
        octaves: 2,
        oscillator: { type: 'square' },
        envelope: {
            attack: 0.001,
            decay: 0.06,
            sustain: 0,
            release: 0.02,
        },
    });
};

// ============================================
// Basic Waveform Synths — pure oscillator PolySynths
// ============================================

// ============================================
// Euphonium — warm, mellow low-brass PolySynth
// ============================================

// ============================================
// Taiko — deep resonant Japanese drum (no samples)
// ============================================

const createTaiko = (): Tone.MembraneSynth => {
    return new Tone.MembraneSynth({
        pitchDecay: 0.08,
        octaves: 4,
        oscillator: { type: 'sine' },
        envelope: {
            attack: 0.001,
            decay: 0.6,
            sustain: 0,
            release: 0.4,
        },
    });
};

// ============================================
// Maracas — shaker noise burst (no samples)
// ============================================

const createMaracas = (): Tone.NoiseSynth => {
    return new Tone.NoiseSynth({
        noise: { type: 'white' },
        envelope: {
            attack: 0.001,
            decay: 0.05,
            sustain: 0,
            release: 0.02,
        },
    });
};

// ============================================
// Preset Registry
// ============================================

// `satisfies` rather than a type annotation: an annotation of
// Record<string, SynthPreset> widens the keys to `string` and SynthPresetId
// below would be useless. `satisfies` checks the shape while keeping the
// literal ids, which is what makes INSTRUMENT_META provably exhaustive.
export const SYNTH_PRESETS = {
    // Keys
    'electric-piano': {
        id: 'electric-piano',
        name: 'Electric Piano',
        category: 'keys',
        createSynth: fromSpec('electric-piano'),
    },
    'bright-piano': {
        id: 'bright-piano',
        name: 'Bright Piano',
        category: 'keys',
        createSynth: fromSpec('bright-piano'),
    },
    'harpsichord': {
        id: 'harpsichord',
        name: 'Harpsichord',
        category: 'keys',
        createSynth: fromSpec('harpsichord'),
    },
    'organ': {
        id: 'organ',
        name: 'Organ',
        category: 'keys',
        createSynth: fromSpec('organ'),
    },
    'clavinet': {
        id: 'clavinet',
        name: 'Clavinet',
        category: 'keys',
        createSynth: fromSpec('clavinet'),
    },

    // Bass
    'sub-bass': {
        id: 'sub-bass',
        name: 'Sub Bass',
        category: 'bass',
        createSynth: fromSpec('sub-bass'),
    },
    'synth-bass': {
        id: 'synth-bass',
        name: 'Synth Bass',
        category: 'bass',
        createSynth: fromSpec('synth-bass'),
    },
    'fm-bass': {
        id: 'fm-bass',
        name: 'FM Bass',
        category: 'bass',
        createSynth: fromSpec('fm-bass'),
    },
    'pluck-bass': {
        id: 'pluck-bass',
        name: 'Pluck Bass',
        category: 'bass',
        createSynth: fromSpec('pluck-bass'),
    },

    // Leads
    'saw-lead': {
        id: 'saw-lead',
        name: 'Saw Lead',
        category: 'lead',
        createSynth: fromSpec('saw-lead'),
    },
    'square-lead': {
        id: 'square-lead',
        name: 'Square Lead',
        category: 'lead',
        createSynth: fromSpec('square-lead'),
    },
    'fm-lead': {
        id: 'fm-lead',
        name: 'FM Lead',
        category: 'lead',
        createSynth: fromSpec('fm-lead'),
    },
    'pulse-lead': {
        id: 'pulse-lead',
        name: 'Pulse Lead',
        category: 'lead',
        createSynth: fromSpec('pulse-lead'),
    },

    // Pads
    'warm-pad': {
        id: 'warm-pad',
        name: 'Warm Pad',
        category: 'pad',
        createSynth: fromSpec('warm-pad'),
    },
    'string-pad': {
        id: 'string-pad',
        name: 'String Pad',
        category: 'pad',
        createSynth: fromSpec('string-pad'),
    },
    'choir-pad': {
        id: 'choir-pad',
        name: 'Choir Pad',
        category: 'pad',
        createSynth: fromSpec('choir-pad'),
    },
    'glass-pad': {
        id: 'glass-pad',
        name: 'Glass Pad',
        category: 'pad',
        createSynth: fromSpec('glass-pad'),
    },

    // Synths
    'basic-synth': {
        id: 'basic-synth',
        name: 'Basic Synth',
        category: 'synth',
        createSynth: fromSpec('basic-synth'),
    },
    'pluck-synth': {
        id: 'pluck-synth',
        name: 'Pluck',
        category: 'synth',
        createSynth: fromSpec('pluck-synth'),
    },
    'bell-synth': {
        id: 'bell-synth',
        name: 'Bell',
        category: 'idiophones',
        createSynth: fromSpec('bell-synth'),
    },

    // Idiophones / Pitched Percussion
    'chimes': {
        id: 'chimes',
        name: 'Chimes',
        category: 'idiophones',
        createSynth: fromSpec('chimes'),
    },
    'marimba': {
        id: 'marimba',
        name: 'Marimba',
        category: 'idiophones',
        createSynth: fromSpec('marimba'),
    },
    'xylophone': {
        id: 'xylophone',
        name: 'Xylophone',
        category: 'idiophones',
        createSynth: fromSpec('xylophone'),
    },
    'vibraphone': {
        id: 'vibraphone',
        name: 'Vibraphone',
        category: 'idiophones',
        createSynth: fromSpec('vibraphone'),
    },
    'kalimba': {
        id: 'kalimba',
        name: 'Kalimba',
        category: 'idiophones',
        createSynth: fromSpec('kalimba'),
    },
    'celeste': {
        id: 'celeste',
        name: 'Celeste',
        category: 'idiophones',
        createSynth: fromSpec('celeste'),
    },
    'glockenspiel': {
        id: 'glockenspiel',
        name: 'Glockenspiel',
        category: 'idiophones',
        createSynth: fromSpec('glockenspiel'),
    },
    'steel-pan': {
        id: 'steel-pan',
        name: 'Steel Pan',
        category: 'idiophones',
        createSynth: fromSpec('steel-pan'),
    },

    // Plucked Strings
    'guitar': {
        id: 'guitar',
        name: 'Guitar',
        category: 'plucked-strings',
        createSynth: fromSpec('guitar'),
    },
    'harp': {
        id: 'harp',
        name: 'Harp',
        category: 'plucked-strings',
        createSynth: fromSpec('harp'),
    },
    'pizzicato': {
        id: 'pizzicato',
        name: 'Pizzicato',
        category: 'plucked-strings',
        createSynth: fromSpec('pizzicato'),
    },
    'ukulele': {
        id: 'ukulele',
        name: 'Ukulele',
        category: 'plucked-strings',
        createSynth: fromSpec('ukulele'),
    },
    'banjo': {
        id: 'banjo',
        name: 'Banjo',
        category: 'plucked-strings',
        createSynth: fromSpec('banjo'),
    },

    // Bowed Strings
    'violin': {
        id: 'violin',
        name: 'Violin',
        category: 'bowed-strings',
        createSynth: fromSpec('violin'),
    },
    'cello': {
        id: 'cello',
        name: 'Cello',
        category: 'bowed-strings',
        createSynth: fromSpec('cello'),
    },
    'double-bass': {
        id: 'double-bass',
        name: 'Double Bass',
        category: 'bowed-strings',
        createSynth: fromSpec('double-bass'),
    },
    'tenor-violin': {
        id: 'tenor-violin',
        name: 'Tenor Violin',
        category: 'bowed-strings',
        createSynth: fromSpec('tenor-violin'),
    },
    'fiddle': {
        id: 'fiddle',
        name: 'Fiddle',
        category: 'bowed-strings',
        createSynth: fromSpec('fiddle'),
    },

    // Wind (merged Woodwind + Brass)
    'flute': {
        id: 'flute',
        name: 'Flute',
        category: 'wind',
        createSynth: fromSpec('flute'),
    },
    'piccolo': {
        id: 'piccolo',
        name: 'Piccolo',
        category: 'wind',
        createSynth: fromSpec('piccolo'),
    },
    'saxophone': {
        id: 'saxophone',
        name: 'Saxophone',
        category: 'wind',
        createSynth: fromSpec('saxophone'),
    },
    'bassoon': {
        id: 'bassoon',
        name: 'Bassoon',
        category: 'wind',
        createSynth: fromSpec('bassoon'),
    },
    'oboe': {
        id: 'oboe',
        name: 'Oboe',
        category: 'wind',
        createSynth: fromSpec('oboe'),
    },
    'trumpet': {
        id: 'trumpet',
        name: 'Trumpet',
        category: 'wind',
        createSynth: fromSpec('trumpet'),
    },
    'euphonium': {
        id: 'euphonium',
        name: 'Euphonium',
        category: 'wind',
        createSynth: fromSpec('euphonium'),
    },

    // Additional instruments
    'didgeridoo': {
        id: 'didgeridoo',
        name: 'Didgeridoo',
        category: 'wind',
        createSynth: fromSpec('didgeridoo'),
    },
    'vocal-synth': {
        id: 'vocal-synth',
        name: 'Vocal Synth',
        category: 'synth',
        createSynth: fromSpec('vocal-synth'),
    },
    'orchestra-hit': {
        id: 'orchestra-hit',
        name: 'Orchestra Hit',
        category: 'bowed-strings',
        createSynth: fromSpec('orchestra-hit'),
    },
    'guzheng': {
        id: 'guzheng',
        name: 'Guzheng',
        category: 'plucked-strings',
        createSynth: fromSpec('guzheng'),
    },

    // Drums (special case)
    'synth-drum-kit': {
        id: 'synth-drum-kit',
        name: 'Synth Drum Kit',
        category: 'drums',
        createSynth: createSynthDrumKit,
    },
    'drum-synth': {
        id: 'drum-synth',
        name: 'Classic Drum',
        category: 'drums',
        createSynth: createDrumSynth,
    },
    'drum-sampler': {
        id: 'drum-sampler',
        name: 'Drum Kit',
        category: 'drums',
        createSynth: createDrumSampler,
    },
    'punchy-kit': {
        id: 'punchy-kit',
        name: 'Punchy Drum',
        category: 'drums',
        createSynth: createPunchyKit,
    },
    '808-kit': {
        id: '808-kit',
        name: '808 Kit',
        category: 'drums',
        createSynth: create808Kit,
    },
    'acoustic-kit': {
        id: 'acoustic-kit',
        name: 'Acoustic Kit',
        category: 'drums',
        createSynth: createAcousticKit,
    },
    'lofi-kit': {
        id: 'lofi-kit',
        name: 'Lo-Fi Kit',
        category: 'drums',
        createSynth: createLoFiKit,
    },
    'electronic-kit': {
        id: 'electronic-kit',
        name: 'Electronic Kit',
        category: 'drums',
        createSynth: createElectronicKit,
    },
    'bongos': {
        id: 'bongos',
        name: 'Bongos',
        category: 'drums',
        createSynth: createBongos,
    },
    'wooden-block': {
        id: 'wooden-block',
        name: 'Wooden Block',
        category: 'drums',
        createSynth: createWoodenBlock,
    },
    'taiko': {
        id: 'taiko',
        name: 'Taiko',
        category: 'drums',
        createSynth: createTaiko,
    },
    'maracas': {
        id: 'maracas',
        name: 'Maracas',
        category: 'drums',
        createSynth: createMaracas,
    },

    // Basic Waveform Synths
    'square-wave': {
        id: 'square-wave',
        name: 'Square Wave',
        category: 'synth',
        createSynth: fromSpec('square-wave'),
    },
    'triangle-wave': {
        id: 'triangle-wave',
        name: 'Triangle Wave',
        category: 'synth',
        createSynth: fromSpec('triangle-wave'),
    },
    'sawtooth-wave': {
        id: 'sawtooth-wave',
        name: 'Sawtooth Wave',
        category: 'synth',
        createSynth: fromSpec('sawtooth-wave'),
    },
} satisfies Record<string, SynthPreset>;

/** Every id in the preset registry — the canonical list of instruments. */
export type SynthPresetId = keyof typeof SYNTH_PRESETS;

/** Preset ids in declaration order (grouped by category in this file). */
export const SYNTH_PRESET_IDS = Object.keys(SYNTH_PRESETS) as SynthPresetId[];

// ============================================
// Helper Functions
// ============================================

/**
 * Get a synth preset by ID
 */
export function getSynthPreset(presetId: string): SynthPreset | undefined {
    return (SYNTH_PRESETS as Record<string, SynthPreset>)[presetId];
}

/**
 * Create a synth for a built-in preset id, falling back to the basic synth.
 *
 * Knows nothing about custom instruments, deliberately: user content is
 * resolved one layer up, in the scheduler, which is already the single place
 * that decides clip preset → track preset → track colour. Teaching this
 * function about the user registry would mean the built-in library importing
 * IndexedDB-backed state, and a genuine import cycle with it.
 */
export function createSynthFromPreset(presetId: string | undefined): SynthType {
    const preset = presetId ? getSynthPreset(presetId) : undefined;
    if (preset) {
        return preset.createSynth();
    }
    return fromSpec('basic-synth')();
}

/** A preset's display name, or the raw id if it is not one we know. */
export function getSynthPresetName(presetId: string): string {
    return getSynthPreset(presetId)?.name ?? presetId;
}

/**
 * Get all presets for a category
 */
export function getPresetsByCategory(category: SynthPreset['category']): SynthPreset[] {
    return Object.values(SYNTH_PRESETS as Record<string, SynthPreset>).filter((p) => p.category === category);
}
