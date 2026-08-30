# CLAUDE.md — ComposeYogi

Browser-based DAW (Ableton-style arrangement view). Local-first, no backend today.
Next.js 15 App Router · React 19 · TypeScript strict · Tone.js 15 · Zustand 5 + zundo ·
IndexedDB (idb) · Radix/Tailwind · next-intl (en/es) · Serwist PWA. MIT, open source.

**North star (from the PRD):** *"If a first-time user records a vocal and says 'this felt
like a real studio' — we've won."* Philosophy: DAW-grade feel, beginner-grade cognitive
load; local-first; musical correctness by default; power revealed progressively.

---

## Planning docs — read BEFORE planning or scoping anything

`docs/` is **gitignored, maintainer-internal**. It is the product source of truth and
outranks assumptions derived from code.

| Doc | What it is |
|---|---|
| `docs/composeyogi_prd.md` | The PRD: vision, users, flows, quality bars, phase roadmap (Phase 2 = multi-take, automation, collaboration-lite; Phase 3 = AI, mobile companion, marketplace), **plus** the compose-page spec in §8. Merged 2026-08-30 from `composeyogi.md` + `design.md`, which overlapped on the whole of that section. Contains **designed-but-unbuilt** features — punch recording, the count-in overlay — so unwired schema for something named there is a commitment, not dead code. It says nothing about how the UI *looks*; that is `design/`, and §8.9 says so. |
| `docs/TaskList.md` | **The planning document** (currently v1.15). Sprint-based, checkboxes, named deliverables, versioned footer. All work is planned here first. **Checkboxes only** — it grew to 463 lines for one sprint before the prose was split out, and the split is only worth anything if it stays split. Sprints 8.5, 8.6 and 8.7.1–8.7.7d shipped; remaining for v1.4: 8.7.5b, 8.7.6, 8.7.8. |
| `docs/notes/` | Per-sprint companions to the task list — findings, measurements, bug post-mortems, scoping rationale, and what was tried and rejected. `sprint-8.7.md` is the first. **Anything longer than a one-line parenthetical goes here, not in TaskList.md.** Nothing here is a task; if it needs doing, it is a checkbox in the task list. |
| `docs/adr/` | Architecture Decision Records (ADR-001 backend = first entry, Sprint 9.0). |
| `design/` (public, shipped Sprint 8.6) | The committed design system — principles, usage rules, live HTML artboards. **All UI must comply**; `npm run check` enforces it. |
| `ROADMAP.md` (public) | Community-facing summary. Keep in sync with TaskList after each release. |
| `CHANGELOG.md` (public) | Keep a Changelog format, semver. |

### Methodology (how work is planned and tracked)

1. Work is organized in **numbered sprints** in `docs/TaskList.md` with checkbox tasks
   grouped in sections (N.1, N.2 …) and a one-line **Sprint Deliverable**.
