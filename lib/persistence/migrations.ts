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
