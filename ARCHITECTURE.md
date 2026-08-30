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

**Adding an instrument:** add the preset, then add its metadata entry. Forget
the second and the build fails — which is the point. These two lists used to be
maintained by hand and drifted into a duplicate-instrument bug (#20).

### Audio, briefly

- Recording: mic → trim to loop bounds → fades → WAV bytes → `AudioTake`,
  with a latency offset from `latency-calibration.ts`.
- Export: `Tone.Offline()` render → WAV, or → lamejs → MP3.
- MP3 encoder loads from `public/workers/lame.min.js` via a `<script>` tag. This
  is a deliberate workaround for webpack/CJS issues — please don't "fix" it back
  into the bundle.

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

---

## Known rough edges

Honest list, so you don't have to discover these yourself:

- **Clip macros** (`energy`, `groove`, `brightness`, `space`, `humanize`,
  `transpose`) are persisted and exported but drive no DSP yet. They are a
  designed feature, not dead code — implement, don't delete.
- **Piano-roll velocity** is hardcoded to 100 and display-only. The velocity
  lane is designed but unbuilt; the drum sequencer already has the drag-to-edit
  interaction to port.
- **Frame-rate, Lighthouse and cross-browser numbers** have not been captured on
  real hardware since the Sprint 8.5 performance work. Treat them as unverified.

See [ROADMAP.md](ROADMAP.md) for where each of these is scheduled.
