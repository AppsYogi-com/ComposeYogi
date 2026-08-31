// ============================================
// ComposeYogi — Editor Preview
// ============================================
//
// The sound an editor makes when you click a note, a key, or a drum lane.
//
// It exists because both editors used to build their own
// `new Tone.PolySynth(...).toDestination()` and trigger it directly. Two things
// were wrong with that, and the first is a bug a user reported:
//
//   - **`.toDestination()` goes straight to the speakers.** It bypasses the
//     track's effects, its fader, its pan, the master limiter, the visualiser —
//     and **mute and solo**. Measured with every track muted: clicking a drum in
//     the sequencer put −34.8 dB on the output while the mixer's own analyser
//     stayed at −891 dB. So a muted track could still be heard, which is the
//     one thing "muted" is supposed to promise.
//   - **It was not the track's instrument.** A generic triangle-wave PolySynth
//     auditioned every track, so clicking a note on a Rhodes played something
//     that was not the Rhodes, and clicking a drum lane played a MembraneSynth
//     rather than the kit.
//
// Both are the same fix: build the voice the way the scheduler does and route it
// where the scheduled clips go. That is what `live-play.ts` already does for the
// on-screen keyboard, and this is deliberately its smaller sibling — one voice,
// one-shot notes, no note book, no pedal, no capture.
//
// **A muted track's preview is silent, and that is correct.** It is what the
// bug report asked for and what Logic and Ableton do: the preview is the track,
// so anything that silences the track silences it.

import * as Tone from 'tone';

import { createLogger } from '@/lib/logger';

import { audioEngine } from './engine';
import { velocityToGain } from './midi-messages';
import { playoutManager } from './playout';
import { createSynthForTrack, trackVoiceKey } from './scheduler';
import { waitForSynthReady, type ResolvedInstrument } from './synth-presets';

import type { Track } from '@/types';

const logger = createLogger('PreviewVoice');

/** How long an auditioned note sounds. Long enough to hear, short enough to spam. */
const PREVIEW_SECONDS = 0.4;

/**
 * A percussion hit ignores the requested length.
 *
 * A `NoiseSynth` has no pitch and no sustain worth holding — a hi-hat does not
 * stay open because you held the key — and the same is true of an audition.
 */
const DRUM_HIT_SECONDS = 0.25;

class PreviewVoice {
    private instrument: ResolvedInstrument | null = null;
    private key: string | null = null;
    private destination: Tone.ToneAudioNode | null = null;
    private building: Promise<void> | null = null;

    /**
     * Build the voice for a track, if it is not already the one we hold.
     *
     * Safe to call on every render: it is a no-op when the voice is unchanged,
     * apart from re-running `connect`, which is idempotent and which matters —
     * the track's chain may not have existed when the voice was first built.
     */
    async prepare(track: Track | null): Promise<void> {
        if (!track) {
            this.dispose();
            return;
        }

        const key = trackVoiceKey(track);
        if (key === this.key && this.instrument) {
            this.connect(track);
            return;
        }

        // A second call while the first is still awaiting a sampler's buffers
        // would build two voices and leak the first.
        if (this.building) await this.building;
        if (key === this.key && this.instrument) {
            this.connect(track);
            return;
        }

        this.building = (async () => {
            this.teardown();
            const instrument = createSynthForTrack(track);
            // Samplers load asynchronously and are silent until they are ready.
            await waitForSynthReady(instrument.synth);
            this.instrument = instrument;
            this.key = key;
            this.connect(track);
        })();

        try {
            await this.building;
        } catch (error) {
            logger.warn('Could not build the preview voice', { error });
        } finally {
            this.building = null;
        }
    }

    /**
     * Audition one pitch on a track.
     *
     * Starts the audio context first. **A voice built on a suspended context
     * constructs fine, connects fine, and `triggerAttackRelease` returns without
     * complaint while making no sound at all** — that shipped once in live play
     * and cost a whole feature. Clicking in an editor is a user gesture, so this
     * is the right place to start it.
     */
    async play(track: Track | null, pitch: number, velocity: number): Promise<void> {
        if (!track) return;

        try {
            await audioEngine.initialize();
            await playoutManager.initialize();
        } catch (error) {
            logger.error('Could not start audio for the preview', { error });
            return;
        }

        await this.prepare(track);
        if (!this.instrument) return;

        const { synth } = this.instrument;
        const gain = velocityToGain(velocity);

        try {
            if (synth instanceof Tone.NoiseSynth) {
                synth.triggerAttackRelease(DRUM_HIT_SECONDS, undefined, gain);
                return;
            }
            synth.triggerAttackRelease(
                Tone.Frequency(pitch, 'midi').toFrequency(),
                PREVIEW_SECONDS,
                undefined,
                gain
            );
        } catch (error) {
            logger.warn('Preview note failed to start', { pitch, error });
        }
    }

    /**
     * Route into the track's chain, or to the destination if the mixer is not up.
     *
     * `output`, not `synth` — a custom instrument's Brightness filter sits
     * between the two. The same footnote is on `scheduleMidiClip` and on live
     * play's `connect`, and it is the same bug all three times.
     *
     * The fallback is only for the window before `playoutManager.initialize()`
     * resolves. `play` awaits that first, so in practice it is never taken; it
     * is here so a preview is never silent because of an ordering accident.
     */
    private connect(track: Track): void {
        if (!this.instrument) return;

        const input = playoutManager.getTrackInput(track);
        const next: Tone.ToneAudioNode = input ?? Tone.getDestination();
        if (next === this.destination) return;

        this.instrument.output.disconnect();
        this.instrument.output.connect(next);
        this.destination = next;
    }

    private teardown(): void {
        if (this.instrument) {
            this.instrument.synth.dispose();
            for (const node of this.instrument.nodes) node.dispose();
        }
        this.instrument = null;
        this.key = null;
        this.destination = null;
    }

    dispose(): void {
        this.teardown();
    }
}

/**
 * One voice for the whole app.
 *
 * Only one editor is open at a time — the Piano Roll, Drums and Waveform tabs
 * share a panel and a clip — so a singleton cannot be two things at once, and it
 * means switching between tabs does not rebuild a sampler's buffers.
 */
export const previewVoice = new PreviewVoice();
