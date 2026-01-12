'use client';

import { useCallback, useEffect, useState } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';
import {
    Play,
    Pause,
    Square,
    Circle,
    SkipBack,
    Repeat,
    Volume2,
    VolumeX,
    Settings,
    ChevronDown,
    Mic,
    Cloud,
    CloudOff,
    Loader2,
    Check,
    Download,
    Moon,
    Sun,
    Keyboard,
    FileAudio,
    Music,
} from 'lucide-react';
import { KeyboardShortcutsModal } from './KeyboardShortcutsModal';
import { ExportModal } from './ExportModal';
import { useTheme } from 'next-themes';
import { MusicWave } from '@/components/MusicWave';
import { useProjectStore, usePlaybackStore } from '@/lib/store';
import { playbackRefs } from '@/lib/store/playback';
import { audioEngine, recordingManager, downloadProjectAsMidi } from '@/lib/audio';
import { formatTime, formatBarsBeats } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import Link from 'next/link';
import type { SaveStatus } from '@/lib/persistence/autosave';

interface TransportProps {
    onPlayPause: () => void;
    onStop: () => void;
    isAudioReady: boolean;
    onOpenSettings?: () => void;
    onOpenProjects?: () => void;
    saveStatus?: SaveStatus;
    saveStatusText?: string;
}

