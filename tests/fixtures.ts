// ============================================
// ComposeYogi — Test Fixtures
// ============================================
//
// Small, hand-written projects used across the test suite. Ids are stable and
// readable so a failing assertion names the thing that broke.

import type { Clip, Note, Project, Track, TrackEffect } from '@/types';

export function makeTrack(overrides: Partial<Track> = {}): Track {
    return {
        id: 'track-1',
        projectId: 'project-1',
        name: 'Track 1',
        type: 'midi',
        color: 'keys',
        volume: 0.8,
        pan: 0,
        muted: false,
        solo: false,
        armed: false,
        order: 0,
        ...overrides,
    };
}

export function makeNote(overrides: Partial<Note> = {}): Note {
    return {
        id: 'note-1',
        pitch: 60,
        startBeat: 0,
        duration: 1,
        velocity: 100,
        ...overrides,
    };
}

export function makeClip(overrides: Partial<Clip> = {}): Clip {
    return {
        id: 'clip-1',
        trackId: 'track-1',
        type: 'midi',
        name: 'Clip 1',
        startBar: 0,
        lengthBars: 4,
        notes: [makeNote()],
        ...overrides,
    };
}

/**
 * A Clip with every field set — the optional ones included.
 *
 * `Required<Clip>` is the whole point. Three separate tests prove a
 * hand-written list of clip fields is complete by walking `Object.keys()` of a
 * fixture, and each of them would pass vacuously against an object that simply
 * omits the field nobody remembered. They did: `stretchToBpm` and `sourceBpm`
 * were added to the type, classified nowhere, and the suite stayed green.
 *
 * Adding a field to Clip now fails to compile here instead, which is the only
 * kind of reminder that cannot be forgotten. The values are chosen to be
 * distinct rather than realistic — a clip does not normally carry both notes
 * and an audio take, but coverage is what this exists for.
 */
export function makeFullClip(overrides: Partial<Clip> = {}): Required<Clip> {
    return {
        id: 'clip-full',
        trackId: 'track-1',
        type: 'audio',
        name: 'Every Field',
        startBar: 2,
        lengthBars: 4,
        audioTakeIds: ['take-1'],
        activeTakeId: 'take-1',
        trimStart: 0.25,
        trimEnd: 0.5,
        fadeIn: 0.1,
        fadeOut: 0.2,
        stretchToBpm: true,
        sourceBpm: 90,
        notes: [makeNote()],
        instrumentPreset: 'electric-piano',
        transpose: 3,
        humanize: 20,
        energy: 60,
        groove: 30,
        brightness: 70,
        space: 40,
        ...overrides,
    };
}

export function makeEffect(overrides: Partial<TrackEffect> = {}): TrackEffect {
    return {
        id: 'fx-1',
        type: 'reverb',
        active: true,
        params: { decay: 1.5, wet: 0.5 },
        ...overrides,
    };
}

export function makeProject(overrides: Partial<Project> = {}): Project {
    return {
        id: 'project-1',
        name: 'Test Project',
        bpm: 120,
        key: 'C',
        scale: 'minor',
        timeSignature: [4, 4],
        tracks: [makeTrack()],
        clips: [makeClip()],
        createdAt: 1_700_000_000_000,
        updatedAt: 1_700_000_000_000,
        ...overrides,
    };
}

/** A Project with every field set. Same contract as makeFullClip. */
export function makeFullProject(overrides: Partial<Project> = {}): Required<Project> {
    return {
        id: 'project-full',
        name: 'Every Field',
        bpm: 97,
        key: 'G',
        scale: 'harmonicMinor',
        timeSignature: [7, 8],
        latencyOffset: 8,
        swing: 55,
        tracks: [makeTrack()],
        clips: [makeClip()],
        createdAt: 1_700_000_000_000,
        updatedAt: 1_700_000_000_000,
        ...overrides,
    };
}

/**
 * A three-track project exercising the cases the render plan has to get right:
 * a plain track, a muted track, and a track whose clip has no notes.
 */
export function makeMixedProject(): Project {
    const drums = makeTrack({ id: 'drums', name: 'Drums', type: 'drum', color: 'drums', volume: 0.9 });
    const bass = makeTrack({ id: 'bass', name: 'Bass', color: 'bass', volume: 0.7, muted: true, order: 1 });
    const keys = makeTrack({ id: 'keys', name: 'Keys', color: 'keys', volume: 0.5, order: 2 });

    return makeProject({
        tracks: [drums, bass, keys],
        clips: [
            makeClip({ id: 'drum-clip', trackId: 'drums', type: 'drum', startBar: 0, lengthBars: 2 }),
            makeClip({ id: 'bass-clip', trackId: 'bass', startBar: 0, lengthBars: 4 }),
            makeClip({ id: 'keys-clip', trackId: 'keys', startBar: 4, lengthBars: 4 }),
            makeClip({ id: 'empty-clip', trackId: 'keys', startBar: 8, lengthBars: 4, notes: [] }),
        ],
    });
}
