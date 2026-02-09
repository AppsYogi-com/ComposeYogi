// ============================================
// ComposeYogi — Synth Presets
// Tone.js synthesizer configurations
// ============================================

import * as Tone from 'tone';

// ============================================
// Types
// ============================================

// Union type for all synths we might create
export type SynthType = Tone.PolySynth | Tone.MonoSynth | Tone.MembraneSynth | Tone.Sampler;

export interface SynthPreset {
    id: string;
    name: string;
    category: 'synth' | 'keys' | 'bass' | 'pad' | 'lead' | 'drums';
    createSynth: () => SynthType;
}

// ============================================
// Synth Factory Functions
// ============================================

// Keys & Pianos - Use PolySynth with basic Synth (works reliably)
const createElectricPiano = (): Tone.PolySynth => {
    return new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'sine' },
        envelope: {
            attack: 0.005,
            decay: 0.8,
            sustain: 0.2,
            release: 1.2,
        },
    });
};

const createBrightPiano = (): Tone.PolySynth => {
    return new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'triangle' },
        envelope: {
            attack: 0.005,
            decay: 0.5,
            sustain: 0.3,
            release: 1.0,
        },
    });
};

// Bass - Use PolySynth wrapping MonoSynth for polyphony with filter envelope
const createSubBass = (): Tone.PolySynth => {
    return new Tone.PolySynth(Tone.MonoSynth, {
        oscillator: { type: 'sine' },
        envelope: {
            attack: 0.005,
            decay: 0.5,
            sustain: 0.8,
            release: 0.3,
        },
        filterEnvelope: {
            attack: 0.001,
            decay: 0.1,
            sustain: 1,
            release: 0.3,
            baseFrequency: 80,
            octaves: 1,
        },
    });
};

const createSynthBass = (): Tone.PolySynth => {
    return new Tone.PolySynth(Tone.MonoSynth, {
        oscillator: { type: 'sawtooth' },
        envelope: {
            attack: 0.01,
            decay: 0.3,
            sustain: 0.4,
            release: 0.2,
        },
        filterEnvelope: {
            attack: 0.01,
            decay: 0.2,
            sustain: 0.3,
            release: 0.2,
            baseFrequency: 200,
            octaves: 2.5,
        },
    });
};

// Leads
const createSawLead = (): Tone.PolySynth => {
    return new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'sawtooth' },
        envelope: {
            attack: 0.01,
            decay: 0.2,
            sustain: 0.6,
            release: 0.3,
        },
    });
};

const createSquareLead = (): Tone.PolySynth => {
    return new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'square' },
        envelope: {
            attack: 0.02,
            decay: 0.15,
            sustain: 0.5,
            release: 0.4,
        },
    });
};

// Pads
const createWarmPad = (): Tone.PolySynth => {
    return new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'sine' },
        envelope: {
            attack: 0.8,
            decay: 0.5,
            sustain: 0.9,
            release: 2.0,
        },
    });
};

const createStringPad = (): Tone.PolySynth => {
    return new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'fatsawtooth', spread: 20, count: 3 },
        envelope: {
            attack: 1.0,
            decay: 0.3,
            sustain: 0.8,
            release: 2.5,
        },
    });
};

// Keys - Organ (sustained drawbar harmonics)
const createOrgan = (): Tone.PolySynth => {
    return new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'custom', partials: [1, 0.8, 0.6, 0.4, 0.3, 0.2] },
        envelope: {
            attack: 0.01,
            decay: 0.01,
            sustain: 1.0,
            release: 0.15,
        },
    });
};

// Keys - Clavinet (percussive, funky bite)
const createClavinet = (): Tone.PolySynth => {
    return new Tone.PolySynth(Tone.MonoSynth, {
        oscillator: { type: 'pulse' },
        envelope: {
            attack: 0.002,
            decay: 0.3,
            sustain: 0.1,
            release: 0.15,
        },
        filterEnvelope: {
            attack: 0.001,
            decay: 0.15,
            sustain: 0.1,
            release: 0.1,
            baseFrequency: 800,
            octaves: 2,
        },
    });
};

