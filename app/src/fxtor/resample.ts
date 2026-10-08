import { biquad, lowpass } from './biquad';

const ANTI_ALIAS_FRACTION = 0.45;
const BUTTERWORTH_8_Q = [0.5098, 0.6013, 0.9, 2.5629];

const hermite = (y0: number, y1: number, y2: number, y3: number, t: number): number => {
  const c1 = 0.5 * (y2 - y0);
  const c2 = y0 - 2.5 * y1 + 2 * y2 - 0.5 * y3;
  const c3 = 0.5 * (y3 - y0) + 1.5 * (y1 - y2);
  return ((c3 * t + c2) * t + c1) * t + y1;
};

export const resampledLength = (frames: number, ratio: number): number =>
  Math.max(1, Math.round(frames / ratio));

const reversed = (data: Float32Array): Float32Array => data.slice().reverse();

export const antiAlias = (
  input: Float32Array,
  cutoff: number,
  sampleRate: number,
): Float32Array => {
  const stages = BUTTERWORTH_8_Q.map((q) => lowpass(cutoff, q, sampleRate));
  const pass = (data: Float32Array) => stages.reduce(biquad, data);
  return reversed(pass(reversed(pass(input))));
};

export const resampleChannel = (
  input: Float32Array,
  ratio: number,
  sampleRate: number,
): Float32Array => {
  const source =
    ratio > 1 ? antiAlias(input, (ANTI_ALIAS_FRACTION * sampleRate) / ratio, sampleRate) : input;
  const length = resampledLength(input.length, ratio);
  const out = new Float32Array(length);
  const at = (i: number) => source[Math.min(source.length - 1, Math.max(0, i))] ?? 0;
  for (let i = 0; i < length; i++) {
    const pos = i * ratio;
    const k = Math.floor(pos);
    out[i] = hermite(at(k - 1), at(k), at(k + 1), at(k + 2), pos - k);
  }
  return out;
};

export const resample = (
  channels: Float32Array[],
  ratio: number,
  sampleRate: number,
): Float32Array[] => channels.map((c) => resampleChannel(c, ratio, sampleRate));
