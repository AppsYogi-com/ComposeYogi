// ============================================
// ComposeYogi — Design System Conformance
// ============================================
//
// Sprint 8.6 made lib/design/tokens.ts the single source of truth for colour.
// These tests are what keeps it that way: a design system that relies on people
// remembering it is a style guide, and this repo already learned what style
// guides do — the track palette had drifted into three different answers before
// anything enforced it.
//
// Every failure here has a fix in design/README.md.

import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
    COLOR_GROUPS,
    DARK,
    DRUM_FAMILIES,
    LIGHT,
    TRACK_ROLES,
    compositeHex,
    contrastRatio,
    hslToHex,
} from '@/lib/design/tokens';
import type { ThemeColors } from '@/lib/design/tokens';
import { DRUM_BG, TRACK_BG, TRACK_TEXT } from '@/lib/design/track-colors';

const ROOT = join(__dirname, '..');
const SOURCE_DIRS = ['app', 'components'];

function sourceFiles(): string[] {
    const found: string[] = [];
    const walk = (dir: string) => {
        for (const entry of readdirSync(dir)) {
            const full = join(dir, entry);
            if (statSync(full).isDirectory()) {
                walk(full);
            } else if (/\.(tsx?|css)$/.test(entry)) {
                found.push(full);
            }
        }
    };
    for (const dir of SOURCE_DIRS) walk(join(ROOT, dir));
    return found;
}

/** The class maps live in lib/design/, so colour-class checks have to look there too. */
function libFiles(): string[] {
    const found: string[] = [];
    const walk = (dir: string) => {
        for (const entry of readdirSync(dir)) {
            const full = join(dir, entry);
            if (statSync(full).isDirectory()) walk(full);
            else if (/\.tsx?$/.test(entry)) found.push(full);
        }
    };
    walk(join(ROOT, 'lib'));
    return found;
}

/** `path:line  offending text` — so a failure says where to go, not just that it failed. */
function scan(pattern: RegExp, skip?: (file: string) => boolean): string[] {
    const hits: string[] = [];
    for (const file of sourceFiles()) {
        if (skip?.(file)) continue;
        const lines = readFileSync(file, 'utf8').split('\n');
        lines.forEach((line, index) => {
            for (const match of line.matchAll(pattern)) {
                hits.push(`${relative(ROOT, file)}:${index + 1}  ${match[0]}`);
            }
        });
    }
    return hits;
}

// ============================================
// No colour outside the system
// ============================================

describe('colour lives in the token system', () => {
    const PALETTE = [
        'slate', 'gray', 'zinc', 'neutral', 'stone', 'red', 'orange', 'amber',
        'yellow', 'lime', 'green', 'emerald', 'teal', 'cyan', 'sky', 'blue',
        'indigo', 'violet', 'purple', 'fuchsia', 'pink', 'rose',
    ].join('|');

    it('uses no raw Tailwind palette classes', () => {
        // `white` and `black` are in here too: they have no numeric suffix, so a
        // palette-only pattern misses them, and `bg-black/60` is exactly as much
        // an untracked colour as `bg-zinc-900`.
        const hits = scan(
            new RegExp(
                `\\b(?:bg|text|border|from|to|via|ring|divide|fill|stroke|placeholder)` +
                `-(?:(?:${PALETTE})-[0-9]{2,3}|white|black)\\b`,
                'g'
            )
        );
        expect(
            hits,
            'Use a semantic token instead: destructive / success / warning / info for state, ' +
            'the track scale for things that need telling apart, scrim for an overlay, ' +
            'or clip-foreground for a label on a filled colour. See design/README.md.'
        ).toEqual([]);
    });

    it('uses no hardcoded hex colours', () => {
        // globals.css holds the generated token block, which is the one place a
        // literal is allowed to exist — and it currently holds none.
        const hits = scan(/#[0-9a-fA-F]{3,8}\b/g);
        expect(
            hits,
            'Add the colour to lib/design/tokens.ts and reference the token.'
        ).toEqual([]);
    });

    it('stays on the type and radius scales', () => {
        // Arbitrary values are how a scale quietly stops being a scale. Keyword
        // values like rounded-[inherit] are structural, not sizing, so they pass.
        const hits = scan(/\b(?:text|rounded|leading|tracking)-\[[^\]]+\]/g).filter(
            (hit) => !/-\[(inherit|initial|unset|revert)\]/.test(hit)
        );
        expect(
            hits,
            'Use a step from the scale. 10px is text-2xs and 2px is rounded-xs; ' +
            'if a genuinely new step is needed, add it to lib/design/tokens.ts first.'
        ).toEqual([]);
    });

    it('never builds a Tailwind class name dynamically', () => {
        // `bg-${role}` produces no CSS at all: Tailwind extracts class names
        // statically, so the class never exists. This shipped in BrowserPanel
        // for months as instrument dots that rendered with no colour.
        const hits = scan(
            /\b(?:bg|text|border|ring|fill|stroke|from|to|via)-\$\{[^}]+\}/g
        );
        expect(
            hits,
            'Tailwind cannot see interpolated class names. Use a static map — ' +
            'TRACK_BG / DRUM_BG in lib/design/track-colors.ts.'
        ).toEqual([]);
    });
});

