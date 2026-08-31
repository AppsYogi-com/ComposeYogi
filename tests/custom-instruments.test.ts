// ============================================
// ComposeYogi — Custom Instrument Tests (#21)
// ============================================
//
// The registry, its database, and the file format. Everything here runs against
// a real (fake-indexeddb) database, so the persistence path under test is the
// one that ships.
//
// Nothing here constructs a Tone node — it cannot, in Node — so the audio side
// is covered by `instrument-spec.test.ts` proving the options are right and by
// a manual pass in a real browser. What *is* covered here is the part that
// fails silently: whether editing an instrument makes the app notice.

import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
    clearCustomInstruments,
    customInstrumentsHash,
    draftFromPreset,
    duplicateCustomInstrument,
    getCustomInstrument,
    getCustomInstruments,
    hydrateCustomInstruments,
    registerCustomInstrument,
    removeCustomInstrument,
    saveCustomInstrument,
    subscribeToCustomInstruments,
} from '@/lib/audio/custom-instruments';
import {
    INSTRUMENT_FILE_EXTENSION,
    INSTRUMENT_SCHEMA_VERSION,
    exportInstrumentToJSON,
    importInstrumentFromJSON,
} from '@/lib/audio/instrument-io';
import { CUSTOM_INSTRUMENT_PREFIX, MACRO_RANGES } from '@/lib/audio/instrument-spec';
import { deleteCustomInstrument, listCustomInstruments, loadCustomInstrument } from '@/lib/persistence/db';

import type { CustomInstrument, InstrumentSpec } from '@/types';

async function wipe(): Promise<void> {
    for (const instrument of await listCustomInstruments()) {
        await deleteCustomInstrument(instrument.id);
    }
    clearCustomInstruments();
}

function draft(name = 'My Rhodes'): CustomInstrument {
    const instrument = draftFromPreset('electric-piano', name);
    if (!instrument) throw new Error('electric-piano should be customizable');
    return instrument;
}

beforeEach(wipe);

// ============================================
// Drafting
// ============================================

describe('draftFromPreset', () => {
    it('starts from the real preset, not from a default', () => {
        // The whole feature rests on this: "customize the Electric Piano" has
        // to begin at the Electric Piano, or the starting point is a fiction.
        const instrument = draft();
        expect(instrument.basePresetId).toBe('electric-piano');
        expect(instrument.spec.envelope).toEqual({
            attack: 0.005,
            decay: 0.8,
            sustain: 0.2,
            release: 1.2,
        });
    });

    it('carries the custom prefix so a bare id stays unambiguous', () => {
        expect(draft().id.startsWith(CUSTOM_INSTRUMENT_PREFIX)).toBe(true);
    });

    it('names itself after the preset when no name is given', () => {
        expect(draftFromPreset('electric-piano')?.name).toBe('Electric Piano (Custom)');
    });

    it('refuses presets that are not built from a voice spec', () => {
        expect(draftFromPreset('808-kit')).toBeNull();
        expect(draftFromPreset('drum-sampler')).toBeNull();
        expect(draftFromPreset('does-not-exist')).toBeNull();
    });

    it('does not persist anything', async () => {
        draft();
        expect(await listCustomInstruments()).toHaveLength(0);
        expect(getCustomInstruments()).toHaveLength(0);
    });

    it('gives each draft its own spec object', () => {
        const first = draft();
        const second = draft();
        first.spec.envelope.attack = 3;
        expect(second.spec.envelope.attack).toBe(0.005);
    });
});

// ============================================
// Saving
// ============================================

