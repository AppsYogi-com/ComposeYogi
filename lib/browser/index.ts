// ============================================
// ComposeYogi — Browser Data & Types
// Templates, Instruments, Samples, FX
// ============================================

import { SYNTH_PRESETS, SYNTH_PRESET_IDS, type SynthPresetId } from '@/lib/audio/synth-presets';
import { DEMO_TEMPLATES } from '@/lib/templates/demo-templates';

import type { TrackType, TrackColor } from '@/types';

// ============================================
// Types
// ============================================

export type BrowserTab = 'templates' | 'instruments' | 'samples' | 'fx';

export interface TemplateItem {
    id: string;
    name: string;
    emoji: string;
    description: string;
    genre: string;
    bpm: number;
    key: string;
    scale: string;
    tracks: {
        name: string;
        type: TrackType;
        color: TrackColor;
        instrumentId?: string;
    }[];
}

export interface InstrumentItem {
    id: string;
    name: string;
    category: 'synth' | 'keys' | 'bass' | 'pad' | 'lead' | 'drums' | 'idiophones' | 'plucked-strings' | 'bowed-strings' | 'wind';
    description: string;
    trackType: TrackType;
    trackColor: TrackColor;
}

export interface SampleFolder {
    id: string;
    name: string;
    icon: string;
    samples: SampleItem[];
}

export interface SampleItem {
    id: string;
    name: string;
    url: string;
    duration: number; // in seconds
    bpm?: number; // for loops
    key?: string; // for melodic samples
}

export interface FXPreset {
    id: string;
    name: string;
    category: 'reverb' | 'delay' | 'distortion' | 'filter' | 'compression';
    description: string;
}

// ============================================
// Templates Data
// ============================================
//
// Derived from DEMO_TEMPLATES — the single source of truth for template
// content. The browser panel only needs the summary fields; clicking a card
// loads the full arrangement (tracks *and* clips) through loadDemoTemplate.
// Before this was derived, the panel had its own parallel list and loading a
// template produced a silent project with no music in it.

export const TEMPLATES: TemplateItem[] = DEMO_TEMPLATES.map((template) => ({
    id: template.id,
    name: template.name,
    emoji: template.emoji,
    description: template.description,
    genre: template.genre,
    bpm: template.bpm,
    key: template.key,
    scale: template.scale,
    tracks: template.tracks.map((track) => ({
        name: track.name,
        type: track.type,
        color: track.color,
        instrumentId: track.instrumentPreset,
    })),
}));

// ============================================
// Instruments Data
// ============================================

/**
 * Browser-only metadata for each instrument: the blurb shown on the card and
 * the kind of track a drag-and-drop creates. Identity (id, display name,
 * category) comes from SYNTH_PRESETS — the audio engine's registry — so the two
 * lists can no longer drift apart the way they did in the duplicate-euphonium
 * bug (#20).
 *
 * This is typed `Record<SynthPresetId, …>`: add a preset without metadata (or
 * metadata without a preset) and the build fails instead of shipping an
 * instrument that is silent or invisible.
 */
