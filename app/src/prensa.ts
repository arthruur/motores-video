// O motor da Prensa: decodifica, desenha cada quadro com o formato escolhido e codifica em MP4.
// Tudo no aparelho, com WebCodecs (mediabunny). Nada sai do celular.
import {
  ALL_FORMATS, AudioBufferSink, AudioBufferSource, BlobSource, BufferTarget, CanvasSink, CanvasSource, Conversion,
  Input, type InputAudioTrack, type InputVideoTrack, Mp4OutputFormat, Output, canEncodeAudio, canEncodeVideo,
} from 'mediabunny';
import { A, L, type Fonte, type Quadro, desenharQuadro } from './formatos';
import { mixar } from './fxtor/som';
import type { Plataforma } from './plataformas';

export const FPS = 30;
// 3 Mbps: ~22 MB por minuto. As redes recomprimem de qualquer jeito, e arquivo leve sobe e compartilha rápido pelo celular
const BITRATE = 3_000_000;

export type Midia = {
  arquivo: File;
  input: Input;
  video: InputVideoTrack;
  audio: InputAudioTrack | null;
  somWeb: AudioBuffer | null; // som decodificado pelo Web Audio quando o WebCodecs não lê (AAC no iPhone, por exemplo)
  inicio: number; // primeiro timestamp do arquivo
  dur: number;
  w: number;
  h: number;
};

/** o navegador não decodifica esse arquivo (ou o som dele): dá para converter com o conversor de segurança */
export class FormatoNaoLido extends Error {
  constructor(public detalhe: string) {
    super(`Este navegador não lê ${detalhe}.`);
  }
}

export async function abrir(arquivo: File): Promise<Midia> {
  const input = new Input({ source: new BlobSource(arquivo), formats: ALL_FORMATS });
  let video: InputVideoTrack | null;
  try {
    video = await input.getPrimaryVideoTrack();
  } catch {
    throw new FormatoNaoLido(`o formato do arquivo (${arquivo.name.split('.').pop()?.toUpperCase()})`);
  }
  if (!video) throw new Error('Esse arquivo não tem vídeo.');
  const codigo = async (t: InputVideoTrack | InputAudioTrack, oque: string) => { const c = await t.getCodec(); return c ? `${oque} em ${c.toUpperCase()}` : `esse tipo de ${oque}`; };
  if (!(await video.canDecode())) throw new FormatoNaoLido(await codigo(video, 'vídeo'));
  let audio = await input.getPrimaryAudioTrack();
  let somWeb: AudioBuffer | null = null;
  if (audio && !(await audio.canDecode())) {
    const faixa = audio;
    // o navegador do iPhone não decodifica AAC pelo WebCodecs, mas decodifica pelo Web Audio: usa esse caminho
    try {
      somWeb = await new OfflineAudioContext(2, 1, 48000).decodeAudioData(await arquivo.arrayBuffer());
      audio = null;
    } catch {
      throw new FormatoNaoLido(await codigo(faixa, 'som'));
    }
  }
  const inicio = await input.getFirstTimestamp();
  const dur = (await input.computeDuration()) - inicio;
  return { arquivo, input, video, audio, somWeb, inicio, dur, w: video.displayWidth, h: video.displayHeight };
}

/** áudio do trecho [ini, fim) como canais Float32 na taxa original */
export const temSom = (m: Midia | null) => !!(m && (m.audio || m.somWeb));

async function lerAudio(m: Midia, ini: number, fim: number): Promise<{ canais: Float32Array<ArrayBuffer>[]; taxa: number }> {
  if (!m.audio && m.somWeb) {
    const b = m.somWeb, taxa = b.sampleRate;
    const de = Math.floor(ini * taxa), ate = Math.min(b.length, Math.ceil(fim * taxa)), n = Math.ceil((fim - ini) * taxa);
    const canais = Array.from({ length: Math.min(2, b.numberOfChannels) }, (_, c) => {
      const out = new Float32Array(new ArrayBuffer(n * 4));
      out.set(b.getChannelData(c).subarray(de, Math.max(de, ate)));
      return out;
    });
    return { canais, taxa };
  }
  const taxa = await m.audio!.getSampleRate();
  const nc = Math.min(2, await m.audio!.getNumberOfChannels());
  const n = Math.ceil((fim - ini) * taxa);
  const canais = Array.from({ length: nc }, () => new Float32Array(new ArrayBuffer(n * 4)));
  const sink = new AudioBufferSink(m.audio!);
  for await (const { buffer, timestamp } of sink.buffers(m.inicio + ini, m.inicio + fim)) {
    const off = Math.round((timestamp - m.inicio - ini) * taxa);
    for (let c = 0; c < nc; c++) {
      const src = buffer.getChannelData(Math.min(c, buffer.numberOfChannels - 1));
      const de = Math.max(0, -off);
      const ate = Math.min(src.length, n - off);
      if (ate > de) canais[c].set(src.subarray(de, ate), off + de);
    }
  }
  return { canais, taxa };
}

