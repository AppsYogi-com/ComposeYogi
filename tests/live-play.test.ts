// ============================================
// ComposeYogi — Play It Live (Sprint 8.7.6)
// ============================================
//
// Three modules' worth of arithmetic, all of it import-free by design, because
// none of it can be reached any other way: Web MIDI does not exist under vitest
// and Tone cannot be constructed there either. What is provable here is which
// note a key plays, which bytes mean what, and what a performance becomes — and
// every bug those can carry is a bug you would otherwise find by ear, once,
// weeks later.
//
// Everything downstream — the voice, the ports, the listeners — cannot be
// verified here: Tone cannot be constructed under vitest, and the headless
// pane refuses Web MIDI. It is verified by measuring in a real browser.
// See CONTRIBUTING.md, "Testing audio".

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
    PITCH_BEND_RANGE_CENTS,
    bendToCents,
    parseMidiMessage,
    velocityToGain,
} from '@/lib/audio/midi-messages';
import { NoteBook } from '@/lib/audio/note-book';
import {
    MIN_NOTE_BEATS,
    clipBarsForNotes,
    closeHeldNotes,
    notesFromPerformance,
    type PerformedNote,
} from '@/lib/audio/midi-take';
import {
    KEYBOARD_HIGH_PITCH,
    KEYBOARD_LOW_PITCH,
    KEY_PRESS_TRAVEL,
    MAX_WHITE_WIDTH,
    RAIL_HEIGHT,
    WHITE_KEY_COUNT,
    keyboardLayout,
} from '@/lib/music/keyboard-layout';
import {
    HIGHEST_PITCH,
    LOWEST_PITCH,
    MIDDLE_C,
    PITCH_OCTAVES,
    isPlayablePitch,
    octaveFirstPitch,
    pitchFrequency,
    pitchName,
    pitchOctave,
} from '@/lib/music/pitch';
import {
    TYPING_KEYS,
    TYPING_OCTAVE_DEFAULT,
    TYPING_OCTAVE_MAX,
    TYPING_OCTAVE_MIN,
    TYPING_SPAN_SEMITONES,
    clampTypingOctave,
    isBlackKey,
    isTypingKey,
    keyForPitch,
    keysForPitch,
    octaveBasePitch,
    pitchForKey,
    typingKeyboard,
} from '@/lib/music/typing-keys';
import { bindingPlaysANote } from '@/hooks/useShortcuts';
import { SHORTCUT_DEFINITIONS } from '@/lib/shortcuts';

// ============================================
// The typing keyboard
// ============================================

describe('the computer keyboard as a piano', () => {
    it('starts each row on C, in scientific pitch notation', () => {
        // Octave 4 means the octave everything else calls 4: `q` is middle C.
        // It used to mean `octave * 12`, so `q` at 4 was MIDI 48 — the app
        // agreed with itself and with nothing else, and the bottom of its range
        // was an octave below what its own labels claimed.
        expect(pitchForKey('z', 4)).toBe(60);
        expect(pitchForKey('q', 4)).toBe(72);
        expect(pitchForKey('q', 3)).toBe(MIDDLE_C);
    });

    it('walks the lower row up a chromatic octave', () => {
        const row = ['z', 's', 'x', 'd', 'c', 'v', 'g', 'b', 'h', 'n', 'j', 'm', ','];
        expect(row.map((key) => pitchForKey(key, 3))).toEqual([
            48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60,
        ]);
    });

    it('walks the upper row up the octave above it', () => {
        const row = ['q', '2', 'w', '3', 'e', 'r', '5', 't', '6', 'y', '7', 'u', 'i'];
        expect(row.map((key) => pitchForKey(key, 3))).toEqual([
            60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72,
        ]);
    });

    it('joins the rows at the same note', () => {
        // `,` closes the lower octave and `q` opens the upper one. They are the
        // same C on purpose — each row reads as a complete C-to-C octave, which
        // is what every tracker and DAW does with this layout.
        expect(pitchForKey(',', 3)).toBe(pitchForKey('q', 3));
    });

    it('puts the black keys on the row above their white neighbours', () => {
        // The gaps matter as much as the keys: there is no black key between E
        // and F, so `f` and `k` play nothing. A layout that filled them in
        // would be a chromatic run, not a keyboard.
        expect(isTypingKey('f')).toBe(false);
        expect(isTypingKey('k')).toBe(false);

        for (const key of ['s', 'd', 'g', 'h', 'j', '2', '3', '5', '6', '7']) {
            expect(isBlackKey(pitchForKey(key, 3) as number), key).toBe(true);
        }
    });

    it('folds case, so a shifted key is the same key', () => {
        expect(pitchForKey('Z', 4)).toBe(pitchForKey('z', 4));
        expect(pitchForKey('W', 4)).toBe(pitchForKey('w', 4));
    });

    it('plays nothing from a key that is not on the layout', () => {
        for (const key of ['a', 'f', 'k', 'o', 'p', '1', '4', '8', 'Escape', ' ', 'Enter']) {
            expect(pitchForKey(key, 3), key).toBeNull();
            expect(isTypingKey(key), key).toBe(false);
        }
    });

    it('shifts by exactly an octave', () => {
        const low = pitchForKey('z', 2) as number;
        const high = pitchForKey('z', 3) as number;
        expect(high - low).toBe(12);
    });
});

