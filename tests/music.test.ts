// ============================================
// ComposeYogi — Music Theory Tests
// ============================================
//
// Two things are being held down here.
//
// The scale tests exist because the app shipped with three disagreeing answers
// to "what scales are there": the type had nine, the Inspector offered thirteen,
// and the interval table knew nine — a different nine. Choosing Harmonic Minor
// therefore highlighted natural minor and said nothing about it. Nothing threw,
// which is why it survived. Every test below is a way for those lists to be
// caught disagreeing again.
//
// The snap tests are arithmetic, and arithmetic is exactly what a triplet grid
// gets wrong: three notes in the space of two is easy to write as 1/3 of a beat
// and be a hair out over a bar.

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { DRUM_KITS, SAMPLE_FAMILY, kitUrls } from '@/lib/audio/drum-kits';

import {
    DRUM_PITCH,
    GM_PERCUSSION,
    GM_PERCUSSION_HIGH,
    GM_PERCUSSION_LOW,
    HIGHEST_PITCH,
    KEYBOARD_HIGH_PITCH,
    KEYBOARD_LOW_PITCH,
    TYPING_OCTAVE_MAX,
    TYPING_OCTAVE_MIN,
    TYPING_SPAN_SEMITONES,
    octaveBasePitch,
    LOWEST_PITCH,
    MIDDLE_C,
    NOTE_NAMES,
    PITCH_OCTAVES,
    isPlayablePitch,
    octaveFirstPitch,
    pitchFrequency,
    pitchName,
    pitchOctave,
    SCALE_IDS,
    SCALE_INTERVALS,
    drumCapLabel,
    drumSoundForPitch,
    drumWindowRange,
    keyboardLayout,
    SNAP_BEATS,
    SNAP_VALUES,
    STRAIGHT_SNAP_VALUES,
    TRIPLET_SNAP_VALUES,
    VIBES,
    matchVibe,
    scalePitchClasses,
    snapStepBeats,
    snapToGrid,
    vibeById,
} from '@/lib/music';

import type { MusicalScale, SnapValue } from '@/types';

const messages = JSON.parse(
    readFileSync(join(__dirname, '..', 'messages', 'en.json'), 'utf8')
) as { scales: Record<string, string>; vibes: Record<string, string> };

/**
 * Every scale, as values rather than types. A type-level check cannot run at
 * runtime, and this list is what the exhaustiveness tests compare against.
 */
const ALL_SCALES: MusicalScale[] = [
    'major', 'minor', 'harmonicMinor', 'melodicMinor',
    'dorian', 'phrygian', 'lydian', 'mixolydian', 'locrian',
    'pentatonicMajor', 'pentatonicMinor', 'blues', 'chromatic',
];

const ALL_SNAP_VALUES: SnapValue[] = [
    'off', '1', '1/2', '1/4', '1/8', '1/16', '1/32', '1/4T', '1/8T', '1/16T',
];

// ============================================
// Scales
// ============================================

/** Every .ts/.tsx file under a project directory, for the source scans below. */
function sourceFilesUnder(dir: string): string[] {
    const root = join(__dirname, '..', dir);
    const out: string[] = [];
    const walk = (path: string) => {
        for (const entry of readdirSync(path, { withFileTypes: true })) {
            const full = join(path, entry.name);
            if (entry.isDirectory()) walk(full);
            else if (/\.tsx?$/.test(entry.name)) out.push(full);
        }
    };
    walk(root);
    return out;
}