2. Community/issue-driven work gets an **inserted sprint** (precedent: Sprint 6.5, built
   from GitHub issues #5–#18) rather than renumbering everything.
3. Reference GitHub issue numbers in task lines and commit messages (`(#NN)`).
4. When completing work: tick the checkbox, bump the TaskList version footer, update
   CHANGELOG.md, and mirror user-visible changes into public ROADMAP.md. Reasoning,
   measurements and post-mortems go in `docs/notes/sprint-N.md` — the task list stays a
   task list.
5. Keep subsections in numeric order. 8.7.8 was filed between 8.7.5b and 8.7.7c and the
   maintainer could not find it.
6. **Quality checkpoints** run after each sprint; a feature is done only per the
   Definition of Done below.

### Definition of Done (from TaskList.md — hold every feature to this)

1. Works as specified · 2. Types complete · 3. Undo/redo supported (if applicable) ·
4. Keyboard shortcut added (if applicable) · 5. Autosave triggers on change ·
6. Works offline (if applicable) · 7. Mobile handles gracefully ·
8. 60fps verified · 9. Accessibility checked

---

## Commands

```bash
npm run dev            # dev server (Turbopack)
npm run build          # prebuild (validate:locales + type-check + lint:warn) → next build
npm run check          # validate:locales + type-check + lint (no build)
npm run type-check     # tsc --noEmit
npm run validate:locales  # messages/en.json vs es.json key parity
```

```bash
npm test               # vitest run
npm run test:watch     # vitest
```

`npm run check` = validate:locales + type-check + lint + tests. CI
(`.github/workflows/ci.yml`) runs `check` then a production build on every push
and PR; `docker-publish.yml` still builds/signs the image separately.

---

## Architecture map

### State — three Zustand stores (`lib/store/`)
- `project.ts` — source of truth for `Project { tracks[], clips[] }`. Wrapped in zundo
  `temporal` (limit 100, JSON-stringify equality). All mutations immutable, stamp `updatedAt`.
- `playback.ts` — transport state **plus** exported `playbackRefs` (plain `{current}` refs
  that bypass React for 60fps playhead animation). Never put per-frame values in React state.
  `recordingSession` is how recording reaches the arrangement: `isRecording` alone said only
  *that* a recording was happening, never which track or from which bar, so the timeline
  could not have drawn one had it wanted to. Cleared by both `stopRecording()` and `stop()` —
  a transport stopped from anywhere must not leave a recording region on screen.
- `ui.ts` — panels, selection, zoom, drag state, custom keybindings.

### Audio (`lib/audio/`)
- `engine.ts` — singleton wrapping Tone.Transport: play/pause/stop/seek, BPM, time
  signature, loop, metronome, bar↔second conversion. `initialize()` deliberately sets **no**
  tempo: it used to stamp 120/4-4 on the first user gesture, and since `secondsToBar()`
  reads the transport and the arrangement sizes every audio clip with it, that silently
  measured dropped samples and finished takes against 120 instead of the song. The project
  owns the tempo; the compose page applies it both at load and again after the context
  starts. Don't reintroduce a default here.
- `scheduler.ts` — **the single source of truth for how a clip becomes sound.** Owns
  timing, instrument resolution, effect construction, solo/mute gating, and
  `buildRenderPlan()` (which clips play, when, at what gain). BOTH the live and
  offline paths schedule through it. A change that touches only one caller is a bug —
  that split is what made exports stop matching playback. Golden snapshot in
  `tests/scheduler.test.ts`.
- `playout.ts` — `PlayoutManager` (live): per-track chain `entry → [active effects] →
  gain → panner → master → limiter → analyser → destination`; schedules from the render
  plan. Guarded by a `scheduleVersion` counter so stale in-flight schedules abort (race
  fix from #15) — preserve this pattern. Mixer moves (`applyMixState`) ramp existing
  nodes and must NEVER reschedule.
- `recorder.ts` + `recording-manager.ts` — mic → trim to loop bounds → fades → WAV bytes
  → `AudioTake` (in-memory map + IndexedDB). Latency offset from `latency-calibration.ts`.
  The count-in has **two shapes and the sign of `startBar - countInBars` picks which**: with
  music before the punch point it is a *lead-in* and the transport plays those bars; at the
  top of the song that subtraction is negative, and a transport parked at a negative time is
  not a count-in but a wrong answer — so it is *pre-roll*, where the clock runs and the
  transport waits. Recording from the top with the default two bars is the second case, so
  it was the shipped default that was broken. `recording-manager` is also the only writer of
  `recordingSession` (below), and it writes it **twice**: an estimate as the count-in begins,
  then the bar the transport actually reports once recording starts.
  The count-in **always clicks**, whatever `metronomeEnabled` says, and the click comes from
  `audioEngine.playCountIn()` rather than the metronome: the metronome is a `Tone.Loop` that
  returns unless the transport is running, so it can never sound during pre-roll — which is
  the count-in nearly every first-time user gets. `playCountIn` schedules against
  `context.currentTime` instead, which covers both shapes identically, and the metronome loop
  stands down for the duration (`countInUntil`) so a lead-in does not click twice.
  `stopCountIn()` silences an abandoned count-in, except for anything already inside Tone's
  0.1s lookAhead — audio already rendered cannot be unrendered.
- `count-in.ts` — the countdown arithmetic, on the **wall clock** rather than transport
  position, because pre-roll has no transport position to read. Imports nothing, which is
  the point: it is the only part of the recording visuals a unit test can reach. `ceil`, not
  `round` — that is what makes the last beat read "1" for its whole duration.
- `offline-renderer.ts` — WAV/MP3 export inside `Tone.Offline()`. Renders from the same
  render plan as `playout.ts`; no scheduling logic of its own.
- `stretch.ts` — Stretch-to-BPM, v1 by `playbackRate` (so it repitches; true time-stretch
  is Phase 2.5). Pure arithmetic, no Tone. The rate needs a **source tempo**, and
  `lengthBars` cannot supply one: every audio clip is created with `lengthBars` derived
  from its duration at the project tempo of that moment, so a rate derived from it is
  always 1.0 — a no-op for exactly the case the feature exists for. So `sourceBpm` is
  stamped where it is actually known (the sample catalogue's loop metadata on drop; the
  project's own tempo on a recording) and only inferred as a last resort. Applied in ONE
  place, `scheduleAudioClip`, which takes a **required** `TempoContext` so the compiler
  forces both the live and offline callers. Fades are stored in source seconds and Tone
  runs them in wall-clock, so they are divided by the rate there.
- `instrument-spec.ts` — an instrument as plain data, and the arithmetic turning a knob
  position into an audio value. **Imports no Tone deliberately**: Web Audio does not exist
  in the test environment, so anything touching Tone cannot be unit-tested at all, and this
  is where everything testable lives. Full Brightness builds **no filter node**, which is
  what makes an unedited custom instrument its source preset exactly rather than
  approximately — don't "simplify" that to an always-on filter at 20kHz.
- `preset-specs.ts` — every built-in as data; the single source for what the 52 melodic
  presets sound like. Not hand-written: extracted mechanically from the option literals the
  old factories passed, with those literals committed as
  `tests/golden/preset-voice-options.json` **before** the factories were deleted.
  `tests/instrument-spec.test.ts` asserts `voiceOptions(spec)` still reproduces all 52
  exactly, so a change here that retunes a shipped sound fails the build. The 12 drum kits
  are `null` — `Record<SynthPresetId, InstrumentSpec | null>` forces a new preset to say
  which it is, where `Partial<>` would let it be silently uncustomizable.
- `synth-presets.ts` — `SYNTH_PRESETS` (64 entries; the 52 melodic ones built from
  `preset-specs.ts` via `createVoice`, the 12 drum/sampler ones still bespoke factories) and
  `ResolvedInstrument`. Knows nothing about custom instruments by design — user content is
  resolved one layer up, in the scheduler, so the built-in library never imports
  IndexedDB-backed state. Resolution order at schedule time: `clip.instrumentPreset` →
  `track.instrumentPreset` → fallback by track color.
- `custom-instruments.ts` — the user's own instruments (#21): in-memory registry backed by
  IndexedDB (the `AudioTake` pattern, and for the same reason — the scheduler resolves
  instruments synchronously and cannot await a read per clip), plus the one place a custom
  voice is built. React reads it via `useSyncExternalStore`, **not** a fourth Zustand store:
  the scheduler and offline renderer are not React and must read it without one.
  `hydrateCustomInstruments()` must run before anything schedules.
  **`revision` is load-bearing** — `instrumentPreset` holds an id, editing an instrument
  changes the sound without changing the id, so without the revision in the reschedule hash
  an edit to an instrument already on a track leaves playback on the old voice. That is #22
  in a new place; `saveCustomInstrument` is the only writer and it always bumps.
- `instrument-io.ts` — a custom instrument as a `.cyi.json` file, mirroring `project-io.ts`.
  Import always mints a new id, so importing never overwrites something already saved.
- MP3 via lamejs loaded by `<script>` tag (`public/workers/lame.min.js`) — deliberate
  workaround for webpack/CJS issues; don't "fix" it back into the bundle.

### Music theory (`lib/music/`)
- `scales.ts` is the **single source** for keys, scale intervals, and the vibes the
  transport's Scale selector offers. It exists because the answer used to live in three
  places that disagreed — `MusicalScale` in types, the Inspector's picker, and a private
  `SCALE_INTERVALS` inside PianoRoll.tsx — so picking Harmonic Minor silently highlighted
  natural minor. Everything is keyed by `MusicalScale`; `tests/music.test.ts` fails if a
  scale lacks intervals, a picker entry, or a translation.
- `snap.ts` owns the editing grid for **both** the timeline and the piano roll, in beats
  (a bar is only four of them in 4/4, so bars are converted at the call site). Triplets are
  `2/3`, never `0.333`. `SNAP_BEATS['off']` is 0, so anything needing a minimum length
  (a new note, a resize floor) must use `snapStepBeats`, not the raw value.

### Persistence (`lib/persistence/`)
- Schema changes go in `migrations.ts` as a new numbered migration; `DB_VERSION` tracks
  it automatically (a test enforces this). Never edit a shipped migration.
- IndexedDB `composeyogi` via idb. Stores: projects (metadata only), tracks, clips
  (notes JSON-stringified), audioTakes (ArrayBuffer + serialized peaks), userSamples,
  userInstruments (migration 5 — stored as the domain object, no record type and no mapping
  either way, which is the one store immune to the `ProjectRecord` disease below), settings.
- `autosave.ts` — 3s debounce for project saves; audio takes save immediately;
  `beforeunload` guard. `projectSaveSignature` decides whether anything changed and is
  **derived from the project object**, never a list of fields — as a literal it silently
  dropped every field nobody remembered to add. `ProjectRecord` in `db.ts` is still
  hand-built in both directions, so a new `Project` field must be added to the record type,
  `saveProject` and `loadProject`; a round-trip test over `keyof Project` enforces it.

### Rendering
- Canvas for the arrangement ruler (drawn inline in `TrackList.tsx`, DPR-aware); DOM for
  everything else — the grid is `.grid-line` divs from `GridLines`, and clips are divs.
- Peaks computed in `public/workers/audio-peaks-worker.js` with Transferable zero-copy.

### Design system (`lib/design/` + `design/`)
- `lib/design/tokens.ts` is the **single source** for every colour, radius, duration and
  elevation. `npm run design:tokens` generates `app/globals.css`, `public/manifest.json`,
  the token tables in `design/README.md`, and `design/previews/tokens.{css,js}` from it;
  `npm run check` fails if any of them drifts. Never hand-edit a generated block.
- `tailwind.config.ts` holds **no** design values — it imports them.
- Static class maps in `lib/design/track-colors.ts` (`TRACK_BG`, `DRUM_BG`). Never build a
  class name by interpolation: `bg-track-${role}` produces no CSS, because Tailwind reads
  class names from source text. `lib/` is in the `content` globs for the same reason.
- Canvas reads tokens at draw time via `tokenColor()` / `monoFont()` and must list
  `resolvedTheme` in its effect deps, or it keeps the previous theme's paint.
- `tests/design-system.test.ts` fails the build on raw palette classes, hex literals,
  interpolated class names, off-scale type/radius, non-exhaustive class maps, a track hue
  inside the accent band, any colour pair that misses WCAG AA, and a looping animation that
  has not said what it rests as under reduced motion.
- **Reduced motion is answered in one block** at the end of `app/globals.css`, not per
  component — `design/README.md` § "Motion, when someone has asked for less of it" is the
  rulebook. Three things there are load-bearing: the blanket rule is `0.01ms` and never
  `none` (Radix unmounts on `animationend`, so `none` strands closed dialogs in the DOM); a
  spinner keeps turning, because frozen it reports a hung app; and every resting state is
  `!important`, because a running animation outranks a plain declaration and two rules from
  that same block were measured disagreeing in one frame.
- `npm run design:artboards` re-exports `design/artboards/*.png` and `public/og-image.png`
  (needs Chrome; the HTML previews in `design/previews/` are the reference and open by
  double-clicking, no server).

### Control labelling (`tests/a11y-labels.test.ts`)
- Radix puts `role="combobox"` on a Select's **trigger** and `role="slider"` on a Slider's
  **thumb**, so an `aria-label` left on the wrapper reaches neither, and a `<Label>` beside
  a control names nothing unless they are wired together. The Inspector shipped that way
  from v1.0: every field was visible text next to an anonymous control.
- The test fails the build on three things: a `<Label>` with neither `htmlFor` nor `id`; a
  `SelectTrigger`/`Input`/`Slider`/raw `<input>` with no `aria-label`, `aria-labelledby` or
  `id`; and a `<Button>`/`<button>` whose children render no text and which carries no name.
  It cannot check that a pairing is *correct*, only that one was attempted.
- The Inspector routes both ids through its `Field` component, so a caption there cannot be
  rendered without one. `htmlFor`/`id` for labelable controls (inputs, Select triggers —
  it also focuses them when the caption is clicked); `aria-labelledby` for a Radix slider,
  whose thumb is a `<span>` and cannot be a label's target.
- **A tooltip is not a name.** Radix Tooltip sets `aria-describedby` on its trigger: a
  description, read after the name, on a control the user could not identify in the first
  place. Every icon-only button takes an `aria-label` from the same message key its tooltip
  already uses, so the two cannot drift.
- The icon-only rule is deliberately conservative — any text, or any expression that might
  render text, counts as named. It under-reports rather than flagging buttons that are fine.

### Cursors, and other things decided once (`tests/a11y.test.ts`, rule 6)
- **The cursor is decided by the primitive, never the call site.** `design/README.md`,
  "The cursor names the gesture", is the table. `Button` and `SelectTrigger` carry
  `cursor-pointer`; `Slider` carries `pointer` on the rail and `grab`/`grabbing` on the
  thumb; disabled is `not-allowed` everywhere. The test asserts both halves — that the
  primitives declare them, and that no call site repeats one.
- It got there because the piano roll's velocity slider offered a hand and the identical
  sliders in the Inspector offered an arrow. Nothing was wrong with either; nothing said
  which was right.
- **Panels collapse, they do not close or hide.** All four leave a labelled bar behind, so
  the verb pair is Collapse/Expand — it was Close Browser, Close Editor, Hide Visualizer and
  Collapse Inspector, four names for two actions. Each collapse button carries a tooltip
  with its shortcut; each collapsed bar names the expand.
- **A dialog's header icon inherits its title's colour.** Two of five were `text-primary`,
  which reads as a state the others do not have.

### Use the primitives (`tests/a11y.test.ts`, rule 5)
- shadcn + Radix in `components/ui` **is** the UI. Anything hand-rolled beside it is
  *nearly* right, which is exactly why it survives: it works, it just visibly belongs to a
  different application. The suite fails the build on a browser `confirm()`/`alert()`, an
  `<input type="range">`, and a native `title=` tooltip.
- What that replaced: `window.confirm` for deleting a sample and `window.alert` for the iOS
  install steps (neither themable nor translatable), three range faders that did not match
  the Radix sliders beside them, nine OS-drawn `title` tooltips, and ten buttons that
  re-implemented `buttonVariants` by hand.
- **The one allowed exception** is the drum grid's per-step `title`: 256 virtualized cells,
  and a Radix Tooltip subscribes each one to a provider. It is named in the test.
- A destructive confirm is an `AlertDialog`, never a `Dialog` — no dismiss-by-clicking-away,
  and the buttons carry the roles.
- Still deliberately raw `<button>`: the piano roll's 84 keys, the drum grid's step cells,
  and the browser's draggable cards and list rows. They are painted surfaces rather than
  buttons, and `<Button>`'s variants would fight every state they have.

### Modals
- **Every modal is a Radix `Dialog`** from `components/ui/dialog.tsx`, and the fourth rule in
  `tests/a11y.test.ts` fails the build on any `fixed inset-0` overlay written outside
  `components/ui`. Three were hand-rolled `<div>`s — the shortcuts sheet, latency
  calibration, and the iOS install instructions — each missing `role="dialog"`, a name, a
  focus trap, focus restore, Escape and scroll lock, none of which is visible until somebody
  needs one.
- `DialogContent` takes `hideClose` for a dialog that draws its own close button — one that
  must stay disabled while work is in flight (calibration) or that sits in a header beside
  other actions (the shortcuts sheet's Reset All).
- A dialog that must not be dismissed mid-task passes the *same* guard to `onEscapeKeyDown`,
  `onPointerDownOutside` and `onInteractOutside`; guarding only one leaves the other routes
  open. Escape belongs to the rebind while a shortcut is being recorded, and to nothing at
  all while a calibration is measuring.
- **Known, pre-existing:** a closed dialog's node lingers in the DOM after its exit
  animation, so Radix restores focus to the opener late or not at all. It behaves the same
  on the dialogs that never changed, so it is in the shared primitive rather than any one
  modal — and it may be an artifact of the headless pane throttling `animationend`. Verify
  in a real browser before chasing it.

### Instruments & templates
- `SYNTH_PRESETS` (lib/audio/synth-presets.ts) is canonical for identity. `INSTRUMENTS`
  (lib/browser/index.ts) derives id/name/category from it; only browser metadata
  (description, trackType, trackColor) lives there, typed `Record<SynthPresetId, …>` so a
  missing entry **fails the build**. `PRESET_SPECS` (lib/audio/preset-specs.ts) is canonical
  for *sound* and is typed the same way. Adding a melodic instrument now means a spec, an
  entry, and metadata — three places, all three compiler-enforced.
- A custom instrument's id is `custom:<uuid>`, and `Track`/`Clip.instrumentPreset` is a
  plain `string`, so assigning one needs **no project schema change** — which is convenient
  and is exactly why the revision counter above exists.
- `DEMO_TEMPLATES` (`lib/templates/demo-templates.ts`) is the single template source; the
  browser panel's `TEMPLATES` derives from it and `createProject(name, templateId)` loads
  the full arrangement via `loadDemoTemplate`.

### i18n
- Locale routes via `app/[locale]/` + middleware; messages in `messages/{en,es}.json`.
- Every user-visible string needs both locales; `npm run validate:locales` gates the build.
  It checks key parity, key line numbers, and that both locales interpolate the same
  `{placeholders}` and `<tags>` — next-intl never throws on a mismatch, it silently renders
  the key path instead of the string, so `Hola {nombre}` from `Hello {name}` puts
  `projects.deleteDescription` on screen.
- `validate:locales` only compares en against es — it cannot tell whether the app *reads*
  either file. `tests/i18n.test.ts` closes that gap and is what keeps the studio
  translated: no user-visible literal may survive in `components/compose/**` (JSX text and
  label attributes, `<kbd>` key names and unit symbols excepted), every key in en.json must
  have a `useTranslations` caller, and every key a component asks for must exist. Failures
  print `path:line  offending text`.
- Message keys follow the component: `transport`, `browser`, `inspector`, `editor.*`,
  `tracks`, `clips`, `loop`, `visualizer`, `projects`, `export`, `import`, `calibration`,
  `shortcuts`, `scales`. Shortcut labels are keyed by registry id (`shortcuts.actions.<id>`)
  so `lib/shortcuts` stays the single source for the ids and the docs table.
- **Still English, by design:** catalogue content owned by `lib/` — instrument, sample, FX
  and template names/descriptions (`lib/browser`, `lib/templates`), GM drum names and drum
  pattern preset names, and `CalibrationProgress.phase`. Translating those means giving the
  catalogues keys, not editing components; the guard scans JSX only, so it will not flag them.

---

## Conventions (match the codebase, not generic style)

- Banner comments: `// ============================================`
- Import order: React → Next → external → internal (`@/…`) → types.
- Components `PascalCase.tsx` (e.g. `TrackList.tsx`); lib modules `kebab-case.ts`
  (e.g. `synth-presets.ts`). Barrel `index.ts` exports per folder.
- Logging: `createLogger('Context')` from `lib/logger.ts` — no bare `console.*` in new code.
- 4-space indentation. Zustand updates via immutable `set((state) => ({ … }))`.

## Audio-specific rules

- Time: **bars in UI/state, seconds in Tone.js**. Convert at the boundary.
- Audio context starts only on user gesture (`audioEngine.initialize()` then
  `playoutManager.initialize()`).
- Always dispose Tone nodes (Players, Synths, effects) when unscheduling/unmounting.
- Rescheduling is driven by `clipNotesHash` + `trackScheduleHash` + `project.clips.length`
  in `app/[locale]/compose/page.tsx` — if a new feature changes clip audio without
  changing those hash fields, playback silently goes stale (this was #22). Mixer state
  (`mixerHash`) deliberately does NOT reschedule.
- COOP/COEP (`credentialless`) headers in `next.config.ts` are required for future
  SharedArrayBuffer/WASM work — don't remove.

---

## Standing decisions & gates (updated 2026-08-29)

- **Backend (ADR-001 direction, to be recorded in docs/adr/):** managed, open-source
  service configured by env keys — hosted Supabase (Postgres + Auth + Storage, one key set,
  `.env` → running in minutes). Firebase rejected (proprietary, no self-host story).
  **Zero keys = the app runs fully local-first with sharing hidden** — this guarantee is
  non-negotiable. Self-hosting the backend stays possible (Supabase is OSS) but is never
  the recommended path.
- **Design-system gate (Sprint 8.6):** a design system is created with Claude Design
  (desktop + mobile artboards) and committed publicly in `design/` BEFORE any new UI ships.
  From then on, ALL UI work must comply with `design/` — check it before building; it is a
  Definition-of-Done criterion. The existing app gets fully migrated to comply first.
- **Single source of truth:** one roadmap (public ROADMAP.md mirrors docs/TaskList.md;
  README links it, never duplicates it), shortcuts documented from the lib/shortcuts
  registry (no hand-copied tables), template systems consolidated (8.5.1). When adding
  content, ask what existing page/doc already covers it.
- **No SEO content scaling** (maintainer rule): every public page must be something a
  musician would want to land on. Discoverability comes from real shared music.

## Known gaps & active issues (updated 2026-08-30 after Sprint 8.7.7 — verify before relying on)

- **Three hand-maintained lists of `Project` fields**, each of which fails silently when a
  new field is forgotten, and each of which has now cost a bug: the reschedule hash
  (`lib/audio/schedule-hash.ts`, was #22), `ProjectRecord` (`lib/persistence/db.ts`, save
  and load, hand-built both ways), and autosave's change signature
  (`projectSaveSignature`, which used to be a literal naming eight fields and quietly
  dropped `swing` and `latencyOffset`). All three now have exhaustiveness tests over
  `keyof Project` in `tests/`. **Adding a field to `Project` means visiting all three** —
  the tests will say so, but only if you run them.
- **Those exhaustiveness tests had the same disease they were built to cure.** Each proved
  its list complete by walking `Object.keys()` of a fixture, so the fixture became a fourth
  hand-maintained list: 8.7.4 added two fields to `Clip`, classified them in neither the
  sound-affecting nor the silent list, and all 275 tests stayed green. They now walk
  `makeFullClip()` / `makeFullProject()` in `tests/fixtures.ts`, typed `Required<Clip>` and
  `Required<Project>` — **add a field to either type and the fixture stops compiling**,
  which is the only reminder that cannot be skipped. Keep it that way; a plain literal
  there silently switches all three tests off.
- **Tone cannot be constructed in the test environment.** `new Tone.PolySynth(...)` throws
  `param must be an AudioParam` under vitest's node environment — there is no Web Audio — so
  **no unit test can ever prove a synth sounds right**. This is why `instrument-spec.ts`
  imports no Tone and why the guard on the instrument library is a golden fixture of the
  *options objects* rather than of rendered audio. Anything that must be verified as sound
  has to be verified in a browser; the pattern that worked (Sprint 8.7.5) is a throwaway
  route under `app/[locale]/` that renders through `renderProjectToAudioBuffer` and measures
  RMS and high-frequency ratio, deleted afterwards. **Mutate something deliberately first
  and confirm the harness fails** — 8.7.5's first two harnesses both reported success while
  measuring nothing (one compared `envelope:{}` to `envelope:{}` because a key array passed
  to `JSON.stringify` is a replacer applied at every level; the other rendered silence for
  every case, including the control, because `Track.volume` is 0-1 linear and the fixture
  set it to 0).
- **Unverified performance claims**: frame rate, Lighthouse, the offline walkthrough and
  the cross-browser matrix have NOT been measured on real hardware since the 8.5 work
  (rAF doesn't run in a headless pane). Don't quote numbers for these.
- **The Browser pane denies `getUserMedia`**, so nothing downstream of the microphone can be
  verified there — 8.7.7's every run reached "Recorder not initialized" after all the state
  and all the visuals but before a sample. It also **suspends rAF while the pane is hidden**,
  which makes any animation look frozen: verify animated state by stepping the *inputs* (a
  store write whose dep change ticks the effect synchronously) rather than watching it run,
  and take a screenshot to force a frame. Two 8.7.7 measurements were void before this was
  understood — one because the pane was hidden, one because a page reload had left the audio
  engine uninitialized so `audioEngine.play()` silently no-opped. **Check `isReady()` and
  that the recording manager has no stale session before trusting a transport measurement.**
- **Recording is still hard to reach**: `+ Add Track` only makes MIDI tracks and the arm
  button only renders for `type === 'audio'`, so the sole route to a recordable track is
  Inspector → Type → Audio. Nothing on the arming path says so. Found by walking the path in
  a browser, not by reading the code; recorded in `docs/notes/sprint-8.7.md` § 8.7.7e and
  deliberately not taken. The other two of that group are fixed (8.7.7e): the count-in has a
  selector, and `R` records.
- **A keyboard hint is not a binding.** `R`, `L` and `M` were printed in the transport's
  tooltips from v1.0 and bound to nothing, and the shortcuts sheet offered `?` when only `/`
  worked — the hint was written as a `<kbd>` beside the button while the binding lives in
  `lib/shortcuts`, so no one place held both halves. `tests/shortcuts.test.ts` reads the
  hints back out of the TSX and fails the build on any key the registry does not bind.
  A shifted combo needs its own entry: react-hotkeys-hook matches the key by `e.code` and
  then rejects the event for the shift it did not ask for, so `slash` can never match `?`.
- **A recording in flight is two phases, and both stop paths must cover both.** `isRecording`
  is false for the whole count-in, so anything that means "is a take in progress" has to ask
  `recordingManager.isPending()`, not the store flag. Guarding on `this.session` is the
  specific mistake that made the count-in uncancellable — it does not exist until after the
  count-in, so every stop was a no-op and the take began anyway.
- **The track headers are translated, not scrolled.** One scroll container (the lanes) owns
  the vertical position and `handleScroll` writes the header column's transform. Two
  containers mirroring `scrollTop` drift by construction, because their travel differs by the
  ruler, the trailing pad, the Add Track button and the horizontal scrollbar's reserved
  height. Do not reintroduce a second `overflow-y-auto` there.
- **The metronome still defaults OFF** (`metronomeEnabled: false`) even though PRD §9 lists
  it ON among the recording defaults. Deliberate: §9's defaults are the *Recording UX*
  section's, the count-in now clicks unconditionally, and a click running through the take
  itself would bleed into any recording made on speakers. Turning it on globally would also
  put a click over every demo template the moment a first-time visitor presses Play.
- **Macro audio is unit-tested, not heard**: the clip macros and global swing are proven
  at the schedule level (`tests/clip-macros.test.ts`) but nobody has listened to them, and
  per-clip `Tone.Reverb.generate()` cost on reschedule for Space-heavy projects is
  unmeasured.
- **Transport bar is full**, but it no longer overflows: measured 0px at 1536 (the `2xl` the
  design targets), armed or not. It used to overflow by 70px whenever a track was armed,
  because the right-hand group carried a mic glyph and the armed track's name — 106px that
  existed only while armed, so arming moved every button to its right and pushed Audio
  Settings, the theme toggle and the language switcher off the screen exactly while someone
  was recording. Removed in 8.7.7e: it broke *state changes appearance, state never changes
  layout*, and it said a third time what the red record button and the header's ARMED badge
  already say. Anything new there still has to buy its space — the vibe selector hides its
  caption below `2xl`, the snap picker went into the arrangement's ruler spacer, and the
  count-in selector is its own readout rather than a labelled select.
- **#21 Custom Instruments is closed** (built in 8.7.5, replied to and closed 2026-08-30).
  The requester never answered the four scoping questions (their consistent pattern across
  #16–#19), so the scope was set from prior art — GarageBand Smart Controls — and the
  reasoning is in `docs/notes/sprint-8.7.md` § 8.7.5 so it can be defended or revised if
  they come back. Open issues: **#23–#30** good-first-issues.
- **Not verified by ear.** Every claim about 8.7.5's audio is a measurement (rendered RMS,
  high-frequency ratio, deep-compared Tone options), not a listening test. Nobody has heard
  a custom instrument, and the same caveat still stands for the 8.7.3 clip macros.
- **Sprint 8.5 shipped as v1.2.0**; **Sprint 8.6 (design system) shipped as v1.3.0**, both
  on 2026-08-29. Sprint 8.7.1–8.7.3 are built on `feat/feel-and-musicality` and unreleased;
  CHANGELOG/ROADMAP are updated at the v1.4 release, not per sprint section.
- **Deferred from 8.6 to 8.7:** mobile artboards (the mobile layout is verified; the drawn
  reference is not done, and the public play page it would cover is a Sprint 9 concept) and
  a fresh demo GIF + repo social preview (both need a recorded take).
- **Artboard PNGs are only as current as the last `npm run design:artboards`** — the HTML
  previews cannot go stale, the exports can.
- **Pushing**: GitHub rejects pushes exposing the maintainer's private email (GH007), so
  commits must be authored as `3322516+superzero11@users.noreply.github.com`. Set
  `GIT_AUTHOR_EMAIL`/`GIT_COMMITTER_EMAIL` per commit, or offer to set it in the repo's
  local git config.

## Open-source posture

- Respond to issues fast; this repo's contributors arrived via issues (#5–#18 → Sprint 6.5).
- No test suite is the main blocker to accepting external audio PRs — prioritize
  golden-render tests before inviting engine contributions.
- Public artifacts (README, ROADMAP, CHANGELOG) must stay consistent with shipped reality.
- **Product rule from the maintainer:** no SEO content scaling, no pages built for
  crawlers. Every public page must be something a musician would want to land on.
  Discoverability comes from real shared music, directory listings, and launches.

## Git & commit conventions

- Commit messages follow Conventional Commits (`feat:`, `fix:`, `refactor:`, `test:`,
  `docs:`, `chore:`) and reference the GitHub issue when one exists (`(#NN)`).
- **Never add a `Co-Authored-By: Claude …` trailer (or any AI attribution trailer) to
  commit messages or PR bodies.** Maintainer rule — commits are authored by the maintainer.
- Never commit or push unless explicitly asked. Never commit directly to `main` for
  feature work — branch, then open a PR.
