// ============================================
// ComposeYogi — UI Store
// Panel states, selection, and editor context
// ============================================

import { create } from 'zustand';
import { TYPING_OCTAVE_DEFAULT, clampTypingOctave } from '@/lib/music/typing-keys';
import type { EditorScope, InspectorSectionId, ModalType, SnapValue } from '@/types';
import type { KeyBindings } from '@/lib/shortcuts';

// ============================================
// Store Types
// ============================================

interface UIState {
    // Panel visibility
    browserOpen: boolean;
    inspectorOpen: boolean;
    editorOpen: boolean;
    visualizerOpen: boolean;

    // Active selections
    selectedTrackId: string | null;
    selectedClipIds: string[];

    // Active editor context
    activeEditorClipId: string | null;
    editorScope: EditorScope;
    editorFocused: boolean; // Whether editor panel has keyboard focus

    // Viewport
    zoom: number;          // pixels per bar
    scrollX: number;       // horizontal scroll in pixels
    scrollY: number;       // vertical scroll in pixels

    // Drag state
    isDragging: boolean;
    dragType: 'clip' | 'selection' | 'resize' | 'loop' | null;
    multiDragOffsetBars: number; // Shared offset for multi-clip drag visual feedback

    // Grid resolution for each surface. Two settings rather than one, because
    // the two are almost never the same: you place clips against bars in the
    // arrangement and draw sixteenths in the piano roll, and a shared value
    // would make one of the two views unusable every time you changed the other.
    timelineSnap: SnapValue;
    editorSnap: SnapValue;

    // Inspector sections the user has folded away. Absent means expanded, so
    // a new section is open until somebody closes it, and the stored shape
    // stays small.
    collapsedSections: Partial<Record<InspectorSectionId, boolean>>;

    // Modals
    activeModal: ModalType | null;

    // Mobile detection
    isMobile: boolean;

    // Velocity every newly drawn note gets, in both editors. An editor
    // preference rather than project data, so it lives here and not in the
    // project store — it is not part of the piece, it is part of how you work.
    defaultVelocity: number;

    // Live playing (Sprint 8.7.6). Open means the keyboard strip is on screen
    // *and* the letter keys play notes instead of running shortcuts — the two
    // cannot be separated, because `r`, `e`, `b`, `i`, `v` and `m` are each both
    // a note and a command, and there is no reading of a keypress that satisfies
    // both. Which shortcuts surrender is derived from the layout, not listed;
    // see `useShortcut`.
    livePlayOpen: boolean;
    // Which two octaves the typing rows cover. Clamped by `clampTypingOctave`
    // to the range the piano roll can draw, so nothing is ever played that the
    // editor then cannot show.
    livePlayOctave: number;

    // Custom keyboard shortcut bindings
    customKeyBindings: KeyBindings;
    keyBindingsLoaded: boolean;
}

interface UIActions {
    // Panel toggles
    toggleBrowser: () => void;
    toggleInspector: () => void;
    toggleEditor: () => void;
    toggleVisualizer: () => void;
    openEditor: (clipId: string) => void;
    closeEditor: () => void;

    // Selection
    selectTrack: (trackId: string | null) => void;
    selectClip: (clipId: string, addToSelection?: boolean) => void;
    selectClips: (clipIds: string[]) => void;
    clearSelection: () => void;
    selectAll: () => void;

    // Editor scope
    setEditorScope: (scope: EditorScope) => void;
    toggleSection: (section: InspectorSectionId) => void;
    setTimelineSnap: (snap: SnapValue) => void;
    setEditorSnap: (snap: SnapValue) => void;
    setEditorFocused: (focused: boolean) => void;
    setDefaultVelocity: (velocity: number) => void;

    // Live playing
    toggleLivePlay: () => void;
    setLivePlayOpen: (open: boolean) => void;
    setLivePlayOctave: (octave: number) => void;
    shiftLivePlayOctave: (delta: number) => void;

    // Viewport
    setZoom: (zoom: number) => void;
    zoomIn: () => void;
    zoomOut: () => void;
    setScrollX: (x: number) => void;
    setScrollY: (y: number) => void;

    // Drag state
    startDrag: (type: 'clip' | 'selection' | 'resize' | 'loop') => void;
    endDrag: () => void;
    setMultiDragOffset: (offsetBars: number) => void;

    // Modals
    openModal: (modal: ModalType) => void;
    closeModal: () => void;

