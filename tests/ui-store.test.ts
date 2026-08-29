// ============================================
// ComposeYogi — UI Store Tests
// ============================================
//
// These exist because of one bug that shipped in v1.0 and survived every
// release since: the store exposed `selectedClipId` as a getter derived from
// `selectedClipIds`, and it silently stopped working after the first update.
//
// Zustand merges with `Object.assign({}, state, partial)`, and Object.assign
// *invokes* a getter on the source and copies the value it returned. So the
// first set() replaced the getter with a snapshot of the state before that
// update, and every read afterwards returned that frozen value. Selecting a
// clip never opened the Inspector's clip panel, and nothing anywhere threw.

import { beforeEach, describe, expect, it } from 'vitest';

import {
    selectCollapsedSections,
    selectEditorSnap,
    selectHasSelection,
    selectIsMultiSelect,
    selectSelectedClipId,
    selectTimelineSnap,
    useUIStore,
} from '@/lib/store/ui';

import type { InspectorSectionId } from '@/types';

const initial = useUIStore.getState();

/**
 * Property descriptors of the store as it was created.
 *
 * Captured at module load because this is the only moment a getter is still
 * observable: the first set() copies it by value, so by the time any test has
 * touched the store the evidence is gone and the check would pass vacuously.
 */
const INITIAL_DESCRIPTORS = Object.getOwnPropertyDescriptors(initial);

beforeEach(() => {
    useUIStore.setState(initial, true);
});

describe('derived selection state', () => {
    it('is null when nothing is selected', () => {
        expect(selectSelectedClipId(useUIStore.getState())).toBeNull();
    });

    it('follows the selection', () => {
        useUIStore.getState().selectClip('clip-a');
        expect(selectSelectedClipId(useUIStore.getState())).toBe('clip-a');
    });

    // The regression itself: derived state must keep tracking after later
    // updates, not freeze at whatever it was on the first one.
    it('keeps tracking across repeated updates', () => {
        const { selectClip } = useUIStore.getState();

        for (const id of ['clip-a', 'clip-b', 'clip-c']) {
            selectClip(id);
            expect(selectSelectedClipId(useUIStore.getState())).toBe(id);
        }
    });

    it('still tracks after an unrelated part of the store changes', () => {
        useUIStore.getState().selectClip('clip-a');
        useUIStore.getState().setScrollX(120);
        useUIStore.getState().selectClip('clip-b');

        expect(selectSelectedClipId(useUIStore.getState())).toBe('clip-b');
    });

    it('reports the first of a multi-selection', () => {
        useUIStore.getState().selectClips(['clip-a', 'clip-b']);

        const state = useUIStore.getState();
        expect(selectSelectedClipId(state)).toBe('clip-a');
        expect(selectHasSelection(state)).toBe(true);
        expect(selectIsMultiSelect(state)).toBe(true);
    });

    it('clears with the selection', () => {
        useUIStore.getState().selectClip('clip-a');
        useUIStore.getState().clearSelection();
        expect(selectSelectedClipId(useUIStore.getState())).toBeNull();
    });
});

describe('collapsible inspector sections', () => {
    const ALL_SECTIONS: InspectorSectionId[] = ['project', 'track', 'effects', 'clip', 'feel'];

    it('starts with every section expanded', () => {
        // Absent means expanded, so a section added later is open until
        // somebody closes it rather than hidden by default.
        const collapsed = selectCollapsedSections(useUIStore.getState());
        for (const section of ALL_SECTIONS) {
            expect(Boolean(collapsed[section]), `${section} should start expanded`).toBe(false);
        }
    });

    it('folds and unfolds a section', () => {
        const { toggleSection } = useUIStore.getState();

        toggleSection('effects');
        expect(selectCollapsedSections(useUIStore.getState()).effects).toBe(true);

        toggleSection('effects');
        expect(selectCollapsedSections(useUIStore.getState()).effects).toBe(false);
    });

    it('folding one section leaves the others as they were', () => {
        // Asserting the untouched sections are *expanded* proves nothing here:
        // absent and expanded read alike, so a toggle that wiped the whole map
        // would pass. Folding two and checking both survive is what catches it.
        const { toggleSection } = useUIStore.getState();

        toggleSection('effects');
        toggleSection('feel');

        const collapsed = selectCollapsedSections(useUIStore.getState());
        expect(collapsed.effects, 'folding feel unfolded effects').toBe(true);
        expect(collapsed.feel).toBe(true);

        // And unfolding one leaves the other folded.
        toggleSection('feel');
        expect(selectCollapsedSections(useUIStore.getState()).effects).toBe(true);
    });

    it('keeps a section folded across a selection change', () => {
        // The clip and track sections unmount whenever the selection changes.
        // A fold that reopened itself every time you picked a different clip
        // would be worse than no fold at all, which is why this is store state
        // and not local state.
        useUIStore.getState().toggleSection('clip');
        useUIStore.getState().selectClip('clip-a');
        useUIStore.getState().selectClip('clip-b');

        expect(selectCollapsedSections(useUIStore.getState()).clip).toBe(true);
    });

    it('replaces the map rather than mutating it', () => {
        // Zustand compares by reference; mutating in place would leave
        // subscribed components unaware that anything changed.
        const before = selectCollapsedSections(useUIStore.getState());
        useUIStore.getState().toggleSection('project');

        expect(selectCollapsedSections(useUIStore.getState())).not.toBe(before);
    });
});

describe('snap settings', () => {
    it('starts each surface at what it used to be hard-coded to', () => {
        // Neither surface had a control before, so these are not new defaults —
        // they are the behaviour people already have, now visible.
        expect(selectTimelineSnap(useUIStore.getState())).toBe('1/4');
        expect(selectEditorSnap(useUIStore.getState())).toBe('1/16');
    });

    it('keeps the two apart', () => {
        // A shared value would make one of the two views unusable every time
        // you changed the other: you place clips against bars in the
        // arrangement and draw sixteenths in the piano roll.
        useUIStore.getState().setEditorSnap('1/8T');

        expect(selectEditorSnap(useUIStore.getState())).toBe('1/8T');
        expect(selectTimelineSnap(useUIStore.getState())).toBe('1/4');

        useUIStore.getState().setTimelineSnap('off');

        expect(selectTimelineSnap(useUIStore.getState())).toBe('off');
        expect(selectEditorSnap(useUIStore.getState())).toBe('1/8T');
    });
});

describe('store shape', () => {
    // The mechanism rather than the symptom: any getter on the store object is
    // frozen by the first update, whatever it happens to derive from.
    it('exposes no getters — zustand would freeze them on the first update', () => {
        const getters = Object.entries(INITIAL_DESCRIPTORS)
            .filter(([, descriptor]) => typeof descriptor.get === 'function')
            .map(([key]) => key);

        expect(
            getters,
            'Derived state belongs in a selector at the bottom of ui.ts. A getter ' +
            'here is copied by value on the next set() and never updates again.'
        ).toEqual([]);
    });
});
