'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import {
    LayoutTemplate,
    Piano,
    Music,
    Sparkles,
    ChevronRight,
    ChevronDown,
    Search,
    PlusCircle,
    GripVertical,
    Play,
    Trash2,
    Upload,
    Loader2,
    FolderOpen,
    Copy,
    Pencil,
    FileJson,
    MoreHorizontal,
    AudioLines,
} from 'lucide-react';
import { useUIStore, useProjectStore } from '@/lib/store';
import { TRACK_BG } from '@/lib/design/track-colors';
import { Button, Input } from '@/components/ui';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { buttonVariants } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { getDemoNotesForInstrument } from '@/lib/browser/demo-notes';
import { InstrumentEditor } from './InstrumentEditor';
import {
    TEMPLATES,
    INSTRUMENTS,
    SAMPLE_FOLDERS,
    FX_PRESETS,
    INSTRUMENT_CATEGORIES,
    FX_CATEGORIES,
    type BrowserTab,
    type TemplateItem,
    type InstrumentItem,
    type SampleFolder,
    type SampleItem,
    type FXPreset,
} from '@/lib/browser';
import {
    importAudioFile,
    getUserSamples,
    removeUserSample,
    createSamplePreviewUrl,
    SUPPORTED_EXTENSIONS,
    INSTRUMENT_FILE_EXTENSION,
    downloadInstrument,
    draftFromPreset,
    duplicateCustomInstrument,
    importInstrumentFromFile,
    isCustomizablePreset,
    removeCustomInstrument,
    saveCustomInstrument,
    useCustomInstruments,
} from '@/lib/audio';
import type { CustomInstrument, UserSample } from '@/types';
import { createLogger } from '@/lib/logger';
import { toast } from 'sonner';

const log = createLogger('BrowserPanel');

// ============================================
// Tab Configuration
// ============================================

// Tab ids only — labels come from `browser.tabs.*` so they follow the locale.
const TABS: { id: BrowserTab; icon: typeof LayoutTemplate }[] = [
    { id: 'templates', icon: LayoutTemplate },
    { id: 'instruments', icon: Piano },
    { id: 'samples', icon: Music },
    { id: 'fx', icon: Sparkles },
];

// ============================================
// Helper Functions
// ============================================

// ============================================
// BrowserPanel Component
// ============================================

