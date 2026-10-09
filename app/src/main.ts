import { type ClipeAcervo, type MusicaAcervo, baixarClipe, baixarMusica, carregarManifesto, carregarMusicas, urlDoClipe } from './acervo';
import { BAIXADOR, baixarLink } from './baixador';
import { checarStatusYouTube, publicarParaYouTube, gerarIdeiasVirais } from './publicador';
import { desenharCompondo } from './compondo';
import { converter } from './conversor';
import { type Passo, criarDemo } from './demo';
import { A, L, type Fonte, type Quadro, desenharQuadro, faixaLegenda } from './formatos';
import { type Bloco, type EstiloLegenda, type Palavra, FONTE, gerarSrt, montarBlocos } from './legenda';
import { PLATAFORMAS } from './plataformas';
import { type Arquivo, FormatoNaoLido, type Midia, type OpcoesDeSom, abrir, audioParaFala, exportar, prensar, temSom } from './prensa';
import { RECEITAS, type Receita, ganchosDaFala } from './receitas';
import { GERADORES } from './retencao';
import { EFEITOS, TRILHAS, gerarEfeito, gerarTrilha } from './trilhas';
import { enviarAoStudio, lembrarStudio, procurarStudio, studioLigado } from './studio';
import { transcrever } from './transcrever';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

type EscolhaBaixo = { tipo: 'receita' } | { tipo: 'nenhum' } | { tipo: 'gerado'; id: string } | { tipo: 'video'; chave: string };
type Saida = { titulo: string; arquivos: Arquivo[]; mestre: Blob; post: string; srt: string; segundos: number };
type PassoId = 'receita' | 'gancho' | 'fonte' | 'baixo' | 'som' | 'legenda' | 'prensar';
/** o que a pessoa ajustou num vídeo da fila: volta quando ela abre o vídeo de novo, e o lote respeita */
type Ajustes = { gancho: string; ganchoMexido: boolean; fonte: string; origem: string; ini: number; fim: number };
type ItemFila = { situacao: 'pendente' | 'pronto' | 'erro' | 'fora'; ajustes: Ajustes | null; capa: string | null };
type FiltroFila = 'todos' | 'pendente' | 'pronto';

// a Aventura do Mangaio vem primeiro na lista, mas quem abre a Prensa começa no Corte direto
const RECEITA_PADRAO = RECEITAS.find((r) => r.id === 'direto') ?? RECEITAS[0];

const estado = {
  principal: null as Midia | null,
  baixo: null as Midia | null,
  ini: 0,
  fim: 0,
  receita: RECEITA_PADRAO,
  escolhaBaixo: { tipo: 'receita' } as EscolhaBaixo,
  estiloLegenda: null as EstiloLegenda | null, // null = o da receita
  plataformas: new Set(PLATAFORMAS.map((p) => p.id)),
  falas: new Map<string, Palavra[]>(),         // trecho -> palavras (já com as correções da pessoa)
  ouvindo: new Map<string, Promise<Palavra[]>>(),
  versaoFala: 0,                               // muda quando a pessoa edita a legenda
  esperandoLegenda: false,
  ganchoMexido: false,
  passo: 'receita' as PassoId,
  fila: [] as File[],
  filaItens: [] as ItemFila[],
  filaIndice: 0,
  filaFiltro: 'todos' as FiltroFila,
  lote: false,       // prensando os pendentes um atrás do outro
  loteParado: false, // a pessoa cancelou no meio do lote
  saidas: [] as Saida[],
  urls: [] as string[],
  cancelar: null as AbortController | null,
  convertendo: null as { texto: string; fracao?: number; vez: number } | null, // conversor em segundo plano
  origem: '',                                  // link original, quando o vídeo veio de um link
  som: {
    volumeFala: 1, musica: 'nenhuma', volumeMusica: 65, abaixar: true, suave: true, efeito: 'whoosh',
    arquivoMusica: null as File | null, buffers: new Map<string, Promise<AudioBuffer>>(),
  },
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
function mostrar(tela: 'inicio' | 'criar') {
  $('tela-inicio').hidden = tela !== 'inicio';
  $('tela-criar').hidden = tela !== 'criar';
  if (tela === 'inicio') demo?.continuar(); else demo?.parar();
  window.scrollTo({ top: 0 });
}
$('ir-inicio').addEventListener('click', () => mostrar(estado.principal ? 'criar' : 'inicio'));

// ---------------------------------------------------------------- 1. início: demonstração viva
let passoAuto: number | undefined;
const DUR_PASSO = 6000;
function irPassoDemo(p: Passo, auto = true) {
  demo?.ir(p);
  document.querySelectorAll<HTMLButtonElement>('#passos-demo button').forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.passo) === p)));
  document.querySelector('.vitrine')!.classList.toggle('passo-2', p === 2);
  clearTimeout(passoAuto);
  if (auto) passoAuto = window.setTimeout(() => irPassoDemo(((p + 1) % 3) as Passo), DUR_PASSO);
  else document.querySelectorAll<HTMLElement>('#passos-demo .tempo').forEach((t) => { t.style.animation = 'none'; });
}
document.querySelectorAll<HTMLButtonElement>('#passos-demo button').forEach((b) => b.addEventListener('click', () => irPassoDemo(Number(b.dataset.passo) as Passo, false)));
document.documentElement.style.setProperty('--dur', `${DUR_PASSO}ms`);

// ---------------------------------------------------------------- 2. a mesa como passo a passo
const PASSOS: { id: PassoId; nome: string }[] = [
  { id: 'receita', nome: 'Receita' }, { id: 'gancho', nome: 'Gancho' }, { id: 'fonte', nome: 'Fonte' },
  { id: 'baixo', nome: 'Vídeo de baixo' }, { id: 'som', nome: 'Som' }, { id: 'legenda', nome: 'Legenda' }, { id: 'prensar', nome: 'Prensar' },
];
const passosDaReceita = () => PASSOS.filter((p) => !(p.id === 'baixo' && estado.receita.id === 'civico'));

function irPara(id: PassoId) {
  estado.passo = id;
  document.querySelectorAll<HTMLElement>('.passo-guia').forEach((d) => { d.hidden = d.dataset.passo !== id; });
  const passos = passosDaReceita();
  const i = passos.findIndex((p) => p.id === id);
  $('trilha-passos').replaceChildren(...passos.map((p, k) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = `${k + 1}. ${p.nome}`;
    b.className = k < i ? 'feito' : '';
    if (p.id === id) b.setAttribute('aria-current', 'step');
    b.addEventListener('click', () => irPara(p.id));
    return b;
  }));
  $<HTMLButtonElement>('voltar-passo').hidden = i <= 0;
  const proximo = passos[i + 1];
  $<HTMLButtonElement>('proximo-passo').hidden = !proximo;
  if (proximo) $('proximo-passo').textContent = `Próximo: ${proximo.nome} →`;
  if (id === 'legenda') montarEditorLegenda();
  if (id === 'prensar') montarResumo();
  $('trilha-passos').querySelector('[aria-current]')?.scrollIntoView({ block: 'nearest', inline: 'center' });
}
$('voltar-passo').addEventListener('click', () => {
  const p = passosDaReceita();
  irPara(p[Math.max(0, p.findIndex((x) => x.id === estado.passo) - 1)].id);
});
$('proximo-passo').addEventListener('click', () => {
  const p = passosDaReceita();
  irPara(p[Math.min(p.length - 1, p.findIndex((x) => x.id === estado.passo) + 1)].id);
  if (matchMedia('(max-width: 899px)').matches) $('trilha-passos').scrollIntoView({ behavior: 'smooth', block: 'start' });
});