export function Transport({
    onPlayPause,
    onStop,
    isAudioReady,
    onOpenSettings,
    onOpenProjects,
    saveStatus = 'idle',
    saveStatusText = '',
}: TransportProps) {
    const project = useProjectStore((s) => s.project);
    const setBpm = useProjectStore((s) => s.setBpm);
    const tracks = useProjectStore((s) => s.project?.tracks || []);
    const {
        isPlaying,
        isRecording,
        isLooping,
        isCountingIn,
        countInBars,
        toggleLoop,
    } = usePlaybackStore();

    const [displayTime, setDisplayTime] = useState(0);
    const [metronomeEnabled, setMetronomeEnabled] = useState(false);
    const [localBpm, setLocalBpm] = useState(project?.bpm || 120);
    const [isRecorderReady, setIsRecorderReady] = useState(false);
    const [recorderError, setRecorderError] = useState<string | null>(null);
    const [showShortcutsModal, setShowShortcutsModal] = useState(false);
    const [showExportModal, setShowExportModal] = useState(false);

    // / or ? key to toggle keyboard shortcuts
    useHotkeys('slash', () => setShowShortcutsModal(prev => !prev), { enableOnFormTags: false });
    useHotkeys('shift+slash', () => setShowShortcutsModal(prev => !prev), { enableOnFormTags: false });

    // Update display time from ref during playback (doesn't cause re-renders elsewhere)
    useEffect(() => {
        if (!isPlaying && !isRecording) {
            // When stopped, just read the current ref value once
            setDisplayTime(playbackRefs.currentTimeRef.current);
            return;
        }

        // During playback, poll the ref at 10fps for smooth display updates
        const interval = setInterval(() => {
            setDisplayTime(playbackRefs.currentTimeRef.current);
        }, 100);

        return () => clearInterval(interval);
    }, [isPlaying, isRecording]);

    // Find armed track
    const armedTrack = tracks.find(t => t.armed);

    // Initialize recording manager when audio is ready (don't block on errors)
    useEffect(() => {
        if (isAudioReady && !isRecorderReady && !recorderError) {
            recordingManager.initialize()
                .then(() => {
                    setIsRecorderReady(true);
                    setRecorderError(null);
                })
                .catch((err) => {
                    // Don't set error yet - user hasn't tried to record
                    console.warn('[Transport] Recorder not ready (mic permission needed):', err.message);
                });
        }
    }, [isAudioReady, isRecorderReady, recorderError]);

    // Sync local BPM with project
    useEffect(() => {
        if (project) {
            setLocalBpm(project.bpm);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [project?.bpm]);

    const handleBpmChange = useCallback((value: number) => {
        const clampedBpm = Math.min(Math.max(value, 20), 300);
        setLocalBpm(clampedBpm);
        setBpm(clampedBpm);
        if (isAudioReady) {
            audioEngine.setBpm(clampedBpm);
        }
    }, [setBpm, isAudioReady]);

    const handleBpmBlur = useCallback(() => {
        handleBpmChange(localBpm);
    }, [localBpm, handleBpmChange]);

    const toggleMetronome = useCallback(() => {
        if (!isAudioReady) return;

        if (metronomeEnabled) {
            audioEngine.stopMetronome();
        } else {
            audioEngine.startMetronome();
        }
        setMetronomeEnabled(!metronomeEnabled);
    }, [metronomeEnabled, isAudioReady]);

    const handleRecord = useCallback(async () => {
        if (!isAudioReady) return;

        if (isRecording) {
            // Stop recording
            await recordingManager.stopRecording();
        } else {
            // Start recording - need an armed track
            if (!armedTrack) {
                console.warn('[Transport] No armed track for recording');
                return;
            }

            // Initialize recorder on-demand if not ready
            if (!isRecorderReady) {
                try {
                    await recordingManager.initialize();
                    setIsRecorderReady(true);
                    setRecorderError(null);
                } catch (err) {
                    const message = err instanceof Error ? err.message : 'Microphone access required';
                    setRecorderError(message);
                    console.error('[Transport] Failed to initialize recorder:', message);
                    return;
                }
            }

            try {
                await recordingManager.startRecording(
                    armedTrack.id,
                    countInBars,
                    (_clip, _take) => {
                    }
                );
            } catch (error) {
                console.error('[Transport] Failed to start recording:', error);
            }
        }
    }, [isAudioReady, isRecording, armedTrack, countInBars, isRecorderReady]);

    if (!project) return null;

    return (
        <header className="flex h-transport items-center border-b border-border bg-card">
            {/* Left: Logo + Project name + Save status */}
            <div className="flex items-center gap-3 px-4">
                <Link href="/" className="flex items-center gap-2 text-accent hover:opacity-80 transition-opacity">
                    <MusicWave barCount={4} color="accent" className="h-5" />
                    <span className="text-sm font-semibold tracking-tight">ComposeYogi</span>
                </Link>
                <Separator orientation="vertical" className="h-6" />

                {/* Project name - clickable to open projects */}
                <Tooltip>
                    <TooltipTrigger asChild>
                        <button
                            onClick={onOpenProjects}
                            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors group"
                        >
                            <span className="truncate max-w-[150px]">{project.name}</span>
                            <ChevronDown className="h-3.5 w-3.5 opacity-50 group-hover:opacity-100" />
                        </button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                        <p>Open Projects</p>
                    </TooltipContent>
                </Tooltip>

                {/* Save status indicator */}
                <Tooltip>
                    <TooltipTrigger asChild>
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            {saveStatus === 'saving' && (
                                <Loader2 className="h-3.5 w-3.5 animate-spin text-accent" />
                            )}
                            {saveStatus === 'saved' && (
                                <Check className="h-3.5 w-3.5 text-green-500" />
                            )}
                            {saveStatus === 'pending' && (
                                <Cloud className="h-3.5 w-3.5 text-yellow-500" />
                            )}
                            {saveStatus === 'error' && (
                                <CloudOff className="h-3.5 w-3.5 text-destructive" />
                            )}
                            {saveStatus === 'idle' && (
                                <Cloud className="h-3.5 w-3.5 opacity-50" />
                            )}
                        </div>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                        <p>{saveStatusText || 'Auto-saved to browser'}</p>
                    </TooltipContent>
                </Tooltip>
            </div>

            {/* Center: Transport controls */}
            <div className="flex-1 flex items-center justify-center">
                <div className="flex items-center bg-background/50 rounded-lg px-1 py-1 gap-0.5">
                    {/* Navigation controls */}
                    <div className="flex items-center">
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="transport"
                                    size="icon-sm"
                                    onClick={onStop}
                                >
                                    <SkipBack className="h-4 w-4" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent side="bottom">
                                <p>Return to start <kbd className="ml-1 text-xs opacity-60">Enter</kbd></p>
                            </TooltipContent>
                        </Tooltip>
                    </div>

                    <Separator orientation="vertical" className="h-5 mx-1" />

                    {/* Playback controls */}
                    <div className="flex items-center gap-0.5">
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant={isPlaying ? "transport-active" : "transport"}
                                    size="icon-sm"
                                    onClick={onPlayPause}
                                >
                                    {isPlaying ? (
                                        <Pause className="h-4 w-4" />
                                    ) : (
                                        <Play className="h-4 w-4" />
                                    )}
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent side="bottom">
                                <p>{isPlaying ? 'Pause' : 'Play'} <kbd className="ml-1 text-xs opacity-60">Space</kbd></p>
                            </TooltipContent>
                        </Tooltip>

                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="transport"
                                    size="icon-sm"
                                    onClick={onStop}
                                >
                                    <Square className="h-3 w-3" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent side="bottom">
                                <p>Stop</p>
                            </TooltipContent>
                        </Tooltip>

                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant={isRecording ? "transport-record-active" : "transport-record"}
                                    size="icon-sm"
                                    onClick={handleRecord}
                                    disabled={!isAudioReady || (!isRecording && !armedTrack)}
                                    className={isCountingIn ? 'animate-pulse' : ''}
                                >
                                    <Circle
                                        className="h-3 w-3"
                                        fill={isRecording ? 'currentColor' : 'none'}
                                    />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent side="bottom">
                                <p>
                                    {recorderError
                                        ? recorderError
                                        : armedTrack
                                            ? `Record - ${armedTrack.name}`
                                            : 'Arm a track to record'}
                                    <kbd className="ml-1 text-xs opacity-60">R</kbd>
                                </p>
                            </TooltipContent>
                        </Tooltip>
                    </div>

                    <Separator orientation="vertical" className="h-5 mx-1" />

                    {/* Loop */}
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant={isLooping ? "transport-active" : "transport"}
                                size="icon-sm"
                                onClick={toggleLoop}
                            >
                                <Repeat className="h-4 w-4" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">
                            <p>Loop <kbd className="ml-1 text-xs opacity-60">L</kbd></p>
                        </TooltipContent>
                    </Tooltip>

                    <Separator orientation="vertical" className="h-5 mx-1" />

                    {/* Export dropdown */}
                    <DropdownMenu>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <DropdownMenuTrigger asChild>
                                    <Button
                                        variant="transport"
                                        size="icon-sm"
                                        disabled={!project}
                                    >
                                        <Download className="h-4 w-4" />
                                    </Button>
                                </DropdownMenuTrigger>
                            </TooltipTrigger>
                            <TooltipContent side="bottom">
                                <p>Export</p>
                            </TooltipContent>
                        </Tooltip>
                        <DropdownMenuContent align="center">
                            <DropdownMenuItem onClick={() => setShowExportModal(true)}>
                                <FileAudio className="mr-2 h-4 w-4" />
                                Export as WAV
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => project && downloadProjectAsMidi(project)}>
                                <Music className="mr-2 h-4 w-4" />
                                Export as MIDI
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>

                <Separator orientation="vertical" className="h-6 mx-4" />

                {/* Time display */}
                <div className="flex items-center bg-background rounded-md border border-border/50">
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <div className="px-3 py-1.5 border-r border-border/50 cursor-default">
                                <span className="font-mono text-sm tabular-nums text-foreground">
                                    {formatBarsBeats(displayTime, project.bpm, project.timeSignature)}
                                </span>
                            </div>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">
                            <p>Musical Time (Bars:Beats:Subdivisions)</p>
                        </TooltipContent>
                    </Tooltip>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <div className="px-3 py-1.5 cursor-default">
                                <span className="font-mono text-sm tabular-nums text-muted-foreground">
                                    {formatTime(displayTime)}
                                </span>
                            </div>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">
                            <p>Clock Time (Minutes:Seconds)</p>
                        </TooltipContent>
                    </Tooltip>
                </div>

                <Separator orientation="vertical" className="h-6 mx-4" />

                {/* Tempo & Time Signature */}
                <div className="flex items-center gap-2">
                    {/* BPM */}
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <div className="flex items-center gap-1.5 bg-background rounded-md border border-border/50 px-2 py-1 cursor-default">
                                <span className="text-xs text-muted-foreground uppercase tracking-wider">BPM</span>
                                <Input
                                    type="number"
                                    value={localBpm}
                                    onChange={(e) => setLocalBpm(Number(e.target.value))}
                                    onBlur={handleBpmBlur}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            handleBpmChange(localBpm);
                                            e.currentTarget.blur();
                                        }
                                    }}
                                    className="w-14 h-6 px-1 text-center font-mono text-sm tabular-nums border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
                                    min={20}
                                    max={300}
                                />
                            </div>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">
                            <p>Tempo (Beats Per Minute)</p>
                        </TooltipContent>
                    </Tooltip>

                    {/* Time signature */}
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <div>
                                <Select
                                    value={`${project.timeSignature[0]}/${project.timeSignature[1]}`}
                                    onValueChange={(value) => {
                                        const [num, denom] = value.split('/').map(Number);
                                        useProjectStore.getState().setTimeSignature([num, denom] as [number, number]);
                                    }}
                                >
                                    <SelectTrigger className="w-16 h-8 bg-background border-border/50 font-mono text-sm">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="4/4">4/4</SelectItem>
                                        <SelectItem value="3/4">3/4</SelectItem>
                                        <SelectItem value="6/8">6/8</SelectItem>
                                        <SelectItem value="2/4">2/4</SelectItem>
                                        <SelectItem value="5/4">5/4</SelectItem>
                                        <SelectItem value="7/8">7/8</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">
                            <p>Time Signature</p>
                        </TooltipContent>
                    </Tooltip>

                    {/* Metronome */}
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant={metronomeEnabled ? "transport-active" : "transport"}
                                size="icon-sm"
                                onClick={toggleMetronome}
                                disabled={!isAudioReady}
                            >
                                {metronomeEnabled ? (
                                    <Volume2 className="h-4 w-4" />
                                ) : (
                                    <VolumeX className="h-4 w-4" />
                                )}
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">
                            <p>Metronome <kbd className="ml-1 text-xs opacity-60">M</kbd></p>
                        </TooltipContent>
                    </Tooltip>
                </div>
            </div>

            {/* Right: Settings */}
            <div className="flex items-center gap-2 px-4">
                {/* Recording indicator */}
                {armedTrack && (
                    <div className="flex items-center gap-1.5 text-xs text-destructive">
                        <Mic className="h-3 w-3" />
                        <span className="truncate max-w-[80px]">{armedTrack.name}</span>
                    </div>
                )}

                <Separator orientation="vertical" className="h-6" />

                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => setShowShortcutsModal(true)}
                        >
                            <Keyboard className="h-4 w-4" />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                        <p>Keyboard Shortcuts <kbd className="ml-1 text-xs opacity-60">?</kbd></p>
                    </TooltipContent>
                </Tooltip>

                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={onOpenSettings}
                        >
                            <Settings className="h-4 w-4" />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                        <p>Audio Settings</p>
                    </TooltipContent>
                </Tooltip>

                <ThemeToggleButton />

                <KeyboardShortcutsModal
                    isOpen={showShortcutsModal}
                    onClose={() => setShowShortcutsModal(false)}
                />

                <ExportModal
                    isOpen={showExportModal}
                    onClose={() => setShowExportModal(false)}
                />
            </div>
        </header>
    );
}

function ThemeToggleButton() {
    const { resolvedTheme, setTheme } = useTheme();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) {
        return (
            <Button variant="ghost" size="icon-sm" disabled>
                <Sun className="h-4 w-4" />
            </Button>
        );
    }

    const isDark = resolvedTheme === 'dark';

    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setTheme(isDark ? 'light' : 'dark')}
                >
                    {isDark ? (
                        <Sun className="h-4 w-4" />
                    ) : (
                        <Moon className="h-4 w-4" />
                    )}
                </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
                <p>{isDark ? 'Light mode' : 'Dark mode'}</p>
            </TooltipContent>
        </Tooltip>
    );
}
