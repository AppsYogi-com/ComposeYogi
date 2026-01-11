// ============================================
// ComposeYogi — Audio Clip Component
// Renders audio clip with waveform visualization
// ============================================

'use client';

import { useRef, useEffect, useState, memo } from 'react';
import type { Clip, Track } from '@/types';
import { getAudioTake } from '@/lib/audio';
import * as Tone from 'tone';

interface AudioClipProps {
    clip: Clip;
    track: Track;
    width: number;
    height: number;
    color: string;
}

export const AudioClip = memo(function AudioClip({
    clip,
    track,
    width,
    height,
    color,
}: AudioClipProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    console.log('[AudioClip] Rendering clip:', clip.id, 'width:', width, 'height:', height, 'takeId:', clip.activeTakeId);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || !clip.activeTakeId) {
            console.log('[AudioClip] No canvas or no activeTakeId');
            return;
        }

        // Ensure minimum dimensions
        const renderWidth = Math.max(1, Math.floor(width));
        const renderHeight = Math.max(1, Math.floor(height));

        const ctx = canvas.getContext('2d');
        if (!ctx) {
            console.log('[AudioClip] No canvas context');
            return;
        }

        const dpr = window.devicePixelRatio || 1;
        canvas.width = renderWidth * dpr;
        canvas.height = renderHeight * dpr;
        ctx.scale(dpr, dpr);

        // Get audio take
        const take = getAudioTake(clip.activeTakeId);
        if (!take) {
            console.log('[AudioClip] Audio take not found:', clip.activeTakeId);
            setError('Audio data not found');
            setIsLoading(false);
            return;
        }

        console.log('[AudioClip] Found take, audioData size:', take.audioData.byteLength);

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

                console.log('[AudioClip] Decoded audio:', audioBuffer.duration, 'seconds');

                // Get channel data
                const channelData = audioBuffer.getChannelData(0);
                const samplesPerPixel = Math.ceil(channelData.length / renderWidth);

                // Calculate peaks
                const peaks: { min: number; max: number }[] = [];
                let globalMin = 0;
                let globalMax = 0;

                for (let i = 0; i < renderWidth; i++) {
                    const start = i * samplesPerPixel;
                    const end = Math.min(start + samplesPerPixel, channelData.length);

                    let min = Infinity;
                    let max = -Infinity;

                    for (let j = start; j < end; j++) {
                        const sample = channelData[j];
                        if (sample < min) min = sample;
                        if (sample > max) max = sample;
                    }

                    const minVal = min === Infinity ? 0 : min;
                    const maxVal = max === -Infinity ? 0 : max;

                    peaks.push({ min: minVal, max: maxVal });

                    // Track global min/max for normalization
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
                ctx.globalAlpha = 1;

                console.log('[AudioClip] Waveform rendered successfully');
                setIsLoading(false);
                setError(null);
            } catch (err) {
                console.error('[AudioClip] Failed to render waveform:', err);
                setError('Failed to load audio');
                setIsLoading(false);
            }
        };

        renderWaveform();
    }, [clip.activeTakeId, width, height, color]);

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
