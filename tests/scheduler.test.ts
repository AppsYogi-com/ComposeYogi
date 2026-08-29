// ============================================
// ComposeYogi — Scheduler Tests
// ============================================
//
// These guard the contract that makes an export sound like the playback:
// both paths schedule from the render plan produced here, so if the plan is
// right for a project, both paths are right for that project.

import { describe, expect, it } from 'vitest';

import {
    barsToSeconds,
    beatsToSeconds,
    buildRenderPlan,
    effectiveTrackGain,
    isTrackAudible,
    clipPlayDuration,
    projectEndBar,
    secondsToBars,
} from '@/lib/audio/scheduler';

import { makeClip, makeMixedProject, makeProject, makeTrack } from './fixtures';

// ============================================
// Timing
// ============================================

describe('timing conversions', () => {
    it('converts bars to seconds at 120bpm 4/4', () => {
        // One 4/4 bar at 120bpm is 4 beats × 0.5s = 2s
        expect(barsToSeconds(1, 120, 4)).toBe(2);
        expect(barsToSeconds(4, 120, 4)).toBe(8);
        expect(barsToSeconds(0, 120, 4)).toBe(0);
    });

    it('honours the time signature', () => {
        // 3/4 at 120bpm: three beats per bar
        expect(barsToSeconds(1, 120, 3)).toBe(1.5);
        // 7/8 counts seven beats, whatever the denominator says
        expect(barsToSeconds(1, 120, 7)).toBe(3.5);
    });

    it('scales inversely with tempo', () => {
        expect(barsToSeconds(1, 60, 4)).toBe(4);
        expect(barsToSeconds(1, 240, 4)).toBe(1);
    });

    it('converts beats to seconds', () => {
        expect(beatsToSeconds(1, 120)).toBe(0.5);
        expect(beatsToSeconds(4, 60)).toBe(4);
    });

    it('round-trips bars through seconds', () => {
        for (const bpm of [70, 85, 120, 174]) {
            for (const bars of [0.25, 1, 3.5, 16]) {
                expect(secondsToBars(barsToSeconds(bars, bpm, 4), bpm, 4)).toBeCloseTo(bars, 10);
            }
        }
    });
});

describe('projectEndBar', () => {
    it('is zero for a project with no clips', () => {
        expect(projectEndBar(makeProject({ clips: [] }))).toBe(0);
    });

    it('is the far edge of the last clip, not the last clip in the array', () => {
        const project = makeProject({
            clips: [
                makeClip({ id: 'late', startBar: 12, lengthBars: 4 }),
                makeClip({ id: 'early', startBar: 0, lengthBars: 2 }),
            ],
        });
        expect(projectEndBar(project)).toBe(16);
    });
});

// ============================================
// Solo / mute
// ============================================

describe('solo and mute gating', () => {
    const plain = makeTrack({ id: 'a' });
    const muted = makeTrack({ id: 'b', muted: true });
    const soloed = makeTrack({ id: 'c', solo: true });

    it('plays every unmuted track when nothing is soloed', () => {
        const tracks = [plain, muted];
        expect(isTrackAudible(plain, tracks)).toBe(true);
        expect(isTrackAudible(muted, tracks)).toBe(false);
    });

    it('silences non-soloed tracks as soon as anything is soloed', () => {
        const tracks = [plain, soloed];
        expect(isTrackAudible(soloed, tracks)).toBe(true);
        expect(isTrackAudible(plain, tracks)).toBe(false);
    });

    it('keeps a muted track silent even when it is also soloed', () => {
        const mutedAndSoloed = makeTrack({ id: 'd', muted: true, solo: true });
        const tracks = [plain, mutedAndSoloed];
        expect(isTrackAudible(mutedAndSoloed, tracks)).toBe(false);
    });

    it('plays all soloed tracks when several are soloed', () => {
        const other = makeTrack({ id: 'e', solo: true });
        const tracks = [plain, soloed, other];
        expect(isTrackAudible(soloed, tracks)).toBe(true);
        expect(isTrackAudible(other, tracks)).toBe(true);
        expect(isTrackAudible(plain, tracks)).toBe(false);
    });

    it('reports gain 0 for anything inaudible and the fader value otherwise', () => {
        const loud = makeTrack({ id: 'f', volume: 0.42 });
        expect(effectiveTrackGain(loud, [loud])).toBe(0.42);
        expect(effectiveTrackGain(muted, [muted])).toBe(0);
        expect(effectiveTrackGain(loud, [loud, soloed])).toBe(0);
    });
});

// ============================================
// Audio clip trimming
// ============================================

describe('clipPlayDuration', () => {
    it('is the whole take when nothing is trimmed', () => {
        expect(clipPlayDuration(makeClip({ type: 'audio' }), 10)).toBe(10);
    });

    it('subtracts both trim handles', () => {
        const clip = makeClip({ type: 'audio', trimStart: 1.5, trimEnd: 2 });
        expect(clipPlayDuration(clip, 10)).toBe(6.5);
    });

    it('never goes negative when the trims overlap', () => {
        const clip = makeClip({ type: 'audio', trimStart: 8, trimEnd: 8 });
        expect(clipPlayDuration(clip, 10)).toBe(0);
    });
});

