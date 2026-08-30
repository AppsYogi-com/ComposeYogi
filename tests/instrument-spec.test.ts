// ============================================
// ComposeYogi — Instrument Spec Tests
// ============================================
//
// The guard on this feature is the golden fixture. Tone cannot be constructed
// in Node — there is no Web Audio — so nothing here can prove a synth *sounds*
// right. What it can prove, and what actually matters, is that the options
// object handed to Tone is byte-for-byte the one the hand-written factories
// used to pass. `tests/golden/preset-voice-options.json` is a copy of those
// literals taken before they were deleted; if a spec drifts, 52 shipped sounds
// change under saved projects, and this is what says so.

import { describe, expect, it } from 'vitest';

import {
    CUSTOM_INSTRUMENT_PREFIX,
    ENVELOPE_RANGES,
    MACRO_RANGES,
    NEUTRAL_MACROS,
    brightnessToFrequency,
    clampSpec,
    filterSpecFor,
    isCustomInstrumentId,
    parseInstrumentSpec,
    resonanceToQ,
    voiceOptions,
} from '@/lib/audio/instrument-spec';
import { CUSTOMIZABLE_PRESET_IDS, PRESET_SPECS, isCustomizablePreset, specForPreset } from '@/lib/audio/preset-specs';
import { SYNTH_PRESET_IDS } from '@/lib/audio/synth-presets';

import golden from './golden/preset-voice-options.json';

import type { InstrumentSpec } from '@/types';

// ============================================
// The golden fixture
// ============================================

describe('preset specs reproduce the shipped sounds', () => {
    const goldenIds = Object.keys(golden) as (keyof typeof golden)[];

    it('covers every customizable preset and nothing else', () => {
        expect(goldenIds.slice().sort()).toEqual(CUSTOMIZABLE_PRESET_IDS.slice().sort());
    });

    it.each(goldenIds)('%s builds the exact options its factory used to pass', (id) => {
        const spec = PRESET_SPECS[id];
        expect(spec).not.toBeNull();
        expect(voiceOptions(spec as InstrumentSpec)).toEqual(golden[id].options);
    });

    it.each(goldenIds)('%s names the voice its factory constructed', (id) => {
        expect((PRESET_SPECS[id] as InstrumentSpec).voice).toBe(golden[id].voice);
    });

    it('gives every preset a spec or an explicit null', () => {
        // Record<SynthPresetId, …> makes this a compile error too. Asserted at
        // runtime as well because the compile-time half is easy to defeat with
        // a cast, and the cost of getting it wrong is a silently uncustomizable
        // instrument nobody notices for a release.
        for (const id of SYNTH_PRESET_IDS) {
            expect(Object.prototype.hasOwnProperty.call(PRESET_SPECS, id)).toBe(true);
        }
        expect(Object.keys(PRESET_SPECS).sort()).toEqual(SYNTH_PRESET_IDS.slice().sort());
    });

    it('starts every preset from neutral macros', () => {
        // A preset that shipped with, say, brightness 60 would mean the built-in
        // itself is filtered — which would contradict the fixture above, since
        // the factories built no filter at all.
        for (const id of CUSTOMIZABLE_PRESET_IDS) {
            const spec = PRESET_SPECS[id] as InstrumentSpec;
            expect(spec.brightness).toBe(NEUTRAL_MACROS.brightness);
            expect(spec.resonance).toBe(NEUTRAL_MACROS.resonance);
            expect(spec.level).toBe(NEUTRAL_MACROS.level);
            expect(filterSpecFor(spec)).toBeNull();
        }
    });

    it('leaves every preset envelope untouched by clamping', () => {
        // The ranges were chosen to contain the library. If a future preset
        // reaches past them this fails, rather than the preset being quietly
        // trimmed into a different sound the first time it is customized.
        for (const id of CUSTOMIZABLE_PRESET_IDS) {
            const spec = PRESET_SPECS[id] as InstrumentSpec;
            expect(clampSpec(spec)).toEqual(spec);
        }
    });

    it('hands out independent copies', () => {
        const first = specForPreset('electric-piano');
        expect(first).not.toBeNull();
        first!.envelope.attack = 4;
        expect(specForPreset('electric-piano')!.envelope.attack).not.toBe(4);
        expect(PRESET_SPECS['electric-piano']!.envelope.attack).not.toBe(4);
    });

    it('reports drum kits as uncustomizable', () => {
        expect(isCustomizablePreset('electric-piano')).toBe(true);
        expect(isCustomizablePreset('808-kit')).toBe(false);
        expect(isCustomizablePreset('drum-sampler')).toBe(false);
        expect(specForPreset('808-kit')).toBeNull();
        expect(isCustomizablePreset('nope')).toBe(false);
    });
});

