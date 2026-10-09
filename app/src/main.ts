import { CORTE, type Fonte, type Quadro, desenharQuadro, faixaLegenda } from './formatos';
import { type Bloco, type EstiloLegenda, type Palavra, FONTE, gerarSrt, montarBlocos } from './legenda';
import { PLATAFORMAS } from './plataformas';
import { type Arquivo, type Midia, abrir, audioParaFala, exportar, prensar } from './prensa';
import { RECEITAS, type Receita, ganchosDaFala } from './receitas';
import { GERADORES } from './retencao';
import { transcrever } from './transcrever';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const guardado = {
  ler: (k: string) => { try { return localStorage.getItem(k); } catch { return null; } },
  gravar: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* aba anônima */ } },
};

const estado = {
  principal: null as Midia | null,
  baixo: null as Midia | null,
  ini: 0,
  fim: 0,
  receita: RECEITAS[0],
  gerador: null as string | null,     // retenção gerada escolhida (sobrepõe a da receita)
  usarBaixoProprio: false,
  estiloLegenda: null as EstiloLegenda | null, // null = o da receita
  plataformas: new Set(PLATAFORMAS.map((p) => p.id)),
  falas: new Map<string, Palavra[]>(),         // trecho -> palavras
  ouvindo: new Map<string, Promise<Palavra[]>>(),
  esperandoLegenda: false,
  ganchoMexido: false,
  ideias: [] as string[],
  ideia: -1,
  srt: '',
  urls: [] as string[],
  cancelar: null as AbortController | null,
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
const geradorAtual = () => (estado.usarBaixoProprio ? null : estado.gerador ?? estado.receita.gerador ?? (estado.receita.layout === 'dividida' ? GERADORES[0].id : null));
const estiloLegendaAtual = (): EstiloLegenda => estado.estiloLegenda ?? estado.receita.legenda;

function mostrar(tela: 'inicio' | 'criar' | 'pronta') {
  $('tela-inicio').hidden = tela !== 'inicio';
  $('tela-criar').hidden = tela !== 'criar';
  $('tela-pronta').hidden = tela !== 'pronta';
  window.scrollTo({ top: 0 });
}

// ---------------------------------------------------------------- fichas genéricas
function fichas<T extends string>(caixa: HTMLElement, itens: { id: T; nome: string }[], ativo: (id: T) => boolean, escolher: (id: T) => void, multi = false) {
  const sinc = () => caixa.querySelectorAll<HTMLButtonElement>('.ficha').forEach((b) => b.setAttribute(multi ? 'aria-pressed' : 'aria-checked', String(ativo(b.dataset.id as T))));
  caixa.replaceChildren(...itens.map((it) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'ficha';
    b.dataset.id = it.id;
    b.textContent = it.nome;
    if (!multi) b.setAttribute('role', 'radio');
    b.addEventListener('click', () => { escolher(it.id); sinc(); });
    return b;
  }));
  sinc();
  return sinc;
}

// ---------------------------------------------------------------- receitas (o coração da tela)
function montarReceitas() {
  const caixa = $('receitas');
  const sinc = () => caixa.querySelectorAll<HTMLButtonElement>('.receita').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.id === estado.receita.id)));
  caixa.replaceChildren(...RECEITAS.map((r) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'receita';
    b.dataset.id = r.id;
    b.setAttribute('role', 'radio');
    b.innerHTML = '<strong></strong><small></small>';
    b.querySelector('strong')!.textContent = r.nome;
    b.querySelector('small')!.textContent = r.para;
    b.addEventListener('click', () => { escolherReceita(r); sinc(); });
    return b;
  }));
  sinc();
}

