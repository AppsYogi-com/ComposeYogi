'use client';

// ============================================
// ComposeYogi — Clip Note Preview
// ============================================
//
// The shape of a pattern, drawn inside its clip in the arrangement view. Until
// now a MIDI or drum clip showed only its name, so the arrangement told you
// where a part sat but nothing about what it did — the difference between a
// sparse verse and a busy chorus was invisible until you opened the editor.
//
// Velocity is drawn as opacity, which is the same language the editors use, so
// a pattern with dynamics reads as textured and a flat one reads as flat. That
// is the point: seeing that a part is uniformly loud is what makes you go and
// shape it.
//
// Canvas rather than DOM. A busy drum clip carries sixty-odd notes, clip
// virtualization keeps roughly eighty clips mounted, and five thousand absolute
// divs would cost more than the arrangement can spare. One canvas per clip
// redraws only when its notes, size or theme change.

import { memo, useEffect, useRef } from 'react';
import { useTheme } from 'next-themes';

import { tokenColor } from '@/lib/design';

import type { Note } from '@/types';

// ============================================
// Constants
// ============================================

/** Clears the clip's name, which sits at 4px with a 12px line box. Notes drawn
 *  any higher collide with the title instead of reading as a separate lane. */
const PADDING_TOP = 19;
const PADDING_BOTTOM = 4;

/** A note has to look like a block, not a hairline, or the preview reads as
 *  specks of damage rather than as music. */
const MIN_NOTE_WIDTH = 2.5;
const NOTE_HEIGHT = 3;

/** The vertical range a clip is drawn against, in semitones. Without a floor,
 *  the used range is stretched to fill the lane whatever it is — so a bassline
 *  moving two semitones renders as a full-height leap, which is a lie about the
 *  part. An octave floor keeps a flat part looking flat and lets a melody that
 *  genuinely ranges wider earn the height. */
const MIN_PITCH_SPAN = 12;

/** Velocity 1 still has to be visible, or a quiet part looks like an empty one. */
const MIN_ALPHA = 0.35;
const MAX_ALPHA = 0.95;

/**
 * Where a pitch sits in the lane, 0 at the bottom and 1 at the top.
 *
 * Exported for tests: this is the part that decides whether the preview tells
 * the truth about a part's contour, and it is easy to get subtly wrong in a way
 * that still looks plausible on screen.
 */
export function pitchPosition(pitch: number, lowest: number, highest: number): number {
    const used = highest - lowest;
    const span = Math.max(used, MIN_PITCH_SPAN);
    const centreOffset = (span - used) / 2;
    return (pitch - lowest + centreOffset) / span;
}

interface NotePreviewProps {
    notes: Note[];
    /** Clip length in beats — the horizontal extent the notes are mapped into. */
    totalBeats: number;
    width: number;
    height: number;
}

export const NotePreview = memo(function NotePreview({
    notes,
    totalBeats,
    width,
    height,
}: NotePreviewProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    // Canvas resolves tokens at draw time, so it has to redraw when the theme
    // changes or it keeps painting the previous theme's colour.
    const { resolvedTheme } = useTheme();

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const renderWidth = Math.max(1, Math.floor(width));
        const renderHeight = Math.max(1, Math.floor(height));
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const dpr = window.devicePixelRatio || 1;
        canvas.width = renderWidth * dpr;
        canvas.height = renderHeight * dpr;
        ctx.scale(dpr, dpr);
        ctx.clearRect(0, 0, renderWidth, renderHeight);

        const lane = renderHeight - PADDING_TOP - PADDING_BOTTOM;
        if (lane <= 0 || !notes.length || totalBeats <= 0) return;

        // Laid out against the pitches this clip actually uses rather than the
        // full MIDI range, so a bassline and a lead both read — but against at
        // least an octave, so the contour stays honest. The used range is then
        // centred in the lane instead of being pinned to its floor.
        let lowest = Infinity;
        let highest = -Infinity;
        for (const note of notes) {
            if (note.pitch < lowest) lowest = note.pitch;
            if (note.pitch > highest) highest = note.pitch;
        }
        const pixelsPerBeat = renderWidth / totalBeats;

        for (const note of notes) {
            const x = note.startBeat * pixelsPerBeat;
            if (x > renderWidth) continue;

            const noteWidth = Math.max(note.duration * pixelsPerBeat, MIN_NOTE_WIDTH);
            const position = pitchPosition(note.pitch, lowest, highest);
            const y = PADDING_TOP + (1 - position) * Math.max(lane - NOTE_HEIGHT, 0);

            ctx.fillStyle = tokenColor(
                'clip-foreground',
                MIN_ALPHA + (note.velocity / 127) * (MAX_ALPHA - MIN_ALPHA)
            );
            ctx.fillRect(x, y, Math.min(noteWidth, renderWidth - x), NOTE_HEIGHT);
        }
    }, [notes, totalBeats, width, height, resolvedTheme]);

    return (
        <canvas
            ref={canvasRef}
            className="pointer-events-none absolute inset-0"
            style={{ width, height }}
            aria-hidden="true"
        />
    );
});
