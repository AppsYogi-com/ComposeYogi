'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import {
    ChevronDown,
    ChevronUp,
    Piano,
    Grid3X3,
    AudioWaveform
} from 'lucide-react';
import { useProjectStore, useUIStore } from '@/lib/store';
import { Button } from '@/components/ui';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { DrumSequencer, PianoRoll, WaveformEditor } from './editors';
import type { Clip } from '@/types';

type EditorMode = 'piano-roll' | 'drum-sequencer' | 'waveform';

export function EditorPanel() {
    const t = useTranslations('editor');
    const [mode, setMode] = useState<EditorMode>('piano-roll');
    const selectedClipIds = useUIStore((s) => s.selectedClipIds);
    const toggleEditor = useUIStore((s) => s.toggleEditor);
    const project = useProjectStore((s) => s.project);

    const selectedClipId = selectedClipIds[0] || null;
    const selectedClip = project?.clips.find((c) => c.id === selectedClipId);

    // Auto-switch editor mode based on clip type
    useEffect(() => {
        if (selectedClip) {
            switch (selectedClip.type) {
                case 'drum':
                    setMode('drum-sequencer');
                    break;
                case 'audio':
                    setMode('waveform');
                    break;
                case 'midi':
                default:
                    setMode('piano-roll');
                    break;
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedClip?.id, selectedClip?.type]);

    return (
        <div className="flex h-editor flex-col border-t border-border bg-surface">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border px-3 py-1">
                <div className="flex items-center gap-1">
                    {/* Editor mode tabs */}
                    <Button
                        variant={mode === 'piano-roll' ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => setMode('piano-roll')}
                        className="h-7 gap-1.5 text-xs"
                    >
                        <Piano className="h-3.5 w-3.5" />
                        {t('tabs.piano')}
                    </Button>
                    <Button
                        variant={mode === 'drum-sequencer' ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => setMode('drum-sequencer')}
                        className="h-7 gap-1.5 text-xs"
                    >
                        <Grid3X3 className="h-3.5 w-3.5" />
                        {t('tabs.drum')}
                    </Button>
                    <Button
                        variant={mode === 'waveform' ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => setMode('waveform')}
                        className="h-7 gap-1.5 text-xs"
                    >
                        <AudioWaveform className="h-3.5 w-3.5" />
                        {t('tabs.waveform')}
                    </Button>
                </div>

                <div className="flex items-center gap-2">
                    {selectedClip && (
                        <span className="text-xs text-muted-foreground">
                            {t('editing', { name: selectedClip.name })}
                        </span>
                    )}
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={toggleEditor}
                                className="h-6 w-6"
                            >
                                <ChevronDown className="h-4 w-4" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">
                            <p>
                                {t('close')}{' '}
                                <kbd className="ml-1 text-xs opacity-60">E</kbd>
                            </p>
                        </TooltipContent>
                    </Tooltip>
                </div>
            </div>

            {/* Editor content */}
            <div className="flex-1 overflow-hidden">
                {!selectedClip ? (
                    <div className="flex h-full items-center justify-center">
                        <p className="text-sm text-muted-foreground">
                            {t('emptyState')}
                        </p>
                    </div>
                ) : (
                    <EditorContent mode={mode} clip={selectedClip} />
                )}
            </div>
        </div>
    );
}

// Separate component to avoid re-mounting editors when switching modes
function EditorContent({ mode, clip }: { mode: EditorMode; clip: Clip }) {
    switch (mode) {
        case 'drum-sequencer':
            return <DrumSequencer clip={clip} />;
        case 'waveform':
            return <WaveformEditor clip={clip} />;
        case 'piano-roll':
        default:
            return <PianoRoll clip={clip} />;
    }
}

// Collapsed bar to show editor
export function EditorCollapsedBar() {
    const t = useTranslations('editor');
    const toggleEditor = useUIStore((s) => s.toggleEditor);

    return (
        <div className="border-t border-border bg-background">
            <button
                onClick={toggleEditor}
                className="w-full flex items-center justify-center gap-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            >
                <ChevronUp className="h-3 w-3" />
                <span className="text-2xs tracking-wider">{t('collapsedLabel')}</span>
                <kbd className="px-1 py-0.5 text-2xs font-mono bg-muted border border-border rounded">E</kbd>
            </button>
        </div>
    );
}
