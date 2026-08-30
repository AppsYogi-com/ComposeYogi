// ============================================
// ComposeYogi — Demo Notes
// ============================================
//
// The phrase a clip is born with when you drop an instrument onto a track, or
// add one from the browser. Not decoration: it is the difference between "a
// rectangle appeared" and "I heard the instrument I just picked", and it is the
// only thing standing between a first-time user and silence.
//
// Lived in TrackList.tsx until the browser panel's + button needed the same
// phrases. Two copies of six hundred lines of note data would have drifted the
// first time anyone tuned one, and the two entry points would have quietly
// stopped agreeing about what an instrument sounds like.
//
// MIDI pitch: C4 = 60, C3 = 48. `startBeat` is relative to the clip start.
// Deliberately English-free — this is note data, not copy.

import { getCustomInstrument } from '@/lib/audio/custom-instruments';

/** One note in a demo phrase. `Omit<Note, 'id'>`, which is what addNote takes. */
export interface DemoNote {
    pitch: number;
    startBeat: number;
    duration: number;
    velocity: number;
}

export function getDemoNotesForInstrument(instrumentId: string): DemoNote[] {
    // A custom instrument plays the phrase its *source preset* would. It was
    // built from that sound, so that phrase is the one that shows it off — and
    // without this every custom instrument, whatever it was made from, dropped
    // in with the same generic arpeggio from the default arm below.
    const custom = getCustomInstrument(instrumentId);
    switch (custom ? custom.basePresetId : instrumentId) {
        // Drum kits - basic rock/pop beat (kick=36, snare=38, hat=42)
        case 'drum-sampler':
        case 'acoustic-kit':
        case 'punchy-kit':
            return [
                // Kick on 1 and 3
                { pitch: 36, startBeat: 0, duration: 0.5, velocity: 110 },
                { pitch: 36, startBeat: 4, duration: 0.5, velocity: 100 },
                // Snare on 2 and 4
                { pitch: 38, startBeat: 2, duration: 0.5, velocity: 100 },
                { pitch: 38, startBeat: 6, duration: 0.5, velocity: 100 },
                // Hi-hat 8ths
                { pitch: 42, startBeat: 0, duration: 0.25, velocity: 80 },
                { pitch: 42, startBeat: 1, duration: 0.25, velocity: 70 },
                { pitch: 42, startBeat: 2, duration: 0.25, velocity: 80 },
                { pitch: 42, startBeat: 3, duration: 0.25, velocity: 70 },
                { pitch: 42, startBeat: 4, duration: 0.25, velocity: 80 },
                { pitch: 42, startBeat: 5, duration: 0.25, velocity: 70 },
                { pitch: 42, startBeat: 6, duration: 0.25, velocity: 80 },
                { pitch: 42, startBeat: 7, duration: 0.25, velocity: 70 },
            ];

        // Classic Drum (MembraneSynth) - pitched knocks
        case 'drum-synth':
            return [
                // Low knock (kick)
                { pitch: 36, startBeat: 0, duration: 0.5, velocity: 110 },
                { pitch: 36, startBeat: 4, duration: 0.5, velocity: 100 },
                // Mid knock (snare)
                { pitch: 38, startBeat: 2, duration: 0.5, velocity: 100 },
                { pitch: 38, startBeat: 6, duration: 0.5, velocity: 100 },
                // High knock (hat)
                { pitch: 42, startBeat: 0, duration: 0.25, velocity: 80 },
                { pitch: 42, startBeat: 1, duration: 0.25, velocity: 70 },
                { pitch: 42, startBeat: 2, duration: 0.25, velocity: 80 },
                { pitch: 42, startBeat: 3, duration: 0.25, velocity: 70 },
                { pitch: 42, startBeat: 4, duration: 0.25, velocity: 80 },
                { pitch: 42, startBeat: 5, duration: 0.25, velocity: 70 },
                { pitch: 42, startBeat: 6, duration: 0.25, velocity: 80 },
                { pitch: 42, startBeat: 7, duration: 0.25, velocity: 70 },
            ];

        // 808 Kit - trap-style beat
        case '808-kit':
            return [
                // 808 kick pattern
                { pitch: 36, startBeat: 0, duration: 0.5, velocity: 120 },
                { pitch: 36, startBeat: 3.5, duration: 0.5, velocity: 100 },
                { pitch: 36, startBeat: 7, duration: 0.5, velocity: 110 },
                // Clap on 2 and 4
                { pitch: 38, startBeat: 2, duration: 0.5, velocity: 100 },
                { pitch: 38, startBeat: 6, duration: 0.5, velocity: 100 },
                // Hi-hat 16ths (rapid)
                { pitch: 42, startBeat: 0, duration: 0.125, velocity: 80 },
                { pitch: 42, startBeat: 0.5, duration: 0.125, velocity: 60 },
                { pitch: 42, startBeat: 1, duration: 0.125, velocity: 80 },
                { pitch: 42, startBeat: 1.5, duration: 0.125, velocity: 60 },
                { pitch: 42, startBeat: 2, duration: 0.125, velocity: 80 },
                { pitch: 42, startBeat: 2.5, duration: 0.125, velocity: 60 },
                { pitch: 42, startBeat: 3, duration: 0.125, velocity: 80 },
                { pitch: 42, startBeat: 3.5, duration: 0.125, velocity: 60 },
                { pitch: 42, startBeat: 4, duration: 0.125, velocity: 80 },
                { pitch: 42, startBeat: 4.5, duration: 0.125, velocity: 60 },
                { pitch: 42, startBeat: 5, duration: 0.125, velocity: 80 },
                { pitch: 42, startBeat: 5.5, duration: 0.125, velocity: 60 },
                { pitch: 42, startBeat: 6, duration: 0.125, velocity: 80 },
                { pitch: 42, startBeat: 6.5, duration: 0.125, velocity: 60 },
                { pitch: 42, startBeat: 7, duration: 0.125, velocity: 80 },
                { pitch: 42, startBeat: 7.5, duration: 0.125, velocity: 60 },
            ];

        // Lo-Fi Kit - laid-back shuffle
        case 'lofi-kit':
            return [
                // Muted kick
                { pitch: 36, startBeat: 0, duration: 0.5, velocity: 90 },
                { pitch: 36, startBeat: 2.5, duration: 0.5, velocity: 80 },
                { pitch: 36, startBeat: 4, duration: 0.5, velocity: 90 },
                { pitch: 36, startBeat: 6.5, duration: 0.5, velocity: 80 },
                // Lo-fi snare on 2 and 4
                { pitch: 38, startBeat: 2, duration: 0.5, velocity: 85 },
                { pitch: 38, startBeat: 6, duration: 0.5, velocity: 85 },
                // Lazy swing hats
                { pitch: 42, startBeat: 0, duration: 0.25, velocity: 65 },
                { pitch: 42, startBeat: 1.5, duration: 0.25, velocity: 55 },
                { pitch: 42, startBeat: 2, duration: 0.25, velocity: 65 },
                { pitch: 42, startBeat: 3.5, duration: 0.25, velocity: 55 },
                { pitch: 42, startBeat: 4, duration: 0.25, velocity: 65 },
                { pitch: 42, startBeat: 5.5, duration: 0.25, velocity: 55 },
                { pitch: 42, startBeat: 6, duration: 0.25, velocity: 65 },
                { pitch: 42, startBeat: 7.5, duration: 0.25, velocity: 55 },
            ];

        // Electronic Kit - four-on-the-floor dance beat
        case 'electronic-kit':
            return [
                // Kick on every beat
                { pitch: 36, startBeat: 0, duration: 0.5, velocity: 120 },
                { pitch: 36, startBeat: 2, duration: 0.5, velocity: 110 },
                { pitch: 36, startBeat: 4, duration: 0.5, velocity: 120 },
                { pitch: 36, startBeat: 6, duration: 0.5, velocity: 110 },
                // Clap on 2 and 4
                { pitch: 38, startBeat: 2, duration: 0.5, velocity: 100 },
                { pitch: 38, startBeat: 6, duration: 0.5, velocity: 100 },
                // Open hat on offbeats
                { pitch: 46, startBeat: 1, duration: 0.25, velocity: 85 },
                { pitch: 46, startBeat: 3, duration: 0.25, velocity: 85 },
                { pitch: 46, startBeat: 5, duration: 0.25, velocity: 85 },
                { pitch: 46, startBeat: 7, duration: 0.25, velocity: 85 },
                // Closed hat on beats
                { pitch: 42, startBeat: 0, duration: 0.25, velocity: 75 },
                { pitch: 42, startBeat: 2, duration: 0.25, velocity: 75 },
                { pitch: 42, startBeat: 4, duration: 0.25, velocity: 75 },
                { pitch: 42, startBeat: 6, duration: 0.25, velocity: 75 },
            ];

        // Piano/Keys - C major chord progression
        case 'electric-piano':
        case 'bright-piano':
        case 'organ':
        case 'clavinet':
            return [
                // C major chord (beat 0)
                { pitch: 60, startBeat: 0, duration: 2, velocity: 100 },
                { pitch: 64, startBeat: 0, duration: 2, velocity: 90 },
                { pitch: 67, startBeat: 0, duration: 2, velocity: 85 },
                // G major chord (beat 2)
                { pitch: 55, startBeat: 2, duration: 2, velocity: 100 },
                { pitch: 59, startBeat: 2, duration: 2, velocity: 90 },
                { pitch: 62, startBeat: 2, duration: 2, velocity: 85 },
                // A minor chord (beat 4)
                { pitch: 57, startBeat: 4, duration: 2, velocity: 100 },
                { pitch: 60, startBeat: 4, duration: 2, velocity: 90 },
                { pitch: 64, startBeat: 4, duration: 2, velocity: 85 },
                // F major chord (beat 6)
                { pitch: 53, startBeat: 6, duration: 2, velocity: 100 },
                { pitch: 57, startBeat: 6, duration: 2, velocity: 90 },
                { pitch: 60, startBeat: 6, duration: 2, velocity: 85 },
            ];

        // Bass - simple bass line
        case 'sub-bass':
        case 'synth-bass':
        case 'fm-bass':
        case 'pluck-bass':
            return [
                { pitch: 36, startBeat: 0, duration: 1, velocity: 110 },
                { pitch: 36, startBeat: 1.5, duration: 0.5, velocity: 90 },
                { pitch: 43, startBeat: 2, duration: 1, velocity: 110 },
                { pitch: 43, startBeat: 3.5, duration: 0.5, velocity: 90 },
                { pitch: 45, startBeat: 4, duration: 1, velocity: 110 },
                { pitch: 45, startBeat: 5.5, duration: 0.5, velocity: 90 },
                { pitch: 41, startBeat: 6, duration: 1, velocity: 110 },
                { pitch: 41, startBeat: 7.5, duration: 0.5, velocity: 90 },
            ];

        // Lead - melody line
        case 'saw-lead':
        case 'square-lead':
        case 'fm-lead':
        case 'pulse-lead':
            return [
                { pitch: 72, startBeat: 0, duration: 0.5, velocity: 100 },
                { pitch: 74, startBeat: 0.5, duration: 0.5, velocity: 95 },
                { pitch: 76, startBeat: 1, duration: 1, velocity: 100 },
                { pitch: 74, startBeat: 2.5, duration: 0.5, velocity: 90 },
                { pitch: 72, startBeat: 3, duration: 1, velocity: 100 },
                { pitch: 69, startBeat: 4.5, duration: 0.5, velocity: 95 },
                { pitch: 67, startBeat: 5, duration: 1.5, velocity: 100 },
                { pitch: 65, startBeat: 7, duration: 1, velocity: 90 },
            ];

        // Pads - long sustained chords
        case 'warm-pad':
        case 'string-pad':
        case 'choir-pad':
        case 'glass-pad':
            return [
                // C major sustained
                { pitch: 60, startBeat: 0, duration: 8, velocity: 80 },
                { pitch: 64, startBeat: 0, duration: 8, velocity: 75 },
                { pitch: 67, startBeat: 0, duration: 8, velocity: 70 },
            ];

        // Pluck - staccato arpeggio to showcase short decay
        case 'pluck-synth':
            return [
                { pitch: 60, startBeat: 0, duration: 0.25, velocity: 100 },
                { pitch: 64, startBeat: 0.5, duration: 0.25, velocity: 90 },
                { pitch: 67, startBeat: 1, duration: 0.25, velocity: 100 },
                { pitch: 72, startBeat: 1.5, duration: 0.25, velocity: 95 },
                { pitch: 76, startBeat: 2, duration: 0.25, velocity: 100 },
                { pitch: 72, startBeat: 2.5, duration: 0.25, velocity: 90 },
                { pitch: 67, startBeat: 3, duration: 0.25, velocity: 95 },
                { pitch: 64, startBeat: 3.5, duration: 0.25, velocity: 90 },
                { pitch: 60, startBeat: 4, duration: 0.25, velocity: 100 },
                { pitch: 55, startBeat: 4.5, duration: 0.25, velocity: 85 },
                { pitch: 60, startBeat: 5, duration: 0.25, velocity: 95 },
                { pitch: 64, startBeat: 5.5, duration: 0.25, velocity: 90 },
                { pitch: 67, startBeat: 6, duration: 0.25, velocity: 100 },
                { pitch: 72, startBeat: 6.5, duration: 0.25, velocity: 95 },
                { pitch: 76, startBeat: 7, duration: 0.5, velocity: 100 },
            ];

        // Bell - spaced hits to let the long decay ring
        case 'bell-synth':
        case 'chimes':
        case 'celeste':
        case 'glockenspiel':
            return [
                { pitch: 84, startBeat: 0, duration: 0.5, velocity: 90 },
                { pitch: 79, startBeat: 2, duration: 0.5, velocity: 85 },
                { pitch: 76, startBeat: 4, duration: 0.5, velocity: 80 },
                { pitch: 72, startBeat: 6, duration: 0.5, velocity: 85 },
            ];

        // Mallet - percussive melodic pattern
        case 'marimba':
        case 'xylophone':
        case 'vibraphone':
        case 'kalimba':
            return [
                { pitch: 72, startBeat: 0, duration: 0.25, velocity: 100 },
                { pitch: 74, startBeat: 0.5, duration: 0.25, velocity: 85 },
                { pitch: 76, startBeat: 1, duration: 0.25, velocity: 95 },
                { pitch: 79, startBeat: 1.5, duration: 0.25, velocity: 90 },
                { pitch: 76, startBeat: 2, duration: 0.5, velocity: 100 },
                { pitch: 72, startBeat: 3, duration: 0.5, velocity: 90 },
                { pitch: 67, startBeat: 4, duration: 0.25, velocity: 95 },
                { pitch: 69, startBeat: 4.5, duration: 0.25, velocity: 85 },
                { pitch: 72, startBeat: 5, duration: 0.25, velocity: 100 },
                { pitch: 74, startBeat: 5.5, duration: 0.25, velocity: 90 },
                { pitch: 72, startBeat: 6, duration: 0.5, velocity: 95 },
                { pitch: 67, startBeat: 7, duration: 0.5, velocity: 85 },
            ];

        // Plucked strings - arpeggiated chord pattern
        case 'guitar':
        case 'ukulele':
        case 'banjo':
            return [
                { pitch: 60, startBeat: 0, duration: 0.5, velocity: 100 },
                { pitch: 64, startBeat: 0.5, duration: 0.5, velocity: 85 },
                { pitch: 67, startBeat: 1, duration: 0.5, velocity: 90 },
                { pitch: 64, startBeat: 1.5, duration: 0.5, velocity: 80 },
                { pitch: 60, startBeat: 2, duration: 0.5, velocity: 95 },
                { pitch: 64, startBeat: 2.5, duration: 0.5, velocity: 85 },
                { pitch: 67, startBeat: 3, duration: 0.5, velocity: 90 },
                { pitch: 64, startBeat: 3.5, duration: 0.5, velocity: 80 },
                { pitch: 55, startBeat: 4, duration: 0.5, velocity: 100 },
                { pitch: 59, startBeat: 4.5, duration: 0.5, velocity: 85 },
                { pitch: 62, startBeat: 5, duration: 0.5, velocity: 90 },
                { pitch: 59, startBeat: 5.5, duration: 0.5, velocity: 80 },
                { pitch: 55, startBeat: 6, duration: 0.5, velocity: 95 },
                { pitch: 59, startBeat: 6.5, duration: 0.5, velocity: 85 },
                { pitch: 62, startBeat: 7, duration: 0.5, velocity: 90 },
            ];

        // Harp - cascading arpeggio
        case 'harp':
            return [
                { pitch: 60, startBeat: 0, duration: 1.5, velocity: 90 },
                { pitch: 64, startBeat: 0.25, duration: 1.5, velocity: 85 },
                { pitch: 67, startBeat: 0.5, duration: 1.5, velocity: 80 },
                { pitch: 72, startBeat: 0.75, duration: 1.5, velocity: 85 },
                { pitch: 76, startBeat: 1, duration: 2, velocity: 90 },
                { pitch: 55, startBeat: 4, duration: 1.5, velocity: 90 },
                { pitch: 59, startBeat: 4.25, duration: 1.5, velocity: 85 },
                { pitch: 62, startBeat: 4.5, duration: 1.5, velocity: 80 },
                { pitch: 67, startBeat: 4.75, duration: 1.5, velocity: 85 },
                { pitch: 71, startBeat: 5, duration: 2, velocity: 90 },
            ];

        // Pizzicato - short staccato notes
        case 'pizzicato':
            return [
                { pitch: 60, startBeat: 0, duration: 0.15, velocity: 100 },
                { pitch: 64, startBeat: 0.5, duration: 0.15, velocity: 90 },
                { pitch: 67, startBeat: 1, duration: 0.15, velocity: 95 },
                { pitch: 72, startBeat: 1.5, duration: 0.15, velocity: 90 },
                { pitch: 67, startBeat: 2, duration: 0.15, velocity: 85 },
                { pitch: 64, startBeat: 2.5, duration: 0.15, velocity: 80 },
                { pitch: 60, startBeat: 3, duration: 0.15, velocity: 95 },
                { pitch: 55, startBeat: 3.5, duration: 0.15, velocity: 85 },
                { pitch: 60, startBeat: 4, duration: 0.15, velocity: 100 },
                { pitch: 62, startBeat: 5, duration: 0.15, velocity: 90 },
                { pitch: 65, startBeat: 6, duration: 0.15, velocity: 95 },
                { pitch: 69, startBeat: 7, duration: 0.15, velocity: 90 },
            ];

        // Bowed strings - sustained legato melody
        case 'violin':
        case 'tenor-violin':
        case 'fiddle':
            return [
                { pitch: 67, startBeat: 0, duration: 2, velocity: 85 },
                { pitch: 69, startBeat: 2, duration: 1, velocity: 90 },
                { pitch: 72, startBeat: 3, duration: 1, velocity: 95 },
                { pitch: 74, startBeat: 4, duration: 2, velocity: 90 },
                { pitch: 72, startBeat: 6, duration: 2, velocity: 85 },
            ];

        // Cello - warm sustained lower notes
        case 'cello':
            return [
                { pitch: 48, startBeat: 0, duration: 4, velocity: 85 },
                { pitch: 52, startBeat: 0, duration: 4, velocity: 75 },
                { pitch: 55, startBeat: 0, duration: 4, velocity: 70 },
                { pitch: 45, startBeat: 4, duration: 4, velocity: 85 },
                { pitch: 48, startBeat: 4, duration: 4, velocity: 75 },
                { pitch: 52, startBeat: 4, duration: 4, velocity: 70 },
            ];

        // Double Bass - deep sustained notes
        case 'double-bass':
            return [
                { pitch: 36, startBeat: 0, duration: 2, velocity: 90 },
                { pitch: 36, startBeat: 2, duration: 1, velocity: 80 },
                { pitch: 41, startBeat: 3, duration: 1, velocity: 85 },
                { pitch: 43, startBeat: 4, duration: 2, velocity: 90 },
                { pitch: 41, startBeat: 6, duration: 1, velocity: 85 },
                { pitch: 36, startBeat: 7, duration: 1, velocity: 80 },
            ];

        // Woodwinds - lyrical melody line
        case 'flute':
        case 'piccolo':
        case 'oboe':
            return [
                { pitch: 72, startBeat: 0, duration: 1, velocity: 85 },
                { pitch: 74, startBeat: 1, duration: 0.5, velocity: 80 },
                { pitch: 76, startBeat: 1.5, duration: 1.5, velocity: 90 },
                { pitch: 74, startBeat: 3, duration: 1, velocity: 85 },
                { pitch: 72, startBeat: 4, duration: 1, velocity: 80 },
                { pitch: 69, startBeat: 5, duration: 0.5, velocity: 85 },
                { pitch: 67, startBeat: 5.5, duration: 2.5, velocity: 90 },
            ];

        // Saxophone - jazzy phrase
        case 'saxophone':
            return [
                { pitch: 65, startBeat: 0, duration: 0.75, velocity: 95 },
                { pitch: 67, startBeat: 0.75, duration: 0.25, velocity: 80 },
                { pitch: 69, startBeat: 1, duration: 1.5, velocity: 90 },
                { pitch: 67, startBeat: 2.5, duration: 0.5, velocity: 85 },
                { pitch: 65, startBeat: 3, duration: 0.5, velocity: 80 },
                { pitch: 62, startBeat: 3.5, duration: 0.5, velocity: 85 },
                { pitch: 60, startBeat: 4, duration: 2, velocity: 95 },
                { pitch: 62, startBeat: 6, duration: 0.5, velocity: 85 },
                { pitch: 65, startBeat: 6.5, duration: 1.5, velocity: 90 },
            ];

        // Bassoon - low woodwind melody
        case 'bassoon':
            return [
                { pitch: 48, startBeat: 0, duration: 1.5, velocity: 85 },
                { pitch: 50, startBeat: 1.5, duration: 0.5, velocity: 80 },
                { pitch: 52, startBeat: 2, duration: 2, velocity: 90 },
                { pitch: 50, startBeat: 4, duration: 1, velocity: 85 },
                { pitch: 48, startBeat: 5, duration: 1, velocity: 80 },
                { pitch: 45, startBeat: 6, duration: 2, velocity: 85 },
            ];

        // Trumpet - bright fanfare
        case 'trumpet':
            return [
                { pitch: 67, startBeat: 0, duration: 0.5, velocity: 100 },
                { pitch: 67, startBeat: 0.5, duration: 0.5, velocity: 90 },
                { pitch: 72, startBeat: 1, duration: 1.5, velocity: 100 },
                { pitch: 74, startBeat: 2.5, duration: 0.5, velocity: 95 },
                { pitch: 76, startBeat: 3, duration: 1, velocity: 100 },
                { pitch: 74, startBeat: 4, duration: 0.5, velocity: 90 },
                { pitch: 72, startBeat: 4.5, duration: 0.5, velocity: 95 },
                { pitch: 67, startBeat: 5, duration: 3, velocity: 100 },
            ];

        // Synth Drum Kit - punchy synthesized beat
        case 'synth-drum-kit':
            return [
                { pitch: 36, startBeat: 0, duration: 0.5, velocity: 120 },
                { pitch: 36, startBeat: 4, duration: 0.5, velocity: 110 },
                { pitch: 38, startBeat: 2, duration: 0.5, velocity: 100 },
                { pitch: 38, startBeat: 6, duration: 0.5, velocity: 100 },
                { pitch: 42, startBeat: 0, duration: 0.25, velocity: 85 },
                { pitch: 42, startBeat: 1, duration: 0.25, velocity: 70 },
                { pitch: 42, startBeat: 2, duration: 0.25, velocity: 85 },
                { pitch: 42, startBeat: 3, duration: 0.25, velocity: 70 },
                { pitch: 42, startBeat: 4, duration: 0.25, velocity: 85 },
                { pitch: 42, startBeat: 5, duration: 0.25, velocity: 70 },
                { pitch: 42, startBeat: 6, duration: 0.25, velocity: 85 },
                { pitch: 42, startBeat: 7, duration: 0.25, velocity: 70 },
            ];

        // Didgeridoo - sustained low drone
        case 'didgeridoo':
            return [
                { pitch: 36, startBeat: 0, duration: 4, velocity: 90 },
                { pitch: 38, startBeat: 4, duration: 2, velocity: 85 },
                { pitch: 36, startBeat: 6, duration: 2, velocity: 90 },
            ];

        // Vocal Synth - sustained vocal phrase
        case 'vocal-synth':
            return [
                { pitch: 60, startBeat: 0, duration: 2, velocity: 85 },
                { pitch: 64, startBeat: 0, duration: 2, velocity: 75 },
                { pitch: 67, startBeat: 0, duration: 2, velocity: 70 },
                { pitch: 62, startBeat: 2.5, duration: 1.5, velocity: 80 },
                { pitch: 65, startBeat: 2.5, duration: 1.5, velocity: 72 },
                { pitch: 69, startBeat: 2.5, duration: 1.5, velocity: 68 },
                { pitch: 60, startBeat: 4, duration: 4, velocity: 85 },
                { pitch: 64, startBeat: 4, duration: 4, velocity: 75 },
                { pitch: 67, startBeat: 4, duration: 4, velocity: 70 },
            ];

        // Orchestra Hit - big stab chords
        case 'orchestra-hit':
            return [
                { pitch: 48, startBeat: 0, duration: 0.5, velocity: 120 },
                { pitch: 55, startBeat: 0, duration: 0.5, velocity: 110 },
                { pitch: 60, startBeat: 0, duration: 0.5, velocity: 115 },
                { pitch: 64, startBeat: 0, duration: 0.5, velocity: 105 },
                { pitch: 48, startBeat: 2, duration: 0.5, velocity: 115 },
                { pitch: 55, startBeat: 2, duration: 0.5, velocity: 105 },
                { pitch: 60, startBeat: 2, duration: 0.5, velocity: 110 },
                { pitch: 64, startBeat: 2, duration: 0.5, velocity: 100 },
                { pitch: 53, startBeat: 4, duration: 0.5, velocity: 120 },
                { pitch: 57, startBeat: 4, duration: 0.5, velocity: 110 },
                { pitch: 60, startBeat: 4, duration: 0.5, velocity: 115 },
                { pitch: 65, startBeat: 4, duration: 0.5, velocity: 105 },
                { pitch: 48, startBeat: 6, duration: 1, velocity: 120 },
                { pitch: 55, startBeat: 6, duration: 1, velocity: 110 },
                { pitch: 60, startBeat: 6, duration: 1, velocity: 115 },
                { pitch: 67, startBeat: 6, duration: 1, velocity: 108 },
            ];

        // Guzheng - cascading plucked zither
        case 'guzheng':
            return [
                { pitch: 64, startBeat: 0, duration: 1.5, velocity: 90 },
                { pitch: 67, startBeat: 0.25, duration: 1.5, velocity: 85 },
                { pitch: 71, startBeat: 0.5, duration: 1.5, velocity: 80 },
                { pitch: 76, startBeat: 0.75, duration: 1.5, velocity: 85 },
                { pitch: 79, startBeat: 1, duration: 2, velocity: 90 },
                { pitch: 60, startBeat: 4, duration: 1.5, velocity: 90 },
                { pitch: 64, startBeat: 4.25, duration: 1.5, velocity: 85 },
                { pitch: 67, startBeat: 4.5, duration: 1.5, velocity: 80 },
                { pitch: 72, startBeat: 4.75, duration: 1.5, velocity: 85 },
                { pitch: 76, startBeat: 5, duration: 2, velocity: 90 },
            ];

        // Bongos — Afro-Cuban martillo-inspired pattern (macho=42 high, hembra=36 low)
        case 'bongos':
            return [
                { pitch: 42, startBeat: 0, duration: 0.25, velocity: 90 },
                { pitch: 42, startBeat: 0.5, duration: 0.25, velocity: 70 },
                { pitch: 36, startBeat: 1, duration: 0.25, velocity: 100 },
                { pitch: 42, startBeat: 1.5, duration: 0.25, velocity: 75 },
                { pitch: 42, startBeat: 2, duration: 0.25, velocity: 90 },
                { pitch: 42, startBeat: 2.5, duration: 0.25, velocity: 70 },
                { pitch: 36, startBeat: 3, duration: 0.25, velocity: 100 },
                { pitch: 42, startBeat: 3.5, duration: 0.25, velocity: 75 },
                { pitch: 42, startBeat: 4, duration: 0.25, velocity: 90 },
                { pitch: 42, startBeat: 4.5, duration: 0.25, velocity: 70 },
                { pitch: 36, startBeat: 5, duration: 0.25, velocity: 100 },
                { pitch: 42, startBeat: 5.5, duration: 0.25, velocity: 75 },
                { pitch: 42, startBeat: 6, duration: 0.25, velocity: 90 },
                { pitch: 36, startBeat: 6.5, duration: 0.25, velocity: 80 },
                { pitch: 36, startBeat: 7, duration: 0.25, velocity: 100 },
                { pitch: 42, startBeat: 7.5, duration: 0.25, velocity: 70 },
            ];

        // Wooden Block — sharp rhythmic clicks
        case 'wooden-block':
            return [
                { pitch: 42, startBeat: 0, duration: 0.125, velocity: 100 },
                { pitch: 38, startBeat: 1, duration: 0.125, velocity: 85 },
                { pitch: 42, startBeat: 2, duration: 0.125, velocity: 100 },
                { pitch: 38, startBeat: 3, duration: 0.125, velocity: 85 },
                { pitch: 42, startBeat: 4, duration: 0.125, velocity: 100 },
                { pitch: 38, startBeat: 4.5, duration: 0.125, velocity: 75 },
                { pitch: 42, startBeat: 5, duration: 0.125, velocity: 90 },
                { pitch: 38, startBeat: 6, duration: 0.125, velocity: 85 },
                { pitch: 42, startBeat: 6.5, duration: 0.125, velocity: 80 },
                { pitch: 42, startBeat: 7, duration: 0.125, velocity: 100 },
            ];

        // Harpsichord — baroque chord progression with ornamented pluck
        case 'harpsichord':
            return [
                // C major chord (beat 0)
                { pitch: 60, startBeat: 0, duration: 1.5, velocity: 100 },
                { pitch: 64, startBeat: 0, duration: 1.5, velocity: 95 },
                { pitch: 67, startBeat: 0, duration: 1.5, velocity: 90 },
                // Ornament run
                { pitch: 72, startBeat: 1.5, duration: 0.25, velocity: 85 },
                { pitch: 71, startBeat: 1.75, duration: 0.25, velocity: 80 },
                // G major chord (beat 2)
                { pitch: 55, startBeat: 2, duration: 1.5, velocity: 100 },
                { pitch: 59, startBeat: 2, duration: 1.5, velocity: 95 },
                { pitch: 62, startBeat: 2, duration: 1.5, velocity: 90 },
                // Ornament
                { pitch: 67, startBeat: 3.5, duration: 0.25, velocity: 85 },
                { pitch: 66, startBeat: 3.75, duration: 0.25, velocity: 80 },
                // A minor chord (beat 4)
                { pitch: 57, startBeat: 4, duration: 1.5, velocity: 100 },
                { pitch: 60, startBeat: 4, duration: 1.5, velocity: 95 },
                { pitch: 64, startBeat: 4, duration: 1.5, velocity: 90 },
                // Run down
                { pitch: 69, startBeat: 5.5, duration: 0.25, velocity: 85 },
                { pitch: 67, startBeat: 5.75, duration: 0.25, velocity: 80 },
                // F major chord (beat 6)
                { pitch: 53, startBeat: 6, duration: 2, velocity: 100 },
                { pitch: 57, startBeat: 6, duration: 2, velocity: 95 },
                { pitch: 60, startBeat: 6, duration: 2, velocity: 90 },
            ];

        // Steel Pan — bright Caribbean melodic pattern
        case 'steel-pan':
            return [
                { pitch: 72, startBeat: 0, duration: 0.5, velocity: 95 },
                { pitch: 76, startBeat: 0.5, duration: 0.5, velocity: 85 },
                { pitch: 79, startBeat: 1, duration: 0.5, velocity: 90 },
                { pitch: 76, startBeat: 1.5, duration: 0.5, velocity: 80 },
                { pitch: 72, startBeat: 2, duration: 1, velocity: 95 },
                { pitch: 74, startBeat: 3, duration: 0.5, velocity: 85 },
                { pitch: 76, startBeat: 3.5, duration: 0.5, velocity: 90 },
                { pitch: 79, startBeat: 4, duration: 0.5, velocity: 95 },
                { pitch: 84, startBeat: 4.5, duration: 0.5, velocity: 90 },
                { pitch: 79, startBeat: 5, duration: 1, velocity: 85 },
                { pitch: 76, startBeat: 6, duration: 0.5, velocity: 90 },
                { pitch: 72, startBeat: 6.5, duration: 1.5, velocity: 95 },
            ];

        // Square Wave — retro 8-bit arpeggio
        case 'square-wave':
            return [
                { pitch: 60, startBeat: 0, duration: 0.5, velocity: 100 },
                { pitch: 64, startBeat: 0.5, duration: 0.5, velocity: 90 },
                { pitch: 67, startBeat: 1, duration: 0.5, velocity: 95 },
                { pitch: 72, startBeat: 1.5, duration: 0.5, velocity: 100 },
                { pitch: 67, startBeat: 2, duration: 0.5, velocity: 85 },
                { pitch: 64, startBeat: 2.5, duration: 0.5, velocity: 80 },
                { pitch: 60, startBeat: 3, duration: 0.5, velocity: 95 },
                { pitch: 55, startBeat: 3.5, duration: 0.5, velocity: 85 },
                { pitch: 60, startBeat: 4, duration: 1, velocity: 100 },
                { pitch: 67, startBeat: 5, duration: 1, velocity: 90 },
                { pitch: 72, startBeat: 6, duration: 2, velocity: 95 },
            ];

        // Triangle Wave — gentle mellow melody
        case 'triangle-wave':
            return [
                { pitch: 67, startBeat: 0, duration: 1.5, velocity: 85 },
                { pitch: 69, startBeat: 1.5, duration: 0.5, velocity: 80 },
                { pitch: 72, startBeat: 2, duration: 2, velocity: 90 },
                { pitch: 69, startBeat: 4, duration: 1, velocity: 85 },
                { pitch: 67, startBeat: 5, duration: 1, velocity: 80 },
                { pitch: 64, startBeat: 6, duration: 2, velocity: 85 },
            ];

        // Sawtooth Wave — buzzy lead riff
        case 'sawtooth-wave':
            return [
                { pitch: 60, startBeat: 0, duration: 0.5, velocity: 100 },
                { pitch: 63, startBeat: 0.5, duration: 0.5, velocity: 90 },
                { pitch: 67, startBeat: 1, duration: 1, velocity: 100 },
                { pitch: 63, startBeat: 2, duration: 0.5, velocity: 85 },
                { pitch: 60, startBeat: 2.5, duration: 0.5, velocity: 90 },
                { pitch: 58, startBeat: 3, duration: 1, velocity: 95 },
                { pitch: 60, startBeat: 4, duration: 0.5, velocity: 100 },
                { pitch: 63, startBeat: 4.5, duration: 0.5, velocity: 90 },
                { pitch: 67, startBeat: 5, duration: 1, velocity: 100 },
                { pitch: 72, startBeat: 6, duration: 2, velocity: 95 },
            ];

        // Euphonium — warm low brass melody
        case 'euphonium':
            return [
                { pitch: 48, startBeat: 0, duration: 1.5, velocity: 90 },
                { pitch: 50, startBeat: 1.5, duration: 0.5, velocity: 85 },
                { pitch: 52, startBeat: 2, duration: 2, velocity: 95 },
                { pitch: 50, startBeat: 4, duration: 1, velocity: 85 },
                { pitch: 48, startBeat: 5, duration: 0.5, velocity: 80 },
                { pitch: 45, startBeat: 5.5, duration: 2.5, velocity: 90 },
            ];

        // Taiko — powerful rhythmic hits
        case 'taiko':
            return [
                { pitch: 36, startBeat: 0, duration: 0.5, velocity: 120 },
                { pitch: 36, startBeat: 1, duration: 0.5, velocity: 90 },
                { pitch: 36, startBeat: 2, duration: 0.5, velocity: 120 },
                { pitch: 42, startBeat: 3, duration: 0.25, velocity: 80 },
                { pitch: 42, startBeat: 3.5, duration: 0.25, velocity: 70 },
                { pitch: 36, startBeat: 4, duration: 0.5, velocity: 120 },
                { pitch: 38, startBeat: 5, duration: 0.5, velocity: 100 },
                { pitch: 36, startBeat: 6, duration: 0.5, velocity: 110 },
                { pitch: 36, startBeat: 7, duration: 0.5, velocity: 120 },
            ];

        // Maracas — fast shaker rhythm
        case 'maracas':
            return [
                { pitch: 42, startBeat: 0, duration: 0.125, velocity: 90 },
                { pitch: 42, startBeat: 0.5, duration: 0.125, velocity: 70 },
                { pitch: 42, startBeat: 1, duration: 0.125, velocity: 90 },
                { pitch: 42, startBeat: 1.5, duration: 0.125, velocity: 70 },
                { pitch: 42, startBeat: 2, duration: 0.125, velocity: 90 },
                { pitch: 42, startBeat: 2.5, duration: 0.125, velocity: 70 },
                { pitch: 42, startBeat: 3, duration: 0.125, velocity: 90 },
                { pitch: 42, startBeat: 3.5, duration: 0.125, velocity: 70 },
                { pitch: 42, startBeat: 4, duration: 0.125, velocity: 90 },
                { pitch: 42, startBeat: 4.5, duration: 0.125, velocity: 70 },
                { pitch: 42, startBeat: 5, duration: 0.125, velocity: 90 },
                { pitch: 42, startBeat: 5.5, duration: 0.125, velocity: 70 },
                { pitch: 42, startBeat: 6, duration: 0.125, velocity: 90 },
                { pitch: 42, startBeat: 6.5, duration: 0.125, velocity: 70 },
                { pitch: 42, startBeat: 7, duration: 0.125, velocity: 90 },
                { pitch: 42, startBeat: 7.5, duration: 0.125, velocity: 70 },
            ];

        // Default synth - simple arpeggio
        case 'basic-synth':
        default:
            return [
                { pitch: 60, startBeat: 0, duration: 0.5, velocity: 100 },
                { pitch: 64, startBeat: 0.5, duration: 0.5, velocity: 95 },
                { pitch: 67, startBeat: 1, duration: 0.5, velocity: 100 },
                { pitch: 72, startBeat: 1.5, duration: 0.5, velocity: 95 },
                { pitch: 67, startBeat: 2, duration: 0.5, velocity: 90 },
                { pitch: 64, startBeat: 2.5, duration: 0.5, velocity: 85 },
                { pitch: 60, startBeat: 3, duration: 1, velocity: 100 },
            ];
    }
}
