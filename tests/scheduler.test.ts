// ============================================
// ComposeYogi — Scheduler Tests
// ============================================
//
// These guard the contract that makes an export sound like the playback:
// both paths schedule from the render plan produced here, so if the plan is
// right for a project, both paths are right for that project.
//
// The last section extends that contract to the screen: what the arrangement
// draws as silent has to be what this file decides is silent.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import ts from 'typescript';
import { describe, expect, it } from 'vitest';

import {
    initialTrackGain,
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

describe('a chain is born at the right gain', () => {
    // The second half of "I muted the track and I can still hear it". A track's
    // chain is created lazily by whoever asks for its input first, and on a page
    // where nothing has played that is the live keyboard or an editor preview,
    // not the transport. Those chains used to start at `track.volume`, so a
    // muted track previewed at full level until the transport ran.
    const quiet = makeTrack({ id: 'a', volume: 0.5 });
    const other = makeTrack({ id: 'b', volume: 0.9 });

    it('starts a normal track at its fader', () => {
        expect(initialTrackGain(quiet, [quiet, other])).toBe(0.5);
    });

    it('starts a muted track silent', () => {
        const muted = { ...quiet, muted: true };
        expect(initialTrackGain(muted, [muted, other])).toBe(0);
    });

    it('starts a track silent while another track is soloed', () => {
        const soloed = { ...other, solo: true };
        expect(initialTrackGain(quiet, [quiet, soloed])).toBe(0);
        expect(initialTrackGain(soloed, [quiet, soloed])).toBe(0.9);
    });

    it('still honours mute when nothing has been applied yet', () => {
        // The cold-page case: the mixer has resolved nothing, so nobody is
        // soloed — but mute is still knowable, and mute is the one that was
        // audibly wrong.
        expect(initialTrackGain(quiet, [])).toBe(0.5);
        expect(initialTrackGain({ ...quiet, muted: true }, [])).toBe(0);
        expect(initialTrackGain({ ...quiet, solo: true }, [])).toBe(0.5);
    });

    it('is the value playout actually builds the node with', () => {
        // Tone cannot be constructed here, so the only way to pin the call is to
        // read it. `getOrCreateTrackChain` reaching for `track.volume` directly
        // is exactly the bug, and it is invisible to every other test.
        const source = readFileSync(join(ROOT, 'lib', 'audio', 'playout.ts'), 'utf8');
        const code = source
            .split('\n')
            .filter((line) => !line.trim().startsWith('*') && !line.trim().startsWith('//'))
            .join('\n');
        expect(code).toContain('initialTrackGain(track, this.mixTracks)');
        // …and that the list it reads is actually kept up to date. Both halves
        // are needed: reading a list nobody fills is the same silence bug with
        // an extra step, and Tone cannot be constructed here to catch it any
        // other way.
        expect(
            (code.match(/this\.mixTracks = tracks/g) ?? []).length,
            'applyMixState and updateSoloState must both record the track list'
        ).toBe(2);
        expect(
            /new Tone\.Gain\(\s*track\.volume/.test(code),
            'playout builds a track gain from the raw fader — use initialTrackGain'
        ).toBe(false);
    });
});

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
    it('carries the project swing onto the plan', () => {
        // The plan is where both the live and the offline path read it from, so
        // a hard-coded value here would render every export straight however
        // the project was set — and playback would not disagree, because it
        // reads the same wrong number.
        expect(buildRenderPlan(makeProject({ ...makeMixedProject(), swing: 65 })).swing).toBe(65);
    });

    it('treats a project saved before swing existed as straight', () => {
        expect(buildRenderPlan(makeProject({ ...makeMixedProject(), swing: undefined })).swing).toBe(0);
    });

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
            "swing": 0,
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

// ============================================
// The picture agrees with the sound
// ============================================
//
// `isTrackAudible` is the whole definition of silence, and the arrangement used
// to keep a second one: the lane dimmed on `track.muted`, so a track silenced
// by somebody else's solo looked exactly like one that was playing. Solo was
// audible and invisible, which is the worst way for a mixer to be wrong —
// nothing on screen is missing, it is just quietly answering a different
// question.
//
// Two rules, one in each direction. Neither can check that a dim is *right*;
// only that the question was asked of the one function that knows. A condition
// laundered through a local variable walks past rule 1, the same way an `id` no
// label points at walks past the accessibility suite.

const ROOT = join(__dirname, '..');
const SOURCE_DIRS = ['app', 'components'];

/** Deciding one of these from a raw mix flag is the mistake. */
const SILENCE_CUE = /\bopacity-|\bgrayscale\b/;

/** The flags that only `isTrackAudible` knows how to combine. */
const RAW_MIX_FLAGS = /\.(muted|solo)\b/;

function walkTsx(dir: string): string[] {
    const found: string[] = [];
    for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) found.push(...walkTsx(full));
        else if (entry.endsWith('.tsx')) found.push(full);
    }
    return found;
}

function sourceFiles(): ts.SourceFile[] {
    return SOURCE_DIRS
        .flatMap((dir) => walkTsx(join(ROOT, dir)))
        .map((file) => ts.createSourceFile(
            file,
            readFileSync(file, 'utf8'),
            ts.ScriptTarget.Latest,
            true,
            ts.ScriptKind.TSX
        ));
}

