// ============================================
// ComposeYogi — Preset Specs
// ============================================
//
// Every built-in instrument as data. This is the single source for what the 53
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
// **The 6 remaining nulls are a decision, not a gap.** The twelve drum presets
// were never one case, and 8.7.5b split them: the six synthesised kits — five
// MembraneSynths and a NoiseSynth — are `DrumSpec`s here like everything else,
// because a membrane is a voice with four parameters and that is exactly what a
// spec is for. The six that stay null are `Tone.Sampler`s. There is no
// oscillator, envelope or filter to adjust on a recording of a snare, and a kit
// is a *mapping of pieces* rather than a voice — "customize this" would first
// have to ask which piece, which is a kit editor and a different feature.
//
// They are typed `null` rather than omitted because `Record<SynthPresetId, …>`
// then forces a new preset to state which it is; `Partial<>` here would let the
// next instrument be silently uncustomizable.

import { isDrumSpec } from './instrument-spec';

import type { AnyInstrumentSpec } from '@/types';

import type { SynthPresetId } from './synth-presets';

/**
 * The starting point for every built-in — melodic (`InstrumentSpec`) or
 * percussion (`DrumSpec`), discriminated by `voice`. `null` means the preset is
 * not built from a spec at all and cannot be customized: the six sampler kits,
 * for the reason above.
 */
export const PRESET_SPECS: Record<SynthPresetId, AnyInstrumentSpec | null> = {
    // The only preset here that was *designed* rather than transcribed, and the
    // reason it exists is a measurement. `electric-piano` is a bare sine and
    // `bright-piano` a triangle; rendered offline, a C1 on the sine puts its
    // second harmonic **38.6 dB** below the fundamental and **0.0%** of the
    // note's energy above 150 Hz — which is roughly where a laptop speaker
    // starts moving air. So the whole bottom two octaves reach the listener as
    // a frequency their speaker cannot reproduce and nothing else. A real piano
    // is audible down there because harmonics 2 through 10 carry the note; ours
    // had none to carry.
    //
    // FM at a **1:1 carrier-to-modulator ratio** is the fix and the classic one:
    // sidebands land at every integer multiple of the fundamental, which is a
    // harmonic series by construction rather than by luck. The two envelopes are
    // what make it a piano rather than a bell:
    //
    //   - The amplitude envelope has almost no attack, a long decay and a
    //     **low sustain**. A struck string never holds a level; it decays from
    //     the moment the hammer leaves it. `sustain: 0.08` is quiet enough to
    //     read as decay and loud enough that a held chord does not vanish.
    //   - The modulation envelope keeps `sustain: 0.35`, and that number is the
    //     whole point. A piano loses brightness as it decays, so the index falls
    //     — but if it fell to zero the tone would settle back into the sine this
    //     preset exists to replace, and the low end would go quiet again a second
    //     after every note. Bright attack, still-harmonic body.
    //
    // It is synthesis, not a recording, and it will not be mistaken for a
    // Steinway. What it is measured to do is in `docs/notes/sprint-8.7.md`
    // § 8.7.6f.
    'grand-piano': {
        voice: 'fmsynth',
        oscillator: {
            type: 'sine',
        },
        envelope: {
            attack: 0.002,
            decay: 2.2,
            sustain: 0.08,
            release: 1.2,
        },
        modulation: {
            type: 'sine',
        },
        modulationEnvelope: {
            attack: 0.001,
            decay: 1.4,
            sustain: 0.45,
            release: 0.8,
        },
        harmonicity: 1,
        modulationIndex: 22,
        brightness: 100,
        resonance: 0,
        // FM spreads its energy across the sidebands, so this peaks at 0.25
        // against the sine presets' 0.78 — a 10 dB drop, jarring enough to read
        // as a broken instrument when you switch to it. +5 dB brings it to about
        // 0.45: still under the others, which is right, because 0.78 for a
        // *single* note is most of the headroom a four-note chord needs.
        level: 5,
    },
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
    'synth-drum-kit': {
        voice: 'membrane',
        oscillator: {
            type: 'triangle',
        },
        pitchDecay: 0.08,
        octaves: 6,
        envelope: {
            attack: 0.001,
            decay: 0.25,
            sustain: 0,
            release: 0.08,
        },
        level: 0,
    },
    'drum-synth': {
        voice: 'membrane',
        oscillator: {
            type: 'sine',
        },
        pitchDecay: 0.05,
        octaves: 4,
        envelope: {
            attack: 0.001,
            decay: 0.4,
            sustain: 0,
            release: 0.1,
        },
        level: 0,
    },
    'drum-sampler': null,
    'punchy-kit': null,
    '808-kit': null,
    'acoustic-kit': null,
    'lofi-kit': null,
    'electronic-kit': null,
    'bongos': {
        voice: 'membrane',
        oscillator: {
            type: 'sine',
        },
        pitchDecay: 0.03,
        octaves: 3,
        envelope: {
            attack: 0.001,
            decay: 0.15,
            sustain: 0,
            release: 0.05,
        },
        level: 0,
    },
    'wooden-block': {
        voice: 'membrane',
        oscillator: {
            type: 'square',
        },
        pitchDecay: 0.008,
        octaves: 2,
        envelope: {
            attack: 0.001,
            decay: 0.06,
            sustain: 0,
            release: 0.02,
        },
        level: 0,
    },
    'taiko': {
        voice: 'membrane',
        oscillator: {
            type: 'sine',
        },
        pitchDecay: 0.08,
        octaves: 4,
        envelope: {
            attack: 0.001,
            decay: 0.6,
            sustain: 0,
            release: 0.4,
        },
        level: 0,
    },
    'maracas': {
        voice: 'noise',
        noise: {
            type: 'white',
        },
        envelope: {
            attack: 0.001,
            decay: 0.05,
            sustain: 0,
            release: 0.02,
        },
        level: 0,
    },
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

/**
 * The same list, split by kind.
 *
 * Split here rather than at each call site because the two are not
 * interchangeable anywhere: the editor renders different controls for them, and
 * a test that walks one asserting the other's fields passes vacuously on an
 * empty array — which is exactly what a `.filter()` written in a test file
 * would eventually become.
 */
export const CUSTOMIZABLE_DRUM_IDS = CUSTOMIZABLE_PRESET_IDS
    .filter((id) => isDrumSpec(PRESET_SPECS[id] as AnyInstrumentSpec));

export const CUSTOMIZABLE_MELODIC_IDS = CUSTOMIZABLE_PRESET_IDS
    .filter((id) => !isDrumSpec(PRESET_SPECS[id] as AnyInstrumentSpec));

/** Whether a built-in can be customized. False for the six sampler kits, and
 *  for anything that is not a preset id at all. */
export function isCustomizablePreset(presetId: string): boolean {
    return (PRESET_SPECS as Record<string, AnyInstrumentSpec | null>)[presetId] != null;
}

/**
 * A fresh, independent copy of a preset's spec, or null if it has none.
 *
 * Deep-copied because the editor mutates what it is given and `PRESET_SPECS` is
 * module state — handing out the live object would let one edit session retune
 * the built-in library for the rest of the page's life.
 */
export function specForPreset(presetId: string): AnyInstrumentSpec | null {
    const spec = (PRESET_SPECS as Record<string, AnyInstrumentSpec | null>)[presetId];
    return spec ? structuredClone(spec) : null;
}
