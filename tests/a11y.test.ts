// ============================================
// ComposeYogi — Accessibility Conformance
// ============================================
//
// A control with no accessible name is invisible to a screen reader, and the
// failure is completely silent: nothing throws, the caption is right there on
// screen, and the panel looks finished. The Inspector shipped that way from
// v1.0 — every field rendered a <Label> carrying no `htmlFor` beside a control
// carrying no `id`, so Key, Scale, the track pickers and every effect slider
// announced as unnamed. Radix is what makes it easy to get wrong: it puts
// `role="combobox"` on a Select's *trigger* and `role="slider"` on a Slider's
// *thumb*, so an attribute left on the wrapper reaches neither.
//
// These tests read the JSX rather than a rendered page, so they catch the
// mistake in the file where it was made. Two rules:
//
//   1. A <Label> must point at something.
//   2. A control must have a name from somewhere.
//
// What they cannot check is whether a pairing is *correct* — an `id` that no
// label references still passes rule 2. The Inspector routes both ids through
// one `Field` component so the pairing is made once, and it was verified in a
// browser by computing accessible names.
//
// Deliberately out of scope: icon-only buttons, which are named by their
// tooltip today and are a separate, larger sweep. Add them here when they are
// fixed, not before — a test that is expected to fail teaches people to ignore
// it.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const ROOT = join(__dirname, '..');
const SOURCE_DIRS = ['app', 'components'];

/**
 * Elements that render something a screen reader announces as a control, and
 * that carry no text of their own to fall back on.
 *
 * The raw intrinsics are here alongside the wrappers because that is how four
 * of them got in: the volume fader on every track, the manual-latency fallback
 * and the browser's search box are plain `<input>`s, so a rule that only knew
 * about `<Input>` walked straight past them.
 */
const NAMED_CONTROLS = new Set([
    'SelectTrigger', 'Input', 'Slider', 'Textarea', 'Switch',
    'input', 'select', 'textarea',
]);

/** Checked only when they turn out to render no text of their own. */
const BUTTONS = new Set(['Button', 'button']);

/** Raw inputs that render no control a name could belong to. */
const UNNAMEABLE_INPUT_TYPES = new Set(['hidden', 'submit', 'reset', 'button', 'image']);

/**
 * `display: none` removes an element from the accessibility tree entirely, so
 * there is nothing there to name — the file pickers behind "Import" are real
 * inputs that no one, sighted or not, ever reaches directly.
 *
 * Matched exactly, not as a class token: `hidden 2xl:inline` is *visible* at
 * 2xl and still needs a name. That combination is in this codebase already.
 */
const VISUALLY_REMOVED = 'hidden';

/** Any one of these gives the control a name. */
const NAMING_ATTRIBUTES = ['aria-label', 'aria-labelledby', 'id'];

// ============================================
// Helpers
// ============================================

function walk(dir: string, match: RegExp): string[] {
    const found: string[] = [];
    for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) found.push(...walk(full, match));
        else if (match.test(entry)) found.push(full);
    }
    return found;
}

function parse(file: string): ts.SourceFile {
    return ts.createSourceFile(
        file,
        readFileSync(file, 'utf8'),
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TSX
    );
}

function report(sf: ts.SourceFile, node: ts.Node, text: string): string {
    const line = sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
    return `${relative(ROOT, sf.fileName)}:${line}  ${text}`;
}

function attributeNames(element: ts.JsxOpeningLikeElement, sf: ts.SourceFile): Set<string> {
    const names = new Set<string>();
    for (const attribute of element.attributes.properties) {
        // A spread could carry anything; treat it as opaque rather than
        // guessing, and let the explicit attributes decide.
        if (ts.isJsxSpreadAttribute(attribute)) {
            names.add('...spread');
            continue;
        }
        names.add(attribute.name.getText(sf));
    }
    return names;
}

function eachOpeningElement(
    sf: ts.SourceFile,
    visit: (element: ts.JsxOpeningLikeElement, tag: string) => void
): void {
    const walkNode = (node: ts.Node) => {
        if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
            visit(node, node.tagName.getText(sf));
        }
        ts.forEachChild(node, walkNode);
    };
    ts.forEachChild(sf, walkNode);
}

/** The literal value of a JSX attribute, when it has one. */
function stringAttribute(
    element: ts.JsxOpeningLikeElement,
    name: string,
    sf: ts.SourceFile
): string | null {
    for (const attribute of element.attributes.properties) {
        if (ts.isJsxSpreadAttribute(attribute)) continue;
        if (attribute.name.getText(sf) !== name) continue;

        const initializer = attribute.initializer;
        if (initializer && ts.isStringLiteral(initializer)) return initializer.text;
    }
    return null;
}

