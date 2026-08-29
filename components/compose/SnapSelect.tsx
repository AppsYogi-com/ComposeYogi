'use client';

// ============================================
// ComposeYogi — Snap Picker
// ============================================
//
// One control, used by the arrangement timeline and by the piano roll against
// their own settings. Shared because the option list is the thing worth keeping
// in step: the piano roll's used to be six inline <SelectItem>s and the
// timeline had none at all, so "add a triplet" meant remembering two places.

import { useTranslations } from 'next-intl';

import { STRAIGHT_SNAP_VALUES, TRIPLET_SNAP_VALUES } from '@/lib/music';
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

import type { SnapValue } from '@/types';

interface SnapSelectProps {
    value: SnapValue;
    onChange: (snap: SnapValue) => void;
    disabled?: boolean;
    className?: string;
}

export function SnapSelect({ value, onChange, disabled, className }: SnapSelectProps) {
    const t = useTranslations('snap');

    return (
        <Select value={value} onValueChange={(v) => onChange(v as SnapValue)} disabled={disabled}>
            <SelectTrigger
                className={cn('h-7 w-[4.5rem] font-mono text-xs tabular-nums', className)}
                aria-label={t('label')}
            >
                <SelectValue />
            </SelectTrigger>
            <SelectContent>
                {/* Off leads, and is the only entry that is a word rather than a
                    fraction — so it reads as the escape hatch it is. */}
                <SelectItem value="off" className="font-mono text-xs">
                    {t('off')}
                </SelectItem>
                <SelectGroup>
                    <SelectLabel className="text-xs">{t('straight')}</SelectLabel>
                    {STRAIGHT_SNAP_VALUES.map((snap) => (
                        <SelectItem key={snap} value={snap} className="font-mono text-xs tabular-nums">
                            {snap}
                        </SelectItem>
                    ))}
                </SelectGroup>
                <SelectGroup>
                    <SelectLabel className="text-xs">{t('triplets')}</SelectLabel>
                    {TRIPLET_SNAP_VALUES.map((snap) => (
                        <SelectItem key={snap} value={snap} className="font-mono text-xs tabular-nums">
                            {snap}
                        </SelectItem>
                    ))}
                </SelectGroup>
            </SelectContent>
        </Select>
    );
}
