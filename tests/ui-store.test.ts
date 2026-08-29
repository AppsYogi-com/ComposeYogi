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
    selectHasSelection,
    selectIsMultiSelect,
    selectSelectedClipId,
    useUIStore,
} from '@/lib/store/ui';

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
