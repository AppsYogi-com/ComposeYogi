'use client';

import { useTranslations } from 'next-intl';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { usePWAInstall } from '@/hooks/usePWAInstall';

export function PWAInstallButton() {
    const t = useTranslations('pwa');
    const { isInstallable, isInstalled, isIOS, canShowButton, promptInstall } = usePWAInstall();

    const handleInstall = async () => {
        if (isIOS) {
            // For iOS, show alert with instructions (can't programmatically install)
            alert(t('iosDescription') + '\n\n1. ' + t('iosStep1') + '\n2. ' + t('iosStep2') + '\n3. ' + t('iosStep3'));
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
        <Tooltip>
            <TooltipTrigger asChild>
                <Button
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
    );
}
