// YouTube Shorts direto da Prensa: o login do Google acontece no navegador (OAuth, fluxo de token) e o vídeo
// sobe do aparelho para a YouTube Data API v3, num envio retomável. Nenhum segredo mora aqui: só o Client ID,
// que é público por natureza (ele só funciona nas origens cadastradas no Google Cloud).
// Vídeo vertical de até 3 min vira Short sozinho; não precisa de nada especial no pedido.
//
// Limite importante: enquanto o projeto do Google Cloud não passar pela auditoria da API do YouTube, todo vídeo
// enviado por videos.insert fica travado como PRIVADO, seja qual for a privacidade pedida.
// Ref.: https://developers.google.com/youtube/v3/docs/videos/insert
//
// Por que um popup que volta para oauth-youtube.html e conversa por BroadcastChannel (e não a biblioteca do
// Google)? A Prensa roda isolada (COOP/COEP, para o Whisper usar threads): o popup perde o `window.opener` ao
// passar pelo domínio do Google, e o script da biblioteca não traria o cabeçalho que o COEP exige. Duas páginas
// da mesma origem sempre se falam pelo BroadcastChannel, com ou sem opener.

export const CLIENT_ID = ((import.meta.env.VITE_YOUTUBE_CLIENT_ID as string | undefined) ?? '').trim();
const ESCOPO = 'https://www.googleapis.com/auth/youtube.upload';
const CANAL = 'prensa:youtube';
const CHAVE = 'prensa:youtube:token';
const ESPERA_LOGIN = 3 * 60_000; // ms

export type Privacidade = 'private' | 'unlisted' | 'public';
export const PRIVACIDADES: { id: Privacidade; nome: string }[] = [
  { id: 'private', nome: 'Privado' },
  { id: 'unlisted', nome: 'Não listado' },
  { id: 'public', nome: 'Público' },
];

type Token = { valor: string; expira: number };

export const youtubeConfigurado = () => !!CLIENT_ID;
export const urlDeRetorno = () => new URL('oauth-youtube.html', location.href).href.split('#')[0].split('?')[0];

function tokenGuardado(): Token | null {
  try {
    const t = JSON.parse(sessionStorage.getItem(CHAVE) ?? 'null') as Token | null;
    return t && t.expira - 60_000 > Date.now() ? t : null; // folga de 1 min: não começa um envio com o token morrendo
  } catch {
    return null;
  }
}

function guardar(t: Token | null) {
  try {
    if (t) sessionStorage.setItem(CHAVE, JSON.stringify(t));
    else sessionStorage.removeItem(CHAVE);
  } catch { /* sem armazenamento: vale só enquanto a página está aberta */ }
}

export const conectado = () => !!tokenGuardado();
export const desconectar = () => guardar(null);

/** abre o login do Google num popup e espera o token voltar por oauth-youtube.html */
export function entrar(): Promise<string> {
  const guardado = tokenGuardado();
  if (guardado) return Promise.resolve(guardado.valor);
  if (!CLIENT_ID) return Promise.reject(new Error('falta o VITE_YOUTUBE_CLIENT_ID no .env.development.local'));
  const estado = crypto.randomUUID();
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.search = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: urlDeRetorno(),
    response_type: 'token',
    scope: ESCOPO,
    include_granted_scopes: 'true',
    prompt: 'select_account', // deixa escolher a conta e o canal (contas de marca aparecem aqui)
    state: estado,
  }).toString();

  return new Promise((resolve, reject) => {
    const canal = new BroadcastChannel(CANAL);
    const fim = (erro: Error | null, valor = '') => {
      clearTimeout(relogio);
      canal.close();
      if (erro) reject(erro); else resolve(valor);
    };
    const relogio = setTimeout(() => fim(new Error('o login do Google não voltou a tempo; tente de novo')), ESPERA_LOGIN);
    canal.onmessage = (e: MessageEvent<Record<string, string>>) => {
      const r = e.data;
      if (r.state !== estado) return; // resposta de outro login (outra aba)
      if (r.error) return fim(new Error(r.error === 'access_denied' ? 'o acesso ao YouTube não foi autorizado' : `login do Google: ${r.error}`));
      if (!r.access_token) return fim(new Error('o login do Google voltou sem o token'));
      guardar({ valor: r.access_token, expira: Date.now() + Number(r.expires_in ?? 3600) * 1000 });
      fim(null, r.access_token);
    };
    const popup = window.open(url, 'prensa-youtube', 'popup,width=480,height=640');
    if (!popup) fim(new Error('o navegador bloqueou a janela de login; libere popups para a Prensa'));
  });
}

