// ============================================
// ComposeYogi — Persistence Tests
// ============================================
//
// Projects are stored split across three object stores with notes serialised to
// JSON, so "save then load" is a real transformation, not a memcpy. These tests
// hold it to a round trip.

import { openDB } from 'idb';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    DB_VERSION,
    clearAllData,
    deleteProject,
    getSetting,
    listProjects,
    loadProject,
    renameProject,
    resetDBConnection,
    saveProject,
    setSetting,
} from '@/lib/persistence/db';
import { LATEST_VERSION, MIGRATIONS, runMigrations } from '@/lib/persistence/migrations';
import { projectSaveSignature } from '@/lib/persistence/autosave';

import { makeClip, makeFullProject, makeNote, makeProject, makeTrack } from './fixtures';

import type { Project } from '@/types';

beforeEach(async () => {
    await clearAllData();
});

afterEach(() => {
    resetDBConnection();
});

// ============================================
// Round trip
// ============================================

describe('project round trip', () => {
    it('returns null for a project that was never saved', async () => {
        expect(await loadProject('nope')).toBeNull();
    });

    it('restores a saved project field for field', async () => {
        const project = makeProject({
            bpm: 85,
            key: 'F',
            scale: 'dorian',
            timeSignature: [3, 4],
            latencyOffset: 12,
        });

        await saveProject(project);
        const loaded = await loadProject(project.id);

        expect(loaded).not.toBeNull();
        expect(loaded).toMatchObject({
            id: project.id,
            name: project.name,
            bpm: 85,
            key: 'F',
            scale: 'dorian',
            timeSignature: [3, 4],
            latencyOffset: 12,
        });
    });

    it('carries every project field through storage, not just the ones listed above', async () => {
        // The assertion above names its fields by hand, so a field added to
        // Project and forgotten in saveProject/loadProject passes it silently —
        // and IndexedDB never complains about a key it was not given. That is
        // how a setting ships, works all session, and is gone after a reload.
        //
        // ProjectRecord is hand-built field by field on both sides, which is the
        // structure that makes this possible; this test is what makes it safe.
        // makeFullProject is Required<Project>, so a field added to the type
        // and forgotten by ProjectRecord fails here rather than being quietly
        // left out of the walk below.
        const project = makeFullProject();

        await saveProject(project);
        const loaded = await loadProject(project.id);
        expect(loaded).not.toBeNull();

        // tracks and clips live in their own stores and have their own tests;
        // updatedAt is deliberately re-stamped on save.
        const derived = new Set(['tracks', 'clips', 'updatedAt']);
        for (const key of Object.keys(project) as (keyof Project)[]) {
            if (derived.has(key)) continue;
            expect(loaded?.[key], `Project.${key} did not survive save/load`)
                .toEqual(project[key]);
        }
    });

    it('restores notes through their JSON round trip', async () => {
        const notes = [
            makeNote({ id: 'n1', pitch: 60, startBeat: 0, duration: 1, velocity: 100 }),
            makeNote({ id: 'n2', pitch: 67, startBeat: 2.5, duration: 0.25, velocity: 42 }),
        ];
        const project = makeProject({ clips: [makeClip({ notes })] });

        await saveProject(project);
        const loaded = await loadProject(project.id);

        expect(loaded!.clips[0].notes).toEqual(notes);
    });

    it('keeps every track and clip, and their linkage', async () => {
        const project = makeProject({
            tracks: [
                makeTrack({ id: 't1', name: 'Drums', order: 0 }),
                makeTrack({ id: 't2', name: 'Bass', order: 1 }),
            ],
            clips: [
                makeClip({ id: 'c1', trackId: 't1' }),
                makeClip({ id: 'c2', trackId: 't2' }),
                makeClip({ id: 'c3', trackId: 't2', startBar: 4 }),
            ],
        });

        await saveProject(project);
        const loaded = await loadProject(project.id);

        expect(loaded!.tracks.map((t) => t.id)).toEqual(['t1', 't2']);
        expect(loaded!.clips.map((c) => c.id).sort()).toEqual(['c1', 'c2', 'c3']);
        expect(loaded!.clips.filter((c) => c.trackId === 't2')).toHaveLength(2);
    });

    it('preserves track effects', async () => {
        const project = makeProject({
            tracks: [
                makeTrack({
                    effects: [
                        { id: 'fx1', type: 'reverb', active: true, params: { decay: 2.5, wet: 0.4 } },
                        { id: 'fx2', type: 'delay', active: false, params: { delayTime: 0.375 } },
                    ],
                }),
            ],
        });

        await saveProject(project);
        const loaded = await loadProject(project.id);

        expect(loaded!.tracks[0].effects).toEqual(project.tracks[0].effects);
    });

    it('normalises track order on load so duplicate orders cannot collide', async () => {
        // Historical projects can hold duplicate order values (fixed in 4.1).
        const project = makeProject({
            tracks: [
                makeTrack({ id: 'a', order: 5 }),
                makeTrack({ id: 'b', order: 5 }),
                makeTrack({ id: 'c', order: 1 }),
            ],
            clips: [],
        });

        await saveProject(project);
        const loaded = await loadProject(project.id);

        expect(loaded!.tracks.map((t) => t.order)).toEqual([0, 1, 2]);
        expect(loaded!.tracks[0].id).toBe('c');
    });

    it('stamps tracks with the project they are saved under', async () => {
        // Regression: only clips were stamped, so a project whose tracks still
        // carried an older projectId — a duplicate, an import, a remix — came
        // back from IndexedDB with no tracks at all.
        const project = makeProject({
            id: 'new-id',
            tracks: [makeTrack({ id: 't1', projectId: 'some-older-project' })],
            clips: [makeClip({ trackId: 't1' })],
        });

        await saveProject(project);
        const loaded = await loadProject('new-id');

        expect(loaded!.tracks).toHaveLength(1);
        expect(loaded!.tracks[0].projectId).toBe('new-id');
    });

    it('re-saving replaces rather than accumulates', async () => {
        const project = makeProject({
            clips: [makeClip({ id: 'c1' }), makeClip({ id: 'c2', startBar: 4 })],
        });
        await saveProject(project);

        await saveProject({ ...project, clips: [makeClip({ id: 'c1' })] });
        const loaded = await loadProject(project.id);

        expect(loaded!.clips.map((c) => c.id)).toEqual(['c1']);
    });
});