describe('saveCustomInstrument', () => {
    it('writes to the database and the registry together', async () => {
        const saved = await saveCustomInstrument(draft());
        expect(await loadCustomInstrument(saved.id)).toEqual(saved);
        expect(getCustomInstrument(saved.id)).toEqual(saved);
    });

    it('bumps the revision on every save', async () => {
        const first = await saveCustomInstrument(draft());
        expect(first.revision).toBe(2);
        const second = await saveCustomInstrument(first);
        expect(second.revision).toBe(3);
    });

    it('clamps the spec on the way in', async () => {
        const instrument = draft();
        const spec = instrument.spec as InstrumentSpec;
        spec.brightness = 9999;
        spec.level = -9999;
        const saved = await saveCustomInstrument(instrument);
        expect((saved.spec as InstrumentSpec).brightness).toBe(MACRO_RANGES.brightness.max);
        expect(saved.spec.level).toBe(MACRO_RANGES.level.min);
    });

    it('refuses to store a blank name', async () => {
        const saved = await saveCustomInstrument({ ...draft(), name: '   ' });
        expect(saved.name).toBe('Untitled Instrument');
    });

    it('notifies subscribers', async () => {
        const listener = vi.fn();
        const unsubscribe = subscribeToCustomInstruments(listener);
        await saveCustomInstrument(draft());
        expect(listener).toHaveBeenCalled();

        unsubscribe();
        listener.mockClear();
        await saveCustomInstrument(draft('Another'));
        expect(listener).not.toHaveBeenCalled();
    });

    it('keeps the snapshot stable by reference between mutations', () => {
        // useSyncExternalStore compares snapshots by identity and will loop
        // forever if handed a fresh array on every read.
        expect(getCustomInstruments()).toBe(getCustomInstruments());
    });

    it('lists by name', async () => {
        await saveCustomInstrument(draft('Zither'));
        await saveCustomInstrument(draft('Aardvark'));
        await saveCustomInstrument(draft('Marimba'));
        expect(getCustomInstruments().map((i) => i.name)).toEqual(['Aardvark', 'Marimba', 'Zither']);
    });
});

// ============================================
// The reschedule property
// ============================================

describe('customInstrumentsHash', () => {
    it('changes when an instrument is edited', async () => {
        // This is the guard on the #22 failure mode. `instrumentPreset` holds
        // an id; editing the sound does not change the id; so if this hash did
        // not move, playback would keep the voice built from the old spec and
        // nothing anywhere would say so.
        const saved = await saveCustomInstrument(draft());
        const before = customInstrumentsHash(getCustomInstruments());

        saved.spec.envelope.release = 4;
        await saveCustomInstrument(saved);

        expect(customInstrumentsHash(getCustomInstruments())).not.toBe(before);
    });

    it('changes when one is added or removed', async () => {
        const empty = customInstrumentsHash(getCustomInstruments());
        const saved = await saveCustomInstrument(draft());
        const withOne = customInstrumentsHash(getCustomInstruments());
        expect(withOne).not.toBe(empty);

        await removeCustomInstrument(saved.id);
        expect(customInstrumentsHash(getCustomInstruments())).toBe(empty);
    });

    it('does not change when nothing has', async () => {
        await saveCustomInstrument(draft());
        expect(customInstrumentsHash(getCustomInstruments()))
            .toBe(customInstrumentsHash(getCustomInstruments()));
    });
});

// ============================================
// Duplicating and removing
// ============================================

describe('duplicateCustomInstrument', () => {
    it('copies the sound under a new id', async () => {
        const original = await saveCustomInstrument(draft('Rhodes'));
        const copy = await duplicateCustomInstrument(original.id);

        expect(copy).not.toBeNull();
        expect(copy!.id).not.toBe(original.id);
        expect(copy!.name).toBe('Rhodes copy');
        expect(copy!.spec).toEqual(original.spec);
        expect(copy!.revision).toBe(1);
    });

    it('does not share the spec with the original', async () => {
        const original = await saveCustomInstrument(draft());
        const copy = await duplicateCustomInstrument(original.id);
        copy!.spec.envelope.attack = 2;
        expect(getCustomInstrument(original.id)!.spec.envelope.attack).not.toBe(2);
    });

    it('returns null for an instrument that is not there', async () => {
        expect(await duplicateCustomInstrument('custom:nope')).toBeNull();
    });
});

describe('removeCustomInstrument', () => {
    it('removes it from both the registry and the database', async () => {
        const saved = await saveCustomInstrument(draft());
        await removeCustomInstrument(saved.id);
        expect(getCustomInstrument(saved.id)).toBeUndefined();
        expect(await loadCustomInstrument(saved.id)).toBeNull();
    });
});

// ============================================
// Hydration
// ============================================