/** áudio mono 16 kHz para o Whisper */
export async function audioParaFala(m: Midia, ini: number, fim: number): Promise<Float32Array | null> {
  if (!temSom(m)) return null;
  const { canais, taxa } = await lerAudio(m, ini, fim);
  const ctx = new OfflineAudioContext(1, Math.ceil((fim - ini) * 16000), 16000);
  const b = ctx.createBuffer(canais.length, canais[0].length, taxa);
  canais.forEach((c, i) => b.copyToChannel(c, i));
  const s = ctx.createBufferSource();
  s.buffer = b;
  s.connect(ctx.destination);
  s.start();
  return (await ctx.startRendering()).getChannelData(0);
}

/** o AAC das redes (e de vários codificadores) só aceita taxas comuns: som de 8 kHz de celular antigo vira 48 kHz */
async function em48k(ab: AudioBuffer): Promise<AudioBuffer> {
  if (ab.sampleRate === 48000) return ab;
  const ctx = new OfflineAudioContext(ab.numberOfChannels, Math.ceil(ab.duration * 48000), 48000);
  const s = ctx.createBufferSource();
  s.buffer = ab;
  s.connect(ctx.destination);
  s.start();
  return ctx.startRendering();
}

export type Pedido = Quadro & {
  principal: Midia;
  baixo: Midia | null;
  ini: number;
  fim: number;
  som: OpcoesDeSom;
};

export type OpcoesDeSom = {
  limpar: boolean;            // remove ruído da voz (RNNoise, do Audio FXtor)
  volumeFala: number;         // 0 a 1.5
  musica: AudioBuffer | null; // trilha gerada ou da pessoa
  volumeMusicaDb: number;     // em relação à fala
  abaixar: boolean;           // abaixa a música enquanto alguém fala
  suave: boolean;             // entrada e saída suaves
};

export type Progresso = (fracao: number) => void;

async function prepararCodecs() {
  if (!(await canEncodeVideo('avc', { width: L, height: A, bitrate: BITRATE }))) {
    throw new Error('Este navegador não consegue gerar vídeo H.264. Use o Chrome, o Edge ou o Safari atualizado.');
  }
  if (!(await canEncodeAudio('aac'))) {
    const { registerAacEncoder } = await import('@mediabunny/aac-encoder');
    registerAacEncoder();
  }
}

/** gera o MP4 9:16 do pedido */
export async function prensar(p: Pedido, progresso: Progresso, sinal?: AbortSignal): Promise<Blob> {
  await prepararCodecs();
  const canvas = document.createElement('canvas'); // no documento: usa as fontes já carregadas pela página
  canvas.width = L;
  canvas.height = A;
  const ctx = canvas.getContext('2d')!;
  const output = new Output({ format: new Mp4OutputFormat({ fastStart: 'in-memory' }), target: new BufferTarget() });
  const fonteVideo = new CanvasSource(canvas, { codec: 'avc', bitrate: BITRATE, keyFrameInterval: 2 });
  output.addVideoTrack(fonteVideo, { frameRate: FPS });
  let fonteAudio: AudioBufferSource | null = null;
  if (temSom(p.principal) || p.som.musica) {
    fonteAudio = new AudioBufferSource({ codec: 'aac', bitrate: 128_000 });
    output.addAudioTrack(fonteAudio);
  }
  await output.start();

  const dur = p.fim - p.ini;
  const n = Math.max(1, Math.round(dur * FPS));
  const tempos = Array.from({ length: n }, (_, i) => p.principal.inicio + p.ini + i / FPS);
  const sinkP = new CanvasSink(p.principal.video, { poolSize: 3, ...tamanho(p.principal) });
  const itP = sinkP.canvasesAtTimestamps(tempos);
  let itB: AsyncGenerator<{ canvas: HTMLCanvasElement | OffscreenCanvas } | null> | null = null;
  if (p.layout === 'dividida' && p.baixo && !p.gerador) {
    const b = p.baixo;
    const sinkB = new CanvasSink(b.video, { poolSize: 3, ...tamanho(b) });
    itB = sinkB.canvasesAtTimestamps(tempos.map((_, i) => b.inicio + ((i / FPS) % Math.max(0.1, b.dur - 0.05))));
  }

  let ultimaP: Fonte | null = null, ultimaB: Fonte | null = null;
  for (let i = 0; i < n; i++) {
    if (sinal?.aborted) { await output.cancel(); throw new DOMException('cancelado', 'AbortError'); }
    const a = (await itP.next()).value;
    if (a) ultimaP = { img: a.canvas, w: a.canvas.width, h: a.canvas.height };
    if (itB) {
      const b = (await itB.next()).value;
      if (b) ultimaB = { img: b.canvas, w: b.canvas.width, h: b.canvas.height };
    }
    desenharQuadro(ctx, p, i / FPS, ultimaP, ultimaB);
    await fonteVideo.add(i / FPS, 1 / FPS);
    if (i % 10 === 0) progresso((i / n) * 0.92);
  }
  await itP.return(undefined);
  if (itB) await itB.return(undefined);

  if (fonteAudio) {
    const lido = temSom(p.principal) ? await lerAudio(p.principal, p.ini, p.fim) : null;
    const taxa = lido?.taxa ?? 48000;
    const canais = (await mixar({
      fala: lido?.canais ?? null, musica: p.som.musica, taxa, amostras: Math.ceil((p.fim - p.ini) * taxa),
      limpar: p.som.limpar, volumeFala: p.som.volumeFala, volumeMusicaDb: p.som.volumeMusicaDb,
      abaixar: p.som.abaixar, suave: p.som.suave, sinal,
    })).map((c) => new Float32Array(c));
    const ab = new AudioBuffer({ length: canais[0].length, numberOfChannels: canais.length, sampleRate: taxa });
    canais.forEach((c, i) => ab.copyToChannel(c, i));
    await fonteAudio.add(await em48k(ab));
  }
  progresso(0.97);
  await output.finalize();
  progresso(1);
  return new Blob([(output.target as BufferTarget).buffer!], { type: 'video/mp4' });
}

