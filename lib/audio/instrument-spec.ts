// ============================================
// ComposeYogi — Instrument Spec
// ============================================
//
// An instrument as plain data, and the arithmetic that turns it into the
// options a Tone voice is constructed from. Deliberately free of any Tone
// import: Web Audio does not exist in the test environment, so anything that
// touches Tone cannot be unit-tested at all. Everything decided here — what a
// knob position means in Hz, what survives a round trip through a file, what a
// preset's starting point is — is decided in pure arithmetic that can be.
//
// The Tone half is `custom-instruments.ts`, and it is deliberately thin: it
// picks a constructor from a map and hands it the object built here.
//
// Two properties this file exists to guarantee:
//
//   1. An unedited custom instrument is its source preset *exactly*. Not
//      approximately, not "close enough to be indistinguishable" — the same
//      options object, and no extra node in the signal path. That is why full
//      brightness builds no filter rather than an open one.
//   2. Nothing a user or a file can express escapes the ranges. `clampSpec`
//      is total, and `parseInstrumentSpec` treats its input as hostile, because
//      an imported `.cyi.json` is a file off the internet.
//
// Two kinds of spec live here — melodic (`InstrumentSpec`) and percussion
// (`DrumSpec`) — discriminated by `voice`, which had to differ anyway. Property
// (1) is *cheaper* on the drum side, not harder: a drum spec builds no filter
// under any setting, so an unedited custom drum is its preset by construction.

import type {
    AnyInstrumentSpec,
    DrumSpec,
    DrumVoice,
    EnvelopeSpec,
    FilterEnvelopeSpec,
    InstrumentSpec,
    InstrumentVoice,
    NoiseSpec,
    OscillatorSpec,
} from '@/types';

// ============================================
// Ranges
// ============================================

/**
 * Envelope bounds, in seconds (sustain is a level).
 *
 * Chosen to contain every built-in comfortably — the widest preset envelope in
 * the library is a 1.2s attack and a 3s decay/release — so clamping a spec
 * derived from a preset is provably a no-op. A test asserts exactly that; if a
 * future preset reaches past these, it fails rather than being quietly trimmed.
 */
export const ENVELOPE_RANGES = {
    attack: { min: 0.001, max: 5 },
    decay: { min: 0.001, max: 5 },
    sustain: { min: 0, max: 1 },
    release: { min: 0.001, max: 10 },
} as const;

/** Macro bounds. Brightness and resonance are 0-100 knob positions. */
export const MACRO_RANGES = {
    brightness: { min: 0, max: 100 },
    resonance: { min: 0, max: 100 },
    level: { min: -24, max: 6 },
} as const;

/**
 * The neutral macro position: wide open, no resonance, no trim.
 *
 * `brightness: 100` is what makes property (1) above true — see
 * `filterSpecFor`, which returns null here rather than an 18kHz lowpass.
 */
export const NEUTRAL_MACROS = {
    brightness: MACRO_RANGES.brightness.max,
    resonance: 0,
    level: 0,
} as const;

/** Cutoff at brightness 0. Dark enough to be a real effect, high enough to still be a note. */
const MIN_CUTOFF_HZ = 120;
/** Cutoff just below brightness 100 — past hearing, so the taper stays smooth into the bypass. */
const MAX_CUTOFF_HZ = 18000;

/** Q at zero resonance. Tone's own default, so no resonance means no colour. */
const MIN_Q = 0.7;
/** Q at full resonance. Enough to whistle; short of self-oscillation. */
const MAX_Q = 12;

/** Oscillator shapes the editor offers. A superset of these is accepted from
 *  presets and files — Tone knows many more, and a spec that could not hold
 *  `custom` or `fatsawtooth` could not reproduce the library. */
export const OSCILLATOR_SHAPES = [
    'sine',
    'triangle',
    'square',
    'sawtooth',
    'pulse',
    'fatsine',
    'fatsawtooth',
] as const;

export type OscillatorShape = (typeof OSCILLATOR_SHAPES)[number];

/** Voices a spec may name — the four the built-in library uses. */
export const INSTRUMENT_VOICES = ['synth', 'monosynth', 'fmsynth', 'amsynth'] as const;

