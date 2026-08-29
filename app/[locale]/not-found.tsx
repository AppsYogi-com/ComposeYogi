// ============================================
// ComposeYogi — Not Found (localized)
// ============================================
//
// The 404 for anything inside a locale segment, which after the middleware's
// rewrite is very nearly everything. It renders a real 404 rather than
// redirecting: bouncing a bad link to the home page tells the visitor nothing
// about what went wrong, and answers 200 to a URL that does not exist.

import { getTranslations } from 'next-intl/server';

import { NotFoundContent } from '@/components/NotFoundContent';

import type { Metadata } from 'next';

export async function generateMetadata(): Promise<Metadata> {
    const t = await getTranslations('notFound');
    return {
        title: t('metaTitle'),
        description: t('metaDescription'),
        robots: 'noindex, nofollow',
    };
}

export default async function LocaleNotFound() {
    const t = await getTranslations('notFound');

    return (
        <NotFoundContent
            heading={t('heading')}
            description={t('description')}
            goHome={t('goHome')}
            openStudio={t('openStudio')}
            homeHref="/"
            studioHref="/compose"
        />
    );
}