    // Mobile
    setIsMobile: (isMobile: boolean) => void;

    // Keyboard shortcuts
    setCustomKeyBindings: (bindings: KeyBindings) => void;
    updateKeyBinding: (actionId: string, hotkeyStr: string) => void;
    resetKeyBinding: (actionId: string) => void;
    resetAllKeyBindings: () => void;
    setKeyBindingsLoaded: (loaded: boolean) => void;
}

type UIStore = UIState & UIActions;

// ============================================
// Constants
// ============================================

const MIN_ZOOM = 20;   // pixels per bar (zoomed out)
const MAX_ZOOM = 200;  // pixels per bar (zoomed in)
const DEFAULT_ZOOM = 80;
const ZOOM_STEP = 1.2;

// ============================================
// Store Implementation
// ============================================

export const useUIStore = create<UIStore>((set) => ({
    // Initial state
    browserOpen: true,
    inspectorOpen: true,
    editorOpen: false,
    visualizerOpen: true,
    selectedTrackId: null,
    selectedClipIds: [],
    activeEditorClipId: null,
    editorScope: 'arrangement',
    editorFocused: false,
    zoom: DEFAULT_ZOOM,
    scrollX: 0,
    scrollY: 0,
    isDragging: false,
    dragType: null,
    multiDragOffsetBars: 0,
    // One beat in the arrangement and a sixteenth in the editor: the values
    // both surfaces were hard-coded to before either had a control.
    timelineSnap: '1/4',
    editorSnap: '1/16',
    collapsedSections: {},
    activeModal: null,
    isMobile: false,
    defaultVelocity: 100,
    livePlayOpen: false,
    livePlayOctave: TYPING_OCTAVE_DEFAULT,
    customKeyBindings: {},
    keyBindingsLoaded: false,

    // Derived state lives in the selectors at the bottom of this file, never in
    // a getter on the store object. Zustand merges an update with
    // `Object.assign({}, state, partial)`, which *invokes* a getter and copies
    // the value it returned — so from the first set() onwards the property is a
    // frozen snapshot of the state before that update, and never changes again.
    // `selectedClipId` was one of these, which is why selecting a clip never
    // opened the Inspector's clip panel.

    // Panel toggles
    toggleBrowser: () => {
        set((state) => ({ browserOpen: !state.browserOpen }));
    },

    toggleInspector: () => {
        set((state) => ({ inspectorOpen: !state.inspectorOpen }));
    },

    toggleEditor: () => {
        set((state) => ({ editorOpen: !state.editorOpen }));
    },

    toggleVisualizer: () => {
        set((state) => ({ visualizerOpen: !state.visualizerOpen }));
    },

    openEditor: (clipId) => {
        set({
            editorOpen: true,
            activeEditorClipId: clipId,
            selectedClipIds: [clipId],
        });
    },

    closeEditor: () => {
        set({
            editorOpen: false,
            activeEditorClipId: null,
            editorScope: 'arrangement',
        });
    },

    // Selection
    selectTrack: (trackId) => {
        set({ selectedTrackId: trackId });
    },

    selectClip: (clipId, addToSelection = false) => {
        set((state) => {
            if (addToSelection) {
                // Toggle selection if already selected
                if (state.selectedClipIds.includes(clipId)) {
                    return {
                        selectedClipIds: state.selectedClipIds.filter((id) => id !== clipId),
                    };
                }
                return {
                    selectedClipIds: [...state.selectedClipIds, clipId],
                };
            }
            return {
                selectedClipIds: [clipId],
            };
        });
    },

    selectClips: (clipIds) => {
        set({ selectedClipIds: clipIds });
    },

    clearSelection: () => {
        set({
            selectedClipIds: [],
            selectedTrackId: null,
        });
    },

    selectAll: () => {
        // This will be connected to project store
        // For now, just a placeholder
    },

    // Editor scope
    toggleSection: (section) => {
        set((state) => ({
            collapsedSections: {
                ...state.collapsedSections,
                [section]: !state.collapsedSections[section],
            },
        }));
    },

    setTimelineSnap: (snap) => {
        set({ timelineSnap: snap });
    },

    setEditorSnap: (snap) => {
        set({ editorSnap: snap });
    },

    setEditorScope: (scope) => {
        set({ editorScope: scope });
    },

    setEditorFocused: (focused) => {
        set({ editorFocused: focused });
    },

    setDefaultVelocity: (velocity) => {
        set({ defaultVelocity: Math.max(1, Math.min(127, Math.round(velocity))) });
    },

    // ========================================
    // Live playing
    // ========================================

    toggleLivePlay: () => {
        set((state) => ({ livePlayOpen: !state.livePlayOpen }));
    },

    setLivePlayOpen: (open) => {
        set({ livePlayOpen: open });
    },

    setLivePlayOctave: (octave) => {
        set({ livePlayOctave: clampTypingOctave(octave) });
    },

    shiftLivePlayOctave: (delta) => {
        set((state) => ({ livePlayOctave: clampTypingOctave(state.livePlayOctave + delta) }));
    },

    // Viewport
    setZoom: (zoom) => {
        set({ zoom: Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom)) });
    },

    zoomIn: () => {
        set((state) => ({
            zoom: Math.min(MAX_ZOOM, state.zoom * ZOOM_STEP),
        }));
    },

    zoomOut: () => {
        set((state) => ({
            zoom: Math.max(MIN_ZOOM, state.zoom / ZOOM_STEP),
        }));
    },

    setScrollX: (x) => {
        set({ scrollX: Math.max(0, x) });
    },

    setScrollY: (y) => {
        set({ scrollY: Math.max(0, y) });
    },

    // Drag state
    startDrag: (type) => {
        set({ isDragging: true, dragType: type });
    },

    endDrag: () => {
        set({ isDragging: false, dragType: null, multiDragOffsetBars: 0 });
    },

    setMultiDragOffset: (offsetBars) => {
        set({ multiDragOffsetBars: offsetBars });
    },

    // Modals
    openModal: (modal) => {
        set({ activeModal: modal });
    },

    closeModal: () => {
        set({ activeModal: null });
    },

    // Mobile
    setIsMobile: (isMobile) => {
        set({ isMobile });
    },

    // Keyboard shortcuts
    setCustomKeyBindings: (bindings) => {
        set({ customKeyBindings: bindings, keyBindingsLoaded: true });
    },

    updateKeyBinding: (actionId, hotkeyStr) => {
        set((state) => ({
            customKeyBindings: { ...state.customKeyBindings, [actionId]: hotkeyStr },
        }));
    },

    resetKeyBinding: (actionId) => {
        set((state) => {
            const next = { ...state.customKeyBindings };
            delete next[actionId];
            return { customKeyBindings: next };
        });
    },

    resetAllKeyBindings: () => {
        set({ customKeyBindings: {} });
    },

    setKeyBindingsLoaded: (loaded) => {
        set({ keyBindingsLoaded: loaded });
    },
}));

