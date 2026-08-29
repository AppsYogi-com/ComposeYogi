// ============================================
// ComposeYogi — Not Found (root)
// ============================================
//
// The fallback for paths the locale middleware never rewrote. It sits outside
// `[locale]`, so there is no request locale to read and no provider overhead —
// the language is taken from Accept-Language and the messages are loaded for it
// directly.
//
// It used to redirect to the home page instead of rendering, which meant its
// own markup was unreachable and a mistyped URL answered 200 from somewhere the
// visitor never asked for.

import { headers } from 'next/headers';
import { getTranslations } from 'next-intl/server';

import { NotFoundContent } from '@/components/NotFoundContent';
import { defaultLocale, locales } from '@/config/i18n';

import type { Metadata } from 'next';

/** First locale the visitor asks for that this app actually speaks. */
async function preferredLocale(): Promise<string> {
    const header = (await headers()).get('accept-language') ?? '';
    const requested = header
        .split(',')
        .map((part) => part.split(';')[0].trim().toLowerCase())
        .filter(Boolean);

    for (const tag of requested) {
        const base = tag.split('-')[0];
        const match = locales.find((locale) => locale === tag || locale === base);
        if (match) return match;
    }
    return defaultLocale;
}

export const metadata: Metadata = {
    robots: 'noindex, nofollow',
};

export default async function RootNotFound() {
    const locale = await preferredLocale();
    const t = await getTranslations({ locale, namespace: 'notFound' });
    const prefix = locale === defaultLocale ? '' : `/${locale}`;

    return (
        <NotFoundContent
            heading={t('heading')}
            description={t('description')}
            goHome={t('goHome')}
            openStudio={t('openStudio')}
            homeHref={prefix || '/'}
            studioHref={`${prefix}/compose`}
        />
    );
}
