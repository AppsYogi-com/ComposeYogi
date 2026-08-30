// ============================================
// ComposeYogi — Custom Instruments (#21)
// ============================================
//
// The runtime side of a user-made instrument: an in-memory registry backed by
// IndexedDB, and the one place a custom voice is constructed.
//
// In-memory because the scheduler resolves instruments *synchronously* — a
// clip becomes sound inside `scheduleMidiClip`, which cannot await a database
// read per clip without stalling playback. This is the same shape as
// `recording-manager`'s take registry, for the same reason, and it carries the
// same obligation: hydrate before anything schedules.
//
// React reads it through `useSyncExternalStore`. That is deliberately not a
// fourth Zustand store — the scheduler and the offline renderer are not React
// and must be able to read this without one, and the state here is genuinely
// external (IndexedDB owns it, not the component tree).

import { useSyncExternalStore } from 'react';
import * as Tone from 'tone';
import { v4 as uuid } from 'uuid';

import { createLogger } from '@/lib/logger';
import {
    deleteCustomInstrument as deleteFromDb,
    listCustomInstruments,
    saveCustomInstrument as saveToDb,
} from '@/lib/persistence/db';

import {
    CUSTOM_INSTRUMENT_PREFIX,
    clampSpec,
    filterSpecFor,
    isCustomInstrumentId,
} from './instrument-spec';
import { specForPreset } from './preset-specs';
import { createVoice, getSynthPreset, type ResolvedInstrument } from './synth-presets';

import type { CustomInstrument, InstrumentSpec } from '@/types';

const logger = createLogger('CustomInstruments');

// ============================================
// Registry
// ============================================

const registry = new Map<string, CustomInstrument>();

/** Cached snapshot. `useSyncExternalStore` compares by reference and will loop
 *  forever if handed a fresh array each read, so this is rebuilt on mutation
 *  and only on mutation. */
let snapshot: CustomInstrument[] = [];
const listeners = new Set<() => void>();

function publish(): void {
    snapshot = [...registry.values()].sort((a, b) => a.name.localeCompare(b.name));
    for (const listener of listeners) listener();
}