// ============================================
// Project management
// ============================================

describe('project management', () => {
    it('lists saved projects', async () => {
        await saveProject(makeProject({ id: 'p1', name: 'One' }));
        await saveProject(makeProject({ id: 'p2', name: 'Two' }));

        const listed = await listProjects();
        expect(listed.map((p) => p.id).sort()).toEqual(['p1', 'p2']);
    });

    it('renames without touching the rest of the project', async () => {
        const project = makeProject();
        await saveProject(project);

        await renameProject(project.id, 'Renamed');
        const loaded = await loadProject(project.id);

        expect(loaded!.name).toBe('Renamed');
        expect(loaded!.clips).toHaveLength(project.clips.length);
    });

    it('deleting a project takes its tracks and clips with it', async () => {
        const keep = makeProject({ id: 'keep' });
        const drop = makeProject({
            id: 'drop',
            tracks: [makeTrack({ id: 'dt', projectId: 'drop' })],
            clips: [makeClip({ id: 'dc', trackId: 'dt' })],
        });
        await saveProject(keep);
        await saveProject(drop);

        await deleteProject('drop');

        expect(await loadProject('drop')).toBeNull();
        expect(await loadProject('keep')).not.toBeNull();
    });
});

// ============================================
// Settings
// ============================================

// ============================================
// What counts as a change worth saving
// ============================================