describe('the octave range stays inside what the piano roll draws', () => {
    it('never lets the top of the upper row leave the editor', () => {
        // A typed note above B7 would sound, record into a clip, and be
        // invisible in the editor — a silent failure of the exact kind this
        // codebase keeps finding.
        for (let octave = TYPING_OCTAVE_MIN; octave <= TYPING_OCTAVE_MAX; octave++) {
            const top = octaveBasePitch(octave) + TYPING_SPAN_SEMITONES;
            expect(top, `octave ${octave}`).toBeLessThanOrEqual(HIGHEST_PITCH);
        }
    });

    it('never offers a note nobody can hear', () => {
        // The floor was MIDI 12 — C0 at 16.35 Hz, under the bottom of hearing
        // and under what any laptop reproduces — and it was labelled "C1". A
        // working synth got called pathetic for it.
        const lowest = octaveBasePitch(TYPING_OCTAVE_MIN);
        expect(lowest).toBe(LOWEST_PITCH);
        expect(pitchFrequency(lowest)).toBeGreaterThan(30);
        expect(pitchName(lowest)).toBe('C1');
    });

    it('clamps rather than wrapping', () => {
        expect(clampTypingOctave(TYPING_OCTAVE_MIN - 3)).toBe(TYPING_OCTAVE_MIN);
        expect(clampTypingOctave(TYPING_OCTAVE_MAX + 3)).toBe(TYPING_OCTAVE_MAX);
        expect(clampTypingOctave(TYPING_OCTAVE_DEFAULT)).toBe(TYPING_OCTAVE_DEFAULT);
    });

    it('survives a value that is not a number', () => {
        expect(clampTypingOctave(Number.NaN)).toBe(TYPING_OCTAVE_DEFAULT);
        expect(clampTypingOctave(Number.POSITIVE_INFINITY)).toBe(TYPING_OCTAVE_DEFAULT);
        expect(clampTypingOctave(2.4)).toBe(2);
    });

    it('ships a default inside its own range', () => {
        expect(TYPING_OCTAVE_DEFAULT).toBeGreaterThanOrEqual(TYPING_OCTAVE_MIN);
        expect(TYPING_OCTAVE_DEFAULT).toBeLessThanOrEqual(TYPING_OCTAVE_MAX);
    });
});

describe('the drawn keyboard matches the layout', () => {
    it('draws two octaves and the C that closes them', () => {
        const keys = typingKeyboard(3);
        expect(keys).toHaveLength(TYPING_SPAN_SEMITONES + 1);
        expect(keys[0].pitch).toBe(48);
        expect(keys[keys.length - 1].pitch).toBe(72);
    });

    it('draws fifteen white keys and ten black ones', () => {
        const keys = typingKeyboard(3);
        expect(keys.filter((key) => !key.black)).toHaveLength(15);
        expect(keys.filter((key) => key.black)).toHaveLength(10);
    });

    it('lights exactly one key per note', () => {
        // The seam pitch is played by two keys, so a keyboard built naively from
        // the two rows would draw 26 keys with two of them lit by the same note.
        const keys = typingKeyboard(3);
        expect(new Set(keys.map((key) => key.pitch)).size).toBe(keys.length);
    });

    it('agrees with the key that plays each pitch', () => {
        for (const { pitch, key } of typingKeyboard(4)) {
            expect(pitchForKey(key, 4), key).toBe(pitch);
        }
    });

    it('returns no key for a pitch outside the span', () => {
        expect(keyForPitch(octaveBasePitch(3) - 1, 3)).toBeNull();
        expect(keyForPitch(octaveBasePitch(3) + TYPING_SPAN_SEMITONES + 1, 3)).toBeNull();
    });

    it('lists every key exactly once, low to high', () => {
        expect(new Set(TYPING_KEYS).size).toBe(TYPING_KEYS.length);
        expect(TYPING_KEYS).toHaveLength((TYPING_SPAN_SEMITONES + 1) + 1); // both rows' C included
    });
});

// ============================================
// Shortcuts standing down
// ============================================

describe('musical typing takes the letter keys and no others', () => {
    it('recognises a binding that plays a note', () => {
        // The five that actually collide today: R records and plays F, E toggles
        // the editor and plays E, B the browser and G, I the inspector and the
        // top C, V the visualizer and F.
        for (const key of ['r', 'e', 'b', 'i', 'v', 'm', '2']) {
            expect(bindingPlaysANote(key), key).toBe(true);
        }
    });

    it('leaves alone anything the layout does not use', () => {
        // `l` is on this list, which is not what anyone guesses: the lower row
        // is `z s x d c v g b h n j m ,` and the upper is `q 2 w 3 e r 5 t 6 y 7
        // u i`, and `l` is on neither. Toggle Loop goes on working while
        // musical typing is on, and this test is the reason that is a fact
        // rather than a hope.
        for (const key of ['k', 'l', 'a', 'p', 'space', 'enter', 'slash', 'equal', 'minus', 'delete, backspace']) {
            expect(bindingPlaysANote(key), key).toBe(false);
        }
    });

    it('leaves alone anything with a modifier', () => {
        // Nothing plays a note with ⌘ or ⇧ held, so undo, redo and reset-zoom go
        // on working while musical typing is on. If this ever flipped, live
        // playing would silently disable undo.
        for (const key of ['mod+z', 'mod+shift+z', 'mod+0', 'shift+slash']) {
            expect(bindingPlaysANote(key), key).toBe(false);
        }
    });

    it('leaves the live-play toggle itself off the layout', () => {
        // The one shortcut that must survive the mode it switches on. A toggle
        // bound to a note key is a mode that cannot be switched off with the key
        // that switched it on.
        const toggle = SHORTCUT_DEFINITIONS.find((def) => def.id === 'view.toggleLivePlay');
        expect(toggle, 'view.toggleLivePlay is not registered').toBeDefined();
        expect(bindingPlaysANote(toggle!.defaultKey)).toBe(false);
    });
});

