'use client';

// ============================================
// ComposeYogi — Default Velocity Control
// ============================================
//
// How hard the next note you draw will be struck, shared by both editors.
//
// One component rather than one per toolbar, because the two editors had
// already drifted once: the drum sequencer read the preference for every step
// it created but offered no way to change it, so working in drums meant every
// hit landed at whatever the piano roll happened to have set. A shared control
// cannot drift like that.
//
// The value lives in the UI store, not the project — it is how you are working
// right now, not part of the piece, and it should not land in undo history or
// the saved file.

import { useTranslations } from 'next-intl';

import { useUIStore } from '@/lib/store';
import { Slider } from '@/components/ui/slider';

const MIN_VELOCITY = 1;
const MAX_VELOCITY = 127;

interface DefaultVelocityControlProps {
    disabled?: boolean;
}

export function DefaultVelocityControl({ disabled = false }: DefaultVelocityControlProps) {
    const t = useTranslations('editor.velocity');
    const defaultVelocity = useUIStore((s) => s.defaultVelocity);
    const setDefaultVelocity = useUIStore((s) => s.setDefaultVelocity);

    return (
        <div className="flex items-center gap-1.5">
            {/* A <span>, not a <label>: a Radix slider's thumb is not a labelable
                element, so a `for` would bind to nothing. The slider carries its
                own name, which says more than the caption does. */}
            <span className="text-xs text-muted-foreground">
                {t('defaultLabel')}
            </span>
            <Slider
                aria-label={t('defaultAriaLabel')}
                min={MIN_VELOCITY}
                max={MAX_VELOCITY}
                value={[defaultVelocity]}
                disabled={disabled}
                onValueChange={([v]) => setDefaultVelocity(v)}
                className="w-20"
            />
            <span className="w-6 text-right font-mono text-xs text-muted-foreground">
                {defaultVelocity}
            </span>
        </div>
    );
}
