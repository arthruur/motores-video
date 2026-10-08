import { A, GANCHOS, L, LAYOUTS, type EstiloGancho, type Fonte, type Layout, type Quadro, desenharQuadro, faixaLegenda } from './formatos';
import { type Bloco, FONTE, gerarSrt, montarBlocos } from './legenda';
import { PLATAFORMAS } from './plataformas';
import { type Arquivo, type Midia, abrir, audioParaFala, exportar, prensar } from './prensa';
import { transcrever } from './transcrever';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const estado = {
  principal: null as Midia | null,
  baixo: null as Midia | null,
  ini: 0,
  fim: 0,
  layout: 'cheio' as Layout,
  gancho: 'voce-sabia' as EstiloGancho,
  plataformas: new Set(['tiktok', 'reels', 'shorts', 'whatsapp']),
  legendas: new Map<string, Bloco[]>(),              // trecho -> blocos prontos
  ouvindo: new Map<string, Promise<Bloco[]>>(),     // trecho -> transcrição em andamento
  esperandoLegenda: false,
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

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const chaveTrecho = () => `${estado.principal?.arquivo.name}|${estado.ini.toFixed(2)}|${estado.fim.toFixed(2)}`;

// ---------------------------------------------------------------- fichas (layout, gancho, plataformas)
function fichas<T extends string>(caixa: HTMLElement, itens: { id: T; nome: string }[], ativo: () => T | Set<string>, escolher: (id: T) => void, multi = false) {
  caixa.replaceChildren(...itens.map((it) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'ficha';
    b.textContent = it.nome;
    if (!multi) b.setAttribute('role', 'radio');
    const sinc = () => {
      const a = ativo();
      const on = typeof a === 'string' ? a === it.id : a.has(it.id);
      b.setAttribute(multi ? 'aria-pressed' : 'aria-checked', String(on));
    };
    b.addEventListener('click', () => { escolher(it.id); caixa.querySelectorAll<HTMLButtonElement>('.ficha').forEach((x) => x.dispatchEvent(new Event('sinc'))); });
    b.addEventListener('sinc', sinc);
    sinc();
    return b;
  }));
}

fichas($('layouts'), LAYOUTS, () => estado.layout, (id) => {
  estado.layout = id;
  $('baixo-campos').hidden = id !== 'dividida';
  desenhar();
});
fichas($('ganchos'), GANCHOS, () => estado.gancho, (id) => {
  estado.gancho = id;
  const g = GANCHOS.find((g) => g.id === id)!;
  $('campo-gancho').hidden = id === 'nenhum';
  campoGancho.placeholder = `ex.: ${g.exemplo}`;
  desenhar();
});
campoGancho.placeholder = `ex.: ${GANCHOS[1].exemplo}`;
fichas($('plataformas'), PLATAFORMAS.map((p) => ({ id: p.id, nome: p.nome })), () => estado.plataformas, (id) => {
  if (estado.plataformas.has(id)) estado.plataformas.delete(id); else estado.plataformas.add(id);
  atualizarBotao();
}, true);

// ---------------------------------------------------------------- vídeo
async function carregarPrincipal(arquivo: File) {
  erro('');
  try {
    estado.principal = await abrir(arquivo);
  } catch (e) {
    erro((e as Error).message);
    return;
  }
  video.src = URL.createObjectURL(arquivo);
  estado.ini = 0;
  estado.fim = Math.min(estado.principal.dur, 60);
  if (!campoFonte.value) campoFonte.placeholder = 'Quem fala, onde e quando (aparece no vídeo)';
  $('soltar').hidden = true;
  $('trecho').hidden = false;
  infoTrecho();
  atualizarBotao();
  video.addEventListener('loadeddata', () => desenhar(), { once: true });
  pedirLegenda().catch(() => {});
}

function infoTrecho() {
  const d = estado.fim - estado.ini;
  $('trecho-info').textContent = `Trecho: ${fmt(estado.ini)} → ${fmt(estado.fim)} (${Math.round(d)} s de ${Math.round(estado.principal?.dur ?? 0)} s). Dê play e marque início e fim.`;
}

