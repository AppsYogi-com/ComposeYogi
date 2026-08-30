'use client';

// ============================================
// ComposeYogi — Error Boundary
// ============================================
//
// A crash inside the arrangement view used to take the whole page with it,
// which in a local-first app means the user is staring at a blank screen with
// their project still safely in IndexedDB and no way back to it. This catches
// the crash, keeps the app shell alive, and offers a reload — autosave has
// already written their work, so reloading recovers it.

import { Component, type ErrorInfo, type ReactNode } from 'react';

import { createLogger } from '@/lib/logger';
import { Button } from '@/components/ui/button';

const logger = createLogger('ErrorBoundary');

interface ErrorBoundaryProps {
    children: ReactNode;
    /** Rendered instead of the default panel. Receives the error and a reset. */
    fallback?: (error: Error, reset: () => void) => ReactNode;
    /** Name of the area being guarded, for the log line. */
    area?: string;
    /**
     * Translated copy. A class component cannot call the next-intl hook, so
     * callers pass the strings in; the English defaults are a last resort for
     * a boundary that is itself outside the locale provider.
     */
    messages?: {
        title: string;
        description: string;
        reload: string;
        retry: string;
    };
}

const DEFAULT_MESSAGES = {
    title: 'Something went wrong',
    description: 'Your project is saved. Reloading should pick up where you left off.',
    reload: 'Reload',
    retry: 'Try again',
};

interface ErrorBoundaryState {
    error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
    state: ErrorBoundaryState = { error: null };

    static getDerivedStateFromError(error: Error): ErrorBoundaryState {
        return { error };
    }

    componentDidCatch(error: Error, info: ErrorInfo): void {
        logger.error('Caught render error', {
            area: this.props.area ?? 'app',
            message: error.message,
            componentStack: info.componentStack,
        });
    }

    private reset = (): void => {
        this.setState({ error: null });
    };

    private reload = (): void => {
        window.location.reload();
    };

    render(): ReactNode {
        const { error } = this.state;
        if (!error) return this.props.children;

        if (this.props.fallback) {
            return this.props.fallback(error, this.reset);
        }

        const messages = this.props.messages ?? DEFAULT_MESSAGES;

        return (
            <div
                role="alert"
                className="flex h-full min-h-[240px] w-full items-center justify-center bg-background p-6"
            >
                <div className="max-w-md text-center">
                    <h2 className="text-lg font-semibold text-foreground">
                        {messages.title}
                    </h2>
                    <p className="mt-2 text-sm text-muted-foreground">
                        {messages.description}
                    </p>

                    <div className="mt-5 flex items-center justify-center gap-2">
                        <Button
                            onClick={this.reload}
                            variant="transport-active"
                            >
                            {messages.reload}
                        </Button>
                        <Button
                            onClick={this.reset}
                            variant="outline"
                            >
                            {messages.retry}
                        </Button>
                    </div>

                    {process.env.NODE_ENV === 'development' && (
                        <pre className="mt-5 max-h-40 overflow-auto rounded-md bg-surface-elevated p-3 text-left text-xs text-muted-foreground">
                            {error.message}
                        </pre>
                    )}
                </div>
            </div>
        );
    }
}
