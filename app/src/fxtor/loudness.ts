import { biquad, type Biquad } from './biquad';

const SHELF_HZ = 1681.974450955533;
const SHELF_DB = 3.999843853973347;
const SHELF_Q = 0.7071752369554196;
const SHELF_VB_EXP = 0.4996667741545416;
const HIGHPASS_HZ = 38.13547087602444;
const HIGHPASS_Q = 0.5003270373238773;
const LOUDNESS_OFFSET = -0.691;
const BLOCK_SECONDS = 0.4;
const STEP_SECONDS = 0.1;
const ABSOLUTE_GATE = -70;
const RELATIVE_GATE = -10;
const OVERSAMPLE = 4;
const TAPS_PER_PHASE = 12;
const SILENCE = -Infinity;

export const kWeighting = (sampleRate: number): [Biquad, Biquad] => {
  const ks = Math.tan((Math.PI * SHELF_HZ) / sampleRate);
  const vh = Math.pow(10, SHELF_DB / 20);
  const vb = Math.pow(vh, SHELF_VB_EXP);
  const a0s = 1 + ks / SHELF_Q + ks * ks;
  const shelf: Biquad = {
    b0: (vh + (vb * ks) / SHELF_Q + ks * ks) / a0s,
    b1: (2 * (ks * ks - vh)) / a0s,
    b2: (vh - (vb * ks) / SHELF_Q + ks * ks) / a0s,
    a1: (2 * (ks * ks - 1)) / a0s,
    a2: (1 - ks / SHELF_Q + ks * ks) / a0s,
  };
  const kh = Math.tan((Math.PI * HIGHPASS_HZ) / sampleRate);
  const a0h = 1 + kh / HIGHPASS_Q + kh * kh;
  const highpass: Biquad = {
    b0: 1,
    b1: -2,
    b2: 1,
    a1: (2 * (kh * kh - 1)) / a0h,
    a2: (1 - kh / HIGHPASS_Q + kh * kh) / a0h,
  };
  return [shelf, highpass];
};

const toLufs = (power: number): number =>
  power > 0 ? LOUDNESS_OFFSET + 10 * Math.log10(power) : SILENCE;

export const blockPowers = (channels: Float32Array[], sampleRate: number): number[] => {
  const [shelf, highpass] = kWeighting(sampleRate);
  const weighted = channels.map((c) => biquad(biquad(c, shelf), highpass));
  const frames = channels[0]?.length ?? 0;
  const block = Math.round(BLOCK_SECONDS * sampleRate);
  const step = Math.round(STEP_SECONDS * sampleRate);
  const squares = weighted.map((w) => {
    const cum = new Float64Array(w.length + 1);
    for (let i = 0; i < w.length; i++) cum[i + 1] = (cum[i] ?? 0) + (w[i] ?? 0) ** 2;
    return cum;
  });
  const span = Math.min(block, frames);
  if (span === 0) return [];
  const powers: number[] = [];
  for (let start = 0; start + span <= frames; start += step) {
    let sum = 0;
    squares.forEach((cum) => (sum += ((cum[start + span] ?? 0) - (cum[start] ?? 0)) / span));
    powers.push(sum);
    if (span < block) break;
  }
  return powers;
};

export const integratedLoudness = (channels: Float32Array[], sampleRate: number): number => {
  const powers = blockPowers(channels, sampleRate);
  const absolute = powers.filter((p) => toLufs(p) > ABSOLUTE_GATE);
  if (absolute.length === 0) return SILENCE;
  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const relative = toLufs(mean(absolute)) + RELATIVE_GATE;
  const gated = absolute.filter((p) => toLufs(p) > relative);
  return toLufs(mean(gated.length > 0 ? gated : absolute));
};

const interpolationTaps = (): Float32Array[] => {
  const half = (TAPS_PER_PHASE * OVERSAMPLE) / 2;
  return Array.from({ length: OVERSAMPLE - 1 }, (_, i) => {
    const phase = i + 1;
    const taps = new Float32Array(TAPS_PER_PHASE);
    for (let k = 0; k < TAPS_PER_PHASE; k++) {
      const n = k * OVERSAMPLE + phase - half;
      const x = n / OVERSAMPLE;
      const sinc = Math.sin(Math.PI * x) / (Math.PI * x);
      const w = 0.5 + 0.5 * Math.cos((Math.PI * n) / (half + 1));
      taps[k] = sinc * w;
    }
    return taps;
  });
};

const PHASE_TAPS = interpolationTaps();
const CENTER = TAPS_PER_PHASE / 2;

export const truePeakEnvelope = (channels: Float32Array[]): Float32Array => {
  const frames = channels[0]?.length ?? 0;
  const env = new Float32Array(frames);
  for (const data of channels) {
    for (let i = 0; i < frames; i++) {
      let peak = Math.abs(data[i] ?? 0);
      for (const taps of PHASE_TAPS) {
        let acc = 0;
        const base = i - CENTER;
        for (let k = 0; k < TAPS_PER_PHASE; k++) acc += (data[base + k] ?? 0) * (taps[k] ?? 0);
        const v = Math.abs(acc);
        if (v > peak) peak = v;
      }
      if (peak > (env[i] ?? 0)) env[i] = peak;
    }
  }
  return env;
};

export const truePeak = (channels: Float32Array[]): number =>
  truePeakEnvelope(channels).reduce((m, v) => (v > m ? v : m), 0);

export const linearToDb = (v: number): number => (v > 0 ? 20 * Math.log10(v) : SILENCE);

export const truePeakDb = (channels: Float32Array[]): number => linearToDb(truePeak(channels));
