// Formatos: como cada quadro 1080x1920 é desenhado. A prévia e o export usam esta mesma função,
// então o que você vê é o que sai.
import { type Bloco, type EstiloLegenda, type Faixa, FONTE, desenharLegenda, desenharPalavra } from './legenda';
import { GERADORES } from './retencao';

export const L = 1080;
export const A = 1920;

export type Layout = 'cheio' | 'dividida';
export type EstiloGancho = 'nenhum' | 'titulo' | 'voce-sabia' | 'pov' | 'manchete' | 'lista' | 'pergunta';

export const LAYOUTS: { id: Layout; nome: string; dica: string }[] = [
  { id: 'cheio', nome: 'Tela cheia', dica: 'Vídeo deitado ganha fundo desfocado' },
  { id: 'dividida', nome: 'Tela dividida', dica: 'Seu vídeo em cima, um vídeo de retenção embaixo' },
];

export const GANCHOS: { id: EstiloGancho; nome: string; exemplo: string }[] = [
  { id: 'nenhum', nome: 'Sem gancho', exemplo: '' },
  { id: 'titulo', nome: 'Título', exemplo: 'a frase mais forte do vídeo' },
  { id: 'voce-sabia', nome: 'Você sabia?', exemplo: 'que o céu não é azul de verdade' },
  { id: 'pov', nome: 'POV', exemplo: 'você descobriu como o céu funciona' },
  { id: 'manchete', nome: 'Manchete', exemplo: 'ninguém te contou isso' },
  { id: 'lista', nome: 'Lista', exemplo: '3 coisas que mudam tudo' },
  { id: 'pergunta', nome: 'Pergunta', exemplo: 'por que isso acontece?' },
];

// Faixa segura comum a TikTok, Reels e Shorts (ver docs/plataformas.md): o mesmo arquivo serve em todas.
export const FAIXA_LEGENDA: Faixa = { esq: 120, dir: 780, base: 1248 };
// Tela dividida: fala em 58% de cima, retenção embaixo; a legenda fica na junção
export const CORTE = Math.round(A * 0.58);
const FAIXA_LEGENDA_DIVIDIDA: Faixa = { esq: 120, dir: 780, base: CORTE + 50 };
const TOPO = 270; // Meta: 14% do topo livre (abas Seguindo / Para você)
const MARGEM = 72;
const GANCHO_S = 4;

export type Fonte = { img: CanvasImageSource; w: number; h: number };

export type Quadro = {
  layout: Layout;
  gancho: { estilo: EstiloGancho; texto: string };
  fonte: string; // quem fala / de onde veio: sempre visível quando preenchido
  creditoBaixo: string;
  legenda: Bloco[] | null;
  estiloLegenda: EstiloLegenda;
  gerador: string | null; // tela dividida com animação gerada (id em GERADORES) em vez de vídeo
};

const fundoPequeno = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(27, 48) : null;

/** cobre a caixa inteira (corta as sobras) */
function cobrir(ctx: CanvasRenderingContext2D, f: Fonte, x: number, y: number, w: number, h: number) {
  const k = Math.max(w / f.w, h / f.h);
  const sw = w / k, sh = h / k;
  ctx.drawImage(f.img, (f.w - sw) / 2, (f.h - sh) / 2, sw, sh, x, y, w, h);
}

/** fundo desfocado barato: reduz para 27x48 e amplia de volta (funciona em todo navegador, inclusive Safari) */
function fundoDesfocado(ctx: CanvasRenderingContext2D, f: Fonte) {
  if (!fundoPequeno) { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, L, A); return; }
  const p = fundoPequeno.getContext('2d')!;
  p.imageSmoothingQuality = 'high';
  const k = Math.max(27 / f.w, 48 / f.h);
  p.drawImage(f.img, (f.w - 27 / k) / 2, (f.h - 48 / k) / 2, 27 / k, 48 / k, 0, 0, 27, 48);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(fundoPequeno, 0, 0, L, A);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(0, 0, L, A);
}

