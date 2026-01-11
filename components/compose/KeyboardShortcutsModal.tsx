'use client';

import { useEffect } from 'react';
import { X, Keyboard } from 'lucide-react';

interface KeyboardShortcutsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const SHORTCUTS = [
    {
        category: 'Playback',
        shortcuts: [
            { keys: ['Space'], description: 'Play / Pause' },
            { keys: ['Enter'], description: 'Stop and return to start' },
            { keys: ['M'], description: 'Toggle metronome' },
        ],
    },
    {
        category: 'Editing',
        shortcuts: [
            { keys: ['⌘', 'Z'], description: 'Undo' },
            { keys: ['⌘', '⇧', 'Z'], description: 'Redo' },
            { keys: ['Delete'], description: 'Delete selected clips' },
            { keys: ['⌘', 'A'], description: 'Select all clips' },
            { keys: ['⇧', 'Click'], description: 'Multi-select clips' },
            { keys: ['⌥', 'Drag'], description: 'Duplicate clip' },
        ],
    },
    {
        category: 'View',
        shortcuts: [
            { keys: ['B'], description: 'Toggle browser panel' },
            { keys: ['I'], description: 'Toggle inspector panel' },
            { keys: ['E'], description: 'Toggle editor panel' },
            { keys: ['V'], description: 'Toggle visualizer' },
            { keys: ['+'], description: 'Zoom in' },
            { keys: ['-'], description: 'Zoom out' },
            { keys: ['⌘', '0'], description: 'Reset zoom' },
        ],
    },
    {
        category: 'Navigation',
        shortcuts: [
            { keys: ['Click Ruler'], description: 'Seek to position' },
            { keys: ['Scroll'], description: 'Navigate timeline' },
        ],
    },
];

export function KeyboardShortcutsModal({ isOpen, onClose }: KeyboardShortcutsModalProps) {
    // Close on Escape key
    useEffect(() => {
        if (!isOpen) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={(e) => {
                // Close when clicking backdrop
                if (e.target === e.currentTarget) {
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
                    <button
                        onClick={onClose}
                        className="p-1 rounded hover:bg-muted transition-colors"
                    >
                        <X className="w-5 h-5 text-muted-foreground" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto space-y-6">
                    {SHORTCUTS.map((category) => (
                        <div key={category.category}>
                            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                                {category.category}
                            </h3>
                            <div className="space-y-2">
                                {category.shortcuts.map((shortcut, index) => (
                                    <div
                                        key={index}
                                        className="flex items-center justify-between py-1.5"
                                    >
                                        <span className="text-sm text-foreground">
                                            {shortcut.description}
                                        </span>
                                        <div className="flex items-center gap-1">
                                            {shortcut.keys.map((key, keyIndex) => (
                                                <kbd
                                                    key={keyIndex}
                                                    className="px-2 py-1 text-xs font-mono bg-muted border border-border rounded text-muted-foreground"
                                                >
                                                    {key}
                                                </kbd>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-border">
                    <p className="text-xs text-muted-foreground text-center">
                        Press <kbd className="px-1.5 py-0.5 text-xs font-mono bg-muted border border-border rounded">/</kbd> or <kbd className="px-1.5 py-0.5 text-xs font-mono bg-muted border border-border rounded">?</kbd> anytime to show this dialog
                    </p>
                </div>
            </div>
        </div>
    );
}
