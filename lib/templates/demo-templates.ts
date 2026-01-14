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
// Template 5: Bollywood Beats (105 BPM, D minor)
// Dholak-inspired patterns with modern production
// ============================================

// Bollywood drum pattern - Dholak/Dhol style
// Classic "dha-dhin-na" pattern with kicks mimicking the bass hits (Ghe/Dha)
// and snares/rims for treble hits (Na/Tin)
const bollywoodDrums = drumPattern(
    {
        // Dholak bass pattern - Ghe/Dha sounds on strong beats
        kick: [0, 3, 4, 6, 8, 11, 12, 14],
        // Na/Tin - treble hits creating the characteristic bounce
        snare: [2, 10],
        rim: [4, 6, 12, 14],           // Additional treble accents
        // Shaker mimics the jhanjh/chimta - continuous groove
        closedHat: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
        openHat: [4, 12],              // Open accent on 2 and 4
        clap: [4, 12],                 // Reinforcing the backbeat
    },
    16
);

// D minor chord progression - classic Bollywood feel
// Dm - Gm - Am - Dm (i - iv - v - i)
const bollywoodChords = chordProgression(
    [
        [2, 5, 9],      // Dm
        [7, 10, 2],     // Gm
        [9, 0, 4],      // Am
        [2, 5, 9],      // Dm
    ],
    4,
    4,
    80
);

// Punchy bass following the kick pattern
const bollywoodBass = bassLine([2, 7, 9, 2], 4, 'eighth', 2);

// Catchy Bollywood-style melody - pentatonic with ornaments
const bollywoodMelody = melody([
    // Hook phrase - Bar 1-4
    { pitch: 2, start: 0, dur: 0.5, vel: 95 },
    { pitch: 5, start: 0.5, dur: 0.5, vel: 90 },
    { pitch: 7, start: 1, dur: 1, vel: 100 },
    { pitch: 5, start: 2.5, dur: 0.5, vel: 85 },
    { pitch: 2, start: 3, dur: 1, vel: 90 },
    // Answer phrase - Bar 5-8
    { pitch: 9, start: 16, dur: 0.5, vel: 95 },
    { pitch: 7, start: 16.5, dur: 0.5, vel: 90 },
    { pitch: 5, start: 17, dur: 1.5, vel: 100 },
    { pitch: 2, start: 19, dur: 1, vel: 90 },
    // Development - Bar 9-12
    { pitch: 10, start: 32, dur: 0.5, vel: 100 },
    { pitch: 9, start: 32.5, dur: 0.5, vel: 95 },
    { pitch: 7, start: 33, dur: 0.5, vel: 90 },
    { pitch: 5, start: 33.5, dur: 0.5, vel: 85 },
    { pitch: 7, start: 34, dur: 2, vel: 100 },
    // Resolution - Bar 13-16
    { pitch: 5, start: 48, dur: 0.5, vel: 95 },
    { pitch: 7, start: 48.5, dur: 0.5, vel: 90 },
    { pitch: 9, start: 49, dur: 1, vel: 100 },
    { pitch: 7, start: 50.5, dur: 0.5, vel: 85 },
    { pitch: 5, start: 51, dur: 0.5, vel: 90 },
    { pitch: 2, start: 52, dur: 4, vel: 100 },
], 5);

