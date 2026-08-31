// ============================================
// ComposeYogi — Music Theory
// ============================================

export {
    NOTE_NAMES,
    SCALE_INTERVALS,
    SCALE_IDS,
    VIBES,
    matchVibe,
    scalePitchClasses,
    vibeById,
} from './scales';
export type { Vibe } from './scales';

export {
    SNAP_BEATS,
    SNAP_VALUES,
    STRAIGHT_SNAP_VALUES,
    TRIPLET_SNAP_VALUES,
    snapStepBeats,
    snapToGrid,
} from './snap';

export {
    TYPING_KEYS,
    TYPING_OCTAVE_DEFAULT,
    TYPING_OCTAVE_MAX,
    TYPING_OCTAVE_MIN,
    TYPING_SPAN_SEMITONES,
    clampTypingOctave,
    isBlackKey,
    isTypingKey,
    keyForPitch,
    keysForPitch,
    octaveBasePitch,
    pitchForKey,
    typingKeyboard,
} from './typing-keys';

export {
    HIGHEST_PITCH,
    LOWEST_PITCH,
    MIDDLE_C,
    PITCH_OCTAVES,
    isPlayablePitch,
    octaveFirstPitch,
    pitchFrequency,
    pitchName,
    pitchOctave,
} from './pitch';

export {
    KEYBOARD_HIGH_PITCH,
    KEYBOARD_LOW_PITCH,
    KEY_PRESS_TRAVEL,
    RAIL_HEIGHT,
    WHITE_KEY_COUNT,
    keyboardLayout,
} from './keyboard-layout';
export type { DrawnKey, KeyboardLayout, KeyboardVoicing } from './keyboard-layout';

export {
    DRUM_PITCH,
    GM_PERCUSSION,
    GM_PERCUSSION_HIGH,
    GM_PERCUSSION_LOW,
    drumCapLabel,
    drumSoundForPitch,
    drumWindowRange,
} from './percussion';
export type { DrumSound, DrumSoundId } from './percussion';
