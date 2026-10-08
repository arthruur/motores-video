import type { Palavra } from './legenda';

let worker: Worker | null = null;
let fila: Promise<unknown> = Promise.resolve();

export type Aviso = (texto: string, progresso?: number) => void;

/** áudio mono 16 kHz -> palavras com tempo (segundos desde o início do áudio).
 *  Um pedido por vez; se `vale()` for falso quando chegar a vez, o pedido é descartado (trecho já mudou). */
export function transcrever(audio: Float32Array, aviso: Aviso, vale: () => boolean = () => true, idioma = 'portuguese'): Promise<Palavra[]> {
  const vez = fila.then(() => {
    if (!vale()) throw new DOMException('trecho mudou', 'AbortError');
    return rodar(audio, aviso, idioma);
  });
  fila = vez.catch(() => {});
  return vez;
}

function rodar(audio: Float32Array, aviso: Aviso, idioma: string): Promise<Palavra[]> {
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
    aviso('Preparando a legenda');
    w.postMessage({ audio, idioma }, [audio.buffer]);
  });
}