export function BrowserPanel() {
    const t = useTranslations('browser');
    const tCommon = useTranslations('common');
    const [activeTab, setActiveTab] = useState<BrowserTab>('templates');
    const [searchQuery, setSearchQuery] = useState('');
    const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(['drums', 'user-samples']));
    const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['synth', 'reverb']));

    // User samples state
    const [userSamples, setUserSamples] = useState<UserSample[]>([]);
    const [isImporting, setIsImporting] = useState(false);
    const [previewingId, setPreviewingId] = useState<string | null>(null);
    const [sampleToDelete, setSampleToDelete] = useState<UserSample | null>(null);

    // Custom instruments (#21). The list comes from the registry rather than
    // local state — the scheduler reads the same registry, so a panel showing
    // something the audio engine does not have would be a lie by construction.
    const customInstruments = useCustomInstruments();
    const [editingInstrument, setEditingInstrument] = useState<CustomInstrument | null>(null);
    const [instrumentToDelete, setInstrumentToDelete] = useState<CustomInstrument | null>(null);
    const instrumentFileInputRef = useRef<HTMLInputElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const previewAudioRef = useRef<HTMLAudioElement | null>(null);

    const toggleBrowser = useUIStore((s) => s.toggleBrowser);
    const createProject = useProjectStore((s) => s.createProject);
    const addTrack = useProjectStore((s) => s.addTrack);
    const updateTrack = useProjectStore((s) => s.updateTrack);
    const addClip = useProjectStore((s) => s.addClip);
    const updateClip = useProjectStore((s) => s.updateClip);
    const addNote = useProjectStore((s) => s.addNote);
    const selectClip = useUIStore((s) => s.selectClip);
    const openEditor = useUIStore((s) => s.openEditor);

    const loadUserSamples = useCallback(async () => {
        try {
            const samples = await getUserSamples();
            setUserSamples(samples);
        } catch (error) {
            log.error('Failed to load user samples', error);
        }
    }, []);

    // Load user samples on mount
    useEffect(() => {
        loadUserSamples();
    }, [loadUserSamples]);

    const toggleFolder = useCallback((folderId: string) => {
        setExpandedFolders((prev) => {
            const next = new Set(prev);
            if (next.has(folderId)) {
                next.delete(folderId);
            } else {
                next.add(folderId);
            }
            return next;
        });
    }, []);

    const toggleCategory = useCallback((categoryId: string) => {
        setExpandedCategories((prev) => {
            const next = new Set(prev);
            if (next.has(categoryId)) {
                next.delete(categoryId);
            } else {
                next.add(categoryId);
            }
            return next;
        });
    }, []);

    // ========================================
    // Drag Handlers
    // ========================================

    const handleInstrumentDrag = useCallback((e: React.DragEvent, instrument: InstrumentItem) => {
        e.dataTransfer.setData('application/json', JSON.stringify({
            type: 'instrument',
            data: instrument,
        }));
        e.dataTransfer.effectAllowed = 'copy';
    }, []);

    const handleSampleDrag = useCallback((e: React.DragEvent, sample: SampleItem, folder: SampleFolder) => {
        e.dataTransfer.setData('application/json', JSON.stringify({
            type: 'sample',
            data: { ...sample, folderId: folder.id },
        }));
        e.dataTransfer.effectAllowed = 'copy';
    }, []);

    const handleSampleClick = useCallback((sample: SampleItem) => {
        const audio = new Audio(sample.url);
        audio.play().catch(err => console.error('Failed to play preview:', err));
    }, []);

    const handleFXDrag = useCallback((e: React.DragEvent, fx: FXPreset) => {
        e.dataTransfer.setData('application/json', JSON.stringify({
            type: 'fx',
            data: fx,
        }));
        e.dataTransfer.effectAllowed = 'copy';
    }, []);

    // ========================================
    // User Sample Handlers
    // ========================================

    const handleImportClick = useCallback(() => {
        fileInputRef.current?.click();
    }, []);

    const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        setIsImporting(true);

        try {
            for (const file of Array.from(files)) {
                try {
                    await importAudioFile(file, {
                        onProgress: (progress) => {
                            log.debug('Import progress', { stage: progress.stage, progress: progress.progress });
                        },
                    });
                    toast.success(t('toast.imported', { name: file.name }));
                } catch (error) {
                    const message = error instanceof Error ? error.message : t('toast.unknownError');
                    toast.error(t('toast.importFailed', { name: file.name, message }));
                    log.error('Import failed', { file: file.name, error });
                }
            }
            // Reload samples list
            await loadUserSamples();
        } finally {
            setIsImporting(false);
            // Reset file input
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    }, [loadUserSamples, t]);

    const handleUserSampleDrag = useCallback((e: React.DragEvent, sample: UserSample) => {
        e.dataTransfer.setData('application/json', JSON.stringify({
            type: 'user-sample',
            data: {
                id: sample.id,
                name: sample.name,
                duration: sample.duration,
                sampleRate: sample.sampleRate,
            },
        }));
        e.dataTransfer.effectAllowed = 'copy';
    }, []);

    const handleUserSampleClick = useCallback((sample: UserSample) => {
        // Stop any currently playing preview
        if (previewAudioRef.current) {
            previewAudioRef.current.pause();
            previewAudioRef.current = null;
        }

        // If clicking the same sample that's playing, just stop it
        if (previewingId === sample.id) {
            setPreviewingId(null);
            return;
        }

        // Create and play preview
        const url = createSamplePreviewUrl(sample);
        const audio = new Audio(url);
        previewAudioRef.current = audio;
        setPreviewingId(sample.id);

        audio.onended = () => {
            URL.revokeObjectURL(url);
            setPreviewingId(null);
            previewAudioRef.current = null;
        };

        audio.onerror = () => {
            URL.revokeObjectURL(url);
            setPreviewingId(null);
            previewAudioRef.current = null;
            toast.error(t('toast.playFailed'));
        };

        audio.play().catch((err) => {
            log.error('Failed to play preview', err);
            URL.revokeObjectURL(url);
            setPreviewingId(null);
        });
    }, [previewingId, t]);

    // Deleting a sample asks first, through the app's own AlertDialog rather
    // than window.confirm — a browser confirm is chrome the design system has no
    // say over, and it looks like a different application.
    const handleDeleteUserSample = useCallback((e: React.MouseEvent, sample: UserSample) => {
        e.stopPropagation();
        setSampleToDelete(sample);
    }, []);

    const confirmDeleteUserSample = useCallback(async () => {
        const sample = sampleToDelete;
        if (!sample) return;
        setSampleToDelete(null);

        try {
            await removeUserSample(sample.id);
            toast.success(t('toast.sampleDeleted', { name: sample.name }));
            await loadUserSamples();
        } catch (error) {
            toast.error(t('toast.deleteFailed'));
            log.error('Delete failed', error);
        }
    }, [sampleToDelete, loadUserSamples, t]);

    // ========================================
    // Template Click Handler
    // ========================================

    const handleTemplateClick = useCallback((template: TemplateItem) => {
        // Create new project from template
        createProject(template.name, template.id);
    }, [createProject]);

    // ========================================
    // Instrument Double-Click (Add Track)
    // ========================================

    /**
     * Add an instrument as a new track, with something to hear on it.
     *
     * This used to create the track and stop, which left a named, coloured,
     * correctly-configured lane that was completely silent — there was no clip,
     * so Play did nothing and the piano roll had nothing to open. Dropping the
     * same instrument onto a lane has always produced a clip with a demo
     * phrase; the two entry points now do the same thing, from the same notes.
     */
    const handleInstrumentDoubleClick = useCallback((instrument: InstrumentItem) => {
        const track = addTrack(instrument.trackType, instrument.name, instrument.trackColor);
        // The track preset is the fallback for clips that carry none of their own.
        updateTrack(track.id, { instrumentPreset: instrument.id });

        const clipType = instrument.trackColor === 'drums' ? 'drum' : 'midi';
        // Bar 0 and two bars, matching what a drop produces. A new track is
        // empty, so there is no arrangement position to infer and no risk of
        // landing on top of something.
        const clip = addClip(track.id, clipType, 0, 2);
        updateClip(clip.id, { instrumentPreset: instrument.id, name: instrument.name });

        for (const note of getDemoNotesForInstrument(instrument.id)) {
            addNote(clip.id, note);
        }

        selectClip(clip.id);
        openEditor(clip.id);
    }, [addTrack, updateTrack, addClip, updateClip, addNote, selectClip, openEditor]);

    // ========================================
    // Custom Instruments (#21)
    // ========================================

    /**
     * A custom instrument, shaped like a built-in.
     *
     * Everything downstream — dragging onto a track, the double-click that
     * creates one, the drop handler in TrackList — already speaks
     * `InstrumentItem`. Adapting here rather than teaching each of those about
     * a second kind of instrument is what keeps a custom sound usable
     * *everywhere* a built-in is, which was the whole point of the request.
     */
    const asInstrumentItem = useCallback((instrument: CustomInstrument): InstrumentItem => {
        const base = INSTRUMENTS.find((i) => i.id === instrument.basePresetId);
        return {
            id: instrument.id,
            name: instrument.name,
            category: base?.category ?? 'synth',
            description: base ? t('basedOn', { preset: base.name }) : '',
            trackType: base?.trackType ?? 'midi',
            trackColor: base?.trackColor ?? 'melody',
        };
    }, [t]);

    const handleCustomizePreset = useCallback((presetId: string) => {
        const draft = draftFromPreset(presetId);
        if (draft) setEditingInstrument(draft);
    }, []);

    const handleDuplicateInstrument = useCallback(async (instrument: CustomInstrument) => {
        const copy = await duplicateCustomInstrument(instrument.id);
        if (copy) toast.success(t('toast.instrumentDuplicated', { name: copy.name }));
    }, [t]);

    const confirmDeleteInstrument = useCallback(async () => {
        const instrument = instrumentToDelete;
        if (!instrument) return;
        setInstrumentToDelete(null);

        try {
            await removeCustomInstrument(instrument.id);
            toast.success(t('toast.instrumentDeleted', { name: instrument.name }));
        } catch (error) {
            log.error('Failed to delete instrument', { error });
            toast.error(t('toast.instrumentDeleteFailed'));
        }
    }, [instrumentToDelete, t]);

    const handleInstrumentFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        // Cleared straight away so picking the same file twice still fires.
        e.target.value = '';
        if (!file) return;

        const { instrument, error } = await importInstrumentFromFile(file);
        if (!instrument) {
            toast.error(t(`importError.${error ?? 'unreadable'}`));
            return;
        }

        // `bumpRevision: false` — an import is a first save, not an edit, and
        // it should land at revision 1 the way a new instrument does.
        const saved = await saveCustomInstrument(instrument, { bumpRevision: false });
        toast.success(t('toast.instrumentImported', { name: saved.name }));
    }, [t]);

    // ========================================
    // Filter Logic
    // ========================================

    const filterBySearch = useCallback(<T extends { name: string }>(items: T[]): T[] => {
        if (!searchQuery) return items;
        const query = searchQuery.toLowerCase();
        return items.filter((item) => item.name.toLowerCase().includes(query));
    }, [searchQuery]);

    // ========================================
    // Render Templates Tab
    // ========================================

    const renderTemplates = () => {
        const filtered = filterBySearch(TEMPLATES);

        return (
            <div className="grid grid-cols-1 gap-2 p-2">
                {filtered.map((template) => (
                    <button
                        key={template.id}
                        onClick={() => handleTemplateClick(template)}
                        className="group flex items-start gap-3 rounded-lg border border-border bg-surface-elevated p-3 text-left transition-all hover:border-accent hover:bg-surface-elevated/80"
                    >
                        <span className="text-2xl">{template.emoji}</span>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                                <span className="font-medium text-sm">{template.name}</span>
                                <span className="text-xs text-muted-foreground">{t('bpm', { bpm: template.bpm })}</span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5 truncate">
                                {template.description}
                            </p>
                            <div className="flex gap-2 mt-1">
                                <span className="text-2xs px-1.5 py-0.5 rounded bg-background text-muted-foreground">
                                    {template.genre}
                                </span>
                                <span className="text-2xs px-1.5 py-0.5 rounded bg-background text-muted-foreground">
                                    {template.key} {template.scale}
                                </span>
                            </div>
                        </div>
                        <Play className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>
                ))}
                {filtered.length === 0 && (
                    <p className="py-8 text-center text-sm text-muted-foreground">
                        {t('noTemplates')}
                    </p>
                )}
            </div>
        );
    };

    // ========================================
    // Render Instruments Tab
    // ========================================

    const renderInstruments = () => {
        const filteredInstruments = filterBySearch(INSTRUMENTS);
        const filteredCustom = filterBySearch(customInstruments);
        const showCustomFolder = !searchQuery || filteredCustom.length > 0;
        const isCustomExpanded = expandedCategories.has('my-instruments');

        return (
            <div className="p-2">
                {/* My Instruments (#21) — first, above the library, the way My
                    Samples sits above the sample folders. What you made is what
                    you are looking for. */}
                {showCustomFolder && (
                    <div className="mb-1">
                        <button
                            onClick={() => toggleCategory('my-instruments')}
                            className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-surface-elevated"
                        >
                            <span className="text-muted-foreground">
                                {isCustomExpanded ? (
                                    <ChevronDown className="h-3 w-3" />
                                ) : (
                                    <ChevronRight className="h-3 w-3" />
                                )}
                            </span>
                            <AudioLines className="h-4 w-4 text-accent" />
                            <span className="font-medium text-accent">{t('myInstruments')}</span>
                            <span className="ml-auto text-xs text-muted-foreground">
                                {customInstruments.length}
                            </span>
                        </button>
                        {isCustomExpanded && (
                            <div className="ml-4 mt-1 space-y-1">
                                {filteredCustom.length === 0 ? (
                                    <p className="px-2 py-2 text-xs italic text-muted-foreground">
                                        {t('noInstruments')}
                                    </p>
                                ) : (
                                    filteredCustom.map((instrument) => {
                                        const item = asInstrumentItem(instrument);
                                        return (
                                            <div
                                                key={instrument.id}
                                                draggable
                                                onDragStart={(e) => handleInstrumentDrag(e, item)}
                                                onDoubleClick={() => handleInstrumentDoubleClick(item)}
                                                className="group relative flex items-center gap-2 rounded px-2 py-1.5 text-sm cursor-grab hover:bg-surface-elevated active:cursor-grabbing"
                                            >
                                                <GripVertical className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-50" />
                                                <div className={`h-1.5 w-1.5 rounded-full ${TRACK_BG[item.trackColor]}`} />
                                                <AudioLines className="h-4 w-4 text-accent/70" />
                                                <span className="flex-1 truncate text-foreground">{instrument.name}</span>

                                                {/* Out of flow, not merely transparent. A hidden
                                                    button still holds its width, and three of them
                                                    left 41px for a name that needed 109 — "My Dark
                                                    Rhodes" rendered as "My D…" at rest, when
                                                    nothing was even being pointed at. Overlaying on
                                                    hover gives the name the whole row back and
                                                    still shifts nothing, because the group never
                                                    enters the layout at all.

                                                    Add Track is here for parity: without it a
                                                    custom instrument could only be dragged or
                                                    double-clicked, a worse deal than the built-in
                                                    it was made from. */}
                                                <div className="absolute right-1 flex items-center gap-0.5 rounded bg-surface-elevated pl-3 opacity-0 transition-opacity group-hover:opacity-100">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleInstrumentDoubleClick(item);
                                                    }}
                                                    aria-label={t('addTrack')}
                                                    className="rounded p-1 opacity-0 transition-all hover:bg-surface-elevated group-hover:opacity-100"
                                                >
                                                    <PlusCircle className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                                                </button>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setEditingInstrument(instrument);
                                                    }}
                                                    aria-label={t('editInstrument')}
                                                    className="rounded p-1 opacity-0 transition-all hover:bg-surface-elevated group-hover:opacity-100"
                                                >
                                                    <Pencil className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                                                </button>
                                                {/* Duplicate, export and delete live in a
                                                    menu rather than as three more icons.
                                                    Buttons hold their width even at
                                                    opacity-0, and five of them in a 230px
                                                    panel left "My Dark Rhodes" rendering as
                                                    "M". Hiding them until hover would buy the
                                                    room back by shifting the row under the
                                                    cursor, which is worse. */}
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <button
                                                            onClick={(e) => e.stopPropagation()}
                                                            aria-label={t('instrumentActions')}
                                                            className="rounded p-1 opacity-0 transition-all hover:bg-surface-elevated group-hover:opacity-100 data-[state=open]:opacity-100"
                                                        >
                                                            <MoreHorizontal className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                                                        </button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end" className="w-44">
                                                        <DropdownMenuItem
                                                            onClick={() => void handleDuplicateInstrument(instrument)}
                                                        >
                                                            <Copy className="mr-2 h-3.5 w-3.5" />
                                                            {t('duplicateInstrument')}
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem onClick={() => downloadInstrument(instrument)}>
                                                            <FileJson className="mr-2 h-3.5 w-3.5" />
                                                            {t('exportInstrument')}
                                                        </DropdownMenuItem>
                                                        <DropdownMenuSeparator />
                                                        <DropdownMenuItem
                                                            onClick={() => setInstrumentToDelete(instrument)}
                                                            className="text-destructive focus:text-destructive"
                                                        >
                                                            <Trash2 className="mr-2 h-3.5 w-3.5" />
                                                            {t('deleteInstrument')}
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        )}
                    </div>
                )}

                {INSTRUMENT_CATEGORIES.map((category) => {
                    const categoryInstruments = filteredInstruments.filter(
                        (i) => i.category === category.id
                    );
                    if (categoryInstruments.length === 0) return null;

                    const isExpanded = expandedCategories.has(category.id);

                    return (
                        <div key={category.id} className="mb-1">
                            <button
                                onClick={() => toggleCategory(category.id)}
                                className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-surface-elevated"
                            >
                                <span className="text-muted-foreground">
                                    {isExpanded ? (
                                        <ChevronDown className="h-3 w-3" />
                                    ) : (
                                        <ChevronRight className="h-3 w-3" />
                                    )}
                                </span>
                                <span>{category.icon}</span>
                                <span className="font-medium">{category.name}</span>
                                <span className="text-xs text-muted-foreground ml-auto">
                                    {categoryInstruments.length}
                                </span>
                            </button>
                            {isExpanded && (
                                <div className="ml-4 space-y-1 mt-1">
                                    {categoryInstruments.map((instrument) => (
                                        <Tooltip key={instrument.id}>
                                            <TooltipTrigger asChild>
                                                <div
                                                    draggable
                                                    onDragStart={(e) => handleInstrumentDrag(e, instrument)}
                                                    onDoubleClick={() => handleInstrumentDoubleClick(instrument)}
                                                    className="flex items-center gap-2 rounded px-2 py-1.5 text-sm cursor-grab active:cursor-grabbing hover:bg-surface-elevated group relative"
                                                >
                                                    <GripVertical className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-50" />

                                                    {/* Color Indicator */}
                                                    <div className={`w-1.5 h-1.5 rounded-full ${TRACK_BG[instrument.trackColor]}`} />

                                                    <Piano className="h-4 w-4 text-muted-foreground" />

                                                    <span className="flex-1 text-foreground truncate">{instrument.name}</span>

                                                    {/* Out of flow, for the reason the custom rows
                                                        above are: buttons hold their width even
                                                        hidden, and in a 230px panel that is the
                                                        difference between "Sawtooth Wave" and
                                                        "Sawtoo...". Pre-existing, but only visible
                                                        as wrong once the row above it read fully. */}
                                                    <div className="absolute right-1 flex items-center gap-0.5 rounded bg-surface-elevated pl-3 opacity-0 transition-opacity group-hover:opacity-100">

                                                    {/* Only where there is a spec to start
                                                        from: the drum kits are Samplers and
                                                        MembraneSynths, and a customize button
                                                        that opened an editor with nothing in it
                                                        would be worse than no button. */}
                                                    {isCustomizablePreset(instrument.id) && (
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleCustomizePreset(instrument.id);
                                                            }}
                                                            className="opacity-0 group-hover:opacity-100 p-1 hover:bg-surface-elevated rounded transition-all"
                                                            aria-label={t('customize')}
                                                        >
                                                            <AudioLines className="h-3.5 w-3.5 text-muted-foreground hover:text-accent" />
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleInstrumentDoubleClick(instrument);
                                                        }}
                                                        className="opacity-0 group-hover:opacity-100 p-1 hover:bg-surface-elevated rounded transition-all"
                                                        aria-label={t('addTrack')}
                                                    >
                                                        <PlusCircle className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                                                    </button>
                                                    </div>
                                                </div>
                                            </TooltipTrigger>
                                            <TooltipContent side="right">
                                                <p className="font-medium">{instrument.name}</p>
                                                <p className="text-xs text-primary-foreground/80">{instrument.description}</p>
                                                <div className="mt-1 flex gap-2">
                                                    <span className="text-2xs bg-background/20 text-primary-foreground px-1 py-0.5 rounded uppercase tracking-wider font-semibold backdrop-blur-sm">
                                                        {instrument.trackType}
                                                    </span>
                                                </div>
                                            </TooltipContent>
                                        </Tooltip>
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        );
    };

    // ========================================
    // Render Samples Tab
    // ========================================

    const formatDuration = (seconds: number): string => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const renderSamples = () => {
        // Filter user samples by search
        const filteredUserSamples = userSamples.filter((s) =>
            s.name.toLowerCase().includes(searchQuery.toLowerCase())
        );

        const showUserSamplesFolder = !searchQuery || filteredUserSamples.length > 0;
        const isUserSamplesExpanded = expandedFolders.has('user-samples');

        return (
            <div className="p-2">
                {/* User Samples Folder */}
                {showUserSamplesFolder && (
                    <div className="mb-1">
                        <button
                            onClick={() => toggleFolder('user-samples')}
                            className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-surface-elevated"
                        >
                            <span className="text-muted-foreground">
                                {isUserSamplesExpanded ? (
                                    <ChevronDown className="h-3 w-3" />
                                ) : (
                                    <ChevronRight className="h-3 w-3" />
                                )}
                            </span>
                            <FolderOpen className="h-4 w-4 text-accent" />
                            <span className="font-medium text-accent">{t('mySamples')}</span>
                            <span className="text-xs text-muted-foreground ml-auto">
                                {userSamples.length}
                            </span>
                        </button>
                        {isUserSamplesExpanded && (
                            <div className="ml-4">
                                {filteredUserSamples.length === 0 ? (
                                    <p className="py-2 px-2 text-xs text-muted-foreground italic">
                                        {t('noSamples')}
                                    </p>
                                ) : (
                                    filteredUserSamples.map((sample) => (
                                        <div
                                            key={sample.id}
                                            draggable
                                            onClick={() => handleUserSampleClick(sample)}
                                            onDragStart={(e) => handleUserSampleDrag(e, sample)}
                                            className={`flex items-center gap-2 rounded px-2 py-1.5 text-sm cursor-grab active:cursor-grabbing hover:bg-surface-elevated group ${previewingId === sample.id ? 'bg-accent/10' : ''
                                                }`}
                                        >
                                            <GripVertical className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100" />
                                            {previewingId === sample.id ? (
                                                <Play className="h-4 w-4 text-accent animate-pulse" />
                                            ) : (
                                                <Music className="h-4 w-4 text-accent/70" />
                                            )}
                                            <span className="flex-1 text-foreground truncate">
                                                {sample.name}
                                            </span>
                                            <span className="text-2xs text-muted-foreground">
                                                {formatDuration(sample.duration)}
                                            </span>
                                            <button
                                                onClick={(e) => handleDeleteUserSample(e, sample)}
                                                className="opacity-0 group-hover:opacity-100 p-1 hover:bg-destructive/20 rounded transition-all"
                                                aria-label={t('deleteSample')}
                                            >
                                                <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* Built-in Sample Folders */}
                {SAMPLE_FOLDERS.map((folder) => {
                    const isExpanded = expandedFolders.has(folder.id);
                    const filteredSamples = filterBySearch(folder.samples);

                    // Skip folder if search is active and no matches
                    if (searchQuery && filteredSamples.length === 0) return null;

                    return (
                        <div key={folder.id} className="mb-1">
                            <button
                                onClick={() => toggleFolder(folder.id)}
                                className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-surface-elevated"
                            >
                                <span className="text-muted-foreground">
                                    {isExpanded ? (
                                        <ChevronDown className="h-3 w-3" />
                                    ) : (
                                        <ChevronRight className="h-3 w-3" />
                                    )}
                                </span>
                                <span>{folder.icon}</span>
                                <span className="font-medium">{folder.name}</span>
                                <span className="text-xs text-muted-foreground ml-auto">
                                    {folder.samples.length}
                                </span>
                            </button>
                            {isExpanded && (
                                <div className="ml-4">
                                    {(searchQuery ? filteredSamples : folder.samples).map((sample) => (
                                        <div
                                            key={sample.id}
                                            draggable
                                            onClick={() => handleSampleClick(sample)}
                                            onDragStart={(e) => handleSampleDrag(e, sample, folder)}
                                            className="flex items-center gap-2 rounded px-2 py-1.5 text-sm cursor-grab active:cursor-grabbing hover:bg-surface-elevated group"
                                        >
                                            <GripVertical className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100" />
                                            <Music className="h-4 w-4 text-muted-foreground" />
                                            <span className="flex-1 text-muted-foreground truncate">
                                                {sample.name}
                                            </span>
                                            {sample.bpm && (
                                                <span className="text-2xs text-muted-foreground">
                                                    {sample.bpm}
                                                </span>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        );
    };

    // ========================================
    // Render FX Tab
    // ========================================

    const renderFX = () => {
        const filteredFX = filterBySearch(FX_PRESETS);

        return (
            <div className="p-2">
                {FX_CATEGORIES.map((category) => {
                    const categoryFX = filteredFX.filter((f) => f.category === category.id);
                    if (categoryFX.length === 0) return null;

                    const isExpanded = expandedCategories.has(category.id);

                    return (
                        <div key={category.id} className="mb-1">
                            <button
                                onClick={() => toggleCategory(category.id)}
                                className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-surface-elevated"
                            >
                                <span className="text-muted-foreground">
                                    {isExpanded ? (
                                        <ChevronDown className="h-3 w-3" />
                                    ) : (
                                        <ChevronRight className="h-3 w-3" />
                                    )}
                                </span>
                                <span>{category.icon}</span>
                                <span className="font-medium">{category.name}</span>
                                <span className="text-xs text-muted-foreground ml-auto">
                                    {categoryFX.length}
                                </span>
                            </button>
                            {isExpanded && (
                                <div className="ml-4">
                                    {categoryFX.map((fx) => (
                                        <Tooltip key={fx.id}>
                                            <TooltipTrigger asChild>
                                                <div
                                                    draggable
                                                    onDragStart={(e) => handleFXDrag(e, fx)}
                                                    className="flex items-center gap-2 rounded px-2 py-1.5 text-sm cursor-grab active:cursor-grabbing hover:bg-surface-elevated group"
                                                >
                                                    <GripVertical className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100" />
                                                    <Sparkles className="h-4 w-4 text-muted-foreground" />
                                                    <span className="flex-1 text-muted-foreground">
                                                        {fx.name}
                                                    </span>
                                                </div>
                                            </TooltipTrigger>
                                            <TooltipContent side="right">{fx.description}</TooltipContent>
                                        </Tooltip>
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        );
    };

    // ========================================
    // Render Content Based on Tab
    // ========================================

    const renderContent = () => {
        switch (activeTab) {
            case 'templates':
                return renderTemplates();
            case 'instruments':
                return renderInstruments();
            case 'samples':
                return renderSamples();
            case 'fx':
                return renderFX();
            default:
                return null;
        }
    };

    return (
        <aside className="flex w-browser flex-col border-r border-border bg-surface">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border px-3 py-2">
                <h2 className="text-sm font-semibold">{t('title')}</h2>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                            aria-label={t('collapse')}
                            variant="ghost"
                            size="icon"
                            onClick={toggleBrowser}
                            className="h-6 w-6"
                        >
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent side="left">
                        <p>
                            {t('collapse')}{' '}
                            <kbd className="ml-1 text-xs opacity-60">B</kbd>
                        </p>
                    </TooltipContent>
                </Tooltip>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-border">
                {TABS.map((tab) => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.id;
                    return (
                        <Tooltip key={tab.id}>
                            <TooltipTrigger asChild>
                                <button
                                    aria-label={t(`tabs.${tab.id}`)}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`flex-1 flex items-center justify-center py-2.5 transition-colors ${isActive
                                        ? 'text-accent border-b-2 border-accent -mb-[1px]'
                                        : 'text-muted-foreground hover:text-foreground'
                                        }`}
                                >
                                    <Icon className="h-4 w-4" />
                                </button>
                            </TooltipTrigger>
                            <TooltipContent side="bottom">
                                <p>{t(`tabs.${tab.id}`)}</p>
                            </TooltipContent>
                        </Tooltip>
                    );
                })}
            </div>

            {/* Search */}
            <div className="border-b border-border p-2">
                <div className="relative">
                    <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        // A placeholder is not an accessible name, and it is
                        // gone as soon as anything is typed.
                        aria-label={t(`search.${activeTab}`)}
                        placeholder={t(`search.${activeTab}`)}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="h-8 pl-8"
                    />
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
                {renderContent()}
            </div>

            {/* Footer: Import an instrument file (#21) */}
            {activeTab === 'instruments' && (
                <div className="border-t border-border p-2">
                    <input
                        ref={instrumentFileInputRef}
                        type="file"
                        accept={INSTRUMENT_FILE_EXTENSION + ',application/json'}
                        onChange={(e) => void handleInstrumentFileSelect(e)}
                        className="hidden"
                        aria-label={t('importInstrument')}
                    />
                    <Button
                        variant="outline"
                        size="sm"
                        className="w-full justify-start gap-2"
                        onClick={() => instrumentFileInputRef.current?.click()}
                    >
                        <Upload className="h-4 w-4" />
                        {t('importInstrument')}
                    </Button>
                    <p className="mt-1 text-center text-2xs text-muted-foreground">
                        {t('importInstrumentHint')}
                    </p>
                </div>
            )}

            {/* Footer: Import (only show for samples tab) */}
            {activeTab === 'samples' && (
                <div className="border-t border-border p-2">
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept={SUPPORTED_EXTENSIONS.join(',')}
                        multiple
                        onChange={handleFileSelect}
                        className="hidden"
                    />
                    <Button
                        variant="outline"
                        size="sm"
                        className="w-full justify-start gap-2"
                        onClick={handleImportClick}
                        disabled={isImporting}
                    >
                        {isImporting ? (
                            <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                {t('importing')}
                            </>
                        ) : (
                            <>
                                <Upload className="h-4 w-4" />
                                {t('importAudio')}
                            </>
                        )}
                    </Button>
                    <p className="mt-1 text-2xs text-muted-foreground text-center">
                        {t('importHint')}
                    </p>
                </div>
            )}

            <AlertDialog
                open={sampleToDelete !== null}
                onOpenChange={(open) => !open && setSampleToDelete(null)}
            >
                <AlertDialogContent className="max-w-sm">
                    <AlertDialogHeader>
                        <AlertDialogTitle>{t('deleteSample')}</AlertDialogTitle>
                        <AlertDialogDescription>
                            {t('confirmDeleteSample', { name: sampleToDelete?.name ?? '' })}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>{tCommon('cancel')}</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={confirmDeleteUserSample}
                            className={buttonVariants({ variant: 'destructive' })}
                        >
                            {t('deleteSample')}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Deleting an instrument is destructive and irreversible, so it is
                an AlertDialog: no dismiss-by-clicking-away, and the buttons
                carry their roles. */}
            <AlertDialog
                open={instrumentToDelete !== null}
                onOpenChange={(open) => !open && setInstrumentToDelete(null)}
            >
                <AlertDialogContent className="max-w-sm">
                    <AlertDialogHeader>
                        <AlertDialogTitle>{t('deleteInstrument')}</AlertDialogTitle>
                        <AlertDialogDescription>
                            {t('confirmDeleteInstrument', { name: instrumentToDelete?.name ?? '' })}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>{tCommon('cancel')}</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => void confirmDeleteInstrument()}
                            className={buttonVariants({ variant: 'destructive' })}
                        >
                            {t('deleteInstrument')}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <InstrumentEditor
                instrument={editingInstrument}
                onClose={() => setEditingInstrument(null)}
                onSaved={() => setEditingInstrument(null)}
            />
        </aside>
    );
}

// Collapsed bar to show browser
export function BrowserCollapsedBar() {
    const t = useTranslations('browser');
    const toggleBrowser = useUIStore((s) => s.toggleBrowser);

    return (
        <div className="border-r border-border bg-background h-full">
            <button
                aria-label={t('expand')}
                onClick={toggleBrowser}
                className="h-full w-6 flex flex-col items-center justify-center gap-2 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            >
                <ChevronRight className="h-3 w-3" />
                <span className="writing-mode-vertical text-2xs tracking-wider">{t('collapsedLabel')}</span>
                <kbd className="px-1 py-0.5 text-2xs font-mono bg-muted border border-border rounded">B</kbd>
            </button>
        </div>
    );
}
