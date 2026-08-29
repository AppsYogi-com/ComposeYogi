'use client';

import { useCallback, useMemo, useRef, useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Check, AlertCircle } from 'lucide-react';
import { useProjectStore, useUIStore } from '@/lib/store';
import { DRUM_BG } from '@/lib/design/track-colors';
import type { DrumFamily } from '@/lib/design/tokens';
import { Button } from '@/components/ui/button';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { useViewportWidth } from '@/hooks/useVisibleClips';
import { useVisibleStepRange, stepIndices } from '@/hooks/useVisibleSteps';

import { AnchoredTooltip } from './AnchoredTooltip';
import { DefaultVelocityControl } from './DefaultVelocityControl';

import type { Clip, Note } from '@/types';
import type { AnchorRect } from './AnchoredTooltip';
import * as Tone from 'tone';

// ============================================
// Velocity editing
// ============================================

/** Width of one step column, in px. Fixed rather than fractional so a step's
 *  position can be computed without measuring the grid. */
const STEP_WIDTH = 28;

/** Vertical travel before a press stops being a click and becomes a drag. */
const VELOCITY_DRAG_THRESHOLD = 4;

/** How much velocity one pixel of travel is worth — a step cell is small, so
 *  the full 1–127 range wants roughly half a cell height of movement. */
const VELOCITY_PER_PIXEL = 2;

interface VelocityDrag {
    pointerId: number;
    noteId: string;
    startY: number;
    /** Velocity when the gesture began, so travel is measured from a fixed point. */
    base: number;
    /** In-flight value — drawn during the drag, written to the store on release. */
    value: number;
    /** False until the pointer passes the threshold; a press that never moves is a click. */
    moved: boolean;
}

// ============================================
// Drum Sound Definitions (General MIDI Percussion)
// Full GM percussion set: MIDI notes 35-81
// ============================================

interface DrumSound {
    name: string;
    shortName: string;
    pitch: number; // MIDI note number
    /** Kit family — drives the lane colour via DRUM_BG. See lib/design/tokens.ts. */
    family: DrumFamily;
}

