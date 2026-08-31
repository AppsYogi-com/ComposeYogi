// ============================================
// ComposeYogi — Play It Live (Sprint 8.7.6)
// ============================================
//
// One voice, kept alive between keypresses, playing the track you are pointed
// at — and, while a take is running, remembering what it played.
//
// Two inputs reach it: a MIDI keyboard (`midi-input.ts`) and the computer
// keyboard (`typing-keys.ts`). They meet here rather than each doing their own
// thing, because everything downstream of "a note started" is identical for
// both and a second implementation is a second set of hanging notes.
//
// **The voice is built by the scheduler's own resolver.** `createSynthForTrack`
// is the same function `scheduleMidiClip` calls, so a custom instrument played
// live is the instrument that clip will play back with. Building a second
// "preview synth" is the mistake the piano roll's audition still makes — its
// audition is a hardcoded triangle wave, so auditioning a note on a track
// carrying a Rhodes plays something that is not the Rhodes.
//
// **The output goes to the track's entry node**, so live playing runs through
// that track's effects, fader, pan and mute. Those nodes are created once by
// `PlayoutManager` and survive every reschedule — the scheduled clips are torn
// down and rebuilt around them — which is what makes the connection safe to
// hold. Connecting to a scheduled clip's chain would go silent the moment
// anything rescheduled.
//
// **The audio context has to be running before any of that means anything.**
// A `triggerAttack` on a suspended context is silent and throws nothing, so a
// voice built before the first user gesture looks completely healthy and makes
// no sound. That shipped, briefly, and it is why `ensureAudio()` exists and why
// `isAudible()` is a state the UI can show rather than a thing to assume.

import * as Tone from 'tone';

import { createLogger } from '@/lib/logger';

import { audioEngine } from './engine';
import { bendToCents, velocityToGain } from './midi-messages';
import { closeHeldNotes, type PerformedNote } from './midi-take';
import { NoteBook } from './note-book';
import { playoutManager } from './playout';
import { createSynthForTrack, releaseSynth, trackVoiceKey } from './scheduler';
import { waitForSynthReady, type ResolvedInstrument } from './synth-presets';

import type { Track } from '@/types';

const logger = createLogger('LivePlay');

/** Velocity a note gets when the source does not send one (a click, a typed key). */
export const DEFAULT_LIVE_VELOCITY = 100;

/**
 * How long a percussion hit rings when it is played live.
 *
 * A `NoiseSynth` has no pitch and no sustain worth holding: a hi-hat does not
 * stay open because you kept the key down, and pretending it does leaves it
 * open forever.
 */
const DRUM_HIT_SECONDS = 0.25;

// ============================================
// Live Play Engine
// ============================================

class LivePlayEngine {
    private instrument: ResolvedInstrument | null = null;
    private key: string | null = null;
    private destination: Tone.ToneAudioNode | null = null;

    /**
     * The track the voice is pointed at, kept so the routing can be redone.
     *
     * `connect` asks `PlayoutManager` for the track's entry node, and that node
     * does not exist until the manager is initialized — which is asynchronous
     * and, on the very first open, finishes *after* the voice is built. Without
     * somewhere to remember the track, the voice stayed on the raw destination
     * for the rest of the session: audible, but bypassing the track's fader,
     * pan, mute and effects, and invisible to the visualiser. Measured, not
     * reasoned about: the tap on the voice read 1.6e-1 while the master
     * analyser read silence.
     */
    private track: Track | null = null;

    /** Keys down, the sustain pedal, and which of those actually stops a note. */
    private notes = new NoteBook();

    /** The take in flight, or null. Written by both inputs, read on stop. */
    private capture: PerformedNote[] | null = null;

    /** Detune in cents from the pitch-bend wheel, reapplied on every rebuild. */
    private bendCents = 0;

    /**
     * What the on-screen keyboard lights up.
     *
     * A cached copy plus listeners rather than a Zustand store, for the reason
     * the custom-instrument registry is not one: the writers are a DOM listener
     * and a Web MIDI callback, neither of which is React, and
     * `useSyncExternalStore` wants a snapshot stable by reference between
     * changes. Rebuilt only on a note, so it costs one array copy per keypress
     * rather than one per frame.
     */
    private snapshot: LiveSnapshot = { sounding: [], down: [], pedal: false, audible: false };
    private listeners = new Set<() => void>();

