// ============================================
// ComposeYogi — Project Store Tests
// ============================================

import { beforeEach, describe, expect, it } from 'vitest';

import { useProjectStore } from '@/lib/store/project';

import { makeNote } from './fixtures';

const store = () => useProjectStore.getState();

/**
 * Start every test from an empty project with a single MIDI track.
 * createProject() seeds four starter tracks, which is right for the app but
 * noise here — its own behaviour is covered separately below.
 */
function freshProject() {
    useProjectStore.temporal.getState().clear();
    store().loadProject({
        id: 'project-1',
        name: 'Test Project',
        bpm: 120,
        key: 'C',
        scale: 'minor',
        timeSignature: [4, 4],
        tracks: [],
        clips: [],
        createdAt: 1_700_000_000_000,
        updatedAt: 1_700_000_000_000,
    });
    useProjectStore.temporal.getState().clear();
    return store().addTrack('midi', 'Keys', 'keys');
}

beforeEach(() => {
    freshProject();
});

// ============================================
// Project lifecycle
// ============================================

describe('createProject', () => {
    it('seeds a new project with the four starter tracks', () => {
        store().createProject('Fresh');

        expect(store().project!.name).toBe('Fresh');
        expect(store().project!.tracks.map((t) => t.name)).toEqual([
            'Drums', 'Bass', 'Keys', 'Melody',
        ]);
        expect(store().project!.clips).toHaveLength(0);
    });

    it('loads a demo template complete with its music, not just empty tracks', () => {
        store().createProject(undefined, 'lofi-study');

        const project = store().project!;
        expect(project.tracks.length).toBeGreaterThan(0);
        expect(project.clips.length).toBeGreaterThan(0);
        // A template that loads without notes is the silent-project bug.
        expect(project.clips.some((c) => (c.notes?.length ?? 0) > 0)).toBe(true);
    });

    it('falls back to a normal empty project for an unknown template id', () => {
        store().createProject('Unknown', 'no-such-template');
        expect(store().project!.clips).toHaveLength(0);
        expect(store().project!.tracks).toHaveLength(4);
    });
});

// ============================================
// Tracks
// ============================================

describe('track operations', () => {
    it('appends tracks with sequential order values', () => {
        store().addTrack('drum', 'Drums', 'drums');
        store().addTrack('midi', 'Bass', 'bass');

        const orders = store().project!.tracks.map((t) => t.order);
        expect(orders).toEqual([0, 1, 2]);
        expect(store().project!.tracks.map((t) => t.name)).toEqual(['Keys', 'Drums', 'Bass']);
    });

    it('deleting a track removes its clips too', () => {
        const track = store().project!.tracks[0];
        store().addClip(track.id, 'midi', 0);
        store().addClip(track.id, 'midi', 4);
        expect(store().project!.clips).toHaveLength(2);

        store().deleteTrack(track.id);

        expect(store().project!.tracks).toHaveLength(0);
        expect(store().project!.clips).toHaveLength(0);
    });

    it('reorderTracks renumbers by the given id order', () => {
        const a = store().project!.tracks[0];
        const b = store().addTrack('midi', 'B');
        const c = store().addTrack('midi', 'C');

        store().reorderTracks([c.id, a.id, b.id]);

        const byId = new Map(store().project!.tracks.map((t) => [t.id, t.order]));
        expect(byId.get(c.id)).toBe(0);
        expect(byId.get(a.id)).toBe(1);
        expect(byId.get(b.id)).toBe(2);
    });

    it('track effects can be added, updated and removed', () => {
        const track = store().project!.tracks[0];
        store().addTrackEffect(track.id, 'reverb');

        const effect = store().project!.tracks[0].effects![0];
        expect(effect.active).toBe(true);

        store().updateTrackEffect(track.id, effect.id, { active: false });
        expect(store().project!.tracks[0].effects![0].active).toBe(false);

        store().removeTrackEffect(track.id, effect.id);
        expect(store().project!.tracks[0].effects).toHaveLength(0);
    });
});

// ============================================
// Clips
// ============================================

describe('clip operations', () => {
    it('duplicateClip offsets by the clip length and gives it a new id', () => {
        const track = store().project!.tracks[0];
        const clip = store().addClip(track.id, 'midi', 0, 4);

        const copy = store().duplicateClip(clip.id)!;

        expect(copy.id).not.toBe(clip.id);
        expect(copy.startBar).toBe(4);
        expect(copy.lengthBars).toBe(4);
        expect(store().project!.clips).toHaveLength(2);
    });

    it('duplicated notes get fresh ids so editing the copy leaves the original alone', () => {
        const track = store().project!.tracks[0];
        const clip = store().addClip(track.id, 'midi', 0, 4);
        store().addNote(clip.id, makeNote({ pitch: 64 }));

        const copy = store().duplicateClip(clip.id)!;
        const originalNoteId = store().project!.clips.find((c) => c.id === clip.id)!.notes![0].id;

        expect(copy.notes![0].id).not.toBe(originalNoteId);
    });

    it('moveClipsByDelta never drags clips past bar zero', () => {
        const track = store().project!.tracks[0];
        const a = store().addClip(track.id, 'midi', 0, 4);
        const b = store().addClip(track.id, 'midi', 8, 4);

        store().moveClipsByDelta([a.id, b.id], -4);

        const byId = new Map(store().project!.clips.map((c) => [c.id, c.startBar]));
        expect(byId.get(a.id)).toBe(0);
        expect(byId.get(b.id)).toBe(4);
    });

    it('deleteClips removes every named clip in one step', () => {
        const track = store().project!.tracks[0];
        const a = store().addClip(track.id, 'midi', 0);
        const b = store().addClip(track.id, 'midi', 4);
        const c = store().addClip(track.id, 'midi', 8);

        store().deleteClips([a.id, c.id]);

        expect(store().project!.clips.map((clip) => clip.id)).toEqual([b.id]);
    });
});