// ============================================
// MIDI messages
// ============================================

describe('the keyboard leaves other controls their own keys', () => {
    // A Radix slider's thumb is a `<span role="slider">`, not an `<input>`, so a
    // tag-name check let it through: dragging the velocity slider with the
    // arrow keys shifted the octave instead of the velocity. Everything named
    // here has keys of its own that a note or an octave would swallow.
    //
    // This is the selector the hook uses, asserted here rather than there
    // because the hook needs a DOM. It is a copy, and the only thing holding the
    // two together is that both are one line long and sit under the same name.
    const GUARDED = [
        'slider', 'combobox', 'listbox', 'menu', 'menuitem', 'spinbutton',
        'textbox', 'dialog',
    ];

    it('names every widget the hook guards', () => {
        const hook = readFileSync(
            join(__dirname, '..', 'hooks', 'useLivePlay.ts'),
            'utf8'
        );
        for (const role of GUARDED) {
            expect(hook, `role="${role}" is not guarded`).toContain(`[role="${role}"]`);
        }
    });

    it('still guards the fields it always did', () => {
        const hook = readFileSync(
            join(__dirname, '..', 'hooks', 'useLivePlay.ts'),
            'utf8'
        );
        for (const tag of ['INPUT', 'TEXTAREA', 'SELECT']) {
            expect(hook).toContain(`'${tag}'`);
        }
        expect(hook).toContain('isContentEditable');
    });
});

describe('MIDI messages become notes', () => {
    it('reads a note-on', () => {
        expect(parseMidiMessage([0x90, 60, 100])).toEqual({
            kind: 'noteOn',
            channel: 0,
            pitch: 60,
            velocity: 100,
        });
    });

    it('reads a note-off', () => {
        expect(parseMidiMessage([0x80, 60, 0])).toMatchObject({ kind: 'noteOff', pitch: 60 });
    });

    it('reads a note-on with velocity 0 as a note-off', () => {
        // The whole reason this module exists. Keyboards using running status
        // send this for *every* key release, and reading it as a note-on means
        // every note played hangs until the page is reloaded.
        expect(parseMidiMessage([0x90, 60, 0])).toMatchObject({ kind: 'noteOff', pitch: 60 });
    });

    it('keeps the channel without filtering on it', () => {
        expect(parseMidiMessage([0x95, 60, 100])).toMatchObject({ kind: 'noteOn', channel: 5 });
        expect(parseMidiMessage([0x9f, 60, 100])).toMatchObject({ channel: 15 });
    });

    it('ignores system real-time messages', () => {
        // A keyboard emits MIDI clock at 24 pulses per quarter note from the
        // moment it is plugged in, and Active Sensing at about 3 Hz. Both are
        // one byte long and neither is a note.
        for (const status of [0xf0, 0xf8, 0xfa, 0xfc, 0xfe, 0xff]) {
            expect(parseMidiMessage([status, 60, 100]), status.toString(16)).toBeNull();
        }
    });

    it('ignores the channel messages this app has no use for', () => {
        // Aftertouch (0xA0), program change (0xC0) and channel pressure (0xD0).
        // Control change and pitch bend are handled — see below.
        for (const status of [0xa0, 0xc0, 0xd0]) {
            expect(parseMidiMessage([status, 64, 127]), status.toString(16)).toBeNull();
        }
    });

    it('ignores a controller it does not map', () => {
        // Mod wheel, expression, channel volume. Read and dropped rather than
        // wired to something arbitrary — a mod wheel that silently moved the
        // filter would be a surprise nobody asked for.
        for (const controller of [1, 7, 11, 74]) {
            expect(parseMidiMessage([0xb0, controller, 127]), String(controller)).toBeNull();
        }
    });

    it('rejects a message that is not a message', () => {
        expect(parseMidiMessage(null)).toBeNull();
        expect(parseMidiMessage(undefined)).toBeNull();
        expect(parseMidiMessage([])).toBeNull();
        expect(parseMidiMessage([0x90])).toBeNull();
        expect(parseMidiMessage([0x90, 60])).toBeNull();
        // A data byte where a status byte should be — the caller handed us the
        // middle of a message.
        expect(parseMidiMessage([0x40, 60, 100])).toBeNull();
    });

    it('rejects data bytes with the top bit set rather than clamping them', () => {
        // Clamping would invent a note nobody played, at a pitch nobody chose.
        expect(parseMidiMessage([0x90, 200, 100])).toBeNull();
        expect(parseMidiMessage([0x90, 60, 200])).toBeNull();
    });

    it('reads real Uint8Array data, not only arrays', () => {
        expect(parseMidiMessage(new Uint8Array([0x90, 64, 96]))).toMatchObject({
            kind: 'noteOn',
            pitch: 64,
            velocity: 96,
        });
    });
});

describe('the sustain pedal', () => {
    it('is down at 64 and up below it', () => {
        // A continuous pedal sweeps rather than switching, so "any non-zero is
        // down" means a pedal resting at 12 latches every note played. 64 is
        // the convention.
        expect(parseMidiMessage([0xb0, 64, 127])).toEqual({ kind: 'sustain', channel: 0, down: true });
        expect(parseMidiMessage([0xb0, 64, 64])).toMatchObject({ kind: 'sustain', down: true });
        expect(parseMidiMessage([0xb0, 64, 63])).toMatchObject({ kind: 'sustain', down: false });
        expect(parseMidiMessage([0xb0, 64, 0])).toMatchObject({ kind: 'sustain', down: false });
    });

    it('keeps its channel', () => {
        expect(parseMidiMessage([0xb9, 64, 127])).toMatchObject({ kind: 'sustain', channel: 9 });
    });
});