/** The two percussion voices. Also the discriminant: a spec naming one of these is a `DrumSpec`. */
export const DRUM_VOICES = ['membrane', 'noise'] as const;

/** Waves a membrane's body may use. Narrower than the melodic list on purpose —
 *  `pulse` and the detuned `fat` family are bodies for held notes, and on a hit
 *  that lasts 60ms they are the same square with more CPU. */
export const DRUM_OSCILLATOR_SHAPES = ['sine', 'triangle', 'square', 'sawtooth'] as const;

/** Tone's three noise colours, darkest last. */
export const NOISE_TYPES = ['white', 'pink', 'brown'] as const;

/**
 * The two membrane parameters, bounded.
 *
 * Both contain every built-in with room either side — the six synthesised kits
 * span 0.008-0.08 of pitch decay and 2-6 octaves — so clamping a spec taken
 * from a preset is provably a no-op, the same guarantee `ENVELOPE_RANGES`
 * carries for the melodic half. A test asserts it rather than trusting it.
 */
export const DRUM_RANGES = {
    /** Seconds for the pitch to fall. Low is a click, high is a descending boom. */
    pitchDecay: { min: 0.001, max: 0.5 },
    /** How far it falls. 0 is no sweep at all — a tuned tone rather than a drum. */
    octaves: { min: 0, max: 12 },
} as const;

// ============================================
// Knob positions → audio values
// ============================================

function clamp(value: number, min: number, max: number): number {
    if (!Number.isFinite(value)) return min;
    return Math.min(max, Math.max(min, value));
}

/**
 * Brightness 0-100 → cutoff in Hz, on a log taper.
 *
 * Linear Hz would put the entire audible difference in the last few percent of
 * the knob: 9000Hz and 18000Hz are the same sound, 120Hz and 240Hz are an
 * octave. Pitch is logarithmic, so the control has to be.
 */
export function brightnessToFrequency(brightness: number): number {
    const position = clamp(brightness, MACRO_RANGES.brightness.min, MACRO_RANGES.brightness.max) / 100;
    return MIN_CUTOFF_HZ * Math.pow(MAX_CUTOFF_HZ / MIN_CUTOFF_HZ, position);
}

/** Resonance 0-100 → filter Q. */
export function resonanceToQ(resonance: number): number {
    const position = clamp(resonance, MACRO_RANGES.resonance.min, MACRO_RANGES.resonance.max) / 100;
    return MIN_Q + position * (MAX_Q - MIN_Q);
}

/**
 * The tone filter for a spec, or null when there should not be one.
 *
 * Null at full brightness is the whole point: an unedited custom instrument
 * must be its source preset, and a preset with an extra filter node in front of
 * it — however open — is not the same signal path.
 */
export function filterSpecFor(spec: InstrumentSpec): { frequency: number; Q: number } | null {
    if (spec.brightness >= MACRO_RANGES.brightness.max) return null;
    return {
        frequency: brightnessToFrequency(spec.brightness),
        Q: resonanceToQ(spec.resonance),
    };
}

// ============================================
// Spec → voice options
// ============================================

/** Drop absent optional keys so the result matches the preset literal exactly. */
function oscillatorOptions(oscillator: OscillatorSpec): Record<string, unknown> {
    const options: Record<string, unknown> = { type: oscillator.type };
    if (oscillator.partials !== undefined) options.partials = [...oscillator.partials];
    if (oscillator.width !== undefined) options.width = oscillator.width;
    if (oscillator.spread !== undefined) options.spread = oscillator.spread;
    if (oscillator.count !== undefined) options.count = oscillator.count;
    return options;
}

/**
 * The options object a voice is constructed from.
 *
 * This is the file's contract with the browser: the object returned for a
 * preset's own spec must deep-equal the literal that preset's factory passes to
 * `new Tone.PolySynth`. It is asserted here as a golden snapshot over all 52
 * customizable presets, and was checked against live Tone instances once, in a
 * real browser, when the specs were generated.
 */
