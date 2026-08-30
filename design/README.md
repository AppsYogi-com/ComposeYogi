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
| `--primary` | `primary` | `#ff9f1a` `35 100% 55%` | `#aa5403` `29 96% 34%` |
| `--primary-foreground` | `primary-foreground` | `#1a140f` `30 25% 8%` | `#ffffff` `0 0% 100%` |
| `--accent` | `accent` | `#ff9f1a` `35 100% 55%` | `#aa5403` `29 96% 34%` |
| `--accent-foreground` | `accent-foreground` | `#1a140f` `30 25% 8%` | `#ffffff` `0 0% 100%` |
| `--secondary` | `secondary` | `#2b2927` `30 5% 16%` | `#f0eeeb` `38 14% 93%` |
| `--secondary-foreground` | `secondary-foreground` | `#f4f2f1` `35 10% 95%` | `#1c1a17` `30 10% 10%` |
| `--muted` | `muted` | `#353331` `30 4% 20%` | `#f0eeeb` `38 14% 93%` |
| `--muted-foreground` | `muted-foreground` | `#a49e98` `32 6% 62%` | `#6f6962` `32 6% 41%` |

#### Lines

*border for structure, input for fields, ring for focus only.*

| Token | Class | Dark | Light |
|---|---|---|---|
| `--border` | `border` | `#33302e` `30 5% 19%` | `#e2dfda` `36 12% 87%` |
| `--input` | `input` | `#2b2927` `30 5% 16%` | `#e2dfda` `36 12% 87%` |
| `--ring` | `ring` | `#ff9f1a` `35 100% 55%` | `#aa5403` `29 96% 34%` |

#### State

*Meaning, not decoration — pick by what happened, never by hue.*

| Token | Class | Dark | Light |
|---|---|---|---|
| `--destructive` | `destructive` | `#ef6166` `358 82% 66%` | `#b62025` `358 70% 42%` |
| `--destructive-foreground` | `destructive-foreground` | `#221111` `358 35% 10%` | `#ffffff` `0 0% 100%` |
| `--success` | `success` | `#39d085` `150 62% 52%` | `#196b42` `150 62% 26%` |
| `--success-foreground` | `success-foreground` | `#0c1d14` `150 40% 8%` | `#ffffff` `0 0% 100%` |
| `--warning` | `warning` | `#f9c31f` `45 95% 55%` | `#955104` `32 95% 30%` |
| `--warning-foreground` | `warning-foreground` | `#241d0f` `40 40% 10%` | `#ffffff` `0 0% 100%` |
| `--info` | `info` | `#5aa8f6` `210 90% 66%` | `#0f61b3` `210 85% 38%` |
| `--info-foreground` | `info-foreground` | `#0e1a25` `210 45% 10%` | `#ffffff` `0 0% 100%` |

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
| `--scrim-foreground` | `scrim-foreground` | `#fbfaf9` `40 15% 98%` | `#fbfaf9` `40 15% 98%` |
| `--clip-foreground` | `clip-foreground` | `#201a13` `30 25% 10%` | `#fbfaf9` `40 15% 98%` |
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

## The cursor names the gesture

The pointer is the smallest promise the interface makes, and it gets made
hundreds of times a session. When it is picked per-component it goes wrong the
same way every design system's does: the piano-roll velocity slider offered a
hand, the identical sliders in the Inspector two panels away offered an arrow,
and nothing anywhere said which was correct.

So it is not picked per-component. Each cursor means one thing, the primitives
in `components/ui` carry it, and a call site that adds its own is either
overriding the primitive or re-implementing it.

| The gesture | Cursor | Where it comes from |
|---|---|---|
| Activate — buttons, select triggers, tabs, panel toggles | `pointer` | `Button`, `SelectTrigger` |
| Set a value on a track | `pointer` on the rail, `grab` → `grabbing` on the thumb | `Slider` |
| Move an object — clips, track rows, browser items | `grab` → `grabbing` | the draggable |
| Resize an edge — clip edges, loop braces | `ew-resize` / `ns-resize` | the handle |
| Draw or select a range — waveform, velocity lane | `crosshair` / `ns-resize` | the surface |
| Type | browser default (`text`) | never overridden |
| Looks interactive, is not — readouts inside a chip | `default` | the readout |
| Disabled | `not-allowed` | the primitive |

Two rules follow from the table:

- **Do not put `cursor-pointer` on a `Button` or a `Slider`.** They already have
  it. Repeating it is how the two drift apart later.
- **A bare `<div>` that responds to a click needs the cursor spelled out**, since
  it inherits nothing. That is the only case where a call site should be setting
  one — and it is usually a sign the thing wanted to be a `Button`.

---

## One glyph, one meaning

Icons are `lucide-react`, and nothing else. Sixty-five of them are in use, which is enough
that picking one by eye no longer works: the custom-instrument feature shipped marked with
`Sparkles`, which is the FX tab's glyph, sitting in the same rail two rows above it. The
same shape meant "effects" in one place and "a sound you made" in the other, and nobody
noticed until it was on screen.

So: **before using an icon, check whether it already means something.** The table below is
the set that carries meaning. Everything absent from it — chevrons, `X`, `Check`,
`Loader2`, `Trash2`, `Search`, `Plus`, `GripVertical` — is generic chrome and may be reused
freely, because nobody reads a chevron as a noun.

