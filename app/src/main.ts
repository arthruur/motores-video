import { type ClipeAcervo, baixarClipe, carregarManifesto, urlDoClipe } from './acervo';
import { desenharCompondo } from './compondo';
import { converter } from './conversor';
import { type Passo, criarDemo } from './demo';
import { A, L, type Fonte, type Quadro, desenharQuadro, faixaLegenda } from './formatos';
import { type Bloco, type EstiloLegenda, type Palavra, FONTE, gerarSrt, montarBlocos } from './legenda';
import { PLATAFORMAS } from './plataformas';
import { type Arquivo, FormatoNaoLido, type Midia, type OpcoesDeSom, abrir, audioParaFala, exportar, prensar } from './prensa';
import { RECEITAS, type Receita, ganchosDaFala } from './receitas';
import { GERADORES } from './retencao';
import { TRILHAS, gerarTrilha } from './trilhas';
import { transcrever } from './transcrever';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const estado = {
  principal: null as Midia | null,
  baixo: null as Midia | null,
  ini: 0,
  fim: 0,
  receita: RECEITAS[0],
  // vídeo de baixo: o padrão da receita, nenhum, uma animação gerada ou um vídeo (do acervo ou da pessoa)
  escolhaBaixo: { tipo: 'receita' } as { tipo: 'receita' } | { tipo: 'nenhum' } | { tipo: 'gerado'; id: string } | { tipo: 'video'; chave: string },
  som: {
    volumeFala: 1, musica: 'nenhuma', volumeMusica: 50, abaixar: true, suave: true,
    arquivoMusica: null as File | null, buffers: new Map<string, Promise<AudioBuffer>>(),
  },
  estiloLegenda: null as EstiloLegenda | null, // null = o da receita
  plataformas: new Set(PLATAFORMAS.map((p) => p.id)),
  falas: new Map<string, Palavra[]>(),         // trecho -> palavras
  ouvindo: new Map<string, Promise<Palavra[]>>(),
  esperandoLegenda: false,
  ganchoMexido: false,
  srt: '',
  urls: [] as string[],
  cancelar: null as AbortController | null,
  convertendo: null as { texto: string; fracao?: number; vez: number } | null, // conversor em segundo plano
};

const video = $<HTMLVideoElement>('video');
const videoBaixo = $<HTMLVideoElement>('video-baixo');
const previa = $<HTMLCanvasElement>('previa');
const ctxPrevia = previa.getContext('2d')!;
const campoGancho = $<HTMLInputElement>('gancho');
const campoFonte = $<HTMLInputElement>('fonte');
const campoCredito = $<HTMLInputElement>('credito-baixo');
const campoLegenda = $<HTMLInputElement>('legenda');
const campoSom = $<HTMLInputElement>('som-limpo');

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const chaveTrecho = () => `${estado.principal?.arquivo.name}|${estado.ini.toFixed(2)}|${estado.fim.toFixed(2)}`;
const estiloLegendaDe = (r: Receita): EstiloLegenda => (r === estado.receita ? estado.estiloLegenda ?? r.legenda : r.legenda);
// a escolha explícita de vídeo de baixo vale para todas as receitas; sem escolha, cada receita usa o seu padrão
const usaDividida = (r: Receita) => {
  const e = estado.escolhaBaixo;
  return e.tipo === 'receita' ? r.layout === 'dividida' : e.tipo !== 'nenhum';
};
const geradorDe = (r: Receita): string | null => {
  const e = estado.escolhaBaixo;
  if (e.tipo === 'gerado') return e.id;
  if (e.tipo === 'receita' && r.layout === 'dividida') return r.gerador ?? GERADORES[0].id;
  return null;
};
const usaVideoDeBaixo = () => estado.escolhaBaixo.tipo === 'video' && !!estado.baixo;

// ---------------------------------------------------------------- telas
let demo: ReturnType<typeof criarDemo> | null = null;
function mostrar(tela: 'inicio' | 'criar' | 'pronta') {
  $('tela-inicio').hidden = tela !== 'inicio';
  $('tela-criar').hidden = tela !== 'criar';
  $('tela-pronta').hidden = tela !== 'pronta';
  if (tela === 'inicio') demo?.continuar(); else demo?.parar();
  if (tela !== 'pronta') $<HTMLVideoElement>('resultado').pause();
  window.scrollTo({ top: 0 });
}
$('ir-inicio').addEventListener('click', () => mostrar(estado.principal ? 'criar' : 'inicio'));

// ---------------------------------------------------------------- 1. início: demonstração viva
let passoAuto: number | undefined;
const DUR_PASSO = 6000;
function irPasso(p: Passo, auto = true) {
  demo?.ir(p);
  document.querySelectorAll<HTMLButtonElement>('#passos-demo button').forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.passo) === p)));
  document.querySelector('.vitrine')!.classList.toggle('passo-2', p === 2);
  clearTimeout(passoAuto);
  if (auto) passoAuto = window.setTimeout(() => irPasso(((p + 1) % 3) as Passo), DUR_PASSO);
  else document.querySelectorAll<HTMLElement>('#passos-demo .tempo').forEach((t) => { t.style.animation = 'none'; });
}
document.querySelectorAll<HTMLButtonElement>('#passos-demo button').forEach((b) => b.addEventListener('click', () => irPasso(Number(b.dataset.passo) as Passo, false)));
document.documentElement.style.setProperty('--dur', `${DUR_PASSO}ms`);

// ---------------------------------------------------------------- vídeo principal (com conversor de segurança)
function convertendo(texto: string, fracao?: number) {
  $('convertendo').hidden = false;
  $('convertendo-texto').textContent = texto;
  const barra = $('convertendo-barra');
  barra.parentElement!.classList.toggle('indeterminado', fracao === undefined);
  barra.style.width = fracao === undefined ? '' : `${Math.round(fracao * 100)}%`;
}

