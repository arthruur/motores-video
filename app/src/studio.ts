// Ponte com o M20 Studio (repositório social-agents): com o Studio aberto no computador, cada vídeo
// prensado entra sozinho na biblioteca dele, com o texto do post e a legenda. Publicar continua lá.

const CHAVE = 'prensa:studio';
export const STUDIO_URL = 'http://127.0.0.1:8055';

export function studioLigado(): boolean {
  try { return localStorage.getItem(CHAVE) === '1'; } catch { return false; }
}

export function lembrarStudio(ligado: boolean) {
  try { localStorage.setItem(CHAVE, ligado ? '1' : '0'); } catch { /* sem armazenamento: vale só nesta visita */ }
}

/** o Studio está aberto nesta máquina? devolve o nome do projeto, ou null */
export async function procurarStudio(): Promise<string | null> {
  try {
    const r = await fetch(`${STUDIO_URL}/api/prensa`, { signal: AbortSignal.timeout(3000) });
    if (!r.ok) return null;
    const d = (await r.json()) as { ok: boolean; nome?: string };
    return d.ok ? d.nome || 'M20 Studio' : null;
  } catch {
    return null;
  }
}

export type ParaStudio = { video: Blob; titulo: string; texto: string; srt: string; origem: string; rede: string };

export async function enviarAoStudio(p: ParaStudio): Promise<string> {
  const corpo = new FormData();
  corpo.append('video', p.video, 'video.mp4');
  for (const k of ['titulo', 'texto', 'srt', 'origem', 'rede'] as const) corpo.append(k, p[k]);
  const r = await fetch(`${STUDIO_URL}/api/prensa`, { method: 'POST', body: corpo, headers: { 'X-Prensa': '1' } });
  const d = (await r.json().catch(() => ({}))) as { ok?: boolean; id?: string; erro?: string };
  if (!r.ok || !d.ok) throw new Error(d.erro ?? `erro ${r.status}`);
  return d.id ?? '';
}
