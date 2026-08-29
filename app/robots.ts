import { MetadataRoute } from 'next';

import { APP_CONFIG } from '@/config/app';

export default function robots(): MetadataRoute.Robots {
    return {
        rules: {
            userAgent: '*',
            allow: '/',
            // The studio itself was disallowed here, which kept the actual
            // product out of search results. Only internals stay blocked.
            disallow: ['/api/', '/_next/'],
        },
        sitemap: `${APP_CONFIG.baseUrl}/sitemap.xml`,
    };
}
