'use client';

// ============================================
// ComposeYogi — Play It Live (Sprint 8.7.6)
// ============================================
//
// The keyboard that appears when live playing is on: a piano sized the way the
// on-screen pianos people actually use are sized, the letters that play it
// printed on the keys they reach, and the controls a performance needs beside
// it.
//
// It exists because musical typing is otherwise **undiscoverable**. The mapping
// is a convention — `z` is C, the black keys sit on the row above — and a
// convention nobody has met is indistinguishable from nothing at all.
//
// The geometry lives in `lib/music/keyboard-layout.ts`, which is where the
// reasoning about size is written down; what is here is what the layout cannot
// decide. Three of those are worth knowing:
//
// - **A key held by the pedal is not a key that is down.** On a piano the key
//   returns and the damper stays off. Drawing every sounding note as pressed
//   made sustain look like it had latched the keyboard.
// - **Keys the letters do not reach are dimmed**, the way the piano roll dims
//   out-of-scale keys. Two octaves of identically-lit keys made the octave
//   buttons look like they did nothing.
// - **The container clips both axes.** `overflow-x: auto` forces `overflow-y`
//   to `auto` with it, and one pixel of block overflow then raises a scrollbar
//   that narrows the box and re-centres the keyboard mid-click.

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useTranslations } from 'next-intl';
import { Cable, ChevronLeft, ChevronRight, CircleSlash, Piano } from 'lucide-react';

import { livePlayEngine } from '@/lib/audio/live-play';
import { getCustomInstrument } from '@/lib/audio/custom-instruments';
import { SYNTH_PRESETS, type SynthPresetId } from '@/lib/audio/synth-presets';
import {
    KEY_PRESS_TRAVEL,
    RAIL_HEIGHT,
    keyboardLayout,
    type DrawnKey,
} from '@/lib/music/keyboard-layout';
import { drumWindowRange } from '@/lib/music/percussion';
import {
    TYPING_OCTAVE_MAX,
    TYPING_OCTAVE_MIN,
    TYPING_SPAN_SEMITONES,
    octaveBasePitch,
} from '@/lib/music/typing-keys';
import { useUIStore } from '@/lib/store';
import { useLivePlay, useMidiState } from '@/hooks';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { DefaultVelocityControl } from '@/components/compose/editors/DefaultVelocityControl';

// ============================================
// Engine and container state
// ============================================

/**
 * What is sounding, what is under a finger, and whether any of it can be heard.
 *
 * `useSyncExternalStore` rather than a store: the writers are a DOM listener
 * and a Web MIDI callback, neither of which is React, and the engine already
 * keeps a snapshot stable by reference between changes, which is exactly the
 * contract this hook asks for.
 */
function useLiveSnapshot() {
    const subscribe = useCallback((listener: () => void) => livePlayEngine.subscribe(listener), []);
    const snapshot = useCallback(() => livePlayEngine.getSnapshot(), []);
    return useSyncExternalStore(subscribe, snapshot, snapshot);
}

/**
 * The element's width, as React state.
 *
 * The keyboard cannot be sized in CSS: how many octaves fit is arithmetic over
 * the available pixels, and the answer changes the DOM rather than a length.
 * Safe against the usual ResizeObserver feedback loop because the observed box
 * is `w-full` with a height this component sets and its children are absolutely
 * positioned — nothing inside it can change its width.
 */
function useMeasuredWidth<T extends HTMLElement>() {
    const ref = useRef<T>(null);
    const [width, setWidth] = useState(0);

    useEffect(() => {
        const element = ref.current;
        if (!element) return;

        const observer = new ResizeObserver(([entry]) => {
            setWidth(Math.floor(entry.contentRect.width));
        });
        observer.observe(element);
        setWidth(Math.floor(element.getBoundingClientRect().width));

        return () => observer.disconnect();
    }, []);

    return [ref, width] as const;
}

/** What the track's instrument is called — a built-in's name, or the user's own. */
function instrumentName(preset: string | undefined): string | null {
    if (!preset) return null;
    const custom = getCustomInstrument(preset);
    if (custom) return custom.name;
    return SYNTH_PRESETS[preset as SynthPresetId]?.name ?? null;
}