/** decodifica já no tamanho que vai para a tela: vídeo 4K não precisa virar 4K de canvas */
function tamanho(m: Midia): { width?: number; height?: number } {
  if (Math.min(m.w, m.h) <= L) return {};
  return m.w < m.h ? { width: L } : { height: L }; // lado menor em 1080, proporção mantida
}

export type Arquivo = { nome: string; blob: Blob; plataforma: string; aviso?: string };

/** recorta/recomprime o vídeo pronto para uma plataforma */
async function converter(blob: Blob, trim: { start: number; end: number } | null, bitrate?: number): Promise<Blob> {
  const input = new Input({ source: new BlobSource(blob), formats: ALL_FORMATS });
  const output = new Output({ format: new Mp4OutputFormat({ fastStart: 'in-memory' }), target: new BufferTarget() });
  const conv = await Conversion.init({
    input, output,
    ...(trim ? { trim } : {}),
    ...(bitrate ? { video: { bitrate }, audio: { bitrate: 96_000 } } : {}),
  });
  await conv.execute();
  return new Blob([(output.target as BufferTarget).buffer!], { type: 'video/mp4' });
}

export async function exportar(mestre: Blob, dur: number, base: string, plats: Plataforma[], progresso: Progresso): Promise<Arquivo[]> {
  const out: Arquivo[] = [];
  for (const [k, pl] of plats.entries()) {
    progresso(k / plats.length);
    const nome = (s = '') => `${base}-${pl.id}${s}.mp4`;
    if (dur <= pl.maxDur + 0.05 && !pl.bitrate) {
      out.push({ nome: nome(), blob: mestre, plataforma: pl.nome, aviso: pl.recomendado && dur > pl.recomendado ? `Acima de ${pl.recomendado} s o alcance costuma cair.` : undefined });
    } else if (dur > pl.maxDur && pl.dividir) {
      const partes = Math.ceil(dur / pl.maxDur);
      for (let i = 0; i < partes; i++) {
        const start = (dur / partes) * i, end = (dur / partes) * (i + 1);
        out.push({ nome: nome(`-parte${i + 1}de${partes}`), blob: await converter(mestre, { start, end }, pl.bitrate), plataforma: `${pl.nome} (${i + 1}/${partes})` });
      }
    } else if (dur > pl.maxDur) {
      out.push({ nome: nome(), blob: await converter(mestre, { start: 0, end: pl.maxDur }, pl.bitrate), plataforma: pl.nome, aviso: `Cortado em ${pl.maxDur} s, o limite da plataforma.` });
    } else {
      out.push({ nome: nome(), blob: await converter(mestre, null, pl.bitrate), plataforma: pl.nome });
    }
  }
  progresso(1);
  return out;
}
