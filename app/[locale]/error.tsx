'use client';

// ============================================
// ComposeYogi — Route Error Boundary
// ============================================
//
// Next.js renders this in place of the segment when a render throws. It is the
// backstop for anything the in-app ErrorBoundary does not wrap.

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';

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
                    <Button
                        onClick={reset}
                        variant="transport-active"
                        >
                        {t('boundaryRetry')}
                    </Button>
                    <Button
                        onClick={() => window.location.reload()}
                        variant="outline"
                        >
                        {t('boundaryReload')}
                    </Button>
                </div>
            </div>
        </div>
    );
}
