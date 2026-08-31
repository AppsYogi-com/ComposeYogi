# Changelog

All notable changes to ComposeYogi will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.4.0] - 2026-08-31

Feel and musicality. The studio stops being a grid you fill in and starts being an
instrument you play — velocity, swing, macros that move real DSP, sounds you can
build yourself, and a keyboard you can play them from.

### Added

- **Grand Piano**, and it is the instrument this app was missing. Every note the
  keyboard played below middle C used to be a bare sine wave — one frequency,
  no harmonics — and a laptop speaker cannot reproduce a 33 Hz sine at all, so
  the whole bottom of the keyboard arrived as silence and cone rattle. The new
  preset is FM-synthesised with a full harmonic series, so the low notes are
  carried by their harmonics the way a real piano's are: at C2 and C3, **57% and
  75%** of each note now lands where a laptop can actually reproduce it, against
  **0%** before. It also decays like a struck string instead of holding a level.
  New Keys tracks start on it; your saved projects keep whatever they had.
- **Play it live.** A MIDI keyboard plays the armed track's instrument, and when
  there is no MIDI keyboard the computer keyboard does — `K` opens a **73-key
  keyboard, C1 to C7**, with every white key named and the letter printed on every
  key the two typing rows reach. The rest of the board is dimmed, so you can see at
  a glance where your hands are. **The keyboard itself never moves**: shifting the
  octave slides the lit keys along it, exactly one octave a step, the way transpose
  works on real hardware. Click or drag across it with the mouse, set how hard notes land, and
  latch **Sustain** or hold **Shift** for it — a note the pedal is holding stays lit
  while its key comes back up, the way a piano does. **Esc** silences a stuck note.
  Notes played land in a MIDI clip while a track is armed, held chords included.
  The live voice is built by the same resolver the scheduler uses, so what you play
  is exactly what the clip will play back, custom instruments and all — and it runs
  through that track's effects, fader and pan. **On a drum track the keys are
  labelled with drums, not notes** — BD2, SN1, CHH, on the black keys as well, since
  that is where General MIDI puts the hats — because the key a piano calls C3 is a
  tom on a kit.
- **Full MIDI keyboard support**: notes, the sustain pedal, pitch bend (±2
  semitones), and the panic controllers a keyboard's own panic button sends. Note-on
  with velocity 0 is read as note-off, which is what most keyboards actually send,
  and MIDI clock is ignored rather than treated as a torrent of notes. *Built
  against the specification — no MIDI hardware was available to test it on, so
  reports from anyone with a keyboard are very welcome.*
