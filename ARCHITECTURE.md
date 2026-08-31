# Architecture

How ComposeYogi is put together, for anyone who wants to change it. Read this
before opening a PR that touches audio, state, or persistence — most of the
non-obvious decisions here exist for a reason, and the reasons are written down.

The short version: **state is Zustand, audio is Tone.js, storage is IndexedDB,
and nothing leaves the browser.**

---

## The shape of the app

```
app/[locale]/
  page.tsx              Landing page
  compose/page.tsx      The studio — owns audio lifecycle and reschedule triggers
components/compose/     Transport, TrackList, BrowserPanel, Inspector, editors
lib/
  audio/                Tone.js engine, scheduling, recording, export
  store/                Three Zustand stores
  persistence/          IndexedDB + autosave + migrations
  canvas/               Ruler and waveform renderers
  templates/            Demo arrangements
hooks/                  Reusable React hooks
tests/                  Vitest suites
```

---

## State: three stores, one rule each

All in `lib/store/`.

| Store | Holds | Rule |
|---|---|---|
| `project.ts` | `Project { tracks[], clips[] }` — the document | Every mutation is immutable and stamps `updatedAt`. Wrapped in zundo `temporal` (history limit 100) so undo/redo comes for free. |
| `playback.ts` | Transport state, **plus** `playbackRefs` | `playbackRefs` are plain `{ current }` refs that deliberately bypass React. Per-frame values (playhead position, scroll offset) go here, never into React state. |
| `ui.ts` | Panels, selection, zoom, drag state, keybindings | Never persisted with the project — it is view state, not document state. |

**Why `playbackRefs` exists.** The playhead moves every frame. Routing that
through `useState` re-renders the arrangement 60 times a second. Instead the
animation loop reads a ref and writes a `transform: translate3d(...)` directly.
If you find yourself adding a per-frame value to a store, put it in a ref.

---

## Audio

### The one rule

> **`lib/audio/scheduler.ts` is the single source of truth for how a clip
> becomes sound.**

There are two places audio gets produced: live playback (`playout.ts`) and
offline export (`offline-renderer.ts`). They used to be two hand-mirrored
implementations, and they had drifted — FX bypass worked on export but not in
playback, the master chains had different gain, solo was ignored by both. An
export did not sound like the playback, which for a music tool is fatal.

Both now go through `scheduler.ts`, which owns:

- **Timing** — `barsToSeconds`, `beatsToSeconds`, and the project's end bar.
- **Mix gating** — `isTrackAudible` / `effectiveTrackGain`. Solo is exclusive;
  an explicitly muted track stays silent even when soloed.
- **Instrument resolution** — clip preset → track preset → fallback by track colour.
- **Effect construction** — including awaiting `Reverb.generate()`, without
  which the first bars render dry.
- **`buildRenderPlan(project)`** — *which* clips play, at *what* time, at *what*
  gain. Both paths schedule from this plan.

If you change how audio is produced, change it in `scheduler.ts`. A change that
only touches one of the two callers is almost certainly a bug.

The plan has a golden snapshot in `tests/scheduler.test.ts`. If your change is
intentional, the snapshot changes with it — that is the review signal that
playback *and* export both moved.

### The signal chain

Identical live and offline:

```
clip → track entry → [active effects] → gain → panner → master → limiter → out
```

Live adds an analyser before the destination for the visualizer. Nothing else
differs.

### Scheduling lifecycle

1. Audio context starts only on a user gesture:
   `audioEngine.initialize()` then `playoutManager.initialize()`.