// ============================================
// Knob positions
// ============================================

describe('brightness', () => {
    it('is a log taper, so each step is the same musical distance', () => {
        const quarter = brightnessToFrequency(25);
        const half = brightnessToFrequency(50);
        const threeQuarters = brightnessToFrequency(75);
        // Equal ratios, not equal differences — that is what "logarithmic" means
        // here, and it is the whole reason the mapping is not linear Hz.
        expect(half / quarter).toBeCloseTo(threeQuarters / half, 6);
    });

    it('rises monotonically across the range', () => {
        for (let b = 0; b < 100; b += 5) {
            expect(brightnessToFrequency(b + 5)).toBeGreaterThan(brightnessToFrequency(b));
        }
    });

    it('clamps out-of-range positions instead of extrapolating', () => {
        expect(brightnessToFrequency(-40)).toBe(brightnessToFrequency(0));
        expect(brightnessToFrequency(400)).toBe(brightnessToFrequency(100));
        expect(brightnessToFrequency(Number.NaN)).toBe(brightnessToFrequency(0));
    });

    it('builds no filter at all when fully open', () => {
        // The property the whole design rests on: an unedited custom instrument
        // is its source preset, not its source preset plus an open filter.
        const spec = specForPreset('electric-piano') as InstrumentSpec;
        expect(filterSpecFor(spec)).toBeNull();

        spec.brightness = MACRO_RANGES.brightness.max - 1;
        expect(filterSpecFor(spec)).not.toBeNull();
    });

    it('darkens as the knob comes down', () => {
        const spec = specForPreset('warm-pad') as InstrumentSpec;
        spec.brightness = 70;
        const open = filterSpecFor(spec)!.frequency;
        spec.brightness = 30;
        expect(filterSpecFor(spec)!.frequency).toBeLessThan(open);
    });
});

describe('resonance', () => {
    it('is Tone\'s own default at zero, so no resonance means no colour', () => {
        expect(resonanceToQ(0)).toBeCloseTo(0.7, 6);
    });

    it('rises with the knob and clamps at both ends', () => {
        expect(resonanceToQ(100)).toBeGreaterThan(resonanceToQ(50));
        expect(resonanceToQ(50)).toBeGreaterThan(resonanceToQ(0));
        expect(resonanceToQ(-10)).toBe(resonanceToQ(0));
        expect(resonanceToQ(999)).toBe(resonanceToQ(100));
    });
});

// ============================================
// Clamping
// ============================================

describe('clampSpec', () => {
    const base = () => specForPreset('saw-lead') as InstrumentSpec;

    it('pulls every editable value inside its range', () => {
        const spec = base();
        spec.envelope.attack = 900;
        spec.envelope.sustain = -3;
        spec.brightness = 5000;
        spec.resonance = -80;
        spec.level = 400;

        const clamped = clampSpec(spec);
        expect(clamped.envelope.attack).toBe(ENVELOPE_RANGES.attack.max);
        expect(clamped.envelope.sustain).toBe(ENVELOPE_RANGES.sustain.min);
        expect(clamped.brightness).toBe(MACRO_RANGES.brightness.max);
        expect(clamped.resonance).toBe(MACRO_RANGES.resonance.min);
        expect(clamped.level).toBe(MACRO_RANGES.level.max);
    });

    it('turns non-finite values into the floor rather than passing them to Tone', () => {
        const spec = base();
        spec.envelope.release = Number.NaN;
        spec.envelope.decay = Number.POSITIVE_INFINITY;
        const clamped = clampSpec(spec);
        expect(Number.isFinite(clamped.envelope.release)).toBe(true);
        expect(Number.isFinite(clamped.envelope.decay)).toBe(true);
    });

    it('drops keys that are not part of the spec', () => {
        const spec = { ...base(), evil: 'payload' } as unknown as InstrumentSpec;
        expect(Object.prototype.hasOwnProperty.call(clampSpec(spec), 'evil')).toBe(false);
    });

    it('carries FM character through untouched', () => {
        const spec = specForPreset('fm-bass') as InstrumentSpec;
        expect(spec.harmonicity).toBeDefined();
        const clamped = clampSpec(spec);
        expect(clamped.harmonicity).toBe(spec.harmonicity);
        expect(clamped.modulationIndex).toBe(spec.modulationIndex);
        expect(clamped.modulationEnvelope).toEqual(spec.modulationEnvelope);
    });

    it('does not alias the input', () => {
        const spec = base();
        const clamped = clampSpec(spec);
        clamped.envelope.attack = 0.9;
        expect(spec.envelope.attack).not.toBe(0.9);
    });
});

