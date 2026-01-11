// ============================================
// ComposeYogi — Synth Presets
// Tone.js synthesizer configurations
// ============================================

import * as Tone from 'tone';

// ============================================
// Types
// ============================================

// Union type for all synths we might create
export type SynthType = Tone.PolySynth | Tone.MonoSynth | Tone.MembraneSynth;

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

// Bass - Use MonoSynth directly (not wrapped in PolySynth)
const createSubBass = (): Tone.MonoSynth => {
    return new Tone.MonoSynth({
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

const createSynthBass = (): Tone.MonoSynth => {
    return new Tone.MonoSynth({
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

// Drum synth - Use MembraneSynth directly
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

    // Basic
    'basic-synth': {
        id: 'basic-synth',
        name: 'Basic Synth',
        category: 'synth',
        createSynth: createBasicSynth,
    },

    // Drums (special case)
    'drum-synth': {
        id: 'drum-synth',
        name: 'Drum Synth',
        category: 'drums',
        createSynth: createDrumSynth,
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
