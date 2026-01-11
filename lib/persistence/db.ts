/**
 * ComposeYogi IndexedDB Database
 * 
 * Schema:
 * - projects: Project metadata (without embedded tracks/clips)
 * - tracks: Track data (separate for efficient updates)
 * - clips: Clip data (separate for efficient updates)
 * - audioTakes: Audio binary data (large, stored separately)
 * - settings: App-level settings (latency, preferences)
 */

import { openDB, DBSchema, IDBPDatabase } from 'idb';
import type { Project, Track, Clip, AudioTake, PeaksCache } from '@/types';

// ============================================
// Database Schema
// ============================================

interface ComposeYogiDB extends DBSchema {
    projects: {
        key: string;
        value: ProjectRecord;
        indexes: {
            'by-updated': number;
        };
    };
    tracks: {
        key: string;
        value: Track;
        indexes: {
            'by-project': string;
        };
    };
    clips: {
        key: string;
        value: ClipRecord;
        indexes: {
            'by-track': string;
            'by-project': string;
        };
    };
    audioTakes: {
        key: string;
        value: AudioTakeRecord;
        indexes: {
            'by-clip': string;
        };
    };
    settings: {
        key: string;
        value: SettingRecord;
    };
}

// Stored versions (some fields stored differently for IndexedDB)
interface ProjectRecord {
    id: string;
    name: string;
    bpm: number;
    key: string;
    scale: string;
    timeSignature: [number, number];
    createdAt: number;
    updatedAt: number;
    latencyOffset?: number;
    // Note: tracks and clips stored in separate object stores
}

interface ClipRecord extends Omit<Clip, 'notes'> {
    projectId: string; // Added for indexing
    notes?: string; // JSON stringified for storage
}

interface AudioTakeRecord {
    id: string;
    clipId: string;
    audioData: ArrayBuffer; // Stored as ArrayBuffer, not Uint8Array
    sampleRate: number;
    duration: number;
    peaks: string; // JSON stringified PeaksCache
    createdAt: number;
}

interface SettingRecord {
    key: string;
    value: unknown;
}

// ============================================
// Database Instance
// ============================================

const DB_NAME = 'composeyogi';
const DB_VERSION = 1;

let dbInstance: IDBPDatabase<ComposeYogiDB> | null = null;

export async function getDB(): Promise<IDBPDatabase<ComposeYogiDB>> {
    if (dbInstance) return dbInstance;

    dbInstance = await openDB<ComposeYogiDB>(DB_NAME, DB_VERSION, {
        upgrade(db, oldVersion, newVersion, transaction) {
            // Projects store
            if (!db.objectStoreNames.contains('projects')) {
                const projectStore = db.createObjectStore('projects', { keyPath: 'id' });
                projectStore.createIndex('by-updated', 'updatedAt');
            }

            // Tracks store
            if (!db.objectStoreNames.contains('tracks')) {
                const trackStore = db.createObjectStore('tracks', { keyPath: 'id' });
                trackStore.createIndex('by-project', 'projectId');
            }

            // Clips store
            if (!db.objectStoreNames.contains('clips')) {
                const clipStore = db.createObjectStore('clips', { keyPath: 'id' });
                clipStore.createIndex('by-track', 'trackId');
                clipStore.createIndex('by-project', 'projectId');
            }

            // Audio takes store
            if (!db.objectStoreNames.contains('audioTakes')) {
                const takeStore = db.createObjectStore('audioTakes', { keyPath: 'id' });
                takeStore.createIndex('by-clip', 'clipId');
            }

            // Settings store
            if (!db.objectStoreNames.contains('settings')) {
                db.createObjectStore('settings', { keyPath: 'key' });
            }
        },
        blocked() {
            console.warn('[DB] Database blocked - close other tabs');
        },
        blocking() {
            console.warn('[DB] Database blocking - new version available');
            dbInstance?.close();
            dbInstance = null;
        },
        terminated() {
            console.error('[DB] Database terminated unexpectedly');
            dbInstance = null;
        },
    });

    return dbInstance;
}

// ============================================
// Project Operations
// ============================================

