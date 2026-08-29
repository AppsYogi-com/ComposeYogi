// ============================================
// ComposeYogi — Reschedule Hash Tests
// ============================================
//
// Issue #22 in one sentence: something changed what should play, the hash did
// not notice, and playback carried on with the old schedule. Nothing throws in
// that failure — you just hear the wrong thing — so it is exactly the kind of
// bug that reaches a user.
//
// The load-bearing test here is the exhaustiveness one. Every key of Clip must
// be declared either sound-affecting or silent, so adding a field to the type
// forces a decision instead of defaulting to "silent" by being forgotten. The
// clip macros are the immediate reason: they are about to start driving DSP,
// and a macro that moves a slider without rebuilding the schedule is #22 again.

import { describe, expect, it } from 'vitest';

import {
    SILENT_CLIP_FIELDS,
    SILENT_PROJECT_FIELDS,
    SOUND_AFFECTING_CLIP_FIELDS,
    SOUND_AFFECTING_PROJECT_FIELDS,
    clipScheduleHash,
    clipsScheduleHash,
    mixerStateHash,
    projectScheduleHash,
    trackEffectsHash,
    trackScheduleHash,
} from '@/lib/audio/schedule-hash';

import { makeClip, makeNote, makeProject, makeTrack } from './fixtures';

import type { Clip, Project } from '@/types';

/**
 * Every field of Clip, as values rather than types — a type-level check cannot
 * be asserted at runtime, and this list is what the exhaustiveness test
 * compares against.
 */
const ALL_CLIP_FIELDS: (keyof Clip)[] = [
    'id', 'trackId', 'type', 'name', 'startBar', 'lengthBars',
    'audioTakeIds', 'activeTakeId', 'trimStart', 'trimEnd', 'fadeIn', 'fadeOut',
    'notes', 'instrumentPreset',
    'transpose', 'humanize', 'energy', 'groove', 'brightness', 'space',
];

describe('every clip field is classified', () => {
    it('declares each one as either heard or silent', () => {
        const classified = new Set<string>([
            ...SOUND_AFFECTING_CLIP_FIELDS,
            ...SILENT_CLIP_FIELDS,
        ]);
        const unclassified = ALL_CLIP_FIELDS.filter((field) => !classified.has(field));

        expect(
            unclassified,
            'Add it to SOUND_AFFECTING_CLIP_FIELDS if it changes what is played, or to ' +
            'SILENT_CLIP_FIELDS if it does not. A field in neither is silently ' +
            'excluded from the hash, which is how #22 happened.'
        ).toEqual([]);
    });

    it('never classifies a field as both', () => {
        const both = SOUND_AFFECTING_CLIP_FIELDS.filter((field) =>
            (SILENT_CLIP_FIELDS as readonly string[]).includes(field)
        );
        expect(both).toEqual([]);
    });

    it('covers the whole type — the field list is not stale', () => {
        // Guards the list above: if Clip gains a field and nobody updates
        // ALL_CLIP_FIELDS, the classification test would pass vacuously.
        const clip = makeClip({
            activeTakeId: 't', trimStart: 1, trimEnd: 2, fadeIn: 0.1, fadeOut: 0.2,
            instrumentPreset: 'p', transpose: 1, humanize: 2,
            energy: 3, groove: 4, brightness: 5, space: 6,
            audioTakeIds: ['t'],
        });
        for (const key of Object.keys(clip)) {
            expect(ALL_CLIP_FIELDS, `Clip.${key} is missing from ALL_CLIP_FIELDS`)
                .toContain(key as keyof Clip);
        }
    });
});

/** Every field of Project, same contract as ALL_CLIP_FIELDS above. */
const ALL_PROJECT_FIELDS: (keyof Project)[] = [
    'id', 'name', 'bpm', 'key', 'scale', 'timeSignature',
    'tracks', 'clips', 'createdAt', 'updatedAt', 'latencyOffset', 'swing',
];