describe('hydrateCustomInstruments', () => {
    it('loads what a previous session saved', async () => {
        const saved = await saveCustomInstrument(draft('Persisted'));
        clearCustomInstruments();
        expect(getCustomInstruments()).toHaveLength(0);

        await hydrateCustomInstruments();
        expect(getCustomInstrument(saved.id)).toEqual(saved);
    });

    it('replaces whatever was in memory rather than merging', async () => {
        await saveCustomInstrument(draft('Stored'));
        registerCustomInstrument({ ...draft('Ghost'), id: 'custom:ghost' });

        await hydrateCustomInstruments();
        expect(getCustomInstrument('custom:ghost')).toBeUndefined();
        expect(getCustomInstruments().map((i) => i.name)).toEqual(['Stored']);
    });
});

// ============================================
// Files
// ============================================

describe('instrument files', () => {
    it('round-trips a saved instrument', async () => {
        const saved = await saveCustomInstrument(draft('Travelling Rhodes'));
        const file = JSON.stringify(exportInstrumentToJSON(saved));

        const { instrument, error } = importInstrumentFromJSON(file);
        expect(error).toBeUndefined();
        expect(instrument!.name).toBe('Travelling Rhodes');
        expect(instrument!.basePresetId).toBe('electric-piano');
        expect(instrument!.spec).toEqual(saved.spec);
    });

    it('imports as a new instrument rather than overwriting one', async () => {
        // Two people can have edited the same exported file. An import that
        // reused the id would silently replace the local copy.
        const saved = await saveCustomInstrument(draft());
        const file = JSON.stringify(exportInstrumentToJSON(saved));

        const first = importInstrumentFromJSON(file).instrument!;
        const second = importInstrumentFromJSON(file).instrument!;
        expect(first.id).not.toBe(saved.id);
        expect(second.id).not.toBe(first.id);
        expect(first.revision).toBe(1);
    });

    it('leaves this browser\'s bookkeeping out of the file', () => {
        const exported = exportInstrumentToJSON(draft()) as unknown as Record<string, unknown>;
        expect(exported.id).toBeUndefined();
        expect(exported.revision).toBeUndefined();
        expect(exported.createdAt).toBeUndefined();
        expect(exported.schemaVersion).toBe(INSTRUMENT_SCHEMA_VERSION);
    });

    it('uses an extension that says what the file is', () => {
        expect(INSTRUMENT_FILE_EXTENSION).toBe('.cyi.json');
    });

    it('rejects files that are not instruments', () => {
        expect(importInstrumentFromJSON('not json').error).toBe('notJson');
        expect(importInstrumentFromJSON('[]').error).toBe('notInstrument');
        expect(importInstrumentFromJSON('{"type":"composeyogi-project"}').error).toBe('notInstrument');
    });

    it('rejects a schema from a newer version of the app', () => {
        const file = { ...exportInstrumentToJSON(draft()), schemaVersion: '99.0.0' };
        expect(importInstrumentFromJSON(JSON.stringify(file)).error).toBe('newerVersion');
    });

    it('accepts a newer minor version, which can only have added fields', () => {
        const file = { ...exportInstrumentToJSON(draft()), schemaVersion: '1.7.0' };
        expect(importInstrumentFromJSON(JSON.stringify(file)).instrument).not.toBeNull();
    });

    it('rejects a file whose spec cannot be read', () => {
        const file = { ...exportInstrumentToJSON(draft()), spec: { voice: 'granular' } };
        expect(importInstrumentFromJSON(JSON.stringify(file)).error).toBe('badSpec');
    });

    it('falls back rather than keeping a base preset it does not have', () => {
        // The spec makes the sound; the base is only what Revert restores. A
        // dangling reference would be worse than a lossless substitution.
        const file = { ...exportInstrumentToJSON(draft()), basePresetId: 'theremin-from-2029' };
        const { instrument } = importInstrumentFromJSON(JSON.stringify(file));
        expect(instrument!.basePresetId).toBe('basic-synth');
        expect(instrument!.spec.envelope.decay).toBe(0.8); // the sound is untouched
    });

    it('names an unnamed import rather than storing a blank', () => {
        const file = { ...exportInstrumentToJSON(draft()), name: '  ' };
        expect(importInstrumentFromJSON(JSON.stringify(file)).instrument!.name)
            .toBe('Imported Instrument');
    });
});
