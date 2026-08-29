// ============================================
// ComposeYogi — Clip Macro Tests
// ============================================
//
// Two properties matter more than the individual numbers here.
//
// Neutrality: a clip nobody has touched must schedule exactly what it did
// before macros existed. Every project already saved on someone's machine
// holds the default values, so a non-neutral default would silently re-mix
// their work the moment they opened it.
//
// Determinism: humanize has to sound random and be anything but. The audio
// engine's one promise is that an export matches the playback it was approved
// from, and a Math.random() in the schedule path would quietly break it —
// including between two exports of the same project.

import { describe, expect, it } from 'vitest';

import {
    MACRO_NEUTRAL,
    energyVelocityScale,
    hashUnitInterval,
    humanizeOffset,
    humanizeSeed,
    isNeutral,
    readClipMacros,
    resolveVelocity,
    spaceSpec,
    effectiveGroove,
    swingDelayBeats,
    toneFilterSpec,
    toneTilt,
    transposedPitch,
} from '@/lib/audio/clip-macros';
import { planClipNotes } from '@/lib/audio/scheduler';

import { makeClip, makeNote } from './fixtures';

// ============================================
// Neutrality
// ============================================

describe('neutral defaults', () => {
    it('treats a clip that predates macros as neutral', () => {
        // Clips saved before the fields existed carry none of them.
        const bare = makeClip();
        delete bare.energy;
        delete bare.groove;

        expect(isNeutral(readClipMacros(bare))).toBe(true);
    });

    it('treats a clip holding the defaults as neutral', () => {
        expect(isNeutral(readClipMacros(makeClip({ ...MACRO_NEUTRAL })))).toBe(true);
    });

    it('changes nothing about a note at neutral', () => {
        const clip = makeClip({ ...MACRO_NEUTRAL, notes: [makeNote({ startBeat: 1.25 })] });
        const [planned] = planClipNotes(clip, 4, 120, 0);

        expect(planned.pitch).toBe(60);
        expect(planned.timeSeconds).toBeCloseTo(4 + 0.625, 10);
        expect(planned.velocity).toBeCloseTo(100 / 127, 10);
    });

    it('asks for no DSP at neutral', () => {
        expect(toneFilterSpec(toneTilt(MACRO_NEUTRAL.brightness, MACRO_NEUTRAL.energy))).toBeNull();
        expect(spaceSpec(MACRO_NEUTRAL.space)).toBeNull();
    });

    it('notices any single macro leaving neutral', () => {
        for (const key of Object.keys(MACRO_NEUTRAL) as (keyof typeof MACRO_NEUTRAL)[]) {
            const moved = { ...MACRO_NEUTRAL, [key]: MACRO_NEUTRAL[key] + 1 };
            expect(isNeutral(moved), `${key} moved but isNeutral still said yes`).toBe(false);
        }
    });
});

// ============================================
// Energy
// ============================================

describe('energy', () => {
    it('leaves velocity alone at the centre', () => {
        expect(energyVelocityScale(50)).toBe(1);
    });

    it('halves at the bottom and adds half again at the top', () => {
        expect(energyVelocityScale(0)).toBe(0.5);
        expect(energyVelocityScale(100)).toBe(1.5);
    });

    it('rises without a step anywhere', () => {
        let previous = energyVelocityScale(0);
        for (let e = 1; e <= 100; e++) {
            const next = energyVelocityScale(e);
            expect(next).toBeGreaterThan(previous);
            previous = next;
        }
    });

    it('opens the tone as well as hitting harder', () => {
        // The whole point of a macro: one slider, several changes.
        expect(toneTilt(50, 100)).toBeGreaterThan(0);
        expect(toneTilt(50, 0)).toBeLessThan(0);
    });

    it('never pushes a note past the top or bottom of the MIDI range', () => {
        expect(resolveVelocity(127, energyVelocityScale(100), 20)).toBe(127);
        // A part turned all the way down is still a part: velocity 0 is a
        // note-off, so the floor is 1.
        expect(resolveVelocity(1, energyVelocityScale(0), -20)).toBe(1);
    });
});

// ============================================
// Brightness
// ============================================

