'use client';

import { useState, useCallback } from 'react';
import {
    LayoutTemplate,
    Piano,
    Music,
    Sparkles,
    ChevronRight,
    ChevronDown,
    ChevronLeft,
    Search,
    Plus,
    PlusCircle,
    GripVertical,
    Play,
} from 'lucide-react';
import { useUIStore, useProjectStore } from '@/lib/store';
import { Button } from '@/components/ui';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/ui/tooltip';
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

// ============================================
// Tab Configuration
// ============================================

const TABS: { id: BrowserTab; label: string; icon: typeof LayoutTemplate }[] = [
    { id: 'templates', label: 'Templates', icon: LayoutTemplate },
    { id: 'instruments', label: 'Instruments', icon: Piano },
    { id: 'samples', label: 'Samples', icon: Music },
    { id: 'fx', label: 'FX', icon: Sparkles },
];

// ============================================
// Helper Functions
// ============================================

const getTrackColorClass = (color: string): string => {
    switch (color) {
        case 'drums': return 'red-500';
        case 'bass': return 'blue-500';
        case 'keys': return 'orange-400';
        case 'melody': return 'purple-500';
        case 'vocals': return 'green-500';
        case 'fx': return 'pink-500';
        default: return 'gray-500';
    }
};

// ============================================
// BrowserPanel Component
// ============================================

export function BrowserPanel() {
    const [activeTab, setActiveTab] = useState<BrowserTab>('templates');
    const [searchQuery, setSearchQuery] = useState('');
    const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(['drums']));
    const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['synth', 'reverb']));

    const toggleBrowser = useUIStore((s) => s.toggleBrowser);
    const createProject = useProjectStore((s) => s.createProject);
    const addTrack = useProjectStore((s) => s.addTrack);
    const updateTrack = useProjectStore((s) => s.updateTrack);

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
    // Template Click Handler
    // ========================================

    const handleTemplateClick = useCallback((template: TemplateItem) => {
        // Create new project from template
        createProject(template.name, template.id);
    }, [createProject]);

    // ========================================
    // Instrument Double-Click (Add Track)
    // ========================================

    const handleInstrumentDoubleClick = useCallback((instrument: InstrumentItem) => {
        const track = addTrack(instrument.trackType, instrument.name, instrument.trackColor);
        // Set the synth preset so the track produces the correct sound
        updateTrack(track.id, { instrumentPreset: instrument.id });
    }, [addTrack, updateTrack]);

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
                                <span className="text-xs text-muted-foreground">{template.bpm} BPM</span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5 truncate">
                                {template.description}
                            </p>
                            <div className="flex gap-2 mt-1">
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-background text-muted-foreground">
                                    {template.genre}
                                </span>
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-background text-muted-foreground">
                                    {template.key} {template.scale}
                                </span>
                            </div>
                        </div>
                        <Play className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>
                ))}
                {filtered.length === 0 && (
                    <p className="py-8 text-center text-sm text-muted-foreground">
                        No templates found
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

        return (
            <div className="p-2">
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
                                                    <div className={`w-1.5 h-1.5 rounded-full bg-${getTrackColorClass(instrument.trackColor)}`} />

                                                    <Piano className="h-4 w-4 text-muted-foreground" />

                                                    <span className="flex-1 text-foreground truncate">{instrument.name}</span>

                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleInstrumentDoubleClick(instrument);
                                                        }}
                                                        className="opacity-0 group-hover:opacity-100 p-1 hover:bg-surface-active rounded transition-all"
                                                        aria-label="Add Track"
                                                    >
                                                        <PlusCircle className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                                                    </button>
                                                </div>
                                            </TooltipTrigger>
                                            <TooltipContent side="right">
                                                <p className="font-medium">{instrument.name}</p>
                                                <p className="text-xs text-primary-foreground/80">{instrument.description}</p>
                                                <div className="mt-1 flex gap-2">
                                                    <span className="text-[10px] bg-background/20 text-primary-foreground px-1 py-0.5 rounded uppercase tracking-wider font-semibold backdrop-blur-sm">
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

    const renderSamples = () => {
        return (
            <div className="p-2">
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
                                                <span className="text-[10px] text-muted-foreground">
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
                                        <div
                                            key={fx.id}
                                            draggable
                                            onDragStart={(e) => handleFXDrag(e, fx)}
                                            className="flex items-center gap-2 rounded px-2 py-1.5 text-sm cursor-grab active:cursor-grabbing hover:bg-surface-elevated group"
                                            title={fx.description}
                                        >
                                            <GripVertical className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100" />
                                            <Sparkles className="h-4 w-4 text-muted-foreground" />
                                            <span className="flex-1 text-muted-foreground">
                                                {fx.name}
                                            </span>
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
                <h2 className="text-sm font-semibold">Browser</h2>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={toggleBrowser}
                            className="h-6 w-6"
                        >
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent side="left">
                        <p>Close Browser <kbd className="ml-1 text-xs opacity-60">B</kbd></p>
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
                                <p>{tab.label}</p>
                            </TooltipContent>
                        </Tooltip>
                    );
                })}
            </div>

            {/* Search */}
            <div className="border-b border-border p-2">
                <div className="relative">
                    <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                        type="text"
                        placeholder={`Search ${activeTab}...`}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full rounded bg-background py-1.5 pl-8 pr-3 text-sm focus:outline-none focus:ring-1 focus:ring-accent"
                    />
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
                {renderContent()}
            </div>

            {/* Footer: Import (only show for samples tab) */}
            {activeTab === 'samples' && (
                <div className="border-t border-border p-2">
                    <Button
                        variant="outline"
                        size="sm"
                        className="w-full justify-start gap-2"
                    >
                        <Plus className="h-4 w-4" />
                        Import Audio
                    </Button>
                </div>
            )}
        </aside>
    );
}

// Collapsed bar to show browser
export function BrowserCollapsedBar() {
    const toggleBrowser = useUIStore((s) => s.toggleBrowser);

    return (
        <div className="border-r border-border bg-background h-full">
            <button
                onClick={toggleBrowser}
                className="h-full w-6 flex flex-col items-center justify-center gap-2 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            >
                <ChevronRight className="h-3 w-3" />
                <span className="writing-mode-vertical text-[10px] tracking-wider">BROWSER</span>
                <kbd className="px-1 py-0.5 text-[10px] font-mono bg-muted border border-border rounded">B</kbd>
            </button>
        </div>
    );
}
