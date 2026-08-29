// ============================================
// ComposeYogi — Offline Audio Renderer
// Export project to WAV/MP3 with real-time progress
// ============================================
//
// The offline half of the engine. It builds the same signal graph and uses the
// same scheduling primitives as the live PlayoutManager (both go through
// lib/audio/scheduler.ts), so an export is a faster-than-real-time render of
// exactly what playback produces — including solo, mute, faders and FX bypass.

import * as Tone from 'tone';

import { createLogger } from '@/lib/logger';
import { encodeAudioBufferToMp3, type Mp3Quality } from './mp3-encoder';
import {
    MASTER_GAIN,
    MASTER_LIMITER_THRESHOLD_DB,
    barsToSeconds,
    buildEffectChain,
    effectiveTrackGain,
    projectEndBar,
    scheduleAudioClip,
    scheduleMidiClip,
} from './scheduler';

import type { Project } from '@/types';

const logger = createLogger('OfflineRenderer');

// ============================================
// Types
// ============================================

export interface ExportOptions {
    sampleRate?: number;
    tailSeconds?: number;  // Extra time for reverb/delay tails
}

export type ProgressCallback = (progress: number) => void;

const DEFAULT_TAIL_SECONDS = 2;

// ============================================
// WAV Encoder (Pure JavaScript)
// ============================================

/**
 * Convert AudioBuffer to WAV Blob
 * No external dependencies needed - WAV is just a header + PCM data
 */
function audioBufferToWav(buffer: AudioBuffer): Blob {
    const numChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const format = 1; // PCM
    const bitDepth = 16;

    // Interleave channels
    const length = buffer.length * numChannels * (bitDepth / 8);
    const arrayBuffer = new ArrayBuffer(44 + length);
    const view = new DataView(arrayBuffer);

    // WAV header
    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + length, true);
    writeString(view, 8, 'WAVE');
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
    view.setUint16(20, format, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * numChannels * (bitDepth / 8), true); // ByteRate
    view.setUint16(32, numChannels * (bitDepth / 8), true); // BlockAlign
    view.setUint16(34, bitDepth, true);
    writeString(view, 36, 'data');
    view.setUint32(40, length, true);

    // Interleave and write samples
    const channels: Float32Array[] = [];
    for (let i = 0; i < numChannels; i++) {
        channels.push(buffer.getChannelData(i));
    }

    let offset = 44;
    for (let i = 0; i < buffer.length; i++) {
        for (let ch = 0; ch < numChannels; ch++) {
            const sample = Math.max(-1, Math.min(1, channels[ch][i]));
            const int16 = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
            view.setInt16(offset, int16, true);
            offset += 2;
        }
    }

    return new Blob([arrayBuffer], { type: 'audio/wav' });
}

function writeString(view: DataView, offset: number, str: string): void {
    for (let i = 0; i < str.length; i++) {
        view.setUint8(offset + i, str.charCodeAt(i));
    }
}

// ============================================
// Rendering
// ============================================

/**
 * Musical length of the project plus a tail for reverb/delay decay.
 */
export function getRenderDuration(project: Project, tailSeconds = DEFAULT_TAIL_SECONDS): number {
    const beatsPerBar = project.timeSignature[0];
    const endBar = projectEndBar(project);
    return barsToSeconds(endBar, project.bpm, beatsPerBar) + tailSeconds;
}

/**
 * Render the project to an AudioBuffer inside a Tone.Offline context.
 *
 * The graph built here is the same one PlayoutManager builds live:
 *   clip -> track entry -> [active effects] -> gain -> panner -> master -> limiter
 * with track gain resolved through the shared solo/mute rules.
 */
