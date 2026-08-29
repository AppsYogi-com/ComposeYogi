'use client';

import { useTranslations } from 'next-intl';
import {
    ChevronLeft,
    Sliders,
    Music,
    Clock,
    Hash,
    Sparkles,
    Trash2
} from 'lucide-react';
import { useProjectStore, useUIStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { SCALES, NOTES } from '@/lib/utils';
import { trackColorValue } from '@/lib/design';
import type { MusicalKey, MusicalScale, TrackType, TrackColor } from '@/types';

// Option lists carry ids only — the labels come from `inspector.trackColors.*`
// and `inspector.trackTypes.*`, so a locale change relabels them.
const TRACK_COLOR_OPTIONS: TrackColor[] = ['drums', 'bass', 'keys', 'melody', 'vocals', 'fx'];

const TRACK_TYPE_OPTIONS: TrackType[] = ['audio', 'midi', 'drum'];

export function Inspector() {
    const t = useTranslations('inspector');
    const tScales = useTranslations('scales');
    const project = useProjectStore((s) => s.project);
    const setKey = useProjectStore((s) => s.setKey);
    const setScale = useProjectStore((s) => s.setScale);
    const removeTrackEffect = useProjectStore((s) => s.removeTrackEffect);
    const updateTrackEffect = useProjectStore((s) => s.updateTrackEffect);
    const selectedTrackId = useUIStore((s) => s.selectedTrackId);
    const selectedClipId = useUIStore((s) => s.selectedClipId);
    const toggleInspector = useUIStore((s) => s.toggleInspector);

    const selectedTrack = project?.tracks.find((t) => t.id === selectedTrackId);
    const selectedClip = project?.clips.find((c) => c.id === selectedClipId);

    return (
        <aside className="flex w-inspector flex-col border-l border-border bg-card">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border px-3 py-2">
                <h2 className="text-sm font-semibold">{t('title')}</h2>
                <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={toggleInspector}
                >
                    <ChevronLeft className="h-4 w-4" />
                </Button>
            </div>

            <ScrollArea className="flex-1">
                {/* Project settings section */}
                <Section title={t('project.title')} icon={<Sliders className="h-4 w-4" />}>
                    {/* Key */}
                    <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">{t('project.key')}</Label>
                        <Select
                            value={project?.key || 'C'}
                            onValueChange={(value) => setKey(value as MusicalKey)}
                        >
                            <SelectTrigger className="h-8">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {NOTES.map((note) => (
                                    <SelectItem key={note} value={note}>
                                        {note}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Scale */}
                    <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">{t('project.scale')}</Label>
                        <Select
                            value={project?.scale || 'major'}
                            onValueChange={(value) => setScale(value as MusicalScale)}
                        >
                            <SelectTrigger className="h-8">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {SCALES.map((scale) => (
                                    <SelectItem key={scale.id} value={scale.id}>
                                        {tScales(scale.id)}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Time signature (read-only display) */}
                    <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">{t('project.timeSignature')}</Label>
                        <div className="flex items-center h-8 px-3 rounded-md border border-input bg-background text-sm font-mono">
                            {project?.timeSignature[0]}/{project?.timeSignature[1]}
                        </div>
                    </div>
                </Section>

                {/* Selected track section */}
                {selectedTrack && (
                    <Section title={t('track.title')} icon={<Music className="h-4 w-4" />}>
                        <div className="space-y-1.5">
                            <Label className="text-xs text-muted-foreground">{t('track.name')}</Label>
                            <Input
                                value={selectedTrack.name}
                                onChange={(e) => {
                                    useProjectStore.getState().updateTrack(selectedTrack.id, {
                                        name: e.target.value,
                                    });
                                }}
                                className="h-8"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-xs text-muted-foreground">{t('track.type')}</Label>
                            <Select
                                value={selectedTrack.type}
                                onValueChange={(value) => {
                                    useProjectStore.getState().updateTrack(selectedTrack.id, {
                                        type: value as TrackType,
                                    });
                                }}
                            >
                                <SelectTrigger className="h-8">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {TRACK_TYPE_OPTIONS.map((opt) => (
                                        <SelectItem key={opt} value={opt}>
                                            {t(`trackTypes.${opt}`)}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-xs text-muted-foreground">{t('track.color')}</Label>
                            <Select
                                value={selectedTrack.color}
                                onValueChange={(value) => {
                                    useProjectStore.getState().updateTrack(selectedTrack.id, {
                                        color: value as TrackColor,
                                    });
                                }}
                            >
                                <SelectTrigger className="h-8">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {TRACK_COLOR_OPTIONS.map((opt) => (
                                        <SelectItem key={opt} value={opt}>
                                            <div className="flex items-center gap-2">
                                                <div
                                                    className="w-3 h-3 rounded-full"
                                                    style={{ backgroundColor: trackColorValue(opt) }}
                                                />
                                                {t(`trackColors.${opt}`)}
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-xs text-muted-foreground">
                                {t('track.pan', { value: Math.round((selectedTrack.pan || 0) * 100) })}
                            </Label>
                            <Slider
                                value={[(selectedTrack.pan || 0) * 50 + 50]}
                                min={0}
                                max={100}
                                step={1}
                                onValueChange={([v]) => {
                                    useProjectStore.getState().updateTrack(selectedTrack.id, {
                                        pan: (v - 50) / 50,
                                    });
                                }}
                                className="py-2"
                            />
                        </div>
                    </Section>
                )}

                {/* Selected track effects */}
                {selectedTrack && (
                    <Section title={t('effects.title')} icon={<Sparkles className="h-4 w-4" />}>
                        {(!selectedTrack.effects || selectedTrack.effects.length === 0) ? (
                            <div className="text-xs text-muted-foreground text-center py-8 border-2 border-dashed border-muted rounded-md bg-muted/20">
                                {t.rich('effects.emptyState', { br: () => <br /> })}
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {selectedTrack.effects.map((effect, index) => (
                                    <div
                                        key={effect.id}
                                        className="rounded-md bg-background border border-border overflow-hidden"
                                    >
                                        {/* Effect Header */}
                                        <div className="flex items-center justify-between p-2 bg-muted/30 border-b border-border/50">
                                            <div className="flex items-center gap-2">
                                                <div className="w-5 h-5 rounded bg-primary/10 flex items-center justify-center shrink-0 border border-primary/20">
                                                    <span className="text-2xs font-bold text-primary">
                                                        {index + 1}
                                                    </span>
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="text-xs font-medium truncate">
                                                        {t(`effectTypes.${effect.type}`)}
                                                    </div>
                                                </div>
                                            </div>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-6 w-6 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                                onClick={() => removeTrackEffect(selectedTrack.id, effect.id)}
                                            >
                                                <Trash2 className="h-3 w-3" />
                                            </Button>
                                        </div>

                                        {/* Effect Controls */}
                                        <div className="p-3 space-y-3">
                                            {/* Common Wet/Dry Control */}
                                            <div className="space-y-1.5">
                                                <div className="flex items-center justify-between">
                                                    <Label className="text-2xs text-muted-foreground">{t('effects.mix')}</Label>
                                                    <span className="text-2xs font-mono">
                                                        {Math.round((effect.params.wet ?? 0.5) * 100)}%
                                                    </span>
                                                </div>
                                                <Slider
                                                    value={[(effect.params.wet ?? 0.5) * 100]}
                                                    min={0}
                                                    max={100}
                                                    step={1}
                                                    onValueChange={([v]) => {
                                                        const newParams = { ...effect.params, wet: v / 100 };
                                                        updateTrackEffect(selectedTrack.id, effect.id, { params: newParams });
                                                    }}
                                                    className="py-1"
                                                />
                                            </div>

                                            {/* Specific Controls based on Type */}
                                            {effect.type === 'reverb' && (
                                                <div className="space-y-1.5">
                                                    <div className="flex items-center justify-between">
                                                        <Label className="text-2xs text-muted-foreground">{t('effects.decay')}</Label>
                                                        <span className="text-2xs font-mono">{effect.params.decay ?? 1.5}s</span>
                                                    </div>
                                                    <Slider
                                                        value={[(effect.params.decay ?? 1.5) * 10]}
                                                        min={1}
                                                        max={100}
                                                        step={1}
                                                        onValueChange={([v]) => {
                                                            const newParams = { ...effect.params, decay: v / 10 };
                                                            updateTrackEffect(selectedTrack.id, effect.id, { params: newParams });
                                                        }}
                                                        className="py-1"
                                                    />
                                                </div>
                                            )}

                                            {effect.type === 'delay' && (
                                                <div className="space-y-1.5">
                                                    <div className="flex items-center justify-between">
                                                        <Label className="text-2xs text-muted-foreground">{t('effects.feedback')}</Label>
                                                        <span className="text-2xs font-mono">{Math.round((effect.params.feedback ?? 0.5) * 100)}%</span>
                                                    </div>
                                                    <Slider
                                                        value={[(effect.params.feedback ?? 0.5) * 100]}
                                                        min={0}
                                                        max={90}
                                                        step={1}
                                                        onValueChange={([v]) => {
                                                            const newParams = { ...effect.params, feedback: v / 100 };
                                                            updateTrackEffect(selectedTrack.id, effect.id, { params: newParams });
                                                        }}
                                                        className="py-1"
                                                    />
                                                </div>
                                            )}

                                            {effect.type === 'distortion' && (
                                                <div className="space-y-1.5">
                                                    <div className="flex items-center justify-between">
                                                        <Label className="text-2xs text-muted-foreground">{t('effects.drive')}</Label>
                                                        <span className="text-2xs font-mono">{Math.round((effect.params.distortion ?? 0.4) * 100)}%</span>
                                                    </div>
                                                    <Slider
                                                        value={[(effect.params.distortion ?? 0.4) * 100]}
                                                        min={0}
                                                        max={100}
                                                        step={1}
                                                        onValueChange={([v]) => {
                                                            const newParams = { ...effect.params, distortion: v / 100 };
                                                            updateTrackEffect(selectedTrack.id, effect.id, { params: newParams });
                                                        }}
                                                        className="py-1"
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </Section>
                )}

                {/* Selected clip section */}
                {selectedClip && (
                    <Section title={t('clip.title')} icon={<Clock className="h-4 w-4" />}>
                        <div className="space-y-1.5">
                            <Label className="text-xs text-muted-foreground">{t('clip.name')}</Label>
                            <Input
                                value={selectedClip.name}
                                onChange={(e) => {
                                    useProjectStore.getState().updateClip(selectedClip.id, {
                                        name: e.target.value,
                                    });
                                }}
                                className="h-8"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1.5">
                                <Label className="text-xs text-muted-foreground">{t('clip.start')}</Label>
                                <Input
                                    type="number"
                                    value={selectedClip.startBar}
                                    onChange={(e) => {
                                        useProjectStore.getState().updateClip(selectedClip.id, {
                                            startBar: parseInt(e.target.value, 10) || 0,
                                        });
                                    }}
                                    min={0}
                                    className="h-8 font-mono"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs text-muted-foreground">{t('clip.length')}</Label>
                                <Input
                                    type="number"
                                    value={selectedClip.lengthBars}
                                    onChange={(e) => {
                                        useProjectStore.getState().updateClip(selectedClip.id, {
                                            lengthBars: parseInt(e.target.value, 10) || 1,
                                        });
                                    }}
                                    min={1}
                                    className="h-8 font-mono"
                                />
                            </div>
                        </div>
                    </Section>
                )}

                {/* No selection */}
                {!selectedTrack && !selectedClip && (
                    <div className="flex flex-col items-center justify-center py-12 text-center px-4">
                        <Hash className="mb-2 h-8 w-8 text-muted-foreground/30" />
                        <p className="text-sm text-muted-foreground">
                            {t('emptyState')}
                        </p>
                    </div>
                )}
            </ScrollArea>
        </aside>
    );
}

// ============================================
// Sub-components
// ============================================

interface SectionProps {
    title: string;
    icon: React.ReactNode;
    children: React.ReactNode;
}

function Section({ title, icon, children }: SectionProps) {
    return (
        <div className="border-b border-border">
            <div className="flex items-center gap-2 bg-background/50 px-3 py-2">
                <span className="text-muted-foreground">{icon}</span>
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {title}
                </span>
            </div>
            <div className="space-y-3 p-3">{children}</div>
        </div>
    );
}

// Collapsed bar to show inspector
export function InspectorCollapsedBar() {
    const t = useTranslations('inspector');
    const toggleInspector = useUIStore((s) => s.toggleInspector);

    return (
        <div className="border-l border-border bg-background h-full">
            <button
                onClick={toggleInspector}
                className="h-full w-6 flex flex-col items-center justify-center gap-2 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            >
                <ChevronLeft className="h-3 w-3" />
                <span className="writing-mode-vertical text-2xs tracking-wider">{t('collapsedLabel')}</span>
                <kbd className="px-1 py-0.5 text-2xs font-mono bg-muted border border-border rounded">I</kbd>
            </button>
        </div>
    );
}
