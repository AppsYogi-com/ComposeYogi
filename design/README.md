# ComposeYogi Design System

The studio has one visual language, and this is it. Everything the interface
draws — colour, type, shape, motion, depth — comes from
[`lib/design/tokens.ts`](../lib/design/tokens.ts), and the build fails if
anything says otherwise.

**If you are about to write UI, you need three things from this page:** the
[token reference](#token-reference), the [usage rules](#usage-rules), and
[what the build enforces](#what-the-build-enforces).

---

## Why this is enforced rather than documented

Before this system existed, ComposeYogi's six track colours were defined in
three places that disagreed. The same track was red in its header, orange on its
clip, and — because its colour class was built by string interpolation, which
Tailwind cannot see — completely invisible in the browser panel. Nobody had done
anything careless; the definitions had simply drifted apart over time, the way
they always do.

So the rule here is not "please use the tokens". It is that a colour outside the
system fails `npm run check`. The system is a build step, not a convention.

---

## Principles

**1. Beginner-grade cognitive load over a DAW-grade engine.**
The product's north star is a first-time user recording a vocal and saying *this
felt like a real studio*. Depth is revealed progressively, never removed — so
the interface should look capable at rest and only get denser as you go deeper.

**2. Amber means "this is on".**
The accent is reserved for active state: playing, armed, looped, selected,
enabled. A resting control never wears it. This is why the six track colours
deliberately vacate the 20°–50° hue band — nothing on a timeline should be
mistakable for something that is switched on.

**3. Colour is never the only signal.**
Every track carries its name, every clip its label, every state an icon or a
word. That is what makes a red/green pair in the categorical scale safe, and it
is what the interface must keep true.

**4. Chrome recedes; content does not.**
Track lanes, clips and waveforms are the subject. Panels, rails and toolbars are
the frame. When something has to give, the frame gives.

**5. The instrument is not the interface.**
Piano keys are black and white in any room. Where a control depicts a real
object, it keeps that object's colours in both themes — deliberately, and as a
token, so the decision is visible rather than scattered.

---

## Token reference

Values below are generated from `lib/design/tokens.ts`. Do not edit this
section — run `npm run design:tokens`.

<!-- === BEGIN generated token reference === -->

### Colour tokens

#### Ground and elevation

*background < surface < surface-elevated. Nothing sits on nothing.*

| Token | Class | Dark | Light |
|---|---|---|---|
| `--background` | `background` | `#131211` `30 6% 7%` | `#fdfdfc` `40 20% 99%` |
| `--foreground` | `foreground` | `#f4f3f1` `35 12% 95%` | `#1c1a17` `30 10% 10%` |
| `--surface` | `surface` | `#1b1a18` `30 5% 10%` | `#f6f5f3` `38 16% 96%` |
| `--surface-elevated` | `surface-elevated` | `#252422` `30 5% 14%` | `#ffffff` `0 0% 100%` |
| `--card` | `card` | `#1b1a18` `30 5% 10%` | `#ffffff` `0 0% 100%` |
| `--card-foreground` | `card-foreground` | `#f4f3f1` `35 12% 95%` | `#1c1a17` `30 10% 10%` |
| `--popover` | `popover` | `#201f1d` `30 5% 12%` | `#ffffff` `0 0% 100%` |
| `--popover-foreground` | `popover-foreground` | `#f4f3f1` `35 12% 95%` | `#1c1a17` `30 10% 10%` |

#### Brand

*Amber is "this is on". Never use it for a resting control.*

| Token | Class | Dark | Light |
|---|---|---|---|
| `--primary` | `primary` | `#ff9f1a` `35 100% 55%` | `#db7706` `32 95% 44%` |
| `--primary-foreground` | `primary-foreground` | `#1a140f` `30 25% 8%` | `#ffffff` `0 0% 100%` |
| `--accent` | `accent` | `#ff9f1a` `35 100% 55%` | `#db7706` `32 95% 44%` |
| `--accent-foreground` | `accent-foreground` | `#1a140f` `30 25% 8%` | `#ffffff` `0 0% 100%` |
| `--secondary` | `secondary` | `#2b2927` `30 5% 16%` | `#f0eeeb` `38 14% 93%` |
| `--secondary-foreground` | `secondary-foreground` | `#f4f2f1` `35 10% 95%` | `#1c1a17` `30 10% 10%` |
| `--muted` | `muted` | `#353331` `30 4% 20%` | `#f0eeeb` `38 14% 93%` |
| `--muted-foreground` | `muted-foreground` | `#a49e98` `32 6% 62%` | `#726c65` `32 6% 42%` |

#### Lines

*border for structure, input for fields, ring for focus only.*

| Token | Class | Dark | Light |
|---|---|---|---|
| `--border` | `border` | `#33302e` `30 5% 19%` | `#e2dfda` `36 12% 87%` |
| `--input` | `input` | `#2b2927` `30 5% 16%` | `#e2dfda` `36 12% 87%` |
| `--ring` | `ring` | `#ff9f1a` `35 100% 55%` | `#db7706` `32 95% 44%` |

#### State

*Meaning, not decoration — pick by what happened, never by hue.*

| Token | Class | Dark | Light |
|---|---|---|---|
| `--destructive` | `destructive` | `#e03e43` `358 72% 56%` | `#ce272d` `358 68% 48%` |
| `--destructive-foreground` | `destructive-foreground` | `#ffffff` `0 0% 100%` | `#ffffff` `0 0% 100%` |
| `--success` | `success` | `#2cba73` `150 62% 45%` | `#218352` `150 60% 32%` |
| `--success-foreground` | `success-foreground` | `#ffffff` `0 0% 100%` | `#ffffff` `0 0% 100%` |
| `--warning` | `warning` | `#f9c31f` `45 95% 55%` | `#c47f08` `38 92% 40%` |
| `--warning-foreground` | `warning-foreground` | `#241d0f` `40 40% 10%` | `#ffffff` `0 0% 100%` |
| `--info` | `info` | `#4299f0` `210 85% 60%` | `#1573d1` `210 82% 45%` |
| `--info-foreground` | `info-foreground` | `#ffffff` `0 0% 100%` | `#ffffff` `0 0% 100%` |

#### Transport

*The playhead red is reserved. Nothing else in the product uses it.*

| Token | Class | Dark | Light |
|---|---|---|---|
| `--playhead` | `playhead` | `#f04c51` `358 85% 62%` | `#df2026` `358 75% 50%` |

#### Fixed surfaces

*Identical in both themes on purpose — nothing here has a theme to invert against.*

| Token | Class | Dark | Light |
|---|---|---|---|
| `--scrim` | `scrim` | `#0b0a09` `30 8% 4%` | `#0b0a09` `30 8% 4%` |
| `--clip-foreground` | `clip-foreground` | `#fbfaf9` `40 15% 98%` | `#fbfaf9` `40 15% 98%` |
| `--piano-white` | `piano-white` | `#edebe8` `40 12% 92%` | `#edebe8` `40 12% 92%` |
| `--piano-white-foreground` | `piano-white-foreground` | `#4d4742` `30 8% 28%` | `#4d4742` `30 8% 28%` |
| `--piano-black` | `piano-black` | `#2b2926` `30 6% 16%` | `#2b2926` `30 6% 16%` |
| `--piano-black-foreground` | `piano-black-foreground` | `#a49f98` `35 6% 62%` | `#a49f98` `35 6% 62%` |

#### Track roles

*The categorical scale. Reused anywhere things need telling apart.*

| Token | Class | Dark | Light |
|---|---|---|---|
| `--track-drums` | `track-drums` | `#e4585d` `358 72% 62%` | `#d6292f` `358 68% 50%` |
| `--track-bass` | `track-bass` | `#6374e3` `232 70% 64%` | `#394dd0` `232 62% 52%` |
| `--track-keys` | `track-keys` | `#b17cde` `272 60% 68%` | `#8e4dc7` `272 52% 54%` |
| `--track-melody` | `track-melody` | `#37be6f` `145 55% 48%` | `#27864f` `145 55% 34%` |
| `--track-vocals` | `track-vocals` | `#df68c1` `315 65% 64%` | `#c1339e` `315 58% 48%` |
| `--track-fx` | `track-fx` | `#1fb8d6` `190 75% 48%` | `#13849a` `190 78% 34%` |

#### Drum families

*The sequencer lane rail, grouped the way a drummer groups a kit.*

| Token | Class | Dark | Light |
|---|---|---|---|
| `--drum-kick` | `drum-kick` | `#df494e` `358 70% 58%` | `#cb2a2f` `358 66% 48%` |
| `--drum-snare` | `drum-snare` | `#e46444` `12 75% 58%` | `#c74423` `12 70% 46%` |
| `--drum-tom` | `drum-tom` | `#a269d3` `272 55% 62%` | `#894abf` `272 48% 52%` |
| `--drum-hat` | `drum-hat` | `#f2d336` `50 88% 58%` | `#b38a0f` `45 85% 38%` |
| `--drum-cymbal` | `drum-cymbal` | `#2fbeda` `190 70% 52%` | `#1a889e` `190 72% 36%` |
| `--drum-perc` | `drum-perc` | `#3db870` `145 50% 48%` | `#2d8050` `145 48% 34%` |
| `--drum-other` | `drum-other` | `#868079` `30 5% 50%` | `#78736d` `30 5% 45%` |

### Type scale

| Step | Size | Line height | Use |
|---|---|---|---|
| `text-2xs` | 0.625rem | 0.75rem | ruler numbers, step labels, meter ticks |
| `text-xs` | 0.75rem | 1rem | the DAW default — track names, values, labels |
| `text-sm` | 0.875rem | 1.25rem | panel body, menu items, dialog text |
| `text-base` | 1rem | 1.5rem | marketing body copy |
| `text-lg` | 1.125rem | 1.75rem | dialog titles, lead paragraphs |
| `text-xl` | 1.25rem | 1.75rem | section headings |
| `text-2xl` | 1.5rem | 2rem | page headings |
| `text-4xl` | 2.25rem | 2.5rem | marketing section headlines |
| `text-6xl` | 3.75rem | 1 | hero — desktop only |

### Shape scale

| Step | Value |
|---|---|
| `rounded-xs` | `calc(var(--radius) - 6px)` |
| `rounded-sm` | `calc(var(--radius) - 4px)` |
| `rounded-md` | `calc(var(--radius) - 2px)` |
| `rounded-lg` | `var(--radius)` |
| `rounded-xl` | `calc(var(--radius) + 4px)` |

### Motion tokens

| Token | Value |
|---|---|
| `duration-instant` | 80ms |
| `duration-fast` | 120ms |
| `duration-base` | 150ms |
| `duration-slow` | 240ms |
| `ease-out` | `cubic-bezier(0.2, 0, 0, 1)` |
| `ease-in-out` | `cubic-bezier(0.4, 0, 0.2, 1)` |

### Elevation tokens

| Token | Value |
|---|---|
| `shadow-clip` | `0 2px 8px rgb(0 0 0 / 0.30)` |
| `shadow-clip-hover` | `0 4px 12px rgb(0 0 0 / 0.40)` |
| `shadow-panel` | `0 4px 16px rgb(0 0 0 / 0.50)` |
| `shadow-modal` | `0 16px 48px rgb(0 0 0 / 0.60)` |

### Layout constants

| Token | Value |
|---|---|
| `transport` | 48px |
| `browser` | 240px |
| `inspector` | 260px |
| `editor` | 35vh |

<!-- === END generated token reference === -->

---

## Usage rules

### Colour

| If you need… | Use | Not |
|---|---|---|
| A destructive action, an error, recording | `destructive` | `red-*` |
| A completed export, a saved project, a good calibration | `success` | `green-*` |
| Offline, unsaved, "this might not be what you want" | `warning` | `yellow-*` |
| A neutral fact about a file or format | `info` | `blue-*` |
| Things that must be told apart at a glance | the track scale | a new hue |
| An active, armed, looping or selected state | `accent` | anything else |
| A panel tint or hover wash | `muted` | `surface` |
| The resting track of a fader or slider | `input` | `muted` |

**State colours are reserved for state.** The export dialog's four format icons
are categorical — they say *which kind of file*, not *what happened* — so they
take the track scale rather than borrowing green from `success`. If you find
yourself picking a state colour because it looks right, you want the track
scale.

**Ground stacks in one direction:** `background` → `surface` →
`surface-elevated`. Nothing sits on nothing, and nothing skips a level to look
more important.

### Type

Two families and one scale. Inter carries all UI and prose. JetBrains Mono
carries anything that counts — BPM, bar:beat, timecode, dB, Hz, key bindings —
always with `tabular-nums`, so digits stop jittering as they change.

`text-xs` is the DAW default, not `text-sm`. Chrome in an arrangement view is
dense on purpose; `text-2xs` exists for the places that are denser still, and it
is the floor. There is no step below it.

### Shape

One radius base, four derivations, chosen by what the thing *is*:

- `rounded-xs` — sequencer steps, piano-roll notes
- `rounded-sm` — clips, chips, badges
- `rounded-md` — buttons, inputs, rows
- `rounded-lg` — panels, cards, modals
- `rounded-xl` — hero surfaces

### Motion

The design language is **120–160ms**: fast enough to feel mechanical, slow
enough to be seen. `duration-instant` (80ms) exists for grid interactions where
120ms already reads as lag — toggling a step should feel like a switch, not an
animation. `duration-slow` (240ms) is for surfaces that travel: modals, drawers,
panels.

Default to `ease-out`. Use `ease-in-out` only for movement that reverses.

Nothing in the transport animates on a timer except the record button, and
nothing animates during playback that is not the playhead. A DAW that fidgets
while you are listening is a DAW you stop trusting.

### Elevation

Four steps, and nothing invents a fifth: `shadow-clip`, `shadow-clip-hover`,
`shadow-panel`, `shadow-modal`. Shadow is depth, not decoration — if two things
are at the same depth they take the same shadow, even when one is more
important.

---

## Both themes are real

ComposeYogi opens dark and most people will stay there, but the light theme
ships and is not an afterthought. It is not an inversion either: categorical
hues are darkened and saturated so that the same track is recognisably the same
track in either theme.

Two failure modes to watch for, both of which have already happened here:

- **A value that reads in one theme and vanishes in the other.** A fader rail at
  `muted` is clear on a 7%-lightness ground and invisible on a 96% one.
- **Canvas keeping stale paint.** Anything drawn with `tokenColor()` must list
  `resolvedTheme` in its effect dependencies, or it holds the previous theme's
  colours until something else forces a repaint.

Check both. The tests cannot see either of these.

---

## Accessibility

- Body and label text meets WCAG AA against its own surface. When you introduce
  a new pairing, check it rather than assuming.
- Focus is always visible: 2px `ring`, 2px offset. Never remove the outline
  without replacing it with something at least as loud.
- Colour never carries meaning alone — pair it with a label, an icon, or a
  position.
- Motion respects `prefers-reduced-motion`.
- Every control reachable by mouse is reachable by keyboard, and the shortcut
  registry in `lib/shortcuts` is the source of truth for what those keys are.

---

## Using tokens in code

```tsx
// DOM — classes, from the Tailwind theme
<div className="bg-surface text-foreground rounded-lg shadow-panel" />
<span className="text-warning">Offline</span>

// Track and drum colours — static maps, never interpolation
import { TRACK_BG, DRUM_BG } from '@/lib/design';
<div className={TRACK_BG[track.color]} />

// Inline style, when a class will not do
import { trackColorValue } from '@/lib/design';
<div style={{ backgroundColor: trackColorValue(track.color) }} />

// Canvas — resolved values, and repaint on theme change
import { tokenColor, monoFont } from '@/lib/design';
ctx.fillStyle = tokenColor('accent');
ctx.fillStyle = tokenColor('info', 0.3);   // with alpha
ctx.font = monoFont(10);
```

`bg-track-${role}` produces **no CSS**. Tailwind extracts class names from
source text, so an interpolated name is a name that never becomes a rule. This
is not a style preference — it is the bug that made the browser panel's
instrument dots render with no colour at all.

---

## Changing a token

1. Edit `lib/design/tokens.ts`.
2. Run `npm run design:tokens` — this rewrites `app/globals.css`,
   `public/manifest.json`, and the generated section of this file.
3. Expose it in `tailwind.config.ts` if components should reach it by class.
4. Add it to a `COLOR_GROUPS` entry, deciding what it means. A colour token that
   belongs to no group refuses to generate.
5. Check both themes.

Never hand-edit a generated block. `npm run check` will catch it, but the point
is that the TypeScript is the design and everything else is output.

---

## What the build enforces

`tests/design-system.test.ts` fails the build on:

- Raw Tailwind palette classes (`bg-yellow-500`, `text-zinc-400`, …)
- Hardcoded hex colours anywhere in `app/` or `components/`
- Class names built by interpolation
- Off-scale type and radius values
- `app/globals.css` or `public/manifest.json` out of sync with the tokens
- A colour token missing from either theme, or from every `COLOR_GROUPS` entry
- A track or drum role with no entry in the class maps
- A track hue inside the accent band, or two hues within 30° of each other
- `lib/` missing from Tailwind's `content` globs

What it cannot check is whether the result looks right, or whether it works in
both themes. That is still a person's job, and it is a Definition-of-Done
criterion.

---

## Artboards

[`artboards/`](artboards/) holds the exported reference screens.
[`previews/`](previews/) holds the HTML they are rendered from — these are live
pages that read the same tokens, so they cannot go stale the way an exported
image can. Open one directly in a browser to inspect the system at any size.

| Preview | What it is for |
|---|---|
| `foundations` | The full palette in both themes, the type scale, shape, motion, elevation. Builds itself from `tokens.json`, so it always shows every token. |
| `components` | Transport, faders, track headers, clip states, editors, fields, status, panels |
| `og-image` | The social card. Exported to `public/og-image.png`, not to `artboards/` — it is a product asset, built here so it cannot drift from the palette. |

Regenerate with `npm run design:artboards` (needs Chrome; the HTML works
without it).

---

*Part of [Sprint 8.6](../ROADMAP.md). All UI work must comply with this system —
it is a Definition-of-Done criterion, not a suggestion.*
