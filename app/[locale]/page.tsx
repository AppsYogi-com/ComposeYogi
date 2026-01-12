import { setRequestLocale } from 'next-intl/server';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Play, Music, Twitter, Linkedin, Instagram, Github } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { MusicWave } from '@/components/MusicWave';
import { TooltipProvider } from '@/components/ui/tooltip';
import { APP_CONFIG } from '@/config/app';
import { DemoTemplates } from '@/components/home/DemoTemplates';
import { PWAInstallButton } from '@/components/PWAInstallButton';

interface PageProps {
    params: Promise<{ locale: string }>;
}

export default async function HomePage({ params }: PageProps) {
    const { locale } = await params;
    setRequestLocale(locale);

    return <HomePageContent />;
}

function HomePageContent() {
    const t = useTranslations();

    return (
        <main className="flex min-h-screen flex-col bg-background">
            {/* Header - Top Right */}
            <div className="absolute top-0 right-0 z-20 flex items-center gap-3 px-4 py-3 sm:px-6 sm:py-4">
                <a
                    href="https://github.com/AppsYogi-com/ComposeYogi"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex"
                >
                    <img
                        src="https://img.shields.io/github/stars/AppsYogi-com/ComposeYogi?style=social"
                        alt="GitHub Stars"
                        className="h-5"
                    />
                </a>
                <TooltipProvider>
                    <PWAInstallButton />
                    <ThemeToggle />
                    <LanguageSwitcher />
                </TooltipProvider>
            </div>

            {/* Hero Section - Full screen centered */}
            <section className="relative flex flex-1 flex-col items-center justify-center px-4 pt-20 sm:pt-0">
                {/* Background gradient */}
                <div className="absolute inset-0 bg-gradient-to-b from-accent/5 via-transparent to-transparent" />

                {/* Content */}
                <div className="relative z-10 max-w-4xl text-center">
                    {/* Logo with Music Wave */}
                    <div className="mb-8 flex items-center justify-center gap-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent">
                            <MusicWave barCount={5} className="h-6" />
                        </div>
                        <span className="text-2xl font-bold">{t('app.name')}</span>
                    </div>

                    {/* Headline */}
                    <h1 className="mb-4 text-5xl font-bold tracking-tight sm:text-6xl md:text-7xl">
                        {t('landing.hero.title')}
                    </h1>
                    <p className="mb-8 text-2xl text-muted-foreground sm:text-3xl">
                        {t('landing.hero.subtitle')}
                    </p>

                    {/* CTA Button */}
                    <Link
                        href="/compose"
                        className="group inline-flex items-center gap-3 rounded-full bg-accent px-8 py-4 text-lg font-semibold text-accent-foreground transition-all hover:scale-105 hover:shadow-lg hover:shadow-accent/25"
                    >
                        <Play className="h-5 w-5 transition-transform group-hover:scale-110" />
                        {t('landing.hero.cta')}
                    </Link>
                    <p className="mt-4 text-sm text-muted-foreground">
                        {t('landing.hero.ctaSubtext')}
                    </p>

                    {/* Demo Templates */}
                    <DemoTemplates />
                </div>
            </section>

            {/* Footer */}
            <footer className="mt-8 border-t border-border py-6 px-4">
                <div className="mx-auto max-w-6xl flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
                    <p>{t('footer.copyright', { year: new Date().getFullYear() })}</p>

                    {/* Social Links */}
                    <div className="flex items-center gap-4">
                        <a
                            href={APP_CONFIG.social.x}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:text-primary transition-colors"
                            aria-label="X (Twitter)"
                        >
                            <Twitter className="h-4 w-4" />
                        </a>
                        <a
                            href={APP_CONFIG.social.linkedIn}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:text-primary transition-colors"
                            aria-label="LinkedIn"
                        >
                            <Linkedin className="h-4 w-4" />
                        </a>
                        <a
                            href={APP_CONFIG.social.instagram}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:text-primary transition-colors"
                            aria-label="Instagram"
                        >
                            <Instagram className="h-4 w-4" />
                        </a>
                        <a
                            href={APP_CONFIG.social.github}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:text-primary transition-colors"
                            aria-label="GitHub"
                        >
                            <Github className="h-4 w-4" />
                        </a>
                    </div>

                    <p>
                        {t.rich('footer.madeWith', {
                            company: (chunks) => (
                                <a
                                    href={APP_CONFIG.company.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-primary hover:underline"
                                >
                                    {APP_CONFIG.company.name}
                                </a>
                            )
                        })}
                    </p>
                </div>
            </footer>
        </main>
    );
}