    // ========================================
    // Audio readiness
    // ========================================

    /**
     * Start the audio context, if a user gesture has not already.
     *
     * Everything about a suspended context looks fine: the synth constructs,
     * the graph connects, `triggerAttack` returns without complaint, and no
     * sound comes out. Opening the keyboard *is* the gesture, so this is called
     * from the toggle and again from the first note — the second call is free
     * when the first worked, and it covers the keyboard being opened
     * programmatically.
     */
    async ensureAudio(): Promise<void> {
        try {
            await audioEngine.initialize();
            await playoutManager.initialize();
        } catch (error) {
            logger.error('Could not start audio for live play', { error });
        }

        // The mixer exists now, so redo the routing. On the first open this is
        // the call that moves the voice off the raw destination and onto the
        // track's chain; every later call is a no-op, because `connect` returns
        // early when the node has not changed.
        if (this.track) this.connect(this.track);
        this.publish();
    }

    /** Whether a note played right now would actually be heard. */
    isAudible(): boolean {
        return this.instrument !== null && Tone.getContext().state === 'running';
    }

    // ========================================
    // Voice
    // ========================================

    /**
     * Point the engine at a track, building or rebuilding the voice if needed.
     *
     * Idempotent: called on every render of the live-play bar, and does nothing
     * at all when the track and its instrument are unchanged.
     */
    async setTrack(track: Track | null): Promise<void> {
        this.track = track;
        if (!track) {
            this.teardown();
            return;
        }

        const key = trackVoiceKey(track);
        if (key === this.key && this.instrument) {
            // Same voice, but the track's chain may have been created since —
            // reconnecting is cheap and idempotent, and skipping it leaves the
            // voice on the destination after the mixer caught up.
            this.connect(track);
            this.publish();
            return;
        }

        this.teardown();

        const instrument = createSynthForTrack(track);
        // Samplers load their buffers asynchronously and are silent until they
        // are ready. The scheduler waits for the same reason.
        await waitForSynthReady(instrument.synth);

        this.instrument = instrument;
        this.key = key;
        this.applyBend();
        this.connect(track);
        this.publish();

        logger.debug('Live voice built', { trackId: track.id, key });
    }

    /**
     * Route the voice into the track's chain, or to the destination if the
     * playout manager has not been initialized yet.
     *
     * `output`, not `synth` — a custom instrument's Brightness filter sits
     * between the two, and connecting the voice directly would bypass it. The
     * same footnote is on `scheduleMidiClip`, and it is the same bug.
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
            this.notes.clear();
            releaseSynth(this.instrument.synth);
            this.instrument.synth.dispose();
            for (const node of this.instrument.nodes) node.dispose();
        }

        this.instrument = null;
        this.key = null;
        this.destination = null;
        this.notes = new NoteBook();
        this.publish();
        // `this.track` is deliberately left alone — `setTrack` owns it, and
        // `teardown` runs *inside* `setTrack` on the way to building the next
        // voice.
    }

    // ========================================
    // Notes
    // ========================================

    /** Start a note. Ignores a pitch already down — see `NoteBook`. */
    noteOn(pitch: number, velocity: number = DEFAULT_LIVE_VELOCITY): void {
        if (!this.instrument) return;

        const action = this.notes.press(pitch);
        if (!action.attack.length) return;

        this.recordNoteOn(pitch, velocity);
        this.attack(pitch, velocity);
        this.publish();
    }

    /** End a note. Under the sustain pedal this only changes bookkeeping. */
    noteOff(pitch: number): void {
        const wasDown = this.notes.heldKeys().includes(pitch);
        const action = this.notes.release(pitch);
        if (!wasDown) return;

        // The take records the key, not the pedal: a note held by the pedal is
        // still a note the player stopped playing, and writing the pedal's
        // release into the clip would stretch every note to the pedal lift.
        this.recordNoteOff(pitch);

        for (const released of action.release) this.release(released);
        this.reassignMonophonic(action.release.length > 0);
        this.publish();
    }

