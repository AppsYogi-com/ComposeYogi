#!/usr/bin/env node
/**
 * Generate synthetic drum samples as WAV files.
 * Creates a "punchy" drum kit with synthesized sounds.
 * 
 * Usage: node scripts/generate-drum-samples.js
 */

const fs = require('fs');
const path = require('path');

const SAMPLE_RATE = 44100;
const OUTPUT_DIR = path.join(__dirname, '..', 'public', 'samples', 'drums-punchy');

// ============================================
// WAV File Writer
// ============================================

function writeWav(filename, samples, sampleRate = SAMPLE_RATE) {
    const numChannels = 1;
    const bitsPerSample = 16;
    const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
    const blockAlign = numChannels * (bitsPerSample / 8);
    const dataSize = samples.length * (bitsPerSample / 8);
    const fileSize = 36 + dataSize;

    const buffer = Buffer.alloc(44 + dataSize);
    let offset = 0;

    // RIFF header
    buffer.write('RIFF', offset); offset += 4;
    buffer.writeUInt32LE(fileSize, offset); offset += 4;
    buffer.write('WAVE', offset); offset += 4;

    // fmt chunk
    buffer.write('fmt ', offset); offset += 4;
    buffer.writeUInt32LE(16, offset); offset += 4; // chunk size
    buffer.writeUInt16LE(1, offset); offset += 2;  // PCM
    buffer.writeUInt16LE(numChannels, offset); offset += 2;
    buffer.writeUInt32LE(sampleRate, offset); offset += 4;
    buffer.writeUInt32LE(byteRate, offset); offset += 4;
    buffer.writeUInt16LE(blockAlign, offset); offset += 2;
    buffer.writeUInt16LE(bitsPerSample, offset); offset += 2;

    // data chunk
    buffer.write('data', offset); offset += 4;
    buffer.writeUInt32LE(dataSize, offset); offset += 4;

    for (let i = 0; i < samples.length; i++) {
        const clamped = Math.max(-1, Math.min(1, samples[i]));
        const intSample = Math.round(clamped * 32767);
        buffer.writeInt16LE(intSample, offset);
        offset += 2;
    }

    const filepath = path.join(OUTPUT_DIR, filename);
    fs.writeFileSync(filepath, buffer);
    console.log(`  ✓ ${filename} (${(samples.length / sampleRate).toFixed(3)}s)`);
}

// ============================================
// Synthesis Helpers
// ============================================

function envelope(t, attack, decay, sustain, release, duration) {
    if (t < attack) return t / attack;
    if (t < attack + decay) return 1 - (1 - sustain) * ((t - attack) / decay);
    if (t < duration - release) return sustain;
    if (t < duration) return sustain * (1 - (t - (duration - release)) / release);
    return 0;
}

function expDecay(t, decay) {
    return Math.exp(-t / decay);
}

function noise() {
    return Math.random() * 2 - 1;
}

function bandpass(samples, centerFreq, bandwidth, sampleRate) {
    // Simple 2-pole bandpass filter
    const omega = 2 * Math.PI * centerFreq / sampleRate;
    const bw = 2 * Math.PI * bandwidth / sampleRate;
    const alpha = Math.sin(omega) * Math.sinh(Math.log(2) / 2 * bw * omega / Math.sin(omega));

    const b0 = alpha;
    const b1 = 0;
    const b2 = -alpha;
    const a0 = 1 + alpha;
    const a1 = -2 * Math.cos(omega);
    const a2 = 1 - alpha;

    const output = new Float64Array(samples.length);
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0;

    for (let i = 0; i < samples.length; i++) {
        const x0 = samples[i];
        output[i] = (b0 / a0) * x0 + (b1 / a0) * x1 + (b2 / a0) * x2
            - (a1 / a0) * y1 - (a2 / a0) * y2;
        x2 = x1; x1 = x0;
        y2 = y1; y1 = output[i];
    }
    return output;
}

function highpass(samples, cutoff, sampleRate) {
    const rc = 1 / (2 * Math.PI * cutoff);
    const dt = 1 / sampleRate;
    const alpha = rc / (rc + dt);
    const output = new Float64Array(samples.length);
    output[0] = samples[0];
    for (let i = 1; i < samples.length; i++) {
        output[i] = alpha * (output[i - 1] + samples[i] - samples[i - 1]);
    }
    return output;
}

