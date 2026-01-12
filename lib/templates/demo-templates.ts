// ============================================
// Demo Templates - Fully Produced 16-bar Arrangements
// ============================================

import type { TrackType, TrackColor, TrackEffectType } from '@/types';

// ============================================
// Types
// ============================================

export interface DemoNote {
    pitch: number;
    startBeat: number;
    duration: number;
    velocity: number;
}

export interface DemoClip {
    name: string;
    trackIndex: number;
    startBar: number;
    lengthBars: number;
    notes?: DemoNote[];
}

export interface DemoTrack {
    name: string;
    type: TrackType;
    color: TrackColor;
    instrumentPreset?: string;
    volume: number;
    pan: number;
    effects?: Array<{
        type: TrackEffectType;
        params: Record<string, number>;
    }>;
}

export interface DemoTemplate {
    id: string;
    name: string;
    emoji: string;
    genre: string;
    description: string;
    bpm: number;
    key: string;
    scale: 'major' | 'minor';
    tracks: DemoTrack[];
    clips: DemoClip[];
}

// ============================================
// Helper: Generate drum pattern notes
// ============================================

// Drum pitch mapping (GM standard)
const DRUM = {
    kick: 36,
    snare: 38,
    closedHat: 42,
    openHat: 46,
    clap: 39,
    rim: 37,
    perc: 56,
};

function drumPattern(
    pattern: { [key: string]: number[] },
    bars: number,
    stepsPerBar: number = 16
): DemoNote[] {
    const notes: DemoNote[] = [];
    const beatsPerStep = 4 / stepsPerBar; // 4 beats per bar, 16 steps = 0.25 beats per step

    for (let bar = 0; bar < bars; bar++) {
        for (const [drumName, steps] of Object.entries(pattern)) {
            const pitch = DRUM[drumName as keyof typeof DRUM];
            if (!pitch) continue;

            for (const step of steps) {
                notes.push({
                    pitch,
                    startBeat: bar * 4 + step * beatsPerStep,
                    duration: 0.25,
                    velocity: drumName === 'kick' || drumName === 'snare' ? 100 : 80,
                });
            }
        }
    }
    return notes;
}

// ============================================
// Helper: Generate chord progression
// ============================================

function chordProgression(
    chords: number[][],
    barsPerChord: number,
    octave: number = 4,
    velocity: number = 85
): DemoNote[] {
    const notes: DemoNote[] = [];
    let currentBar = 0;

    for (const chord of chords) {
        for (const interval of chord) {
            notes.push({
                pitch: octave * 12 + interval,
                startBeat: currentBar * 4,
                duration: barsPerChord * 4 - 0.5, // Slightly shorter for articulation
                velocity,
            });
        }
        currentBar += barsPerChord;
    }
    return notes;
}

// ============================================
// Helper: Generate bass line
// ============================================

function bassLine(
    rootNotes: number[],
    barsPerNote: number,
    pattern: 'sustained' | 'eighth' | 'syncopated' = 'sustained',
    octave: number = 2
): DemoNote[] {
    const notes: DemoNote[] = [];
    let currentBar = 0;

    for (const root of rootNotes) {
        const pitch = octave * 12 + root;

        if (pattern === 'sustained') {
            notes.push({
                pitch,
                startBeat: currentBar * 4,
                duration: barsPerNote * 4 - 0.5,
                velocity: 100,
            });
        } else if (pattern === 'eighth') {
            // Eighth note pattern
            for (let beat = 0; beat < barsPerNote * 4; beat += 0.5) {
                notes.push({
                    pitch,
                    startBeat: currentBar * 4 + beat,
                    duration: 0.4,
                    velocity: beat % 1 === 0 ? 100 : 70,
                });
            }
        } else if (pattern === 'syncopated') {
            // Syncopated trap-style pattern
            const syncopatedPattern = [0, 1.75, 2.5, 3.5];
            for (let bar = 0; bar < barsPerNote; bar++) {
                for (const offset of syncopatedPattern) {
                    notes.push({
                        pitch,
                        startBeat: (currentBar + bar) * 4 + offset,
                        duration: 0.5,
                        velocity: offset === 0 ? 100 : 85,
                    });
                }
            }
        }
        currentBar += barsPerNote;
    }
    return notes;
}

// ============================================
// Helper: Generate melody
// ============================================

function melody(
    noteSequence: Array<{ pitch: number; start: number; dur: number; vel?: number }>,
    octave: number = 5
): DemoNote[] {
    return noteSequence.map((n) => ({
        pitch: octave * 12 + n.pitch,
        startBeat: n.start,
        duration: n.dur,
        velocity: n.vel || 90,
    }));
}

