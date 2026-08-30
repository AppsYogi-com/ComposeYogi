'use client';

import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useTranslations } from 'next-intl';

export function ThemeToggle() {
    const t = useTranslations('common');
    const { setTheme, resolvedTheme } = useTheme();
    const [mounted, setMounted] = useState(false);

    // Prevent hydration mismatch
    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) {
        return (
            <Button aria-label={t('toggleTheme')} variant="ghost" size="icon-sm" disabled>
                <Sun className="h-4 w-4" />
            </Button>
        );
    }

    const isDark = resolvedTheme === 'dark';

    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <Button
                    aria-label={isDark ? t('themeToLight') : t('themeToDark')}
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setTheme(isDark ? 'light' : 'dark')}
                >
                    {isDark ? (
                        <Sun className="h-4 w-4" />
                    ) : (
                        <Moon className="h-4 w-4" />
                    )}
                </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
                <p>{isDark ? t('themeToLight') : t('themeToDark')}</p>
            </TooltipContent>
        </Tooltip>
    );
}