function quebrar(ctx: CanvasRenderingContext2D, texto: string, larg: number): string[] {
  const linhas: string[] = [];
  let cur = '';
  for (const p of texto.split(/\s+/).filter(Boolean)) {
    const t = cur ? `${cur} ${p}` : p;
    if (ctx.measureText(t).width > larg && cur) { linhas.push(cur); cur = p; } else cur = t;
  }
  if (cur) linhas.push(cur);
  return linhas;
}

/** escreve linhas centradas numa placa; devolve o y logo abaixo dela */
function placa(ctx: CanvasRenderingContext2D, linhas: string[], y: number, corpo: number, corPlaca: string, corTexto: string, raio = 18) {
  if (!linhas.length) return y;
  const alt = corpo * 1.05;
  const larg = Math.max(...linhas.map((l) => ctx.measureText(l).width));
  const pad = corpo * 0.35;
  ctx.fillStyle = corPlaca;
  ctx.beginPath();
  ctx.roundRect(L / 2 - larg / 2 - pad, y, larg + 2 * pad, alt * linhas.length + pad * 1.4, raio);
  ctx.fill();
  ctx.fillStyle = corTexto;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  linhas.forEach((l, i) => ctx.fillText(l, L / 2, y + pad * 0.7 + i * alt + corpo * 0.06));
  return y + alt * linhas.length + pad * 1.4;
}

const AMARELO = '#FFD633';
const VAZIAS = new Set(['O', 'A', 'OS', 'AS', 'UM', 'UMA', 'DE', 'DO', 'DA', 'DOS', 'DAS', 'QUE', 'E', 'É', 'EM', 'NO', 'NA', 'POR', 'PARA', 'COM', 'SEU', 'SUA', 'ISSO', 'ESSE', 'ESSA', 'MAIS', 'NÃO', 'COMO', 'QUANDO', 'VOCÊ']);

/** a palavra que leva a cor: um número, senão a palavra mais longa que não seja vazia */
function palavraChave(texto: string): string {
  const palavras = texto.toUpperCase().split(/\s+/).map((p) => p.replace(/[^\p{L}\p{N}]/gu, '')).filter(Boolean);
  const numero = palavras.find((p) => /\d/.test(p));
  if (numero) return numero;
  return palavras.filter((p) => !VAZIAS.has(p) && p.length >= 4).sort((a, b) => b.length - a.length)[0] ?? '';
}

/** linhas centradas, com contorno grosso, sombra e a palavra-chave em amarelo */
function textoForte(ctx: CanvasRenderingContext2D, linhas: string[], y: number, corpo: number, chave: string, cor = '#FFFFFF') {
  const alt = corpo * 1.02;
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
  ctx.lineJoin = 'round';
  linhas.forEach((linha, i) => {
    const palavras = linha.split(' ');
    const esp = ctx.measureText(' ').width;
    const larg = palavras.map((p) => ctx.measureText(p).width);
    let x = L / 2 - (larg.reduce((a, b) => a + b, 0) + esp * (palavras.length - 1)) / 2;
    const yy = y + i * alt;
    palavras.forEach((p, k) => {
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.55)';
      ctx.shadowOffsetY = corpo * 0.06;
      ctx.shadowBlur = corpo * 0.12;
      ctx.lineWidth = corpo * 0.16;
      ctx.strokeStyle = '#000';
      ctx.strokeText(p, x, yy);
      ctx.restore();
      ctx.fillStyle = chave && p.replace(/[^\p{L}\p{N}]/gu, '') === chave ? AMARELO : cor;
      ctx.fillText(p, x, yy);
      x += larg[k] + esp;
    });
  });
  return y + linhas.length * alt;
}

/** entrada de carimbo: começa grande e inclinado, assenta com um leve exagero (a prensa batendo no papel) */
function carimbo(t: number): { escala: number; giro: number } {
  const p = Math.min(1, Math.max(0, t / 0.32));
  const volta = 1 + 2.4 * (p - 1) ** 3 + 1.4 * (p - 1) ** 2; // easeOutBack
  return { escala: 1.35 - 0.35 * volta, giro: (1 - p) * -0.06 };
}

