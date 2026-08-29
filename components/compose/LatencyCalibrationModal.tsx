'use client';

// ============================================
// ComposeYogi — Latency Calibration Modal
// UI for automatic latency detection and configuration
// ============================================

import { useState, useCallback } from 'react';
import { useTranslations, useFormatter } from 'next-intl';
import {
    Activity,
    AlertCircle,
    CheckCircle,
    Headphones,
    Loader2,
    Mic,
    Play,
    Settings2,
    Volume2,
    X,
} from 'lucide-react';
import {
    latencyCalibrator,
    type CalibrationProgress,
    type LatencyCalibrationResult,
} from '@/lib/audio/latency-calibration';

// ============================================
// Types
// ============================================

interface LatencyCalibrationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onCalibrationComplete: (result: LatencyCalibrationResult) => void;
}

type CalibrationState = 'idle' | 'instructions' | 'calibrating' | 'complete' | 'error';

// ============================================
// Modal Component
// ============================================

export function LatencyCalibrationModal({
    isOpen,
    onClose,
    onCalibrationComplete,
}: LatencyCalibrationModalProps) {
    const t = useTranslations('calibration');
    const [state, setState] = useState<CalibrationState>('idle');
    const [progress, setProgress] = useState<CalibrationProgress | null>(null);
    const [result, setResult] = useState<LatencyCalibrationResult | null>(null);
    const [manualLatency, setManualLatency] = useState<number>(0);

    // ========================================
    // Handlers
    // ========================================

    const handleStartCalibration = useCallback(async () => {
        setState('calibrating');
        setProgress(null);
        setResult(null);

        const calibrationResult = await latencyCalibrator.calibrate((p) => {
            setProgress(p);
        });

        setResult(calibrationResult);
        setState(calibrationResult.success ? 'complete' : 'error');
    }, []);

    const handleAcceptResult = useCallback(() => {
        if (result && result.success) {
            onCalibrationComplete(result);
            onClose();
        }
    }, [result, onCalibrationComplete, onClose]);

    const handleUseManual = useCallback(() => {
        const manualResult: LatencyCalibrationResult = {
            roundTripLatencyMs: manualLatency * 2,
            inputLatencyMs: manualLatency,
            outputLatencyMs: manualLatency,
            totalLatencyMs: manualLatency * 2,
            confidence: 1,
            sampleCount: 1,
            success: true,
        };
        onCalibrationComplete(manualResult);
        onClose();
    }, [manualLatency, onCalibrationComplete, onClose]);

    const handleClose = useCallback(() => {
        if (state !== 'calibrating') {
            setState('idle');
            setProgress(null);
            setResult(null);
            onClose();
        }
    }, [state, onClose]);

    // ========================================
    // Render Helpers
    // ========================================

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-scrim/60 backdrop-blur-sm">
            <div className="bg-background border border-border rounded-lg shadow-xl w-full max-w-md mx-4">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-border">
                    <div className="flex items-center gap-3">
                        <Activity className="w-5 h-5 text-primary" />
                        <h2 className="text-lg font-semibold text-foreground">
                            {t('title')}
                        </h2>
                    </div>
                    <button
                        onClick={handleClose}
                        disabled={state === 'calibrating'}
                        className="p-1 rounded hover:bg-muted disabled:opacity-50 transition-colors"
                    >
                        <X className="w-5 h-5 text-muted-foreground" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6">
                    {state === 'idle' && (
                        <IdleView onStart={() => setState('instructions')} />
                    )}

                    {state === 'instructions' && (
                        <InstructionsView onContinue={handleStartCalibration} />
                    )}

                    {state === 'calibrating' && progress && (
                        <CalibratingView progress={progress} />
                    )}

                    {state === 'complete' && result && (
                        <CompleteView
                            result={result}
                            onAccept={handleAcceptResult}
                            onRetry={handleStartCalibration}
                        />
                    )}

                    {state === 'error' && result && (
                        <ErrorView
                            error={result.error || t('unknownError')}
                            onRetry={handleStartCalibration}
                            manualLatency={manualLatency}
                            onManualChange={setManualLatency}
                            onUseManual={handleUseManual}
                        />
                    )}
                </div>
            </div>
        </div>
    );
}

// ============================================
// Sub-views
// ============================================

