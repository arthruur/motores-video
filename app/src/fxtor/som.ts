// "Som limpo" da Prensa, montado com o motor do Audio FXtor (ver README.md desta pasta):
// tira o grave de fundo, limpa o ruído da voz (RNNoise, como o Noise Remover no modo voz),
// e nivela em -14 LUFS com pico real até -1 dBTP (como o Normalize no preset "streaming").
import { biquad, highpass } from './biquad';
import { limitTruePeak } from './dynamics';
import { integratedLoudness } from './loudness';
import { resample } from './resample';
import { RNNOISE_RATE, denoiseChannel, loadRnnoise } from './rnnoise';

const ALVO_LUFS = -14;
const TETO_DB = -1;
const GANHO_MAX_DB = 24;
const PASSA_ALTA_HZ = 80;
const FORCA = 0.65; // a mesma força padrão do Noise Remover
const dbParaLinear = (db: number) => 10 ** (db / 20);

async function limparVoz(canais: Float32Array[], taxa: number, sinal: AbortSignal): Promise<Float32Array[]> {
  const rnnoise = await loadRnnoise();
  const razao = taxa / RNNOISE_RATE;
  const a48 = taxa === RNNOISE_RATE ? canais : resample(canais, razao, taxa);
  const limpo: Float32Array[] = [];
  for (const c of a48) limpo.push((await denoiseChannel(rnnoise, c, sinal)).audio);
  const volta = taxa === RNNOISE_RATE ? limpo : resample(limpo, 1 / razao, RNNOISE_RATE);
  const seco = 1 - (1 - FORCA) ** 2; // mistura um pouco do original: soa menos "robótico"
  return volta.map((c, i) => {
    const orig = canais[i];
    const out = new Float32Array(orig.length);
    for (let j = 0; j < out.length; j++) out[j] = (c[j] ?? 0) * seco + orig[j] * (1 - seco);
    return out;
  });
}

export type OpcoesSom = { limpar: boolean; sinal?: AbortSignal };

export async function tratarSom(canais: Float32Array[], taxa: number, { limpar, sinal = new AbortController().signal }: OpcoesSom): Promise<Float32Array[]> {
  let c = canais;
  if (limpar) {
    const f = highpass(PASSA_ALTA_HZ, Math.SQRT1_2, taxa);
    c = c.map((x) => biquad(biquad(x, f), f));
    try {
      c = await limparVoz(c, taxa, sinal);
    } catch (e) {
      if (sinal.aborted) throw e;
      console.warn('RNNoise indisponível; segue sem limpar o ruído', e);
    }
  }
  const medido = integratedLoudness(c.length === 1 ? [c[0], c[0]] : c, taxa);
  if (Number.isFinite(medido)) {
    const ganho = Math.min(dbParaLinear(ALVO_LUFS - medido), dbParaLinear(GANHO_MAX_DB));
    c = c.map((x) => x.map((v) => v * ganho));
  }
  return limitTruePeak(c, { ceiling: dbParaLinear(TETO_DB), lookaheadSeconds: 0.0015, releaseSeconds: 0.05, sampleRate: taxa });
}
