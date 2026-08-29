# Contributing to ComposeYogi

First off, thank you for considering contributing to ComposeYogi! 🎵

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Making Changes](#making-changes)
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

- Use the design system colors defined in `tailwind.config.ts`
- Prefer utility classes over custom CSS
- Use `cn()` helper from `lib/utils.ts` for conditional classes

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