// Full General MIDI Percussion Map (organized by category)
const DRUM_SOUNDS: DrumSound[] = [
    // Kicks (35-36)
    { name: 'Acoustic Bass Drum', shortName: 'BD1', pitch: 35, family: 'kick' },
    { name: 'Bass Drum 1', shortName: 'BD2', pitch: 36, family: 'kick' },

    // Snares & Rim (37-40)
    { name: 'Side Stick', shortName: 'STK', pitch: 37, family: 'snare' },
    { name: 'Acoustic Snare', shortName: 'SN1', pitch: 38, family: 'snare' },
    { name: 'Hand Clap', shortName: 'CLP', pitch: 39, family: 'snare' },
    { name: 'Electric Snare', shortName: 'SN2', pitch: 40, family: 'snare' },

    // Toms (41, 43, 45, 47, 48, 50)
    { name: 'Low Floor Tom', shortName: 'LFT', pitch: 41, family: 'tom' },
    { name: 'High Floor Tom', shortName: 'HFT', pitch: 43, family: 'tom' },
    { name: 'Low Tom', shortName: 'LTM', pitch: 45, family: 'tom' },
    { name: 'Low-Mid Tom', shortName: 'LMT', pitch: 47, family: 'tom' },
    { name: 'Hi-Mid Tom', shortName: 'HMT', pitch: 48, family: 'tom' },
    { name: 'High Tom', shortName: 'HTM', pitch: 50, family: 'tom' },

    // Hi-Hats (42, 44, 46)
    { name: 'Closed Hi-Hat', shortName: 'CHH', pitch: 42, family: 'hat' },
    { name: 'Pedal Hi-Hat', shortName: 'PHH', pitch: 44, family: 'hat' },
    { name: 'Open Hi-Hat', shortName: 'OHH', pitch: 46, family: 'hat' },

    // Cymbals (49, 51, 52, 53, 55, 57, 59)
    { name: 'Crash Cymbal 1', shortName: 'CR1', pitch: 49, family: 'cymbal' },
    { name: 'Ride Cymbal 1', shortName: 'RD1', pitch: 51, family: 'cymbal' },
    { name: 'Chinese Cymbal', shortName: 'CHN', pitch: 52, family: 'cymbal' },
    { name: 'Ride Bell', shortName: 'RBL', pitch: 53, family: 'cymbal' },
    { name: 'Splash Cymbal', shortName: 'SPL', pitch: 55, family: 'cymbal' },
    { name: 'Crash Cymbal 2', shortName: 'CR2', pitch: 57, family: 'cymbal' },
    { name: 'Ride Cymbal 2', shortName: 'RD2', pitch: 59, family: 'cymbal' },

    // Latin - Bongos & Congas (60-64)
    { name: 'Hi Bongo', shortName: 'HBG', pitch: 60, family: 'perc' },
    { name: 'Low Bongo', shortName: 'LBG', pitch: 61, family: 'perc' },
    { name: 'Mute Hi Conga', shortName: 'MHC', pitch: 62, family: 'perc' },
    { name: 'Open Hi Conga', shortName: 'OHC', pitch: 63, family: 'perc' },
    { name: 'Low Conga', shortName: 'LCG', pitch: 64, family: 'perc' },

    // Latin - Timbales (65-66)
    { name: 'High Timbale', shortName: 'HTB', pitch: 65, family: 'perc' },
    { name: 'Low Timbale', shortName: 'LTB', pitch: 66, family: 'perc' },

    // Latin - Agogo & Bells (67-68, 56)
    { name: 'High Agogo', shortName: 'HAG', pitch: 67, family: 'perc' },
    { name: 'Low Agogo', shortName: 'LAG', pitch: 68, family: 'perc' },
    { name: 'Cowbell', shortName: 'COW', pitch: 56, family: 'perc' },

    // Shakers & Tambourine (54, 69-71)
    { name: 'Tambourine', shortName: 'TMB', pitch: 54, family: 'perc' },
    { name: 'Cabasa', shortName: 'CAB', pitch: 69, family: 'perc' },
    { name: 'Maracas', shortName: 'MRC', pitch: 70, family: 'perc' },
    { name: 'Short Whistle', shortName: 'SWH', pitch: 71, family: 'perc' },

    // More Percussion (72-81)
    { name: 'Long Whistle', shortName: 'LWH', pitch: 72, family: 'perc' },
    { name: 'Short Guiro', shortName: 'SGU', pitch: 73, family: 'perc' },
    { name: 'Long Guiro', shortName: 'LGU', pitch: 74, family: 'perc' },
    { name: 'Claves', shortName: 'CLV', pitch: 75, family: 'perc' },
    { name: 'Hi Wood Block', shortName: 'HWB', pitch: 76, family: 'perc' },
    { name: 'Low Wood Block', shortName: 'LWB', pitch: 77, family: 'perc' },
    { name: 'Mute Cuica', shortName: 'MCU', pitch: 78, family: 'perc' },
    { name: 'Open Cuica', shortName: 'OCU', pitch: 79, family: 'perc' },
    { name: 'Mute Triangle', shortName: 'MTR', pitch: 80, family: 'perc' },
    { name: 'Open Triangle', shortName: 'OTR', pitch: 81, family: 'perc' },
];

// Pattern presets
const PATTERN_PRESETS = {
    'Four on Floor': [
        { row: 0, steps: [0, 4, 8, 12] }, // Kick on 1, 2, 3, 4
        { row: 1, steps: [4, 12] }, // Snare on 2, 4
        { row: 2, steps: [0, 2, 4, 6, 8, 10, 12, 14] }, // Hi-hat 8ths
    ],
    'Breakbeat': [
        { row: 0, steps: [0, 6, 10] }, // Kick
        { row: 1, steps: [4, 12] }, // Snare
        { row: 2, steps: [0, 2, 4, 6, 8, 10, 12, 14] }, // Hi-hat
    ],
    'Hip Hop': [
        { row: 0, steps: [0, 5, 8, 13] }, // Kick
        { row: 1, steps: [4, 12] }, // Snare
        { row: 2, steps: [2, 6, 10, 14] }, // Hi-hat
    ],
    'Trap': [
        { row: 0, steps: [0, 7, 14] }, // Kick
        { row: 1, steps: [4, 12] }, // Snare
        { row: 2, steps: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15] }, // Hi-hat 16ths
    ],
};