describe('every scale is complete', () => {
    it('covers the whole type — the test list is not stale', () => {
        // Guards the lists below: a scale added to MusicalScale but not to
        // ALL_SCALES would make every test here pass without checking it.
        expect(Object.keys(SCALE_INTERVALS).sort()).toEqual([...ALL_SCALES].sort());
    });

    it('has intervals', () => {
        for (const scale of ALL_SCALES) {
            expect(SCALE_INTERVALS[scale], `${scale} has no intervals`).toBeTruthy();
            expect(SCALE_INTERVALS[scale].length).toBeGreaterThan(0);
        }
    });

    it('has a place in the picker', () => {
        // The original bug in reverse: a scale the type knows about that no
        // picker offers is unreachable, which is what `pentatonic` was.
        const missing = ALL_SCALES.filter((scale) => !(SCALE_IDS as readonly string[]).includes(scale));
        expect(missing, 'add it to SCALE_IDS or it cannot be chosen').toEqual([]);
    });

    it('has an English name', () => {
        // `pentatonic` had none, so choosing it would have rendered the literal
        // key path "scales.pentatonic" into the toolbar.
        const missing = ALL_SCALES.filter((scale) => !messages.scales[scale]);
        expect(missing, 'add it to messages/{en,es}.json under `scales`').toEqual([]);
    });

    it('is a set of ascending semitones inside one octave', () => {
        for (const scale of ALL_SCALES) {
            const intervals = SCALE_INTERVALS[scale];
            expect(intervals[0], `${scale} does not start on its root`).toBe(0);
            expect(Math.max(...intervals), `${scale} leaves the octave`).toBeLessThan(12);
            expect(Math.min(...intervals), `${scale} has a negative interval`).toBeGreaterThanOrEqual(0);

            const ascending = intervals.every((n, i) => i === 0 || n > intervals[i - 1]);
            expect(ascending, `${scale} is not in ascending order`).toBe(true);
            expect(new Set(intervals).size, `${scale} repeats an interval`).toBe(intervals.length);
        }
    });
});

describe('scalePitchClasses', () => {
    it('roots the scale on the chosen key', () => {
        expect([...scalePitchClasses('C', 'major')].sort((a, b) => a - b))
            .toEqual([0, 2, 4, 5, 7, 9, 11]);
        // A minor is C major's relative — same notes, different root.
        expect([...scalePitchClasses('A', 'minor')].sort((a, b) => a - b))
            .toEqual([0, 2, 4, 5, 7, 9, 11]);
    });

    it('wraps past B rather than running off the end', () => {
        const classes = scalePitchClasses('A#', 'major');
        expect([...classes].every((pc) => pc >= 0 && pc < 12)).toBe(true);
        expect(classes.size).toBe(7);
    });

    it('admits every note under chromatic and rejects none', () => {
        expect(scalePitchClasses('F', 'chromatic').size).toBe(12);
    });

    it('names notes so that NOTE_NAMES[pitch % 12] is the note', () => {
        expect(NOTE_NAMES[60 % 12]).toBe('C');   // middle C
        expect(NOTE_NAMES[69 % 12]).toBe('A');   // A440
    });
});

// ============================================
// Vibes
// ============================================

describe('vibes', () => {
    it('resolve to a real key and a real scale', () => {
        for (const vibe of VIBES) {
            expect(NOTE_NAMES, `${vibe.id} has an unknown key`).toContain(vibe.key);
            expect(ALL_SCALES, `${vibe.id} has an unknown scale`).toContain(vibe.scale);
        }
    });

    it('have an English name', () => {
        const missing = VIBES.filter((vibe) => !messages.vibes[vibe.id]);
        expect(missing.map((v) => v.id)).toEqual([]);
    });

    it('never share a key and scale', () => {
        // matchVibe returns the first hit, so two vibes on the same pair would
        // make the transport label whichever one was declared first — the
        // control would silently disagree with the click that set it.
        const pairs = VIBES.map((v) => `${v.key} ${v.scale}`);
        expect(new Set(pairs).size).toBe(VIBES.length);
    });

    it('round-trip through matchVibe', () => {
        for (const vibe of VIBES) {
            expect(matchVibe(vibe.key, vibe.scale)?.id).toBe(vibe.id);
        }
    });

    it('report no match rather than guessing', () => {
        // C locrian is nobody's vibe. Falling back to the first one would put a
        // label on the transport that the piano roll then contradicts.
        expect(matchVibe('C', 'locrian')).toBeNull();
    });

    it('look up by id, and refuse an id that is not one', () => {
        expect(vibeById('chill')?.scale).toBe('dorian');
        // @ts-expect-error — the guard is for values arriving from storage
        expect(vibeById('nonsense')).toBeUndefined();
    });
});