const ENDERECO_OFICIAL = 'https://arthruur-prensa.static.hf.space/';

/** o que a Prensa precisa do navegador; sem isso, explica o que fazer em vez de falhar no meio */
function verificarRequisitos(): boolean {
  let titulo = '', texto = '', link = '';
  if (!isSecureContext) {
    titulo = 'Abra a Prensa pelo endereço oficial.';
    texto = `Esta página foi aberta sem conexão segura (${location.origin}), e assim o navegador desliga justamente o que a Prensa usa para ler e gravar vídeo no aparelho. O endereço oficial tem HTTPS de verdade e funciona em qualquer celular.`;
    link = ENDERECO_OFICIAL;
  } else if (typeof VideoEncoder === 'undefined' || typeof VideoDecoder === 'undefined') {
    titulo = 'Este navegador ainda não sabe fazer vídeo.';
    texto = 'A Prensa monta o vídeo no próprio aparelho com uma tecnologia chamada WebCodecs, que falta neste navegador. Use o Chrome, o Edge ou o Safari atualizados (no iPhone, iOS 17 ou mais novo).';
  }
  if (!titulo) return true;
  $('requisitos').hidden = false;
  $('requisitos-titulo').textContent = titulo;
  $('requisitos-texto').textContent = texto;
  const a = $<HTMLAnchorElement>('requisitos-link');
  a.hidden = !link;
  if (link) { a.href = link; a.textContent = 'Abrir a Prensa oficial'; }
  $('soltar').hidden = true;
  return false;
}

let vezArquivo = 0;
async function carregarPrincipal(arquivo: File) {
  erro('');
  if (!verificarRequisitos()) { mostrar('inicio'); return; }
  const vez = ++vezArquivo; // se a pessoa escolher outro vídeo no meio da conversão, a antiga é descartada
  try {
    usarPrincipal(await abrir(arquivo));
    return;
  } catch (e) {
    if (!(e instanceof FormatoNaoLido)) { convertendo(`Não deu para abrir: ${(e as Error).message}`, 0); return; }
    // conversão em segundo plano: a pessoa já vai para a mesa e compõe enquanto isso
    estado.principal = null;
    video.removeAttribute('src');
    estado.convertendo = { texto: 'Preparando o conversor', vez };
    $('convertendo').hidden = true;
    $('faixa-conversao-motivo').textContent = e.message;
    $('faixa-conversao').hidden = false;
    prontoParaPrensar(false);
    mostrar('criar');
    escolherReceita(estado.receita);
    animarCompondo();
    try {
      const convertido = await converter(arquivo, (texto, fracao) => {
        if (estado.convertendo?.vez !== vez) return;
        estado.convertendo = { texto, fracao, vez };
        $('faixa-conversao-texto').textContent = fracao === undefined ? `${texto}…` : `${texto} · ${Math.round(fracao * 100)}%`;
        const barra = $('faixa-conversao-barra');
        barra.parentElement!.classList.toggle('indeterminado', fracao === undefined);
        barra.style.width = fracao === undefined ? '' : `${Math.round(fracao * 100)}%`;
      });
      if (vez !== vezArquivo) return;
      try {
        usarPrincipal(await abrir(convertido));
      } catch (e3) {
        throw new Error(`o vídeo convertido também não abriu (${(e3 as Error).message}); o navegador pode estar sem suporte a vídeo`);
      }
    } catch (e2) {
      if (vez !== vezArquivo) return;
      estado.convertendo = null;
      $('faixa-conversao').hidden = true;
      erro(`Não consegui converter esse vídeo: ${(e2 as Error).message}. Tente exportá-lo de novo no celular (em MP4) ou escolha outro em "Mais opções → Trocar o vídeo".`);
      redesenhar();
    }
  }
}

function animarCompondo() {
  const t0 = performance.now();
  previa.parentElement!.classList.add('convertendo');
  const passo = () => {
    if (!estado.convertendo) { previa.parentElement!.classList.remove('convertendo'); return; }
    desenharCompondo(ctxPrevia, (performance.now() - t0) / 1000, estado.convertendo.texto, estado.convertendo.fracao);
    requestAnimationFrame(passo);
  };
  requestAnimationFrame(passo);
}

function prontoParaPrensar(sim: boolean) {
  const b = $<HTMLButtonElement>('prensar');
  b.disabled = !sim;
  b.querySelector('span')!.textContent = sim ? 'Prensar' : 'Esperando a conversão…';
}

function usarPrincipal(m: Midia) {
  estado.convertendo = null;
  $('convertendo').hidden = true;
  $('faixa-conversao').hidden = true;
  prontoParaPrensar(true);
  estado.principal = m;
  $('som-fala').hidden = !m.audio;
  video.src = URL.createObjectURL(m.arquivo);
  video.volume = Math.min(1, estado.som.volumeFala);
  estado.ini = 0;
  estado.fim = Math.min(m.dur, 60);
  estado.ganchoMexido = !!campoGancho.value.trim(); // o que a pessoa escreveu durante a conversão fica
  infoTrecho();
  mostrar('criar');
  escolherReceita(estado.receita);
  video.addEventListener('loadeddata', () => { video.currentTime = Math.min(1.5, m.dur / 2); }, { once: true });
  pedirLegenda().catch(() => {});
}

$<HTMLInputElement>('arquivo').addEventListener('change', (e) => {
  const f = (e.target as HTMLInputElement).files?.[0];
  if (f) carregarPrincipal(f);
});
const soltar = $('soltar');
soltar.addEventListener('dragover', (e) => { e.preventDefault(); soltar.classList.add('sobre'); });
soltar.addEventListener('dragleave', () => soltar.classList.remove('sobre'));
soltar.addEventListener('drop', (e) => {
  e.preventDefault();
  soltar.classList.remove('sobre');
  const f = e.dataTransfer?.files[0];
  if (f) carregarPrincipal(f);
});
$('trocar').addEventListener('click', () => { mostrar('inicio'); $<HTMLInputElement>('arquivo').click(); });

