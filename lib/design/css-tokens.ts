// ============================================
// ComposeYogi — Runtime Token Resolution
// ============================================
//
// Canvas cannot use a class or a `var()` reference: `ctx.fillStyle` needs a
// finished colour string. These helpers read the computed value of a design
// token so the timeline, the waveform editor and the peak renderers draw from
// the same palette as the DOM instead of carrying their own hex literals.
//
// Anything that draws with these must re-run when the theme changes — depend on
// `resolvedTheme` from next-themes in the effect that draws, or the canvas keeps
// the previous theme's colours until something else forces a repaint.

/** Raw value of a CSS custom property, or '' before hydration. */
export function readCssVar(name: string): string {
    if (typeof window === 'undefined') return '';
    return getComputedStyle(document.documentElement).getPropertyValue(`--${name}`).trim();
}

/**
 * A design token as a canvas-ready colour.
 *
 * Colour tokens are stored as bare HSL triples ("35 100% 55%") so Tailwind can
 * append an alpha — which means this is also the only place that knows how to
 * turn one back into a colour.
 *
 * @param alpha 0–1. Omit for fully opaque.
 */
export function tokenColor(name: string, alpha?: number): string {
    const raw = readCssVar(name);
    if (!raw) return 'transparent';
    if (raw.includes('(')) return raw; // already a finished colour
    return alpha === undefined ? `hsl(${raw})` : `hsl(${raw} / ${alpha})`;
}

/**
 * A canvas `font` shorthand using the product's mono stack. Everything drawn on
 * a canvas in this app is a number — timecodes, seconds, bar counts — so this is
 * the only font helper there needs to be.
 */
export function monoFont(sizePx: number): string {
    const stack = readCssVar('font-mono') || 'monospace';
    return `${sizePx}px ${stack}`;
}
