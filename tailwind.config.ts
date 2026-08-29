// ============================================
// ComposeYogi — Tailwind Configuration
// ============================================
//
// This file holds NO design values. Everything comes from lib/design/tokens.ts,
// the same module that generates the CSS custom properties in app/globals.css —
// so a token cannot exist as a class without existing as a variable, and cannot
// change in one place without changing in the other.
//
// Colours are declared as `hsl(var(--token) / <alpha-value>)` so opacity
// modifiers work: `bg-accent/30`, `border-warning/40`, `text-track-bass/70`.

import type { Config } from 'tailwindcss';

import {
    DRUM_FAMILIES,
    EASING,
    ELEVATION,
    LAYOUT,
    MOTION,
    RADIUS,
    TRACK_ROLES,
} from './lib/design/tokens';

/** `hsl(var(--x) / <alpha-value>)` — the form Tailwind needs for `/50` to work. */
const token = (name: string) => `hsl(var(--${name}) / <alpha-value>)`;

/** A colour plus its paired foreground, the shadcn convention. */
const pair = (name: string) => ({
    DEFAULT: token(name),
    foreground: token(`${name}-foreground`),
});

const fromList = (names: readonly string[], prefix: string) =>
    Object.fromEntries(names.map((name) => [name, token(`${prefix}-${name}`)]));

const config: Config = {
    content: [
        './app/**/*.{js,ts,jsx,tsx,mdx}',
        './components/**/*.{js,ts,jsx,tsx,mdx}',
        // lib/ has to be scanned: the static class maps in lib/design/ are where
        // `bg-track-drums` and friends are written out, and a class Tailwind
        // never sees is a class that produces no CSS.
        './lib/**/*.{js,ts,jsx,tsx,mdx}',
    ],
    darkMode: 'class',
    theme: {
        extend: {
            colors: {
                // Ground and elevation
                background: token('background'),
                foreground: token('foreground'),
                surface: {
                    DEFAULT: token('surface'),
                    elevated: token('surface-elevated'),
                },
                card: pair('card'),
                popover: pair('popover'),

                // Brand
                primary: pair('primary'),
                accent: pair('accent'),
                secondary: pair('secondary'),
                muted: pair('muted'),

                // Lines
                border: token('border'),
                input: token('input'),
                ring: token('ring'),

                // State
                destructive: pair('destructive'),
                success: pair('success'),
                warning: pair('warning'),
                info: pair('info'),

                // Transport
                playhead: token('playhead'),

                // Fixed surfaces
                scrim: pair('scrim'),
                'clip-foreground': token('clip-foreground'),
                piano: {
                    white: token('piano-white'),
                    'white-foreground': token('piano-white-foreground'),
                    black: token('piano-black'),
                    'black-foreground': token('piano-black-foreground'),
                },

                // Categorical
                track: fromList(TRACK_ROLES, 'track'),
                drum: fromList(DRUM_FAMILIES, 'drum'),
            },

            fontFamily: {
                sans: ['var(--font-sans)'],
                mono: ['var(--font-mono)'],
            },

            fontSize: {
                // One step below Tailwind's scale, for DAW chrome that genuinely
                // needs 10px: ruler numbers, step labels, meter ticks.
                '2xs': ['0.625rem', { lineHeight: '0.75rem' }],
            },

            spacing: LAYOUT,
            borderRadius: RADIUS,
            boxShadow: ELEVATION,
            transitionDuration: MOTION,
            transitionTimingFunction: {
                out: EASING.out,
                'in-out': EASING.inOut,
            },

            animation: {
                'pulse-beat': 'pulse-beat 0.5s ease-in-out',
                'slide-up': 'slide-up var(--motion-base) var(--ease-out)',
                'slide-down': 'slide-down var(--motion-base) var(--ease-out)',
                glow: 'glow 2s ease-in-out infinite',
            },
            keyframes: {
                'pulse-beat': {
                    '0%, 100%': { opacity: '1' },
                    '50%': { opacity: '0.7' },
                },
                'slide-up': {
                    '0%': { transform: 'translateY(100%)' },
                    '100%': { transform: 'translateY(0)' },
                },
                'slide-down': {
                    '0%': { transform: 'translateY(0)' },
                    '100%': { transform: 'translateY(100%)' },
                },
                glow: {
                    '0%, 100%': { boxShadow: '0 0 5px currentColor' },
                    '50%': { boxShadow: '0 0 20px currentColor' },
                },
            },
        },
    },
    plugins: [require('tailwindcss-animate')],
};

export default config;
