// ============================================
// ComposeYogi — Preset Specs
// ============================================
//
// Every built-in instrument as data. This is the single source for what the 52
// melodic presets sound like: `SYNTH_PRESETS` builds them from here, and the
// instrument editor starts from here, so "customize the Electric Piano" begins
// at the real Electric Piano rather than at something named after it.
//
// It was not written by hand. The entries were extracted mechanically from the
// options literals the factory functions used to pass to `new Tone.PolySynth`,
// and `tests/golden/preset-voice-options.json` is a golden copy of those same
// literals, captured before the factories were replaced. `instrument-spec.test.ts`
// asserts that `voiceOptions()` still reproduces every one of them exactly — so
// a change here that alters a shipped sound fails the build rather than quietly
// retuning somebody's saved project.
//
// **The 12 nulls are a decision, not a gap.** Drum kits are Samplers,
// MembraneSynths and a NoiseSynth — a different construction with a different
// parameter space, and a "custom drum kit" is a different feature (a kit is a
// mapping of pieces, not a voice). They are typed `null` rather than omitted
// because `Record<SynthPresetId, …>` then forces a new preset to state which it
// is; `Partial<>` here would let the next instrument be silently uncustomizable.

import type { InstrumentSpec } from '@/types';

import type { SynthPresetId } from './synth-presets';

/**
 * The starting point for every built-in. `null` means the preset is not built
 * from a voice spec and cannot be customized in v1 — see the note above.
 */
