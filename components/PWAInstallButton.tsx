'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { usePWAInstall } from '@/hooks/usePWAInstall';
import { PWAIosInstructions } from './PWAIosInstructions';

export function PWAInstallButton() {
    const t = useTranslations('pwa');
    const { isInstallable, isInstalled, isIOS, canShowButton, promptInstall } = usePWAInstall();
    const [showIOSInstructions, setShowIOSInstructions] = useState(false);

    const handleInstall = async () => {
        if (isIOS) {
            // Safari cannot be asked to install, so iOS gets the same instructions
            // dialog the banner shows — not a window.alert().
            setShowIOSInstructions(true);
        } else if (isInstallable) {
            await promptInstall();
        }
        // If prompt not ready, do nothing - browser will show install icon in address bar
    };

    // Don't show if already installed or can't show button
    if (isInstalled || !canShowButton) {
        return null;
    }

    return (
        <>
        <Tooltip>
            <TooltipTrigger asChild>
                <Button
                    aria-label={t('install')}
                    variant="ghost"
                    size="icon-sm"
                    onClick={handleInstall}
                    disabled={!isInstallable && !isIOS}
                    className={!isInstallable && !isIOS ? 'opacity-50' : ''}
                >
                    <Download className="h-4 w-4" />
                </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
                <p>{t('install')}</p>
            </TooltipContent>
        </Tooltip>
        <PWAIosInstructions open={showIOSInstructions} onOpenChange={setShowIOSInstructions} />
        </>
    );
}