// ============================================
// The generated artefacts match their source
// ============================================

describe('generated files match lib/design/tokens.ts', () => {
    it('app/globals.css and public/manifest.json are up to date', () => {
        // The same check CI runs. Failing here means someone edited a generated
        // file by hand, or changed a token without regenerating.
        expect(() =>
            execFileSync('node', ['scripts/generate-design-tokens.js', '--check'], {
                cwd: ROOT,
                stdio: 'pipe',
            })
        ).not.toThrow();
    });

    it('emits every colour token for both themes', () => {
        const css = readFileSync(join(ROOT, 'app', 'globals.css'), 'utf8');
        const missing = Object.keys(DARK).filter(
            (name) => (css.match(new RegExp(`--${name}:`, 'g')) || []).length !== 2
        );
        expect(missing, 'Each token must be declared once per theme.').toEqual([]);
    });

    it('defines the same token names in both themes', () => {
        expect(Object.keys(LIGHT).sort()).toEqual(Object.keys(DARK).sort());
    });

    it('groups every token, so none is silently dropped', () => {
        const grouped = COLOR_GROUPS.flatMap((group) => group.tokens).sort();
        expect(grouped).toEqual(Object.keys(DARK).sort());
    });
});

// ============================================
// Lookups stay exhaustive
// ============================================

// ============================================
// Icons
// ============================================

describe('motion respects prefers-reduced-motion', () => {
    // design/README.md promised this from the day the design system shipped and
    // nothing implemented it for two sprints — the kind of claim a document can
    // hold indefinitely and a test cannot. Every failure here is a motion that
    // has not said what it does when someone has asked for less of it.
    const css = readFileSync(join(ROOT, 'app/globals.css'), 'utf8');

    const reducedMotionBlock = (): string => {
        const start = css.indexOf('@media (prefers-reduced-motion: reduce)');
        if (start === -1) return '';
        // Walk the braces, since the block contains nested rules.
        let depth = 0;
        for (let i = css.indexOf('{', start); i < css.length; i++) {
            if (css[i] === '{') depth++;
            else if (css[i] === '}' && --depth === 0) return css.slice(start, i + 1);
        }
        return css.slice(start);
    };

    it('declares a reduced-motion block at all', () => {
        expect(
            reducedMotionBlock(),
            'app/globals.css must answer prefers-reduced-motion. design/README.md says it does.'
        ).not.toBe('');
    });

    it('neutralises animation and transition across the whole document', () => {
        const block = reducedMotionBlock();
        for (const property of [
            'animation-duration',
            'animation-iteration-count',
            'transition-duration',
        ]) {
            expect(block, `the blanket rule must set ${property}`).toContain(property);
        }
        // 0.01ms, never `none`: Radix unmounts on animationend, and an animation
        // that never runs never ends, so `none` strands closed dialogs in the DOM.
        expect(
            block.replace(/animation:[^;]*;/g, ''),
            'use 0.01ms, not `none` — see the comment in globals.css'
        ).toContain('0.01ms');
    });

    it('says what every looping animation becomes when it stops', () => {
        // A `… infinite` animation freezes on one arbitrary keyframe under the
        // blanket rule. That is fine for some and wrong for others — the logo
        // wave freezes into a flat block — so each one has to be named here and
        // given a resting state deliberately.
        const block = reducedMotionBlock();
        const body = css.slice(0, css.indexOf('@media (prefers-reduced-motion: reduce)'));

        const looping = new Set<string>();
        // Selector(s) immediately preceding a declaration block containing an
        // infinite animation.
        const rule = /([^{}]+)\{([^{}]*)\}/g;
        let match: RegExpExecArray | null;
        while ((match = rule.exec(body)) !== null) {
            if (!/animation:[^;]*infinite/.test(match[2])) continue;
            for (const cls of match[1].matchAll(/\.([a-zA-Z][\w-]*)/g)) looping.add(cls[1]);
        }

        const unanswered = [...looping].filter((cls) => !block.includes(`.${cls}`));
        expect(
            unanswered,
            'These loop forever but say nothing about reduced motion. Add each to the ' +
            '@media (prefers-reduced-motion: reduce) block in app/globals.css with the ' +
            'state it should rest in.'
        ).toEqual([]);
        // Guard the guard: if the scan stops finding anything, it stops checking.
        expect(looping.size, 'the scan found no looping animations — it has broken').toBeGreaterThan(0);
    });
});

