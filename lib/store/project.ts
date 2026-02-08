// ============================================
// ComposeYogi — Project Store
// Central state for project data with undo/redo
// ============================================

import { create } from 'zustand';
import { temporal } from 'zundo';
import { v4 as uuid } from 'uuid';
import { TEMPLATES } from '@/lib/browser';
import type {
    Project,
    Track,
    Clip,
    Note,
    TrackType,
    TrackColor,
    TrackEffect,
    TrackEffectType,
    ClipType,
    MusicalKey,
    MusicalScale
} from '@/types';

// ============================================
// Store Types
// ============================================

interface ProjectState {
    // Current project
    project: Project | null;

    // Loading states
    isLoading: boolean;
    isSaving: boolean;
    lastSaved: number | null;
    hasUnsavedChanges: boolean;
}

interface ProjectActions {
    // Project lifecycle
    createProject: (name?: string, templateId?: string) => Project;
    loadProject: (project: Project) => void;
    updateProject: (updates: Partial<Project>) => void;
    closeProject: () => void;

    // Track operations
    addTrack: (type: TrackType, name?: string, color?: TrackColor) => Track;
    updateTrack: (trackId: string, updates: Partial<Track>) => void;
    addTrackEffect: (trackId: string, type: TrackEffectType, presetId?: string) => void;
    updateTrackEffect: (trackId: string, effectId: string, updates: Partial<TrackEffect>) => void;
    removeTrackEffect: (trackId: string, effectId: string) => void;
    deleteTrack: (trackId: string) => void;
    reorderTracks: (trackIds: string[]) => void;

    // Clip operations
    addClip: (trackId: string, type: ClipType, startBar: number, lengthBars?: number) => Clip;
    updateClip: (clipId: string, updates: Partial<Clip>) => void;
    deleteClip: (clipId: string) => void;
    deleteClips: (clipIds: string[]) => void;
    duplicateClip: (clipId: string, offsetBars?: number) => Clip | null;
    moveClip: (clipId: string, newTrackId: string, newStartBar: number) => void;
    moveClipsByDelta: (clipIds: string[], deltaBars: number) => void;
    resizeClip: (clipId: string, newLengthBars: number) => void;
    splitClip: (clipId: string, atBar: number) => [Clip, Clip] | null;

    // Note operations (for MIDI/drum clips)
    addNote: (clipId: string, note: Omit<Note, 'id'>) => Note | null;
    updateNote: (clipId: string, noteId: string, updates: Partial<Note>) => void;
    deleteNote: (clipId: string, noteId: string) => void;

    // Musical settings
    setBpm: (bpm: number) => void;
    setKey: (key: MusicalKey) => void;
    setScale: (scale: MusicalScale) => void;
    setTimeSignature: (timeSignature: [number, number]) => void;

    // Save state
    markSaved: () => void;
    setLoading: (loading: boolean) => void;
}

type ProjectStore = ProjectState & ProjectActions;

// ============================================
// Default Values
// ============================================

const DEFAULT_BPM = 120;
const DEFAULT_KEY: MusicalKey = 'C';
const DEFAULT_SCALE: MusicalScale = 'minor';
const DEFAULT_TIME_SIGNATURE: [number, number] = [4, 4];

const TRACK_COLORS: TrackColor[] = ['drums', 'bass', 'keys', 'melody', 'vocals', 'fx'];

// ============================================
// Helper Functions
// ============================================

const createDefaultProject = (name: string = 'Untitled Project'): Project => ({
    id: uuid(),
    name,
    bpm: DEFAULT_BPM,
    key: DEFAULT_KEY,
    scale: DEFAULT_SCALE,
    timeSignature: DEFAULT_TIME_SIGNATURE,
    tracks: [],
    clips: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
});

const getNextTrackColor = (tracks: Track[]): TrackColor => {
    const usedColors = tracks.map(t => t.color);
    const availableColor = TRACK_COLORS.find(c => !usedColors.includes(c));
    return availableColor || TRACK_COLORS[tracks.length % TRACK_COLORS.length];
};

// ============================================
// Store Implementation
// ============================================

