// ============================================
// Template Loader - Converts DemoTemplate to Project
// ============================================

import { v4 as uuid } from 'uuid';
import type { Project, Track, Clip, Note, TrackEffect } from '@/types';
import { getDemoTemplate, type DemoTemplate } from './demo-templates';

/**
 * Loads a demo template and converts it to a full Project object
 * with generated UUIDs for all entities.
 */
export function loadDemoTemplate(templateId: string): Project | null {
    const template = getDemoTemplate(templateId);
    if (!template) {
        console.error(`[loadDemoTemplate] Template not found: ${templateId}`);
        return null;
    }

    const projectId = uuid();
    const now = Date.now();

    // Create tracks with generated IDs
    const tracks: Track[] = template.tracks.map((t, index) => {
        const trackId = uuid();

        // Convert effects
        const effects: TrackEffect[] = (t.effects || []).map((fx) => ({
            id: uuid(),
            type: fx.type,
            active: true,
            params: {
                wet: fx.params.wet ?? 0.5,
                ...fx.params,
            },
        }));

        return {
            id: trackId,
            projectId,
            name: t.name,
            type: t.type,
            color: t.color,
            volume: t.volume,
            pan: t.pan,
            muted: false,
            solo: false,
            armed: false,
            instrumentPreset: t.instrumentPreset,
            effects,
            order: index,
        };
    });

    // Create clips with generated IDs, linking to track IDs
    const clips: Clip[] = template.clips.map((c) => {
        const clipId = uuid();
        const track = tracks[c.trackIndex];

        // Convert notes with generated IDs
        const notes: Note[] = (c.notes || []).map((n) => ({
            id: uuid(),
            pitch: n.pitch,
            startBeat: n.startBeat,
            duration: n.duration,
            velocity: n.velocity,
        }));

        return {
            id: clipId,
            trackId: track.id,
            type: track.type === 'drum' ? 'drum' : track.type === 'midi' ? 'midi' : 'audio',
            name: c.name,
            startBar: c.startBar,
            lengthBars: c.lengthBars,
            notes,
        };
    });

    // Build the project
    const project: Project = {
        id: projectId,
        name: `${template.emoji} ${template.name}`,
        bpm: template.bpm,
        key: template.key as Project['key'],
        scale: template.scale,
        timeSignature: [4, 4],
        tracks,
        clips,
        createdAt: now,
        updatedAt: now,
    };

    console.log(`[loadDemoTemplate] Loaded template: ${template.name} (${tracks.length} tracks, ${clips.length} clips)`);
    return project;
}

/**
 * Get all available demo template metadata (for display in UI)
 */
export function getDemoTemplateList() {
    const { DEMO_TEMPLATES } = require('./demo-templates');
    return DEMO_TEMPLATES.map((t: DemoTemplate) => ({
        id: t.id,
        name: t.name,
        emoji: t.emoji,
        genre: t.genre,
        description: t.description,
        bpm: t.bpm,
        key: t.key,
        scale: t.scale,
    }));
}
