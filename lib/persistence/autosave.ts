/**
 * ComposeYogi Autosave System
 * 
 * Automatically saves project changes to IndexedDB with debouncing.
 * Shows save status in UI.
 */

import { saveProject, saveAudioTake } from './db';
import type { Project, AudioTake } from '@/types';
import { createLogger } from '@/lib/logger';

const logger = createLogger('Autosave');

// ============================================
// Types
// ============================================

export type SaveStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'error';

export interface AutosaveOptions {
    debounceMs?: number;
    onStatusChange?: (status: SaveStatus) => void;
    onError?: (error: Error) => void;
}

// ============================================
// Autosave Manager
// ============================================

class AutosaveManager {
    private debounceMs: number = 3000; // 3 seconds
    private status: SaveStatus = 'idle';
    private pendingProject: Project | null = null;
    private pendingAudioTakes: Map<string, AudioTake> = new Map();
    private debounceTimer: ReturnType<typeof setTimeout> | null = null;
    private statusListeners: Set<(status: SaveStatus) => void> = new Set();
    private errorListeners: Set<(error: Error) => void> = new Set();
    private lastSavedAt: number = 0;

    configure(options: AutosaveOptions) {
        if (options.debounceMs !== undefined) {
            this.debounceMs = options.debounceMs;
        }
        if (options.onStatusChange) {
            this.statusListeners.add(options.onStatusChange);
        }
        if (options.onError) {
            this.errorListeners.add(options.onError);
        }
    }

    removeListeners(options: AutosaveOptions) {
        if (options.onStatusChange) {
            this.statusListeners.delete(options.onStatusChange);
        }
        if (options.onError) {
            this.errorListeners.delete(options.onError);
        }
    }

    private setStatus(status: SaveStatus) {
        this.status = status;
        this.statusListeners.forEach((listener) => listener(status));
    }

    private notifyError(error: Error) {
        this.errorListeners.forEach((listener) => listener(error));
    }

    /**
     * Schedule a project save with debouncing
     */
    scheduleProjectSave(project: Project) {
        this.pendingProject = project;
        this.setStatus('pending');
        this.scheduleSave();
    }

    /**
     * Schedule an audio take save (immediate, no debounce for audio data)
     */
    async saveAudioTakeImmediate(take: AudioTake): Promise<void> {
        try {
            await saveAudioTake(take);
            logger.debug('Audio take saved immediately', { takeId: take.id });
        } catch (error) {
            logger.error('Failed to save audio take', error);
            this.notifyError(error instanceof Error ? error : new Error('Failed to save audio'));
        }
    }

    /**
     * Queue an audio take to be saved with the next project save
     */
    queueAudioTakeSave(take: AudioTake) {
        this.pendingAudioTakes.set(take.id, take);
        this.setStatus('pending');
        this.scheduleSave();
    }

    private scheduleSave() {
        // Clear existing timer
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }

        // Schedule new save
        this.debounceTimer = setTimeout(() => {
            this.executeSave();
        }, this.debounceMs);
    }

    private async executeSave() {
        if (!this.pendingProject && this.pendingAudioTakes.size === 0) {
            this.setStatus('idle');
            return;
        }

        this.setStatus('saving');

        try {
            // Save audio takes first (they might be referenced by clips)
            for (const take of this.pendingAudioTakes.values()) {
                await saveAudioTake(take);
            }
            this.pendingAudioTakes.clear();

            // Save project
            if (this.pendingProject) {
                await saveProject(this.pendingProject);
                this.pendingProject = null;
            }

            this.lastSavedAt = Date.now();
            this.setStatus('saved');
            logger.debug('Project autosaved successfully');

            // Reset to idle after showing "saved" briefly
            setTimeout(() => {
                if (this.status === 'saved') {
                    this.setStatus('idle');
                }
            }, 2000);

        } catch (error) {
            logger.error('Autosave failed', error);
            this.setStatus('error');
            this.notifyError(error instanceof Error ? error : new Error('Save failed'));
        }
    }

    /**
     * Force immediate save (e.g., before navigating away)
     */
    async saveNow(): Promise<void> {
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
            this.debounceTimer = null;
        }
        await this.executeSave();
    }

    /**
     * Cancel pending save
     */
    cancel() {
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
            this.debounceTimer = null;
        }
        this.pendingProject = null;
        this.pendingAudioTakes.clear();
        this.setStatus('idle');
    }

    getStatus(): SaveStatus {
        return this.status;
    }

    getLastSavedAt(): number {
        return this.lastSavedAt;
    }

    hasPendingChanges(): boolean {
        return this.pendingProject !== null || this.pendingAudioTakes.size > 0;
    }
}

// ============================================
// Singleton Instance
// ============================================

export const autosaveManager = new AutosaveManager();

// ============================================
// Exports
// ============================================

export { AutosaveManager };
