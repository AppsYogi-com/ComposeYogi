// ============================================
// ComposeYogi — MIDI Export
// Export project clips to standard MIDI file
// ============================================

import { Midi } from '@tonejs/midi';
import type { Project, Clip, Track, Note } from '@/types';

// ============================================
// Constants
// ============================================

// GM Drum channel (channel 10, but 0-indexed = 9)
const DRUM_CHANNEL = 9;

// Ticks per quarter note (standard MIDI resolution)
const TICKS_PER_QUARTER = 480;

// ============================================
// Export Functions
// ============================================

/**
 * Export a project to MIDI format
 */
export function exportProjectToMidi(project: Project): Midi {
    const midi = new Midi();

    // Set header info
    midi.header.setTempo(project.bpm);
    midi.header.timeSignatures.push({
        ticks: 0,
        timeSignature: [project.timeSignature[0], project.timeSignature[1]],
        measures: 0,
    });
    midi.header.name = project.name;

    // Create a map of trackId -> track for quick lookup
    const trackMap = new Map<string, Track>();
    for (const track of project.tracks) {
        trackMap.set(track.id, track);
    }

    // Group clips by track
    const clipsByTrack = new Map<string, Clip[]>();
    for (const clip of project.clips) {
        if (!clipsByTrack.has(clip.trackId)) {
            clipsByTrack.set(clip.trackId, []);
        }
        clipsByTrack.get(clip.trackId)!.push(clip);
    }

    // Process each track
    let midiChannelIndex = 0;
    for (const track of project.tracks) {
        const clips = clipsByTrack.get(track.id) || [];

        // Skip audio tracks (they have no MIDI data)
        if (track.type === 'audio') continue;

        // Skip tracks with no clips
        if (clips.length === 0) continue;

        // Create MIDI track
        const midiTrack = midi.addTrack();
        midiTrack.name = track.name;

        // Determine channel
        const isDrum = track.type === 'drum';
        const channel = isDrum ? DRUM_CHANNEL : midiChannelIndex++;

        // Skip channel 9 for melodic tracks
        if (!isDrum && midiChannelIndex === DRUM_CHANNEL) {
            midiChannelIndex++;
        }

        // Cap at 16 channels
        if (midiChannelIndex > 15) {
            midiChannelIndex = 0;
        }

        midiTrack.channel = channel;

        // Process each clip
        for (const clip of clips) {
            if (!clip.notes || clip.notes.length === 0) continue;

            // Convert clip position to seconds
            const clipStartSeconds = barToSeconds(clip.startBar, project.bpm, project.timeSignature[0]);

            for (const note of clip.notes) {
                // Convert note timing
                const noteStartSeconds = clipStartSeconds + beatToSeconds(note.startBeat, project.bpm);
                const noteDurationSeconds = beatToSeconds(note.duration, project.bpm);

                midiTrack.addNote({
                    midi: note.pitch,
                    time: noteStartSeconds,
                    duration: noteDurationSeconds,
                    velocity: note.velocity / 127, // Normalize to 0-1
                });
            }
        }
    }

    return midi;
}

/**
 * Export project to MIDI and trigger download
 */
export function downloadProjectAsMidi(project: Project): void {
    const midi = exportProjectToMidi(project);
    const array = midi.toArray();
    // Convert to ArrayBuffer for Blob compatibility
    const buffer = new ArrayBuffer(array.length);
    const view = new Uint8Array(buffer);
    view.set(array);
    const blob = new Blob([buffer], { type: 'audio/midi' });

    // Create download link
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${sanitizeFilename(project.name)}.mid`;

    // Trigger download
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Cleanup
    URL.revokeObjectURL(url);
}

// ============================================
// Utility Functions
// ============================================

/**
 * Convert bar number to seconds
 */
function barToSeconds(bar: number, bpm: number, beatsPerBar: number): number {
    const secondsPerBeat = 60 / bpm;
    return bar * beatsPerBar * secondsPerBeat;
}

/**
 * Convert beats to seconds
 */
function beatToSeconds(beats: number, bpm: number): number {
    const secondsPerBeat = 60 / bpm;
    return beats * secondsPerBeat;
}

/**
 * Sanitize filename for safe download
 */
function sanitizeFilename(name: string): string {
    return name
        .replace(/[<>:"/\\|?*]/g, '') // Remove illegal characters
        .replace(/\s+/g, '_')          // Replace spaces with underscores
        .slice(0, 100)                 // Limit length
        || 'project';                  // Fallback
}