describe('the panic controllers', () => {
    it('reads all three as the same thing', () => {
        // All Sound Off, Reset All Controllers, All Notes Off. Their differences
        // matter to a synth with per-voice release curves; here they all mean
        // "the keyboard says stop", which is what a panic button sends.
        for (const controller of [120, 121, 123]) {
            expect(parseMidiMessage([0xb0, controller, 0]), String(controller))
                .toEqual({ kind: 'allNotesOff', channel: 0 });
        }
    });
});

describe('pitch bend', () => {
    it('centres at zero', () => {
        // 8192, little end first: LSB 0, MSB 64.
        expect(parseMidiMessage([0xe0, 0, 64])).toEqual({ kind: 'pitchBend', channel: 0, bend: 0 });
    });

    it('reaches exactly one at both extremes', () => {
        // The halves are asymmetric — 0 is 8192 below centre and 16383 is 8191
        // above — so a single divisor leaves one end short of full deflection.
        expect(parseMidiMessage([0xe0, 0, 0])).toMatchObject({ bend: -1 });
        expect(parseMidiMessage([0xe0, 127, 127])).toMatchObject({ bend: 1 });
    });

    it('reads the fourteen bits in the right order', () => {
        // LSB-first. Swapping the bytes still centres correctly, which is why
        // this case uses a value that is not symmetric.
        const half = parseMidiMessage([0xe0, 0, 96]);
        expect(half).toMatchObject({ kind: 'pitchBend' });
        expect((half as { bend: number }).bend).toBeCloseTo(4096 / 8191, 5);
    });

    it('rejects a malformed bend rather than inventing one', () => {
        expect(parseMidiMessage([0xe0, 200, 64])).toBeNull();
        expect(parseMidiMessage([0xe0, 0])).toBeNull();
    });

    it('converts to cents against the General MIDI default range', () => {
        // Two semitones each way is what a keyboard assumes unless told
        // otherwise over RPN, which this app does not send.
        expect(bendToCents(0)).toBe(0);
        expect(bendToCents(1)).toBe(PITCH_BEND_RANGE_CENTS);
        expect(bendToCents(-1)).toBe(-PITCH_BEND_RANGE_CENTS);
        expect(bendToCents(0.5)).toBe(PITCH_BEND_RANGE_CENTS / 2);
    });

    it('clamps a bend outside the range', () => {
        expect(bendToCents(4)).toBe(PITCH_BEND_RANGE_CENTS);
        expect(bendToCents(-4)).toBe(-PITCH_BEND_RANGE_CENTS);
    });
});

describe('velocity becomes gain', () => {
    it('maps the range the way the scheduler does', () => {
        expect(velocityToGain(127)).toBe(1);
        expect(velocityToGain(0)).toBe(0);
        expect(velocityToGain(64)).toBeCloseTo(64 / 127, 10);
    });

    it('never turns the quietest playable note into silence', () => {
        expect(velocityToGain(1)).toBeGreaterThan(0);
    });

    it('clamps rather than exceeding unity', () => {
        expect(velocityToGain(200)).toBe(1);
        expect(velocityToGain(-5)).toBe(0);
    });
});

// ============================================
// What should be sounding
// ============================================
//
// Every case here is a stuck note if it is wrong, and a stuck note is the one
// bug in this feature a user cannot work around without reloading the page.

