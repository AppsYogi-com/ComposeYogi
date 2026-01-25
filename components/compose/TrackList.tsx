'use client';

import { useCallback, useRef, useEffect, useState } from 'react';
import * as Tone from 'tone';
import { useTheme } from 'next-themes';
import { audioEngine } from '@/lib/audio';
import { loadSampleAsAudioTake, loadUserSampleAsAudioTake } from '@/lib/audio/sample-loader';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    type DragEndEvent,
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    useSortable,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
    Volume2,
    VolumeX,
    Headphones,
    Trash2,
    Plus,
    GripVertical,
    Mic
} from 'lucide-react';
import { useProjectStore, useUIStore, usePlaybackStore } from '@/lib/store';
import { playbackRefs } from '@/lib/store/playback';
import { Button } from '@/components/ui';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { DraggableClip } from './DraggableClip';
import { LoopBraces } from './LoopBraces';
import type { Track, TrackColor } from '@/types';

const TRACK_HEIGHT = 80;
const TRACK_HEADER_WIDTH = 180;
const RULER_HEIGHT = 24;
const DEFAULT_PROJECT_BARS = 32;

const TRACK_HEADER_COLORS: Record<TrackColor, string> = {
    drums: '#ef4444',
    bass: '#f97316',
    keys: '#22c55e',
    melody: '#3b82f6',
    vocals: '#a855f7',
    fx: '#ec4899',
};

const FX_ABBR: Record<string, string> = {
    reverb: 'REV',
    delay: 'DLY',
    distortion: 'DIST',
    filter: 'FILT',
    compression: 'COMP',
};

// Demo notes for different instrument types (startBeat is relative to clip start)
// MIDI pitch: C4 = 60, C3 = 48, etc.
function getDemoNotesForInstrument(instrumentId: string): Array<{ pitch: number; startBeat: number; duration: number; velocity: number }> {
    switch (instrumentId) {
        // Piano/Keys - C major chord progression
        case 'electric-piano':
        case 'bright-piano':
            return [
                // C major chord (beat 0)
                { pitch: 60, startBeat: 0, duration: 2, velocity: 100 },
                { pitch: 64, startBeat: 0, duration: 2, velocity: 90 },
                { pitch: 67, startBeat: 0, duration: 2, velocity: 85 },
                // G major chord (beat 2)
                { pitch: 55, startBeat: 2, duration: 2, velocity: 100 },
                { pitch: 59, startBeat: 2, duration: 2, velocity: 90 },
                { pitch: 62, startBeat: 2, duration: 2, velocity: 85 },
                // A minor chord (beat 4)
                { pitch: 57, startBeat: 4, duration: 2, velocity: 100 },
                { pitch: 60, startBeat: 4, duration: 2, velocity: 90 },
                { pitch: 64, startBeat: 4, duration: 2, velocity: 85 },
                // F major chord (beat 6)
                { pitch: 53, startBeat: 6, duration: 2, velocity: 100 },
                { pitch: 57, startBeat: 6, duration: 2, velocity: 90 },
                { pitch: 60, startBeat: 6, duration: 2, velocity: 85 },
            ];

        // Bass - simple bass line
        case 'sub-bass':
        case 'synth-bass':
            return [
                { pitch: 36, startBeat: 0, duration: 1, velocity: 110 },
                { pitch: 36, startBeat: 1.5, duration: 0.5, velocity: 90 },
                { pitch: 43, startBeat: 2, duration: 1, velocity: 110 },
                { pitch: 43, startBeat: 3.5, duration: 0.5, velocity: 90 },
                { pitch: 45, startBeat: 4, duration: 1, velocity: 110 },
                { pitch: 45, startBeat: 5.5, duration: 0.5, velocity: 90 },
                { pitch: 41, startBeat: 6, duration: 1, velocity: 110 },
                { pitch: 41, startBeat: 7.5, duration: 0.5, velocity: 90 },
            ];

        // Lead - melody line
        case 'saw-lead':
        case 'square-lead':
            return [
                { pitch: 72, startBeat: 0, duration: 0.5, velocity: 100 },
                { pitch: 74, startBeat: 0.5, duration: 0.5, velocity: 95 },
                { pitch: 76, startBeat: 1, duration: 1, velocity: 100 },
                { pitch: 74, startBeat: 2.5, duration: 0.5, velocity: 90 },
                { pitch: 72, startBeat: 3, duration: 1, velocity: 100 },
                { pitch: 69, startBeat: 4.5, duration: 0.5, velocity: 95 },
                { pitch: 67, startBeat: 5, duration: 1.5, velocity: 100 },
                { pitch: 65, startBeat: 7, duration: 1, velocity: 90 },
            ];

        // Pads - long sustained chords
        case 'warm-pad':
        case 'string-pad':
            return [
                // C major sustained
                { pitch: 60, startBeat: 0, duration: 8, velocity: 80 },
                { pitch: 64, startBeat: 0, duration: 8, velocity: 75 },
                { pitch: 67, startBeat: 0, duration: 8, velocity: 70 },
            ];

        // Default synth - simple arpeggio
        case 'basic-synth':
        default:
            return [
                { pitch: 60, startBeat: 0, duration: 0.5, velocity: 100 },
                { pitch: 64, startBeat: 0.5, duration: 0.5, velocity: 95 },
                { pitch: 67, startBeat: 1, duration: 0.5, velocity: 100 },
                { pitch: 72, startBeat: 1.5, duration: 0.5, velocity: 95 },
                { pitch: 67, startBeat: 2, duration: 0.5, velocity: 90 },
                { pitch: 64, startBeat: 2.5, duration: 0.5, velocity: 85 },
                { pitch: 60, startBeat: 3, duration: 1, velocity: 100 },
            ];
    }
}