- **Custom instruments** (#21, the community's oldest open request). Start from any
  of 58 built-ins, move four controls — or eight, behind a disclosure — and hear it
  as you go. Save, duplicate, delete, and share as a `.cyi.json` file. Drum kits are
  editable too, with their own controls: Pitch, Decay and Snap.
- **Clip macros that move real DSP.** Energy, Groove, Brightness and Space are
  applied inside the scheduler, so they sound identical on playback and on export.
  Humanize and Transpose apply at schedule time.
- **Velocity, everywhere it was missing.** A velocity lane under the piano roll, a
  default-velocity control for new notes, and velocity drawn into the clip preview
  in the arrangement, so a flat part looks flat.
- **Swing**, global and per-clip through the Groove macro, applied to off-beats.
- **A real snap grid** in both the piano roll and the arrangement — 1/4 through
  1/32, triplets, and off — each surface with its own setting, because you place
  clips against bars and draw sixteenths.
- **A vibe-based key and scale selector** in the transport.
- **Stretch a clip to the project's tempo.** Version one repitches; true
  time-stretch is a later phase. Audio clips also gained playback preview inside
  the waveform editor.
- **Recording looks like recording.** A count-in overlay, an ARMED badge on the
  track header, a softly pulsing region where the take is landing, a brighter
  playhead and a dimmed grid. The count-in is selectable in the transport, and it
  clicks whether or not the metronome is on.
- Every track can be armed, not only audio ones — arming a MIDI or drum track means
  the notes you play land there, and it raises no microphone prompt.
- **You can change a track's instrument.** Until now the only way to put a sound on
  a track was to drag one from the browser — which also created a clip and filled it
  with demo notes, so there was no way to change what a track *sounded like* without
  changing what was *on* it. The Inspector now has an Instrument field on the track
  and another on the clip, the clip's carrying **Same as track** so an override the
  arrangement set can be cleared. It is a search box rather than a menu: 64 built-ins
  plus your own is a list you type into, and it matches on category as well as name,
  so "keys" finds all six Keys instruments though none of them contains the word.
- **The studio speaks Spanish.** Every panel, toolbar, editor, modal, tooltip and
  toast in `components/compose/` reads from `messages/{en,es}.json` instead of
  hardcoded English. Scale names, track types, effect names and shortcut labels are
  translated too; catalogue content owned by `lib/` (instrument, sample and template
  names) is still English.
- A language switcher in the studio header, beside the theme toggle. It also gained
  the accessible name it never had, on the home page as well.
- Deleting a track now asks first.

### Fixed

- **Screen readers could not tell whether a switch was on.** Mute, Solo, Loop,
  the Metronome and the keyboard button all changed colour to show they were
  active and said nothing about it, so each was announced identically on and
  off. They now report their state. (Play/Pause and Arm/Disarm already did, by
  changing their own label.)
- **A muted track could still be heard from the editors.** Clicking a note in the
  piano roll, or a drum in the step sequencer, played straight to your speakers —
  past the track's effects, its fader, its pan and its mute and solo buttons. It
  also wasn't the track's instrument: every melodic track auditioned through the
  same generic synth and every kit through the same drum, so clicking a note on a
  Rhodes played something that wasn't a Rhodes. Previews now go through the track
  they belong to, which means they sound like the track — and a muted track is
  silent, which is what muted means. The same fix reached one more corner: a track
  you had muted *before* pressing play could be heard from the on-screen keyboard,
  because its fader was only set up once the transport ran.
- **Every drum in the app played the wrong sound — since v1.0.** All six kits mapped
  their samples an octave below the notes the sequencer, the templates and the piano
  roll actually write, so nothing ever reached the sample it was meant to. The kick
  played an open hi-hat; the snare, the hats, the ride and the cowbell all played the
  same shaker at different speeds. Seven of the nine samples in each kit were loaded
  on every visit and never heard once. In practice the demo beats had **no kick drum
  at all** — measured, a kick now puts **94%** of its energy below 150 Hz where it
  used to put 7.9%, and arrives 32 dB louder. Claps are mapped too, so the five demo
  beats that layer a clap on the backbeat finally have one. The shaker has also
  moved off the ride cymbal, where it had been standing in — one sample in the
  wrong slot was being handed to every cymbal and hand-percussion sound above
  it, so those now reach for a cymbal instead. *Your drum patterns have not
  changed — they were always written correctly; the kits were reading them
  wrongly.*
- **Every note in the app was named an octave too high, and the bottom octave
  could not be heard.** Middle C was labelled C5; the piano roll's own note names
  and its key column disagreed with each other. Worse, the lowest note the on-screen
  keyboard offered — labelled "C1" — was really C0 at **16.35 Hz**: below human
  hearing, below the lowest note on a piano, and below anything a laptop speaker
  can move. Every label now follows scientific pitch notation, so C4 is middle C
  and C1 is the 32.70 Hz that every other instrument calls C1. The playable range
  moved with it, to **C1–B7**: it loses the octave nothing could reproduce and
  gains the octave a piano has at the top. *Your notes have not moved or changed
  pitch — only what they are called, and the range the editor draws.*
- **The count-in ran the transport backwards.** Recording from the top of the song
  with the default two-bar count-in asked the transport to sit at a negative time.
  A count-in before bar 0 is pre-roll — the clock runs and the transport waits — and
  only a count-in with music before it is a lead-in the transport plays.
- **Recording with no count-in started from bar 0** wherever the playhead was.
- **A count-in could not be cancelled**, and pressing stop during one still produced
  a clip. Every stop path guarded on a session that does not exist until after the
  count-in.
- **The record button was dead until you pressed Play first.**
- **`R`, `L`, `M` and `?` were printed in tooltips and bound to nothing** — since
  v1.0. All four work, and the build now fails on any key hint the shortcut registry
  does not bind.
- **Solo dimmed nothing.** The arrangement and track headers asked `track.muted`
  rather than the scheduler's own answer, so a track silenced by another track's
  solo looked exactly like one that was playing.
- **Track headers drifted out of line with the lanes** when scrolled.
- **Editing a custom instrument left playback on the old sound**, because the
  instrument's id does not change when its sound does.
- **The audio engine overwrote the project's tempo** with 120 BPM on the first user
  gesture, which silently measured every recording and dropped sample against the
  wrong tempo.
- **The Inspector's clip panel had been unreachable since v1.0.**
- **Autosave could not see two fields nobody had listed** — `swing` and
  `latencyOffset`. The change signature is now derived from the project itself.
- **Picking Harmonic Minor highlighted natural minor.** Scales were defined in three
  places that disagreed; there is now one.
- The transport bar no longer moves its own buttons when a track is armed.
- Reduced motion is honoured product-wide, in one place, with a test that keeps it
  honoured.
- **An edit that changed nothing no longer costs an undo step.** Every mutation
  stamps `project.updatedAt`, and the undo history compared it, so a gesture that
  ended where it began — a velocity drag returned to its start, a clip dragged and
  dropped back — pushed an empty state onto the stack, and only sometimes: two
  writes inside the same millisecond compared equal, two across a boundary did not.
  Undo now compares the project's content.
- The studio header fits at 1280px, the narrowest common laptop width: below 1536px
  the zoom slider gives way — the −/reset/+ buttons beside it do the same job — and
  the header's edge padding and project name tighten.
- The Spanish footer read "por el equipo de ComposeYogi equipo".

### Changed

- **A new Melody track starts on a pluck, not a saw lead.** A raw sawtooth held at
  60% sustain is a soloing sound — an aggressive thing to hand someone who has just
  drawn their first four notes, and it droned rather than played whenever those
  notes overlapped. The pluck decays. New Keys tracks likewise start on the Grand
  Piano. *Existing tracks keep whatever instrument they already had.*
- **One gear instead of four icons** in the studio header: the shortcuts sheet,
  latency calibration, the theme and the language now live in a single settings
  menu. None of them is something you touch while you are working, and they were
  taking permanent width in the tightest part of the bar. Latency calibration also
  got its own name and icon — it had been sitting behind a gear labelled "Audio
  Settings" while being the only thing that gear did.
- **The zoom slider is gone.** It duplicated the −/reset/+ buttons immediately to
  its left. With it and the four icons removed, the header now fits at 1280px with
  room to spare rather than overflowing by 94px.
- `npm run check` gained build gates for keyboard hints that name unbound keys, for
  reduced motion, for i18n (no user-visible literal may survive in
  `components/compose/**`, every message key must have a caller, and every key a
  component asks for must exist), for locale placeholder parity, and for the
  exhaustiveness of the three hand-maintained lists of `Project` fields that had
  each already cost a bug.
- Every modal is a real Radix dialog; the shortcuts sheet, latency calibration and
  the iOS install steps were hand-rolled `<div>`s with no focus trap, no escape and
  no accessible name.
- Every control in the Inspector is now actually named — a `<Label>` beside a Radix
  control names nothing unless the two are wired together.
- Cursors are decided by the primitive, never the call site.
- Panels collapse rather than closing, hiding or being dismissed — one verb pair
  instead of four names for two actions.
- `tests/velocity.test.ts` resets the UI store between tests. It shared
  `defaultVelocity` across the file, so the clamping test left it at 65 and the test
  asserting the default passed only because vitest happened to run it first — under
  `--sequence.shuffle` it failed 2 runs in 12.


### Removed

- Message keys nothing read and no screen showed: `app`, `templates` (superseded by
  `DEMO_TEMPLATES`), `mobile` (no view-only mode exists), `common`, and four unused
  `errors` entries.
- The transport's armed-track indicator, which appeared and disappeared with arming
  and so moved every button to its right.
- A dead duplicate of the track header in `TrackList.tsx`.

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
