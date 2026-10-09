// Conversor de segurança: quando o navegador não lê o vídeo (MPEG-4 Part 2, 3GP, ProRes, AVI, HEVC sem
// suporte do aparelho...), converte uma vez para H.264 + AAC com o ffmpeg.wasm e segue o fluxo normal.
// O ffmpeg.wasm (GPL-2.0-or-later) NÃO vai junto do app: é baixado do CDN só quando precisa (~31 MB, fica em cache).
import { FFmpeg, FFFSType } from '@ffmpeg/ffmpeg';
import { toBlobURL } from '@ffmpeg/util';

const CORE = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm';
const MAX_S = 20 * 60; // uma fala de 1 h não precisa ser convertida inteira: o trecho máximo é de 3 min
let carregado: Promise<FFmpeg> | null = null;

export type Aviso = (texto: string, fracao?: number) => void;

function carregar(aviso: Aviso): Promise<FFmpeg> {
  carregado ??= (async () => {
    aviso('Buscando o conversor (só na 1ª vez, ~31 MB)');
    const ff = new FFmpeg();
    try {
      await ff.load({
        coreURL: await toBlobURL(`${CORE}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${CORE}/ffmpeg-core.wasm`, 'application/wasm'),
      });
    } catch (e) {
      throw new Error(`não consegui baixar o conversor (${(e as Error).message || 'sem internet?'})`);
    }
    return ff;
  })();
  carregado.catch(() => { carregado = null; });
  return carregado;
}

export async function converter(arquivo: File, aviso: Aviso): Promise<File> {
  const ff = await carregar(aviso);
  const log: string[] = [];
  const registrar = ({ message }: { message: string }) => { log.push(message); if (log.length > 40) log.shift(); };
  const progresso = ({ progress }: { progress: number }) => aviso('Compondo os tipos', Math.max(0, Math.min(1, progress)));
  ff.on('log', registrar);
  ff.on('progress', progresso);
  // o arquivo é lido direto do disco (WORKERFS), sem copiar para a memória do WASM: vídeo grande de celular cabe
  const ext = arquivo.name.match(/\.[a-z0-9]+$/i)?.[0] ?? '.bin';
  const entrada = new File([arquivo], `entrada${ext}`, { type: arquivo.type });
  const pasta = `/entrada${Date.now()}`;
  await ff.createDir(pasta);
  await ff.mount(FFFSType.WORKERFS, { files: [entrada] }, pasta);
  try {
    aviso('Compondo os tipos', 0);
    // lado maior até 1920 já basta para 1080x1920; ultrafast: o objetivo é destravar, a Prensa recodifica depois
    const codigo = await ff.exec(['-i', `${pasta}/${entrada.name}`, '-t', String(MAX_S),
      '-vf', "scale='if(gt(iw,ih),min(1920,iw),-2)':'if(gt(iw,ih),-2,min(1920,ih))'",
      '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '20', '-pix_fmt', 'yuv420p',
      '-c:a', 'aac', '-b:a', '192k', '-ac', '2', '-ar', '48000', '-movflags', '+faststart', 'saida.mp4']);
    if (codigo !== 0) {
      const motivo = log.filter((l) => /error|invalid|not supported|unknown|could not|no such/i.test(l)).pop() ?? log.at(-1) ?? `código ${codigo}`;
      throw new Error(motivo.trim());
    }
    const dados = (await ff.readFile('saida.mp4')) as Uint8Array;
    return new File([new Uint8Array(dados)], arquivo.name.replace(/\.[^.]+$/, '') + '.mp4', { type: 'video/mp4' });
  } finally {
    ff.off('log', registrar);
    ff.off('progress', progresso);
    await ff.unmount(pasta).catch(() => {});
    await ff.deleteDir(pasta).catch(() => {});
    await ff.deleteFile('saida.mp4').catch(() => {});
  }
}
