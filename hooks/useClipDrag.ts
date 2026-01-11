// ============================================
// ComposeYogi — Clip Drag Hook
// Handles clip dragging with grid snapping
// ============================================

import { useState, useCallback } from 'react';
import { useProjectStore, useUIStore } from '@/lib/store';
import type { Clip } from '@/types';

interface DragState {
    clipId: string;
    startX: number;
    originalStartBar: number;
}

interface UseClipDragOptions {
    pixelsPerBeat: number;
    beatsPerBar: number;
    snapToGrid?: boolean;
    gridSize?: number; // in beats (1 = beat, 0.25 = 16th note)
}

export function useClipDrag(options: UseClipDragOptions) {
    const { pixelsPerBeat, beatsPerBar, snapToGrid = true, gridSize = 1 } = options;

    const [dragState, setDragState] = useState<DragState | null>(null);
    const [previewOffset, setPreviewOffset] = useState(0);

    const updateClip = useProjectStore((s) => s.updateClip);
    const scrollX = useUIStore((s) => s.scrollX);

    const pixelsPerBar = pixelsPerBeat * beatsPerBar;

    const handleDragStart = useCallback((clip: Clip, e: React.MouseEvent) => {
        e.stopPropagation();
        setDragState({
            clipId: clip.id,
            startX: e.clientX,
            originalStartBar: clip.startBar,
        });
        setPreviewOffset(0);
    }, []);

    const handleDragMove = useCallback((e: MouseEvent) => {
        if (!dragState) return;

        const deltaX = e.clientX - dragState.startX;
        const deltaBars = deltaX / pixelsPerBar;

        // Snap to grid
        let snappedDeltaBars = deltaBars;
        if (snapToGrid) {
            const gridBars = gridSize / beatsPerBar;
            snappedDeltaBars = Math.round(deltaBars / gridBars) * gridBars;
        }

        // Clamp to valid range (can't go negative)
        const newStartBar = Math.max(0, dragState.originalStartBar + snappedDeltaBars);
        const actualDelta = newStartBar - dragState.originalStartBar;

        setPreviewOffset(actualDelta * pixelsPerBar);
    }, [dragState, pixelsPerBar, beatsPerBar, snapToGrid, gridSize]);

    const handleDragEnd = useCallback(() => {
        if (!dragState) return;

        // Calculate final position
        const deltaBars = previewOffset / pixelsPerBar;
        const newStartBar = Math.max(0, dragState.originalStartBar + deltaBars);

        // Update the clip in the store
        if (newStartBar !== dragState.originalStartBar) {
            updateClip(dragState.clipId, { startBar: newStartBar });
        }

        setDragState(null);
        setPreviewOffset(0);
    }, [dragState, previewOffset, pixelsPerBar, updateClip]);

    const cancelDrag = useCallback(() => {
        setDragState(null);
        setPreviewOffset(0);
    }, []);

    return {
        isDragging: dragState !== null,
        draggingClipId: dragState?.clipId || null,
        previewOffset,
        handleDragStart,
        handleDragMove,
        handleDragEnd,
        cancelDrag,
    };
}