describe('icons follow the design system', () => {
    it('sizes every dialog header icon at h-5 w-5', () => {
        // A header icon at h-4 reads as a lighter title than the dialogs
        // around it. The instrument editor shipped that way and it took a
        // side-by-side to notice, which is exactly the kind of drift a rule in
        // a README does not catch. See "One glyph, one meaning" in
        // design/README.md.
        const offenders: string[] = [];

        for (const file of sourceFiles()) {
            const source = readFileSync(file, 'utf8');
            if (!source.includes('<DialogTitle')) continue;

            // The whole element, not a fixed window of lines: a header with a
            // comment above its icon pushed it out of a 5-line window, and the
            // first version of this test passed happily while measuring
            // nothing at all.
            const lines = source.split('\n');
            lines.forEach((line, index) => {
                if (!/<DialogTitle/.test(line)) return;

                const close = lines.findIndex((l, i) => i >= index && /<\/DialogTitle>/.test(l));
                if (close === -1) return;
                const block = lines.slice(index, close + 1).join('\n');

                // Comments are where the reasoning lives; they are not markup.
                const markup = block.replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
                const icon = markup.match(/<[A-Z]\w*\s+className="([^"]*\bh-\d[^"]*)"/);
                if (!icon) return;

                if (!/\bh-5\b/.test(icon[1]) || !/\bw-5\b/.test(icon[1])) {
                    offenders.push(`${relative(ROOT, file)}:${index + 1}  ${icon[1]}`);
                }
            });
        }

        expect(offenders, 'Dialog header icons are h-5 w-5.').toEqual([]);
    });

    it('keeps any hand-drawn icon on lucide\'s contract', () => {
        // Vacuous until the first custom icon exists, and deliberately so: the
        // rule needs to be in place *before* somebody adds one, because a glyph
        // that is off-grid or paints its own colour looks wrong beside the
        // sixty-five library icons and stops responding to the theme.
        const iconsDir = join(ROOT, 'components', 'icons');
        let files: string[] = [];
        try {
            files = readdirSync(iconsDir).filter((f) => /\.tsx$/.test(f));
        } catch {
            return; // no custom icons yet
        }

        const offenders: string[] = [];
        for (const file of files) {
            const source = readFileSync(join(iconsDir, file), 'utf8');
            const required: [RegExp, string][] = [
                [/viewBox="0 0 24 24"/, 'viewBox="0 0 24 24"'],
                [/stroke="currentColor"/, 'stroke="currentColor"'],
                [/fill="none"/, 'fill="none"'],
                [/strokeWidth=\{?"?2"?\}?/, 'strokeWidth 2'],
                [/strokeLinecap="round"/, 'strokeLinecap="round"'],
                [/strokeLinejoin="round"/, 'strokeLinejoin="round"'],
            ];
            for (const [pattern, label] of required) {
                if (!pattern.test(source)) offenders.push(`components/icons/${file}  missing ${label}`);
            }
        }

        expect(offenders, 'Custom icons match lucide: 24x24, currentColor, no fill, stroke 2, round caps.').toEqual([]);
    });
});

