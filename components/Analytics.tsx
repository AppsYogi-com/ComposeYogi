// ============================================
// ComposeYogi — Privacy-First Analytics
// ============================================
//
// Opt-in and inert by default. With no environment variable set, nothing is
// loaded and no request is made — which is the same promise the rest of the app
// makes: with no keys configured, ComposeYogi is entirely local.
//
// Supports Plausible and Umami. Both are self-hostable, open source, and
// cookie-free: no cross-site identifiers, no personal data, nothing that would
// need a consent banner.
//
// To enable, set one of these (see .env.example):
//   NEXT_PUBLIC_PLAUSIBLE_DOMAIN   — plus NEXT_PUBLIC_PLAUSIBLE_HOST to self-host
//   NEXT_PUBLIC_UMAMI_WEBSITE_ID   — plus NEXT_PUBLIC_UMAMI_HOST

import Script from 'next/script';

const PLAUSIBLE_DEFAULT_HOST = 'https://plausible.io';

export function Analytics() {
    const plausibleDomain = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN;
    const umamiWebsiteId = process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID;
    const umamiHost = process.env.NEXT_PUBLIC_UMAMI_HOST;

    if (plausibleDomain) {
        const host = process.env.NEXT_PUBLIC_PLAUSIBLE_HOST || PLAUSIBLE_DEFAULT_HOST;
        return (
            <Script
                defer
                data-domain={plausibleDomain}
                src={`${host}/js/script.js`}
                strategy="afterInteractive"
            />
        );
    }

    if (umamiWebsiteId && umamiHost) {
        return (
            <Script
                defer
                data-website-id={umamiWebsiteId}
                src={`${umamiHost}/script.js`}
                strategy="afterInteractive"
            />
        );
    }

    return null;
}
