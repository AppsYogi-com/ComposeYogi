'use client';

import { useEffect, useCallback, useMemo, useState, useRef, Suspense } from 'react';
import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { useProjectStore, usePlaybackStore, useUIStore } from '@/lib/store';
import { audioEngine, playoutManager, recordingManager, registerAudioTake, clearAudioTakes, customInstrumentsHash, hydrateCustomInstruments, useCustomInstruments, type LatencyCalibrationResult } from '@/lib/audio';
import { createLogger } from '@/lib/logger';

const logger = createLogger('Compose');
import { Transport } from '@/components/compose/Transport';
import { BrowserPanel, BrowserCollapsedBar } from '@/components/compose/BrowserPanel';
import { Inspector, InspectorCollapsedBar } from '@/components/compose/Inspector';
import { EditorPanel, EditorCollapsedBar } from '@/components/compose/EditorPanel';
import { TrackList } from '@/components/compose/TrackList';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { AudioVisualizer, VisualizerCollapsedBar } from '@/components/compose/AudioVisualizer';
import { LivePlayBar } from '@/components/compose/LivePlayBar';
import { LatencyCalibrationModal } from '@/components/compose/LatencyCalibrationModal';
import { ProjectSelector } from '@/components/compose/ProjectSelector';
import { useAutosave, useShortcut, useLoadKeyBindings, usePersistKeyBindings } from '@/hooks';
import { listProjects, loadProject, loadAudioTakesForClip } from '@/lib/persistence';
import {
    clipsScheduleHash,
    mixerStateHash,
    projectScheduleHash,
    trackEffectsHash,
    trackScheduleHash,
} from '@/lib/audio/schedule-hash';
import { loadDemoTemplate } from '@/lib/templates';

// Loading fallback for Suspense
function ComposeLoading() {
    const tCommon = useTranslations('common');

    return (
        <div className="flex h-screen items-center justify-center bg-background">
            <div className="text-muted-foreground">{tCommon('loading')}</div>
        </div>
    );
}

export default function ComposePage() {
    return (
        <Suspense fallback={<ComposeLoading />}>
            <ComposePageContent />
        </Suspense>
    );
}

