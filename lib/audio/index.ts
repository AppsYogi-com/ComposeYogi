// ============================================
// ComposeYogi — Audio Exports
// ============================================

export { audioEngine, useAudioEngine } from './engine';
export { playoutManager } from './playout';
export { audioRecorder } from './recorder';
export type { RecordingOptions, RecordedSegment, LoopBoundaries } from './recorder';
export {
    latencyCalibrator,
    type LatencyCalibrationResult,
    type CalibrationProgress,
} from './latency-calibration';
export {
    recordingManager,
    getAudioTake,
    getAllAudioTakes,
    deleteAudioTake,
    registerAudioTake,
    clearAudioTakes,
} from './recording-manager';
export { exportProjectToMidi, downloadProjectAsMidi } from './export';
export {
    exportProjectToWav,
    downloadProjectAsWav,
    downloadProjectAsMp3,
    renderProjectToAudioBuffer,
} from './offline-renderer';
export { encodeAudioBufferToMp3, MP3_QUALITY_PRESETS, type Mp3Quality } from './mp3-encoder';
export {
    exportProjectToJSON,
    downloadProjectAsJSON,
    importProjectFromJSON,
    importProjectFromFile,
    previewMidiFile,
    importMidiFile,
    FILE_EXTENSION as PROJECT_FILE_EXTENSION,
    SCHEMA_VERSION as PROJECT_SCHEMA_VERSION,
    type ExportedProject as ProjectFileFormat,
    type ImportResult,
    type MidiImportPreview,
} from './project-io';
export {
    importAudioFile,
    importAudioFiles,
    getUserSamples,
    getUserSample,
    removeUserSample,
    getUserSampleAudioBuffer,
    createSamplePreviewUrl,
    validateAudioFile,
    MAX_FILE_SIZE,
    SUPPORTED_EXTENSIONS,
    type ImportProgress,
    type ImportOptions,
    type ValidationResult,
} from './sample-import';
export {
    buildInstrumentFromSpec,
    clearCustomInstruments,
    customInstrumentsHash,
    draftFromPreset,
    duplicateCustomInstrument,
    getCustomInstrument,
    getCustomInstruments,
    hydrateCustomInstruments,
    registerCustomInstrument,
    removeCustomInstrument,
    resolveCustomInstrument,
    saveCustomInstrument,
    subscribeToCustomInstruments,
    useCustomInstruments,
} from './custom-instruments';
export {
    CUSTOMIZABLE_DRUM_IDS,
    CUSTOMIZABLE_MELODIC_IDS,
    CUSTOMIZABLE_PRESET_IDS,
    PRESET_SPECS,
    isCustomizablePreset,
    specForPreset,
} from './preset-specs';
export {
    CUSTOM_INSTRUMENT_PREFIX,
    DRUM_OSCILLATOR_SHAPES,
    DRUM_RANGES,
    DRUM_VOICES,
    ENVELOPE_RANGES,
    MACRO_RANGES,
    NEUTRAL_MACROS,
    NOISE_TYPES,
    TONE_MEMBRANE_DEFAULTS,
    brightnessToFrequency,
    clampSpec,
    drumVoiceOptions,
    filterSpecFor,
    isCustomInstrumentId,
    isDrumSpec,
    parseInstrumentSpec,
    resonanceToQ,
    voiceOptions,
    OSCILLATOR_SHAPES,
    type OscillatorShape,
} from './instrument-spec';
export {
    INSTRUMENT_FILE_EXTENSION,
    INSTRUMENT_SCHEMA_VERSION,
    downloadInstrument,
    exportInstrumentToJSON,
    importInstrumentFromFile,
    importInstrumentFromJSON,
    type ExportedInstrument,
    type InstrumentImportResult,
} from './instrument-io';
export {
    SYNTH_PRESETS,
    SYNTH_PRESET_IDS,
    createDrumVoice,
    createSpecVoice,
    createVoice,
    getSynthPreset,
    getSynthPresetName,
    type SynthPreset,
    type SynthPresetId,
    type ResolvedInstrument,
} from './synth-presets';
