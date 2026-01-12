'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { X, Download, Share } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePWAInstall } from '@/hooks/usePWAInstall';

export function PWAInstallPrompt() {
    const t = useTranslations('pwa');
    const { isInstallable, isInstalled, isIOS, promptInstall } = usePWAInstall();
    const [dismissed, setDismissed] = useState(false);
    const [showIOSInstructions, setShowIOSInstructions] = useState(false);

    // Check if user previously dismissed
    useEffect(() => {
        const wasDismissed = localStorage.getItem('pwa-install-dismissed');
        if (wasDismissed) {
            const dismissedAt = parseInt(wasDismissed, 10);
            // Show again after 7 days
            if (Date.now() - dismissedAt < 7 * 24 * 60 * 60 * 1000) {
                setDismissed(true);
            }
        }
    }, []);

    const handleDismiss = () => {
        setDismissed(true);
        localStorage.setItem('pwa-install-dismissed', Date.now().toString());
    };

    const handleInstall = async () => {
        if (isIOS) {
            setShowIOSInstructions(true);
        } else {
            const installed = await promptInstall();
            if (installed) {
                setDismissed(true);
            }
        }
    };

    // Don't show if installed, dismissed, or not installable (and not iOS)
    if (isInstalled || dismissed || (!isInstallable && !isIOS)) {
        return null;
    }

    // iOS instructions modal
    if (showIOSInstructions) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                <div className="max-w-sm rounded-lg bg-card p-6 shadow-xl">
                    <h3 className="mb-4 text-lg font-semibold">{t('iosTitle')}</h3>
                    <p className="mb-4 text-sm text-muted-foreground">
                        {t('iosDescription')}
                    </p>
                    <ol className="mb-4 space-y-2 text-sm">
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
                    <Button
                        onClick={() => setShowIOSInstructions(false)}
                        className="w-full"
                    >
                        {t('gotIt')}
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed top-4 left-4 right-4 z-50 max-w-md animate-in slide-in-from-top-4 duration-300 sm:right-auto">
            <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-3 shadow-lg">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-accent">
                    <Download className="h-5 w-5 text-accent-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{t('installTitle')}</p>
                    <p className="text-xs text-muted-foreground truncate">
                        {t('installDescription')}
                    </p>
                </div>
                <Button
                    size="sm"
                    onClick={handleInstall}
                    className="flex-shrink-0"
                >
                    {t('install')}
                </Button>
                <button
                    onClick={handleDismiss}
                    className="flex-shrink-0 p-1 text-muted-foreground hover:text-foreground"
                    aria-label="Dismiss"
                >
                    <X className="h-4 w-4" />
                </button>
            </div>
        </div>
    );
}