function lowpass(samples, cutoff, sampleRate) {
    const rc = 1 / (2 * Math.PI * cutoff);
    const dt = 1 / sampleRate;
    const alpha = dt / (rc + dt);
    const output = new Float64Array(samples.length);
    output[0] = alpha * samples[0];
    for (let i = 1; i < samples.length; i++) {
        output[i] = output[i - 1] + alpha * (samples[i] - output[i - 1]);
    }
    return output;
}

// ============================================
// Drum Synthesis
// ============================================

function synthKickPunchy() {
    // Classic punchy kick: sine wave with fast pitch drop + subtle click transient
    const duration = 0.35;
    const numSamples = Math.floor(SAMPLE_RATE * duration);
    const samples = new Float64Array(numSamples);

    for (let i = 0; i < numSamples; i++) {
        const t = i / SAMPLE_RATE;

        // Pitch envelope: 150Hz → 45Hz fast sweep
        const pitchEnv = 45 + 105 * expDecay(t, 0.015);
        // Phase accumulation for pitch sweep
        let phase = 0;
        for (let j = 0; j <= i; j++) {
            const tj = j / SAMPLE_RATE;
            const freq = 45 + 105 * expDecay(tj, 0.015);
            phase += freq / SAMPLE_RATE;
        }

        // Body: sine wave
        const body = Math.sin(2 * Math.PI * phase) * expDecay(t, 0.15);

        // Click transient
        const click = noise() * expDecay(t, 0.003) * 0.3;

        // Amplitude envelope
        const amp = envelope(t, 0.001, 0.05, 0.3, 0.1, duration);

        samples[i] = (body * 0.85 + click) * amp;
    }

    // Apply lowpass to tame harshness
    return Array.from(lowpass(samples, 8000, SAMPLE_RATE));
}

function synthKickSub() {
    // Sub kick: deeper, longer tail
    const duration = 0.5;
    const numSamples = Math.floor(SAMPLE_RATE * duration);
    const samples = new Float64Array(numSamples);

    for (let i = 0; i < numSamples; i++) {
        const t = i / SAMPLE_RATE;
        let phase = 0;
        for (let j = 0; j <= i; j++) {
            const tj = j / SAMPLE_RATE;
            const freq = 38 + 80 * expDecay(tj, 0.02);
            phase += freq / SAMPLE_RATE;
        }
        const body = Math.sin(2 * Math.PI * phase) * expDecay(t, 0.25);
        const amp = envelope(t, 0.001, 0.1, 0.2, 0.15, duration);
        samples[i] = body * amp * 0.9;
    }

    return Array.from(lowpass(samples, 5000, SAMPLE_RATE));
}

function synthSnarePunchy() {
    // Punchy snare: short body tone + noise burst
    const duration = 0.25;
    const numSamples = Math.floor(SAMPLE_RATE * duration);
    const samples = new Float64Array(numSamples);

    for (let i = 0; i < numSamples; i++) {
        const t = i / SAMPLE_RATE;

        // Body: tuned resonance at ~180Hz
        const body = Math.sin(2 * Math.PI * 180 * t) * expDecay(t, 0.05) * 0.6;

        // Noise (snare wires)
        const noiseSignal = noise() * expDecay(t, 0.08) * 0.7;

        // Transient click
        const click = noise() * expDecay(t, 0.002) * 0.4;

        samples[i] = body + noiseSignal + click;
    }

    // Bandpass the noise to sound more realistic
    const filtered = bandpass(samples, 3000, 2000, SAMPLE_RATE);
    // Mix filtered and original
    const result = new Float64Array(numSamples);
    for (let i = 0; i < numSamples; i++) {
        result[i] = samples[i] * 0.5 + filtered[i] * 0.5;
    }
    return Array.from(result);
}

function synthSnareClap() {
    // Clap: multiple noise bursts slightly offset
    const duration = 0.3;
    const numSamples = Math.floor(SAMPLE_RATE * duration);
    const samples = new Float64Array(numSamples);

    // 3 micro-timed slaps + tail
    const slapTimes = [0, 0.008, 0.018];
    for (let i = 0; i < numSamples; i++) {
        const t = i / SAMPLE_RATE;
        let signal = 0;
        for (const slapT of slapTimes) {
            const dt = t - slapT;
            if (dt >= 0) {
                signal += noise() * expDecay(dt, 0.015) * 0.4;
            }
        }
        // Tail
        signal += noise() * expDecay(t, 0.1) * 0.3;
        samples[i] = signal;
    }

    const filtered = bandpass(samples, 1200, 800, SAMPLE_RATE);
    return Array.from(filtered);
}

