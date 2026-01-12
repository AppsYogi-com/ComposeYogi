import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
    return {
        rules: {
            userAgent: '*',
            allow: '/',
            disallow: ['/api/', '*/compose', '/_next/'], // Don't index compose pages (any locale)
        },
        sitemap: 'https://composeyogi.com/sitemap.xml',
    };
}
