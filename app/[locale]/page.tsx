import { setRequestLocale } from 'next-intl/server';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import {
    ArrowRight,
    Github,
    Instagram,
    Linkedin,
    Mic,
    Play,
    Sliders,
    Twitter,
    WifiOff,
} from 'lucide-react';

import { Link } from '@/i18n/navigation';
import { ThemeToggle } from '@/components/ThemeToggle';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { MusicWave } from '@/components/MusicWave';
import { TooltipProvider } from '@/components/ui/tooltip';
import { PWAInstallButton } from '@/components/PWAInstallButton';
import { DemoTemplates } from '@/components/home/DemoTemplates';
import { APP_CONFIG } from '@/config/app';
import { SYNTH_PRESET_IDS } from '@/lib/audio/synth-presets';
import { DEMO_TEMPLATES } from '@/lib/templates';

interface PageProps {
    params: Promise<{ locale: string }>;
}

// ============================================
// Counts come from the source, not from copy
// ============================================
//
// "64 instruments" written into a translation file is a number that goes stale
// the first time someone adds a preset. These read the real collections.

const INSTRUMENT_COUNT = SYNTH_PRESET_IDS.length;
const TEMPLATE_COUNT = DEMO_TEMPLATES.length;

const GOOD_FIRST_ISSUES = `${APP_CONFIG.repository.url}/labels/good%20first%20issue`;
const ARCHITECTURE = `${APP_CONFIG.repository.url}/blob/main/ARCHITECTURE.md`;

// Each feature borrows a hue from the track scale, so the page is coloured by
// the product's own palette rather than by a decoration invented for marketing.
const FEATURES = [
    { key: 'daw', Icon: Sliders, tint: 'text-track-keys', wash: 'bg-track-keys/10' },
    { key: 'recording', Icon: Mic, tint: 'text-track-drums', wash: 'bg-track-drums/10' },
    { key: 'offline', Icon: WifiOff, tint: 'text-track-melody', wash: 'bg-track-melody/10' },
    { key: 'export', Icon: ArrowRight, tint: 'text-track-fx', wash: 'bg-track-fx/10' },
] as const;

export default async function HomePage({ params }: PageProps) {
    const { locale } = await params;
    setRequestLocale(locale);

    return <HomePageContent />;
}

function HomePageContent() {
    const t = useTranslations();

    return (
        <div className="flex min-h-screen flex-col bg-background">
            <Header />

            <main className="flex-1">
                <Hero t={t} />
                <Showcase t={t} />
                <Features t={t} />
                <Paths t={t} />
                <FinalCta t={t} />
            </main>

            <Footer t={t} />
        </div>
    );
}

// ============================================
// Header
// ============================================

