// ============================================
// ComposeYogi — UI Store
// Panel states, selection, and editor context
// ============================================

import { create } from 'zustand';
import type { EditorScope, ModalType } from '@/types';

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

    // Viewport
    zoom: number;          // pixels per bar
    scrollX: number;       // horizontal scroll in pixels
    scrollY: number;       // vertical scroll in pixels

    // Drag state
    isDragging: boolean;
    dragType: 'clip' | 'selection' | 'resize' | 'loop' | null;
    multiDragOffsetBars: number; // Shared offset for multi-clip drag visual feedback

    // Modals
    activeModal: ModalType | null;

    // Mobile detection
    isMobile: boolean;
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
}

// Computed getters (read-only properties derived from state)
interface UIComputed {
    readonly showBrowser: boolean;
    readonly showInspector: boolean;
    readonly showEditor: boolean;
    readonly showVisualizer: boolean;
    readonly selectedClipId: string | null;
    readonly scrollPosition: { x: number; y: number };
}

type UIStore = UIState & UIActions & UIComputed;

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

export const useUIStore = create<UIStore>((set, get) => ({
    // Initial state
    browserOpen: true,
    inspectorOpen: true,
    editorOpen: false,
    visualizerOpen: true,
    selectedTrackId: null,
    selectedClipIds: [],
    activeEditorClipId: null,
    editorScope: 'arrangement',
    zoom: DEFAULT_ZOOM,
    scrollX: 0,
    scrollY: 0,
    isDragging: false,
    dragType: null,
    multiDragOffsetBars: 0,
    activeModal: null,
    isMobile: false,

    // Computed getters for component compatibility
    get showBrowser() {
        return get().browserOpen;
    },
    get showInspector() {
        return get().inspectorOpen;
    },
    get showEditor() {
        return get().editorOpen;
    },
    get showVisualizer() {
        return get().visualizerOpen;
    },
    get selectedClipId() {
        return get().selectedClipIds[0] || null;
    },
    get scrollPosition() {
        return { x: get().scrollX, y: get().scrollY };
    },

    // Setter for scroll position
    setScrollPosition: ({ x, y }: { x: number; y: number }) => {
        set({ scrollX: Math.max(0, x), scrollY: Math.max(0, y) });
    },

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
    setEditorScope: (scope) => {
        set({ editorScope: scope });
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
export const selectZoom = (state: UIStore) => state.zoom;
export const selectIsDragging = (state: UIStore) => state.isDragging;
export const selectActiveModal = (state: UIStore) => state.activeModal;
export const selectIsMobile = (state: UIStore) => state.isMobile;

// Derived selectors
export const selectHasSelection = (state: UIStore) => state.selectedClipIds.length > 0;
export const selectIsMultiSelect = (state: UIStore) => state.selectedClipIds.length > 1;
