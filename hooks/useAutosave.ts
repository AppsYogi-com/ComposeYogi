/**
 * useAutosave Hook
 * 
 * Provides autosave functionality and status for React components.
 */

'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { autosaveManager, projectSaveSignature, SaveStatus } from '@/lib/persistence/autosave';
import { useProjectStore } from '@/lib/store';

interface UseAutosaveOptions {
    enabled?: boolean;
    debounceMs?: number;
}

interface UseAutosaveReturn {
    status: SaveStatus;
    lastSavedAt: number | null;
    hasPendingChanges: boolean;
    saveNow: () => Promise<void>;
    statusText: string;
}

export function useAutosave(options: UseAutosaveOptions = {}): UseAutosaveReturn {
    const { enabled = true, debounceMs = 3000 } = options;

    const [status, setStatus] = useState<SaveStatus>('idle');
    const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
    const previousProjectRef = useRef<string | null>(null);

    const project = useProjectStore((s) => s.project);

    // Configure autosave manager
    useEffect(() => {
        const handleStatusChange = (newStatus: SaveStatus) => {
            setStatus(newStatus);
            if (newStatus === 'saved') {
                setLastSavedAt(Date.now());
            }
        };

        const handleError = (error: Error) => {
            console.error('[useAutosave] Error:', error.message);
        };

        autosaveManager.configure({
            debounceMs,
            onStatusChange: handleStatusChange,
            onError: handleError,
        });

        return () => {
            autosaveManager.removeListeners({
                onStatusChange: handleStatusChange,
                onError: handleError,
            });
        };
    }, [debounceMs]);

    // Watch for project changes and trigger autosave
    useEffect(() => {
        if (!enabled || !project) return;

        // Derived from the project, never a list of its fields — see
        // projectSaveSignature. A field missing from the old hand-written list
        // was simply never saved, with nothing anywhere to say so.
        const projectJson = projectSaveSignature(project);

        // Skip if project hasn't actually changed
        if (projectJson === previousProjectRef.current) {
            return;
        }

        previousProjectRef.current = projectJson;

        // Don't save on first render (initial load)
        if (lastSavedAt === null && status === 'idle') {
            setLastSavedAt(project.updatedAt || Date.now());
            return;
        }

        // Schedule autosave
        autosaveManager.scheduleProjectSave(project);
    }, [project, enabled, lastSavedAt, status]);

    // Save before page unload
    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (autosaveManager.hasPendingChanges()) {
                // Try to save (might not complete)
                autosaveManager.saveNow();

                // Show browser warning
                e.preventDefault();
                e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
                return e.returnValue;
            }
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, []);

    const saveNow = useCallback(async () => {
        if (project) {
            autosaveManager.scheduleProjectSave(project);
            await autosaveManager.saveNow();
        }
    }, [project]);

    const hasPendingChanges = autosaveManager.hasPendingChanges();

    // Human-readable status text
    const statusText = (() => {
        switch (status) {
            case 'pending':
                return 'Unsaved changes';
            case 'saving':
                return 'Saving...';
            case 'saved':
                return 'Saved';
            case 'error':
                return 'Save failed';
            default:
                return lastSavedAt ? 'All changes saved' : '';
        }
    })();

    return {
        status,
        lastSavedAt,
        hasPendingChanges,
        saveNow,
        statusText,
    };
}
