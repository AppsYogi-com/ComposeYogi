# Changelog

All notable changes to ComposeYogi will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.3.0] - 2026-08-29

The studio gets one visual language, and a build that enforces it.

### Added

- **A design system, committed publicly in `design/`** — principles, usage
  rules, a token reference, and live HTML artboards you can open in a browser.
  `lib/design/tokens.ts` is the single source for every colour, radius,
  duration and elevation in the product.
- **A redesigned home page** — templates above the fold so the first thing the
  page can do is make a sound, a look at the real arrangement view, what the
  studio does, and two clear ways in: open it, or help build it.
- Named `success`, `warning` and `info` state colours, a seven-family drum
  palette for the sequencer rail, and tokens for the fixed surfaces that
  deliberately do not follow the theme (modal scrims, clip labels, piano keys).
- `npm run design:tokens` regenerates everything derived from the tokens;
  `npm run design:artboards` re-exports the reference images and the social card.

### Fixed

- **Every track was a different colour depending on where you looked.** The
  palette was defined in three places that disagreed: bass was blue on its clip,
  orange in its track header, and blue again in the browser panel. Drums was
  orange, red, and red.
- **The instrument browser's colour dots had no colour at all.** Their class name
  was built by string interpolation, which Tailwind cannot see, so the rule was
  never generated.
- **JetBrains Mono never applied anywhere.** `--font-mono` was defined in terms
  of itself, which makes the whole declaration invalid, so every number in the
  studio fell back to the default monospace.
- Volume faders were invisible in the light theme — the rail was tinted at 93%
  lightness against a 96% surface.
- The light-theme accent failed WCAG AA in both directions: 3.2:1 as text on the
  page, and 3.2:1 under white text on a button. Three dark-theme state colours
  had the same problem. The whole palette is now checked in the test suite.
- Clip labels were white on colours too light to carry them; they are now dark
  in the dark theme and light in the light theme, following the fill.
- The social card was a 2102×1261 screenshot of an old build — showing template
  names that no longer exist — while being declared as 1200×630. It is now a
  designed card at the size it claims.
- The compose screenshot on the home page still showed the old track palette.

### Changed

- `npm run check` now fails on a raw Tailwind palette class, a hex literal, an
  interpolated class name, an off-scale type or radius value, a generated file
  out of sync with the tokens, or a colour pair that fails WCAG AA.
- `CONTRIBUTING.md` gains a Design section — UI changes must comply with
  `design/` — and finally points newcomers at the `good first issue` label,
  which only the README and roadmap did before.

## [1.2.0] - 2026-08-29

Hardening release. No new surface area — this is about the studio behaving the
way a studio has to, and about making the codebase safe for contributors.

### Fixed

#### Audio correctness
- **Export now sounds exactly like playback.** Live playback and offline export
  were two separate implementations of the same scheduling logic and had
  drifted: bypassed effects were skipped on export but still applied during
  playback, the master chain used a different gain with no limiter live, and
  reverb impulse responses were awaited offline but not live. Both paths now
  share one scheduler (`lib/audio/scheduler.ts`).
- **Solo now works.** The function existed but nothing ever called it. Solo is
  applied live and honoured on export, as are mute and track faders.
