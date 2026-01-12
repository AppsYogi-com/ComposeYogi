// ============================================
// ComposeYogi — Export Modal
// Progress UI for audio export
// ============================================

'use client';

import { useEffect, useState, useCallback } from 'react';
import { Download, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog';
import { useProjectStore } from '@/lib/store';
import { downloadProjectAsWav } from '@/lib/audio/offline-renderer';

// ============================================
// Types
// ============================================

type ExportState = 'idle' | 'exporting' | 'complete' | 'error';

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

    // Reset state when modal opens
    useEffect(() => {
        if (isOpen) {
            setExportState('idle');
            setProgress(0);
            setErrorMessage(null);
        }
    }, [isOpen]);

    const handleExport = useCallback(async () => {
        if (!project) return;

        setExportState('exporting');
        setProgress(0);
        setErrorMessage(null);

        try {
            await downloadProjectAsWav(project, (p) => {
                setProgress(p);
            });
            setExportState('complete');
        } catch (error) {
            console.error('[ExportModal] Export failed:', error);
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
                        Export Audio
                    </DialogTitle>
                    <DialogDescription>
                        Export &quot;{project.name}&quot; as a WAV file
                    </DialogDescription>
                </DialogHeader>

                <div className="py-4 space-y-4">
                    {/* Idle State */}
                    {exportState === 'idle' && (
                        <div className="space-y-4">
                            <div className="rounded-lg bg-muted/50 p-4 space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Format</span>
                                    <span className="font-medium">WAV (16-bit PCM)</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Sample Rate</span>
                                    <span className="font-medium">44.1 kHz</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Channels</span>
                                    <span className="font-medium">Stereo</span>
                                </div>
                            </div>

                            <div className="flex justify-end gap-2">
                                <Button variant="outline" onClick={handleClose}>
                                    Cancel
                                </Button>
                                <Button onClick={handleExport}>
                                    <Download className="mr-2 h-4 w-4" />
                                    Export WAV
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* Exporting State */}
                    {exportState === 'exporting' && (
                        <div className="space-y-4">
                            <div className="flex items-center gap-3">
                                <Loader2 className="h-5 w-5 animate-spin text-accent" />
                                <span className="text-sm">Rendering audio...</span>
                            </div>

                            <div className="space-y-2">
                                <Progress value={progress} className="h-2" />
                                <p className="text-xs text-muted-foreground text-center">
                                    {progress}% complete
                                </p>
                            </div>

                            <p className="text-xs text-muted-foreground">
                                Please wait while your project is being rendered. This may take a moment.
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
                                <Button onClick={handleExport}>
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
