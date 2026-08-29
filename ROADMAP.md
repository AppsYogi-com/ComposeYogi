# 🗺️ ComposeYogi Roadmap

Our mission: **make professional music creation accessible to everyone,
instantly, in the browser.**

The north star we hold ourselves to: *if a first-time user records a vocal and
says "this felt like a real studio", we've won.* Everything below is in service
of that — a beginner-grade cognitive load over a DAW-grade engine, with the
depth revealed progressively rather than removed.

This is the single source of truth for what has shipped and what is next.
Star ⭐ the repo to follow along.

---

## ✅ Shipped

### v1.2 — Solid Ground *(in progress)*

The engine you can build on. No new surface area; everything here is about the
studio behaving the way a studio has to.

- [x] **Export sounds exactly like playback** — live and offline rendering now
      share one scheduler, so a mix cannot drift between what you hear and what
      you download
- [x] **Solo works** — and is honoured on export, alongside mute and faders
- [x] **Instant mixer** — volume, pan, mute and solo no longer rebuild the
      playback schedule, so faders respond immediately and never interrupt audio
- [x] **Templates load real music** — clicking a template in the browser panel
      now opens the full arrangement instead of a silent set of empty tracks
- [x] **Smooth with big arrangements** — clips are virtualized; a 256-clip
      project mounts a screenful, not all of it
- [x] **Track headers stay aligned** — vertical scrolling past a screenful of
      tracks no longer desynced the names from their lanes
- [x] **Crash containment** — a failure in one panel no longer blanks the page
      while your project sits safely saved
- [x] **First test suite and CI** — types, lint, locales and tests run on every
      pull request
- [x] **Correct splits in odd time signatures** — splitting a clip in 3/4 or 7/8
      no longer sends notes to the wrong side of the cut

### v1.1.0 — March 2026

- [x] **WAV, MP3, MIDI and JSON export**
- [x] **Audio import** — drag-and-drop WAV/MP3 onto the timeline
- [x] **64 instruments** across 10 categories, including 6 drum kits
- [x] **Zoom controls** and custom time signatures
- [x] **8 demo templates** — Lo-Fi, Trap, Ambient, EDM, Bollywood, Reggaeton,
      Synthwave, Afrobeats
- [x] **Bug fixes** — polyphony, audio glitch on note edit, per-clip instruments

### v1.0.0 — Studio

Multi-track timeline, piano roll, drum sequencer, microphone recording with
latency calibration, local-first storage with autosave, offline PWA support,
rebindable keyboard shortcuts, English and Spanish.

---

## 🎨 Next — v1.3, Design System

Before any new interface ships, ComposeYogi gets a real design system: tokens,
components and artboards for desktop *and* mobile, committed publicly in
`design/` so contributors build inside it rather than around it. The existing
app is migrated to comply first.

- [ ] Design system committed to the repo — foundations, component gallery,
      desktop and mobile artboards
- [ ] Full app migration: no hardcoded colours, one type and spacing scale,
      verified in both themes
- [ ] **Home page redesign** — the studio's real power, with clear paths for
      musicians and for contributors
- [ ] Refreshed screenshots, demo GIF and social preview

---

## 🎼 Then — v1.4, Feel & Musicality

Where a pattern stops being programmed and starts being played.

- [ ] **Velocity lane** in the piano roll — the biggest gap between our editor
      and a real one
- [ ] **Clip macros that do something** — Energy, Groove, Brightness and Space
      wired to real DSP: one slider, many changes
- [ ] **Swing and humanize** — timing and velocity that breathe
- [ ] **Triplet snapping** — and finer grid options, which unlock whole genres
- [ ] **Vibe-based key and scale picker** — "Chill", "Dark", rather than modes
- [ ] **Stretch to BPM** for audio clips
- [ ] **Custom instruments** ([#21](https://github.com/AppsYogi-com/ComposeYogi/issues/21))
      — design your own sounds, save and share them as presets
- [ ] **Play it live** — MIDI keyboard input and musical typing

---

## 🔗 After that — v1.5, Share & Cloud

A track should be able to become a link.

- [ ] **Anonymous share links** — no account needed, on either end
- [ ] **Public play page** — mobile-first, plays in the browser, unfurls nicely
- [ ] **Remix** — open someone's track in your own editor, with attribution
- [ ] **Accounts and cloud sync** — optional, arriving after sharing works
- [ ] **Embeddable player**
- [ ] **More templates** — Jazz, Classical, World, Rock, House

> **A promise about the backend.** ComposeYogi stays fully local-first. Sharing
> is powered by a managed, open-source backend configured with keys in a `.env`
> file — paste your keys and it runs in minutes, no infrastructure to deploy.
> With **no keys at all, the app works exactly as it does today**, with the
> sharing UI simply hidden. Self-hosting stays possible; it is never required.

---

## 🎛️ Later — v2.0 and beyond

The pro depth. Sequenced behind the on-ramp, not cut from it.

- [ ] **Multi-take recording** with comping
- [ ] **Automation lanes** — volume, pan and effect parameters over time
- [ ] **Collaboration** — remix chains and time-stamped comments
- [ ] **True time-stretching** via WASM
- [ ] **Sidechain compression** and master-bus FX
- [ ] **Version history**
- [ ] **Plugin exploration** — a WASM instrument and effect API

**Deliberately not planned:** real-time simultaneous co-editing. We are building
the asynchronous model instead — remix and comment — because it fits how music
actually gets passed between people, and it works without anyone being online at
the same time.

---

## 💡 Suggest a Feature

Have an idea? [Open an issue](https://github.com/AppsYogi-com/ComposeYogi/issues/new).
Several of the instruments and fixes above came directly from community issues.

Want to build something? [`good first issue`](https://github.com/AppsYogi-com/ComposeYogi/labels/good%20first%20issue)
is where to start, and [ARCHITECTURE.md](ARCHITECTURE.md) explains how the
engine fits together.

---

## 🎯 Our Principles

1. **Browser-first** — no installation, works everywhere
2. **Professional quality** — DAW-grade tools without the complexity
3. **Local-first** — your data stays on your device unless you choose to sync
4. **Open and collaborative** — built with and for the community
5. **Progressive disclosure** — simple for beginners, powerful for pros

---

**Last updated:** August 2026
