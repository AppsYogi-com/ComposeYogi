#!/usr/bin/env node
/**
 * Design Token Generator
 *
 * lib/design/tokens.ts is the single source of truth for every colour, radius,
 * duration and elevation in the product. This script writes those tokens into
 * the generated block in app/globals.css so the CSS can never say something the
 * TypeScript does not.
 *
 * Usage:
 *   node scripts/generate-design-tokens.js          rewrite the block
 *   node scripts/generate-design-tokens.js --check  fail if it is out of date
 *
 * `--check` runs in `npm run check` and CI. If it fails, run the script without
 * the flag and commit the result — never hand-edit the generated block.
 */

const fs = require('fs');
const path = require('path');
const esbuild = require('esbuild');

const ROOT = path.join(__dirname, '..');
const TOKENS_TS = path.join(ROOT, 'lib', 'design', 'tokens.ts');
const GLOBALS_CSS = path.join(ROOT, 'app', 'globals.css');
const MANIFEST = path.join(ROOT, 'public', 'manifest.json');
const DESIGN_README = path.join(ROOT, 'design', 'README.md');
const PREVIEW_CSS = path.join(ROOT, 'design', 'previews', 'tokens.css');
const PREVIEW_JS = path.join(ROOT, 'design', 'previews', 'tokens.js');

const BEGIN = '/* === BEGIN generated design tokens — npm run design:tokens === */';
const END = '/* === END generated design tokens === */';

const DOC_BEGIN = '<!-- === BEGIN generated token reference === -->';
const DOC_END = '<!-- === END generated token reference === -->';

// ============================================
// Load the TypeScript token module
// ============================================
//
// tokens.ts has no imports, so a single transform is enough — no bundling, no
// temp files, no build step for contributors to discover.

function loadTokens() {
    const source = fs.readFileSync(TOKENS_TS, 'utf8');
    const { code } = esbuild.transformSync(source, {
        loader: 'ts',
        format: 'cjs',
        target: 'node18',
    });
    const module = { exports: {} };
    new Function('module', 'exports', code)(module, module.exports);
    return module.exports;
}

// ============================================
// Emit
// ============================================

const INDENT = '        '; // inside @layer base > selector

function declarations(colors, groups) {
    const lines = [];
    groups.forEach((group, index) => {
        if (index > 0) lines.push('');
        lines.push(`${INDENT}/* ${group.title} — ${group.note} */`);
        for (const token of group.tokens) {
            if (!(token in colors)) {
                throw new Error(`COLOR_GROUPS names "${token}", which no theme defines.`);
            }
            lines.push(`${INDENT}--${token}: ${colors[token]};`);
        }
    });

    // Anything defined on the theme but never grouped would silently never be
    // emitted, so refuse rather than ship a half-written stylesheet.
    const grouped = new Set(groups.flatMap((g) => g.tokens));
    const orphans = Object.keys(colors).filter((token) => !grouped.has(token));
    if (orphans.length > 0) {
        throw new Error(
            `These tokens are defined but not in any COLOR_GROUPS entry, so they would ` +
            `not reach the CSS: ${orphans.join(', ')}. Add them to a group in tokens.ts.`
        );
    }

    return lines.join('\n');
}

function build(tokens) {
    const {
        DARK, LIGHT, COLOR_GROUPS, FONT_STACKS,
        RADIUS_BASE, MOTION, EASING, ELEVATION,
    } = tokens;

    const out = [];
    out.push(BEGIN);
    out.push('/*');
    out.push(' * Generated from lib/design/tokens.ts by scripts/generate-design-tokens.js.');
    out.push(' * Do not edit by hand — `npm run check` will fail. Edit the TypeScript and');
    out.push(' * run `npm run design:tokens`.');
    out.push(' */');
    out.push('@layer base {');
    out.push('    :root {');
    out.push('        /* Typography */');
    out.push(`        --font-sans: ${FONT_STACKS.sans};`);
    out.push(`        --font-mono: ${FONT_STACKS.mono};`);
    out.push('');
    out.push('        /* Shape — one base; sm/md/lg/xl derive from it in tailwind.config.ts */');
    out.push(`        --radius: ${RADIUS_BASE};`);
    out.push('');
    out.push('        /* Motion — the design language is 120–160ms */');
    for (const [name, value] of Object.entries(MOTION)) {
        out.push(`        --motion-${name}: ${value};`);
    }
    out.push(`        --ease-out: ${EASING.out};`);
    out.push(`        --ease-in-out: ${EASING.inOut};`);
    out.push('');
    out.push('        /* Elevation */');
    for (const [name, value] of Object.entries(ELEVATION)) {
        out.push(`        --shadow-${name}: ${value};`);
    }
    out.push('');
    out.push('        /* ---- Light theme ---- */');
    out.push(declarations(LIGHT, COLOR_GROUPS));
    out.push('    }');
    out.push('');
    out.push('    /* ---- Dark theme (the primary design target) ---- */');
    out.push('    .dark {');
    out.push(declarations(DARK, COLOR_GROUPS));
    out.push('    }');
    out.push('}');
    out.push(END);
    return out.join('\n');
}

