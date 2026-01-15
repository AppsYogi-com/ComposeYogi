// ============================================
// ComposeYogi — Project Import/Export
// JSON export/import + MIDI import
// ============================================

import { Midi } from '@tonejs/midi';
import { v4 as uuid } from 'uuid';
import type { Project, Track, Clip, Note, AudioTake, TrackType, TrackColor, ClipType } from '@/types';
import { createLogger } from '@/lib/logger';

const logger = createLogger('ProjectIO');

// ============================================
// Constants & Types
// ============================================

export const SCHEMA_VERSION = '1.0.0';
export const FILE_EXTENSION = '.cyp.json'; // ComposeYogi Project

export interface ExportedProject {
    schemaVersion: string;
    exportedAt: number;
    appVersion: string;
    project: Project;
    audioTakes?: ExportedAudioTake[];
}

export interface ExportedAudioTake {
    id: string;
    clipId: string;
    audioDataBase64: string; // Base64 encoded audio
    sampleRate: number;
    duration: number;
    peaks: string; // JSON stringified peaks
    createdAt: number;
}

export interface ImportResult {
    success: boolean;
    project?: Project;
    audioTakes?: AudioTake[];
    error?: string;
    warnings?: string[];
}

export interface MidiImportPreview {
    name: string;
    bpm: number;
    duration: number; // seconds
    trackCount: number;
    noteCount: number;
    tracks: Array<{
        name: string;
        channel: number;
        noteCount: number;
        isDrum: boolean;
    }>;
}

// ============================================
// JSON Export
// ============================================

/**
 * Export a project to JSON format
 */
export function exportProjectToJSON(
    project: Project,
    audioTakes?: AudioTake[],
    includeAudio: boolean = false
): ExportedProject {
    const exported: ExportedProject = {
        schemaVersion: SCHEMA_VERSION,
        exportedAt: Date.now(),
        appVersion: '1.0.0',
        project: {
            ...project,
            // Ensure dates are serializable
            createdAt: project.createdAt,
            updatedAt: Date.now(),
        },
    };

    // Include audio takes if requested and available
    if (includeAudio && audioTakes && audioTakes.length > 0) {
        exported.audioTakes = audioTakes.map(take => ({
            id: take.id,
            clipId: take.clipId,
            audioDataBase64: uint8ArrayToBase64(take.audioData),
            sampleRate: take.sampleRate,
            duration: take.duration,
            peaks: JSON.stringify(take.peaks),
            createdAt: take.createdAt,
        }));
    }

    return exported;
}

/**
 * Trigger download of project as JSON file
 */
