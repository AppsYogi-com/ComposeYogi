import type { Metadata, Viewport } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';
import { ThemeProvider } from '@/components/ThemeProvider';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from '@/components/ui/sonner';
import { OfflineIndicator } from '@/components/OfflineIndicator';
import Script from 'next/script';
import '@/app/globals.css';

// Load Inter for UI text
const inter = Inter({
    subsets: ['latin'],
    display: 'swap',
    variable: '--font-inter',
});

// Load JetBrains Mono for monospace (BPM, time display)
const jetbrainsMono = JetBrains_Mono({
    subsets: ['latin'],
    display: 'swap',
    variable: '--font-mono',
});

export const metadata: Metadata = {
    title: {
        default: 'ComposeYogi — Make real music. Instantly. In your browser.',
        template: '%s | ComposeYogi',
    },
    description:
        'The world\'s most intuitive online music composer — create professional beats without installing anything. Ableton-like DAW in your browser.',
    keywords: [
        'music composer',
        'online DAW',
        'beat maker',
        'music production',
        'browser DAW',
        'free music maker',
        'loop maker',
        'drum machine',
        'piano roll',
    ],
    icons: {
        icon: [
            { url: '/favicon.svg', type: 'image/svg+xml' },
        ],
        apple: '/icons/apple-touch-icon.png',
    },
    manifest: '/manifest.json',
    appleWebApp: {
        capable: true,
        statusBarStyle: 'black-translucent',
        title: 'ComposeYogi',
    },
    authors: [{ name: 'ComposeYogi' }],
    creator: 'ComposeYogi',
    openGraph: {
        type: 'website',
        locale: 'en_US',
        url: 'https://composeyogi.com',
        siteName: 'ComposeYogi',
        title: 'ComposeYogi — Make real music. Instantly. In your browser.',
        description:
            'Create professional music without installing anything. Free online DAW with Ableton-like interface.',
        images: [
            {
                url: '/og-image.png',
                width: 1200,
                height: 630,
                alt: 'ComposeYogi - Online Music Composer',
            },
        ],
    },
    twitter: {
        card: 'summary_large_image',
        title: 'ComposeYogi — Make real music. Instantly.',
        description: 'Create professional music in your browser. Free online DAW.',
        images: ['/og-image.png'],
    },
    robots: {
        index: true,
        follow: true,
    },
};

export const viewport: Viewport = {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
    themeColor: '#f97316',
};

export function generateStaticParams() {
    return routing.locales.map((locale) => ({ locale }));
}

interface RootLayoutProps {
    children: React.ReactNode;
    params: Promise<{ locale: string }>;
}

export default async function RootLayout({ children, params }: RootLayoutProps) {
    const { locale } = await params;

    // Validate locale
    if (!routing.locales.includes(locale as any)) {
        notFound();
    }

    // Enable static rendering
    setRequestLocale(locale);

    // Get messages for the locale
    const messages = await getMessages();

    return (
        <html lang={locale} suppressHydrationWarning className={`${inter.variable} ${jetbrainsMono.variable}`}>
            <body className="min-h-screen bg-background text-foreground antialiased font-sans">
                <ThemeProvider
                    attribute="class"
                    defaultTheme="dark"
                    enableSystem={false}
                    disableTransitionOnChange
                >
                    <NextIntlClientProvider messages={messages}>
                        <TooltipProvider delayDuration={300}>
                            <OfflineIndicator />
                            {children}
                        </TooltipProvider>
                        <Toaster position="bottom-right" theme="dark" />
                    </NextIntlClientProvider>
                </ThemeProvider>
                <Script src="https://userhero.co/widget.js" data-key="pk_live_f1iT3MsNLDWy88b4w9ty" strategy="lazyOnload" />
            </body>
        </html>
    );
}