function infoTrecho() {
  const d = estado.fim - estado.ini;
  $('trecho-info').textContent = `Trecho: ${fmt(estado.ini)} → ${fmt(estado.fim)} (${Math.round(d)} s de ${Math.round(estado.principal?.dur ?? 0)} s). Dê play e marque o início e o fim.`;
}
$('marca-ini').addEventListener('click', () => {
  estado.ini = Math.min(video.currentTime, estado.fim - 1);
  if (estado.fim - estado.ini > 180) estado.fim = estado.ini + 180;
  infoTrecho(); redesenhar(); pedirLegenda().catch(() => {});
});
$('marca-fim').addEventListener('click', () => {
  estado.fim = Math.min(Math.max(video.currentTime, estado.ini + 1), estado.ini + 180); // 3 min: limite dos Shorts
  infoTrecho(); pedirLegenda().catch(() => {});
});

// ---------------------------------------------------------------- receitas: cada cartão mostra o SEU vídeo naquela receita
const miniaturas = new Map<string, CanvasRenderingContext2D>();
function montarReceitas() {
  $('receitas').replaceChildren(...RECEITAS.map((r) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'receita';
    b.dataset.id = r.id;
    b.setAttribute('role', 'radio');
    const c = document.createElement('canvas');
    c.width = 216; c.height = 384;
    const ctx = c.getContext('2d')!;
    ctx.scale(216 / L, 384 / A);
    miniaturas.set(r.id, ctx);
    const nome = document.createElement('strong');
    nome.textContent = r.nome;
    const para = document.createElement('small');
    para.textContent = r.para;
    b.append(c, nome, para);
    b.addEventListener('click', () => escolherReceita(r));
    return b;
  }));
}

function escolherReceita(r: Receita) {
  estado.receita = r;
  estado.estiloLegenda = null;
  // receita de tela dividida "pede" o vídeo de baixo: se a pessoa tinha tirado, volta ao padrão da receita
  if (r.layout === 'dividida' && estado.escolhaBaixo.tipo === 'nenhum') estado.escolhaBaixo = { tipo: 'receita' };
  document.querySelectorAll<HTMLButtonElement>('.receita').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.id === r.id)));
  $('receita-dica').textContent = r.dica;
  sincGaleria(); sincEstilos();
  montarIdeias();
  redesenhar();
}

// ---------------------------------------------------------------- gancho: ideias da própria fala primeiro
function montarIdeias() {
  const palavras = estado.falas.get(chaveTrecho());
  const daFala = palavras ? ganchosDaFala(palavras) : [];
  if (!estado.ganchoMexido) campoGancho.value = daFala[0] ?? '';
  campoGancho.placeholder = estado.receita.modelos[0] ? `ex.: ${estado.receita.modelos[0]}` : 'a frase mais forte do vídeo';
  const chips = [...daFala.map((t) => ({ t, fala: true })), ...estado.receita.modelos.map((t) => ({ t, fala: false }))];
  $('ideias').replaceChildren(...chips.map(({ t, fala }) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = fala ? 'ideia da-fala' : 'ideia';
    b.textContent = t;
    b.title = t;
    b.addEventListener('click', () => {
      campoGancho.value = t;
      estado.ganchoMexido = true;
      campoGancho.focus();
      const lacuna = t.indexOf('___'); // seleciona a lacuna: é só digitar por cima
      if (lacuna >= 0) campoGancho.setSelectionRange(lacuna, lacuna + 3);
      redesenhar();
    });
    return b;
  }));
}
campoGancho.addEventListener('input', () => { estado.ganchoMexido = true; redesenhar(); });

// ---------------------------------------------------------------- mais opções
function fichas<T extends string>(caixa: HTMLElement, itens: { id: T; nome: string }[], ativo: (id: T) => boolean, escolher: (id: T) => void, multi = false) {
  const sinc = () => caixa.querySelectorAll<HTMLButtonElement>('button').forEach((b) => b.setAttribute(multi ? 'aria-pressed' : 'aria-checked', String(ativo(b.dataset.id as T))));
  caixa.replaceChildren(...itens.map((it) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.id = it.id;
    b.textContent = it.nome;
    if (!multi) b.setAttribute('role', 'radio');
    b.addEventListener('click', () => { escolher(it.id); sinc(); });
    return b;
  }));
  sinc();
  return sinc;
}
const sincEstilos = fichas($('estilos-legenda'), [{ id: 'bloco' as EstiloLegenda, nome: 'Bloco (2 a 4 palavras)' }, { id: 'palavra' as EstiloLegenda, nome: 'Palavra por palavra' }], (id) => estiloLegendaDe(estado.receita) === id, (id) => {
  estado.estiloLegenda = id;
  redesenhar();
});
fichas($('plataformas'), PLATAFORMAS.map((p) => ({ id: p.id, nome: p.nome })), (id) => estado.plataformas.has(id), (id) => {
  if (estado.plataformas.has(id)) estado.plataformas.delete(id); else estado.plataformas.add(id);
  $<HTMLButtonElement>('prensar').disabled = estado.plataformas.size === 0;
}, true);

// ---------------------------------------------------------------- 4. vídeo de baixo: tudo à vista, numa galeria
const galeria = $('galeria-baixo');
const animacoes: { ctx: CanvasRenderingContext2D; desenhar: (typeof GERADORES)[number]['desenhar'] }[] = [];
let clipesAcervo: ClipeAcervo[] = [];