// ============================================
// Splice into globals.css
// ============================================

function splice(css, block) {
    return spliceMarkers(css, block, BEGIN, END, 'app/globals.css');
}

// ============================================
// Standalone token stylesheet for the artboards
// ============================================
//
// design/previews/*.html open straight from disk with no build step, so they
// need the tokens as plain CSS. Same source, so an artboard cannot show a
// palette the product no longer has.

function previewCss(tokens) {
    // Everything before the `:root {` line is the markers and the CSS file's own
    // header; the artboards get their own. The wrapping @layer base goes too —
    // this is not a Tailwind project, so that layer would be undeclared here.
    const generated = build(tokens);
    const block = generated
        .slice(generated.indexOf('    :root {'), generated.lastIndexOf('}\n' + END))
        .split('\n')
        .map((line) => (line.startsWith('    ') ? line.slice(4) : line))
        .join('\n');

    return [
        '/*',
        ' * Generated from lib/design/tokens.ts by scripts/generate-design-tokens.js.',
        ' * Do not edit — run `npm run design:tokens`.',
        ' *',
        ' * Standalone copy of the design tokens for the artboards in this folder,',
        ' * which open directly in a browser without the app build.',
        ' */',
        block.trimEnd(),
        '',
    ].join('\n');
}

// ============================================
// Machine-readable tokens for the artboards
// ============================================
//
// design/previews/foundations.html builds itself from this rather than having
// swatches written into its markup. An artboard with a hand-authored list of
// tokens is an artboard that silently stops showing new ones — which is exactly
// the drift this whole pipeline exists to prevent.
//
// A script that assigns a global, not JSON fetched at runtime: the artboards
// have to open by double-clicking the file, and `fetch` is blocked on file://
// by CORS while a <script src> is not.

function previewJson(tokens) {
    const { COLOR_GROUPS, RADIUS, MOTION, EASING, ELEVATION, LAYOUT, TYPE_SCALE } = tokens;
    const data = JSON.stringify(
        {
            groups: COLOR_GROUPS,
            type: TYPE_SCALE,
            radius: RADIUS,
            motion: MOTION,
            easing: { out: EASING.out, inOut: EASING.inOut },
            elevation: ELEVATION,
            layout: LAYOUT,
        },
        null,
        4
    );
    return [
        '/*',
        ' * Generated from lib/design/tokens.ts by scripts/generate-design-tokens.js.',
        ' * Do not edit — run `npm run design:tokens`.',
        ' */',
        `window.COMPOSEYOGI_TOKENS = ${data};`,
        '',
    ].join('\n');
}

// ============================================
// The token reference in design/README.md
// ============================================
//
// The design doc's tables are the third generated surface. A hand-maintained
// table of colour values is the most reliable way to end up with documentation
// that quietly describes a product you no longer ship.

function swatch(hslToHex, hsl) {
    const hex = hslToHex(hsl);
    // GitHub renders a colour chip for a bare hex in backticks inside a table.
    return `\`${hex}\``;
}