// ============================================
// Untrusted input
// ============================================

describe('parseInstrumentSpec', () => {
    it('round-trips a real spec through JSON', () => {
        const spec = specForPreset('choir-pad') as InstrumentSpec;
        expect(parseInstrumentSpec(JSON.parse(JSON.stringify(spec)))).toEqual(spec);
    });

    it('round-trips every customizable preset', () => {
        for (const id of CUSTOMIZABLE_PRESET_IDS) {
            const spec = specForPreset(id) as InstrumentSpec;
            expect(parseInstrumentSpec(JSON.parse(JSON.stringify(spec)))).toEqual(spec);
        }
    });

    it('rejects input that is not a spec', () => {
        expect(parseInstrumentSpec(null)).toBeNull();
        expect(parseInstrumentSpec('electric-piano')).toBeNull();
        expect(parseInstrumentSpec([])).toBeNull();
        expect(parseInstrumentSpec({})).toBeNull();
    });

    it('rejects a voice it cannot construct', () => {
        // Not repaired to a default: the voice decides which Tone class is
        // built, and guessing would silently produce the wrong instrument.
        const spec = specForPreset('saw-lead') as InstrumentSpec;
        expect(parseInstrumentSpec({ ...spec, voice: 'granular' })).toBeNull();
        expect(parseInstrumentSpec({ ...spec, voice: 42 })).toBeNull();
    });

    it('rejects a missing or malformed oscillator', () => {
        const spec = specForPreset('saw-lead') as InstrumentSpec;
        expect(parseInstrumentSpec({ ...spec, oscillator: undefined })).toBeNull();
        expect(parseInstrumentSpec({ ...spec, oscillator: { type: 7 } })).toBeNull();
    });

    it('repairs a damaged envelope rather than rejecting the file', () => {
        const spec = specForPreset('saw-lead') as InstrumentSpec;
        const parsed = parseInstrumentSpec({ ...spec, envelope: { attack: 'slow' } });
        expect(parsed).not.toBeNull();
        expect(Number.isFinite(parsed!.envelope.attack)).toBe(true);
    });

    it('clamps values that arrive out of range', () => {
        const spec = specForPreset('saw-lead') as InstrumentSpec;
        const parsed = parseInstrumentSpec({ ...spec, brightness: 100000, level: -9999 });
        expect(parsed!.brightness).toBe(MACRO_RANGES.brightness.max);
        expect(parsed!.level).toBe(MACRO_RANGES.level.min);
    });

    it('drops unknown keys instead of carrying them into the synth', () => {
        const spec = specForPreset('saw-lead') as InstrumentSpec;
        const parsed = parseInstrumentSpec({ ...spec, __proto__: { polluted: true }, extra: 1 });
        expect(Object.prototype.hasOwnProperty.call(parsed!, 'extra')).toBe(false);
    });

    it('defaults absent macros to neutral, so an old file plays as it was made', () => {
        const spec = specForPreset('saw-lead') as InstrumentSpec;
        const { brightness: _b, resonance: _r, level: _l, ...withoutMacros } = spec;
        const parsed = parseInstrumentSpec(withoutMacros);
        expect(parsed!.brightness).toBe(NEUTRAL_MACROS.brightness);
        expect(parsed!.resonance).toBe(NEUTRAL_MACROS.resonance);
        expect(parsed!.level).toBe(NEUTRAL_MACROS.level);
    });
});

// ============================================
// Identity
// ============================================

describe('custom instrument ids', () => {
    it('recognises its own prefix and nothing else', () => {
        expect(isCustomInstrumentId(`${CUSTOM_INSTRUMENT_PREFIX}abc`)).toBe(true);
        expect(isCustomInstrumentId('electric-piano')).toBe(false);
        expect(isCustomInstrumentId(undefined)).toBe(false);
        expect(isCustomInstrumentId('')).toBe(false);
    });

    it('cannot collide with a built-in id', () => {
        // Built-in ids are kebab-case with no colon; the prefix is what keeps a
        // bare `instrumentPreset` string unambiguous.
        for (const id of SYNTH_PRESET_IDS) {
            expect(isCustomInstrumentId(id)).toBe(false);
        }
    });
});
