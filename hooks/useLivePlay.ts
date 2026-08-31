// ============================================
// ComposeYogi — Live Playing (Sprint 8.7.6)
// ============================================
//
// Wires the two inputs — a MIDI keyboard and the computer keyboard — into the
// one live voice, and keeps that voice pointed at the right track.
//
// The keyboard listener is a raw `keydown`/`keyup` pair rather than fourteen
// more `useShortcut` registrations, because notes are not shortcuts: a note has
// a *release*, and react-hotkeys-hook models a keypress as an event, not as a
// duration. Holding a key has to hold a note, and there is no combination of
// hotkey registrations that produces that.

import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from 'react';

import { livePlayEngine } from '@/lib/audio/live-play';
import {
    getMidiState,
    requestMidiAccess,
    subscribeToMidiMessages,
    subscribeToMidiState,
    type MidiState,
} from '@/lib/audio/midi-input';
import { pitchForKey } from '@/lib/music/typing-keys';
import { useProjectStore, useUIStore } from '@/lib/store';

import type { Track } from '@/types';

/**
 * The track live playing sounds through.
 *
 * The armed track wins, then the selected one. Arming is the stronger signal
 * because it is the one that says "what I play lands here" — and a player who
 * armed a track and then clicked another one to look at it would otherwise
 * record onto the track they were only reading.
 *
 * **Then the first melodic track**, and that fallback is not a nicety.
 * `selectedTrackId` is `null` on every fresh load, so without it the keyboard
 * opened onto nothing until you happened to click a lane: you pressed a key, a
 * key lit, and no sound came out. It reads as the feature being broken, and it
 * was reported as "opening it means nothing because without arm it doesn't
 * play" — arming was a red herring, an unclicked project was the cause.
 *
 * **Melodic before drum, and that order is the whole point of having one.** The
 * first version of this fallback took the first track that was not audio, and
 * every demo template opens with Drums — so the default experience became a
 * drawn piano, labelled C1 to C7, playing a kit: on a drum track those pitches
 * are General MIDI percussion slots, so the key marked C3 is a tom. A keyboard
 * whose labels are wrong is not obviously better than one that is silent. A
 * drum track is a fine target when it is *chosen*, by arming or selecting it;
 * it is a bad thing to land on by default.
 *
 * Audio is never a fallback and always honoured when explicitly selected: an
 * audio lane has no instrument, so defaulting onto one recreates the silence
 * this exists to prevent, while overriding a deliberate click would be the app
 * disagreeing with the user about what they selected.
 */
export function useLiveTarget(): Track | null {
    const tracks = useProjectStore((s) => s.project?.tracks);
    const selectedTrackId = useUIStore((s) => s.selectedTrackId);

    return useMemo(() => {
        if (!tracks?.length) return null;
        return (
            tracks.find((track) => track.armed)
            ?? tracks.find((track) => track.id === selectedTrackId)
            ?? tracks.find((track) => track.type === 'midi')
            ?? tracks.find((track) => track.type === 'drum')
            ?? null
        );
    }, [tracks, selectedTrackId]);
}

/** Web MIDI's state, as React state. */
export function useMidiState(): MidiState {
    return useSyncExternalStore(subscribeToMidiState, getMidiState, getMidiState);
}

/**
 * Keep the live voice built and pointed at the target track.
 *
 * Separate from the input listeners because it has a different lifetime: the
 * voice is rebuilt when the track's *instrument* changes, which is a project
 * edit, while the listeners come and go with the bar being open.
 */
function useLiveVoice(target: Track | null, active: boolean): void {
    // **Opening the keyboard starts the audio context.** This is the whole bug
    // that shipped: a synth built on a suspended context constructs fine,
    // connects fine, and `triggerAttack` returns without complaint — and makes
    // no sound at all. Nothing in the app started audio except pressing Play or
    // Record, so the keyboard was silent until you had already played the song.
    useEffect(() => {
        if (!active) return;
        void livePlayEngine.ensureAudio();
    }, [active]);

    useEffect(() => {
        if (!active) return;
        void livePlayEngine.setTrack(target);
    }, [
        active,
        target,
        // The instrument's identity, not just the track's: assigning a new
        // preset to the same track has to rebuild the voice, and `target` is a
        // new object on every project edit anyway, so naming the field that
        // matters is what keeps this from rebuilding on a volume change.
        target?.instrumentPreset,
    ]);

    // Tear the voice down when the bar closes, so a synth is not left in the
    // graph — and, more to the point, so a note held as the bar closed does not
    // sound forever.
    useEffect(() => {
        if (active) return;
        livePlayEngine.dispose();
    }, [active]);

    useEffect(() => () => livePlayEngine.dispose(), []);
}

