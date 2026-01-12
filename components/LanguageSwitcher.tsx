'use client';

import { useParams } from 'next/navigation';
import { useRouter, usePathname } from '@/i18n/navigation';
import { Languages, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { locales, localeNames, localeFlags, localeSymbols, type Locale } from '@/config/i18n';

export function LanguageSwitcher() {
    const params = useParams();
    const router = useRouter();
    const pathname = usePathname();
    const currentLocale = (params.locale as Locale) || 'en';

    const handleSelect = (locale: Locale) => {
        if (locale !== currentLocale) {
            router.replace(pathname, { locale });
        }
    };

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm">
                    <Languages className="h-4 w-4" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                {locales.map((locale) => (
                    <DropdownMenuItem
                        key={locale}
                        onClick={() => handleSelect(locale)}
                        className="flex items-center gap-3 cursor-pointer"
                    >
                        <span className="text-base">{localeFlags[locale]}</span>
                        <span className="flex-1">{localeNames[locale]}</span>
                        <span className="text-xs text-muted-foreground font-mono">
                            {localeSymbols[locale]}
                        </span>
                        {currentLocale === locale && (
                            <Check className="h-4 w-4" />
                        )}
                    </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