/** gancho no topo: entra com um carimbo, fica grande nos primeiros 4 s e depois vira título fixo */
function desenharGancho(ctx: CanvasRenderingContext2D, g: Quadro['gancho'], t: number): number {
  const texto = g.texto.trim();
  if (g.estilo === 'nenhum' || !texto) return TOPO;
  const { escala, giro } = carimbo(t);
  const encolhe = 1 - 0.38 * Math.min(1, Math.max(0, (t - GANCHO_S) / 0.35));
  const k = escala * encolhe;
  ctx.save();
  ctx.translate(L / 2, TOPO);
  ctx.rotate(giro);
  ctx.scale(k, k);
  ctx.translate(-L / 2, -TOPO);
  const larg = L - 2 * MARGEM;
  const caixa = texto.toUpperCase();
  const chave = palavraChave(texto);
  let y = TOPO;
  if (g.estilo === 'titulo') {
    ctx.font = `104px "${FONTE}"`;
    y = textoForte(ctx, quebrar(ctx, caixa, larg), y, 104, chave);
  } else if (g.estilo === 'voce-sabia') {
    ctx.save();
    ctx.translate(L / 2, y + 40);
    ctx.rotate(-0.06);
    ctx.font = `66px "${FONTE}"`;
    const w = ctx.measureText('VOCÊ SABIA?').width + 56;
    ctx.fillStyle = AMARELO;
    ctx.beginPath(); ctx.roundRect(-w / 2, -44, w, 88, 14); ctx.fill();
    ctx.fillStyle = '#111';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('VOCÊ SABIA?', 0, 4);
    ctx.restore();
    ctx.font = `96px "${FONTE}"`;
    y = textoForte(ctx, quebrar(ctx, caixa, larg), y + 104, 96, chave);
  } else if (g.estilo === 'pov') {
    ctx.font = `100px "${FONTE}"`;
    y = textoForte(ctx, quebrar(ctx, `POV: ${caixa}`, larg), y, 100, 'POV');
  } else if (g.estilo === 'manchete') {
    ctx.font = `92px "${FONTE}"`;
    const linhas = quebrar(ctx, caixa, larg - 20);
    const alt = linhas.length * 96 + 44;
    ctx.save();
    ctx.translate(L / 2, y + alt / 2);
    ctx.rotate(-0.035);
    ctx.fillStyle = '#E0242B';
    ctx.fillRect(-L * 0.6, -alt / 2, L * 1.2, alt); // faixa de ponta a ponta
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    linhas.forEach((l, i) => ctx.fillText(l, 0, -alt / 2 + 24 + i * 96));
    ctx.restore();
    y += alt + 16;
  } else if (g.estilo === 'lista') {
    const m = caixa.match(/^(\d+)\s*(.*)$/);
    if (m && m[2]) { // número gigante à esquerda, o resto ao lado
      ctx.font = `260px "${FONTE}"`;
      const wn = ctx.measureText(m[1]).width;
      ctx.font = `86px "${FONTE}"`;
      const linhas = quebrar(ctx, m[2], larg - wn - 30);
      const altTexto = linhas.length * 88;
      const x0 = L / 2 - (wn + 30 + Math.max(...linhas.map((l) => ctx.measureText(l).width))) / 2;
      ctx.save();
      ctx.textBaseline = 'top'; ctx.textAlign = 'left'; ctx.lineJoin = 'round';
      ctx.font = `260px "${FONTE}"`;
      ctx.lineWidth = 26; ctx.strokeStyle = '#000';
      ctx.strokeText(m[1], x0, y - 20);
      ctx.fillStyle = AMARELO;
      ctx.fillText(m[1], x0, y - 20);
      ctx.font = `86px "${FONTE}"`;
      ctx.lineWidth = 14;
      const yt = y + Math.max(0, (230 - altTexto) / 2);
      linhas.forEach((l, i) => { ctx.strokeText(l, x0 + wn + 30, yt + i * 88); ctx.fillStyle = '#FFF'; ctx.fillText(l, x0 + wn + 30, yt + i * 88); });
      ctx.restore();
      y += Math.max(240, altTexto) + 10;
    } else {
      ctx.font = `100px "${FONTE}"`;
      y = textoForte(ctx, quebrar(ctx, caixa, larg), y, 100, chave);
    }
  } else if (g.estilo === 'pergunta') {
    // balão de pergunta: o vídeo é a resposta
    ctx.font = `80px "${FONTE}"`;
    const linhas = quebrar(ctx, texto, larg - 60);
    const alt = linhas.length * 84 + 110;
    const lb = Math.min(L - 2 * MARGEM + 40, Math.max(...linhas.map((l) => ctx.measureText(l).width)) + 96);
    const x0 = L / 2 - lb / 2;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.35)'; ctx.shadowOffsetY = 10; ctx.shadowBlur = 24;
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath(); ctx.roundRect(x0, y, lb, alt, 34); ctx.fill();
    ctx.beginPath(); ctx.moveTo(x0 + 80, y + alt - 2); ctx.lineTo(x0 + 66, y + alt + 44); ctx.lineTo(x0 + 130, y + alt - 2); ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#D7301F';
    ctx.font = `40px "${FONTE}"`;
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.fillText('PERGUNTA', x0 + 48, y + 26);
    ctx.fillStyle = '#16130F';
    ctx.font = `80px "${FONTE}"`;
    linhas.forEach((l, i) => ctx.fillText(l, x0 + 48, y + 78 + i * 84));
    y += alt + 50;
  }
  ctx.restore();
  return TOPO + (y - TOPO) * k;
}