describe('every project field is classified', () => {
    it('declares each one as either heard or silent', () => {
        const classified = new Set<string>([
            ...SOUND_AFFECTING_PROJECT_FIELDS,
            ...SILENT_PROJECT_FIELDS,
        ]);
        const unclassified = ALL_PROJECT_FIELDS.filter((field) => !classified.has(field));

        expect(
            unclassified,
            'Add it to SOUND_AFFECTING_PROJECT_FIELDS if it changes what is played, ' +
            'or to SILENT_PROJECT_FIELDS if it does not.'
        ).toEqual([]);
    });

    it('never classifies a field as both', () => {
        const both = SOUND_AFFECTING_PROJECT_FIELDS.filter((field) =>
            (SILENT_PROJECT_FIELDS as readonly string[]).includes(field)
        );
        expect(both).toEqual([]);
    });

    it('covers the whole type — the field list is not stale', () => {
        const project = makeProject({ latencyOffset: 10, swing: 40 });
        for (const key of Object.keys(project)) {
            expect(ALL_PROJECT_FIELDS, `Project.${key} is missing from ALL_PROJECT_FIELDS`)
                .toContain(key as keyof Project);
        }
    });
});

describe('projectScheduleHash', () => {
    it('changes when swing changes', () => {
        // The whole reason this hash exists. Swing is resolved at schedule time
        // into every note's position, so moving it without rebuilding leaves
        // the project playing at the previous groove with no error anywhere.
        const base = makeProject();
        expect(projectScheduleHash(makeProject({ swing: 60 }))).not.toBe(projectScheduleHash(base));
    });

    it('distinguishes no swing from zero swing', () => {
        // Both are straight, but they are different stored states, and a hash
        // that flattened them would hide a genuine change on the way back.
        expect(projectScheduleHash(makeProject({ swing: 0 })))
            .not.toBe(projectScheduleHash(makeProject({ swing: undefined })));
    });

    it('changes when tempo or time signature changes', () => {
        // Tone rescales already-scheduled events on a tempo change, so bar
        // positions survive on their own — but the note *durations* handed to
        // triggerAttackRelease were resolved to seconds at the old tempo and
        // do not move.
        const base = makeProject();
        expect(projectScheduleHash(makeProject({ bpm: 90 }))).not.toBe(projectScheduleHash(base));
        expect(projectScheduleHash(makeProject({ timeSignature: [3, 4] })))
            .not.toBe(projectScheduleHash(base));
    });

    it('ignores what only the piano roll draws', () => {
        // Key and scale highlight notes. Nothing is retuned, so rebuilding the
        // whole schedule to change a colour would be pure cost.
        const base = projectScheduleHash(makeProject());
        expect(projectScheduleHash(makeProject({ key: 'F', scale: 'lydian' }))).toBe(base);
        expect(projectScheduleHash(makeProject({ name: 'Renamed', updatedAt: 1 }))).toBe(base);
        expect(projectScheduleHash(makeProject({ latencyOffset: 25 }))).toBe(base);
    });

    it('is empty with no project, rather than throwing', () => {
        expect(projectScheduleHash(null)).toBe('');
    });
});

