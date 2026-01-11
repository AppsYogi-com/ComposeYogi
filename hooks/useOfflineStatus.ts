'use client';

import { useEffect, useState } from 'react';

// ============================================
// Hook for Offline Status Detection
// ============================================

export function useOfflineStatus() {
    const [isOnline, setIsOnline] = useState(true);
    const [wasOffline, setWasOffline] = useState(false);

    useEffect(() => {
        // Initial state
        setIsOnline(navigator.onLine);

        const handleOnline = () => {
            setIsOnline(true);
            // Track that we were offline (for showing "reconnected" message)
            if (!navigator.onLine) {
                setWasOffline(true);
            }
        };

        const handleOffline = () => {
            setIsOnline(false);
            setWasOffline(true);
        };

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    const clearWasOffline = () => setWasOffline(false);

    return {
        isOnline,
        isOffline: !isOnline,
        wasOffline,
        clearWasOffline,
    };
}
