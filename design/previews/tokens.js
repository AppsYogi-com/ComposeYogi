/*
 * Generated from lib/design/tokens.ts by scripts/generate-design-tokens.js.
 * Do not edit — run `npm run design:tokens`.
 */
window.COMPOSEYOGI_TOKENS = {
    "groups": [
        {
            "title": "Ground and elevation",
            "note": "background < surface < surface-elevated. Nothing sits on nothing.",
            "tokens": [
                "background",
                "foreground",
                "surface",
                "surface-elevated",
                "card",
                "card-foreground",
                "popover",
                "popover-foreground"
            ]
        },
        {
            "title": "Brand",
            "note": "Amber is \"this is on\". Never use it for a resting control.",
            "tokens": [
                "primary",
                "primary-foreground",
                "accent",
                "accent-foreground",
                "secondary",
                "secondary-foreground",
                "muted",
                "muted-foreground"
            ]
        },
        {
            "title": "Lines",
            "note": "border for structure, input for fields, ring for focus only.",
            "tokens": [
                "border",
                "input",
                "ring"
            ]
        },
        {
            "title": "State",
            "note": "Meaning, not decoration — pick by what happened, never by hue.",
            "tokens": [
                "destructive",
                "destructive-foreground",
                "success",
                "success-foreground",
                "warning",
                "warning-foreground",
                "info",
                "info-foreground"
            ]
        },
        {
            "title": "Transport",
            "note": "The playhead red is reserved. Nothing else in the product uses it.",
            "tokens": [
                "playhead"
            ]
        },
        {
            "title": "Fixed surfaces",
            "note": "Identical in both themes on purpose — nothing here has a theme to invert against.",
            "tokens": [
                "scrim",
                "scrim-foreground",
                "clip-foreground",
                "piano-white",
                "piano-white-foreground",
                "piano-black",
                "piano-black-foreground"
            ]
        },
        {
            "title": "Track roles",
            "note": "The categorical scale. Reused anywhere things need telling apart.",
            "tokens": [
                "track-drums",
                "track-bass",
                "track-keys",
                "track-melody",
                "track-vocals",
                "track-fx"
            ]
        },
        {
            "title": "Drum families",
            "note": "The sequencer lane rail, grouped the way a drummer groups a kit.",
            "tokens": [
                "drum-kick",
                "drum-snare",
                "drum-tom",
                "drum-hat",
                "drum-cymbal",
                "drum-perc",
                "drum-other"
            ]
        }
    ],
    "type": {
        "2xs": {
            "size": "0.625rem",
            "leading": "0.75rem",
            "use": "ruler numbers, step labels, meter ticks"
        },
        "xs": {
            "size": "0.75rem",
            "leading": "1rem",
            "use": "the DAW default — track names, values, labels"
        },
        "sm": {
            "size": "0.875rem",
            "leading": "1.25rem",
            "use": "panel body, menu items, dialog text"
        },
        "base": {
            "size": "1rem",
            "leading": "1.5rem",
            "use": "marketing body copy"
        },
        "lg": {
            "size": "1.125rem",
            "leading": "1.75rem",
            "use": "dialog titles, lead paragraphs"
        },
        "xl": {
            "size": "1.25rem",
            "leading": "1.75rem",
            "use": "section headings"
        },
        "2xl": {
            "size": "1.5rem",
            "leading": "2rem",
            "use": "page headings"
        },
        "4xl": {
            "size": "2.25rem",
            "leading": "2.5rem",
            "use": "marketing section headlines"
        },
        "6xl": {
            "size": "3.75rem",
            "leading": "1",
            "use": "hero — desktop only"
        }
    },
    "radius": {
        "xs": "calc(var(--radius) - 6px)",
        "sm": "calc(var(--radius) - 4px)",
        "md": "calc(var(--radius) - 2px)",
        "lg": "var(--radius)",
        "xl": "calc(var(--radius) + 4px)"
    },
    "motion": {
        "instant": "80ms",
        "fast": "120ms",
        "base": "150ms",
        "slow": "240ms"
    },
    "easing": {
        "out": "cubic-bezier(0.2, 0, 0, 1)",
        "inOut": "cubic-bezier(0.4, 0, 0.2, 1)"
    },
    "elevation": {
        "clip": "0 2px 8px rgb(0 0 0 / 0.30)",
        "clip-hover": "0 4px 12px rgb(0 0 0 / 0.40)",
        "panel": "0 4px 16px rgb(0 0 0 / 0.50)",
        "modal": "0 16px 48px rgb(0 0 0 / 0.60)"
    },
    "layout": {
        "transport": "48px",
        "browser": "240px",
        "inspector": "260px",
        "editor": "35vh"
    }
};
