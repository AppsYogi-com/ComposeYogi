# Changelog

All notable changes to ComposeYogi will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
  - **Strings**: Violin, Viola, Cello, Double Bass, Acoustic Guitar, Harp, Erhu, Sitar
  - **Woodwind**: Flute, Clarinet, Oboe, Bassoon, Pan Flute
  - **Brass**: Trumpet, French Horn, Trombone, Tuba
- 5 additional instruments: Synth Drum Kit, Didgeridoo, Vocal Synth, Orchestra Hit, Guzheng (#17)
- 4 more instruments: Bongos, Wooden Block, Harpsichord, Steel Pan (#18)
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
- 10 instrument categories: Synths, Keys, Bass, Pads, Leads, Drums, Idiophones, Strings, Woodwind, Brass
- Public roadmap (ROADMAP.md)
- AI coding assistant instructions (.github/copilot-instructions.md)

### Fixed
- Synth Bass polyphony — changed MonoSynth to PolySynth\<MonoSynth\> (#10)
- Audio glitch when modifying notes — race condition in scheduleProject + weak clipNotesHash (#15)
- All clips playing the same sound regardless of instrument preset

### Changed
- "Mallet" instrument category renamed to "Idiophones" (#18)
- Bell moved from Synths → Idiophones (#18)
- Orchestra Hit moved from Synths → Strings (#18)

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

[Unreleased]: https://github.com/AppsYogi-com/ComposeYogi/compare/v1.1.0...HEAD
[1.1.0]: https://github.com/AppsYogi-com/ComposeYogi/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/AppsYogi-com/ComposeYogi/releases/tag/v1.0.0