describe('projectSaveSignature', () => {
    // Autosave only runs when this string changes. It used to be a hand-written
    // literal naming eight fields, so anything else could be edited all session
    // and be gone after a reload — no error, no log, no warning. Swing was the
    // first field to fall through it.
    const FIELDS: { field: keyof Project; value: unknown }[] = [
        { field: 'id', value: 'other' },
        { field: 'name', value: 'Renamed' },
        { field: 'bpm', value: 140 },
        { field: 'key', value: 'F' },
        { field: 'scale', value: 'lydian' },
        { field: 'timeSignature', value: [3, 4] },
        { field: 'swing', value: 40 },
        { field: 'latencyOffset', value: 12 },
        { field: 'createdAt', value: 1 },
        { field: 'tracks', value: [makeTrack({ id: 'other', volume: 0.1 })] },
        { field: 'clips', value: [makeClip({ id: 'other', startBar: 9 })] },
    ];

    it.each(FIELDS)('notices $field changing', ({ field, value }) => {
        const base = makeProject();
        const changed = { ...base, [field]: value } as Project;

        expect(
            projectSaveSignature(changed),
            `editing Project.${field} does not trigger a save`
        ).not.toBe(projectSaveSignature(base));
    });

    it('covers every field of Project — the list above is not stale', () => {
        // updatedAt is the one deliberate exclusion, so it is the only key
        // allowed to be missing here.
        const named = new Set<string>([...FIELDS.map((f) => f.field), 'updatedAt']);
        const missing = Object.keys(makeFullProject()).filter((key) => !named.has(key));

        expect(missing, 'add it to FIELDS so autosave is proven to notice it').toEqual([]);
    });

    it('ignores the timestamp that saving itself stamps', () => {
        // Including it would make every save look like another change.
        const base = makeProject();
        expect(projectSaveSignature({ ...base, updatedAt: base.updatedAt + 5000 }))
            .toBe(projectSaveSignature(base));
    });
});

describe('settings', () => {
    it('returns the default until something is stored', async () => {
        expect(await getSetting('latency-offset', 0)).toBe(0);
        await setSetting('latency-offset', 23);
        expect(await getSetting('latency-offset', 0)).toBe(23);
    });

    it('round-trips objects', async () => {
        await setSetting('keybindings', { play: 'Space', record: 'R' });
        expect(await getSetting('keybindings', {})).toEqual({ play: 'Space', record: 'R' });
    });
});

// ============================================
// Migrations
// ============================================

