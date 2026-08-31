'use client';

// ============================================
// ComposeYogi — Count-in Selector
// ============================================
//
// PRD §8.3 lists a count-in selector among the transport's elements. The store
// has carried `setCountInBars` since v1.0 with no caller anywhere, so every
// count-in anyone has ever heard was the hardcoded default of two bars.
//
// The transport bar is full — it fits at the 2xl the design targets and no
// wider — so this buys its space by being the readout as well as the control:
// the trigger is the current bar count in the same mono numeral the time
// signature and zoom readouts already use, and the choice lives in a popover
// rather than in a select wide enough to spell itself out.
//
// It sits beside the record button rather than beside the metronome. The click
// is what you hear, but the count-in is a property of the take: it is set with
// the control it delays, and it is not disabled when no track is armed, because
// choosing it before arming is the normal order.

import { useTranslations } from 'next-intl';

import { usePlaybackStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/ui/tooltip';

/** Exactly what the store's own clamp allows: `Math.max(0, Math.min(4, bars))`. */
const COUNT_IN_OPTIONS = [0, 1, 2, 3, 4] as const;

export function CountInSelect() {
    const t = useTranslations('recording');
    const countInBars = usePlaybackStore((s) => s.countInBars);
    const setCountInBars = usePlaybackStore((s) => s.setCountInBars);

    // "Count-in: 2 bars" / "Count-in: off" — the name a screen reader reads and
    // the sentence the tooltip shows, from one message so they cannot disagree.
    const label = t('countInValue', { bars: countInBars });

    return (
        <Popover>
            <Tooltip>
                <PopoverTrigger asChild>
                    <TooltipTrigger asChild>
                        <Button
                            variant="transport"
                            size="icon-sm"
                            className="w-6 font-mono text-xs tabular-nums"
                            aria-label={label}
                        >
                            {countInBars}
                        </Button>
                    </TooltipTrigger>
                </PopoverTrigger>
                <TooltipContent side="bottom">
                    <p>{label}</p>
                </TooltipContent>
            </Tooltip>
            <PopoverContent className="w-56 p-4" align="center">
                <div className="space-y-3">
                    <h4 className="text-sm font-medium">{t('countInSetting')}</h4>
                    {/* Digits, not words: 0 needs no translation and reads as the
                        end of the same scale rather than as a separate mode. The
                        caption below says what the number counts. */}
                    <div className="grid grid-cols-5 gap-1">
                        {COUNT_IN_OPTIONS.map((bars) => (
                            <Button
                                key={bars}
                                variant={bars === countInBars ? 'default' : 'outline'}
                                size="sm"
                                className="px-0 font-mono text-xs tabular-nums"
                                aria-label={t('countInValue', { bars })}
                                onClick={() => setCountInBars(bars)}
                            >
                                {bars}
                            </Button>
                        ))}
                    </div>
                    <p className="text-xs text-muted-foreground">{t('countInHint')}</p>
                </div>
            </PopoverContent>
        </Popover>
    );
}