function IdleView({ onStart }: { onStart: () => void }) {
    const t = useTranslations('calibration');
    const format = useFormatter();
    const systemLatency = latencyCalibrator.constructor.prototype.constructor.getSystemLatency
        ? { baseLatency: 0, outputLatency: 0 }
        : { baseLatency: 0, outputLatency: 0 };

    return (
        <div className="space-y-6">
            <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
                    <Headphones className="w-8 h-8 text-primary" />
                </div>
                <p className="text-muted-foreground">
                    {t('description')}
                </p>
            </div>

            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                <h4 className="text-sm font-medium text-foreground">
                    {t('systemReported')}
                </h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                        <span className="text-muted-foreground">{t('base')} </span>
                        <span className="text-foreground">
                            {format.number(systemLatency.baseLatency, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} ms
                        </span>
                    </div>
                    <div>
                        <span className="text-muted-foreground">{t('output')} </span>
                        <span className="text-foreground">
                            {format.number(systemLatency.outputLatency, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} ms
                        </span>
                    </div>
                </div>
            </div>

            <button
                onClick={onStart}
                className="w-full py-3 px-4 bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
            >
                <Play className="w-4 h-4" />
                {t('start')}
            </button>
        </div>
    );
}

function InstructionsView({ onContinue }: { onContinue: () => void }) {
    const t = useTranslations('calibration.instructions');

    return (
        <div className="space-y-6">
            <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-warning/10 flex items-center justify-center">
                    <Settings2 className="w-8 h-8 text-warning" />
                </div>
                <h3 className="text-lg font-medium text-foreground mb-2">
                    {t('title')}
                </h3>
            </div>

            <div className="space-y-4">
                <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Volume2 className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                        <h4 className="font-medium text-foreground">
                            {t('speakers.title')}
                        </h4>
                        <p className="text-sm text-muted-foreground">
                            {t('speakers.body')}
                        </p>
                    </div>
                </div>

                <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Mic className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                        <h4 className="font-medium text-foreground">
                            {t('microphone.title')}
                        </h4>
                        <p className="text-sm text-muted-foreground">
                            {t('microphone.body')}
                        </p>
                    </div>
                </div>

                <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-warning/10 flex items-center justify-center flex-shrink-0">
                        <AlertCircle className="w-4 h-4 text-warning" />
                    </div>
                    <div>
                        <h4 className="font-medium text-foreground">
                            {t('quiet.title')}
                        </h4>
                        <p className="text-sm text-muted-foreground">
                            {t('quiet.body')}
                        </p>
                    </div>
                </div>
            </div>

            <button
                onClick={onContinue}
                className="w-full py-3 px-4 bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
            >
                <Play className="w-4 h-4" />
                {t('continue')}
            </button>
        </div>
    );
}

function CalibratingView({ progress }: { progress: CalibrationProgress }) {
    const t = useTranslations('calibration');

    return (
        <div className="space-y-6 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
            </div>

            <div>
                <h3 className="text-lg font-medium text-foreground mb-2">
                    {progress.phase}
                </h3>
                <p className="text-sm text-muted-foreground">
                    {t('step', { step: progress.step, total: progress.totalSteps })}
                </p>
            </div>

            {/* Progress bar */}
            <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                <div
                    className="h-full bg-primary transition-all duration-300"
                    style={{ width: `${progress.percentage}%` }}
                />
            </div>

            <p className="text-sm text-muted-foreground">
                {t('beepsHint')}
            </p>
        </div>
    );
}

function CompleteView({
    result,
    onAccept,
    onRetry,
}: {
    result: LatencyCalibrationResult;
    onAccept: () => void;
    onRetry: () => void;
}) {
    const t = useTranslations('calibration.result');
    const confidenceColor =
        result.confidence > 0.7
            ? 'text-success'
            : result.confidence > 0.4
                ? 'text-warning'
                : 'text-destructive';

    return (
        <div className="space-y-6">
            <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-success/10 flex items-center justify-center">
                    <CheckCircle className="w-8 h-8 text-success" />
                </div>
                <h3 className="text-lg font-medium text-foreground">
                    {t('title')}
                </h3>
            </div>

            <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">{t('roundTrip')}</span>
                    <span className="font-mono font-medium text-foreground">
                        {result.roundTripLatencyMs} ms
                    </span>
                </div>
                <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">{t('inputCompensation')}</span>
                    <span className="font-mono text-foreground">
                        {result.inputLatencyMs} ms
                    </span>
                </div>
                <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">{t('outputCompensation')}</span>
                    <span className="font-mono text-foreground">
                        {result.outputLatencyMs} ms
                    </span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-border">
                    <span className="text-muted-foreground">{t('confidence')}</span>
                    <span className={`font-medium ${confidenceColor}`}>
                        {Math.round(result.confidence * 100)}%
                    </span>
                </div>
                <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">{t('samplesUsed')}</span>
                    <span className="text-foreground">
                        {result.sampleCount}
                    </span>
                </div>
            </div>

            <div className="flex gap-3">
                <button
                    onClick={onRetry}
                    className="flex-1 py-3 px-4 border border-border hover:bg-muted text-foreground font-medium rounded-lg transition-colors"
                >
                    {t('retry')}
                </button>
                <button
                    onClick={onAccept}
                    className="flex-1 py-3 px-4 bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded-lg transition-colors"
                >
                    {t('apply')}
                </button>
            </div>
        </div>
    );
}

function ErrorView({
    error,
    onRetry,
    manualLatency,
    onManualChange,
    onUseManual,
}: {
    error: string;
    onRetry: () => void;
    manualLatency: number;
    onManualChange: (value: number) => void;
    onUseManual: () => void;
}) {
    const t = useTranslations('calibration.error');

    return (
        <div className="space-y-6">
            <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-destructive/10 flex items-center justify-center">
                    <AlertCircle className="w-8 h-8 text-destructive" />
                </div>
                <h3 className="text-lg font-medium text-foreground">
                    {t('title')}
                </h3>
                <p className="text-sm text-muted-foreground mt-2">
                    {error}
                </p>
            </div>

            <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                <h4 className="text-sm font-medium text-foreground">
                    {t('manualTitle')}
                </h4>
                <div className="flex items-center gap-3">
                    <input
                        type="range"
                        min="0"
                        max="200"
                        step="1"
                        value={manualLatency}
                        onChange={(e) => onManualChange(Number(e.target.value))}
                        className="flex-1 h-1 cursor-pointer appearance-none rounded-full bg-muted [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary"
                    />
                    <div className="w-16 text-right">
                        <span className="font-mono text-foreground">
                            {manualLatency} ms
                        </span>
                    </div>
                </div>
                <p className="text-xs text-muted-foreground">
                    {t('manualHint')}
                </p>
            </div>

            <div className="flex gap-3">
                <button
                    onClick={onRetry}
                    className="flex-1 py-3 px-4 border border-border hover:bg-muted text-foreground font-medium rounded-lg transition-colors"
                >
                    {t('retry')}
                </button>
                <button
                    onClick={onUseManual}
                    className="flex-1 py-3 px-4 bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded-lg transition-colors"
                >
                    {t('useManual')}
                </button>
            </div>
        </div>
    );
}
