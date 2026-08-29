'use client';

// ============================================
// ComposeYogi — Velocity Lane
// ============================================
//
// The strip under the piano roll where each note's velocity is a bar you can
// drag. The engine has always honoured velocity — scheduler.ts passes
// note.velocity / 127 into triggerAttackRelease — but nothing in the interface
// could set it, so every note played at the 100 the editors hardcode. A
// pattern with no dynamics is the single loudest tell that something was
// programmed rather than played.
//
// The drag writes nothing to the store until it ends. Velocity is part of
// clipNotesHash, so every write reschedules the clip: committing on each
// pointermove would rebuild the schedule a hundred times over one gesture and
// fill a hundred-deep undo history with a single drag. During the gesture the
// bars render from local state; on release one update per note lands, which is
// one undo entry and one reschedule.

import { useCallback, useMemo, useRef, useState } from 'react';

import { useProjectStore } from '@/lib/store';

import type { Clip, Note } from '@/types';

// ============================================
// Constants
// ============================================

/** Lane height in px. Also the drag distance that spans the full range. */
export const VELOCITY_LANE_HEIGHT = 72;

const MIN_VELOCITY = 1;
const MAX_VELOCITY = 127;

/** Arrow-key steps, matching the convention elsewhere: fine, then coarse. */
const STEP_FINE = 1;
const STEP_COARSE = 10;

const clampVelocity = (value: number) =>
    Math.max(MIN_VELOCITY, Math.min(MAX_VELOCITY, Math.round(value)));

// ============================================
// Component
// ============================================

interface VelocityLaneProps {
    clip: Clip;
    pixelsPerBeat: number;
    /** Content width, matched to the grid so bars line up with their notes. */
    width: number;
    /** Notes selected in the grid — dragging one of them moves them together. */
    selectedNoteIds: Set<string>;
    /** Width of the piano-key gutter, so the lane starts where the grid does. */
    gutterWidth: number;
    /** Set by the piano roll to mirror the grid's horizontal scroll. */
    scrollRef: React.RefObject<HTMLDivElement | null>;
    disabled?: boolean;
}

interface DragState {
    pointerId: number;
    startY: number;
    /** Velocity of every affected note when the gesture began. */
    base: Map<string, number>;
}

