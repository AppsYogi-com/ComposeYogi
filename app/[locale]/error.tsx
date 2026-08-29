'use client';

// ============================================
// ComposeYogi — Route Error Boundary
// ============================================
//
// Next.js renders this in place of the segment when a render throws. It is the
// backstop for anything the in-app ErrorBoundary does not wrap.

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';

import { createLogger } from '@/lib/logger';

const logger = createLogger('RouteError');

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    const t = useTranslations('errors');

    useEffect(() => {
        logger.error('Route render failed', { message: error.message, digest: error.digest });
    }, [error]);

    return (
        <div
            role="alert"
            className="flex min-h-screen items-center justify-center bg-background p-6"
        >
            <div className="max-w-md text-center">
                <h1 className="text-xl font-semibold text-foreground">{t('boundaryTitle')}</h1>
                <p className="mt-2 text-sm text-muted-foreground">{t('boundaryDescription')}</p>

                <div className="mt-6 flex items-center justify-center gap-2">
                    <button
                        onClick={reset}
                        className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                    >
                        {t('boundaryRetry')}
                    </button>
                    <button
                        onClick={() => window.location.reload()}
                        className="rounded-md border border-border px-4 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                    >
                        {t('boundaryReload')}
                    </button>
                </div>
            </div>
        </div>
    );
}