export type ParaYoutube = {
  video: Blob;
  titulo: string;
  descricao: string;
  privacidade: Privacidade;
  aoProgresso: (fracao: number) => void;
};

/** envia o Short e devolve o id do vídeo no YouTube */
export async function enviarShort(p: ParaYoutube): Promise<string> {
  const token = await entrar();
  // título: até 100 caracteres e sem < > (o YouTube recusa o pedido inteiro)
  const titulo = p.titulo.replace(/[<>]/g, '').trim().slice(0, 100) || 'Vídeo da Prensa';
  const descricao = p.descricao.replace(/[<>]/g, '').slice(0, 5000);

  // 1. abre a sessão de envio retomável: o YouTube devolve, no Location, o endereço para onde mandar o arquivo
  const inicio = await fetch('https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json; charset=UTF-8',
      'X-Upload-Content-Length': String(p.video.size),
      'X-Upload-Content-Type': 'video/mp4',
    },
    body: JSON.stringify({
      snippet: { title: titulo, description: descricao, categoryId: '22' }, // 22 = Pessoas e blogs
      status: { privacyStatus: p.privacidade, selfDeclaredMadeForKids: false },
    }),
  });
  if (!inicio.ok) throw await erroDoYoutube(inicio);
  const destino = inicio.headers.get('Location');
  if (!destino) throw new Error('o YouTube não abriu a sessão de envio');

  // 2. manda o arquivo. XHR em vez de fetch: só ele dá o progresso do envio
  const resposta = await new Promise<{ status: number; corpo: string }>((resolve, reject) => {
    const x = new XMLHttpRequest();
    x.open('PUT', destino);
    x.setRequestHeader('Authorization', `Bearer ${token}`);
    x.setRequestHeader('Content-Type', 'video/mp4');
    x.upload.onprogress = (e) => { if (e.lengthComputable) p.aoProgresso(e.loaded / e.total); };
    x.onload = () => resolve({ status: x.status, corpo: x.responseText });
    x.onerror = () => reject(new Error('a conexão caiu durante o envio'));
    x.send(p.video);
  });
  if (resposta.status >= 400) throw await erroDoYoutube(new Response(resposta.corpo, { status: resposta.status }));
  const id = (JSON.parse(resposta.corpo) as { id?: string }).id;
  if (!id) throw new Error('o YouTube não devolveu o id do vídeo');
  return id;
}

async function erroDoYoutube(r: Response): Promise<Error> {
  const d = (await r.json().catch(() => ({}))) as { error?: { message?: string; errors?: { reason?: string }[] } };
  const motivo = d.error?.errors?.[0]?.reason ?? '';
  if (r.status === 401) {
    desconectar();
    return new Error('o login do YouTube expirou; entre de novo');
  }
  if (motivo === 'quotaExceeded') return new Error('a cota diária da API do YouTube acabou; amanhã ela volta');
  if (motivo === 'uploadLimitExceeded') return new Error('este canal chegou ao limite de envios por hoje');
  if (motivo === 'youtubeSignupRequired') return new Error('esta conta do Google ainda não tem canal no YouTube');
  return new Error(d.error?.message ?? `erro ${r.status} do YouTube`);
}

export const linkDoStudio = (id: string) => `https://studio.youtube.com/video/${id}/edit`;
export const linkDoShort = (id: string) => `https://youtube.com/shorts/${id}`;
