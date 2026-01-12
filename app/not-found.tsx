import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
    title: 'Page Not Found - ComposeYogi',
    description: 'The page you are looking for does not exist.',
    robots: 'noindex, nofollow'
};

export default async function GlobalNotFound() {
    // Get the headers to determine the preferred locale
    const headersList = await headers();
    const acceptLanguage = headersList.get('accept-language') || '';

    // Simple locale detection
    const preferredLocale = acceptLanguage.includes('es') ? 'es' : 'en';

    // Redirect to localized home page
    redirect(`/${preferredLocale}`);

    // Fallback (won't render due to redirect)
    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
            <h1 className="text-4xl font-bold mb-4">404</h1>
            <p className="text-muted-foreground mb-6">Page not found</p>
            <Link
                href="/"
                className="text-accent hover:underline"
            >
                Go home
            </Link>
        </div>
    );
}