describe('brightness', () => {
    it('darkens with a lowpass and brightens with a shelf', () => {
        expect(toneFilterSpec(toneTilt(0, 50))?.type).toBe('lowpass');
        expect(toneFilterSpec(toneTilt(100, 50))?.type).toBe('highshelf');
    });

    it('closes the lowpass further the darker it gets', () => {
        const dark = toneFilterSpec(toneTilt(0, 50))!;
        const lessDark = toneFilterSpec(toneTilt(25, 50))!;
        expect(dark.frequency).toBeLessThan(lessDark.frequency);
        expect(dark.frequency).toBeGreaterThan(20); // still audible, not shut
    });

    it('sweeps by ear, not by number', () => {
        // Halfway down the slider should land near the geometric middle of the
        // sweep, not the arithmetic one — pitch is logarithmic, and a linear
        // sweep spends most of its travel in the top octave where little lives.
        const full = toneFilterSpec(toneTilt(0, 50))!.frequency;
        const half = toneFilterSpec(toneTilt(25, 50))!.frequency;
        expect(half).toBeCloseTo(Math.sqrt(full * 20000), 0);
    });

    it('lifts the shelf further the brighter it gets', () => {
        expect(toneFilterSpec(toneTilt(100, 50))!.gain)
            .toBeGreaterThan(toneFilterSpec(toneTilt(75, 50))!.gain);
    });

    it('builds one filter for two macros, not two', () => {
        // Energy and brightness both colour the tone; stacking a filter each
        // would colour the signal twice for one musical intention.
        expect(toneFilterSpec(toneTilt(20, 20))).not.toBeNull();
        expect(toneTilt(20, 20)).toBeGreaterThanOrEqual(-50);
    });

    it('stays inside the tilt range however the two macros combine', () => {
        for (const brightness of [0, 25, 50, 75, 100]) {
            for (const energy of [0, 25, 50, 75, 100]) {
                const tilt = toneTilt(brightness, energy);
                expect(tilt).toBeGreaterThanOrEqual(-50);
                expect(tilt).toBeLessThanOrEqual(50);
            }
        }
    });
});

// ============================================
// Space
// ============================================

describe('space', () => {
    it('is dry at zero', () => {
        expect(spaceSpec(0)).toBeNull();
    });

    it('grows the room as well as the mix', () => {
        // Raising only the wet level makes a small room louder, which reads as
        // a mixing error rather than a bigger space.
        const little = spaceSpec(20)!;
        const lots = spaceSpec(100)!;
        expect(lots.wet).toBeGreaterThan(little.wet);
        expect(lots.decay).toBeGreaterThan(little.decay);
    });

    it('never washes the clip out completely', () => {
        expect(spaceSpec(100)!.wet).toBeLessThan(1);
    });
});

// ============================================
// Groove
// ============================================

describe('global swing and clip groove combine', () => {
    it('is straight when neither is set', () => {
        expect(effectiveGroove(0, 0)).toBe(0);
        expect(effectiveGroove(undefined, 0)).toBe(0);
    });

    it('treats an absent project swing as straight', () => {
        // Every project saved before swing existed has no value at all, and it
        // must keep playing exactly as it was recorded.
        expect(effectiveGroove(undefined, 40)).toBe(40);
    });

    it('lets a clip push past the project', () => {
        expect(effectiveGroove(30, 40)).toBe(70);
    });

    it('lets the project swing a clip nobody has touched', () => {
        // The reason this is additive rather than an override: Groove's neutral
        // is 0, so an override would make every untouched clip snap back to
        // straight and the global control would do nothing at all.
        expect(effectiveGroove(60, 0)).toBe(60);
    });

    it('stops at the triplet ceiling rather than running past it', () => {
        expect(effectiveGroove(80, 80)).toBe(100);
    });

    it('clamps each side before adding, so bad input cannot cancel out', () => {
        expect(effectiveGroove(-50, 30)).toBe(30);
        expect(effectiveGroove(200, 0)).toBe(100);
    });
});

describe('groove', () => {
    it('is straight at zero', () => {
        expect(swingDelayBeats(0, 0.25)).toBe(0);
    });

    it('leaves the notes on the beat where they are', () => {
        // Swing is the uneven long-short pair: moving both halves is just a
        // delay, and the feel disappears.
        for (const beat of [0, 0.5, 1, 1.5, 2]) {
            expect(swingDelayBeats(100, beat)).toBe(0);
        }
    });

    it('pushes the off-beat sixteenths late', () => {
        for (const beat of [0.25, 0.75, 1.25]) {
            expect(swingDelayBeats(100, beat)).toBeGreaterThan(0);
        }
    });

    it('reaches a triplet feel at full swing and no further', () => {
        // A third of a sixteenth is the shuffle every swung groove is built on.
        expect(swingDelayBeats(100, 0.25)).toBeCloseTo(0.25 / 3, 10);
    });

    it('scales smoothly between straight and shuffled', () => {
        expect(swingDelayBeats(50, 0.25)).toBeCloseTo(swingDelayBeats(100, 0.25) / 2, 10);
    });

    it('leaves notes that are off the grid alone', () => {
        // Somebody who dragged a note off the grid meant it there, not
        // somewhere else a macro chose.
        expect(swingDelayBeats(100, 0.3)).toBe(0);
    });

    it('never pushes a note into the one after it', () => {
        // The off-beat must not arrive at or past the next downbeat.
        expect(swingDelayBeats(100, 0.25)).toBeLessThan(0.25);
    });
});