export function TrackList() {
    const { resolvedTheme } = useTheme();
    const project = useProjectStore((s) => s.project);
    const addTrack = useProjectStore((s) => s.addTrack);
    const updateTrack = useProjectStore((s) => s.updateTrack);
    const deleteTrack = useProjectStore((s) => s.deleteTrack);
    const reorderTracks = useProjectStore((s) => s.reorderTracks);
    const selectTrack = useUIStore((s) => s.selectTrack);
    const selectedTrackId = useUIStore((s) => s.selectedTrackId);
    const zoom = useUIStore((s) => s.zoom);
    const zoomIn = useUIStore((s) => s.zoomIn);
    const zoomOut = useUIStore((s) => s.zoomOut);
    const setZoom = useUIStore((s) => s.setZoom);
    const scrollX = useUIStore((s) => s.scrollX);
    const setScrollX = useUIStore((s) => s.setScrollX);
    const setScrollY = useUIStore((s) => s.setScrollY);

    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const rulerCanvasRef = useRef<HTMLCanvasElement>(null);
    const isPlaying = usePlaybackStore((s) => s.isPlaying);
    const isRecording = usePlaybackStore((s) => s.isRecording);
    const positionVersion = usePlaybackStore((s) => s.positionVersion);

    const playheadRef = useRef<HTMLDivElement>(null);
    const animationRef = useRef<number>(0);

    const beatsPerBar = project?.timeSignature[0] || 4;
    const pixelsPerBeat = zoom / beatsPerBar;
    const projectLengthBeats = DEFAULT_PROJECT_BARS * beatsPerBar;

    // DnD sensors for track reordering
    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8, // Require 8px drag before activating
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    // Handle track reorder drag end
    const handleDragEnd = useCallback((event: DragEndEvent) => {
        const { active, over } = event;

        if (over && active.id !== over.id && project) {
            const oldIndex = project.tracks.findIndex((t) => t.id === active.id);
            const newIndex = project.tracks.findIndex((t) => t.id === over.id);

            if (oldIndex !== -1 && newIndex !== -1) {
                const newOrder = arrayMove(
                    project.tracks.map((t) => t.id),
                    oldIndex,
                    newIndex
                );
                reorderTracks(newOrder);
            }
        }
    }, [project, reorderTracks]);

    // Draw ruler on canvas
    const drawRuler = useCallback(() => {
        const canvas = rulerCanvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx || !project) return;

        const dpr = window.devicePixelRatio || 1;
        const width = canvas.clientWidth;
        const height = RULER_HEIGHT;

        canvas.width = width * dpr;
        canvas.height = height * dpr;
        ctx.scale(dpr, dpr);

        // Theme-aware colors
        const isDark = resolvedTheme === 'dark';
        const bgColor = isDark ? 'hsl(0 0% 12%)' : 'hsl(0 0% 96%)';
        const downbeatColor = isDark ? 'hsl(0 0% 50%)' : 'hsl(0 0% 40%)';
        const beatColor = isDark ? 'hsl(0 0% 30%)' : 'hsl(0 0% 70%)';
        const textColor = isDark ? 'hsl(0 0% 60%)' : 'hsl(0 0% 40%)';
        const borderColor = isDark ? 'hsl(0 0% 20%)' : 'hsl(0 0% 85%)';

        // Background
        ctx.fillStyle = bgColor;
        ctx.fillRect(0, 0, width, height);

        const bpb = project.timeSignature[0];
        const totalBeats = Math.max(projectLengthBeats, Math.ceil(300 * (project.bpm / 60)));

        for (let beat = 0; beat <= totalBeats; beat++) {
            const x = beat * pixelsPerBeat;
            if (x > width) break;

            const isDownbeat = beat % bpb === 0;
            const barNumber = Math.floor(beat / bpb) + 1;

            ctx.beginPath();
            ctx.moveTo(x, height);
            ctx.lineTo(x, isDownbeat ? height - 12 : height - 6);
            ctx.strokeStyle = isDownbeat ? downbeatColor : beatColor;
            ctx.lineWidth = 1;
            ctx.stroke();

            if (isDownbeat) {
                ctx.fillStyle = textColor;
                ctx.font = '10px system-ui';
                ctx.fillText(`${barNumber}`, x + 4, 12);
            }
        }

        ctx.beginPath();
        ctx.moveTo(0, height - 0.5);
        ctx.lineTo(width, height - 0.5);
        ctx.strokeStyle = borderColor;
        ctx.lineWidth = 1;
        ctx.stroke();
    }, [project, pixelsPerBeat, projectLengthBeats, resolvedTheme]);

    // Update playhead position (during playback AND recording)
    useEffect(() => {
        const isActive = isPlaying || isRecording;

        const updatePlayhead = () => {
            if (!playheadRef.current || !project) return;

            let time: number;
            // Check both playing and recording refs
            if (playbackRefs.isPlayingRef.current) {
                time = Tone.getTransport().seconds;
                playbackRefs.currentTimeRef.current = time;
            } else {
                time = playbackRefs.currentTimeRef.current;
            }

            const beatsElapsed = (time / 60) * project.bpm;
            const absoluteX = beatsElapsed * pixelsPerBeat;

            playheadRef.current.style.transform = `translate3d(${absoluteX}px, 0, 0)`;

            // Auto-scroll when playhead goes near edge (during playback or recording)
            if (playbackRefs.isPlayingRef.current && scrollContainerRef.current) {
                const viewportWidth = scrollContainerRef.current.clientWidth;
                const currentScrollX = scrollContainerRef.current.scrollLeft;
                const viewportX = absoluteX - currentScrollX;
                const scrollMargin = 100;

                if (viewportX > viewportWidth - scrollMargin) {
                    const newScrollX = absoluteX - viewportWidth * 0.25;
                    scrollContainerRef.current.scrollLeft = Math.max(0, newScrollX);
                }
            }

            if (playbackRefs.isPlayingRef.current) {
                animationRef.current = requestAnimationFrame(updatePlayhead);
            }
        };

        // Initial position update
        updatePlayhead();

        if (isActive) {
            animationRef.current = requestAnimationFrame(updatePlayhead);
        }

        return () => {
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
            }
        };
    }, [isPlaying, isRecording, positionVersion, project, pixelsPerBeat]);

    // Redraw ruler on changes
    useEffect(() => {
        drawRuler();
        const handleResize = () => drawRuler();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [drawRuler]);

    // Handle ruler click to seek
    const seekTo = usePlaybackStore((s) => s.seekTo);
    const handleRulerClick = useCallback((e: React.MouseEvent) => {
        if (!project || !rulerCanvasRef.current) return;

        const rect = rulerCanvasRef.current.getBoundingClientRect();
        // e.clientX - rect.left gives us the position within the visible canvas
        // Since the canvas spans the full content width and scrolls with the container,
        // we don't need to add scrollLeft - the click position is already correct
        const x = e.clientX - rect.left;
        const beat = x / pixelsPerBeat;
        const secondsPerBeat = 60 / project.bpm;
        const time = Math.max(0, beat * secondsPerBeat);

        // Update store and ref (seekTo increments positionVersion to trigger playhead update)
        seekTo(time);
        // Seek the audio engine so playback starts from this position
        audioEngine.seek(time);
    }, [project, pixelsPerBeat, seekTo]);

    // Apply scrollX state to container
    useEffect(() => {
        if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollLeft = scrollX;
            playbackRefs.scrollXRef.current = scrollX;
        }
    }, [scrollX]);

    // Handle scroll
    const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
        const target = e.target as HTMLDivElement;
        playbackRefs.scrollXRef.current = target.scrollLeft;
        setScrollX(target.scrollLeft);
        setScrollY(target.scrollTop);
    }, [setScrollX, setScrollY]);

    // Handle mouse wheel zoom (Ctrl/Cmd + scroll)
    const handleWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
        // Only zoom when Ctrl (Windows/Linux) or Cmd (Mac) is held
        if (!e.ctrlKey && !e.metaKey) return;

        e.preventDefault();

        // Get cursor position relative to scroll container
        const container = scrollContainerRef.current;
        if (!container) return;

        const rect = container.getBoundingClientRect();
        const cursorX = e.clientX - rect.left + container.scrollLeft;

        // Calculate the beat position under cursor before zoom
        const beatUnderCursor = cursorX / pixelsPerBeat;

        // Determine zoom direction and apply
        const MIN_ZOOM = 20;
        const MAX_ZOOM = 200;
        const ZOOM_STEP = 1.15;

        const newZoom = e.deltaY < 0
            ? Math.min(MAX_ZOOM, zoom * ZOOM_STEP)  // Scroll up = zoom in
            : Math.max(MIN_ZOOM, zoom / ZOOM_STEP); // Scroll down = zoom out

        if (newZoom === zoom) return;

        // Calculate new pixelsPerBeat
        const newPixelsPerBeat = newZoom / beatsPerBar;

        // Calculate new scroll position to keep cursor at same beat position
        const newCursorX = beatUnderCursor * newPixelsPerBeat;
        const cursorOffsetFromLeft = e.clientX - rect.left;
        const newScrollX = Math.max(0, newCursorX - cursorOffsetFromLeft);

        // Apply zoom and scroll
        setZoom(newZoom);
        setScrollX(newScrollX);
    }, [zoom, pixelsPerBeat, beatsPerBar, setZoom, setScrollX]);

    const handleAddTrack = useCallback(() => {
        addTrack('midi', `Track ${(project?.tracks.length || 0) + 1}`);
    }, [addTrack, project?.tracks.length]);

    const handleMuteToggle = useCallback((track: Track) => {
        updateTrack(track.id, { muted: !track.muted });
    }, [updateTrack]);

    const handleSoloToggle = useCallback((track: Track) => {
        updateTrack(track.id, { solo: !track.solo });
    }, [updateTrack]);

    const handleArmToggle = useCallback((track: Track) => {
        const currentlyArmed = project?.tracks.find(t => t.armed && t.id !== track.id);
        if (currentlyArmed) {
            updateTrack(currentlyArmed.id, { armed: false });
        }
        updateTrack(track.id, { armed: !track.armed });
    }, [updateTrack, project?.tracks]);

    const handleVolumeChange = useCallback((track: Track, volume: number) => {
        updateTrack(track.id, { volume });
    }, [updateTrack]);

    const handleDeleteTrack = useCallback((trackId: string) => {
        deleteTrack(trackId);
    }, [deleteTrack]);

    if (!project) return null;

    const contentWidth = Math.max(projectLengthBeats, Math.ceil(300 * (project.bpm / 60))) * pixelsPerBeat;
    const trackIds = project.tracks.map((t) => t.id);

    return (
        <div className="flex flex-1 overflow-hidden">
            {/* Track headers column (fixed left) */}
            <div
                className="flex flex-col border-r border-border bg-surface flex-shrink-0"
                style={{ width: TRACK_HEADER_WIDTH }}
            >
                {/* Ruler spacer */}
                <div
                    className="border-b border-border bg-surface"
                    style={{ height: RULER_HEIGHT }}
                />

                {/* Track headers with drag-to-reorder */}
                <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                >
                    <SortableContext items={trackIds} strategy={verticalListSortingStrategy}>
                        <div className="flex-1 overflow-y-auto overflow-x-hidden">
                            {project.tracks.map((track) => (
                                <SortableTrackHeader
                                    key={track.id}
                                    track={track}
                                    isSelected={selectedTrackId === track.id}
                                    onSelect={() => selectTrack(track.id)}
                                    onMuteToggle={() => handleMuteToggle(track)}
                                    onSoloToggle={() => handleSoloToggle(track)}
                                    onArmToggle={() => handleArmToggle(track)}
                                    onVolumeChange={(v) => handleVolumeChange(track, v)}
                                    onDelete={() => handleDeleteTrack(track.id)}
                                />
                            ))}

                            <button
                                onClick={handleAddTrack}
                                className="flex w-full items-center justify-center gap-2 border-b border-border py-4 text-sm text-muted-foreground transition-colors hover:bg-surface-elevated hover:text-foreground"
                            >
                                <Plus className="h-4 w-4" />
                                Add Track
                            </button>
                        </div>
                    </SortableContext>
                </DndContext>
            </div>

            {/* Scrollable content area (ruler + tracks scroll together horizontally) */}
            <div
                ref={scrollContainerRef}
                className="relative flex-1 overflow-auto bg-background"
                onScroll={handleScroll}
                onWheel={handleWheel}
            >
                {/* Content wrapper with full width */}
                <div
                    className="relative"
                    style={{
                        width: contentWidth,
                        minHeight: `${RULER_HEIGHT + project.tracks.length * TRACK_HEIGHT + 100}px`,
                    }}
                >
                    {/* Sticky ruler (stays at top while scrolling vertically) */}
                    <div
                        className="sticky top-0 z-20 border-b border-border relative"
                        style={{ height: RULER_HEIGHT }}
                    >
                        <canvas
                            ref={rulerCanvasRef}
                            className="h-full cursor-pointer"
                            style={{ width: contentWidth, height: RULER_HEIGHT }}
                            onClick={handleRulerClick}
                        />
                        {/* Loop braces overlay */}
                        <LoopBraces
                            pixelsPerBar={pixelsPerBeat * beatsPerBar}
                            rulerHeight={RULER_HEIGHT}
                        />
                    </div>

                    {/* Track lanes area */}
                    <div className="relative">
                        {/* Grid lines */}
                        <GridLines
                            bpm={project.bpm}
                            timeSignature={project.timeSignature}
                            pixelsPerBeat={pixelsPerBeat}
                            trackCount={project.tracks.length}
                            projectLengthBeats={projectLengthBeats}
                        />

                        {/* Track lanes */}
                        {project.tracks.map((track, index) => (
                            <TrackLane
                                key={track.id}
                                track={track}
                                index={index}
                                pixelsPerBeat={pixelsPerBeat}
                                beatsPerBar={beatsPerBar}
                                isSelected={selectedTrackId === track.id}
                                onSelect={() => selectTrack(track.id)}
                            />
                        ))}
                    </div>

                    {/* Single unified playhead (ruler + tracks) */}
                    <div
                        ref={playheadRef}
                        className="playhead-unified"
                        style={{
                            transform: 'translate3d(0, 0, 0)',
                            top: 0,
                            height: `${RULER_HEIGHT + project.tracks.length * TRACK_HEIGHT}px`
                        }}
                    />
                </div>
            </div>
        </div>
    );
}

