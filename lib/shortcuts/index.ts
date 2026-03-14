// ============================================
// ComposeYogi — Keyboard Shortcuts Registry
// Centralized shortcut definitions with rebinding support
// ============================================

import { getSetting, setSetting } from '@/lib/persistence';
import { createLogger } from '@/lib/logger';

const logger = createLogger('Shortcuts');

// ============================================
// Types
// ============================================

export type ShortcutCategory = 'playback' | 'editing' | 'view' | 'navigation';

export interface ShortcutDefinition {
    /** Unique action identifier */
    id: string;
    /** Display label for the shortcut */
    label: string;
    /** Category for grouping in the modal */
    category: ShortcutCategory;
    /** Default hotkey string (react-hotkeys-hook format) */
    defaultKey: string;
    /** Whether this shortcut can be rebound by the user */
    rebindable: boolean;
    /** Display-friendly key labels (e.g., ['⌘', 'Z']) — derived from hotkey string */
    displayKeys?: string[];
}

/** User's custom key bindings: action id → hotkey string */
export type KeyBindings = Record<string, string>;

// ============================================
// Shortcut Definitions
// ============================================

export const SHORTCUT_DEFINITIONS: ShortcutDefinition[] = [
    // Playback
    {
        id: 'playback.playPause',
        label: 'Play / Pause',
        category: 'playback',
        defaultKey: 'space',
        rebindable: true,
    },
    {
        id: 'playback.stop',
        label: 'Stop and return to start',
        category: 'playback',
        defaultKey: 'enter',
        rebindable: true,
    },

    // Editing
    {
        id: 'editing.undo',
        label: 'Undo',
        category: 'editing',
        defaultKey: 'mod+z',
        rebindable: true,
    },
    {
        id: 'editing.redo',
        label: 'Redo',
        category: 'editing',
        defaultKey: 'mod+shift+z',
        rebindable: true,
    },
    {
        id: 'editing.delete',
        label: 'Delete selected clips',
        category: 'editing',
        defaultKey: 'delete, backspace',
        rebindable: true,
    },

    // View
    {
        id: 'view.toggleBrowser',
        label: 'Toggle browser panel',
        category: 'view',
        defaultKey: 'b',
        rebindable: true,
    },
    {
        id: 'view.toggleInspector',
        label: 'Toggle inspector panel',
        category: 'view',
        defaultKey: 'i',
        rebindable: true,
    },
    {
        id: 'view.toggleEditor',
        label: 'Toggle editor panel',
        category: 'view',
        defaultKey: 'e',
        rebindable: true,
    },
    {
        id: 'view.toggleVisualizer',
        label: 'Toggle visualizer',
        category: 'view',
        defaultKey: 'v',
        rebindable: true,
    },
    {
        id: 'view.zoomIn',
        label: 'Zoom in',
        category: 'view',
        defaultKey: 'equal',
        rebindable: true,
    },
    {
        id: 'view.zoomOut',
        label: 'Zoom out',
        category: 'view',
        defaultKey: 'minus',
        rebindable: true,
    },
    {
        id: 'view.resetZoom',
        label: 'Reset zoom',
        category: 'view',
        defaultKey: 'mod+0',
        rebindable: true,
    },
    {
        id: 'view.showShortcuts',
        label: 'Show keyboard shortcuts',
        category: 'view',
        defaultKey: 'slash',
        rebindable: true,
    },

    // Navigation (display-only, not rebindable — mouse/gesture actions)
    {
        id: 'navigation.seekPosition',
        label: 'Seek to position',
        category: 'navigation',
        defaultKey: '',
        rebindable: false,
        displayKeys: ['Click Ruler'],
    },
    {
        id: 'navigation.scrollTimeline',
        label: 'Navigate timeline',
        category: 'navigation',
        defaultKey: '',
        rebindable: false,
        displayKeys: ['Scroll'],
    },
    {
        id: 'editing.multiSelect',
        label: 'Multi-select clips',
        category: 'editing',
        defaultKey: '',
        rebindable: false,
        displayKeys: ['⇧', 'Click'],
    },
    {
        id: 'editing.duplicateClip',
        label: 'Duplicate clip',
        category: 'editing',
        defaultKey: '',
        rebindable: false,
        displayKeys: ['⌥', 'Drag'],
    },
];

// Build a lookup map for fast access
const definitionMap = new Map<string, ShortcutDefinition>();
for (const def of SHORTCUT_DEFINITIONS) {
    definitionMap.set(def.id, def);
}

// ============================================
// Category Display Info
// ============================================

export const SHORTCUT_CATEGORIES: { id: ShortcutCategory; label: string }[] = [
    { id: 'playback', label: 'Playback' },
    { id: 'editing', label: 'Editing' },
    { id: 'view', label: 'View' },
    { id: 'navigation', label: 'Navigation' },
];

// ============================================
// Helpers
// ============================================

/** Get the shortcut definition by action id */
export function getShortcutDefinition(id: string): ShortcutDefinition | undefined {
    return definitionMap.get(id);
}

/** Get the effective hotkey string for an action (custom or default) */
export function getEffectiveKey(id: string, customBindings: KeyBindings): string {
    return customBindings[id] ?? (definitionMap.get(id)?.defaultKey ?? '');
}

