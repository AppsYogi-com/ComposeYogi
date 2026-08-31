'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
    Play,
    Pause,
    Square,
    Circle,
    SkipBack,
    Repeat,
    Volume2,
    VolumeX,
    ChevronDown,
    Cloud,
    CloudOff,
    Loader2,
    Check,
    Download,
    Upload,
    Piano,
    ZoomIn,
    ZoomOut,
} from 'lucide-react';
import { KeyboardShortcutsModal } from './KeyboardShortcutsModal';
import { CountInSelect } from './CountInSelect';
import { SettingsMenu } from './SettingsMenu';
import { VibeSelect } from './VibeSelect';
import { ExportModal } from './ExportModal';
import { ImportModal } from './ImportModal';
import { MusicWave } from '@/components/MusicWave';
import { useProjectStore, usePlaybackStore, useUIStore } from '@/lib/store';
import { playbackRefs } from '@/lib/store/playback';
import { audioEngine, recordingManager } from '@/lib/audio';
import { formatTime, formatBarsBeats } from '@/lib/utils';
import { useShortcut, useLiveTarget } from '@/hooks';
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
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import Link from 'next/link';
import type { SaveStatus } from '@/lib/persistence/autosave';

interface TransportProps {
    onPlayPause: () => void;
    onStop: () => void;
    /** Starts the audio context. The record button is a user gesture too. */
    onRequestAudio: () => Promise<void>;
    isAudioReady: boolean;
    onOpenSettings?: () => void;
    onOpenProjects?: () => void;
    saveStatus?: SaveStatus;
    saveStatusText?: string;
}