function docBlock(tokens) {
    const { DARK, LIGHT, COLOR_GROUPS, RADIUS, MOTION, EASING, ELEVATION, LAYOUT, TYPE_SCALE, hslToHex } = tokens;
    const out = [DOC_BEGIN, ''];

    out.push('### Colour tokens', '');
    for (const group of COLOR_GROUPS) {
        out.push(`#### ${group.title}`, '', `*${group.note}*`, '');
        out.push('| Token | Class | Dark | Light |');
        out.push('|---|---|---|---|');
        for (const name of group.tokens) {
            out.push(
                `| \`--${name}\` | \`${name}\` | ${swatch(hslToHex, DARK[name])} ` +
                `\`${DARK[name]}\` | ${swatch(hslToHex, LIGHT[name])} \`${LIGHT[name]}\` |`
            );
        }
        out.push('');
    }

    out.push('### Type scale', '');
    out.push('| Step | Size | Line height | Use |');
    out.push('|---|---|---|---|');
    for (const [step, meta] of Object.entries(TYPE_SCALE)) {
        out.push(`| \`text-${step}\` | ${meta.size} | ${meta.leading} | ${meta.use} |`);
    }
    out.push('');

    out.push('### Shape scale', '');
    out.push('| Step | Value |');
    out.push('|---|---|');
    for (const [step, value] of Object.entries(RADIUS)) {
        out.push(`| \`rounded-${step}\` | \`${value}\` |`);
    }
    out.push('');

    out.push('### Motion tokens', '');
    out.push('| Token | Value |');
    out.push('|---|---|');
    for (const [name, value] of Object.entries(MOTION)) {
        out.push(`| \`duration-${name}\` | ${value} |`);
    }
    out.push(`| \`ease-out\` | \`${EASING.out}\` |`);
    out.push(`| \`ease-in-out\` | \`${EASING.inOut}\` |`);
    out.push('');

    out.push('### Elevation tokens', '');
    out.push('| Token | Value |');
    out.push('|---|---|');
    for (const [name, value] of Object.entries(ELEVATION)) {
        out.push(`| \`shadow-${name}\` | \`${value}\` |`);
    }
    out.push('');

    out.push('### Layout constants', '');
    out.push('| Token | Value |');
    out.push('|---|---|');
    for (const [name, value] of Object.entries(LAYOUT)) {
        out.push(`| \`${name}\` | ${value} |`);
    }
    out.push('');

    out.push(DOC_END);
    return out.join('\n');
}

function spliceMarkers(text, block, begin, end, file) {
    const start = text.indexOf(begin);
    const stop = text.indexOf(end);
    if (start === -1 || stop === -1) {
        throw new Error(`${file} is missing the generated markers:\n  ${begin}\n  ${end}`);
    }
    if (stop < start) throw new Error(`${file} has its END marker before its BEGIN marker.`);
    return text.slice(0, start) + block + text.slice(stop + end.length);
}

// ============================================
// The PWA manifest
// ============================================
//
// manifest.json is static JSON that cannot import anything, so its two colours
// are written from the tokens here. Same guarantee, one more surface.

function manifestUpdate(tokens) {
    const current = fs.readFileSync(MANIFEST, 'utf8');
    const parsed = JSON.parse(current);
    const updated = {
        ...parsed,
        background_color: tokens.THEME_COLOR_HEX,
        theme_color: tokens.THEME_COLOR_HEX,
    };
    // Match the file's existing indentation so the diff stays to the two lines.
    const indent = /\n(\s+)"/.exec(current)?.[1]?.length ?? 4;
    return { current, next: JSON.stringify(updated, null, indent) + '\n' };
}

function main() {
    const check = process.argv.includes('--check');
    const tokens = loadTokens();

    const css = fs.readFileSync(GLOBALS_CSS, 'utf8');
    const nextCss = splice(css, build(tokens));
    const manifest = manifestUpdate(tokens);

    const doc = fs.readFileSync(DESIGN_README, 'utf8');
    const nextDoc = spliceMarkers(doc, docBlock(tokens), DOC_BEGIN, DOC_END, 'design/README.md');

    const css2 = fs.existsSync(PREVIEW_CSS) ? fs.readFileSync(PREVIEW_CSS, 'utf8') : '';
    const nextCss2 = previewCss(tokens);

    const json = fs.existsSync(PREVIEW_JS) ? fs.readFileSync(PREVIEW_JS, 'utf8') : '';
    const nextJson = previewJson(tokens);

    const stale = [];
    if (nextCss !== css) stale.push('app/globals.css');
    if (manifest.next !== manifest.current) stale.push('public/manifest.json');
    if (nextDoc !== doc) stale.push('design/README.md');
    if (nextCss2 !== css2) stale.push('design/previews/tokens.css');
    if (nextJson !== json) stale.push('design/previews/tokens.js');

    if (stale.length === 0) {
        console.log('✓ Every generated file matches lib/design/tokens.ts');
        return;
    }

    if (check) {
        console.error(`✗ Out of date with lib/design/tokens.ts: ${stale.join(', ')}`);
        console.error('  Run `npm run design:tokens` and commit the result.');
        process.exit(1);
    }

    if (nextCss !== css) fs.writeFileSync(GLOBALS_CSS, nextCss);
    if (manifest.next !== manifest.current) fs.writeFileSync(MANIFEST, manifest.next);
    if (nextDoc !== doc) fs.writeFileSync(DESIGN_README, nextDoc);
    if (nextCss2 !== css2) fs.writeFileSync(PREVIEW_CSS, nextCss2);
    if (nextJson !== json) fs.writeFileSync(PREVIEW_JS, nextJson);
    console.log(`✓ Wrote design tokens into ${stale.join(', ')}`);
}

try {
    main();
} catch (error) {
    console.error(`✗ ${error.message}`);
    process.exit(1);
}