export async function saveProject(project: Project): Promise<void> {
    const db = await getDB();
    const tx = db.transaction(['projects', 'tracks', 'clips'], 'readwrite');

    // Save project metadata (without tracks/clips arrays)
    const projectRecord: ProjectRecord = {
        id: project.id,
        name: project.name,
        bpm: project.bpm,
        key: project.key,
        scale: project.scale,
        timeSignature: project.timeSignature,
        createdAt: project.createdAt,
        updatedAt: Date.now(),
        latencyOffset: project.latencyOffset,
    };
    await tx.objectStore('projects').put(projectRecord);

    // Get existing tracks/clips to determine what to delete
    const trackStore = tx.objectStore('tracks');
    const clipStore = tx.objectStore('clips');

    const existingTracks = await trackStore.index('by-project').getAll(project.id);
    const existingClips = await clipStore.index('by-project').getAll(project.id);

    // Find tracks that were deleted (exist in DB but not in current project)
    const currentTrackIds = new Set(project.tracks.map(t => t.id));
    const deletedTracks = existingTracks.filter(t => !currentTrackIds.has(t.id));

    // Find clips that were deleted
    const currentClipIds = new Set(project.clips.map(c => c.id));
    const deletedClips = existingClips.filter(c => !currentClipIds.has(c.id));

    // Delete removed tracks
    for (const track of deletedTracks) {
        await trackStore.delete(track.id);
        console.log('[DB] Deleted track:', track.id);
    }

    // Delete removed clips
    for (const clip of deletedClips) {
        await clipStore.delete(clip.id);
        console.log('[DB] Deleted clip:', clip.id);
    }

    // Save all current tracks
    for (const track of project.tracks) {
        await trackStore.put(track);
    }

    // Save all current clips (with projectId for indexing)
    for (const clip of project.clips) {
        const clipRecord: ClipRecord = {
            ...clip,
            projectId: project.id,
            notes: clip.notes ? JSON.stringify(clip.notes) : undefined,
        };
        await clipStore.put(clipRecord);
    }

    await tx.done;
    console.log('[DB] Project saved:', project.id);
}

export async function loadProject(projectId: string): Promise<Project | null> {
    const db = await getDB();

    // Load project metadata
    const projectRecord = await db.get('projects', projectId);
    if (!projectRecord) return null;

    // Load tracks
    const tracks = await db.getAllFromIndex('tracks', 'by-project', projectId);
    console.log('[DB] Loaded tracks before sort:', tracks.map(t => ({ name: t.name, order: t.order })));

    // Sort tracks by order, preserving original array index for ties (maintains insertion order)
    const sortedTracks = tracks
        .map((track, originalIndex) => ({ track, originalIndex }))
        .sort((a, b) => a.track.order - b.track.order || a.originalIndex - b.originalIndex)
        .map(({ track }, newIndex) => ({ ...track, order: newIndex })); // Normalize orders

    // Load clips
    const clipRecords = await db.getAllFromIndex('clips', 'by-project', projectId);
    const clips: Clip[] = clipRecords.map((record) => ({
        ...record,
        notes: record.notes ? JSON.parse(record.notes) : undefined,
    }));

    // Reconstruct full project
    const project: Project = {
        id: projectRecord.id,
        name: projectRecord.name,
        bpm: projectRecord.bpm,
        key: projectRecord.key as Project['key'],
        scale: projectRecord.scale as Project['scale'],
        timeSignature: projectRecord.timeSignature,
        createdAt: projectRecord.createdAt,
        updatedAt: projectRecord.updatedAt,
        latencyOffset: projectRecord.latencyOffset,
        tracks: sortedTracks,
        clips,
    };

    console.log('[DB] Project loaded:', projectId);
    return project;
}

export async function deleteProject(projectId: string): Promise<void> {
    const db = await getDB();
    const tx = db.transaction(['projects', 'tracks', 'clips', 'audioTakes'], 'readwrite');

    // Get all clips for this project to find audio takes
    const clips = await tx.objectStore('clips').index('by-project').getAll(projectId);

    // Delete audio takes for each clip
    const takeStore = tx.objectStore('audioTakes');
    for (const clip of clips) {
        if (clip.audioTakeIds) {
            for (const takeId of clip.audioTakeIds) {
                await takeStore.delete(takeId);
            }
        }
    }

    // Delete all clips
    const clipStore = tx.objectStore('clips');
    for (const clip of clips) {
        await clipStore.delete(clip.id);
    }

    // Delete all tracks
    const tracks = await tx.objectStore('tracks').index('by-project').getAll(projectId);
    const trackStore = tx.objectStore('tracks');
    for (const track of tracks) {
        await trackStore.delete(track.id);
    }

    // Delete project
    await tx.objectStore('projects').delete(projectId);

    await tx.done;
    console.log('[DB] Project deleted:', projectId);
}

export async function listProjects(): Promise<ProjectRecord[]> {
    const db = await getDB();
    const projects = await db.getAllFromIndex('projects', 'by-updated');
    // Return sorted by most recently updated first
    return projects.reverse();
}

