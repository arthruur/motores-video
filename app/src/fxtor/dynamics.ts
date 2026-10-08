import { truePeak, truePeakEnvelope } from './loudness';

export interface CompressorSettings {
  thresholdDb: number;
  ratio: number;
  kneeDb: number;
  attackSeconds: number;
  releaseSeconds: number;
  sampleRate: number;
}

const DB_FLOOR = -120;

const toDb = (v: number) => (v > 0 ? 20 * Math.log10(v) : DB_FLOOR);

const gainReductionDb = (levelDb: number, { thresholdDb, ratio, kneeDb }: CompressorSettings) => {
  const over = levelDb - thresholdDb;
  if (over <= -kneeDb / 2) return 0;
  if (over >= kneeDb / 2) return over * (1 - 1 / ratio);
  const x = over + kneeDb / 2;
  return ((1 - 1 / ratio) * x * x) / (2 * kneeDb);
};

export const compress = (
  channels: Float32Array[],
  settings: CompressorSettings,
): Float32Array[] => {
  const frames = channels[0]?.length ?? 0;
  const attack = Math.exp(-1 / Math.max(1, settings.attackSeconds * settings.sampleRate));
  const release = Math.exp(-1 / Math.max(1, settings.releaseSeconds * settings.sampleRate));
  const gains = new Float32Array(frames);
  let envelope = 0;
  for (let i = 0; i < frames; i++) {
    let peak = 0;
    channels.forEach((c) => (peak = Math.max(peak, Math.abs(c[i] ?? 0))));
    envelope = peak > envelope ? attack * envelope + (1 - attack) * peak : release * envelope;
    gains[i] = Math.pow(10, -gainReductionDb(toDb(envelope), settings) / 20);
  }
  return channels.map((c) => c.map((v, i) => v * (gains[i] ?? 1)));
};

export interface LimiterSettings {
  ceiling: number;
  lookaheadSeconds: number;
  releaseSeconds: number;
  sampleRate: number;
}

const slidingMinAhead = (data: Float32Array, span: number): Float32Array => {
  const n = data.length;
  const w = span + 1;
  const prefix = new Float32Array(n);
  const suffix = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const v = data[i] ?? 1;
    prefix[i] = i % w === 0 ? v : Math.min(prefix[i - 1] ?? v, v);
  }
  for (let i = n - 1; i >= 0; i--) {
    const v = data[i] ?? 1;
    suffix[i] = i % w === w - 1 || i === n - 1 ? v : Math.min(suffix[i + 1] ?? v, v);
  }
  return suffix.map((v, i) => Math.min(v, prefix[Math.min(i + w - 1, n - 1)] ?? v));
};

const movingAverageBehind = (data: Float32Array, span: number): Float32Array => {
  const out = new Float32Array(data.length);
  let sum = 0;
  for (let i = 0; i < data.length; i++) {
    sum += data[i] ?? 1;
    if (i > span) sum -= data[i - span - 1] ?? 1;
    out[i] = sum / Math.min(i + 1, span + 1);
  }
  return out;
};

export const limitTruePeak = (
  channels: Float32Array[],
  { ceiling, lookaheadSeconds, releaseSeconds, sampleRate }: LimiterSettings,
): Float32Array[] => {
  const envelope = truePeakEnvelope(channels);
  if (envelope.every((v) => v <= ceiling)) return channels;
  const need = envelope.map((v) => (v > ceiling ? ceiling / v : 1));
  const span = Math.max(1, Math.round(lookaheadSeconds * sampleRate));
  const smooth = movingAverageBehind(slidingMinAhead(need, span), span);
  const release = 1 - Math.exp(-1 / Math.max(1, releaseSeconds * sampleRate));
  let g = 1;
  for (let i = 0; i < smooth.length; i++) {
    g = Math.min(smooth[i] ?? 1, g + (1 - g) * release);
    smooth[i] = g;
  }
  const limited = channels.map((c) => c.map((v, i) => v * (smooth[i] ?? 1)));
  const residual = truePeak(limited);
  return residual > ceiling ? limited.map((c) => c.map((v) => (v * ceiling) / residual)) : limited;
};