describe('keys, the pedal, and what actually stops a note', () => {
    it('attacks a key going down and releases it coming up', () => {
        const book = new NoteBook();
        expect(book.press(60)).toEqual({ attack: [60], release: [] });
        expect(book.sounding()).toEqual([60]);
        expect(book.release(60)).toEqual({ attack: [], release: [60] });
        expect(book.sounding()).toEqual([]);
    });

    it('does not re-attack a key that is already down', () => {
        // Key repeat fires at ~30 Hz, and a sticky MIDI key does the same. A
        // synth re-attacked thirty times a second is a buzz, not a note.
        const book = new NoteBook();
        book.press(60);
        expect(book.press(60)).toEqual({ attack: [], release: [] });
        expect(book.sounding()).toEqual([60]);
    });

    it('ignores the release of a key that was never down', () => {
        const book = new NoteBook();
        expect(book.release(60)).toEqual({ attack: [], release: [] });
    });

    it('keeps press order, because a monophonic voice needs it', () => {
        // Hold C, add E, release C — the E has to keep sounding. Releasing on
        // any key-up, which is what a Set forces, cuts the note still held.
        //
        // Three notes, not two: with two, a reversed order and the right one
        // give the same answer after a release, and the test passes on both.
        const book = new NoteBook();
        book.press(60);
        book.press(64);
        book.press(67);
        expect(book.heldKeys()).toEqual([60, 64, 67]);

        book.release(64);
        expect(book.heldKeys()).toEqual([60, 67]);

        // The monophonic fallback re-attacks the *last* of what is left.
        expect(book.heldKeys()[book.heldKeys().length - 1]).toBe(67);
    });

    it('holds a note released under the pedal, and lets it go when the pedal lifts', () => {
        const book = new NoteBook();
        book.press(60);
        book.setPedal(true);
        expect(book.release(60)).toEqual({ attack: [], release: [] });
        expect(book.sounding()).toEqual([60]);

        expect(book.setPedal(false)).toEqual({ attack: [], release: [60] });
        expect(book.sounding()).toEqual([]);
    });

    it('keeps a key that is still down when the pedal lifts', () => {
        // The one that is easy to get wrong: lifting the pedal releases what the
        // pedal was holding, not everything.
        const book = new NoteBook();
        book.press(60);
        book.press(64);
        book.setPedal(true);
        book.release(60);

        expect(book.setPedal(false)).toEqual({ attack: [], release: [60] });
        expect(book.sounding()).toEqual([64]);
    });

    it('takes a re-pressed note back off the pedal', () => {
        // Press, pedal, release: the pedal is holding it. Press again and it is
        // a live key once more — which matters because a monophonic voice reads
        // `heldKeys`, and because the note must not be counted twice.
        const book = new NoteBook();
        book.press(60);
        book.setPedal(true);
        book.release(60);
        expect(book.heldKeys()).toEqual([]);

        expect(book.press(60)).toEqual({ attack: [60], release: [] });
        expect(book.heldKeys()).toEqual([60]);
        expect(book.sounding()).toEqual([60]);
    });

    it('pressing the pedal is not audible on its own', () => {
        const book = new NoteBook();
        book.press(60);
        expect(book.setPedal(true)).toEqual({ attack: [], release: [] });
        expect(book.sounding()).toEqual([60]);
    });

    it('survives a repeated pedal message in either direction', () => {
        // A continuous pedal streams CC 64 values the whole time it is held, so
        // the same boolean arrives over and over. Both directions have to be
        // idempotent — the second `down` must not re-run the lift, and the
        // second `up` must not release a note the first one already released.
        const book = new NoteBook();
        book.press(60);
        book.setPedal(true);
        book.release(60);

        expect(book.setPedal(true)).toEqual({ attack: [], release: [] });
        expect(book.sounding()).toEqual([60]);

        expect(book.setPedal(false)).toEqual({ attack: [], release: [60] });
        expect(book.setPedal(false)).toEqual({ attack: [], release: [] });
        expect(book.sounding()).toEqual([]);
    });

    it('never reports the same pitch twice', () => {
        // `sounding()` is the union of two sets that must stay disjoint. If
        // `press` ever stops taking a pitch off the pedal, this is where it
        // shows: the note is counted twice, and the on-screen keyboard lights a
        // key that a second entry then keeps lit after it is released.
        const book = new NoteBook();
        book.setPedal(true);
        book.press(60);
        book.release(60);
        book.press(60);

        const sounding = book.sounding();
        expect(sounding).toEqual([60]);
        expect(new Set(sounding).size).toBe(sounding.length);
    });

    it('does not release a note whose key is still down when the pedal lifts', () => {
        // Press, pedal, release, press again: the second press takes the note
        // off the pedal, so lifting the pedal must leave it alone — the key is
        // still down. Without that, the note dies under the player's finger.
        const book = new NoteBook();
        book.press(60);
        book.setPedal(true);
        book.release(60);
        book.press(60);

        expect(book.setPedal(false)).toEqual({ attack: [], release: [] });
        expect(book.sounding()).toEqual([60]);
    });

    it('clears everything, pedal included', () => {
        // A panic is reached from a stuck note or a lost keyup. Leaving a
        // latched pedal behind means the next note played sticks as well.
        const book = new NoteBook();
        book.press(60);
        book.press(64);
        book.setPedal(true);
        book.release(60);

        const cleared = book.clear();
        expect(cleared.release.slice().sort((a, b) => a - b)).toEqual([60, 64]);
        expect(book.sounding()).toEqual([]);
        expect(book.isPedalDown()).toBe(false);
    });
});

// ============================================
// A performance becomes a clip
// ============================================

const at = (pitch: number, start: number, end: number | null, velocity = 100): PerformedNote => ({
    pitch,
    velocity,
    startSeconds: start,
    endSeconds: end,
});

describe('a performance becomes notes', () => {
    // 120 BPM: one beat is half a second, so every number below is readable.
    const BPM = 120;

    it('places a note where it was played, relative to the take', () => {
        const notes = notesFromPerformance([at(60, 4.5, 5.0)], 4, BPM);
        expect(notes).toEqual([
            { pitch: 60, startBeat: 1, duration: 1, velocity: 100 },
        ]);
    });

    it('does not quantize', () => {
        // A performance is a performance. Snapping it would be an edit the app
        // has no quantize command to undo, and the north star is that what you
        // played is what you get.
        const [note] = notesFromPerformance([at(60, 4.13, 4.61)], 4, BPM);
        expect(note.startBeat).toBeCloseTo(0.26, 10);
        expect(note.duration).toBeCloseTo(0.96, 10);
    });

    it('drops a note that is still held', () => {
        // Not lost — `closeHeldNotes` is what stops that, and it runs first.
        // This only says that an unterminated note has no duration to store.
        expect(notesFromPerformance([at(60, 4, null)], 4, BPM)).toEqual([]);
    });

    it('keeps a note held past the end of the take', () => {
        const closed = closeHeldNotes([at(60, 4, null), at(64, 4, 4.5)], 6);
        expect(closed[0].endSeconds).toBe(6);
        // A note that already ended is left exactly as it was.
        expect(closed[1].endSeconds).toBe(4.5);

        const notes = notesFromPerformance(closed, 4, BPM);
        expect(notes).toHaveLength(2);
        expect(notes.find((note) => note.pitch === 60)?.duration).toBe(4);
    });

    it('gives a staccato hit a length it can be seen and heard at', () => {
        // Pressed and released inside one frame. Without a floor this is a
        // zero-length note: undrawable by the piano roll and untriggerable by
        // the scheduler.
        const [note] = notesFromPerformance([at(60, 4, 4.0001)], 4, BPM);
        expect(note.duration).toBe(MIN_NOTE_BEATS);
        expect(note.duration).toBeGreaterThan(0);
    });

    it('pulls a note played during the count-in to the top of the clip', () => {
        const [note] = notesFromPerformance([at(60, 3.5, 4.5)], 4, BPM);
        expect(note.startBeat).toBe(0);
    });

    it('keeps velocity as played, and never at zero', () => {
        const notes = notesFromPerformance(
            [at(60, 4, 4.5, 1), at(62, 4, 4.5, 127), at(64, 4, 4.5, 0)],
            4,
            BPM
        );
        expect(notes.map((note) => note.velocity)).toEqual([1, 127, 1]);
    });

    it('sorts by time, then by pitch', () => {
        const notes = notesFromPerformance(
            [at(67, 5, 5.5), at(60, 4, 4.5), at(64, 4, 4.5)],
            4,
            BPM
        );
        expect(notes.map((note) => note.pitch)).toEqual([60, 64, 67]);
    });

    it('scales with tempo', () => {
        // The same half-second note is one beat at 120 and two at 240.
        expect(notesFromPerformance([at(60, 0, 0.5)], 0, 120)[0].duration).toBe(1);
        expect(notesFromPerformance([at(60, 0, 0.5)], 0, 240)[0].duration).toBe(2);
    });

    it('refuses to divide by a tempo that is not one', () => {
        for (const bpm of [0, -120, Number.NaN, Number.POSITIVE_INFINITY]) {
            expect(notesFromPerformance([at(60, 4, 4.5)], 4, bpm), String(bpm)).toEqual([]);
        }
    });

    it('produces nothing from nothing', () => {
        expect(notesFromPerformance([], 4, BPM)).toEqual([]);
    });
});