// ============================================
// Sub-components
// ============================================

interface TrackHeaderProps {
    track: Track;
    isSelected: boolean;
    onSelect: () => void;
    onMuteToggle: () => void;
    onSoloToggle: () => void;
    onArmToggle: () => void;
    onVolumeChange: (volume: number) => void;
    onDelete: () => void;
}

function _TrackHeader({
    track,
    isSelected,
    onSelect,
    onMuteToggle,
    onSoloToggle,
    onArmToggle,
    onVolumeChange,
    onDelete,
}: TrackHeaderProps) {
    return (
        <div
            className={`flex flex-col border-b border-border p-2 transition-colors ${isSelected ? 'bg-accent/10' : 'hover:bg-surface-elevated'
                }`}
            style={{ height: TRACK_HEIGHT }}
            onClick={onSelect}
        >
            <div className="flex items-center gap-1">
                <GripVertical className="h-4 w-4 cursor-grab text-muted-foreground/50" />
                <div
                    className="h-3 w-3 rounded-sm"
                    style={{ backgroundColor: TRACK_HEADER_COLORS[track.color] || '#888' }}
                />
                <span className="flex-1 truncate text-sm font-medium">
                    {track.name}
                </span>
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5 text-muted-foreground hover:text-destructive"
                    onClick={(e) => {
                        e.stopPropagation();
                        onDelete();
                    }}
                >
                    <Trash2 className="h-3 w-3" />
                </Button>
            </div>

            {/* Active Effects Indicators */}
            <div className="flex flex-wrap gap-1 mt-1 pl-6 h-[18px] overflow-hidden">
                {track.effects?.filter((fx) => fx.active).map((fx) => (
                    <div
                        key={fx.id}
                        className="text-[9px] font-bold px-1 rounded-[2px] bg-pink-500/10 text-pink-500 border border-pink-500/20 flex items-center justify-center uppercase tracking-wider"
                        title={`${fx.type} active`}
                    >
                        {FX_ABBR[fx.type] || fx.type.substring(0, 3)}
                    </div>
                ))}
            </div>

            <div className="mt-auto flex items-center gap-1">
                <Button
                    variant="ghost"
                    size="icon"
                    className={`h-6 w-6 ${track.muted ? 'text-destructive' : 'text-muted-foreground'}`}
                    onClick={(e) => {
                        e.stopPropagation();
                        onMuteToggle();
                    }}
                    title="Mute"
                >
                    {track.muted ? (
                        <VolumeX className="h-3.5 w-3.5" />
                    ) : (
                        <Volume2 className="h-3.5 w-3.5" />
                    )}
                </Button>

                <Button
                    variant="ghost"
                    size="icon"
                    className={`h-6 w-6 ${track.solo ? 'text-accent' : 'text-muted-foreground'}`}
                    onClick={(e) => {
                        e.stopPropagation();
                        onSoloToggle();
                    }}
                    title="Solo"
                >
                    <Headphones className="h-3.5 w-3.5" />
                </Button>

                {track.type === 'audio' && (
                    <Button
                        variant="ghost"
                        size="icon"
                        className={`h-6 w-6 ${track.armed ? 'text-destructive animate-pulse' : 'text-muted-foreground'}`}
                        onClick={(e) => {
                            e.stopPropagation();
                            onArmToggle();
                        }}
                        title={track.armed ? 'Disarm' : 'Arm for recording'}
                    >
                        <Mic className="h-3.5 w-3.5" />
                    </Button>
                )}

                <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={track.volume}
                    onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
                    onClick={(e) => e.stopPropagation()}
                    className="h-1 flex-1 cursor-pointer appearance-none rounded-full bg-muted [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary"
                />
            </div>
        </div>
    );
}