function cartao(chave: string, titulo: string, sub: string, aoEscolher: () => void, classe = ''): HTMLButtonElement {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = `cartao-baixo ${classe}`.trim();
  b.dataset.chave = chave;
  b.setAttribute('role', 'radio');
  const quadro = document.createElement('div');
  quadro.className = 'quadro';
  const t = document.createElement('strong');
  t.textContent = titulo;
  const sm = document.createElement('small');
  sm.textContent = sub;
  b.append(quadro, t, sm);
  b.addEventListener('click', aoEscolher);
  return b;
}

function chaveEscolha(): string {
  const e = estado.escolhaBaixo;
  if (e.tipo === 'video') return e.chave;
  const g = geradorDe(estado.receita);
  return g ? `gerado:${g}` : 'nenhum';
}

function sincGaleria() {
  const k = chaveEscolha();
  galeria.querySelectorAll<HTMLButtonElement>('.cartao-baixo').forEach((b) => {
    b.setAttribute('aria-checked', String(b.dataset.chave === k || (k.startsWith('proprio:') && b.dataset.chave === 'enviar')));
  });
  $('campo-credito').hidden = !usaVideoDeBaixo();
}

function escolherBaixo(e: typeof estado.escolhaBaixo) {
  estado.escolhaBaixo = e;
  sincGaleria();
  redesenhar();
}

/** a miniatura do clipe só é buscada quando o cartão aparece na tela */
const observarClipe = new IntersectionObserver((es) => es.forEach(async (e) => {
  if (!e.isIntersecting) return;
  observarClipe.unobserve(e.target);
  const v = e.target as HTMLVideoElement;
  const c = clipesAcervo.find((x) => x.id === v.dataset.id);
  const url = c ? await urlDoClipe(c) : null;
  if (!url) return;
  // o navegador só desenha o quadro se o tempo for pedido de verdade (o #t não basta em todo lugar)
  v.addEventListener('loadedmetadata', () => { v.currentTime = Math.min(1.5, (v.duration || 3) / 2); }, { once: true });
  if (url.startsWith('http')) v.crossOrigin = 'anonymous'; // a página é isolada (COEP): vídeo de outro domínio só em modo CORS
  v.preload = 'auto';
  v.src = url;
}), { rootMargin: '200px' });

function cartaoClipe(c: ClipeAcervo): HTMLButtonElement {
  // não revisado: ninguém confirmou a licença, então ela não vai para a tela como se fosse certa
  const licenca = c.revisado ? c.licenca : 'licença não confirmada';
  const sub = `${c.credito} · ${licenca}${c.share_alike ? ' · o reel herda a CC BY-SA' : ''}`;
  const b = cartao(`clipe:${c.id}`, c.titulo, sub, async () => {
    b.classList.add('baixando');
    try {
      const blob = await baixarClipe(c);
      await usarBaixo(new File([blob], c.arquivo, { type: blob.type || 'video/mp4' }), `${c.credito} (${licenca})`, `clipe:${c.id}`);
    } catch (err) {
      erro((err as Error).message);
    } finally {
      b.classList.remove('baixando');
    }
  }, c.revisado ? '' : 'nao-revisado');
  const v = document.createElement('video');
  v.muted = true;
  v.playsInline = true;
  v.preload = 'none';
  v.dataset.id = c.id;
  b.querySelector('.quadro')!.append(v);
  observarClipe.observe(v);
  return b;
}

function montarGaleria() {
  animacoes.length = 0;
  const nenhum = cartao('nenhum', 'Nenhum', 'tela cheia', () => escolherBaixo({ tipo: 'nenhum' }), 'sem');
  const geradas = GERADORES.map((g) => {
    const b = cartao(`gerado:${g.id}`, g.nome, 'animação · sem direitos de ninguém', () => escolherBaixo({ tipo: 'gerado', id: g.id }));
    const c = document.createElement('canvas');
    c.width = 135; c.height = 240;
    b.querySelector('.quadro')!.append(c);
    animacoes.push({ ctx: c.getContext('2d')!, desenhar: g.desenhar });
    return b;
  });
  const revisados = clipesAcervo.filter((c) => c.revisado).map(cartaoClipe);
  const outros = clipesAcervo.filter((c) => !c.revisado).map(cartaoClipe);
  const enviar = cartao('enviar', 'Enviar o seu', 'um vídeo do seu aparelho', () => $<HTMLInputElement>('arquivo-baixo').click(), 'enviar');
  enviar.querySelector('.quadro')!.textContent = '+';
  // faixas com rolagem lateral: tudo à vista sem virar uma parede de cartões no celular
  const faixa = (titulo: string, cartoes: HTMLElement[]) => {
    const g = document.createElement('div');
    g.className = 'grupo';
    const t = Object.assign(document.createElement('p'), { className: 'galeria-titulo', textContent: titulo });
    const f = Object.assign(document.createElement('div'), { className: 'faixa' });
    f.append(...cartoes);
    g.append(t, f);
    return g;
  };
  galeria.replaceChildren(
    faixa('Animações (sem direitos de ninguém) e o seu', [nenhum, enviar, ...geradas]),
    ...(revisados.length ? [faixa(`Acervo livre, revisado (${revisados.length})`, revisados)] : []),
    ...(outros.length ? [faixa(`Não revisados · licença não confirmada (${outros.length}): se não é seu, diga de onde veio`, outros)] : []),
  );
  sincGaleria();
}

/** as animações da galeria tocam de verdade, enquanto a mesa está na tela */
function animarGaleria(agora: number) {
  if (!$('tela-criar').hidden) {
    for (const a of animacoes) a.desenhar(a.ctx, agora / 1000, 0, 0, 135, 240);
  }
  requestAnimationFrame(animarGaleria);
}