const BOLLYWOOD_TEMPLATE: DemoTemplate = {
    id: 'bollywood-beats',
    name: 'Bollywood Beats',
    emoji: '🪘',
    genre: 'Bollywood',
    description: 'Dholak-driven grooves with filmy vibes',
    bpm: 105,
    key: 'D',
    scale: 'minor',
    tracks: [
        {
            name: 'Dholak Kit',
            type: 'drum',
            color: 'drums',
            instrumentPreset: 'drum-sampler',
            volume: 0.85,
            pan: 0,
            effects: [
                { type: 'compression', params: { threshold: -18, ratio: 4 } },
            ],
        },
        {
            name: 'Strings',
            type: 'midi',
            color: 'keys',
            instrumentPreset: 'string-pad',
            volume: 0.55,
            pan: 0,
            effects: [
                { type: 'reverb', params: { decay: 2.5, wet: 0.4 } },
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
                { type: 'compression', params: { threshold: -15, ratio: 5 } },
            ],
        },
        {
            name: 'Lead Melody',
            type: 'midi',
            color: 'melody',
            instrumentPreset: 'saw-lead',
            volume: 0.6,
            pan: 0.1,
            effects: [
                { type: 'delay', params: { delayTime: 0.285, feedback: 0.3, wet: 0.25 } },
                { type: 'reverb', params: { decay: 1.8, wet: 0.3 } },
            ],
        },
    ],
    clips: [
        { name: 'Dholak Beat', trackIndex: 0, startBar: 0, lengthBars: 16, notes: bollywoodDrums },
        { name: 'Filmi Strings', trackIndex: 1, startBar: 0, lengthBars: 16, notes: bollywoodChords },
        { name: 'Groovy Bass', trackIndex: 2, startBar: 0, lengthBars: 16, notes: bollywoodBass },
        { name: 'Bollywood Hook', trackIndex: 3, startBar: 0, lengthBars: 16, notes: bollywoodMelody },
    ],
};

// ============================================
// Template 6: Reggaeton/Dembow (95 BPM, G minor)
// The iconic "dembow" riddim pattern
// ============================================

// Classic dembow pattern - the signature reggaeton rhythm
// Kick on 1 and 3, snare syncopated on the "and" of 2 and on 4
const reggaetonDrums = drumPattern(
    {
        kick: [0, 4, 8, 12],           // Four-on-the-floor foundation
        snare: [3, 6, 11, 14],         // Syncopated snare - the dembow signature
        clap: [4, 12],                 // Reinforce beats 2 and 4
        closedHat: [0, 2, 4, 6, 8, 10, 12, 14], // Driving eighth-note hats
        openHat: [3, 7, 11, 15],       // Open hats on off-beats for swing
        rim: [1, 5, 9, 13],            // Rim shots add Latin flavor
    },
    16
);

// G minor progression - dark and moody
// Gm - Cm - D - Gm (i - iv - V - i)
const reggaetonChords = chordProgression(
    [
        [7, 10, 2],     // Gm
        [0, 3, 7],      // Cm
        [2, 6, 9],      // D
        [7, 10, 2],     // Gm
    ],
    4,
    4,
    75
);

// Heavy 808 bass with slides
const reggaetonBass = bassLine([7, 0, 2, 7], 4, 'syncopated', 1);

// Reggaeton melody - brass-stab style with repetitive hooks
const reggaetonMelody = melody([
    // Brass stab hook - Bar 1-4
    { pitch: 7, start: 0, dur: 0.25, vel: 100 },
    { pitch: 10, start: 0.5, dur: 0.25, vel: 95 },
    { pitch: 7, start: 1, dur: 0.25, vel: 100 },
    { pitch: 7, start: 2, dur: 0.25, vel: 100 },
    { pitch: 10, start: 2.5, dur: 0.25, vel: 95 },
    { pitch: 2, start: 3, dur: 1, vel: 90 },
    // Repeat with variation - Bar 5-8
    { pitch: 7, start: 16, dur: 0.25, vel: 100 },
    { pitch: 10, start: 16.5, dur: 0.25, vel: 95 },
    { pitch: 0, start: 17, dur: 0.5, vel: 100 },
    { pitch: 10, start: 18, dur: 0.25, vel: 95 },
    { pitch: 7, start: 18.5, dur: 0.25, vel: 90 },
    { pitch: 3, start: 19, dur: 1, vel: 95 },
    // Build - Bar 9-12
    { pitch: 2, start: 32, dur: 0.25, vel: 100 },
    { pitch: 5, start: 32.5, dur: 0.25, vel: 100 },
    { pitch: 7, start: 33, dur: 0.25, vel: 100 },
    { pitch: 10, start: 33.5, dur: 0.25, vel: 100 },
    { pitch: 2, start: 34, dur: 2, vel: 100 },
    // Drop - Bar 13-16
    { pitch: 7, start: 48, dur: 0.5, vel: 100 },
    { pitch: 5, start: 49, dur: 0.5, vel: 95 },
    { pitch: 3, start: 50, dur: 0.5, vel: 90 },
    { pitch: 2, start: 51, dur: 1, vel: 100 },
    { pitch: 7, start: 52, dur: 4, vel: 95 },
], 5);

