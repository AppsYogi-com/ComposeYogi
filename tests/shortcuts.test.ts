// ============================================
// ComposeYogi — Keyboard Hints Tell the Truth
// ============================================
//
// The transport has advertised `R`, `L` and `M` in its tooltips since v1.0 and
// bound none of them, and offered `?` for the shortcuts sheet when only `/`
// worked. None of that was a typo: the hint was written as a `<kbd>` beside the
// button, and the binding lives in `lib/shortcuts`, so no single place ever held
// both halves and nothing could notice they disagreed.
//
// These tests hold them together. A failure prints `path:line  hint`, the same
// as the design-system and i18n suites, so it says where to go.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import ts from 'typescript';
import { describe, expect, it } from 'vitest';

import { SHORTCUT_DEFINITIONS } from '@/lib/shortcuts';

import en from '../messages/en.json';
import es from '../messages/es.json';

const ROOT = join(__dirname, '..');
const SOURCE_DIRS = ['app', 'components'];

/**
 * How one key of a combo is spelled on screen.
 *
 * Two renderings per modifier because `hotkeyToDisplayKeys` picks by platform
 * and the components hardcode the Mac symbols: a test that read the platform
 * would pass on a laptop and fail in CI.
 */
const KEY_SPELLINGS: Record<string, string[]> = {
    mod: ['⌘', 'Ctrl'],
    meta: ['⌘', 'Win'],
    shift: ['⇧', 'Shift'],
    alt: ['⌥', 'Alt'],
    ctrl: ['Ctrl'],
    space: ['Space'],
    enter: ['Enter'],
    escape: ['Esc'],
    delete: ['Delete'],
    backspace: ['⌫'],
    equal: ['+'],
    minus: ['-'],
    slash: ['/'],
};

/**
 * Combos whose printed form is a character rather than its parts spelled out.
 * `⇧/` is not what anyone types on a keycap, and it is not what the tooltip
 * says either.
 */
const COMBO_SPELLINGS: Record<string, string[]> = {
    'shift+slash': ['?'],
};

function spellings(part: string): string[] {
    const key = part.trim().toLowerCase();
    if (KEY_SPELLINGS[key]) return KEY_SPELLINGS[key];
    return key.length === 1 ? [key.toUpperCase()] : [key.charAt(0).toUpperCase() + key.slice(1)];
}

/** Every way a registered shortcut may legitimately be printed. */
function boundSpellings(): Set<string> {
    const printed = new Set<string>();

    for (const def of SHORTCUT_DEFINITIONS) {
        for (const label of def.displayKeys ?? []) printed.add(label);

        for (const combo of def.defaultKey.split(',')) {
            const normalized = combo.trim().toLowerCase();
            if (!normalized) continue;

            for (const alias of COMBO_SPELLINGS[normalized] ?? []) printed.add(alias);

            // The parts of a combo render concatenated ("⌘0", "⌘⇧Z"), so build
            // the product of every part's spellings rather than one of them.
            let forms = [''];
            for (const part of normalized.split('+')) {
                forms = forms.flatMap((prefix) => spellings(part).map((s) => prefix + s));
            }
            for (const form of forms) printed.add(form);
        }
    }

    return printed;
}

function walkTsx(dir: string): string[] {
    const found: string[] = [];
    for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) found.push(...walkTsx(full));
        else if (entry.endsWith('.tsx')) found.push(full);
    }
    return found;
}

/** Every `<kbd>` in the app, with the file and line it is written on. */
function keyboardHints(): { file: string; line: number; text: string }[] {
    const hints: { file: string; line: number; text: string }[] = [];

    for (const file of SOURCE_DIRS.flatMap((dir) => walkTsx(join(ROOT, dir)))) {
        const sf = ts.createSourceFile(
            file,
            readFileSync(file, 'utf8'),
            ts.ScriptTarget.Latest,
            true,
            ts.ScriptKind.TSX
        );

        const visit = (node: ts.Node) => {
            if (ts.isJsxElement(node) && node.openingElement.tagName.getText(sf) === 'kbd') {
                const text = node.children
                    .filter(ts.isJsxText)
                    .map((child) => child.getText(sf).trim())
                    .join('')
                    .trim();

                // An expression child is a hint built at runtime — those already
                // come from the registry, which is the whole point.
                if (text) {
                    hints.push({
                        file: relative(ROOT, file),
                        line: sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1,
                        text,
                    });
                }
            }
            ts.forEachChild(node, visit);
        };
        ts.forEachChild(sf, visit);
    }

    return hints;
}

describe('the keyboard hints name keys that are actually bound', () => {
    it('finds the hints at all', () => {
        // Every rule below passes vacuously on an empty scan.
        expect(keyboardHints().length).toBeGreaterThan(5);
    });

    it('prints no key the registry does not bind', () => {
        const printed = boundSpellings();

        const offenders = keyboardHints()
            .filter((hint) => !printed.has(hint.text))
            .map((hint) => `${hint.file}:${hint.line}  <kbd>${hint.text}</kbd>`);

        expect(
            offenders,
            'a tooltip advertises a key nothing listens for — register it in '
            + 'lib/shortcuts (and wire a useShortcut) or stop printing it:\n'
            + offenders.join('\n')
        ).toEqual([]);
    });

    it('gives every rebindable action its own default combo', () => {
        const claimed = new Map<string, string>();
        const clashes: string[] = [];

        for (const def of SHORTCUT_DEFINITIONS) {
            for (const combo of def.defaultKey.split(',')) {
                const normalized = combo.trim().toLowerCase();
                if (!normalized) continue;
                const owner = claimed.get(normalized);
                if (owner) clashes.push(`"${normalized}" — ${owner} and ${def.id}`);
                else claimed.set(normalized, def.id);
            }
        }

        expect(
            clashes,
            'two shortcuts ship with the same default key, so one of them never '
            + 'fires and the rebind dialog cannot say which:\n' + clashes.join('\n')
        ).toEqual([]);
    });

    it('names every action in both locales', () => {
        const read = (source: unknown, key: string) =>
            key.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown>)?.[part], source);

        const missing = SHORTCUT_DEFINITIONS.flatMap((def) => [
            ...(read(en, `shortcuts.actions.${def.id}`) ? [] : [`en.json  shortcuts.actions.${def.id}`]),
            ...(read(es, `shortcuts.actions.${def.id}`) ? [] : [`es.json  shortcuts.actions.${def.id}`]),
        ]);

        expect(
            missing,
            'the shortcuts sheet reads its labels from `shortcuts.actions.<id>`, and '
            + 'next-intl renders the key path rather than throwing when one is absent:\n'
            + missing.join('\n')
        ).toEqual([]);
    });
});