export function voiceOptions(spec: InstrumentSpec): Record<string, unknown> {
    const options: Record<string, unknown> = {
        oscillator: oscillatorOptions(spec.oscillator),
        envelope: { ...spec.envelope },
    };

    if (spec.filterEnvelope) options.filterEnvelope = { ...spec.filterEnvelope };
    if (spec.modulation) options.modulation = oscillatorOptions(spec.modulation);
    if (spec.modulationEnvelope) options.modulationEnvelope = { ...spec.modulationEnvelope };
    if (spec.harmonicity !== undefined) options.harmonicity = spec.harmonicity;
    if (spec.modulationIndex !== undefined) options.modulationIndex = spec.modulationIndex;

    return options;
}

/**
 * The options object a percussion voice is constructed from.
 *
 * Held to the same contract as `voiceOptions` and by the same golden fixture:
 * what comes out here for a preset's own spec must deep-equal the literal that
 * preset's factory used to hand `new Tone.MembraneSynth`. Absent keys are
 * dropped rather than defaulted, so a noise spec produces no `oscillator` and a
 * membrane produces no `noise` — an extra key with Tone's own default in it
 * would still be a different object from the one that shipped.
 */
export function drumVoiceOptions(spec: DrumSpec): Record<string, unknown> {
    const options: Record<string, unknown> = {};

    if (spec.pitchDecay !== undefined) options.pitchDecay = spec.pitchDecay;
    if (spec.octaves !== undefined) options.octaves = spec.octaves;
    if (spec.oscillator) options.oscillator = oscillatorOptions(spec.oscillator);
    if (spec.noise) options.noise = { type: spec.noise.type };
    options.envelope = { ...spec.envelope };

    return options;
}

/**
 * Which kind of spec this is.
 *
 * The only place the discriminant is read. Written against `DRUM_VOICES` rather
 * than as `spec.voice === 'membrane' || …` so adding a third percussion voice
 * is one edit to the list above.
 */
export function isDrumSpec(spec: AnyInstrumentSpec): spec is DrumSpec {
    return (DRUM_VOICES as readonly string[]).includes(spec.voice);
}

// ============================================
// Clamping
// ============================================

function clampEnvelope(envelope: EnvelopeSpec): EnvelopeSpec {
    return {
        attack: clamp(envelope.attack, ENVELOPE_RANGES.attack.min, ENVELOPE_RANGES.attack.max),
        decay: clamp(envelope.decay, ENVELOPE_RANGES.decay.min, ENVELOPE_RANGES.decay.max),
        sustain: clamp(envelope.sustain, ENVELOPE_RANGES.sustain.min, ENVELOPE_RANGES.sustain.max),
        release: clamp(envelope.release, ENVELOPE_RANGES.release.min, ENVELOPE_RANGES.release.max),
    };
}

/**
 * Bring every editable value inside its range.
 *
 * Total by construction: it rebuilds the spec field by field rather than
 * spreading the input, so a value that arrived from a file cannot ride along
 * unexamined in a key nobody thought about.
 *
 * Overloaded rather than returning the bare union, so a caller holding a
 * melodic spec still holds one afterwards. The two bodies are separate for the
 * same reason the two types are: there is no field they both clamp except the
 * envelope and the level.
 */
export function clampSpec(spec: InstrumentSpec): InstrumentSpec;
export function clampSpec(spec: DrumSpec): DrumSpec;
export function clampSpec(spec: AnyInstrumentSpec): AnyInstrumentSpec;
export function clampSpec(spec: AnyInstrumentSpec): AnyInstrumentSpec {
    return isDrumSpec(spec) ? clampDrumSpec(spec) : clampInstrumentSpec(spec);
}

function clampInstrumentSpec(spec: InstrumentSpec): InstrumentSpec {
    const clamped: InstrumentSpec = {
        voice: spec.voice,
        oscillator: { ...spec.oscillator },
        envelope: clampEnvelope(spec.envelope),
        brightness: clamp(spec.brightness, MACRO_RANGES.brightness.min, MACRO_RANGES.brightness.max),
        resonance: clamp(spec.resonance, MACRO_RANGES.resonance.min, MACRO_RANGES.resonance.max),
        level: clamp(spec.level, MACRO_RANGES.level.min, MACRO_RANGES.level.max),
    };

    // Carried-through voice character. Not editable in v1, so not clamped to a
    // knob range — but still rebuilt rather than spread.
    if (spec.filterEnvelope) clamped.filterEnvelope = { ...spec.filterEnvelope };
    if (spec.modulation) clamped.modulation = { ...spec.modulation };
    if (spec.modulationEnvelope) clamped.modulationEnvelope = { ...spec.modulationEnvelope };
    if (spec.harmonicity !== undefined) clamped.harmonicity = spec.harmonicity;
    if (spec.modulationIndex !== undefined) clamped.modulationIndex = spec.modulationIndex;

    return clamped;
}