// Sortable wrapper for TrackHeader with drag-to-reorder
function SortableTrackHeader(props: TrackHeaderProps) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: props.track.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        zIndex: isDragging ? 100 : 'auto',
    };

    return (
        <div ref={setNodeRef} style={style} {...attributes}>
            <div
                className={`flex flex-col border-b border-border p-2 transition-colors ${props.isSelected ? 'bg-accent/10' : 'hover:bg-surface-elevated'
                    } ${isDragging ? 'shadow-lg ring-2 ring-accent' : ''}`}
                style={{ height: TRACK_HEIGHT }}
                onClick={props.onSelect}
            >
                <div className="flex items-center gap-1">
                    {/* Drag handle */}
                    <div
                        {...listeners}
                        className="cursor-grab active:cursor-grabbing touch-none"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <GripVertical className="h-4 w-4 text-muted-foreground/50 hover:text-muted-foreground" />
                    </div>
                    <div
                        className="h-3 w-3 rounded-sm"
                        style={{ backgroundColor: TRACK_HEADER_COLORS[props.track.color] || '#888' }}
                    />
                    <span className="flex-1 truncate text-sm font-medium">
                        {props.track.name}
                    </span>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5 text-muted-foreground hover:text-destructive"
                        onClick={(e) => {
                            e.stopPropagation();
                            props.onDelete();
                        }}
                    >
                        <Trash2 className="h-3 w-3" />
                    </Button>
                </div>

                <div className="mt-auto flex items-center gap-1">
                    <Button
                        variant="ghost"
                        size="icon"
                        className={`h-6 w-6 ${props.track.muted ? 'text-destructive' : 'text-muted-foreground'}`}
                        onClick={(e) => {
                            e.stopPropagation();
                            props.onMuteToggle();
                        }}
                        title="Mute"
                    >
                        {props.track.muted ? (
                            <VolumeX className="h-3.5 w-3.5" />
                        ) : (
                            <Volume2 className="h-3.5 w-3.5" />
                        )}
                    </Button>

                    <Button
                        variant="ghost"
                        size="icon"
                        className={`h-6 w-6 ${props.track.solo ? 'text-accent' : 'text-muted-foreground'}`}
                        onClick={(e) => {
                            e.stopPropagation();
                            props.onSoloToggle();
                        }}
                        title="Solo"
                    >
                        <Headphones className="h-3.5 w-3.5" />
                    </Button>

                    {props.track.type === 'audio' && (
                        <Button
                            variant="ghost"
                            size="icon"
                            className={`h-6 w-6 ${props.track.armed ? 'text-destructive animate-pulse' : 'text-muted-foreground'}`}
                            onClick={(e) => {
                                e.stopPropagation();
                                props.onArmToggle();
                            }}
                            title={props.track.armed ? 'Disarm' : 'Arm for recording'}
                        >
                            <Mic className="h-3.5 w-3.5" />
                        </Button>
                    )}

                    <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.01}
                        value={props.track.volume}
                        onChange={(e) => props.onVolumeChange(parseFloat(e.target.value))}
                        onClick={(e) => e.stopPropagation()}
                        className="h-1 flex-1 cursor-pointer appearance-none rounded-full bg-muted [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary"
                    />
                </div>

                {/* Active Effects Indicators */}
                {props.track.effects && props.track.effects.filter((fx) => fx.active).length > 0 && (
                    <TooltipProvider delayDuration={200}>
                        <div className="flex items-center gap-1 overflow-hidden">
                            {props.track.effects.filter((fx) => fx.active).slice(0, 3).map((fx) => (
                                <Tooltip key={fx.id}>
                                    <TooltipTrigger asChild>
                                        <div
                                            className="text-[9px] font-bold px-1 rounded-[2px] bg-pink-500/20 text-pink-400 border border-pink-500/30 flex items-center justify-center uppercase tracking-wider shrink-0 cursor-default"
                                        >
                                            {FX_ABBR[fx.type] || fx.type.substring(0, 3).toUpperCase()}
                                        </div>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <p className="capitalize">{fx.type}</p>
                                    </TooltipContent>
                                </Tooltip>
                            ))}
                            {props.track.effects.filter((fx) => fx.active).length > 3 && (
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <div
                                            className="text-[9px] font-bold px-1 rounded-[2px] bg-muted text-muted-foreground flex items-center justify-center shrink-0 cursor-default"
                                        >
                                            +{props.track.effects.filter((fx) => fx.active).length - 3}
                                        </div>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <p className="capitalize">{props.track.effects.filter((fx) => fx.active).slice(3).map(fx => fx.type).join(', ')}</p>
                                    </TooltipContent>
                                </Tooltip>
                            )}
                        </div>
                    </TooltipProvider>
                )}
            </div>
        </div>
    );
}