const REGGAETON_TEMPLATE: DemoTemplate = {
    id: 'reggaeton-dembow',
    name: 'Reggaeton',
    emoji: '🌴',
    genre: 'Reggaeton',
    description: 'Classic dembow riddim with Latin heat',
    bpm: 95,
    key: 'G',
    scale: 'minor',
    tracks: [
        {
            name: 'Dembow Kit',
            type: 'drum',
            color: 'drums',
            instrumentPreset: 'drum-sampler',
            volume: 0.85,
            pan: 0,
            effects: [
                { type: 'compression', params: { threshold: -15, ratio: 5 } },
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
                { type: 'reverb', params: { decay: 2, wet: 0.35 } },
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
                { type: 'distortion', params: { distortion: 0.15, wet: 0.25 } },
            ],
        },
        {
            name: 'Brass Stabs',
            type: 'midi',
            color: 'melody',
            instrumentPreset: 'square-lead',
            volume: 0.6,
            pan: 0,
            effects: [
                { type: 'reverb', params: { decay: 1, wet: 0.2 } },
            ],
        },
    ],
    clips: [
        { name: 'Dembow Beat', trackIndex: 0, startBar: 0, lengthBars: 16, notes: reggaetonDrums },
        { name: 'Moody Pad', trackIndex: 1, startBar: 0, lengthBars: 16, notes: reggaetonChords },
        { name: '808 Slide', trackIndex: 2, startBar: 0, lengthBars: 16, notes: reggaetonBass },
        { name: 'Latin Hook', trackIndex: 3, startBar: 0, lengthBars: 16, notes: reggaetonMelody },
    ],
};

// ============================================
// Template 7: Synthwave/Retrowave (118 BPM, A minor)
// 80s nostalgia with modern production
// ============================================

// Synthwave drums - punchy gated reverb style
const synthwaveDrums = drumPattern(
    {
        kick: [0, 4, 8, 12],            // Four-on-the-floor
        snare: [4, 12],                 // Big gated snare on 2 and 4
        clap: [4, 12],                  // Layer clap for that 80s punch
        closedHat: [0, 2, 4, 6, 8, 10, 12, 14], // Driving hats
        openHat: [2, 6, 10, 14],        // Open hat accents
    },
    16
);

// A minor progression - nostalgic and driving
// Am - F - C - G (i - VI - III - VII)
const synthwaveChords = chordProgression(
    [
        [9, 0, 4],      // Am
        [5, 9, 0],      // F
        [0, 4, 7],      // C
        [7, 11, 2],     // G
    ],
    4,
    4,
    80
);