2. `scheduleProject(project)` builds the plan and schedules every clip.
3. `scheduleVersion` guards against races: an in-flight schedule aborts if a
   newer one started (fixed a real audio-glitch bug, #15). **Preserve this.**
4. Rescheduling is triggered from `app/[locale]/compose/page.tsx` by two hashes:
   `clipNotesHash` and `trackScheduleHash`.

> ⚠️ **If a feature changes how a clip sounds, it must appear in one of those
> hashes** — otherwise playback silently keeps playing the old version. This has
> already bitten once (#22, `activeTakeId`).

**Mixer moves are not rescheduling.** Volume, pan, mute and solo ramp the
existing nodes via `applyMixState`. Moving a fader must never tear down the
schedule — it is the difference between an instant fader and a stutter, and
automation (Sprint 14-15) depends on it.

### Instruments

`SYNTH_PRESETS` (`lib/audio/synth-presets.ts`) is the canonical registry.
`INSTRUMENTS` (`lib/browser/index.ts`) derives id, name and category from it and
adds only browser-panel metadata, typed `Record<SynthPresetId, …>`.

**Adding an instrument:** add a spec, a preset entry, and a metadata entry.
Miss any of the three and the build fails — which is the point. These lists used
to be maintained by hand and drifted into a duplicate-instrument bug (#20).

`PRESET_SPECS` (`lib/audio/preset-specs.ts`) is canonical for what a preset
*sounds like*, as plain data. It is typed `Record<SynthPresetId, AnyInstrumentSpec
| null>`, so a new preset must say whether it is spec-built or one of the six
samplers. `tests/golden/preset-voice-options.json` pins the resulting options
objects, so **a change here that retunes a shipped sound fails the build.** That
is deliberate: add a preset beside the old one rather than changing it.

`lib/audio/instrument-spec.ts` turns a spec into audio values and **imports no
Tone on purpose** — see Testing below. `lib/audio/drum-kits.ts` holds the six
sampler kits as data for the same reason.

**Custom instruments** (`lib/audio/custom-instruments.ts`) are user-owned specs
in IndexedDB, read through `useSyncExternalStore` rather than a Zustand store —
the scheduler and offline renderer are not React and must resolve instruments
synchronously. `hydrateCustomInstruments()` must run before anything schedules.

> ⚠️ Editing a custom instrument does not change its id, so **`revision` is
> load-bearing**: it goes into the reschedule hash, and without it an edit to an
> instrument already on a track leaves playback on the old voice. Same failure as
> #22, in a new place.

### Playing and previewing

`live-play.ts` (the on-screen and MIDI keyboard) and `preview-voice.ts` (clicking
a note in an editor) both build their voice with the scheduler's own
`createSynthForTrack`, and both route to the track's **entry node** via
`playoutManager.getTrackInput(track)`.

> ⚠️ **Nothing in `components/` may call `.toDestination()`.** It is a straight
> wire to the speakers, past the track's effects, fader, pan, the master limiter
> and mute/solo. Both editors did this until v1.4: with every track muted,
> clicking a drum still put −34.8 dB on the output. `tests/scheduler.test.ts`
> fails the build on a new one; the two remaining exceptions are named there,
> and both play something that belongs to no track.

### MIDI

Split so the parts that can be tested are:

- `midi-messages.ts` — the byte parse. Imports nothing. A note-on with velocity 0
  **is** a note-off, and only the two note commands are accepted by high nibble,
  which is what stops a keyboard's 24-ppqn clock becoming a torrent of notes.
- `note-book.ts` — which key or pedal actually stops a note. Every rule in it is
  a stuck note if wrong. Lifting the pedal releases what the *pedal* was holding,
  not everything.
- `midi-take.ts` — a performance becomes notes. Nothing is quantized and nothing
  is latency-compensated, the opposite of the audio path: a mic hears the player
  after the sound leaves the speakers, a key is stamped as it goes down.
- `midi-input.ts` — the Web MIDI wiring. **Unverifiable in CI** (no hardware, and
  headless browsers refuse Web MIDI), so it is the specification plus a test over
  the exact bytes. Reports from anyone with a keyboard are welcome.

### Audio, briefly

- Recording: mic → trim to loop bounds → fades → WAV bytes → `AudioTake`,
  with a latency offset from `latency-calibration.ts`.
- Export: `Tone.Offline()` render → WAV, or → lamejs → MP3.
- MP3 encoder loads from `public/workers/lame.min.js` via a `<script>` tag. This
  is a deliberate workaround for webpack/CJS issues — please don't "fix" it back
  into the bundle.

---

## Music theory: `lib/music/`

Small, dependency-free modules, each the **single source** for one fact. Every
one of them exists because that fact previously lived in two or three places
that disagreed, and each disagreement shipped.

| Module | The single source for | What it cost before |
|---|---|---|
| `pitch.ts` | what a pitch is called and where it sounds | `Math.floor(pitch / 12)` is not the octave — MIDI 0 is C**-1** — so middle C was drawn as C5, and the keyboard's lowest note was labelled C1 while being 16.35 Hz |
| `percussion.ts` | which drum a pitch is (GM 35–81) | the map lived in three places; the sampler kits' copy was an octave out, so **every kick played an open hi-hat** |
| `scales.ts` | keys, intervals, and the transport's vibes | picking Harmonic Minor highlighted natural minor |
| `snap.ts` | the editing grid, in beats | — |
| `typing-keys.ts` | the computer keyboard as a piano | — |
| `keyboard-layout.ts` | the drawn keyboard's geometry and keycaps | — |

Two rules the build enforces:

- **Never write `Math.floor(pitch / 12)`.** `tests/music.test.ts` scans
  `components/` and `lib/` and fails on a fourth opinion.
- **Never key a `Tone.Sampler` by note name.** Tone reads `C1` as MIDI 24;
  General MIDI puts the kick at 36. Use `DRUM_PITCH`. The same test fails the
  build on a note name beside a sample.

`keyboard-layout.ts` also carries one design rule worth knowing before changing
it: **the keyboard does not move.** The board is a fixed C1–C7 and only the lit
block and the printed letters shift with the octave. Three earlier versions
resized or re-centred it and all three felt broken.

---

## Persistence

IndexedDB database `composeyogi`, via `idb`.

| Store | Contents |
|---|---|
| `projects` | Metadata only — no embedded tracks or clips |
| `tracks` | Indexed `by-project` |
| `clips` | Notes JSON-stringified; indexed `by-track` and `by-project` |
| `audioTakes` | ArrayBuffer + serialized peaks |
| `userSamples` | Imported audio |
| `settings` | Latency offset, keybindings, preferences |

Projects are split across stores so editing one clip doesn't rewrite the whole
document. `loadProject` reassembles them and normalises track order.

**Schema changes go in `lib/persistence/migrations.ts`** — one numbered, ordered
step per version. Never edit a shipped migration; someone has already run it.
Bump `DB_VERSION` by adding a migration, not by hand (a test enforces this).

Autosave debounces project writes by 3s; audio takes save immediately, and a
`beforeunload` guard catches the rest. Losing a recording is not acceptable.

---

## Rendering

- **Canvas** for the arrangement ruler, drawn inline in `TrackList.tsx` (DPR-aware),
  and for a clip's waveform, drawn inline in `AudioClip.tsx`.
- **DOM** for everything else — the grid is `.grid-line` divs from `GridLines`,
  and clips are divs because they need drag, resize, context menus and selection.
- **Peaks** are computed in `public/workers/audio-peaks-worker.js` and returned
  as Transferables (zero-copy).
- **Clips are virtualized** (`hooks/useVisibleClips.ts`): a lane mounts only the
  clips in the viewport plus a one-screen buffer. `DraggableClip` is memoized,
  so an unrelated store update doesn't re-render everything on screen.

---

## The design system: `lib/design/` + `design/`

> **`lib/design/tokens.ts` is the single source for every colour, radius,
> duration and elevation in the product.**

`npm run design:tokens` *generates* `app/globals.css`, `public/manifest.json`,
the token tables in [`design/README.md`](design/README.md), and the artboard
stylesheet from it. **`npm run check` fails if any generated file has drifted**,
so never hand-edit a generated block — change the token and regenerate.
`tailwind.config.ts` holds no design values of its own; it imports them.

[`design/README.md`](design/README.md) is the usage rulebook — principles, when
to use which colour, and live HTML artboards that open by double-clicking, no
build step. **All UI must comply with it**, and `tests/design-system.test.ts`
enforces the parts a machine can check: no raw palette classes, no hex literals,
no off-scale type or radius, no colour pair that misses WCAG AA, and no looping
animation that has not declared what it rests as under reduced motion.

Two traps worth knowing before you write a class name:

- **Never build one by interpolation.** `bg-track-${role}` produces no CSS,
  because Tailwind reads class names out of source text and cannot evaluate a
  template literal. Use the static maps in `lib/design/track-colors.ts`. This
  shipped once: every colour dot in the instrument browser rendered transparent.
- **Canvas reads tokens at draw time** via `tokenColor()` / `monoFont()`, so a
  canvas effect must list `resolvedTheme` in its dependencies or it keeps
  painting the previous theme.

Reduced motion is answered in **one** block at the end of `app/globals.css`,
never per component.

---

## Templates

`DEMO_TEMPLATES` (`lib/templates/demo-templates.ts`) is the single source for the
eight demo arrangements; the browser panel's list derives from it, and
`createProject(name, templateId)` loads the full arrangement. They are the first
thing a visitor hears, so a bug in a template is a bug in the product's first
impression — the drum-kit octave fault was invisible for four releases largely
because nobody had listened to these closely.

---

## i18n

Locale routes via `app/[locale]/` plus middleware; messages in
`messages/{en,es}.json`. Every user-visible string needs both locales —
`npm run validate:locales` gates the build, so a missing translation is a build
failure, not a runtime surprise.

---

## Keyboard shortcuts

`lib/shortcuts/` is the registry: every shortcut has an id, a category and
default keys, and users can rebind them. The in-app reference modal (press `/`)
renders from the registry, so it is always accurate.

Adding a shortcut means adding a registry entry — not a `useHotkeys` call
somewhere in a component.

---

## Conventions

- Banner comments: `// ============================================`
- Imports: React → Next → external → internal (`@/…`) → types
- `PascalCase.tsx` for components, `kebab-case.ts` for lib modules
- 4-space indentation
- Logging via `createLogger('Context')` from `lib/logger.ts` — no bare `console.*`
- **Time: bars in UI and state, seconds in Tone.js.** Convert at the boundary.
- Always dispose Tone nodes when unscheduling or unmounting.
- `COOP/COEP` headers in `next.config.ts` are required for future
  SharedArrayBuffer/WASM work — don't remove them.

---

## Testing

```bash
npm test          # Vitest
npm run check     # locales + types + lint + tests — what CI runs
```

Tests live in `tests/`, using Vitest and `fake-indexeddb` so persistence code is
exercised as-is rather than mocked.

If you are changing the audio engine, the scheduler tests are the ones that
matter. A PR that changes scheduling behaviour without moving the golden render
plan snapshot is either a no-op or a bug.

> ⚠️ **Tone.js cannot be constructed in the test environment.**
> `new Tone.PolySynth(...)` throws `param must be an AudioParam` under Vitest —
> there is no Web Audio in Node. **No unit test can prove a synth sounds right.**

This one constraint explains a lot of the codebase's shape, and working with it
rather than against it is most of what makes an audio change reviewable:

- `instrument-spec.ts`, `preset-specs.ts`, `drum-kits.ts`, `percussion.ts`,
  `midi-messages.ts`, `note-book.ts` and `midi-take.ts` **import no Tone**, so
  the decisions inside them are testable as plain data and arithmetic.
- Anything written as a *factory* is a sound nothing can check. A kit written
  that way had a wrong sample in it, and the fix survived a deliberate revert
  with all 636 tests green — which is why kits and presets are data now.
- Sound itself is verified by measuring in a real browser. See
  [CONTRIBUTING.md](CONTRIBUTING.md) § "Testing audio" for how, and for the
  three ways such a measurement can quietly lie to you.

---

## Known rough edges

Honest list, so you don't have to discover these yourself:

- **Frame-rate, Lighthouse, the offline walkthrough and the cross-browser
  matrix** have not been measured on real hardware since Sprint 8.5. Treat any
  number you find for them as unverified — including in this file.
- **Web MIDI has never run against hardware.** Notes, sustain, pitch bend and
  the panic controllers are built to the specification and tested at the byte
  level. If you own a MIDI keyboard, trying it is genuinely useful.
- **No audio in the app has been assessed by ear.** Every claim about how
  something sounds — the instruments, the drum kits, the clip macros, the Grand
  Piano — is a measurement.
- **`Project` has three hand-maintained field lists** that each fail silently
  when a new field is forgotten: the reschedule hashes
  (`lib/audio/schedule-hash.ts`), `ProjectRecord` (`lib/persistence/db.ts`, built
  by hand in both directions), and autosave's change signature. All three have
  exhaustiveness tests over `keyof Project`, so **adding a field to `Project`
  means visiting all three** — the tests will say so, if you run them.
- **Stretch-to-BPM repitches** rather than time-stretching. True time-stretch
  needs WASM and is a later phase.
- **There is no sampled acoustic piano.** All six `Tone.Sampler` presets are
  drum kits; every melodic preset is synthesised.
- **`+ Add Track` only creates MIDI tracks.** Changing a track to audio means
  Inspector → Type → Audio.

See [ROADMAP.md](ROADMAP.md) for where each of these is scheduled.
