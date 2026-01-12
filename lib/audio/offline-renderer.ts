// ============================================
// ComposeYogi — Offline Audio Renderer
// Export project to WAV with real-time progress
// ============================================

import * as Tone from 'tone';
import type { Project, Track, Clip, TrackEffect } from '@/types';
import { getAudioTake } from './recording-manager';
import { createSynthFromPreset, waitForSynthReady, type SynthType } from './synth-presets';

// ============================================
// Types
// ============================================

export interface ExportOptions {
    sampleRate?: number;
    tailSeconds?: number;  // Extra time for reverb/delay tails
}

export type ProgressCallback = (progress: number) => void;

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
// Timing Utilities
// ============================================

function barsToSeconds(bars: number, bpm: number, beatsPerBar: number): number {
    const beatsPerSecond = bpm / 60;
    const secondsPerBeat = 1 / beatsPerSecond;
    return bars * beatsPerBar * secondsPerBeat;
}

function beatsToSeconds(beats: number, bpm: number): number {
    return (beats / bpm) * 60;
}

// ============================================
// Effect Creation (Mirrors playout.ts)
// ============================================

async function createEffectNode(effect: TrackEffect): Promise<Tone.ToneAudioNode | null> {
    try {
        switch (effect.type) {
            case 'reverb':
                const rev = new Tone.Reverb({
                    decay: effect.params.decay || 1.5,
                    preDelay: 0.01,
                    wet: effect.params.wet || 0.5
                });
                // IMPORTANT: Wait for impulse response generation for offline rendering
                await rev.generate();
                return rev;
            case 'delay':
                return new Tone.FeedbackDelay({
                    delayTime: effect.params.delayTime || 0.25,
                    feedback: effect.params.feedback || 0.5,
                    wet: effect.params.wet || 0.5
                });
            case 'distortion':
                return new Tone.Distortion({
                    distortion: effect.params.distortion || 0.4,
                    wet: effect.params.wet || 0.5
                });
            case 'filter':
                return new Tone.Filter({
                    frequency: effect.params.frequency || 1000,
                    type: effect.params.filterType || 'lowpass',
                    Q: effect.params.Q || 1
                });
            case 'compression':
                return new Tone.Compressor({
                    threshold: effect.params.threshold || -30,
                    ratio: effect.params.ratio || 12
                });
            default:
                return null;
        }
    } catch (e) {
        console.error('[OfflineRenderer] Error creating effect:', e);
        return null;
    }
}

// ============================================
// Synth Selection (Mirrors playout.ts)
// ============================================

function createSynthForTrack(track: Track): SynthType {
    if (track.instrumentPreset) {
        return createSynthFromPreset(track.instrumentPreset);
    }

    switch (track.color) {
        case 'bass':
            return createSynthFromPreset('synth-bass');
        case 'keys':
            return createSynthFromPreset('electric-piano');
        case 'melody':
            return createSynthFromPreset('saw-lead');
        case 'drums':
            return createSynthFromPreset('drum-synth');
        case 'fx':
            return createSynthFromPreset('warm-pad');
        case 'vocals':
        default:
            return createSynthFromPreset('basic-synth');
    }
}

// ============================================
// Main Export Function
// ============================================

/**
 * Export project to WAV with real-time progress updates
 * Uses OfflineAudioContext with suspend/resume for accurate progress
 */