// Arpeggiated synth pattern - classic 80s
const synthwaveArp = melody([
    // Am arpeggio - Bar 1-4
    { pitch: 9, start: 0, dur: 0.25, vel: 85 },
    { pitch: 0, start: 0.5, dur: 0.25, vel: 80 },
    { pitch: 4, start: 1, dur: 0.25, vel: 85 },
    { pitch: 0, start: 1.5, dur: 0.25, vel: 80 },
    { pitch: 9, start: 2, dur: 0.25, vel: 85 },
    { pitch: 0, start: 2.5, dur: 0.25, vel: 80 },
    { pitch: 4, start: 3, dur: 0.25, vel: 85 },
    { pitch: 0, start: 3.5, dur: 0.25, vel: 80 },
    // F arpeggio - Bar 5-8
    { pitch: 5, start: 16, dur: 0.25, vel: 85 },
    { pitch: 9, start: 16.5, dur: 0.25, vel: 80 },
    { pitch: 0, start: 17, dur: 0.25, vel: 85 },
    { pitch: 9, start: 17.5, dur: 0.25, vel: 80 },
    { pitch: 5, start: 18, dur: 0.25, vel: 85 },
    { pitch: 9, start: 18.5, dur: 0.25, vel: 80 },
    { pitch: 0, start: 19, dur: 0.25, vel: 85 },
    { pitch: 9, start: 19.5, dur: 0.25, vel: 80 },
    // C arpeggio - Bar 9-12
    { pitch: 0, start: 32, dur: 0.25, vel: 85 },
    { pitch: 4, start: 32.5, dur: 0.25, vel: 80 },
    { pitch: 7, start: 33, dur: 0.25, vel: 85 },
    { pitch: 4, start: 33.5, dur: 0.25, vel: 80 },
    { pitch: 0, start: 34, dur: 0.25, vel: 85 },
    { pitch: 4, start: 34.5, dur: 0.25, vel: 80 },
    { pitch: 7, start: 35, dur: 0.25, vel: 85 },
    { pitch: 4, start: 35.5, dur: 0.25, vel: 80 },
    // G arpeggio - Bar 13-16
    { pitch: 7, start: 48, dur: 0.25, vel: 85 },
    { pitch: 11, start: 48.5, dur: 0.25, vel: 80 },
    { pitch: 2, start: 49, dur: 0.25, vel: 85 },
    { pitch: 11, start: 49.5, dur: 0.25, vel: 80 },
    { pitch: 7, start: 50, dur: 0.25, vel: 85 },
    { pitch: 11, start: 50.5, dur: 0.25, vel: 80 },
    { pitch: 2, start: 51, dur: 0.25, vel: 85 },
    { pitch: 11, start: 51.5, dur: 0.25, vel: 80 },
], 5);

// Pulsing saw bass
const synthwaveBass = bassLine([9, 5, 0, 7], 4, 'eighth', 2);

// Retro lead melody
const synthwaveLead = melody([
    // Soaring lead - Bar 1-4
    { pitch: 4, start: 0, dur: 2, vel: 90 },
    { pitch: 7, start: 2, dur: 1, vel: 85 },
    { pitch: 4, start: 3.5, dur: 0.5, vel: 80 },
    // Bar 5-8
    { pitch: 5, start: 16, dur: 2, vel: 90 },
    { pitch: 4, start: 18, dur: 1, vel: 85 },
    { pitch: 0, start: 19.5, dur: 0.5, vel: 80 },
    // Bar 9-12
    { pitch: 7, start: 32, dur: 1.5, vel: 95 },
    { pitch: 9, start: 34, dur: 1, vel: 90 },
    { pitch: 7, start: 35.5, dur: 0.5, vel: 85 },
    // Climax - Bar 13-16
    { pitch: 12, start: 48, dur: 2, vel: 100 },
    { pitch: 11, start: 50, dur: 1, vel: 95 },
    { pitch: 9, start: 51, dur: 1, vel: 90 },
    { pitch: 7, start: 52, dur: 4, vel: 85 },
], 5);

const SYNTHWAVE_TEMPLATE: DemoTemplate = {
    id: 'synthwave-retro',
    name: 'Synthwave',
    emoji: '🌆',
    genre: 'Synthwave',
    description: '80s nostalgia with neon-soaked synths',
    bpm: 118,
    key: 'A',
    scale: 'minor',
    tracks: [
        {
            name: 'Retro Drums',
            type: 'drum',
            color: 'drums',
            instrumentPreset: 'drum-sampler',
            volume: 0.8,
            pan: 0,
            effects: [
                { type: 'reverb', params: { decay: 1.5, wet: 0.3 } },
                { type: 'compression', params: { threshold: -12, ratio: 4 } },
            ],
        },
        {
            name: 'Arp Synth',
            type: 'midi',
            color: 'keys',
            instrumentPreset: 'basic-synth',
            volume: 0.5,
            pan: -0.2,
            effects: [
                { type: 'delay', params: { delayTime: 0.254, feedback: 0.4, wet: 0.35 } },
                { type: 'reverb', params: { decay: 2, wet: 0.3 } },
            ],
        },
        {
            name: 'Saw Bass',
            type: 'midi',
            color: 'bass',
            instrumentPreset: 'synth-bass',
            volume: 0.75,
            pan: 0,
            effects: [
                { type: 'distortion', params: { distortion: 0.1, wet: 0.15 } },
            ],
        },
        {
            name: 'Lead Synth',
            type: 'midi',
            color: 'melody',
            instrumentPreset: 'saw-lead',
            volume: 0.6,
            pan: 0.15,
            effects: [
                { type: 'delay', params: { delayTime: 0.375, feedback: 0.35, wet: 0.3 } },
                { type: 'reverb', params: { decay: 2.5, wet: 0.4 } },
            ],
        },
    ],
    clips: [
        { name: '80s Beat', trackIndex: 0, startBar: 0, lengthBars: 16, notes: synthwaveDrums },
        { name: 'Retro Arp', trackIndex: 1, startBar: 0, lengthBars: 16, notes: synthwaveArp },
        { name: 'Pulsing Bass', trackIndex: 2, startBar: 0, lengthBars: 16, notes: synthwaveBass },
        { name: 'Neon Lead', trackIndex: 3, startBar: 4, lengthBars: 12, notes: synthwaveLead },
    ],
};

