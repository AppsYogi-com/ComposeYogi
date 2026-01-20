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