// ============================================
// Selectors
// ============================================

export const selectBrowserOpen = (state: UIStore) => state.browserOpen;
export const selectInspectorOpen = (state: UIStore) => state.inspectorOpen;
export const selectEditorOpen = (state: UIStore) => state.editorOpen;
export const selectSelectedClipIds = (state: UIStore) => state.selectedClipIds;
export const selectSelectedTrackId = (state: UIStore) => state.selectedTrackId;
export const selectActiveEditorClipId = (state: UIStore) => state.activeEditorClipId;
export const selectEditorScope = (state: UIStore) => state.editorScope;
export const selectCollapsedSections = (state: UIStore) => state.collapsedSections;
export const selectTimelineSnap = (state: UIStore) => state.timelineSnap;
export const selectEditorSnap = (state: UIStore) => state.editorSnap;
export const selectZoom = (state: UIStore) => state.zoom;
export const selectIsDragging = (state: UIStore) => state.isDragging;
export const selectActiveModal = (state: UIStore) => state.activeModal;
export const selectIsMobile = (state: UIStore) => state.isMobile;
export const selectDefaultVelocity = (state: UIStore) => state.defaultVelocity;
export const selectLivePlayOpen = (state: UIStore) => state.livePlayOpen;
export const selectLivePlayOctave = (state: UIStore) => state.livePlayOctave;
export const selectCustomKeyBindings = (state: UIStore) => state.customKeyBindings;
export const selectKeyBindingsLoaded = (state: UIStore) => state.keyBindingsLoaded;

// Derived selectors
export const selectSelectedClipId = (state: UIStore) => state.selectedClipIds[0] ?? null;
export const selectHasSelection = (state: UIStore) => state.selectedClipIds.length > 0;
export const selectIsMultiSelect = (state: UIStore) => state.selectedClipIds.length > 1;
