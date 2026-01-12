// ============================================
// ComposeYogi — Audio Clip Component
// Renders audio clip with waveform visualization
// Supports trimmed regions and fade curves
// ============================================

'use client';

import { useRef, useEffect, useState, memo } from 'react';
import type { Clip, Track } from '@/types';
import { getAudioTake } from '@/lib/audio';
import * as Tone from 'tone';

interface AudioClipProps {
    clip: Clip;
    track: Track; // Kept in props for future use (waveform color from track, etc.)
    width: number;
    height: number;
    color: string;
    // Trim/fade props (in seconds)
    trimStart?: number;
    trimEnd?: number;
    fadeIn?: number;
    fadeOut?: number;
    sourceDuration?: number; // Full audio duration before trim
}

export const AudioClip = memo(function AudioClip({
    clip,
    track: _track, // Unused currently but part of interface for future use
    width,
    height,
    color,
    trimStart = 0,
    trimEnd = 0,
    fadeIn = 0,
    fadeOut = 0,
    sourceDuration,
}: AudioClipProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [_audioDuration, setAudioDuration] = useState<number>(sourceDuration || 0);


    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || !clip.activeTakeId) {
            return;
        }

        // Ensure minimum dimensions
        const renderWidth = Math.max(1, Math.floor(width));
        const renderHeight = Math.max(1, Math.floor(height));

        const ctx = canvas.getContext('2d');
        if (!ctx) {
            return;
        }

        const dpr = window.devicePixelRatio || 1;
        canvas.width = renderWidth * dpr;
        canvas.height = renderHeight * dpr;
        ctx.scale(dpr, dpr);

        // Get audio take
        const take = getAudioTake(clip.activeTakeId);
        if (!take) {
            setError('Audio data not found');
            setIsLoading(false);
            return;
        }


        // Decode audio and render waveform
        const renderWaveform = async () => {
            try {
                setIsLoading(true);

                // Create ArrayBuffer from Uint8Array
                const arrayBuffer = new ArrayBuffer(take.audioData.byteLength);
                new Uint8Array(arrayBuffer).set(take.audioData);

                // Decode audio
                const audioContext = Tone.getContext().rawContext;
                const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

                const fullDuration = audioBuffer.duration;
                setAudioDuration(fullDuration);

                // Calculate trimmed region
                const effectiveTrimStart = Math.min(trimStart, fullDuration);
                const effectiveTrimEnd = Math.min(trimEnd, fullDuration - effectiveTrimStart);
                const trimmedDuration = Math.max(0, fullDuration - effectiveTrimStart - effectiveTrimEnd);

                if (trimmedDuration <= 0) {
                    console.warn('[AudioClip] Trimmed duration is 0 or negative');
                    setIsLoading(false);
                    return;
                }

                // Get channel data
                const channelData = audioBuffer.getChannelData(0);
                const sampleRate = audioBuffer.sampleRate;

                // Calculate sample indices for trimmed region
                const startSample = Math.floor(effectiveTrimStart * sampleRate);
                const endSample = Math.floor((fullDuration - effectiveTrimEnd) * sampleRate);
                const trimmedSampleCount = endSample - startSample;

                // Calculate samples per pixel for the trimmed region
                const samplesPerPixel = Math.ceil(trimmedSampleCount / renderWidth);

                // Calculate peaks for trimmed region only
                const peaks: { min: number; max: number }[] = [];
                let globalMin = 0;
                let globalMax = 0;

                for (let i = 0; i < renderWidth; i++) {
                    const sampleStart = startSample + (i * samplesPerPixel);
                    const sampleEnd = Math.min(sampleStart + samplesPerPixel, endSample);

                    let min = Infinity;
                    let max = -Infinity;

                    for (let j = sampleStart; j < sampleEnd; j++) {
                        if (j < channelData.length) {
                            const sample = channelData[j];
                            if (sample < min) min = sample;
                            if (sample > max) max = sample;
                        }
                    }

                    const minVal = min === Infinity ? 0 : min;
                    const maxVal = max === -Infinity ? 0 : max;

                    peaks.push({ min: minVal, max: maxVal });

                    if (minVal < globalMin) globalMin = minVal;
                    if (maxVal > globalMax) globalMax = maxVal;
                }

                // Normalize peaks to fill the visible area
                // Find the peak amplitude (max of abs(min) and abs(max))
                const peakAmplitude = Math.max(Math.abs(globalMin), Math.abs(globalMax), 0.001);
                const scaleFactor = 1 / peakAmplitude; // Scale to fill -1 to 1 range

                // Render waveform
                ctx.clearRect(0, 0, renderWidth, renderHeight);

                const centerY = renderHeight / 2;
                const amplitude = (renderHeight / 2) - 4; // Leave 4px padding

                ctx.fillStyle = color;
                ctx.globalAlpha = 0.8;
                ctx.beginPath();

                // Draw top half (max values) - normalized
                for (let i = 0; i < peaks.length; i++) {
                    const x = i;
                    const normalizedMax = peaks[i].max * scaleFactor;
                    const y = centerY - normalizedMax * amplitude;
                    if (i === 0) {
                        ctx.moveTo(x, y);
                    } else {
                        ctx.lineTo(x, y);
                    }
                }

                // Draw bottom half (min values) - backwards, normalized
                for (let i = peaks.length - 1; i >= 0; i--) {
                    const x = i;
                    const normalizedMin = peaks[i].min * scaleFactor;
                    const y = centerY - normalizedMin * amplitude;
                    ctx.lineTo(x, y);
                }

                ctx.closePath();
                ctx.fill();

                // === Draw Fade Curves ===
                // Calculate fade widths in pixels (relative to trimmed duration)
                const fadeInPixels = trimmedDuration > 0 ? (fadeIn / trimmedDuration) * renderWidth : 0;
                const fadeOutPixels = trimmedDuration > 0 ? (fadeOut / trimmedDuration) * renderWidth : 0;

                // Fade In curve (left side)
                if (fadeInPixels > 2) {
                    const gradient = ctx.createLinearGradient(0, 0, fadeInPixels, 0);
                    gradient.addColorStop(0, 'rgba(0, 0, 0, 0.6)');
                    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
                    ctx.fillStyle = gradient;
                    ctx.fillRect(0, 0, fadeInPixels, renderHeight);

                    // Draw fade curve line
                    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
                    ctx.lineWidth = 1.5;
                    ctx.beginPath();
                    ctx.moveTo(0, renderHeight);
                    // Exponential curve for fade in
                    for (let x = 0; x <= fadeInPixels; x++) {
                        const t = x / fadeInPixels;
                        const y = renderHeight * (1 - Math.pow(t, 0.5)); // sqrt curve
                        ctx.lineTo(x, y);
                    }
                    ctx.stroke();
                }

                // Fade Out curve (right side)
                if (fadeOutPixels > 2) {
                    const fadeOutStart = renderWidth - fadeOutPixels;
                    const gradient = ctx.createLinearGradient(fadeOutStart, 0, renderWidth, 0);
                    gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
                    gradient.addColorStop(1, 'rgba(0, 0, 0, 0.6)');
                    ctx.fillStyle = gradient;
                    ctx.fillRect(fadeOutStart, 0, fadeOutPixels, renderHeight);

                    // Draw fade curve line
                    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
                    ctx.lineWidth = 1.5;
                    ctx.beginPath();
                    ctx.moveTo(fadeOutStart, 0);
                    // Exponential curve for fade out
                    for (let x = 0; x <= fadeOutPixels; x++) {
                        const t = x / fadeOutPixels;
                        const y = renderHeight * Math.pow(t, 0.5); // sqrt curve
                        ctx.lineTo(fadeOutStart + x, y);
                    }
                    ctx.stroke();
                }

                ctx.globalAlpha = 1;

                setIsLoading(false);
                setError(null);
            } catch (err) {
                console.error('[AudioClip] Failed to render waveform:', err);
                setError('Failed to load audio');
                setIsLoading(false);
            }
        };

        renderWaveform();
    }, [clip.activeTakeId, width, height, color, trimStart, trimEnd, fadeIn, fadeOut]);

    return (
        <div className="relative h-full w-full overflow-hidden">
            {/* Clip name */}
            <span className="absolute left-1 top-0.5 z-10 truncate text-2xs font-medium text-white/90 drop-shadow-sm">
                {clip.name}
            </span>

            {/* Waveform canvas */}
            <canvas
                ref={canvasRef}
                className="absolute inset-0 h-full w-full"
                style={{ imageRendering: 'pixelated' }}
            />

            {/* Loading state */}
            {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                    <div className="h-3 w-3 animate-spin rounded-full border border-white/50 border-t-transparent" />
                </div>
            )}

            {/* Error state */}
            {error && (
                <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-2xs text-white/50">{error}</span>
                </div>
            )}
        </div>
    );
});