/** Get all shortcuts grouped by category */
export function getShortcutsByCategory(): Map<ShortcutCategory, ShortcutDefinition[]> {
    const grouped = new Map<ShortcutCategory, ShortcutDefinition[]>();
    for (const cat of SHORTCUT_CATEGORIES) {
        grouped.set(cat.id, []);
    }
    for (const def of SHORTCUT_DEFINITIONS) {
        grouped.get(def.category)?.push(def);
    }
    return grouped;
}

/** Build default bindings map (all defaults, no overrides) */
export function getDefaultBindings(): KeyBindings {
    const bindings: KeyBindings = {};
    for (const def of SHORTCUT_DEFINITIONS) {
        if (def.defaultKey) {
            bindings[def.id] = def.defaultKey;
        }
    }
    return bindings;
}

// ============================================
// Hotkey String ↔ Display Conversion
// ============================================

const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);

/** Convert a react-hotkeys-hook key string to display-friendly key labels */
export function hotkeyToDisplayKeys(hotkeyStr: string): string[] {
    if (!hotkeyStr) return [];

    // Take the first combo if multiple (e.g., "delete, backspace" → "delete")
    const primary = hotkeyStr.split(',')[0].trim();
    const parts = primary.split('+');

    return parts.map((part) => {
        const p = part.trim().toLowerCase();
        switch (p) {
            case 'mod': return isMac ? '⌘' : 'Ctrl';
            case 'shift': return isMac ? '⇧' : 'Shift';
            case 'alt': return isMac ? '⌥' : 'Alt';
            case 'ctrl': return 'Ctrl';
            case 'meta': return isMac ? '⌘' : 'Win';
            case 'space': return 'Space';
            case 'enter': return 'Enter';
            case 'delete': return 'Delete';
            case 'backspace': return '⌫';
            case 'escape': return 'Esc';
            case 'arrowup': return '↑';
            case 'arrowdown': return '↓';
            case 'arrowleft': return '←';
            case 'arrowright': return '→';
            case 'equal': return '+';
            case 'minus': return '-';
            case 'slash': return '/';
            default: return p.length === 1 ? p.toUpperCase() : p.charAt(0).toUpperCase() + p.slice(1);
        }
    });
}

/** Convert a KeyboardEvent to a react-hotkeys-hook compatible string */
export function keyboardEventToHotkeyString(e: KeyboardEvent): string {
    const parts: string[] = [];

    // Modifiers first
    if (e.metaKey || e.ctrlKey) parts.push('mod');
    if (e.shiftKey) parts.push('shift');
    if (e.altKey) parts.push('alt');

    // Main key
    const key = e.key.toLowerCase();
    // Skip if the key is just a modifier
    if (['control', 'shift', 'alt', 'meta'].includes(key)) {
        return '';
    }

    // Map some key names
    switch (key) {
        case ' ': parts.push('space'); break;
        case '=': parts.push('equal'); break;
        case '-': parts.push('minus'); break;
        case '/': parts.push('slash'); break;
        case 'delete': parts.push('delete'); break;
        case 'backspace': parts.push('backspace'); break;
        case 'enter': parts.push('enter'); break;
        case 'escape': parts.push('escape'); break;
        case 'arrowup': parts.push('arrowup'); break;
        case 'arrowdown': parts.push('arrowdown'); break;
        case 'arrowleft': parts.push('arrowleft'); break;
        case 'arrowright': parts.push('arrowright'); break;
        default:
            // For letter/number keys, use the key value directly
            if (e.code.startsWith('Key')) {
                parts.push(e.code.slice(3).toLowerCase());
            } else if (e.code.startsWith('Digit')) {
                parts.push(e.code.slice(5));
            } else {
                parts.push(key);
            }
    }

    return parts.join('+');
}

// ============================================
// Persistence
// ============================================

const SETTINGS_KEY = 'keyboardShortcuts';

/** Load custom key bindings from IndexedDB */
export async function loadCustomBindings(): Promise<KeyBindings> {
    try {
        const saved = await getSetting<KeyBindings>(SETTINGS_KEY, {});
        logger.debug('Loaded custom key bindings', { count: Object.keys(saved).length });
        return saved;
    } catch (err) {
        logger.error('Failed to load custom key bindings', err);
        return {};
    }
}

/** Save custom key bindings to IndexedDB */
export async function saveCustomBindings(bindings: KeyBindings): Promise<void> {
    try {
        await setSetting(SETTINGS_KEY, bindings);
        logger.debug('Saved custom key bindings', { count: Object.keys(bindings).length });
    } catch (err) {
        logger.error('Failed to save custom key bindings', err);
    }
}

/** Check if a hotkey string conflicts with another shortcut */
export function findConflict(
    hotkeyStr: string,
    actionId: string,
    customBindings: KeyBindings,
): ShortcutDefinition | null {
    if (!hotkeyStr) return null;

    const normalized = hotkeyStr.toLowerCase().trim();

    for (const def of SHORTCUT_DEFINITIONS) {
        if (def.id === actionId) continue;
        if (!def.defaultKey && !customBindings[def.id]) continue;

        const effectiveKey = getEffectiveKey(def.id, customBindings);
        // Check each combo in multi-key shortcuts (e.g., "delete, backspace")
        const combos = effectiveKey.split(',').map((s) => s.trim().toLowerCase());
        const newCombos = normalized.split(',').map((s) => s.trim().toLowerCase());

        for (const combo of newCombos) {
            if (combos.includes(combo)) {
                return def;
            }
        }
    }

    return null;
}