/** Nothing a screen reader will ever reach, so nothing to name. */
function isUnnameableInput(element: ts.JsxOpeningLikeElement, sf: ts.SourceFile): boolean {
    if (stringAttribute(element, 'className', sf) === VISUALLY_REMOVED) return true;
    if (stringAttribute(element, 'aria-hidden', sf) === 'true') return true;

    if (element.tagName.getText(sf) !== 'input') return false;
    const type = stringAttribute(element, 'type', sf);
    return type !== null && UNNAMEABLE_INPUT_TYPES.has(type);
}

function componentFiles(): ts.SourceFile[] {
    return SOURCE_DIRS
        .flatMap((dir) => walk(join(ROOT, dir), /\.tsx$/))
        .sort()
        .map(parse);
}

// ============================================
// 1 — A label must point at something
// ============================================

describe('every label names a control', () => {
    it('carries an htmlFor, or an id for aria-labelledby to reference', () => {
        const orphans: string[] = [];

        for (const sf of componentFiles()) {
            // The primitive itself is the definition, not a usage.
            if (sf.fileName.endsWith(join('components', 'ui', 'label.tsx'))) continue;

            eachOpeningElement(sf, (element, tag) => {
                if (tag !== 'Label') return;
                const attributes = attributeNames(element, sf);
                if (attributes.has('htmlFor') || attributes.has('id') || attributes.has('...spread')) return;

                orphans.push(report(sf, element, '<Label> with neither htmlFor nor id'));
            });
        }

        expect(
            orphans,
            'A <Label> with no htmlFor and no id is visible text, not a label. Give it ' +
            'htmlFor and put the same id on the control, or an id for the control to ' +
            'reference with aria-labelledby. If it names no control at all, it is a ' +
            'caption — use a <span>.'
        ).toEqual([]);
    });
});

/**
 * True when a button renders nothing a screen reader could read as its name.
 *
 * Deliberately conservative: any text at all, and any expression that might
 * evaluate to text (a `t()` call, a prop, a variable) counts as named, so this
 * under-reports rather than flagging buttons that are already fine. What is
 * left is the genuine icon-only case — an element or two and whitespace.
 *
 * A tooltip does not count, which is the trap. Radix Tooltip sets
 * `aria-describedby` on its trigger: a description, read *after* the name, and
 * only once focus has already landed somewhere the user cannot identify.
 */
function rendersNoText(element: ts.JsxElement, sf: ts.SourceFile): boolean {
    let text = false;

    const visit = (node: ts.Node) => {
        if (text) return;
        if (ts.isJsxText(node) && node.text.trim()) {
            text = true;
            return;
        }
        if (ts.isJsxExpression(node) && node.expression) {
            // `{icon}`, `{t('play')}`, `{count}` — anything that is not plainly
            // an element could put characters on screen.
            const inner = node.expression;
            const isElement = ts.isJsxElement(inner) || ts.isJsxSelfClosingElement(inner)
                || ts.isJsxFragment(inner);
            if (!isElement && !ts.isConditionalExpression(inner) && !ts.isBinaryExpression(inner)) {
                text = true;
                return;
            }
        }
        ts.forEachChild(node, visit);
    };

    element.children.forEach(visit);
    return !text;
}

// ============================================
// 2 — A control must have a name from somewhere
// ============================================

describe('every control can be named', () => {
    it('has an aria-label, an aria-labelledby, or an id a label can point at', () => {
        const unnamed: string[] = [];

        for (const sf of componentFiles()) {
            if (sf.fileName.includes(join('components', 'ui'))) continue; // primitives take it from callers

            eachOpeningElement(sf, (element, tag) => {
                if (!NAMED_CONTROLS.has(tag)) return;
                if (isUnnameableInput(element, sf)) return;

                const attributes = attributeNames(element, sf);
                if (attributes.has('...spread')) return;
                if (NAMING_ATTRIBUTES.some((name) => attributes.has(name))) return;

                unnamed.push(report(sf, element, `<${tag}> has no accessible name`));
            });
        }

        expect(
            unnamed,
            'Radix puts role="combobox" on a SelectTrigger and role="slider" on a ' +
            "Slider's thumb, so neither inherits a nearby caption. Pair it with a " +
            '<Label htmlFor>, point it at one with aria-labelledby, or give it an ' +
            'aria-label. A placeholder is not an accessible name.'
        ).toEqual([]);
    });
});

