'use client';

// ============================================
// ComposeYogi — Settings Menu
// ============================================
//
// One gear where there were four icons: the shortcuts sheet, latency
// calibration, the theme toggle and the language switcher.
//
// They were four separate glyphs in the tightest part of the header, and none
// of them is something you touch while you are working — you set the theme once
// and the language once, you calibrate once, and you open the shortcuts sheet
// when you have forgotten a key. A control you use once does not deserve
// permanent width in a bar that had 0px of slack.
//
// Theme and language stay *visible* rather than hidden behind a submenu,
// because their current value is the useful part: the menu says which language
// you are in and which theme is on, and a submenu would hide both behind
// another click.

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useTheme } from 'next-themes';
import { Check, Gauge, Keyboard, Languages, Moon, Settings, Sun } from 'lucide-react';

import { useRouter, usePathname } from '@/i18n/navigation';
import { locales, localeFlags, localeNames, type Locale } from '@/config/i18n';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuShortcut,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface SettingsMenuProps {
    onOpenShortcuts: () => void;
    onOpenCalibration: () => void;
}

export function SettingsMenu({ onOpenShortcuts, onOpenCalibration }: SettingsMenuProps) {
    const t = useTranslations('transport');
    const tCommon = useTranslations('common');
    const tLanguage = useTranslations('language');

    const { resolvedTheme, setTheme } = useTheme();
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);

    const params = useParams();
    const router = useRouter();
    const pathname = usePathname();
    const currentLocale = (params.locale as Locale) || 'en';

    // Before hydration `resolvedTheme` is undefined, and rendering the wrong
    // icon for a frame is worse than rendering the light one: the menu would
    // flip under the cursor. The label follows the icon either way.
    const isDark = mounted && resolvedTheme === 'dark';

    return (
        <DropdownMenu>
            <Tooltip>
                <TooltipTrigger asChild>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon-sm" aria-label={t('settings')}>
                            <Settings className="h-4 w-4" />
                        </Button>
                    </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                    <p>{t('settings')}</p>
                </TooltipContent>
            </Tooltip>

            <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem onClick={onOpenShortcuts} className="cursor-pointer">
                    <Keyboard className="mr-2 h-4 w-4" />
                    <span className="flex-1">{t('shortcuts')}</span>
                    <DropdownMenuShortcut>?</DropdownMenuShortcut>
                </DropdownMenuItem>

                {/* A gauge, not a gear. This opens latency calibration and
                    nothing else, and a second gear inside the gear menu said
                    "settings" twice while naming the one thing it actually
                    does — measuring how late your audio comes back. */}
                <DropdownMenuItem onClick={onOpenCalibration} className="cursor-pointer">
                    <Gauge className="mr-2 h-4 w-4" />
                    <span className="flex-1">{t('calibration')}</span>
                </DropdownMenuItem>

                <DropdownMenuSeparator />

                <DropdownMenuItem
                    onClick={() => setTheme(isDark ? 'light' : 'dark')}
                    className="cursor-pointer"
                    disabled={!mounted}
                >
                    {isDark ? <Sun className="mr-2 h-4 w-4" /> : <Moon className="mr-2 h-4 w-4" />}
                    <span className="flex-1">
                        {mounted ? (isDark ? t('lightMode') : t('darkMode')) : tCommon('toggleTheme')}
                    </span>
                </DropdownMenuItem>

                <DropdownMenuSeparator />

                <DropdownMenuLabel className="flex items-center gap-2 text-xs font-normal text-muted-foreground">
                    <Languages className="h-3.5 w-3.5" />
                    {tLanguage('label')}
                </DropdownMenuLabel>

                {locales.map((locale) => (
                    <DropdownMenuItem
                        key={locale}
                        onClick={() => {
                            if (locale !== currentLocale) router.replace(pathname, { locale });
                        }}
                        className="cursor-pointer"
                    >
                        <span className="mr-2 text-base">{localeFlags[locale]}</span>
                        <span className="flex-1">{localeNames[locale]}</span>
                        {currentLocale === locale && <Check className="h-4 w-4" />}
                    </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