// ============================================
// Snap
// ============================================

describe('snap resolutions', () => {
    it('cover the whole type — the test list is not stale', () => {
        expect(Object.keys(SNAP_BEATS).sort()).toEqual([...ALL_SNAP_VALUES].sort());
    });

    it('are all offered by the picker exactly once', () => {
        expect([...SNAP_VALUES].sort()).toEqual([...ALL_SNAP_VALUES].sort());
        expect(new Set(SNAP_VALUES).size).toBe(SNAP_VALUES.length);
    });

    it('halve at each straight division, with a quarter note worth one beat', () => {
        expect(SNAP_BEATS['1/4']).toBe(1);
        for (let i = 1; i < STRAIGHT_SNAP_VALUES.length; i++) {
            expect(SNAP_BEATS[STRAIGHT_SNAP_VALUES[i]])
                .toBeCloseTo(SNAP_BEATS[STRAIGHT_SNAP_VALUES[i - 1]] / 2, 10);
        }
    });

    it('fit three triplets into the space of two straight notes', () => {
        const pairs = [['1/4T', '1/4'], ['1/8T', '1/8'], ['1/16T', '1/16']] as const;
        for (const [triplet, straight] of pairs) {
            expect(SNAP_BEATS[triplet] * 3, `${triplet} does not fill two ${straight}`)
                .toBeCloseTo(SNAP_BEATS[straight] * 2, 10);
        }
    });

    it('lands three eighth-note triplets exactly on the next beat', () => {
        // The arithmetic a naive 1/3 gets wrong: three of them must reach 1.0
        // exactly, or a triplet figure drifts a little further off every bar.
        expect(SNAP_BEATS['1/8T'] * 3).toBeCloseTo(1, 12);
        expect(SNAP_BEATS['1/16T'] * 6).toBeCloseTo(1, 12);
    });

    it('offers every division in one group or the other', () => {
        const grouped = [...STRAIGHT_SNAP_VALUES, ...TRIPLET_SNAP_VALUES, 'off'];
        expect([...grouped].sort()).toEqual([...ALL_SNAP_VALUES].sort());
    });
});

describe('snapToGrid', () => {
    it('rounds to the nearest division', () => {
        expect(snapToGrid(0.3, '1/4')).toBe(0);
        expect(snapToGrid(0.6, '1/4')).toBe(1);
        expect(snapToGrid(1.3, '1/8')).toBeCloseTo(1.5, 10);
    });

    it('leaves a value alone when snapping is off', () => {
        // The point of the setting: a note nudged deliberately off the grid has
        // to survive being dragged.
        expect(snapToGrid(1.234, 'off')).toBe(1.234);
        expect(snapToGrid(-0.5, 'off')).toBe(-0.5);
    });

    it('puts an off-beat eighth on the triplet grid', () => {
        // 0.5 of a beat is nearer the second eighth-triplet (0.666…) than the
        // first (0.333…) only by a hair — this is the rounding that decides
        // whether a shuffle lands.
        expect(snapToGrid(0.5, '1/8T')).toBeCloseTo(2 / 3, 10);
        expect(snapToGrid(0.3, '1/8T')).toBeCloseTo(1 / 3, 10);
    });

    it('does not drift over a bar of triplets', () => {
        for (let i = 0; i <= 12; i++) {
            const exact = i * SNAP_BEATS['1/8T'];
            expect(snapToGrid(exact + 0.001, '1/8T')).toBeCloseTo(exact, 9);
        }
    });
});

describe('snapStepBeats', () => {
    it('is the snap resolution when snapping is on', () => {
        expect(snapStepBeats('1/16')).toBe(0.25);
        expect(snapStepBeats('1/8T')).toBeCloseTo(1 / 3, 10);
    });

    it('is never zero, so a new note always has a length', () => {
        // Drawing at snap=off used to be the trap: the raw value is 0, and a
        // note of no length is silent and unclickable.
        for (const snap of ALL_SNAP_VALUES) {
            expect(snapStepBeats(snap), `${snap} yields a zero-length note`).toBeGreaterThan(0);
        }
    });
});

