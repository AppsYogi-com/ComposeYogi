// ============================================
// ComposeYogi — Web Worker for Peak Computation
// Zero-copy audio analysis using Transferable Objects
// ============================================

let cancelledJobs = new Set();

self.onmessage = async (e) => {
    const { type, jobId, data } = e.data;

    // Handle cancellation request
    if (type === 'cancel') {
        cancelledJobs.add(jobId);
        return;
    }

    // Handle peak computation
    if (type === 'computePeaks') {
        try {
            const { channelData, sampleRate, targetWidth, samplesPerPixel: requestedSpp } = data;

            // Calculate samples per pixel if not provided
            const samples = channelData[0].length;
            const samplesPerPixel = requestedSpp || Math.ceil(samples / targetWidth);
            const actualWidth = Math.ceil(samples / samplesPerPixel);

            // Report start
            self.postMessage({
                type: 'progress',
                jobId,
                progress: 0,
                message: 'Starting waveform analysis...'
            });

            // Merge channels to mono for waveform display
            const mono = new Float32Array(samples);
            const numChannels = channelData.length;

            for (let i = 0; i < samples; i++) {
                let sum = 0;
                for (let ch = 0; ch < numChannels; ch++) {
                    sum += channelData[ch][i];
                }
                mono[i] = sum / numChannels;
            }

            // Check for cancellation
            if (cancelledJobs.has(jobId)) {
                cancelledJobs.delete(jobId);
                return;
            }

            self.postMessage({
                type: 'progress',
                jobId,
                progress: 20,
                message: 'Computing peaks...'
            });

            // Compute peaks
            const min = new Float32Array(actualWidth);
            const max = new Float32Array(actualWidth);

            for (let px = 0; px < actualWidth; px++) {
                // Check for cancellation periodically
                if (px % 500 === 0) {
                    if (cancelledJobs.has(jobId)) {
                        cancelledJobs.delete(jobId);
                        return;
                    }

                    // Report progress
                    const progress = 20 + Math.round((px / actualWidth) * 70);
                    self.postMessage({
                        type: 'progress',
                        jobId,
                        progress,
                        message: `Computing waveform... ${progress}%`
                    });
                }

                const start = px * samplesPerPixel;
                const end = Math.min(start + samplesPerPixel, samples);

                let minVal = Infinity;
                let maxVal = -Infinity;

                for (let i = start; i < end; i++) {
                    const val = mono[i];
                    if (val < minVal) minVal = val;
                    if (val > maxVal) maxVal = val;
                }

                min[px] = minVal === Infinity ? 0 : minVal;
                max[px] = maxVal === -Infinity ? 0 : maxVal;
            }

            self.postMessage({
                type: 'progress',
                jobId,
                progress: 95,
                message: 'Finalizing...'
            });

            // Transfer back (zero-copy return)
            self.postMessage(
                {
                    type: 'result',
                    jobId,
                    peaks: { min, max },
                    meta: {
                        samplesPerPixel,
                        width: actualWidth,
                        duration: samples / sampleRate
                    }
                },
                [min.buffer, max.buffer] // Transfer ownership back
            );

        } catch (error) {
            self.postMessage({
                type: 'error',
                jobId,
                error: error.message || 'Peak computation failed'
            });
        }
    }

    // Handle multi-zoom computation
    if (type === 'computeMultiZoom') {
        try {
            const { channelData, sampleRate, zoomLevels } = data;
            const samples = channelData[0].length;
            const numChannels = channelData.length;

            // Merge to mono once
            const mono = new Float32Array(samples);
            for (let i = 0; i < samples; i++) {
                let sum = 0;
                for (let ch = 0; ch < numChannels; ch++) {
                    sum += channelData[ch][i];
                }
                mono[i] = sum / numChannels;
            }

            const results = {};
            const totalLevels = zoomLevels.length;

            for (let levelIdx = 0; levelIdx < totalLevels; levelIdx++) {
                const spp = zoomLevels[levelIdx];
                const width = Math.ceil(samples / spp);
                const min = new Float32Array(width);
                const max = new Float32Array(width);

                for (let px = 0; px < width; px++) {
                    if (px % 1000 === 0 && cancelledJobs.has(jobId)) {
                        cancelledJobs.delete(jobId);
                        return;
                    }

                    const start = px * spp;
                    const end = Math.min(start + spp, samples);

                    let minVal = Infinity;
                    let maxVal = -Infinity;

                    for (let i = start; i < end; i++) {
                        const val = mono[i];
                        if (val < minVal) minVal = val;
                        if (val > maxVal) maxVal = val;
                    }

                    min[px] = minVal === Infinity ? 0 : minVal;
                    max[px] = maxVal === -Infinity ? 0 : maxVal;
                }

                results[spp] = { min, max, width };

                self.postMessage({
                    type: 'progress',
                    jobId,
                    progress: Math.round(((levelIdx + 1) / totalLevels) * 100),
                    message: `Computing zoom level ${levelIdx + 1}/${totalLevels}`
                });
            }

            // Collect all transferables
            const transferables = [];
            Object.values(results).forEach(({ min, max }) => {
                transferables.push(min.buffer, max.buffer);
            });

            self.postMessage(
                {
                    type: 'result',
                    jobId,
                    peaks: results,
                    meta: {
                        zoomLevels,
                        duration: samples / sampleRate
                    }
                },
                transferables
            );

        } catch (error) {
            self.postMessage({
                type: 'error',
                jobId,
                error: error.message || 'Multi-zoom computation failed'
            });
        }
    }
};

// Log worker initialization
console.log('[AudioPeaksWorker] Initialized');
