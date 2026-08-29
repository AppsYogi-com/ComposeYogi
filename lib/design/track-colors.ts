// ============================================
// ComposeYogi — Track & Drum Colour Lookup
// ============================================
//
// The one place anything asks "what colour is this track?". Before Sprint 8.6
// there were three answers depending on which component you asked, and one of
// them didn't render at all.
//
// Two shapes, because there are two consumers:
//   - Static Tailwind class maps for DOM. They must be written out in full —
//     `bg-track-${role}` is invisible to Tailwind's extractor and produces no
//     CSS. That is exactly the bug this module replaces.
//   - `hsl(var(--token))` strings for inline styles and canvas, where a class
//     is not an option.
//
// Colour values themselves live in lib/design/tokens.ts. Nothing here holds one.

import type { DrumFamily, TrackRole } from './tokens';

// ============================================
// DOM — static class maps
// ============================================

export const TRACK_BG: Record<TrackRole, string> = {
    drums: 'bg-track-drums',
    bass: 'bg-track-bass',
    keys: 'bg-track-keys',
    melody: 'bg-track-melody',
    vocals: 'bg-track-vocals',
    fx: 'bg-track-fx',
};

export const TRACK_TEXT: Record<TrackRole, string> = {
    drums: 'text-track-drums',
    bass: 'text-track-bass',
    keys: 'text-track-keys',
    melody: 'text-track-melody',
    vocals: 'text-track-vocals',
    fx: 'text-track-fx',
};

export const DRUM_BG: Record<DrumFamily, string> = {
    kick: 'bg-drum-kick',
    snare: 'bg-drum-snare',
    tom: 'bg-drum-tom',
    hat: 'bg-drum-hat',
    cymbal: 'bg-drum-cymbal',
    perc: 'bg-drum-perc',
    other: 'bg-drum-other',
};

// ============================================
// Inline styles
// ============================================

/**
 * A track's colour as a CSS value. Resolves through the custom property, so it
 * follows the theme — unlike the hex literals this replaces, which stayed dark
 * theme colours in light mode.
 */
export function trackColorValue(role: TrackRole): string {
    return `hsl(var(--track-${role}))`;
}
