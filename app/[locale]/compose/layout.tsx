'use client';

import { useEffect } from 'react';
import { audioEngine } from '@/lib/audio';

interface ComposeLayoutProps {
    children: React.ReactNode;
}

export default function ComposeLayout({ children }: ComposeLayoutProps) {
    // Initialize audio engine on mount
    useEffect(() => {
        // Audio context will be initialized on first user interaction
        // due to browser autoplay policies
        return () => {
            // Cleanup on unmount
            audioEngine.stop();
        };
    }, []);

    return (
        <div className="flex h-screen flex-col overflow-hidden bg-background">
            {children}
        </div>
    );
}