describe('the arrangement draws the mix the scheduler renders', () => {
    it('never decides a dim from muted or solo directly', () => {
        const files = sourceFiles();
        expect(files.length, 'the scan found no components — it has broken').toBeGreaterThan(0);

        const offenders: string[] = [];

        for (const sf of files) {
            const visit = (node: ts.Node) => {
                let condition: ts.Node | null = null;
                let branches: ts.Node[] = [];

                if (ts.isConditionalExpression(node)) {
                    condition = node.condition;
                    branches = [node.whenTrue, node.whenFalse];
                } else if (
                    ts.isBinaryExpression(node) &&
                    (node.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken ||
                        node.operatorToken.kind === ts.SyntaxKind.BarBarToken)
                ) {
                    condition = node.left;
                    branches = [node.right];
                }

                if (condition && RAW_MIX_FLAGS.test(condition.getText(sf))) {
                    for (const branch of branches) {
                        if (!SILENCE_CUE.test(branch.getText(sf))) continue;
                        const line = sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
                        offenders.push(
                            `${relative(ROOT, sf.fileName)}:${line}  ${node.getText(sf).replace(/\s+/g, ' ').slice(0, 100)}`
                        );
                    }
                }

                ts.forEachChild(node, visit);
            };
            ts.forEachChild(sf, visit);
        }

        expect(
            offenders,
            'a track silenced by another track\'s solo is just as silent as a muted one — '
            + 'ask isTrackAudible(track, project.tracks) instead:\n' + offenders.join('\n')
        ).toEqual([]);
    });

    it('asks isTrackAudible somewhere in the arrangement', () => {
        // Rule 1 alone would stay green if the dimming were deleted outright,
        // which is the same silent failure in a new place.
        const callers = walkTsx(join(ROOT, 'components', 'compose'))
            .filter((file) => /\bisTrackAudible\b/.test(readFileSync(file, 'utf8')))
            .map((file) => relative(ROOT, file));

        expect(
            callers,
            'nothing in components/compose reads isTrackAudible, so the arrangement '
            + 'no longer shows which tracks a solo has silenced'
        ).not.toEqual([]);
    });
});

// ============================================
// Nothing plays outside the mixer
// ============================================
//
// The bug this pins: both editors auditioned notes through their own
// `new Tone.PolySynth(...).toDestination()`. `toDestination()` is Tone's "wire
// this straight to the speakers", so those previews skipped the track's
// effects, its fader, its pan, the master limiter, the visualiser — and **mute
// and solo**. Measured in the running app with every track muted, clicking a
// drum in the sequencer put −34.8 dB on the output while the mixer's own
// analyser sat at −891 dB: the one meter that could have shown the problem was
// downstream of it.
//
// A component has no business connecting to the destination. Anything that
// makes a sound belongs to a track, and a track's sound enters at
// `playoutManager.getTrackInput(track)` — which is what `preview-voice.ts` and
// `live-play.ts` both do.

describe('nothing in the UI plays straight to the speakers', () => {
    it('leaves toDestination to the audio layer', () => {
        const files = sourceFiles();
        expect(files.length, 'the scan found no components — it has broken').toBeGreaterThan(0);

        // Two places are allowed, and both are allowed for the same reason:
        // what they play does not belong to a track, so there is no track chain
        // to route it through.
        //
        //   InstrumentEditor  auditions an instrument *spec* while you design
        //                     it. It is a library item in a modal; no clip and
        //                     no track exist yet.
        //   WaveformEditor    is a monitor on the raw take, and says so — it
        //                     deliberately reproduces no effects, no fader and
        //                     no macros either, only the trim, fades and
        //                     stretch that this panel edits. Excluding the
        //                     mixer is the whole point of it, not an oversight.
        //
        // The piano roll and the drum sequencer are *not* on this list, and
        // that is the fix: what they audition is a note on a track's own
        // instrument, which is exactly the thing mute and solo govern.
        const ALLOWED = new Set([
            join('components', 'compose', 'InstrumentEditor.tsx'),
            join('components', 'compose', 'editors', 'WaveformEditor.tsx'),
        ]);

        const offenders: string[] = [];
        for (const sf of files) {
            const path = relative(ROOT, sf.fileName);
            if (ALLOWED.has(path)) continue;
            sf.text.split('\n').forEach((line, index) => {
                if (line.trim().startsWith('//') || line.trim().startsWith('*')) return;
                if (/\.toDestination\s*\(/.test(line) || /getDestination\s*\(/.test(line)) {
                    offenders.push(`${path}:${index + 1}  ${line.trim()}`);
                }
            });
        }

        // A stale exception is as bad as a missing one: if a named file stops
        // reaching for the destination, it should leave this list.
        for (const allowed of ALLOWED) {
            const sf = files.find((f) => relative(ROOT, f.fileName) === allowed);
            expect(sf, `${allowed} is on the exception list but does not exist`).toBeDefined();
            expect(
                /\.toDestination\s*\(|getDestination\s*\(/.test(sf!.text),
                `${allowed} no longer plays to the destination — take it off the exception list`
            ).toBe(true);
        }

        expect(
            offenders,
            'A component must not connect audio to the destination — that bypasses the '
            + "track's fader, pan, effects, and mute and solo. Route through "
            + 'playoutManager.getTrackInput(track); see lib/audio/preview-voice.ts.'
        ).toEqual([]);
    });
});
