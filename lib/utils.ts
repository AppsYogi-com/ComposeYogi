import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

/**
 * Format time in seconds to MM:SS.ms
 */
export function formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 100);
    return `${mins}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
}

/**
 * Format bar:beat position
 */
export function formatBarBeat(bar: number, beat: number): string {
    return `${Math.floor(bar) + 1}.${beat + 1}`;
}

/**
 * Format time to bars:beats:sixteenths
 */
export function formatBarsBeats(seconds: number, bpm: number, timeSignature: [number, number]): string {
    const beatsPerBar = timeSignature[0];
    const secondsPerBeat = 60 / bpm;
    const totalBeats = seconds / secondsPerBeat;

    const bars = Math.floor(totalBeats / beatsPerBar) + 1;
    const beats = Math.floor(totalBeats % beatsPerBar) + 1;
    const sixteenths = Math.floor((totalBeats % 1) * 4) + 1;

    return `${bars}.${beats}.${sixteenths}`;
}

// Scales, keys and their intervals live in lib/music — they are musical facts,
// not string helpers, and keeping the English names here is what let the picker
// and the type drift apart.