function synthHihatClosed() {
    // Closed hi-hat: short burst of filtered noise
    const duration = 0.08;
    const numSamples = Math.floor(SAMPLE_RATE * duration);
    const samples = new Float64Array(numSamples);

    for (let i = 0; i < numSamples; i++) {
        const t = i / SAMPLE_RATE;
        // Mix of metallic tones
        const metal = Math.sin(2 * Math.PI * 3500 * t) * 0.2 +
            Math.sin(2 * Math.PI * 5200 * t) * 0.15 +
            Math.sin(2 * Math.PI * 7800 * t) * 0.1;
        const noiseSignal = noise() * 0.5;
        samples[i] = (metal + noiseSignal) * expDecay(t, 0.02);
    }

    return Array.from(highpass(samples, 4000, SAMPLE_RATE));
}

function synthHihatOpen() {
    // Open hi-hat: longer version
    const duration = 0.4;
    const numSamples = Math.floor(SAMPLE_RATE * duration);
    const samples = new Float64Array(numSamples);

    for (let i = 0; i < numSamples; i++) {
        const t = i / SAMPLE_RATE;
        const metal = Math.sin(2 * Math.PI * 3500 * t) * 0.2 +
            Math.sin(2 * Math.PI * 5200 * t) * 0.15 +
            Math.sin(2 * Math.PI * 7800 * t) * 0.1 +
            Math.sin(2 * Math.PI * 10200 * t) * 0.05;
        const noiseSignal = noise() * 0.5;
        samples[i] = (metal + noiseSignal) * expDecay(t, 0.15);
    }

    return Array.from(highpass(samples, 3000, SAMPLE_RATE));
}

function synthHihatPedal() {
    // Pedal hi-hat: very short, tight
    const duration = 0.05;
    const numSamples = Math.floor(SAMPLE_RATE * duration);
    const samples = new Float64Array(numSamples);

    for (let i = 0; i < numSamples; i++) {
        const t = i / SAMPLE_RATE;
        const metal = Math.sin(2 * Math.PI * 4000 * t) * 0.2 +
            Math.sin(2 * Math.PI * 6000 * t) * 0.15;
        const noiseSignal = noise() * 0.4;
        samples[i] = (metal + noiseSignal) * expDecay(t, 0.012);
    }

    return Array.from(highpass(samples, 5000, SAMPLE_RATE));
}

function synthRim() {
    // Rim shot: short resonant click
    const duration = 0.06;
    const numSamples = Math.floor(SAMPLE_RATE * duration);
    const samples = new Float64Array(numSamples);

    for (let i = 0; i < numSamples; i++) {
        const t = i / SAMPLE_RATE;
        const tone = Math.sin(2 * Math.PI * 800 * t) * 0.5;
        const click = noise() * expDecay(t, 0.002) * 0.5;
        samples[i] = (tone + click) * expDecay(t, 0.015);
    }

    return Array.from(samples);
}

function synthShaker() {
    // Shaker: gentle noise burst
    const duration = 0.15;
    const numSamples = Math.floor(SAMPLE_RATE * duration);
    const samples = new Float64Array(numSamples);

    for (let i = 0; i < numSamples; i++) {
        const t = i / SAMPLE_RATE;
        samples[i] = noise() * expDecay(t, 0.05) * 0.4;
    }

    return Array.from(highpass(samples, 6000, SAMPLE_RATE));
}

// ============================================
// Main
// ============================================

console.log('🥁 Generating punchy drum samples...\n');

if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

writeWav('kick-punchy.wav', synthKickPunchy());
writeWav('kick-sub.wav', synthKickSub());
writeWav('snare-punchy.wav', synthSnarePunchy());
writeWav('snare-clap.wav', synthSnareClap());
writeWav('hihat-closed.wav', synthHihatClosed());
writeWav('hihat-open.wav', synthHihatOpen());
writeWav('hihat-pedal.wav', synthHihatPedal());
writeWav('perc-rim.wav', synthRim());
writeWav('perc-shaker.wav', synthShaker());

console.log('\n✅ All punchy drum samples generated in public/samples/drums-punchy/');
