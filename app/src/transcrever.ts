import type { Palavra } from './legenda';
import { BAIXADOR } from './baixador';

let worker: Worker | null = null;
let fila: Promise<unknown> = Promise.resolve();

export type Aviso = (texto: string, progresso?: number) => void;

/** Converte Float32Array (16kHz mono) para Blob WAV PCM 16-bit */
function audioParaWavBlob(samples: Float32Array, sampleRate = 16000): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  /* RIFF identifier */
  const writeString = (offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, 1, true); // 1 channel (mono)
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate (sampleRate * 1 * 2)
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // 16-bit
  writeString(36, 'data');
  view.setUint32(40, samples.length * 2, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += 2;
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

/** Tenta transcrever no servidor com GPU (faster-whisper) */
async function transcreverRemoto(audio: Float32Array, aviso: Aviso, idioma: string): Promise<Palavra[] | null> {
  if (!BAIXADOR) return null;
  try {
    aviso('Enviando áudio para transcrição rápida na GPU...');
    const wavBlob = audioParaWavBlob(audio);
    const formData = new FormData();
    formData.append('audio', wavBlob, 'audio.wav');
    formData.append('idioma', idioma.startsWith('pt') || idioma === 'portuguese' ? 'pt' : idioma);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000); // 12s timeout

    const r = await fetch(`${BAIXADOR}/transcrever`, {
      method: 'POST',
      body: formData,
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout));

    if (!r.ok) return null;
    const res = await r.json();
    if (res.ok && Array.isArray(res.palavras) && res.palavras.length > 0) {
      return res.palavras;
    }
  } catch {
    // Falha ou offline, segue pro worker local
  }
  return null;
}

/** áudio mono 16 kHz -> palavras com tempo (segundos desde o início do áudio).
 *  Um pedido por vez; se `vale()` for falso quando chegar a vez, o pedido é descartado (trecho já mudou). */
export function transcrever(audio: Float32Array, aviso: Aviso, vale: () => boolean = () => true, idioma = 'portuguese'): Promise<Palavra[]> {
  const vez = fila.then(async () => {
    if (!vale()) throw new DOMException('trecho mudou', 'AbortError');

    // 1. Tenta transcrição na GPU (servidor local com RTX/CUDA)
    const palavrasGPU = await transcreverRemoto(audio, aviso, idioma);
    if (palavrasGPU && palavrasGPU.length > 0) {
      if (!vale()) throw new DOMException('trecho mudou', 'AbortError');
      return palavrasGPU;
    }

    // 2. Fallback: Whisper WASM in-browser
    return rodarWorker(audio, aviso, idioma);
  });
  fila = vez.catch(() => {});
  return vez;
}

function rodarWorker(audio: Float32Array, aviso: Aviso, idioma: string): Promise<Palavra[]> {
  worker ??= new Worker(new URL('./transcrever.worker.ts', import.meta.url), { type: 'module' });
  const w = worker;
  return new Promise((ok, falha) => {
    w.onmessage = (e) => {
      const m = e.data;
      if (m.tipo === 'baixando') aviso('Carregando o ouvido da Prensa (a 1ª vez baixa 77 MB)', m.progresso);
      else if (m.tipo === 'ouvindo') aviso('Ouvindo a fala para a legenda');
      else if (m.tipo === 'pronto') ok(m.palavras);
      else if (m.tipo === 'erro') falha(new Error(m.mensagem));
    };
    aviso('Preparando a legenda no navegador');
    w.postMessage({ audio, idioma }, [audio.buffer]);
  });
}
