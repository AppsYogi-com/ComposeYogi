// ============================================
// ComposeYogi — Translation Conformance
// ============================================
//
// `npm run validate:locales` only compares en.json against es.json. It cannot
// tell whether the app actually reads either of them, which is how the studio
// shipped with `editor`, `transport`, `inspector` and friends written in both
// locales while every compose component rendered hardcoded English.
//
// These tests close both halves of that gap:
//
//   1. no user-visible string literal survives in components/compose/
//   2. every key in en.json is reached by a `useTranslations` call
//   3. every key a component asks for exists in en.json
//
// A failure prints `path:line  offending text`, the same as the design-system
// suite, so it says where to go rather than only that something is wrong.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const ROOT = join(__dirname, '..');
/**
 * Where user-visible text must be translated.
 *
 * This was components/compose only, which is where the studio lives — and so
 * the untranslated strings all collected in the places nobody looks at: the
 * 404 page, loading states, and screen-reader labels on every dialog.
 */
const TEXT_DIRS = ['app', 'components'];

/**
 * Literals that are not prose and never will be. Keep this short: it is the
 * one place a genuine miss could hide.
 */
const NOT_PROSE = new Set([
    'composeyogi.com/compose', // a URL, drawn inside mock browser chrome
]);

/** Everything that may hold a `useTranslations` call or a message key. */
const SOURCE_DIRS = ['app', 'components', 'lib', 'hooks'];

// ============================================
// What is allowed to stay in English
// ============================================

/**
 * Symbols and unit abbreviations that are written the same way in every locale
 * we ship. A text node made only of these (plus digits and punctuation) is not
 * a translation miss.
 */
const UNIVERSAL_TOKENS = new Set([
    'ms', 's', 'Hz', 'kHz', 'dB', 'px', 'BPM', 'bpm',
]);

/** Proper nouns. The product is not renamed per locale. */
const BRAND_NAMES = new Set(['ComposeYogi']);

/**
 * Pitch-class names. Scientific pitch notation ("C4", "F#") is what every DAW
 * prints on a piano key, in Spanish as much as in English — the solfège names
 * belong to singing, not to a keyboard gutter.
 */
const NOTE_NAME = /^[A-G]#?$/;

/**
 * Elements whose text is a literal keyboard key ("Esc", "V", "⌘0"), not prose.
 * Translating them would misdescribe the key the user has to press.
 */
const LITERAL_TEXT_ELEMENTS = new Set(['kbd']);

/** Attributes that carry text a person reads. */
const LABEL_ATTRIBUTES = new Set([
    'title',
    'placeholder',
    'alt',
    'label',
    'aria-label',
    'aria-description',
    'aria-placeholder',
    'aria-roledescription',
    'aria-valuetext',
]);

/**
 * Message keys that exist on purpose without a caller. Empty, and meant to stay
 * that way: a key with no reader is a string no user will ever see. Add one
 * only with a comment saying which unbuilt screen will consume it.
 */
const INTENTIONALLY_UNREFERENCED: string[] = [];

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

function at(sf: ts.SourceFile, node: ts.Node): number {
    return sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
}

/** `path:line  offending text` — so a failure says where to go. */
function report(sf: ts.SourceFile, node: ts.Node, text: string): string {
    return `${relative(ROOT, sf.fileName)}:${at(sf, node)}  ${text.trim()}`;
}