function ComposePageContent() {
    const searchParams = useSearchParams();
    const demoId = searchParams.get('demo');

    const [isAudioReady, setIsAudioReady] = useState(false);
    const [showLatencyModal, setShowLatencyModal] = useState(false);
    const [showProjectsModal, setShowProjectsModal] = useState(false);
    const [isPlayoutScheduled, setIsPlayoutScheduled] = useState(false);
    const [isInitializing, setIsInitializing] = useState(true);
    const [shouldAutoPlay, setShouldAutoPlay] = useState(false);
    const initializedRef = useRef(false);

    // Autosave hook
    const { status: saveStatus, statusText: saveStatusText } = useAutosave();

    // Copy for the panel error boundaries (class components cannot use hooks)
    const tErrors = useTranslations('errors');
    const tApp = useTranslations('app');
    const boundaryMessages = useMemo(() => ({
        title: tErrors('boundaryTitle'),
        description: tErrors('boundaryDescription'),
        reload: tErrors('boundaryReload'),
        retry: tErrors('boundaryRetry'),
    }), [tErrors]);

    // Store hooks
    const project = useProjectStore((s) => s.project);
    const createProject = useProjectStore((s) => s.createProject);
    const loadProjectStore = useProjectStore((s) => s.loadProject);
    const deleteClips = useProjectStore((s) => s.deleteClips);
    const { isPlaying, play, pause, stop } = usePlaybackStore();
    // Use actual state properties, not computed getters (getters aren't reactive in Zustand)
    const browserOpen = useUIStore((s) => s.browserOpen);
    const inspectorOpen = useUIStore((s) => s.inspectorOpen);
    const editorOpen = useUIStore((s) => s.editorOpen);
    const editorFocused = useUIStore((s) => s.editorFocused);
    const visualizerOpen = useUIStore((s) => s.visualizerOpen);
    const livePlayOpen = useUIStore((s) => s.livePlayOpen);
    const toggleBrowser = useUIStore((s) => s.toggleBrowser);
    const toggleInspector = useUIStore((s) => s.toggleInspector);
    const toggleEditor = useUIStore((s) => s.toggleEditor);
    const toggleVisualizer = useUIStore((s) => s.toggleVisualizer);
    const toggleLivePlay = useUIStore((s) => s.toggleLivePlay);
    const setScrollX = useUIStore((s) => s.setScrollX);
    const zoomIn = useUIStore((s) => s.zoomIn);
    const zoomOut = useUIStore((s) => s.zoomOut);
    const selectedClipIds = useUIStore((s) => s.selectedClipIds);
    const clearSelection = useUIStore((s) => s.clearSelection);

    // Initialize project from IndexedDB or create new
    useEffect(() => {
        async function initializeProject() {
            if (initializedRef.current) return;
            initializedRef.current = true;

            try {
                // Before anything is scheduled: a track pointing at a custom
                // instrument that is not in the registry yet falls back to its
                // track-colour default and plays the wrong sound for a render.
                await hydrateCustomInstruments();

                // Check for demo template first
                if (demoId) {
                    const demoProject = loadDemoTemplate(demoId);
                    if (demoProject) {
                        logger.info('Loaded demo template', { demoId });
                        loadProjectStore(demoProject);
                        setShouldAutoPlay(true);
                        setIsInitializing(false);
                        return;
                    }
                }

                // Try to load the most recently updated project
                const projects = await listProjects();

                if (projects.length > 0) {
                    const lastProject = projects[0]; // Already sorted by updatedAt desc
                    const fullProject = await loadProject(lastProject.id);

                    if (fullProject) {
                        // Clear any existing audio takes and load new ones
                        clearAudioTakes();

                        // Load audio takes for all audio clips
                        for (const clip of fullProject.clips) {
                            if (clip.type === 'audio' && clip.activeTakeId) {
                                const takes = await loadAudioTakesForClip(clip.id);
                                for (const take of takes) {
                                    registerAudioTake(take);
                                }
                            }
                        }

                        loadProjectStore(fullProject);
                        logger.info('Loaded existing project', { id: fullProject.id, name: fullProject.name });
                    } else {
                        createProject('Untitled Project');
                    }
                } else {
                    // No existing projects, create a new one
                    createProject('Untitled Project');
                    logger.info('Created new project');
                }
            } catch (error) {
                console.error('[ComposePage] Failed to load project:', error);
                createProject('Untitled Project');
            } finally {
                setIsInitializing(false);
            }
        }

        initializeProject();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [createProject, loadProjectStore]);

    // Initialize audio on first user interaction
    const initAudio = useCallback(async () => {
        if (!isAudioReady) {
            await audioEngine.initialize();
            await playoutManager.initialize();
            setIsAudioReady(true);
        }
    }, [isAudioReady]);

    // Schedule clips when project changes or before playing.
    // Held in a ref as well so the reschedule effect can stay keyed to the
    // scheduling hashes below instead of re-firing on every project mutation.
    const scheduleClips = useCallback(async () => {
        if (project && isAudioReady) {
            await playoutManager.scheduleProject(project);
            setIsPlayoutScheduled(true);
        }
    }, [project, isAudioReady]);

    const scheduleClipsRef = useRef(scheduleClips);
    scheduleClipsRef.current = scheduleClips;

    // What has to change before the audio is rebuilt. Defined in
    // lib/audio/schedule-hash.ts, where it can be tested: a field that affects
    // playback but is missing from the hash leaves the schedule stale with no
    // error anywhere, which is what #22 was.
    const clipNotesHash = project ? clipsScheduleHash(project.clips) : '';
    const trackHash = project ? trackScheduleHash(project.tracks) : '';
    const effectsHash = project ? trackEffectsHash(project.tracks) : '';
    const mixerHash = project ? mixerStateHash(project.tracks) : '';
    const projectHash = projectScheduleHash(project);

    // Custom instruments are the one thing whose *sound* can change while the
    // project is untouched: `instrumentPreset` holds an id, and editing an
    // instrument leaves that id alone. Without the revision here, saving an
    // edit to an instrument already on a track changes nothing you can hear
    // until something else forces a rebuild — #22, one layer down.
    const customInstruments = useCustomInstruments();
    const instrumentsHash = customInstrumentsHash(customInstruments);

    // Re-schedule clips when project clips or notes change
    useEffect(() => {
        if (isAudioReady) {
            void scheduleClipsRef.current();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isAudioReady, project?.clips.length, clipNotesHash, trackHash, projectHash, instrumentsHash]);

    // Sync track effects
    useEffect(() => {
        if (project && isAudioReady) {
            project.tracks.forEach(track => {
                playoutManager.updateTrackEffects(track.id, track.effects || []);
            });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [effectsHash, isAudioReady]); // Only re-run if effects structure changes

    // Sync mixer state (volume, pan, mute, solo) — ramps existing nodes instead
    // of tearing down and rebuilding the schedule, so faders and solo are
    // instant and never interrupt playback.
    //
    // **Deliberately not gated on `isAudioReady`.** It is safe before the audio
    // graph exists — every write is a `?.` on a chain that is not there yet —
    // and running it anyway is what hands the manager the track list. A chain is
    // created lazily by whoever asks for a track's input first, and on a page
    // where nothing has played that is the live keyboard or an editor's preview.
    // Without the list those chains were born at the raw fader value, so a muted
    // track's preview was audible. `isAudioReady` stays in the deps so the real
    // gains are applied the moment the graph does exist.
    useEffect(() => {
        if (project) {
            playoutManager.applyMixState(project.tracks);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [mixerHash, isAudioReady]);

    // Sync BPM with audio engine.
    //
    // Runs on `isAudioReady` like its neighbours, but unlike them it does NOT
    // wait for it. Both halves are load-bearing:
    //
    //   not gated — audioEngine.secondsToBar reads the transport's tempo, and
    //     the arrangement sizes every audio clip it creates with it. Waiting
    //     for the first user gesture meant a sample dropped or a take recorded
    //     before anyone pressed play was measured against Tone's default 120
    //     instead of the song's: in an 85 BPM project, 41% too long, drawn that
    //     way, with nothing to say so. Setting a param on a suspended context
    //     is fine; only starting one needs a gesture.
    //
    //   still in the deps — starting the context is the moment a fresh
    //     transport can appear, so the tempo has to be re-applied after it.
    useEffect(() => {
        if (project) {
            audioEngine.setBpm(project.bpm);
            audioEngine.setTimeSignature(project.timeSignature[0], project.timeSignature[1]);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [project?.bpm, project?.timeSignature, isAudioReady]);

    // Sync loop settings with audio engine
    const { loopEnabled, loopStartBar, loopEndBar } = usePlaybackStore();
    useEffect(() => {
        if (isAudioReady) {
            audioEngine.setLoop(loopEnabled, loopStartBar, loopEndBar);
        }
    }, [isAudioReady, loopEnabled, loopStartBar, loopEndBar]);

    // Handle play with clip scheduling
    const handlePlay = useCallback(async () => {
        await initAudio();

        // Schedule clips before playing if not already scheduled
        if (!isPlayoutScheduled && project) {
            await scheduleClips();
        }

        if (isPlaying) {
            pause();
            audioEngine.pause();
        } else {
            play();
            audioEngine.play();
        }
    }, [initAudio, isPlaying, pause, play, isPlayoutScheduled, project, scheduleClips]);

    // Auto-play demo templates after 1.5 seconds
    useEffect(() => {
        if (shouldAutoPlay && project && !isInitializing) {
            const timer = setTimeout(async () => {
                setShouldAutoPlay(false);
                await handlePlay();
            }, 1500);
            return () => clearTimeout(timer);
        }
    }, [shouldAutoPlay, project, isInitializing, handlePlay]);

    // ============================
    // Keyboard shortcuts (rebindable)
    // ============================

    // Load and persist custom key bindings
    useLoadKeyBindings();
    usePersistKeyBindings();

    // Spacebar: Play/Pause
    useShortcut('playback.playPause', (e) => {
        e.preventDefault();
        handlePlay();
    }, [handlePlay]);

    // Enter: Stop and return to start
    useShortcut('playback.stop', (e) => {
        e.preventDefault();
        stop();
        audioEngine.stop();
        // Reset scroll to show bar 1 where clips typically start
        setScrollX(0);
    }, [stop, setScrollX]);

    // Cmd/Ctrl + Z: Undo
    useShortcut('editing.undo', (e) => {
        e.preventDefault();
        useProjectStore.temporal.getState().undo();
    }, []);

    // Cmd/Ctrl + Shift + Z: Redo
    useShortcut('editing.redo', (e) => {
        e.preventDefault();
        useProjectStore.temporal.getState().redo();
    }, []);

    // B: Toggle browser
    useShortcut('view.toggleBrowser', () => toggleBrowser(), [toggleBrowser]);

    // I: Toggle inspector
    useShortcut('view.toggleInspector', () => toggleInspector(), [toggleInspector]);

    // E: Toggle editor
    useShortcut('view.toggleEditor', () => toggleEditor(), [toggleEditor]);

    // V: Toggle visualizer
    useShortcut('view.toggleVisualizer', () => toggleVisualizer(), [toggleVisualizer]);

    // `alwaysEnabled`, alone in the app: every other single-letter shortcut
    // stands down while musical typing has the keyboard, and this is the one
    // that has to keep working — a mode you can enter and not leave is worse
    // than no mode. `K` is not on the typing layout, so nothing is lost.
    useShortcut('view.toggleLivePlay', () => toggleLivePlay(), [toggleLivePlay], {
        alwaysEnabled: true,
    });

    // +/= : Zoom in
    useShortcut('view.zoomIn', () => zoomIn(), [zoomIn]);

    // - : Zoom out
    useShortcut('view.zoomOut', () => zoomOut(), [zoomOut]);

    // Cmd/Ctrl + 0: Reset zoom
    useShortcut('view.resetZoom', (e) => {
        e.preventDefault();
        useUIStore.getState().setZoom(80); // Default zoom
    }, []);

    // Delete/Backspace: Delete selected clips (skip if editor has focus)
    useShortcut('editing.delete', (e) => {
        // Don't delete clips if the editor is focused - let the editor handle note deletion
        if (editorFocused) return;

        e.preventDefault();
        if (selectedClipIds.length > 0) {
            deleteClips(selectedClipIds);
            clearSelection();
        }
    }, [selectedClipIds, deleteClips, clearSelection, editorFocused]);

    // Handle latency calibration result
    const handleCalibrationComplete = useCallback((result: LatencyCalibrationResult) => {
        // Apply latency compensation to the playout manager
        playoutManager.setLatencyCompensation(result.inputLatencyMs);
    }, []);

    if (!project || isInitializing) {
        return (
            <div className="flex h-full items-center justify-center">
                <div className="text-center">
                    <div className="mb-4 h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent mx-auto" />
                    <p className="text-muted-foreground">
                        {isInitializing ? tApp('loadingProject') : tApp('creatingProject')}
                    </p>
                </div>
            </div>
        );
    }

    return (
        <>
            {/* Top: Transport Bar */}
            <Transport
                onPlayPause={handlePlay}
                onStop={() => {
                    // Stop has to reach the recorder, not just the transport.
                    // It used to stop only the engine, so a count-in kept its
                    // timeout, fired, and started the take anyway — you pressed
                    // stop and got a clip.
                    if (recordingManager.isPending()) {
                        void recordingManager.stopRecording();
                        return;
                    }
                    stop();
                    audioEngine.stop();
                }}
                isAudioReady={isAudioReady}
                onRequestAudio={initAudio}
                onOpenSettings={() => setShowLatencyModal(true)}
                onOpenProjects={() => setShowProjectsModal(true)}
                saveStatus={saveStatus}
                saveStatusText={saveStatusText}
            />

            {/* Main content area. Each panel is guarded separately: a crash in
                the piano roll should not take the arrangement — and the user's
                unsaved work — down with it. */}
            <div className="flex flex-1 overflow-hidden">
                {/* Left: Browser Panel */}
                <ErrorBoundary area="browser" messages={boundaryMessages}>
                    {browserOpen ? <BrowserPanel /> : <BrowserCollapsedBar />}
                </ErrorBoundary>

                {/* Center: Timeline + Tracks */}
                <div className="flex flex-1 flex-col overflow-hidden">
                    {/* Track list with integrated ruler */}
                    <ErrorBoundary area="arrangement" messages={boundaryMessages}>
                        <TrackList />
                    </ErrorBoundary>

                    {/* Live playing. A mode rather than a panel, so it leaves
                        nothing behind when it is off — see LivePlayBar. */}
                    {livePlayOpen && (
                        <ErrorBoundary area="arrangement" messages={boundaryMessages}>
                            <LivePlayBar />
                        </ErrorBoundary>
                    )}

                    {/* Audio Visualizer */}
                    <ErrorBoundary area="visualizer" messages={boundaryMessages}>
                        {visualizerOpen ? <AudioVisualizer /> : <VisualizerCollapsedBar />}
                    </ErrorBoundary>

                    {/* Bottom: Editor Panel (Piano Roll / Step Sequencer) */}
                    <ErrorBoundary area="editor" messages={boundaryMessages}>
                        {editorOpen ? <EditorPanel /> : <EditorCollapsedBar />}
                    </ErrorBoundary>
                </div>

                {/* Right: Inspector Panel */}
                <ErrorBoundary area="inspector" messages={boundaryMessages}>
                    {inspectorOpen ? <Inspector /> : <InspectorCollapsedBar />}
                </ErrorBoundary>
            </div>

            {/* Latency Calibration Modal */}
            <LatencyCalibrationModal
                isOpen={showLatencyModal}
                onClose={() => setShowLatencyModal(false)}
                onCalibrationComplete={handleCalibrationComplete}
            />

            {/* Project Selector Modal */}
            <ProjectSelector
                isOpen={showProjectsModal}
                onClose={() => setShowProjectsModal(false)}
            />
        </>
    );
}