// Bass - FM Bass (metallic, growly)
const createFMBass = (): Tone.PolySynth => {
    return new Tone.PolySynth(Tone.FMSynth, {
        harmonicity: 1,
        modulationIndex: 8,
        oscillator: { type: 'sine' },
        modulation: { type: 'square' },
        envelope: {
            attack: 0.01,
            decay: 0.4,
            sustain: 0.3,
            release: 0.2,
        },
        modulationEnvelope: {
            attack: 0.01,
            decay: 0.2,
            sustain: 0.1,
            release: 0.2,
        },
    });
};

// Bass - Pluck Bass (short pizzicato)
const createPluckBass = (): Tone.PolySynth => {
    return new Tone.PolySynth(Tone.MonoSynth, {
        oscillator: { type: 'triangle' },
        envelope: {
            attack: 0.005,
            decay: 0.25,
            sustain: 0.05,
            release: 0.1,
        },
        filterEnvelope: {
            attack: 0.002,
            decay: 0.15,
            sustain: 0.05,
            release: 0.1,
            baseFrequency: 300,
            octaves: 3,
        },
    });
};

// Leads - FM Lead (bell-like, metallic)
const createFMLead = (): Tone.PolySynth => {
    return new Tone.PolySynth(Tone.FMSynth, {
        harmonicity: 3,
        modulationIndex: 10,
        oscillator: { type: 'sine' },
        modulation: { type: 'sine' },
        envelope: {
            attack: 0.01,
            decay: 0.3,
            sustain: 0.5,
            release: 0.5,
        },
        modulationEnvelope: {
            attack: 0.02,
            decay: 0.4,
            sustain: 0.2,
            release: 0.3,
        },
    });
};

// Leads - Pulse Lead (PWM feel)
const createPulseLead = (): Tone.PolySynth => {
    return new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'pulse', width: 0.3 },
        envelope: {
            attack: 0.02,
            decay: 0.15,
            sustain: 0.7,
            release: 0.3,
        },
    });
};

// Pads - Choir Pad (detuned voices, vocal-like)
const createChoirPad = (): Tone.PolySynth => {
    return new Tone.PolySynth(Tone.AMSynth, {
        harmonicity: 2,
        oscillator: { type: 'fatsine', spread: 30, count: 3 },
        modulation: { type: 'sine' },
        envelope: {
            attack: 1.2,
            decay: 0.5,
            sustain: 0.85,
            release: 3.0,
        },
        modulationEnvelope: {
            attack: 0.8,
            decay: 0.3,
            sustain: 0.7,
            release: 2.0,
        },
    });
};

// Pads - Glass Pad (crystalline shimmer)
const createGlassPad = (): Tone.PolySynth => {
    return new Tone.PolySynth(Tone.FMSynth, {
        harmonicity: 5,
        modulationIndex: 4,
        oscillator: { type: 'sine' },
        modulation: { type: 'triangle' },
        envelope: {
            attack: 0.6,
            decay: 0.8,
            sustain: 0.7,
            release: 2.5,
        },
        modulationEnvelope: {
            attack: 0.5,
            decay: 0.6,
            sustain: 0.3,
            release: 2.0,
        },
    });
};

// Synth - Pluck (short, harp/guitar-like)
const createPluckSynth = (): Tone.PolySynth => {
    return new Tone.PolySynth(Tone.MonoSynth, {
        oscillator: { type: 'sawtooth' },
        envelope: {
            attack: 0.001,
            decay: 0.4,
            sustain: 0.0,
            release: 0.2,
        },
        filterEnvelope: {
            attack: 0.001,
            decay: 0.25,
            sustain: 0.0,
            release: 0.15,
            baseFrequency: 600,
            octaves: 4,
        },
    });
};

// Synth - Bell (FM bell harmonics)
const createBellSynth = (): Tone.PolySynth => {
    return new Tone.PolySynth(Tone.FMSynth, {
        harmonicity: 5.07,
        modulationIndex: 14,
        oscillator: { type: 'sine' },
        modulation: { type: 'sine' },
        envelope: {
            attack: 0.001,
            decay: 2.0,
            sustain: 0.0,
            release: 1.5,
        },
        modulationEnvelope: {
            attack: 0.001,
            decay: 1.5,
            sustain: 0.0,
            release: 1.0,
        },
    });
};

// Basic Synth
const createBasicSynth = (): Tone.PolySynth => {
    return new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'triangle' },
        envelope: {
            attack: 0.02,
            decay: 0.1,
            sustain: 0.5,
            release: 0.4,
        },
    });
};

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

