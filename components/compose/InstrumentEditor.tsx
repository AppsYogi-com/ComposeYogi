'use client';

// ============================================
// ComposeYogi — Instrument Editor (#21)
// ============================================
//
// "Take the Electric Piano and make it darker and slower to fade."
//
// The whole design question in #21 was the word *simple*: a synth has dozens of
// parameters and showing them all produces something nobody opens twice. The
// answer here is the one GarageBand's Smart Controls settled on years ago —
// four controls that cover almost every adjustment a person actually wants
// (character, brightness, how fast it arrives, how long it takes to go), with
// the rest of the envelope one disclosure away.
//
// There is no blank-oscillator page, deliberately. Every custom instrument
// starts as one of the 64 built-ins, which is both the far friendlier starting
// point and the reason the sound is always already musical.
//
// You hear every change. A control that commits re-auditions the note, because
// a sound editor where you adjust in silence and press play afterwards is a
// form, not an instrument.

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { useFormatter, useTranslations } from 'next-intl';
import * as Tone from 'tone';
import { AudioLines, ChevronDown, ChevronRight, Download, Play, RotateCcw, Save } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import {
    ENVELOPE_RANGES,
    MACRO_RANGES,
    OSCILLATOR_SHAPES,
    audioEngine,
    buildInstrumentFromSpec,
    downloadInstrument,
    getSynthPresetName,
    saveCustomInstrument,
    specForPreset,
} from '@/lib/audio';
import { cn } from '@/lib/utils';

import type { CustomInstrument, EnvelopeSpec, InstrumentSpec } from '@/types';

// ============================================
// Constants
// ============================================

/** The chord the preview plays. A triad says more about a voice than one note —
 *  detuning, beating and how a pad's attack stacks are only audible in three. */
const PREVIEW_CHORD = ['C4', 'E4', 'G4'] as const;
const PREVIEW_DURATION = 1.2;

/** Preview level. The editor is not the mix; a raw voice at unity next to a
 *  playing arrangement is startling. */
const PREVIEW_GAIN_DB = -8;

/** Envelope sliders move in seconds but the useful range is not linear — the
 *  difference between 5ms and 50ms of attack is enormous and the difference
 *  between 4s and 5s is nearly nothing. Slider position is 0-100 and the value
 *  is taken on a curve, the same reason brightness is logarithmic. */
const ENVELOPE_CURVE = 3;

function envelopeToSlider(seconds: number, min: number, max: number): number {
    const normalized = (seconds - min) / (max - min);
    return Math.round(Math.pow(Math.max(0, normalized), 1 / ENVELOPE_CURVE) * 100);
}

function sliderToEnvelope(position: number, min: number, max: number): number {
    return min + Math.pow(position / 100, ENVELOPE_CURVE) * (max - min);
}

// ============================================
// Field
// ============================================

interface FieldProps {
    label: string;
    value?: string;
    children: (ids: { id: string; labelledBy: string }) => React.ReactNode;
}

/**
 * A caption wired to its control.
 *
 * Same shape as the Inspector's: a Radix slider's `role="slider"` is on the
 * thumb, which is a `<span>` and cannot be a label's `htmlFor` target, so both
 * an id and a labelledby id are handed down and the control picks the one it
 * can use. Routing every field through here is what makes it impossible to
 * render a caption in this dialog without wiring it to something.
 */
function Field({ label, value, children }: FieldProps) {
    const generated = useId();
    const id = `${generated}-control`;
    const labelledBy = `${generated}-label`;

    return (
        <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
                <Label htmlFor={id} id={labelledBy} className="text-xs text-muted-foreground">
                    {label}
                </Label>
                {value && (
                    <span className="font-mono text-2xs tabular-nums text-muted-foreground">{value}</span>
                )}
            </div>
            {children({ id, labelledBy })}
        </div>
    );
}

// ============================================
// Component
// ============================================

interface InstrumentEditorProps {
    /** The instrument being edited. Null closes the dialog. */
    instrument: CustomInstrument | null;
    onClose: () => void;
    onSaved?: (instrument: CustomInstrument) => void;
}

