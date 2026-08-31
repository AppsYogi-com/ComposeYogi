// ============================================
// ComposeYogi — Web MIDI Input
// ============================================
//
// The bridge between a MIDI keyboard and `live-play.ts`. Everything testable
// was pushed down into `midi-messages.ts`; what is left is the part that needs
// a browser and a device — port enumeration, permission, and hotplug.
//
// **Not verified on hardware.** There is no MIDI device in this environment and
// the headless pane exposes no Web MIDI at all, so every claim about this file
// is a claim about the specification, not a measurement. That is why the parse
// lives next door with tests around it and why this module is kept as thin as
// it can be: the part that can be wrong in a way nobody notices is the part
// that got tested.
//
// Support, as of writing: Chrome, Edge and Opera implement Web MIDI. Safari
// ships it behind a flag and Firefox behind a permission that most builds
// refuse. So "no MIDI here" is the common case and has to be a *state the UI
// can show*, not an error in a console nobody opens.

import { createLogger } from '@/lib/logger';

import { parseMidiMessage, type MidiMessage } from './midi-messages';

const logger = createLogger('MidiInput');

// ============================================
// Types
// ============================================

/**
 * Why there is or is not MIDI, in the terms the user experiences it.
 *
 * Four states rather than a boolean because the fixes are different: an
 * unsupported browser wants a different browser, a denied permission wants the
 * site settings, and "no devices" wants a cable. Collapsing them into "MIDI
 * unavailable" would be true and useless.
 */
export type MidiStatus = 'unsupported' | 'unrequested' | 'denied' | 'ready';

export interface MidiDevice {
    id: string;
    name: string;
}

export interface MidiState {
    status: MidiStatus;
    devices: MidiDevice[];
}

type MessageListener = (message: MidiMessage) => void;

// Web MIDI's own types (`MIDIAccess`, `MIDIInput`, `MIDIMessageEvent`) are in
// the TS DOM lib; only the navigator method is missing, because it is optional
// in every engine that has it and absent in the ones that do not.
type MidiCapableNavigator = Navigator & {
    requestMIDIAccess?: (options?: MIDIOptions) => Promise<MIDIAccess>;
};

// ============================================
// State
// ============================================

let access: MIDIAccess | null = null;
let state: MidiState = { status: 'unrequested', devices: [] };

const messageListeners = new Set<MessageListener>();
const stateListeners = new Set<() => void>();

function publish(next: MidiState): void {
    state = next;
    for (const listener of stateListeners) listener();
}

/** Subscribe to device/permission changes. Returns the unsubscribe function. */
export function subscribeToMidiState(listener: () => void): () => void {
    stateListeners.add(listener);
    return () => {
        stateListeners.delete(listener);
    };
}

/**
 * The current state. Stable by reference between changes, so it can be handed
 * straight to `useSyncExternalStore` — the same contract the custom-instrument
 * registry keeps, and for the same reason.
 */
export function getMidiState(): MidiState {
    return state;
}

/**
 * Receive every message this app acts on, from every connected input.
 *
 * Notes, the sustain pedal, pitch bend and the three panic controllers — see
 * `midi-messages.ts`. Everything else the keyboard sends is dropped there.
 */
export function subscribeToMidiMessages(listener: MessageListener): () => void {
    messageListeners.add(listener);
    return () => {
        messageListeners.delete(listener);
    };
}

// ============================================
// Wiring
// ============================================

function handleMessage(event: MIDIMessageEvent): void {
    const message = parseMidiMessage(event.data);
    if (!message) return;
    for (const listener of messageListeners) listener(message);
}

/**
 * Attach to every input port, and re-attach on every state change.
 *
 * Re-attaching wholesale rather than diffing: a port that disconnects and comes
 * back is a *new* port object with the same id, so a diff by id would leave the
 * handler on the dead one. Assigning `onmidimessage` is idempotent — it is a
 * property, not an listener list — so setting it again on a port that already
 * has it costs nothing.
 */
function attachPorts(midi: MIDIAccess): void {
    const devices: MidiDevice[] = [];

    midi.inputs.forEach((port) => {
        if (port.state === 'disconnected') return;
        port.onmidimessage = handleMessage;
        devices.push({ id: port.id, name: port.name || 'MIDI Input' });
    });

    publish({ status: 'ready', devices });
    logger.info('MIDI inputs attached', { count: devices.length });
}

/**
 * Ask for MIDI access, once.
 *
 * Called from a user gesture — the same click that starts the audio context —
 * because Chrome ties the permission prompt to one, and a prompt raised from a
 * page load is one the user cannot connect to anything they did.
 *
 * `sysex: false` on purpose. System-exclusive access reads and writes device
 * firmware, Chrome shows a markedly scarier prompt for it, and nothing here
 * needs a byte of it.
 */
export async function requestMidiAccess(): Promise<MidiState> {
    if (access) return state;

    const nav = typeof navigator === 'undefined' ? null : (navigator as MidiCapableNavigator);
    if (!nav?.requestMIDIAccess) {
        publish({ status: 'unsupported', devices: [] });
        logger.info('Web MIDI is not available in this browser');
        return state;
    }

    try {
        const midi = await nav.requestMIDIAccess({ sysex: false });
        access = midi;
        midi.onstatechange = () => attachPorts(midi);
        attachPorts(midi);
    } catch (error) {
        // A refusal and a browser that throws on the call are the same thing to
        // the user: no MIDI, and a reason that is not "it is broken".
        publish({ status: 'denied', devices: [] });
        logger.warn('MIDI access denied', { error });
    }

    return state;
}

/** Drop every port handler. Used on teardown. */
export function releaseMidiAccess(): void {
    if (!access) return;

    access.inputs.forEach((port) => {
        port.onmidimessage = null;
    });
    access.onstatechange = null;
    access = null;

    publish({ status: 'unrequested', devices: [] });
}