function escolherReceita(r: Receita) {
  estado.receita = r;
  estado.gerador = null;
  estado.estiloLegenda = null;
  if (r.layout !== 'dividida') estado.usarBaixoProprio = false;
  $('receita-dica').textContent = r.dica;
  sincRetencoes();
  sincEstilos();
  montarIdeias();
  if (!estado.ganchoMexido) campoGancho.value = estado.ideias.find((i) => !i.includes('___')) ?? '';
  campoGancho.placeholder = r.modelos[0] ? `ex.: ${r.modelos[0]}` : 'a frase mais forte do vídeo';
  desenhar();
}

/** ideias de gancho: primeiro as frases da própria fala; depois os modelos da receita */
function montarIdeias() {
  const palavras = estado.falas.get(chaveTrecho());
  const daFala = palavras ? ganchosDaFala(palavras) : [];
  estado.ideias = [...daFala, ...estado.receita.modelos];
  estado.ideia = -1;
  const btn = $<HTMLButtonElement>('da-fala');
  btn.hidden = !daFala.length;
  if (daFala.length) btn.textContent = `Da fala: "${daFala[0]}"`;
  $<HTMLButtonElement>('outra-ideia').disabled = estado.ideias.length === 0;
}

$('outra-ideia').addEventListener('click', () => {
  if (!estado.ideias.length) return;
  estado.ideia = (estado.ideia + 1) % estado.ideias.length;
  const ideia = estado.ideias[estado.ideia];
  campoGancho.value = ideia;
  estado.ganchoMexido = true;
  campoGancho.focus();
  const lacuna = ideia.indexOf('___'); // seleciona a lacuna: é só digitar por cima
  if (lacuna >= 0) campoGancho.setSelectionRange(lacuna, lacuna + 3);
  desenhar();
});
$('da-fala').addEventListener('click', () => {
  const daFala = estado.ideias.find((i) => !i.includes('___'));
  if (daFala) { campoGancho.value = daFala; estado.ganchoMexido = true; desenhar(); }
});
campoGancho.addEventListener('input', () => { estado.ganchoMexido = true; desenhar(); });

// ---------------------------------------------------------------- mais opções
const sincRetencoes = fichas($('retencoes'), GERADORES.map((g) => ({ id: g.id, nome: g.nome })), (id) => quadro(null).layout === 'dividida' && geradorAtual() === id, (id) => {
  estado.gerador = id;
  estado.usarBaixoProprio = false;
  forcarDividida();
});
const sincEstilos = fichas($('estilos-legenda'), [{ id: 'bloco' as EstiloLegenda, nome: 'Bloco (2 a 4 palavras)' }, { id: 'palavra' as EstiloLegenda, nome: 'Palavra por palavra' }], (id) => estiloLegendaAtual() === id, (id) => {
  estado.estiloLegenda = id;
  desenhar();
});
fichas($('plataformas'), PLATAFORMAS.map((p) => ({ id: p.id, nome: p.nome })), (id) => estado.plataformas.has(id), (id) => {
  if (estado.plataformas.has(id)) estado.plataformas.delete(id); else estado.plataformas.add(id);
  $<HTMLButtonElement>('prensar').disabled = estado.plataformas.size === 0;
}, true);

/** escolher um vídeo de baixo liga a tela dividida, mesmo numa receita de tela cheia */
function forcarDividida() {
  if (estado.receita.layout !== 'dividida') {
    const { gerador, usarBaixoProprio } = estado;
    escolherReceita(RECEITAS.find((r) => r.id === 'duplo')!);
    Object.assign(estado, { gerador, usarBaixoProprio });
    montarReceitas();
  }
  sincRetencoes();
  desenhar();
}

$<HTMLInputElement>('arquivo-baixo').addEventListener('change', async (e) => {
  const f = (e.target as HTMLInputElement).files?.[0];
  if (f) await usarBaixo(f, '');
});

