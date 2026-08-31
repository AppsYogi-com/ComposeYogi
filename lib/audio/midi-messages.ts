// ============================================
// ComposeYogi — MIDI Message Parsing
// ============================================
//
// Bytes off the wire, turned into something the rest of the app can act on.
// Pure arithmetic and no imports, for the same reason as `count-in.ts` and
// `typing-keys.ts`: Web MIDI does not exist under vitest any more than Web
// Audio does, so a test can never open a port — but it can hand this function
// the exact bytes a keyboard sends and check what comes back.
//
// That matters more here than the size suggests. Almost everything this module
// gets wrong shows up as a **hanging note**: the synth is told to start and
// never told to stop, and the only cure is reloading the page.
//
// **No MIDI hardware was available while this was written.** Every shape below
// is the MIDI 1.0 specification rather than a measurement, which is exactly why
// the parsing was separated from the port wiring and given a test per message
// type: the half that can be wrong in a way nobody notices is the half that
// got tested.

/** Everything the live keyboard acts on. Anything else parses to null. */
export type MidiMessage =
    | { kind: 'noteOn'; channel: number; pitch: number; velocity: number }
    | { kind: 'noteOff'; channel: number; pitch: number; velocity: number }
    /** Sustain pedal, CC 64. */
    | { kind: 'sustain'; channel: number; down: boolean }
    /** CC 123 (all notes off), CC 120 (all sound off), CC 121 (reset controllers). */
    | { kind: 'allNotesOff'; channel: number }
    /** -1..1, already centred and scaled from the 14-bit value. */
    | { kind: 'pitchBend'; channel: number; bend: number };

const NOTE_OFF = 0x80;
const NOTE_ON = 0x90;
const CONTROL_CHANGE = 0xb0;
const PITCH_BEND = 0xe0;

/** Sustain: the one pedal nearly every keyboard has, on the controller everyone uses. */
const CC_SUSTAIN = 64;

/**
 * The three "stop everything" controllers.
 *
 * All three are treated identically, deliberately. Their differences matter to
 * a synthesiser with per-voice release curves and a channel-mode distinction
 * this app does not have; here they all mean "the keyboard says stop", which is
 * what a controller sends when a player mashes its panic button.
 */
const CC_ALL_SOUND_OFF = 120;
const CC_RESET_CONTROLLERS = 121;
const CC_ALL_NOTES_OFF = 123;

/** A controller value at or above this counts as pressed. Half of 0-127. */
const PEDAL_THRESHOLD = 64;

/** The 14-bit centre of the pitch-bend range. */
const BEND_CENTRE = 8192;

/** A data byte has its top bit clear. Anything else is a framing error. */
function isDataByte(byte: number): boolean {
    return byte >= 0 && byte <= 127;
}

/**
 * Parse one MIDI message, or null if it is not one this app acts on.
 *
 * Three things here are the point of the module:
 *
 * 1. **A note-on with velocity 0 is a note-off.** Not an edge case — it is what
 *    a keyboard using running status sends for *every* key release, so reading
 *    it as a note-on means every note played hangs until the page is reloaded.
 *    Half the keyboards in the world send 0x80 and half send 0x90 with a zero,
 *    and nothing tells you which you have until you try it.
 *
 * 2. **Only the commands below are accepted, matched on the high nibble.** A
 *    keyboard emits MIDI clock (0xF8) at 24 pulses per quarter note from the
 *    moment it is plugged in, and Active Sensing (0xFE) at about 3 Hz; both
 *    would otherwise be a torrent of events. `0xF8 & 0xf0` is `0xF0`, which
 *    matches nothing here — and nothing below 0x80 can have 0x80 or 0x90 in its
 *    high nibble either, so the same line rejects a stray data byte.
 *
 * 3. **A continuous pedal is still a switch.** Half-pedalling sends a sweep of
 *    values, and treating any non-zero as down means a pedal resting at 12
 *    latches every note played. The threshold is the convention: 64.
 *
 * Channel is reported and never filtered on. A DAW with one player is omni, and
 * a keyboard set to channel 5 that produced silence would be indistinguishable
 * from a broken cable.
 */
export function parseMidiMessage(data: ArrayLike<number> | undefined | null): MidiMessage | null {
    if (!data || data.length < 3) return null;

    const status = data[0];
    const command = status & 0xf0;
    const channel = status & 0x0f;

    if (command === NOTE_ON || command === NOTE_OFF) {
        const pitch = data[1];
        const velocity = data[2];
        if (!isDataByte(pitch) || !isDataByte(velocity)) return null;

        return command === NOTE_ON && velocity > 0
            ? { kind: 'noteOn', channel, pitch, velocity }
            : { kind: 'noteOff', channel, pitch, velocity };
    }

    if (command === CONTROL_CHANGE) {
        const controller = data[1];
        const value = data[2];
        if (!isDataByte(controller) || !isDataByte(value)) return null;

        if (controller === CC_SUSTAIN) {
            return { kind: 'sustain', channel, down: value >= PEDAL_THRESHOLD };
        }
        if (
            controller === CC_ALL_NOTES_OFF
            || controller === CC_ALL_SOUND_OFF
            || controller === CC_RESET_CONTROLLERS
        ) {
            return { kind: 'allNotesOff', channel };
        }
        // Every other controller — mod wheel, expression, channel volume — is
        // read and ignored rather than mapped to something arbitrary. A mod
        // wheel that silently moved the filter is a surprise nobody asked for.
        return null;
    }

    if (command === PITCH_BEND) {
        const lsb = data[1];
        const msb = data[2];
        if (!isDataByte(lsb) || !isDataByte(msb)) return null;

        // 14 bits, little end first, centred at 8192. The halves are asymmetric
        // — 0 is 8192 below centre, 16383 is 8191 above — so the divisor
        // depends on direction. That is what makes centre exactly 0 and both
        // extremes exactly +/-1 instead of one of them falling slightly short.
        const offset = ((msb << 7) | lsb) - BEND_CENTRE;
        return {
            kind: 'pitchBend',
            channel,
            bend: offset / (offset < 0 ? BEND_CENTRE : BEND_CENTRE - 1),
        };
    }

    return null;
}

/**
 * MIDI velocity as the 0-1 gain `triggerAttackRelease` wants.
 *
 * Velocity 1 must not be silence — it is the quietest note a player can
 * *choose*, and rounding it away makes a soft passage disappear. The scheduler
 * divides by 127 for stored notes; this matches it exactly, so a note played
 * live and the same note played back are the same loudness.
 */
export function velocityToGain(velocity: number): number {
    return Math.min(1, Math.max(0, velocity / 127));
}

/**
 * How far a bend of -1..1 detunes the voice, in cents.
 *
 * Two semitones each way is the General MIDI default bend range, and what a
 * keyboard assumes unless told otherwise over RPN — which this app does not
 * send, so assuming anything else would disagree with the hardware.
 */
export const PITCH_BEND_RANGE_CENTS = 200;

export function bendToCents(bend: number): number {
    return Math.max(-1, Math.min(1, bend)) * PITCH_BEND_RANGE_CENTS;
}