describe('migrations', () => {
    it('are numbered from 1 with no gaps or duplicates', () => {
        const versions = MIGRATIONS.map((m) => m.version);
        expect(versions).toEqual([...versions].sort((a, b) => a - b));
        expect(new Set(versions).size).toBe(versions.length);
        expect(versions).toEqual(versions.map((_, i) => i + 1));
    });

    it('keep DB_VERSION in step with the migration list', () => {
        expect(DB_VERSION).toBe(LATEST_VERSION);
    });

    it('build the whole schema from an empty database', async () => {
        const name = `migrate-fresh-${LATEST_VERSION}`;
        const db = await openDB(name, LATEST_VERSION, {
            async upgrade(database, oldVersion, newVersion, transaction) {
                await runMigrations(database, oldVersion, newVersion, transaction);
            },
        });

        expect([...db.objectStoreNames].sort()).toEqual([
            'audioTakes', 'clips', 'projects', 'settings', 'tracks', 'userSamples',
        ]);
        db.close();
    });

    it('upgrade an old database in order, keeping the data already in it', async () => {
        const name = 'migrate-stepwise';

        // Open at v1 only — the state a user who last opened the app before
        // user samples existed would still have.
        const v1 = await openDB(name, 1, {
            async upgrade(database, oldVersion, newVersion, transaction) {
                await runMigrations(database, oldVersion, newVersion, transaction);
            },
        });
        expect(v1.objectStoreNames.contains('userSamples')).toBe(false);
        await v1.put('settings', { key: 'from-v1', value: 'still here' });
        v1.close();

        // Reopen at the latest version: the remaining migrations must run.
        const latest = await openDB(name, LATEST_VERSION, {
            async upgrade(database, oldVersion, newVersion, transaction) {
                expect(oldVersion).toBe(1);
                await runMigrations(database, oldVersion, newVersion, transaction);
            },
        });

        expect(latest.objectStoreNames.contains('userSamples')).toBe(true);
        expect(await latest.get('settings', 'from-v1')).toEqual({
            key: 'from-v1',
            value: 'still here',
        });
        latest.close();
    });

    it('rewrite the data they exist to rewrite', async () => {
        // Both data migrations in one pass, because both are the same kind of
        // risk: they change what is already on someone's machine, and getting
        // one wrong is silent — the project simply plays or highlights
        // differently the next time it is opened.
        const name = 'migrate-data';

        const old = await openDB(name, 2, {
            async upgrade(database, oldVersion, newVersion, transaction) {
                await runMigrations(database, oldVersion, newVersion, transaction);
            },
        });

        // Migration 3: Groove and Space shipped at 50 while no macro did
        // anything. Left alone, every clip would start playing half-swung and wet.
        await old.put('clips', {
            id: 'untouched', projectId: 'p1', trackId: 't1', type: 'midi',
            name: 'Untouched', startBar: 0, lengthBars: 4,
            energy: 50, brightness: 50, groove: 50, space: 50,
        });
        await old.put('clips', {
            id: 'deliberate', projectId: 'p1', trackId: 't1', type: 'midi',
            name: 'Deliberate', startBar: 4, lengthBars: 4,
            energy: 50, brightness: 50, groove: 20, space: 70,
        });
        // Migration 4: the one scale value the new list has no name for.
        await old.put('projects', {
            id: 'p1', name: 'Legacy', bpm: 120, key: 'C', scale: 'pentatonic',
            timeSignature: [4, 4], createdAt: 1, updatedAt: 1,
        });
        await old.put('projects', {
            id: 'p2', name: 'Modern', bpm: 120, key: 'C', scale: 'dorian',
            timeSignature: [4, 4], createdAt: 1, updatedAt: 1,
        });
        old.close();

        const migrated = await openDB(name, LATEST_VERSION, {
            async upgrade(database, oldVersion, newVersion, transaction) {
                await runMigrations(database, oldVersion, newVersion, transaction);
            },
        });

        const untouched = await migrated.get('clips', 'untouched');
        expect(untouched.groove, 'the shipped default must become straight').toBe(0);
        expect(untouched.space, 'the shipped default must become dry').toBe(0);
        expect(untouched.energy, 'a bipolar macro is neutral at 50 and stays there').toBe(50);
        expect(untouched.brightness).toBe(50);

        const deliberate = await migrated.get('clips', 'deliberate');
        expect(deliberate.groove, 'a value nobody defaulted to must survive').toBe(20);
        expect(deliberate.space).toBe(70);

        expect((await migrated.get('projects', 'p1')).scale).toBe('pentatonicMinor');
        expect((await migrated.get('projects', 'p2')).scale, 'other scales are left alone')
            .toBe('dorian');
        migrated.close();
    });

    it('do nothing when the database is already current', async () => {
        const name = 'migrate-noop';
        const first = await openDB(name, LATEST_VERSION, {
            async upgrade(database, oldVersion, newVersion, transaction) {
                await runMigrations(database, oldVersion, newVersion, transaction);
            },
        });
        first.close();

        let upgradeRan = false;
        const second = await openDB(name, LATEST_VERSION, {
            upgrade() {
                upgradeRan = true;
            },
        });

        expect(upgradeRan).toBe(false);
        second.close();
    });
});