$<HTMLInputElement>('arquivo-baixo').addEventListener('change', async (e) => {
  const f = (e.target as HTMLInputElement).files?.[0];
  if (!f) return;
  await usarBaixo(f, '', `proprio:${f.name}`);
  galeria.querySelector('.enviar small')!.textContent = f.name;
});

async function usarBaixo(f: File, credito: string, chave: string) {
  try {
    estado.baixo = await abrir(f);
    videoBaixo.src = URL.createObjectURL(f);
    // vídeo escondido só decodifica um quadro se for pedido: o seek força o 1º quadro para a prévia
    videoBaixo.addEventListener('loadedmetadata', () => { videoBaixo.currentTime = 0.05; }, { once: true });
    if (!video.paused) videoBaixo.play();
    campoCredito.value = credito;
    escolherBaixo({ tipo: 'video', chave });
  } catch (err) {
    erro((err as Error).message);
  }
}
videoBaixo.addEventListener('seeked', () => redesenhar());

async function carregarAcervo() {
  try { clipesAcervo = await carregarManifesto(); } catch { clipesAcervo = []; }
  montarGaleria();
}

// ---------------------------------------------------------------- 5. som: fala, música, ducking
const MUSICAS = [
  { id: 'nenhuma', nome: 'Sem música', clima: 'só o som do vídeo' },
  ...TRILHAS.map((t) => ({ id: t.id, nome: t.nome, clima: t.clima })),
  { id: 'arquivo', nome: 'Sua música', clima: 'do seu aparelho' },
];
const volumeMusicaDb = () => -30 + 24 * (estado.som.volumeMusica / 100); // 50 = -18 dB, o padrão de vídeo falado
const dbLin = (db: number) => 10 ** (db / 20);

function montarMusicas() {
  $('musicas').replaceChildren(...MUSICAS.map((m) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'musica';
    b.dataset.id = m.id;
    b.setAttribute('role', 'radio');
    b.innerHTML = '<strong></strong><small></small>';
    b.querySelector('strong')!.textContent = m.nome;
    b.querySelector('small')!.textContent = m.clima;
    b.addEventListener('click', () => escolherMusica(m.id));
    return b;
  }));
  sincMusicas();
}

function sincMusicas() {
  const s = estado.som;
  document.querySelectorAll<HTMLButtonElement>('#musicas .musica').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.id === s.musica)));
  $('som-musica').hidden = s.musica === 'nenhuma';
  if (s.arquivoMusica) document.querySelector('#musicas [data-id="arquivo"] small')!.textContent = s.arquivoMusica.name;
  $('musica-credito').textContent = s.musica === 'arquivo'
    ? 'Use só música que você pode usar (sua, livre ou licenciada): as redes derrubam vídeo com música de terceiros.'
    : s.musica !== 'nenhuma' ? 'Trilha gerada pela Prensa, na hora: sem direitos de ninguém.' : '';
  const v = s.volumeMusica;
  $('volume-musica-valor').textContent = `${v < 30 ? 'baixa' : v < 70 ? 'média' : 'alta'} (${Math.round(volumeMusicaDb())} dB)`;
}

function escolherMusica(id: string) {
  acordarAudio();
  if (id === 'arquivo' && !estado.som.arquivoMusica) { $<HTMLInputElement>('arquivo-musica').click(); return; }
  estado.som.musica = id;
  sincMusicas();
  bufferDaMusica(); // já começa a preparar a trilha
  if (!video.paused) tocarMusicaNaPrevia();
}
$<HTMLInputElement>('arquivo-musica').addEventListener('change', (e) => {
  const f = (e.target as HTMLInputElement).files?.[0];
  if (!f) return;
  estado.som.arquivoMusica = f;
  escolherMusica('arquivo');
});

function bufferDaMusica(): Promise<AudioBuffer> | null {
  const s = estado.som;
  if (s.musica === 'nenhuma' || (s.musica === 'arquivo' && !s.arquivoMusica)) return null;
  const chave = s.musica === 'arquivo' ? `arquivo:${s.arquivoMusica!.name}:${s.arquivoMusica!.size}` : s.musica;
  if (!s.buffers.has(chave)) {
    const p = s.musica === 'arquivo'
      ? s.arquivoMusica!.arrayBuffer().then((b) => new OfflineAudioContext(2, 48000, 48000).decodeAudioData(b))
      : gerarTrilha(s.musica, 48000);
    p.catch(() => s.buffers.delete(chave));
    s.buffers.set(chave, p);
  }
  return s.buffers.get(chave)!;
}

const reguaFala = $<HTMLInputElement>('volume-fala');
reguaFala.addEventListener('input', () => {
  estado.som.volumeFala = Number(reguaFala.value) / 100;
  $('volume-fala-valor').textContent = `${reguaFala.value}%`;
  video.volume = Math.min(1, estado.som.volumeFala);
  atualizarGanhoMusica();
});
const reguaMusica = $<HTMLInputElement>('volume-musica');
reguaMusica.addEventListener('input', () => { estado.som.volumeMusica = Number(reguaMusica.value); sincMusicas(); atualizarGanhoMusica(); });
$<HTMLInputElement>('abaixar').addEventListener('change', (e) => { estado.som.abaixar = (e.target as HTMLInputElement).checked; });
$<HTMLInputElement>('suave').addEventListener('change', (e) => { estado.som.suave = (e.target as HTMLInputElement).checked; });

// prévia do som: a música toca junto com a prévia, com o volume e o ducking aproximados (a mixagem final é nivelada)
let ctxAudio: AudioContext | null = null;
let fonteMusica: AudioBufferSourceNode | null = null;
let ganhoMusica: GainNode | null = null;
let vezMusica = 0;

