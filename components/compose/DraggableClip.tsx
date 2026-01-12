// ============================================
// ComposeYogi — Draggable Clip Component
// Individual clip with drag, select, resize
// ============================================

'use client';

import { useRef, useCallback, useEffect, useState, useMemo } from 'react';
import { useProjectStore, useUIStore } from '@/lib/store';
import { getAudioTake, audioEngine } from '@/lib/audio';
import { AudioClip } from './AudioClip';
import type { Clip, Track, TrackColor } from '@/types';

const TRACK_HEIGHT = 80;
const RESIZE_HANDLE_WIDTH = 8; // Width of resize handle zone
const MIN_CLIP_BARS = 0.25; // Minimum clip length (1 beat in 4/4)

const TRACK_COLORS: Record<TrackColor, string> = {
    drums: 'bg-track-drums',
    bass: 'bg-track-bass',
    keys: 'bg-track-keys',
    melody: 'bg-track-melody',
    vocals: 'bg-track-vocals',
    fx: 'bg-track-fx',
};

type DragMode = 'move' | 'resize-left' | 'resize-right' | null;

interface DraggableClipProps {
    clip: Clip;
    track: Track;
    pixelsPerBeat: number;
    beatsPerBar: number;
}

export function DraggableClip({ clip, track, pixelsPerBeat, beatsPerBar }: DraggableClipProps) {
    const updateClip = useProjectStore((s) => s.updateClip);
    const resizeClip = useProjectStore((s) => s.resizeClip);
    const duplicateClip = useProjectStore((s) => s.duplicateClip);
    const moveClipsByDelta = useProjectStore((s) => s.moveClipsByDelta);
    const selectedClipIds = useUIStore((s) => s.selectedClipIds);
    const selectClip = useUIStore((s) => s.selectClip);
    const openEditor = useUIStore((s) => s.openEditor);
    const multiDragOffsetBars = useUIStore((s) => s.multiDragOffsetBars);
    const setMultiDragOffset = useUIStore((s) => s.setMultiDragOffset);

    const [dragMode, setDragMode] = useState<DragMode>(null);
    const [dragOffset, setDragOffset] = useState(0);
    const [resizeOffset, setResizeOffset] = useState(0);
    const [isHovered, setIsHovered] = useState(false);
    const [isDuplicating, setIsDuplicating] = useState(false);
    const [isLeadingDrag, setIsLeadingDrag] = useState(false); // This clip initiated the multi-drag

    const dragStartRef = useRef<{
        x: number;
        originalBar: number;
        originalLength: number;
        altKeyHeld: boolean;
    } | null>(null);

    const isSelected = selectedClipIds.includes(clip.id);
    const pixelsPerBar = pixelsPerBeat * beatsPerBar;
    const isInMultiDrag = isSelected && multiDragOffsetBars !== 0 && !isLeadingDrag;

    // For audio clips, get the source audio duration (in seconds and bars)
    const audioSourceInfo = useMemo(() => {
        if (clip.type !== 'audio' || !clip.activeTakeId) return null;
        const take = getAudioTake(clip.activeTakeId);
        if (!take) return null;
        const sourceDurationSec = take.duration;
        const sourceDurationBars = audioEngine.secondsToBar(sourceDurationSec);
        return {
            durationSec: sourceDurationSec,
            durationBars: sourceDurationBars,
        };
    }, [clip.type, clip.activeTakeId]);

    // Calculate position and size with drag/resize offsets
    const _startBeat = clip.startBar * beatsPerBar;
    const _durationBeats = clip.lengthBars * beatsPerBar;

    // Apply resize offset to calculate visual dimensions
    let visualStartBar = clip.startBar;
    let visualLengthBars = clip.lengthBars;
    let ghostStartBar: number | null = null; // Position for duplicate ghost

    if (dragMode === 'move') {
        if (isDuplicating) {
            // Keep original in place, ghost shows at new position
            ghostStartBar = clip.startBar + dragOffset / pixelsPerBar;
        } else {
            visualStartBar = clip.startBar + dragOffset / pixelsPerBar;
        }
    } else if (isInMultiDrag) {
        // This clip is part of a multi-select being dragged by another clip
        visualStartBar = clip.startBar + multiDragOffsetBars;
    } else if (dragMode === 'resize-left') {
        const deltaBars = resizeOffset / pixelsPerBar;
        visualStartBar = Math.max(0, clip.startBar + deltaBars);
        visualLengthBars = Math.max(MIN_CLIP_BARS, clip.lengthBars - deltaBars);
    } else if (dragMode === 'resize-right') {
        visualLengthBars = Math.max(MIN_CLIP_BARS, clip.lengthBars + resizeOffset / pixelsPerBar);
    }

    const clipWidth = Math.max(visualLengthBars * pixelsPerBar, 40);
    const clipHeight = TRACK_HEIGHT - 8;
    const clipLeft = visualStartBar * pixelsPerBar;
    const ghostLeft = ghostStartBar !== null ? ghostStartBar * pixelsPerBar : null;

    // Handle click - selection is handled in mouseDown, this just stops propagation
    const handleClick = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        // Selection handled in handleMouseDown to support Shift+click
    }, []);

    // Handle double-click to open editor
    const handleDoubleClick = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        openEditor(clip.id);
    }, [clip.id, openEditor]);

    // Determine drag mode based on click position
    const getDragMode = useCallback((e: React.MouseEvent): DragMode => {
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;

        if (x <= RESIZE_HANDLE_WIDTH) {
            return 'resize-left';
        } else if (x >= rect.width - RESIZE_HANDLE_WIDTH) {
            return 'resize-right';
        }
        return 'move';
    }, []);

    // Handle mouse down - start drag or resize
    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault(); // Prevent any default browser behavior

        // Selection logic:
        // - Shift+click: toggle in/out of selection
        // - Click on unselected clip: select only this clip
        // - Click on already selected clip: keep current selection (for multi-drag)
        if (e.shiftKey) {
            selectClip(clip.id, true); // Add/remove from selection
        } else if (!selectedClipIds.includes(clip.id)) {
            selectClip(clip.id, false); // Replace selection with this clip
        }
        // If already selected and not shift-clicking, keep current selection

        const mode = getDragMode(e);
        const altKeyHeld = e.altKey && mode === 'move'; // Alt+drag only for move, not resize
        const _isMultiSelect = selectedClipIds.length > 1 || (selectedClipIds.length === 1 && !selectedClipIds.includes(clip.id));

        dragStartRef.current = {
            x: e.clientX,
            originalBar: clip.startBar,
            originalLength: clip.lengthBars,
            altKeyHeld,
        };
        setDragMode(mode);
        setIsDuplicating(altKeyHeld);

        // Mark this clip as the one leading the multi-drag
        if (mode === 'move' && selectedClipIds.includes(clip.id) && selectedClipIds.length > 1) {
            setIsLeadingDrag(true);
        }
    }, [clip.id, clip.startBar, clip.lengthBars, selectClip, getDragMode, selectedClipIds]);

    // Handle drag/resize move and end
    useEffect(() => {
        if (!dragMode) return;

        const handleMouseMove = (e: MouseEvent) => {
            if (!dragStartRef.current) return;

            const deltaX = e.clientX - dragStartRef.current.x;
            const snapUnit = 1 / beatsPerBar; // Snap to beats

            if (dragMode === 'move') {
                const deltaBars = deltaX / pixelsPerBar;
                const snappedDeltaBars = Math.round(deltaBars / snapUnit) * snapUnit;
                const newStartBar = Math.max(0, dragStartRef.current.originalBar + snappedDeltaBars);
                const actualDelta = newStartBar - dragStartRef.current.originalBar;
                setDragOffset(actualDelta * pixelsPerBar);

                // Broadcast offset to other selected clips for visual feedback
                if (isLeadingDrag && selectedClipIds.length > 1) {
                    setMultiDragOffset(actualDelta);
                }
            } else if (dragMode === 'resize-left') {
                const deltaBars = deltaX / pixelsPerBar;
                const snappedDeltaBars = Math.round(deltaBars / snapUnit) * snapUnit;

                // For audio clips, clamp to source audio bounds
                let maxExpandLeft = dragStartRef.current.originalBar; // Can't go before bar 0
                if (audioSourceInfo) {
                    // Can only expand left by the amount of trimStart available
                    const currentTrimStartBars = audioEngine.secondsToBar(clip.trimStart || 0);
                    maxExpandLeft = Math.min(maxExpandLeft, currentTrimStartBars);
                }

                const maxShrink = dragStartRef.current.originalLength - MIN_CLIP_BARS;
                const clampedDelta = Math.max(-maxExpandLeft, Math.min(maxShrink, snappedDeltaBars));
                setResizeOffset(clampedDelta * pixelsPerBar);
            } else if (dragMode === 'resize-right') {
                const deltaBars = deltaX / pixelsPerBar;
                const snappedDeltaBars = Math.round(deltaBars / snapUnit) * snapUnit;

                // For audio clips, clamp to source audio bounds
                let maxExpandRight = Infinity;
                if (audioSourceInfo) {
                    // Can only expand right by the amount of trimEnd available
                    const currentTrimEndBars = audioEngine.secondsToBar(clip.trimEnd || 0);
                    maxExpandRight = currentTrimEndBars;
                }

                const minDelta = MIN_CLIP_BARS - dragStartRef.current.originalLength;
                const clampedDelta = Math.max(minDelta, Math.min(maxExpandRight, snappedDeltaBars));
                setResizeOffset(clampedDelta * pixelsPerBar);
            }
        };

        const handleMouseUp = () => {
            if (dragStartRef.current) {
                if (dragMode === 'move') {
                    const deltaBars = dragOffset / pixelsPerBar;
                    if (Math.abs(deltaBars) > 0.001) {
                        if (dragStartRef.current.altKeyHeld) {
                            // Alt+drag: duplicate clip at new position
                            const newStartBar = Math.max(0, dragStartRef.current.originalBar + deltaBars);
                            const newClip = duplicateClip(clip.id, 0);
                            if (newClip) {
                                // Move the duplicate to the drop position
                                updateClip(newClip.id, { startBar: newStartBar });
                                selectClip(newClip.id);
                            }
                        } else if (selectedClipIds.length > 1 && selectedClipIds.includes(clip.id)) {
                            // Multi-select drag: move all selected clips by delta
                            moveClipsByDelta(selectedClipIds, deltaBars);
                        } else {
                            // Single clip drag: move just this clip
                            const newStartBar = Math.max(0, dragStartRef.current.originalBar + deltaBars);
                            updateClip(clip.id, { startBar: newStartBar });
                        }
                    }
                } else if (dragMode === 'resize-left') {
                    const deltaBars = resizeOffset / pixelsPerBar;
                    if (Math.abs(deltaBars) > 0.001) {
                        const newStartBar = Math.max(0, dragStartRef.current.originalBar + deltaBars);
                        const newLength = Math.max(MIN_CLIP_BARS, dragStartRef.current.originalLength - deltaBars);

                        if (audioSourceInfo) {
                            // Audio clip: adjust trimStart instead of just lengthBars
                            const deltaSeconds = audioEngine.barToSeconds(deltaBars);
                            const currentTrimStart = clip.trimStart || 0;
                            const newTrimStart = Math.max(0, currentTrimStart + deltaSeconds);

                            updateClip(clip.id, {
                                startBar: newStartBar,
                                lengthBars: newLength,
                                trimStart: newTrimStart,
                            });
                        } else {
                            // MIDI/Drum clip: just resize
                            updateClip(clip.id, { startBar: newStartBar, lengthBars: newLength });
                        }
                    }
                } else if (dragMode === 'resize-right') {
                    const deltaBars = resizeOffset / pixelsPerBar;
                    const newLength = Math.max(MIN_CLIP_BARS, dragStartRef.current.originalLength + deltaBars);
                    if (Math.abs(newLength - dragStartRef.current.originalLength) > 0.001) {
                        if (audioSourceInfo) {
                            // Audio clip: adjust trimEnd instead of just lengthBars
                            const deltaSeconds = audioEngine.barToSeconds(deltaBars);
                            const currentTrimEnd = clip.trimEnd || 0;
                            // Expanding right means reducing trimEnd, shrinking means increasing it
                            const newTrimEnd = Math.max(0, currentTrimEnd - deltaSeconds);

                            updateClip(clip.id, {
                                lengthBars: newLength,
                                trimEnd: newTrimEnd,
                            });
                        } else {
                            // MIDI/Drum clip: just resize
                            resizeClip(clip.id, newLength);
                        }
                    }
                }
            }

            dragStartRef.current = null;
            setDragMode(null);
            setDragOffset(0);
            setResizeOffset(0);
            setIsDuplicating(false);
            setIsLeadingDrag(false);
            setMultiDragOffset(0); // Clear shared offset
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [dragMode, dragOffset, resizeOffset, pixelsPerBar, beatsPerBar, clip.id, clip.trimStart, clip.trimEnd, updateClip, resizeClip, duplicateClip, selectClip, selectedClipIds, moveClipsByDelta, isLeadingDrag, setMultiDragOffset, audioSourceInfo]);

    // Get cursor style based on hover position
    const getCursorStyle = useCallback((e: React.MouseEvent): string => {
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;

        if (x <= RESIZE_HANDLE_WIDTH || x >= rect.width - RESIZE_HANDLE_WIDTH) {
            return 'ew-resize';
        }
        return dragMode ? 'grabbing' : 'grab';
    }, [dragMode]);

    const [cursorStyle, setCursorStyle] = useState('grab');

    const handleMouseMove = useCallback((e: React.MouseEvent) => {
        if (!dragMode) {
            setCursorStyle(getCursorStyle(e));
        }
    }, [dragMode, getCursorStyle]);

    return (
        <>
            {/* Ghost duplicate preview during Alt+drag */}
            {isDuplicating && ghostLeft !== null && (
                <div
                    className={`clip ${TRACK_COLORS[track.color] || 'bg-accent'} pointer-events-none`}
                    style={{
                        left: ghostLeft,
                        width: clipWidth,
                        top: 4,
                        height: clipHeight,
                        zIndex: 99,
                        opacity: 0.6,
                    }}
                >
                    {/* Duplication indicator on ghost */}
                    <div className="absolute -top-5 left-1/2 -translate-x-1/2 rounded bg-white/90 px-1.5 py-0.5 text-2xs font-medium text-gray-800 shadow-sm">
                        + Copy
                    </div>
                    <div className="flex h-full flex-col p-1 px-2">
                        <span className="truncate text-2xs font-medium text-white/90">
                            {clip.name}
                        </span>
                    </div>
                </div>
            )}

            {/* Original clip */}
            <div
                className={`clip ${TRACK_COLORS[track.color] || 'bg-accent'} ${isSelected ? 'selected' : ''} ${dragMode && !isDuplicating ? 'opacity-90' : ''}`}
                style={{
                    left: clipLeft,
                    width: clipWidth,
                    top: 4,
                    height: clipHeight,
                    zIndex: dragMode ? 100 : isSelected ? 10 : 1,
                    cursor: isDuplicating ? 'copy' : dragMode === 'move' ? 'grabbing' : dragMode ? 'ew-resize' : cursorStyle,
                }}
                onClick={handleClick}
                onDoubleClick={handleDoubleClick}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
            >
                {/* Left resize handle - visible on hover/select */}
                <div
                    className={`absolute left-0 top-0 bottom-0 w-2 transition-opacity ${isHovered || isSelected ? 'opacity-100' : 'opacity-0'
                        }`}
                    style={{ cursor: 'ew-resize' }}
                >
                    <div className="absolute inset-y-1 left-0.5 w-0.5 rounded-full bg-white/50" />
                </div>

                {/* Right resize handle - visible on hover/select */}
                <div
                    className={`absolute right-0 top-0 bottom-0 w-2 transition-opacity ${isHovered || isSelected ? 'opacity-100' : 'opacity-0'
                        }`}
                    style={{ cursor: 'ew-resize' }}
                >
                    <div className="absolute inset-y-1 right-0.5 w-0.5 rounded-full bg-white/50" />
                </div>

                {/* Clip content */}
                {clip.type === 'audio' && clip.activeTakeId ? (
                    <AudioClip
                        clip={clip}
                        track={track}
                        width={clipWidth}
                        height={clipHeight}
                        color="rgba(255, 255, 255, 0.7)"
                        trimStart={clip.trimStart}
                        trimEnd={clip.trimEnd}
                        fadeIn={clip.fadeIn}
                        fadeOut={clip.fadeOut}
                    />
                ) : (
                    <div className="flex h-full flex-col p-1 px-2">
                        <span className="truncate text-2xs font-medium text-white/90">
                            {clip.name}
                        </span>
                        {/* MIDI/Drum pattern preview would go here */}
                    </div>
                )}
            </div>
        </>
    );
}
