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
            <label htmlFor="default-velocity" className="text-xs text-muted-foreground">
                {t('defaultLabel')}
            </label>
            <input
                id="default-velocity"
                type="range"
                min={MIN_VELOCITY}
                max={MAX_VELOCITY}
                value={defaultVelocity}
                disabled={disabled}
                aria-label={t('defaultAriaLabel')}
                onChange={(e) => setDefaultVelocity(Number(e.target.value))}
                className="h-1 w-20 cursor-pointer appearance-none rounded-full bg-input disabled:cursor-not-allowed disabled:opacity-50 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary"
            />
            <span className="w-6 text-right font-mono text-xs text-muted-foreground">
                {defaultVelocity}
            </span>
        </div>
    );
}
