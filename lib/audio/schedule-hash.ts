// ============================================
// ComposeYogi — Reschedule Hashes
// ============================================
//
// What has to change before the audio schedule is rebuilt.
//
// This is the most bug-prone invariant in the app, and it used to live as an
// inline template string inside the compose page — untestable, and impossible
// to reason about next to the effect that consumed it. Issue #22 was exactly
// this: switching a clip's audio take changed what should play, the hash did
// not notice, and playback carried on with the previous take. The failure is
// silent by construction. Nothing throws; you simply hear the wrong thing.
//
// The split matters as much as the contents:
//
//   clipScheduleHash / trackScheduleHash   rebuild the schedule
//   trackEffectsHash                       rebuild the effect chain
//   mixerStateHash                         ramp existing nodes, never rebuild
//
// Volume, pan, mute and solo are deliberately in the last group. They are
// applied to live nodes by playout.ts, and rescheduling on a fader move would
// tear down and rebuild every clip to change one number — which is what made
// moving a fader on a 256-clip project unusable before Sprint 8.5.

import type { Clip, Note, Track } from '@/types';

// ============================================
// Which clip fields reach the audio
// ============================================

/**
 * Clip fields that change what is scheduled, and so must be hashed.
 *
 * Listed explicitly rather than derived from the object, because the bug this
 * prevents is a *missing* field: an object-key walk would hash whatever
 * happened to be present and stay silent about the one nobody set.
 */
export const SOUND_AFFECTING_CLIP_FIELDS = [
    'type',
    'startBar',
    'lengthBars',
    'activeTakeId',
    'trimStart',
    'trimEnd',
    'fadeIn',
    'fadeOut',
    'notes',
    'instrumentPreset',
    'transpose',
    'humanize',
    'energy',
    'groove',
    'brightness',
    'space',
] as const satisfies readonly (keyof Clip)[];

/**
 * Clip fields that deliberately do not affect playback.
 *
 * Every key of Clip must appear in this list or the one above — a test asserts
 * it — so adding a field to the type forces a decision about whether it makes
 * a sound, rather than defaulting to "no" by omission.
 */
export const SILENT_CLIP_FIELDS = [
    'id',        // identity, hashed separately as the row key
    'trackId',   // moving a clip between tracks changes trackScheduleHash
    'name',      // a label
    'audioTakeIds', // only the active take is heard; activeTakeId covers it
] as const satisfies readonly (keyof Clip)[];

// ============================================
// Hashes
// ============================================

function noteHash(notes: Note[] | undefined): string {
    if (!notes?.length) return '';
    return notes.map((n) => `${n.pitch}.${n.startBeat}.${n.duration}.${n.velocity}`).join(';');
}

/** Serialize one clip's sound-affecting state. */
export function clipScheduleHash(clip: Clip): string {
    const field = (name: (typeof SOUND_AFFECTING_CLIP_FIELDS)[number]): string => {
        if (name === 'notes') return noteHash(clip.notes);
        const value = clip[name];
        return value === undefined ? '' : String(value);
    };

    return `${clip.id}:${SOUND_AFFECTING_CLIP_FIELDS.map(field).join(':')}`;
}

/** Serialize every clip in the project. */
export function clipsScheduleHash(clips: Clip[]): string {
    return clips.map(clipScheduleHash).join(',');
}

/**
 * Track state the schedule is built from. The synth is constructed at schedule
 * time, so changing the instrument means rebuilding; the colour is here because
 * it selects the fallback instrument when no preset is set.
 */
export function trackScheduleHash(tracks: Track[]): string {
    return tracks.map((t) => `${t.id}:${t.instrumentPreset || ''}:${t.color}`).join('|');
}

/** Effect chain shape and parameters — rebuilds the chain, not the schedule. */
export function trackEffectsHash(tracks: Track[]): string {
    return tracks
        .map((t) => `${t.id}:${(t.effects || [])
            .map((e) => `${e.id}-${e.active}-${JSON.stringify(e.params)}`)
            .join(',')}`)
        .join('|');
}

/** Mixer state — ramped on live nodes, and never a reason to reschedule. */
export function mixerStateHash(tracks: Track[]): string {
    return tracks
        .map((t) => `${t.id}:${t.volume}:${t.pan}:${t.muted ? 1 : 0}:${t.solo ? 1 : 0}`)
        .join('|');
}