// ============================================
// What a pitch is called, and where it sounds
// ============================================
//
// The third disagreeing list, found the way the first one was — by someone
// playing the app and saying it sounded wrong. `PianoRoll`'s key column and the
// live keyboard both named a pitch `Math.floor(pitch / 12)`, so MIDI 60 was
// drawn as "C5"; `PianoRoll`'s own `noteName`, two hundred lines away in the
// same file, subtracted the one and called it C4. Nothing threw.
//
// It was not only cosmetic. The live keyboard's lowest offered octave was
// labelled "C1" and was MIDI 12 — C0, **16.35 Hz**, below the bottom of human
// hearing and far below what a laptop speaker moves. Held against an online
// piano's C1 at 32.70 Hz it sounds broken, because it is: an octave lower than
// its own label, in a range nothing can reproduce.

describe('a pitch has one name, and it is the one everyone else uses', () => {
    it('puts middle C where middle C is', () => {
        expect(MIDDLE_C).toBe(60);
        expect(pitchName(MIDDLE_C)).toBe('C4');
        expect(pitchOctave(MIDDLE_C)).toBe(4);
    });

    it('names the octave below MIDI 12 correctly', () => {
        // The old formula said "C1" here. It is C0, and the difference is an
        // octave of pitch that does not exist on a piano.
        expect(pitchName(12)).toBe('C0');
        expect(pitchName(24)).toBe('C1');
    });

    it('names every pitch class', () => {
        for (let i = 0; i < 12; i++) {
            expect(pitchName(MIDDLE_C + i)).toBe(`${NOTE_NAMES[i]}4`);
        }
    });

    it('round-trips an octave through its first pitch', () => {
        for (let octave = 0; octave <= 8; octave++) {
            expect(pitchOctave(octaveFirstPitch(octave))).toBe(octave);
            expect(pitchName(octaveFirstPitch(octave))).toBe(`C${octave}`);
        }
    });
});

describe('the playable range is one a speaker can reproduce', () => {
    it('starts at C1 and ends at B7', () => {
        expect(pitchName(LOWEST_PITCH)).toBe('C1');
        expect(pitchName(HIGHEST_PITCH)).toBe('B7');
        expect(PITCH_OCTAVES).toBe(7);
    });

    it('never offers a note below what a speaker can move', () => {
        // 20 Hz is the bottom of hearing; a laptop is lucky to reach 80. The old
        // floor was 16.35 Hz, which is cone travel and no note.
        expect(pitchFrequency(LOWEST_PITCH)).toBeGreaterThan(30);
        expect(pitchFrequency(LOWEST_PITCH - 12)).toBeLessThan(20);
    });

    it('agrees with a tuner', () => {
        expect(pitchFrequency(69)).toBeCloseTo(440, 6);
        expect(pitchFrequency(MIDDLE_C)).toBeCloseTo(261.626, 2);
        expect(pitchFrequency(LOWEST_PITCH)).toBeCloseTo(32.703, 2);
        expect(pitchFrequency(HIGHEST_PITCH)).toBeCloseTo(3951.066, 2);
    });

    it('rejects what it cannot draw rather than moving it', () => {
        // Not a clamp: an out-of-range pitch is a bug at the call site, and
        // silently shifting it an octave is how a wrong note becomes a mystery.
        expect(isPlayablePitch(LOWEST_PITCH)).toBe(true);
        expect(isPlayablePitch(HIGHEST_PITCH)).toBe(true);
        expect(isPlayablePitch(LOWEST_PITCH - 1)).toBe(false);
        expect(isPlayablePitch(HIGHEST_PITCH + 1)).toBe(false);
        expect(isPlayablePitch(60.5)).toBe(false);
    });
});

