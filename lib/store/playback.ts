// ============================================
// ComposeYogi — Playback Store
// Transport state with refs for 60fps animation
// ============================================

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

// ============================================
// Store Types
// ============================================

interface PlaybackState {
    // Transport state (triggers re-renders when changed)
    isPlaying: boolean;
    isRecording: boolean;
    isPaused: boolean;
    isLooping: boolean; // Alias for loopEnabled for component compatibility

    // Current time in seconds (for UI display)
    currentTime: number;

    // Version counter to force playhead updates (increments on stop/seek)
    positionVersion: number;

    // Metronome
    metronomeEnabled: boolean;
    metronomeVolume: number; // 0-1

    // Count-in
    countInBars: number;
    isCountingIn: boolean;

    // Loop
    loopEnabled: boolean;
    loopStartBar: number;
    loopEndBar: number;

    // Current position (updated less frequently for UI)
    currentBar: number;
    currentBeat: number;
}

interface PlaybackActions {
    // Transport controls
    play: () => void;
    pause: () => void;
    stop: () => void;
    togglePlayPause: () => void;

    // Recording
    startRecording: () => void;
    stopRecording: () => void;
    toggleRecording: () => void;

    // Position
    seekToBar: (bar: number) => void;
    setPosition: (bar: number, beat: number) => void;
    setCurrentTime: (time: number) => void;
    seekTo: (time: number) => void;

    // Metronome
    toggleMetronome: () => void;
    setMetronomeVolume: (volume: number) => void;

    // Count-in
    setCountInBars: (bars: number) => void;
    setCountingIn: (counting: boolean) => void;

    // Loop
    toggleLoop: () => void;
    setLoopRegion: (startBar: number, endBar: number) => void;
    clearLoopRegion: () => void;
}

type PlaybackStore = PlaybackState & PlaybackActions;

// ============================================
// Refs for 60fps Animation (exported separately)
// These bypass React's state system for performance
// ============================================

export const playbackRefs = {
    // Current playback time in seconds (updated every frame)
    currentTimeRef: { current: 0 },
    // Is currently playing (mirrors state but accessible without re-render)
    isPlayingRef: { current: false },
    // AudioContext time when playback started
    playbackStartTimeRef: { current: 0 },
    // Position in seconds when playback started
    audioStartPositionRef: { current: 0 },
    // Current scroll position (updated on scroll, bypasses React for performance)
    scrollXRef: { current: 0 },
};

// ============================================
// Constants
// ============================================

const DEFAULT_LOOP_START = 0;
const DEFAULT_LOOP_END = 8;
const DEFAULT_COUNT_IN = 2;
const DEFAULT_METRONOME_VOLUME = 0.7;

// ============================================
// Store Implementation
// ============================================

export const usePlaybackStore = create<PlaybackStore>()(
    subscribeWithSelector((set, get) => ({
        // Initial state
        isPlaying: false,
        isRecording: false,
        isPaused: false,
        isLooping: false,
        currentTime: 0,
        positionVersion: 0,
        metronomeEnabled: true,
        metronomeVolume: DEFAULT_METRONOME_VOLUME,
        countInBars: DEFAULT_COUNT_IN,
        isCountingIn: false,
        loopEnabled: false,
        loopStartBar: DEFAULT_LOOP_START,
        loopEndBar: DEFAULT_LOOP_END,
        currentBar: 0,
        currentBeat: 0,

        // Transport controls
        play: () => {
            playbackRefs.isPlayingRef.current = true;
            set({ isPlaying: true, isPaused: false });
        },

        pause: () => {
            playbackRefs.isPlayingRef.current = false;
            set({ isPlaying: false, isPaused: true });
        },

        stop: () => {
            playbackRefs.isPlayingRef.current = false;
            playbackRefs.currentTimeRef.current = 0;
            set((state) => ({
                isPlaying: false,
                isPaused: false,
                isRecording: false,
                isCountingIn: false,
                currentBar: 0,
                currentBeat: 0,
                currentTime: 0,
                positionVersion: state.positionVersion + 1,
            }));
        },

        togglePlayPause: () => {
            const { isPlaying, play, pause } = get();
            if (isPlaying) {
                pause();
            } else {
                play();
            }
        },

        // Recording
        startRecording: () => {
            set({ isRecording: true });
        },

        stopRecording: () => {
            set({ isRecording: false });
        },

        toggleRecording: () => {
            const { isRecording, startRecording, stopRecording } = get();
            if (isRecording) {
                stopRecording();
            } else {
                startRecording();
            }
        },

        // Position
        seekToBar: (bar) => {
            const clampedBar = Math.max(0, bar);
            playbackRefs.audioStartPositionRef.current = clampedBar;
            set({ currentBar: clampedBar, currentBeat: 0 });
        },

        setPosition: (bar, beat) => {
            set({ currentBar: bar, currentBeat: beat });
        },

        setCurrentTime: (time) => {
            playbackRefs.currentTimeRef.current = time;
            set({ currentTime: time });
        },

        // Seek to a specific time (for user-initiated seeks, triggers playhead update)
        seekTo: (time) => {
            playbackRefs.currentTimeRef.current = time;
            set((state) => ({
                currentTime: time,
                positionVersion: state.positionVersion + 1,
            }));
        },

        // Metronome
        toggleMetronome: () => {
            set((state) => ({ metronomeEnabled: !state.metronomeEnabled }));
        },

        setMetronomeVolume: (volume) => {
            set({ metronomeVolume: Math.max(0, Math.min(1, volume)) });
        },

        // Count-in
        setCountInBars: (bars) => {
            set({ countInBars: Math.max(0, Math.min(4, bars)) });
        },

        setCountingIn: (counting) => {
            set({ isCountingIn: counting });
        },

        // Loop
        toggleLoop: () => {
            set((state) => ({
                loopEnabled: !state.loopEnabled,
                isLooping: !state.loopEnabled, // Keep in sync
            }));
        },

        setLoopRegion: (startBar, endBar) => {
            if (endBar > startBar) {
                set({
                    loopStartBar: startBar,
                    loopEndBar: endBar,
                    loopEnabled: true,
                    isLooping: true,
                });
            }
        },

        clearLoopRegion: () => {
            set({
                loopEnabled: false,
                isLooping: false,
                loopStartBar: DEFAULT_LOOP_START,
                loopEndBar: DEFAULT_LOOP_END,
            });
        },
    }))
);

// ============================================
// Selectors
// ============================================

export const selectIsPlaying = (state: PlaybackStore) => state.isPlaying;
export const selectIsRecording = (state: PlaybackStore) => state.isRecording;
export const selectMetronomeEnabled = (state: PlaybackStore) => state.metronomeEnabled;
export const selectLoopEnabled = (state: PlaybackStore) => state.loopEnabled;
export const selectLoopRegion = (state: PlaybackStore) => ({
    start: state.loopStartBar,
    end: state.loopEndBar,
});
export const selectCurrentPosition = (state: PlaybackStore) => ({
    bar: state.currentBar,
    beat: state.currentBeat,
});

// ============================================
// Subscribe to state changes (for audio engine sync)
// ============================================

// Example: Sync isPlaying to audio engine
// usePlaybackStore.subscribe(
//   (state) => state.isPlaying,
//   (isPlaying) => {
//     if (isPlaying) {
//       audioEngine.start();
//     } else {
//       audioEngine.pause();
//     }
//   }
// );