interface TrackLaneProps {
    track: Track;
    index: number;
    pixelsPerBeat: number;
    beatsPerBar: number;
    isSelected: boolean;
    onSelect: () => void;
}

function TrackLane({ track, index, pixelsPerBeat, beatsPerBar, isSelected, onSelect }: TrackLaneProps) {
    const project = useProjectStore((s) => s.project);
    const addClip = useProjectStore((s) => s.addClip);
    const addNote = useProjectStore((s) => s.addNote);
    const updateTrack = useProjectStore((s) => s.updateTrack);
    const addTrackEffect = useProjectStore((s) => s.addTrackEffect);
    const clearSelection = useUIStore((s) => s.clearSelection);
    const selectClip = useUIStore((s) => s.selectClip);
    const openEditor = useUIStore((s) => s.openEditor);
    const [isDragOver, setIsDragOver] = useState(false);

    const handleLaneClick = useCallback((e: React.MouseEvent) => {
        if (e.target === e.currentTarget) {
            clearSelection();
        }
        onSelect();
    }, [clearSelection, onSelect]);

    // Double-click to create new clip
    const handleDoubleClick = useCallback((e: React.MouseEvent) => {
        if (!project) return;
        if (e.target !== e.currentTarget) return; // Only on empty area

        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const beat = x / pixelsPerBeat;
        const bar = Math.floor(beat / beatsPerBar);

        // Determine clip type based on track type/color
        let clipType: 'midi' | 'drum' | 'audio' = 'midi';
        if (track.type === 'audio') {
            clipType = 'audio';
        } else if (track.color === 'drums') {
            clipType = 'drum';
        }

        const clip = addClip(track.id, clipType, bar, 1); // 1 bar clip
        selectClip(clip.id);
        openEditor(clip.id);
    }, [project, track.id, track.type, track.color, pixelsPerBeat, beatsPerBar, addClip, selectClip, openEditor]);

    // Handle drag over
    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
        setIsDragOver(true);
    }, []);

    const handleDragLeave = useCallback(() => {
        setIsDragOver(false);
    }, []);

    // Handle drop from browser panel
    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(false);

        try {
            const data = JSON.parse(e.dataTransfer.getData('application/json'));

            // Calculate bar position from drop location
            const rect = e.currentTarget.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const beat = x / pixelsPerBeat;
            const bar = Math.floor(beat / beatsPerBar);

            if (data.type === 'sample') {
                const sampleName = data.data.name;
                const sampleUrl = data.data.url;

                if (!sampleUrl) {
                    console.error('[TrackLane] Dropped sample has no URL');
                    return;
                }

                // 1. Create a "loading" audio clip first (placeholder)
                // We default to 1 bar length, but will update when audio loads
                const clip = addClip(track.id, 'audio', bar, 1);

                // 2. Set name immediately
                useProjectStore.getState().updateClip(clip.id, { name: sampleName });
                selectClip(clip.id);


                // 3. Load the audio data
                loadSampleAsAudioTake(sampleUrl, sampleName, clip.id)
                    .then((take) => {
                        // 4. Update clip with correct duration and link to take
                        const durationInBars = audioEngine.secondsToBar(take.duration);
                        // Use exact fractional bars for audio clips so visual width matches audio duration
                        const lengthBars = Math.max(0.25, durationInBars);

                        useProjectStore.getState().updateClip(clip.id, {
                            audioTakeIds: [take.id],
                            activeTakeId: take.id,
                            lengthBars: lengthBars, // Auto-size to fit sample
                        });
                    })
                    .catch((err) => {
                        console.error('[TrackLane] Failed to load sample audio:', err);
                        // Optionally remove the placeholder clip on failure
                        // useProjectStore.getState().deleteClip(clip.id);
                    });

            } else if (data.type === 'instrument') {
                // Update track's instrument preset
                updateTrack(track.id, { instrumentPreset: data.data.id });

                // Create MIDI clip for instrument
                const clipType = track.color === 'drums' ? 'drum' : 'midi';
                const clip = addClip(track.id, clipType, bar, 2); // 2 bar default

                // Add demo notes so user hears something immediately
                const instrumentId = data.data.id as string;
                const demoNotes = getDemoNotesForInstrument(instrumentId);
                demoNotes.forEach(note => addNote(clip.id, note));

                selectClip(clip.id);
                openEditor(clip.id);
            } else if (data.type === 'fx') {
                // Add effect to track
                const preset = data.data;
                addTrackEffect(track.id, preset.category, preset.id);
            } else if (data.type === 'user-sample') {
                // Handle user-imported samples from IndexedDB
                const sampleId = data.data.id;
                const sampleName = data.data.name;
                const sampleDuration = data.data.duration;

                if (!sampleId) {
                    console.error('[TrackLane] Dropped user sample has no ID');
                    return;
                }

                // 1. Create audio clip with estimated duration
                const estimatedBars = audioEngine.secondsToBar(sampleDuration || 2);
                const clip = addClip(track.id, 'audio', bar, Math.max(0.25, estimatedBars));

                // 2. Set name immediately
                useProjectStore.getState().updateClip(clip.id, { name: sampleName });
                selectClip(clip.id);

                // 3. Load user sample from IndexedDB as AudioTake
                loadUserSampleAsAudioTake(sampleId, clip.id)
                    .then((take) => {
                        // 4. Update clip with correct duration and link to take
                        const durationInBars = audioEngine.secondsToBar(take.duration);
                        const lengthBars = Math.max(0.25, durationInBars);

                        useProjectStore.getState().updateClip(clip.id, {
                            audioTakeIds: [take.id],
                            activeTakeId: take.id,
                            lengthBars: lengthBars,
                        });
                    })
                    .catch((err) => {
                        console.error('[TrackLane] Failed to load user sample:', err);
                    });
            }
        } catch (err) {
            console.error('[TrackLane] Failed to parse drop data:', err);
        }
    }, [track.id, track.color, pixelsPerBeat, beatsPerBar, addClip, addNote, selectClip, openEditor, updateTrack, addTrackEffect]);

    if (!project) return null;

    const clips = project.clips.filter((c) => c.trackId === track.id);

    return (
        <div
            className={`absolute left-0 right-0 border-b border-border/50 transition-colors ${isSelected ? 'bg-accent/5' : ''
                } ${track.muted ? 'opacity-50' : ''} ${isDragOver ? 'bg-accent/20 ring-1 ring-accent ring-inset' : ''
                }`}
            style={{
                top: index * TRACK_HEIGHT,
                height: TRACK_HEIGHT,
            }}
            onClick={handleLaneClick}
            onDoubleClick={handleDoubleClick}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
        >
            {clips.map((clip) => (
                <DraggableClip
                    key={clip.id}
                    clip={clip}
                    track={track}
                    pixelsPerBeat={pixelsPerBeat}
                    beatsPerBar={beatsPerBar}
                />
            ))}
        </div>
    );
}

