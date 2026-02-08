// ============================================
// ComposeYogi — Core Type Definitions
// ============================================

// ============================================
// Project & Composition Types
// ============================================

export interface Project {
    id: string;
    name: string;
    bpm: number;
    key: MusicalKey;
    scale: MusicalScale;
    timeSignature: [number, number];
    tracks: Track[];
    clips: Clip[];
    createdAt: number;
    updatedAt: number;
    latencyOffset?: number; // ms, from calibration
}

export type MusicalKey = 'C' | 'C#' | 'D' | 'D#' | 'E' | 'F' | 'F#' | 'G' | 'G#' | 'A' | 'A#' | 'B';

export type MusicalScale =
    | 'major'
    | 'minor'
    | 'dorian'
    | 'phrygian'
    | 'lydian'
    | 'mixolydian'
    | 'locrian'
    | 'pentatonic'
    | 'blues';

// ============================================
// Track Types
// ============================================

export interface Track {
    id: string;
    projectId: string;
    name: string;
    type: TrackType;
    color: TrackColor;
    volume: number;        // 0-1
    pan: number;           // -1 to 1
    muted: boolean;
    solo: boolean;
    armed: boolean;
    instrumentPreset?: string;
    effects?: TrackEffect[];
    order: number;
}

export type TrackEffectType = 'reverb' | 'delay' | 'distortion' | 'filter' | 'compression';

export interface TrackEffect {
    id: string;
    type: TrackEffectType;
    active: boolean;
    presetId?: string; // Reference to FX_PRESETS
    params: Record<string, any>;
}

export type TrackType = 'audio' | 'midi' | 'drum';

export type TrackColor =
    | 'drums'
    | 'bass'
    | 'keys'
    | 'melody'
    | 'vocals'
    | 'fx';

// ============================================
// Clip Types
// ============================================

export interface Clip {
    id: string;
    trackId: string;
    type: ClipType;
    name: string;
    startBar: number;
    lengthBars: number;
    // Audio-specific
    audioTakeIds?: string[];
    activeTakeId?: string;
    trimStart?: number;    // seconds
    trimEnd?: number;      // seconds
    fadeIn?: number;       // seconds
    fadeOut?: number;      // seconds
    // MIDI/Drum-specific
    notes?: Note[];
    // Instrument
    instrumentPreset?: string; // Synth preset ID (overrides track default)
    // Common
    transpose?: number;
    humanize?: number;     // 0-100
    energy?: number;       // 0-100 (macro)
    groove?: number;       // 0-100 (macro)
    brightness?: number;   // 0-100 (macro)
    space?: number;        // 0-100 (macro)
}

export type ClipType = 'audio' | 'midi' | 'drum';

// ============================================
// Audio Types
// ============================================

export interface AudioTake {
    id: string;
    clipId: string;
    audioData: Uint8Array; // Raw audio bytes
    sampleRate: number;
    duration: number;      // seconds
    peaks: PeaksCache;
    createdAt: number;
}

export interface PeaksCache {
    [samplesPerPixel: number]: {
        min: Float32Array;
        max: Float32Array;
    };
}

export interface UserSample {
    id: string;
    name: string;
    fileName: string;
    mimeType: string;
    fileSize: number;
    audioData: Uint8Array; // Raw audio bytes
    sampleRate: number;
    duration: number;      // seconds
    peaks: PeaksCache;
    bpm?: number;
    key?: string;
    createdAt: number;
}

// ============================================
// MIDI Types
// ============================================

export interface Note {
    id: string;
    pitch: number;         // MIDI note number (0-127)
    startBeat: number;     // In beats from clip start
    duration: number;      // In beats
    velocity: number;      // 0-127
}

// ============================================
// Template Types
// ============================================

export interface Template {
    id: string;
    name: string;
    emoji: string;
    description: string;
    bpm: number;
    key: MusicalKey;
    scale: MusicalScale;
    genre: TemplateGenre;
    tracks: TemplateTrack[];
    clips: TemplateClip[];
    audioUrls: string[];   // URLs for lazy loading
}

