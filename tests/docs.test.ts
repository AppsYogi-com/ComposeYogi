// ============================================
// ComposeYogi — Public Documentation Tests
// ============================================
//
// The public documents are what a contributor reads before they read any code,
// and nothing was checking that they were still true. `ARCHITECTURE.md` went a
// whole release out of date without a single test going red: it described none
// of `lib/music/`, which by then was the single source for what a pitch is
// called, which drum a pitch is, and how the keyboard is drawn — three facts
// that had each already caused a shipped bug. Worse, its "Known rough edges"
// invited contributors to implement clip macros and the velocity lane, both of
// which had shipped.
//
// A cadence does not fix that, and neither does remembering. A failing build
// does. These tests are deliberately shallow — they cannot tell you a paragraph
// is *correct*, only that it exists and does not point somewhere nobody can
// follow. That is the part that rots silently.

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const ROOT = join(__dirname, '..');
const read = (relative: string) => readFileSync(join(ROOT, relative), 'utf8');

/** The documents a contributor is pointed at. All tracked, all public. */
const PUBLIC_DOCS = [
    'README.md',
    'ARCHITECTURE.md',
    'CONTRIBUTING.md',
    'ROADMAP.md',
    'CHANGELOG.md',
    'design/README.md',
    '.github/copilot-instructions.md',
];

// ============================================
// Architecture keeps up with the code
// ============================================

describe('ARCHITECTURE.md describes the code that exists', () => {
    it('names every directory under lib/', () => {
        // `lib/<name>/` is the unit a contributor navigates by, and a new one is
        // a new concept — exactly the thing the architecture document exists to
        // introduce. This is the check that would have failed the day
        // `lib/music/` was created and stayed red until someone wrote it up.
        const architecture = read('ARCHITECTURE.md');

        const missing = readdirSync(join(ROOT, 'lib'), { withFileTypes: true })
            .filter((entry) => entry.isDirectory())
            .map((entry) => entry.name)
            .filter((name) => !architecture.includes(`lib/${name}`));

        expect(
            missing,
            'ARCHITECTURE.md does not mention these lib/ directories. A new one is '
            + 'a new concept for a contributor to learn — say what it owns, or say '
            + 'why it does not need explaining.'
        ).toEqual([]);
    });

    it('names the modules that own a single source of truth', () => {
        // These are the files where "there is exactly one answer to this" is the
        // whole design. Every one of them replaced two or three copies that had
        // drifted, and every one of those drifts reached a release. A
        // contributor who does not know they are canonical will add a fourth.
        const architecture = read('ARCHITECTURE.md');

        const canonical = [
            'lib/audio/scheduler.ts',
            'lib/music/pitch.ts',
            'lib/music/percussion.ts',
            'lib/music/scales.ts',
            'lib/audio/preset-specs.ts',
            'lib/design/tokens.ts',
        ];

        const missing = canonical.filter((path) => {
            const file = path.split('/').pop()!;
            return !architecture.includes(path) && !architecture.includes(file);
        });

        expect(
            missing,
            'ARCHITECTURE.md must name each single-source-of-truth module, or a '
            + 'contributor cannot know not to add a second one.'
        ).toEqual([]);
    });

    it('still points at files that exist', () => {
        // A path in prose is a promise. `docs/` was renamed to `internal_docs/`
        // and three tracked source comments were left pointing into it.
        const architecture = read('ARCHITECTURE.md');
        const dead: string[] = [];

        for (const match of architecture.matchAll(/`((?:lib|app|components|hooks|tests|public|scripts)\/[\w./[\]-]+)`/g)) {
            const path = match[1];
            // Only check things that look like a file, not a directory gesture.
            if (!/\.\w+$/.test(path)) continue;
            if (!existsSync(join(ROOT, path))) dead.push(path);
        }

        expect(dead, 'ARCHITECTURE.md names files that are not there').toEqual([]);
    });
});

// ============================================
// Public docs stay reachable
// ============================================

describe('nothing public points somewhere private', () => {
    it('keeps internal_docs out of the public documents', () => {
        // `internal_docs/` is gitignored and maintainer-only. A contributor who
        // clones this repo does not have it, so a reference to it from a public
        // document is an instruction to read something that is not there.
        const offenders: string[] = [];

        for (const doc of PUBLIC_DOCS) {
            read(doc).split('\n').forEach((line, index) => {
                if (/internal_docs\//.test(line)) {
                    offenders.push(`${doc}:${index + 1}  ${line.trim()}`);
                }
            });
        }

        expect(
            offenders,
            'A public document may not send a reader into internal_docs/. State '
            + 'the fact, or move it into ARCHITECTURE.md / CONTRIBUTING.md.'
        ).toEqual([]);
    });

    it('keeps internal_docs out of the source tree', () => {
        // Same rule, and it has already been broken: after the rename, comments
        // in tests/live-play.test.ts, lib/audio/preset-specs.ts and
        // lib/audio/clip-macros.ts still cited docs that ship to nobody.
        const offenders: string[] = [];

        const walk = (dir: string) => {
            for (const entry of readdirSync(join(ROOT, dir), { withFileTypes: true })) {
                const relative = `${dir}/${entry.name}`;
                if (entry.isDirectory()) walk(relative);
                // This file is the one place the banned strings legitimately
                // appear: the rule bans a *reference*, and a reference is what
                // both the regex and its explanation are made of. Same shape as
                // the note-name sampler guard in tests/music.test.ts.
                else if (/\.tsx?$/.test(entry.name) && relative !== 'tests/docs.test.ts') {
                    readFileSync(join(ROOT, relative), 'utf8').split('\n').forEach((line, index) => {
                        if (/internal_docs\/|docs\/(notes|adr)\/|composeyogi_prd|docs\/TaskList/.test(line)) {
                            offenders.push(`${relative}:${index + 1}  ${line.trim()}`);
                        }
                    });
                }
            }
        };
        for (const dir of ['lib', 'components', 'app', 'hooks', 'tests']) walk(dir);

        expect(
            offenders,
            'Source may not cite a maintainer-only document. A contributor cannot '
            + 'read it. Put the fact in the comment, or in ARCHITECTURE.md.'
        ).toEqual([]);
    });

    it('links only to public documents that exist', () => {
        // Relative markdown links between the public docs. A dead one is the
        // cheapest possible bad first impression.
        const dead: string[] = [];

        for (const doc of PUBLIC_DOCS) {
            const from = doc.includes('/') ? doc.split('/').slice(0, -1).join('/') : '.';
            for (const match of read(doc).matchAll(/\]\((?!https?:|#|mailto:)([^)#]+)/g)) {
                const target = join(ROOT, from, match[1]);
                if (!existsSync(target)) dead.push(`${doc} → ${match[1]}`);
            }
        }

        expect(dead, 'a public document links to something that is not there').toEqual([]);
    });
});
