'use client';

import { useCallback, useRef, useState, useEffect, useMemo } from 'react';
import {
    ZoomIn,
    ZoomOut,
    Play,
    Square,
    Scissors,
    RotateCcw,
    Volume2,
    X,
    Repeat
} from 'lucide-react';
import { useProjectStore } from '@/lib/store';
import { getAudioTake } from '@/lib/audio';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import type { Clip } from '@/types';
import * as Tone from 'tone';

// ============================================
// Types
// ============================================

interface WaveformEditorProps {
    clip: Clip;
}

interface TrimHandles {
    startOffset: number; // seconds from original start
    endOffset: number;   // seconds from original end
}

// ============================================
// Waveform Editor Component
// ============================================

export function WaveformEditor({ clip }: WaveformEditorProps) {
    const project = useProjectStore((s) => s.project);
    const updateClip = useProjectStore((s) => s.updateClip);

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [zoom, setZoom] = useState(1);
    const [scrollX, setScrollX] = useState(0);
    const [player, setPlayer] = useState<Tone.Player | null>(null);
    const [gainNode, setGainNode] = useState<Tone.Gain | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [playheadPosition, setPlayheadPosition] = useState(0);

    // Trim/fade state
    const [trimHandles, setTrimHandles] = useState<TrimHandles>({
        startOffset: 0,
        endOffset: 0,
    });
    const [fadeIn, setFadeIn] = useState(0); // seconds
    const [fadeOut, setFadeOut] = useState(0); // seconds
    const [isDraggingTrim, setIsDraggingTrim] = useState<'start' | 'end' | null>(null);

    // Selection state for click-and-drag region
    const [selection, setSelection] = useState<{ start: number; end: number } | null>(null);
    const [isSelecting, setIsSelecting] = useState(false);
    const selectionStartRef = useRef<number>(0);
    const [isLooping, setIsLooping] = useState(false);
    const playbackRef = useRef<number | null>(null);

    // Calculate dimensions
    const bpm = project?.bpm || 120;
    const beatsPerBar = project?.timeSignature[0] || 4;
    const secondsPerBeat = 60 / bpm;
    const clipDuration = clip.lengthBars * beatsPerBar * secondsPerBeat;

    // Load audio buffer
    useEffect(() => {
        async function loadAudio() {
            if (!clip.activeTakeId) {
                setError('No audio data');
                setIsLoading(false);
                return;
            }

            try {
                setIsLoading(true);
                const take = getAudioTake(clip.activeTakeId);

                if (!take) {
                    setError('Audio take not found');
                    setIsLoading(false);
                    return;
                }

                // Decode audio
                const arrayBuffer = take.audioData.slice().buffer;
                const audioContext = Tone.getContext().rawContext;
                const buffer = await audioContext.decodeAudioData(arrayBuffer);

                setAudioBuffer(buffer);
                setError(null);

                // Create player with gain node for fades
                const toneBuffer = new Tone.ToneAudioBuffer(buffer);
                const newGain = new Tone.Gain(1).toDestination();
                const newPlayer = new Tone.Player(toneBuffer).connect(newGain);
                setPlayer(newPlayer);
                setGainNode(newGain);

            } catch (err) {
                console.error('[WaveformEditor] Failed to load audio:', err);
                setError('Failed to load audio');
            } finally {
                setIsLoading(false);
            }
        }

        loadAudio();

        return () => {
            if (player) {
                player.stop();
                player.dispose();
            }
            if (gainNode) {
                gainNode.dispose();
            }
        };
    }, [clip.activeTakeId]);

    // Draw waveform
    useEffect(() => {
        if (!canvasRef.current || !audioBuffer) return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const dpr = window.devicePixelRatio || 1;
        const containerWidth = containerRef.current?.clientWidth || 800;
        const displayWidth = Math.max(containerWidth * zoom, containerWidth);
        const displayHeight = canvas.parentElement?.clientHeight || 150;

        canvas.width = displayWidth * dpr;
        canvas.height = displayHeight * dpr;
        canvas.style.width = `${displayWidth}px`;
        canvas.style.height = `${displayHeight}px`;
        ctx.scale(dpr, dpr);

        // Clear
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(0, 0, displayWidth, displayHeight);

        // Get channel data
        const channelData = audioBuffer.getChannelData(0);
        const duration = audioBuffer.duration;
        const samplesPerPixel = Math.ceil(channelData.length / displayWidth);

        // Calculate peaks
        const centerY = displayHeight / 2;
        const amplitude = (displayHeight / 2) - 10;

        // Find global peak for normalization
        let globalPeak = 0;
        for (let i = 0; i < channelData.length; i++) {
            const abs = Math.abs(channelData[i]);
            if (abs > globalPeak) globalPeak = abs;
        }
        const scale = globalPeak > 0 ? 1 / globalPeak : 1;

        // Draw waveform
        ctx.fillStyle = '#f97316'; // Orange accent
        ctx.globalAlpha = 0.8;
        ctx.beginPath();
        ctx.moveTo(0, centerY);

        // Draw top half
        for (let i = 0; i < displayWidth; i++) {
            const start = Math.floor(i * samplesPerPixel);
            const end = Math.min(start + samplesPerPixel, channelData.length);

            let max = 0;
            for (let j = start; j < end; j++) {
                if (channelData[j] > max) max = channelData[j];
            }

            const y = centerY - (max * scale * amplitude);
            ctx.lineTo(i, y);
        }

        // Draw bottom half (backwards)
        for (let i = displayWidth - 1; i >= 0; i--) {
            const start = Math.floor(i * samplesPerPixel);
            const end = Math.min(start + samplesPerPixel, channelData.length);

            let min = 0;
            for (let j = start; j < end; j++) {
                if (channelData[j] < min) min = channelData[j];
            }

            const y = centerY - (min * scale * amplitude);
            ctx.lineTo(i, y);
        }

        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = 1;

        // Draw trim overlays
        const trimStartX = (trimHandles.startOffset / duration) * displayWidth;
        const trimEndX = displayWidth - (trimHandles.endOffset / duration) * displayWidth;

        // Dimmed areas for trimmed regions
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.fillRect(0, 0, trimStartX, displayHeight);
        ctx.fillRect(trimEndX, 0, displayWidth - trimEndX, displayHeight);

        // Trim handles
        ctx.fillStyle = '#3b82f6';
        ctx.fillRect(trimStartX - 2, 0, 4, displayHeight);
        ctx.fillRect(trimEndX - 2, 0, 4, displayHeight);

        // Fade curves
        if (fadeIn > 0) {
            const fadeInWidth = (fadeIn / duration) * displayWidth;
            ctx.fillStyle = 'rgba(59, 130, 246, 0.3)';
            ctx.beginPath();
            ctx.moveTo(trimStartX, displayHeight);
            ctx.lineTo(trimStartX, 0);
            ctx.lineTo(trimStartX + fadeInWidth, displayHeight / 2);
            ctx.lineTo(trimStartX, displayHeight);
            ctx.fill();
        }

        if (fadeOut > 0) {
            const fadeOutWidth = (fadeOut / duration) * displayWidth;
            ctx.fillStyle = 'rgba(59, 130, 246, 0.3)';
            ctx.beginPath();
            ctx.moveTo(trimEndX, displayHeight);
            ctx.lineTo(trimEndX, 0);
            ctx.lineTo(trimEndX - fadeOutWidth, displayHeight / 2);
            ctx.lineTo(trimEndX, displayHeight);
            ctx.fill();
        }

        // Draw selection region
        if (selection) {
            const selStartX = (selection.start / duration) * displayWidth;
            const selEndX = (selection.end / duration) * displayWidth;
            const selLeft = Math.min(selStartX, selEndX);
            const selWidth = Math.abs(selEndX - selStartX);

            // Selection highlight
            ctx.fillStyle = 'rgba(59, 130, 246, 0.25)';
            ctx.fillRect(selLeft, 0, selWidth, displayHeight);

            // Selection borders
            ctx.strokeStyle = '#3b82f6';
            ctx.lineWidth = 1;
            ctx.strokeRect(selLeft, 0, selWidth, displayHeight);
        }

        // Time markers
        ctx.fillStyle = '#666';
        ctx.font = '10px system-ui';
        const secondsVisible = duration * zoom;
        const markerInterval = secondsVisible > 10 ? 1 : 0.5;

        for (let t = 0; t <= duration; t += markerInterval) {
            const x = (t / duration) * displayWidth;
            ctx.fillRect(x, displayHeight - 15, 1, 5);
            ctx.fillText(`${t.toFixed(1)}s`, x + 3, displayHeight - 3);
        }

        // Playhead
        if (playheadPosition > 0) {
            const playheadX = (playheadPosition / duration) * displayWidth;
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(playheadX, 0);
            ctx.lineTo(playheadX, displayHeight);;
            ctx.stroke();
        }

    }, [audioBuffer, zoom, trimHandles, fadeIn, fadeOut, playheadPosition, selection]);

    // Handle trim drag and region selection
    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        if (!containerRef.current || !audioBuffer) return;

        const rect = containerRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left + scrollX;
        const containerWidth = rect.width * zoom;
        const duration = audioBuffer.duration;

        const trimStartX = (trimHandles.startOffset / duration) * containerWidth;
        const trimEndX = containerWidth - (trimHandles.endOffset / duration) * containerWidth;

        // Check if clicking near trim handles (priority)
        if (Math.abs(x - trimStartX) < 10) {
            setIsDraggingTrim('start');
            setSelection(null);
        } else if (Math.abs(x - trimEndX) < 10) {
            setIsDraggingTrim('end');
            setSelection(null);
        } else {
            // Start region selection
            const timeAtX = Math.max(0, Math.min((x / containerWidth) * duration, duration));
            selectionStartRef.current = timeAtX;
            setSelection({ start: timeAtX, end: timeAtX });
            setIsSelecting(true);
        }
    }, [audioBuffer, zoom, scrollX, trimHandles]);

    const handleMouseMove = useCallback((e: React.MouseEvent) => {
        if (!containerRef.current || !audioBuffer) return;

        const rect = containerRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left + scrollX;
        const containerWidth = rect.width * zoom;
        const duration = audioBuffer.duration;

        // Handle trim dragging
        if (isDraggingTrim) {
            const timeAtX = (x / containerWidth) * duration;

            if (isDraggingTrim === 'start') {
                setTrimHandles((prev) => ({
                    ...prev,
                    startOffset: Math.max(0, Math.min(timeAtX, duration - prev.endOffset - 0.1)),
                }));
            } else if (isDraggingTrim === 'end') {
                setTrimHandles((prev) => ({
                    ...prev,
                    endOffset: Math.max(0, Math.min(duration - timeAtX, duration - prev.startOffset - 0.1)),
                }));
            }
            return;
        }

        // Handle region selection
        if (isSelecting) {
            const timeAtX = Math.max(0, Math.min((x / containerWidth) * duration, duration));
            setSelection({
                start: selectionStartRef.current,
                end: timeAtX,
            });
        }
    }, [isDraggingTrim, isSelecting, audioBuffer, zoom, scrollX]);

    const handleMouseUp = useCallback(() => {
        if (isDraggingTrim) {
            setIsDraggingTrim(null);
        }
        if (isSelecting) {
            setIsSelecting(false);
            // Normalize selection (start < end)
            if (selection && selection.start !== selection.end) {
                setSelection({
                    start: Math.min(selection.start, selection.end),
                    end: Math.max(selection.start, selection.end),
                });
            } else {
                // Clear selection if it's just a click (no drag)
                setSelection(null);
            }
        }
    }, [isDraggingTrim, isSelecting, selection]);

    // Stop playback
    const stopPlayback = useCallback(() => {
        if (player) {
            player.stop();
        }
        if (gainNode) {
            gainNode.gain.cancelScheduledValues(Tone.now());
            gainNode.gain.setValueAtTime(1, Tone.now());
        }
        if (playbackRef.current) {
            cancelAnimationFrame(playbackRef.current);
            playbackRef.current = null;
        }
        setIsPlaying(false);
        setPlayheadPosition(0);
    }, [player, gainNode]);

    // Preview playback - plays selection if exists, otherwise trimmed region
    const togglePlayback = useCallback(() => {
        if (!player || !audioBuffer || !gainNode) return;

        if (isPlaying) {
            stopPlayback();
        } else {
            // Determine what to play: selection takes priority, then trimmed region
            let startTime: number;
            let duration: number;
            let applyFades = false;

            if (selection) {
                // Play selection (no fades for selection preview)
                startTime = Math.min(selection.start, selection.end);
                const endTime = Math.max(selection.start, selection.end);
                duration = endTime - startTime;
            } else {
                // Play trimmed region with fades
                startTime = trimHandles.startOffset;
                duration = audioBuffer.duration - trimHandles.startOffset - trimHandles.endOffset;
                applyFades = true;
            }

            const playOnce = () => {
                const now = Tone.now();

                // Reset and schedule gain automation for fades
                gainNode.gain.cancelScheduledValues(now);

                if (applyFades && (fadeIn > 0 || fadeOut > 0)) {
                    // Fade in
                    if (fadeIn > 0) {
                        gainNode.gain.setValueAtTime(0, now);
                        gainNode.gain.linearRampToValueAtTime(1, now + fadeIn);
                    } else {
                        gainNode.gain.setValueAtTime(1, now);
                    }

                    // Fade out
                    if (fadeOut > 0) {
                        const fadeOutStart = now + duration - fadeOut;
                        gainNode.gain.setValueAtTime(1, fadeOutStart);
                        gainNode.gain.linearRampToValueAtTime(0, now + duration);
                    }
                } else {
                    gainNode.gain.setValueAtTime(1, now);
                }

                player.start(now, startTime, duration);
                setIsPlaying(true);

                // Animate playhead
                const startNow = Tone.now();
                const animate = () => {
                    const elapsed = Tone.now() - startNow;
                    if (elapsed < duration) {
                        setPlayheadPosition(startTime + elapsed);
                        playbackRef.current = requestAnimationFrame(animate);
                    } else if (isLooping && selection) {
                        // Loop: restart
                        setPlayheadPosition(startTime);
                        playOnce();
                    } else {
                        setPlayheadPosition(0);
                        setIsPlaying(false);
                        // Reset gain after playback
                        gainNode.gain.cancelScheduledValues(Tone.now());
                        gainNode.gain.setValueAtTime(1, Tone.now());
                    }
                };
                playbackRef.current = requestAnimationFrame(animate);
            };

            playOnce();
        }
    }, [player, audioBuffer, gainNode, isPlaying, trimHandles, selection, isLooping, fadeIn, fadeOut, stopPlayback]);

    // Trim to selection - snap trim handles to selection bounds
    const trimToSelection = useCallback(() => {
        if (!selection || !audioBuffer) return;

        const start = Math.min(selection.start, selection.end);
        const end = Math.max(selection.start, selection.end);

        setTrimHandles({
            startOffset: start,
            endOffset: audioBuffer.duration - end,
        });
        setSelection(null);
    }, [selection, audioBuffer]);

    // Clear selection
    const clearSelection = useCallback(() => {
        setSelection(null);
        setIsLooping(false);
    }, []);

    // Reset trim/fade
    const resetAll = useCallback(() => {
        setTrimHandles({ startOffset: 0, endOffset: 0 });
        setFadeIn(0);
        setFadeOut(0);
        setSelection(null);
        setIsLooping(false);
    }, []);

    // Zoom controls
    const zoomIn = () => setZoom((z) => Math.min(z * 1.5, 10));
    const zoomOut = () => setZoom((z) => Math.max(z / 1.5, 1));

    if (isLoading) {
        return (
            <div className="flex h-full items-center justify-center">
                <div className="text-center">
                    <div className="mb-2 h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent mx-auto" />
                    <p className="text-sm text-muted-foreground">Loading audio...</p>
                </div>
            </div>
        );
    }

    if (error || !audioBuffer) {
        return (
            <div className="flex h-full items-center justify-center">
                <div className="text-center">
                    <Volume2 className="mx-auto mb-2 h-12 w-12 text-muted-foreground/30" />
                    <p className="text-sm text-muted-foreground">
                        {error || 'No audio data available'}
                    </p>
                </div>
            </div>
        );
    }

    const effectiveDuration = audioBuffer.duration - trimHandles.startOffset - trimHandles.endOffset;

    return (
        <div className="flex h-full flex-col">
            {/* Toolbar */}
            <div className="flex items-center gap-3 border-b border-border bg-surface px-3 py-1.5">
                {/* Playback */}
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                            variant={isPlaying ? 'default' : 'ghost'}
                            size="icon-sm"
                            onClick={togglePlayback}
                        >
                            {isPlaying ? (
                                <Square className="h-3 w-3 fill-current" />
                            ) : (
                                <Play className="h-3.5 w-3.5" />
                            )}
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                        {isPlaying ? 'Stop' : selection ? 'Play Selection' : 'Preview'}
                    </TooltipContent>
                </Tooltip>

                {/* Loop toggle - only when selection exists */}
                {selection && (
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant={isLooping ? 'default' : 'ghost'}
                                size="icon-sm"
                                onClick={() => setIsLooping(!isLooping)}
                            >
                                <Repeat className="h-3.5 w-3.5" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>Loop Selection</TooltipContent>
                    </Tooltip>
                )}

                <div className="h-4 w-px bg-border" />

                {/* Selection actions */}
                {selection && (
                    <>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={trimToSelection}
                                    className="h-7 gap-1.5 text-xs"
                                >
                                    <Scissors className="h-3.5 w-3.5" />
                                    Trim to Selection
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>Set trim handles to selection bounds</TooltipContent>
                        </Tooltip>

                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon-sm"
                                    onClick={clearSelection}
                                >
                                    <X className="h-3.5 w-3.5" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>Clear Selection</TooltipContent>
                        </Tooltip>

                        <div className="h-4 w-px bg-border" />

                        <span className="text-xs text-muted-foreground">
                            Selection: {Math.abs(selection.end - selection.start).toFixed(2)}s
                        </span>

                        <div className="h-4 w-px bg-border" />
                    </>
                )}

                {/* Info */}
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>Duration: {effectiveDuration.toFixed(2)}s</span>
                    <span>Sample Rate: {audioBuffer.sampleRate}Hz</span>
                </div>

                <div className="flex-1" />

                {/* Fade controls */}
                <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Fade In:</span>
                    <Slider
                        value={[fadeIn]}
                        onValueChange={([v]) => setFadeIn(v)}
                        min={0}
                        max={Math.min(2, effectiveDuration / 2)}
                        step={0.05}
                        className="w-20"
                    />
                    <span className="w-8 text-xs text-muted-foreground">{fadeIn.toFixed(1)}s</span>
                </div>

                <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Fade Out:</span>
                    <Slider
                        value={[fadeOut]}
                        onValueChange={([v]) => setFadeOut(v)}
                        min={0}
                        max={Math.min(2, effectiveDuration / 2)}
                        step={0.05}
                        className="w-20"
                    />
                    <span className="w-8 text-xs text-muted-foreground">{fadeOut.toFixed(1)}s</span>
                </div>

                <div className="h-4 w-px bg-border" />

                {/* Reset */}
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon-sm" onClick={resetAll}>
                            <RotateCcw className="h-3.5 w-3.5" />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>Reset All</TooltipContent>
                </Tooltip>

                {/* Zoom */}
                <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon-sm" onClick={zoomOut}>
                        <ZoomOut className="h-3.5 w-3.5" />
                    </Button>
                    <span className="w-10 text-center text-xs text-muted-foreground">
                        {Math.round(zoom * 100)}%
                    </span>
                    <Button variant="ghost" size="icon-sm" onClick={zoomIn}>
                        <ZoomIn className="h-3.5 w-3.5" />
                    </Button>
                </div>
            </div>

            {/* Waveform display */}
            <div
                ref={containerRef}
                className="flex-1 overflow-x-auto overflow-y-hidden bg-background cursor-crosshair"
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onScroll={(e) => setScrollX(e.currentTarget.scrollLeft)}
            >
                <canvas ref={canvasRef} className="block" />
            </div>

            {/* Info bar */}
            <div className="flex items-center justify-between border-t border-border bg-surface px-3 py-1">
                <span className="text-xs text-muted-foreground">
                    Trim Start: {trimHandles.startOffset.toFixed(2)}s
                </span>
                <span className="text-xs text-muted-foreground">
                    {selection
                        ? `Selected: ${Math.min(selection.start, selection.end).toFixed(2)}s - ${Math.max(selection.start, selection.end).toFixed(2)}s`
                        : 'Drag handles to trim • Click & drag to select'
                    }
                </span>
                <span className="text-xs text-muted-foreground">
                    Trim End: {trimHandles.endOffset.toFixed(2)}s
                </span>
            </div>
        </div>
    );
}
