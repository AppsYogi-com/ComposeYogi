# ComposeYogi — AI Coding Assistant Instructions

ComposeYogi is a browser-based DAW with an Ableton-style arrangement view.
Next.js 15 · React 19 · TypeScript (strict) · Tone.js · Zustand + zundo ·
IndexedDB · Radix/Tailwind · next-intl (en/es) · Serwist PWA. Local-first: there
is no backend today, and nothing leaves the browser.

## Read this first

**[ARCHITECTURE.md](../ARCHITECTURE.md) is the source of truth** for how the
audio engine, state, persistence and rendering work, which modules own a single
answer, and which invariants a change must not break.
**[CONTRIBUTING.md](../CONTRIBUTING.md)** covers workflow, PR expectations, and
how to test audio in a codebase where Tone.js cannot be constructed under Vitest.

**This file does not restate either of them.** It has drifted out of date twice
by trying to — most recently telling contributors that adding an instrument
touches two places when it had taken three since v1.4. Anything that is a fact
about the project belongs in those two documents, where a test now checks it.
What is left here is only what an assistant specifically tends to get wrong.

## What assistants get wrong here

1. **Do not delete "unused" fields.** Several fields in `types/index.ts` and some
   unwired schema exist because a designed feature is scheduled but unbuilt —
   punch recording and the count-in overlay were both in this state. They are
   commitments, not dead code. Check [ROADMAP.md](../ROADMAP.md) before
   proposing a removal.

2. **Do not "fix" the MP3 encoder into the bundle.** It loads from
   `public/workers/lame.min.js` via a `<script>` tag as a deliberate workaround
   for webpack/CJS issues.

3. **A passing `npm run check` is not proof an audio change works.** There is no
   Web Audio in the test environment, so nothing there can hear anything. Claims
   about how something sounds must be measured in a browser — CONTRIBUTING.md
   explains how, and the three ways such a measurement lies.

4. **Never build a Tailwind class name by interpolation.** `bg-track-${role}`
   produces no CSS. This shipped once and made every colour dot invisible.

5. **Do not add a second answer to a question that already has one.** The
   modules that own a single source of truth are listed in ARCHITECTURE.md, and
   `tests/music.test.ts` and `tests/design-system.test.ts` fail the build on a
   duplicate. Every one of them exists because a copy drifted and reached a
   release.

## Commands

```bash
npm run dev      # Dev server (Turbopack)
npm test         # Vitest
npm run check    # Locales + tokens + types + lint + tests — what CI runs
npm run build    # Production build
```