    /**
     * The sustain pedal moved.
     *
     * The early-out is a render guard, not a correctness one — `NoteBook`
     * handles a repeated message correctly on its own. A continuous pedal sends
     * a stream of CC 64 values the whole time it is held, each parsing to the
     * same boolean, and publishing on every one would re-render the keyboard
     * around fifty times a second for no change. Not unit-testable: everything
     * below it needs Tone.
     */
    setSustain(down: boolean): void {
        if (this.notes.isPedalDown() === down) return;

        const action = this.notes.setPedal(down);
        for (const pitch of action.release) this.release(pitch);
        this.reassignMonophonic(action.release.length > 0);
        this.publish();
    }

    /** The pitch-bend wheel moved, -1..1. */
    setPitchBend(bend: number): void {
        this.bendCents = bendToCents(bend);
        this.applyBend();
    }

    /**
     * Silence everything.
     *
     * The escape hatch for a note that got away — a key-up swallowed by a
     * window blur, a MIDI cable pulled mid-chord, a keyboard's own panic
     * button. Bound to Escape while the bar is open, and called on teardown and
     * on every voice rebuild.
     */
    allNotesOff(): void {
        const action = this.notes.clear();
        for (const pitch of action.release) this.recordNoteOff(pitch);

        // `releaseSynth` rather than a release per pitch: a monophonic voice has
        // one note to stop whatever the book says, and a PolySynth's
        // `releaseAll` also catches anything the book has lost track of, which
        // is exactly the situation a panic button is for.
        if (this.instrument) releaseSynth(this.instrument.synth);
        this.publish();
    }

    // ========================================
    // The synth
    // ========================================

    private attack(pitch: number, velocity: number): void {
        if (!this.instrument) return;
        const { synth } = this.instrument;
        const gain = velocityToGain(velocity);

        try {
            if (synth instanceof Tone.NoiseSynth) {
                synth.triggerAttackRelease(DRUM_HIT_SECONDS, undefined, gain);
                return;
            }
            synth.triggerAttack(Tone.Frequency(pitch, 'midi').toFrequency(), undefined, gain);
        } catch (error) {
            logger.warn('Live note failed to start', { pitch, error });
        }
    }

    private release(pitch: number): void {
        if (!this.instrument) return;
        const { synth } = this.instrument;

        try {
            // A noise hit released itself at attack time; there is nothing here
            // to stop, and asking would cut a hit that is still decaying.
            if (synth instanceof Tone.NoiseSynth) return;

            if (synth instanceof Tone.PolySynth || synth instanceof Tone.Sampler) {
                synth.triggerRelease(Tone.Frequency(pitch, 'midi').toFrequency());
                return;
            }
            // Monophonic: the release is decided in `reassignMonophonic`, which
            // knows whether anything is left to fall back to.
        } catch (error) {
            logger.warn('Live note failed to stop', { pitch, error });
        }
    }

    /**
     * Monophonic voices have one note and no idea which pitch it is playing.
     *
     * Releasing on any key-up would cut whatever is *currently* sounding, so the
     * voice is released only when nothing is left, and re-attacked on the note
     * below when a higher one is let go — which is how every monophonic synth
     * ever made behaves.
     */
    private reassignMonophonic(somethingWasReleased: boolean): void {
        if (!this.instrument || !somethingWasReleased) return;
        const { synth } = this.instrument;
        if (
            synth instanceof Tone.PolySynth
            || synth instanceof Tone.Sampler
            || synth instanceof Tone.NoiseSynth
        ) return;

        const sounding = this.notes.sounding();
        try {
            if (sounding.length === 0) {
                synth.triggerRelease();
            } else {
                const next = sounding[sounding.length - 1];
                synth.triggerAttack(Tone.Frequency(next, 'midi').toFrequency());
            }
        } catch (error) {
            logger.warn('Monophonic reassignment failed', { error });
        }
    }