export async function renderProjectToAudioBuffer(
    project: Project,
    onProgress?: ProgressCallback,
    options: ExportOptions = {}
): Promise<AudioBuffer> {
    const { tailSeconds = DEFAULT_TAIL_SECONDS } = options;

    const beatsPerBar = project.timeSignature[0];
    const duration = getRenderDuration(project, tailSeconds);

    if (duration <= tailSeconds) {
        throw new Error('Project has no clips to export');
    }

    onProgress?.(0);

    const renderedBuffer = await Tone.Offline(async ({ transport }) => {
        transport.bpm.value = project.bpm;
        transport.timeSignature = project.timeSignature;

        // Master chain: masterGain (headroom) -> limiter -> destination
        const masterLimiter = new Tone.Limiter(MASTER_LIMITER_THRESHOLD_DB);
        masterLimiter.toDestination();

        const masterGain = new Tone.Gain(MASTER_GAIN);
        masterGain.connect(masterLimiter);

        for (const track of project.tracks) {
            // Solo-aware: exporting while a track is soloed exports the solo.
            const trackGain = effectiveTrackGain(track, project.tracks);
            if (trackGain === 0) continue;

            const panner = new Tone.Panner(track.pan);
            panner.connect(masterGain);

            const gain = new Tone.Gain(trackGain);
            gain.connect(panner);

            // Track entry point; the effect chain is wired entry -> … -> gain.
            const entry = new Tone.Gain(1);
            await buildEffectChain(track.effects, entry, gain);

            const trackClips = project.clips.filter((c) => c.trackId === track.id);

            for (const clip of trackClips) {
                const startSeconds = barsToSeconds(clip.startBar, project.bpm, beatsPerBar);

                if (clip.type === 'audio' && clip.activeTakeId) {
                    await scheduleAudioClip(clip, entry, startSeconds);
                } else if ((clip.type === 'midi' || clip.type === 'drum') && clip.notes) {
                    await scheduleMidiClip(clip, track, entry, startSeconds, {
                        transport,
                        bpm: project.bpm,
                        beatsPerBar,
                    });
                }
            }
        }

        transport.start(0);
    }, duration);

    onProgress?.(100);

    logger.debug('Render complete', { duration, tracks: project.tracks.length });

    return renderedBuffer.get() as AudioBuffer;
}

/**
 * Export project to WAV using Tone.Offline for proper offline rendering
 */
export async function exportProjectToWav(
    project: Project,
    onProgress?: ProgressCallback,
    options: ExportOptions = {}
): Promise<Blob> {
    const audioBuffer = await renderProjectToAudioBuffer(project, onProgress, options);
    return audioBufferToWav(audioBuffer);
}

// ============================================
// Download Helpers
// ============================================

function triggerDownload(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
}

/**
 * Export project and trigger browser download as WAV
 */
export async function downloadProjectAsWav(
    project: Project,
    onProgress?: ProgressCallback
): Promise<void> {
    const blob = await exportProjectToWav(project, onProgress);
    triggerDownload(blob, `${sanitizeFilename(project.name)}.wav`);
}

/**
 * Export project and trigger browser download as MP3
 */
export async function downloadProjectAsMp3(
    project: Project,
    quality: Mp3Quality = 192,
    onProgress?: ProgressCallback
): Promise<void> {
    // Step 1: Render audio (0-50% progress)
    const renderProgress = (p: number) => onProgress?.(Math.round(p * 0.5));
    const audioBuffer = await renderProjectToAudioBuffer(project, renderProgress);

    // Step 2: Encode to MP3 (50-100% progress)
    const encodeProgress = (p: number) => onProgress?.(50 + Math.round(p * 0.5));
    const blob = await encodeAudioBufferToMp3(audioBuffer, {
        quality,
        onProgress: encodeProgress,
    });

    triggerDownload(blob, `${sanitizeFilename(project.name)}.mp3`);
}

/**
 * Sanitize filename for safe download
 */
function sanitizeFilename(name: string): string {
    return name
        .replace(/[<>:"/\\|?*]/g, '')
        .replace(/\s+/g, '_')
        .slice(0, 100)
        || 'project';
}
