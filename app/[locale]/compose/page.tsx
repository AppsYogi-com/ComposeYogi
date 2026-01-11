'use client';

import { useEffect, useCallback, useState, useRef } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';
import { useProjectStore, usePlaybackStore, useUIStore } from '@/lib/store';
import { audioEngine, playoutManager, registerAudioTake, clearAudioTakes, type LatencyCalibrationResult } from '@/lib/audio';
import { Transport } from '@/components/compose/Transport';
import { BrowserPanel, BrowserCollapsedBar } from '@/components/compose/BrowserPanel';
import { Inspector, InspectorCollapsedBar } from '@/components/compose/Inspector';
import { EditorPanel, EditorCollapsedBar } from '@/components/compose/EditorPanel';
import { TrackList } from '@/components/compose/TrackList';
import { AudioVisualizer, VisualizerCollapsedBar } from '@/components/compose/AudioVisualizer';
import { LatencyCalibrationModal } from '@/components/compose/LatencyCalibrationModal';
import { ProjectSelector } from '@/components/compose/ProjectSelector';
import { useAutosave } from '@/hooks';
import { listProjects, loadProject, loadAudioTakesForClip } from '@/lib/persistence';

export default function ComposePage() {
    const [isAudioReady, setIsAudioReady] = useState(false);
    const [showLatencyModal, setShowLatencyModal] = useState(false);
    const [showProjectsModal, setShowProjectsModal] = useState(false);
    const [isPlayoutScheduled, setIsPlayoutScheduled] = useState(false);
    const [isInitializing, setIsInitializing] = useState(true);
    const initializedRef = useRef(false);

    // Autosave hook
    const { status: saveStatus, statusText: saveStatusText } = useAutosave();

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
    const visualizerOpen = useUIStore((s) => s.visualizerOpen);
    const toggleBrowser = useUIStore((s) => s.toggleBrowser);
    const toggleInspector = useUIStore((s) => s.toggleInspector);
    const toggleEditor = useUIStore((s) => s.toggleEditor);
    const toggleVisualizer = useUIStore((s) => s.toggleVisualizer);
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
                                console.log('[ComposePage] Loaded', takes.length, 'audio takes for clip:', clip.id);
                            }
                        }

                        loadProjectStore(fullProject);
                        console.log('[ComposePage] Loaded project from DB:', fullProject.name);
                    } else {
                        createProject('Untitled Project');
                    }
                } else {
                    // No existing projects, create a new one
                    createProject('Untitled Project');
                    console.log('[ComposePage] Created new project');
                }
            } catch (error) {
                console.error('[ComposePage] Failed to load project:', error);
                createProject('Untitled Project');
            } finally {
                setIsInitializing(false);
            }
        }

        initializeProject();
    }, [createProject, loadProjectStore]);

    // Initialize audio on first user interaction
    const initAudio = useCallback(async () => {
        if (!isAudioReady) {
            await audioEngine.initialize();
            await playoutManager.initialize();
            setIsAudioReady(true);
        }
    }, [isAudioReady]);

    // Schedule clips when project changes or before playing
    const scheduleClips = useCallback(async () => {
        if (project && isAudioReady) {
            await playoutManager.scheduleProject(project);
            setIsPlayoutScheduled(true);
            console.log('[ComposePage] Clips scheduled for playback');
        }
    }, [project, isAudioReady]);

    // Calculate a hash of clip notes for change detection
    const clipNotesHash = project?.clips.map(c => `${c.id}:${c.notes?.length || 0}`).join(',') || '';

    // Re-schedule clips when project clips or notes change
    useEffect(() => {
        if (isAudioReady && project?.clips.length) {
            scheduleClips();
        }
    }, [isAudioReady, project?.clips.length, clipNotesHash, scheduleClips]);

    // Sync BPM with audio engine
    useEffect(() => {
        if (project && isAudioReady) {
            audioEngine.setBpm(project.bpm);
            audioEngine.setTimeSignature(project.timeSignature[0], project.timeSignature[1]);
        }
    }, [project?.bpm, project?.timeSignature, isAudioReady]);

    // Sync loop settings with audio engine
    const { loopEnabled, loopStartBar, loopEndBar } = usePlaybackStore();
    useEffect(() => {
        if (isAudioReady) {
            audioEngine.setLoop(loopEnabled, loopStartBar, loopEndBar);
            console.log('[ComposePage] Loop synced:', loopEnabled, loopStartBar, '-', loopEndBar);
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

    // ============================
    // Keyboard shortcuts
    // ============================

    // Spacebar: Play/Pause
    useHotkeys('space', (e) => {
        e.preventDefault();
        handlePlay();
    }, { enableOnFormTags: false }, [handlePlay]);

    // Enter: Stop and return to start
    useHotkeys('enter', (e) => {
        e.preventDefault();
        stop();
        audioEngine.stop();
        // Reset scroll to show bar 1 where clips typically start
        setScrollX(0);
    }, { enableOnFormTags: false });

    // Cmd/Ctrl + Z: Undo
    useHotkeys('mod+z', (e) => {
        e.preventDefault();
        useProjectStore.temporal.getState().undo();
    }, { enableOnFormTags: false });

    // Cmd/Ctrl + Shift + Z: Redo
    useHotkeys('mod+shift+z', (e) => {
        e.preventDefault();
        useProjectStore.temporal.getState().redo();
    }, { enableOnFormTags: false });

    // B: Toggle browser
    useHotkeys('b', () => toggleBrowser(), { enableOnFormTags: false });

    // I: Toggle inspector
    useHotkeys('i', () => toggleInspector(), { enableOnFormTags: false });

    // E: Toggle editor
    useHotkeys('e', () => toggleEditor(), { enableOnFormTags: false });

    // V: Toggle visualizer
    useHotkeys('v', () => toggleVisualizer(), { enableOnFormTags: false });

    // +/= : Zoom in
    useHotkeys('equal', () => zoomIn(), { enableOnFormTags: false });
    useHotkeys('shift+equal', () => zoomIn(), { enableOnFormTags: false }); // + key

    // -/_ : Zoom out
    useHotkeys('minus', () => zoomOut(), { enableOnFormTags: false });

    // Cmd/Ctrl + 0: Reset zoom
    useHotkeys('mod+0', (e) => {
        e.preventDefault();
        useUIStore.getState().setZoom(80); // Default zoom
    }, { enableOnFormTags: false });

    // Delete/Backspace: Delete selected clips
    useHotkeys('delete, backspace', (e) => {
        e.preventDefault();
        if (selectedClipIds.length > 0) {
            deleteClips(selectedClipIds);
            clearSelection();
        }
    }, { enableOnFormTags: false }, [selectedClipIds, deleteClips, clearSelection]);

    // Handle latency calibration result
    const handleCalibrationComplete = useCallback((result: LatencyCalibrationResult) => {
        // Apply latency compensation to the playout manager
        playoutManager.setLatencyCompensation(result.inputLatencyMs);
        console.log('Latency calibration applied:', result);
    }, []);

    if (!project || isInitializing) {
        return (
            <div className="flex h-full items-center justify-center">
                <div className="text-center">
                    <div className="mb-4 h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent mx-auto" />
                    <p className="text-muted-foreground">
                        {isInitializing ? 'Loading project...' : 'Creating project...'}
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
                    stop();
                    audioEngine.stop();
                }}
                isAudioReady={isAudioReady}
                onOpenSettings={() => setShowLatencyModal(true)}
                onOpenProjects={() => setShowProjectsModal(true)}
                saveStatus={saveStatus}
                saveStatusText={saveStatusText}
            />

            {/* Main content area */}
            <div className="flex flex-1 overflow-hidden">
                {/* Left: Browser Panel */}
                {browserOpen ? <BrowserPanel /> : <BrowserCollapsedBar />}

                {/* Center: Timeline + Tracks */}
                <div className="flex flex-1 flex-col overflow-hidden">
                    {/* Track list with integrated ruler */}
                    <TrackList />

                    {/* Audio Visualizer */}
                    {visualizerOpen ? <AudioVisualizer /> : <VisualizerCollapsedBar />}

                    {/* Bottom: Editor Panel (Piano Roll / Step Sequencer) */}
                    {editorOpen ? <EditorPanel /> : <EditorCollapsedBar />}
                </div>

                {/* Right: Inspector Panel */}
                {inspectorOpen ? <Inspector /> : <InspectorCollapsedBar />}
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
