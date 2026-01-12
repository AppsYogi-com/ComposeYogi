'use client';

import { Link } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import { Play } from 'lucide-react';
import { DEMO_TEMPLATES } from '@/lib/templates';

export function DemoTemplates() {
    const t = useTranslations('landing.demos');

    return (
        <section className="w-full mt-16">
            {/* Section Header */}
            <div className="text-center mb-8">
                <h2 className="text-2xl font-bold mb-2">{t('title')}</h2>
                <p className="text-muted-foreground">{t('subtitle')}</p>
            </div>

            {/* Template Cards Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {DEMO_TEMPLATES.map((template) => (
                    <Link
                        key={template.id}
                        href={`/compose?demo=${template.id}`}
                        className="group relative flex flex-col items-center p-4 rounded-xl border border-border bg-card hover:bg-accent/10 hover:border-accent/50 transition-all duration-200 hover:scale-[1.02] hover:shadow-lg"
                    >
                        {/* Emoji */}
                        <div className="text-4xl mb-3 group-hover:scale-110 transition-transform">
                            {template.emoji}
                        </div>

                        {/* Name */}
                        <h3 className="font-semibold text-sm mb-1">{template.name}</h3>

                        {/* Genre Tag */}
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-accent/20 text-accent mb-2">
                            {template.genre}
                        </span>

                        {/* BPM & Key */}
                        <div className="text-[10px] text-muted-foreground">
                            {template.bpm} BPM • {template.key} {template.scale}
                        </div>

                        {/* Play overlay on hover */}
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 backdrop-blur-sm rounded-xl">
                            <div className="flex items-center gap-1.5 text-white text-sm font-semibold">
                                <Play className="h-5 w-5 fill-current" />
                                {t('playButton')}
                            </div>
                        </div>
                    </Link>
                ))}
            </div>

            {/* Helper text */}
            <p className="text-center text-xs text-muted-foreground mt-6">
                {t('helperText')}
            </p>
        </section>
    );
}