describe('the clip is long enough to hold what was played', () => {
    it('rounds up to whole bars', () => {
        expect(clipBarsForNotes([{ pitch: 60, startBeat: 0, duration: 1, velocity: 100 }], 4)).toBe(1);
        expect(clipBarsForNotes([{ pitch: 60, startBeat: 4, duration: 1, velocity: 100 }], 4)).toBe(2);
        expect(clipBarsForNotes([{ pitch: 60, startBeat: 7, duration: 2, velocity: 100 }], 4)).toBe(3);
    });

    it('measures the end of a note, not its start', () => {
        // A held final chord has to fit inside the clip, or the arrangement
        // draws a clip shorter than the sound it makes.
        expect(clipBarsForNotes([{ pitch: 60, startBeat: 0, duration: 9, velocity: 100 }], 4)).toBe(3);
    });

    it('is never shorter than a bar', () => {
        expect(clipBarsForNotes([], 4)).toBe(1);
        expect(clipBarsForNotes([{ pitch: 60, startBeat: 0, duration: 0.01, velocity: 100 }], 4)).toBe(1);
    });

    it('follows the time signature', () => {
        const notes = [{ pitch: 60, startBeat: 0, duration: 4, velocity: 100 }];
        expect(clipBarsForNotes(notes, 4)).toBe(1);
        expect(clipBarsForNotes(notes, 3)).toBe(2);
    });

    it('survives a time signature that is not one', () => {
        expect(clipBarsForNotes([{ pitch: 60, startBeat: 0, duration: 4, velocity: 100 }], 0)).toBe(1);
    });
});

// ============================================
// The drawn keyboard
// ============================================
//
// The component that renders this cannot be tested at all — it needs a layout
// engine and a ResizeObserver — so the arithmetic was pulled out into
// `keyboard-layout.ts` and every rule about how the keyboard looks lives here.
// Three of these are the bugs the first version actually shipped: it drew 25
// keys at any width, it had no slack in the block axis, and it named no
// relationship between what is drawn and what the letters reach.