function Header() {
    return (
        <header className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur">
            <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-6 py-3">
                <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-md bg-accent">
                        <MusicWave barCount={4} className="h-4" />
                    </div>
                    <span className="text-base font-semibold tracking-tight">ComposeYogi</span>
                </div>

                <div className="flex items-center gap-3">
                    <a
                        href={APP_CONFIG.repository.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hidden sm:flex"
                    >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
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
            </div>
        </header>
    );
}

// ============================================
// Hero
// ============================================
//
// The templates sit inside the hero rather than below it. The strongest thing
// this product can say is a sound, and the fastest route to one is a track that
// is already arranged — so nothing is allowed between the headline and them.

function Hero({ t }: { t: ReturnType<typeof useTranslations> }) {
    return (
        <section className="relative overflow-hidden">
            <div
                aria-hidden
                className="pointer-events-none absolute inset-x-0 top-0 h-[420px] bg-gradient-to-b from-accent/10 via-accent/[0.03] to-transparent"
            />

            <div className="relative mx-auto w-full max-w-5xl px-6 pb-16 pt-16 sm:pt-24">
                <div className="text-center">
                    <h1 className="text-balance text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
                        {t('landing.hero.title')}
                        <span className="block text-muted-foreground">
                            {t('landing.hero.subtitle')}
                        </span>
                    </h1>

                    <div className="mt-8 flex flex-col items-center gap-3">
                        <Link
                            href="/compose"
                            className="group inline-flex items-center gap-2.5 rounded-full bg-accent px-7 py-3.5 text-base font-semibold text-accent-foreground transition-all duration-fast ease-out hover:shadow-panel focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                        >
                            <Play className="h-4 w-4 fill-current" />
                            {t('landing.hero.cta')}
                        </Link>
                        <p className="text-sm text-muted-foreground">
                            {t('landing.hero.ctaSubtext')}
                        </p>
                    </div>

                    <DemoTemplates />
                </div>
            </div>
        </section>
    );
}

// ============================================
// Showcase
// ============================================

function Stat({ value, label }: { value: string; label: string }) {
    return (
        <div className="text-center">
            <div className="font-mono text-2xl font-semibold tabular-nums text-foreground">
                {value}
            </div>
            <div className="mt-0.5 text-xs text-muted-foreground">{label}</div>
        </div>
    );
}

function Showcase({ t }: { t: ReturnType<typeof useTranslations> }) {
    return (
        <section className="border-t border-border bg-surface/40">
            <div className="mx-auto w-full max-w-6xl px-6 py-20">
                <div className="mx-auto max-w-2xl text-center">
                    <h2 className="text-balance text-3xl font-bold tracking-tight sm:text-4xl">
                        {t('landing.showcase.title')}
                    </h2>
                    <p className="mt-3 text-muted-foreground">
                        {t('landing.showcase.subtitle')}
                    </p>
                </div>

                <div className="mt-12 overflow-hidden rounded-xl border border-border bg-surface shadow-panel">
                    <div className="flex items-center gap-1.5 border-b border-border px-4 py-2.5">
                        <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/30" />
                        <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/30" />
                        <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/30" />
                        <span className="ml-3 font-mono text-2xs text-muted-foreground">
                            composeyogi.com/compose
                        </span>
                    </div>
                    <Image
                        src="/screenshots/desktop-compose.png"
                        alt={t('landing.showcase.alt')}
                        width={3200}
                        height={1800}
                        className="w-full"
                        priority
                    />
                </div>

                <div className="mt-12 grid grid-cols-2 gap-8 sm:grid-cols-4">
                    <Stat value={String(INSTRUMENT_COUNT)} label={t('landing.stats.instruments')} />
                    <Stat value={String(TEMPLATE_COUNT)} label={t('landing.stats.templates')} />
                    <Stat
                        value={t('landing.stats.installValue')}
                        label={t('landing.stats.install')}
                    />
                    <Stat value={t('landing.stats.costValue')} label={t('landing.stats.cost')} />
                </div>
            </div>
        </section>
    );
}

// ============================================
// Features
// ============================================

function Features({ t }: { t: ReturnType<typeof useTranslations> }) {
    return (
        <section className="border-t border-border">
            <div className="mx-auto w-full max-w-6xl px-6 py-20">
                <h2 className="text-balance text-center text-3xl font-bold tracking-tight sm:text-4xl">
                    {t('landing.features.title')}
                </h2>

                <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {FEATURES.map(({ key, Icon, tint, wash }) => (
                        <div
                            key={key}
                            className="rounded-lg border border-border bg-surface p-5 transition-colors duration-base ease-out hover:border-border hover:bg-surface-elevated"
                        >
                            <div
                                className={`mb-4 flex h-10 w-10 items-center justify-center rounded-md ${wash}`}
                            >
                                <Icon className={`h-5 w-5 ${tint}`} />
                            </div>
                            <h3 className="text-base font-semibold">
                                {t(`landing.features.${key}.title`)}
                            </h3>
                            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                                {t(`landing.features.${key}.description`)}
                            </p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}

// ============================================
// Two paths
// ============================================
//
// Musicians first, and by more than order: the studio card is the one that
// carries the accent. The contributor path is real and prominent, but this is a
// page a musician should want to land on.

function Paths({ t }: { t: ReturnType<typeof useTranslations> }) {
    return (
        <section className="border-t border-border bg-surface/40">
            <div className="mx-auto w-full max-w-6xl px-6 py-20">
                <h2 className="text-balance text-center text-3xl font-bold tracking-tight sm:text-4xl">
                    {t('landing.paths.title')}
                </h2>

                <div className="mt-12 grid gap-4 md:grid-cols-2">
                    <div className="flex flex-col rounded-xl border border-accent/30 bg-accent/[0.06] p-7">
                        <h3 className="text-xl font-semibold">{t('landing.paths.musician.title')}</h3>
                        <p className="mt-2.5 flex-1 leading-relaxed text-muted-foreground">
                            {t('landing.paths.musician.body')}
                        </p>
                        <Link
                            href="/compose"
                            className="mt-6 inline-flex w-fit items-center gap-2 rounded-md bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground transition-colors duration-fast ease-out focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                        >
                            {t('landing.paths.musician.cta')}
                            <ArrowRight className="h-4 w-4" />
                        </Link>
                    </div>

                    <div className="flex flex-col rounded-xl border border-border bg-surface p-7">
                        <h3 className="text-xl font-semibold">{t('landing.paths.builder.title')}</h3>
                        <p className="mt-2.5 flex-1 leading-relaxed text-muted-foreground">
                            {t('landing.paths.builder.body')}
                        </p>
                        <div className="mt-6 flex flex-wrap items-center gap-2">
                            <a
                                href={GOOD_FIRST_ISSUES}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 rounded-md border border-border bg-surface-elevated px-4 py-2.5 text-sm font-semibold transition-colors duration-fast ease-out hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                            >
                                <Github className="h-4 w-4" />
                                {t('landing.paths.builder.cta')}
                            </a>
                            <a
                                href={ARCHITECTURE}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 rounded-md px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors duration-fast ease-out hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                            >
                                {t('landing.paths.builder.secondary')}
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}

// ============================================
// Final call to action
// ============================================

function FinalCta({ t }: { t: ReturnType<typeof useTranslations> }) {
    return (
        <section className="border-t border-border">
            <div className="mx-auto w-full max-w-3xl px-6 py-20 text-center">
                <h2 className="text-balance text-3xl font-bold tracking-tight sm:text-4xl">
                    {t('landing.finalCta.title')}
                </h2>
                <p className="mt-3 text-muted-foreground">{t('landing.finalCta.subtitle')}</p>
                <Link
                    href="/compose"
                    className="mt-8 inline-flex items-center gap-2.5 rounded-full bg-accent px-7 py-3.5 text-base font-semibold text-accent-foreground transition-all duration-fast ease-out hover:shadow-panel focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                    <Play className="h-4 w-4 fill-current" />
                    {t('landing.finalCta.cta')}
                </Link>
            </div>
        </section>
    );
}

// ============================================
// Footer
// ============================================

const SOCIALS = [
    { href: APP_CONFIG.social.x, Icon: Twitter, label: 'X (Twitter)' },
    { href: APP_CONFIG.social.linkedIn, Icon: Linkedin, label: 'LinkedIn' },
    { href: APP_CONFIG.social.instagram, Icon: Instagram, label: 'Instagram' },
    { href: APP_CONFIG.social.github, Icon: Github, label: 'GitHub' },
] as const;

function Footer({ t }: { t: ReturnType<typeof useTranslations> }) {
    return (
        <footer className="border-t border-border py-8">
            <div className="mx-auto w-full max-w-6xl px-6">
                <div className="flex flex-col items-center justify-between gap-4 text-sm text-muted-foreground sm:flex-row">
                    <p>{t('footer.copyright', { year: new Date().getFullYear() })}</p>

                    <div className="flex items-center gap-4">
                        {SOCIALS.map(({ href, Icon, label }) => (
                            <a
                                key={label}
                                href={href}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="transition-colors duration-fast ease-out hover:text-foreground"
                                aria-label={label}
                            >
                                <Icon className="h-4 w-4" />
                            </a>
                        ))}
                    </div>

                    <p>
                        {t.rich('footer.madeWith', {
                            company: () => (
                                <a
                                    href={APP_CONFIG.company.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-accent hover:underline"
                                >
                                    {APP_CONFIG.company.name}
                                </a>
                            ),
                        })}
                    </p>
                </div>
            </div>
        </footer>
    );
}
