import { BAIXADOR } from './baixador';

export type StatusYouTube = {
  pronto: boolean;
  tem_secret: boolean;
  caminho_secret: string | null;
  caminho_token: string | null;
};

export type ResultadoYouTube = {
  ok: boolean;
  plataforma: string;
  id: string;
  url: string;
  privacidade: string;
  titulo: string;
};

const BASE_URL = BAIXADOR || 'http://localhost:7860';

export async function checarStatusYouTube(): Promise<StatusYouTube> {
  try {
    const res = await fetch(`${BASE_URL}/publicar/youtube/status`);
    if (!res.ok) return { pronto: false, tem_secret: false, caminho_secret: null, caminho_token: null };
    return await res.json();
  } catch {
    return { pronto: false, tem_secret: false, caminho_secret: null, caminho_token: null };
  }
}

export async function publicarParaYouTube(
  videoBlob: Blob,
  titulo: string,
  descricao: string,
  privacidade: 'private' | 'unlisted' | 'public' = 'private',
  progresso?: (texto: string) => void
): Promise<ResultadoYouTube> {
  progresso?.('Preparando envio para o YouTube Shorts...');
  const fd = new FormData();
  fd.append('arquivo', videoBlob, 'shorts.mp4');
  fd.append('titulo', titulo);
  fd.append('descricao', descricao);
  fd.append('hashtags', 'Shorts');
  fd.append('privacidade', privacidade);

  progresso?.('Enviando para o YouTube...');
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}/publicar/youtube`, {
      method: 'POST',
      body: fd,
    });
  } catch {
    throw new Error('Não foi possível conectar ao servidor de publicação. Certifique-se de que o backend está rodando.');
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: `Erro HTTP ${res.status}` }));
    throw new Error(String(err.detail ?? `Erro ${res.status} ao publicar`));
  }

  return await res.json();
}

export type IdeiasVirais = {
  ok: boolean;
  hook: string;
  titulos: string[];
  descricao: string;
  hashtags: string;
};

export async function gerarIdeiasVirais(transcricao: string, contexto = ''): Promise<IdeiasVirais | null> {
  try {
    const res = await fetch(`${BASE_URL}/gerar-titulos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transcricao, contexto }),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}
