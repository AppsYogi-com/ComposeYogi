// ============================================
// ComposeYogi — Browser Data & Types
// Templates, Instruments, Samples, FX
// ============================================

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
    category: 'synth' | 'keys' | 'bass' | 'pad' | 'lead' | 'drums';
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

export const TEMPLATES: TemplateItem[] = [
    {
        id: 'lofi-chill',
        name: 'Lo-Fi Chill',
        emoji: '🎧',
        description: 'Relaxed beats with dusty piano and vinyl crackle',
        genre: 'Lo-Fi',
        bpm: 85,
        key: 'C',
        scale: 'minor',
        tracks: [
            { name: 'Drums', type: 'drum', color: 'drums' },
            { name: 'E-Piano', type: 'midi', color: 'keys', instrumentId: 'electric-piano' },
            { name: 'Sub Bass', type: 'midi', color: 'bass', instrumentId: 'sub-bass' },
            { name: 'Vinyl Any', type: 'midi', color: 'fx', instrumentId: 'warm-pad' },
        ]
    },
    {
        id: 'trap-beat',
        name: 'Trap Beat',
        emoji: '🔥',
        description: 'Hard-hitting 808s with rolling hi-hats',
        genre: 'Trap',
        bpm: 140,
        key: 'F',
        scale: 'minor',
        tracks: [
            { name: 'Trap Drums', type: 'drum', color: 'drums' },
            { name: '808 Bass', type: 'midi', color: 'bass', instrumentId: 'sub-bass' },
            { name: 'Pluck', type: 'midi', color: 'melody', instrumentId: 'basic-synth' },
            { name: 'Dark Pad', type: 'midi', color: 'fx', instrumentId: 'string-pad' },
        ]
    },
    {
        id: 'ambient',
        name: 'Ambient',
        emoji: '🌊',
        description: 'Ethereal pads and gentle textures',
        genre: 'Ambient',
        bpm: 70,
        key: 'A',
        scale: 'major',
        tracks: [
            { name: 'Atmosphere', type: 'midi', color: 'fx', instrumentId: 'warm-pad' },
            { name: 'Strings', type: 'midi', color: 'keys', instrumentId: 'string-pad' },
            { name: 'Soft Keys', type: 'midi', color: 'keys', instrumentId: 'electric-piano' },
        ]
    },
    {
        id: 'afro-groove',
        name: 'Afro Groove',
        emoji: '💃',
        description: 'Energetic rhythms with percussive elements',
        genre: 'Afrobeats',
        bpm: 105,
        key: 'G',
        scale: 'major',
        tracks: [
            { name: 'Afro Perc', type: 'drum', color: 'drums' },
            { name: 'Log Drum', type: 'midi', color: 'bass', instrumentId: 'synth-bass' },
            { name: 'Chords', type: 'midi', color: 'keys', instrumentId: 'bright-piano' },
            { name: 'Lead', type: 'midi', color: 'melody', instrumentId: 'saw-lead' },
        ]
    },
    {
        id: 'pop-starter',
        name: 'Pop Starter',
        emoji: '🎵',
        description: 'Modern pop foundation with catchy hooks',
        genre: 'Pop',
        bpm: 120,
        key: 'C',
        scale: 'major',
        tracks: [
            { name: 'Pop Drums', type: 'drum', color: 'drums' },
            { name: 'Bass Guitar', type: 'midi', color: 'bass', instrumentId: 'synth-bass' },
            { name: 'Piano', type: 'midi', color: 'keys', instrumentId: 'bright-piano' },
            { name: 'Top Line', type: 'midi', color: 'melody', instrumentId: 'basic-synth' },
        ]
    },
    {
        id: 'edm-drop',
        name: 'EDM Drop',
        emoji: '⚡',
        description: 'High-energy build-ups and drops',
        genre: 'EDM',
        bpm: 128,
        key: 'A',
        scale: 'minor',
        tracks: [
            { name: 'Big Drums', type: 'drum', color: 'drums' },
            { name: 'Super Saw', type: 'midi', color: 'melody', instrumentId: 'saw-lead' },
            { name: 'Sub Bass', type: 'midi', color: 'bass', instrumentId: 'sub-bass' },
            { name: 'Growl', type: 'midi', color: 'fx', instrumentId: 'square-lead' },
        ]
    },
];

// ============================================
// Instruments Data
// ============================================