function acordarAudio() { // no iPhone, o áudio só liga dentro de um toque
  ctxAudio ??= new AudioContext();
  ctxAudio.resume().catch(() => {});
}

async function tocarMusicaNaPrevia() {
  pararMusicaNaPrevia();
  const vez = ++vezMusica;
  const p = bufferDaMusica();
  if (!p || video.paused || !ctxAudio) return;
  const buf = await p.catch(() => null);
  if (!buf || vez !== vezMusica || video.paused) return;
  ganhoMusica = ctxAudio.createGain();
  ganhoMusica.gain.value = 0;
  ganhoMusica.connect(ctxAudio.destination);
  fonteMusica = ctxAudio.createBufferSource();
  fonteMusica.buffer = buf;
  fonteMusica.loop = true;
  fonteMusica.connect(ganhoMusica);
  fonteMusica.start(0, Math.max(0, video.currentTime - estado.ini) % buf.duration);
  atualizarGanhoMusica();
}

function pararMusicaNaPrevia() {
  vezMusica++;
  try { fonteMusica?.stop(); } catch { /* já parou */ }
  fonteMusica = null;
  ganhoMusica = null;
}

function atualizarGanhoMusica() {
  if (!ganhoMusica || !ctxAudio) return;
  const s = estado.som;
  const t = video.currentTime - estado.ini;
  const dur = estado.fim - estado.ini;
  let g = dbLin(volumeMusicaDb()) * 3 * Math.max(0.2, s.volumeFala);
  if (s.abaixar && estado.principal?.audio) {
    const palavras = estado.falas.get(chaveTrecho());
    if (palavras?.some((w) => t >= w.inicio - 0.1 && t <= w.fim + 0.25)) g *= dbLin(-10);
  }
  if (s.suave) {
    if (t < 1) g *= Math.max(0, t);
    if (dur - t < 2) g *= Math.max(0, (dur - t) / 2);
  }
  ganhoMusica.gain.setTargetAtTime(g, ctxAudio.currentTime, 0.06);
}
// ---------------------------------------------------------------- prévia e miniaturas (a mesma função de desenho do export)
const EXEMPLO_GANCHO: Record<string, string> = {
  titulo: 'A frase mais forte do vídeo', 'voce-sabia': 'que isso muda tudo?', lista: '3 erros que todo mundo comete',
  manchete: 'Isso não é o que te contaram', pov: 'você descobriu isso agora', pergunta: 'Por que isso acontece?',
};
/** exemplo = true só nas miniaturas: sem gancho escrito, mostra um exemplo para a receita se distinguir */
function quadroPara(r: Receita, legenda: Bloco[] | null, exemplo = false): Quadro {
  const escrito = campoGancho.value.includes('___') ? '' : campoGancho.value;
  return {
    layout: usaDividida(r) ? 'dividida' : 'cheio',
    gancho: { estilo: r.gancho, texto: escrito || (exemplo ? EXEMPLO_GANCHO[r.gancho] ?? '' : '') },
    fonte: campoFonte.value.trim(),
    creditoBaixo: usaVideoDeBaixo() ? campoCredito.value.trim() : '',
    legenda,
    estiloLegenda: estiloLegendaDe(r),
    gerador: geradorDe(r),
  };
}

let blocosCache: { chave: string; blocos: Bloco[] | null } = { chave: '', blocos: null };
function blocosDoTrecho(): Bloco[] | null {
  const chave = `${chaveTrecho()}|${campoLegenda.checked}|${estado.falas.has(chaveTrecho())}`;
  if (blocosCache.chave !== chave) {
    const palavras = estado.falas.get(chaveTrecho());
    const f = faixaLegenda('cheio');
    blocosCache = { chave, blocos: palavras && campoLegenda.checked ? montarBlocos(palavras, ctxPrevia, f.dir - f.esq - 56) : null };
  }
  return blocosCache.blocos;
}

function fontes(): [Fonte | null, Fonte | null] {
  const p = video.readyState >= 2 ? { img: video, w: video.videoWidth, h: video.videoHeight } : null;
  const b = usaVideoDeBaixo() && videoBaixo.readyState >= 2 ? { img: videoBaixo, w: videoBaixo.videoWidth, h: videoBaixo.videoHeight } : null;
  return [p, b];
}

function desenhar() {
  if (estado.convertendo) return; // a prévia está mostrando a composição dos tipos
  const [p, b] = fontes();
  desenharQuadro(ctxPrevia, quadroPara(estado.receita, blocosDoTrecho()), Math.max(0, video.currentTime - estado.ini), p, b);
}

let miniaturaPendente = 0;
function redesenhar() {
  desenhar();
  cancelAnimationFrame(miniaturaPendente);
  miniaturaPendente = requestAnimationFrame(() => {
    const [p, b] = fontes();
    const blocos = blocosDoTrecho();
    // instante que mostra gancho e legenda juntos
    const t = Math.max(1.2, blocos?.[0] ? blocos[0].ini + 0.3 : video.currentTime - estado.ini);
    for (const r of RECEITAS) {
      const ctx = miniaturas.get(r.id);
      if (ctx) desenharQuadro(ctx, quadroPara(r, blocos, true), t, p, b);
    }
  });
}

