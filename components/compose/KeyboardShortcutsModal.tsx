'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { Keyboard, RotateCcw } from 'lucide-react';
import { useUIStore, selectCustomKeyBindings } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
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
    const t = useTranslations('shortcuts');
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
                    {t(`actions.${definition.id}`)}
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
                {t(`actions.${definition.id}`)}
            </span>
            <div className="flex items-center gap-2">
                {/* Reset button (only visible for customized shortcuts) */}
                {isCustomized && !isRecording && (
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon"
                                aria-label={t('resetToDefault')}
                                onClick={onReset}
                                className="h-6 w-6 opacity-0 group-hover:opacity-100"
                            >
                                <RotateCcw className="w-3 h-3 text-muted-foreground" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>{t('resetToDefault')}</TooltipContent>
                    </Tooltip>
                )}

                {/* Key binding display / recording button. Deliberately a raw
                    <button>: it renders key caps, and <Button>'s variants would
                    fight every one of the recording/customised states below. */}
                <Tooltip>
                <TooltipTrigger asChild>
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
                    aria-label={isRecording ? t('recordingHint') : t('clickToRebind')}
                >
                    {isRecording ? (
                        <span className="text-xs text-primary font-medium">
                            {t('pressKeys')}
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
                </TooltipTrigger>
                <TooltipContent>
                    {isRecording ? t('recordingHint') : t('clickToRebind')}
                </TooltipContent>
                </Tooltip>
            </div>
        </div>
    );
}

// ============================================
// Main Modal Component
// ============================================

export function KeyboardShortcutsModal({ isOpen, onClose }: KeyboardShortcutsModalProps) {
    const t = useTranslations('shortcuts');
    const customBindings = useUIStore(selectCustomKeyBindings);
    const updateKeyBinding = useUIStore((s) => s.updateKeyBinding);
    const resetKeyBinding = useUIStore((s) => s.resetKeyBinding);
    const resetAllKeyBindings = useUIStore((s) => s.resetAllKeyBindings);

    const [recordingActionId, setRecordingActionId] = useState<string | null>(null);
    const [conflictMessage, setConflictMessage] = useState<string | null>(null);

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
                t('conflictWith', {
                    keys: hotkeyToDisplayKeys(hotkeyStr).join(' + '),
                    action: t(`actions.${conflict.id}`),
                })
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
    }, [recordingActionId, customBindings, updateKeyBinding, resetKeyBinding, t]);

    const handleResetAll = useCallback(() => {
        resetAllKeyBindings();
        setConflictMessage(null);
    }, [resetAllKeyBindings]);

    const hasCustomBindings = Object.keys(customBindings).length > 0;

    // Group definitions by category
    const grouped = new Map<string, ShortcutDefinition[]>();
    for (const cat of SHORTCUT_CATEGORIES) {
        grouped.set(cat.id, []);
    }
    for (const def of SHORTCUT_DEFINITIONS) {
        grouped.get(def.category)?.push(def);
    }

    // While a key is being recorded, Escape and a click outside both belong to
    // the rebind — Escape cancels it, and the footer says so. Radix would
    // otherwise close the whole dialog out from under the gesture.
    const busyRebinding = (event: Event) => {
        if (recordingActionId) event.preventDefault();
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent
                className="flex max-h-[80vh] flex-col sm:max-w-lg"
                onEscapeKeyDown={busyRebinding}
                onPointerDownOutside={busyRebinding}
                onInteractOutside={busyRebinding}
            >
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Keyboard className="h-5 w-5" />
                        {t('title')}
                    </DialogTitle>
                    {/* The how-to-use line reads as the dialog's description, which
                        is where every other modal here puts it — it used to sit in
                        a footer of its own. */}
                    <DialogDescription>
                        {t.rich('footer', {
                            kbd: (chunks) => (
                                <kbd className="px-1.5 py-0.5 text-xs font-mono bg-muted border border-border rounded">
                                    {chunks}
                                </kbd>
                            ),
                        })}
                    </DialogDescription>
                </DialogHeader>

                {/* Conflict warning */}
                {conflictMessage && (
                    <div className="px-3 py-2 bg-destructive/10 border border-destructive/30 rounded text-xs text-destructive">
                        {conflictMessage}
                    </div>
                )}

                {/* Content */}
                <div className="-mx-6 overflow-y-auto px-6 space-y-6">
                    {SHORTCUT_CATEGORIES.map((cat) => {
                        const shortcuts = grouped.get(cat.id) || [];
                        if (shortcuts.length === 0) return null;

                        return (
                            <div key={cat.id}>
                                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                                    {t(`categories.${cat.id}`)}
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

                {hasCustomBindings && (
                    <DialogFooter>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={handleResetAll}
                                    className="text-muted-foreground"
                                >
                                    <RotateCcw className="h-3.5 w-3.5" />
                                    {t('resetAll')}
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>{t('resetAllHint')}</TooltipContent>
                        </Tooltip>
                    </DialogFooter>
                )}
            </DialogContent>
        </Dialog>
    );
}