async function usarBaixo(f: File, credito: string) {
  try {
    estado.baixo = await abrir(f);
    estado.usarBaixoProprio = true;
    videoBaixo.src = URL.createObjectURL(f);
    // vídeo escondido só decodifica um quadro se for pedido: o seek força o 1º quadro para a prévia
    videoBaixo.addEventListener('loadedmetadata', () => { videoBaixo.currentTime = 0.05; }, { once: true });
    videoBaixo.addEventListener('seeked', desenhar);
    if (!video.paused) videoBaixo.play();
    campoCredito.value = credito;
    $('campo-credito').hidden = false;
    forcarDividida();
  } catch (err) {
    erro((err as Error).message);
  }
}

import { carregarManifesto, baixarClipe } from './acervo';

// acervo de mídias livres (Wikimedia Commons / Hugging Face Datasets)
async function carregarAcervo() {
  try {
    const clipes = await carregarManifesto();
    if (!clipes.length) return;
    const caixa = $('acervo');
    caixa.hidden = false;
    caixa.replaceChildren(...clipes.map((c) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'clipe';
      b.innerHTML = '<span></span><small></small>';
      b.querySelector('span')!.textContent = c.titulo;
      b.querySelector('small')!.textContent = `${c.credito} · ${c.licenca}`;
      b.addEventListener('click', async () => {
        const textoOriginal = b.querySelector('small')!.textContent;
        b.disabled = true;
        try {
          const blob = await baixarClipe(c, (msg) => {
            b.querySelector('small')!.textContent = msg;
          });
          await usarBaixo(new File([blob], c.arquivo, { type: blob.type || 'video/mp4' }), `${c.credito} (${c.licenca})`);
        } catch (err) {
          alert((err as Error).message);
        } finally {
          b.querySelector('small')!.textContent = textoOriginal;
          b.disabled = false;
        }
      });
      return b;
    }));
  } catch { /* sem acervo: só as animações geradas */ }
}

// ---------------------------------------------------------------- vídeo principal
async function carregarPrincipal(arquivo: File) {
  erro('');
  try {
    estado.principal = await abrir(arquivo);
  } catch (e) {
    alert((e as Error).message);
    return;
  }
  video.src = URL.createObjectURL(arquivo);
  estado.ini = 0;
  estado.fim = Math.min(estado.principal.dur, 60);
  estado.ganchoMexido = false;
  campoGancho.value = '';
  infoTrecho();
  mostrar('criar');
  escolherReceita(estado.receita);
  video.addEventListener('loadeddata', () => desenhar(), { once: true });
  pedirLegenda().catch(() => {});
}

