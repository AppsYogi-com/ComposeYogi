'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useTheme } from 'next-themes';
import { Activity, AudioWaveform, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { usePlaybackStore, useUIStore } from '@/lib/store';
import { playoutManager } from '@/lib/audio';

type VisualizerMode = 'bars' | 'waveform';

const CANVAS_HEIGHT = 160;
const BAR_COUNT = 64;
const BAR_GAP = 2;

export function AudioVisualizer() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const animationRef = useRef<number | null>(null);
    const [mode, setMode] = useState<VisualizerMode>('bars');
    const { resolvedTheme } = useTheme();
    const isPlaying = usePlaybackStore((s) => s.isPlaying);
    const visualizerOpen = useUIStore((s) => s.visualizerOpen);
    const toggleVisualizer = useUIStore((s) => s.toggleVisualizer);

    // Get theme colors
    const getColors = useCallback(() => {
        const isDark = resolvedTheme === 'dark';
        return {
            background: isDark ? 'hsl(240 10% 4%)' : 'hsl(0 0% 98%)',
            foreground: isDark ? 'hsl(0 0% 98%)' : 'hsl(240 10% 4%)',
            primary: 'hsl(36 100% 50%)', // Orange accent
            muted: isDark ? 'hsl(240 4% 16%)' : 'hsl(240 5% 84%)',
            border: isDark ? 'hsl(240 4% 16%)' : 'hsl(240 6% 90%)',
        };
    }, [resolvedTheme]);

    // Draw frequency bars
    const drawBars = useCallback((ctx: CanvasRenderingContext2D, dataArray: Float32Array, width: number, height: number) => {
        const colors = getColors();
        const barWidth = (width - (BAR_COUNT - 1) * BAR_GAP) / BAR_COUNT;
        const step = Math.floor(dataArray.length / BAR_COUNT);

        ctx.fillStyle = colors.background;
        ctx.fillRect(0, 0, width, height);

        for (let i = 0; i < BAR_COUNT; i++) {
            // Get average of frequency bin range
            let sum = 0;
            for (let j = 0; j < step; j++) {
                sum += dataArray[i * step + j];
            }
            const value = sum / step;

            // Convert dB to normalized value (0-1)
            // FFT values are typically -100 to 0 dB
            const normalizedValue = Math.max(0, (value + 100) / 100);
            const barHeight = normalizedValue * height * 0.9;

            const x = i * (barWidth + BAR_GAP);
            const y = height - barHeight;

            // Gradient from muted to primary based on intensity
            const intensity = normalizedValue;
            if (intensity > 0.01) {
                ctx.fillStyle = intensity > 0.5 ? colors.primary : colors.muted;
                ctx.fillRect(x, y, barWidth, barHeight);
            } else {
                // Show minimal bars when quiet
                ctx.fillStyle = colors.muted;
                ctx.fillRect(x, height - 2, barWidth, 2);
            }
        }
    }, [getColors]);

    // Draw waveform
    const drawWaveform = useCallback((ctx: CanvasRenderingContext2D, dataArray: Float32Array, width: number, height: number) => {
        const colors = getColors();

        ctx.fillStyle = colors.background;
        ctx.fillRect(0, 0, width, height);

        ctx.beginPath();
        ctx.strokeStyle = colors.primary;
        ctx.lineWidth = 2;

        const centerY = height / 2;
        const sliceWidth = width / dataArray.length;
        let x = 0;

        // Convert frequency data to waveform-like display
        for (let i = 0; i < dataArray.length; i++) {
            const value = dataArray[i];
            // Normalize and scale
            const normalizedValue = Math.max(0, (value + 100) / 100);
            const y = centerY + (normalizedValue - 0.5) * height * 0.8;

            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }

            x += sliceWidth;
        }

        ctx.stroke();

        // Draw center line
        ctx.beginPath();
        ctx.strokeStyle = colors.muted;
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.moveTo(0, centerY);
        ctx.lineTo(width, centerY);
        ctx.stroke();
        ctx.setLineDash([]);
    }, [getColors]);

    // Animation loop
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || !visualizerOpen) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const analyser = playoutManager.getAnalyser();

        const draw = () => {
            const width = canvas.width;
            const height = canvas.height;

            if (analyser && isPlaying) {
                const dataArray = analyser.getValue() as Float32Array;

                if (mode === 'bars') {
                    drawBars(ctx, dataArray, width, height);
                } else {
                    drawWaveform(ctx, dataArray, width, height);
                }
            } else {
                // Draw idle state
                const colors = getColors();
                ctx.fillStyle = colors.background;
                ctx.fillRect(0, 0, width, height);

                if (mode === 'bars') {
                    // Draw minimal idle bars
                    const barWidth = (width - (BAR_COUNT - 1) * BAR_GAP) / BAR_COUNT;
                    ctx.fillStyle = colors.muted;
                    for (let i = 0; i < BAR_COUNT; i++) {
                        const x = i * (barWidth + BAR_GAP);
                        ctx.fillRect(x, height - 2, barWidth, 2);
                    }
                } else {
                    // Draw center line
                    ctx.beginPath();
                    ctx.strokeStyle = colors.muted;
                    ctx.lineWidth = 1;
                    ctx.setLineDash([4, 4]);
                    ctx.moveTo(0, height / 2);
                    ctx.lineTo(width, height / 2);
                    ctx.stroke();
                    ctx.setLineDash([]);
                }
            }

            animationRef.current = requestAnimationFrame(draw);
        };

        draw();

        return () => {
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
            }
        };
    }, [isPlaying, mode, visualizerOpen, drawBars, drawWaveform, getColors]);

    // Handle canvas resize
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const resizeObserver = new ResizeObserver((entries) => {
            for (const entry of entries) {
                const { width } = entry.contentRect;
                canvas.width = width * window.devicePixelRatio;
                canvas.height = CANVAS_HEIGHT * window.devicePixelRatio;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
                }
            }
        });

        resizeObserver.observe(canvas);
        return () => resizeObserver.disconnect();
    }, []);

    const colors = getColors();

    return (
        <div
            className="border-t border-border bg-background flex flex-col"
            style={{ borderColor: colors.border }}
        >
            {/* Header with controls */}
            <div className="flex items-center justify-between px-3 py-1.5 border-b border-border">
                <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Visualizer
                    </span>
                    {isPlaying && (
                        <span className="flex items-center gap-1 text-xs text-primary">
                            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                            Live
                        </span>
                    )}
                </div>

                <div className="flex items-center gap-1">
                    {/* Mode toggle */}
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon-sm"
                                onClick={() => setMode(mode === 'bars' ? 'waveform' : 'bars')}
                                className={mode === 'bars' ? 'text-primary' : ''}
                            >
                                <Activity className="h-3.5 w-3.5" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent side="top">
                            <p>Frequency Bars</p>
                        </TooltipContent>
                    </Tooltip>

                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon-sm"
                                onClick={() => setMode(mode === 'waveform' ? 'bars' : 'waveform')}
                                className={mode === 'waveform' ? 'text-primary' : ''}
                            >
                                <AudioWaveform className="h-3.5 w-3.5" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent side="top">
                            <p>Waveform</p>
                        </TooltipContent>
                    </Tooltip>

                    {/* Collapse toggle */}
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon-sm"
                                onClick={toggleVisualizer}
                            >
                                <ChevronDown className="h-3.5 w-3.5" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent side="top">
                            <p>Hide Visualizer <kbd className="ml-1 text-xs opacity-60">V</kbd></p>
                        </TooltipContent>
                    </Tooltip>
                </div>
            </div>

            {/* Canvas */}
            <canvas
                ref={canvasRef}
                className="w-full"
                style={{ height: CANVAS_HEIGHT }}
            />
        </div>
    );
}

// Collapsed bar to show visualizer
export function VisualizerCollapsedBar() {
    const toggleVisualizer = useUIStore((s) => s.toggleVisualizer);

    return (
        <div className="border-t border-border bg-background">
            <button
                onClick={toggleVisualizer}
                className="w-full flex items-center justify-center gap-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            >
                <ChevronUp className="h-3 w-3" />
                <span className="text-[10px] tracking-wider">VISUALISER</span>
                <kbd className="px-1 py-0.5 text-[10px] font-mono bg-muted border border-border rounded">V</kbd>
            </button>
        </div>
    );
}
