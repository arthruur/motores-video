import { baixarClipe, carregarManifesto } from './acervo';
import { desenharCompondo } from './compondo';
import { converter } from './conversor';
import { type Passo, criarDemo } from './demo';
import { A, L, type Fonte, type Quadro, desenharQuadro, faixaLegenda } from './formatos';
import { type Bloco, type EstiloLegenda, type Palavra, FONTE, gerarSrt, montarBlocos } from './legenda';
import { PLATAFORMAS } from './plataformas';
import { type Arquivo, FormatoNaoLido, type Midia, abrir, audioParaFala, exportar, prensar } from './prensa';
import { RECEITAS, type Receita, ganchosDaFala } from './receitas';
import { GERADORES } from './retencao';
import { transcrever } from './transcrever';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const estado = {
  principal: null as Midia | null,
  baixo: null as Midia | null,
  ini: 0,
  fim: 0,
  receita: RECEITAS[0],
  gerador: null as string | null,     // animação escolhida (sobrepõe a da receita)
  usarBaixoProprio: false,
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
const usaDividida = (r: Receita) => r.layout === 'dividida' || (r === estado.receita && estado.usarBaixoProprio);
const geradorDe = (r: Receita) => {
  if (!usaDividida(r) || (r === estado.receita && estado.usarBaixoProprio)) return null;
  return (r === estado.receita ? estado.gerador : null) ?? r.gerador ?? GERADORES[0].id;
};

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
  video.src = URL.createObjectURL(m.arquivo);
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
  estado.gerador = null;
  estado.estiloLegenda = null;
  if (r.layout !== 'dividida') estado.usarBaixoProprio = false;
  document.querySelectorAll<HTMLButtonElement>('.receita').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.id === r.id)));
  $('receita-dica').textContent = r.dica;
  sincRetencoes(); sincEstilos();
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
const sincRetencoes = fichas($('retencoes'), GERADORES.map((g) => ({ id: g.id, nome: g.nome })), (id) => geradorDe(estado.receita) === id, (id) => {
  estado.usarBaixoProprio = false;
  forcarDividida();
  estado.gerador = id;
  sincRetencoes();
  redesenhar();
});
const sincEstilos = fichas($('estilos-legenda'), [{ id: 'bloco' as EstiloLegenda, nome: 'Bloco (2 a 4 palavras)' }, { id: 'palavra' as EstiloLegenda, nome: 'Palavra por palavra' }], (id) => estiloLegendaDe(estado.receita) === id, (id) => {
  estado.estiloLegenda = id;
  redesenhar();
});
fichas($('plataformas'), PLATAFORMAS.map((p) => ({ id: p.id, nome: p.nome })), (id) => estado.plataformas.has(id), (id) => {
  if (estado.plataformas.has(id)) estado.plataformas.delete(id); else estado.plataformas.add(id);
  $<HTMLButtonElement>('prensar').disabled = estado.plataformas.size === 0;
}, true);

/** escolher um vídeo de baixo liga a tela dividida, mesmo numa receita de tela cheia */
function forcarDividida() {
  if (estado.receita.layout === 'dividida') return;
  const usarBaixoProprio = estado.usarBaixoProprio;
  escolherReceita(RECEITAS.find((r) => r.id === 'duplo')!);
  estado.usarBaixoProprio = usarBaixoProprio;
}

$<HTMLInputElement>('arquivo-baixo').addEventListener('change', async (e) => {
  const f = (e.target as HTMLInputElement).files?.[0];
  if (f) await usarBaixo(f, '');
});

async function usarBaixo(f: File, credito: string) {
  try {
    estado.baixo = await abrir(f);
    forcarDividida();
    estado.usarBaixoProprio = true;
    videoBaixo.src = URL.createObjectURL(f);
    // vídeo escondido só decodifica um quadro se for pedido: o seek força o 1º quadro para a prévia
    videoBaixo.addEventListener('loadedmetadata', () => { videoBaixo.currentTime = 0.05; }, { once: true });
    if (!video.paused) videoBaixo.play();
    campoCredito.value = credito;
    $('campo-credito').hidden = false;
    sincRetencoes();
    redesenhar();
  } catch (err) {
    erro((err as Error).message);
  }
}
videoBaixo.addEventListener('seeked', () => redesenhar());