const projectStoreBase = (
    set: (fn: (state: ProjectState) => Partial<ProjectState>) => void,
    get: () => ProjectStore
): ProjectStore => ({
    // Initial state
    project: null,
    isLoading: false,
    isSaving: false,
    lastSaved: null,
    hasUnsavedChanges: false,

    // Project lifecycle
    createProject: (name, templateId) => {
        const project = createDefaultProject(name);

        // Find template if provided
        const template = templateId ? TEMPLATES.find(t => t.id === templateId) : null;

        if (template) {
            project.bpm = template.bpm;
            project.key = template.key as MusicalKey;
            project.scale = template.scale as MusicalScale;

            project.tracks = template.tracks.map((t, index) => ({
                id: uuid(),
                projectId: project.id,
                name: t.name,
                type: t.type,
                color: t.color,
                instrumentPreset: t.instrumentId,
                volume: 0.8,
                pan: 0,
                muted: false,
                solo: false,
                armed: false,
                order: index,
            }));
        } else {
            // Add default starter tracks
            const defaultTracks: Track[] = [
                {
                    id: uuid(),
                    projectId: project.id,
                    name: 'Drums',
                    type: 'drum',
                    color: 'drums',
                    volume: 0.85,
                    pan: 0,
                    muted: false,
                    solo: false,
                    armed: false,
                    order: 0,
                },
                {
                    id: uuid(),
                    projectId: project.id,
                    name: 'Bass',
                    type: 'midi',
                    color: 'bass',
                    volume: 0.8,
                    pan: 0,
                    muted: false,
                    solo: false,
                    armed: false,
                    order: 1,
                },
                {
                    id: uuid(),
                    projectId: project.id,
                    name: 'Keys',
                    type: 'midi',
                    color: 'keys',
                    volume: 0.75,
                    pan: 0,
                    muted: false,
                    solo: false,
                    armed: false,
                    order: 2,
                },
                {
                    id: uuid(),
                    projectId: project.id,
                    name: 'Melody',
                    type: 'midi',
                    color: 'melody',
                    volume: 0.7,
                    pan: 0,
                    muted: false,
                    solo: false,
                    armed: false,
                    order: 3,
                },
            ];
            project.tracks = defaultTracks;
        }

        set(() => ({
            project,
            hasUnsavedChanges: true,
            lastSaved: null,
        }));
        return project;
    },

    loadProject: (project) => {
        set(() => ({
            project,
            hasUnsavedChanges: false,
            lastSaved: Date.now(),
        }));
    },

    updateProject: (updates) => {
        set((state) => ({
            project: state.project
                ? { ...state.project, ...updates, updatedAt: Date.now() }
                : null,
            hasUnsavedChanges: true,
        }));
    },

    closeProject: () => {
        set(() => ({
            project: null,
            hasUnsavedChanges: false,
            lastSaved: null,
        }));
    },

    // Track operations
    addTrack: (type, name, color) => {
        const state = get();
        if (!state.project) throw new Error('No project loaded');

        const tracks = state.project.tracks;
        // Calculate next order as max existing order + 1 (handles gaps from deleted tracks)
        const maxOrder = tracks.length > 0 ? Math.max(...tracks.map(t => t.order)) : -1;
        const trackColor = color || getNextTrackColor(tracks);

        // Assign a default instrument preset based on track color
        const defaultPresetForColor: Record<string, string> = {
            drums: 'drum-sampler',
            bass: 'synth-bass',
            keys: 'electric-piano',
            melody: 'saw-lead',
            fx: 'warm-pad',
            vocals: 'basic-synth',
        };

        const newTrack: Track = {
            id: uuid(),
            projectId: state.project.id,
            name: name || `${type.charAt(0).toUpperCase() + type.slice(1)} ${tracks.length + 1}`,
            type,
            color: trackColor,
            volume: 0.8,
            pan: 0,
            muted: false,
            solo: false,
            armed: false,
            order: maxOrder + 1,
            instrumentPreset: defaultPresetForColor[trackColor] || 'basic-synth',
        };

        set((s) => ({
            project: s.project
                ? {
                    ...s.project,
                    tracks: [...s.project.tracks, newTrack],
                    updatedAt: Date.now(),
                }
                : null,
            hasUnsavedChanges: true,
        }));

        return newTrack;
    },

    updateTrack: (trackId, updates) => {
        set((state) => ({
            project: state.project
                ? {
                    ...state.project,
                    tracks: state.project.tracks.map((t) =>
                        t.id === trackId ? { ...t, ...updates } : t
                    ),
                    updatedAt: Date.now(),
                }
                : null,
            hasUnsavedChanges: true,
        }));
    },

    addTrackEffect: (trackId, type, presetId) => {
        set((state) => {
            if (!state.project) return {};

            // Helper to get default params for effect type
            const getDefaultParams = (type: TrackEffectType) => {
                switch (type) {
                    case 'reverb': return { decay: 1.5, preDelay: 0.01, wet: 0.5 };
                    case 'delay': return { delayTime: 0.25, feedback: 0.5, wet: 0.5 };
                    case 'distortion': return { distortion: 0.4, wet: 0.5 };
                    case 'filter': return { frequency: 1000, type: 'lowpass', Q: 1, wet: 1 };
                    case 'compression': return { threshold: -24, ratio: 12, attack: 0.003, release: 0.25 };
                    default: return {};
                }
            };

            return {
                project: {
                    ...state.project,
                    tracks: state.project.tracks.map((t) => {
                        if (t.id !== trackId) return t;
                        const effects = t.effects || [];
                        const newEffect: TrackEffect = {
                            id: uuid(),
                            type,
                            active: true,
                            presetId,
                            params: getDefaultParams(type)
                        };
                        return { ...t, effects: [...effects, newEffect] };
                    }),
                    updatedAt: Date.now(),
                },
                hasUnsavedChanges: true,
            };
        });
    },

    removeTrackEffect: (trackId, effectId) => {
        set((state) => ({
            project: state.project
                ? {
                    ...state.project,
                    tracks: state.project.tracks.map((t) => {
                        if (t.id !== trackId) return t;
                        return {
                            ...t,
                            effects: (t.effects || []).filter(e => e.id !== effectId)
                        };
                    }),
                    updatedAt: Date.now(),
                }
                : null,
            hasUnsavedChanges: true,
        }));
    },

    updateTrackEffect: (trackId, effectId, updates) => {
        set((state) => ({
            project: state.project
                ? {
                    ...state.project,
                    tracks: state.project.tracks.map((t) => {
                        if (t.id !== trackId) return t;
                        return {
                            ...t,
                            effects: (t.effects || []).map(e =>
                                e.id === effectId ? { ...e, ...updates } : e
                            )
                        };
                    }),
                    updatedAt: Date.now(),
                }
                : null,
            hasUnsavedChanges: true,
        }));
    },

    deleteTrack: (trackId) => {
        set((state) => ({
            project: state.project
                ? {
                    ...state.project,
                    tracks: state.project.tracks.filter((t) => t.id !== trackId),
                    clips: state.project.clips.filter((c) => c.trackId !== trackId),
                    updatedAt: Date.now(),
                }
                : null,
            hasUnsavedChanges: true,
        }));
    },

    reorderTracks: (trackIds) => {
        set((state) => ({
            project: state.project
                ? {
                    ...state.project,
                    tracks: trackIds
                        .map((id, index) => {
                            const track = state.project!.tracks.find((t) => t.id === id);
                            return track ? { ...track, order: index } : null;
                        })
                        .filter((t): t is Track => t !== null),
                    updatedAt: Date.now(),
                }
                : null,
            hasUnsavedChanges: true,
        }));
    },

    // Clip operations
    addClip: (trackId, type, startBar, lengthBars = 4) => {
        const state = get();
        if (!state.project) throw new Error('No project loaded');

        const newClip: Clip = {
            id: uuid(),
            trackId,
            type,
            name: `Clip ${state.project.clips.length + 1}`,
            startBar,
            lengthBars,
            notes: type === 'midi' || type === 'drum' ? [] : undefined,
            transpose: 0,
            humanize: 0,
            energy: 50,
            groove: 50,
            brightness: 50,
            space: 50,
        };

        set((s) => ({
            project: s.project
                ? {
                    ...s.project,
                    clips: [...s.project.clips, newClip],
                    updatedAt: Date.now(),
                }
                : null,
            hasUnsavedChanges: true,
        }));

        return newClip;
    },

    updateClip: (clipId, updates) => {
        set((state) => ({
            project: state.project
                ? {
                    ...state.project,
                    clips: state.project.clips.map((c) =>
                        c.id === clipId ? { ...c, ...updates } : c
                    ),
                    updatedAt: Date.now(),
                }
                : null,
            hasUnsavedChanges: true,
        }));
    },

    deleteClip: (clipId) => {
        set((state) => ({
            project: state.project
                ? {
                    ...state.project,
                    clips: state.project.clips.filter((c) => c.id !== clipId),
                    updatedAt: Date.now(),
                }
                : null,
            hasUnsavedChanges: true,
        }));
    },

    deleteClips: (clipIds) => {
        set((state) => ({
            project: state.project
                ? {
                    ...state.project,
                    clips: state.project.clips.filter((c) => !clipIds.includes(c.id)),
                    updatedAt: Date.now(),
                }
                : null,
            hasUnsavedChanges: true,
        }));
    },

    duplicateClip: (clipId, offsetBars = 0) => {
        const state = get();
        if (!state.project) return null;

        const original = state.project.clips.find((c) => c.id === clipId);
        if (!original) return null;

        const newClip: Clip = {
            ...original,
            id: uuid(),
            name: `${original.name} (copy)`,
            startBar: original.startBar + original.lengthBars + offsetBars,
            notes: original.notes ? original.notes.map((n) => ({ ...n, id: uuid() })) : undefined,
        };

        set((s) => ({
            project: s.project
                ? {
                    ...s.project,
                    clips: [...s.project.clips, newClip],
                    updatedAt: Date.now(),
                }
                : null,
            hasUnsavedChanges: true,
        }));

        return newClip;
    },

    moveClip: (clipId, newTrackId, newStartBar) => {
        set((state) => ({
            project: state.project
                ? {
                    ...state.project,
                    clips: state.project.clips.map((c) =>
                        c.id === clipId
                            ? { ...c, trackId: newTrackId, startBar: newStartBar }
                            : c
                    ),
                    updatedAt: Date.now(),
                }
                : null,
            hasUnsavedChanges: true,
        }));
    },

    moveClipsByDelta: (clipIds, deltaBars) => {
        if (clipIds.length === 0 || Math.abs(deltaBars) < 0.001) return;
        set((state) => ({
            project: state.project
                ? {
                    ...state.project,
                    clips: state.project.clips.map((c) =>
                        clipIds.includes(c.id)
                            ? { ...c, startBar: Math.max(0, c.startBar + deltaBars) }
                            : c
                    ),
                    updatedAt: Date.now(),
                }
                : null,
            hasUnsavedChanges: true,
        }));
    },

    resizeClip: (clipId, newLengthBars) => {
        set((state) => ({
            project: state.project
                ? {
                    ...state.project,
                    clips: state.project.clips.map((c) =>
                        c.id === clipId ? { ...c, lengthBars: Math.max(1, newLengthBars) } : c
                    ),
                    updatedAt: Date.now(),
                }
                : null,
            hasUnsavedChanges: true,
        }));
    },

    splitClip: (clipId, atBar) => {
        const state = get();
        if (!state.project) return null;

        const original = state.project.clips.find((c) => c.id === clipId);
        if (!original) return null;

        const splitPoint = atBar - original.startBar;
        if (splitPoint <= 0 || splitPoint >= original.lengthBars) return null;

        const firstClip: Clip = {
            ...original,
            lengthBars: splitPoint,
        };

        const secondClip: Clip = {
            ...original,
            id: uuid(),
            name: `${original.name} (split)`,
            startBar: atBar,
            lengthBars: original.lengthBars - splitPoint,
            notes: original.notes
                ?.filter((n) => n.startBeat >= splitPoint * 4) // 4 beats per bar
                .map((n) => ({
                    ...n,
                    id: uuid(),
                    startBeat: n.startBeat - splitPoint * 4,
                })),
        };

        // Filter notes for first clip
        if (firstClip.notes) {
            firstClip.notes = firstClip.notes.filter((n) => n.startBeat < splitPoint * 4);
        }

        set((s) => ({
            project: s.project
                ? {
                    ...s.project,
                    clips: [
                        ...s.project.clips.filter((c) => c.id !== clipId),
                        firstClip,
                        secondClip,
                    ],
                    updatedAt: Date.now(),
                }
                : null,
            hasUnsavedChanges: true,
        }));

        return [firstClip, secondClip];
    },

    // Note operations
    addNote: (clipId, noteData) => {
        const state = get();
        if (!state.project) return null;

        const clip = state.project.clips.find((c) => c.id === clipId);
        if (!clip || (clip.type !== 'midi' && clip.type !== 'drum')) return null;

        const newNote: Note = {
            id: uuid(),
            ...noteData,
        };

        set((s) => ({
            project: s.project
                ? {
                    ...s.project,
                    clips: s.project.clips.map((c) =>
                        c.id === clipId
                            ? { ...c, notes: [...(c.notes || []), newNote] }
                            : c
                    ),
                    updatedAt: Date.now(),
                }
                : null,
            hasUnsavedChanges: true,
        }));

        return newNote;
    },

    updateNote: (clipId, noteId, updates) => {
        set((state) => ({
            project: state.project
                ? {
                    ...state.project,
                    clips: state.project.clips.map((c) =>
                        c.id === clipId
                            ? {
                                ...c,
                                notes: c.notes?.map((n) =>
                                    n.id === noteId ? { ...n, ...updates } : n
                                ),
                            }
                            : c
                    ),
                    updatedAt: Date.now(),
                }
                : null,
            hasUnsavedChanges: true,
        }));
    },

    deleteNote: (clipId, noteId) => {
        set((state) => ({
            project: state.project
                ? {
                    ...state.project,
                    clips: state.project.clips.map((c) =>
                        c.id === clipId
                            ? { ...c, notes: c.notes?.filter((n) => n.id !== noteId) }
                            : c
                    ),
                    updatedAt: Date.now(),
                }
                : null,
            hasUnsavedChanges: true,
        }));
    },

    // Musical settings
    setBpm: (bpm) => {
        set((state) => ({
            project: state.project
                ? { ...state.project, bpm: Math.max(20, Math.min(300, bpm)), updatedAt: Date.now() }
                : null,
            hasUnsavedChanges: true,
        }));
    },

    setKey: (key) => {
        set((state) => ({
            project: state.project
                ? { ...state.project, key, updatedAt: Date.now() }
                : null,
            hasUnsavedChanges: true,
        }));
    },

    setScale: (scale) => {
        set((state) => ({
            project: state.project
                ? { ...state.project, scale, updatedAt: Date.now() }
                : null,
            hasUnsavedChanges: true,
        }));
    },

    setTimeSignature: (timeSignature) => {
        set((state) => ({
            project: state.project
                ? { ...state.project, timeSignature, updatedAt: Date.now() }
                : null,
            hasUnsavedChanges: true,
        }));
    },

    // Save state
    markSaved: () => {
        set(() => ({
            hasUnsavedChanges: false,
            lastSaved: Date.now(),
        }));
    },

    setLoading: (loading) => {
        set(() => ({ isLoading: loading }));
    },
});

