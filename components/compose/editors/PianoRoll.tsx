'use client';

import { useCallback, useMemo, useRef, useState, useEffect, memo } from 'react';
import { useTranslations } from 'next-intl';
import { ZoomIn, ZoomOut, AlertCircle } from 'lucide-react';
import { useProjectStore, useUIStore } from '@/lib/store';
import { SNAP_BEATS, scalePitchClasses, snapStepBeats } from '@/lib/music';
import { SnapSelect } from '../SnapSelect';
import { DefaultVelocityControl } from './DefaultVelocityControl';
import { VelocityLane } from './VelocityLane';
import { Button } from '@/components/ui/button';
import type { Clip, Note } from '@/types';
import * as Tone from 'tone';

// ============================================
// Constants
// ============================================

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const MIN_OCTAVE = 1;
const MAX_OCTAVE = 7;
const NOTE_HEIGHT = 14;
/** Piano-key column width. The velocity lane's gutter matches it so the bars
 *  sit under the notes they belong to. */
const KEY_COLUMN_WIDTH = 48;
const MIN_PIXELS_PER_BEAT = 20;
const MAX_PIXELS_PER_BEAT = 200;
const DEFAULT_PIXELS_PER_BEAT = 60;

interface PianoRollProps {
    clip: Clip;
}

