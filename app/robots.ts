import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
    return {
        rules: {
            userAgent: '*',
            allow: '/',
            disallow: ['/api/', '/compose', '/_next/'], // Don't index the compose page (user-specific)
        },
        sitemap: 'https://composeyogi.com/sitemap.xml',
    };
}