// ============================================
// Template 8: Afrobeats (105 BPM, E minor)
// West African-inspired grooves
// ============================================

// Afrobeats drum pattern - log drum style with shaker
// Signature bouncy kick pattern with clave-inspired rhythm
const afrobeatsDrums = drumPattern(
    {
        kick: [0, 5, 8, 10, 14],        // Bouncy, syncopated kick
        snare: [4, 12],                 // Snare on 2 and 4
        rim: [2, 6, 10, 14],            // Rim for log drum feel
        closedHat: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], // Shaker-like continuous
        openHat: [4, 12],               // Open hat accents
        perc: [3, 7, 11, 15],           // Percussion - clave pattern
    },
    16
);

// E minor progression - uplifting African feel
// Em - Am - D - G (i - iv - VII - III)
const afrobeatsChords = chordProgression(
    [
        [4, 7, 11],     // Em
        [9, 0, 4],      // Am
        [2, 6, 9],      // D
        [7, 11, 2],     // G
    ],
    4,
    4,
    75
);

// Bouncy melodic bassline - characteristic of Afrobeats
const afrobeatsBass = melody([
    // Em bass - Bar 1-4
    { pitch: 4, start: 0, dur: 0.5, vel: 100 },
    { pitch: 4, start: 1, dur: 0.25, vel: 85 },
    { pitch: 7, start: 1.5, dur: 0.5, vel: 90 },
    { pitch: 4, start: 2.5, dur: 0.5, vel: 95 },
    { pitch: 4, start: 3.5, dur: 0.5, vel: 85 },
    // Am bass - Bar 5-8  
    { pitch: 9, start: 16, dur: 0.5, vel: 100 },
    { pitch: 9, start: 17, dur: 0.25, vel: 85 },
    { pitch: 0, start: 17.5, dur: 0.5, vel: 90 },
    { pitch: 9, start: 18.5, dur: 0.5, vel: 95 },
    { pitch: 9, start: 19.5, dur: 0.5, vel: 85 },
    // D bass - Bar 9-12
    { pitch: 2, start: 32, dur: 0.5, vel: 100 },
    { pitch: 2, start: 33, dur: 0.25, vel: 85 },
    { pitch: 6, start: 33.5, dur: 0.5, vel: 90 },
    { pitch: 2, start: 34.5, dur: 0.5, vel: 95 },
    { pitch: 2, start: 35.5, dur: 0.5, vel: 85 },
    // G bass - Bar 13-16
    { pitch: 7, start: 48, dur: 0.5, vel: 100 },
    { pitch: 7, start: 49, dur: 0.25, vel: 85 },
    { pitch: 11, start: 49.5, dur: 0.5, vel: 90 },
    { pitch: 7, start: 50.5, dur: 0.5, vel: 95 },
    { pitch: 7, start: 51.5, dur: 0.5, vel: 85 },
], 2);