describe('nothing names a pitch on its own again', () => {
    it('leaves the octave arithmetic in one place', () => {
        // `Math.floor(pitch / 12)` without the `- 1` is the bug, and it was
        // written twice. This is the only way to notice a third.
        const files = [
            ...sourceFilesUnder('components'),
            ...sourceFilesUnder('lib'),
        ].filter((file) => !file.endsWith(join('lib', 'music', 'pitch.ts')));

        const hits: string[] = [];
        for (const file of files) {
            readFileSync(file, 'utf8').split('\n').forEach((line, index) => {
                if (/Math\.floor\(\s*\w*[Pp]itch\w*\s*\/\s*12\s*\)/.test(line)) {
                    hits.push(`${file}:${index + 1}  ${line.trim()}`);
                }
            });
        }

        expect(
            hits,
            'Use pitchOctave() or pitchName() from lib/music/pitch.ts. '
            + 'Math.floor(pitch / 12) is an octave too high: MIDI 0 is C-1.'
        ).toEqual([]);
    });

    it('leaves no sample mapped by note name', () => {
        // The bug this replaced: every `Tone.Sampler` kit was written as
        // `C1: 'kick-deep.wav'` with a `// 36 - Kick` comment beside it. Tone
        // parses a note name as `index + (octave + 1) * 12`, so `C1` is MIDI 24
        // and General MIDI's kick is 36 — the samples sat a full octave below
        // the pitches the sequencer and the templates write, and Tone repitched
        // the nearest buffer it did have. Measured against Tone's own registry:
        // a kick played hihat-open two semitones sharp, and every drum above 40
        // played the same shaker at a different speed.
        //
        // `SamplesMap` takes `[midi: number]` as a first-class key, so there is
        // no reason for a note name to appear near a sample and every reason
        // for it not to. `DRUM_PITCH` is the way to name one.
        // Whole-line comments are skipped, unlike the octave guard above. That
        // guard bans an *expression* outright, so prose has to avoid it too;
        // this one bans a *key form*, and explaining why a key form is banned
        // is impossible without writing one down. A trailing comment on a real
        // line is still scanned, which is where a stray mapping would hide.
        const isProse = (line: string) => /^(\/\/|\/?\*)/.test(line.trim());

        const hits: string[] = [];
        for (const file of sourceFilesUnder('lib')) {
            readFileSync(file, 'utf8').split('\n').forEach((line, index) => {
                if (isProse(line)) return;
                if (/(['"]?)[A-G](?:#|b)?-?\d\1\s*:\s*['"][^'"]*\.(wav|mp3|ogg)['"]/.test(line)) {
                    hits.push(`${file}:${index + 1}  ${line.trim()}`);
                }
            });
        }

        expect(
            hits,
            'Key a Tone.Sampler by MIDI number via DRUM_PITCH from '
            + 'lib/music/percussion.ts. A note name is an octave trap: Tone reads '
            + 'C1 as MIDI 24, and General MIDI puts the kick at 36.'
        ).toEqual([]);
    });
});

// ============================================
// The kit map
// ============================================
//
// This list spent v1.0 through 8.7.6h private inside `DrumSequencer.tsx`, while
// the six sampler kits kept a second copy in note names and `demo-templates.ts`
// a third in a seven-entry literal. The sampler's copy was an octave out and
// nobody could see the three side by side to notice. These tests are what makes
// a fourth copy, or a drift in this one, fail the build.

describe('General MIDI percussion', () => {
    it('covers 35 to 81 exactly once each, with nothing outside', () => {
        // The comment above the old list said "Full GM percussion set: MIDI
        // notes 35-81" and sat above 46 of the 47 — Vibraslap (58) was simply
        // absent. A range check is the only thing that notices a missing middle.
        const pitches = GM_PERCUSSION.map((sound) => sound.pitch).sort((a, b) => a - b);
        const expected = Array.from(
            { length: GM_PERCUSSION_HIGH - GM_PERCUSSION_LOW + 1 },
            (_, index) => GM_PERCUSSION_LOW + index
        );
        expect(pitches).toEqual(expected);
    });

    it('gives every sound a unique id, name and short name', () => {
        // `DRUM_PITCH` is built by folding the array into a record, so a
        // duplicate id silently drops a sound's pitch rather than erroring.
        for (const field of ['id', 'name', 'shortName'] as const) {
            const values = GM_PERCUSSION.map((sound) => sound[field]);
            expect(new Set(values).size, `duplicate ${field}`).toBe(values.length);
        }
    });

    it('keeps short names to three characters, the width of a lane rail', () => {
        for (const sound of GM_PERCUSSION) {
            expect(sound.shortName, sound.name).toHaveLength(3);
        }
    });

    it('reaches every sound by pitch, and nothing outside the range', () => {
        for (const sound of GM_PERCUSSION) {
            expect(drumSoundForPitch(sound.pitch)).toEqual(sound);
        }
        expect(drumSoundForPitch(GM_PERCUSSION_LOW - 1)).toBeNull();
        expect(drumSoundForPitch(GM_PERCUSSION_HIGH + 1)).toBeNull();
        expect(drumSoundForPitch(60.5)).toBeNull();
    });

    it('names the pitches the kits and templates are keyed by', () => {
        // The specific numbers the six samplers and every demo template depend
        // on. Written out rather than derived, because deriving them from the
        // same array they are meant to pin proves nothing — and because these
        // are the General MIDI standard, not this app's choice.
        expect(DRUM_PITCH.acousticBassDrum).toBe(35);
        expect(DRUM_PITCH.kick).toBe(36);
        expect(DRUM_PITCH.sideStick).toBe(37);
        expect(DRUM_PITCH.snare).toBe(38);
        expect(DRUM_PITCH.handClap).toBe(39);
        expect(DRUM_PITCH.electricSnare).toBe(40);
        expect(DRUM_PITCH.closedHat).toBe(42);
        expect(DRUM_PITCH.pedalHat).toBe(44);
        expect(DRUM_PITCH.openHat).toBe(46);
        expect(DRUM_PITCH.ride).toBe(51);
        expect(DRUM_PITCH.cowbell).toBe(56);
    });

    it('sits inside the range the drawn keyboard can show', () => {
        // A drum the live keyboard cannot draw is one you can sequence and not
        // play, which is the mismatch this whole change exists to remove.
        expect(GM_PERCUSSION_LOW).toBeGreaterThanOrEqual(KEYBOARD_LOW_PITCH);
        expect(GM_PERCUSSION_HIGH).toBeLessThanOrEqual(KEYBOARD_HIGH_PITCH);
    });
});

// ============================================
// What the keycaps say
// ============================================

describe('the drawn keyboard speaks the track\'s language', () => {
    const melodic = keyboardLayout(3, 1400);
    const kit = keyboardLayout(3, 1400, 'kit');
    const at = (layout: typeof melodic, pitch: number) =>
        layout.keys.find((key) => key.pitch === pitch)!;

    it('labels notes on a melodic track and drums on a kit', () => {
        // 48 is middle-C-minus-an-octave on a piano and a Hi-Mid Tom on a kit,
        // and the app drew "C3" on it for both.
        expect(at(melodic, 48).label).toBe('C3');
        expect(at(melodic, 48).name).toBe('C3');
        expect(at(kit, 48).label).toBe('HMT');
        expect(at(kit, 48).name).toBe('Hi-Mid Tom');
    });

    it('labels a kit\'s black keys, where a melodic board labels none', () => {
        // The whole reason this cannot reuse the note-name rule: GM puts the
        // closed hat on F#, the open hat on A# and the ride on D#. A kit board
        // that only labels the whites is missing the hats.
        expect(at(melodic, 42).label).toBeNull();
        // Two characters, because a black key cannot hold three — see the cap
        // tests below. The white keys keep the full short name.
        expect(at(kit, 42).label).toBe('CH');
        expect(at(kit, 46).label).toBe('OH');
        expect(at(kit, 51).label).toBe('RD');
        expect(at(kit, 48).label).toBe('HMT');
        expect(kit.keys.filter((key) => key.black && key.label).length).toBeGreaterThan(0);
    });

    it('leaves a kit key blank outside the percussion range', () => {
        // Blank is the honest answer: the sampler will repitch a neighbour, but
        // General MIDI has no sound there and naming one would be inventing it.
        expect(at(kit, GM_PERCUSSION_LOW - 1).label).toBeNull();
        expect(at(kit, GM_PERCUSSION_HIGH + 1).label).toBeNull();
        // The accessible name falls back to the pitch rather than going empty —
        // an unnamed button is worse than one named something unhelpful.
        expect(at(kit, GM_PERCUSSION_LOW - 1).name).toBe(pitchName(GM_PERCUSSION_LOW - 1));
    });

    it('changes nothing but the words', () => {
        // The board is the same object either way. Three versions of this
        // keyboard moved when something about the track changed, and each one
        // read as a rendering bug.
        expect(kit.keys.length).toBe(melodic.keys.length);
        expect(kit.width).toBe(melodic.width);
        expect(kit.height).toBe(melodic.height);
        expect(kit.offsetX).toBe(melodic.offsetX);
        expect(kit.windowX).toBe(melodic.windowX);
        expect(kit.windowWidth).toBe(melodic.windowWidth);
        for (const key of kit.keys) {
            const twin = at(melodic, key.pitch);
            expect([key.x, key.width, key.height, key.black, key.inWindow])
                .toEqual([twin.x, twin.width, twin.height, twin.black, twin.inWindow]);
            expect(key.typed).toEqual(twin.typed);
        }
    });

    it('defaults to melodic, so an unaware caller cannot get drum names', () => {
        expect(keyboardLayout(3, 1400).keys).toEqual(melodic.keys);
    });
});

// ============================================
// Kit caps and the kit readout
// ============================================

const isBlack = (pitch: number) => [1, 3, 6, 8, 10].includes(((pitch % 12) + 12) % 12);

describe('a black key gets a cap that fits it', () => {
    it('prints two characters on a black key and three on a white', () => {
        // A black key is 13.7/23 of a white one. At 23px whites — a laptop with
        // both side panels open — that is 14px, and a three-character cap at
        // `text-2xs` measures 17px. It clipped a quarter off each outer glyph.
        for (const sound of GM_PERCUSSION) {
            const black = isBlack(sound.pitch);
            const cap = drumCapLabel(sound, black);
            expect(cap, sound.name).toHaveLength(black ? 2 : 3);
        }
    });

    it('never gives two black-key drums the same cap', () => {
        const caps = GM_PERCUSSION
            .filter((sound) => isBlack(sound.pitch))
            .map((sound) => drumCapLabel(sound, true));
        expect(new Set(caps).size).toBe(caps.length);
    });

    it('overrides exactly the drums that need one, and no others', () => {
        // The override list is derived here rather than trusted: take the naive
        // first-two-characters for every black-key drum, find which ones
        // collide, and require the shipped caps to differ from the naive form on
        // precisely those. A stale override — one whose collision went away
        // because a short name changed — fails as loudly as a missing one.
        const black = GM_PERCUSSION.filter((sound) => isBlack(sound.pitch));
        const naive = new Map(black.map((sound) => [sound.id, sound.shortName.slice(0, 2)]));

        const seen = new Set<string>();
        const collided = new Set<string>();
        for (const sound of black) {
            const cap = naive.get(sound.id)!;
            if (seen.has(cap)) collided.add(cap);
            seen.add(cap);
        }
        // Every drum whose naive cap is contested, minus the first claimant,
        // must have been given something else.
        const overridden = black
            .filter((sound) => drumCapLabel(sound, true) !== naive.get(sound.id))
            .map((sound) => sound.id);

        for (const id of overridden) {
            expect(collided.has(naive.get(id)!), `${id} is overridden but nothing collides with it`).toBe(true);
        }
        expect(overridden.length).toBe(collided.size);
    });

    it('keeps the hats readable, which is the case that matters', () => {
        // All three hats are on black keys, and they are the drums anyone
        // actually reaches for after the kick and the snare.
        const cap = (pitch: number) => drumCapLabel(drumSoundForPitch(pitch)!, true);
        expect(cap(42)).toBe('CH');
        expect(cap(44)).toBe('PH');
        expect(cap(46)).toBe('OH');
    });
});

describe('the octave readout speaks the same language as the keys', () => {
    it('names a drum at each end of the window, for every octave', () => {
        // `C3–C5` is true about pitch and meaningless about a kit, and it sat
        // above keys reading BD2 and CHH. GM's 35–81 overlaps every window the
        // typing octaves allow, so there is always an answer — no octave falls
        // back to a dash.
        for (let octave = TYPING_OCTAVE_MIN; octave <= TYPING_OCTAVE_MAX; octave++) {
            const low = octaveBasePitch(octave);
            const range = drumWindowRange(low, low + TYPING_SPAN_SEMITONES);
            expect(range, `octave ${octave}`).not.toBeNull();
            expect(range!.from).toHaveLength(3);
            expect(range!.to).toHaveLength(3);
        }
    });

    it('reports the first and last drum inside the window, not its end pitches', () => {
        // The window can start below 35 or run past 81, and a blank end would
        // say the range is open when it is not.
        expect(drumWindowRange(24, 48)).toEqual({ from: 'BD1', to: 'HMT' });
        expect(drumWindowRange(72, 96)).toEqual({ from: 'LWH', to: 'OTR' });
    });

    it('says nothing rather than guessing when no drum is in range', () => {
        expect(drumWindowRange(0, 20)).toBeNull();
    });
});

// ============================================
// The sampled kits
// ============================================
//
// These exist because the shaker-on-the-ride fix survived a deliberate revert
// with every test green: a kit written as a Tone factory is a sound nothing can
// check, and Tone cannot be constructed here at all. `drum-kits.ts` is the data;
// this is what reads it.

describe('the sampled kits', () => {
    const kits = Object.entries(DRUM_KITS);

    it('never files a sample under a slot of another family', () => {
        // The whole shape of the bug: `perc-shaker.wav` sat on Ride Cymbal 1,
        // and because `_findClosest` walks outward from the pitch asked for,
        // that one entry handed the shaker to every cymbal, tom and latin slot
        // above it. A sample belongs in a slot of its own family or in none.
        const wrong: string[] = [];
        for (const [id, kit] of kits) {
            for (const [slot, file] of Object.entries(kit.samples)) {
                const sound = GM_PERCUSSION.find((s) => s.id === slot)!;
                const family = SAMPLE_FAMILY[file];
                if (family !== sound.family) {
                    wrong.push(`${id}: ${file} (${family}) on ${sound.name} (${sound.family})`);
                }
            }
        }
        expect(wrong).toEqual([]);
    });

    it('describes every sample it uses', () => {
        for (const [id, kit] of kits) {
            for (const file of Object.values(kit.samples)) {
                expect(SAMPLE_FAMILY[file], `${id} uses ${file}, which SAMPLE_FAMILY does not describe`)
                    .toBeDefined();
            }
        }
    });

    it('names only files that exist on disk', () => {
        // A missing WAV is a 404 and a silent slot, and nothing else notices.
        for (const [id, kit] of kits) {
            for (const file of new Set(Object.values(kit.samples))) {
                const path = join(__dirname, '..', 'public', kit.baseUrl, file);
                expect(existsSync(path), `${id} names ${kit.baseUrl}${file}, which is not there`).toBe(true);
            }
        }
    });

    it('keys every slot by MIDI number, in General MIDI range', () => {
        for (const [id, kit] of kits) {
            const urls = kitUrls(kit);
            for (const key of Object.keys(urls)) {
                const midi = Number(key);
                expect(Number.isInteger(midi), `${id} has a non-numeric key: ${key}`).toBe(true);
                expect(midi).toBeGreaterThanOrEqual(GM_PERCUSSION_LOW);
                expect(midi).toBeLessThanOrEqual(GM_PERCUSSION_HIGH);
            }
        }
    });

    it('covers what every demo template plays, in every kit', () => {
        // Kick, snare, both hats, clap and rim. If one of these is unmapped it
        // repitches off a neighbour, which is how the kick became a hi-hat.
        const required = ['kick', 'snare', 'closedHat', 'openHat', 'handClap', 'sideStick'] as const;
        for (const [id, kit] of kits) {
            for (const slot of required) {
                expect(kit.samples[slot], `${id} does not map ${slot}`).toBeDefined();
            }
        }
    });
});
