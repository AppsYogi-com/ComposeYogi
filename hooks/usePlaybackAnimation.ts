'use client';

import { useEffect, useRef, useCallback } from 'react';
import { playbackRefs } from '@/lib/store/playback';
import { audioEngine } from '@/lib/audio/engine';

// ============================================
// Hook for 60fps Playhead Animation
// Uses refs to bypass React rendering
// ============================================

interface PlaybackAnimationOptions {
    onFrame?: (currentTime: number) => void;
    onBar?: (bar: number) => void;
    onBeat?: (bar: number, beat: number) => void;
}

export function usePlaybackAnimation(options: PlaybackAnimationOptions = {}) {
    const { onFrame, onBar, onBeat } = options;
    const animationFrameRef = useRef<number | null>(null);
    const lastBarRef = useRef<number>(-1);
    const lastBeatRef = useRef<number>(-1);

    const animate = useCallback(() => {
        if (!playbackRefs.isPlayingRef.current) {
            animationFrameRef.current = null;
            return;
        }

        // Calculate current time from audio context
        const currentTime = audioEngine.getCurrentTime();
        playbackRefs.currentTimeRef.current = currentTime;

        // Call frame callback
        onFrame?.(currentTime);

        // Calculate bar and beat
        const bar = audioEngine.getCurrentBar();
        const beat = audioEngine.getCurrentBeat();

        // Call bar callback if changed
        if (Math.floor(bar) !== lastBarRef.current) {
            lastBarRef.current = Math.floor(bar);
            onBar?.(lastBarRef.current);
        }

        // Call beat callback if changed
        if (beat !== lastBeatRef.current) {
            lastBeatRef.current = beat;
            onBeat?.(Math.floor(bar), beat);
        }

        // Continue animation loop
        animationFrameRef.current = requestAnimationFrame(animate);
    }, [onFrame, onBar, onBeat]);

    // Start animation when playing
    useEffect(() => {
        const checkAndStart = () => {
            if (playbackRefs.isPlayingRef.current && !animationFrameRef.current) {
                lastBarRef.current = -1;
                lastBeatRef.current = -1;
                animationFrameRef.current = requestAnimationFrame(animate);
            }
        };

        // Poll for play state changes (since we're using refs)
        const interval = setInterval(checkAndStart, 100);

        return () => {
            clearInterval(interval);
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
        };
    }, [animate]);

    // Manual start/stop for external control
    const start = useCallback(() => {
        if (!animationFrameRef.current) {
            lastBarRef.current = -1;
            lastBeatRef.current = -1;
            animationFrameRef.current = requestAnimationFrame(animate);
        }
    }, [animate]);

    const stop = useCallback(() => {
        if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
            animationFrameRef.current = null;
        }
    }, []);

    return {
        start,
        stop,
        currentTimeRef: playbackRefs.currentTimeRef,
    };
}

// ============================================
// Hook for Playhead DOM Element
// Directly manipulates DOM for 60fps
// ============================================

interface UsePlayheadOptions {
    containerRef: React.RefObject<HTMLElement>;
    pixelsPerSecond: number;
}

export function usePlayhead({ containerRef, pixelsPerSecond }: UsePlayheadOptions) {
    const playheadRef = useRef<HTMLDivElement | null>(null);

    const updatePlayhead = useCallback((currentTime: number) => {
        if (playheadRef.current) {
            const position = currentTime * pixelsPerSecond;
            playheadRef.current.style.transform = `translate3d(${position}px, 0, 0)`;
        }
    }, [pixelsPerSecond]);

    usePlaybackAnimation({
        onFrame: updatePlayhead,
    });

    return playheadRef;
}