// ============================================
// Template 1: Lo-Fi Study (85 BPM, C minor)
// ============================================

const lofiDrums = drumPattern(
    {
        kick: [0, 5, 8, 13],      // Laid back boom bap kick
        snare: [4, 12],           // Snare on 2 and 4
        closedHat: [0, 2, 4, 6, 8, 10, 12, 14], // Swung hats
        openHat: [6, 14],         // Open hat accents
    },
    16
);

// C minor: C, Eb, G / Ab, C, Eb / Bb, D, F / G, Bb, D
const lofiChords = chordProgression(
    [
        [0, 3, 7],      // Cm
        [8, 0, 3],      // Ab (voiced up)
        [10, 2, 5],     // Bb
        [7, 10, 2],     // Gm
    ],
    4, // 4 bars per chord
    4, // Octave 4
    70 // Soft velocity
);

const lofiBass = bassLine([0, 8, 10, 7], 4, 'sustained', 2);

const lofiMelody = melody([
    // Bar 1-4: Simple motif
    { pitch: 7, start: 0, dur: 1 },
    { pitch: 3, start: 1.5, dur: 0.5 },
    { pitch: 0, start: 2, dur: 2 },
    // Bar 5-8: Response
    { pitch: 8, start: 16, dur: 1 },
    { pitch: 7, start: 17.5, dur: 0.5 },
    { pitch: 3, start: 18, dur: 1.5 },
    // Bar 9-12: Development
    { pitch: 10, start: 32, dur: 0.75 },
    { pitch: 8, start: 33, dur: 0.75 },
    { pitch: 7, start: 34, dur: 2 },
    // Bar 13-16: Resolution
    { pitch: 7, start: 48, dur: 1 },
    { pitch: 5, start: 49.5, dur: 0.5 },
    { pitch: 3, start: 50, dur: 1 },
    { pitch: 0, start: 52, dur: 4 },
], 5);

const LOFI_TEMPLATE: DemoTemplate = {
    id: 'lofi-study',
    name: 'Lo-Fi Study',
    emoji: '🎧',
    genre: 'Lo-Fi',
    description: 'Relaxed beats with dusty piano and vinyl warmth',
    bpm: 85,
    key: 'C',
    scale: 'minor',
    tracks: [
        {
            name: 'Drums',
            type: 'drum',
            color: 'drums',
            instrumentPreset: 'drum-sampler',
            volume: 0.75,
            pan: 0,
            effects: [],
        },
        {
            name: 'E-Piano',
            type: 'midi',
            color: 'keys',
            instrumentPreset: 'electric-piano',
            volume: 0.6,
            pan: -0.2,
            effects: [
                { type: 'reverb', params: { decay: 2.5, wet: 0.4 } },
                { type: 'filter', params: { frequency: 2000, wet: 1 } },
            ],
        },
        {
            name: 'Sub Bass',
            type: 'midi',
            color: 'bass',
            instrumentPreset: 'sub-bass',
            volume: 0.8,
            pan: 0,
            effects: [],
        },
        {
            name: 'Melody',
            type: 'midi',
            color: 'melody',
            instrumentPreset: 'basic-synth',
            volume: 0.5,
            pan: 0.15,
            effects: [
                { type: 'reverb', params: { decay: 3, wet: 0.5 } },
                { type: 'delay', params: { delayTime: 0.375, feedback: 0.3, wet: 0.25 } },
            ],
        },
    ],
    clips: [
        { name: 'Lo-Fi Beat', trackIndex: 0, startBar: 0, lengthBars: 16, notes: lofiDrums },
        { name: 'Dusty Keys', trackIndex: 1, startBar: 0, lengthBars: 16, notes: lofiChords },
        { name: 'Deep Sub', trackIndex: 2, startBar: 0, lengthBars: 16, notes: lofiBass },
        { name: 'Chill Melody', trackIndex: 3, startBar: 4, lengthBars: 12, notes: lofiMelody },
    ],
};

// ============================================
// Template 2: Trap Banger (140 BPM, F minor)
// ============================================

const trapDrums = drumPattern(
    {
        kick: [0, 3, 7, 10, 14],   // Hard trap kick pattern
        snare: [4, 12],            // Snare on 2 and 4
        clap: [4, 12],             // Layer clap with snare
        closedHat: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], // Rolling hats
        openHat: [2, 6, 10, 14],   // Open hat accents
    },
    16
);

