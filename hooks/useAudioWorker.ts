'use client';

import { useCallback, useRef, useEffect, useState } from 'react';
import type { AudioWorkerResponse } from '@/types';

// ============================================
// Types
// ============================================

interface ActiveJob {
    resolve: (result: any) => void;
    reject: (error: Error) => void;
    onProgress?: (progress: number, message?: string) => void;
}

interface PeaksResult {
    min: Float32Array;
    max: Float32Array;
}

interface ComputePeaksOptions {
    targetWidth: number;
    samplesPerPixel?: number;
    onProgress?: (progress: number, message?: string) => void;
}

interface ComputeMultiZoomOptions {
    zoomLevels?: number[];
    onProgress?: (progress: number, message?: string) => void;
}

// ============================================
// Hook
// ============================================

export function useAudioWorker() {
    const workerRef = useRef<Worker | null>(null);
    const jobsRef = useRef<Map<string, ActiveJob>>(new Map());
    const jobCounter = useRef(0);
    const [isReady, setIsReady] = useState(false);

    // Initialize worker
    useEffect(() => {
        if (typeof window === 'undefined') return;

        workerRef.current = new Worker('/workers/audio-peaks-worker.js');

        workerRef.current.onmessage = (e: MessageEvent<AudioWorkerResponse>) => {
            const { type, jobId, progress, message, peaks, error } = e.data;
            const job = jobsRef.current.get(jobId);
            if (!job) return;

            switch (type) {
                case 'progress':
                    job.onProgress?.(progress ?? 0, message);
                    break;
                case 'result':
                    jobsRef.current.delete(jobId);
                    job.resolve({ peaks, meta: (e.data as any).meta });
                    break;
                case 'error':
                    jobsRef.current.delete(jobId);
                    job.reject(new Error(error ?? 'Unknown error'));
                    break;
            }
        };

        workerRef.current.onerror = (e) => {
            console.error('[AudioWorker] Error:', e);
        };

        setIsReady(true);

        return () => {
            workerRef.current?.terminate();
            jobsRef.current.clear();
        };
    }, []);

    // Compute peaks for a single zoom level
    const computePeaks = useCallback(async (
        audioBuffer: AudioBuffer,
        options: ComputePeaksOptions
    ): Promise<{ peaks: PeaksResult; meta: any }> => {
        if (!workerRef.current) throw new Error('Worker not initialized');

        const { targetWidth, samplesPerPixel, onProgress } = options;
        const jobId = `peaks-${++jobCounter.current}-${Date.now()}`;

        // Extract channel data (create copies for transfer)
        const channelData: Float32Array[] = [];
        const transferables: ArrayBuffer[] = [];

        for (let i = 0; i < audioBuffer.numberOfChannels; i++) {
            const data = audioBuffer.getChannelData(i).slice(); // Copy for transfer
            channelData.push(data);
            transferables.push(data.buffer);
        }

        return new Promise((resolve, reject) => {
            jobsRef.current.set(jobId, { resolve, reject, onProgress });

            // Transfer ownership of ArrayBuffers (zero-copy!)
            workerRef.current!.postMessage(
                {
                    type: 'computePeaks',
                    jobId,
                    data: {
                        channelData,
                        sampleRate: audioBuffer.sampleRate,
                        targetWidth,
                        samplesPerPixel,
                    }
                },
                transferables
            );
        });
    }, []);

    // Compute peaks for multiple zoom levels
    const computeMultiZoom = useCallback(async (
        audioBuffer: AudioBuffer,
        options: ComputeMultiZoomOptions = {}
    ): Promise<{ peaks: Record<number, PeaksResult>; meta: any }> => {
        if (!workerRef.current) throw new Error('Worker not initialized');

        const {
            zoomLevels = [512, 1024, 2048, 4096],
            onProgress
        } = options;
        const jobId = `multizoom-${++jobCounter.current}-${Date.now()}`;

        // Extract channel data
        const channelData: Float32Array[] = [];
        const transferables: ArrayBuffer[] = [];

        for (let i = 0; i < audioBuffer.numberOfChannels; i++) {
            const data = audioBuffer.getChannelData(i).slice();
            channelData.push(data);
            transferables.push(data.buffer);
        }

        return new Promise((resolve, reject) => {
            jobsRef.current.set(jobId, { resolve, reject, onProgress });

            workerRef.current!.postMessage(
                {
                    type: 'computeMultiZoom',
                    jobId,
                    data: {
                        channelData,
                        sampleRate: audioBuffer.sampleRate,
                        zoomLevels,
                    }
                },
                transferables
            );
        });
    }, []);

    // Cancel a job
    const cancel = useCallback((jobId: string) => {
        workerRef.current?.postMessage({ type: 'cancel', jobId });
        jobsRef.current.delete(jobId);
    }, []);

    // Cancel all jobs
    const cancelAll = useCallback(() => {
        jobsRef.current.forEach((_, jobId) => {
            workerRef.current?.postMessage({ type: 'cancel', jobId });
        });
        jobsRef.current.clear();
    }, []);

    return {
        isReady,
        computePeaks,
        computeMultiZoom,
        cancel,
        cancelAll,
    };
}
