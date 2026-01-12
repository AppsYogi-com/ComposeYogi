// ComposeYogi App Configuration
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

    social: {
        x: 'https://x.com/AppsYogi',
        linkedIn: 'https://www.linkedin.com/company/appsyogi',
        instagram: 'https://www.instagram.com/appsyogi',
        github: 'https://github.com/AppsYogi-com',
    },

    seo: {
        primaryKeywords: [
            'online music maker',
            'browser daw',
            'beat maker online',
            'music composer online',
            'free beat maker',
            'online music studio',
            'web based daw',
            'make beats online',
            'music production online',
            'free music maker',
        ],
    },

    features: {
        maxTracks: 16,
        maxClipsPerTrack: 64,
        maxProjectsStored: 50,
        autosaveIntervalMs: 30000, // 30 seconds
        undoHistoryLimit: 100,
    },

    audio: {
        defaultBpm: 120,
        minBpm: 40,
        maxBpm: 300,
        defaultKey: 'C',
        defaultScale: 'major',
        defaultTimeSignature: { numerator: 4, denominator: 4 },
        sampleRate: 44100,
        latencyHint: 'interactive' as const,
    },

    project: {
        defaultName: 'Untitled Project',
        maxNameLength: 64,
        fileExtension: '.composeyogi',
    },

    export: {
        formats: ['midi', 'wav'] as const,
        defaultFormat: 'midi' as const,
        wavSampleRate: 44100,
        wavBitDepth: 16,
    },

    ui: {
        gridSnapValues: [1, 0.5, 0.25, 0.125] as const, // bars
        defaultGridSnap: 0.25,
        zoomLevels: [0.5, 0.75, 1, 1.5, 2, 3, 4] as const,
        defaultZoom: 1,
        pixelsPerBeat: 24,
        trackHeaderWidth: 200,
        minTrackHeight: 60,
        maxTrackHeight: 200,
        defaultTrackHeight: 80,
    },

    templates: [
        'lofi',
        'trap',
        'ambient',
        'afro',
        'pop',
    ] as const,

    trackColors: {
        drums: 'hsl(0, 70%, 50%)',      // Red
        bass: 'hsl(200, 70%, 50%)',     // Blue
        keys: 'hsl(45, 70%, 50%)',      // Yellow/Orange
        melody: 'hsl(280, 70%, 50%)',   // Purple
        vocals: 'hsl(120, 70%, 50%)',   // Green
        fx: 'hsl(340, 70%, 50%)',       // Pink
    },
} as const;

export type AppConfig = typeof APP_CONFIG;
export type TemplateType = (typeof APP_CONFIG.templates)[number];
export type ExportFormat = (typeof APP_CONFIG.export.formats)[number];
export type GridSnapValue = (typeof APP_CONFIG.ui.gridSnapValues)[number];
export type ZoomLevel = (typeof APP_CONFIG.ui.zoomLevels)[number];