export function InstrumentEditor({ instrument, onClose, onSaved }: InstrumentEditorProps) {
    const t = useTranslations('instruments');
    // next-intl's formatter, not toFixed: these numbers are read by the user and
    // a Spanish session writes 1,25 s where an English one writes 1.25 s.
    const format = useFormatter();

    const formatSeconds = useCallback(
        (seconds: number) =>
            seconds < 1
                ? `${format.number(Math.round(seconds * 1000))} ms`
                : `${format.number(seconds, { maximumFractionDigits: 2 })} s`,
        [format]
    );

    const [name, setName] = useState('');
    const [spec, setSpec] = useState<InstrumentSpec | null>(null);
    const [showMore, setShowMore] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    // Refs, not state: these are Tone nodes with a disposal obligation, and a
    // re-render that dropped one on the floor would leak a voice per edit.
    const voiceRef = useRef<ReturnType<typeof buildInstrumentFromSpec> | null>(null);
    const gainRef = useRef<Tone.Gain | null>(null);

    // Load the instrument into local state when the dialog opens. Edits are
    // local until Save, so closing without saving changes nothing.
    useEffect(() => {
        if (!instrument) return;
        setName(instrument.name);
        setSpec(structuredClone(instrument.spec));
        setShowMore(false);
    }, [instrument]);

    const disposeVoice = useCallback(() => {
        voiceRef.current?.synth.dispose();
        for (const node of voiceRef.current?.nodes ?? []) node.dispose();
        voiceRef.current = null;
    }, []);

    // Tear the preview down with the dialog. Without this the voice, its filter
    // and the gain outlive every session the editor is opened in.
    useEffect(() => {
        if (instrument) return;
        disposeVoice();
        gainRef.current?.dispose();
        gainRef.current = null;
    }, [instrument, disposeVoice]);

    useEffect(() => () => {
        disposeVoice();
        gainRef.current?.dispose();
    }, [disposeVoice]);

    /**
     * Play the current spec.
     *
     * The voice is rebuilt from scratch each time rather than mutated: a spec
     * change can alter the *class* being constructed, and half the parameters
     * (a MonoSynth's filter envelope, an FM voice's modulation index) are set
     * at construction. Rebuilding is a few hundred microseconds and is the only
     * version that always plays what the panel says.
     */
    const audition = useCallback(async (next?: InstrumentSpec) => {
        const playing = next ?? spec;
        if (!playing) return;

        await audioEngine.initialize();

        if (!gainRef.current) {
            gainRef.current = new Tone.Gain(Tone.dbToGain(PREVIEW_GAIN_DB)).toDestination();
        }

        disposeVoice();
        const built = buildInstrumentFromSpec(playing);
        built.output.connect(gainRef.current);
        voiceRef.current = built;

        built.synth.triggerAttackRelease([...PREVIEW_CHORD], PREVIEW_DURATION);
    }, [spec, disposeVoice]);

    const update = useCallback((patch: Partial<InstrumentSpec>) => {
        setSpec((current) => (current ? { ...current, ...patch } : current));
    }, []);

    const updateEnvelope = useCallback((patch: Partial<EnvelopeSpec>) => {
        setSpec((current) =>
            current ? { ...current, envelope: { ...current.envelope, ...patch } } : current
        );
    }, []);

    const baseName = useMemo(
        () => (instrument ? getSynthPresetName(instrument.basePresetId) : ''),
        [instrument]
    );

    const handleRevert = useCallback(() => {
        if (!instrument) return;
        const original = specForPreset(instrument.basePresetId);
        if (!original) return;
        setSpec(original);
        void audition(original);
    }, [instrument, audition]);

    const handleSave = useCallback(async () => {
        if (!instrument || !spec) return;
        setIsSaving(true);
        try {
            const saved = await saveCustomInstrument({ ...instrument, name, spec });
            onSaved?.(saved);
            onClose();
        } finally {
            setIsSaving(false);
        }
    }, [instrument, spec, name, onSaved, onClose]);

    const handleExport = useCallback(() => {
        if (!instrument || !spec) return;
        downloadInstrument({ ...instrument, name, spec });
    }, [instrument, spec, name]);

    if (!instrument || !spec) return null;

    const isOpen = Boolean(instrument);

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        {/* h-5, like every other dialog header — this shipped at h-4 and
                            read as a slightly smaller title than the other five. And a
                            Play glyph named the wrong thing entirely: nothing here plays
                            the project, and Preview already owns that icon below. */}
                        <AudioLines className="h-5 w-5" />
                        {t('editorTitle')}
                    </DialogTitle>
                    <DialogDescription>{t('editorDescription', { preset: baseName })}</DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    <Field label={t('name')}>
                        {({ id }) => (
                            <Input
                                id={id}
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                maxLength={60}
                            />
                        )}
                    </Field>

                    <Field label={t('wave')}>
                        {({ id }) => (
                            <Select
                                value={spec.oscillator.type}
                                onValueChange={(value) => {
                                    const next: InstrumentSpec = {
                                        ...spec,
                                        // Replacing the shape drops `partials`,
                                        // `width` and the fat-oscillator spread
                                        // along with it — they belong to the
                                        // wave that was there, and carrying them
                                        // onto a sine is meaningless.
                                        oscillator: { type: value },
                                    };
                                    setSpec(next);
                                    void audition(next);
                                }}
                            >
                                <SelectTrigger id={id} aria-label={t('wave')}>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {/* A preset may arrive on a shape the picker
                                        does not list — `custom` additive organs,
                                        for one. It is shown so the control names
                                        what is actually playing rather than
                                        silently reading as something else. */}
                                    {!(OSCILLATOR_SHAPES as readonly string[]).includes(spec.oscillator.type) && (
                                        <SelectItem value={spec.oscillator.type}>
                                            {t('waveOriginal')}
                                        </SelectItem>
                                    )}
                                    {OSCILLATOR_SHAPES.map((shape) => (
                                        <SelectItem key={shape} value={shape}>
                                            {t(`waves.${shape}`)}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )}
                    </Field>

                    <Field label={t('brightness')} value={`${Math.round(spec.brightness)}`}>
                        {({ labelledBy }) => (
                            <Slider
                                aria-labelledby={labelledBy}
                                min={MACRO_RANGES.brightness.min}
                                max={MACRO_RANGES.brightness.max}
                                step={1}
                                value={[spec.brightness]}
                                onValueChange={([value]) => update({ brightness: value })}
                                onValueCommit={() => void audition()}
                            />
                        )}
                    </Field>

                    <div className="grid grid-cols-2 gap-4">
                        <Field label={t('attack')} value={formatSeconds(spec.envelope.attack)}>
                            {({ labelledBy }) => (
                                <Slider
                                    aria-labelledby={labelledBy}
                                    min={0}
                                    max={100}
                                    step={1}
                                    value={[envelopeToSlider(
                                        spec.envelope.attack,
                                        ENVELOPE_RANGES.attack.min,
                                        ENVELOPE_RANGES.attack.max
                                    )]}
                                    onValueChange={([value]) => updateEnvelope({
                                        attack: sliderToEnvelope(
                                            value,
                                            ENVELOPE_RANGES.attack.min,
                                            ENVELOPE_RANGES.attack.max
                                        ),
                                    })}
                                    onValueCommit={() => void audition()}
                                />
                            )}
                        </Field>

                        <Field label={t('release')} value={formatSeconds(spec.envelope.release)}>
                            {({ labelledBy }) => (
                                <Slider
                                    aria-labelledby={labelledBy}
                                    min={0}
                                    max={100}
                                    step={1}
                                    value={[envelopeToSlider(
                                        spec.envelope.release,
                                        ENVELOPE_RANGES.release.min,
                                        ENVELOPE_RANGES.release.max
                                    )]}
                                    onValueChange={([value]) => updateEnvelope({
                                        release: sliderToEnvelope(
                                            value,
                                            ENVELOPE_RANGES.release.min,
                                            ENVELOPE_RANGES.release.max
                                        ),
                                    })}
                                    onValueCommit={() => void audition()}
                                />
                            )}
                        </Field>
                    </div>

                    <button
                        onClick={() => setShowMore((open) => !open)}
                        aria-expanded={showMore}
                        className="flex w-full items-center gap-1.5 rounded px-1 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
                    >
                        {showMore ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                        {t('more')}
                    </button>

                    {showMore && (
                        <div className="grid grid-cols-2 gap-4 border-t border-border pt-4">
                            <Field label={t('decay')} value={formatSeconds(spec.envelope.decay)}>
                                {({ labelledBy }) => (
                                    <Slider
                                        aria-labelledby={labelledBy}
                                        min={0}
                                        max={100}
                                        step={1}
                                        value={[envelopeToSlider(
                                            spec.envelope.decay,
                                            ENVELOPE_RANGES.decay.min,
                                            ENVELOPE_RANGES.decay.max
                                        )]}
                                        onValueChange={([value]) => updateEnvelope({
                                            decay: sliderToEnvelope(
                                                value,
                                                ENVELOPE_RANGES.decay.min,
                                                ENVELOPE_RANGES.decay.max
                                            ),
                                        })}
                                        onValueCommit={() => void audition()}
                                    />
                                )}
                            </Field>

                            <Field label={t('sustain')} value={`${Math.round(spec.envelope.sustain * 100)}%`}>
                                {({ labelledBy }) => (
                                    <Slider
                                        aria-labelledby={labelledBy}
                                        min={0}
                                        max={100}
                                        step={1}
                                        value={[spec.envelope.sustain * 100]}
                                        onValueChange={([value]) => updateEnvelope({ sustain: value / 100 })}
                                        onValueCommit={() => void audition()}
                                    />
                                )}
                            </Field>

                            <Field label={t('resonance')} value={`${Math.round(spec.resonance)}`}>
                                {({ labelledBy }) => (
                                    <Slider
                                        aria-labelledby={labelledBy}
                                        min={MACRO_RANGES.resonance.min}
                                        max={MACRO_RANGES.resonance.max}
                                        step={1}
                                        value={[spec.resonance]}
                                        onValueChange={([value]) => update({ resonance: value })}
                                        onValueCommit={() => void audition()}
                                    />
                                )}
                            </Field>

                            <Field label={t('level')} value={`${spec.level > 0 ? '+' : ''}${format.number(spec.level, { maximumFractionDigits: 1 })} dB`}>
                                {({ labelledBy }) => (
                                    <Slider
                                        aria-labelledby={labelledBy}
                                        min={MACRO_RANGES.level.min}
                                        max={MACRO_RANGES.level.max}
                                        step={0.5}
                                        value={[spec.level]}
                                        onValueChange={([value]) => update({ level: value })}
                                        onValueCommit={() => void audition()}
                                    />
                                )}
                            </Field>
                        </div>
                    )}
                </div>

                <DialogFooter className="gap-2 sm:justify-between">
                    <div className="flex gap-2">
                        <Button variant="ghost" size="sm" onClick={() => void audition()}>
                            <Play className="mr-1.5 h-3.5 w-3.5" />
                            {t('preview')}
                        </Button>
                        <Button variant="ghost" size="sm" onClick={handleRevert}>
                            <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                            {t('revert')}
                        </Button>
                        <Button variant="ghost" size="sm" onClick={handleExport}>
                            <Download className="mr-1.5 h-3.5 w-3.5" />
                            {t('export')}
                        </Button>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={onClose}>
                            {t('cancel')}
                        </Button>
                        <Button size="sm" onClick={() => void handleSave()} disabled={isSaving}>
                            <Save className={cn('mr-1.5 h-3.5 w-3.5', isSaving && 'animate-pulse')} />
                            {t('save')}
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
