'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { WifiOff } from 'lucide-react';

export function OfflineIndicator() {
    const t = useTranslations('offline');
    const [isOffline, setIsOffline] = useState(false);

    useEffect(() => {
        // Check initial state
        setIsOffline(!navigator.onLine);

        const handleOnline = () => setIsOffline(false);
        const handleOffline = () => setIsOffline(true);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    if (!isOffline) return null;

    return (
        <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center gap-2 bg-warning/90 px-4 py-2 text-sm font-medium text-warning-foreground">
            <WifiOff className="h-4 w-4" />
            <span>{t('message')}</span>
        </div>
    );
}