const INSTRUMENT_META: Record<SynthPresetId, {
    description: string;
    trackType: TrackType;
    trackColor: TrackColor;
}> = {
    // Synths
    'basic-synth': { description: 'Clean, versatile synthesizer', trackType: 'midi', trackColor: 'melody' },
    'saw-lead': { description: 'Bright sawtooth lead', trackType: 'midi', trackColor: 'melody' },
    'square-lead': { description: 'Retro square wave sound', trackType: 'midi', trackColor: 'melody' },
    'fm-lead': { description: 'Bell-like metallic FM lead', trackType: 'midi', trackColor: 'melody' },
    'pulse-lead': { description: 'Warm pulse width modulation lead', trackType: 'midi', trackColor: 'melody' },

    // Keys
    'electric-piano': { description: 'Warm Rhodes-style keys', trackType: 'midi', trackColor: 'keys' },
    'bright-piano': { description: 'Clear acoustic piano', trackType: 'midi', trackColor: 'keys' },
    'harpsichord': { description: 'Baroque plucked-string keyboard with metallic twang', trackType: 'midi', trackColor: 'keys' },
    'organ': { description: 'Sustained drawbar organ with harmonics', trackType: 'midi', trackColor: 'keys' },
    'clavinet': { description: 'Percussive funky keys with bite', trackType: 'midi', trackColor: 'keys' },

    // Bass
    'sub-bass': { description: 'Deep 808-style sub', trackType: 'midi', trackColor: 'bass' },
    'synth-bass': { description: 'Punchy analog bass', trackType: 'midi', trackColor: 'bass' },
    'fm-bass': { description: 'Metallic growly FM synthesis bass', trackType: 'midi', trackColor: 'bass' },
    'pluck-bass': { description: 'Short pizzicato-style bass', trackType: 'midi', trackColor: 'bass' },

    // Pads
    'warm-pad': { description: 'Soft, atmospheric pad', trackType: 'midi', trackColor: 'fx' },
    'string-pad': { description: 'Orchestral string texture', trackType: 'midi', trackColor: 'fx' },
    'choir-pad': { description: 'Detuned vocal-like choral pad', trackType: 'midi', trackColor: 'fx' },
    'glass-pad': { description: 'Crystalline FM shimmer pad', trackType: 'midi', trackColor: 'fx' },

    // Synths - Additional
    'pluck-synth': { description: 'Short harp/guitar-like pluck', trackType: 'midi', trackColor: 'melody' },
    'bell-synth': { description: 'FM bell with metallic harmonics', trackType: 'midi', trackColor: 'melody' },

    // Idiophones / Pitched Percussion
    'chimes': { description: 'Metallic pipe chimes with long ring', trackType: 'midi', trackColor: 'keys' },
    'marimba': { description: 'Warm wooden mallet percussion', trackType: 'midi', trackColor: 'keys' },
    'xylophone': { description: 'Bright, short wooden tone', trackType: 'midi', trackColor: 'keys' },
    'vibraphone': { description: 'Sustained metallic mallet with vibrato', trackType: 'midi', trackColor: 'keys' },
    'kalimba': { description: 'Delicate African thumb piano', trackType: 'midi', trackColor: 'keys' },
    'celeste': { description: 'Gentle music-box bell tone', trackType: 'midi', trackColor: 'keys' },
    'glockenspiel': { description: 'Bright metallic orchestral bells', trackType: 'midi', trackColor: 'keys' },
    'steel-pan': { description: 'Bright shimmery Caribbean bell-like tones', trackType: 'midi', trackColor: 'keys' },

    // Plucked Strings
    'guitar': { description: 'Warm nylon-like plucked string', trackType: 'midi', trackColor: 'melody' },
    'harp': { description: 'Gentle plucked harp string', trackType: 'midi', trackColor: 'melody' },
    'pizzicato': { description: 'Short orchestral plucked string', trackType: 'midi', trackColor: 'melody' },
    'ukulele': { description: 'Bright small-bodied pluck', trackType: 'midi', trackColor: 'melody' },
    'banjo': { description: 'Twangy bright plucked string', trackType: 'midi', trackColor: 'melody' },

    // Bowed Strings
    'violin': { description: 'Bright bowed string', trackType: 'midi', trackColor: 'melody' },
    'cello': { description: 'Warm rich bowed string', trackType: 'midi', trackColor: 'melody' },
    'double-bass': { description: 'Deep bowed orchestral bass', trackType: 'midi', trackColor: 'bass' },
    'tenor-violin': { description: 'Mellow viola-like bowed string', trackType: 'midi', trackColor: 'melody' },
    'fiddle': { description: 'Lively bright bowed string', trackType: 'midi', trackColor: 'melody' },

    // Wind (merged Woodwind + Brass)
    'flute': { description: 'Pure breathy woodwind tone', trackType: 'midi', trackColor: 'melody' },
    'piccolo': { description: 'Bright high-pitched flute', trackType: 'midi', trackColor: 'melody' },
    'saxophone': { description: 'Rich reedy tone with harmonics', trackType: 'midi', trackColor: 'melody' },
    'bassoon': { description: 'Dark low woodwind', trackType: 'midi', trackColor: 'melody' },
    'oboe': { description: 'Nasal reedy orchestral woodwind', trackType: 'midi', trackColor: 'melody' },
    'trumpet': { description: 'Bright brassy fanfare tone', trackType: 'midi', trackColor: 'melody' },
    'euphonium': { description: 'Warm mellow low-brass tone', trackType: 'midi', trackColor: 'melody' },

    // Additional
    'didgeridoo': { description: 'Deep droning Australian wind instrument', trackType: 'midi', trackColor: 'melody' },
    'vocal-synth': { description: 'Formant-like vocal ahh articulation', trackType: 'midi', trackColor: 'vocals' },
    'orchestra-hit': { description: 'Classic big orchestral stab chord', trackType: 'midi', trackColor: 'melody' },
    'guzheng': { description: 'Chinese plucked zither with bright twang', trackType: 'midi', trackColor: 'melody' },

    // Drums
    'synth-drum-kit': { description: 'Punchy synthesized drums, no samples', trackType: 'drum', trackColor: 'drums' },
    'drum-sampler': { description: 'Standard kit with deep kick, snares & hats', trackType: 'drum', trackColor: 'drums' },
    'punchy-kit': { description: 'Tight punchy kick with crisp snare', trackType: 'drum', trackColor: 'drums' },
    'drum-synth': { description: 'Pure synthesized knock sound, no samples', trackType: 'drum', trackColor: 'drums' },
    '808-kit': { description: 'Classic TR-808 style with deep sub kick & claps', trackType: 'drum', trackColor: 'drums' },
    'acoustic-kit': { description: 'Natural punchy acoustic drum sounds', trackType: 'drum', trackColor: 'drums' },
    'lofi-kit': { description: 'Muted dusty lo-fi drum character', trackType: 'drum', trackColor: 'drums' },
    'electronic-kit': { description: 'Punchy tight modern electronic drums', trackType: 'drum', trackColor: 'drums' },
    'bongos': { description: 'Afro-Cuban high-pitched hand drum pair', trackType: 'drum', trackColor: 'drums' },
    'wooden-block': { description: 'Sharp clicky percussive wood crack', trackType: 'drum', trackColor: 'drums' },
    'taiko': { description: 'Deep resonant Japanese drum', trackType: 'drum', trackColor: 'drums' },
    'maracas': { description: 'Shaker noise burst percussion', trackType: 'drum', trackColor: 'drums' },

    // Basic Waveform Synths
    'square-wave': { description: 'Classic hollow buzzy 8-bit tone', trackType: 'midi', trackColor: 'melody' },
    'triangle-wave': { description: 'Soft mellow flute-like pure tone', trackType: 'midi', trackColor: 'melody' },
    'sawtooth-wave': { description: 'Bright buzzy harmonically rich waveform', trackType: 'midi', trackColor: 'melody' },
};

