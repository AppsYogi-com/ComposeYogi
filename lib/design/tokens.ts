// ============================================
// ComposeYogi — Design Tokens (single source of truth)
// ============================================
//
// Every colour, radius, duration and elevation in the product is defined here
// and nowhere else. `app/globals.css` does not hold its own values: the CSS
// custom-property block between the generated markers is written from this file
// by `npm run design:tokens`, and `npm run check` fails if the two drift.
//
// Why this exists: before Sprint 8.6 the track palette was defined in four
// places that disagreed, so one track was red in its header, orange on its clip
// and invisible in the browser panel. A design system that can drift is not a
// design system, so this one is enforced by the build.
//
// Adding or changing a token:
//   1. Edit it here.
//   2. Run `npm run design:tokens` to rewrite the generated block in globals.css.
//   3. Expose it in tailwind.config.ts if components should reach it by class.
//   4. Document intent in design/README.md — a token nobody knows when to use
//      gets bypassed.
//
// Colour values are bare HSL triples ("35 100% 55%") because Tailwind composes
// them as `hsl(var(--token) / <alpha>)`, which is what makes `bg-accent/30`
// work. Never store a token as a finished `hsl(...)` string.

// ============================================
// Types
// ============================================

/** A bare HSL triple: hue, saturation%, lightness%. No wrapping `hsl()`. */
export type Hsl = string;

export interface ThemeColors {
    // Ground and text
    background: Hsl;
    foreground: Hsl;
    /** Panels and rails that sit on the ground. */
    surface: Hsl;
    /** Controls and rows that sit on a surface — the top of the elevation ramp. */
    'surface-elevated': Hsl;
    card: Hsl;
    'card-foreground': Hsl;
    popover: Hsl;
    'popover-foreground': Hsl;

    // Brand
    primary: Hsl;
    'primary-foreground': Hsl;
    accent: Hsl;
    'accent-foreground': Hsl;
    secondary: Hsl;
    'secondary-foreground': Hsl;
    muted: Hsl;
    'muted-foreground': Hsl;

    // Lines
    border: Hsl;
    input: Hsl;
    ring: Hsl;

    // State — meaning, not decoration. See design/README.md § Semantic colour.
    destructive: Hsl;
    'destructive-foreground': Hsl;
    success: Hsl;
    'success-foreground': Hsl;
    warning: Hsl;
    'warning-foreground': Hsl;
    info: Hsl;
    'info-foreground': Hsl;

    // Transport
    /** The playhead. Deliberately the one red that is never a button. */
    playhead: Hsl;

    // Fixed surfaces — see the note in DARK below.
    /** Modal scrims and any wash that darkens what is behind it. */
    scrim: Hsl;
    /** Labels and handles drawn on top of a filled colour: clips, braces, notes. */
    'clip-foreground': Hsl;
    'piano-white': Hsl;
    'piano-white-foreground': Hsl;
    'piano-black': Hsl;
    'piano-black-foreground': Hsl;

    // Categorical — track roles
    'track-drums': Hsl;
    'track-bass': Hsl;
    'track-keys': Hsl;
    'track-melody': Hsl;
    'track-vocals': Hsl;
    'track-fx': Hsl;

    // Categorical — drum families (the sequencer's left rail)
    'drum-kick': Hsl;
    'drum-snare': Hsl;
    'drum-tom': Hsl;
    'drum-hat': Hsl;
    'drum-cymbal': Hsl;
    'drum-perc': Hsl;
    'drum-other': Hsl;
}

// ============================================
// Dark theme — the primary design target
// ============================================
//
// Neutrals carry a slight warm bias (hue 30, low saturation) so they belong to
// the amber accent rather than sitting next to it. A pure 0 0% grey reads as
// unchosen; this reads as a room with the lights down.

