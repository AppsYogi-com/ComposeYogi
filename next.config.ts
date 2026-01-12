import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';
import withSerwistInit from '@serwist/next';

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

const withSerwist = withSerwistInit({
    swSrc: 'app/sw.ts',
    swDest: 'public/sw.js',
    disable: false, // Enable for testing, set back to: process.env.NODE_ENV === 'development'
});

const nextConfig: NextConfig = {
    // Enable standalone output for Docker
    output: 'standalone',

    // Enable React strict mode for better development experience
    reactStrictMode: true,

    // Optimize images
    images: {
        formats: ['image/avif', 'image/webp'],
    },

    // Headers for audio worklet and SharedArrayBuffer support
    async headers() {
        return [
            {
                source: '/(.*)',
                headers: [
                    {
                        key: 'Cross-Origin-Opener-Policy',
                        value: 'same-origin',
                    },
                    {
                        key: 'Cross-Origin-Embedder-Policy',
                        value: 'credentialless',
                    },
                ],
            },
        ];
    },

    // Webpack configuration for audio workers
    webpack: (config, { isServer }) => {
        // Allow importing audio files
        config.module.rules.push({
            test: /\.(mp3|wav|ogg)$/,
            type: 'asset/resource',
        });

        return config;
    },
};

export default withSerwist(withNextIntl(nextConfig));