describe('the keyboard is a fixed instrument', () => {
    // This is the whole design, and three versions got it wrong. Shifting the
    // octave used to move the lit block *and* slide the drawn range under it, by
    // a different amount, and at the ends by no amount at all — so every octave
    // change was a different animation and the thing read as broken. A real
    // keyboard does not move when you transpose.
    const OCTAVES = [1, 2, 3, 4, 5];
    const WIDTHS = [320, 480, 700, 916, 1012, 1280, 1500, 1900, 2400, 6000];

    it('draws the same keys wherever the octave is', () => {
        for (const width of WIDTHS) {
            const first = keyboardLayout(OCTAVES[0], width);
            for (const octave of OCTAVES) {
                const other = keyboardLayout(octave, width);
                expect(
                    other.keys.map((key) => key.pitch),
                    `octave ${octave} at ${width}px draws different keys`
                ).toEqual(first.keys.map((key) => key.pitch));
            }
        }
    });

    it('never moves a key when the octave changes', () => {
        // The one that matters. Not just the same keys — the same geometry, so
        // React re-renders the same buttons in the same places and there is no
        // reflow to see.
        for (const width of WIDTHS) {
            const first = keyboardLayout(OCTAVES[0], width);
            for (const octave of OCTAVES) {
                const other = keyboardLayout(octave, width);
                expect(other.offsetX, `offsetX moved at octave ${octave}`).toBe(first.offsetX);
                expect(other.width).toBe(first.width);
                expect(other.height).toBe(first.height);
                for (let i = 0; i < first.keys.length; i++) {
                    expect(
                        [other.keys[i].x, other.keys[i].width, other.keys[i].height],
                        `key ${first.keys[i].pitch} moved at octave ${octave}, ${width}px`
                    ).toEqual([first.keys[i].x, first.keys[i].width, first.keys[i].height]);
                }
            }
        }
    });

    it('is a 73-key board, C1 to C7', () => {
        const layout = keyboardLayout(TYPING_OCTAVE_DEFAULT, 1012);
        expect(layout.keys[0].pitch).toBe(KEYBOARD_LOW_PITCH);
        expect(layout.keys[layout.keys.length - 1].pitch).toBe(KEYBOARD_HIGH_PITCH);
        expect(pitchName(KEYBOARD_LOW_PITCH)).toBe('C1');
        expect(pitchName(KEYBOARD_HIGH_PITCH)).toBe('C7');
        expect(layout.keys.filter((key) => !key.black)).toHaveLength(WHITE_KEY_COUNT);
        expect(layout.keys).toHaveLength(73);
    });

    it('is sized to hold the window, not the other way round', () => {
        // The board grew to fit the octave range; the range was never cut to fit
        // the board. It was, once — a 36-key board needed octaves 1–4, and the
        // top octave silently disappeared. Asserted as **equality**, not "fits":
        // the board is exactly the window's full travel, so narrowing either end
        // fails here rather than quietly removing notes anyone can play.
        //
        // There was a `windowFitsBoard()` helper in the module saying this. It
        // asserted `<=` where this asserts `===`, nothing in the app called it,
        // and mutation testing showed it could return a constant `true` without
        // a single test noticing — a guard that guards nothing, which is
        // `note-book.ts`'s two dead filters again.
        expect(TYPING_OCTAVE_MIN).toBe(1);
        expect(TYPING_OCTAVE_MAX).toBe(5);
        expect(octaveBasePitch(TYPING_OCTAVE_MAX) + TYPING_SPAN_SEMITONES)
            .toBe(KEYBOARD_HIGH_PITCH);
        expect(octaveBasePitch(TYPING_OCTAVE_MIN)).toBe(KEYBOARD_LOW_PITCH);
    });

    it('spends a wider bar on bigger keys, never on more of them', () => {
        const narrow = keyboardLayout(TYPING_OCTAVE_DEFAULT, 700);
        const wide = keyboardLayout(TYPING_OCTAVE_DEFAULT, 1500);
        expect(wide.keys.length).toBe(narrow.keys.length);
        expect(wide.whiteWidth).toBeGreaterThan(narrow.whiteWidth);
    });

    it('stops growing and turns the rest into margin', () => {
        // Both reference keyboards are fixed boards centred on their page.
        const huge = keyboardLayout(TYPING_OCTAVE_DEFAULT, 6000);
        expect(huge.whiteWidth).toBe(MAX_WHITE_WIDTH);
        expect(huge.width).toBeLessThan(6000);
        expect(huge.offsetX).toBeGreaterThan(100);
    });

    it('fits inside the width it was given', () => {
        for (const width of WIDTHS) {
            const fitted = keyboardLayout(TYPING_OCTAVE_DEFAULT, width);
            expect(fitted.width, `${width}px`).toBeLessThanOrEqual(width);
            expect(fitted.offsetX * 2 + fitted.width).toBeLessThanOrEqual(width + 1);
        }
    });

    it('survives a width it cannot honour', () => {
        for (const width of [0, 1, Number.NaN, -50]) {
            const fitted = keyboardLayout(TYPING_OCTAVE_DEFAULT, width);
            expect(fitted.keys).toHaveLength(73);
            expect(fitted.whiteWidth).toBeGreaterThanOrEqual(1);
        }
    });
});

describe('only the highlight moves', () => {
    const OCTAVES = [1, 2, 3, 4, 5];

    it('prints a letter on exactly the twenty-five keys that have one', () => {
        for (const octave of OCTAVES) {
            const layout = keyboardLayout(octave, 1012);
            const lettered = layout.keys.filter((key) => key.typed.length > 0);
            expect(lettered.length, `octave ${octave}`).toBe(25);
            for (const key of lettered) {
                expect(key.typed).toEqual(keysForPitch(key.pitch, octave));
            }
        }
    });

    it('lights exactly the keys the letters reach', () => {
        for (const octave of OCTAVES) {
            for (const key of keyboardLayout(octave, 1012).keys) {
                expect(key.inWindow, `${key.pitch} at octave ${octave}`)
                    .toBe(key.typed.length > 0);
            }
        }
    });

    it('slides the rail by exactly one octave per step', () => {
        // What the eye should see: the lit block moves one octave, over keys
        // that have not moved at all.
        const layouts = OCTAVES.map((octave) => keyboardLayout(octave, 1012));
        for (let i = 1; i < layouts.length; i++) {
            expect(layouts[i].windowX - layouts[i - 1].windowX)
                .toBe(7 * layouts[i].whiteWidth);
            expect(layouts[i].windowWidth).toBe(layouts[0].windowWidth);
        }
    });

    it('draws the rail across exactly the lit keys', () => {
        for (const octave of OCTAVES) {
            const layout = keyboardLayout(octave, 1012);
            const lit = layout.keys.filter((key) => key.inWindow && !key.black);
            const first = lit[0];
            const last = lit[lit.length - 1];
            expect(layout.windowX, `octave ${octave}`).toBe(first.x);
            expect(layout.windowX + layout.windowWidth).toBe(last.x + last.width);
        }
    });
});

