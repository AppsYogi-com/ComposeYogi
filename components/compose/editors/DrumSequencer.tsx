'use client';

import { useCallback, useMemo, useRef, useState, useEffect } from 'react';
import { Check, AlertCircle } from 'lucide-react';
import { useProjectStore, useUIStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import type { Clip, Note } from '@/types';
import * as Tone from 'tone';

// ============================================
// Drum Sound Definitions (General MIDI Percussion)
// Full GM percussion set: MIDI notes 35-81
// ============================================

interface DrumSound {
    name: string;
    shortName: string;
    pitch: number; // MIDI note number
    color: string;
}

// Full General MIDI Percussion Map (organized by category)
const DRUM_SOUNDS: DrumSound[] = [
    // Kicks (35-36)
    { name: 'Acoustic Bass Drum', shortName: 'BD1', pitch: 35, color: 'bg-red-600' },
    { name: 'Bass Drum 1', shortName: 'BD2', pitch: 36, color: 'bg-red-500' },

    // Snares & Rim (37-40)
    { name: 'Side Stick', shortName: 'STK', pitch: 37, color: 'bg-orange-600' },
    { name: 'Acoustic Snare', shortName: 'SN1', pitch: 38, color: 'bg-orange-500' },
    { name: 'Hand Clap', shortName: 'CLP', pitch: 39, color: 'bg-pink-500' },
    { name: 'Electric Snare', shortName: 'SN2', pitch: 40, color: 'bg-orange-400' },

    // Toms (41, 43, 45, 47, 48, 50)
    { name: 'Low Floor Tom', shortName: 'LFT', pitch: 41, color: 'bg-purple-600' },
    { name: 'High Floor Tom', shortName: 'HFT', pitch: 43, color: 'bg-purple-500' },
    { name: 'Low Tom', shortName: 'LTM', pitch: 45, color: 'bg-purple-400' },
    { name: 'Low-Mid Tom', shortName: 'LMT', pitch: 47, color: 'bg-purple-300' },
    { name: 'Hi-Mid Tom', shortName: 'HMT', pitch: 48, color: 'bg-violet-400' },
    { name: 'High Tom', shortName: 'HTM', pitch: 50, color: 'bg-violet-300' },

    // Hi-Hats (42, 44, 46)
    { name: 'Closed Hi-Hat', shortName: 'CHH', pitch: 42, color: 'bg-yellow-500' },
    { name: 'Pedal Hi-Hat', shortName: 'PHH', pitch: 44, color: 'bg-yellow-400' },
    { name: 'Open Hi-Hat', shortName: 'OHH', pitch: 46, color: 'bg-yellow-600' },

    // Cymbals (49, 51, 52, 53, 55, 57, 59)
    { name: 'Crash Cymbal 1', shortName: 'CR1', pitch: 49, color: 'bg-cyan-500' },
    { name: 'Ride Cymbal 1', shortName: 'RD1', pitch: 51, color: 'bg-cyan-400' },
    { name: 'Chinese Cymbal', shortName: 'CHN', pitch: 52, color: 'bg-cyan-600' },
    { name: 'Ride Bell', shortName: 'RBL', pitch: 53, color: 'bg-sky-400' },
    { name: 'Splash Cymbal', shortName: 'SPL', pitch: 55, color: 'bg-sky-500' },
    { name: 'Crash Cymbal 2', shortName: 'CR2', pitch: 57, color: 'bg-cyan-300' },
    { name: 'Ride Cymbal 2', shortName: 'RD2', pitch: 59, color: 'bg-sky-300' },

    // Latin - Bongos & Congas (60-64)
    { name: 'Hi Bongo', shortName: 'HBG', pitch: 60, color: 'bg-amber-500' },
    { name: 'Low Bongo', shortName: 'LBG', pitch: 61, color: 'bg-amber-600' },
    { name: 'Mute Hi Conga', shortName: 'MHC', pitch: 62, color: 'bg-orange-700' },
    { name: 'Open Hi Conga', shortName: 'OHC', pitch: 63, color: 'bg-amber-700' },
    { name: 'Low Conga', shortName: 'LCG', pitch: 64, color: 'bg-amber-800' },

    // Latin - Timbales (65-66)
    { name: 'High Timbale', shortName: 'HTB', pitch: 65, color: 'bg-rose-400' },
    { name: 'Low Timbale', shortName: 'LTB', pitch: 66, color: 'bg-rose-500' },

    // Latin - Agogo & Bells (67-68, 56)
    { name: 'High Agogo', shortName: 'HAG', pitch: 67, color: 'bg-emerald-400' },
    { name: 'Low Agogo', shortName: 'LAG', pitch: 68, color: 'bg-emerald-500' },
    { name: 'Cowbell', shortName: 'COW', pitch: 56, color: 'bg-lime-500' },

    // Shakers & Tambourine (54, 69-71)
    { name: 'Tambourine', shortName: 'TMB', pitch: 54, color: 'bg-yellow-300' },
    { name: 'Cabasa', shortName: 'CAB', pitch: 69, color: 'bg-green-400' },
    { name: 'Maracas', shortName: 'MRC', pitch: 70, color: 'bg-green-500' },
    { name: 'Short Whistle', shortName: 'SWH', pitch: 71, color: 'bg-blue-300' },

    // More Percussion (72-81)
    { name: 'Long Whistle', shortName: 'LWH', pitch: 72, color: 'bg-blue-400' },
    { name: 'Short Guiro', shortName: 'SGU', pitch: 73, color: 'bg-lime-400' },
    { name: 'Long Guiro', shortName: 'LGU', pitch: 74, color: 'bg-lime-600' },
    { name: 'Claves', shortName: 'CLV', pitch: 75, color: 'bg-red-400' },
    { name: 'Hi Wood Block', shortName: 'HWB', pitch: 76, color: 'bg-amber-300' },
    { name: 'Low Wood Block', shortName: 'LWB', pitch: 77, color: 'bg-amber-400' },
    { name: 'Mute Cuica', shortName: 'MCU', pitch: 78, color: 'bg-fuchsia-400' },
    { name: 'Open Cuica', shortName: 'OCU', pitch: 79, color: 'bg-fuchsia-500' },
    { name: 'Mute Triangle', shortName: 'MTR', pitch: 80, color: 'bg-indigo-300' },
    { name: 'Open Triangle', shortName: 'OTR', pitch: 81, color: 'bg-indigo-400' },
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
    const addNote = useProjectStore((s) => s.addNote);
    const deleteNote = useProjectStore((s) => s.deleteNote);
    const updateNote = useProjectStore((s) => s.updateNote);
    const project = useProjectStore((s) => s.project);
    const setEditorFocused = useUIStore((s) => s.setEditorFocused);

    const [_velocityEditing, setVelocityEditing] = useState<string | null>(null);
    const [previewSynth, setPreviewSynth] = useState<Tone.MembraneSynth | null>(null);
    const [activePreset, setActivePreset] = useState<string | null>(null);
    const gridRef = useRef<HTMLDivElement>(null);

    // Check if clip type is compatible
    const isCompatible = clip.type === 'drum' || clip.type === 'midi';

    // Calculate steps based on clip length and time signature
    const beatsPerBar = project?.timeSignature[0] || 4;
    const stepsPerBeat = 4; // 16th notes
    const totalSteps = clip.lengthBars * beatsPerBar * stepsPerBeat;
    const steps = Math.min(totalSteps, 64); // Cap at 64 steps for performance

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
                velocity: 100,
            });

            // Play preview
            if (previewSynth) {
                previewSynth.triggerAttackRelease(
                    Tone.Frequency(sound.pitch, 'midi').toNote(),
                    '16n'
                );
            }
        }
    }, [clip.id, gridState, deleteNote, addNote, previewSynth]);

    // Handle velocity change via drag
    const _handleVelocityDrag = useCallback((noteId: string, deltaY: number) => {
        const note = clip.notes?.find((n) => n.id === noteId);
        if (!note) return;

        const newVelocity = Math.max(1, Math.min(127, note.velocity - deltaY));
        updateNote(clip.id, noteId, { velocity: newVelocity });
    }, [clip.id, clip.notes, updateNote]);

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
                <div className="flex items-center gap-2 border-b border-yellow-500/30 bg-yellow-500/10 px-3 py-2">
                    <AlertCircle className="h-4 w-4 text-yellow-500" />
                    <span className="text-xs text-yellow-500">
                        This is an audio clip. Switch to a MIDI or Drum clip to use the drum sequencer, or change the clip type.
                    </span>
                </div>
            )}

            {/* Toolbar */}
            <div className="flex items-center gap-2 border-b border-border bg-surface px-3 py-1.5">
                <span className="text-xs text-muted-foreground">Presets:</span>
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
                <div className="flex-1" />
                <span className="text-xs text-muted-foreground">
                    {steps} steps ({clip.lengthBars} bar{clip.lengthBars > 1 ? 's' : ''})
                </span>
                <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs text-destructive hover:text-destructive"
                    onClick={clearAll}
                >
                    Clear All
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
                                            <div className={`h-2 w-2 rounded-full ${sound.color}`} />
                                            <span className="truncate">{sound.shortName}</span>
                                        </button>
                                    </TooltipTrigger>
                                    <TooltipContent side="right">
                                        <p>{sound.name}</p>
                                        <p className="text-2xs text-muted-foreground">Click to preview</p>
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
                        }}
                    >
                        <div style={{ minWidth: steps * 28 }}>
                            {/* Grid */}
                            <div
                                className="grid"
                                style={{
                                    gridTemplateColumns: `repeat(${steps}, 1fr)`,
                                    gridTemplateRows: `repeat(${DRUM_SOUNDS.length}, ${ROW_HEIGHT}px)`,
                                }}
                            >
                                {DRUM_SOUNDS.map((sound, rowIndex) =>
                                    Array.from({ length: steps }).map((_, stepIndex) => {
                                        const key = `${rowIndex}-${stepIndex}`;
                                        const note = gridState.get(key);
                                        const isActive = !!note;
                                        const isDownbeat = stepIndex % (stepsPerBeat * beatsPerBar) === 0;
                                        const isBeat = stepIndex % stepsPerBeat === 0;
                                        const velocity = note?.velocity ?? 100;

                                        return (
                                            <button
                                                key={key}
                                                className={`
                                                relative transition-all duration-75 border-b border-r border-border
                                                ${isDownbeat ? 'bg-surface border-l-2 border-l-accent/50' : isBeat ? 'bg-surface/80 border-l border-l-border' : 'bg-background/60'}
                                                hover:bg-accent/20
                                            `}
                                                onClick={() => toggleStep(rowIndex, stepIndex)}
                                                onContextMenu={(e) => {
                                                    e.preventDefault();
                                                    if (note) {
                                                        setVelocityEditing(note.id);
                                                    }
                                                }}
                                            >
                                                {isActive && (
                                                    <div
                                                        className={`
                                                        absolute inset-1 rounded-sm ${sound.color}
                                                        transition-opacity
                                                    `}
                                                        style={{
                                                            opacity: 0.5 + (velocity / 127) * 0.5,
                                                        }}
                                                    />
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
                        <span className="text-2xs text-muted-foreground">Beat</span>
                    </div>
                    {/* Beat numbers - horizontal scroll synced with grid */}
                    <div
                        id="drum-beat-numbers"
                        className="flex-1 overflow-x-auto overflow-y-hidden scrollbar-hide"
                    >
                        <div
                            className="grid"
                            style={{
                                gridTemplateColumns: `repeat(${steps}, 1fr)`,
                                minWidth: steps * 28,
                            }}
                        >
                            {Array.from({ length: steps }).map((_, i) => {
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
                                        title={`Beat ${beatNumber}.${subBeat} (Step ${i + 1})`}
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
    );
}
