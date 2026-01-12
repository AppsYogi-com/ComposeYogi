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
export { exportProjectToWav, downloadProjectAsWav } from './offline-renderer';