export const PRESET_SPECS: Record<SynthPresetId, InstrumentSpec | null> = {
    'electric-piano': {
        voice: 'synth',
        oscillator: {
            type: 'sine',
        },
        envelope: {
            attack: 0.005,
            decay: 0.8,
            sustain: 0.2,
            release: 1.2,
        },
        brightness: 100,
        resonance: 0,
        level: 0,
    },
    'bright-piano': {
        voice: 'synth',
        oscillator: {
            type: 'triangle',
        },
        envelope: {
            attack: 0.005,
            decay: 0.5,
            sustain: 0.3,
            release: 1,
        },
        brightness: 100,
        resonance: 0,
        level: 0,
    },
    'harpsichord': {
        voice: 'monosynth',
        oscillator: {
            type: 'sawtooth',
        },
        envelope: {
            attack: 0.001,
            decay: 1.2,
            sustain: 0,
            release: 0.6,
        },
        filterEnvelope: {
            attack: 0.001,
            decay: 0.3,
            sustain: 0,
            release: 0.3,
            baseFrequency: 800,
            octaves: 4,
        },
        brightness: 100,
        resonance: 0,
        level: 0,
    },
    'organ': {
        voice: 'synth',
        oscillator: {
            type: 'custom',
            partials: [1, 0.8, 0.6, 0.4, 0.3, 0.2],
        },
        envelope: {
            attack: 0.01,
            decay: 0.01,
            sustain: 1,
            release: 0.15,
        },
        brightness: 100,
        resonance: 0,
        level: 0,
    },
    'clavinet': {
        voice: 'monosynth',
        oscillator: {
            type: 'pulse',
        },
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
        brightness: 100,
        resonance: 0,
        level: 0,
    },
    'sub-bass': {
        voice: 'monosynth',
        oscillator: {
            type: 'sine',
        },
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
        brightness: 100,
        resonance: 0,
        level: 0,
    },
    'synth-bass': {
        voice: 'monosynth',
        oscillator: {
            type: 'sawtooth',
        },
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
        brightness: 100,
        resonance: 0,
        level: 0,
    },
    'fm-bass': {
        voice: 'fmsynth',
        oscillator: {
            type: 'sine',
        },
        envelope: {
            attack: 0.01,
            decay: 0.4,
            sustain: 0.3,
            release: 0.2,
        },
        modulation: {
            type: 'square',
        },
        modulationEnvelope: {
            attack: 0.01,
            decay: 0.2,
            sustain: 0.1,
            release: 0.2,
        },
        harmonicity: 1,
        modulationIndex: 8,
        brightness: 100,
        resonance: 0,
        level: 0,
    },
    'pluck-bass': {
        voice: 'monosynth',
        oscillator: {
            type: 'triangle',
        },
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
        brightness: 100,
        resonance: 0,
        level: 0,
    },
    'saw-lead': {
        voice: 'synth',
        oscillator: {
            type: 'sawtooth',
        },
        envelope: {
            attack: 0.01,
            decay: 0.2,
            sustain: 0.6,
            release: 0.3,
        },
        brightness: 100,
        resonance: 0,
        level: 0,
    },
    'square-lead': {
        voice: 'synth',
        oscillator: {
            type: 'square',
        },
        envelope: {
            attack: 0.02,
            decay: 0.15,
            sustain: 0.5,
            release: 0.4,
        },
        brightness: 100,
        resonance: 0,
        level: 0,
    },
    'fm-lead': {
        voice: 'fmsynth',
        oscillator: {
            type: 'sine',
        },
        envelope: {
            attack: 0.01,
            decay: 0.3,
            sustain: 0.5,
            release: 0.5,
        },
        modulation: {
            type: 'sine',
        },
        modulationEnvelope: {
            attack: 0.02,
            decay: 0.4,
            sustain: 0.2,
            release: 0.3,
        },
        harmonicity: 3,
        modulationIndex: 10,
        brightness: 100,
        resonance: 0,
        level: 0,
    },
    'pulse-lead': {
        voice: 'synth',
        oscillator: {
            type: 'pulse',
            width: 0.3,
        },
        envelope: {
            attack: 0.02,
            decay: 0.15,
            sustain: 0.7,
            release: 0.3,
        },
        brightness: 100,
        resonance: 0,
        level: 0,
    },
    'warm-pad': {
        voice: 'synth',
        oscillator: {
            type: 'sine',
        },
        envelope: {
            attack: 0.8,
            decay: 0.5,
            sustain: 0.9,
            release: 2,
        },
        brightness: 100,
        resonance: 0,
        level: 0,
    },
    'string-pad': {
        voice: 'synth',
        oscillator: {
            type: 'fatsawtooth',
            spread: 20,
            count: 3,
        },
        envelope: {
            attack: 1,
            decay: 0.3,
            sustain: 0.8,
            release: 2.5,
        },
        brightness: 100,
        resonance: 0,
        level: 0,
    },
    'choir-pad': {
        voice: 'amsynth',
        oscillator: {
            type: 'fatsine',
            spread: 30,
            count: 3,
        },
        envelope: {
            attack: 1.2,
            decay: 0.5,
            sustain: 0.85,
            release: 3,
        },
        modulation: {
            type: 'sine',
        },
        modulationEnvelope: {
            attack: 0.8,
            decay: 0.3,
            sustain: 0.7,
            release: 2,
        },
        harmonicity: 2,
        brightness: 100,
        resonance: 0,
        level: 0,
    },
    'glass-pad': {
        voice: 'fmsynth',
        oscillator: {
            type: 'sine',
        },
        envelope: {
            attack: 0.6,
            decay: 0.8,
            sustain: 0.7,
            release: 2.5,
        },
        modulation: {
            type: 'triangle',
        },
        modulationEnvelope: {
            attack: 0.5,
            decay: 0.6,
            sustain: 0.3,
            release: 2,
        },
        harmonicity: 5,
        modulationIndex: 4,
        brightness: 100,
        resonance: 0,
        level: 0,
    },
    'basic-synth': {
        voice: 'synth',
        oscillator: {
            type: 'triangle',
        },
        envelope: {
            attack: 0.02,
            decay: 0.1,
            sustain: 0.5,
            release: 0.4,
        },
        brightness: 100,
        resonance: 0,
        level: 0,
    },
    'pluck-synth': {
        voice: 'monosynth',
        oscillator: {
            type: 'sawtooth',
        },
        envelope: {
            attack: 0.001,
            decay: 0.4,
            sustain: 0,
            release: 0.2,
        },
        filterEnvelope: {
            attack: 0.001,
            decay: 0.25,
            sustain: 0,
            release: 0.15,
            baseFrequency: 600,
            octaves: 4,
        },
        brightness: 100,
        resonance: 0,
        level: 0,
    },
    'bell-synth': {
        voice: 'fmsynth',
        oscillator: {
            type: 'sine',
        },
        envelope: {
            attack: 0.001,
            decay: 2,
            sustain: 0,
            release: 1.5,
        },
        modulation: {
            type: 'sine',
        },
        modulationEnvelope: {
            attack: 0.001,
            decay: 1.5,
            sustain: 0,
            release: 1,
        },
        harmonicity: 5.07,
        modulationIndex: 14,
        brightness: 100,
        resonance: 0,
        level: 0,
    },
    'chimes': {
        voice: 'fmsynth',
        oscillator: {
            type: 'sine',
        },
        envelope: {
            attack: 0.001,
            decay: 3,
            sustain: 0,
            release: 2,
        },
        modulation: {
            type: 'sine',
        },
        modulationEnvelope: {
            attack: 0.001,
            decay: 2,
            sustain: 0,
            release: 1.5,
        },
        harmonicity: 7,
        modulationIndex: 12,
        brightness: 100,
        resonance: 0,
        level: 0,
    },
    'marimba': {
        voice: 'fmsynth',
        oscillator: {
            type: 'sine',
        },
        envelope: {
            attack: 0.001,
            decay: 0.8,
            sustain: 0,
            release: 0.5,
        },
        modulation: {
            type: 'sine',
        },
        modulationEnvelope: {
            attack: 0.001,
            decay: 0.4,
            sustain: 0,
            release: 0.3,
        },
        harmonicity: 4,
        modulationIndex: 2,
        brightness: 100,
        resonance: 0,
        level: 0,
    },
    'xylophone': {
        voice: 'fmsynth',
        oscillator: {
            type: 'sine',
        },
        envelope: {
            attack: 0.001,
            decay: 0.4,
            sustain: 0,
            release: 0.2,
        },
        modulation: {
            type: 'sine',
        },
        modulationEnvelope: {
            attack: 0.001,
            decay: 0.2,
            sustain: 0,
            release: 0.15,
        },
        harmonicity: 5.07,
        modulationIndex: 6,
        brightness: 100,
        resonance: 0,
        level: 0,
    },
    'vibraphone': {
        voice: 'fmsynth',
        oscillator: {
            type: 'sine',
        },
        envelope: {
            attack: 0.001,
            decay: 2.5,
            sustain: 0.3,
            release: 2,
        },
        modulation: {
            type: 'sine',
        },
        modulationEnvelope: {
            attack: 0.001,
            decay: 1.5,
            sustain: 0.2,
            release: 1,
        },
        harmonicity: 3.01,
        modulationIndex: 4,
        brightness: 100,
        resonance: 0,
        level: 0,
    },
    'kalimba': {
        voice: 'fmsynth',
        oscillator: {
            type: 'sine',
        },
        envelope: {
            attack: 0.001,
            decay: 1.2,
            sustain: 0,
            release: 0.8,
        },
        modulation: {
            type: 'triangle',
        },
        modulationEnvelope: {
            attack: 0.001,
            decay: 0.6,
            sustain: 0,
            release: 0.4,
        },
        harmonicity: 8,
        modulationIndex: 2,
        brightness: 100,
        resonance: 0,
        level: 0,
    },
    'celeste': {
        voice: 'fmsynth',
        oscillator: {
            type: 'sine',
        },
        envelope: {
            attack: 0.001,
            decay: 1.8,
            sustain: 0,
            release: 1.2,
        },
        modulation: {
            type: 'sine',
        },
        modulationEnvelope: {
            attack: 0.001,
            decay: 1,
            sustain: 0,
            release: 0.8,
        },
        harmonicity: 4,
        modulationIndex: 6,
        brightness: 100,
        resonance: 0,
        level: 0,
    },
    'glockenspiel': {
        voice: 'fmsynth',
        oscillator: {
            type: 'sine',
        },
        envelope: {
            attack: 0.001,
            decay: 1.5,
            sustain: 0,
            release: 1,
        },
        modulation: {
            type: 'sine',
        },
        modulationEnvelope: {
            attack: 0.001,
            decay: 0.8,
            sustain: 0,
            release: 0.6,
        },
        harmonicity: 5.07,
        modulationIndex: 18,
        brightness: 100,
        resonance: 0,
        level: 0,
    },
    'steel-pan': {
        voice: 'fmsynth',
        oscillator: {
            type: 'sine',
        },
        envelope: {
            attack: 0.001,
            decay: 1.5,
            sustain: 0,
            release: 0.8,
        },
        modulation: {
            type: 'triangle',
        },
        modulationEnvelope: {
            attack: 0.001,
            decay: 0.8,
            sustain: 0,
            release: 0.5,
        },
        harmonicity: 4,
        modulationIndex: 3,
        brightness: 100,
        resonance: 0,
        level: 0,
    },
    'guitar': {
        voice: 'monosynth',
        oscillator: {
            type: 'fatsawtooth',
            spread: 10,
            count: 2,
        },
        envelope: {
            attack: 0.002,
            decay: 0.6,
            sustain: 0.05,
            release: 0.3,
        },
        filterEnvelope: {
            attack: 0.001,
            decay: 0.3,
            sustain: 0.05,
            release: 0.2,
            baseFrequency: 400,
            octaves: 3,
        },
        brightness: 100,
        resonance: 0,
        level: 0,
    },
    'harp': {
        voice: 'monosynth',
        oscillator: {
            type: 'triangle',
        },
        envelope: {
            attack: 0.001,
            decay: 1.5,
            sustain: 0,
            release: 1,
        },
        filterEnvelope: {
            attack: 0.001,
            decay: 0.8,
            sustain: 0,
            release: 0.5,
            baseFrequency: 500,
            octaves: 3,
        },
        brightness: 100,
        resonance: 0,
        level: 0,
    },
    'pizzicato': {
        voice: 'monosynth',
        oscillator: {
            type: 'sawtooth',
        },
        envelope: {
            attack: 0.001,
            decay: 0.2,
            sustain: 0,
            release: 0.1,
        },
        filterEnvelope: {
            attack: 0.001,
            decay: 0.12,
            sustain: 0,
            release: 0.08,
            baseFrequency: 500,
            octaves: 3.5,
        },
        brightness: 100,
        resonance: 0,
        level: 0,
    },
    'ukulele': {
        voice: 'monosynth',
        oscillator: {
            type: 'triangle',
        },
        envelope: {
            attack: 0.001,
            decay: 0.4,
            sustain: 0.02,
            release: 0.2,
        },
        filterEnvelope: {
            attack: 0.001,
            decay: 0.2,
            sustain: 0.02,
            release: 0.15,
            baseFrequency: 800,
            octaves: 2.5,
        },
        brightness: 100,
        resonance: 0,
        level: 0,
    },
    'banjo': {
        voice: 'monosynth',
        oscillator: {
            type: 'pulse',
            width: 0.15,
        },
        envelope: {
            attack: 0.001,
            decay: 0.3,
            sustain: 0.01,
            release: 0.15,
        },
        filterEnvelope: {
            attack: 0.001,
            decay: 0.15,
            sustain: 0.01,
            release: 0.1,
            baseFrequency: 1000,
            octaves: 3,
        },
        brightness: 100,
        resonance: 0,
        level: 0,
    },
    'violin': {
        voice: 'synth',
        oscillator: {
            type: 'fatsawtooth',
            spread: 15,
            count: 3,
        },
        envelope: {
            attack: 0.15,
            decay: 0.2,
            sustain: 0.85,
            release: 0.4,
        },
        brightness: 100,
        resonance: 0,
        level: 0,
    },
    'cello': {
        voice: 'synth',
        oscillator: {
            type: 'fatsawtooth',
            spread: 20,
            count: 3,
        },
        envelope: {
            attack: 0.2,
            decay: 0.3,
            sustain: 0.8,
            release: 0.6,
        },
        brightness: 100,
        resonance: 0,
        level: 0,
    },
    'double-bass': {
        voice: 'synth',
        oscillator: {
            type: 'fatsawtooth',
            spread: 12,
            count: 2,
        },
        envelope: {
            attack: 0.25,
            decay: 0.3,
            sustain: 0.75,
            release: 0.5,
        },
        brightness: 100,
        resonance: 0,
        level: 0,
    },
    'tenor-violin': {
        voice: 'synth',
        oscillator: {
            type: 'fatsawtooth',
            spread: 18,
            count: 3,
        },
        envelope: {
            attack: 0.18,
            decay: 0.25,
            sustain: 0.82,
            release: 0.5,
        },
        brightness: 100,
        resonance: 0,
        level: 0,
    },
    'fiddle': {
        voice: 'synth',
        oscillator: {
            type: 'fatsawtooth',
            spread: 10,
            count: 2,
        },
        envelope: {
            attack: 0.08,
            decay: 0.15,
            sustain: 0.8,
            release: 0.3,
        },
        brightness: 100,
        resonance: 0,
        level: 0,
    },
    'flute': {
        voice: 'synth',
        oscillator: {
            type: 'sine',
        },
        envelope: {
            attack: 0.08,
            decay: 0.1,
            sustain: 0.85,
            release: 0.3,
        },
        brightness: 100,
        resonance: 0,
        level: 0,
    },
    'piccolo': {
        voice: 'synth',
        oscillator: {
            type: 'sine',
        },
        envelope: {
            attack: 0.05,
            decay: 0.08,
            sustain: 0.9,
            release: 0.25,
        },
        brightness: 100,
        resonance: 0,
        level: 0,
    },
    'saxophone': {
        voice: 'monosynth',
        oscillator: {
            type: 'pulse',
            width: 0.35,
        },
        envelope: {
            attack: 0.05,
            decay: 0.2,
            sustain: 0.7,
            release: 0.3,
        },
        filterEnvelope: {
            attack: 0.03,
            decay: 0.15,
            sustain: 0.5,
            release: 0.25,
            baseFrequency: 400,
            octaves: 2.5,
        },
        brightness: 100,
        resonance: 0,
        level: 0,
    },
    'bassoon': {
        voice: 'monosynth',
        oscillator: {
            type: 'sawtooth',
        },
        envelope: {
            attack: 0.06,
            decay: 0.3,
            sustain: 0.65,
            release: 0.4,
        },
        filterEnvelope: {
            attack: 0.04,
            decay: 0.2,
            sustain: 0.4,
            release: 0.3,
            baseFrequency: 150,
            octaves: 2,
        },
        brightness: 100,
        resonance: 0,
        level: 0,
    },
    'oboe': {
        voice: 'monosynth',
        oscillator: {
            type: 'pulse',
            width: 0.25,
        },
        envelope: {
            attack: 0.04,
            decay: 0.15,
            sustain: 0.75,
            release: 0.3,
        },
        filterEnvelope: {
            attack: 0.03,
            decay: 0.1,
            sustain: 0.6,
            release: 0.2,
            baseFrequency: 600,
            octaves: 2,
        },
        brightness: 100,
        resonance: 0,
        level: 0,
    },
    'trumpet': {
        voice: 'synth',
        oscillator: {
            type: 'square',
        },
        envelope: {
            attack: 0.04,
            decay: 0.15,
            sustain: 0.7,
            release: 0.25,
        },
        brightness: 100,
        resonance: 0,
        level: 0,
    },
    'euphonium': {
        voice: 'fmsynth',
        oscillator: {
            type: 'sine',
        },
        envelope: {
            attack: 0.08,
            decay: 0.2,
            sustain: 0.7,
            release: 0.4,
        },
        modulation: {
            type: 'sine',
        },
        modulationEnvelope: {
            attack: 0.1,
            decay: 0.3,
            sustain: 0.5,
            release: 0.3,
        },
        harmonicity: 1.5,
        modulationIndex: 2,
        brightness: 100,
        resonance: 0,
        level: 0,
    },
    'didgeridoo': {
        voice: 'monosynth',
        oscillator: {
            type: 'sawtooth',
        },
        envelope: {
            attack: 0.1,
            decay: 0.3,
            sustain: 0.9,
            release: 0.5,
        },
        filterEnvelope: {
            attack: 0.08,
            decay: 0.2,
            sustain: 0.4,
            release: 0.4,
            baseFrequency: 80,
            octaves: 1.5,
        },
        brightness: 100,
        resonance: 0,
        level: 0,
    },
    'vocal-synth': {
        voice: 'amsynth',
        oscillator: {
            type: 'fatsine',
            spread: 40,
            count: 3,
        },
        envelope: {
            attack: 0.15,
            decay: 0.4,
            sustain: 0.7,
            release: 0.8,
        },
        modulation: {
            type: 'sine',
        },
        modulationEnvelope: {
            attack: 0.1,
            decay: 0.3,
            sustain: 0.5,
            release: 0.6,
        },
        harmonicity: 3,
        brightness: 100,
        resonance: 0,
        level: 0,
    },
    'orchestra-hit': {
        voice: 'synth',
        oscillator: {
            type: 'fatsawtooth',
            spread: 30,
            count: 5,
        },
        envelope: {
            attack: 0.005,
            decay: 0.6,
            sustain: 0,
            release: 0.4,
        },
        brightness: 100,
        resonance: 0,
        level: 0,
    },
    'guzheng': {
        voice: 'monosynth',
        oscillator: {
            type: 'triangle',
        },
        envelope: {
            attack: 0.001,
            decay: 1.8,
            sustain: 0,
            release: 1.2,
        },
        filterEnvelope: {
            attack: 0.001,
            decay: 0.5,
            sustain: 0,
            release: 0.4,
            baseFrequency: 600,
            octaves: 4,
        },
        brightness: 100,
        resonance: 0,
        level: 0,
    },
    'synth-drum-kit': null,
    'drum-synth': null,
    'drum-sampler': null,
    'punchy-kit': null,
    '808-kit': null,
    'acoustic-kit': null,
    'lofi-kit': null,
    'electronic-kit': null,
    'bongos': null,
    'wooden-block': null,
    'taiko': null,
    'maracas': null,
    'square-wave': {
        voice: 'synth',
        oscillator: {
            type: 'square',
        },
        envelope: {
            attack: 0.01,
            decay: 0.3,
            sustain: 0.6,
            release: 0.4,
        },
        brightness: 100,
        resonance: 0,
        level: 0,
    },
    'triangle-wave': {
        voice: 'synth',
        oscillator: {
            type: 'triangle',
        },
        envelope: {
            attack: 0.01,
            decay: 0.3,
            sustain: 0.7,
            release: 0.4,
        },
        brightness: 100,
        resonance: 0,
        level: 0,
    },
    'sawtooth-wave': {
        voice: 'synth',
        oscillator: {
            type: 'sawtooth',
        },
        envelope: {
            attack: 0.01,
            decay: 0.3,
            sustain: 0.6,
            release: 0.4,
        },
        brightness: 100,
        resonance: 0,
        level: 0,
    },};

/** Preset ids that can be used as a starting point for a custom instrument. */
export const CUSTOMIZABLE_PRESET_IDS = (Object.keys(PRESET_SPECS) as SynthPresetId[])
    .filter((id) => PRESET_SPECS[id] !== null);

/** Whether a built-in can be customized. False for the drum kits and samplers. */
export function isCustomizablePreset(presetId: string): boolean {
    return (PRESET_SPECS as Record<string, InstrumentSpec | null>)[presetId] != null;
}

/**
 * A fresh, independent copy of a preset's spec, or null if it has none.
 *
 * Deep-copied because the editor mutates what it is given and `PRESET_SPECS` is
 * module state — handing out the live object would let one edit session retune
 * the built-in library for the rest of the page's life.
 */
export function specForPreset(presetId: string): InstrumentSpec | null {
    const spec = (PRESET_SPECS as Record<string, InstrumentSpec | null>)[presetId];
    return spec ? structuredClone(spec) : null;
}