export async function exportProjectToWav(
    project: Project,
    onProgress?: ProgressCallback,
    options: ExportOptions = {}
): Promise<Blob> {
    const {
        sampleRate = 44100,
        tailSeconds = 2,
    } = options;

    // Store original context to restore later
    const originalContext = Tone.getContext();

    try {
        // 1. Calculate total duration
        const maxBar = project.clips.reduce((max, clip) => {
            return Math.max(max, clip.startBar + clip.lengthBars);
        }, 0);

        const beatsPerBar = project.timeSignature[0];
        const duration = barsToSeconds(maxBar, project.bpm, beatsPerBar) + tailSeconds;

        if (duration <= tailSeconds) {
            throw new Error('Project has no clips to export');
        }


        // 2. Create offline context
        const offlineCtx = new OfflineAudioContext(2, sampleRate * duration, sampleRate);

        // 3. Set up progress checkpoints via suspend/resume
        const checkpointInterval = 1; // seconds
        const checkpoints: number[] = [];
        for (let t = checkpointInterval; t < duration; t += checkpointInterval) {
            checkpoints.push(t);
        }

        // Schedule suspend points for progress tracking
        checkpoints.forEach(time => {
            offlineCtx.suspend(time).then(() => {
                const progress = Math.round((time / duration) * 100);
                onProgress?.(progress);
                offlineCtx.resume();
            });
        });

        // 4. Switch Tone.js to offline context
        const toneOfflineCtx = new Tone.Context(offlineCtx);
        Tone.setContext(toneOfflineCtx);

        // Set up transport for offline context
        const transport = Tone.getTransport();
        transport.bpm.value = project.bpm;
        transport.timeSignature = project.timeSignature;

        // 5. Build audio graph and schedule clips
        const nodesToDispose: Tone.ToneAudioNode[] = [];

        for (const track of project.tracks) {
            if (track.muted) continue;

            // Build track chain: input -> effects -> gain -> pan -> destination
            const panner = new Tone.Panner(track.pan);
            panner.toDestination();
            nodesToDispose.push(panner);

            const gain = new Tone.Gain(track.volume);
            gain.connect(panner);
            nodesToDispose.push(gain);

            // Build effects chain
            let chainInput: Tone.ToneAudioNode = gain;
            if (track.effects && track.effects.length > 0) {
                const activeEffects = track.effects.filter(e => e.active);

                // Effects connect in reverse (last effect -> gain)
                const effectNodes: Tone.ToneAudioNode[] = [];
                for (const effect of activeEffects) {
                    const node = await createEffectNode(effect);
                    if (node) {
                        effectNodes.push(node);
                        nodesToDispose.push(node);
                    }
                }

                // Connect: entry -> effect1 -> effect2 -> ... -> gain
                if (effectNodes.length > 0) {
                    const entryGain = new Tone.Gain(1);
                    nodesToDispose.push(entryGain);

                    let current: Tone.ToneAudioNode = entryGain;
                    for (const effectNode of effectNodes) {
                        current.connect(effectNode);
                        current = effectNode;
                    }
                    current.connect(gain);
                    chainInput = entryGain;
                }
            }

            // Schedule clips for this track
            const trackClips = project.clips.filter(c => c.trackId === track.id);

            for (const clip of trackClips) {
                const clipStartSeconds = barsToSeconds(clip.startBar, project.bpm, beatsPerBar);

                if (clip.type === 'audio' && clip.activeTakeId) {
                    // Schedule audio clip
                    await scheduleAudioClipOffline(
                        clip,
                        chainInput,
                        clipStartSeconds,
                        project,
                        offlineCtx,
                        nodesToDispose
                    );
                } else if ((clip.type === 'midi' || clip.type === 'drum') && clip.notes) {
                    // Schedule MIDI/Drum clip
                    await scheduleMidiClipOffline(
                        clip,
                        track,
                        chainInput,
                        clipStartSeconds,
                        project,
                        nodesToDispose
                    );
                }
            }
        }

        // 6. Start transport and render
        transport.start(0);

        onProgress?.(0); // Initial progress
        const renderedBuffer = await offlineCtx.startRendering();
        onProgress?.(100); // Complete


        // 7. Cleanup offline nodes
        transport.stop();
        transport.cancel();
        nodesToDispose.forEach(node => {
            try {
                node.dispose();
            } catch (_e) {
                // Ignore disposal errors
            }
        });

        // 8. Convert to WAV
        const wavBlob = audioBufferToWav(renderedBuffer);

        return wavBlob;

    } finally {
        // 9. ALWAYS restore original context
        Tone.setContext(originalContext);
    }
}

// ============================================
// Audio Clip Scheduling (Offline)
// ============================================

