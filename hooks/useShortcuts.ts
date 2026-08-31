// ============================================
// ComposeYogi — Rebindable Keyboard Shortcuts Hook
// Wraps react-hotkeys-hook with centralized shortcut registry
// ============================================

import { useEffect, useCallback } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';
import { useUIStore, selectCustomKeyBindings, selectKeyBindingsLoaded, selectLivePlayOpen } from '@/lib/store';
import { isTypingKey } from '@/lib/music/typing-keys';
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

export interface ShortcutOptions {
    /**
     * Keep listening even while musical typing has the keyboard.
     *
     * Only for the toggle that turns musical typing *off*: it is bound to `K`,
     * which is a letter, and a rule with no exception would make the mode
     * impossible to leave with the key that entered it.
     */
    alwaysEnabled?: boolean;
}

/**
 * Register a rebindable keyboard shortcut.
 * Reads the effective key from the store (custom binding or default).
 *
 * **A shortcut whose key plays a note stands down while the live-play bar is
 * open.** `R`, `E`, `B`, `I`, `V` and `M` are each both a note and a command,
 * and no reading of a keypress satisfies both. `L` is not — the layout skips
 * it — so Toggle Loop goes on working, which is the kind of thing a hand-kept
 * list gets wrong and a derived check does not. The test is `isTypingKey` on
 * the *effective* binding rather than a list of the defaults,
 * for two reasons: a shortcut the user rebound onto a note key has to stand
 * down too, and one bound to a key the layout does not use — `K`, `A`, `P`, or
 * anything with a modifier — must go on working, because a mode you can enter
 * and not leave is worse than no mode at all.
 *
 * The decision lives here rather than at the fourteen call sites so that a
 * shortcut added later cannot forget it.
 *
 * @param actionId - The shortcut action id (e.g., 'playback.playPause')
 * @param callback - Handler function when the shortcut fires
 * @param deps - React dependency array for the callback
 */
export function useShortcut(
    actionId: string,
    callback: (e: KeyboardEvent) => void,
    deps: unknown[] = [],
    options: ShortcutOptions = {},
) {
    const customBindings = useUIStore(selectCustomKeyBindings);
    const livePlayOpen = useUIStore(selectLivePlayOpen);
    const effectiveKey = getEffectiveKey(actionId, customBindings);

    const surrendered =
        livePlayOpen && !options.alwaysEnabled && bindingPlaysANote(effectiveKey);
    const active = !!effectiveKey && !surrendered;

    // eslint-disable-next-line react-hooks/exhaustive-deps
    const stableCallback = useCallback(callback, deps);

    useHotkeys(
        effectiveKey || '__disabled__',
        (e) => {
            if (active) {
                stableCallback(e);
            }
        },
        { enableOnFormTags: false, enabled: active },
        [active, stableCallback],
    );
}

/**
 * Whether any of a binding's combos is a bare key the typing keyboard plays.
 *
 * A combo with a modifier never is — nothing plays a note with ⌘ or ⌥ held, so
 * undo, redo and reset-zoom are untouched. Named keys (`space`, `enter`,
 * `slash`, `equal`) are not typing keys either, which is why the check is
 * against the layout rather than against a combo's length.
 */
export function bindingPlaysANote(key: string): boolean {
    return key
        .split(',')
        .map((combo) => combo.trim())
        .filter(Boolean)
        .some((combo) => !combo.includes('+') && isTypingKey(combo));
}