function montarResumo() {
  const r = estado.receita;
  const gerador = geradorDe(r);
  const baixo = usaVideoDeBaixo() ? (campoCredito.value || 'seu vídeo') : gerador ? GERADORES.find((g) => g.id === gerador)?.nome ?? '' : 'nenhum';
  const musica = MUSICAS.find((m) => m.id === estado.som.musica)?.nome ?? 'Sem música';
  const itens: [string, string][] = [
    ['Receita', r.nome],
    ['Gancho', campoGancho.value.trim() || '—'],
    ['Vídeo de baixo', baixo],
    ['Música', musica],
    ['Legenda', campoLegenda.checked ? (estiloLegendaDe(r) === 'palavra' ? 'palavra por palavra' : 'em bloco') : 'desligada'],
    ['Trecho', `${fmt(estado.ini)} → ${fmt(estado.fim)}`],
  ];
  $('resumo').replaceChildren(...itens.map(([k, v]) => {
    const li = document.createElement('li');
    li.innerHTML = '<span></span><strong></strong>';
    li.querySelector('span')!.textContent = k;
    li.querySelector('strong')!.textContent = v;
    return li;
  }));
}

// ---------------------------------------------------------------- vídeo principal (com conversor de segurança) e fila
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
    texto = `Esta página foi aberta sem conexão segura (${location.origin}), e assim o navegador desliga o que a Prensa usa para ler e gravar vídeo.`;
    link = ENDERECO_OFICIAL;
  } else if (typeof VideoEncoder === 'undefined' || typeof VideoDecoder === 'undefined') {
    titulo = 'Este navegador ainda não sabe fazer vídeo.';
    texto = 'Use o Chrome, o Edge ou o Safari atualizados (no iPhone, iOS 17 ou mais novo).';
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

// ---------------------------------------------------------------- link: o baixador traz o vídeo, a fonte já vem preenchida
const formLink = $<HTMLFormElement>('colar-link');
formLink.hidden = !BAIXADOR;
const REDES: Record<string, string> = { Twitter: 'X', Instagram: 'Instagram', TikTok: 'TikTok', Youtube: 'YouTube', Kwai: 'Kwai', Facebook: 'Facebook' };
async function buscarLink(url: string) {
  if (!verificarRequisitos()) return;
  const botao = formLink.querySelector('button')!;
  botao.disabled = true;
  try {
    const b = await baixarLink(url, convertendo);
    $('convertendo').hidden = true;
    const rede = REDES[b.plataforma] ?? b.plataforma;
    const arroba = ['X', 'Instagram', 'TikTok'].includes(rede) && b.autor ? `@${b.autor.replace(/^@/, '')}` : b.autor;
    campoFonte.value = [arroba, rede].filter(Boolean).join(' · ');
    estado.origem = b.origem;
    novaFila([b.arquivo]);
    await carregarPrincipal(b.arquivo);
  } catch (e) {
    convertendo(`Não deu: ${(e as Error).message}`, 0);
  } finally {
    botao.disabled = false;
  }
}
formLink.addEventListener('submit', (e) => {
  e.preventDefault();
  const url = $<HTMLInputElement>('link').value.trim();
  if (url) buscarLink(/^https?:\/\//.test(url) ? url : `https://${url}`);
});

function receberArquivos(lista: FileList | File[]) {
  const videos = [...lista];
  if (!videos.length) return;
  estado.origem = '';
  novaFila(videos);
  carregarPrincipal(videos[0]).then((ok) => { if (!ok) marcarFila(0, 'erro'); });
}

// ---------------------------------------------------------------- fila em grade: muitos vídeos de uma vez
function novaFila(videos: File[]) {
  estado.filaItens.forEach((it) => { if (it.capa) URL.revokeObjectURL(it.capa); });
  estado.fila = videos;
  estado.filaItens = videos.map(() => ({ situacao: 'pendente', ajustes: null, capa: null }));
  estado.filaIndice = 0;
  estado.filaFiltro = 'todos';
  cartoesFila.length = 0;
  if (videos.length > 1) gerarCapas(videos);
}

function marcarFila(i: number, situacao: ItemFila['situacao']) {
  const it = estado.filaItens[i];
  if (it) { it.situacao = situacao; atualizarFila(); }
}

/** guarda o que a pessoa mexeu no vídeo aberto, para não perder ao pular para outro */
function guardarAjustes() {
  const it = estado.filaItens[estado.filaIndice];
  if (!it || !estado.principal) return;
  it.ajustes = { gancho: campoGancho.value, ganchoMexido: estado.ganchoMexido, fonte: campoFonte.value, origem: estado.origem, ini: estado.ini, fim: estado.fim };
}

/** abre o vídeo i da fila, com os ajustes que ele já tinha */
async function abrirDaFila(i: number): Promise<boolean> {
  if (i < 0 || i >= estado.fila.length) return false;
  guardarAjustes();
  estado.filaIndice = i;
  const it = estado.filaItens[i];
  atualizarFila();
  if (!(await carregarPrincipal(estado.fila[i], true))) { marcarFila(i, 'erro'); return false; }
  if (it.situacao === 'erro') it.situacao = 'pendente';
  const a = it.ajustes;
  if (a && estado.principal) {
    estado.ini = Math.min(a.ini, estado.principal.dur);
    estado.fim = Math.min(a.fim, estado.principal.dur);
    estado.ganchoMexido = a.ganchoMexido;
    campoGancho.value = a.gancho;
    campoFonte.value = a.fonte;
    estado.origem = a.origem;
    infoTrecho();
    video.currentTime = estado.ini;
    pedirLegenda().catch(() => {});
    montarIdeias();
    redesenhar();
  }
  atualizarFila();
  return true;
}

/** o próximo vídeo ainda por fazer depois de `depois`, dando a volta na fila; -1 se não há */
function proximoPendente(depois: number): number {
  const n = estado.fila.length;
  for (let k = 1; k <= n; k++) {
    const i = (depois + k) % n;
    if (estado.filaItens[i].situacao === 'pendente') return i;
  }
  return -1;
}

/** um quadro de cada vídeo, um de cada vez e com um <video> à parte: só para reconhecer o vídeo na grade */
async function gerarCapas(fila: File[]) {
  const v = document.createElement('video');
  v.muted = true;
  v.preload = 'auto';
  const c = document.createElement('canvas');
  c.width = 108; c.height = 192;
  const ctx = c.getContext('2d')!;
  for (let i = 0; i < fila.length; i++) {
    if (estado.fila !== fila) break; // chegou outra fila
    const url = URL.createObjectURL(fila[i]);
    try {
      v.src = url;
      await new Promise<void>((ok, falha) => {
        v.onloadedmetadata = () => { v.currentTime = Math.min(1.5, (v.duration || 0) / 2); };
        v.onseeked = () => ok();
        v.onerror = () => falha(new Error('formato'));
        setTimeout(() => falha(new Error('demorou')), 8000);
      });
      // cobre o quadro 9:16, como a prévia
      const e = Math.max(c.width / v.videoWidth, c.height / v.videoHeight);
      const w = v.videoWidth * e, h = v.videoHeight * e;
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.drawImage(v, (c.width - w) / 2, (c.height - h) / 2, w, h);
      const capa = await new Promise<Blob | null>((ok) => c.toBlob(ok, 'image/jpeg', 0.7));
      if (capa && estado.fila === fila) {
        const it = estado.filaItens[i];
        it.capa = URL.createObjectURL(capa);
        const img = cartoesFila[i]?.querySelector('img');
        if (img) { img.src = it.capa; img.hidden = false; }
      }
    } catch { /* fica só o número (formato que só a conversão lê) */ }
    finally { URL.revokeObjectURL(url); }
  }
  v.removeAttribute('src');
}

const cartoesFila: HTMLLIElement[] = [];
function cartaoFila(i: number): HTMLLIElement {
  const li = document.createElement('li');
  const abrir = Object.assign(document.createElement('button'), { type: 'button', className: 'fila-abrir' });
  const quadro = Object.assign(document.createElement('span'), { className: 'fila-quadro' });
  const img = Object.assign(document.createElement('img'), { alt: '', hidden: !estado.filaItens[i]?.capa });
  if (estado.filaItens[i]?.capa) img.src = estado.filaItens[i].capa!;
  quadro.append(img, Object.assign(document.createElement('b'), { className: 'fila-numero', textContent: String(i + 1) }),
    Object.assign(document.createElement('span'), { className: 'fila-selo' }));
  abrir.append(quadro, Object.assign(document.createElement('small'), { className: 'fila-nome' }));
  abrir.addEventListener('click', () => {
    if (estado.lote || i === estado.filaIndice) return;
    abrirDaFila(i).then(() => irPara('gancho'));
  });
  const fora = Object.assign(document.createElement('button'), { type: 'button', className: 'fila-fora' });
  fora.addEventListener('click', () => {
    const it = estado.filaItens[i];
    it.situacao = it.situacao === 'fora' ? 'pendente' : 'fora';
    atualizarFila();
  });
  li.append(abrir, fora);
  return li;
}

const NOME_SITUACAO = { pendente: 'pendente', pronto: 'pronto', erro: 'não abriu', fora: 'fora do lote' } as const;
function atualizarFila() {
  const f = estado.fila, itens = estado.filaItens;
  $('fila').hidden = f.length < 2;
  if (f.length < 2) {
    $<HTMLButtonElement>('proximo-fila').hidden = true;
    $<HTMLButtonElement>('prensar-fila').hidden = true;
    return;
  }
  while (cartoesFila.length < f.length) cartoesFila.push(cartaoFila(cartoesFila.length));
  const conta = (s: ItemFila['situacao']) => itens.filter((it) => it.situacao === s).length;
  const pendentes = conta('pendente');
  $('fila-contagem').textContent = `${conta('pronto')} de ${f.length} prontos` + (conta('erro') ? ` · ${conta('erro')} não abriram` : '');
  cartoesFila.forEach((li, i) => {
    const it = itens[i];
    li.className = `situacao-${it.situacao}` + (i === estado.filaIndice ? ' atual' : '');
    const nome = it.ajustes?.gancho || f[i].name.replace(/\.[^.]+$/, '');
    li.querySelector('.fila-nome')!.textContent = nome;
    const abrir = li.querySelector<HTMLButtonElement>('.fila-abrir')!;
    abrir.title = `${i + 1}. ${nome} (${NOME_SITUACAO[it.situacao]})`;
    abrir.setAttribute('aria-current', String(i === estado.filaIndice));
    abrir.disabled = estado.lote;
    const fora = li.querySelector<HTMLButtonElement>('.fila-fora')!;
    fora.textContent = it.situacao === 'fora' ? '↺' : '⨯';
    fora.setAttribute('aria-label', it.situacao === 'fora' ? `Pôr o vídeo ${i + 1} de volta no lote` : `Tirar o vídeo ${i + 1} do lote`);
    fora.hidden = it.situacao === 'pronto' || estado.lote;
  });
  const grade = $('fila-grade');
  grade.replaceChildren(...cartoesFila.filter((_, i) => estado.filaFiltro === 'todos' || itens[i].situacao === estado.filaFiltro || i === estado.filaIndice));
  grade.querySelector('.atual')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  sincFiltrosFila();
  $<HTMLButtonElement>('fila-anterior').disabled = estado.lote || estado.filaIndice === 0;
  const prox = proximoPendente(estado.filaIndice);
  $<HTMLButtonElement>('fila-proximo').disabled = estado.lote || prox < 0;
  const b = $<HTMLButtonElement>('fila-prensar');
  b.textContent = estado.lote ? 'Parar depois deste' : `Prensar os pendentes (${pendentes})`;
  b.disabled = !estado.lote && !pendentes;
  // os mesmos atalhos na bandeja, depois de prensar
  $<HTMLButtonElement>('proximo-fila').hidden = prox < 0 || estado.lote;
  $<HTMLButtonElement>('prensar-fila').hidden = !pendentes || estado.lote;
  if (pendentes) $('prensar-fila').textContent = `Prensar os pendentes (${pendentes}) com estas escolhas`;
}

const sincFiltrosFila = fichas($('fila-filtros'),
  [{ id: 'todos' as FiltroFila, nome: 'Todos' }, { id: 'pendente' as FiltroFila, nome: 'Pendentes' }, { id: 'pronto' as FiltroFila, nome: 'Prontos' }],
  (id) => estado.filaFiltro === id, (id) => { estado.filaFiltro = id; atualizarFila(); });

$('fila-anterior').addEventListener('click', () => abrirDaFila(estado.filaIndice - 1).then(() => irPara('gancho')));
async function irProximoPendente() {
  const i = proximoPendente(estado.filaIndice);
  if (i < 0) return;
  await abrirDaFila(i);
  irPara('gancho');
  $('trilha-passos').scrollIntoView({ behavior: 'smooth', block: 'start' });
}
$('fila-proximo').addEventListener('click', irProximoPendente);

/** em lote: os pendentes com as escolhas atuais (receita, som, redes); o gancho de cada um é o ajustado ou o da fala */
async function prensarPendentes() {
  if (estado.lote) { estado.loteParado = true; atualizarFila(); return; }
  estado.lote = true;
  estado.loteParado = false;
  $<HTMLButtonElement>('prensar').disabled = true;
  atualizarFila();
  try {
    // começa pelo que está aberto, se ele ainda não saiu
    let i = estado.filaItens[estado.filaIndice]?.situacao === 'pendente' ? estado.filaIndice : proximoPendente(estado.filaIndice);
    while (i >= 0 && !estado.loteParado) {
      const prontos = estado.filaItens.filter((it) => it.situacao === 'pronto').length;
      const total = prontos + estado.filaItens.filter((it) => it.situacao === 'pendente').length;
      andamento(`Vídeo ${i + 1} (${prontos + 1} de ${total}): abrindo`);
      if (i !== estado.filaIndice || !estado.principal) {
        if (!(await abrirDaFila(i))) { i = proximoPendente(i); continue; }
      }
      if (campoLegenda.checked && temSom(estado.principal)) { await pedirLegenda().catch(() => []); montarIdeias(); }
      if (!(await prensarAtual())) {
        if (estado.loteParado) break;
        marcarFila(i, 'erro');
      }
      i = proximoPendente(i);
    }
  } finally {
    estado.lote = false;
    $<HTMLButtonElement>('prensar').disabled = false;
    atualizarFila();
  }
}
$('fila-prensar').addEventListener('click', prensarPendentes);

let vezArquivo = 0;
/** abre o vídeo; se o navegador não lê o formato, converte em segundo plano enquanto a pessoa já compõe */
async function carregarPrincipal(arquivo: File, manterPasso = false): Promise<boolean> {
  erro('');
  if (!verificarRequisitos()) { mostrar('inicio'); return false; }
  const vez = ++vezArquivo; // se a pessoa escolher outro vídeo no meio da conversão, a antiga é descartada
  try {
    usarPrincipal(await abrir(arquivo), manterPasso);
    return true;
  } catch (e) {
    if (!(e instanceof FormatoNaoLido)) { convertendo(`Não deu para abrir: ${(e as Error).message}`, 0); return false; }
    estado.principal = null;
    video.removeAttribute('src');
    estado.convertendo = { texto: 'Preparando o conversor', vez };
    $('convertendo').hidden = true;
    $('faixa-conversao-motivo').textContent = e.message;
    $('faixa-conversao').hidden = false;
    prontoParaPrensar(false);
    mostrar('criar');
    if (!manterPasso) irPara('receita');
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
      if (vez !== vezArquivo) return false;
      usarPrincipal(await abrir(convertido), true);
      return true;
    } catch (e2) {
      if (vez !== vezArquivo) return false;
      estado.convertendo = null;
      $('faixa-conversao').hidden = true;
      erro(`Não consegui abrir esse vídeo (${(e2 as Error).message}). Tente outro, ou exporte de novo em MP4.`);
      redesenhar();
      return false;
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

function usarPrincipal(m: Midia, manterPasso = false) {
  estado.convertendo = null;
  $('convertendo').hidden = true;
  $('faixa-conversao').hidden = true;
  prontoParaPrensar(true);
  estado.principal = m;
  $('som-fala').hidden = !temSom(m);
  video.src = URL.createObjectURL(m.arquivo);
  video.volume = Math.min(1, estado.som.volumeFala);
  estado.ini = 0;
  estado.fim = Math.min(m.dur, 60);
  estado.ganchoMexido = false;
  campoGancho.value = '';
  infoTrecho();
  atualizarFila();
  mostrar('criar');
  aplicarReceita(estado.receita);
  if (!manterPasso) irPara(estado.saidas.length ? 'gancho' : 'receita');
  video.addEventListener('loadeddata', () => { video.currentTime = Math.min(1.5, m.dur / 2); }, { once: true });
  pedirLegenda().catch(() => {});
}

$<HTMLInputElement>('arquivo').addEventListener('change', (e) => {
  const lista = (e.target as HTMLInputElement).files;
  if (lista?.length) receberArquivos(lista);
});
const soltar = $('soltar');
soltar.addEventListener('dragover', (e) => { e.preventDefault(); soltar.classList.add('sobre'); });
soltar.addEventListener('dragleave', () => soltar.classList.remove('sobre'));
soltar.addEventListener('drop', (e) => {
  e.preventDefault();
  soltar.classList.remove('sobre');
  if (e.dataTransfer?.files.length) receberArquivos(e.dataTransfer.files);
});
$('trocar').addEventListener('click', () => { $<HTMLInputElement>('arquivo').value = ''; $<HTMLInputElement>('arquivo').click(); });

function infoTrecho() {
  const d = estado.fim - estado.ini;
  $('trecho-info').textContent = `Trecho: ${fmt(estado.ini)} → ${fmt(estado.fim)} (${Math.round(d)} s de ${Math.round(estado.principal?.dur ?? 0)} s). Dê play e marque o início e o fim.`;
}
$('marca-ini').addEventListener('click', () => {
  estado.ini = Math.min(video.currentTime, estado.fim - 1);
  if (estado.fim - estado.ini > 180) estado.fim = estado.ini + 180;
  infoTrecho(); redesenhar(); pedirLegenda().catch(() => {}); montarResumo();
});
$('marca-fim').addEventListener('click', () => {
  estado.fim = Math.min(Math.max(video.currentTime, estado.ini + 1), estado.ini + 180); // 3 min: limite dos Shorts
  infoTrecho(); pedirLegenda().catch(() => {}); montarResumo();
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
    const texto = document.createElement('div');
    texto.className = 'receita-texto';
    const nome = document.createElement('strong');
    nome.textContent = r.nome;
    const ideal = document.createElement('small');
    ideal.textContent = r.ideal;
    texto.append(nome, ideal);
    b.append(c, texto);
    b.addEventListener('click', () => { aplicarReceita(r); irPara('gancho'); });
    return b;
  }));
}

/** troca de receita: o que vinha da receita anterior volta ao padrão; o que a pessoa escolheu de propósito fica */
function aplicarReceita(r: Receita) {
  const anterior = estado.receita;
  estado.receita = r;
  estado.estiloLegenda = null;
  if (estado.escolhaBaixo.tipo !== 'video') estado.escolhaBaixo = { tipo: 'receita' };
  // gancho que veio de um modelo da receita anterior não serve para a nova
  if (anterior !== r && (campoGancho.value.includes('___') || anterior.modelos.includes(campoGancho.value))) estado.ganchoMexido = false;
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
  const chips = [...daFala.map((t) => ({ t, fala: true, llm: false })), ...estado.receita.modelos.map((t) => ({ t, fala: false, llm: false }))];
  const containerIdeias = $('ideias');
  
  const renderChips = (lista: { t: string; fala: boolean; llm: boolean }[]) => {
    containerIdeias.replaceChildren(...lista.map(({ t, fala, llm }) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = llm ? 'ideia da-fala' : (fala ? 'ideia da-fala' : 'ideia');
      if (llm) b.style.borderColor = 'var(--cor-destaque, #f59e0b)';
      b.textContent = llm ? `⚡ ${t}` : t;
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
  };

  renderChips(chips);

  // Se tivermos texto falado, consulta o LLM local (Qwen na GPU) para hooks virais extras
  if (palavras && palavras.length > 3) {
    const textoCompleto = palavras.map((p) => p.texto).join(' ');
    gerarIdeiasVirais(textoCompleto, estado.receita.nome).then((ideias) => {
      if (!ideias || !ideias.ok) return;
      const extras: { t: string; fala: boolean; llm: boolean }[] = [];
      if (ideias.hook) extras.push({ t: ideias.hook, fala: true, llm: true });
      if (Array.isArray(ideias.titulos)) {
        for (const tit of ideias.titulos) {
          if (tit && !extras.some((x) => x.t === tit)) {
            extras.push({ t: tit, fala: true, llm: true });
          }
        }
      }
      if (extras.length > 0) {
        renderChips([...extras, ...chips]);
      }
    }).catch(() => {});
  }
}
campoGancho.addEventListener('input', () => { estado.ganchoMexido = true; redesenhar(); });

// ---------------------------------------------------------------- fichas (estilo de legenda, redes)
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

// ---------------------------------------------------------------- vídeo de baixo: tudo à vista, em faixas
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

function escolherBaixo(e: EscolhaBaixo) {
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
  // com o quadro na mão, o <video> sai: dezenas de vídeos vivos estouravam a memória do celular
  v.addEventListener('seeked', () => {
    const c = document.createElement('canvas');
    c.width = 135; c.height = 240;
    const k = Math.max(135 / v.videoWidth, 240 / v.videoHeight);
    c.getContext('2d')!.drawImage(v, (135 - v.videoWidth * k) / 2, (240 - v.videoHeight * k) / 2, v.videoWidth * k, v.videoHeight * k);
    v.replaceWith(c);
    v.removeAttribute('src');
    v.load();
  }, { once: true });
  if (url.startsWith('http')) v.crossOrigin = 'anonymous'; // a página é isolada (COEP): vídeo de outro domínio só em modo CORS
  v.preload = 'metadata';
  v.src = url;
}), { rootMargin: '200px' });

function cartaoClipe(c: ClipeAcervo): HTMLButtonElement {
  const sub = c.revisado ? `${c.credito} · ${c.licenca}` : `${c.credito} · não revisado`;
  const b = cartao(`clipe:${c.id}`, c.titulo, sub, async () => {
    b.classList.add('baixando');
    try {
      const blob = await baixarClipe(c);
      await usarBaixo(new File([blob], c.arquivo, { type: blob.type || 'video/mp4' }), c.credito, `clipe:${c.id}`);
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
    const b = cartao(`gerado:${g.id}`, g.nome, 'animação', () => escolherBaixo({ tipo: 'gerado', id: g.id }));
    const c = document.createElement('canvas');
    c.width = 135; c.height = 240;
    b.querySelector('.quadro')!.append(c);
    animacoes.push({ ctx: c.getContext('2d')!, desenhar: g.desenhar });
    return b;
  });
  const revisados = clipesAcervo.filter((c) => c.revisado).map(cartaoClipe);
  const outros = clipesAcervo.filter((c) => !c.revisado).map(cartaoClipe);
  const enviar = cartao('enviar', 'Enviar o seu', 'do seu aparelho', () => $<HTMLInputElement>('arquivo-baixo').click(), 'enviar');
  enviar.querySelector('.quadro')!.textContent = '+';
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
    faixa('Animações e o seu', [nenhum, enviar, ...geradas]),
    ...(revisados.length ? [faixa(`Acervo (${revisados.length})`, revisados)] : []),
    ...(outros.length ? [faixa(`Não revisados (${outros.length})`, outros)] : []),
  );
  sincGaleria();
}

/** as animações da galeria tocam de verdade, enquanto a etapa está na tela */
function animarGaleria(agora: number) {
  if (!$('tela-criar').hidden && estado.passo === 'baixo') {
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
  try { clipesAcervo = (await carregarManifesto()).filter((c) => c.revisado); } catch { clipesAcervo = []; }
  montarGaleria();
  try { musicasAcervo = await carregarMusicas(); } catch { musicasAcervo = []; }
  listarMusicas();
  montarMusicas();
}

// ---------------------------------------------------------------- som: fala, música, ducking
let musicasAcervo: MusicaAcervo[] = [];
const MUSICAS: { id: string; nome: string; clima: string }[] = [];
function listarMusicas() {
  MUSICAS.splice(0, MUSICAS.length,
    { id: 'nenhuma', nome: 'Sem música', clima: 'só o som do vídeo' },
    ...musicasAcervo.map((m) => ({ id: `acervo:${m.id}`, nome: m.titulo, clima: m.clima ?? m.credito })),
    ...TRILHAS.map((t) => ({ id: t.id, nome: t.nome, clima: `gerada · ${t.clima}` })),
    { id: 'arquivo', nome: 'Sua música', clima: 'do seu aparelho' });
}
listarMusicas();
// régua de 0 a 100 → -20 a +4 dB em relação à fala; 65 ≈ -4 dB (a música abaixa 8 dB quando alguém fala)
const volumeMusicaDb = () => -20 + 24 * (estado.som.volumeMusica / 100);
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
  const v = s.volumeMusica;
  $('volume-musica-valor').textContent = v < 30 ? 'baixa' : v < 70 ? 'média' : 'alta';
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
    const daAcervo = musicasAcervo.find((m) => `acervo:${m.id}` === s.musica);
    const decodificar = (b: ArrayBuffer) => new OfflineAudioContext(2, 48000, 48000).decodeAudioData(b);
    const p = s.musica === 'arquivo' ? s.arquivoMusica!.arrayBuffer().then(decodificar)
      : daAcervo ? baixarMusica(daAcervo).then(decodificar)
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
// efeito na entrada do gancho: toca na hora em que é escolhido
const efeitosProntos = new Map<string, Promise<AudioBuffer>>();
const efeitoBuffer = (id: string) => { if (!efeitosProntos.has(id)) efeitosProntos.set(id, gerarEfeito(id, 48000)); return efeitosProntos.get(id)!; };
fichas($('efeitos'), [{ id: 'nenhum', nome: 'Nenhum' }, ...EFEITOS], (id) => estado.som.efeito === id, async (id) => {
  estado.som.efeito = id;
  if (id === 'nenhum') return;
  acordarAudio();
  const b = await efeitoBuffer(id);
  if (!ctxAudio) return;
  const s = ctxAudio.createBufferSource();
  const g = ctxAudio.createGain();
  g.gain.value = 0.7;
  s.buffer = b;
  s.connect(g).connect(ctxAudio.destination);
  s.start();
});

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
  let g = dbLin(volumeMusicaDb()) * 2 * Math.max(0.2, s.volumeFala);
  if (s.abaixar && temSom(estado.principal)) {
    const palavras = estado.falas.get(chaveTrecho());
    if (palavras?.some((w) => t >= w.inicio - 0.1 && t <= w.fim + 0.25)) g *= dbLin(-8);
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
/** exemplo = true só nas miniaturas: mostra um gancho de exemplo, para cada receita se distinguir */
function quadroPara(r: Receita, legenda: Bloco[] | null, exemplo = false): Quadro {
  const escrito = campoGancho.value.includes('___') ? '' : campoGancho.value;
  return {
    layout: usaDividida(r) ? 'dividida' : 'cheio',
    gancho: { estilo: r.gancho, texto: exemplo ? EXEMPLO_GANCHO[r.gancho] ?? escrito : escrito },
    fonte: campoFonte.value.trim(),
    creditoBaixo: usaVideoDeBaixo() ? campoCredito.value.trim() : '',
    legenda,
    estiloLegenda: estiloLegendaDe(r),
    gerador: geradorDe(r),
  };
}

let blocosCache: { chave: string; blocos: Bloco[] | null } = { chave: '', blocos: null };
function blocosDoTrecho(): Bloco[] | null {
  const chave = `${chaveTrecho()}|${campoLegenda.checked}|${estado.falas.has(chaveTrecho())}|${estado.versaoFala}`;
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
    const t = 1.6; // o carimbo do gancho já assentou e a legenda costuma estar na tela
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
campoLegenda.addEventListener('change', () => { redesenhar(); pedirLegenda().catch(() => {}); montarEditorLegenda(); });

// ---------------------------------------------------------------- legenda: em segundo plano, e editável
function estadoLegenda(t: string) {
  $('legenda-estado').textContent = t;
  $('legenda-estado-2').textContent = t.replace(/^Ideias tiradas da própria fala:$/, '');
}

function avisoLegenda(texto: string, fracao?: number) {
  estadoLegenda(`Ouvindo a fala… ${fracao === undefined ? '' : `${Math.round(fracao * 100)}%`}`);
  if (estado.esperandoLegenda) andamento(texto, fracao);
}

function pedirLegenda(): Promise<Palavra[]> {
  const m = estado.principal;
  if (!temSom(m) || !campoLegenda.checked) {
    estadoLegenda(m && !temSom(m) ? 'Esse vídeo não tem som: sai sem legenda.' : '');
    return Promise.resolve([]);
  }
  const k = chaveTrecho();
  const pronta = estado.falas.get(k);
  if (pronta) { estadoLegenda('Ideias tiradas da própria fala:'); return Promise.resolve(pronta); }
  const andando = estado.ouvindo.get(k);
  if (andando) return andando;
  const { ini, fim } = estado;
  const p = (async () => {
    avisoLegenda('Separando o áudio');
    const audio = await audioParaFala(m!, ini, fim);
    const palavras = audio ? await transcrever(audio, avisoLegenda, () => k === chaveTrecho()) : [];
    estado.falas.set(k, palavras);
    if (k === chaveTrecho()) {
      estadoLegenda('Ideias tiradas da própria fala:');
      montarIdeias();
      redesenhar();
      if (estado.passo === 'legenda') montarEditorLegenda();
    }
    return palavras;
  })().finally(() => estado.ouvindo.delete(k));
  estado.ouvindo.set(k, p);
  return p;
}

/** cada bloco da legenda vira um campo: a pessoa corrige o texto e o tempo se redistribui dentro do bloco */
function montarEditorLegenda() {
  const blocos = blocosDoTrecho();
  const caixa = $('editor-legenda');
  caixa.hidden = !blocos?.length;
  if (!blocos?.length) return;
  $('blocos-legenda').replaceChildren(...blocos.map((b) => {
    const li = document.createElement('li');
    const tempo = document.createElement('button');
    tempo.type = 'button';
    tempo.className = 'tempo-bloco';
    tempo.textContent = fmt(b.ini);
    tempo.title = 'Ouvir este trecho';
    tempo.addEventListener('click', () => {
      acordarAudio();
      video.currentTime = estado.ini + b.ini;
      video.play();
      setTimeout(() => video.pause(), Math.max(600, (b.fim - b.ini) * 1000));
    });
    const campo = document.createElement('input');
    campo.type = 'text';
    campo.value = b.palavras.map((w) => w.texto).join(' ');
    campo.addEventListener('change', () => corrigirBloco(b, campo.value));
    li.append(tempo, campo);
    return li;
  }));
}

function corrigirBloco(b: Bloco, texto: string) {
  const palavras = estado.falas.get(chaveTrecho());
  if (!palavras) return;
  const i = palavras.indexOf(b.palavras[0]);
  const j = palavras.indexOf(b.palavras[b.palavras.length - 1]);
  if (i < 0 || j < 0) return;
  const novas = texto.trim().split(/\s+/).filter(Boolean);
  const ini = b.palavras[0].inicio, fim = b.palavras[b.palavras.length - 1].fim;
  const total = novas.reduce((a, w) => a + w.length + 1, 0) || 1;
  let t = ini;
  const comTempo = novas.map((w) => { const d = ((w.length + 1) / total) * (fim - ini); const p = { texto: w, inicio: t, fim: t + d }; t += d; return p; });
  palavras.splice(i, j - i + 1, ...comTempo);
  estado.versaoFala++;
  redesenhar();
  montarEditorLegenda();
}

// ---------------------------------------------------------------- prensar (um vídeo, a fila inteira)
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

function textoPost(): string {
  const g = campoGancho.value.trim();
  const prefixo: Record<string, string> = { 'voce-sabia': 'Você sabia? ', pov: 'POV: ' };
  const linhas = [];
  if (g && !g.includes('___')) linhas.push((prefixo[estado.receita.gancho] ?? '') + g);
  if (campoFonte.value.trim()) linhas.push(`Fonte: ${campoFonte.value.trim()}`);
  if (usaVideoDeBaixo() && campoCredito.value.trim()) linhas.push(`Vídeo de baixo: ${campoCredito.value.trim()}`);
  if (estado.origem) linhas.push(`Original: ${estado.origem}`);
  const musica = musicasAcervo.find((m) => `acervo:${m.id}` === estado.som.musica);
  if (musica) linhas.push(`Música: ${musica.credito}`);
  linhas.push('\nFeito na Prensa (software livre) · Contato: @arthurnoyes (https://x.com/arthurnoyes)');
  return linhas.join('\n');
}

/** os vídeos prontos vão para o disco do navegador (OPFS), quando ele deixa: assim a bandeja não ocupa a memória */
async function paraODisco(arquivos: Arquivo[]) {
  try {
    const pasta = await navigator.storage.getDirectory();
    const feitos = new Map<Blob, Blob>();
    for (const a of arquivos) {
      if (!feitos.has(a.blob)) {
        const h = await pasta.getFileHandle(`${Date.now()}-${a.nome}`, { create: true });
        const w = await h.createWritable();
        await w.write(a.blob);
        await w.close();
        feitos.set(a.blob, await h.getFile());
      }
      a.blob = feitos.get(a.blob)!;
    }
  } catch { /* sem OPFS gravável (iPhone antigo): fica na memória */ }
}

/** prensa o vídeo atual com as escolhas atuais e põe o resultado na bandeja */
async function prensarAtual(): Promise<boolean> {
  const m = estado.principal;
  if (!m) return false;
  erro('');
  video.pause();
  estado.cancelar = new AbortController();
  const plats = PLATAFORMAS.filter((p) => estado.plataformas.has(p.id));
  $('prelo-folhas').replaceChildren(...plats.map((p) => Object.assign(document.createElement('span'), { textContent: p.nome.replace('Status do ', '') })));
  const t0 = performance.now();
  try {
    let blocos: Bloco[] | null = null;
    let srt = '';
    if (campoLegenda.checked && temSom(m)) {
      estado.esperandoLegenda = true;
      andamento('Terminando de ouvir a fala');
      await pedirLegenda().finally(() => { estado.esperandoLegenda = false; });
      blocos = blocosDoTrecho();
      srt = blocos ? gerarSrt(blocos) : '';
    }
    const q = quadroPara(estado.receita, blocos);
    const pMusica = bufferDaMusica();
    if (pMusica) andamento('Preparando a música');
    const som: OpcoesDeSom = {
      limpar: campoSom.checked, volumeFala: estado.som.volumeFala, musica: pMusica ? await pMusica : null,
      volumeMusicaDb: volumeMusicaDb(), abaixar: estado.som.abaixar, suave: estado.som.suave,
      // o efeito acompanha o carimbo do gancho (só quando há gancho)
      efeitos: estado.som.efeito !== 'nenhum' && q.gancho.texto.trim() && q.gancho.estilo !== 'nenhum'
        ? [{ buffer: await efeitoBuffer(estado.som.efeito), em: 0, db: -3 }] : [],
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
    await paraODisco(arquivos);
    estado.saidas.unshift({ titulo: campoGancho.value.trim() || m.arquivo.name, arquivos, mestre: arquivos[0]?.blob ?? mestre, post: textoPost(), srt, segundos: (performance.now() - t0) / 1000 });
    guardarAjustes();
    if (estado.filaItens[estado.filaIndice]) estado.filaItens[estado.filaIndice].situacao = 'pronto';
    montarBandeja();
    if (studioLigado()) paraOStudio(estado.saidas[0]);
    return true;
  } catch (e) {
    if ((e as Error).name !== 'AbortError') {
      console.error(e);
      erro(`Não deu certo: ${(e as Error).message}`);
    }
    return false;
  } finally {
    $('andamento').hidden = true;
    estado.cancelar = null;
  }
}

$('prensar').addEventListener('click', async () => {
  const b = $<HTMLButtonElement>('prensar');
  b.disabled = true;
  const ok = await prensarAtual();
  b.disabled = false;
  if (ok) $('bandeja').scrollIntoView({ behavior: 'smooth', block: 'start' });
});
$('cancelar').addEventListener('click', () => { estado.loteParado = estado.lote; estado.cancelar?.abort(); });

// ---------------------------------------------------------------- modal publicar no youtube shorts
const dlgYt = $<HTMLDialogElement>('dialog-yt');
const campoYtTitulo = $<HTMLInputElement>('yt-titulo');
const campoYtDesc = $<HTMLTextAreaElement>('yt-desc');
const campoYtPrivacidade = $<HTMLSelectElement>('yt-privacidade');
const msgYt = $<HTMLDivElement>('yt-status-msg');
const btnYtEnviar = $<HTMLButtonElement>('yt-enviar');
const btnYtCancelar = $<HTMLButtonElement>('yt-cancelar');
const btnYtFechar = $<HTMLButtonElement>('dialog-yt-fechar');

let blobParaEnviar: Blob | null = null;
let botaoOrigemPublicacao: HTMLButtonElement | null = null;

function fecharModalYt() {
  dlgYt.close();
  blobParaEnviar = null;
  botaoOrigemPublicacao = null;
}

btnYtFechar.addEventListener('click', fecharModalYt);
btnYtCancelar.addEventListener('click', fecharModalYt);
dlgYt.addEventListener('click', (e) => {
  if (e.target === dlgYt) fecharModalYt();
});

async function abrirModalPublicar(blob: Blob, titulo: string, post: string, btn: HTMLButtonElement) {
  blobParaEnviar = blob;
  botaoOrigemPublicacao = btn;
  campoYtTitulo.value = titulo || 'Vídeo da Prensa';
  campoYtDesc.value = post || '';
  campoYtPrivacidade.value = 'private';
  msgYt.hidden = true;
  msgYt.className = 'yt-status-msg';
  msgYt.textContent = '';
  btnYtEnviar.disabled = false;
  btnYtEnviar.textContent = 'Publicar agora';

  dlgYt.showModal();

  checarStatusYouTube().then((st) => {
    if (!st.pronto && !st.tem_secret) {
      msgYt.hidden = false;
      msgYt.className = 'yt-status-msg aviso';
      msgYt.textContent = 'Aviso: client_secret.json não foi encontrado. Para publicar pelo bot, baixe o arquivo OAuth do Google Cloud Console e coloque na pasta do projeto ou backend.';
    }
  }).catch(() => {});
}

btnYtEnviar.addEventListener('click', async () => {
  if (!blobParaEnviar) return;
  btnYtEnviar.disabled = true;
  btnYtEnviar.textContent = 'Enviando...';
  msgYt.hidden = false;
  msgYt.className = 'yt-status-msg';
  msgYt.textContent = 'Iniciando upload para o YouTube Shorts...';

  try {
    const res = await publicarParaYouTube(
      blobParaEnviar,
      campoYtTitulo.value.trim() || 'Vídeo da Prensa',
      campoYtDesc.value.trim(),
      campoYtPrivacidade.value as 'private' | 'unlisted' | 'public',
      (texto) => { msgYt.textContent = texto; }
    );

    msgYt.className = 'yt-status-msg sucesso';
    msgYt.innerHTML = `<strong>Shorts publicado com sucesso!</strong><br><a href="${res.url}" target="_blank" rel="noopener" style="color: #15803d; font-weight: bold; text-decoration: underline;">Abrir vídeo: ${res.url} ↗</a>`;
    btnYtEnviar.textContent = 'Concluído ✓';
    if (botaoOrigemPublicacao) {
      botaoOrigemPublicacao.textContent = 'Publicado no YouTube ✓';
      botaoOrigemPublicacao.classList.add('sucesso');
    }
  } catch (e) {
    btnYtEnviar.disabled = false;
    btnYtEnviar.textContent = 'Tentar novamente';
    msgYt.className = 'yt-status-msg erro';
    msgYt.textContent = `Erro ao publicar: ${(e as Error).message}`;
  }
});

/** a bandeja de saída: tudo o que já foi prensado nesta sessão, com compartilhar e baixar; a mesa continua aberta */
// ---------------------------------------------------------------- M20 Studio: cada vídeo pronto entra na biblioteca dele
const chaveStudio = $<HTMLInputElement>('mandar-studio');
const estadoStudio = $('studio-estado');
async function conferirStudio() {
  if (!chaveStudio.checked) { estadoStudio.textContent = ''; return; }
  estadoStudio.textContent = 'procurando o Studio…';
  const nome = await procurarStudio();
  estadoStudio.textContent = nome ? `ligado a ${nome}` : 'Studio não encontrado: abra o M20 Studio neste computador';
}
chaveStudio.checked = studioLigado();
chaveStudio.addEventListener('change', () => { lembrarStudio(chaveStudio.checked); conferirStudio(); });
async function paraOStudio(saida: (typeof estado.saidas)[number]) {
  estadoStudio.textContent = 'mandando para o Studio…';
  try {
    await enviarAoStudio({ video: saida.mestre, titulo: saida.titulo, texto: saida.post, srt: saida.srt, origem: estado.origem, rede: saida.arquivos[0]?.plataforma ?? '' });
    estadoStudio.textContent = `“${saida.titulo}” está na biblioteca do Studio`;
  } catch (e) {
    estadoStudio.textContent = `não chegou ao Studio (${(e as Error).message}). Ele está aberto?`;
  }
}

function montarBandeja() {
  if (chaveStudio.checked && !estadoStudio.textContent) conferirStudio();
  estado.urls.forEach((u) => URL.revokeObjectURL(u));
  estado.urls = [];
  const s = estado.saidas;
  $('bandeja').hidden = !s.length;
  $('passe-adiante').hidden = !s.length;
  $('bandeja-contador').textContent = `${s.length} ${s.length === 1 ? 'vídeo' : 'vídeos'}`;
  $('saidas').replaceChildren(...s.map((saida, k) => {
    const li = document.createElement('li');
    li.className = 'saida';
    li.style.setProperty('--k', String(k));
    const v = document.createElement('video');
    v.muted = true; v.loop = true; v.playsInline = true;
    const u = URL.createObjectURL(saida.mestre);
    estado.urls.push(u);
    v.src = u;
    v.addEventListener('mouseenter', () => v.play().catch(() => {}));
    v.addEventListener('mouseleave', () => v.pause());
    v.addEventListener('click', () => (v.paused ? v.play() : v.pause()));
    const corpo = document.createElement('div');
    corpo.className = 'saida-corpo';
    const t = document.createElement('strong');
    t.textContent = saida.titulo;
    const sub = document.createElement('small');
    sub.textContent = `pronto em ${Math.round(saida.segundos)} s`;
    const botoes = document.createElement('div');
    botoes.className = 'saida-botoes';
    for (const a of saida.arquivos) {
      const arquivo = new File([a.blob], a.nome, { type: 'video/mp4' });
      const url = URL.createObjectURL(a.blob);
      estado.urls.push(url);
      const grupo = document.createElement('span');
      grupo.className = 'rede';
      if (a.aviso) grupo.title = a.aviso;
      grupo.append(Object.assign(document.createElement('b'), { textContent: `${a.plataforma} · ${(a.blob.size / 1e6).toFixed(0)} MB` }));
      if (navigator.canShare?.({ files: [arquivo] })) {
        const comp = Object.assign(document.createElement('button'), { type: 'button', className: 'compartilhar', textContent: 'Compartilhar' });
        comp.addEventListener('click', () => navigator.share({
          title: saida.titulo ? `${saida.titulo} · Prensa` : 'Vídeo pronto na Prensa',
          text: saida.post,
          files: [arquivo],
        }).catch(() => {}));
        grupo.append(comp);
      }
      grupo.append(Object.assign(document.createElement('a'), { href: url, download: a.nome, className: 'baixar', textContent: 'Baixar' }));
      if (a.plataforma.toLowerCase().includes('shorts')) {
        const pub = Object.assign(document.createElement('button'), {
          type: 'button',
          className: 'publicar-yt',
          textContent: 'Publicar no YouTube',
        });
        pub.addEventListener('click', () => abrirModalPublicar(a.blob, saida.titulo, saida.post, pub));
        grupo.append(pub);
      }
      botoes.append(grupo);
    }
    const extras = document.createElement('div');
    extras.className = 'saida-extras';
    const copiar = Object.assign(document.createElement('button'), { type: 'button', textContent: 'Copiar texto do post' });
    copiar.addEventListener('click', () => { navigator.clipboard.writeText(saida.post); copiar.textContent = 'Copiado ✓'; });
    extras.append(copiar);
    if (saida.srt) {
      const srt = Object.assign(document.createElement('button'), { type: 'button', textContent: 'Legenda .srt' });
      srt.addEventListener('click', () => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([saida.srt], { type: 'text/plain' }));
        a.download = `${slug(saida.titulo)}.srt`;
        a.click();
      });
      extras.append(srt);
    }
    corpo.append(t, sub, botoes, extras);
    li.append(v, corpo);
    return li;
  }));
  const resto = (estado.principal?.dur ?? 0) - estado.fim;
  $<HTMLButtonElement>('outro-corte').hidden = resto < 3;
  atualizarFila();
}

$('outro-corte').addEventListener('click', () => {
  const m = estado.principal;
  if (!m) return;
  const dur = estado.fim - estado.ini;
  estado.ini = estado.fim;
  estado.fim = Math.min(m.dur, estado.ini + dur);
  estado.ganchoMexido = false;
  campoGancho.value = '';
  infoTrecho();
  video.currentTime = estado.ini;
  redesenhar();
  pedirLegenda().catch(() => {});
  irPara('gancho');
  montarBandeja();
  $('trilha-passos').scrollIntoView({ behavior: 'smooth', block: 'start' });
});

$('proximo-fila').addEventListener('click', irProximoPendente);
$('prensar-fila').addEventListener('click', prensarPendentes);

$('novo').addEventListener('click', () => { $<HTMLInputElement>('arquivo').value = ''; $<HTMLInputElement>('arquivo').click(); });

$('passar-adiante').addEventListener('click', async () => {
  const dados = { title: 'Prensa', text: 'Prensa: seu vídeo vira reels em 3 toques, no seu celular. Software livre, de graça, sem marca d’água.', url: location.origin + location.pathname };
  if (navigator.share) await navigator.share(dados).catch(() => {});
  else { await navigator.clipboard.writeText(`${dados.text} ${dados.url}`); $('passar-adiante').textContent = 'Link copiado ✓'; }
});

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

const dlgContato = $<HTMLDialogElement>('contato');
const abaAutor = $<HTMLButtonElement>('aba-autor');
const abaMangaio = $<HTMLButtonElement>('aba-mangaio');
const painelAutor = $<HTMLDivElement>('painel-autor');
const painelMangaio = $<HTMLDivElement>('painel-mangaio');

function alternarAbaContato(aba: 'autor' | 'mangaio') {
  const isAutor = aba === 'autor';
  abaAutor.classList.toggle('ativa', isAutor);
  abaAutor.setAttribute('aria-selected', String(isAutor));
  abaMangaio.classList.toggle('ativa', !isAutor);
  abaMangaio.setAttribute('aria-selected', String(!isAutor));
  painelAutor.hidden = !isAutor;
  painelMangaio.hidden = isAutor;
}

abaAutor?.addEventListener('click', () => alternarAbaContato('autor'));
abaMangaio?.addEventListener('click', () => alternarAbaContato('mangaio'));

$('abrir-contato').addEventListener('click', () => {
  alternarAbaContato('autor');
  dlgContato.showModal();
  dlgContato.scrollTop = 0;
  $('contato-titulo').focus();
});
$('contato-fechar').addEventListener('click', () => dlgContato.close());
dlgContato.addEventListener('click', (e) => {
  if (e.target === dlgContato) dlgContato.close();
});

// ---------------------------------------------------------------- início
(async () => {
  verificarRequisitos();
  // vídeos prontos de sessões anteriores não são mais usados: libera o disco
  navigator.storage?.getDirectory?.().then(async (pasta) => {
    for await (const nome of (pasta as unknown as { keys(): AsyncIterable<string> }).keys()) await pasta.removeEntry(nome).catch(() => {});
  }).catch(() => {});
  montarReceitas();
  montarMusicas();
  montarGaleria();
  irPara('receita');
  requestAnimationFrame(animarGaleria);
  await document.fonts.load(`84px "${FONTE}"`).catch(() => {});
  demo = criarDemo($<HTMLCanvasElement>('demo'));
  irPassoDemo(0);
  aplicarReceita(RECEITA_PADRAO);
  carregarAcervo();
  // link recebido pelo menu Compartilhar (Android) ou pela URL
  const linkRecebido = new URLSearchParams(location.search).get('link');
  if (linkRecebido && BAIXADOR) {
    history.replaceState(null, '', location.pathname);
    $<HTMLInputElement>('link').value = linkRecebido;
    buscarLink(linkRecebido);
  }
  // vídeo recebido pelo menu Compartilhar (Android)
  if (new URLSearchParams(location.search).has('recebido') && 'caches' in window) {
    const c = await caches.open('prensa-recebido');
    const r = await c.match('./recebido');
    if (r) {
      const nome = decodeURIComponent(r.headers.get('X-Nome') ?? 'video.mp4');
      receberArquivos([new File([await r.blob()], nome, { type: r.headers.get('Content-Type') ?? 'video/mp4' })]);
      await c.delete('./recebido');
    }
    history.replaceState(null, '', location.pathname);
  }
  if (import.meta.env.PROD && 'serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js');
})();

// para testes automatizados
Object.assign(window, { __prensa: { estado } });