export const INSTRUMENTS: InstrumentItem[] = SYNTH_PRESET_IDS.map((id) => {
    const preset = SYNTH_PRESETS[id];
    const meta = INSTRUMENT_META[id];
    return {
        id,
        name: preset.name,
        category: preset.category,
        description: meta.description,
        trackType: meta.trackType,
        trackColor: meta.trackColor,
    };
});

// ============================================
// Samples Data
// ============================================

export const SAMPLE_FOLDERS: SampleFolder[] = [
    {
        id: 'drums',
        name: 'Drums',
        icon: '🥁',
        samples: [
            { id: 'kick-deep', name: 'Kick - Deep', url: '/samples/drums/kick-deep.wav', duration: 0.5 },
            { id: 'kick-punchy', name: 'Kick - Punchy', url: '/samples/drums/kick-punchy.wav', duration: 0.4 },
            { id: 'kick-808', name: 'Kick - 808', url: '/samples/drums/kick-808.wav', duration: 0.8 },
            { id: 'snare-crisp', name: 'Snare - Crisp', url: '/samples/drums/snare-crisp.wav', duration: 0.3 },
            { id: 'snare-lofi', name: 'Snare - Lo-Fi', url: '/samples/drums/snare-lofi.wav', duration: 0.35 },
            { id: 'snare-clap', name: 'Snare - Clap', url: '/samples/drums/snare-clap.wav', duration: 0.25 },
            { id: 'hihat-closed', name: 'Hi-Hat - Closed', url: '/samples/drums/hihat-closed.wav', duration: 0.1 },
            { id: 'hihat-open', name: 'Hi-Hat - Open', url: '/samples/drums/hihat-open.wav', duration: 0.4 },
            { id: 'hihat-pedal', name: 'Hi-Hat - Pedal', url: '/samples/drums/hihat-pedal.wav', duration: 0.15 },
            { id: 'perc-rim', name: 'Perc - Rim', url: '/samples/drums/perc-rim.wav', duration: 0.2 },
            { id: 'perc-shaker', name: 'Perc - Shaker', url: '/samples/drums/perc-shaker.wav', duration: 0.3 },
        ],
    },
    {
        id: 'bass',
        name: 'Bass',
        icon: '🎸',
        samples: [
            { id: '808-sub-c', name: '808 Sub C', url: '/samples/bass/808-sub-c.wav', duration: 1.5, key: 'C' },
            { id: '808-sub-f', name: '808 Sub F', url: '/samples/bass/808-sub-f.wav', duration: 1.5, key: 'F' },
            { id: 'bass-hit', name: 'Bass Hit', url: '/samples/bass/bass-hit.wav', duration: 0.8 },
        ],
    },
    {
        id: 'melodic',
        name: 'Melodic',
        icon: '🎹',
        samples: [
            { id: 'piano-chord-c', name: 'Piano Chord C', url: '/samples/melodic/piano-chord-c.wav', duration: 2.0, key: 'C' },
            { id: 'piano-chord-am', name: 'Piano Chord Am', url: '/samples/melodic/piano-chord-am.wav', duration: 2.0, key: 'A' },
            { id: 'synth-stab', name: 'Synth Stab', url: '/samples/melodic/synth-stab.wav', duration: 0.5 },
        ],
    },
    {
        id: 'loops',
        name: 'Loops',
        icon: '🔄',
        samples: [
            { id: 'drum-loop-90', name: 'Drum Loop 90 BPM', url: '/samples/loops/drum-loop-90.wav', duration: 2.67, bpm: 90 },
            { id: 'drum-loop-120', name: 'Drum Loop 120 BPM', url: '/samples/loops/drum-loop-120.wav', duration: 2.0, bpm: 120 },
            { id: 'hats-loop-140', name: 'Hats Loop 140 BPM', url: '/samples/loops/hats-loop-140.wav', duration: 1.71, bpm: 140 },
        ],
    },
];