export async function renameProject(projectId: string, newName: string): Promise<void> {
    const db = await getDB();
    const project = await db.get('projects', projectId);
    if (project) {
        project.name = newName;
        project.updatedAt = Date.now();
        await db.put('projects', project);
        console.log('[DB] Project renamed:', projectId, newName);
    }
}

// ============================================
// Audio Take Operations
// ============================================

export async function saveAudioTake(take: AudioTake): Promise<void> {
    const db = await getDB();

    // Convert Uint8Array to ArrayBuffer (handle both ArrayBuffer and Uint8Array input)
    let audioBuffer: ArrayBuffer;
    if (take.audioData instanceof ArrayBuffer) {
        audioBuffer = take.audioData;
    } else {
        // Safely slice the underlying buffer to get only the view's portion
        audioBuffer = take.audioData.slice().buffer;
    }

    const record: AudioTakeRecord = {
        id: take.id,
        clipId: take.clipId,
        audioData: audioBuffer,
        sampleRate: take.sampleRate,
        duration: take.duration,
        peaks: JSON.stringify(serializePeaks(take.peaks)),
        createdAt: take.createdAt,
    };

    await db.put('audioTakes', record);
    console.log('[DB] Audio take saved:', take.id);
}

export async function loadAudioTake(takeId: string): Promise<AudioTake | null> {
    const db = await getDB();
    const record = await db.get('audioTakes', takeId);
    if (!record) return null;

    // Convert ArrayBuffer back to Uint8Array and parse peaks
    const take: AudioTake = {
        id: record.id,
        clipId: record.clipId,
        audioData: new Uint8Array(record.audioData),
        sampleRate: record.sampleRate,
        duration: record.duration,
        peaks: deserializePeaks(JSON.parse(record.peaks)),
        createdAt: record.createdAt,
    };

    return take;
}

export async function loadAudioTakesForClip(clipId: string): Promise<AudioTake[]> {
    const db = await getDB();
    const records = await db.getAllFromIndex('audioTakes', 'by-clip', clipId);

    return records.map((record) => ({
        id: record.id,
        clipId: record.clipId,
        audioData: new Uint8Array(record.audioData),
        sampleRate: record.sampleRate,
        duration: record.duration,
        peaks: deserializePeaks(JSON.parse(record.peaks)),
        createdAt: record.createdAt,
    }));
}

export async function deleteAudioTake(takeId: string): Promise<void> {
    const db = await getDB();
    await db.delete('audioTakes', takeId);
    console.log('[DB] Audio take deleted:', takeId);
}

// ============================================
// Settings Operations
// ============================================

export async function getSetting<T>(key: string, defaultValue: T): Promise<T> {
    const db = await getDB();
    const record = await db.get('settings', key);
    return record ? (record.value as T) : defaultValue;
}

export async function setSetting<T>(key: string, value: T): Promise<void> {
    const db = await getDB();
    await db.put('settings', { key, value });
}

// ============================================
// Utility Functions
// ============================================

// Serialize PeaksCache (Float32Array → regular arrays)
function serializePeaks(peaks: PeaksCache): Record<string, { min: number[]; max: number[] }> {
    const result: Record<string, { min: number[]; max: number[] }> = {};
    for (const [spp, data] of Object.entries(peaks)) {
        result[spp] = {
            min: Array.from(data.min),
            max: Array.from(data.max),
        };
    }
    return result;
}

// Deserialize PeaksCache (regular arrays → Float32Array)
function deserializePeaks(data: Record<string, { min: number[]; max: number[] }>): PeaksCache {
    const result: PeaksCache = {};
    for (const [spp, values] of Object.entries(data)) {
        result[Number(spp)] = {
            min: new Float32Array(values.min),
            max: new Float32Array(values.max),
        };
    }
    return result;
}

// ============================================
// Database Utilities
// ============================================

export async function clearAllData(): Promise<void> {
    const db = await getDB();
    const tx = db.transaction(['projects', 'tracks', 'clips', 'audioTakes', 'settings'], 'readwrite');
    await tx.objectStore('projects').clear();
    await tx.objectStore('tracks').clear();
    await tx.objectStore('clips').clear();
    await tx.objectStore('audioTakes').clear();
    await tx.objectStore('settings').clear();
    await tx.done;
    console.log('[DB] All data cleared');
}

export async function getStorageEstimate(): Promise<{ usage: number; quota: number }> {
    if (navigator.storage && navigator.storage.estimate) {
        const estimate = await navigator.storage.estimate();
        return {
            usage: estimate.usage || 0,
            quota: estimate.quota || 0,
        };
    }
    return { usage: 0, quota: 0 };
}
