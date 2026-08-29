'use client';

import { useEffect, useState } from 'react';

interface MusicWaveProps {
    barCount?: number;
    /** Must set a height — the bars are sized as a percentage of this box. */
    className?: string;
    color?: 'accent' | 'accent-foreground' | 'primary' | 'foreground';
    /**
     * `tight` inside the logo mark, where four bars at the normal gap span 28
     * of the mark's 32 pixels and leave the wave touching both edges.
     */
    spacing?: 'tight' | 'normal';
}

export function MusicWave({
    barCount = 5,
    className = '',
    color = 'accent-foreground',
    spacing = 'normal',
}: MusicWaveProps) {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    // Written out rather than interpolated — Tailwind reads class names from
    // source text, so `gap-${...}` would produce no CSS at all.
    const gapClass = spacing === 'tight' ? 'gap-0.5' : 'gap-1';

    const colorClass = {
        'accent': 'bg-accent',
        'accent-foreground': 'bg-accent-foreground',
        'primary': 'bg-primary',
        'foreground': 'bg-foreground',
    }[color];

    if (!mounted) {
        return (
            <div className={`flex items-end justify-center ${gapClass} ${className}`}>
                {Array.from({ length: barCount }).map((_, i) => (
                    <div
                        key={i}
                        className={`w-1 ${colorClass}/50 rounded-full`}
                        style={{ height: '50%' }}
                    />
                ))}
            </div>
        );
    }

    return (
        <div className={`flex items-end justify-center ${gapClass} ${className}`}>
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