// ============================================
// Split
// ============================================

describe('splitClip', () => {
    it('splits into two clips whose lengths add up to the original', () => {
        const track = store().project!.tracks[0];
        const clip = store().addClip(track.id, 'midi', 0, 8);

        const [first, second] = store().splitClip(clip.id, 3)!;

        expect(first.lengthBars).toBe(3);
        expect(second.startBar).toBe(3);
        expect(second.lengthBars).toBe(5);
        expect(store().project!.clips).toHaveLength(2);
    });

    it('refuses to split on or outside the clip boundaries', () => {
        const track = store().project!.tracks[0];
        const clip = store().addClip(track.id, 'midi', 4, 4);

        expect(store().splitClip(clip.id, 4)).toBeNull();   // at the start
        expect(store().splitClip(clip.id, 8)).toBeNull();   // at the end
        expect(store().splitClip(clip.id, 99)).toBeNull();  // past the end
        expect(store().project!.clips).toHaveLength(1);
    });

    it('sends each note to exactly one side of the split', () => {
        const track = store().project!.tracks[0];
        const clip = store().addClip(track.id, 'midi', 0, 4);
        // Bars 0-1 hold beats 0-7 at 4/4; bar 2 starts at beat 8.
        store().addNote(clip.id, makeNote({ pitch: 60, startBeat: 0 }));
        store().addNote(clip.id, makeNote({ pitch: 62, startBeat: 7 }));
        store().addNote(clip.id, makeNote({ pitch: 64, startBeat: 8 }));

        const [first, second] = store().splitClip(clip.id, 2)!;

        expect(first.notes!.map((n) => n.pitch)).toEqual([60, 62]);
        expect(second.notes!.map((n) => n.pitch)).toEqual([64]);
        // The second clip's notes are rebased to its own start
        expect(second.notes![0].startBeat).toBe(0);
    });

    it('splits on the beat grid of the project time signature, not always 4/4', () => {
        // Regression: the split point was hardcoded to 4 beats per bar, so in
        // 3/4 every note between the real and assumed boundary landed on the
        // wrong side of the cut.
        store().setTimeSignature([3, 4]);

        const track = store().project!.tracks[0];
        const clip = store().addClip(track.id, 'midi', 0, 4);
        store().addNote(clip.id, makeNote({ pitch: 60, startBeat: 5 })); // bar 1 in 3/4
        store().addNote(clip.id, makeNote({ pitch: 64, startBeat: 6 })); // bar 2 in 3/4

        const [first, second] = store().splitClip(clip.id, 2)!;

        expect(first.notes!.map((n) => n.pitch)).toEqual([60]);
        expect(second.notes!.map((n) => n.pitch)).toEqual([64]);
        expect(second.notes![0].startBeat).toBe(0);
    });
});

// ============================================
// Undo / redo
// ============================================

describe('undo and redo', () => {
    it('undoes an added clip and redoes it', () => {
        const track = store().project!.tracks[0];
        store().addClip(track.id, 'midi', 0, 4);
        expect(store().project!.clips).toHaveLength(1);

        useProjectStore.temporal.getState().undo();
        expect(store().project!.clips).toHaveLength(0);

        useProjectStore.temporal.getState().redo();
        expect(store().project!.clips).toHaveLength(1);
    });

    it('undoes a track rename back to the previous name', () => {
        const track = store().project!.tracks[0];
        store().updateTrack(track.id, { name: 'Renamed' });
        expect(store().project!.tracks[0].name).toBe('Renamed');

        useProjectStore.temporal.getState().undo();
        expect(store().project!.tracks[0].name).toBe('Keys');
    });

    it('walks back through several edits one at a time', () => {
        const track = store().project!.tracks[0];
        store().addClip(track.id, 'midi', 0, 4);
        store().addClip(track.id, 'midi', 4, 4);
        store().addClip(track.id, 'midi', 8, 4);

        const temporal = useProjectStore.temporal.getState();
        temporal.undo();
        expect(store().project!.clips).toHaveLength(2);
        temporal.undo();
        expect(store().project!.clips).toHaveLength(1);
    });

    it('does not record UI-only state in history', () => {
        // partialize keeps only `project`, so save bookkeeping must not create
        // an undo step of its own.
        const before = useProjectStore.temporal.getState().pastStates.length;
        store().markSaved();
        expect(useProjectStore.temporal.getState().pastStates.length).toBe(before);
    });
});
