# Changelog

All notable changes to ComposeYogi will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- 4 new demo templates: Bollywood Beats, Reggaeton, Synthwave, Afrobeats
- Public roadmap (ROADMAP.md)
- AI coding assistant instructions (.github/copilot-instructions.md)

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

[Unreleased]: https://github.com/AppsYogi-com/ComposeYogi/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/AppsYogi-com/ComposeYogi/releases/tag/v1.0.0
