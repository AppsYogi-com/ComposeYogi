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

const BEGIN = '/* === BEGIN generated design tokens — npm run design:tokens === */';
const END = '/* === END generated design tokens === */';

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
    const start = css.indexOf(BEGIN);
    const end = css.indexOf(END);

    if (start === -1 || end === -1) {
        throw new Error(
            `app/globals.css is missing the generated token markers.\n` +
            `Expected to find:\n  ${BEGIN}\n  ${END}`
        );
    }
    if (end < start) {
        throw new Error('The END marker appears before the BEGIN marker in app/globals.css.');
    }

    return css.slice(0, start) + block + css.slice(end + END.length);
}

function main() {
    const check = process.argv.includes('--check');
    const tokens = loadTokens();
    const css = fs.readFileSync(GLOBALS_CSS, 'utf8');
    const next = splice(css, build(tokens));

    if (next === css) {
        console.log('✓ Design tokens in app/globals.css match lib/design/tokens.ts');
        return;
    }

    if (check) {
        console.error('✗ app/globals.css is out of date with lib/design/tokens.ts.');
        console.error('  Run `npm run design:tokens` and commit the result.');
        process.exit(1);
    }

    fs.writeFileSync(GLOBALS_CSS, next);
    console.log('✓ Wrote design tokens into app/globals.css');
}

try {
    main();
} catch (error) {
    console.error(`✗ ${error.message}`);
    process.exit(1);
}
