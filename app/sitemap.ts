import { MetadataRoute } from 'next';

import { APP_CONFIG } from '@/config/app';
import { routing } from '@/i18n/routing';

/**
 * Real pages only — the landing page and the studio, in each locale. There is
 * deliberately no generated content here: pages exist because a musician would
 * want to land on them, not to give a crawler something to index.
 */
export default function sitemap(): MetadataRoute.Sitemap {
    const baseUrl = APP_CONFIG.baseUrl;
    const lastModified = new Date();

    return routing.locales.flatMap((locale) => {
        // The default locale is served from the root path.
        const prefix = locale === routing.defaultLocale ? '' : `/${locale}`;

        return [
            {
                url: `${baseUrl}${prefix}` || baseUrl,
                lastModified,
                changeFrequency: 'weekly' as const,
                priority: 1,
            },
            {
                url: `${baseUrl}${prefix}/compose`,
                lastModified,
                changeFrequency: 'weekly' as const,
                priority: 0.9,
            },
        ];
    });
}
