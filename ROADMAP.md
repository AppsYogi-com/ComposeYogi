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

### v1.4 — Feel & Musicality *(August 2026)*

Where a pattern stops being programmed and starts being played.

- [x] **Play it live** — a MIDI keyboard plays the armed track's instrument, and
      when there is no MIDI keyboard the computer keyboard does. `K` brings up a
      73-key keyboard, C1 to C7, with every white key named and the letter
      printed on every key the typing rows reach. The rest is dimmed, so you can
      see where your hands are rather than having to be told — and the keyboard
      never moves: shifting the octave slides the lit keys along it. Velocity,
      sustain, pitch bend, mouse glissando, and what you play lands in a clip
      while a track is armed. On a drum track the keys are labelled with drums
      rather than notes, black keys included, because the key a piano calls C3
      is a tom on a kit.
      *The MIDI hardware path was built against the specification and has not been
      tried on a real keyboard — reports welcome*
- [x] **A muted track could still be heard from the editors** — clicking a note
      in the piano roll or a drum in the sequencer played straight to the
      speakers, past the track's fader, effects and its mute and solo buttons,
      and using a generic synth rather than the track's own instrument. Previews
      now run through the track, so they sound like it and go quiet when it does
- [x] **You can change a track's instrument** — until now the only way to put a
      sound on a track was to drag one from the browser, which also created a
      clip and filled it with notes, so there was no way to change what a track
      sounded like without changing what was on it. The Inspector now has an
      Instrument field on the track and on the clip, and it is a search box
      rather than a 64-item menu
- [x] **The drums played the wrong sounds, and had since v1.0** — every kit
      mapped its samples an octave below the notes the sequencer writes, so the
      kick played an open hi-hat and the snare, hats and ride all played the
      same shaker at different speeds. Seven of the nine samples in each kit
      were downloaded on every visit and never heard. The demo beats had no
      kick drum at all; one now lands 32 dB louder with 94% of its energy below
      150 Hz. The shaker has moved off the ride cymbal too, so the cymbals
      reach for a cymbal. *Your patterns were always right — the kits were
      reading them wrongly*
- [x] **Grand Piano** — the low half of the keyboard used to be a bare sine
      wave, which a laptop speaker cannot reproduce at all below middle C. The
      new FM piano carries those notes on their harmonics, the way a real one
      does: at C2 and C3, 57% and 75% of the note now lands in a range a laptop
      can play, against 0% before
- [x] **Custom instruments** ([#21](https://github.com/AppsYogi-com/ComposeYogi/issues/21))
      — start from any built-in, move four controls, hear it as you go. Save,
      duplicate, and share as a file. Drum kits too, with their own controls
- [x] **Clip macros that do something** — Energy, Groove, Brightness and Space
      wired to real DSP, applied inside the scheduler so playback and export
      cannot disagree
- [x] **A velocity lane** in the piano roll, a default-velocity control, and
      velocity drawn into the clip preview — so a flat part looks flat
- [x] **Swing and humanize** — timing and velocity that breathe
- [x] **Triplet snapping** — and a real grid in both the piano roll and the
      arrangement, each with its own setting
- [x] **Vibe-based key and scale picker** — "Chill", "Dark", rather than modes
- [x] **Stretch to BPM** for audio clips
- [x] **Recording looks like recording** — a count-in overlay you can set and
      cancel, an ARMED badge, a pulsing region where the take is landing, and
      arming on every track type, not just audio ones
- [x] **The keyboard hints tell the truth** — `R`, `L`, `M` and `?` had been
      printed in tooltips and bound to nothing since v1.0
- [ ] Mobile artboards and a fresh demo GIF — the two pieces of the design
      system that need a drawn reference and a recorded take, not a screenshot
      *(carried to v1.5)*

### v1.3 — One Language *(August 2026)*

The studio now has a single visual language, and a build that enforces it.

- [x] **A design system in the repo** — [`design/`](design/README.md) holds the
      principles, the usage rules and live artboards you can open in a browser.
      Every colour, radius and duration comes from one file.
- [x] **Every track is one colour again** — the palette had been defined in
      three places that disagreed, so the same track was blue on its clip and
      orange in its header
- [x] **The instrument browser's colour dots actually render** — their class
      name was built in a way the CSS tooling could never see
- [x] **The numbers are in the right typeface** — the mono font had been
      defined in terms of itself, so it never applied anywhere
- [x] **The light theme is real** — faders are visible, and every colour pair
      the interface puts together now meets WCAG AA, which several did not
- [x] **A redesigned home page** — templates above the fold, a look at the real
      arrangement view, and clear paths for musicians and for contributors
- [x] **A social card that shows the product we actually ship**

### v1.2 — Solid Ground *(August 2026)*

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

## 🔗 Next — v1.5, Share & Cloud

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
is where to start, [ARCHITECTURE.md](ARCHITECTURE.md) explains how the engine
fits together, and [design/](design/README.md) is the system every piece of UI
is built from.

---

## 🎯 Our Principles

1. **Browser-first** — no installation, works everywhere
2. **Professional quality** — DAW-grade tools without the complexity
3. **Local-first** — your data stays on your device unless you choose to sync
4. **Open and collaborative** — built with and for the community
5. **Progressive disclosure** — simple for beginners, powerful for pros

---

**Last updated:** August 2026