// ============================================
// Component
// ============================================

export function LivePlayBar() {
    const t = useTranslations('livePlay');
    const tTracks = useTranslations('tracks');

    const octave = useUIStore((s) => s.livePlayOctave);
    const shiftOctave = useUIStore((s) => s.shiftLivePlayOctave);
    // Clicked keys have to carry it too. They did not — `noteOn(pitch)` fell
    // through to the engine's default of 100 — so the velocity control silently
    // applied to typed notes and not to moused ones, which is half of what
    // "what does velocity do here?" was asking.
    const velocity = useUIStore((s) => s.defaultVelocity);

    const { target } = useLivePlay();
    const midi = useMidiState();
    const live = useLiveSnapshot();

    const [boxRef, boxWidth] = useMeasuredWidth<HTMLDivElement>();

    // **What the keys say follows the track, not the drawing.** A drum lane's
    // notes are General MIDI percussion slots, so the key at C3 is a tom — and
    // labelling it `C3` is not a small inaccuracy, it is the wrong noun. The
    // board itself is unchanged: same 73 keys, same places, because a kit under
    // a piano keyboard is exactly how every DAW plays one.
    const voicing = target?.type === 'drum' ? 'kit' : 'melodic';
    const layout = boxWidth > 0 ? keyboardLayout(octave, boxWidth, voicing) : null;

    const windowLow = octaveBasePitch(octave);
    const kitRange = voicing === 'kit'
        ? drumWindowRange(windowLow, windowLow + TYPING_SPAN_SEMITONES)
        : null;

    /**
     * Whether the mouse is held down anywhere on the keyboard.
     *
     * A ref rather than state: it is read inside a pointer handler on every key
     * and never rendered, so putting it in state would re-render thirty keys on
     * mousedown to change nothing anyone can see. It is what makes dragging
     * across the keys glissando, which is the first thing anybody tries.
     */
    const dragging = useRef(false);
    useEffect(() => {
        const stop = () => {
            dragging.current = false;
        };
        window.addEventListener('pointerup', stop);
        window.addEventListener('pointercancel', stop);
        return () => {
            window.removeEventListener('pointerup', stop);
            window.removeEventListener('pointercancel', stop);
        };
    }, []);

    /**
     * What to say about MIDI.
     *
     * Four states rather than "MIDI: yes/no" because the fix differs each time —
     * a different browser, a site permission, or a cable. See `midi-input.ts`.
     * Inline rather than a helper beside the component: `tests/i18n.test.ts`
     * resolves a namespace from the `useTranslations` call in the same
     * component, so a helper taking `t` as an argument reads as an unnamespaced
     * key and the guard cannot tell whether the message exists.
     */
    const midiLabel = () => {
        switch (midi.status) {
            case 'unsupported':
                return t('midiUnsupported');
            case 'denied':
                return t('midiDenied');
            case 'ready':
                return midi.devices.length
                    ? midi.devices.map((device) => device.name).join(', ')
                    : t('midiNoDevices');
            default:
                return t('midiSearching');
        }
    };

    const instrument = instrumentName(target?.instrumentPreset);
    const connected = midi.status === 'ready' && midi.devices.length > 0;

    return (
        <div className="border-t border-border bg-card">
            {/* A grid, not a flex row, because the octave control has to be in
                the **middle of the bar** rather than the middle of what is left
                over — and with `justify-between` a longer track name moved it.
                Three equal columns keep it centred whatever the sides carry, and
                the whole thing collapses to stacked rows on a narrow bar. */}
            <div className="flex flex-col items-center gap-2 px-3 py-2 lg:grid lg:grid-cols-3 lg:gap-4">
                {/* Which track this sounds through, what it will sound like, and
                    what MIDI found. All three answer "why does this not sound
                    how I expected". */}
                <span className="flex min-w-0 items-center gap-2">
                    <Piano className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="truncate text-xs font-medium text-foreground">
                        {target ? target.name : t('noTrack')}
                    </span>
                    {instrument && (
                        <span className="truncate text-xs text-muted-foreground">
                            {instrument}
                        </span>
                    )}

                    {/* Spelled out only when a device is actually connected. The
                        other three states all mean "no keyboard", differ only in
                        what you would do about it, and are read once — so they
                        ride on the icon's name and its tooltip instead of taking
                        permanent width. */}
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <span className="flex min-w-0 items-center gap-1.5 text-2xs text-muted-foreground">
                                <Cable
                                    aria-label={midiLabel()}
                                    role="img"
                                    className={`h-3.5 w-3.5 shrink-0 ${connected ? 'text-foreground' : ''}`}
                                />
                                {connected && <span className="truncate">{midiLabel()}</span>}
                            </span>
                        </TooltipTrigger>
                        <TooltipContent side="top">{midiLabel()}</TooltipContent>
                    </Tooltip>
                </span>

                {/* The octave, centred. It is the control this keyboard is used
                    with most, it is the one whose effect you watch on the keys
                    below it, and it is the only one whose reading you check
                    mid-performance. The readout is the range rather than the
                    number: "C3" alone does not say what the other twenty-four
                    keys play, and the range is what the lit keys are drawing. */}
                <span className="flex items-center justify-center gap-1">
                    <span className="mr-1 text-2xs uppercase tracking-wider text-muted-foreground">
                        {t('octave')}
                    </span>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                aria-label={t('octaveDown')}
                                variant="transport"
                                size="icon-sm"
                                disabled={octave <= TYPING_OCTAVE_MIN}
                                onClick={() => shiftOctave(-1)}
                            >
                                <ChevronLeft className="h-3.5 w-3.5" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent side="top">
                            <p>
                                {t('octaveDown')} <kbd className="ml-1 text-xs opacity-60">←</kbd>
                            </p>
                        </TooltipContent>
                    </Tooltip>

                    {/* The window, in whatever language the keys below are
                        speaking. `C3–C5` is a true statement about pitch and a
                        meaningless one about a drum kit — and it was sitting
                        above keys reading BD2 and CHH. The arrows still shift by
                        an octave on both, which is why the caption and the
                        tooltips do not change: what changes is the readout, not
                        the gesture. */}
                    <span className="w-14 text-center font-mono text-xs tabular-nums text-foreground">
                        {kitRange
                            ? `${kitRange.from}–${kitRange.to}`
                            : `C${octave}–C${octave + 2}`}
                    </span>

                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                aria-label={t('octaveUp')}
                                variant="transport"
                                size="icon-sm"
                                disabled={octave >= TYPING_OCTAVE_MAX}
                                onClick={() => shiftOctave(1)}
                            >
                                <ChevronRight className="h-3.5 w-3.5" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent side="top">
                            <p>
                                {t('octaveUp')} <kbd className="ml-1 text-xs opacity-60">→</kbd>
                            </p>
                        </TooltipContent>
                    </Tooltip>
                </span>

                <span className="flex items-center justify-end gap-3">
                    {/* How hard every note this keyboard plays is struck — a
                        typed key has no touch, so this is the only dynamics
                        control it has, and it is carried into the recorded clip
                        as well. It was already what live playing used; the only
                        place to change it was the piano roll's toolbar, which
                        meant opening an editor to change how hard the keyboard
                        in front of you hits. Same control, same value. */}
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <span>
                                <DefaultVelocityControl />
                            </span>
                        </TooltipTrigger>
                        <TooltipContent side="top">{t('velocityHint')}</TooltipContent>
                    </Tooltip>

                    {/* A toggle, not a readout. It was a pill that lit while
                        Shift was down and could not be pressed — a label wearing
                        a control's clothes — and the pedal is the one thing on a
                        keyboard a mouse-only player most needs. */}
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant={live.pedal ? 'transport-active' : 'transport'}
                                size="sm"
                                aria-pressed={live.pedal}
                                onClick={() => livePlayEngine.setSustain(!live.pedal)}
                            >
                                {t('sustain')}
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent side="top">
                            <p>
                                {t('sustainHold')} <kbd className="ml-1 text-xs opacity-60">Shift</kbd>
                            </p>
                        </TooltipContent>
                    </Tooltip>

                    {/* **Only while a MIDI keyboard is attached.** Panic exists
                        for a note whose end never arrived, and from the computer
                        keyboard that cannot now happen: a lost keyup is caught
                        by the window's blur, and a release is sent to the pitch
                        the key was pressed at rather than recomputed. A cable
                        pulled mid-chord is the case left, so the button appears
                        with the cable. Escape still works either way, and is in
                        the shortcuts sheet. */}
                    {connected && (
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="transport"
                                    size="sm"
                                    disabled={live.sounding.length === 0}
                                    onClick={() => livePlayEngine.allNotesOff()}
                                >
                                    <CircleSlash className="mr-1.5 h-3.5 w-3.5" />
                                    {t('panic')}
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent side="top">
                                <p>
                                    {t('panicHint')} <kbd className="ml-1 text-xs opacity-60">Esc</kbd>
                                </p>
                            </TooltipContent>
                        </Tooltip>
                    )}
                </span>
            </div>

            <div
                ref={boxRef}
                className="relative w-full select-none overflow-hidden"
                style={{ height: layout?.height }}
            >
                {layout && (
                    <>
                        {/* The fallboard: the dark strip a real keyboard's keys
                            disappear under, and somewhere for the rail to live
                            that is not on top of a key. */}
                        <div
                            className="absolute inset-x-0 top-0 bg-secondary"
                            style={{ height: RAIL_HEIGHT }}
                        />
                        <div
                            className="absolute top-0 bg-accent transition-[left,width] duration-150"
                            style={{
                                left: layout.offsetX + layout.windowX,
                                width: layout.windowWidth,
                                height: RAIL_HEIGHT,
                            }}
                        />

                        {/* Whites first so the blacks paint over their seams. */}
                        {layout.keys.filter((key) => !key.black).map((key) => (
                            <LiveKey
                                key={key.pitch}
                                drawn={key}
                                offsetX={layout.offsetX}
                                velocity={velocity}
                                down={live.down.includes(key.pitch)}
                                pedalled={
                                    live.sounding.includes(key.pitch)
                                    && !live.down.includes(key.pitch)
                                }
                                kit={voicing === 'kit'}
                                dragging={dragging}
                            />
                        ))}
                        {layout.keys.filter((key) => key.black).map((key) => (
                            <LiveKey
                                key={key.pitch}
                                drawn={key}
                                offsetX={layout.offsetX}
                                velocity={velocity}
                                down={live.down.includes(key.pitch)}
                                pedalled={
                                    live.sounding.includes(key.pitch)
                                    && !live.down.includes(key.pitch)
                                }
                                kit={voicing === 'kit'}
                                dragging={dragging}
                            />
                        ))}
                    </>
                )}
            </div>

            {/* Only while it is true, and it is the difference between "this app
                is broken" and "arm the track first". */}
            {target && !target.armed && (
                <p className="px-3 pb-1.5 pt-1 text-center text-2xs text-muted-foreground">
                    {tTracks('armToRecordHint')}
                </p>
            )}
        </div>
    );
}