/**
 * Play notes from the computer keyboard.
 *
 * Three guards, each of which is a bug if it is missing:
 *
 * - **Modifiers pass through.** `mod+z` must undo, not play a C. Shift is the
 *   exception: it only changes the case of the letter, and a shifted note key
 *   is the same physical key.
 * - **`event.repeat` is ignored.** A held key repeats at around 30 Hz, and a
 *   synth re-attacked thirty times a second is a buzz rather than a note.
 * - **Typing into a field is typing.** Renaming a track to "Bass" would
 *   otherwise play B, A, and two Ss while spelling it.
 *
 * The arrows shift the octave. Every other keyboard puts that on `z`/`x`, and
 * both of those are playing notes here — the two-row layout spends the whole of
 * both letter rows. The arrows are what a hand resting on the note rows can
 * still reach, and they are bound to nothing else: the app's only other arrow
 * handling is on the velocity lane's focused notes, and this listener already
 * stands down inside anything focusable.
 */
function useTypingKeyboard(active: boolean, octave: number, velocity: number): void {
    const shiftOctave = useUIStore((s) => s.shiftLivePlayOctave);

    /**
     * The octave and velocity the handlers read.
     *
     * Through a ref rather than the effect's dependency list, because the
     * listener's teardown releases every held note: naming `octave` as a
     * dependency meant that shifting the octave tore the listener down, killed
     * the chord being held, and installed a new one — which is precisely the
     * note that shifting octaves mid-chord exists to keep. The listener is
     * installed once per open now, and reads the current values when a key
     * arrives.
     */
    const settings = useRef({ octave, velocity });
    useEffect(() => {
        settings.current = { octave, velocity };
    });

    /**
     * The pitch each held key started on.
     *
     * Releasing at the *current* octave is wrong the moment the octave can
     * change while a key is down: the release goes to a pitch that was never
     * attacked, and the one that was sounds until the page is reloaded. That
     * was survivable while shifting octaves meant reaching for the mouse. With
     * the arrows on the keyboard it is one keystroke away, so the pitch is
     * remembered rather than recomputed.
     */
    const soundingByKey = useRef(new Map<string, number>());

    /**
     * Whether this keypress belongs to something else.
     *
     * Fields are the obvious half — renaming a track to "Bass" would otherwise
     * play B, A and two Ss while you spell it.
     *
     * The ARIA roles are the half that was missing, and the arrows are what
     * exposed it: a Radix slider's thumb is a `<span role="slider">`, not an
     * `<input>`, so dragging the velocity slider with the arrow keys shifted the
     * **octave** instead — the keyboard ate a control's own keys while that
     * control had focus. Every widget in this list has keys of its own that a
     * note or an octave would swallow, and `closest` rather than a tag check
     * because the focused node is usually a thumb or an option inside the
     * widget, not the widget itself.
     */
    const isEditable = useCallback((target: EventTarget | null): boolean => {
        const element = target as HTMLElement | null;
        if (!element?.tagName) return false;
        if (
            element.tagName === 'INPUT'
            || element.tagName === 'TEXTAREA'
            || element.tagName === 'SELECT'
            || element.isContentEditable
        ) return true;

        return !!element.closest?.(
            '[role="slider"],[role="combobox"],[role="listbox"],[role="menu"],'
            + '[role="menuitem"],[role="spinbutton"],[role="textbox"],[role="dialog"]'
        );
    }, []);

    useEffect(() => {
        if (!active) return;
        const held = soundingByKey.current;

        const onKeyDown = (event: KeyboardEvent) => {
            if (event.ctrlKey || event.metaKey || event.altKey) return;
            if (isEditable(event.target)) return;

            // Shift is the computer keyboard's sustain pedal. It is the nearest
            // thing to one a laptop has: held rather than toggled, reachable
            // with the hand already on the note keys, and bound to nothing on
            // its own. Case folding means a shifted note key is still that note,
            // so holding it does not cost any of the layout.
            if (event.key === 'Shift') {
                event.preventDefault();
                livePlayEngine.setSustain(true);
                return;
            }

            if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
                event.preventDefault();
                if (!event.repeat) shiftOctave(event.key === 'ArrowLeft' ? -1 : 1);
                return;
            }

            if (event.repeat) return;

            const pitch = pitchForKey(event.key, settings.current.octave);
            if (pitch === null) return;

            // The page must not scroll, and the character must not reach a
            // field that gained focus between the check above and now.
            event.preventDefault();
            held.set(event.key.toLowerCase(), pitch);
            livePlayEngine.noteOn(pitch, settings.current.velocity);
        };

        const onKeyUp = (event: KeyboardEvent) => {
            if (isEditable(event.target)) return;

            if (event.key === 'Shift') {
                event.preventDefault();
                livePlayEngine.setSustain(false);
                return;
            }

            const letter = event.key.toLowerCase();
            // The pitch it was pressed at, never the pitch it would be pressed
            // at now. The fallback covers a key that went down before this
            // listener existed.
            const pitch = held.get(letter) ?? pitchForKey(event.key, settings.current.octave);
            if (pitch === null) return;

            event.preventDefault();
            held.delete(letter);
            livePlayEngine.noteOff(pitch);
        };

        // A key held while the window loses focus never sends its keyup — the
        // classic stuck note. Alt-tabbing away mid-chord would otherwise leave
        // it sounding until the page is reloaded. The same is true of a
        // `keydown` the browser swallowed, which is what Escape is for.
        const panic = () => {
            held.clear();
            livePlayEngine.allNotesOff();
        };
        const onEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') panic();
        };

        window.addEventListener('keydown', onKeyDown);
        window.addEventListener('keydown', onEscape);
        window.addEventListener('keyup', onKeyUp);
        window.addEventListener('blur', panic);

        return () => {
            window.removeEventListener('keydown', onKeyDown);
            window.removeEventListener('keydown', onEscape);
            window.removeEventListener('keyup', onKeyUp);
            window.removeEventListener('blur', panic);
            panic();
        };
    }, [active, isEditable, shiftOctave]);
}