function laco() {
  desenhar();
  atualizarGanhoMusica();
  if (!video.paused) requestAnimationFrame(laco);
}
const celular = previa.parentElement!;
video.addEventListener('play', () => { celular.classList.add('tocando'); if (usaVideoDeBaixo()) videoBaixo.play(); tocarMusicaNaPrevia(); laco(); });
video.addEventListener('pause', () => { celular.classList.remove('tocando'); videoBaixo.pause(); pararMusicaNaPrevia(); });
video.addEventListener('seeked', () => { redesenhar(); if (!video.paused) tocarMusicaNaPrevia(); });
video.addEventListener('timeupdate', () => { if (video.currentTime > estado.fim + 0.2 && !video.paused) video.currentTime = estado.ini; });
function alternar() {
  if (!estado.principal) return;
  acordarAudio();
  if (video.paused) {
    if (video.currentTime < estado.ini || video.currentTime > estado.fim) video.currentTime = estado.ini;
    video.play();
  } else video.pause();
}
previa.addEventListener('click', alternar);
$('play').addEventListener('click', alternar);
$<HTMLInputElement>('ver-zona').addEventListener('change', (e) => { $('zona').hidden = !(e.target as HTMLInputElement).checked; });
[campoFonte, campoCredito].forEach((c) => c.addEventListener('input', () => redesenhar()));
campoFonte.addEventListener('input', () => { $('aviso-fonte').hidden = true; });
campoLegenda.addEventListener('change', () => { redesenhar(); pedirLegenda().catch(() => {}); });

// ---------------------------------------------------------------- legenda em segundo plano: começa assim que o vídeo chega
function estadoLegenda(t: string) {
  $('legenda-estado').textContent = t;
  $('legenda-estado-2').textContent = t.replace(/ Ideias tiradas da própria fala:$/, '');
}

function avisoLegenda(texto: string, fracao?: number) {
  estadoLegenda(`Ouvindo a fala para sugerir o gancho e fazer a legenda… ${fracao === undefined ? '' : `${Math.round(fracao * 100)}%`}`);
  if (estado.esperandoLegenda) andamento(texto, fracao);
}

function pedirLegenda(): Promise<Palavra[]> {
  const m = estado.principal;
  if (!m?.audio || !campoLegenda.checked) {
    estadoLegenda(m && !m.audio ? 'Esse vídeo não tem som: sai sem legenda.' : '');
    return Promise.resolve([]);
  }
  const k = chaveTrecho();
  const pronta = estado.falas.get(k);
  if (pronta) { estadoLegenda('Legenda pronta. Ideias tiradas da própria fala:'); return Promise.resolve(pronta); }
  const andando = estado.ouvindo.get(k);
  if (andando) return andando;
  const { ini, fim } = estado;
  const p = (async () => {
    avisoLegenda('Separando o áudio');
    const audio = await audioParaFala(m, ini, fim);
    const palavras = audio ? await transcrever(audio, avisoLegenda, () => k === chaveTrecho()) : [];
    estado.falas.set(k, palavras);
    if (k === chaveTrecho()) {
      estadoLegenda('Legenda pronta. Ideias tiradas da própria fala:');
      montarIdeias();
      redesenhar();
    }
    return palavras;
  })().finally(() => estado.ouvindo.delete(k));
  estado.ouvindo.set(k, p);
  return p;
}

// ---------------------------------------------------------------- prensar
function erro(msg: string) {
  $('erro').hidden = !msg;
  $('erro').textContent = msg;
}

function andamento(texto: string, fracao?: number) {
  $('andamento').hidden = false;
  $('andamento-texto').textContent = texto;
  const barra = $('andamento-barra');
  barra.parentElement!.classList.toggle('indeterminado', fracao === undefined);
  barra.style.width = fracao === undefined ? '' : `${Math.round(fracao * 100)}%`;
}

function folhasDoPrelo(n: number) {
  document.querySelectorAll('#prelo-folhas span').forEach((s, i) => s.classList.toggle('pronta', i < n));
}

function slug(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'reel';
}

$('prensar').addEventListener('click', async () => {
  const m = estado.principal;
  if (!m) return;
  erro('');
  $('aviso-fonte').hidden = !!campoFonte.value.trim();
  video.pause();
  const botao = $<HTMLButtonElement>('prensar');
  botao.disabled = true;
  estado.cancelar = new AbortController();
  const plats = PLATAFORMAS.filter((p) => estado.plataformas.has(p.id));
  $('prelo-folhas').replaceChildren(...plats.map((p) => Object.assign(document.createElement('span'), { textContent: p.nome.replace('Status do ', '') })));
  const t0 = performance.now();
  try {
    let blocos: Bloco[] | null = null;
    if (campoLegenda.checked && m.audio) {
      estado.esperandoLegenda = true;
      andamento('Terminando de ouvir a fala');
      await pedirLegenda().finally(() => { estado.esperandoLegenda = false; });
      blocos = blocosDoTrecho();
      estado.srt = blocos ? gerarSrt(blocos) : '';
    }
    const q = quadroPara(estado.receita, blocos);
    const pMusica = bufferDaMusica();
    if (pMusica) andamento('Preparando a música');
    const som: OpcoesDeSom = {
      limpar: campoSom.checked, volumeFala: estado.som.volumeFala, musica: pMusica ? await pMusica : null,
      volumeMusicaDb: volumeMusicaDb(), abaixar: estado.som.abaixar, suave: estado.som.suave,
    };
    andamento('Prensando', 0);
    const mestre = await prensar({ ...q, principal: m, baixo: usaVideoDeBaixo() ? estado.baixo : null, ini: estado.ini, fim: estado.fim, som },
      (f) => andamento(`Prensando · ${Math.round(f * 100)}%`, f), estado.cancelar.signal);
    const base = slug(campoGancho.value || m.arquivo.name.replace(/\.[^.]+$/, ''));
    const arquivos = await exportar(mestre, estado.fim - estado.ini, base, plats, (f) => {
      andamento('Uma folha para cada rede', f);
      folhasDoPrelo(Math.floor(f * plats.length));
    });
    folhasDoPrelo(plats.length);
    mostrarProntos(arquivos, mestre, (performance.now() - t0) / 1000);
  } catch (e) {
    if ((e as Error).name !== 'AbortError') {
      console.error(e);
      erro(`Não deu certo: ${(e as Error).message}`);
    }
  } finally {
    $('andamento').hidden = true;
    botao.disabled = false;
    estado.cancelar = null;
  }
});
$('cancelar').addEventListener('click', () => estado.cancelar?.abort());

