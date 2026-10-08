import type { Rnnoise } from '@shiguredo/rnnoise-wasm';

const yieldToEventLoop = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));
const throwIfAborted = (signal: AbortSignal): void => {
  if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
};

export const RNNOISE_RATE = 48000;
export const RNNOISE_FRAME = 480;
// Measured by cross-correlation: this build's output trails its input by two frames.
const RNNOISE_DELAY = 2 * RNNOISE_FRAME;
const PCM_SCALE = 32768;
const YIELD_EVERY_FRAMES = 200;

let loading: Promise<Rnnoise> | null = null;

export const loadRnnoise = (): Promise<Rnnoise> => {
  loading ??= import('@shiguredo/rnnoise-wasm').then((m) => m.Rnnoise.load());
  loading.catch(() => {
    loading = null;
  });
  return loading;
};

export interface DenoisedChannel {
  audio: Float32Array;
  vad: Float32Array;
}

export const denoiseChannel = async (
  rnnoise: Rnnoise,
  input: Float32Array,
  signal: AbortSignal,
  onProgress?: (fraction: number) => void,
): Promise<DenoisedChannel> => {
  const state = rnnoise.createDenoiseState();
  const total = input.length + RNNOISE_DELAY;
  const frames = Math.ceil(total / RNNOISE_FRAME);
  const audio = new Float32Array(input.length);
  const vad = new Float32Array(frames);
  const frame = new Float32Array(RNNOISE_FRAME);
  try {
    for (let f = 0; f < frames; f++) {
      const start = f * RNNOISE_FRAME;
      for (let n = 0; n < RNNOISE_FRAME; n++) frame[n] = (input[start + n] ?? 0) * PCM_SCALE;
      vad[f] = state.processFrame(frame);
      for (let n = 0; n < RNNOISE_FRAME; n++) {
        const at = start + n - RNNOISE_DELAY;
        if (at >= 0 && at < audio.length) audio[at] = (frame[n] ?? 0) / PCM_SCALE;
      }
      if (f % YIELD_EVERY_FRAMES === 0) {
        onProgress?.(f / frames);
        await yieldToEventLoop();
        throwIfAborted(signal);
      }
    }
  } finally {
    state.destroy();
  }
  onProgress?.(1);
  return { audio, vad };
};

// Reads the VAD 20 ms ahead on purpose, so the gate is already open at a word's onset.
const VAD_LOOKAHEAD = RNNOISE_DELAY;

export const vadAt = (vad: Float32Array, sample: number): number =>
  vad[Math.floor((sample + VAD_LOOKAHEAD) / RNNOISE_FRAME)] ?? 0;

export const mergeVads = (vads: readonly Float32Array[]): Float32Array => {
  const merged = new Float32Array(Math.max(0, ...vads.map((v) => v.length)));
  vads.forEach((v) => v.forEach((p, i) => (merged[i] = Math.max(merged[i] ?? 0, p))));
  return merged;
};