export const DARK: ThemeColors = {
    background: '30 6% 7%',
    foreground: '35 12% 95%',
    surface: '30 5% 10%',
    'surface-elevated': '30 5% 14%',
    card: '30 5% 10%',
    'card-foreground': '35 12% 95%',
    popover: '30 5% 12%',
    'popover-foreground': '35 12% 95%',

    primary: '35 100% 55%',
    'primary-foreground': '30 25% 8%',
    accent: '35 100% 55%',
    'accent-foreground': '30 25% 8%',
    secondary: '30 5% 16%',
    'secondary-foreground': '35 10% 95%',
    muted: '30 4% 20%',
    'muted-foreground': '32 6% 62%',

    border: '30 5% 19%',
    input: '30 5% 16%',
    ring: '35 100% 55%',

    destructive: '358 82% 66%',
    'destructive-foreground': '358 35% 10%',
    success: '150 62% 52%',
    'success-foreground': '150 40% 8%',
    warning: '45 95% 55%',
    'warning-foreground': '40 40% 10%',
    info: '210 90% 66%',
    'info-foreground': '210 45% 10%',

    playhead: '358 85% 62%',

    // A piano is black and white in any room, so these are identical in both
    // themes. They are still tokens rather than literals: a fixed colour that
    // is deliberately fixed belongs in the system, where the decision is
    // visible, not scattered through a component as `bg-zinc-800`.
    // A scrim darkens whatever is behind it, so it is the same in both themes.
    // clip-foreground is not: it sits on the track colour, and the track colour
    // is bright on the dark timeline and deep on the light one — so the label
    // that reads on it inverts with the fill, not with the theme's text.
    scrim: '30 8% 4%',
    'clip-foreground': '30 25% 10%',

    'piano-white': '40 12% 92%',
    'piano-white-foreground': '30 8% 28%',
    'piano-black': '30 6% 16%',
    'piano-black-foreground': '35 6% 62%',

    'track-drums': '358 72% 62%',
    'track-bass': '232 70% 64%',
    'track-keys': '272 60% 68%',
    'track-melody': '145 55% 48%',
    'track-vocals': '315 65% 64%',
    'track-fx': '190 75% 48%',

    'drum-kick': '358 70% 58%',
    'drum-snare': '12 75% 58%',
    'drum-tom': '272 55% 62%',
    'drum-hat': '50 88% 58%',
    'drum-cymbal': '190 70% 52%',
    'drum-perc': '145 50% 48%',
    'drum-other': '30 5% 50%',
};

// ============================================
// Light theme
// ============================================
//
// Not an inversion. Categorical hues are darkened and saturated so they hold
// their identity against white — the same track is recognisably the same track
// in either theme, which is the only thing the light theme has to guarantee.

export const LIGHT: ThemeColors = {
    background: '40 20% 99%',
    foreground: '30 10% 10%',
    surface: '38 16% 96%',
    'surface-elevated': '0 0% 100%',
    card: '0 0% 100%',
    'card-foreground': '30 10% 10%',
    popover: '0 0% 100%',
    'popover-foreground': '30 10% 10%',

    primary: '29 96% 34%',
    'primary-foreground': '0 0% 100%',
    accent: '29 96% 34%',
    'accent-foreground': '0 0% 100%',
    secondary: '38 14% 93%',
    'secondary-foreground': '30 10% 10%',
    muted: '38 14% 93%',
    'muted-foreground': '32 6% 42%',

    border: '36 12% 87%',
    input: '36 12% 87%',
    ring: '29 96% 34%',

    destructive: '358 70% 42%',
    'destructive-foreground': '0 0% 100%',
    success: '150 62% 26%',
    'success-foreground': '0 0% 100%',
    warning: '32 95% 30%',
    'warning-foreground': '0 0% 100%',
    info: '210 85% 38%',
    'info-foreground': '0 0% 100%',

    playhead: '358 75% 50%',

    // Identical to the dark theme — see the note in DARK.
    // Fixed in both themes, and for the same reason: a scrim darkens whatever
    // is behind it, and a clip label sits on a saturated colour rather than on
    // a theme surface. Neither has anything to invert against.
    scrim: '30 8% 4%',
    'clip-foreground': '40 15% 98%',

    'piano-white': '40 12% 92%',
    'piano-white-foreground': '30 8% 28%',
    'piano-black': '30 6% 16%',
    'piano-black-foreground': '35 6% 62%',

    'track-drums': '358 68% 50%',
    'track-bass': '232 62% 52%',
    'track-keys': '272 52% 54%',
    'track-melody': '145 55% 34%',
    'track-vocals': '315 58% 48%',
    'track-fx': '190 78% 34%',

    'drum-kick': '358 66% 48%',
    'drum-snare': '12 70% 46%',
    'drum-tom': '272 48% 52%',
    'drum-hat': '45 85% 38%',
    'drum-cymbal': '190 72% 36%',
    'drum-perc': '145 48% 34%',
    'drum-other': '30 5% 45%',
};

// ============================================
// Track roles
// ============================================
//
// Six roles, six hues spread evenly around the wheel with a deliberate gap at
// 20°–50° so nothing competes with the amber accent. Order here is the order
// `getNextTrackColor` assigns them, so consecutive new tracks land far apart on
// the wheel instead of shading into each other.
//
// Accessibility: track colour is never the only signal. Every track carries its
// name, and every clip its label — red/green adjacency is safe because nothing
// depends on telling them apart.

export const TRACK_ROLES = ['drums', 'bass', 'keys', 'melody', 'vocals', 'fx'] as const;
export type TrackRole = (typeof TRACK_ROLES)[number];

