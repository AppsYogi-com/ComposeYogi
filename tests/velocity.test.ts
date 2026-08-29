// ============================================
// ComposeYogi — Velocity Tests
// ============================================
//
// Velocity has always reached the synth — the scheduler passes
// note.velocity / 127 into triggerAttackRelease — but until Sprint 8.7 nothing
// in the interface could set it, so every note played at the 100 the editors
// hardcoded. These tests cover the contract the new editing gestures depend on.
//
// The load-bearing one is undo granularity. A velocity drag emits a pointermove
// on every pixel; if each of those wrote to the store, one gesture would fill a
// hundred-deep history and rebuild the audio schedule a hundred times, because
// velocity is part of the reschedule hash. Both editors therefore hold the
// in-flight value in local state and commit once on release. What that buys is
// asserted here, at the store, rather than trusted.

import { beforeEach, describe, expect, it } from 'vitest';

import { useProjectStore } from '@/lib/store/project';
import { useUIStore } from '@/lib/store/ui';

import { pitchPosition } from '@/components/compose/NotePreview';

import { makeNote } from './fixtures';

const store = () => useProjectStore.getState();
const history = () => useProjectStore.temporal.getState();

function freshClipWithNote() {
    history().clear();
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
    const track = store().addTrack('midi', 'Keys', 'keys');
    const clip = store().addClip(track.id, 'midi', 0, 4);
    const note = store().addNote(clip.id, makeNote({ velocity: 100 }));
    history().clear();
    return { clipId: clip.id, noteId: note!.id };
}

const noteVelocity = (clipId: string, noteId: string) =>
    store().project?.clips
        .find((c) => c.id === clipId)
        ?.notes?.find((n) => n.id === noteId)?.velocity;

/** The UI store is module state shared by every test in this file. */
const pristineDefaultVelocity = useUIStore.getState().defaultVelocity;

beforeEach(() => {
    freshClipWithNote();
    // Without this, the clamping test leaves defaultVelocity at 65 and whichever
    // test asserts the default fails depending on the order vitest happens to run.
    useUIStore.setState({ defaultVelocity: pristineDefaultVelocity });
});

// ============================================
// Undo granularity
// ============================================

describe('a velocity gesture costs one undo step', () => {
    it('records a single history entry for a single committed change', () => {
        const { clipId, noteId } = freshClipWithNote();
        expect(history().pastStates.length).toBe(0);

        store().updateNote(clipId, noteId, { velocity: 72 });

        expect(noteVelocity(clipId, noteId)).toBe(72);
        expect(history().pastStates.length).toBe(1);
    });

    it('restores the pre-gesture velocity with one undo', () => {
        const { clipId, noteId } = freshClipWithNote();
        store().updateNote(clipId, noteId, { velocity: 40 });

        history().undo();

        expect(noteVelocity(clipId, noteId)).toBe(100);
    });

    // The reason the editors buffer the drag. Writing per pointermove is not
    // merely wasteful — it destroys undo: the user's previous action is pushed
    // out of a hundred-deep history by a single gesture.
    it('would cost one entry per move if the drag wrote as it went', () => {
        const { clipId, noteId } = freshClipWithNote();

        for (let velocity = 99; velocity >= 70; velocity--) {
            store().updateNote(clipId, noteId, { velocity });
        }

        expect(history().pastStates.length).toBe(30);
        history().undo();
        // One undo walks back one pixel of the drag, not the gesture.
        expect(noteVelocity(clipId, noteId)).toBe(71);
    });

    it('writes nothing when the value did not actually change', () => {
        const { clipId, noteId } = freshClipWithNote();

        store().updateNote(clipId, noteId, { velocity: 100 });

        // zundo's equality check drops a state identical to the last one, so a
        // gesture that ends where it began leaves no trace to undo.
        expect(history().pastStates.length).toBe(0);
    });
});

// ============================================
// Default velocity
// ============================================

describe('the default velocity for new notes', () => {
    it('starts at a musical mid-level rather than full scale', () => {
        expect(useUIStore.getState().defaultVelocity).toBe(100);
    });

    it('clamps to the MIDI range and rounds to a whole step', () => {
        const set = useUIStore.getState().setDefaultVelocity;

        set(0);
        expect(useUIStore.getState().defaultVelocity).toBe(1);

        set(999);
        expect(useUIStore.getState().defaultVelocity).toBe(127);

        set(64.6);
        expect(useUIStore.getState().defaultVelocity).toBe(65);
    });
});

// ============================================
// The reschedule contract
// ============================================

describe('velocity reaches the audio path', () => {
    it('is part of what the scheduler reads for a note', async () => {
        const { clipId, noteId } = freshClipWithNote();
        store().updateNote(clipId, noteId, { velocity: 42 });

        const clip = store().project?.clips.find((c) => c.id === clipId);
        const note = clip?.notes?.find((n) => n.id === noteId);

        // scheduler.ts converts to Tone's 0–1 gain with note.velocity / 127.
        expect(note?.velocity).toBe(42);
        expect((note!.velocity / 127).toFixed(4)).toBe('0.3307');
    });
});

// ============================================
// Clip preview contour
// ============================================
//
// The preview is only worth drawing if it tells the truth about the part. The
// trap is normalising every clip to its own pitch range: that stretches whatever
// the part does to fill the lane, so a bassline moving two semitones renders as
// a full-height leap and reads as a dramatic melody. An octave floor keeps a
// flat part flat.

describe('the clip preview places pitches honestly', () => {
    it('centres a part that never moves', () => {
        expect(pitchPosition(60, 60, 60)).toBeCloseTo(0.5, 5);
    });

    it('keeps a narrow part in a narrow band rather than filling the lane', () => {
        const low = pitchPosition(60, 60, 62);
        const high = pitchPosition(62, 60, 62);

        // Two semitones of movement must stay near the middle...
        expect(high - low).toBeCloseTo(2 / 12, 5);
        // ...and must not reach either edge, which is what "filling the lane" means.
        expect(low).toBeGreaterThan(0.4);
        expect(high).toBeLessThan(0.6);
    });

    it('lets a part that ranges wider use the whole lane', () => {
        expect(pitchPosition(48, 48, 72)).toBeCloseTo(0, 5);
        expect(pitchPosition(72, 48, 72)).toBeCloseTo(1, 5);
        expect(pitchPosition(60, 48, 72)).toBeCloseTo(0.5, 5);
    });

    it('uses the full lane exactly at an octave, and not before', () => {
        // An octave is the floor, so its top note reaches the top of the lane
        // and its bottom note reaches the bottom.
        expect(pitchPosition(72, 60, 72)).toBeCloseTo(1, 5);
        expect(pitchPosition(60, 60, 72)).toBeCloseTo(0, 5);
        // An eleventh is under the floor, so it still holds something back.
        expect(pitchPosition(71, 60, 71)).toBeLessThan(1);
        expect(pitchPosition(60, 60, 71)).toBeGreaterThan(0);
    });

    it('is monotonic — a higher note never draws lower', () => {
        const lowest = 55;
        const highest = 79;
        let previous = -Infinity;
        for (let pitch = lowest; pitch <= highest; pitch++) {
            const position = pitchPosition(pitch, lowest, highest);
            expect(position).toBeGreaterThan(previous);
            previous = position;
        }
    });
});