    /**
     * Push the bend onto the voice.
     *
     * `detune` is in cents and exists on every voice this can build except a
     * `NoiseSynth`, which has no pitch to bend. A `PolySynth` forwards it to
     * every voice it owns, so a bent chord bends as a chord.
     */
    private applyBend(): void {
        const synth = this.instrument?.synth;
        if (!synth || synth instanceof Tone.NoiseSynth) return;

        try {
            const detune = (synth as unknown as { detune?: { value: number } }).detune;
            if (detune) detune.value = this.bendCents;
        } catch (error) {
            logger.warn('Pitch bend could not be applied', { error });
        }
    }

    // ========================================
    // What the UI reads
    // ========================================

    getSnapshot(): LiveSnapshot {
        return this.snapshot;
    }

    subscribe(listener: () => void): () => void {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    }

    private publish(): void {
        this.snapshot = {
            sounding: this.notes.sounding(),
            down: [...this.notes.heldKeys()],
            pedal: this.notes.isPedalDown(),
            audible: this.isAudible(),
        };
        for (const listener of this.listeners) listener();
    }

    // ========================================
    // Capture
    // ========================================

    /** Begin remembering what is played. Called by the recording manager. */
    startCapture(): void {
        this.capture = [];

        // A key already down when recording starts is playing *now*, so the take
        // begins with it. Without this, a player holding a pad through the
        // count-in records the silence after they let go.
        const now = this.transportSeconds();
        for (const pitch of this.notes.heldKeys()) {
            this.capture.push({
                pitch,
                velocity: DEFAULT_LIVE_VELOCITY,
                startSeconds: now,
                endSeconds: null,
            });
        }
    }

    /**
     * Stop remembering, and hand back the performance.
     *
     * Held notes are closed at the stop time rather than dropped — ending a take
     * on a held chord is normal, and a recorder that loses exactly the last
     * thing you played is one nobody trusts twice.
     */
    stopCapture(): PerformedNote[] {
        const captured = this.capture ?? [];
        this.capture = null;
        return closeHeldNotes(captured, this.transportSeconds());
    }

    /** Discard a take in progress without producing notes. */
    cancelCapture(): void {
        this.capture = null;
    }

    private transportSeconds(): number {
        try {
            return Tone.getTransport().seconds;
        } catch {
            return 0;
        }
    }

    private recordNoteOn(pitch: number, velocity: number): void {
        this.capture?.push({
            pitch,
            velocity,
            startSeconds: this.transportSeconds(),
            endSeconds: null,
        });
    }

    private recordNoteOff(pitch: number): void {
        if (!this.capture) return;

        // Backwards: the same pitch can be in the buffer several times over a
        // take, and the one being released is the most recent still open.
        for (let i = this.capture.length - 1; i >= 0; i--) {
            const note = this.capture[i];
            if (note.pitch === pitch && note.endSeconds === null) {
                note.endSeconds = this.transportSeconds();
                return;
            }
        }
    }

    // ========================================
    // Cleanup
    // ========================================

    dispose(): void {
        this.capture = null;
        this.bendCents = 0;
        this.teardown();
        this.track = null;
    }
}

/** Everything the live-play UI renders from. */
export interface LiveSnapshot {
    /** Pitches sounding — keys down plus whatever the pedal is holding. */
    sounding: number[];
    /**
     * Pitches whose **key is physically down**.
     *
     * Separate from `sounding` because on a real piano the key comes back up
     * when you let go; the damper is what the pedal holds, not the key. Drawing
     * every sounding note as a pressed key made the sustain pedal look like it
     * had latched the keyboard down — reported as "sustain toggle keeps the
     * button/key pressed, where an actual piano just holds the note longer".
     * The distinction already existed inside `NoteBook`, which keeps `down` and
     * `pedalled` disjoint; it just never reached the UI.
     */
    down: number[];
    /** Whether the sustain pedal is down. */
    pedal: boolean;
    /** Whether a note played now would be heard at all. */
    audible: boolean;
}

// ============================================
// Singleton Export
// ============================================

export const livePlayEngine = new LivePlayEngine();
