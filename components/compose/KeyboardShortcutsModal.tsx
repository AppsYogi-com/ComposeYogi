'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { X, Keyboard, RotateCcw } from 'lucide-react';
import { useUIStore, selectCustomKeyBindings } from '@/lib/store';
import {
    SHORTCUT_DEFINITIONS,
    SHORTCUT_CATEGORIES,
    getEffectiveKey,
    hotkeyToDisplayKeys,
    keyboardEventToHotkeyString,
    findConflict,
    type ShortcutDefinition,
    type KeyBindings,
} from '@/lib/shortcuts';

// ============================================
// Types
// ============================================

interface KeyboardShortcutsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

// ============================================
// Shortcut Row Component
// ============================================

function ShortcutRow({
    definition,
    customBindings,
    isRecording,
    onStartRecording,
    onStopRecording,
    onReset,
}: {
    definition: ShortcutDefinition;
    customBindings: KeyBindings;
    isRecording: boolean;
    onStartRecording: () => void;
    onStopRecording: (hotkeyStr: string) => void;
    onReset: () => void;
}) {
    const recordRef = useRef<HTMLButtonElement>(null);
    const effectiveKey = getEffectiveKey(definition.id, customBindings);
    const isCustomized = definition.id in customBindings;
    const displayKeys = definition.displayKeys || hotkeyToDisplayKeys(effectiveKey);

    // Handle key capture when recording
    useEffect(() => {
        if (!isRecording) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            e.preventDefault();
            e.stopPropagation();

            // Ignore bare modifier keys
            if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) return;

            // Escape cancels recording
            if (e.key === 'Escape') {
                onStopRecording('');
                return;
            }

            const hotkeyStr = keyboardEventToHotkeyString(e);
            if (hotkeyStr) {
                onStopRecording(hotkeyStr);
            }
        };

        // Use capture phase to intercept before other handlers
        document.addEventListener('keydown', handleKeyDown, true);
        return () => document.removeEventListener('keydown', handleKeyDown, true);
    }, [isRecording, onStopRecording]);

    // Focus the button when recording starts
    useEffect(() => {
        if (isRecording && recordRef.current) {
            recordRef.current.focus();
        }
    }, [isRecording]);

    if (!definition.rebindable) {
        // Non-rebindable shortcuts (mouse actions) — display only
        return (
            <div className="flex items-center justify-between py-1.5">
                <span className="text-sm text-foreground">
                    {definition.label}
                </span>
                <div className="flex items-center gap-1">
                    {displayKeys.map((key, i) => (
                        <kbd
                            key={i}
                            className="px-2 py-1 text-xs font-mono bg-muted border border-border rounded text-muted-foreground"
                        >
                            {key}
                        </kbd>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="flex items-center justify-between py-1.5 group">
            <span className="text-sm text-foreground">
                {definition.label}
            </span>
            <div className="flex items-center gap-2">
                {/* Reset button (only visible for customized shortcuts) */}
                {isCustomized && !isRecording && (
                    <button
                        onClick={onReset}
                        className="p-1 rounded hover:bg-muted transition-colors opacity-0 group-hover:opacity-100"
                        title="Reset to default"
                    >
                        <RotateCcw className="w-3 h-3 text-muted-foreground" />
                    </button>
                )}

                {/* Key binding display / recording button */}
                <button
                    ref={recordRef}
                    onClick={() => {
                        if (!isRecording) onStartRecording();
                    }}
                    className={`
                        flex items-center gap-1 px-2 py-1 rounded transition-all cursor-pointer min-w-[60px] justify-end
                        ${isRecording
                            ? 'bg-primary/20 border border-primary ring-2 ring-primary/30 animate-pulse'
                            : isCustomized
                                ? 'hover:bg-muted/60 border border-primary/40 bg-primary/5'
                                : 'hover:bg-muted/60 border border-transparent'
                        }
                    `}
                    title={isRecording ? 'Press a key combo... (Esc to cancel)' : 'Click to rebind'}
                >
                    {isRecording ? (
                        <span className="text-xs text-primary font-medium">
                            Press keys...
                        </span>
                    ) : (
                        displayKeys.map((key, i) => (
                            <kbd
                                key={i}
                                className={`
                                    px-2 py-0.5 text-xs font-mono rounded
                                    ${isCustomized
                                        ? 'bg-primary/10 border border-primary/30 text-primary'
                                        : 'bg-muted border border-border text-muted-foreground'
                                    }
                                `}
                            >
                                {key}
                            </kbd>
                        ))
                    )}
                </button>
            </div>
        </div>
    );
}

// ============================================
// Main Modal Component
// ============================================

export function KeyboardShortcutsModal({ isOpen, onClose }: KeyboardShortcutsModalProps) {
    const customBindings = useUIStore(selectCustomKeyBindings);
    const updateKeyBinding = useUIStore((s) => s.updateKeyBinding);
    const resetKeyBinding = useUIStore((s) => s.resetKeyBinding);
    const resetAllKeyBindings = useUIStore((s) => s.resetAllKeyBindings);

    const [recordingActionId, setRecordingActionId] = useState<string | null>(null);
    const [conflictMessage, setConflictMessage] = useState<string | null>(null);

    // Close on Escape (only when not recording)
    useEffect(() => {
        if (!isOpen) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && !recordingActionId) {
                onClose();
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose, recordingActionId]);

    // Clear conflict message after a delay
    useEffect(() => {
        if (!conflictMessage) return;
        const timer = setTimeout(() => setConflictMessage(null), 3000);
        return () => clearTimeout(timer);
    }, [conflictMessage]);

    // Reset state when modal closes
    useEffect(() => {
        if (!isOpen) {
            setRecordingActionId(null);
            setConflictMessage(null);
        }
    }, [isOpen]);

    const handleStartRecording = useCallback((actionId: string) => {
        setRecordingActionId(actionId);
        setConflictMessage(null);
    }, []);

    const handleStopRecording = useCallback((hotkeyStr: string) => {
        if (!recordingActionId) return;

        if (!hotkeyStr) {
            // Cancelled (Esc)
            setRecordingActionId(null);
            return;
        }

        // Check for conflicts
        const conflict = findConflict(hotkeyStr, recordingActionId, customBindings);
        if (conflict) {
            setConflictMessage(
                `"${hotkeyToDisplayKeys(hotkeyStr).join(' + ')}" is already used by "${conflict.label}"`
            );
            setRecordingActionId(null);
            return;
        }

        // Check if new binding matches the default — if so, remove override
        const def = SHORTCUT_DEFINITIONS.find((d) => d.id === recordingActionId);
        if (def && hotkeyStr === def.defaultKey) {
            resetKeyBinding(recordingActionId);
        } else {
            updateKeyBinding(recordingActionId, hotkeyStr);
        }

        setRecordingActionId(null);
    }, [recordingActionId, customBindings, updateKeyBinding, resetKeyBinding]);

    const handleResetAll = useCallback(() => {
        resetAllKeyBindings();
        setConflictMessage(null);
    }, [resetAllKeyBindings]);

    const hasCustomBindings = Object.keys(customBindings).length > 0;

    if (!isOpen) return null;

    // Group definitions by category
    const grouped = new Map<string, ShortcutDefinition[]>();
    for (const cat of SHORTCUT_CATEGORIES) {
        grouped.set(cat.id, []);
    }
    for (const def of SHORTCUT_DEFINITIONS) {
        grouped.get(def.category)?.push(def);
    }

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={(e) => {
                if (e.target === e.currentTarget && !recordingActionId) {
                    onClose();
                }
            }}
        >
            <div className="bg-background border border-border rounded-lg shadow-xl w-full max-w-lg mx-4 max-h-[80vh] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-border">
                    <div className="flex items-center gap-3">
                        <Keyboard className="w-5 h-5 text-primary" />
                        <h2 className="text-lg font-semibold text-foreground">
                            Keyboard Shortcuts
                        </h2>
                    </div>
                    <div className="flex items-center gap-2">
                        {hasCustomBindings && (
                            <button
                                onClick={handleResetAll}
                                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded hover:bg-muted transition-colors text-muted-foreground"
                                title="Reset all shortcuts to defaults"
                            >
                                <RotateCcw className="w-3.5 h-3.5" />
                                Reset All
                            </button>
                        )}
                        <button
                            onClick={onClose}
                            className="p-1 rounded hover:bg-muted transition-colors"
                        >
                            <X className="w-5 h-5 text-muted-foreground" />
                        </button>
                    </div>
                </div>

                {/* Conflict warning */}
                {conflictMessage && (
                    <div className="mx-6 mt-3 px-3 py-2 bg-destructive/10 border border-destructive/30 rounded text-xs text-destructive">
                        {conflictMessage}
                    </div>
                )}

                {/* Content */}
                <div className="p-6 overflow-y-auto space-y-6">
                    {SHORTCUT_CATEGORIES.map((cat) => {
                        const shortcuts = grouped.get(cat.id) || [];
                        if (shortcuts.length === 0) return null;

                        return (
                            <div key={cat.id}>
                                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                                    {cat.label}
                                </h3>
                                <div className="space-y-1">
                                    {shortcuts.map((def) => (
                                        <ShortcutRow
                                            key={def.id}
                                            definition={def}
                                            customBindings={customBindings}
                                            isRecording={recordingActionId === def.id}
                                            onStartRecording={() => handleStartRecording(def.id)}
                                            onStopRecording={handleStopRecording}
                                            onReset={() => resetKeyBinding(def.id)}
                                        />
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-border">
                    <p className="text-xs text-muted-foreground text-center">
                        Click a shortcut to rebind it &middot; Press{' '}
                        <kbd className="px-1.5 py-0.5 text-xs font-mono bg-muted border border-border rounded">
                            Esc
                        </kbd>{' '}
                        to cancel &middot; Press{' '}
                        <kbd className="px-1.5 py-0.5 text-xs font-mono bg-muted border border-border rounded">
                            /
                        </kbd>{' '}
                        or{' '}
                        <kbd className="px-1.5 py-0.5 text-xs font-mono bg-muted border border-border rounded">
                            ?
                        </kbd>{' '}
                        anytime to toggle this dialog
                    </p>
                </div>
            </div>
        </div>
    );
}