/**
 * Play from a MIDI keyboard.
 *
 * Every message the parser admits is acted on, not just notes: the sustain
 * pedal, pitch bend, and the three controllers a keyboard's own panic button
 * sends. A keyboard whose pedal did nothing would read as broken hardware, and
 * one whose panic button did nothing would leave the user with no way out of a
 * stuck note except reloading the page.
 */
function useMidiKeyboard(active: boolean): void {
    useEffect(() => {
        if (!active) return;

        // Asked for here rather than on page load: Chrome ties the permission
        // prompt to a user gesture, and opening the keyboard is that gesture. A
        // prompt raised at load is one nobody can connect to anything they did.
        void requestMidiAccess();

        return subscribeToMidiMessages((message) => {
            switch (message.kind) {
                case 'noteOn':
                    livePlayEngine.noteOn(message.pitch, message.velocity);
                    break;
                case 'noteOff':
                    livePlayEngine.noteOff(message.pitch);
                    break;
                case 'sustain':
                    livePlayEngine.setSustain(message.down);
                    break;
                case 'pitchBend':
                    livePlayEngine.setPitchBend(message.bend);
                    break;
                case 'allNotesOff':
                    livePlayEngine.allNotesOff();
                    break;
            }
        });
    }, [active]);
}

/**
 * Everything live playing needs, for the compose page to mount once.
 *
 * Returns the target track so the bar can name it — the bar should say what it
 * will play, and the answer is computed here.
 */
export function useLivePlay(): { target: Track | null; active: boolean } {
    const active = useUIStore((s) => s.livePlayOpen);
    const octave = useUIStore((s) => s.livePlayOctave);
    const velocity = useUIStore((s) => s.defaultVelocity);
    const target = useLiveTarget();

    useLiveVoice(target, active);
    useTypingKeyboard(active, octave, velocity);
    useMidiKeyboard(active);

    return { target, active };
}
