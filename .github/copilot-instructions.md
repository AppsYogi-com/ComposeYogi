# ComposeYogi AI Coding Assistant Instructions

## Project Overview
ComposeYogi is a professional browser-based Digital Audio Workstation (DAW) with an Ableton-like interface. Built with Next.js 15, Tone.js, TypeScript, and Zustand for state management. The app is local-first with IndexedDB persistence, PWA-enabled, and supports i18n (en, es).

## Architecture & Core Systems

### State Management (Zustand + Zundo)
- **Three stores**: `project`, `playback`, `ui` in `lib/store/`
- Project store uses `temporal` from `zundo` for undo/redo history
- Always import from `lib/store/index.ts` for consistent selectors
- Use refs in `playbackRefs` (from `lib/store/playback`) for animation loop values that don't trigger re-renders

### Audio Engine (Tone.js)
- **Engine**: `lib/audio/engine.ts` wraps Tone.Transport for play/stop/seek/loop
- **Playout**: `lib/audio/playout.ts` schedules clips to Tone.js, manages track signal chains (gain → panner → effects → master)
- **Recording**: `lib/audio/recorder.ts` + `recording-manager.ts` handle microphone input with latency compensation
- Always await `audioEngine.initialize()` before playback operations

### Data Model & Persistence
- **Types**: All core types in `types/index.ts` (Project, Track, Clip, Note, AudioTake)
- **IndexedDB schema**: Defined in `lib/persistence/db.ts` with separate object stores for projects, tracks, clips, audioTakes, settings
- Projects store metadata only; tracks/clips stored separately for efficient updates
- Audio takes stored as ArrayBuffer with peaks JSON for waveform rendering
- Auto-save runs every 30s via `hooks/useAutosave.ts`

### Rendering & Canvas
- **GridRenderer** (`lib/canvas/GridRenderer.ts`): Timeline grid with beat markers, handles DPR scaling
- **WaveformRenderer** (`lib/canvas/WaveformRenderer.ts`): Audio visualization with peaks caching at different zoom levels
- All canvas operations scale for devicePixelRatio
- Use `requestAnimationFrame` for playhead animation loops

### Internationalization (next-intl)
- Locale-prefixed routes via `app/[locale]/` and middleware
- Translation keys in `messages/{locale}.json`
- Use `useTranslations()` hook with namespace (e.g., `t = useTranslations('compose.transport')`)
- Validate translations before build: `npm run validate:locales`

## Development Workflows

### Running & Building
```bash
npm run dev             # Dev server with Turbopack
npm run build           # Validate locales, type-check, lint, then build
npm run check           # Run all validations without building
```

### Key Patterns
- **Clip Editors**: Each clip type has a dedicated editor in `components/compose/editors/` (DrumSequencer, PianoRoll, WaveformEditor)
- **DnD**: Uses `@dnd-kit` for clip dragging in timeline. See `hooks/useClipDrag.ts` for collision/snapping logic
- **Keyboard shortcuts**: Registered with `react-hotkeys-hook` in main compose page
- **PWA**: Service worker built with Serwist from `app/sw.ts` → `public/sw.js`

### Critical Dependencies
- **Tone.js**: All audio scheduling/synthesis/recording
- **@dnd-kit**: Drag-and-drop for clips
- **idb**: IndexedDB wrapper
- **zundo**: Time-travel for project store
- **next-intl**: i18n routing and translations

## Project-Specific Conventions

### Naming & Structure
- Use kebab-case for file names: `track-list.tsx`, `audio-engine.ts`
- Components prefixed by feature: `compose/Transport.tsx`, `home/DemoTemplates.tsx`
- Barrel exports in `index.ts` files for clean imports

### Code Style
- Banner comments: `// ============================================`
- Group imports: React → Next → external → internal → types
- State updates immutable via Zustand's `set((state) => ({ ... }))`
- Logger usage: `createLogger('ComponentName')` for all modules

### Audio-Specific
- Time values: Bars for UI/state, seconds for Tone.js Transport
- Always convert: `Tone.getTransport().toSeconds('bars:beats:sixteenths')`
- Latency: Stored in `project.latencyOffset` (ms), applied in recording only
- COOP/COEP headers required (set in `next.config.ts`) for SharedArrayBuffer support

### Common Pitfalls
- Don't update playback refs directly; use `playbackRefs.isPlayingRef.current`
- Always dispose Tone.js objects when unmounting (Players, Synths, Effects)
- Canvas rendering: Clear before draw, restore context after transformations
- IndexedDB: Notes stored as JSON string in ClipRecord, parse on read

## File References
- Main compose page: `app/[locale]/compose/page.tsx`
- Store setup: `lib/store/index.ts`, `lib/store/project.ts`
- Audio system: `lib/audio/engine.ts`, `lib/audio/playout.ts`
- Type definitions: `types/index.ts`
- Configuration: `config/app.ts`, `next.config.ts`
