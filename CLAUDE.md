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
| `docs/composeyogi.md` | Founder PRD: vision, users, flows, quality bars, phase roadmap (Phase 2 = multi-take, automation, collaboration-lite; Phase 3 = AI, mobile companion, marketplace) |
| `docs/design.md` | UI/UX spec for the compose page. Contains **designed-but-unbuilt** features — piano-roll velocity lane, clip macros (Energy/Groove/Brightness/Space → "one slider = many DSP changes"), stretch-to-BPM, vibe-based scale selector. Do not treat unwired schema for these as dead code. |
| `docs/TaskList.md` | **The planning document** (currently v1.3). Sprint-based, checkboxes, named deliverables, versioned footer. All work is planned here first. Active: Sprint 8.5 → 8.6 (design gate) → 8.7 → Phase 1.5. |
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
   CHANGELOG.md, and mirror user-visible changes into public ROADMAP.md.
5. **Quality checkpoints** run after each sprint; a feature is done only per the
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
- `ui.ts` — panels, selection, zoom, drag state, custom keybindings.

### Audio (`lib/audio/`)
- `engine.ts` — singleton wrapping Tone.Transport: play/pause/stop/seek, BPM, time
  signature, loop, metronome, bar↔second conversion.
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
- `offline-renderer.ts` — WAV/MP3 export inside `Tone.Offline()`. Renders from the same
  render plan as `playout.ts`; no scheduling logic of its own.
- `synth-presets.ts` — 64 preset factories (`SYNTH_PRESETS`). Resolution order at schedule
  time: `clip.instrumentPreset` → `track.instrumentPreset` → fallback by track color.
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
  (notes JSON-stringified), audioTakes (ArrayBuffer + serialized peaks), userSamples, settings.
- `autosave.ts` — 3s debounce for project saves; audio takes save immediately;
  `beforeunload` guard. `projectSaveSignature` decides whether anything changed and is
  **derived from the project object**, never a list of fields — as a literal it silently
  dropped every field nobody remembered to add. `ProjectRecord` in `db.ts` is still
  hand-built in both directions, so a new `Project` field must be added to the record type,
  `saveProject` and `loadProject`; a round-trip test over `keyof Project` enforces it.

### Rendering
- Canvas for ruler/grid (`lib/canvas/`, DPR-aware); DOM for clips.
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
  inside the accent band, and any colour pair that misses WCAG AA.
- `npm run design:artboards` re-exports `design/artboards/*.png` and `public/og-image.png`
  (needs Chrome; the HTML previews in `design/previews/` are the reference and open by
  double-clicking, no server).

### Instruments & templates
- `SYNTH_PRESETS` (lib/audio/synth-presets.ts) is canonical. `INSTRUMENTS`
  (lib/browser/index.ts) derives id/name/category from it; only browser metadata
  (description, trackType, trackColor) lives there, typed `Record<SynthPresetId, …>` so a
  missing entry **fails the build**. Adding an instrument touches both places by design.
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

## Known gaps & active issues (updated 2026-08-29 after Sprint 8.7.3 — verify before relying on)

- **Three hand-maintained lists of `Project` fields**, each of which fails silently when a
  new field is forgotten, and each of which has now cost a bug: the reschedule hash
  (`lib/audio/schedule-hash.ts`, was #22), `ProjectRecord` (`lib/persistence/db.ts`, save
  and load, hand-built both ways), and autosave's change signature
  (`projectSaveSignature`, which used to be a literal naming eight fields and quietly
  dropped `swing` and `latencyOffset`). All three now have exhaustiveness tests over
  `keyof Project` in `tests/`. **Adding a field to `Project` means visiting all three** —
  the tests will say so, but only if you run them.
- **Unverified performance claims**: frame rate, Lighthouse, the offline walkthrough and
  the cross-browser matrix have NOT been measured on real hardware since the 8.5 work
  (rAF doesn't run in a headless pane). Don't quote numbers for these.
- **Macro audio is unit-tested, not heard**: the clip macros and global swing are proven
  at the schedule level (`tests/clip-macros.test.ts`) but nobody has listened to them, and
  per-clip `Tone.Reverb.generate()` cost on reschedule for Space-heavy projects is
  unmeasured.
- **Transport bar is full.** It overflows its own width by ~60px at 1280px and just fits at
  1536 (the `2xl` the design targets); it already overflowed slightly before Sprint 8.7.
  Anything new there has to buy its space — the vibe selector hides its caption below `2xl`,
  and the snap picker went into the arrangement's ruler spacer instead.
- Open issues: **#21** Custom Instruments (answered 2026-08-29, scheduled v1.4/Sprint
  8.7.5, awaiting requester's scoping input), **#23–#30** good-first-issues.
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
