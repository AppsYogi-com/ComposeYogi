// ============================================
// ComposeYogi — Export Modal
// Progress UI for audio export + JSON export
// ============================================

'use client';

import { useEffect, useState, useCallback } from 'react';
import { Download, CheckCircle, AlertCircle, Loader2, FileJson, Music, FileAudio } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { useProjectStore } from '@/lib/store';
import { downloadProjectAsWav, downloadProjectAsMp3 } from '@/lib/audio/offline-renderer';
import { downloadProjectAsMidi } from '@/lib/audio/export';
import { downloadProjectAsJSON } from '@/lib/audio/project-io';
import { MP3_QUALITY_PRESETS, type Mp3Quality } from '@/lib/audio/mp3-encoder';

// ============================================
// Types
// ============================================

type ExportState = 'idle' | 'exporting' | 'complete' | 'error';
type ExportType = 'wav' | 'mp3' | 'midi' | 'json';

interface ExportModalProps {
    isOpen: boolean;
    onClose: () => void;
}

// ============================================
// Component
// ============================================

export function ExportModal({ isOpen, onClose }: ExportModalProps) {
    const project = useProjectStore((s) => s.project);
    const [exportState, setExportState] = useState<ExportState>('idle');
    const [progress, setProgress] = useState(0);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [exportType, setExportType] = useState<ExportType>('wav');
    const [mp3Quality, setMp3Quality] = useState<Mp3Quality>(192);

    // Reset state when modal opens
    useEffect(() => {
        if (isOpen) {
            setExportState('idle');
            setProgress(0);
            setErrorMessage(null);
            setExportType('wav');
        }
    }, [isOpen]);

    const handleExportWav = useCallback(async () => {
        if (!project) return;

        setExportState('exporting');
        setExportType('wav');
        setProgress(0);
        setErrorMessage(null);

        try {
            await downloadProjectAsWav(project, (p) => {
                setProgress(p);
            });
            setExportState('complete');
        } catch (error) {
            console.error('[ExportModal] WAV export failed:', error);
            setErrorMessage(error instanceof Error ? error.message : 'Export failed');
            setExportState('error');
        }
    }, [project]);

    const handleExportMp3 = useCallback(async () => {
        if (!project) return;

        setExportState('exporting');
        setExportType('mp3');
        setProgress(0);
        setErrorMessage(null);

        try {
            await downloadProjectAsMp3(project, mp3Quality, (p) => {
                setProgress(p);
            });
            setExportState('complete');
        } catch (error) {
            console.error('[ExportModal] MP3 export failed:', error);
            setErrorMessage(error instanceof Error ? error.message : 'Export failed');
            setExportState('error');
        }
    }, [project, mp3Quality]);

    const handleExportMidi = useCallback(() => {
        if (!project) return;
        try {
            downloadProjectAsMidi(project);
            setExportState('complete');
            setExportType('midi');
        } catch (error) {
            console.error('[ExportModal] MIDI export failed:', error);
            setErrorMessage(error instanceof Error ? error.message : 'Export failed');
            setExportState('error');
        }
    }, [project]);

    const handleExportJSON = useCallback(() => {
        if (!project) return;
        try {
            downloadProjectAsJSON(project, undefined, false);
            setExportState('complete');
            setExportType('json');
        } catch (error) {
            console.error('[ExportModal] JSON export failed:', error);
            setErrorMessage(error instanceof Error ? error.message : 'Export failed');
            setExportState('error');
        }
    }, [project]);

    const handleClose = useCallback(() => {
        // Don't allow closing while exporting
        if (exportState === 'exporting') return;
        onClose();
    }, [exportState, onClose]);

    if (!project) return null;

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Download className="h-5 w-5" />
                        Export Project
                    </DialogTitle>
                    <DialogDescription>
                        Export &quot;{project.name}&quot; in your preferred format
                    </DialogDescription>
                </DialogHeader>

                <div className="py-4 space-y-4">
                    {/* Idle State */}
                    {exportState === 'idle' && (
                        <div className="space-y-3">
                            {/* WAV Export */}
                            <button
                                onClick={handleExportWav}
                                className="w-full flex items-center gap-4 p-4 rounded-lg border border-border hover:bg-muted/50 transition-colors text-left"
                            >
                                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center">
                                    <FileAudio className="h-5 w-5 text-green-500" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="font-medium">WAV Audio</div>
                                    <div className="text-sm text-muted-foreground">High-quality 16-bit PCM, 44.1 kHz stereo</div>
                                </div>
                            </button>

                            {/* MP3 Export */}
                            <div className="rounded-lg border border-border p-4 space-y-3">
                                <div className="flex items-center gap-4">
                                    <div className="flex-shrink-0 w-10 h-10 rounded-full bg-orange-500/10 flex items-center justify-center">
                                        <FileAudio className="h-5 w-5 text-orange-500" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="font-medium">MP3 Audio</div>
                                        <div className="text-sm text-muted-foreground">Compressed, smaller file size</div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3 pl-14">
                                    <Select
                                        value={mp3Quality.toString()}
                                        onValueChange={(v) => setMp3Quality(parseInt(v) as Mp3Quality)}
                                    >
                                        <SelectTrigger className="w-[180px] h-8 text-sm">
                                            <SelectValue placeholder="Quality" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {Object.entries(MP3_QUALITY_PRESETS).map(([kbps, preset]) => (
                                                <SelectItem key={kbps} value={kbps}>
                                                    {preset.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <Button size="sm" onClick={handleExportMp3}>
                                        Export MP3
                                    </Button>
                                </div>
                            </div>

                            {/* MIDI Export */}
                            <button
                                onClick={handleExportMidi}
                                className="w-full flex items-center gap-4 p-4 rounded-lg border border-border hover:bg-muted/50 transition-colors text-left"
                            >
                                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                                    <Music className="h-5 w-5 text-blue-500" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="font-medium">MIDI File</div>
                                    <div className="text-sm text-muted-foreground">Standard MIDI for use in other DAWs</div>
                                </div>
                            </button>

                            {/* JSON Export */}
                            <button
                                onClick={handleExportJSON}
                                className="w-full flex items-center gap-4 p-4 rounded-lg border border-border hover:bg-muted/50 transition-colors text-left"
                            >
                                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-purple-500/10 flex items-center justify-center">
                                    <FileJson className="h-5 w-5 text-purple-500" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="font-medium">Project File (.cyp)</div>
                                    <div className="text-sm text-muted-foreground">Full project backup, can be re-imported</div>
                                </div>
                            </button>

                            <div className="flex justify-end pt-2">
                                <Button variant="outline" onClick={handleClose}>
                                    Cancel
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* Exporting State (WAV/MP3) */}
                    {exportState === 'exporting' && (exportType === 'wav' || exportType === 'mp3') && (
                        <div className="space-y-4">
                            <div className="flex items-center gap-3">
                                <Loader2 className="h-5 w-5 animate-spin text-accent" />
                                <span className="text-sm">
                                    {exportType === 'mp3' && progress < 50
                                        ? 'Rendering audio...'
                                        : exportType === 'mp3' && progress >= 50
                                          ? 'Encoding MP3...'
                                          : 'Rendering audio...'}
                                </span>
                            </div>

                            <div className="space-y-2">
                                <Progress value={progress} className="h-2" />
                                <p className="text-xs text-muted-foreground text-center">
                                    {progress}% complete
                                </p>
                            </div>

                            <p className="text-xs text-muted-foreground">
                                Please wait while your project is being {exportType === 'mp3' ? 'rendered and encoded' : 'rendered'}. This may take a moment.
                            </p>
                        </div>
                    )}

                    {/* Complete State */}
                    {exportState === 'complete' && (
                        <div className="space-y-4">
                            <div className="flex items-center gap-3 text-green-500">
                                <CheckCircle className="h-5 w-5" />
                                <span className="font-medium">Export Complete!</span>
                            </div>

                            <p className="text-sm text-muted-foreground">
                                Your project has been exported and the download should start automatically.
                            </p>

                            <div className="flex justify-end">
                                <Button onClick={handleClose}>
                                    Done
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* Error State */}
                    {exportState === 'error' && (
                        <div className="space-y-4">
                            <div className="flex items-center gap-3 text-destructive">
                                <AlertCircle className="h-5 w-5" />
                                <span className="font-medium">Export Failed</span>
                            </div>

                            <p className="text-sm text-muted-foreground">
                                {errorMessage || 'An error occurred during export.'}
                            </p>

                            <div className="flex justify-end gap-2">
                                <Button variant="outline" onClick={handleClose}>
                                    Close
                                </Button>
                                <Button onClick={() => setExportState('idle')}>
                                    Try Again
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