// F minor: F, Ab, C / Db, F, Ab / Eb, G, Bb / C, Eb, G
const trapChords = chordProgression(
    [
        [5, 8, 0],      // Fm
        [1, 5, 8],      // Db
        [3, 7, 10],     // Eb
        [0, 3, 7],      // Cm
    ],
    4,
    4,
    75
);

const trapBass = bassLine([5, 1, 3, 0], 4, 'syncopated', 1);

const trapMelody = melody([
    // Aggressive arpeggio pattern
    { pitch: 0, start: 0, dur: 0.25, vel: 100 },
    { pitch: 3, start: 0.5, dur: 0.25, vel: 90 },
    { pitch: 5, start: 1, dur: 0.5, vel: 95 },
    { pitch: 8, start: 2, dur: 0.25, vel: 100 },
    { pitch: 5, start: 2.5, dur: 0.25, vel: 85 },
    { pitch: 3, start: 3, dur: 1, vel: 90 },
    // Repeat with variation
    { pitch: 0, start: 16, dur: 0.25, vel: 100 },
    { pitch: 5, start: 16.5, dur: 0.25, vel: 90 },
    { pitch: 8, start: 17, dur: 0.5, vel: 95 },
    { pitch: 10, start: 18, dur: 0.25, vel: 100 },
    { pitch: 8, start: 18.5, dur: 0.25, vel: 85 },
    { pitch: 5, start: 19, dur: 1, vel: 90 },
    // Build
    { pitch: 0, start: 32, dur: 0.25, vel: 100 },
    { pitch: 3, start: 32.5, dur: 0.25, vel: 100 },
    { pitch: 5, start: 33, dur: 0.25, vel: 100 },
    { pitch: 8, start: 33.5, dur: 0.25, vel: 100 },
    { pitch: 10, start: 34, dur: 0.25, vel: 100 },
    { pitch: 12, start: 34.5, dur: 1.5, vel: 100 },
    // Drop
    { pitch: 5, start: 48, dur: 2, vel: 100 },
    { pitch: 3, start: 50, dur: 1, vel: 95 },
    { pitch: 0, start: 52, dur: 4, vel: 100 },
], 5);

const TRAP_TEMPLATE: DemoTemplate = {
    id: 'trap-banger',
    name: 'Trap Banger',
    emoji: '🔥',
    genre: 'Trap',
    description: 'Hard-hitting 808s with rolling hi-hats',
    bpm: 140,
    key: 'F',
    scale: 'minor',
    tracks: [
        {
            name: 'Trap Drums',
            type: 'drum',
            color: 'drums',
            instrumentPreset: 'drum-sampler',
            volume: 0.85,
            pan: 0,
            effects: [
                { type: 'compression', params: { threshold: -20, ratio: 4 } },
            ],
        },
        {
            name: 'Dark Pad',
            type: 'midi',
            color: 'fx',
            instrumentPreset: 'string-pad',
            volume: 0.45,
            pan: 0,
            effects: [
                { type: 'reverb', params: { decay: 4, wet: 0.6 } },
            ],
        },
        {
            name: '808 Bass',
            type: 'midi',
            color: 'bass',
            instrumentPreset: 'sub-bass',
            volume: 0.9,
            pan: 0,
            effects: [
                { type: 'distortion', params: { distortion: 0.2, wet: 0.3 } },
            ],
        },
        {
            name: 'Lead',
            type: 'midi',
            color: 'melody',
            instrumentPreset: 'square-lead',
            volume: 0.55,
            pan: 0.1,
            effects: [
                { type: 'delay', params: { delayTime: 0.214, feedback: 0.4, wet: 0.35 } },
            ],
        },
    ],
    clips: [
        { name: 'Trap Beat', trackIndex: 0, startBar: 0, lengthBars: 16, notes: trapDrums },
        { name: 'Dark Atmosphere', trackIndex: 1, startBar: 0, lengthBars: 16, notes: trapChords },
        { name: '808 Line', trackIndex: 2, startBar: 0, lengthBars: 16, notes: trapBass },
        { name: 'Hard Lead', trackIndex: 3, startBar: 0, lengthBars: 16, notes: trapMelody },
    ],
};

// ============================================
// Template 3: Ambient Dreams (70 BPM, A major)
// ============================================

// Ambient uses sparse, atmospheric drums
const ambientDrums = drumPattern(
    {
        kick: [0],                 // Sparse kick
        rim: [8],                  // Gentle rim
        closedHat: [4, 12],        // Minimal hats
    },
    16
);