// ============================================
// 3 — An icon is not a name
// ============================================

describe('every icon-only button says what it does', () => {
    it('carries an aria-label, because a tooltip is a description and not a name', () => {
        const unnamed: string[] = [];

        for (const sf of componentFiles()) {
            if (sf.fileName.includes(join('components', 'ui'))) continue;

            const visit = (node: ts.Node) => {
                if (ts.isJsxElement(node)) {
                    const opening = node.openingElement;
                    const tag = opening.tagName.getText(sf);

                    if (BUTTONS.has(tag) && rendersNoText(node, sf)) {
                        const attributes = attributeNames(opening, sf);
                        const named = attributes.has('...spread')
                            || NAMING_ATTRIBUTES.some((name) => attributes.has(name))
                            || attributes.has('title');

                        if (!named) {
                            unnamed.push(report(sf, opening, `<${tag}> renders only an icon and has no name`));
                        }
                    }
                }
                ts.forEachChild(node, visit);
            };
            ts.forEachChild(sf, visit);
        }

        expect(
            unnamed,
            'A button whose only content is an icon is announced as "button" and nothing ' +
            'else. Give it aria-label — the tooltip beside it already holds the ' +
            'translated string, and Radix Tooltip only supplies aria-describedby.'
        ).toEqual([]);
    });
});

// ============================================
// 4 — A modal must be a dialog
// ============================================

/**
 * The overlay a hand-rolled modal is built from.
 *
 * Three of them existed — the shortcuts sheet, latency calibration, and the iOS
 * install instructions — each a `<div>` painted over the page. They looked
 * right and behaved almost right, and were missing everything a dialog is:
 * `role="dialog"` and `aria-modal`, a name taken from the heading, a focus trap
 * (Tab walked straight out into the studio behind), focus restored to whatever
 * opened it, and Escape. The primitives in components/ui/dialog.tsx bring all
 * of that, and three sibling modals were already using them.
 */
const OVERLAY_CLASS = /\bfixed\s+inset-0\b/;

describe('every modal is a real dialog', () => {
    it('builds full-screen overlays from the dialog primitives, not from a div', () => {
        const handRolled: string[] = [];

        for (const sf of componentFiles()) {
            // The primitives are where the overlay is supposed to be written.
            if (sf.fileName.includes(join('components', 'ui'))) continue;

            eachOpeningElement(sf, (element, tag) => {
                const className = stringAttribute(element, 'className', sf);
                if (!className || !OVERLAY_CLASS.test(className)) return;

                handRolled.push(report(sf, element, `<${tag}> is a hand-rolled full-screen overlay`));
            });
        }

        expect(
            handRolled,
            'Use Dialog/DialogContent (or AlertDialog) from components/ui. A div over the ' +
            'page has no role, no name, no focus trap, no focus restore and no Escape — ' +
            'and every one of those is invisible until somebody tries to use it.'
        ).toEqual([]);
    });
});

// ============================================
// 5 — Use the design system's own components
// ============================================

/**
 * Hand-rolled UI is how a design system quietly stops being one.
 *
 * The studio had accumulated a browser `confirm()` for deleting a sample, a
 * `window.alert()` of iOS install steps, three `<input type="range">` faders
 * that did not look like the Radix sliders next to them, and nine native
 * `title=` tooltips rendered by the OS rather than by `components/ui/tooltip`.
 * Every one of them was *nearly* right, which is why they survived: they work,
 * they are just visibly not the same application.
 *
 * `components/ui` is exempt — that is where the primitives are defined.
 */