/** Subscribe to registry changes. Returns the unsubscribe function. */
export function subscribeToCustomInstruments(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

/** Every custom instrument, by name. Stable by reference between mutations. */
export function getCustomInstruments(): CustomInstrument[] {
    return snapshot;
}

export function getCustomInstrument(id: string | undefined): CustomInstrument | undefined {
    return id ? registry.get(id) : undefined;
}

/** Put one into the registry without touching the database. */
export function registerCustomInstrument(instrument: CustomInstrument): void {
    registry.set(instrument.id, instrument);
    publish();
}

/** Drop everything. Used on teardown and by tests between cases. */
export function clearCustomInstruments(): void {
    registry.clear();
    publish();
}

/**
 * Load every stored instrument into memory.
 *
 * Must complete before the first schedule, or a track pointing at a custom
 * instrument falls back to its track-colour default and plays the wrong sound
 * for one render — audible, and confusing in exactly the way a silent failure
 * is. The compose page awaits this alongside the audio takes.
 */
export async function hydrateCustomInstruments(): Promise<CustomInstrument[]> {
    try {
        const stored = await listCustomInstruments();
        registry.clear();
        for (const instrument of stored) registry.set(instrument.id, instrument);
        publish();
        logger.info('Custom instruments hydrated', { count: stored.length });
        return snapshot;
    } catch (error) {
        logger.error('Failed to hydrate custom instruments', { error });
        return [];
    }
}

// ============================================
// Creating and editing
// ============================================

/**
 * A new instrument starting from a built-in, or null if that built-in has no
 * spec (the drum kits — see `preset-specs.ts`).
 *
 * Not persisted: the editor works on this and saves when the user does, so
 * opening the editor and closing it leaves nothing behind.
 */
export function draftFromPreset(basePresetId: string, name?: string): CustomInstrument | null {
    const spec = specForPreset(basePresetId);
    if (!spec) return null;

    const now = Date.now();
    return {
        id: `${CUSTOM_INSTRUMENT_PREFIX}${uuid()}`,
        name: name || `${getSynthPreset(basePresetId)?.name ?? 'Instrument'} (Custom)`,
        basePresetId,
        spec,
        revision: 1,
        createdAt: now,
        updatedAt: now,
    };
}

/**
 * Persist an instrument and register it.
 *
 * The revision bump is the point. `Track.instrumentPreset` holds an id, and an
 * edit changes the sound without changing the id — so the reschedule hash would
 * see nothing and playback would carry on with the voice built from the
 * previous spec. That is issue #22 in a new place. `revision` is what the hash
 * actually reads; incrementing it here, in the one function that can change a
 * stored sound, is what keeps it honest.
 */
export async function saveCustomInstrument(
    instrument: CustomInstrument,
    { bumpRevision = true }: { bumpRevision?: boolean } = {}
): Promise<CustomInstrument> {
    const saved: CustomInstrument = {
        ...instrument,
        name: instrument.name.trim() || 'Untitled Instrument',
        spec: clampSpec(instrument.spec),
        revision: bumpRevision ? instrument.revision + 1 : instrument.revision,
        updatedAt: Date.now(),
    };

    await saveToDb(saved);
    registerCustomInstrument(saved);
    return saved;
}

/** Copy an instrument under a new id, so editing the copy leaves the original alone. */
export async function duplicateCustomInstrument(id: string): Promise<CustomInstrument | null> {
    const source = registry.get(id);
    if (!source) return null;

    const now = Date.now();
    return saveCustomInstrument(
        {
            ...source,
            id: `${CUSTOM_INSTRUMENT_PREFIX}${uuid()}`,
            name: `${source.name} copy`,
            spec: structuredClone(source.spec),
            revision: 1,
            createdAt: now,
            updatedAt: now,
        },
        { bumpRevision: false }
    );
}

/**
 * Remove an instrument for good.
 *
 * Tracks and clips still pointing at it are deliberately left alone. Rewriting
 * them would be a destructive edit to the project made as a side effect of a
 * delete in a different panel, and it would be undoable only as a project
 * change — so instead the resolution path falls back to the track's colour
 * default, which is what an unknown preset id has always done.
 */
export async function removeCustomInstrument(id: string): Promise<void> {
    await deleteFromDb(id);
    registry.delete(id);
    publish();
}

// ============================================
// Rescheduling
// ============================================

/**
 * What the reschedule hash reads for custom instruments.
 *
 * Id and revision only — the spec itself is not hashed, because the revision
 * already changes whenever the spec can (nothing writes to the registry except
 * `saveCustomInstrument`, which bumps it) and hashing a nested object on every
 * render is a cost with no extra guarantee.
 */
export function customInstrumentsHash(instruments: CustomInstrument[]): string {
    return instruments.map((instrument) => `${instrument.id}@${instrument.revision}`).join(',');
}

// ============================================
// Construction
// ============================================

/**
 * A voice built from a spec. Narrower than `ResolvedInstrument` — a spec always
 * produces a PolySynth, never a Sampler or a NoiseSynth — so callers that
 * actually play notes (the editor's preview) get the polyphonic
 * `triggerAttackRelease` signature rather than the union's narrowest one.
 */
export interface BuiltVoice extends ResolvedInstrument {
    synth: Tone.PolySynth;
}

/**
 * Build a custom instrument's voice and its tone filter.
 *
 * The filter exists only when Brightness has been brought down — see
 * `filterSpecFor`. At full brightness this returns the bare voice with `output`
 * pointing at the synth itself, which is what makes an unedited custom
 * instrument identical to the preset it came from rather than merely close.
 */
export function buildInstrumentFromSpec(spec: InstrumentSpec): BuiltVoice {
    const synth = createVoice(spec);
    const filter = filterSpecFor(spec);

    if (!filter) return { synth, output: synth, nodes: [] };

    const node = new Tone.Filter({ type: 'lowpass', frequency: filter.frequency, Q: filter.Q });
    synth.connect(node);
    return { synth, output: node, nodes: [node] };
}

/**
 * Resolve an `instrumentPreset` string that names a custom instrument.
 *
 * Null for anything else — including a custom id that is no longer in the
 * registry, which happens when a project references an instrument that has been
 * deleted, or one made in another browser. The caller falls back to the
 * built-in path, which is the same behaviour any unknown preset id has always
 * had: a sensible sound rather than silence.
 */
export function resolveCustomInstrument(presetId: string | undefined): ResolvedInstrument | null {
    if (!isCustomInstrumentId(presetId)) return null;

    const instrument = registry.get(presetId as string);
    if (!instrument) {
        logger.warn('Custom instrument not found, falling back', { presetId });
        return null;
    }

    return buildInstrumentFromSpec(instrument.spec);
}

// ============================================
// React
// ============================================

/**
 * The registry, as React state.
 *
 * `useSyncExternalStore` rather than a store of its own: IndexedDB owns this
 * list, the scheduler reads it without React, and the snapshot above is already
 * the stable reference the hook needs. `getCustomInstruments` is also the
 * server snapshot — it returns the empty array before hydration, which is what
 * the server would render anyway.
 */
export function useCustomInstruments(): CustomInstrument[] {
    return useSyncExternalStore(
        subscribeToCustomInstruments,
        getCustomInstruments,
        getCustomInstruments
    );
}