export const INSTRUMENTS: InstrumentItem[] = [
    // Synths
    {
        id: 'basic-synth',
        name: 'Basic Synth',
        category: 'synth',
        description: 'Clean, versatile synthesizer',
        trackType: 'midi',
        trackColor: 'melody',
    },
    {
        id: 'saw-lead',
        name: 'Saw Lead',
        category: 'lead',
        description: 'Bright sawtooth lead',
        trackType: 'midi',
        trackColor: 'melody',
    },
    {
        id: 'square-lead',
        name: 'Square Lead',
        category: 'lead',
        description: 'Retro square wave sound',
        trackType: 'midi',
        trackColor: 'melody',
    },
    {
        id: 'fm-lead',
        name: 'FM Lead',
        category: 'lead',
        description: 'Bell-like metallic FM lead',
        trackType: 'midi',
        trackColor: 'melody',
    },
    {
        id: 'pulse-lead',
        name: 'Pulse Lead',
        category: 'lead',
        description: 'Warm pulse width modulation lead',
        trackType: 'midi',
        trackColor: 'melody',
    },
    // Keys
    {
        id: 'electric-piano',
        name: 'Electric Piano',
        category: 'keys',
        description: 'Warm Rhodes-style keys',
        trackType: 'midi',
        trackColor: 'keys',
    },
    {
        id: 'bright-piano',
        name: 'Bright Piano',
        category: 'keys',
        description: 'Clear acoustic piano',
        trackType: 'midi',
        trackColor: 'keys',
    },
    {
        id: 'organ',
        name: 'Organ',
        category: 'keys',
        description: 'Sustained drawbar organ with harmonics',
        trackType: 'midi',
        trackColor: 'keys',
    },
    {
        id: 'clavinet',
        name: 'Clavinet',
        category: 'keys',
        description: 'Percussive funky keys with bite',
        trackType: 'midi',
        trackColor: 'keys',
    },
    // Bass
    {
        id: 'sub-bass',
        name: 'Sub Bass',
        category: 'bass',
        description: 'Deep 808-style sub',
        trackType: 'midi',
        trackColor: 'bass',
    },
    {
        id: 'synth-bass',
        name: 'Synth Bass',
        category: 'bass',
        description: 'Punchy analog bass',
        trackType: 'midi',
        trackColor: 'bass',
    },
    {
        id: 'fm-bass',
        name: 'FM Bass',
        category: 'bass',
        description: 'Metallic growly FM synthesis bass',
        trackType: 'midi',
        trackColor: 'bass',
    },
    {
        id: 'pluck-bass',
        name: 'Pluck Bass',
        category: 'bass',
        description: 'Short pizzicato-style bass',
        trackType: 'midi',
        trackColor: 'bass',
    },
    // Pads
    {
        id: 'warm-pad',
        name: 'Warm Pad',
        category: 'pad',
        description: 'Soft, atmospheric pad',
        trackType: 'midi',
        trackColor: 'fx',
    },
    {
        id: 'string-pad',
        name: 'String Pad',
        category: 'pad',
        description: 'Orchestral string texture',
        trackType: 'midi',
        trackColor: 'fx',
    },
    {
        id: 'choir-pad',
        name: 'Choir Pad',
        category: 'pad',
        description: 'Detuned vocal-like choral pad',
        trackType: 'midi',
        trackColor: 'fx',
    },
    {
        id: 'glass-pad',
        name: 'Glass Pad',
        category: 'pad',
        description: 'Crystalline FM shimmer pad',
        trackType: 'midi',
        trackColor: 'fx',
    },
    // Synths - Additional
    {
        id: 'pluck-synth',
        name: 'Pluck',
        category: 'synth',
        description: 'Short harp/guitar-like pluck',
        trackType: 'midi',
        trackColor: 'melody',
    },
    {
        id: 'bell-synth',
        name: 'Bell',
        category: 'synth',
        description: 'FM bell with metallic harmonics',
        trackType: 'midi',
        trackColor: 'melody',
    },
    // Drums
    {
        id: 'drum-sampler',
        name: 'Drum Kit',
        category: 'drums',
        description: 'Standard kit with deep kick, snares & hats',
        trackType: 'drum',
        trackColor: 'drums',
    },
    {
        id: 'punchy-kit',
        name: 'Punchy Drum',
        category: 'drums',
        description: 'Tight punchy kick with crisp snare',
        trackType: 'drum',
        trackColor: 'drums',
    },
    {
        id: 'drum-synth',
        name: 'Classic Drum',
        category: 'drums',
        description: 'Pure synthesized knock sound, no samples',
        trackType: 'drum',
        trackColor: 'drums',
    },
    {
        id: '808-kit',
        name: '808 Kit',
        category: 'drums',
        description: 'Classic TR-808 style with deep sub kick & claps',
        trackType: 'drum',
        trackColor: 'drums',
    },
    {
        id: 'acoustic-kit',
        name: 'Acoustic Kit',
        category: 'drums',
        description: 'Natural punchy acoustic drum sounds',
        trackType: 'drum',
        trackColor: 'drums',
    },
    {
        id: 'lofi-kit',
        name: 'Lo-Fi Kit',
        category: 'drums',
        description: 'Muted dusty lo-fi drum character',
        trackType: 'drum',
        trackColor: 'drums',
    },
    {
        id: 'electronic-kit',
        name: 'Electronic Kit',
        category: 'drums',
        description: 'Punchy tight modern electronic drums',
        trackType: 'drum',
        trackColor: 'drums',
    },
];

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