describe('class maps cover the whole scale', () => {
    it('has a background and text class for every track role', () => {
        expect(Object.keys(TRACK_BG).sort()).toEqual([...TRACK_ROLES].sort());
        expect(Object.keys(TRACK_TEXT).sort()).toEqual([...TRACK_ROLES].sort());
    });

    it('has a background class for every drum family', () => {
        expect(Object.keys(DRUM_BG).sort()).toEqual([...DRUM_FAMILIES].sort());
    });

    it('names a real token in each class', () => {
        for (const [role, className] of Object.entries(TRACK_BG)) {
            expect(className).toBe(`bg-track-${role}`);
            expect(DARK).toHaveProperty(`track-${role}`);
        }
        for (const [family, className] of Object.entries(DRUM_BG)) {
            expect(className).toBe(`bg-drum-${family}`);
            expect(DARK).toHaveProperty(`drum-${family}`);
        }
    });
});

// ============================================
// Tailwind can actually see the classes
// ============================================

describe('every design class reaches Tailwind', () => {
    it('scans the directory the class maps live in', async () => {
        // TRACK_BG lives in lib/design/, so lib/ must be in `content`. It was
        // not, and the result was `bg-track-drums` in the DOM computing to
        // transparent — the class name existed, the CSS rule did not.
        const config = await import('@/tailwind.config');
        const content = config.default.content as string[];
        expect(content.some((glob) => glob.startsWith('./lib/'))).toBe(true);
    });

    it('emits a rule for every colour class the source uses', async () => {
        // The two checks above guard the conditions that made classes vanish
        // before. This one checks the thing itself. Tailwind emits nothing for
        // a colour it does not know — no error, no warning, just an element
        // with no background — which is how `bg-surface-active` sat live in
        // BrowserPanel while eight siblings correctly said surface-elevated.
        const valid = new Set<string>();
        const walk = (node: Record<string, unknown>, prefix: string) => {
            for (const [key, value] of Object.entries(node)) {
                const name = key === 'DEFAULT' ? prefix : prefix ? `${prefix}-${key}` : key;
                if (typeof value === 'string') valid.add(name);
                else walk(value as Record<string, unknown>, name);
            }
        };
        const config = await import('@/tailwind.config');
        walk(config.default.theme!.extend!.colors as Record<string, unknown>, '');

        // Only suffixes that begin with a token family count as colour classes,
        // so Tailwind's own `border-t-transparent` and `ring-offset-2` do not
        // register. `bg-clip-*` is background-clip, not the clip token.
        const families = [...new Set([...valid].map((name) => name.split('-')[0]))];
        const TAILWIND_OWN = /^clip-(text|border|content|padding)$/;
        const UTILITIES = 'bg|text|border|ring|fill|stroke|divide|from|to|via|placeholder|caret|decoration';

        const hits: string[] = [];
        for (const file of [...sourceFiles(), ...libFiles()]) {
            readFileSync(file, 'utf8').split('\n').forEach((line, index) => {
                const pattern = new RegExp(
                    `\\b(?:${UTILITIES})-((?:${families.join('|')})(?:-[a-z0-9]+)+)`,
                    'g'
                );
                for (const match of line.matchAll(pattern)) {
                    if (valid.has(match[1]) || TAILWIND_OWN.test(match[1])) continue;
                    hits.push(`${relative(ROOT, file)}:${index + 1}  ${match[0]}`);
                }
            });
        }

        expect(
            hits,
            'This class names no token, so Tailwind generates no CSS for it and ' +
            'the element renders unstyled. Check the spelling against ' +
            'lib/design/tokens.ts, or add the token if it should exist.'
        ).toEqual([]);
    });

    it('reads tokens by bare name, not with the -- prefix', () => {
        // readCssVar prepends the dashes itself. Passing them again looks up
        // `----accent`, finds nothing, and tokenColor quietly returns
        // 'transparent' — a canvas that draws nothing and reports no error.
        //
        // Matched against whole files rather than line by line: these calls are
        // routinely wrapped, so a per-line scan would miss the argument and
        // pass no matter what the code said.
        const hits: string[] = [];
        for (const file of sourceFiles()) {
            const text = readFileSync(file, 'utf8');
            for (const match of text.matchAll(/\b(?:tokenColor|readCssVar)\(\s*['"`]--/g)) {
                const line = text.slice(0, match.index).split('\n').length;
                hits.push(`${relative(ROOT, file)}:${line}  ${match[0].replace(/\s+/g, ' ')}`);
            }
        }
        expect(
            hits,
            'Pass the token name without leading dashes: tokenColor(\'accent\'), not tokenColor(\'--accent\').'
        ).toEqual([]);
    });

    it('declares each class as a literal a scanner can find', () => {
        // Tailwind matches source text, not evaluated values, so every class in
        // these maps has to appear spelled out in the file.
        const source = readFileSync(
            join(ROOT, 'lib', 'design', 'track-colors.ts'),
            'utf8'
        );
        for (const className of [...Object.values(TRACK_BG), ...Object.values(TRACK_TEXT), ...Object.values(DRUM_BG)]) {
            expect(source, `${className} must appear verbatim in track-colors.ts`)
                .toContain(`'${className}'`);
        }
    });
});

// ============================================
// Contrast
// ============================================
//
// The pairs asserted here are the ones the product actually puts together. This
// is not a substitute for looking at the page — it cannot see a fader rail that
// vanishes into its surface, because that is a difference in appearance, not in
// contrast ratio — but it does hold the line on text legibility, which is where
// an amber accent quietly fails.

describe('colour pairs meet WCAG AA', () => {
    const AA_BODY = 4.5;
    const AA_LARGE = 3;

    const themes: [string, ThemeColors][] = [['dark', DARK], ['light', LIGHT]];
    const STATES = ['accent', 'primary', 'destructive', 'success', 'warning', 'info'] as const;

    describe.each(themes)('%s', (_name, theme) => {
        it('reads body text on the ground', () => {
            expect(contrastRatio(theme.foreground, theme.background)).toBeGreaterThanOrEqual(AA_BODY);
            expect(contrastRatio(theme.foreground, theme.surface)).toBeGreaterThanOrEqual(AA_BODY);
            expect(contrastRatio(theme['card-foreground'], theme.card)).toBeGreaterThanOrEqual(AA_BODY);
            expect(contrastRatio(theme['popover-foreground'], theme.popover)).toBeGreaterThanOrEqual(AA_BODY);
        });

        it('reads secondary text on every ground it sits on', () => {
            // muted and secondary are in this list because tab lists, keyboard
            // chips and toast descriptions put muted-foreground directly on
            // them. That pair sat at 4.48:1 in the light theme — a real miss,
            // just a small one, and invisible while the list stopped at surface.
            const GROUNDS = [
                'background', 'surface', 'surface-elevated',
                'card', 'popover', 'muted', 'secondary',
            ] as const;
            for (const ground of GROUNDS) {
                expect(
                    contrastRatio(theme['muted-foreground'], theme[ground]),
                    `muted-foreground on ${ground}`
                ).toBeGreaterThanOrEqual(AA_BODY);
            }
        });

        it('reads a state colour used as text', () => {
            // `text-warning` on a panel, `text-success` in a toast — these are
            // small text, so they need the full ratio.
            for (const state of STATES) {
                expect(
                    contrastRatio(theme[state], theme.background),
                    `${state} as text on background`
                ).toBeGreaterThanOrEqual(AA_BODY);
                expect(
                    contrastRatio(theme[state], theme.surface),
                    `${state} as text on surface`
                ).toBeGreaterThanOrEqual(AA_BODY);
            }
        });

        it('reads a foreground on its own fill', () => {
            // The button case: text-accent-foreground on bg-accent.
            for (const state of STATES) {
                expect(
                    contrastRatio(theme[`${state}-foreground`], theme[state]),
                    `${state}-foreground on ${state}`
                ).toBeGreaterThanOrEqual(AA_BODY);
            }
        });

        it('shows a focus ring against every ground', () => {
            // A ring is a large graphical object, so 3:1 is the bar.
            for (const ground of ['background', 'surface', 'surface-elevated', 'input'] as const) {
                expect(
                    contrastRatio(theme.ring, theme[ground]),
                    `ring on ${ground}`
                ).toBeGreaterThanOrEqual(AA_LARGE);
            }
        });

        it('separates the piano keys from their labels', () => {
            expect(
                contrastRatio(theme['piano-white-foreground'], theme['piano-white'])
            ).toBeGreaterThanOrEqual(AA_BODY);
            expect(
                contrastRatio(theme['piano-black-foreground'], theme['piano-black'])
            ).toBeGreaterThanOrEqual(AA_BODY);
        });

        it('shows a label on a scrim, once the scrim is opaque enough to carry one', () => {
            // This pair is the reason it exists. The demo-template play overlay
            // used `text-clip-foreground` here, which is near-black in the dark
            // theme, on a near-black scrim — the label was invisible.
            expect(
                contrastRatio(theme['scrim-foreground'], theme.scrim),
                'scrim-foreground on a solid scrim'
            ).toBeGreaterThanOrEqual(AA_BODY);

            // Scrims are translucent, so the ground behind them is part of the
            // colour. The light theme is the hard case: the page underneath is
            // near-white, and it lifts the composite. 60% is the floor at which
            // a scrim can still carry text — a thinner wash than that needs its
            // own solid surface, not a label straight on the overlay.
            const TEXT_BEARING_ALPHA = 0.6;
            for (const under of ['background', 'surface', 'card'] as const) {
                expect(
                    contrastRatio(
                        theme['scrim-foreground'],
                        compositeHex(theme.scrim, TEXT_BEARING_ALPHA, theme[under])
                    ),
                    `scrim-foreground on scrim/60 over ${under}`
                ).toBeGreaterThanOrEqual(AA_BODY);
            }
        });

        it('shows a clip label on every track colour', () => {
            // Clip titles are clip-foreground on a filled track colour.
            for (const role of TRACK_ROLES) {
                expect(
                    contrastRatio(theme['clip-foreground'], theme[`track-${role}`]),
                    `clip-foreground on track-${role}`
                ).toBeGreaterThanOrEqual(AA_LARGE);
            }
        });
    });
});

// ============================================
// Palette intent
// ============================================

describe('the palette holds its own rules', () => {
    const hue = (token: string) => parseFloat(token.split(/\s+/)[0]);

    it('keeps every track hue clear of the accent band', () => {
        // The accent sits at 35°. Track colours deliberately vacate 20°–50° so
        // nothing on the timeline can be mistaken for "this is on".
        const collisions = TRACK_ROLES.filter((role) => {
            const h = hue(DARK[`track-${role}`]);
            return h >= 20 && h <= 50;
        });
        expect(collisions).toEqual([]);
    });

    it('keeps track hues at least 30° apart', () => {
        const hues = TRACK_ROLES.map((role) => hue(DARK[`track-${role}`])).sort((a, b) => a - b);
        const gaps = hues.map((h, i) => {
            const next = i === hues.length - 1 ? hues[0] + 360 : hues[i + 1];
            return Math.round(next - h);
        });
        expect(Math.min(...gaps)).toBeGreaterThanOrEqual(30);
    });

    it('derives hex forms correctly', () => {
        expect(hslToHex('0 0% 100%')).toBe('#ffffff');
        expect(hslToHex('0 0% 0%')).toBe('#000000');
        expect(hslToHex('210 100% 50%')).toBe('#0080ff');
        expect(hslToHex('0 100% 50%')).toBe('#ff0000');
        expect(hslToHex('120 100% 50%')).toBe('#00ff00');
        expect(hslToHex('240 100% 50%')).toBe('#0000ff');
    });
});