function infoTrecho() {
  const d = estado.fim - estado.ini;
  $('trecho-info').textContent = `Trecho: ${fmt(estado.ini)} → ${fmt(estado.fim)} (${Math.round(d)} s de ${Math.round(estado.principal?.dur ?? 0)} s). Dê play e marque o início e o fim.`;
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
$('trocar').addEventListener('click', () => $<HTMLInputElement>('arquivo').click());

$('marca-ini').addEventListener('click', () => {
  estado.ini = Math.min(video.currentTime, estado.fim - 1);
  if (estado.fim - estado.ini > 180) estado.fim = estado.ini + 180;
  infoTrecho();
  desenhar();
  pedirLegenda().catch(() => {});
});
$('marca-fim').addEventListener('click', () => {
  estado.fim = Math.min(Math.max(video.currentTime, estado.ini + 1), estado.ini + 180); // 3 min: limite dos Shorts
  infoTrecho();
  pedirLegenda().catch(() => {});
});

// ---------------------------------------------------------------- prévia (mesma função de desenho do export)
function quadro(legenda: Bloco[] | null): Quadro {
  return {
    layout: estado.receita.layout === 'dividida' || estado.usarBaixoProprio ? 'dividida' : 'cheio',
    gancho: { estilo: estado.receita.gancho, texto: campoGancho.value.includes('___') ? '' : campoGancho.value },
    fonte: campoFonte.value.trim(),
    creditoBaixo: campoCredito.value.trim(),
    legenda,
    estiloLegenda: estiloLegendaAtual(),
    gerador: geradorAtual(),
  };
}

function blocosDoTrecho(): Bloco[] | null {
  const palavras = estado.falas.get(chaveTrecho());
  if (!palavras || !campoLegenda.checked) return null;
  const f = faixaLegenda('cheio');
  return montarBlocos(palavras, ctxPrevia, f.dir - f.esq - 56);
}

let blocosCache: { chave: string; blocos: Bloco[] | null } = { chave: '', blocos: null };
function desenhar() {
  const chave = `${chaveTrecho()}|${campoLegenda.checked}|${estado.falas.has(chaveTrecho())}`;
  if (blocosCache.chave !== chave) blocosCache = { chave, blocos: blocosDoTrecho() };
  const p: Fonte | null = video.readyState >= 2 ? { img: video, w: video.videoWidth, h: video.videoHeight } : null;
  const b: Fonte | null = estado.baixo && videoBaixo.readyState >= 2 ? { img: videoBaixo, w: videoBaixo.videoWidth, h: videoBaixo.videoHeight } : null;
  desenharQuadro(ctxPrevia, quadro(blocosCache.blocos), Math.max(0, video.currentTime - estado.ini), p, b);
}

function laco() {
  desenhar();
  if (!video.paused) requestAnimationFrame(laco);
}
video.addEventListener('play', () => { if (estado.baixo) videoBaixo.play(); laco(); });
video.addEventListener('pause', () => videoBaixo.pause());
video.addEventListener('seeked', desenhar);
video.addEventListener('timeupdate', () => { if (video.currentTime > estado.fim + 0.2 && !video.paused) video.currentTime = estado.ini; });
previa.addEventListener('click', () => {
  if (!estado.principal) return;
  if (video.paused) {
    if (video.currentTime < estado.ini || video.currentTime > estado.fim) video.currentTime = estado.ini;
    video.play();
  } else video.pause();
});
[campoFonte, campoCredito].forEach((c) => c.addEventListener('input', desenhar));
campoFonte.addEventListener('input', () => { $('aviso-fonte').hidden = true; });
campoLegenda.addEventListener('change', () => { desenhar(); pedirLegenda().catch(() => {}); });

// ---------------------------------------------------------------- legenda em segundo plano: começa assim que o vídeo chega
function avisoLegenda(texto: string, fracao?: number) {
  $('legenda-estado').textContent = fracao === undefined ? `Legenda: ${texto.toLowerCase()}…` : `Legenda: ${texto.toLowerCase()}… ${Math.round(fracao * 100)}%`;
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
  if (pronta) { $('legenda-estado').textContent = 'Legenda pronta ✓'; return Promise.resolve(pronta); }
  const andando = estado.ouvindo.get(k);
  if (andando) return andando;
  const { ini, fim } = estado;
  const p = (async () => {
    avisoLegenda('Separando o áudio');
    const audio = await audioParaFala(m, ini, fim);
    const palavras = audio ? await transcrever(audio, avisoLegenda, () => k === chaveTrecho()) : [];
    estado.falas.set(k, palavras);
    if (k === chaveTrecho()) {
      $('legenda-estado').textContent = 'Legenda pronta ✓';
      montarIdeias();
      // gancho sugerido da própria fala, se a pessoa ainda não escreveu nada
      const daFala = estado.ideias.find((i) => !i.includes('___'));
      if (!estado.ganchoMexido && daFala) campoGancho.value = daFala;
      desenhar();
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
  const barra = $<HTMLProgressElement>('andamento-barra');
  if (fracao === undefined) barra.removeAttribute('value'); else barra.value = fracao;
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
  const t0 = performance.now();
  try {
    let blocos: Bloco[] | null = null;
    if (campoLegenda.checked && m.audio) {
      estado.esperandoLegenda = true;
      andamento('Terminando a legenda');
      await pedirLegenda().finally(() => { estado.esperandoLegenda = false; });
      blocos = blocosDoTrecho();
      estado.srt = blocos ? gerarSrt(blocos) : '';
    }
    andamento('Prensando o vídeo', 0);
    const q = quadro(blocos);
    const mestre = await prensar({ ...q, principal: m, baixo: q.gerador ? null : estado.baixo, ini: estado.ini, fim: estado.fim, somLimpo: campoSom.checked },
      (f) => andamento(`Prensando o vídeo · ${Math.round(f * 100)}%`, f), estado.cancelar.signal);
    andamento('Preparando para cada rede', 0);
    const plats = PLATAFORMAS.filter((p) => estado.plataformas.has(p.id));
    const base = slug(campoGancho.value || m.arquivo.name.replace(/\.[^.]+$/, ''));
    const arquivos = await exportar(mestre, estado.fim - estado.ini, base, plats, (f) => andamento('Preparando para cada rede', f));
    mostrarProntos(arquivos, (performance.now() - t0) / 1000);
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
  const q = quadro(null);
  if (q.layout === 'dividida' && !q.gerador && campoCredito.value.trim()) linhas.push(`Vídeo de baixo: ${campoCredito.value.trim()}`);
  return linhas.join('\n');
}

function mostrarProntos(arquivos: Arquivo[], segundos: number) {
  estado.urls.forEach((u) => URL.revokeObjectURL(u));
  estado.urls = [];
  $('arquivos').replaceChildren(...arquivos.map((a) => {
    const li = document.createElement('li');
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
    baixar.className = 'botao-link';
    li.append(baixar);
    return li;
  }));
  $<HTMLTextAreaElement>('post').value = textoPost();
  $('srt').hidden = !estado.srt;
  $('pronto-titulo').textContent = `Pronto em ${Math.round(segundos)} s`;
  mostrar('pronta');
}

$('copiar').addEventListener('click', () => navigator.clipboard.writeText($<HTMLTextAreaElement>('post').value));
$('srt').addEventListener('click', () => {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([estado.srt], { type: 'text/plain' }));
  a.download = 'legenda.srt';
  a.click();
});
$('voltar').addEventListener('click', () => mostrar('criar'));
$('novo').addEventListener('click', () => { $<HTMLInputElement>('arquivo').value = ''; mostrar('inicio'); });

// ---------------------------------------------------------------- onboarding e história
const ajuda = $<HTMLDialogElement>('ajuda');
let slide = 0;
function irSlide(n: number) {
  const slides = [...ajuda.querySelectorAll<HTMLElement>('.slide')];
  slide = n;
  slides.forEach((s, i) => { s.hidden = i !== n; });
  $('ajuda-proximo').textContent = n === slides.length - 1 ? 'Começar' : 'Próximo';
}
$('ajuda-proximo').addEventListener('click', () => {
  if (slide < 2) irSlide(slide + 1);
  else ajuda.close();
});
$('ajuda-pular').addEventListener('click', () => ajuda.close());
ajuda.addEventListener('close', () => guardado.gravar('prensa-viu-ajuda', '1'));
$('abrir-ajuda').addEventListener('click', () => { irSlide(0); ajuda.showModal(); });
const historia = $<HTMLDialogElement>('historia');
$('abrir-historia').addEventListener('click', () => { historia.showModal(); historia.scrollTop = 0; $('historia-titulo').focus(); });
$('historia-fechar').addEventListener('click', () => historia.close());
[ajuda, historia].forEach((d) => d.addEventListener('click', (e) => { if (e.target === d) d.close(); }));

// ---------------------------------------------------------------- início
(async () => {
  montarReceitas();
  escolherReceita(RECEITAS[0]);
  await document.fonts.load(`84px "${FONTE}"`).catch(() => {});
  if (!guardado.ler('prensa-viu-ajuda') && !new URLSearchParams(location.search).has('sem-ajuda')) { irSlide(0); ajuda.showModal(); }
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
Object.assign(window, { __prensa: { estado, CORTE } });
