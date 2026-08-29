// ============================================
// ComposeYogi — Not Found
// ============================================
//
// Shared by both 404 routes: the one inside the locale segment, which handles
// almost everything, and the root one, which catches paths the middleware never
// rewrote. Neither can borrow the other's translation context — the root page
// sits outside `[locale]` entirely — so the strings arrive as props and each
// route resolves them its own way.

import Link from 'next/link';

interface NotFoundContentProps {
    heading: string;
    description: string;
    goHome: string;
    openStudio: string;
    /** Locale-prefixed hrefs, since this renders outside the locale router. */
    homeHref: string;
    studioHref: string;
}

export function NotFoundContent({
    heading,
    description,
    goHome,
    openStudio,
    homeHref,
    studioHref,
}: NotFoundContentProps) {
    return (
        <main className="flex min-h-screen flex-col items-center justify-center bg-background p-6 text-center">
            {/* Not translated: a status code is the same number everywhere. */}
            <p className="font-mono text-5xl font-bold text-accent">404</p>

            <h1 className="mt-4 text-xl font-semibold text-foreground">{heading}</h1>
            <p className="mt-2 max-w-sm text-sm text-muted-foreground">{description}</p>

            <div className="mt-8 flex items-center gap-3">
                <Link
                    href={studioHref}
                    className="rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-accent-foreground transition-colors duration-fast ease-out hover:bg-accent/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                    {openStudio}
                </Link>
                <Link
                    href={homeHref}
                    className="rounded-full border border-border px-5 py-2.5 text-sm font-medium text-foreground transition-colors duration-fast ease-out hover:bg-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                    {goHome}
                </Link>
            </div>
        </main>
    );
}