export function Transport({
    onPlayPause,
    onStop,
    onRequestAudio,
    isAudioReady,
    onOpenSettings,
    onOpenProjects,
    saveStatus = 'idle',
    saveStatusText = '',
}: TransportProps) {
    const t = useTranslations('transport');
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
        metronomeEnabled,
        metronomeVolume,
        toggleMetronome: toggleMetronomeState,
    } = usePlaybackStore();

    // Zoom controls
    const zoom = useUIStore((s) => s.zoom);
    const zoomIn = useUIStore((s) => s.zoomIn);
    const zoomOut = useUIStore((s) => s.zoomOut);
    const setZoom = useUIStore((s) => s.setZoom);
    const livePlayOpen = useUIStore((s) => s.livePlayOpen);
    // Whether the keyboard has anything to sound through.
    const liveTarget = useLiveTarget();
    const toggleLivePlay = useUIStore((s) => s.toggleLivePlay);

    // Calculate zoom percentage (MIN_ZOOM=20, MAX_ZOOM=200, DEFAULT=80)
    const zoomPercentage = Math.round((zoom / 80) * 100);

    const [displayTime, setDisplayTime] = useState(0);
    const [localBpm, setLocalBpm] = useState(project?.bpm || 120);
    const [isRecorderReady, setIsRecorderReady] = useState(false);
    const [recorderError, setRecorderError] = useState<string | null>(null);
    const [showShortcutsModal, setShowShortcutsModal] = useState(false);
    const [showExportModal, setShowExportModal] = useState(false);
    const [showImportModal, setShowImportModal] = useState(false);
    const [showCustomTimeSignature, setShowCustomTimeSignature] = useState(false);
    const [customNumerator, setCustomNumerator] = useState(4);
    const [customDenominator, setCustomDenominator] = useState(4);

    // / or ? key to toggle keyboard shortcuts
    useShortcut('view.showShortcuts', () => setShowShortcutsModal(prev => !prev), []);

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
            audioEngine.startMetronome(metronomeVolume);
        }
        toggleMetronomeState();
    }, [metronomeEnabled, metronomeVolume, toggleMetronomeState, isAudioReady]);

    const handleRecord = useCallback(async () => {
        // Counting in counts as recording for this button. It is not
        // `isRecording` yet, so this used to fall through to the else branch and
        // start a *second* take on top of the one counting in — and the count-in
        // itself had no way to be stopped at all.
        if (isRecording || isCountingIn) {
            await recordingManager.stopRecording();
            return;
        }

        // Start recording - need an armed track
        if (!armedTrack) {
            console.warn('[Transport] No armed track for recording');
            return;
        }

        // This click is itself the gesture the audio context needs. Waiting for
        // `isAudioReady` meant the record button stayed dead until the user
        // happened to press Play first, which is not a thing anyone would guess.
        if (!isAudioReady) {
            await onRequestAudio();
        }

        {
            // Only an audio take needs a microphone. A MIDI track records the
            // notes that were played, and asking for mic permission to do that
            // would be a prompt the user cannot connect to anything they did —
            // and one a refusal would then block a recording that never needed
            // it. The recording manager makes the same distinction, from the
            // same field.
            if (!isRecorderReady && armedTrack.type === 'audio') {
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
                    },
                    t('recordedClipName')
                );
            } catch (error) {
                console.error('[Transport] Failed to start recording:', error);
            }
        }
    }, [isAudioReady, isRecording, isCountingIn, armedTrack, countInBars, isRecorderReady, onRequestAudio, t]);

    // R, L and M. All three were printed in the tooltips below and bound to
    // nothing: the hint was written beside the button instead of registered in
    // `lib/shortcuts`, so nothing could notice the difference. They live here
    // rather than on the compose page because the handlers do.
    useShortcut('playback.record', () => { void handleRecord(); }, [handleRecord]);
    useShortcut('playback.toggleLoop', () => toggleLoop(), [toggleLoop]);
    useShortcut('playback.toggleMetronome', () => toggleMetronome(), [toggleMetronome]);

    if (!project) return null;

    return (
        <header className="flex h-transport items-center border-b border-border bg-card">
            {/* Left: Logo + Project name + Save status */}
            <div className="flex items-center gap-2 px-3 2xl:gap-3 2xl:px-4">
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
                            <span className="truncate max-w-[90px] 2xl:max-w-[150px]">{project.name}</span>
                            <ChevronDown className="h-3.5 w-3.5 opacity-50 group-hover:opacity-100" />
                        </button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                        <p>{t('openProjects')}</p>
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
                                <Check className="h-3.5 w-3.5 text-success" />
                            )}
                            {saveStatus === 'pending' && (
                                <Cloud className="h-3.5 w-3.5 text-warning" />
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
                        <p>{saveStatusText || t('autoSaved')}</p>
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
                                    aria-label={t('returnToStart')}
                                >
                                    <SkipBack className="h-4 w-4" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent side="bottom">
                                <p>
                                    {t('returnToStart')}{' '}
                                    <kbd className="ml-1 text-xs opacity-60">Enter</kbd>
                                </p>
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
                                    aria-label={isPlaying ? t('pause') : t('play')}
                                >
                                    {isPlaying ? (
                                        <Pause className="h-4 w-4" />
                                    ) : (
                                        <Play className="h-4 w-4" />
                                    )}
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent side="bottom">
                                <p>
                                    {isPlaying ? t('pause') : t('play')}{' '}
                                    <kbd className="ml-1 text-xs opacity-60">Space</kbd>
                                </p>
                            </TooltipContent>
                        </Tooltip>

                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    aria-label={t('stop')}
                                    variant="transport"
                                    size="icon-sm"
                                    onClick={onStop}
                                >
                                    <Square className="h-3 w-3" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent side="bottom">
                                <p>{t('stop')}</p>
                            </TooltipContent>
                        </Tooltip>

                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant={
                                        isRecording
                                            ? "transport-record-active"
                                            : armedTrack
                                                ? "transport-record-armed"
                                                : "transport-record"
                                    }
                                    size="icon-sm"
                                    onClick={handleRecord}
                                    disabled={!isRecording && !isCountingIn && !armedTrack}
                                    className={isCountingIn ? 'animate-pulse' : ''}
                                    // The tooltip can show a recorder error; a name has to
                                    // stay a name, so it tracks the armed track instead.
                                    aria-label={armedTrack ? t('recordTrack', { name: armedTrack.name }) : t('armToRecord')}
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
                                            ? t('recordTrack', { name: armedTrack.name })
                                            : t('armToRecord')}
                                    {/* Only while it is true. `R` plays F on the
                                        typing keyboard, so live playing takes it
                                        — and a hint that is right half the time
                                        is the thing tests/shortcuts.test.ts
                                        exists to stop. */}
                                    {!livePlayOpen && (
                                        <kbd className="ml-1 text-xs opacity-60">R</kbd>
                                    )}
                                </p>
                            </TooltipContent>
                        </Tooltip>

                        {/* How many bars of click come first. Beside the button
                            it delays, and readable without opening it. */}
                        <CountInSelect />

                        {/* Play It Live, inside the record group rather than
                            beside it. That is where it belongs — the notes it
                            plays are the notes record captures — and it is also
                            what it can afford: the transport measured 0px of
                            slack at 1536, so a button with its own separator
                            put the bar 31px over and pushed the language
                            switcher off the screen. Sharing this group's
                            separators is the difference. */}
                        {/* Disabled only when there is genuinely nothing to play
                            through — no track that can hold an instrument. It is
                            deliberately **not** tied to arming, which was the
                            suggestion when this opened onto silence: arming means
                            "record what I play", and needing it to *play* would
                            make hearing an instrument a two-step ritual. No DAW
                            asks for that. The silence had a different cause and
                            `useLiveTarget` fixes it. */}
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <span>
                                    <Button
                                        aria-label={t('livePlay')}
                                        aria-pressed={livePlayOpen}
                                        variant={livePlayOpen ? "transport-active" : "transport"}
                                        size="icon-sm"
                                        disabled={!liveTarget && !livePlayOpen}
                                        onClick={toggleLivePlay}
                                    >
                                        <Piano className="h-4 w-4" />
                                    </Button>
                                </span>
                            </TooltipTrigger>
                            <TooltipContent side="bottom">
                                <p>
                                    {liveTarget || livePlayOpen ? t('livePlay') : t('livePlayNoTrack')}{' '}
                                    <kbd className="ml-1 text-xs opacity-60">K</kbd>
                                </p>
                            </TooltipContent>
                        </Tooltip>
                    </div>

                    <Separator orientation="vertical" className="h-5 mx-1" />

                    {/* Loop */}
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                aria-label={t('loop')}
                                aria-pressed={isLooping}
                                variant={isLooping ? "transport-active" : "transport"}
                                size="icon-sm"
                                onClick={toggleLoop}
                            >
                                <Repeat className="h-4 w-4" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">
                            <p>
                                {t('loop')}{' '}
                                <kbd className="ml-1 text-xs opacity-60">L</kbd>
                            </p>
                        </TooltipContent>
                    </Tooltip>

                    <Separator orientation="vertical" className="h-5 mx-1" />

                    {/* Import button */}
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                aria-label={t('import')}
                                variant="transport"
                                size="icon-sm"
                                onClick={() => setShowImportModal(true)}
                            >
                                <Upload className="h-4 w-4" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">
                            <p>{t('import')}</p>
                        </TooltipContent>
                    </Tooltip>

                    {/* Export dropdown */}
                    {/* Export button */}
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                aria-label={t('export')}
                                variant="transport"
                                size="icon-sm"
                                disabled={!project}
                                onClick={() => setShowExportModal(true)}
                            >
                                <Download className="h-4 w-4" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">
                            <p>{t('export')}</p>
                        </TooltipContent>
                    </Tooltip>
                </div>

                <Separator orientation="vertical" className="h-6 mx-2" />

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
                            <p>{t('musicalTime')}</p>
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
                            <p>{t('clockTime')}</p>
                        </TooltipContent>
                    </Tooltip>
                </div>

                <Separator orientation="vertical" className="h-6 mx-2" />

                {/* Tempo & Time Signature */}
                <div className="flex items-center gap-2">
                    {/* BPM */}
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <div className="flex items-center gap-1.5 bg-background rounded-md border border-border/50 px-2 py-1 cursor-default">
                                <span className="text-xs text-muted-foreground uppercase tracking-wider">{t('bpm')}</span>
                                <Input
                                    type="number"
                                    // Matches the visible "BPM" caption beside it:
                                    // an accessible name that disagrees with the
                                    // label on screen is its own problem.
                                    aria-label={t('bpm')}
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
                            <p>{t('tempo')}</p>
                        </TooltipContent>
                    </Tooltip>

                    {/* Time signature */}
                    <Popover open={showCustomTimeSignature} onOpenChange={setShowCustomTimeSignature}>
                        <PopoverTrigger asChild>
                            <div>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button
                                            variant="ghost"
                                            className="h-8 px-2 bg-background border border-border/50 font-mono text-sm hover:bg-accent/50"
                                        >
                                            {project.timeSignature[0]}/{project.timeSignature[1]}
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent side="bottom">
                                        <p>{t('timeSignatureHint')}</p>
                                    </TooltipContent>
                                </Tooltip>
                            </div>
                        </PopoverTrigger>
                        <PopoverContent className="w-64 p-4" align="center">
                            <div className="space-y-4">
                                <h4 className="font-medium text-sm">{t('timeSignature')}</h4>

                                {/* Common presets */}
                                <div className="grid grid-cols-4 gap-1">
                                    {['4/4', '3/4', '6/8', '2/4', '5/4', '7/8', '9/8', '12/8'].map((ts) => {
                                        const [num, denom] = ts.split('/').map(Number);
                                        const isActive = project.timeSignature[0] === num && project.timeSignature[1] === denom;
                                        return (
                                            <Button
                                                key={ts}
                                                variant={isActive ? "default" : "outline"}
                                                size="sm"
                                                className="font-mono text-xs"
                                                onClick={() => {
                                                    useProjectStore.getState().setTimeSignature([num, denom] as [number, number]);
                                                    setShowCustomTimeSignature(false);
                                                }}
                                            >
                                                {ts}
                                            </Button>
                                        );
                                    })}
                                </div>

                                <Separator />

                                {/* Custom input */}
                                {/* "Custom" captions the pair, so it is the
                                    group's name — each half still needs its own,
                                    or both read as unnamed. */}
                                <div role="group" aria-labelledby="time-signature-custom">
                                    <span
                                        id="time-signature-custom"
                                        className="text-xs text-muted-foreground mb-2 block"
                                    >
                                        {t('custom')}
                                    </span>
                                    <div className="flex items-center gap-2">
                                        <Input
                                            type="number"
                                            aria-label={t('beatsPerBar')}
                                            value={customNumerator}
                                            onChange={(e) => setCustomNumerator(Math.max(1, Math.min(32, Number(e.target.value) || 1)))}
                                            className="h-8 text-center font-mono flex-1"
                                            min={1}
                                            max={32}
                                        />
                                        <span className="text-xl text-muted-foreground" aria-hidden="true">/</span>
                                        <Select
                                            value={String(customDenominator)}
                                            onValueChange={(v) => setCustomDenominator(Number(v))}
                                        >
                                            <SelectTrigger className="h-8 font-mono flex-1" aria-label={t('beatUnit')}>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="2">2</SelectItem>
                                                <SelectItem value="4">4</SelectItem>
                                                <SelectItem value="8">8</SelectItem>
                                                <SelectItem value="16">16</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <Button
                                            size="sm"
                                            onClick={() => {
                                                useProjectStore.getState().setTimeSignature([customNumerator, customDenominator] as [number, number]);
                                                setShowCustomTimeSignature(false);
                                            }}
                                        >
                                            {t('apply')}
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </PopoverContent>
                    </Popover>

                    {/* Scale / key, as a vibe */}
                    <VibeSelect />

                    {/* Metronome */}
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                aria-label={t('metronome')}
                                aria-pressed={metronomeEnabled}
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
                            <p>
                                {t('metronome')}{' '}
                                <kbd className="ml-1 text-xs opacity-60">M</kbd>
                            </p>
                        </TooltipContent>
                    </Tooltip>

                    <Separator orientation="vertical" className="h-5 mx-1" />

                    {/* Zoom controls */}
                    <div className="flex items-center gap-1">
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    aria-label={t('zoomOut')}
                                    variant="transport"
                                    size="icon-sm"
                                    onClick={zoomOut}
                                >
                                    <ZoomOut className="h-3.5 w-3.5" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent side="bottom">
                                <p>
                                    {t('zoomOut')}{' '}
                                    <kbd className="ml-1 text-xs opacity-60">-</kbd>
                                </p>
                            </TooltipContent>
                        </Tooltip>

                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="ghost"
                                    onClick={() => setZoom(80)}
                                    className="h-7 w-12 px-0 text-xs font-mono tabular-nums text-muted-foreground hover:text-foreground"
                                >
                                    {zoomPercentage}%
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent side="bottom">
                                <p>
                                    {t('resetZoom')}{' '}
                                    <kbd className="ml-1 text-xs opacity-60">⌘0</kbd>
                                </p>
                            </TooltipContent>
                        </Tooltip>

                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    aria-label={t('zoomIn')}
                                    variant="transport"
                                    size="icon-sm"
                                    onClick={zoomIn}
                                >
                                    <ZoomIn className="h-3.5 w-3.5" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent side="bottom">
                                <p>
                                    {t('zoomIn')}{' '}
                                    <kbd className="ml-1 text-xs opacity-60">+</kbd>
                                </p>
                            </TooltipContent>
                        </Tooltip>

                        {/* No zoom slider. It was a duplicate of the −/reset/+
                            buttons immediately to its left, and it cost 80px in
                            the bar that had none to spare. */}
                    </div>
                </div>
            </div>

            {/* Right: Settings */}
            <div className="flex items-center gap-2 px-3 2xl:px-4">
                {/* No armed-track indicator here. It appeared and disappeared with
                    arming, so it moved every button to its right — state changing
                    layout rather than appearance — and it cost 106px in a bar that
                    only just fits. What it said is already said twice: the record
                    button turns red and names the track, and the track header says
                    ARMED. */}
                <Separator orientation="vertical" className="h-6" />

                {/* One gear, four things. The shortcuts sheet, latency
                    calibration, the theme and the language were four separate
                    glyphs in the tightest part of the header, and not one of
                    them is touched while you are working. */}
                <SettingsMenu
                    onOpenShortcuts={() => setShowShortcutsModal(true)}
                    onOpenCalibration={() => onOpenSettings?.()}
                />

                <KeyboardShortcutsModal
                    isOpen={showShortcutsModal}
                    onClose={() => setShowShortcutsModal(false)}
                />

                <ExportModal
                    isOpen={showExportModal}
                    onClose={() => setShowExportModal(false)}
                />

                <ImportModal
                    isOpen={showImportModal}
                    onClose={() => setShowImportModal(false)}
                />
            </div>
        </header>
    );
}