describe('the keyboard is drawn like a keyboard', () => {
    const layout = keyboardLayout(TYPING_OCTAVE_DEFAULT, 1012);

    it('starts and ends on a white key', () => {
        expect(layout.keys[0].black).toBe(false);
        expect(layout.keys[layout.keys.length - 1].black).toBe(false);
    });

    it('sits every black key on the seam between two whites', () => {
        // The single most visible thing a drawn piano can get wrong, and the
        // reason the layout counts white keys rather than dividing by twelve.
        const whites = layout.keys.filter((key) => !key.black);
        const seams = new Set(whites.slice(1).map((key) => key.x));
        for (const black of layout.keys.filter((key) => key.black)) {
            expect(seams.has(black.x + black.width / 2), `${black.pitch} is off its seam`).toBe(true);
        }
    });

    it("holds a real piano's proportions", () => {
        const white = layout.keys.find((key) => !key.black)!;
        const black = layout.keys.find((key) => key.black)!;
        // 13.7mm on 23mm, and 62% of the length.
        expect(black.width / white.width).toBeCloseTo(13.7 / 23, 1);
        expect(black.height / white.height).toBeCloseTo(0.62, 1);
    });

    it('never overlaps two white keys', () => {
        const whites = layout.keys.filter((key) => !key.black);
        for (let i = 1; i < whites.length; i++) {
            expect(whites[i].x).toBe(whites[i - 1].x + whites[i - 1].width);
        }
    });

    it('names every white key, and only the C carries its octave', () => {
        // Both reference keyboards label every white key. Labelling only the Cs
        // makes the player count up from a key half a screen away.
        for (const key of layout.keys) {
            if (key.black) {
                expect(key.label).toBeNull();
            } else if (key.pitch % 12 === 0) {
                expect(key.label).toBe(pitchName(key.pitch));
                expect(key.label).toMatch(/^C\d$/);
            } else {
                expect(key.label).toBe(pitchName(key.pitch).slice(0, -1));
                expect(key.label).toMatch(/^[A-G]$/);
            }
        }
    });

    it('draws keys a piano would recognise the shape of', () => {
        // musicca.com is 5.1 : 1 and virtualpiano.net is 6.0 : 1. This one is a
        // strip docked under an arrangement, so it does not go that far — but
        // 3 : 1 is a tile, which is what "its height is small" meant.
        // The aspect is a floor, so it can only err tall — a real piano is
        // 6.5 : 1 and both references sit between 5 and 6.
        for (const width of [900, 1012, 1400, 2400, 6000]) {
            const fitted = keyboardLayout(TYPING_OCTAVE_DEFAULT, width);
            const white = fitted.keys.find((key) => !key.black)!;
            const aspect = white.height / white.width;
            expect(aspect, `${width}px too short`).toBeGreaterThan(4.4);
            // Never thinner than a real piano. A height floor alone breaks this:
            // held at 150px on a 20px key it is 7.5 : 1, which no keyboard ever
            // built looks like.
            expect(aspect, `${width}px too thin`).toBeLessThanOrEqual(6.6);
        }
    });

    it('keeps the keys tall even when the board is 36 keys wide', () => {
        // The aspect alone is not enough. A fixed 36-key board on a 1512px
        // laptop gives 28px keys, and 28 x 4.6 is 129 — shorter than the version
        // this replaced, which is the wrong direction when the complaint was
        // that the keys were stubby. The floor is what holds it, and without
        // this test nothing did: the aspect check passes either way.
        const laptop = keyboardLayout(TYPING_OCTAVE_DEFAULT, 1012);
        expect(laptop.whiteWidth).toBe(23);
        expect(laptop.whiteHeight).toBeGreaterThanOrEqual(145);

        // And it stops, so the bar cannot eat the arrangement on a big screen.
        expect(keyboardLayout(TYPING_OCTAVE_DEFAULT, 6000).whiteHeight).toBeLessThanOrEqual(175);
    });

    it('reserves room for a pressed key to sink into', () => {
        // A box sized to exactly the key height has no slack in the block axis,
        // and `overflow-x: auto` forces `overflow-y: auto` with it — so one
        // pixel of overflow raised a scrollbar that narrowed the box and
        // re-centred the keyboard mid-click. That was the reported layout shift.
        expect(KEY_PRESS_TRAVEL).toBeGreaterThan(0);
        for (const width of [400, 1000, 2400]) {
            const fitted = keyboardLayout(TYPING_OCTAVE_DEFAULT, width);
            expect(fitted.height, `${width}px`)
                .toBe(RAIL_HEIGHT + fitted.whiteHeight + KEY_PRESS_TRAVEL);
        }
    });
});

describe('the seam is the one key two letters play', () => {
    it('gives the C between the rows both of them', () => {
        // `,` closes the lower row and `q` opens the upper one on the same note.
        // Printing only `,` there says the upper row starts an octave higher
        // than it does.
        expect(keysForPitch(octaveBasePitch(3) + 12, 3)).toEqual([',', 'q']);
    });

    it('gives every other key exactly one', () => {
        const base = octaveBasePitch(3);
        for (let offset = 0; offset <= TYPING_SPAN_SEMITONES; offset++) {
            if (offset === 12) continue;
            expect(keysForPitch(base + offset, 3), `offset ${offset}`).toHaveLength(1);
        }
    });

    it('gives a key outside the window none', () => {
        const base = octaveBasePitch(3);
        expect(keysForPitch(base - 1, 3)).toEqual([]);
        expect(keysForPitch(base + TYPING_SPAN_SEMITONES + 1, 3)).toEqual([]);
    });

    it('agrees with keyForPitch on which letter comes first', () => {
        const base = octaveBasePitch(3);
        for (let offset = 0; offset <= TYPING_SPAN_SEMITONES; offset++) {
            expect(keysForPitch(base + offset, 3)[0]).toBe(keyForPitch(base + offset, 3));
        }
    });
});