$<HTMLInputElement>('arquivo').addEventListener('change', (e) => {
  const f = (e.target as HTMLInputElement).files?.[0];
  if (f) carregarPrincipal(f);
});
$('trocar').addEventListener('click', () => { $<HTMLInputElement>('arquivo').click(); });
const soltar = $('soltar');
soltar.addEventListener('dragover', (e) => { e.preventDefault(); soltar.classList.add('sobre'); });
soltar.addEventListener('dragleave', () => soltar.classList.remove('sobre'));
soltar.addEventListener('drop', (e) => {
  e.preventDefault();
  soltar.classList.remove('sobre');
  const f = e.dataTransfer?.files[0];
  if (f) carregarPrincipal(f);
});

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

$<HTMLInputElement>('arquivo-baixo').addEventListener('change', async (e) => {
  const f = (e.target as HTMLInputElement).files?.[0];
  if (!f) return;
  try {
    estado.baixo = await abrir(f);
    videoBaixo.src = URL.createObjectURL(f);
    videoBaixo.addEventListener('loadeddata', () => desenhar(), { once: true });
    if (!video.paused) videoBaixo.play();
  } catch (err) {
    erro((err as Error).message);
  }
});

// ---------------------------------------------------------------- prévia (mesma função de desenho do export)
function quadro(legenda: Bloco[] | null): Quadro {
  return {
    layout: estado.layout,
    gancho: { estilo: estado.gancho, texto: campoGancho.value || (estado.gancho === 'nenhum' ? '' : GANCHOS.find((g) => g.id === estado.gancho)!.exemplo) },
    fonte: campoFonte.value.trim(),
    creditoBaixo: campoCredito.value.trim(),
    legenda,
  };
}

function desenhar() {
  const p: Fonte | null = video.readyState >= 2 ? { img: video, w: video.videoWidth, h: video.videoHeight } : null;
  const b: Fonte | null = estado.baixo && videoBaixo.readyState >= 2 ? { img: videoBaixo, w: videoBaixo.videoWidth, h: videoBaixo.videoHeight } : null;
  const leg = campoLegenda.checked ? estado.legendas.get(chaveTrecho()) ?? null : null;
  desenharQuadro(ctxPrevia, quadro(leg), Math.max(0, video.currentTime - estado.ini), p, b);
}

function laco() {
  desenhar();
  if (!video.paused) requestAnimationFrame(laco);
}
video.addEventListener('play', () => { if (estado.baixo) videoBaixo.play(); laco(); });
video.addEventListener('pause', () => videoBaixo.pause());
video.addEventListener('seeked', desenhar);
video.addEventListener('timeupdate', () => { if (video.currentTime > estado.fim + 0.2 && !video.paused) video.currentTime = estado.ini; });
[campoGancho, campoFonte, campoCredito].forEach((c) => c.addEventListener('input', desenhar));
campoLegenda.addEventListener('change', () => { desenhar(); pedirLegenda().catch(() => {}); });

// ---------------------------------------------------------------- legenda: começa a ouvir assim que o trecho é escolhido,
// enquanto a pessoa escolhe o formato. Quando ela aperta "Prensar", a legenda normalmente já está pronta.
function avisoLegenda(texto: string, fracao?: number) {
  $('legenda-estado').textContent = fracao === undefined ? `${texto}…` : `${texto}… ${Math.round(fracao * 100)}%`;
  if (estado.esperandoLegenda) andamento(texto, fracao);
}

function pedirLegenda(): Promise<Bloco[]> {
  const m = estado.principal;
  if (!m?.audio || !campoLegenda.checked) {
    $('legenda-estado').textContent = m && !m.audio ? 'Esse vídeo não tem som: sem legenda.' : '';
    return Promise.resolve([]);
  }
  const k = chaveTrecho();
  const pronta = estado.legendas.get(k);
  if (pronta) { $('legenda-estado').textContent = 'Legenda pronta ✓'; return Promise.resolve(pronta); }
  const andando = estado.ouvindo.get(k);
  if (andando) return andando;
  const { ini, fim } = estado;
  const p = (async () => {
    avisoLegenda('Separando o áudio');
    const audio = await audioParaFala(m, ini, fim);
    const palavras = audio ? await transcrever(audio, avisoLegenda, () => k === chaveTrecho()) : [];
    const f = faixaLegenda(estado.layout);
    const blocos = montarBlocos(palavras, document.createElement('canvas').getContext('2d')!, f.dir - f.esq - 56);
    estado.legendas.set(k, blocos);
    if (k === chaveTrecho()) { $('legenda-estado').textContent = 'Legenda pronta ✓'; desenhar(); }
    return blocos;
  })().finally(() => estado.ouvindo.delete(k));
  estado.ouvindo.set(k, p);
  return p;
}