export function VelocityLane({
    clip,
    pixelsPerBeat,
    width,
    selectedNoteIds,
    gutterWidth,
    scrollRef,
    disabled = false,
}: VelocityLaneProps) {
    const updateNote = useProjectStore((s) => s.updateNote);

    const dragRef = useRef<DragState | null>(null);
    const [pending, setPending] = useState<Map<string, number> | null>(null);

    const notes = useMemo(() => clip.notes ?? [], [clip.notes]);

    /** The velocity to draw: the in-flight value while dragging, else the note's. */
    const shownVelocity = useCallback(
        (note: Note) => pending?.get(note.id) ?? note.velocity,
        [pending]
    );

    /** Dragging a note that is part of a selection moves the whole selection. */
    const affectedIds = useCallback(
        (noteId: string) =>
            selectedNoteIds.has(noteId) && selectedNoteIds.size > 1
                ? [...selectedNoteIds]
                : [noteId],
        [selectedNoteIds]
    );

    const commit = useCallback(
        (values: Map<string, number>) => {
            for (const [noteId, velocity] of values) {
                const note = notes.find((n) => n.id === noteId);
                if (note && note.velocity !== velocity) {
                    updateNote(clip.id, noteId, { velocity });
                }
            }
        },
        [clip.id, notes, updateNote]
    );

    // ============================================
    // Pointer drag — one path for mouse, touch and pen
    // ============================================

    const handlePointerDown = useCallback(
        (note: Note, event: React.PointerEvent<HTMLDivElement>) => {
            if (disabled) return;
            event.preventDefault();
            event.stopPropagation();
            // Throws if the pointer is already gone; the drag still works without
            // capture, it just stops tracking outside the element.
            try {
                event.currentTarget.setPointerCapture(event.pointerId);
            } catch {
                /* no active pointer to capture */
            }

            const ids = affectedIds(note.id);
            dragRef.current = {
                pointerId: event.pointerId,
                startY: event.clientY,
                base: new Map(
                    ids.map((id) => [id, notes.find((n) => n.id === id)?.velocity ?? MAX_VELOCITY])
                ),
            };
            setPending(new Map(dragRef.current.base));
        },
        [affectedIds, disabled, notes]
    );

    const handlePointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
        const drag = dragRef.current;
        if (!drag || drag.pointerId !== event.pointerId) return;

        // Up is louder. A full lane height of travel covers the full range.
        const delta = (drag.startY - event.clientY) * (MAX_VELOCITY / VELOCITY_LANE_HEIGHT);
        const next = new Map<string, number>();
        for (const [id, base] of drag.base) next.set(id, clampVelocity(base + delta));
        setPending(next);
    }, []);

    const endDrag = useCallback(
        (event: React.PointerEvent<HTMLDivElement>) => {
            const drag = dragRef.current;
            if (!drag || drag.pointerId !== event.pointerId) return;
            if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                event.currentTarget.releasePointerCapture(event.pointerId);
            }
            dragRef.current = null;
            setPending((values) => {
                if (values) commit(values);
                return null;
            });
        },
        [commit]
    );

    // ============================================
    // Keyboard — a bar is a slider, so it answers to arrows
    // ============================================

    const handleKeyDown = useCallback(
        (note: Note, event: React.KeyboardEvent<HTMLDivElement>) => {
            if (disabled) return;
            const step = event.shiftKey ? STEP_COARSE : STEP_FINE;
            const direction =
                event.key === 'ArrowUp' || event.key === 'ArrowRight'
                    ? 1
                    : event.key === 'ArrowDown' || event.key === 'ArrowLeft'
                        ? -1
                        : 0;

            if (direction === 0 && event.key !== 'Home' && event.key !== 'End') return;
            event.preventDefault();

            const target =
                event.key === 'Home'
                    ? MIN_VELOCITY
                    : event.key === 'End'
                        ? MAX_VELOCITY
                        : clampVelocity(note.velocity + direction * step);

            const values = new Map(affectedIds(note.id).map((id) => [id, target]));
            commit(values);
        },
        [affectedIds, commit, disabled]
    );

    return (
        <div
            className="flex flex-shrink-0 border-t border-border bg-surface"
            style={{ height: VELOCITY_LANE_HEIGHT }}
        >
            {/* Gutter, aligned with the piano keys so bars sit under their notes */}
            <div
                className="flex flex-shrink-0 items-end justify-end border-r border-border pb-1 pr-1.5"
                style={{ width: gutterWidth }}
            >
                <span className="text-2xs font-medium text-muted-foreground">vel</span>
            </div>

            {/* Bars — scrolled by the grid, never independently */}
            <div
                ref={scrollRef}
                className="relative flex-1 overflow-hidden"
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
                <div className="relative h-full" style={{ minWidth: '100%', width }}>
                    {notes.map((note) => {
                        const velocity = shownVelocity(note);
                        const isSelected = selectedNoteIds.has(note.id);
                        return (
                            <div
                                key={note.id}
                                role="slider"
                                tabIndex={disabled ? -1 : 0}
                                aria-label={`Velocity ${velocity}`}
                                aria-valuenow={velocity}
                                aria-valuemin={MIN_VELOCITY}
                                aria-valuemax={MAX_VELOCITY}
                                aria-disabled={disabled || undefined}
                                title={`${velocity}`}
                                className={`
                                    absolute bottom-0 cursor-ns-resize rounded-t-sm border-t
                                    transition-colors focus-visible:outline focus-visible:outline-1
                                    focus-visible:outline-ring
                                    ${isSelected
                                        ? 'bg-accent border-accent-foreground'
                                        : 'bg-accent/60 border-accent/70 hover:bg-accent/80'
                                    }
                                `}
                                style={{
                                    left: note.startBeat * pixelsPerBeat,
                                    width: Math.max(note.duration * pixelsPerBeat - 1, 3),
                                    height: `${(velocity / MAX_VELOCITY) * 100}%`,
                                }}
                                onPointerDown={(e) => handlePointerDown(note, e)}
                                onPointerMove={handlePointerMove}
                                onPointerUp={endDrag}
                                onPointerCancel={endDrag}
                                onKeyDown={(e) => handleKeyDown(note, e)}
                            />
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