| Glyph | Means | Where it is spoken for |
|---|---|---|
| `LayoutTemplate` | Templates | Browser tab |
| `Piano` | A built-in instrument | Browser tab + every built-in row; Piano Roll editor tab |
| `Music` | Samples | Browser tab; Inspector TRACK section |
| `Sparkles` | Effects | Browser FX tab + FX rows; Inspector EFFECTS section |
| `AudioLines` | **A custom instrument** | My Instruments group, custom rows, Customize action, editor dialog |
| `AudioWaveform` | The waveform *view* | Editor tab; visualizer mode |
| `Grid3X3` | The drum grid | Editor tab |
| `Sliders` | Project settings | Inspector PROJECT section |
| `Waves` | Feel / clip macros | Inspector FEEL section |
| `Clock` | A clip | Inspector CLIP section |
| `Mic` | Record / arm | Transport, track headers, calibration |
| `Headphones` | Solo / monitoring | Track headers, calibration |
| `Volume2` / `VolumeX` | Audible / muted | Track headers, transport |
| `Repeat` | Loop | Transport, waveform editor |
| `Play` `Pause` `Square` `SkipBack` `Circle` | Transport actions | Transport, and any local preview |
| `Keyboard` | Shortcuts | Transport, shortcuts sheet |
| `Activity` | Latency calibration | Calibration dialog, visualizer |
| `FolderOpen` | Projects | Project selector, browser |
| `Download` / `Upload` | Export / import | Export and import dialogs, browser |

`AudioLines` and `AudioWaveform` are deliberately close relatives — discrete bars versus a
continuous wave — and they sit in different panels. If a third audio-ish glyph is ever
needed, that pair is already at the limit of what reads apart at 14px.

### Sizes

| Context | Size |
|---|---|
| Inside a list row, a tab, or a small button | `h-4 w-4` (or `h-3.5` where the row is dense) |
| A dialog header, beside its title | `h-5 w-5` |
| Inline in body text | match the text's line box, never larger |

A dialog header icon that is `h-4` reads as a lighter title than the dialogs around it.
All of them are `h-5`.

### Naming the action, not the appearance

An icon is chosen for what the control *does*, not for what looks nice next to it. The
instrument editor shipped with a `Play` glyph in its header — a dialog that plays nothing,
while the real Play sat two inches below it on Preview. If the glyph names an action the
control does not perform, it is the wrong glyph however well it sits.

And an icon is never the only signal: see principle 3. Every icon here has a label, a
tooltip, or an `aria-label` beside it.

### When lucide has nothing

It happens — no library icon means "an instrument you shaped", and the shortlist for
`AudioLines` was thirteen glyphs each of which got half the meaning. A custom SVG is
allowed, on these terms:

- It lives in `components/icons/`, exported as a React component like any lucide icon
- It matches lucide's contract exactly, or it will look subtly wrong beside sixty-five that
  do: `24×24` viewBox, `fill="none"`, `stroke="currentColor"`, `strokeWidth={2}`,
  `strokeLinecap="round"`, `strokeLinejoin="round"`
- `currentColor` is not optional. A hex literal fails `tests/design-system.test.ts`, which
  is what keeps the icon themed in both light and dark without knowing about either
- It is added to the table above in the same commit

Prefer a library icon that is 80% right over a bespoke one that is 100% right and slightly
off-grid. Reach for a custom glyph when the concept is genuinely specific to this product
and every candidate misleads — not when the shortlist is merely uninspiring.

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
- Motion respects `prefers-reduced-motion` — see below.
- Every control reachable by mouse is reachable by keyboard, and the shortcut
  registry in `lib/shortcuts` is the source of truth for what those keys are.

### Motion, when someone has asked for less of it

One block in `app/globals.css` answers `prefers-reduced-motion`, so there is one
answer rather than a decision per component — the same reasoning as the cursor
table. `tests/design-system.test.ts` fails the build if it goes missing, and if a
new `infinite` animation appears without saying what it rests as.

- **The blanket rule is `0.01ms`, never `none`.** Radix unmounts a dialog on
  `animationend`, and an animation that never runs never ends: `none` would leave
  every closed dialog in the DOM. 0.01ms cannot be perceived and still fires.
- **A spinner is the one carve-out.** It reports that work is still happening, and
  frozen it reports the opposite. Rotation in place is not what triggers
  vestibular symptoms — travel, parallax and zoom are — so it keeps turning,
  slower.
- **A motion that is a *state* has to keep saying so when it stops.** The record
  glow settles at its brightest, the recording region stays tinted, the logo wave
  holds a static wave rather than freezing flat. Ask what the animation was
  telling the user, then say it without moving.
- **Write those resting states `!important`.** A running animation outranks a
  normal declaration, so a resting state written plainly wins only if that
  animation happens to have finished — measured, two rules from the same block
  disagreed in the same frame. `!important` outranks animations unconditionally.

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
image can. **Double-click one to open it**: they need no server and no build,
which is why the token data is a script rather than a fetch.

| Preview | What it is for |
|---|---|
| `foundations` | The full palette in both themes, the type scale, shape, motion, elevation. Builds itself from `tokens.js`, so it always shows every token. |
| `components` | Transport, faders, track headers, clip states, editors, fields, status, panels |
| `og-image` | The social card. Exported to `public/og-image.png`, not to `artboards/` — it is a product asset, built here so it cannot drift from the palette. |

Regenerate with `npm run design:artboards` (needs Chrome; the HTML works
without it).

---

*Part of [Sprint 8.6](../ROADMAP.md). All UI work must comply with this system —
it is a Definition-of-Done criterion, not a suggestion.*
