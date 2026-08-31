// ============================================
// ComposeYogi — Instrument Import / Export (#21)
// ============================================
//
// A custom instrument as a file. The whole sound is already plain JSON, so this
// is mostly envelope: a schema version, a type marker, and a careful reader.
//
// It exists because sharing was the third of the four scoping questions on #21
// and the answer was yes — an instrument someone made is the smallest thing in
// this app worth sending to another person, and it is the piece that will slot
// into shareable links in Sprint 9 without needing a different representation.
//
// The reader assumes the file is hostile. Not because instrument files are a
// likely attack, but because `parseInstrumentSpec` had to be written that way
// regardless and a lenient wrapper around a strict parser is just a strict
// parser with a hole in it.

import { v4 as uuid } from 'uuid';

import { createLogger } from '@/lib/logger';

import { CUSTOM_INSTRUMENT_PREFIX, isDrumSpec, parseInstrumentSpec } from './instrument-spec';
import { isCustomizablePreset, specForPreset } from './preset-specs';

import type { CustomInstrument } from '@/types';

const logger = createLogger('InstrumentIO');

/** Bumped only for a breaking change to the file's shape. */
export const INSTRUMENT_SCHEMA_VERSION = '1.0.0';
export const INSTRUMENT_FILE_EXTENSION = '.cyi.json'; // ComposeYogi Instrument

/** Marks the file as ours. A `.json` on disk says nothing about what is inside. */
const FILE_TYPE = 'composeyogi-instrument';

export interface ExportedInstrument {
    schemaVersion: string;
    type: typeof FILE_TYPE;
    name: string;
    basePresetId: string;
    spec: CustomInstrument['spec'];
    exportedAt: number;
}

export interface InstrumentImportResult {
    instrument: CustomInstrument | null;
    error?: string;
}

// ============================================
// Export
// ============================================

/**
 * The file's contents.
 *
 * Deliberately drops id, revision and timestamps. They describe this browser's
 * copy, not the sound: importing a file should make a new instrument here, not
 * silently overwrite whatever happens to share its id.
 */
export function exportInstrumentToJSON(instrument: CustomInstrument): ExportedInstrument {
    return {
        schemaVersion: INSTRUMENT_SCHEMA_VERSION,
        type: FILE_TYPE,
        name: instrument.name,
        basePresetId: instrument.basePresetId,
        spec: instrument.spec,
        exportedAt: Date.now(),
    };
}

function sanitizeFilename(name: string): string {
    return name
        .replace(/[<>:"/\\|?*]/g, '')
        .replace(/\s+/g, '_')
        .substring(0, 100);
}

/** Save an instrument to the user's disk. */
export function downloadInstrument(instrument: CustomInstrument): void {
    const json = JSON.stringify(exportInstrumentToJSON(instrument), null, 2);
    const blob = new Blob([json], { type: 'application/json' });

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${sanitizeFilename(instrument.name)}${INSTRUMENT_FILE_EXTENSION}`;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    logger.info('Exported instrument', { name: instrument.name });
}

// ============================================
// Import
// ============================================

/**
 * Read an instrument out of a file's text.
 *
 * Returns a *new* instrument — new id, revision 1, timestamps now — so an
 * import can never clobber something already saved here, and importing the same
 * file twice gives two instruments rather than a silent overwrite.
 */
export function importInstrumentFromJSON(jsonContent: string): InstrumentImportResult {
    let parsed: unknown;
    try {
        parsed = JSON.parse(jsonContent);
    } catch {
        return { instrument: null, error: 'notJson' };
    }

    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        return { instrument: null, error: 'notInstrument' };
    }

    const file = parsed as Partial<ExportedInstrument>;
    if (file.type !== FILE_TYPE) return { instrument: null, error: 'notInstrument' };

    // Major version only. A minor bump means fields were added, which an older
    // reader can ignore; a major bump means something it needs has changed
    // meaning, and guessing at that is how you import silence.
    const [fileMajor] = String(file.schemaVersion ?? '').split('.').map(Number);
    const [currentMajor] = INSTRUMENT_SCHEMA_VERSION.split('.').map(Number);
    if (!Number.isFinite(fileMajor) || fileMajor > currentMajor) {
        return { instrument: null, error: 'newerVersion' };
    }

    const spec = parseInstrumentSpec(file.spec);
    if (!spec) return { instrument: null, error: 'badSpec' };

    const name = typeof file.name === 'string' && file.name.trim() ? file.name.trim() : 'Imported Instrument';
    // A base preset from a future version of the app — or a typo — must not
    // become a dangling reference. The spec is what makes the sound; the base
    // is only what Revert would restore, so falling back is lossless in every
    // way that can be heard.
    //
    // The fallback has to match the spec's *kind*, though: Revert reads the base
    // preset, and a drum whose base had fallen back to a synth would turn into a
    // Rhodes on a button labelled Revert. It also has to name a base of the right
    // kind even when the file's own base is a real preset of the wrong one.
    const fallbackBase = isDrumSpec(spec) ? 'drum-synth' : 'basic-synth';
    const namedBase = typeof file.basePresetId === 'string' ? file.basePresetId : '';
    const baseSpec = isCustomizablePreset(namedBase) ? specForPreset(namedBase) : null;
    const basePresetId = baseSpec && isDrumSpec(baseSpec) === isDrumSpec(spec)
        ? namedBase
        : fallbackBase;

    const now = Date.now();
    return {
        instrument: {
            id: `${CUSTOM_INSTRUMENT_PREFIX}${uuid()}`,
            name,
            basePresetId,
            spec,
            revision: 1,
            createdAt: now,
            updatedAt: now,
        },
    };
}

/** Read an instrument from a File the user picked. */
export async function importInstrumentFromFile(file: File): Promise<InstrumentImportResult> {
    try {
        return importInstrumentFromJSON(await file.text());
    } catch (error) {
        logger.error('Failed to read instrument file', { error });
        return { instrument: null, error: 'unreadable' };
    }
}
