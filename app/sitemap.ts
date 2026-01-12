import { MetadataRoute } from 'next';
import { APP_CONFIG } from '@/config/app';

export default function sitemap(): MetadataRoute.Sitemap {
    const baseUrl = APP_CONFIG.baseUrl;

    return [
        {
            url: baseUrl,
            lastModified: new Date(),
            changeFrequency: 'weekly',
            priority: 1,
        },
        {
            url: `${baseUrl}/es`,
            lastModified: new Date(),
            changeFrequency: 'weekly',
            priority: 1,
        }
    ];
}