// ---------------------------------------------------------------- prensar
function atualizarBotao() {
  $<HTMLButtonElement>('prensar').disabled = !estado.principal || estado.plataformas.size === 0;
}

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
      blocos = await pedirLegenda().finally(() => { estado.esperandoLegenda = false; });
      estado.srt = gerarSrt(blocos);
    }
    andamento('Prensando o vídeo', 0);
    const mestre = await prensar({ ...quadro(blocos), principal: m, baixo: estado.baixo, ini: estado.ini, fim: estado.fim },
      (f) => andamento(`Prensando o vídeo · ${Math.round(f * 100)}%`, f), estado.cancelar.signal);
    andamento('Preparando para cada plataforma', 0);
    const plats = PLATAFORMAS.filter((p) => estado.plataformas.has(p.id));
    const base = slug(campoGancho.value || m.arquivo.name.replace(/\.[^.]+$/, ''));
    const arquivos = await exportar(mestre, estado.fim - estado.ini, base, plats, (f) => andamento('Preparando para cada plataforma', f));
    mostrarProntos(arquivos, (performance.now() - t0) / 1000);
    desenhar();
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
  const prefixo = { 'voce-sabia': 'Você sabia? ', pov: 'POV: ', manchete: '', lista: '', nenhum: '' }[estado.gancho];
  const linhas = [];
  if (g && estado.gancho !== 'nenhum') linhas.push(prefixo + g);
  if (campoFonte.value.trim()) linhas.push(`Fonte: ${campoFonte.value.trim()}`);
  if (estado.layout === 'dividida' && campoCredito.value.trim()) linhas.push(`Vídeo de baixo: ${campoCredito.value.trim()}`);
  return linhas.join('\n');
}

function mostrarProntos(arquivos: Arquivo[], segundos: number) {
  estado.urls.forEach((u) => URL.revokeObjectURL(u));
  estado.urls = [];
  const lista = $('arquivos');
  lista.replaceChildren(...arquivos.map((a) => {
    const li = document.createElement('li');
    const url = URL.createObjectURL(a.blob);
    estado.urls.push(url);
    const arquivo = new File([a.blob], a.nome, { type: 'video/mp4' });
    const info = document.createElement('div');
    info.className = 'info';
    info.innerHTML = `<strong></strong><small></small>`;
    info.querySelector('strong')!.textContent = a.plataforma;
    info.querySelector('small')!.textContent = `${(a.blob.size / 1e6).toFixed(1)} MB${a.aviso ? ` · ${a.aviso}` : ''}`;
    li.append(info);
    if (navigator.canShare?.({ files: [arquivo] })) {
      const comp = document.createElement('button');
      comp.type = 'button';
      comp.textContent = 'Compartilhar';
      comp.addEventListener('click', () => navigator.share({ files: [arquivo], text: textoPost() }).catch(() => {}));
      li.append(comp);
    }
    const baixar = document.createElement('a');
    baixar.href = url;
    baixar.download = a.nome;
    baixar.textContent = 'Baixar';
    baixar.setAttribute('role', 'button');
    baixar.className = 'botao-link';
    li.append(baixar);
    return li;
  }));
  $<HTMLTextAreaElement>('post').value = textoPost();
  $('srt').hidden = !estado.srt;
  $('passo-pronto').hidden = false;
  $('passo-pronto').querySelector('h2')!.lastChild!.textContent = ` Pronto em ${Math.round(segundos)} s`;
  $('passo-pronto').scrollIntoView({ behavior: 'smooth' });
}

$('copiar').addEventListener('click', () => navigator.clipboard.writeText($<HTMLTextAreaElement>('post').value));
$('srt').addEventListener('click', () => {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([estado.srt], { type: 'text/plain' }));
  a.download = 'legenda.srt';
  a.click();
});

// ---------------------------------------------------------------- início
(async () => {
  await document.fonts.load(`84px "${FONTE}"`).catch(() => {});
  desenhar();
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
Object.assign(window, { __prensa: { estado, L, A } });