function clampDrumSpec(spec: DrumSpec): DrumSpec {
    const clamped: DrumSpec = {
        voice: spec.voice,
        envelope: clampEnvelope(spec.envelope),
        level: clamp(spec.level, MACRO_RANGES.level.min, MACRO_RANGES.level.max),
    };

    // Per-voice fields are carried only when they belong to that voice. A
    // membrane's `oscillator` surviving onto a noise spec would be dropped by
    // `drumVoiceOptions` anyway, but it would be dropped *silently* — and this
    // object is what gets written to IndexedDB and to an export file.
    if (spec.voice === 'membrane') {
        if (spec.oscillator) clamped.oscillator = { ...spec.oscillator };
        if (spec.pitchDecay !== undefined) {
            clamped.pitchDecay = clamp(spec.pitchDecay, DRUM_RANGES.pitchDecay.min, DRUM_RANGES.pitchDecay.max);
        }
        if (spec.octaves !== undefined) {
            clamped.octaves = clamp(spec.octaves, DRUM_RANGES.octaves.min, DRUM_RANGES.octaves.max);
        }
    } else if (spec.noise) {
        clamped.noise = { type: spec.noise.type };
    }

    return clamped;
}

// ============================================
// Parsing untrusted input
// ============================================

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readNumber(value: unknown, fallback: number): number {
    return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function readEnvelope(value: unknown, fallback: EnvelopeSpec): EnvelopeSpec {
    if (!isRecord(value)) return { ...fallback };
    return {
        attack: readNumber(value.attack, fallback.attack),
        decay: readNumber(value.decay, fallback.decay),
        sustain: readNumber(value.sustain, fallback.sustain),
        release: readNumber(value.release, fallback.release),
    };
}

function readOscillator(value: unknown): OscillatorSpec | null {
    if (!isRecord(value) || typeof value.type !== 'string') return null;

    const oscillator: OscillatorSpec = { type: value.type };
    if (Array.isArray(value.partials)) {
        const partials = value.partials.filter((p): p is number => typeof p === 'number' && Number.isFinite(p));
        if (partials.length > 0) oscillator.partials = partials;
    }
    if (typeof value.width === 'number' && Number.isFinite(value.width)) oscillator.width = value.width;
    if (typeof value.spread === 'number' && Number.isFinite(value.spread)) oscillator.spread = value.spread;
    if (typeof value.count === 'number' && Number.isFinite(value.count)) oscillator.count = value.count;
    return oscillator;
}

const DEFAULT_ENVELOPE: EnvelopeSpec = { attack: 0.01, decay: 0.3, sustain: 0.5, release: 0.5 };

/** A percussive repair: instant, short, and gone. A drum that inherited the
 *  melodic default above would sustain at half level and never stop. */
const DEFAULT_DRUM_ENVELOPE: EnvelopeSpec = { attack: 0.001, decay: 0.2, sustain: 0, release: 0.05 };

/**
 * Read a spec out of parsed JSON, or null if it is not one.
 *
 * Written for a file a stranger sent: every field is checked, unknown keys are
 * dropped rather than carried, and the result is clamped. A malformed voice or
 * a missing oscillator is a rejection, not a repair — those two decide what is
 * constructed, and guessing at them would build the wrong instrument silently.
 */
export function parseInstrumentSpec(value: unknown): AnyInstrumentSpec | null {
    if (!isRecord(value)) return null;

    const voice = value.voice;
    if (typeof voice !== 'string') return null;
    if ((DRUM_VOICES as readonly string[]).includes(voice)) {
        return parseDrumSpec(voice as DrumVoice, value);
    }
    if (!(INSTRUMENT_VOICES as readonly string[]).includes(voice)) return null;

    const oscillator = readOscillator(value.oscillator);
    if (!oscillator) return null;

    const spec: InstrumentSpec = {
        voice: voice as InstrumentVoice,
        oscillator,
        envelope: readEnvelope(value.envelope, DEFAULT_ENVELOPE),
        brightness: readNumber(value.brightness, NEUTRAL_MACROS.brightness),
        resonance: readNumber(value.resonance, NEUTRAL_MACROS.resonance),
        level: readNumber(value.level, NEUTRAL_MACROS.level),
    };

    if (isRecord(value.filterEnvelope)) {
        const envelope = readEnvelope(value.filterEnvelope, DEFAULT_ENVELOPE);
        spec.filterEnvelope = {
            ...envelope,
            baseFrequency: readNumber(value.filterEnvelope.baseFrequency, 200),
            octaves: readNumber(value.filterEnvelope.octaves, 2),
        } satisfies FilterEnvelopeSpec;
    }

    const modulation = readOscillator(value.modulation);
    if (modulation) spec.modulation = modulation;
    if (isRecord(value.modulationEnvelope)) {
        spec.modulationEnvelope = readEnvelope(value.modulationEnvelope, DEFAULT_ENVELOPE);
    }
    if (typeof value.harmonicity === 'number' && Number.isFinite(value.harmonicity)) {
        spec.harmonicity = value.harmonicity;
    }
    if (typeof value.modulationIndex === 'number' && Number.isFinite(value.modulationIndex)) {
        spec.modulationIndex = value.modulationIndex;
    }

    return clampSpec(spec);
}

function readNoise(value: unknown): NoiseSpec | null {
    if (!isRecord(value)) return null;
    if (typeof value.type !== 'string') return null;
    if (!(NOISE_TYPES as readonly string[]).includes(value.type)) return null;
    return { type: value.type as NoiseSpec['type'] };
}

/**
 * Tone's own MembraneSynth defaults, used when a file omits them.
 *
 * Tone's rather than any preset's: a spec that does not mention a field is
 * asking for whatever the constructor would have done, and answering with
 * "whatever the Classic Drum does" would make an incomplete file sound like a
 * particular instrument for no reason it could state.
 */
export const TONE_MEMBRANE_DEFAULTS = { pitchDecay: 0.05, octaves: 10 } as const;

/**
 * The percussion half of `parseInstrumentSpec`.
 *
 * The strictness is the same and lands in the same place: the field that
 * decides the *timbre* must be present and well-formed — the body's wave for a
 * membrane, the colour for a noise burst — because guessing at it builds a
 * different drum and says nothing. Everything else is repaired.
 */
function parseDrumSpec(voice: DrumVoice, value: Record<string, unknown>): DrumSpec | null {
    const spec: DrumSpec = {
        voice,
        envelope: readEnvelope(value.envelope, DEFAULT_DRUM_ENVELOPE),
        level: readNumber(value.level, NEUTRAL_MACROS.level),
    };

    if (voice === 'membrane') {
        const oscillator = readOscillator(value.oscillator);
        if (!oscillator) return null;
        spec.oscillator = oscillator;
        spec.pitchDecay = readNumber(value.pitchDecay, TONE_MEMBRANE_DEFAULTS.pitchDecay);
        spec.octaves = readNumber(value.octaves, TONE_MEMBRANE_DEFAULTS.octaves);
    } else {
        const noise = readNoise(value.noise);
        if (!noise) return null;
        spec.noise = noise;
    }

    return clampSpec(spec);
}

// ============================================
// Identity
// ============================================

/** Prefix on every custom instrument id. */
export const CUSTOM_INSTRUMENT_PREFIX = 'custom:';

/**
 * Whether an `instrumentPreset` string names a custom instrument.
 *
 * `Track.instrumentPreset` and `Clip.instrumentPreset` are plain strings, which
 * is what lets a custom instrument be assigned without touching the project
 * schema at all — so the prefix is the only thing distinguishing the two kinds,
 * and it is checked here rather than inline anywhere.
 */
export function isCustomInstrumentId(id: string | undefined): boolean {
    return typeof id === 'string' && id.startsWith(CUSTOM_INSTRUMENT_PREFIX);
}