const HAND_ROLLED = [
    {
        pattern: /(?<![\w.])(confirm|alert|prompt)\s*\(/,
        what: 'a browser dialog',
        instead: 'AlertDialog from components/ui — window.confirm/alert cannot be themed, ' +
            'translated by next-intl, or made to match anything else on the page.',
    },
    {
        pattern: /<input[^>]*type=["']range["']/,
        what: 'a native range input',
        instead: 'Slider from components/ui — the native thumb and track ignore the tokens.',
    },
];

/** `title=` on anything is a tooltip the OS draws, not the one in components/ui. */
const NATIVE_TITLE = /\stitle=\{?["'a-z]/;

/**
 * Where a native `title` is still the right answer.
 *
 * The drum grid renders a tooltip per step across 256 steps. It is virtualized
 * for 60fps, and a Radix Tooltip subscribes each cell to a provider — the cost
 * lands exactly where this app cannot afford it.
 */
const NATIVE_TITLE_ALLOWED = new Set([join('components', 'compose', 'editors', 'DrumSequencer.tsx')]);

describe('the design system is the only source of UI', () => {
    it.each(HAND_ROLLED)('has no $what', ({ pattern, instead }) => {
        const found: string[] = [];

        for (const sf of componentFiles()) {
            if (sf.fileName.includes(join('components', 'ui'))) continue;

            sf.getFullText().split('\n').forEach((line, i) => {
                if (line.trim().startsWith('//') || line.trim().startsWith('*')) return;
                if (pattern.test(line)) {
                    found.push(`${relative(ROOT, sf.fileName)}:${i + 1}  ${line.trim().slice(0, 70)}`);
                }
            });
        }

        expect(found, `Use ${instead}`).toEqual([]);
    });

    it('draws tooltips with the Tooltip component, not the title attribute', () => {
        const found: string[] = [];

        for (const sf of componentFiles()) {
            if (sf.fileName.includes(join('components', 'ui'))) continue;
            if ([...NATIVE_TITLE_ALLOWED].some((allowed) => sf.fileName.endsWith(allowed))) continue;

            eachOpeningElement(sf, (element, tag) => {
                // `title` is also an ordinary prop name on our own components.
                if (/^[A-Z]/.test(tag)) return;
                if (!attributeNames(element, sf).has('title')) return;

                found.push(report(sf, element, `<${tag}> uses a native title= tooltip`));
            });
        }

        expect(
            found,
            'A native title is drawn by the OS after its own delay, in its own font, ' +
            'and never on touch. Wrap the element in <Tooltip> and give it an aria-label.'
        ).toEqual([]);
    });
});

// ============================================
// 6 — The cursor names the gesture
// ============================================

/**
 * design/README.md, "The cursor names the gesture".
 *
 * The pointer is the smallest promise the interface makes and it gets made
 * hundreds of times a session, so it is decided once per primitive rather than
 * per call site. It was not: the piano roll's velocity slider offered a hand and
 * the identical sliders in the Inspector two panels away offered an arrow.
 *
 * Both halves are checked. A primitive that loses its cursor takes every call
 * site with it, and a call site that adds one back is either overriding the
 * primitive or quietly re-implementing it.
 */
const PRIMITIVE_CURSORS = [
    { file: join('components', 'ui', 'button.tsx'), required: ['cursor-pointer', 'disabled:cursor-not-allowed'] },
    { file: join('components', 'ui', 'select.tsx'), required: ['cursor-pointer', 'disabled:cursor-not-allowed'] },
    { file: join('components', 'ui', 'slider.tsx'), required: ['cursor-pointer', 'cursor-grab', 'active:cursor-grabbing'] },
];

/** Components whose cursor is already settled by the primitive. */
const CURSOR_OWNED_BY_PRIMITIVE = new Set(['Button', 'Slider', 'SelectTrigger']);

describe('the cursor names the gesture', () => {
    it.each(PRIMITIVE_CURSORS)('$file declares its own', ({ file, required }) => {
        // Whole class tokens, not substrings: `active:cursor-grabbing` contains
        // `cursor-grab`, so a naive includes() passes with the thumb's cursor
        // deleted. This check did exactly that until it was mutation-tested.
        const classes = new Set(
            readFileSync(join(ROOT, file), 'utf8').split(/[\s"'`]+/).filter(Boolean)
        );
        const missing = required.filter((cls) => !classes.has(cls));

        expect(
            missing,
            `${file} is where this cursor is decided for every call site. Removing it ` +
            'here does not fall back to anything — it just becomes an arrow everywhere.'
        ).toEqual([]);
    });

    it('is not repeated on a component that already has one', () => {
        const repeated: string[] = [];

        for (const sf of componentFiles()) {
            if (sf.fileName.includes(join('components', 'ui'))) continue;

            eachOpeningElement(sf, (element, tag) => {
                if (!CURSOR_OWNED_BY_PRIMITIVE.has(tag)) return;
                const className = stringAttribute(element, 'className', sf);
                if (!className || !/\bcursor-/.test(className)) return;

                repeated.push(report(sf, element, `<${tag}> sets its own cursor`));
            });
        }

        expect(
            repeated,
            'Button, Slider and SelectTrigger carry their cursor already. Repeating it ' +
            'here is how the two drift apart the next time one of them changes.'
        ).toEqual([]);
    });
});