interface GridLinesProps {
    bpm: number;
    timeSignature: [number, number];
    pixelsPerBeat: number;
    trackCount: number;
    projectLengthBeats: number;
}

function GridLines({ bpm, timeSignature, pixelsPerBeat, trackCount, projectLengthBeats }: GridLinesProps) {
    const beatsPerBar = timeSignature[0];
    const totalBeats = Math.max(projectLengthBeats, Math.ceil(300 * (bpm / 60)));
    const lines = [];
    const totalHeight = trackCount * TRACK_HEIGHT;

    // Vertical lines for beats/bars
    for (let beat = 0; beat <= totalBeats; beat++) {
        const isDownbeat = beat % beatsPerBar === 0;
        const x = beat * pixelsPerBeat;

        lines.push(
            <div
                key={beat}
                className={`grid-line ${isDownbeat ? 'downbeat' : 'bar'}`}
                style={{ left: x, height: totalHeight }}
            />
        );
    }

    // Horizontal lines for track separators
    for (let i = 0; i <= trackCount; i++) {
        lines.push(
            <div
                key={`h-${i}`}
                className="absolute left-0 right-0 h-px bg-border/30"
                style={{ top: i * TRACK_HEIGHT }}
            />
        );
    }

    return (
        <div className="absolute inset-0 pointer-events-none" style={{ height: totalHeight }}>
            {lines}
        </div>
    );
}