// ============================================
// Render plan — the export/playback contract
// ============================================

describe('buildRenderPlan', () => {
    it('places clips at their bar positions in seconds', () => {
        const project = makeProject({
            clips: [
                makeClip({ id: 'first', startBar: 0 }),
                makeClip({ id: 'second', startBar: 4 }),
            ],
        });
        const plan = buildRenderPlan(project);

        expect(plan.clips.map((c) => [c.clipId, c.startSeconds])).toEqual([
            ['first', 0],
            ['second', 8],
        ]);
    });

    it('reports the musical duration without any export tail', () => {
        // The arrangement runs to bar 12 (the empty clip still occupies the
        // timeline), and 12 bars at 120bpm 4/4 is 24s.
        const plan = buildRenderPlan(makeMixedProject());
        expect(plan.durationSeconds).toBe(24);
    });

    it('drops clips that cannot make a sound', () => {
        const project = makeProject({
            clips: [
                makeClip({ id: 'has-notes' }),
                makeClip({ id: 'no-notes', notes: [] }),
                makeClip({ id: 'audio-without-take', type: 'audio', notes: undefined }),
                makeClip({ id: 'audio-with-take', type: 'audio', notes: undefined, activeTakeId: 'take-1' }),
            ],
        });
        const plan = buildRenderPlan(project);

        expect(plan.clips.map((c) => c.clipId)).toEqual(['has-notes', 'audio-with-take']);
        expect(plan.clips.find((c) => c.clipId === 'audio-with-take')?.kind).toBe('audio');
    });

    it('drops clips whose track no longer exists', () => {
        const project = makeProject({
            clips: [makeClip({ id: 'orphan', trackId: 'deleted-track' })],
        });
        expect(buildRenderPlan(project).clips).toHaveLength(0);
    });

    it('marks clips on muted tracks inaudible but still plans them', () => {
        const plan = buildRenderPlan(makeMixedProject());
        const bassClip = plan.clips.find((c) => c.clipId === 'bass-clip');

        expect(bassClip).toBeDefined();
        expect(bassClip?.audible).toBe(false);
    });

    it('applies solo across both tracks and clips', () => {
        const project = makeMixedProject();
        project.tracks = project.tracks.map((t) =>
            t.id === 'keys' ? { ...t, solo: true } : t
        );

        const plan = buildRenderPlan(project);
        const gains = Object.fromEntries(plan.tracks.map((t) => [t.trackId, t.gain]));

        expect(gains).toEqual({ drums: 0, bass: 0, keys: 0.5 });
        expect(plan.clips.filter((c) => c.audible).map((c) => c.clipId)).toEqual(['keys-clip']);
    });

    it('excludes bypassed effects so FX bypass means the same thing live and on export', () => {
        const project = makeProject({
            tracks: [
                makeTrack({
                    effects: [
                        { id: 'on', type: 'reverb', active: true, params: {} },
                        { id: 'off', type: 'delay', active: false, params: {} },
                    ],
                }),
            ],
        });

        const plan = buildRenderPlan(project);
        expect(plan.tracks[0].activeEffects.map((e) => e.id)).toEqual(['on']);
    });

    it('is deterministic — the same project always plans identically', () => {
        const project = makeMixedProject();
        expect(buildRenderPlan(project)).toEqual(buildRenderPlan(project));
    });

    it('matches its recorded shape (golden)', () => {
        // A change to this snapshot means playback AND export both changed.
        // That is allowed — but it must be deliberate.
        expect(buildRenderPlan(makeMixedProject())).toMatchInlineSnapshot(`
          {
            "beatsPerBar": 4,
            "bpm": 120,
            "clips": [
              {
                "audible": true,
                "clipId": "drum-clip",
                "kind": "midi",
                "startSeconds": 0,
                "trackId": "drums",
              },
              {
                "audible": false,
                "clipId": "bass-clip",
                "kind": "midi",
                "startSeconds": 0,
                "trackId": "bass",
              },
              {
                "audible": true,
                "clipId": "keys-clip",
                "kind": "midi",
                "startSeconds": 8,
                "trackId": "keys",
              },
            ],
            "durationSeconds": 24,
            "tracks": [
              {
                "activeEffects": [],
                "audible": true,
                "gain": 0.9,
                "pan": 0,
                "trackId": "drums",
              },
              {
                "activeEffects": [],
                "audible": false,
                "gain": 0,
                "pan": 0,
                "trackId": "bass",
              },
              {
                "activeEffects": [],
                "audible": true,
                "gain": 0.5,
                "pan": 0,
                "trackId": "keys",
              },
            ],
          }
        `);
    });
});