// ============================================
// Preset Registry
// ============================================

export const SYNTH_PRESETS: Record<string, SynthPreset> = {
    // Keys
    'electric-piano': {
        id: 'electric-piano',
        name: 'Electric Piano',
        category: 'keys',
        createSynth: createElectricPiano,
    },
    'bright-piano': {
        id: 'bright-piano',
        name: 'Bright Piano',
        category: 'keys',
        createSynth: createBrightPiano,
    },
    'organ': {
        id: 'organ',
        name: 'Organ',
        category: 'keys',
        createSynth: createOrgan,
    },
    'clavinet': {
        id: 'clavinet',
        name: 'Clavinet',
        category: 'keys',
        createSynth: createClavinet,
    },

    // Bass
    'sub-bass': {
        id: 'sub-bass',
        name: 'Sub Bass',
        category: 'bass',
        createSynth: createSubBass,
    },
    'synth-bass': {
        id: 'synth-bass',
        name: 'Synth Bass',
        category: 'bass',
        createSynth: createSynthBass,
    },
    'fm-bass': {
        id: 'fm-bass',
        name: 'FM Bass',
        category: 'bass',
        createSynth: createFMBass,
    },
    'pluck-bass': {
        id: 'pluck-bass',
        name: 'Pluck Bass',
        category: 'bass',
        createSynth: createPluckBass,
    },

    // Leads
    'saw-lead': {
        id: 'saw-lead',
        name: 'Saw Lead',
        category: 'lead',
        createSynth: createSawLead,
    },
    'square-lead': {
        id: 'square-lead',
        name: 'Square Lead',
        category: 'lead',
        createSynth: createSquareLead,
    },
    'fm-lead': {
        id: 'fm-lead',
        name: 'FM Lead',
        category: 'lead',
        createSynth: createFMLead,
    },
    'pulse-lead': {
        id: 'pulse-lead',
        name: 'Pulse Lead',
        category: 'lead',
        createSynth: createPulseLead,
    },

    // Pads
    'warm-pad': {
        id: 'warm-pad',
        name: 'Warm Pad',
        category: 'pad',
        createSynth: createWarmPad,
    },
    'string-pad': {
        id: 'string-pad',
        name: 'String Pad',
        category: 'pad',
        createSynth: createStringPad,
    },
    'choir-pad': {
        id: 'choir-pad',
        name: 'Choir Pad',
        category: 'pad',
        createSynth: createChoirPad,
    },
    'glass-pad': {
        id: 'glass-pad',
        name: 'Glass Pad',
        category: 'pad',
        createSynth: createGlassPad,
    },

    // Synths
    'basic-synth': {
        id: 'basic-synth',
        name: 'Basic Synth',
        category: 'synth',
        createSynth: createBasicSynth,
    },
    'pluck-synth': {
        id: 'pluck-synth',
        name: 'Pluck',
        category: 'synth',
        createSynth: createPluckSynth,
    },
    'bell-synth': {
        id: 'bell-synth',
        name: 'Bell',
        category: 'synth',
        createSynth: createBellSynth,
    },

    // Drums (special case)
    'drum-synth': {
        id: 'drum-synth',
        name: 'Drum Synth',
        category: 'drums',
        createSynth: createDrumSynth,
    },
    'drum-sampler': {
        id: 'drum-sampler',
        name: 'Drum Kit',
        category: 'drums',
        createSynth: createDrumSampler,
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
};

// ============================================
// Helper Functions
// ============================================

/**
 * Get a synth preset by ID
 */
export function getSynthPreset(presetId: string): SynthPreset | undefined {
    return SYNTH_PRESETS[presetId];
}

/**
 * Create a synth for a given preset ID
 * Falls back to basic synth if preset not found
 */
export function createSynthFromPreset(presetId: string | undefined): SynthType {
    if (presetId && SYNTH_PRESETS[presetId]) {
        return SYNTH_PRESETS[presetId].createSynth();
    }
    // Default fallback
    return createBasicSynth();
}

/**
 * Get all presets for a category
 */
export function getPresetsByCategory(category: SynthPreset['category']): SynthPreset[] {
    return Object.values(SYNTH_PRESETS).filter((p) => p.category === category);
}
