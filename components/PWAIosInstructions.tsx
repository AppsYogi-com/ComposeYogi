'use client';

// ============================================
// ComposeYogi — iOS Install Instructions
// ============================================
//
// Safari gives no programmatic install, so iOS gets told how to do it by hand.
// One component for both entry points — the banner and the toolbar button — so
// the steps cannot drift apart. The toolbar button used to raise a
// `window.alert()` instead, which is chrome the design system has no say over.

import { useTranslations } from 'next-intl';
import { Share } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';

interface PWAIosInstructionsProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function PWAIosInstructions({ open, onOpenChange }: PWAIosInstructionsProps) {
    const t = useTranslations('pwa');

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-sm">
                <DialogHeader>
                    <DialogTitle>{t('iosTitle')}</DialogTitle>
                    <DialogDescription>{t('iosDescription')}</DialogDescription>
                </DialogHeader>
                <ol className="space-y-2 text-sm">
                    <li className="flex items-center gap-2">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent text-xs font-bold text-accent-foreground">1</span>
                        <span>{t('iosStep1')} <Share className="inline h-4 w-4" /></span>
                    </li>
                    <li className="flex items-center gap-2">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent text-xs font-bold text-accent-foreground">2</span>
                        <span>{t('iosStep2')}</span>
                    </li>
                    <li className="flex items-center gap-2">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent text-xs font-bold text-accent-foreground">3</span>
                        <span>{t('iosStep3')}</span>
                    </li>
                </ol>
                <Button onClick={() => onOpenChange(false)} className="w-full">
                    {t('gotIt')}
                </Button>
            </DialogContent>
        </Dialog>
    );
}
