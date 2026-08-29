'use client';

// ============================================
// ComposeYogi — Vibe Selector
// ============================================
//
// design.md puts "Scale: Chill ▾" in the transport bar, and the reason is the
// north star rather than the layout: someone opening a DAW for the first time
// has no idea what Phrygian is, but they know exactly what "Dark" means. This
// picks the key and the scale together behind a word they already have.
//
// It does not replace the literal controls — the Inspector still lists all
// twelve keys and thirteen scales, and moving either one there puts this back
// to showing what the project is actually set to. That is the whole progressive
// disclosure idea in one widget: the vocabulary is hidden, the control is not.

import { useTranslations } from 'next-intl';

import { VIBES, matchVibe } from '@/lib/music';
import { useProjectStore } from '@/lib/store';
import { selectKey, selectScale } from '@/lib/store/project';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';

import type { VibeId } from '@/types';

export function VibeSelect() {
    const t = useTranslations('transport');
    const tVibes = useTranslations('vibes');
    const tScales = useTranslations('scales');

    const musicalKey = useProjectStore(selectKey);
    const scale = useProjectStore(selectScale);
    const setVibe = useProjectStore((s) => s.setVibe);

    const current = matchVibe(musicalKey, scale);
    const literal = `${musicalKey} ${tScales(scale)}`;

    // No tooltip. Every other chip in the transport has one, but a Radix
    // tooltip anchored here stays open once the listbox is above it and covers
    // the first vibe in the list — and it would only repeat what the trigger
    // and the list already say.
    return (
        <div className="flex items-center gap-1.5 rounded-md border border-border/50 bg-background px-2 py-1">
            {/* Hidden below the width the transport is designed for, the same
                way the duplicate zoom slider beside it is — the value is what
                has to survive a narrow window, not the caption. */}
            <span className="hidden text-xs uppercase tracking-wider text-muted-foreground 2xl:inline">
                {t('scale')}
            </span>
            <Select
                // Empty means "no vibe matches", which shows the placeholder —
                // the literal key and scale the user chose in the Inspector.
                value={current?.id ?? ''}
                onValueChange={(value) => setVibe(value as VibeId)}
            >
                <SelectTrigger
                    className="h-6 w-auto gap-1 border-0 bg-transparent px-1 py-0 text-sm shadow-none focus:ring-0"
                    aria-label={t('scale')}
                >
                    {/* The vibe's name alone, not the name plus its key and
                        scale. Rendering the selected item verbatim — which is
                        what a bare <SelectValue/> does — put "Chill A Dorian"
                        in a transport bar that is already full at the width
                        the design targets. The detail is one click away in the
                        list, and spelled out in the Inspector. */}
                    <SelectValue placeholder={literal}>
                        {current ? tVibes(current.id) : literal}
                    </SelectValue>
                </SelectTrigger>
                <SelectContent>
                    {VIBES.map((vibe) => (
                        <SelectItem key={vibe.id} value={vibe.id}>
                            <span className="flex items-baseline gap-2">
                                {tVibes(vibe.id)}
                                <span className="font-mono text-2xs text-muted-foreground">
                                    {vibe.key} {tScales(vibe.scale)}
                                </span>
                            </span>
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    );
}
