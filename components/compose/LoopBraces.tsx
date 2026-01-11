// ============================================
// ComposeYogi — Loop Braces Component
// Draggable loop region markers on the ruler
// ============================================

'use client';

import { useCallback, useState, useEffect, useRef } from 'react';
import { usePlaybackStore } from '@/lib/store';

const HANDLE_WIDTH = 8; // Width of drag handles
const MIN_LOOP_BARS = 1; // Minimum loop length

type DragMode = 'left' | 'right' | 'move' | null;

interface LoopBracesProps {
    pixelsPerBar: number;
    rulerHeight: number;
}

export function LoopBraces({ pixelsPerBar, rulerHeight }: LoopBracesProps) {
    const loopEnabled = usePlaybackStore((s) => s.loopEnabled);
    const loopStartBar = usePlaybackStore((s) => s.loopStartBar);
    const loopEndBar = usePlaybackStore((s) => s.loopEndBar);
    const setLoopRegion = usePlaybackStore((s) => s.setLoopRegion);
    const toggleLoop = usePlaybackStore((s) => s.toggleLoop);

    const [dragMode, setDragMode] = useState<DragMode>(null);
    const [dragOffset, setDragOffset] = useState({ start: 0, end: 0 });

    const dragStartRef = useRef<{
        x: number;
        originalStart: number;
        originalEnd: number;
    } | null>(null);

    // Visual positions (with drag offset applied)
    const visualStart = loopStartBar + dragOffset.start;
    const visualEnd = loopEndBar + dragOffset.end;

    const leftPos = visualStart * pixelsPerBar;
    const rightPos = visualEnd * pixelsPerBar;
    const width = rightPos - leftPos;

    // Handle mouse down on left handle
    const handleLeftMouseDown = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        dragStartRef.current = {
            x: e.clientX,
            originalStart: loopStartBar,
            originalEnd: loopEndBar,
        };
        setDragMode('left');
    }, [loopStartBar, loopEndBar]);

    // Handle mouse down on right handle
    const handleRightMouseDown = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        dragStartRef.current = {
            x: e.clientX,
            originalStart: loopStartBar,
            originalEnd: loopEndBar,
        };
        setDragMode('right');
    }, [loopStartBar, loopEndBar]);

    // Handle mouse down on middle (move entire region)
    const handleMiddleMouseDown = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        dragStartRef.current = {
            x: e.clientX,
            originalStart: loopStartBar,
            originalEnd: loopEndBar,
        };
        setDragMode('move');
    }, [loopStartBar, loopEndBar]);

    // Double-click to toggle loop
    const handleDoubleClick = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        toggleLoop();
    }, [toggleLoop]);

    // Handle drag
    useEffect(() => {
        if (!dragMode) return;

        const handleMouseMove = (e: MouseEvent) => {
            if (!dragStartRef.current) return;

            const deltaX = e.clientX - dragStartRef.current.x;
            const deltaBars = deltaX / pixelsPerBar;
            const snappedDelta = Math.round(deltaBars); // Snap to bars

            if (dragMode === 'left') {
                // Resize from left - can't go below 0 or past right handle
                const maxDelta = dragStartRef.current.originalEnd - dragStartRef.current.originalStart - MIN_LOOP_BARS;
                const minDelta = -dragStartRef.current.originalStart;
                const clampedDelta = Math.max(minDelta, Math.min(maxDelta, snappedDelta));
                setDragOffset({ start: clampedDelta, end: 0 });
            } else if (dragMode === 'right') {
                // Resize from right - maintain minimum length
                const minDelta = MIN_LOOP_BARS - (dragStartRef.current.originalEnd - dragStartRef.current.originalStart);
                const clampedDelta = Math.max(minDelta, snappedDelta);
                setDragOffset({ start: 0, end: clampedDelta });
            } else if (dragMode === 'move') {
                // Move entire region - can't go below 0
                const minDelta = -dragStartRef.current.originalStart;
                const clampedDelta = Math.max(minDelta, snappedDelta);
                setDragOffset({ start: clampedDelta, end: clampedDelta });
            }
        };

        const handleMouseUp = () => {
            if (dragStartRef.current) {
                // Only update if there was actual movement
                if (dragOffset.start !== 0 || dragOffset.end !== 0) {
                    const newStart = Math.max(0, dragStartRef.current.originalStart + dragOffset.start);
                    const newEnd = Math.max(newStart + MIN_LOOP_BARS, dragStartRef.current.originalEnd + dragOffset.end);
                    setLoopRegion(newStart, newEnd);
                }
            }

            dragStartRef.current = null;
            setDragMode(null);
            setDragOffset({ start: 0, end: 0 });
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [dragMode, dragOffset, pixelsPerBar, setLoopRegion]);

    return (
        <div
            className="absolute top-0 pointer-events-none"
            style={{
                left: leftPos,
                width: width,
                height: rulerHeight,
                zIndex: 15,
            }}
        >
            {/* Loop region background */}
            <div
                className={`absolute inset-0 pointer-events-auto cursor-grab ${loopEnabled ? 'bg-yellow-500/30' : 'bg-gray-500/20'
                    } ${dragMode === 'move' ? 'cursor-grabbing' : ''}`}
                onMouseDown={handleMiddleMouseDown}
                onDoubleClick={handleDoubleClick}
                title={loopEnabled ? 'Loop enabled (double-click to disable)' : 'Loop disabled (double-click to enable)'}
            />

            {/* Left bracket/handle */}
            <div
                className={`absolute left-0 top-0 bottom-0 pointer-events-auto cursor-ew-resize flex items-center justify-center ${loopEnabled ? 'bg-yellow-500' : 'bg-gray-500'
                    }`}
                style={{ width: HANDLE_WIDTH }}
                onMouseDown={handleLeftMouseDown}
            >
                <div className="w-0.5 h-3 bg-white/70 rounded-full" />
            </div>

            {/* Right bracket/handle */}
            <div
                className={`absolute right-0 top-0 bottom-0 pointer-events-auto cursor-ew-resize flex items-center justify-center ${loopEnabled ? 'bg-yellow-500' : 'bg-gray-500'
                    }`}
                style={{ width: HANDLE_WIDTH }}
                onMouseDown={handleRightMouseDown}
            >
                <div className="w-0.5 h-3 bg-white/70 rounded-full" />
            </div>

            {/* Loop region indicator line at bottom */}
            <div
                className={`absolute bottom-0 left-0 right-0 h-0.5 ${loopEnabled ? 'bg-yellow-500' : 'bg-gray-500'
                    }`}
            />
        </div>
    );
}