/** General-MIDI drum families, used for the sequencer's lane rail. */
export const DRUM_FAMILIES = [
    'kick',
    'snare',
    'tom',
    'hat',
    'cymbal',
    'perc',
    'other',
] as const;
export type DrumFamily = (typeof DRUM_FAMILIES)[number];

// ============================================
// Radius
// ============================================
//
// One base, three derivations, so a change to --radius moves the whole product
// together. Usage rules live in design/README.md § Shape.

export const RADIUS_BASE = '0.5rem';

export const RADIUS = {
    xs: 'calc(var(--radius) - 6px)', // sequencer steps, piano-roll notes — 2px
    sm: 'calc(var(--radius) - 4px)', // clips, chips, badges — 4px
    md: 'calc(var(--radius) - 2px)', // buttons, inputs, rows — 6px
    lg: 'var(--radius)', //             panels, cards, modals — 8px
    xl: 'calc(var(--radius) + 4px)', // hero surfaces — 12px
} as const;

// ============================================
// Motion
// ============================================
//
// The design language is 120–160ms: fast enough to feel mechanical, slow enough
// to be seen. `instant` exists for grid interactions where 120ms already reads
// as lag — toggling a step should feel like a switch, not an animation.

export const MOTION = {
    instant: '80ms',
    fast: '120ms',
    base: '150ms',
    slow: '240ms',
} as const;

export const EASING = {
    /** Default. Decelerating — things arrive and settle. */
    out: 'cubic-bezier(0.2, 0, 0, 1)',
    /** Two-way movement: panels opening and closing, drawers. */
    inOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
} as const;

// ============================================
// Elevation
// ============================================
//
// Shadow is depth, not decoration. Four steps, and nothing invents a fifth.

export const ELEVATION = {
    clip: '0 2px 8px rgb(0 0 0 / 0.30)',
    'clip-hover': '0 4px 12px rgb(0 0 0 / 0.40)',
    panel: '0 4px 16px rgb(0 0 0 / 0.50)',
    modal: '0 16px 48px rgb(0 0 0 / 0.60)',
} as const;

// ============================================
// Layout
// ============================================
//
// Fixed chrome dimensions. These are structural, not spacing — the 4px spacing
// scale is Tailwind's default and is not redefined here.

export const LAYOUT = {
    transport: '48px',
    browser: '240px',
    inspector: '260px',
    editor: '35vh',
} as const;

// ============================================
// Typography
// ============================================
//
// Two families, and a scale that is Tailwind's default plus one step down.
// `2xs` exists because DAW chrome genuinely needs 10px — bar numbers, step
// labels, meter ticks — and inventing it once is better than arbitrary
// `text-[10px]` scattered through the timeline.

export const TYPE_SCALE = {
    '2xs': { size: '0.625rem', leading: '0.75rem', use: 'ruler numbers, step labels, meter ticks' },
    xs: { size: '0.75rem', leading: '1rem', use: 'the DAW default — track names, values, labels' },
    sm: { size: '0.875rem', leading: '1.25rem', use: 'panel body, menu items, dialog text' },
    base: { size: '1rem', leading: '1.5rem', use: 'marketing body copy' },
    lg: { size: '1.125rem', leading: '1.75rem', use: 'dialog titles, lead paragraphs' },
    xl: { size: '1.25rem', leading: '1.75rem', use: 'section headings' },
    '2xl': { size: '1.5rem', leading: '2rem', use: 'page headings' },
    '4xl': { size: '2.25rem', leading: '2.5rem', use: 'marketing section headlines' },
    '6xl': { size: '3.75rem', leading: '1', use: 'hero — desktop only' },
} as const;

export const FONT_ROLES = {
    sans: 'Inter — all UI and prose.',
    mono: 'JetBrains Mono — anything that counts: BPM, bar:beat, timecode, dB, Hz, key bindings. Always with tabular-nums so digits stop jittering.',
} as const;

/**
 * Font stacks. The `--font-inter` / `--font-mono` variables at the head of each
 * stack are injected by `next/font` in the root layout; everything after them is
 * the fallback chain that renders before the webfont arrives.
 */
export const FONT_STACKS = {
    sans:
        'var(--font-inter), ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, ' +
        '"Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    mono:
        'var(--font-jetbrains-mono), ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, ' +
        '"Liberation Mono", monospace',
} as const;

/**
 * Which colour tokens belong together, and what each group is for. Drives the
 * comment headings in the generated CSS and the grouping in design/README.md, so
 * a new token cannot be added without deciding what it means.
 */
