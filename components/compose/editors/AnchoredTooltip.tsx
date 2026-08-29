'use client';

// ============================================
// ComposeYogi — Anchored Tooltip
// ============================================
//
// The app's tooltip primitive, pointed at an arbitrary rectangle instead of at
// a element that owns it.
//
// The drum grid renders on the order of three thousand step cells and the
// velocity lane one bar per note. Giving each of those its own <Tooltip> means
// that many Radix state machines mounted at once, which is why these two places
// reached for the browser's native `title` instead — and a native tooltip looks
// nothing like the rest of the product, appears after an uncontrollable delay,
// and cannot be styled.
//
// So: one tooltip, one zero-size trigger positioned over whichever cell the
// pointer is on. Same primitive, same appearance as everywhere else, constant
// cost regardless of how many cells there are.

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

import type { ReactNode } from 'react';

/** A viewport rectangle, straight from getBoundingClientRect(). */
export interface AnchorRect {
    left: number;
    top: number;
    width: number;
    height: number;
}

interface AnchoredTooltipProps {
    /** The rectangle to point at, or null to show nothing. */
    anchor: AnchorRect | null;
    children: ReactNode;
    side?: 'top' | 'right' | 'bottom' | 'left';
}

export function AnchoredTooltip({ anchor, children, side = 'top' }: AnchoredTooltipProps) {
    return (
        <Tooltip open={!!anchor}>
            <TooltipTrigger asChild>
                {/* Fixed rather than absolute so it needs no positioned ancestor,
                    and inert so it never intercepts the pointer it is following. */}
                <span
                    aria-hidden="true"
                    className="pointer-events-none fixed"
                    style={{
                        left: anchor?.left ?? 0,
                        top: anchor?.top ?? 0,
                        width: anchor?.width ?? 0,
                        height: anchor?.height ?? 0,
                    }}
                />
            </TooltipTrigger>
            <TooltipContent side={side} className="font-mono">
                {children}
            </TooltipContent>
        </Tooltip>
    );
}