// ============================================
// Humanize
// ============================================

describe('humanize', () => {
    it('does nothing at zero', () => {
        expect(humanizeOffset(0, 'anything')).toEqual({ timingBeats: 0, velocity: 0 });
    });

    it('gives the same note the same wobble every time', () => {
        // The engine's one promise is that an export matches the playback. A
        // random source here would break it — and make two exports of one
        // project differ from each other.
        const seed = humanizeSeed('clip-1', makeNote(), 0);
        expect(humanizeOffset(60, seed)).toEqual(humanizeOffset(60, seed));
    });

    it('survives a reload — the seed is the note, not its position in an array', () => {
        const note = makeNote({ id: 'note-x', pitch: 64, startBeat: 2 });
        expect(humanizeSeed('clip-1', note, 0)).toBe(humanizeSeed('clip-1', note, 7));
    });

    it('gives neighbouring notes unrelated wobble', () => {
        // The failure this catches: consecutive notes differ by a character or
        // two, and a hash that carried that similarity through would make the
        // jitter drift steadily rather than scatter — a drummer running late,
        // not one playing loosely.
        const offsets = Array.from({ length: 64 }, (_, i) =>
            humanizeOffset(
                100,
                humanizeSeed('clip-1', makeNote({ id: `note-${i}`, startBeat: i * 0.25 }), i)
            ).timingBeats
        );

        const early = offsets.filter((o) => o < 0).length;
        expect(early).toBeGreaterThan(20);
        expect(early).toBeLessThan(44);

        // Lag-1 autocorrelation: how well each note's wobble predicts the next.
        const mean = offsets.reduce((a, b) => a + b, 0) / offsets.length;
        let covariance = 0;
        let variance = 0;
        offsets.forEach((value, i) => {
            variance += (value - mean) ** 2;
            if (i > 0) covariance += (value - mean) * (offsets[i - 1] - mean);
        });

        expect(Math.abs(covariance / variance)).toBeLessThan(0.35);
    });

    it('decouples late from quiet', () => {
        // One seed for both would make every late note also a soft one.
        const seeds = Array.from({ length: 40 }, (_, i) => `note-${i}`);
        const agree = seeds.filter((seed) => {
            const { timingBeats, velocity } = humanizeOffset(100, seed);
            return (timingBeats < 0) === (velocity < 0);
        }).length;

        expect(agree).toBeGreaterThan(10);
        expect(agree).toBeLessThan(30);
    });

    it('stays subtle enough to be a performance, not a mistake', () => {
        for (let i = 0; i < 200; i++) {
            const { timingBeats, velocity } = humanizeOffset(100, `note-${i}`);
            expect(Math.abs(timingBeats)).toBeLessThanOrEqual(0.03);
            expect(Math.abs(velocity)).toBeLessThanOrEqual(20);
        }
    });

    it('spreads its hash across the whole interval', () => {
        const buckets = new Array(10).fill(0);
        for (let i = 0; i < 1000; i++) {
            buckets[Math.floor(hashUnitInterval(`seed-${i}`) * 10)]++;
        }
        for (const count of buckets) {
            expect(count).toBeGreaterThan(50); // uniform enough; 100 is even
        }
    });
});

// ============================================
// Transpose
// ============================================

describe('transpose', () => {
    it('shifts by semitones', () => {
        expect(transposedPitch(60, 12)).toBe(72);
        expect(transposedPitch(60, -12)).toBe(48);
    });

    it('drops notes pushed off the keyboard rather than clamping them', () => {
        // Clamping would hold one note at the edge while the rest of the part
        // moved — a wrong note, which is more audibly broken than a missing one.
        expect(transposedPitch(120, 24)).toBeNull();
        expect(transposedPitch(5, -24)).toBeNull();
    });

    it('keeps the notes that still fit', () => {
        const clip = makeClip({
            transpose: 24,
            notes: [makeNote({ id: 'a', pitch: 60 }), makeNote({ id: 'b', pitch: 120 })],
        });
        const planned = planClipNotes(clip, 0, 120, 0);

        expect(planned).toHaveLength(1);
        expect(planned[0].pitch).toBe(84);
    });
});

