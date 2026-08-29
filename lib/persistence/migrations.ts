// ============================================
// ComposeYogi — IndexedDB Migrations
// ============================================
//
// One ordered, numbered step per schema version. `openDB`'s upgrade callback
// runs every migration whose version is greater than the browser's current
// database version, in order, inside a single version-change transaction — so a
// user coming back after six months gets v1 → v2 → v3 applied in sequence, and
// a brand-new user gets all of them against an empty database.
//
// Rules for adding one:
//   1. Append a new entry; never renumber or edit a shipped migration. Someone
//      out there has already run it.
//   2. Bump DB_VERSION in db.ts to match the highest version here.
//   3. Store creation must stay idempotent (`if (!contains) create`) so a
//      partially-upgraded database can still be repaired.
//   4. Data rewrites use the transaction passed in — opening a new one inside
//      an upgrade deadlocks.

import type { IDBPDatabase, IDBPTransaction } from 'idb';

import { createLogger } from '@/lib/logger';

const logger = createLogger('DB:migrate');

/* eslint-disable @typescript-eslint/no-explicit-any -- migrations run against
   historical schemas, which by definition do not match today's typed schema. */

export interface Migration {
    version: number;
    name: string;
    run: (
        db: IDBPDatabase<any>,
        transaction: IDBPTransaction<any, any, 'versionchange'>
    ) => void | Promise<void>;
}

export const MIGRATIONS: Migration[] = [
    {
        version: 1,
        name: 'initial-schema',
        run: (db) => {
            if (!db.objectStoreNames.contains('projects')) {
                const projects = db.createObjectStore('projects', { keyPath: 'id' });
                projects.createIndex('by-updated', 'updatedAt');
            }

            if (!db.objectStoreNames.contains('tracks')) {
                const tracks = db.createObjectStore('tracks', { keyPath: 'id' });
                tracks.createIndex('by-project', 'projectId');
            }

            if (!db.objectStoreNames.contains('clips')) {
                const clips = db.createObjectStore('clips', { keyPath: 'id' });
                clips.createIndex('by-track', 'trackId');
                clips.createIndex('by-project', 'projectId');
            }

            if (!db.objectStoreNames.contains('audioTakes')) {
                const takes = db.createObjectStore('audioTakes', { keyPath: 'id' });
                takes.createIndex('by-clip', 'clipId');
            }

            if (!db.objectStoreNames.contains('settings')) {
                db.createObjectStore('settings', { keyPath: 'key' });
            }
        },
    },
    {
        version: 2,
        name: 'user-samples',
        run: (db) => {
            if (!db.objectStoreNames.contains('userSamples')) {
                const samples = db.createObjectStore('userSamples', { keyPath: 'id' });
                samples.createIndex('by-created', 'createdAt');
            }
        },
    },
    {
        // Groove and Space started life at 50, alongside Energy and Brightness,
        // back when no macro did anything. Now that they drive DSP the centre is
        // the wrong neutral for them: there is no "less than straight" and no
        // "drier than dry", so their neutral is 0 and the whole slider swings or
        // reverberates. Left at 50 every clip ever saved would suddenly play
        // half-swung and wet.
        //
        // Only the untouched default is rewritten. Nothing else can have set
        // these — no UI exposed them until now — but matching exactly is what
        // makes it safe to run against a database this assumption is wrong about.
        version: 3,
        name: 'macro-neutral-defaults',
        run: async (_db, transaction) => {
            const clips = transaction.objectStore('clips');

            for await (const cursor of clips.iterate()) {
                const clip = cursor.value as { groove?: number; space?: number };
                if (clip.groove !== 50 && clip.space !== 50) continue;

                await cursor.update({
                    ...clip,
                    groove: clip.groove === 50 ? 0 : clip.groove,
                    space: clip.space === 50 ? 0 : clip.space,
                });
            }
        },
    },
    {
        // `pentatonic` was the one scale the type knew about that no picker
        // offered and no translation covered, and it sat next to a picker
        // offering five scales the type did not have. Consolidating the two
        // lists in lib/music/scales.ts settles on the picker's names, which
        // leaves this one legacy value with nowhere to go.
        //
        // Minor rather than major: `pentatonic`'s intervals were [0,2,4,7,9] —
        // the major pentatonic — but it could only ever have been set on a
        // project whose *default* was minor, and only by hand. Neither answer
        // is provably right; a valid scale that highlights something is better
        // than a value the app no longer has intervals for.
        version: 4,
        name: 'legacy-pentatonic-scale',
        run: async (_db, transaction) => {
            const projects = transaction.objectStore('projects');

            for await (const cursor of projects.iterate()) {
                const project = cursor.value as { scale?: string };
                if (project.scale !== 'pentatonic') continue;

                await cursor.update({ ...project, scale: 'pentatonicMinor' });
            }
        },
    },
];

/** Highest migration version — db.ts opens the database at this version. */
export const LATEST_VERSION = MIGRATIONS.reduce(
    (max, migration) => Math.max(max, migration.version),
    0
);

/**
 * Apply every migration newer than `oldVersion`, in order.
 * Called from the `upgrade` callback of `openDB`.
 */
export async function runMigrations(
    db: IDBPDatabase<any>,
    oldVersion: number,
    newVersion: number | null,
    transaction: IDBPTransaction<any, any, 'versionchange'>
): Promise<void> {
    const target = newVersion ?? LATEST_VERSION;
    const pending = MIGRATIONS
        .filter((m) => m.version > oldVersion && m.version <= target)
        .sort((a, b) => a.version - b.version);

    if (pending.length === 0) return;

    logger.info('Upgrading database', {
        from: oldVersion,
        to: target,
        migrations: pending.map((m) => `${m.version}:${m.name}`),
    });

    for (const migration of pending) {
        await migration.run(db, transaction);
    }
}
