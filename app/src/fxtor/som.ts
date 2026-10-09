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

/** fala: tira o grave de fundo e o ruído (opcional) e nivela em -14 LUFS */
async function prepararFala(canais: Float32Array[], taxa: number, limpar: boolean, sinal: AbortSignal): Promise<Float32Array[]> {
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
  return nivelar(c, taxa);
}

function nivelar(c: Float32Array[], taxa: number, alvo = ALVO_LUFS): Float32Array[] {
  const medido = integratedLoudness(c.length === 1 ? [c[0], c[0]] : c, taxa);
  if (!Number.isFinite(medido)) return c;
  const ganho = Math.min(dbParaLinear(alvo - medido), dbParaLinear(GANHO_MAX_DB));
  return c.map((x) => x.map((v) => v * ganho));
}

const limitar = (c: Float32Array[], taxa: number) =>
  limitTruePeak(c, { ceiling: dbParaLinear(TETO_DB), lookaheadSeconds: 0.0015, releaseSeconds: 0.05, sampleRate: taxa });

/** só a fala (o comportamento de antes): limpa, nivela e limita */
export async function tratarSom(canais: Float32Array[], taxa: number, { limpar, sinal = new AbortController().signal }: OpcoesSom): Promise<Float32Array[]> {
  return limitar(await prepararFala(canais, taxa, limpar, sinal), taxa);
}

export type Mixagem = {
  fala: Float32Array[] | null;   // canais da fala na taxa `taxa` (null: vídeo sem som)
  musica: AudioBuffer | null;    // trilha em qualquer taxa; é reamostrada e repetida até cobrir o trecho
  taxa: number;
  amostras: number;              // duração do trecho em amostras
  limpar: boolean;
  volumeFala: number;            // 0 a 1.5 (1 = como veio, já nivelada)
  volumeMusicaDb: number;        // em relação à fala: -18 dB é o padrão de vídeo falado
  abaixar: boolean;              // abaixa a música enquanto alguém fala (ducking)
  suave: boolean;                // entrada e saída suaves da música
  efeitos?: { buffer: AudioBuffer; em: number; db: number }[]; // efeitos sonoros: quando (s) e o volume (dB, em relação à fala)
  sinal?: AbortSignal;
};

/** a música repetida até cobrir o trecho, na taxa da fala, em estéreo */
async function musicaNoTrecho(m: AudioBuffer, taxa: number, amostras: number): Promise<Float32Array[]> {
  const ctx = new OfflineAudioContext(2, amostras, taxa);
  const s = ctx.createBufferSource();
  s.buffer = m;
  s.loop = true;
  s.connect(ctx.destination);
  s.start();
  const r = await ctx.startRendering();
  return [r.getChannelData(0), r.getChannelData(1)];
}

/** envelope de "tem gente falando" (0 ou 1, suavizado) a partir da energia da fala, de 20 em 20 ms */
function quandoFala(fala: Float32Array[], taxa: number, amostras: number): Float32Array {
  const passo = Math.round(taxa * 0.02);
  const rms: number[] = [];
  for (let i = 0; i < amostras; i += passo) {
    let s = 0;
    const fim = Math.min(amostras, i + passo);
    for (let j = i; j < fim; j++) s += fala[0][j] * fala[0][j];
    rms.push(Math.sqrt(s / Math.max(1, fim - i)));
  }
  const ordenado = [...rms].sort((a, b) => a - b);
  const limiar = Math.max(0.004, ordenado[Math.floor(ordenado.length * 0.95)] * 0.12);
  const env = new Float32Array(amostras);
  const ataque = Math.exp(-1 / (0.06 * taxa)), solta = Math.exp(-1 / (0.45 * taxa));
  let g = 0, segura = 0;
  for (let i = 0; i < amostras; i++) {
    const quadro = Math.floor(i / passo);
    if (rms[quadro] > limiar) segura = Math.round(0.25 * taxa); // segura um pouco entre palavras
    const alvo = segura-- > 0 ? 1 : 0;
    g = alvo + (g - alvo) * (alvo > g ? ataque : solta);
    env[i] = g;
  }
  return env;
}

/** fala + música, com volume, ducking e entrada/saída suave; no fim, -14 LUFS e pico real em -1 dBTP */
export async function mixar(o: Mixagem): Promise<Float32Array[]> {
  const sinal = o.sinal ?? new AbortController().signal;
  const n = o.amostras;
  let fala: Float32Array[] | null = null;
  if (o.fala) {
    fala = (await prepararFala(o.fala, o.taxa, o.limpar, sinal)).map((c) => c.map((v) => v * o.volumeFala));
    if (fala.length === 1) fala = [fala[0], new Float32Array(fala[0])];
  }
  let saida: Float32Array[] = fala ?? [new Float32Array(n), new Float32Array(n)];
  if (o.musica) {
    let m = nivelar(await musicaNoTrecho(o.musica, o.taxa, n), o.taxa);
    const base = fala ? dbParaLinear(o.volumeMusicaDb) * Math.max(0.2, o.volumeFala) : 1;
    const env = fala && o.abaixar ? quandoFala(fala, o.taxa, n) : null;
    const abaixado = dbParaLinear(-8);
    const entra = o.suave ? Math.round(1.0 * o.taxa) : 0, sai = o.suave ? Math.round(2.0 * o.taxa) : 0;
    m = m.map((c) => c.map((v, i) => {
      let g = base;
      if (env) g *= 1 - (1 - abaixado) * env[i];
      if (i < entra) g *= i / entra;
      if (n - i < sai) g *= (n - i) / sai;
      return v * g;
    }));
    saida = saida.map((c, k) => c.map((v, i) => v + m[k][i]));
  }
  for (const ef of o.efeitos ?? []) {
    // o efeito é reamostrado para a taxa da fala e somado no instante pedido, com pico em -6 dBFS mais o ajuste
    const r = await musicaNoTrecho(ef.buffer, o.taxa, Math.ceil(ef.buffer.duration * o.taxa));
    let pico = 0;
    for (const c of r) for (const v of c) pico = Math.max(pico, Math.abs(v));
    const g = pico > 0 ? (dbParaLinear(-6 + ef.db) / pico) * (fala ? 1 : 0.6) : 0;
    const de = Math.round(ef.em * o.taxa);
    for (let k = 0; k < 2; k++) {
      const src = r[Math.min(k, r.length - 1)];
      for (let i = 0; i < src.length && de + i < n; i++) if (de + i >= 0) saida[k][de + i] += src[i] * g;
    }
  }
  return limitar(nivelar(saida, o.taxa), o.taxa);
}
