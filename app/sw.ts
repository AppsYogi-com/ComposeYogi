import { defaultCache } from '@serwist/next/worker';
import type { PrecacheEntry, SerwistGlobalConfig } from 'serwist';
import { Serwist, CacheFirst, StaleWhileRevalidate, ExpirationPlugin, CacheableResponsePlugin } from 'serwist';

// This declares the value of `injectionPoint` to TypeScript.
declare global {
    interface WorkerGlobalScope extends SerwistGlobalConfig {
        __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
    }
}

declare const self: WorkerGlobalScope & typeof globalThis;

const serwist = new Serwist({
    precacheEntries: self.__SW_MANIFEST,
    skipWaiting: true,
    clientsClaim: true,
    navigationPreload: true,
    runtimeCaching: [
        ...defaultCache,
        // Cache audio samples for offline use
        {
            matcher: ({ url }) => /\/samples\/.*\.(wav|mp3|ogg)$/i.test(url.pathname),
            handler: new CacheFirst({
                cacheName: 'audio-samples',
                plugins: [
                    new ExpirationPlugin({
                        maxEntries: 100,
                        maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
                    }),
                    new CacheableResponsePlugin({
                        statuses: [0, 200],
                    }),
                ],
            }),
        },
        // Cache fonts
        {
            matcher: ({ url }) => /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i.test(url.href),
            handler: new CacheFirst({
                cacheName: 'google-fonts',
                plugins: [
                    new ExpirationPlugin({
                        maxEntries: 20,
                        maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
                    }),
                    new CacheableResponsePlugin({
                        statuses: [0, 200],
                    }),
                ],
            }),
        },
        // Cache images
        {
            matcher: ({ request }) => request.destination === 'image',
            handler: new StaleWhileRevalidate({
                cacheName: 'images',
                plugins: [
                    new ExpirationPlugin({
                        maxEntries: 50,
                        maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
                    }),
                ],
            }),
        },
    ],
});

serwist.addEventListeners();
