// ============================================
// ComposeYogi — Browser Data & Types
// Templates, Instruments, Samples, FX
// ============================================

import type { TrackType, TrackColor, Note } from '@/types';

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
}

export interface InstrumentItem {
    id: string;
    name: string;
    category: 'synth' | 'keys' | 'bass' | 'pad' | 'lead';
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
            { id: 'kick-deep', name: 'Kick - Deep', duration: 0.5 },
            { id: 'kick-punchy', name: 'Kick - Punchy', duration: 0.4 },
            { id: 'kick-808', name: 'Kick - 808', duration: 0.8 },
            { id: 'snare-crisp', name: 'Snare - Crisp', duration: 0.3 },
            { id: 'snare-lofi', name: 'Snare - Lo-Fi', duration: 0.35 },
            { id: 'snare-clap', name: 'Snare - Clap', duration: 0.25 },
            { id: 'hihat-closed', name: 'Hi-Hat - Closed', duration: 0.1 },
            { id: 'hihat-open', name: 'Hi-Hat - Open', duration: 0.4 },
            { id: 'hihat-pedal', name: 'Hi-Hat - Pedal', duration: 0.15 },
            { id: 'perc-rim', name: 'Perc - Rim', duration: 0.2 },
            { id: 'perc-shaker', name: 'Perc - Shaker', duration: 0.3 },
        ],
    },
    {
        id: 'bass',
        name: 'Bass',
        icon: '🎸',
        samples: [
            { id: '808-sub-c', name: '808 Sub C', duration: 1.5, key: 'C' },
            { id: '808-sub-f', name: '808 Sub F', duration: 1.5, key: 'F' },
            { id: 'bass-hit', name: 'Bass Hit', duration: 0.8 },
        ],
    },
    {
        id: 'melodic',
        name: 'Melodic',
        icon: '🎹',
        samples: [
            { id: 'piano-chord-c', name: 'Piano Chord C', duration: 2.0, key: 'C' },
            { id: 'piano-chord-am', name: 'Piano Chord Am', duration: 2.0, key: 'A' },
            { id: 'synth-stab', name: 'Synth Stab', duration: 0.5 },
        ],
    },
    {
        id: 'loops',
        name: 'Loops',
        icon: '🔄',
        samples: [
            { id: 'drum-loop-90', name: 'Drum Loop 90 BPM', duration: 2.67, bpm: 90 },
            { id: 'drum-loop-120', name: 'Drum Loop 120 BPM', duration: 2.0, bpm: 120 },
            { id: 'hats-loop-140', name: 'Hats Loop 140 BPM', duration: 1.71, bpm: 140 },
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