// A major: A, C#, E / D, F#, A / E, G#, B / F#m
const ambientChords = chordProgression(
    [
        [9, 1, 4],      // A
        [2, 6, 9],      // D
        [4, 8, 11],     // E
        [6, 9, 1],      // F#m
    ],
    4,
    4,
    60 // Very soft
);

const ambientPad = chordProgression(
    [
        [9, 1, 4, 8],   // A add9
        [2, 6, 9, 1],   // D add9
        [4, 8, 11, 2],  // E add9
        [6, 9, 1, 4],   // F#m add9
    ],
    4,
    3, // Lower octave
    50
);

const ambientMelody = melody([
    // Floating, ethereal melody
    { pitch: 4, start: 8, dur: 4, vel: 70 },
    { pitch: 6, start: 14, dur: 2, vel: 65 },
    { pitch: 4, start: 24, dur: 3, vel: 70 },
    { pitch: 1, start: 28, dur: 4, vel: 65 },
    { pitch: 9, start: 40, dur: 4, vel: 70 },
    { pitch: 8, start: 46, dur: 2, vel: 65 },
    { pitch: 6, start: 56, dur: 6, vel: 60 },
], 5);

const AMBIENT_TEMPLATE: DemoTemplate = {
    id: 'ambient-dreams',
    name: 'Ambient Dreams',
    emoji: '🌊',
    genre: 'Ambient',
    description: 'Ethereal pads and gentle textures',
    bpm: 70,
    key: 'A',
    scale: 'major',
    tracks: [
        {
            name: 'Soft Perc',
            type: 'drum',
            color: 'drums',
            instrumentPreset: 'drum-sampler',
            volume: 0.4,
            pan: 0,
            effects: [
                { type: 'reverb', params: { decay: 5, wet: 0.7 } },
            ],
        },
        {
            name: 'Warm Keys',
            type: 'midi',
            color: 'keys',
            instrumentPreset: 'electric-piano',
            volume: 0.5,
            pan: -0.3,
            effects: [
                { type: 'reverb', params: { decay: 6, wet: 0.65 } },
                { type: 'delay', params: { delayTime: 0.428, feedback: 0.5, wet: 0.3 } },
            ],
        },
        {
            name: 'String Pad',
            type: 'midi',
            color: 'fx',
            instrumentPreset: 'string-pad',
            volume: 0.55,
            pan: 0.2,
            effects: [
                { type: 'reverb', params: { decay: 8, wet: 0.75 } },
            ],
        },
        {
            name: 'Floating Lead',
            type: 'midi',
            color: 'melody',
            instrumentPreset: 'warm-pad',
            volume: 0.45,
            pan: 0,
            effects: [
                { type: 'reverb', params: { decay: 7, wet: 0.8 } },
                { type: 'delay', params: { delayTime: 0.857, feedback: 0.6, wet: 0.4 } },
            ],
        },
    ],
    clips: [
        { name: 'Ambient Perc', trackIndex: 0, startBar: 0, lengthBars: 16, notes: ambientDrums },
        { name: 'Dreamy Keys', trackIndex: 1, startBar: 0, lengthBars: 16, notes: ambientChords },
        { name: 'Lush Pad', trackIndex: 2, startBar: 0, lengthBars: 16, notes: ambientPad },
        { name: 'Ethereal', trackIndex: 3, startBar: 2, lengthBars: 14, notes: ambientMelody },
    ],
};

// ============================================
// Template 4: EDM Drop (128 BPM, A minor)
// ============================================

const edmDrums = drumPattern(
    {
        kick: [0, 4, 8, 12],       // Four on the floor
        snare: [4, 12],            // Snare/clap on 2 and 4
        clap: [4, 12],             // Clap layer
        closedHat: [0, 2, 4, 6, 8, 10, 12, 14], // Driving hats
        openHat: [2, 6, 10, 14],   // Off-beat open hats
    },
    16
);

// A minor: Am, F, C, G
const edmChords = chordProgression(
    [
        [9, 0, 4],      // Am
        [5, 9, 0],      // F
        [0, 4, 7],      // C
        [7, 11, 2],     // G
    ],
    4,
    4,
    85
);

const edmBass = bassLine([9, 5, 0, 7], 4, 'eighth', 2);