function textoPost(): string {
  const g = campoGancho.value.trim();
  const prefixo: Record<string, string> = { 'voce-sabia': 'Você sabia? ', pov: 'POV: ' };
  const linhas = [];
  if (g && !g.includes('___')) linhas.push((prefixo[estado.receita.gancho] ?? '') + g);
  if (campoFonte.value.trim()) linhas.push(`Fonte: ${campoFonte.value.trim()}`);
  if (usaVideoDeBaixo() && campoCredito.value.trim()) linhas.push(`Vídeo de baixo: ${campoCredito.value.trim()}`);
  return linhas.join('\n');
}

function mostrarProntos(arquivos: Arquivo[], mestre: Blob, segundos: number) {
  estado.urls.forEach((u) => URL.revokeObjectURL(u));
  estado.urls = [];
  const resultado = $<HTMLVideoElement>('resultado');
  resultado.src = URL.createObjectURL(mestre);
  estado.urls.push(resultado.src);
  $('arquivos').replaceChildren(...arquivos.map((a, k) => {
    const li = document.createElement('li');
    li.style.setProperty('--k', String(k));
    const url = URL.createObjectURL(a.blob);
    estado.urls.push(url);
    const arquivo = new File([a.blob], a.nome, { type: 'video/mp4' });
    const info = document.createElement('div');
    info.className = 'info';
    info.innerHTML = '<strong></strong><small></small>';
    info.querySelector('strong')!.textContent = a.plataforma;
    info.querySelector('small')!.textContent = `${(a.blob.size / 1e6).toFixed(1)} MB${a.aviso ? ` · ${a.aviso}` : ''}`;
    li.append(info);
    if (navigator.canShare?.({ files: [arquivo] })) {
      const comp = document.createElement('button');
      comp.type = 'button';
      comp.className = 'compartilhar';
      comp.textContent = 'Compartilhar';
      comp.addEventListener('click', () => navigator.share({ files: [arquivo], text: textoPost() }).catch(() => {}));
      li.append(comp);
    }
    const baixar = document.createElement('a');
    baixar.href = url;
    baixar.download = a.nome;
    baixar.textContent = 'Baixar';
    baixar.className = 'baixar';
    li.append(baixar);
    return li;
  }));
  $<HTMLTextAreaElement>('post').value = textoPost();
  $('srt').hidden = !estado.srt;
  $('pronto-tempo').textContent = `Pronto em ${Math.round(segundos)} s`;
  mostrar('pronta');
  resultado.play().catch(() => {});
}

$('copiar').addEventListener('click', () => navigator.clipboard.writeText($<HTMLTextAreaElement>('post').value));
$('srt').addEventListener('click', () => {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([estado.srt], { type: 'text/plain' }));
  a.download = 'legenda.srt';
  a.click();
});
$('voltar').addEventListener('click', () => mostrar('criar'));
$('passar-adiante').addEventListener('click', async () => {
  const dados = { title: 'Prensa', text: 'Prensa: seu vídeo vira reels em 3 toques, no seu celular. Software livre, de graça, sem marca d’água.', url: location.origin + location.pathname };
  if (navigator.share) await navigator.share(dados).catch(() => {});
  else { await navigator.clipboard.writeText(`${dados.text} ${dados.url}`); $('passar-adiante').textContent = 'Link copiado ✓'; }
});
$('novo').addEventListener('click', () => { $<HTMLInputElement>('arquivo').value = ''; estado.principal = null; mostrar('inicio'); });

// ---------------------------------------------------------------- a história
const historia = $<HTMLDialogElement>('historia');
const observador = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) e.target.classList.add('visivel'); }), { root: historia, threshold: 0.2 });
historia.querySelectorAll('.capitulo').forEach((c) => observador.observe(c));
function abrirHistoria() {
  historia.showModal();
  historia.scrollTop = 0;
  $('historia-titulo').focus();
  const comp = historia.querySelector('.composicao')!;
  comp.classList.remove('impresso');
  setTimeout(() => comp.classList.add('impresso'), 900);
}
$('abrir-historia').addEventListener('click', abrirHistoria);
$('abrir-historia-2').addEventListener('click', abrirHistoria);
$('historia-fechar').addEventListener('click', () => historia.close());
$('historia-comecar').addEventListener('click', () => {
  historia.close();
  if (!estado.principal) { mostrar('inicio'); $<HTMLInputElement>('arquivo').click(); }
});

// ---------------------------------------------------------------- início
(async () => {
  verificarRequisitos();
  montarReceitas();
  montarMusicas();
  montarGaleria();
  requestAnimationFrame(animarGaleria);
  await document.fonts.load(`84px "${FONTE}"`).catch(() => {});
  demo = criarDemo($<HTMLCanvasElement>('demo'));
  irPasso(0);
  escolherReceita(RECEITAS[0]);
  carregarAcervo();
  // vídeo recebido pelo menu Compartilhar (Android)
  if (new URLSearchParams(location.search).has('recebido') && 'caches' in window) {
    const c = await caches.open('prensa-recebido');
    const r = await c.match('./recebido');
    if (r) {
      const nome = decodeURIComponent(r.headers.get('X-Nome') ?? 'video.mp4');
      await carregarPrincipal(new File([await r.blob()], nome, { type: r.headers.get('Content-Type') ?? 'video/mp4' }));
      await c.delete('./recebido');
    }
    history.replaceState(null, '', location.pathname);
  }
  if (import.meta.env.PROD && 'serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js');
})();

// para testes automatizados
Object.assign(window, { __prensa: { estado } });
