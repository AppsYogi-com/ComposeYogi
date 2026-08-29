// ============================================
// ComposeYogi — App Configuration
// ============================================
//
// Identity and links only. Behavioural constants deliberately do NOT live here:
// this file used to carry a parallel set of limits, zoom levels, track colours
// and a template list that had all drifted from the code, so reading it told
// you things about the app that were no longer true.
//
// The real sources of truth:
//   BPM / key / scale defaults ....... lib/store/project.ts
//   Zoom, track height, panel state .. lib/store/ui.ts + components/compose/TrackList.tsx
//   Track colours .................... app/globals.css + TrackList.tsx
//   Templates ........................ lib/templates/demo-templates.ts
//   Instruments ...................... lib/audio/synth-presets.ts
//   Export formats ................... lib/audio/index.ts
//   Autosave timing .................. lib/persistence/autosave.ts
//   Undo history limit ............... lib/store/project.ts (zundo `limit`)

export const APP_CONFIG = {
    name: 'ComposeYogi',
    tagline: 'Make real music. Instantly. In your browser.',
    description: 'Your online music studio and DAW for creating beats, loops, and compositions.',
    baseUrl: 'https://composeyogi.com',

    contact: {
        email: 'hello@appsyogi.com',
        support: 'hello@appsyogi.com',
    },

    company: {
        name: 'AppsYogi',
        url: 'https://appsyogi.com',
    },

    repository: {
        url: 'https://github.com/AppsYogi-com/ComposeYogi',
        issues: 'https://github.com/AppsYogi-com/ComposeYogi/issues',
    },

    social: {
        x: 'https://x.com/AppsYogi',
        linkedIn: 'https://www.linkedin.com/company/appsyogi',
        instagram: 'https://www.instagram.com/appsyogi',
        github: 'https://github.com/AppsYogi-com',
    },

    project: {
        defaultName: 'Untitled Project',
        maxNameLength: 64,
        fileExtension: '.composeyogi',
    },
} as const;

export type AppConfig = typeof APP_CONFIG;