// acervo de mídias livres: pasta local, cache offline ou o dataset no Hugging Face (src/acervo.ts)
async function carregarAcervo() {
  try {
    const clipes = await carregarManifesto();
    if (!clipes.length) return;
    const caixa = $('acervo');
    caixa.hidden = false;
    const botoes = clipes.map((c) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'clipe';
      b.innerHTML = '<span></span><small></small>';
      b.querySelector('span')!.textContent = c.titulo;
      // não revisado: ninguém confirmou a licença, então ela não vai para a tela como se fosse certa
      const licenca = c.revisado ? c.licenca : 'licença não confirmada';
      if (!c.revisado) b.classList.add('nao-revisado');
      const legenda = `${c.credito} · ${licenca}${c.share_alike ? ' · o reel herda a CC BY-SA' : ''}`;
      b.querySelector('small')!.textContent = legenda;
      b.addEventListener('click', async () => {
        b.disabled = true;
        try {
          const blob = await baixarClipe(c, (msg) => { b.querySelector('small')!.textContent = msg; });
          await usarBaixo(new File([blob], c.arquivo, { type: blob.type || 'video/mp4' }), `${c.credito} (${licenca})`);
        } catch (err) {
          erro((err as Error).message);
        } finally {
          b.querySelector('small')!.textContent = legenda;
          b.disabled = false;
        }
      });
      return b;
    });
    const revisados = botoes.filter((b) => !b.classList.contains('nao-revisado'));
    const outros = botoes.filter((b) => b.classList.contains('nao-revisado'));
    caixa.replaceChildren(...revisados);
    if (outros.length) {
      const grupo = document.createElement('details');
      grupo.className = 'nao-revisados';
      grupo.innerHTML = '<summary></summary><p class="nota"></p><div class="acervo"></div>';
      grupo.querySelector('summary')!.textContent = `Não revisados · licença não confirmada (${outros.length})`;
      grupo.querySelector('p')!.textContent = 'Ninguém confirmou que esses vídeos podem ser reusados. Se o vídeo não é seu, use por sua conta e diga de onde veio.';
      grupo.querySelector('.acervo')!.replaceChildren(...outros);
      caixa.append(grupo);
    }
  } catch { /* sem acervo: só as animações geradas */ }
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
    creditoBaixo: campoCredito.value.trim(),
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
  const b = estado.baixo && videoBaixo.readyState >= 2 ? { img: videoBaixo, w: videoBaixo.videoWidth, h: videoBaixo.videoHeight } : null;
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
  if (!video.paused) requestAnimationFrame(laco);
}
const celular = previa.parentElement!;
video.addEventListener('play', () => { celular.classList.add('tocando'); if (estado.baixo) videoBaixo.play(); laco(); });
video.addEventListener('pause', () => { celular.classList.remove('tocando'); videoBaixo.pause(); });
video.addEventListener('seeked', () => redesenhar());
video.addEventListener('timeupdate', () => { if (video.currentTime > estado.fim + 0.2 && !video.paused) video.currentTime = estado.ini; });
function alternar() {
  if (!estado.principal) return;
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
function avisoLegenda(texto: string, fracao?: number) {
  $('legenda-estado').textContent = `Ouvindo a fala para sugerir o gancho e fazer a legenda… ${fracao === undefined ? '' : `${Math.round(fracao * 100)}%`}`;
  if (estado.esperandoLegenda) andamento(texto, fracao);
}

function pedirLegenda(): Promise<Palavra[]> {
  const m = estado.principal;
  if (!m?.audio || !campoLegenda.checked) {
    $('legenda-estado').textContent = m && !m.audio ? 'Esse vídeo não tem som: sai sem legenda.' : '';
    return Promise.resolve([]);
  }
  const k = chaveTrecho();
  const pronta = estado.falas.get(k);
  if (pronta) { $('legenda-estado').textContent = 'Legenda pronta. Ideias tiradas da própria fala:'; return Promise.resolve(pronta); }
  const andando = estado.ouvindo.get(k);
  if (andando) return andando;
  const { ini, fim } = estado;
  const p = (async () => {
    avisoLegenda('Separando o áudio');
    const audio = await audioParaFala(m, ini, fim);
    const palavras = audio ? await transcrever(audio, avisoLegenda, () => k === chaveTrecho()) : [];
    estado.falas.set(k, palavras);
    if (k === chaveTrecho()) {
      $('legenda-estado').textContent = 'Legenda pronta. Ideias tiradas da própria fala:';
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
    andamento('Prensando', 0);
    const q = quadroPara(estado.receita, blocos);
    const mestre = await prensar({ ...q, principal: m, baixo: q.gerador ? null : estado.baixo, ini: estado.ini, fim: estado.fim, somLimpo: campoSom.checked },
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
  if (usaDividida(estado.receita) && estado.usarBaixoProprio && campoCredito.value.trim()) linhas.push(`Vídeo de baixo: ${campoCredito.value.trim()}`);
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
