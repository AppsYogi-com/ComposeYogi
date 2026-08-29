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
| `design/` (public, from Sprint 8.6) | The committed design system — tokens, principles, exported artboards. All UI must comply. |
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

No test suite exists yet. CI (`.github/workflows/docker-publish.yml`) only builds/signs
the Docker image — it does not run `check`.

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
- `playout.ts` — `PlayoutManager`: per-track chain `entry → [effects] → gain → panner →
  master → analyser → destination`; `scheduleProject()` schedules every clip via
  `Transport.schedule`. Guarded by a `scheduleVersion` counter so stale in-flight
  schedules abort (race fix from #15) — preserve this pattern.
- `recorder.ts` + `recording-manager.ts` — mic → trim to loop bounds → fades → WAV bytes
  → `AudioTake` (in-memory map + IndexedDB). Latency offset from `latency-calibration.ts`.
- `offline-renderer.ts` — separate scheduling implementation inside `Tone.Offline()` for
  WAV/MP3 export. ⚠ Duplicates `playout.ts` logic; any scheduling change must be made in
  BOTH until they are unified (planned).
- `synth-presets.ts` — 64 preset factories (`SYNTH_PRESETS`). Resolution order at schedule
  time: `clip.instrumentPreset` → `track.instrumentPreset` → fallback by track color.
- MP3 via lamejs loaded by `<script>` tag (`public/workers/lame.min.js`) — deliberate
  workaround for webpack/CJS issues; don't "fix" it back into the bundle.

### Persistence (`lib/persistence/`)
- IndexedDB `composeyogi` v2 via idb. Stores: projects (metadata only), tracks, clips
  (notes JSON-stringified), audioTakes (ArrayBuffer + serialized peaks), userSamples, settings.
- `autosave.ts` — 3s debounce for project saves; audio takes save immediately;
  `beforeunload` guard.

### Rendering
- Canvas for ruler/grid (`lib/canvas/`, DPR-aware); DOM for clips.
- Peaks computed in `public/workers/audio-peaks-worker.js` with Transferable zero-copy.

### Instruments & templates — sync hazards
- `SYNTH_PRESETS` (lib/audio/synth-presets.ts) and `INSTRUMENTS` (lib/browser/index.ts)
  are **hand-mirrored registries**. Drift here caused the duplicate-euphonium bug (#20).
  Any instrument add/change touches both (and usually a demo pattern in TrackList).
- Two template systems exist: `TEMPLATES` (browser panel — tracks only, no clips) and
  `DEMO_TEMPLATES` (`lib/templates/demo-templates.ts` — full music, used by landing page
  and `?demo=` param). Consolidation is a known target; until then know which one you're in.

### i18n
- Locale routes via `app/[locale]/` + middleware; messages in `messages/{en,es}.json`.
- Every user-visible string needs both locales; `npm run validate:locales` gates the build.

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
- Rescheduling is driven by `clipNotesHash` + `project.clips.length` in
  `app/[locale]/compose/page.tsx` — if a new feature changes clip audio without changing
  those hash fields, playback silently goes stale (see issue #22: `activeTakeId`).
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

## Known gaps & active issues (updated 2026-08-29 — verify before relying on)

- **Solo is unwired**: `playoutManager.updateSoloState()` exists, nothing calls it.
- **Mixer perf**: any track volume/pan change triggers a full `scheduleProject()`
  teardown/rebuild; `updateTrackVolume`/`updateTrackPan` exist but the UI never uses them.
- **Piano roll velocity**: hardcoded 100, display-only. Velocity lane is a designed
  feature (design.md + TaskList 5.3) — drum sequencer already has drag-to-edit to port.
- **Clip macros** (energy/groove/brightness/space/humanize/transpose): persisted and
  exported but drive no DSP yet. These are planned features (design.md) — implement, don't delete.
- **Scheduler duplication**: `playout.ts` vs `offline-renderer.ts` (see above).
- **Metronome state duplicated**: Transport.tsx local `useState` vs unused
  `playbackStore.metronomeEnabled`.
- Open issues: **#21** Custom Instruments (5 months old, from the most active community
  member — scheduled Sprint 8.7.5), **#22** reschedule-hash misses `activeTakeId`
  (one-line fix proposed by author — lands in Sprint 8.5.1).
- **README roadmap section has drifted** (lists WAV export as planned though it shipped in
  v1.1) — fix is Sprint 8.5.5; until then don't cite README's roadmap as current.
- Repo has no git tags / GitHub Releases despite CHANGELOG versions (Sprint 8.5.4).

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