// Call-and-response style melody
const afrobeatsMelody = melody([
    // Call phrase - Bar 1-4
    { pitch: 4, start: 0, dur: 0.5, vel: 95 },
    { pitch: 7, start: 0.5, dur: 0.5, vel: 90 },
    { pitch: 11, start: 1, dur: 1, vel: 100 },
    { pitch: 7, start: 2.5, dur: 0.5, vel: 85 },
    { pitch: 4, start: 3, dur: 1, vel: 90 },
    // Response - Bar 5-8
    { pitch: 9, start: 16, dur: 0.5, vel: 95 },
    { pitch: 0, start: 16.5, dur: 0.5, vel: 90 },
    { pitch: 4, start: 17, dur: 1.5, vel: 100 },
    { pitch: 0, start: 19, dur: 0.5, vel: 85 },
    { pitch: 9, start: 19.5, dur: 0.5, vel: 90 },
    // Development - Bar 9-12
    { pitch: 2, start: 32, dur: 0.5, vel: 100 },
    { pitch: 6, start: 32.5, dur: 0.5, vel: 95 },
    { pitch: 9, start: 33, dur: 0.5, vel: 90 },
    { pitch: 11, start: 33.5, dur: 1.5, vel: 100 },
    { pitch: 9, start: 35.5, dur: 0.5, vel: 85 },
    // Resolution - Bar 13-16
    { pitch: 7, start: 48, dur: 1, vel: 100 },
    { pitch: 11, start: 49.5, dur: 0.5, vel: 95 },
    { pitch: 7, start: 50, dur: 0.5, vel: 90 },
    { pitch: 4, start: 51, dur: 1, vel: 95 },
    { pitch: 4, start: 52, dur: 4, vel: 85 },
], 5);

const AFROBEATS_TEMPLATE: DemoTemplate = {
    id: 'afrobeats-groove',
    name: 'Afrobeats',
    emoji: '🌍',
    genre: 'Afrobeats',
    description: 'West African rhythms with infectious energy',
    bpm: 105,
    key: 'E',
    scale: 'minor',
    tracks: [
        {
            name: 'Log Drums',
            type: 'drum',
            color: 'drums',
            instrumentPreset: 'drum-sampler',
            volume: 0.85,
            pan: 0,
            effects: [
                { type: 'compression', params: { threshold: -15, ratio: 4 } },
            ],
        },
        {
            name: 'Warm Keys',
            type: 'midi',
            color: 'keys',
            instrumentPreset: 'electric-piano',
            volume: 0.55,
            pan: -0.15,
            effects: [
                { type: 'reverb', params: { decay: 1.5, wet: 0.25 } },
            ],
        },
        {
            name: 'Bouncy Bass',
            type: 'midi',
            color: 'bass',
            instrumentPreset: 'synth-bass',
            volume: 0.8,
            pan: 0,
            effects: [],
        },
        {
            name: 'Lead Hook',
            type: 'midi',
            color: 'melody',
            instrumentPreset: 'basic-synth',
            volume: 0.6,
            pan: 0.1,
            effects: [
                { type: 'delay', params: { delayTime: 0.285, feedback: 0.25, wet: 0.2 } },
                { type: 'reverb', params: { decay: 1.5, wet: 0.25 } },
            ],
        },
    ],
    clips: [
        { name: 'Afro Beat', trackIndex: 0, startBar: 0, lengthBars: 16, notes: afrobeatsDrums },
        { name: 'Island Keys', trackIndex: 1, startBar: 0, lengthBars: 16, notes: afrobeatsChords },
        { name: 'Groove Bass', trackIndex: 2, startBar: 0, lengthBars: 16, notes: afrobeatsBass },
        { name: 'Afro Hook', trackIndex: 3, startBar: 0, lengthBars: 16, notes: afrobeatsMelody },
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
    BOLLYWOOD_TEMPLATE,
    REGGAETON_TEMPLATE,
    SYNTHWAVE_TEMPLATE,
    AFROBEATS_TEMPLATE,
];

export function getDemoTemplate(id: string): DemoTemplate | undefined {
    return DEMO_TEMPLATES.find((t) => t.id === id);
}
