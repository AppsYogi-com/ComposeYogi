'use client';

// ============================================
// ComposeYogi — Count-In Overlay
// "Recording in 3…2…1…" — PRD §9
// ============================================

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';

import { countInProgress } from '@/lib/audio/count-in';
import { usePlaybackStore } from '@/lib/store/playback';
import { useProjectStore } from '@/lib/store/project';

// ============================================
// Component
// ============================================

/**
 * The one moment the user most needs to be told what is about to happen.
 *
 * The count-in has run since Sprint 2.1 and is configurable in the transport;
 * it just happened invisibly, and — with the metronome off by default — often
 * inaudibly too. This is the whole of the feedback.
 *
 * Draws itself over the arrangement, never over the transport: stopping a
 * count-in you did not mean to start has to stay one click away.
 */
export function CountInOverlay() {
    const t = useTranslations('recording');
    const isCountingIn = usePlaybackStore((s) => s.isCountingIn);
    const session = usePlaybackStore((s) => s.recordingSession);
    const bpm = useProjectStore((s) => s.project?.bpm ?? 0);
    const beatsPerBar = useProjectStore((s) => s.project?.timeSignature[0] ?? 4);

    const endsAt = session?.countInEndsAt ?? null;
    const totalBeats = session?.countInBeats ?? 0;
    const active = isCountingIn && endsAt !== null && totalBeats > 0;

    // Beats, not frames. The number changes twice a second at 120bpm, so it can
    // live in React state — what may never go in there is the per-frame value
    // this is derived from, which is why the frame loop writes only on a change.
    const [beatsRemaining, setBeatsRemaining] = useState(totalBeats);
    const frameRef = useRef<number>(0);

    useEffect(() => {
        if (!active || endsAt === null) return;

        let last = -1;
        const tick = () => {
            const { beatsRemaining: left } = countInProgress(
                performance.now(),
                endsAt,
                totalBeats,
                bpm
            );
            if (left !== last) {
                last = left;
                setBeatsRemaining(left);
            }
            frameRef.current = requestAnimationFrame(tick);
        };
        tick();

        return () => cancelAnimationFrame(frameRef.current);
    }, [active, endsAt, totalBeats, bpm]);

    if (!active) return null;

    const elapsed = totalBeats - beatsRemaining;

    return (
        <div
            className="pointer-events-none absolute inset-0 z-40 flex flex-col items-center justify-center gap-5 bg-background/75 backdrop-blur-sm"
            data-testid="count-in-overlay"
        >
            {/* Announced once, as a phrase. The number is hidden from screen
                readers on purpose — a countdown that speaks every beat talks
                over the count it is announcing. */}
            <p
                role="status"
                className="text-xs uppercase tracking-widest text-muted-foreground"
            >
                {t('countIn')}
            </p>

            <span
                aria-hidden="true"
                className="font-mono-nums text-7xl font-bold leading-none text-destructive tabular-nums"
            >
                {beatsRemaining}
            </span>

            {/* One pip per beat, downbeats larger — the bar structure the
                metronome would have given you, for the count-ins that are
                silent because the metronome is off. */}
            <div
                aria-hidden="true"
                className="flex max-w-sm flex-wrap items-center justify-center gap-1.5"
            >
                {Array.from({ length: totalBeats }, (_, beat) => {
                    const isDownbeat = beat % beatsPerBar === 0;
                    const lit = beat < elapsed;
                    return (
                        <span
                            key={beat}
                            className={[
                                'rounded-full transition-colors',
                                isDownbeat ? 'h-2.5 w-2.5' : 'h-1.5 w-1.5',
                                lit ? 'bg-destructive' : 'bg-muted-foreground/30',
                            ].join(' ')}
                        />
                    );
                })}
            </div>
        </div>
    );
}