describe('clipScheduleHash', () => {
    it('changes when any sound-affecting field changes', () => {
        const base = makeClip();
        const baseline = clipScheduleHash(base);

        const variants: Partial<Clip>[] = [
            { type: 'audio' }, { startBar: 8 }, { lengthBars: 2 },
            { activeTakeId: 'take-2' }, { trimStart: 0.5 }, { trimEnd: 0.5 },
            { fadeIn: 0.25 }, { fadeOut: 0.25 }, { instrumentPreset: 'other' },
            { transpose: 3 }, { humanize: 40 },
            { energy: 70 }, { groove: 55 }, { brightness: 20 }, { space: 90 },
            { notes: [makeNote({ velocity: 42 })] },
        ];

        for (const change of variants) {
            const field = Object.keys(change)[0];
            expect(
                clipScheduleHash({ ...base, ...change }),
                `changing ${field} must change the hash, or the schedule goes stale`
            ).not.toBe(baseline);
        }
    });

    it('ignores fields that make no sound', () => {
        const base = makeClip();
        const baseline = clipScheduleHash(base);

        expect(clipScheduleHash({ ...base, name: 'Renamed' })).toBe(baseline);
        expect(clipScheduleHash({ ...base, audioTakeIds: ['a', 'b', 'c'] })).toBe(baseline);
    });

    it('notices a note changing pitch, timing, length or velocity', () => {
        const base = makeClip({ notes: [makeNote()] });
        const baseline = clipScheduleHash(base);

        for (const change of [{ pitch: 61 }, { startBeat: 1 }, { duration: 2 }, { velocity: 99 }]) {
            expect(clipScheduleHash({ ...base, notes: [makeNote(change)] })).not.toBe(baseline);
        }
    });

    it('distinguishes an absent value from a zero', () => {
        // `${undefined}` and `${0}` both stringify to something truthy-looking;
        // a hash that collapsed them would miss a fade being cleared.
        expect(clipScheduleHash(makeClip({ fadeIn: 0 })))
            .not.toBe(clipScheduleHash(makeClip({ fadeIn: undefined })));
    });
});

describe('clipsScheduleHash', () => {
    it('notices a clip being added or removed', () => {
        const a = makeClip({ id: 'a' });
        const b = makeClip({ id: 'b', startBar: 4 });
        expect(clipsScheduleHash([a])).not.toBe(clipsScheduleHash([a, b]));
    });

    it('notices two clips swapping their content', () => {
        const a = makeClip({ id: 'a', startBar: 0 });
        const b = makeClip({ id: 'b', startBar: 4 });
        expect(clipsScheduleHash([a, b]))
            .not.toBe(clipsScheduleHash([{ ...a, startBar: 4 }, { ...b, startBar: 0 }]));
    });
});

describe('track hashes', () => {
    it('reschedules when the instrument changes, because the synth is built then', () => {
        const track = makeTrack();
        expect(trackScheduleHash([{ ...track, instrumentPreset: 'piano' }]))
            .not.toBe(trackScheduleHash([{ ...track, instrumentPreset: 'bass' }]));
    });

    it('does not reschedule for a mixer move', () => {
        const track = makeTrack();
        const baseline = trackScheduleHash([track]);

        expect(trackScheduleHash([{ ...track, volume: 0.2 }])).toBe(baseline);
        expect(trackScheduleHash([{ ...track, pan: -1 }])).toBe(baseline);
        expect(trackScheduleHash([{ ...track, muted: true }])).toBe(baseline);
        expect(trackScheduleHash([{ ...track, solo: true }])).toBe(baseline);
    });

    it('tracks mixer state separately, so it can be ramped instead', () => {
        const track = makeTrack();
        const baseline = mixerStateHash([track]);

        expect(mixerStateHash([{ ...track, volume: 0.2 }])).not.toBe(baseline);
        expect(mixerStateHash([{ ...track, pan: -1 }])).not.toBe(baseline);
        expect(mixerStateHash([{ ...track, muted: true }])).not.toBe(baseline);
        expect(mixerStateHash([{ ...track, solo: true }])).not.toBe(baseline);
    });

    it('rebuilds the effect chain when an effect is bypassed or retuned', () => {
        const withEffect = makeTrack({
            effects: [{ id: 'reverb-1', type: 'reverb', active: true, params: { wet: 0.3 } }],
        });
        const baseline = trackEffectsHash([withEffect]);

        expect(trackEffectsHash([{
            ...withEffect,
            effects: [{ ...withEffect.effects![0], active: false }],
        }])).not.toBe(baseline);

        expect(trackEffectsHash([{
            ...withEffect,
            effects: [{ ...withEffect.effects![0], params: { wet: 0.9 } }],
        }])).not.toBe(baseline);
    });
});