/** True when the text carries nothing a translator would need to touch. */
function isUntranslatable(text: string): boolean {
    const trimmed = text.trim();
    if (!trimmed) return true;
    if (BRAND_NAMES.has(trimmed)) return true;
    if (NOT_PROSE.has(trimmed)) return true;
    const words = trimmed.split(/[^\p{L}#]+/u).filter(Boolean);
    if (words.length === 0) return true;
    return words.every((word) => UNIVERSAL_TOKENS.has(word) || NOTE_NAME.test(word));
}

/** The JSX element a node sits directly inside, if any. */
function enclosingTag(node: ts.Node, sf: ts.SourceFile): string | null {
    const parent = node.parent;
    if (parent && ts.isJsxElement(parent)) return parent.openingElement.tagName.getText(sf);
    return null;
}

// ============================================
// 1 — No hardcoded user-visible text in the studio
// ============================================

/**
 * The literals an expression can actually render — the branches of a ternary or
 * a `??` chain, not the condition it tested and not a nested element's
 * className. `t('editor.close')` renders a message, so its argument is a key
 * rather than copy and stops the walk.
 */
function renderedLiterals(node: ts.Node): { node: ts.Node; text: string }[] {
    if (ts.isParenthesizedExpression(node)) return renderedLiterals(node.expression);

    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
        return [{ node, text: node.text }];
    }

    if (ts.isTemplateExpression(node)) {
        // Only the fixed chunks; the substitutions are values, not copy.
        return [node.head, ...node.templateSpans.map((span) => span.literal)]
            .filter((chunk) => chunk.text.trim())
            .map((chunk) => ({ node: chunk, text: chunk.text }));
    }

    if (ts.isConditionalExpression(node)) {
        return [...renderedLiterals(node.whenTrue), ...renderedLiterals(node.whenFalse)];
    }

    if (
        ts.isBinaryExpression(node)
        && (node.operatorToken.kind === ts.SyntaxKind.BarBarToken
            || node.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken)
    ) {
        return [...renderedLiterals(node.left), ...renderedLiterals(node.right)];
    }

    return [];
}

function hardcodedText(): string[] {
    const hits: string[] = [];

    for (const file of TEXT_DIRS.flatMap((dir) => walk(join(ROOT, dir), /\.tsx$/)).sort()) {
        const sf = parse(file);

        const visit = (node: ts.Node) => {
            // <span>Snap:</span>
            if (ts.isJsxText(node)) {
                const tag = enclosingTag(node, sf);
                if (!(tag && LITERAL_TEXT_ELEMENTS.has(tag)) && !isUntranslatable(node.text)) {
                    hits.push(report(sf, node, JSON.stringify(node.text.trim())));
                }
            }

            // title="Mute", aria-label={'Add Track'}
            if (ts.isJsxAttribute(node) && node.initializer) {
                const name = node.name.getText(sf);
                if (LABEL_ATTRIBUTES.has(name)) {
                    const value = ts.isJsxExpression(node.initializer) && node.initializer.expression
                        ? node.initializer.expression
                        : node.initializer;
                    for (const literal of renderedLiterals(value)) {
                        if (!isUntranslatable(literal.text)) {
                            hits.push(report(sf, literal.node, `${name}=${JSON.stringify(literal.text.trim())}`));
                        }
                    }
                }
            }

            // {isPlaying ? 'Stop' : 'Preview'} as an element's child
            if (
                ts.isJsxExpression(node)
                && node.expression
                && node.parent
                && (ts.isJsxElement(node.parent) || ts.isJsxFragment(node.parent))
            ) {
                const tag = enclosingTag(node, sf);
                if (!(tag && LITERAL_TEXT_ELEMENTS.has(tag))) {
                    for (const literal of renderedLiterals(node.expression)) {
                        if (!isUntranslatable(literal.text)) {
                            hits.push(report(sf, literal.node, JSON.stringify(literal.text.trim())));
                        }
                    }
                }
            }

            ts.forEachChild(node, visit);
        };

        visit(sf);
    }

    return hits;
}

// ============================================
// 2 & 3 — Messages and the calls that read them
// ============================================

interface Reference {
    /** Full dotted path, with `*` where a template substitution was. */
    key: string;
    where: string;
}

interface Usage {
    /** Keys named by a string or template literal. */
    references: Reference[];
    /**
     * Namespaces called with a computed key (`tScales(scale.id)`). We cannot
     * know which key was meant, so the whole subtree is treated as read.
     */
    opaqueNamespaces: string[];
}

const SCOPE_KINDS = new Set([
    ts.SyntaxKind.FunctionDeclaration,
    ts.SyntaxKind.FunctionExpression,
    ts.SyntaxKind.ArrowFunction,
    ts.SyntaxKind.MethodDeclaration,
    ts.SyntaxKind.SourceFile,
]);

/**
 * How a translator is obtained. Server components use getTranslations, and
 * awaiting it is still a call — a collector that knows only useTranslations
 * reports every key a server component uses as having no caller at all.
 */
const TRANSLATOR_FACTORIES = ['useTranslations', 'getTranslations'];

function isTranslatorFactory(call: ts.CallExpression, sf: ts.SourceFile): boolean {
    return TRANSLATOR_FACTORIES.includes(call.expression.getText(sf));
}

/**
 * The namespace argument, as either `getTranslations('ns')` or the object form
 * `getTranslations({ locale, namespace: 'ns' })`.
 */
function namespaceOf(arg: ts.Expression | undefined): string {
    if (!arg) return '';
    if (ts.isStringLiteral(arg)) return arg.text;
    if (ts.isObjectLiteralExpression(arg)) {
        for (const prop of arg.properties) {
            if (
                ts.isPropertyAssignment(prop)
                && prop.name.getText() === 'namespace'
                && ts.isStringLiteral(prop.initializer)
            ) {
                return prop.initializer.text;
            }
        }
    }
    return '';
}

/** next-intl's `t` also answers to `.rich`, `.raw`, `.markup` and `.has`. */
const TRANSLATOR_METHODS = new Set(['rich', 'raw', 'markup', 'has']);

function collectUsage(): Usage {
    const references: Reference[] = [];
    const opaqueNamespaces: string[] = [];

    const files = SOURCE_DIRS.flatMap((dir) => walk(join(ROOT, dir), /\.tsx?$/)).sort();

    for (const file of files) {
        const text = readFileSync(file, 'utf8');
        if (!TRANSLATOR_FACTORIES.some((factory) => text.includes(factory))) continue;

        const sf = parse(file);
        const rel = relative(ROOT, file);
        const scopeOf = (node: ts.Node): ts.Node => {
            let parent = node.parent;
            while (parent && !SCOPE_KINDS.has(parent.kind)) parent = parent.parent;
            return parent ?? sf;
        };

        // scope → (variable name → namespace)
        const bindings = new Map<ts.Node, Map<string, string>>();
        const bind = (scope: ts.Node, name: string, namespace: string) => {
            if (!bindings.has(scope)) bindings.set(scope, new Map());
            bindings.get(scope)!.set(name, namespace);
        };

        const collectBindings = (node: ts.Node) => {
            // `const t = await getTranslations(...)` wraps the call in an await,
            // so the initializer is an AwaitExpression rather than the call itself.
            const initializer = node && ts.isVariableDeclaration(node) && node.initializer
                ? (ts.isAwaitExpression(node.initializer) ? node.initializer.expression : node.initializer)
                : undefined;

            if (
                ts.isVariableDeclaration(node)
                && initializer
                && ts.isCallExpression(initializer)
                && isTranslatorFactory(initializer, sf)
                && ts.isIdentifier(node.name)
            ) {
                const arg = initializer.arguments[0];
                const namespace = namespaceOf(arg);
                bind(scopeOf(node), node.name.text, namespace);
            }

            // `function Hero({ t }: { t: ReturnType<typeof useTranslations> })`
            if (
                (ts.isParameter(node) || ts.isPropertySignature(node))
                && node.type
                && /ReturnType<\s*typeof\s+useTranslations\s*>/.test(node.type.getText(sf))
            ) {
                const names = ts.isParameter(node) && ts.isObjectBindingPattern(node.name)
                    ? node.name.elements.map((element) => element.name.getText(sf))
                    : [node.name.getText(sf)];
                for (const name of names) bind(sf, name, '');
            }

            ts.forEachChild(node, collectBindings);
        };
        collectBindings(sf);

        const resolve = (node: ts.Node, name: string): string | undefined => {
            let scope: ts.Node | undefined = scopeOf(node);
            while (scope) {
                const found = bindings.get(scope)?.get(name);
                if (found !== undefined) return found;
                if (scope === sf) break;
                scope = scopeOf(scope);
            }
            return undefined;
        };

        const collectCalls = (node: ts.Node) => {
            if (ts.isCallExpression(node)) {
                const callee = node.expression;
                let name: string | null = null;
                if (ts.isIdentifier(callee)) {
                    name = callee.text;
                } else if (
                    ts.isPropertyAccessExpression(callee)
                    && ts.isIdentifier(callee.expression)
                    && TRANSLATOR_METHODS.has(callee.name.text)
                ) {
                    name = callee.expression.text;
                }

                const namespace = name === null ? undefined : resolve(node, name);
                if (namespace !== undefined) {
                    const arg = node.arguments[0];
                    const where = `${rel}:${at(sf, node)}`;
                    const prefix = namespace ? `${namespace}.` : '';

                    if (arg && (ts.isStringLiteral(arg) || ts.isNoSubstitutionTemplateLiteral(arg))) {
                        references.push({ key: prefix + arg.text, where });
                    } else if (arg && ts.isTemplateExpression(arg)) {
                        const pattern = arg.head.text
                            + arg.templateSpans.map((span) => `*${span.literal.text}`).join('');
                        references.push({ key: prefix + pattern, where });
                    } else {
                        opaqueNamespaces.push(namespace);
                    }
                }
            }
            ts.forEachChild(node, collectCalls);
        };
        collectCalls(sf);
    }

    return { references, opaqueNamespaces };
}

function flatten(messages: Record<string, unknown>, prefix = ''): string[] {
    const keys: string[] = [];
    for (const [name, value] of Object.entries(messages)) {
        const key = prefix ? `${prefix}.${name}` : name;
        if (value && typeof value === 'object') {
            keys.push(...flatten(value as Record<string, unknown>, key));
        } else {
            keys.push(key);
        }
    }
    return keys;
}

/** `landing.features.*.title` → matches any single interpolated value. */
function toMatcher(pattern: string): RegExp {
    const escaped = pattern
        .split('*')
        .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
        .join('.+');
    return new RegExp(`^${escaped}$`);
}

// ============================================
// Tests
// ============================================

const messages = JSON.parse(
    readFileSync(join(ROOT, 'messages', 'en.json'), 'utf8')
) as Record<string, unknown>;

describe('studio components are translated', () => {
    it('renders no hardcoded user-visible text', () => {
        expect(hardcodedText()).toEqual([]);
    });
});

describe('numbers and dates follow the app locale', () => {
    // These format for the *browser's* locale, or for no locale at all:
    //
    //   toLocaleString()      reads navigator.language, not the app language,
    //                         so the import dialog once showed "1,539" above a
    //                         list of "1.009" — two formats, one dialog.
    //   toFixed()             always emits a dot, so Spanish saw "2.50s" where
    //                         it writes "2,50s"; and it returns a string, so a
    //                         message receiving it can no longer localise it.
    //
    // next-intl's useFormatter() is locale-aware. Anything drawn for a person
    // to read goes through it.
    const FORMATTERS = /\.(?:toFixed|toLocaleString|toLocaleDateString|toLocaleTimeString)\s*\(/g;

    it('never formats a user-visible number with the browser locale', () => {
        const hits: string[] = [];

        for (const dir of ['app', 'components']) {
            for (const file of walk(join(ROOT, dir), /\.tsx?$/)) {
                const text = readFileSync(file, 'utf8');
                text.split('\n').forEach((line, index) => {
                    // Skip prose: these names appear in the comments explaining
                    // why they are not used.
                    const code = line.replace(/\/\/.*$/, '').replace(/^\s*\*.*$/, '');
                    for (const match of code.matchAll(FORMATTERS)) {
                        hits.push(`${relative(ROOT, file)}:${index + 1}  ${match[0].trim()}`);
                    }
                });
            }
        }

        expect(
            hits,
            "Use next-intl's useFormatter(): format.number(value, { maximumFractionDigits: 2 }) " +
            'or format.dateTime(date). These format for the app language; toFixed and ' +
            'toLocaleString do not.'
        ).toEqual([]);
    });
});

describe('messages and their callers agree', () => {
    const { references, opaqueNamespaces } = collectUsage();

    it('has a caller for every message key', () => {
        const exact = new Set(references.filter((r) => !r.key.includes('*')).map((r) => r.key));
        const patterns = references
            .filter((r) => r.key.includes('*'))
            .map((r) => toMatcher(r.key));
        const opaque = opaqueNamespaces.map((namespace) => `${namespace}.`);
        const allowed = new Set(INTENTIONALLY_UNREFERENCED);

        const orphans = flatten(messages).filter((key) => {
            if (exact.has(key) || allowed.has(key)) return false;
            if (patterns.some((pattern) => pattern.test(key))) return false;
            return !opaque.some((prefix) => key.startsWith(prefix));
        });

        expect(orphans).toEqual([]);
    });

    it('has a message for every key a component asks for', () => {
        const defined = new Set(flatten(messages));
        const definedPrefixes = new Set(
            flatten(messages).flatMap((key) => {
                const parts = key.split('.');
                return parts.map((_, index) => parts.slice(0, index + 1).join('.'));
            })
        );

        const missing = references
            .filter(({ key }) => {
                if (key.includes('*')) {
                    // Only the fixed part can be checked; the rest is runtime data.
                    const stem = key.split('*')[0].replace(/\.$/, '');
                    return stem !== '' && !definedPrefixes.has(stem);
                }
                return !defined.has(key);
            })
            .map(({ key, where }) => `${where}  ${key}`);

        expect(missing).toEqual([]);
    });
});