// ============================================
// Create Store with Undo/Redo (zundo)
// ============================================

export const useProjectStore = create<ProjectStore>()(
    temporal(projectStoreBase, {
        // Only track project changes, not UI state
        partialize: (state) => ({
            project: state.project,
        }),
        // Limit history to 100 states
        limit: 100,
        // Equality check to avoid duplicate states
        equality: (pastState, currentState) =>
            JSON.stringify(pastState) === JSON.stringify(currentState),
    })
);

// ============================================
// Selectors
// ============================================

export const selectProject = (state: ProjectStore) => state.project;
export const selectTracks = (state: ProjectStore) => state.project?.tracks ?? [];
export const selectClips = (state: ProjectStore) => state.project?.clips ?? [];
export const selectBpm = (state: ProjectStore) => state.project?.bpm ?? DEFAULT_BPM;
export const selectKey = (state: ProjectStore) => state.project?.key ?? DEFAULT_KEY;
export const selectScale = (state: ProjectStore) => state.project?.scale ?? DEFAULT_SCALE;
export const selectHasUnsavedChanges = (state: ProjectStore) => state.hasUnsavedChanges;

export const selectTrackById = (trackId: string) => (state: ProjectStore) =>
    state.project?.tracks.find((t) => t.id === trackId);

export const selectClipById = (clipId: string) => (state: ProjectStore) =>
    state.project?.clips.find((c) => c.id === clipId);

export const selectClipsByTrack = (trackId: string) => (state: ProjectStore) =>
    state.project?.clips.filter((c) => c.trackId === trackId) ?? [];
