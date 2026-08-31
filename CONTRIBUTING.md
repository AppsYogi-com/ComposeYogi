# Contributing to ComposeYogi

First off, thank you for considering contributing to ComposeYogi! 🎵

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Making Changes](#making-changes)
- [Design](#design)
- [Pull Request Process](#pull-request-process)
- [Style Guide](#style-guide)
- [Reporting Bugs](#reporting-bugs)
- [Requesting Features](#requesting-features)

## Code of Conduct

This project and everyone participating in it is governed by our [Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code.

## Getting Started

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:
   ```bash
   git clone git@github.com:YOUR_USERNAME/ComposeYogi.git
   cd ComposeYogi
   ```
3. **Add upstream remote**:
   ```bash
   git remote add upstream git@github.com:AppsYogi-com/ComposeYogi.git
   ```
4. **Create a branch** for your changes:
   ```bash
   git checkout -b feature/your-feature-name
   ```

## Development Setup

### Prerequisites

- Node.js 18.17 or later
- npm, yarn, or pnpm

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

The app will be available at [http://localhost:3000](http://localhost:3000).

### Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server with Turbopack |
| `npm run build` | Create production build |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run type-check` | Run TypeScript type checking |
| `npm test` | Run the test suite (Vitest) |
| `npm run check` | Locales + types + lint + tests — exactly what CI runs |

## Project Structure

```
composeyogi.com/
├── app/                    # Next.js App Router pages
├── components/
│   ├── compose/            # DAW-specific components
│   └── ui/                 # Reusable UI components
├── lib/
│   ├── audio/              # Tone.js audio engine
│   ├── store/              # Zustand state stores
│   ├── persistence/        # IndexedDB operations
│   └── canvas/             # Canvas rendering utilities
├── hooks/                  # Custom React hooks
├── types/                  # TypeScript type definitions
└── messages/               # i18n translation files
```

## Making Changes

### Before You Start

1. **Check existing issues** to see if someone is already working on it
2. **Open an issue** to discuss major changes before implementing
3. **Keep changes focused** — one feature/fix per PR

Looking for somewhere to start? Issues labelled
[`good first issue`](https://github.com/AppsYogi-com/ComposeYogi/labels/good%20first%20issue)
are scoped so you can pick one up without reading the whole codebase — each
names the files to touch and what "done" means. Comment on it and it's yours.
[ARCHITECTURE.md](ARCHITECTURE.md) explains how the engine fits together when
you need the bigger picture.

### Development Guidelines

1. **TypeScript**: All code should be properly typed
2. **Components**: Follow the existing component patterns
3. **State Management**: Use Zustand stores for global state
4. **Audio**: All audio operations should go through `lib/audio/`
5. **Styling**: Use Tailwind CSS classes
6. **Accessibility**: Ensure keyboard navigation works

### Testing Your Changes

```bash
# Everything CI will run: locale parity, types, lint and tests
npm run check

# And confirm it builds
npm run build
```

Add tests for what you change. Tests live in `tests/` and run on Vitest with
`fake-indexeddb`, so store and persistence code is exercised as written rather
than mocked.

**If your change touches the audio engine**, the scheduler tests are the ones
that matter. `tests/scheduler.test.ts` holds a golden snapshot of the render
plan that both live playback and offline export schedule from. A change to
scheduling behaviour should move that snapshot — if it doesn't, either the
change is a no-op or it has broken the guarantee that an export sounds like the
playback. Update the snapshot deliberately and say so in the PR.

Read [ARCHITECTURE.md](ARCHITECTURE.md) before changing audio, state or
persistence — it documents the invariants a change must not break.

### Testing audio

Read this before writing your first audio test — it will save you an afternoon.

**Tone.js cannot be constructed here.** `new Tone.PolySynth(...)` throws
`param must be an AudioParam` under Vitest, because Node has no Web Audio. There
is no mock and no workaround. **No unit test in this repo can prove that
something sounds right.**

What to do instead, in order of preference:

1. **Put the decision somewhere Tone-free and test that.** Most "does it sound
   right" questions are really "is the right number in the right field", and
   those live in `instrument-spec.ts`, `preset-specs.ts`, `drum-kits.ts` or
   `percussion.ts` — none of which import Tone. A kit or preset written as a
   factory is a sound nothing can check.
2. **Pin the output as a golden fixture.** `tests/golden/preset-voice-options.json`
   holds the options objects every preset produces, so an accidental retune of a
   shipped sound fails the build.
3. **Measure it in a real browser** when the question is genuinely acoustic.

If you go as far as (3), three things will lie to you, and all three have:

- **A tap on the voice's own output is not what the user hears.** Measure at
  `playoutManager.getAnalyser()`. The difference between those two readings is
  what catches a voice that makes sound but never reaches the mixer. And the
  master analyser sits *before* the destination, so it cannot see a
  `.toDestination()` bypass at all — for that, tap `Tone.Destination.input`.
- **An instantaneous FFT read is not a loudness measurement.** It samples one
  moment of an envelope. Sample on an interval and keep a running max over
  ~600 ms, or a loud note will measure quieter than a soft one.
- **Start from a normal page load, through the control a user actually clicks.**
  A feature shipped silent once because every harness called `Tone.start()` by
  hand; the page a user opens has a suspended audio context until something
  starts one, and nothing did.

**Always mutate something deliberately first and confirm your harness fails.**
Two harnesses have reported success while measuring nothing at all.

## Pull Request Process

1. **Update your branch** with the latest upstream changes:
   ```bash
   git fetch upstream
   git rebase upstream/main
   ```

2. **Push your branch** to your fork:
   ```bash
   git push origin feature/your-feature-name
   ```

3. **Create a Pull Request** on GitHub

4. **PR Title Format**:
   - `feat: Add new feature` — New feature
   - `fix: Fix bug description` — Bug fix
   - `docs: Update documentation` — Documentation only
   - `refactor: Refactor code` — Code change that neither fixes a bug nor adds a feature
   - `style: Format code` — Formatting, missing semicolons, etc.
   - `perf: Improve performance` — Performance improvements
   - `test: Add tests` — Adding tests
   - `chore: Update dependencies` — Maintenance tasks

5. **PR Description** should include:
   - What changes were made
   - Why the changes were made
   - Screenshots (for UI changes)
   - Related issue numbers

6. **Wait for review** — Maintainers will review your PR and may request changes

## Style Guide

### TypeScript

```typescript
// Use explicit types for function parameters and returns
function calculateBpm(beats: number, seconds: number): number {
  return (beats / seconds) * 60;
}

// Use interfaces for object shapes
interface Track {
  id: string;
  name: string;
  type: 'audio' | 'midi' | 'drum';
}

// Use type for unions or simple types
type TrackType = 'audio' | 'midi' | 'drum';
```

### React Components

```tsx
// Use function components with TypeScript
interface ButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary';
}

export function Button({ children, onClick, variant = 'primary' }: ButtonProps) {
  return (
    <button
      onClick={onClick}
      className={cn('px-4 py-2 rounded', {
        'bg-accent': variant === 'primary',
        'bg-muted': variant === 'secondary',
      })}
    >
      {children}
    </button>
  );
}
```

### Tailwind CSS

- Every colour, radius, duration and shadow comes from the design system — see
  [Design](#design) below
- Prefer utility classes over custom CSS
- Use `cn()` helper from `lib/utils.ts` for conditional classes

## Design

**UI changes must comply with [`design/`](design/README.md).** This is a
Definition-of-Done criterion, not a preference — read it before building
anything visual. It is short, and most of it is a reference you will only need
once.

The short version:

- Colour, type, shape, motion and elevation all come from
  [`lib/design/tokens.ts`](lib/design/tokens.ts). Nothing else defines them.
- No raw Tailwind palette classes (`bg-yellow-500`), no hex literals, no
  off-scale values like `text-[13px]`. `npm run check` fails on all three.
- Never build a class name by interpolation — `bg-track-${role}` produces no
  CSS at all, because Tailwind extracts class names from source text. Use the
  static maps in [`lib/design/track-colors.ts`](lib/design/track-colors.ts).
- State colours (`destructive`, `success`, `warning`, `info`) mean state.
  Anything merely categorical uses the track scale instead.
- **Check both themes.** The tests cannot see a value that reads in one and
  vanishes in the other, and that has already shipped here more than once.

Changing a token:

```bash
# 1. Edit lib/design/tokens.ts
npm run design:tokens      # rewrites globals.css, manifest.json and design/README.md
npm run design:artboards   # optional — re-exports the reference PNGs (needs Chrome)
```

Never hand-edit a generated block.

[`design/previews/`](design/previews/) holds live HTML artboards you can open in
a browser to see the whole system at once — press `t` to switch themes.

## Reporting Bugs

When reporting bugs, please include:

1. **Description**: Clear description of the bug
2. **Steps to Reproduce**: Numbered steps to reproduce the issue
3. **Expected Behavior**: What should happen
4. **Actual Behavior**: What actually happens
5. **Environment**:
   - Browser and version
   - Operating system
   - Node.js version (if relevant)
6. **Screenshots**: If applicable
7. **Console Errors**: Any errors from browser dev tools

Use the [Bug Report template](https://github.com/AppsYogi-com/ComposeYogi/issues/new?template=bug_report.md) when creating an issue.

## Requesting Features

When requesting features, please include:

1. **Problem**: What problem does this feature solve?
2. **Solution**: How do you envision this working?
3. **Alternatives**: Have you considered any alternatives?
4. **Additional Context**: Any mockups, examples, or references

Use the [Feature Request template](https://github.com/AppsYogi-com/ComposeYogi/issues/new?template=feature_request.md) when creating an issue.

## Questions?

If you have questions, feel free to:

- Join our [Discord Community](https://discord.gg/M5qBX4Fz)
- Open a [Discussion](https://github.com/AppsYogi-com/ComposeYogi/discussions)
- Ask in the issue you're working on

---

Thank you for contributing! 🎹✨