// ============================================
// Planned notes — the macros arriving together
// ============================================

describe('planClipNotes', () => {
    it('swings a clip with no groove of its own when the project swings', () => {
        // The wiring test, not the arithmetic one. effectiveGroove can be
        // perfect and the project's swing still never reach a note if the
        // scheduler forgets to pass it — and nothing throws when it does.
        const clip = makeClip({ ...MACRO_NEUTRAL, notes: [makeNote({ startBeat: 0.25 })] });

        const straight = planClipNotes(clip, 0, 120, 0)[0].timeSeconds;
        const swung = planClipNotes(clip, 0, 120, 100)[0].timeSeconds;

        // A full-swing off-beat sixteenth lands a third of a sixteenth late.
        expect(swung - straight).toBeCloseTo((0.25 / 3) * (60 / 120), 10);
    });

    it('adds the project swing on top of the clip groove', () => {
        const clip = makeClip({ ...MACRO_NEUTRAL, groove: 50, notes: [makeNote({ startBeat: 0.25 })] });

        const clipOnly = planClipNotes(clip, 0, 120, 0)[0].timeSeconds;
        const both = planClipNotes(clip, 0, 120, 50)[0].timeSeconds;
        const full = planClipNotes(
            makeClip({ ...MACRO_NEUTRAL, groove: 100, notes: [makeNote({ startBeat: 0.25 })] }),
            0, 120, 0
        )[0].timeSeconds;

        expect(both).toBeGreaterThan(clipOnly);
        expect(both).toBeCloseTo(full, 10);
    });

    it('leaves an on-beat note where it is however hard the project swings', () => {
        const clip = makeClip({ ...MACRO_NEUTRAL, notes: [makeNote({ startBeat: 1 })] });
        expect(planClipNotes(clip, 0, 120, 100)[0].timeSeconds)
            .toBeCloseTo(planClipNotes(clip, 0, 120, 0)[0].timeSeconds, 10);
    });

    it('returns notes in time order however the array was built', () => {
        // Jitter can reorder notes, and the monophonic stagger numbers them
        // within a chord, so the order has to be settled here.
        const clip = makeClip({
            humanize: 100,
            notes: [
                makeNote({ id: 'c', startBeat: 2 }),
                makeNote({ id: 'a', startBeat: 0 }),
                makeNote({ id: 'b', startBeat: 1 }),
            ],
        });

        const times = planClipNotes(clip, 0, 120, 0).map((n) => n.timeSeconds);
        expect(times).toEqual([...times].sort((a, b) => a - b));
    });

    it('never schedules before the transport starts', () => {
        // Humanize can pull the first note of the first clip earlier than zero.
        const clip = makeClip({ humanize: 100, notes: [makeNote({ startBeat: 0 })] });
        for (const note of planClipNotes(clip, 0, 120, 0)) {
            expect(note.timeSeconds).toBeGreaterThanOrEqual(0);
        }
    });

    it('applies groove and energy together', () => {
        const straight = makeClip({ notes: [makeNote({ startBeat: 0.25 })] });
        const swung = makeClip({ groove: 100, energy: 100, notes: [makeNote({ startBeat: 0.25 })] });

        const [a] = planClipNotes(straight, 0, 120, 0);
        const [b] = planClipNotes(swung, 0, 120, 0);

        expect(b.timeSeconds).toBeGreaterThan(a.timeSeconds);
        expect(b.velocity).toBeGreaterThan(a.velocity);
    });

    it('normalises velocity for triggerAttackRelease', () => {
        for (const energy of [0, 50, 100]) {
            const clip = makeClip({ energy, notes: [makeNote({ velocity: 127 })] });
            const [note] = planClipNotes(clip, 0, 120, 0);
            expect(note.velocity).toBeGreaterThan(0);
            expect(note.velocity).toBeLessThanOrEqual(1);
        }
    });

    it('is deterministic — the same clip plans identically every time', () => {
        const clip = makeClip({
            humanize: 80, groove: 60, energy: 70, transpose: 5,
            notes: [makeNote({ id: 'a' }), makeNote({ id: 'b', startBeat: 0.25 })],
        });
        expect(planClipNotes(clip, 0, 120, 0)).toEqual(planClipNotes(clip, 0, 120, 0));
    });
});