export function PianoRoll({ clip }: PianoRollProps) {
    const t = useTranslations('editor.piano');
    const tScales = useTranslations('scales');
    const addNote = useProjectStore((s) => s.addNote);
    const deleteNote = useProjectStore((s) => s.deleteNote);
    const updateNote = useProjectStore((s) => s.updateNote);
    const project = useProjectStore((s) => s.project);
    const setEditorFocused = useUIStore((s) => s.setEditorFocused);
    const defaultVelocity = useUIStore((s) => s.defaultVelocity);

    const snap = useUIStore((s) => s.editorSnap);
    const setSnap = useUIStore((s) => s.setEditorSnap);
    const [pixelsPerBeat, setPixelsPerBeat] = useState(DEFAULT_PIXELS_PER_BEAT);
    const [selectedNoteIds, setSelectedNoteIds] = useState<Set<string>>(new Set());
    const [previewSynth, setPreviewSynth] = useState<Tone.PolySynth | null>(null);
    const [isDragging, setIsDragging] = useState(false);

    // Resize state
    const [resizingNote, setResizingNote] = useState<{ id: string; startDuration: number; startX: number } | null>(null);

    const gridRef = useRef<HTMLDivElement>(null);
    const keysRef = useRef<HTMLDivElement>(null);
    const velocityLaneRef = useRef<HTMLDivElement>(null);

    // Check if clip is compatible with piano roll
    const isCompatible = clip.type === 'midi';

    // Project settings
    const musicalKey = project?.key || 'C';
    const musicalScale = project?.scale || 'minor';
    const beatsPerBar = project?.timeSignature[0] || 4;
    const totalBeats = clip.lengthBars * beatsPerBar;

    // Calculate grid dimensions
    const totalNotes = (MAX_OCTAVE - MIN_OCTAVE + 1) * 12;
    const gridHeight = totalNotes * NOTE_HEIGHT;
    const clipWidth = totalBeats * pixelsPerBeat;

    const snapBeats = SNAP_BEATS[snap];
    /** What a freshly drawn note is worth, and the shortest a resize may reach.
     *  Never the raw snap value: with snapping off that is zero, which would
     *  draw notes of no length at all. */
    const noteStepBeats = snapStepBeats(snap);

    // Generate scale notes for highlighting
    const scaleNotes = useMemo(
        () => scalePitchClasses(musicalKey, musicalScale),
        [musicalKey, musicalScale]
    );

    // Check if a note is in scale
    const isInScale = useCallback((pitch: number) => {
        const noteIndex = pitch % 12;
        return scaleNotes.has(noteIndex);
    }, [scaleNotes]);

    // Initialize preview synth
    useEffect(() => {
        const synth = new Tone.PolySynth(Tone.Synth, {
            oscillator: { type: 'triangle' },
            envelope: {
                attack: 0.02,
                decay: 0.1,
                sustain: 0.3,
                release: 0.3,
            },
        }).toDestination();
        synth.volume.value = -12;
        setPreviewSynth(synth);

        return () => {
            synth.dispose();
        };
    }, []);

    // Convert MIDI pitch to row index (higher pitches at top)
    const pitchToRow = useCallback((pitch: number) => {
        const maxPitch = MAX_OCTAVE * 12 + 11;
        return maxPitch - pitch;
    }, []);

    // Convert row index to MIDI pitch
    const rowToPitch = useCallback((row: number) => {
        const maxPitch = MAX_OCTAVE * 12 + 11;
        return maxPitch - row;
    }, []);

    // Get note name from pitch
    const _pitchToNoteName = useCallback((pitch: number) => {
        const octave = Math.floor(pitch / 12) - 1;
        const noteIndex = pitch % 12;
        return `${NOTE_NAMES[noteIndex]}${octave}`;
    }, []);

    // Snap value to grid. Snapping off leaves the value exactly where the
    // pointer was, which is the whole point of the setting.
    const snapToGrid = useCallback((value: number) => {
        if (snapBeats <= 0) return value;
        return Math.round(value / snapBeats) * snapBeats;
    }, [snapBeats]);

    // Handle click on grid - toggle notes (like Drum Sequencer)
    const handleGridClick = useCallback((e: React.MouseEvent) => {
        if (!gridRef.current || isDragging) return;

        const rect = gridRef.current.getBoundingClientRect();
        const scrollLeft = gridRef.current.scrollLeft;
        const scrollTop = gridRef.current.scrollTop;

        const x = e.clientX - rect.left + scrollLeft;
        const y = e.clientY - rect.top + scrollTop;

        const beat = snapToGrid(x / pixelsPerBeat);
        const row = Math.floor(y / NOTE_HEIGHT);
        const pitch = rowToPitch(row);

        if (pitch < MIN_OCTAVE * 12 || pitch > MAX_OCTAVE * 12 + 11) return;

        // Bounds check: don't allow notes beyond clip length
        if (beat >= totalBeats) return;

        // Check if clicking on existing note
        const existingNote = clip.notes?.find((n) => {
            const noteRow = pitchToRow(n.pitch);
            const noteStartX = n.startBeat * pixelsPerBeat;
            const noteEndX = (n.startBeat + n.duration) * pixelsPerBeat;
            return row === noteRow && x >= noteStartX && x < noteEndX;
        });

        if (existingNote) {
            // Select, do not delete. A single click used to remove the note
            // outright, which meant selection could never be populated at all:
            // the Delete key had nothing to act on, the selected-note styling
            // never appeared, and the velocity lane's multi-note drag could
            // never trigger. Removing a note is now a double-click or Delete,
            // which is also what a DAW does.
            setSelectedNoteIds((prev) => {
                const additive = e.shiftKey || e.metaKey || e.ctrlKey;
                if (!additive) return new Set([existingNote.id]);
                const next = new Set(prev);
                if (next.has(existingNote.id)) next.delete(existingNote.id);
                else next.add(existingNote.id);
                return next;
            });

            if (previewSynth) {
                previewSynth.triggerAttackRelease(
                    Tone.Frequency(existingNote.pitch, 'midi').toNote(),
                    existingNote.duration * (60 / (project?.bpm || 120))
                );
            }
        } else {
            // Add new note (toggle on)
            const maxDuration = totalBeats - beat;
            const noteDuration = Math.min(noteStepBeats, maxDuration);

            setSelectedNoteIds(new Set());

            const newNote = addNote(clip.id, {
                pitch,
                startBeat: beat,
                duration: noteDuration,
                velocity: defaultVelocity,
            });

            if (newNote && previewSynth) {
                previewSynth.triggerAttackRelease(
                    Tone.Frequency(pitch, 'midi').toNote(),
                    noteStepBeats * (60 / (project?.bpm || 120))
                );
            }
        }
    }, [
        noteStepBeats, pixelsPerBeat, clip.id, clip.notes, totalBeats,
        pitchToRow, rowToPitch, snapToGrid, addNote,
        previewSynth, project?.bpm, isDragging, defaultVelocity
    ]);

    // Handle key preview
    const handleKeyClick = useCallback((pitch: number) => {
        if (previewSynth) {
            previewSynth.triggerAttackRelease(
                Tone.Frequency(pitch, 'midi').toNote(),
                '8n'
            );
        }
    }, [previewSynth]);

    /** Double-click removes a note. Single click selects it. */
    const handleGridDoubleClick = useCallback((e: React.MouseEvent) => {
        const grid = gridRef.current;
        if (!grid || !isCompatible) return;

        const rect = grid.getBoundingClientRect();
        const x = e.clientX - rect.left + grid.scrollLeft;
        const y = e.clientY - rect.top + grid.scrollTop;
        const row = Math.floor(y / NOTE_HEIGHT);

        const note = clip.notes?.find((n) => {
            const noteStartX = n.startBeat * pixelsPerBeat;
            const noteEndX = (n.startBeat + n.duration) * pixelsPerBeat;
            return row === pitchToRow(n.pitch) && x >= noteStartX && x < noteEndX;
        });
        if (!note) return;

        e.preventDefault();
        e.stopPropagation();
        deleteNote(clip.id, note.id);
        setSelectedNoteIds((prev) => {
            const next = new Set(prev);
            next.delete(note.id);
            return next;
        });
    }, [clip.id, clip.notes, deleteNote, isCompatible, pitchToRow, pixelsPerBeat]);

    // Delete selected notes
    const handleDeleteSelected = useCallback(() => {
        if (selectedNoteIds.size === 0) return;
        selectedNoteIds.forEach((id) => {
            deleteNote(clip.id, id);
        });
        setSelectedNoteIds(new Set());
    }, [clip.id, selectedNoteIds, deleteNote]);

    // Keyboard shortcuts - only when piano roll container is focused
    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        // Delete selected notes
        if (e.key === 'Delete' || e.key === 'Backspace') {
            if (selectedNoteIds.size > 0) {
                e.preventDefault();
                e.stopPropagation();
                handleDeleteSelected();
            }
        }
    }, [handleDeleteSelected, selectedNoteIds.size]);

    // Handle note resize start
    const handleResizeStart = useCallback((noteId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        const note = clip.notes?.find(n => n.id === noteId);
        if (!note) return;

        setResizingNote({
            id: noteId,
            startDuration: note.duration,
            startX: e.clientX,
        });
        setIsDragging(true);
    }, [clip.notes]);

    // Handle mouse move for resizing
    useEffect(() => {
        if (!resizingNote) return;

        const handleMouseMove = (e: MouseEvent) => {
            const deltaX = e.clientX - resizingNote.startX;
            const deltaDuration = deltaX / pixelsPerBeat;
            const newDuration = Math.max(noteStepBeats, snapToGrid(resizingNote.startDuration + deltaDuration));

            // Don't allow resizing beyond clip length
            const note = clip.notes?.find(n => n.id === resizingNote.id);
            if (note) {
                const maxDuration = totalBeats - note.startBeat;
                const clampedDuration = Math.min(newDuration, maxDuration);
                updateNote(clip.id, resizingNote.id, { duration: clampedDuration });
            }
        };

        const handleMouseUp = () => {
            setResizingNote(null);
            setIsDragging(false);
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [resizingNote, pixelsPerBeat, noteStepBeats, snapToGrid, clip.id, clip.notes, totalBeats, updateNote]);

    // Zoom controls
    const zoomIn = () => setPixelsPerBeat((p) => Math.min(p * 1.25, MAX_PIXELS_PER_BEAT));
    const zoomOut = () => setPixelsPerBeat((p) => Math.max(p / 1.25, MIN_PIXELS_PER_BEAT));

    // Generate piano keys
    const keys = useMemo(() => {
        const result = [];
        for (let octave = MAX_OCTAVE; octave >= MIN_OCTAVE; octave--) {
            for (let i = 11; i >= 0; i--) {
                const pitch = octave * 12 + i;
                const noteName = NOTE_NAMES[i];
                const isBlack = noteName.includes('#');
                result.push({ pitch, noteName, octave, isBlack });
            }
        }
        return result;
    }, []);


    return (
        <div
            className="flex h-full flex-col outline-none"
            tabIndex={0}
            onKeyDown={handleKeyDown}
            onFocus={() => setEditorFocused(true)}
            onBlur={() => setEditorFocused(false)}
        >
            {/* Incompatible clip warning */}
            {!isCompatible && (
                <div className="flex items-center gap-2 border-b border-warning/30 bg-warning/10 px-3 py-2">
                    <AlertCircle className="h-4 w-4 text-warning" />
                    <span className="text-xs text-warning">
                        {clip.type === 'audio' ? t('incompatibleAudio') : t('incompatibleDrum')}
                    </span>
                </div>
            )}

            {/* Toolbar */}
            <div className="flex items-center gap-3 border-b border-border bg-surface px-3 py-1.5">
                {/* Snap selector */}
                <div className="flex items-center gap-1.5">
                    <span className="text-xs text-muted-foreground">{t('snap')}</span>
                    <SnapSelect value={snap} onChange={setSnap} disabled={!isCompatible} />
                </div>

                <DefaultVelocityControl disabled={!isCompatible} />

                {/* Scale info */}
                <div className="flex items-center gap-1.5">
                    <span className="text-xs text-muted-foreground">{t('scale')}</span>
                    <span className="text-xs font-medium">
                        {musicalKey} {tScales(musicalScale)}
                    </span>
                </div>

                <div className="flex-1" />

                {/* Zoom controls */}
                <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon-sm" onClick={zoomOut}>
                        <ZoomOut className="h-3.5 w-3.5" />
                    </Button>
                    <span className="w-12 text-center text-xs text-muted-foreground">
                        {t('zoomLevel', { px: Math.round(pixelsPerBeat) })}
                    </span>
                    <Button variant="ghost" size="icon-sm" onClick={zoomIn}>
                        <ZoomIn className="h-3.5 w-3.5" />
                    </Button>
                </div>
            </div>

            {/* Main content - synced scrolling */}
            <div className="flex flex-1 overflow-hidden">
                {/* Piano keys - scroll synced with grid */}
                <div
                    ref={keysRef}
                    className="flex-shrink-0 border-r border-border overflow-y-auto overflow-x-hidden scrollbar-hide"
                    style={{ width: KEY_COLUMN_WIDTH, scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                >
                    <div className="flex flex-col" style={{ height: gridHeight }}>
                        {keys.map(({ pitch, noteName, octave, isBlack }) => (
                            <button
                                key={pitch}
                                className={`
                                    flex-shrink-0 flex items-center justify-end pr-1.5 text-2xs font-medium transition-all
                                    ${isBlack
                                        ? 'bg-piano-black text-piano-black-foreground border-b border-scrim/40'
                                        : 'bg-piano-white text-piano-white-foreground border-b border-scrim/15'
                                    }
                                    ${isInScale(pitch) ? '' : 'opacity-40'}
                                    hover:brightness-110 active:brightness-90
                                `}
                                style={{ height: NOTE_HEIGHT }}
                                onClick={() => handleKeyClick(pitch)}
                            >
                                {noteName === 'C' ? `C${octave}` : ''}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Note grid - scrollable */}
                <div
                    ref={gridRef}
                    className="flex-1 overflow-auto bg-background relative"
                    onClick={handleGridClick}
                    onDoubleClick={handleGridDoubleClick}
                    onScroll={(e) => {
                        // Sync piano keys scroll with grid vertical scroll
                        if (keysRef.current) {
                            keysRef.current.scrollTop = e.currentTarget.scrollTop;
                        }
                        // The velocity lane follows the grid horizontally. One
                        // way only — a lane that also drove the grid would feed
                        // its own scroll back and fight the pointer.
                        if (velocityLaneRef.current) {
                            velocityLaneRef.current.scrollLeft = e.currentTarget.scrollLeft;
                        }
                    }}
                >
                    {/* Grid container - fills available width */}
                    <div
                        className="relative"
                        style={{
                            minWidth: '100%',
                            width: Math.max(clipWidth, 800),
                            height: gridHeight,
                        }}
                    >
                        {/* Row backgrounds (scale highlighting) - only in clip area */}
                        {keys.map(({ pitch, isBlack }, i) => (
                            <div
                                key={pitch}
                                className={`
                                    absolute border-b border-border/30
                                    ${isBlack ? 'bg-foreground/[0.06]' : 'bg-foreground/[0.02]'}
                                    ${isInScale(pitch) ? '' : 'bg-foreground/[0.10]'}
                                `}
                                style={{
                                    top: i * NOTE_HEIGHT,
                                    height: NOTE_HEIGHT,
                                    left: 0,
                                    width: clipWidth,
                                }}
                            />
                        ))}

                        {/* Grayed out area beyond clip */}
                        <div
                            className="absolute top-0 bottom-0 bg-background/80 pointer-events-none"
                            style={{
                                left: clipWidth,
                                right: 0,
                            }}
                        />

                        {/* Clip end boundary line */}
                        <div
                            className="absolute top-0 bottom-0 w-0.5 bg-accent/70"
                            style={{ left: clipWidth }}
                        />

                        {/* Beat grid lines */}
                        {Array.from({ length: Math.ceil(totalBeats) + 1 }).map((_, i) => {
                            const isBar = i % beatsPerBar === 0;
                            return (
                                <div
                                    key={i}
                                    className={`
                                        absolute top-0 bottom-0 w-px
                                        ${isBar ? 'bg-border' : 'bg-border/30'}
                                    `}
                                    style={{ left: i * pixelsPerBeat }}
                                />
                            );
                        })}

                        {/* Notes */}
                        {clip.notes?.map((note) => {
                            const row = pitchToRow(note.pitch);
                            const x = note.startBeat * pixelsPerBeat;
                            const width = note.duration * pixelsPerBeat;
                            const isSelected = selectedNoteIds.has(note.id);

                            return (
                                <NoteBlock
                                    key={note.id}
                                    note={note}
                                    x={x}
                                    y={row * NOTE_HEIGHT}
                                    width={width}
                                    height={NOTE_HEIGHT - 1}
                                    isSelected={isSelected}
                                    isInScale={isInScale(note.pitch)}
                                    onResizeStart={(e) => handleResizeStart(note.id, e)}
                                />
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Velocity lane — drag a bar to shape the dynamics */}
            <VelocityLane
                clip={clip}
                pixelsPerBeat={pixelsPerBeat}
                width={Math.max(clipWidth, 800)}
                selectedNoteIds={selectedNoteIds}
                gutterWidth={KEY_COLUMN_WIDTH}
                scrollRef={velocityLaneRef}
                disabled={!isCompatible}
            />
        </div>
    );
}

// ============================================
// Note Block Component
// ============================================

interface NoteBlockProps {
    note: Note;
    x: number;
    y: number;
    width: number;
    height: number;
    isSelected: boolean;
    isInScale: boolean;
    onResizeStart: (e: React.MouseEvent) => void;
}

const NoteBlock = memo(function NoteBlock({
    note,
    x,
    y,
    width,
    height,
    isSelected,
    isInScale,
    onResizeStart,
}: NoteBlockProps) {
    return (
        <div
            className={`
                absolute rounded-sm border transition-colors cursor-pointer
                ${isSelected
                    ? 'bg-accent border-accent-foreground ring-1 ring-accent-foreground'
                    : isInScale
                        ? 'bg-accent/80 border-accent/50 hover:bg-accent'
                        : 'bg-accent/50 border-accent/30 hover:bg-accent/60'
                }
            `}
            style={{
                left: x,
                top: y,
                width: Math.max(width - 1, 4),
                height,
                opacity: 0.5 + (note.velocity / 127) * 0.5,
            }}
        >
            {/* Resize handle (right edge) */}
            <div
                className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-clip-foreground/50 active:bg-clip-foreground/70"
                onMouseDown={onResizeStart}
            />
        </div>
    );
});