export interface TemplateTrack {
    name: string;
    type: TrackType;
    color: TrackColor;
    instrumentPreset?: string;
}

export interface TemplateClip {
    trackIndex: number;
    type: ClipType;
    startBar: number;
    lengthBars: number;
    audioUrl?: string;
    notes?: Note[];
}

export type TemplateGenre =
    | 'lofi'
    | 'trap'
    | 'ambient'
    | 'afro'
    | 'pop'
    | 'edm'
    | 'rock'
    | 'jazz';

// ============================================
// UI State Types
// ============================================

export interface UIState {
    // Panel visibility
    browserOpen: boolean;
    inspectorOpen: boolean;
    editorOpen: boolean;

    // Active selections
    selectedTrackId: string | null;
    selectedClipIds: string[];

    // Active editor context
    activeEditorClipId: string | null;
    editorScope: EditorScope;

    // Viewport
    zoom: number;          // samplesPerPixel
    scrollX: number;       // pixels
    scrollY: number;       // pixels

    // Loop region
    loopStart: number;     // bars
    loopEnd: number;       // bars
    loopEnabled: boolean;

    // Recording
    punchEnabled: boolean;
    countInBars: number;

    // Modals
    activeModal: ModalType | null;
}

export type EditorScope =
    | 'arrangement'
    | 'pianoRoll'
    | 'drumSequencer'
    | 'waveformEditor';

export type ModalType =
    | 'export'
    | 'latencyCalibration'
    | 'shortcuts'
    | 'settings'
    | 'newProject';

// ============================================
// Playback State Types
// ============================================

export interface PlaybackState {
    isPlaying: boolean;
    isRecording: boolean;
    currentBar: number;
    // Refs (not stored in state, but typed here for hook returns)
}

export interface PlaybackRefs {
    currentTimeRef: React.MutableRefObject<number>;
    isPlayingRef: React.MutableRefObject<boolean>;
    playbackStartTimeRef: React.MutableRefObject<number>;
    audioStartPositionRef: React.MutableRefObject<number>;
}

// ============================================
// Web Worker Types
// ============================================

export interface AudioWorkerMessage {
    type: 'computePeaks' | 'cancel';
    jobId: string;
    data?: {
        channelData: Float32Array[];
        sampleRate: number;
        targetWidth: number;
        samplesPerPixel?: number;
    };
}

export interface AudioWorkerResponse {
    type: 'progress' | 'result' | 'error';
    jobId: string;
    progress?: number;
    message?: string;
    peaks?: { min: Float32Array; max: Float32Array };
    error?: string;
}

// ============================================
// Persistence Types
// ============================================

export interface DBSchema {
    projects: {
        key: string;
        value: Project;
        indexes: {
            'by-updated': number;
        };
    };
    audioTakes: {
        key: string;
        value: AudioTake;
        indexes: {
            'by-clip': string;
        };
    };
    settings: {
        key: string;
        value: AppSettings;
    };
}

export interface AppSettings {
    latencyOffset: number;
    metronomeVolume: number;
    defaultCountIn: number;
    theme: 'dark' | 'light';
    locale: string;
}

// ============================================
// Keyboard Shortcut Types
// ============================================

export interface ShortcutConfig {
    key: string;
    modifiers?: ('mod' | 'shift' | 'alt')[];
    action: string;
    scope?: EditorScope | 'global';
    description: string;
}

// ============================================
// Export Types
// ============================================

export interface ExportOptions {
    format: 'wav' | 'midi';
    includeMetronome: boolean;
    startBar?: number;
    endBar?: number;
    quality?: 'high' | 'medium' | 'low';
}

export interface ExportProgress {
    status: 'preparing' | 'rendering' | 'encoding' | 'complete' | 'error';
    progress: number;
    message: string;
}

// ============================================
// Latency Calibration Types
// ============================================

export interface CalibrationResult {
    latencyMs: number;
    confidence: 'high' | 'medium' | 'low';
    attempts: number;
}

export interface CalibrationState {
    status: 'idle' | 'preparing' | 'playing' | 'analyzing' | 'complete' | 'error';
    progress: number;
    result?: CalibrationResult;
    error?: string;
}