export function downloadProjectAsJSON(
    project: Project,
    audioTakes?: AudioTake[],
    includeAudio: boolean = false
): void {
    const exported = exportProjectToJSON(project, audioTakes, includeAudio);
    const json = JSON.stringify(exported, null, 2);
    const blob = new Blob([json], { type: 'application/json' });

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${sanitizeFilename(project.name)}${FILE_EXTENSION}`;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    logger.info(`Exported project: ${project.name}`);
}

// ============================================
// JSON Import
// ============================================

/**
 * Import a project from JSON file content
 */
export function importProjectFromJSON(jsonContent: string): ImportResult {
    const warnings: string[] = [];

    try {
        const data = JSON.parse(jsonContent);

        // Validate schema
        if (!data.schemaVersion) {
            return { success: false, error: 'Invalid project file: missing schema version' };
        }

        // Check version compatibility
        const [major] = data.schemaVersion.split('.').map(Number);
        const [currentMajor] = SCHEMA_VERSION.split('.').map(Number);

        if (major > currentMajor) {
            return {
                success: false,
                error: `Project was created with a newer version (${data.schemaVersion}). Please update ComposeYogi.`,
            };
        }

        if (!data.project) {
            return { success: false, error: 'Invalid project file: missing project data' };
        }

        // Generate new IDs to avoid conflicts
        const idMap = new Map<string, string>();
        const newProjectId = uuid();
        idMap.set(data.project.id, newProjectId);

        // Clone and remap project
        const project: Project = {
            ...data.project,
            id: newProjectId,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            tracks: [],
            clips: [],
        };

        // Remap tracks
        for (const track of data.project.tracks || []) {
            const newTrackId = uuid();
            idMap.set(track.id, newTrackId);

            project.tracks.push({
                ...track,
                id: newTrackId,
                projectId: newProjectId,
            });
        }

        // Remap clips
        for (const clip of data.project.clips || []) {
            const newClipId = uuid();
            const newTrackId = idMap.get(clip.trackId);

            if (!newTrackId) {
                warnings.push(`Clip "${clip.name}" references unknown track, skipping`);
                continue;
            }

            idMap.set(clip.id, newClipId);

            // Remap audio take IDs if present
            const audioTakeIds = clip.audioTakeIds?.map((id: string) => {
                const newId = uuid();
                idMap.set(id, newId);
                return newId;
            });

            const activeTakeId = clip.activeTakeId ? idMap.get(clip.activeTakeId) : undefined;

            project.clips.push({
                ...clip,
                id: newClipId,
                trackId: newTrackId,
                audioTakeIds,
                activeTakeId,
            });
        }

        // Import audio takes if present
        let audioTakes: AudioTake[] | undefined;
        if (data.audioTakes && data.audioTakes.length > 0) {
            audioTakes = [];
            for (const take of data.audioTakes) {
                const newTakeId = idMap.get(take.id);
                const newClipId = idMap.get(take.clipId);

                if (!newTakeId || !newClipId) {
                    warnings.push(`Audio take references unknown clip, skipping`);
                    continue;
                }

                try {
                    audioTakes.push({
                        id: newTakeId,
                        clipId: newClipId,
                        audioData: base64ToUint8Array(take.audioDataBase64),
                        sampleRate: take.sampleRate,
                        duration: take.duration,
                        peaks: JSON.parse(take.peaks),
                        createdAt: Date.now(),
                    });
                } catch {
                    warnings.push(`Failed to decode audio take, skipping`);
                }
            }
        }

        logger.info(`Imported project: ${project.name} (${project.tracks.length} tracks, ${project.clips.length} clips)`);

        return {
            success: true,
            project,
            audioTakes,
            warnings: warnings.length > 0 ? warnings : undefined,
        };
    } catch (error) {
        logger.error('Failed to import project:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to parse project file',
        };
    }
}

/**
 * Read and import a project from a File object
 */
export async function importProjectFromFile(file: File): Promise<ImportResult> {
    return new Promise((resolve) => {
        const reader = new FileReader();

        reader.onload = (e) => {
            const content = e.target?.result as string;
            if (!content) {
                resolve({ success: false, error: 'Failed to read file' });
                return;
            }
            resolve(importProjectFromJSON(content));
        };

        reader.onerror = () => {
            resolve({ success: false, error: 'Failed to read file' });
        };

        reader.readAsText(file);
    });
}

// ============================================
// MIDI Import
// ============================================

/**
 * Preview a MIDI file before importing
 */
export async function previewMidiFile(file: File): Promise<MidiImportPreview | null> {
    try {
        const arrayBuffer = await file.arrayBuffer();
        const midi = new Midi(arrayBuffer);

        const tracks: MidiImportPreview['tracks'] = [];
        let totalNotes = 0;

        for (const track of midi.tracks) {
            const isDrum = track.channel === 9;
            const noteCount = track.notes.length;
            totalNotes += noteCount;

            if (noteCount > 0) {
                tracks.push({
                    name: track.name || `Track ${tracks.length + 1}`,
                    channel: track.channel,
                    noteCount,
                    isDrum,
                });
            }
        }

        return {
            name: midi.name || file.name.replace(/\.mid$/i, ''),
            bpm: midi.header.tempos[0]?.bpm || 120,
            duration: midi.duration,
            trackCount: tracks.length,
            noteCount: totalNotes,
            tracks,
        };
    } catch (error) {
        logger.error('Failed to preview MIDI file:', error);
        return null;
    }
}

/**
 * Import a MIDI file and create a new project
 */
export async function importMidiFile(file: File): Promise<ImportResult> {
    try {
        const arrayBuffer = await file.arrayBuffer();
        const midi = new Midi(arrayBuffer);

        const projectId = uuid();
        const bpm = midi.header.tempos[0]?.bpm || 120;
        const timeSignature = midi.header.timeSignatures[0]?.timeSignature || [4, 4];

        // Create project
        const project: Project = {
            id: projectId,
            name: midi.name || file.name.replace(/\.mid$/i, ''),
            bpm: Math.round(bpm),
            key: 'C',
            scale: 'minor',
            timeSignature: [timeSignature[0], timeSignature[1]] as [number, number],
            tracks: [],
            clips: [],
            createdAt: Date.now(),
            updatedAt: Date.now(),
        };

        const warnings: string[] = [];

        // Track colors by type
        const colors: TrackColor[] = ['keys', 'bass', 'melody', 'fx', 'vocals'];
        let colorIndex = 0;

        // Process MIDI tracks
        for (const midiTrack of midi.tracks) {
            if (midiTrack.notes.length === 0) continue;

            const trackId = uuid();
            const isDrum = midiTrack.channel === 9;
            const trackType: TrackType = isDrum ? 'drum' : 'midi';
            const trackColor: TrackColor = isDrum ? 'drums' : colors[colorIndex++ % colors.length];

            // Create track
            const track: Track = {
                id: trackId,
                projectId,
                name: midiTrack.name || (isDrum ? 'Drums' : `Track ${project.tracks.length + 1}`),
                type: trackType,
                color: trackColor,
                volume: 0.8,
                pan: 0,
                muted: false,
                solo: false,
                armed: false,
                order: project.tracks.length,
            };

            project.tracks.push(track);

            // Group notes into clips by finding gaps
            const notes = [...midiTrack.notes].sort((a, b) => a.time - b.time);
            const clips = groupNotesIntoClips(notes, bpm, timeSignature[0]);

            for (const clipData of clips) {
                const clipId = uuid();
                const clipType: ClipType = isDrum ? 'drum' : 'midi';

                const clip: Clip = {
                    id: clipId,
                    trackId,
                    type: clipType,
                    name: `${track.name} ${project.clips.filter(c => c.trackId === trackId).length + 1}`,
                    startBar: clipData.startBar,
                    lengthBars: clipData.lengthBars,
                    notes: clipData.notes,
                };

                project.clips.push(clip);
            }
        }

        // Warn if tempo changes detected
        if (midi.header.tempos.length > 1) {
            warnings.push(`MIDI file contains ${midi.header.tempos.length} tempo changes. Only the first tempo (${Math.round(bpm)} BPM) was used.`);
        }

        logger.info(`Imported MIDI: ${project.name} (${project.tracks.length} tracks, ${project.clips.length} clips)`);

        return {
            success: true,
            project,
            warnings: warnings.length > 0 ? warnings : undefined,
        };
    } catch (error) {
        logger.error('Failed to import MIDI file:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to parse MIDI file',
        };
    }
}

// ============================================
// Helper Functions
// ============================================

/**
 * Group MIDI notes into clips based on gaps in the note sequence
 */
function groupNotesIntoClips(
    midiNotes: Array<{ time: number; duration: number; midi: number; velocity: number }>,
    bpm: number,
    beatsPerBar: number
): Array<{ startBar: number; lengthBars: number; notes: Note[] }> {
    if (midiNotes.length === 0) return [];

    const secondsPerBeat = 60 / bpm;
    const secondsPerBar = secondsPerBeat * beatsPerBar;
    const gapThreshold = secondsPerBar * 2; // 2 bars of silence = new clip

    const clips: Array<{ startBar: number; lengthBars: number; notes: Note[] }> = [];
    let currentClipNotes: Array<{ time: number; duration: number; midi: number; velocity: number }> = [];
    let clipStartTime = 0;
    let lastNoteEnd = 0;

    for (const note of midiNotes) {
        // Check for gap
        if (currentClipNotes.length > 0 && note.time - lastNoteEnd > gapThreshold) {
            // Save current clip
            clips.push(createClipFromNotes(currentClipNotes, clipStartTime, bpm, beatsPerBar));
            currentClipNotes = [];
            clipStartTime = note.time;
        }

        if (currentClipNotes.length === 0) {
            clipStartTime = note.time;
        }

        currentClipNotes.push(note);
        lastNoteEnd = Math.max(lastNoteEnd, note.time + note.duration);
    }

    // Save final clip
    if (currentClipNotes.length > 0) {
        clips.push(createClipFromNotes(currentClipNotes, clipStartTime, bpm, beatsPerBar));
    }

    return clips;
}

/**
 * Create a clip from a group of MIDI notes
 */
function createClipFromNotes(
    midiNotes: Array<{ time: number; duration: number; midi: number; velocity: number }>,
    clipStartTime: number,
    bpm: number,
    beatsPerBar: number
): { startBar: number; lengthBars: number; notes: Note[] } {
    const secondsPerBeat = 60 / bpm;
    const secondsPerBar = secondsPerBeat * beatsPerBar;

    // Calculate clip boundaries (snap to bar)
    const startBar = Math.floor(clipStartTime / secondsPerBar);
    const clipStartSeconds = startBar * secondsPerBar;

    let maxEndTime = 0;
    const notes: Note[] = [];

    for (const midiNote of midiNotes) {
        // Convert time to beats relative to clip start
        const relativeTime = midiNote.time - clipStartSeconds;
        const startBeat = relativeTime / secondsPerBeat;
        const durationBeats = midiNote.duration / secondsPerBeat;

        notes.push({
            id: uuid(),
            pitch: midiNote.midi,
            startBeat,
            duration: durationBeats,
            velocity: Math.round(midiNote.velocity * 127),
        });

        maxEndTime = Math.max(maxEndTime, midiNote.time + midiNote.duration);
    }

    // Calculate clip length (round up to nearest bar)
    const clipDuration = maxEndTime - clipStartSeconds;
    const lengthBars = Math.max(1, Math.ceil(clipDuration / secondsPerBar));

    return { startBar, lengthBars, notes };
}

/**
 * Convert Uint8Array to Base64 string
 */
function uint8ArrayToBase64(uint8Array: Uint8Array): string {
    let binary = '';
    const len = uint8Array.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(uint8Array[i]);
    }
    return btoa(binary);
}

/**
 * Convert Base64 string to Uint8Array
 */
function base64ToUint8Array(base64: string): Uint8Array {
    const binary = atob(base64);
    const len = binary.length;
    const uint8Array = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        uint8Array[i] = binary.charCodeAt(i);
    }
    return uint8Array;
}

/**
 * Sanitize filename for download
 */
function sanitizeFilename(name: string): string {
    return name
        .replace(/[<>:"/\\|?*]/g, '')
        .replace(/\s+/g, '_')
        .substring(0, 100);
}
