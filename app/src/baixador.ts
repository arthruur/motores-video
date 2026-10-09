// Links (X, Instagram, TikTok, YouTube...): o navegador não pode baixar dessas redes direto (CORS), então um
// serviço pequeno com o yt-dlp baixa e devolve o MP4 (servidor/baixador). O resto continua no aparelho.

export const BAIXADOR = ((import.meta.env.VITE_BAIXADOR_URL as string | undefined) ?? '').replace(/\/$/, '');

export type Baixado = { arquivo: File; titulo: string; autor: string; origem: string; plataforma: string };

export async function baixarLink(url: string, aviso: (texto: string, fracao?: number) => void): Promise<Baixado> {
  if (!BAIXADOR) throw new Error('o baixador de links ainda não está configurado nesta Prensa');
  aviso('Buscando o vídeo (na 1ª vez do dia o serviço pode levar um minuto para acordar)');
  let r: Response;
  try {
    r = await fetch(`${BAIXADOR}/baixar`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url }) });
  } catch {
    throw new Error('o serviço de links não respondeu; tente de novo em instantes');
  }
  if (!r.ok) {
    const corpo = await r.json().catch(() => ({ detail: `erro ${r.status}` }));
    throw new Error(String(corpo.detail ?? `erro ${r.status}`));
  }
  const h = (k: string) => decodeURIComponent(r.headers.get(k) ?? '');
  const total = Number(r.headers.get('Content-Length') ?? 0);
  const partes: Uint8Array[] = [];
  let lido = 0;
  const leitor = r.body!.getReader();
  for (;;) {
    const { done, value } = await leitor.read();
    if (done) break;
    partes.push(value);
    lido += value.length;
    aviso('Baixando o vídeo', total ? lido / total : undefined);
  }
  const titulo = h('X-Titulo');
  const nome = `${(titulo || 'video').replace(/[^\p{L}\p{N} _-]/gu, '').trim().slice(0, 60) || 'video'}.mp4`;
  return { arquivo: new File(partes as BlobPart[], nome, { type: 'video/mp4' }), titulo, autor: h('X-Autor'), origem: h('X-Origem'), plataforma: h('X-Plataforma') };
}
