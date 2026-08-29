# ComposeYogi — AI Coding Assistant Instructions

ComposeYogi is a browser-based DAW with an Ableton-style arrangement view.
Next.js 15 · React 19 · TypeScript (strict) · Tone.js · Zustand + zundo ·
IndexedDB · Radix/Tailwind · next-intl (en/es) · Serwist PWA. Local-first: there
is no backend today, and nothing leaves the browser.

## Read this first

**[ARCHITECTURE.md](../ARCHITECTURE.md) is the source of truth** for how the
audio engine, state, persistence and rendering work, and which invariants a
change must not break. This file does not restate it — it drifted out of date
once already by trying to.

Also worth reading before proposing changes:

- **[ROADMAP.md](../ROADMAP.md)** — what is planned and in what order. Several
  fields in `types/index.ts` (`energy`, `groove`, `brightness`, `space`,
  `humanize`, `transpose`) are persisted but not yet wired to DSP. They are
  **designed features, not dead code.** Do not suggest deleting them.
- **[CONTRIBUTING.md](../CONTRIBUTING.md)** — workflow and PR expectations.

## The rules that matter most

1. **`lib/audio/scheduler.ts` owns how a clip becomes sound.** Live playback and
   offline export both schedule through it. A change to timing, instruments,
   effects or mix gating that touches only one caller is a bug — that split is
   exactly what made exports stop matching playback before.
2. **If a feature changes how a clip sounds, add it to the reschedule hashes**
   in `app/[locale]/compose/page.tsx`. Otherwise playback silently goes stale.
3. **Never put per-frame values in React state.** The playhead and scroll
   position use `playbackRefs` (plain `{ current }` refs) deliberately.
4. **Mixer moves must not reschedule.** Volume, pan, mute and solo ramp existing
   nodes. Rebuilding the schedule for a fader is a regression.
5. **Adding an instrument touches two places**: the preset in
   `lib/audio/synth-presets.ts` and its metadata in `lib/browser/index.ts`.
   Forgetting the second fails the build, by design.
6. **Every user-visible string needs both locales.** `npm run validate:locales`
   gates the build.
7. **Schema changes go in `lib/persistence/migrations.ts`** as a new numbered
   migration. Never edit a shipped one.

## Conventions

- Banner comments: `// ============================================`
- Imports: React → Next → external → internal (`@/…`) → types
- `PascalCase.tsx` for components (`TrackList.tsx`), `kebab-case.ts` for lib
  modules (`synth-presets.ts`); barrel `index.ts` per folder
- 4-space indentation
- `createLogger('Context')` from `lib/logger.ts` — no bare `console.*`
- Immutable Zustand updates: `set((state) => ({ … }))`
- Time: bars in UI and state, seconds in Tone.js — convert at the boundary
- Always dispose Tone nodes (Players, Synths, effects) on unschedule/unmount
- Commit messages follow Conventional Commits and reference the issue (`(#NN)`)

## Commands

```bash
npm run dev      # Dev server (Turbopack)
npm test         # Vitest
npm run check    # Locales + types + lint + tests — what CI runs
npm run build    # Production build
```

## Where things live

| | |
|---|---|
| Studio page (audio lifecycle, reschedule triggers) | `app/[locale]/compose/page.tsx` |
| Shared scheduling core | `lib/audio/scheduler.ts` |
| Live playback / offline export | `lib/audio/playout.ts` / `lib/audio/offline-renderer.ts` |
| Stores | `lib/store/{project,playback,ui}.ts` |
| Persistence and migrations | `lib/persistence/` |
| Instruments | `lib/audio/synth-presets.ts` |
| Shortcut registry | `lib/shortcuts/` |
| Types | `types/index.ts` |
| Tests | `tests/` |