interface DrumSequencerProps {
    clip: Clip;
}

export function DrumSequencer({ clip }: DrumSequencerProps) {
    const t = useTranslations('editor.drum');
    const addNote = useProjectStore((s) => s.addNote);
    const deleteNote = useProjectStore((s) => s.deleteNote);
    const updateNote = useProjectStore((s) => s.updateNote);
    const project = useProjectStore((s) => s.project);
    const setEditorFocused = useUIStore((s) => s.setEditorFocused);
    const defaultVelocity = useUIStore((s) => s.defaultVelocity);

    // A vertical drag on a filled step edits its velocity. As in the piano
    // roll's lane, nothing reaches the store until the gesture ends: velocity
    // is part of clipNotesHash, so a write per pointermove would reschedule the
    // clip on every pixel and bury the undo history under a single drag.
    const [velocityDrag, setVelocityDrag] = useState<VelocityDrag | null>(null);
    const velocityDragRef = useRef<VelocityDrag | null>(null);
    // `click` fires after `pointerup`, by which point the drag state is already
    // cleared — so a finished drag would fall through and toggle the step off.
    // This flag survives that one event.
    const suppressClickRef = useRef(false);
    // Which filled step the pointer is over, so one tooltip can follow it.
    const [hoveredStep, setHoveredStep] = useState<{
        anchor: AnchorRect;
        sound: string;
        velocity: number;
    } | null>(null);
    const [previewSynth, setPreviewSynth] = useState<Tone.MembraneSynth | null>(null);
    const [activePreset, setActivePreset] = useState<string | null>(null);
    const gridRef = useRef<HTMLDivElement>(null);
    const [gridScrollX, setGridScrollX] = useState(0);
    const gridWidth = useViewportWidth(gridRef);

    // Check if clip type is compatible
    const isCompatible = clip.type === 'drum' || clip.type === 'midi';

    // Calculate steps based on clip length and time signature
    const beatsPerBar = project?.timeSignature[0] || 4;
    const stepsPerBeat = 4; // 16th notes
    // Every step the clip actually spans. This used to be capped at 64, which
    // did not limit the view so much as the pattern: past bar four the grid had
    // no cells, so those hits could be heard and cleared but never seen or
    // edited. The columns are virtualized instead — see hooks/useVisibleSteps.
    const steps = clip.lengthBars * beatsPerBar * stepsPerBeat;

    const visibleSteps = useVisibleStepRange(steps, STEP_WIDTH, {
        scrollX: gridScrollX,
        width: gridWidth,
    });
    const visibleStepIndices = stepIndices(visibleSteps);

    // Initialize preview synth
    useEffect(() => {
        const synth = new Tone.MembraneSynth({
            pitchDecay: 0.05,
            octaves: 4,
            oscillator: { type: 'sine' },
            envelope: {
                attack: 0.001,
                decay: 0.4,
                sustain: 0.01,
                release: 0.4,
            },
        }).toDestination();
        synth.volume.value = -10;
        setPreviewSynth(synth);

        return () => {
            synth.dispose();
        };
    }, []);

    // Convert notes to grid state
    const gridState = useMemo(() => {
        const state: Map<string, Note> = new Map();
        if (!clip.notes) return state;

        for (const note of clip.notes) {
            // Find which row this note belongs to
            const rowIndex = DRUM_SOUNDS.findIndex((s) => s.pitch === note.pitch);
            if (rowIndex === -1) continue;

            // Convert startBeat to step index
            const stepIndex = Math.round(note.startBeat * stepsPerBeat);
            const key = `${rowIndex}-${stepIndex}`;
            state.set(key, note);
        }
        return state;
    }, [clip.notes]);

    // Toggle a step
    const toggleStep = useCallback((rowIndex: number, stepIndex: number) => {
        const key = `${rowIndex}-${stepIndex}`;
        const existingNote = gridState.get(key);

        if (existingNote) {
            // Remove note
            deleteNote(clip.id, existingNote.id);
        } else {
            // Add note
            const sound = DRUM_SOUNDS[rowIndex];
            addNote(clip.id, {
                pitch: sound.pitch,
                startBeat: stepIndex / stepsPerBeat,
                duration: 0.25, // 16th note
                velocity: defaultVelocity,
            });

            // Play preview
            if (previewSynth) {
                previewSynth.triggerAttackRelease(
                    Tone.Frequency(sound.pitch, 'midi').toNote(),
                    '16n'
                );
            }
        }
    }, [clip.id, gridState, deleteNote, addNote, previewSynth, defaultVelocity]);

    // ============================================
    // Velocity drag
    // ============================================

    const beginVelocityDrag = useCallback((
        note: Note,
        event: React.PointerEvent<HTMLButtonElement>
    ) => {
        // Throws if the pointer is already gone; the drag still works without
        // capture, it just stops tracking outside the element.
        try {
            event.currentTarget.setPointerCapture(event.pointerId);
        } catch {
            /* no active pointer to capture */
        }
        const drag: VelocityDrag = {
            pointerId: event.pointerId,
            noteId: note.id,
            startY: event.clientY,
            base: note.velocity,
            value: note.velocity,
            moved: false,
        };
        velocityDragRef.current = drag;
        suppressClickRef.current = false;
        setVelocityDrag(drag);
    }, []);

    const moveVelocityDrag = useCallback((event: React.PointerEvent<HTMLButtonElement>) => {
        const drag = velocityDragRef.current;
        if (!drag || drag.pointerId !== event.pointerId) return;

        const travel = drag.startY - event.clientY;
        // Under the threshold this is still a click, and a click toggles the
        // step. Only past it does the gesture become a velocity edit.
        if (!drag.moved && Math.abs(travel) < VELOCITY_DRAG_THRESHOLD) return;

        const next: VelocityDrag = {
            ...drag,
            moved: true,
            value: Math.max(1, Math.min(127, Math.round(drag.base + travel * VELOCITY_PER_PIXEL))),
        };
        velocityDragRef.current = next;
        setVelocityDrag(next);
    }, []);

    const endVelocityDrag = useCallback((event: React.PointerEvent<HTMLButtonElement>) => {
        const drag = velocityDragRef.current;
        if (!drag || drag.pointerId !== event.pointerId) return;
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
        }
        if (drag.moved) {
            suppressClickRef.current = true;
            if (drag.value !== drag.base) {
                updateNote(clip.id, drag.noteId, { velocity: drag.value });
            }
        }
        velocityDragRef.current = null;
        setVelocityDrag(null);
    }, [clip.id, updateNote]);

    // Preview sound on row hover
    const previewSound = useCallback((rowIndex: number) => {
        if (!previewSynth) return;
        const sound = DRUM_SOUNDS[rowIndex];
        previewSynth.triggerAttackRelease(
            Tone.Frequency(sound.pitch, 'midi').toNote(),
            '16n'
        );
    }, [previewSynth]);

    // Apply preset pattern
    const applyPreset = useCallback((presetName: string) => {
        if (!isCompatible) {
            console.warn('[DrumSequencer] Cannot apply preset: clip type is', clip.type);
            return;
        }

        const preset = PATTERN_PRESETS[presetName as keyof typeof PATTERN_PRESETS];
        if (!preset) return;

        // Show active state
        setActivePreset(presetName);

        // Clear existing notes first (copy array to avoid mutation issues)
        const notesToDelete = [...(clip.notes || [])];
        notesToDelete.forEach((note) => {
            deleteNote(clip.id, note.id);
        });

        // Add preset notes after a microtask to ensure deletions are processed
        setTimeout(() => {
            preset.forEach(({ row, steps: stepIndices }) => {
                const sound = DRUM_SOUNDS[row];
                if (!sound) return;

                stepIndices.forEach((stepIndex) => {
                    if (stepIndex < steps) {
                        addNote(clip.id, {
                            pitch: sound.pitch,
                            startBeat: stepIndex / stepsPerBeat,
                            duration: 0.25,
                            velocity: 100,
                        });
                    }
                });
            });

            // Clear active state after a moment
            setTimeout(() => setActivePreset(null), 500);
        }, 0);
    }, [clip.id, clip.type, clip.notes, steps, isCompatible, deleteNote, addNote]);

    // Clear all notes
    const clearAll = useCallback(() => {
        const notesToDelete = [...(clip.notes || [])];
        notesToDelete.forEach((note) => {
            deleteNote(clip.id, note.id);
        });
    }, [clip.id, clip.notes, deleteNote]);

    // Row height constant for alignment
    const ROW_HEIGHT = 28;

    return (
        <div
            className="flex h-full flex-col outline-none"
            tabIndex={0}
            onFocus={() => setEditorFocused(true)}
            onBlur={() => setEditorFocused(false)}
        >
            {/* Incompatible clip warning */}
            {!isCompatible && (
                <div className="flex items-center gap-2 border-b border-warning/30 bg-warning/10 px-3 py-2">
                    <AlertCircle className="h-4 w-4 text-warning" />
                    <span className="text-xs text-warning">
                        {t('incompatible')}
                    </span>
                </div>
            )}

            {/* Toolbar */}
            <div className="flex items-center gap-2 border-b border-border bg-surface px-3 py-1.5">
                <span className="text-xs text-muted-foreground">{t('presets')}</span>
                {Object.keys(PATTERN_PRESETS).map((name) => (
                    <Button
                        key={name}
                        variant={activePreset === name ? 'default' : 'ghost'}
                        size="sm"
                        className={`h-6 text-xs transition-all ${activePreset === name ? 'bg-accent' : ''}`}
                        onClick={() => applyPreset(name)}
                        disabled={!isCompatible}
                    >
                        {activePreset === name && <Check className="mr-1 h-3 w-3" />}
                        {name}
                    </Button>
                ))}
                <DefaultVelocityControl disabled={!isCompatible} />

                <div className="flex-1" />
                <span className="text-xs text-muted-foreground">
                    {t('stepCount', { steps, bars: clip.lengthBars })}
                </span>
                <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs text-destructive hover:text-destructive"
                    onClick={clearAll}
                >
                    {t('clearAll')}
                </Button>
            </div>

            {/* Main content area */}
            <div className="flex flex-col flex-1 overflow-hidden">
                {/* Scrollable grid area */}
                <div className="flex flex-1 overflow-hidden">
                    {/* Row labels - synced vertical scroll with grid */}
                    <div
                        className="w-16 flex-shrink-0 border-r border-border bg-surface overflow-y-auto overflow-x-hidden scrollbar-hide"
                        onScroll={(e) => {
                            // Sync scroll with grid
                            if (gridRef.current) {
                                gridRef.current.scrollTop = e.currentTarget.scrollTop;
                            }
                        }}
                    >
                        <div className="flex flex-col">
                            {DRUM_SOUNDS.map((sound, rowIndex) => (
                                <Tooltip key={sound.name}>
                                    <TooltipTrigger asChild>
                                        <button
                                            className="flex items-center gap-1 px-1.5 text-2xs text-muted-foreground hover:bg-accent/10 hover:text-foreground transition-colors border-b border-border flex-shrink-0"
                                            style={{ height: ROW_HEIGHT }}
                                            onClick={() => previewSound(rowIndex)}
                                        >
                                            <div className={`h-2 w-2 rounded-full ${DRUM_BG[sound.family]}`} />
                                            <span className="truncate">{sound.shortName}</span>
                                        </button>
                                    </TooltipTrigger>
                                    <TooltipContent side="right">
                                        <p>{sound.name}</p>
                                        <p className="text-2xs text-muted-foreground">{t('clickToPreview')}</p>
                                    </TooltipContent>
                                </Tooltip>
                            ))}
                        </div>
                    </div>

                    {/* Step grid - scrollable */}
                    <div
                        ref={gridRef}
                        className="flex-1 overflow-auto"
                        onScroll={(e) => {
                            // Sync vertical scroll with row labels
                            const labelContainer = e.currentTarget.previousElementSibling;
                            if (labelContainer) {
                                labelContainer.scrollTop = e.currentTarget.scrollTop;
                            }
                            // Sync horizontal scroll with beat numbers
                            const beatRow = document.getElementById('drum-beat-numbers');
                            if (beatRow) {
                                beatRow.scrollLeft = e.currentTarget.scrollLeft;
                            }
                            setGridScrollX(e.currentTarget.scrollLeft);
                        }}
                    >
                        <div style={{ width: steps * STEP_WIDTH }}>
                            {/* Only the columns on screen are mounted; the offset
                                keeps them under the right part of the ruler. */}
                            <div
                                className="grid"
                                style={{
                                    marginLeft: visibleSteps.start * STEP_WIDTH,
                                    gridTemplateColumns: `repeat(${visibleStepIndices.length}, ${STEP_WIDTH}px)`,
                                    gridTemplateRows: `repeat(${DRUM_SOUNDS.length}, ${ROW_HEIGHT}px)`,
                                }}
                            >
                                {DRUM_SOUNDS.map((sound, rowIndex) =>
                                    visibleStepIndices.map((stepIndex) => {
                                        const key = `${rowIndex}-${stepIndex}`;
                                        const note = gridState.get(key);
                                        const isActive = !!note;
                                        const isDownbeat = stepIndex % (stepsPerBeat * beatsPerBar) === 0;
                                        const isBeat = stepIndex % stepsPerBeat === 0;
                                        const isBeingDragged =
                                            !!velocityDrag && velocityDrag.noteId === note?.id && velocityDrag.moved;
                                        // Show the in-flight value while its own step is being dragged.
                                        const velocity =
                                            velocityDrag?.noteId && velocityDrag.noteId === note?.id
                                                ? velocityDrag.value
                                                : note?.velocity ?? defaultVelocity;

                                        return (
                                            <button
                                                key={key}
                                                className={`
                                                relative transition-all duration-75 border-b border-r border-border
                                                ${isDownbeat ? 'bg-surface border-l-2 border-l-accent/50' : isBeat ? 'bg-surface/80 border-l border-l-border' : 'bg-background/60'}
                                                ${isActive ? 'cursor-ns-resize' : 'cursor-pointer'}
                                                hover:bg-accent/20
                                            `}
                                                aria-label={
                                                    isActive
                                                        ? t('stepActiveLabel', {
                                                            sound: sound.name,
                                                            step: stepIndex + 1,
                                                            velocity,
                                                        })
                                                        : t('stepEmptyLabel', {
                                                            sound: sound.name,
                                                            step: stepIndex + 1,
                                                        })
                                                }
                                                onClick={() => {
                                                    // A drag already handled this press.
                                                    if (suppressClickRef.current) {
                                                        suppressClickRef.current = false;
                                                        return;
                                                    }
                                                    toggleStep(rowIndex, stepIndex);
                                                }}
                                                onPointerDown={(e) => {
                                                    if (note) beginVelocityDrag(note, e);
                                                }}
                                                onPointerMove={moveVelocityDrag}
                                                onPointerUp={endVelocityDrag}
                                                onPointerCancel={endVelocityDrag}
                                                onPointerEnter={(e) => {
                                                    if (!note) return setHoveredStep(null);
                                                    const r = e.currentTarget.getBoundingClientRect();
                                                    setHoveredStep({
                                                        anchor: { left: r.left, top: r.top, width: r.width, height: r.height },
                                                        sound: sound.name,
                                                        velocity,
                                                    });
                                                }}
                                                onPointerLeave={() => {
                                                    // A drag keeps its readout even once the pointer
                                                    // leaves the cell it started on.
                                                    if (!velocityDragRef.current) setHoveredStep(null);
                                                }}
                                            >
                                                {isActive && (
                                                    <>
                                                        {/* The hit itself, dimmed by how softly it lands */}
                                                        <div
                                                            className={`
                                                            absolute inset-1 rounded-sm ${DRUM_BG[sound.family]}
                                                            transition-opacity
                                                        `}
                                                            style={{
                                                                opacity: 0.35 + (velocity / 127) * 0.65,
                                                            }}
                                                        />
                                                        {/* A level filling from the bottom, so velocity is
                                                            readable at a glance and visibly moves under a
                                                            drag. Opacity alone is hard to judge, and
                                                            impossible to compare between two steps. */}
                                                        <div
                                                            className="pointer-events-none absolute inset-x-1 bottom-1 rounded-b-sm bg-clip-foreground/30"
                                                            style={{
                                                                height: `calc((100% - 0.5rem) * ${velocity / 127})`,
                                                            }}
                                                        />
                                                        {isBeingDragged && (
                                                            <span className="pointer-events-none absolute inset-0 flex items-center justify-center font-mono text-2xs font-bold text-clip-foreground">
                                                                {velocity}
                                                            </span>
                                                        )}
                                                    </>
                                                )}
                                            </button>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Beat numbers row - fixed at bottom, synced horizontal scroll */}
                <div className="flex border-t border-border bg-surface flex-shrink-0">
                    {/* Beat label */}
                    <div className="w-16 flex-shrink-0 flex items-center justify-center border-r border-border h-6">
                        <span className="text-2xs text-muted-foreground">{t('beat')}</span>
                    </div>
                    {/* Beat numbers - horizontal scroll synced with grid */}
                    <div
                        id="drum-beat-numbers"
                        className="flex-1 overflow-x-auto overflow-y-hidden scrollbar-hide"
                    >
                        {/* Virtualized on the same range as the grid, or the
                            numbers drift out of line with the steps they label. */}
                        <div style={{ width: steps * STEP_WIDTH }}>
                        <div
                            className="grid"
                            style={{
                                marginLeft: visibleSteps.start * STEP_WIDTH,
                                gridTemplateColumns: `repeat(${visibleStepIndices.length}, ${STEP_WIDTH}px)`,
                            }}
                        >
                            {visibleStepIndices.map((i) => {
                                const beatNumber = Math.floor(i / stepsPerBeat) + 1;
                                const subBeat = (i % stepsPerBeat) + 1;
                                const isDownbeat = i % (stepsPerBeat * beatsPerBar) === 0;
                                const isBeat = i % stepsPerBeat === 0;

                                let label = '';
                                if (isBeat) {
                                    label = String(beatNumber);
                                } else {
                                    label = '·';
                                }

                                return (
                                    <div
                                        key={i}
                                        className={`
                                        flex h-6 items-center justify-center text-2xs border-r border-border
                                        ${isDownbeat ? 'text-foreground font-medium bg-accent/10' : isBeat ? 'text-foreground' : 'text-muted-foreground/30'}
                                    `}
                                        title={t('stepTooltip', { beat: beatNumber, sub: subBeat, step: i + 1 })}
                                    >
                                        {label}
                                    </div>
                                );
                            })}
                        </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* One tooltip for the whole grid, following the hovered step */}
            <AnchoredTooltip anchor={hoveredStep?.anchor ?? null}>
                {/* Just the number, as in the piano roll's lane. The gesture is
                    already announced by the ns-resize cursor, so spelling it out
                    on every hover is noise. */}
                {velocityDrag && hoveredStep
                    ? velocityDrag.value
                    : hoveredStep?.velocity ?? 0}
            </AnchoredTooltip>
        </div>
    );
}