// ============================================
// FX Presets Data
// ============================================

export const FX_PRESETS: FXPreset[] = [
    // Reverb
    {
        id: 'room-reverb',
        name: 'Room',
        category: 'reverb',
        description: 'Small room ambience',
    },
    {
        id: 'hall-reverb',
        name: 'Hall',
        category: 'reverb',
        description: 'Large concert hall',
    },
    {
        id: 'plate-reverb',
        name: 'Plate',
        category: 'reverb',
        description: 'Classic plate reverb',
    },
    // Delay
    {
        id: 'ping-pong',
        name: 'Ping Pong',
        category: 'delay',
        description: 'Stereo bouncing delay',
    },
    {
        id: 'tape-delay',
        name: 'Tape Delay',
        category: 'delay',
        description: 'Warm analog delay',
    },
    // Distortion
    {
        id: 'soft-saturation',
        name: 'Soft Saturation',
        category: 'distortion',
        description: 'Gentle warmth',
    },
    {
        id: 'bit-crush',
        name: 'Bit Crush',
        category: 'distortion',
        description: 'Lo-fi digital grit',
    },
    // Filter
    {
        id: 'lowpass',
        name: 'Low Pass',
        category: 'filter',
        description: 'Remove high frequencies',
    },
    {
        id: 'highpass',
        name: 'High Pass',
        category: 'filter',
        description: 'Remove low frequencies',
    },
    // Compression
    {
        id: 'gentle-comp',
        name: 'Gentle Comp',
        category: 'compression',
        description: 'Subtle dynamic control',
    },
    {
        id: 'punch-comp',
        name: 'Punch',
        category: 'compression',
        description: 'Add punch and presence',
    },
];

// ============================================
// Instrument Categories for grouping
// ============================================

export const INSTRUMENT_CATEGORIES = [
    { id: 'drums', name: 'Drums', icon: '🥁' },
    { id: 'idiophones', name: 'Idiophones', icon: '🔔' },
    { id: 'plucked-strings', name: 'Plucked Strings', icon: '🎸' },
    { id: 'bowed-strings', name: 'Bowed Strings', icon: '🎻' },
    { id: 'wind', name: 'Wind', icon: '🎷' },
    { id: 'synth', name: 'Synths', icon: '🎛️' },
    { id: 'keys', name: 'Keys', icon: '🎹' },
    { id: 'bass', name: 'Bass', icon: '🎸' },
    { id: 'lead', name: 'Leads', icon: '🎵' },
    { id: 'pad', name: 'Pads', icon: '☁️' },
] as const;

// ============================================
// FX Categories for grouping
// ============================================

export const FX_CATEGORIES = [
    { id: 'reverb', name: 'Reverb', icon: '🌀' },
    { id: 'delay', name: 'Delay', icon: '📢' },
    { id: 'distortion', name: 'Distortion', icon: '⚡' },
    { id: 'filter', name: 'Filter', icon: '🎚️' },
    { id: 'compression', name: 'Compression', icon: '📊' },
] as const;