export const COLOR_GROUPS: { title: string; note: string; tokens: (keyof ThemeColors)[] }[] = [
    {
        title: 'Ground and elevation',
        note: 'background < surface < surface-elevated. Nothing sits on nothing.',
        tokens: [
            'background', 'foreground', 'surface', 'surface-elevated',
            'card', 'card-foreground', 'popover', 'popover-foreground',
        ],
    },
    {
        title: 'Brand',
        note: 'Amber is "this is on". Never use it for a resting control.',
        tokens: [
            'primary', 'primary-foreground', 'accent', 'accent-foreground',
            'secondary', 'secondary-foreground', 'muted', 'muted-foreground',
        ],
    },
    {
        title: 'Lines',
        note: 'border for structure, input for fields, ring for focus only.',
        tokens: ['border', 'input', 'ring'],
    },
    {
        title: 'State',
        note: 'Meaning, not decoration — pick by what happened, never by hue.',
        tokens: [
            'destructive', 'destructive-foreground', 'success', 'success-foreground',
            'warning', 'warning-foreground', 'info', 'info-foreground',
        ],
    },
    {
        title: 'Transport',
        note: 'The playhead red is reserved. Nothing else in the product uses it.',
        tokens: ['playhead'],
    },
    {
        title: 'Fixed surfaces',
        note: 'Identical in both themes on purpose — nothing here has a theme to invert against.',
        tokens: [
            'scrim', 'clip-foreground',
            'piano-white', 'piano-white-foreground',
            'piano-black', 'piano-black-foreground',
        ],
    },
    {
        title: 'Track roles',
        note: 'The categorical scale. Reused anywhere things need telling apart.',
        tokens: [
            'track-drums', 'track-bass', 'track-keys',
            'track-melody', 'track-vocals', 'track-fx',
        ],
    },
    {
        title: 'Drum families',
        note: 'The sequencer lane rail, grouped the way a drummer groups a kit.',
        tokens: [
            'drum-kick', 'drum-snare', 'drum-tom', 'drum-hat',
            'drum-cymbal', 'drum-perc', 'drum-other',
        ],
    },
];

// ============================================
// Hex forms
// ============================================
//
// A few surfaces cannot read a CSS variable: the PWA manifest, the
// `<meta name="theme-color">` tag, and anything an OS renders on our behalf.
// They get a hex derived from the same token rather than a second opinion —
// `npm run design:tokens` writes public/manifest.json from these, and
// `npm run check` fails if someone edits it by hand.

/** Convert a bare HSL triple ("35 100% 55%") to `#rrggbb`. */
export function hslToHex(hsl: Hsl): string {
    const [h, s, l] = hsl.split(/\s+/).map((part) => parseFloat(part));
    const saturation = s / 100;
    const lightness = l / 100;

    const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
    const second = chroma * (1 - Math.abs(((h / 60) % 2) - 1));
    const match = lightness - chroma / 2;

    const [r, g, b] =
        h < 60 ? [chroma, second, 0] :
        h < 120 ? [second, chroma, 0] :
        h < 180 ? [0, chroma, second] :
        h < 240 ? [0, second, chroma] :
        h < 300 ? [second, 0, chroma] :
        [chroma, 0, second];

    const channel = (value: number) =>
        Math.round((value + match) * 255).toString(16).padStart(2, '0');

    return `#${channel(r)}${channel(g)}${channel(b)}`;
}

/**
 * The colour the browser paints its own chrome with. The dark ground rather
 * than the accent: ComposeYogi opens dark, and an amber address bar above a
 * near-black studio reads as a mistake rather than as branding.
 */
export const THEME_COLOR_HEX = hslToHex(DARK.background);

/** The accent, for places that need the brand as a literal. */
export const ACCENT_HEX = hslToHex(DARK.accent);

// ============================================
// Contrast
// ============================================
//
// WCAG relative luminance and contrast ratio, so the palette's accessibility is
// a thing the test suite can check rather than a thing someone remembers to
// look at. tests/design-system.test.ts asserts the pairs that actually get used
// together — text on ground, and foreground on its own fill.
//
// The light accent had to be darkened because of this: at 44% lightness it was
// 3.2:1 both as text on the page and under white text on a button, which fails
// AA in both directions. Amber accents are prone to exactly this.

/** WCAG 2.1 relative luminance of a bare HSL triple. */
export function relativeLuminance(hsl: Hsl): number {
    const hex = hslToHex(hsl);
    const channel = (offset: number) => {
        const value = parseInt(hex.slice(1 + offset * 2, 3 + offset * 2), 16) / 255;
        return value <= 0.03928 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * channel(0) + 0.7152 * channel(1) + 0.0722 * channel(2);
}

/** WCAG contrast ratio between two tokens, 1–21. AA wants 4.5 for body text. */
export function contrastRatio(a: Hsl, b: Hsl): number {
    const [light, dark] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
    return (light + 0.05) / (dark + 0.05);
}
