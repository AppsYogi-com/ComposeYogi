'use client';

import { useCallback, useMemo, useRef, useState, useEffect, memo } from 'react';
import { ZoomIn, ZoomOut, MousePointer2, Pencil, Eraser, AlertCircle } from 'lucide-react';
import { useProjectStore, useUIStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import type { Clip, Note, MusicalKey, MusicalScale } from '@/types';
import * as Tone from 'tone';

// ============================================
// Constants
// ============================================

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const MIN_OCTAVE = 1;
const MAX_OCTAVE = 7;
const NOTE_HEIGHT = 14;
const MIN_PIXELS_PER_BEAT = 20;
const MAX_PIXELS_PER_BEAT = 200;
const DEFAULT_PIXELS_PER_BEAT = 60;

// Scale intervals (semitones from root)
const SCALE_INTERVALS: Record<MusicalScale, number[]> = {
    major: [0, 2, 4, 5, 7, 9, 11],
    minor: [0, 2, 3, 5, 7, 8, 10],
    dorian: [0, 2, 3, 5, 7, 9, 10],
    phrygian: [0, 1, 3, 5, 7, 8, 10],
    lydian: [0, 2, 4, 6, 7, 9, 11],
    mixolydian: [0, 2, 4, 5, 7, 9, 10],
    locrian: [0, 1, 3, 5, 6, 8, 10],
    pentatonic: [0, 2, 4, 7, 9],
    blues: [0, 3, 5, 6, 7, 10],
};

type Tool = 'select' | 'draw' | 'erase';
type SnapValue = '1' | '1/2' | '1/4' | '1/8' | '1/16' | '1/32';

interface PianoRollProps {
    clip: Clip;
}

export function PianoRoll({ clip }: PianoRollProps) {
    const addNote = useProjectStore((s) => s.addNote);
    const deleteNote = useProjectStore((s) => s.deleteNote);
    const updateNote = useProjectStore((s) => s.updateNote);
    const project = useProjectStore((s) => s.project);

    const [tool, setTool] = useState<Tool>('draw');
    const [snap, setSnap] = useState<SnapValue>('1/16');
    const [pixelsPerBeat, setPixelsPerBeat] = useState(DEFAULT_PIXELS_PER_BEAT);
    const [selectedNoteIds, setSelectedNoteIds] = useState<Set<string>>(new Set());
    const [previewSynth, setPreviewSynth] = useState<Tone.PolySynth | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState<{ x: number; y: number; noteId?: string } | null>(null);

    const gridRef = useRef<HTMLDivElement>(null);
    const keysRef = useRef<HTMLDivElement>(null);

    // Project settings
    const musicalKey = project?.key || 'C';
    const musicalScale = project?.scale || 'minor';
    const beatsPerBar = project?.timeSignature[0] || 4;
    const totalBeats = clip.lengthBars * beatsPerBar;

    // Calculate grid dimensions
    const totalNotes = (MAX_OCTAVE - MIN_OCTAVE + 1) * 12;
    const gridHeight = totalNotes * NOTE_HEIGHT;
    const clipWidth = totalBeats * pixelsPerBeat;

    // Get snap value in beats
    const snapBeats = useMemo(() => {
        const snapMap: Record<SnapValue, number> = {
            '1': 4, // Whole note (4 beats)
            '1/2': 2,
            '1/4': 1,
            '1/8': 0.5,
            '1/16': 0.25,
            '1/32': 0.125,
        };
        return snapMap[snap];
    }, [snap]);

    // Generate scale notes for highlighting
    const scaleNotes = useMemo(() => {
        const rootIndex = NOTE_NAMES.indexOf(musicalKey);
        const intervals = SCALE_INTERVALS[musicalScale] || SCALE_INTERVALS.minor;
        return new Set(intervals.map((i) => (rootIndex + i) % 12));
    }, [musicalKey, musicalScale]);

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
    const pitchToNoteName = useCallback((pitch: number) => {
        const octave = Math.floor(pitch / 12) - 1;
        const noteIndex = pitch % 12;
        return `${NOTE_NAMES[noteIndex]}${octave}`;
    }, []);

    // Snap value to grid
    const snapToGrid = useCallback((value: number) => {
        return Math.round(value / snapBeats) * snapBeats;
    }, [snapBeats]);

    // Handle click on grid
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

        if (tool === 'draw') {
            // Check if clicking on existing note
            const existingNote = clip.notes?.find((n) => {
                const noteRow = pitchToRow(n.pitch);
                const noteStartX = n.startBeat * pixelsPerBeat;
                const noteEndX = (n.startBeat + n.duration) * pixelsPerBeat;
                return row === noteRow && x >= noteStartX && x < noteEndX;
            });

            if (existingNote) {
                // Select existing note
                setSelectedNoteIds(new Set([existingNote.id]));
            } else {
                // Clamp note duration to not exceed clip length
                const maxDuration = totalBeats - beat;
                const noteDuration = Math.min(snapBeats, maxDuration);

                // Add new note
                const newNote = addNote(clip.id, {
                    pitch,
                    startBeat: beat,
                    duration: noteDuration,
                    velocity: 100,
                });

                if (newNote && previewSynth) {
                    previewSynth.triggerAttackRelease(
                        Tone.Frequency(pitch, 'midi').toNote(),
                        snapBeats * (60 / (project?.bpm || 120))
                    );
                }
            }
        } else if (tool === 'erase') {
            // Find and delete note at position
            const noteToDelete = clip.notes?.find((n) => {
                const noteRow = pitchToRow(n.pitch);
                const noteStartX = n.startBeat * pixelsPerBeat;
                const noteEndX = (n.startBeat + n.duration) * pixelsPerBeat;
                return row === noteRow && x >= noteStartX && x < noteEndX;
            });

            if (noteToDelete) {
                deleteNote(clip.id, noteToDelete.id);
            }
        } else if (tool === 'select') {
            const clickedNote = clip.notes?.find((n) => {
                const noteRow = pitchToRow(n.pitch);
                const noteStartX = n.startBeat * pixelsPerBeat;
                const noteEndX = (n.startBeat + n.duration) * pixelsPerBeat;
                return row === noteRow && x >= noteStartX && x < noteEndX;
            });

            if (clickedNote) {
                if (e.shiftKey) {
                    // Toggle selection
                    setSelectedNoteIds((prev) => {
                        const next = new Set(prev);
                        if (next.has(clickedNote.id)) {
                            next.delete(clickedNote.id);
                        } else {
                            next.add(clickedNote.id);
                        }
                        return next;
                    });
                } else {
                    setSelectedNoteIds(new Set([clickedNote.id]));
                }
            } else {
                setSelectedNoteIds(new Set());
            }
        }
    }, [
        tool, snap, snapBeats, pixelsPerBeat, clip.id, clip.notes, totalBeats,
        pitchToRow, rowToPitch, snapToGrid, addNote, deleteNote,
        previewSynth, project?.bpm, isDragging
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

    // Delete selected notes
    const handleDeleteSelected = useCallback(() => {
        selectedNoteIds.forEach((id) => {
            deleteNote(clip.id, id);
        });
        setSelectedNoteIds(new Set());
    }, [clip.id, selectedNoteIds, deleteNote]);

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Delete' || e.key === 'Backspace') {
                handleDeleteSelected();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleDeleteSelected]);

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

    // Check if clip is compatible with piano roll
    const isCompatible = clip.type === 'midi';

    return (
        <div className="flex h-full flex-col">
            {/* Incompatible clip warning */}
            {!isCompatible && (
                <div className="flex items-center gap-2 border-b border-yellow-500/30 bg-yellow-500/10 px-3 py-2">
                    <AlertCircle className="h-4 w-4 text-yellow-500" />
                    <span className="text-xs text-yellow-500">
                        This is {clip.type === 'audio' ? 'an audio' : 'a drum'} clip. Switch to a MIDI clip to use the piano roll, or change the clip type.
                    </span>
                </div>
            )}

            {/* Toolbar */}
            <div className="flex items-center gap-3 border-b border-border bg-surface px-3 py-1.5">
                {/* Tool selection */}
                <div className="flex items-center gap-0.5 rounded-md bg-background p-0.5">
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant={tool === 'select' ? 'default' : 'ghost'}
                                size="icon-sm"
                                onClick={() => setTool('select')}
                            >
                                <MousePointer2 className="h-3.5 w-3.5" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>Select (V)</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant={tool === 'draw' ? 'default' : 'ghost'}
                                size="icon-sm"
                                onClick={() => setTool('draw')}
                                disabled={!isCompatible}
                            >
                                <Pencil className="h-3.5 w-3.5" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>Draw (B)</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant={tool === 'erase' ? 'default' : 'ghost'}
                                size="icon-sm"
                                onClick={() => setTool('erase')}
                                disabled={!isCompatible}
                            >
                                <Eraser className="h-3.5 w-3.5" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>Erase (E)</TooltipContent>
                    </Tooltip>
                </div>

                {/* Snap selector */}
                <div className="flex items-center gap-1.5">
                    <span className="text-xs text-muted-foreground">Snap:</span>
                    <Select value={snap} onValueChange={(v) => setSnap(v as SnapValue)} disabled={!isCompatible}>
                        <SelectTrigger className="h-7 w-16 text-xs">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="1">1</SelectItem>
                            <SelectItem value="1/2">1/2</SelectItem>
                            <SelectItem value="1/4">1/4</SelectItem>
                            <SelectItem value="1/8">1/8</SelectItem>
                            <SelectItem value="1/16">1/16</SelectItem>
                            <SelectItem value="1/32">1/32</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                {/* Scale info */}
                <div className="flex items-center gap-1.5">
                    <span className="text-xs text-muted-foreground">Scale:</span>
                    <span className="text-xs font-medium">
                        {musicalKey} {musicalScale}
                    </span>
                </div>

                <div className="flex-1" />

                {/* Zoom controls */}
                <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon-sm" onClick={zoomOut}>
                        <ZoomOut className="h-3.5 w-3.5" />
                    </Button>
                    <span className="w-12 text-center text-xs text-muted-foreground">
                        {Math.round(pixelsPerBeat)}px
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
                    className="w-12 flex-shrink-0 border-r border-border overflow-y-auto overflow-x-hidden scrollbar-hide"
                    style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                >
                    <div className="flex flex-col" style={{ height: gridHeight }}>
                        {keys.map(({ pitch, noteName, octave, isBlack }) => (
                            <button
                                key={pitch}
                                className={`
                                    flex-shrink-0 flex items-center justify-end pr-1.5 text-2xs font-medium transition-all
                                    ${isBlack
                                        ? 'bg-zinc-800 text-zinc-400 border-b border-zinc-700'
                                        : 'bg-zinc-200 text-zinc-700 border-b border-zinc-300'
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
                    onScroll={(e) => {
                        // Sync piano keys scroll with grid vertical scroll
                        if (keysRef.current) {
                            keysRef.current.scrollTop = e.currentTarget.scrollTop;
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
                                    ${isBlack ? 'bg-zinc-900/50' : 'bg-zinc-900/20'}
                                    ${isInScale(pitch) ? '' : 'bg-zinc-900/70'}
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
                            className="absolute top-0 bottom-0 bg-zinc-950/80 pointer-events-none"
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
                                />
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Velocity lane (optional) */}
            <div className="h-16 border-t border-border bg-surface flex items-end px-14">
                <div className="flex-1 relative h-full">
                    {clip.notes?.map((note) => {
                        const x = note.startBeat * pixelsPerBeat;
                        const height = (note.velocity / 127) * 100;
                        const isSelected = selectedNoteIds.has(note.id);

                        return (
                            <div
                                key={note.id}
                                className={`
                                    absolute bottom-0 w-2 rounded-t-sm
                                    ${isSelected ? 'bg-accent' : 'bg-accent/60'}
                                `}
                                style={{
                                    left: x,
                                    height: `${height}%`,
                                }}
                            />
                        );
                    })}
                </div>
            </div>
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
}

const NoteBlock = memo(function NoteBlock({
    note,
    x,
    y,
    width,
    height,
    isSelected,
    isInScale,
}: NoteBlockProps) {
    return (
        <div
            className={`
                absolute rounded-sm border transition-all cursor-pointer
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
            <div className="absolute right-0 top-0 bottom-0 w-1 cursor-ew-resize hover:bg-white/30" />
        </div>
    );
});