- Switching a clip's active audio take now triggers a reschedule, instead of
  continuing to play the previous take (#22, reported by @develephant)
- Splitting a clip measured the cut at four beats per bar regardless of the
  project's time signature, so a split in 3/4 or 7/8 sent notes to the wrong
  side of the cut
- Saving a project stamped its clips with the project id but not its tracks, so
  a project whose tracks carried an older id reloaded with no tracks at all
- Track headers scrolled independently of their lanes, so past a screenful of
  tracks the names lined up against the wrong lanes
- The studio was excluded from search engines by `robots.txt`

#### Templates and instruments
- Clicking a template in the browser panel created tracks with no clips — a
  silent, empty project. Templates now load their full arrangement.
- The instrument browser and the audio engine kept hand-mirrored registries that
  could drift apart (the cause of the duplicate-euphonium bug, #20). The browser
  list is now derived from the engine's, and a missing entry fails the build.

### Added
- **Rebindable keyboard shortcuts** and a searchable shortcut reference panel
  (<kbd>/</kbd>), driven by a central registry (#20). This shipped to `main` in
  March but was never released, so it is recorded here.
- 6 instruments: Square Wave, Triangle Wave, Sawtooth Wave, Euphonium, Taiko,
  Maracas — with the duplicate Euphonium removed and Orchestra Hit recategorised
  to bowed strings (#20)
- First test suite: 75 tests covering the scheduler, project store, persistence
  round-trips and clip virtualization (Vitest + fake-indexeddb)
- Continuous integration — types, lint, locale parity, tests and a production
  build now run on every push and pull request
- Ordered IndexedDB migrations (`lib/persistence/migrations.ts`), with tests for
  fresh installs and stepwise upgrades
- Error boundaries around each studio panel and at the route level, so a crash
  no longer blanks the page
- `ARCHITECTURE.md` — how the engine, state and persistence fit together

### Changed
- **Mixer moves are instant.** Volume, pan, mute and solo now ramp the existing
  audio nodes instead of tearing down and rebuilding the entire playback
  schedule. Measured on a 256-clip project: zero reschedules where previously
  every fader movement rebuilt all 256 clips.
- Clips are virtualized — a lane mounts only what the viewport can show plus a
  buffer. The same 256-clip project mounts 80 elements instead of 256.
- Metronome state lived in two contradictory places; it now lives in the
  playback store alone
- `config/app.ts` carried limits, zoom levels, track colours and a template list
  that had all drifted from the code. It now holds identity and links only, and
  points at the real source of truth for everything else.
- README no longer duplicates the roadmap or the keyboard-shortcut list; both
  have one home (ROADMAP.md and the in-app reference panel)

---

## [1.1.0] - 2026-03-08

### Added

#### Audio Export & Import
- WAV export with OfflineAudioContext renderer and progress indicator (#7)
- MP3 export via lamejs encoder (#6)
- Audio file import — drag-and-drop WAV/MP3 files onto timeline (#5)

#### Instruments — 45+ New Presets
- 10 new synth presets: Electric Piano, Clavinet, Fingerstyle Bass, FM Bass, Funk Lead, Distortion Lead, Warm Pad, Choir Pad, Ethereal Pad, Pluck Synth (#9)
- 24 pitched instruments across 4 new categories (#16):
  - **Idiophones**: Marimba, Xylophone, Glockenspiel, Vibraphone, Celesta, Kalimba, Music Box
  - **Plucked Strings**: Acoustic Guitar, Harp, Ukulele, Banjo, Pizzicato, Guzheng
  - **Bowed Strings**: Violin, Cello, Double Bass, Tenor Violin, Fiddle
  - **Wind**: Flute, Piccolo, Oboe, Bassoon, Saxophone, Trumpet
- 5 additional instruments: Synth Drum Kit, Didgeridoo, Vocal Synth, Orchestra Hit, Guzheng (#17)
- 4 more instruments: Bongos, Wooden Block, Harpsichord, Steel Pan (#18)
- 6 new instruments: Square Wave, Triangle Wave, Sawtooth Wave, Euphonium, Taiko, Maracas (#19)
- Per-clip instrument preset support (each clip remembers its instrument)
- Demo note patterns for every instrument

#### Drum Kits
- 4 sampler-based drum kits: 808, Acoustic, Lo-Fi, Electronic (#11)
- Punchy Drum kit with synthesized samples (#12)
- Classic Drum (MembraneSynth) preset (#14)

#### UI & Workflow
- Zoom controls in toolbar (+/− buttons) (#8)
- Custom time signature support (#8)
- 4 new demo templates: Bollywood Beats, Reggaeton, Synthwave, Afrobeats
- 10 instrument categories: Synths, Keys, Bass, Pads, Leads, Drums, Idiophones, Plucked Strings, Bowed Strings, Wind
- Public roadmap (ROADMAP.md)
- AI coding assistant instructions (.github/copilot-instructions.md)

### Fixed
- Synth Bass polyphony — changed MonoSynth to PolySynth\<MonoSynth\> (#10)
- Audio glitch when modifying notes — race condition in scheduleProject + weak clipNotesHash (#15)
- All clips playing the same sound regardless of instrument preset

### Changed
- "Mallet" instrument category renamed to "Idiophones" (#18)
- Bell moved from Synths → Idiophones (#18)
- Orchestra Hit moved from Synths → Idiophones (#18, #19)
- Woodwind and Brass merged into "Wind" category (#19)
- Strings split into "Plucked Strings" and "Bowed Strings" (#19)
- NoiseSynth added to SynthType union for Maracas support (#19)

---

## [1.0.0] - 2026-01-10

### Added
- **Multi-track Timeline** — Audio, MIDI, and Drum tracks with drag-and-drop clips
- **Piano Roll Editor** — Full-featured MIDI note editor with scale lock
- **Drum Sequencer** — Step sequencer with pattern presets (Four on Floor, Hip Hop, Trap)
- **Built-in Instruments** — Synths, bass, keys, leads, and pads powered by Tone.js
- **Real-time Visualizer** — Frequency bars and waveform display
- **Mixer Controls** — Volume, pan, mute, and solo per track
- **Audio Recording** — Record from microphone with latency calibration
- **Local-first Storage** — Auto-save to IndexedDB, works offline
- **MIDI Export** — Export compositions to MIDI files
- **Audio Export** — Export projects as audio files
- **Keyboard Shortcuts** — Professional workflow with hotkeys
- **Dark/Light Theme** — Theme toggle support
- **Internationalization** — English and Spanish language support
- **PWA Support** — Installable app with offline caching
- **Demo Templates** — Lo-Fi, Trap, Ambient, EDM starter projects
- **Sample Browser** — Browse and preview built-in samples
- **Docker Support** — Containerized deployment with Docker Compose

### Technical
- Next.js 15 with App Router
- Tone.js audio engine
- Zustand + Zundo for state management with undo/redo
- IndexedDB persistence via idb
- next-intl for i18n routing
- Radix UI components
- @dnd-kit for drag-and-drop
- Serwist for PWA/service worker

---

[Unreleased]: https://github.com/AppsYogi-com/ComposeYogi/compare/v1.3.0...HEAD
[1.3.0]: https://github.com/AppsYogi-com/ComposeYogi/compare/v1.2.0...v1.3.0
[1.2.0]: https://github.com/AppsYogi-com/ComposeYogi/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/AppsYogi-com/ComposeYogi/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/AppsYogi-com/ComposeYogi/releases/tag/v1.0.0
