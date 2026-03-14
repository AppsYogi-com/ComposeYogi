// ============================================
// ComposeYogi — Rebindable Keyboard Shortcuts Hook
// Wraps react-hotkeys-hook with centralized shortcut registry
// ============================================

import { useEffect, useCallback } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';
import { useUIStore, selectCustomKeyBindings, selectKeyBindingsLoaded } from '@/lib/store';
import { getEffectiveKey, loadCustomBindings, saveCustomBindings } from '@/lib/shortcuts';
import { createLogger } from '@/lib/logger';

const logger = createLogger('useShortcuts');

// ============================================
// Hook to load key bindings from IndexedDB on mount
// ============================================

export function useLoadKeyBindings() {
    const setCustomKeyBindings = useUIStore((s) => s.setCustomKeyBindings);

    useEffect(() => {
        loadCustomBindings().then((bindings) => {
            setCustomKeyBindings(bindings);
            logger.debug('Key bindings loaded into store', { count: Object.keys(bindings).length });
        });
    }, [setCustomKeyBindings]);
}

// ============================================
// Hook to persist key bindings when they change
// ============================================

export function usePersistKeyBindings() {
    const customKeyBindings = useUIStore(selectCustomKeyBindings);
    const loaded = useUIStore(selectKeyBindingsLoaded);

    useEffect(() => {
        // Don't save until initial load completes (avoid overwriting with empty object)
        if (!loaded) return;
        saveCustomBindings(customKeyBindings);
    }, [customKeyBindings, loaded]);
}

// ============================================
// Hook for a single rebindable shortcut
// ============================================

/**
 * Register a rebindable keyboard shortcut.
 * Reads the effective key from the store (custom binding or default).
 *
 * @param actionId - The shortcut action id (e.g., 'playback.playPause')
 * @param callback - Handler function when the shortcut fires
 * @param deps - React dependency array for the callback
 */
export function useShortcut(
    actionId: string,
    callback: (e: KeyboardEvent) => void,
    deps: unknown[] = [],
) {
    const customBindings = useUIStore(selectCustomKeyBindings);
    const effectiveKey = getEffectiveKey(actionId, customBindings);

    // eslint-disable-next-line react-hooks/exhaustive-deps
    const stableCallback = useCallback(callback, deps);

    useHotkeys(
        effectiveKey || '__disabled__',
        (e) => {
            if (effectiveKey) {
                stableCallback(e);
            }
        },
        { enableOnFormTags: false, enabled: !!effectiveKey },
        [effectiveKey, stableCallback],
    );
}
