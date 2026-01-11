'use client';

import { useEffect, useState } from 'react';

interface MusicWaveProps {
    barCount?: number;
    className?: string;
    color?: 'accent' | 'accent-foreground' | 'primary' | 'foreground';
}

export function MusicWave({ barCount = 5, className = '', color = 'accent-foreground' }: MusicWaveProps) {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    const colorClass = {
        'accent': 'bg-accent',
        'accent-foreground': 'bg-accent-foreground',
        'primary': 'bg-primary',
        'foreground': 'bg-foreground',
    }[color];

    if (!mounted) {
        return (
            <div className={`flex items-end justify-center gap-1 ${className}`}>
                {Array.from({ length: barCount }).map((_, i) => (
                    <div
                        key={i}
                        className={`w-1 ${colorClass}/50 rounded-full`}
                        style={{ height: '12px' }}
                    />
                ))}
            </div>
        );
    }

    return (
        <div className={`flex items-end justify-center gap-1 ${className}`}>
            {Array.from({ length: barCount }).map((_, i) => (
                <div
                    key={i}
                    className={`w-1 ${colorClass} rounded-full music-bar`}
                    style={{
                        animationDelay: `${i * 0.1}s`,
                    }}
                />
            ))}
        </div>
    );
}