const edmLead = melody([
    // Energetic EDM melody
    // Bar 1-4
    { pitch: 0, start: 0, dur: 0.5, vel: 100 },
    { pitch: 4, start: 0.5, dur: 0.5, vel: 95 },
    { pitch: 7, start: 1, dur: 0.5, vel: 100 },
    { pitch: 4, start: 1.5, dur: 0.5, vel: 90 },
    { pitch: 0, start: 2, dur: 1, vel: 100 },
    { pitch: 0, start: 3.5, dur: 0.5, vel: 85 },
    // Bar 5-8
    { pitch: 5, start: 16, dur: 0.5, vel: 100 },
    { pitch: 9, start: 16.5, dur: 0.5, vel: 95 },
    { pitch: 0, start: 17, dur: 0.5, vel: 100 },
    { pitch: 9, start: 17.5, dur: 0.5, vel: 90 },
    { pitch: 5, start: 18, dur: 1, vel: 100 },
    // Bar 9-12 - Build up
    { pitch: 0, start: 32, dur: 0.25, vel: 100 },
    { pitch: 2, start: 32.5, dur: 0.25, vel: 100 },
    { pitch: 4, start: 33, dur: 0.25, vel: 100 },
    { pitch: 5, start: 33.5, dur: 0.25, vel: 100 },
    { pitch: 7, start: 34, dur: 0.25, vel: 100 },
    { pitch: 9, start: 34.5, dur: 0.25, vel: 100 },
    { pitch: 11, start: 35, dur: 0.25, vel: 100 },
    { pitch: 12, start: 35.5, dur: 0.5, vel: 100 },
    // Bar 13-16 - Drop
    { pitch: 12, start: 48, dur: 1, vel: 100 },
    { pitch: 9, start: 49.5, dur: 0.5, vel: 95 },
    { pitch: 7, start: 50, dur: 0.5, vel: 100 },
    { pitch: 4, start: 50.5, dur: 0.5, vel: 95 },
    { pitch: 0, start: 51, dur: 2, vel: 100 },
    { pitch: 12, start: 54, dur: 0.5, vel: 100 },
    { pitch: 11, start: 54.5, dur: 0.5, vel: 95 },
    { pitch: 9, start: 55, dur: 0.5, vel: 100 },
    { pitch: 7, start: 55.5, dur: 0.5, vel: 95 },
    { pitch: 4, start: 56, dur: 2, vel: 100 },
], 5);

const EDM_TEMPLATE: DemoTemplate = {
    id: 'edm-drop',
    name: 'EDM Drop',
    emoji: '⚡',
    genre: 'EDM',
    description: 'High-energy build-ups and euphoric drops',
    bpm: 128,
    key: 'A',
    scale: 'minor',
    tracks: [
        {
            name: 'Big Drums',
            type: 'drum',
            color: 'drums',
            instrumentPreset: 'drum-sampler',
            volume: 0.85,
            pan: 0,
            effects: [
                { type: 'compression', params: { threshold: -15, ratio: 6 } },
            ],
        },
        {
            name: 'Supersaw',
            type: 'midi',
            color: 'melody',
            instrumentPreset: 'saw-lead',
            volume: 0.65,
            pan: 0,
            effects: [
                { type: 'reverb', params: { decay: 2, wet: 0.35 } },
            ],
        },
        {
            name: 'Punchy Bass',
            type: 'midi',
            color: 'bass',
            instrumentPreset: 'synth-bass',
            volume: 0.8,
            pan: 0,
            effects: [
                { type: 'distortion', params: { distortion: 0.15, wet: 0.2 } },
            ],
        },
        {
            name: 'Lead Synth',
            type: 'midi',
            color: 'keys',
            instrumentPreset: 'square-lead',
            volume: 0.6,
            pan: 0,
            effects: [
                { type: 'delay', params: { delayTime: 0.234, feedback: 0.35, wet: 0.3 } },
                { type: 'reverb', params: { decay: 1.5, wet: 0.25 } },
            ],
        },
    ],
    clips: [
        { name: 'EDM Beat', trackIndex: 0, startBar: 0, lengthBars: 16, notes: edmDrums },
        { name: 'Supersaw Chords', trackIndex: 1, startBar: 0, lengthBars: 16, notes: edmChords },
        { name: 'Driving Bass', trackIndex: 2, startBar: 0, lengthBars: 16, notes: edmBass },
        { name: 'Euphoric Lead', trackIndex: 3, startBar: 0, lengthBars: 16, notes: edmLead },
    ],
};

// ============================================
// Export all templates
// ============================================

export const DEMO_TEMPLATES: DemoTemplate[] = [
    LOFI_TEMPLATE,
    TRAP_TEMPLATE,
    AMBIENT_TEMPLATE,
    EDM_TEMPLATE,
];

export function getDemoTemplate(id: string): DemoTemplate | undefined {
    return DEMO_TEMPLATES.find((t) => t.id === id);
}