function rotulo(ctx: CanvasRenderingContext2D, texto: string, x: number, y: number) {
  if (!texto.trim()) return;
  ctx.save();
  ctx.font = `38px "${FONTE}"`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  let t = texto.trim();
  while (ctx.measureText(t).width > L - x - MARGEM - 24 && t.length > 4) t = `${t.slice(0, -2)}…`;
  const w = ctx.measureText(t).width;
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.beginPath();
  ctx.roundRect(x, y, w + 24, 50, 10);
  ctx.fill();
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText(t, x + 12, y + 8);
  ctx.restore();
}

/** desenha o quadro do instante t (segundos desde o início do trecho) */
export function desenharQuadro(ctx: CanvasRenderingContext2D, q: Quadro, t: number, principal: Fonte | null, baixo: Fonte | null) {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, L, A);
  if (q.layout === 'dividida') {
    if (principal) cobrir(ctx, principal, 0, 0, L, CORTE);
    const g = q.gerador ? GERADORES.find((g) => g.id === q.gerador) : null;
    if (g) g.desenhar(ctx, t, 0, CORTE, L, A - CORTE);
    else if (baixo) cobrir(ctx, baixo, 0, CORTE, L, A - CORTE);
    else { ctx.fillStyle = '#1b2233'; ctx.fillRect(0, CORTE, L, A - CORTE); }
    ctx.fillStyle = '#000';
    ctx.fillRect(0, CORTE - 3, L, 6);
  } else if (principal) {
    if (principal.w / principal.h > 0.7) { // deitado ou quadrado: fundo desfocado + vídeo inteiro
      fundoDesfocado(ctx, principal);
      const h = (L * principal.h) / principal.w;
      ctx.drawImage(principal.img, 0, A * 0.45 - h / 2, L, h);
    } else cobrir(ctx, principal, 0, 0, L, A);
  }
  const y = desenharGancho(ctx, q.gancho, t);
  rotulo(ctx, q.fonte ? `Fonte: ${q.fonte}` : '', MARGEM, y + 14);
  if (q.layout === 'dividida' && !q.gerador) rotulo(ctx, q.creditoBaixo ? `Vídeo de baixo: ${q.creditoBaixo}` : '', MARGEM, CORTE + 150);
  if (q.legenda) {
    const f = faixaLegenda(q.layout);
    if (q.estiloLegenda === 'palavra') desenharPalavra(ctx, q.legenda, t, f);
    else desenharLegenda(ctx, q.legenda, t, f);
  }
}

export function faixaLegenda(layout: Layout): Faixa {
  return layout === 'dividida' ? FAIXA_LEGENDA_DIVIDIDA : FAIXA_LEGENDA;
}