// ============================================
// One key
// ============================================

interface LiveKeyProps {
    drawn: DrawnKey;
    /** Left pad that centres the board in its container. */
    offsetX: number;
    /** How hard a click strikes it — the same value a typed key carries. */
    velocity: number;
    /** A finger is on it. */
    down: boolean;
    /** Sounding, but only because the pedal is holding it. */
    pedalled: boolean;
    /** A kit key's cap carries a drum's short name, not a note's. */
    kit: boolean;
    dragging: React.MutableRefObject<boolean>;
}

/**
 * A raw `<button>`, like the piano roll's 84 keys and the drum grid's steps.
 *
 * `<Button>`'s variants would fight every state this has: it is a painted
 * surface with three sounding states, a black/white identity and a printed
 * keycap, and none of those is any of `variant`'s business. The a11y suite names
 * this pattern as deliberate.
 */
function LiveKey({ drawn, offsetX, velocity, down, pedalled, kit, dragging }: LiveKeyProps) {
    const { pitch, black, typed, label, name, inWindow } = drawn;
    const play = useCallback(() => livePlayEngine.noteOn(pitch, velocity), [pitch, velocity]);
    const release = useCallback(() => livePlayEngine.noteOff(pitch), [pitch]);

    return (
        <button
            type="button"
            // The drum's name on a kit, the pitch's on everything else. `C3` on
            // a kit key names a note the track cannot play.
            aria-label={name}
            aria-pressed={down || pedalled}
            // Out of the tab order on purpose. Every key the letters reach is
            // reachable by the letter printed on it — that is the whole feature
            // — so putting thirty of them in the tab order would make getting
            // past the keyboard cost thirty presses to reach something you could
            // already play. The `aria-label` stays, so the layout is readable.
            tabIndex={-1}
            style={{
                position: 'absolute',
                left: offsetX + drawn.x,
                top: RAIL_HEIGHT,
                width: drawn.width,
                height: drawn.height,
                zIndex: black ? 2 : 1,
                // Only a key with a finger on it sinks. A key the pedal is
                // holding has come back up — that is what a damper pedal does,
                // and drawing it down said the pedal had latched the keyboard.
                transform: down ? `translateY(${KEY_PRESS_TRAVEL}px)` : undefined,
                // Without this a touch drag across the keys scrolls the page
                // instead of playing them, which is the one gesture a
                // touchscreen user will try first.
                touchAction: 'none',
            }}
            // Pointer events rather than click: a key has a press and a release,
            // and `onClick` fires once, after both. `onPointerEnter` while the
            // mouse is down is the glissando — dragging across a picture of a
            // piano is the first thing anybody tries — and `onPointerLeave`
            // releases the note you slid off, which is otherwise a stuck note
            // that same gesture causes.
            onPointerDown={(e) => {
                e.preventDefault();
                dragging.current = true;
                play();
            }}
            onPointerEnter={() => {
                if (dragging.current) play();
            }}
            onPointerUp={release}
            onPointerLeave={release}
            onContextMenu={(e) => e.preventDefault()}
            className={[
                'flex select-none flex-col items-center justify-end gap-1 overflow-hidden pb-2',
                'font-mono text-2xs uppercase transition-[background-color,opacity,transform] duration-75',
                // Three states, and the middle one is the point: a pedalled note
                // is lit but not pressed, so you can see what is ringing and
                // what your hands are on at the same time.
                down
                    ? 'bg-accent text-accent-foreground shadow-none'
                    : pedalled
                        ? 'bg-accent/45 text-foreground'
                        : black
                            ? 'bg-piano-black text-piano-black-foreground shadow-lg hover:brightness-125'
                            : 'bg-piano-white text-piano-white-foreground hover:brightness-95',
                // Dimmed the way the piano roll dims an out-of-scale key: still
                // playable with the mouse, visibly not where the letters are.
                // This is what makes shifting the octave something you can see.
                inWindow ? '' : 'opacity-50',
                black
                    ? 'rounded-b border border-t-0 border-scrim/70'
                    // The heavier bottom border is the lip of the key — the one
                    // piece of shading that makes a flat rectangle read as
                    // something with a front edge.
                    : 'rounded-b-md border-x border-b-2 border-scrim/25',
            ].join(' ')}
        >
            {/* Every white key named, the way both reference keyboards do it.
                Labelling only the Cs makes the player count. `text-2xs` is the
                bottom of the type scale — there is no step below it, and
                inventing one for a keycap is not a reason to add a step to the
                whole product.

                On a kit the label is the drum rather than the note, and it is
                the **primary** thing on the cap rather than a background hint:
                on a piano the note is half-guessable from the key's position in
                the group of two or three, and no position on a kit tells you
                anything. So it is not dimmed, and it is tracked in tight enough
                to fit a black key. */}
            {label && (
                <span className={kit ? 'leading-none tracking-tighter' : 'opacity-45'}>
                    {label}
                </span>
            )}

            {/* Both letters where there are two: `,` and `q` are the same note,
                and the seam is the only place on the keyboard that shows the two
                rows overlapping. */}
            {typed.length > 0 && (
                <span className={black ? undefined : 'font-semibold'}>{typed.join(' ')}</span>
            )}
        </button>
    );
}
