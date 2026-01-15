// ============================================
// ComposeYogi — Import Modal
// Import JSON projects and MIDI files
// ============================================

'use client';

import { useCallback, useState, useRef } from 'react';
import {
    Upload,
    FileJson,
    Music,
    AlertCircle,
    CheckCircle,
    FileWarning,
    Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog';
import { useProjectStore } from '@/lib/store';
import {
    importProjectFromFile,
    importMidiFile,
    previewMidiFile,
    type ImportResult,
    type MidiImportPreview,
} from '@/lib/audio/project-io';

// ============================================
// Types
// ============================================

type ImportState = 'idle' | 'previewing' | 'importing' | 'complete' | 'error';
type FileType = 'json' | 'midi' | null;

interface ImportModalProps {
    isOpen: boolean;
    onClose: () => void;
}

// ============================================
// Component
// ============================================

export function ImportModal({ isOpen, onClose }: ImportModalProps) {
    const loadProject = useProjectStore((s) => s.loadProject);

    const [importState, setImportState] = useState<ImportState>('idle');
    const [fileType, setFileType] = useState<FileType>(null);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [midiPreview, setMidiPreview] = useState<MidiImportPreview | null>(null);
    const [importResult, setImportResult] = useState<ImportResult | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [isDragging, setIsDragging] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);

    // Reset state when modal closes
    const resetState = useCallback(() => {
        setImportState('idle');
        setFileType(null);
        setSelectedFile(null);
        setMidiPreview(null);
        setImportResult(null);
        setErrorMessage(null);
        setIsDragging(false);
    }, []);

    const handleClose = useCallback(() => {
        if (importState === 'importing') return;
        resetState();
        onClose();
    }, [importState, onClose, resetState]);

    // Detect file type and handle accordingly
    const handleFileSelect = useCallback(async (file: File) => {
        const extension = file.name.toLowerCase().split('.').pop();

        setSelectedFile(file);
        setErrorMessage(null);

        if (extension === 'mid' || extension === 'midi') {
            setFileType('midi');
            setImportState('previewing');

            const preview = await previewMidiFile(file);
            if (preview) {
                setMidiPreview(preview);
            } else {
                setErrorMessage('Failed to read MIDI file');
                setImportState('error');
            }
        } else if (extension === 'json' || file.name.endsWith('.cyp.json')) {
            setFileType('json');
            setImportState('previewing');
        } else {
            setErrorMessage('Unsupported file type. Please select a .mid, .midi, or .cyp.json file.');
            setImportState('error');
        }
    }, []);

    // Handle file input change
    const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            handleFileSelect(file);
        }
    }, [handleFileSelect]);

    // Handle drag and drop
    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);

        const file = e.dataTransfer.files[0];
        if (file) {
            handleFileSelect(file);
        }
    }, [handleFileSelect]);

    // Perform the import
    const handleImport = useCallback(async () => {
        if (!selectedFile) return;

        setImportState('importing');
        setErrorMessage(null);

        try {
            let result: ImportResult;

            if (fileType === 'midi') {
                result = await importMidiFile(selectedFile);
            } else {
                result = await importProjectFromFile(selectedFile);
            }

            setImportResult(result);

            if (result.success && result.project) {
                loadProject(result.project);
                setImportState('complete');
            } else {
                setErrorMessage(result.error || 'Import failed');
                setImportState('error');
            }
        } catch (error) {
            console.error('[ImportModal] Import failed:', error);
            setErrorMessage(error instanceof Error ? error.message : 'Import failed');
            setImportState('error');
        }
    }, [selectedFile, fileType, loadProject]);

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Upload className="h-5 w-5" />
                        Import Project
                    </DialogTitle>
                    <DialogDescription>
                        Import a ComposeYogi project (.cyp.json) or MIDI file (.mid)
                    </DialogDescription>
                </DialogHeader>

                <div className="py-4 space-y-4">
                    {/* Idle State - File Picker */}
                    {importState === 'idle' && (
                        <div
                            className={`
                                border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer
                                ${isDragging ? 'border-accent bg-accent/5' : 'border-border hover:border-muted-foreground'}
                            `}
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onDrop={handleDrop}
                            onClick={() => fileInputRef.current?.click()}
                        >
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".mid,.midi,.json,.cyp.json"
                                onChange={handleInputChange}
                                className="hidden"
                            />

                            <div className="flex justify-center gap-4 mb-4">
                                <div className="w-12 h-12 rounded-full bg-purple-500/10 flex items-center justify-center">
                                    <FileJson className="h-6 w-6 text-purple-500" />
                                </div>
                                <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center">
                                    <Music className="h-6 w-6 text-blue-500" />
                                </div>
                            </div>

                            <p className="text-sm font-medium mb-1">
                                Drop a file here or click to browse
                            </p>
                            <p className="text-xs text-muted-foreground">
                                Supports .cyp.json (ComposeYogi) and .mid (MIDI) files
                            </p>
                        </div>
                    )}

                    {/* Previewing State - Show file details */}
                    {importState === 'previewing' && (
                        <div className="space-y-4">
                            {/* File Info */}
                            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                                {fileType === 'midi' ? (
                                    <Music className="h-8 w-8 text-blue-500" />
                                ) : (
                                    <FileJson className="h-8 w-8 text-purple-500" />
                                )}
                                <div className="flex-1 min-w-0">
                                    <p className="font-medium truncate">{selectedFile?.name}</p>
                                    <p className="text-xs text-muted-foreground">
                                        {fileType === 'midi' ? 'MIDI File' : 'ComposeYogi Project'}
                                    </p>
                                </div>
                            </div>

                            {/* MIDI Preview Details */}
                            {fileType === 'midi' && midiPreview && (
                                <div className="rounded-lg border border-border p-4 space-y-3">
                                    <div className="grid grid-cols-2 gap-2 text-sm">
                                        <div>
                                            <span className="text-muted-foreground">Name:</span>
                                            <span className="ml-2 font-medium">{midiPreview.name}</span>
                                        </div>
                                        <div>
                                            <span className="text-muted-foreground">BPM:</span>
                                            <span className="ml-2 font-medium">{Math.round(midiPreview.bpm)}</span>
                                        </div>
                                        <div>
                                            <span className="text-muted-foreground">Tracks:</span>
                                            <span className="ml-2 font-medium">{midiPreview.trackCount}</span>
                                        </div>
                                        <div>
                                            <span className="text-muted-foreground">Notes:</span>
                                            <span className="ml-2 font-medium">{midiPreview.noteCount.toLocaleString()}</span>
                                        </div>
                                    </div>

                                    {midiPreview.tracks.length > 0 && (
                                        <div className="pt-2 border-t border-border">
                                            <p className="text-xs text-muted-foreground mb-2">Tracks to import:</p>
                                            <div className="space-y-1 max-h-32 overflow-y-auto">
                                                {midiPreview.tracks.map((track, i) => (
                                                    <div key={i} className="flex items-center justify-between text-xs">
                                                        <span className="truncate">{track.name}</span>
                                                        <span className="text-muted-foreground ml-2">
                                                            {track.isDrum ? '🥁' : '🎹'} {track.noteCount} notes
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* JSON Preview */}
                            {fileType === 'json' && (
                                <div className="rounded-lg border border-border p-4">
                                    <p className="text-sm text-muted-foreground">
                                        Ready to import. This will create a new project with all tracks and clips.
                                    </p>
                                </div>
                            )}

                            {/* Actions */}
                            <div className="flex justify-end gap-2">
                                <Button variant="outline" onClick={resetState}>
                                    Cancel
                                </Button>
                                <Button onClick={handleImport}>
                                    <Upload className="mr-2 h-4 w-4" />
                                    Import
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* Importing State */}
                    {importState === 'importing' && (
                        <div className="flex flex-col items-center py-8">
                            <Loader2 className="h-8 w-8 animate-spin text-accent mb-4" />
                            <p className="text-sm">Importing project...</p>
                        </div>
                    )}

                    {/* Complete State */}
                    {importState === 'complete' && (
                        <div className="space-y-4">
                            <div className="flex items-center gap-3 text-green-500">
                                <CheckCircle className="h-5 w-5" />
                                <span className="font-medium">Import Complete!</span>
                            </div>

                            {importResult?.project && (
                                <div className="rounded-lg bg-muted/50 p-3 text-sm">
                                    <p><strong>{importResult.project.name}</strong></p>
                                    <p className="text-muted-foreground">
                                        {importResult.project.tracks.length} tracks, {importResult.project.clips.length} clips
                                    </p>
                                </div>
                            )}

                            {/* Warnings */}
                            {importResult?.warnings && importResult.warnings.length > 0 && (
                                <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-3">
                                    <div className="flex items-center gap-2 text-yellow-600 mb-2">
                                        <FileWarning className="h-4 w-4" />
                                        <span className="text-sm font-medium">Warnings</span>
                                    </div>
                                    <ul className="text-xs text-muted-foreground space-y-1">
                                        {importResult.warnings.map((warning, i) => (
                                            <li key={i}>• {warning}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            <div className="flex justify-end">
                                <Button onClick={handleClose}>
                                    Done
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* Error State */}
                    {importState === 'error' && (
                        <div className="space-y-4">
                            <div className="flex items-center gap-3 text-destructive">
                                <AlertCircle className="h-5 w-5" />
                                <span className="font-medium">Import Failed</span>
                            </div>

                            <p className="text-sm text-muted-foreground">
                                {errorMessage || 'An error occurred during import.'}
                            </p>

                            <div className="flex justify-end gap-2">
                                <Button variant="outline" onClick={handleClose}>
                                    Close
                                </Button>
                                <Button onClick={resetState}>
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