async function scheduleAudioClipOffline(
    clip: Clip,
    destination: Tone.ToneAudioNode,
    startTime: number,
    project: Project,
    offlineCtx: OfflineAudioContext,
    nodesToDispose: Tone.ToneAudioNode[]
): Promise<void> {
    if (!clip.activeTakeId) return;

    const take = getAudioTake(clip.activeTakeId);
    if (!take) {
        console.warn('[OfflineRenderer] AudioTake not found:', clip.activeTakeId);
        return;
    }

    try {
        // Decode audio in offline context - create a proper ArrayBuffer copy
        const arrayBuffer = new ArrayBuffer(take.audioData.byteLength);
        new Uint8Array(arrayBuffer).set(take.audioData);
        const audioBuffer = await offlineCtx.decodeAudioData(arrayBuffer);

        // Create Tone buffer and player
        const toneBuffer = new Tone.ToneAudioBuffer(audioBuffer);
        const player = new Tone.Player(toneBuffer);
        player.connect(destination);
        nodesToDispose.push(player);

        // Apply fades
        player.fadeIn = clip.fadeIn || 0;
        player.fadeOut = clip.fadeOut || 0;

        // Calculate trim/duration
        const trimStart = clip.trimStart || 0;
        const trimEnd = clip.trimEnd || 0;
        const sourceDuration = toneBuffer.duration;
        const playDuration = Math.max(0, sourceDuration - trimStart - trimEnd);

        if (playDuration > 0) {
            // Sync to transport and schedule
            player.sync();
            player.start(startTime, trimStart, playDuration);
        }

    } catch (error) {
        console.error('[OfflineRenderer] Failed to schedule audio clip:', error);
    }
}

// ============================================
// MIDI Clip Scheduling (Offline)
// ============================================

async function scheduleMidiClipOffline(
    clip: Clip,
    track: Track,
    destination: Tone.ToneAudioNode,
    startTime: number,
    project: Project,
    nodesToDispose: Tone.ToneAudioNode[]
): Promise<void> {
    if (!clip.notes?.length) return;

    const synth = createSynthForTrack(track);
    synth.connect(destination);
    nodesToDispose.push(synth);

    // Wait for synth to be ready (important for Sampler which loads async)
    await waitForSynthReady(synth);

    const transport = Tone.getTransport();

    // Check if synth is polyphonic (PolySynth and Sampler can handle multiple notes at same time)
    const isPolyphonic = synth instanceof Tone.PolySynth || synth instanceof Tone.Sampler;

    // Group notes by start time to handle concurrent notes for monophonic synths
    const notesByTime = new Map<number, typeof clip.notes>();
    for (const note of clip.notes) {
        const noteOffsetSeconds = beatsToSeconds(note.startBeat, project.bpm);
        const absoluteTime = startTime + noteOffsetSeconds;
        // Round to avoid floating point issues
        const timeKey = Math.round(absoluteTime * 10000) / 10000;

        if (!notesByTime.has(timeKey)) {
            notesByTime.set(timeKey, []);
        }
        notesByTime.get(timeKey)!.push(note);
    }

    // Schedule notes, adding tiny offsets for monophonic synths with concurrent notes
    for (const [timeKey, notes] of notesByTime) {
        notes.forEach((note, index) => {
            const noteDurationSeconds = beatsToSeconds(note.duration, project.bpm);
            // For monophonic synths, add 1ms offset for each concurrent note
            const offset = isPolyphonic ? 0 : index * 0.001;
            const scheduledTime = timeKey + offset;

            transport.schedule((time) => {
                synth.triggerAttackRelease(
                    Tone.Frequency(note.pitch, 'midi').toFrequency(),
                    noteDurationSeconds,
                    time,
                    note.velocity / 127
                );
            }, scheduledTime);
        });
    }

}

// ============================================
// Download Helper
// ============================================

/**
 * Export project and trigger browser download
 */
export async function downloadProjectAsWav(
    project: Project,
    onProgress?: ProgressCallback
): Promise<void> {
    const blob = await exportProjectToWav(project, onProgress);

    // Trigger download
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${sanitizeFilename(project.name)}.wav`;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
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
