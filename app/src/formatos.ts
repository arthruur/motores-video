// Formatos: como cada quadro 1080x1920 é desenhado. A prévia e o export usam esta mesma função,
// então o que você vê é o que sai.
import { type Bloco, type EstiloLegenda, type Faixa, FONTE, desenharLegenda, desenharPalavra } from './legenda';
import { GERADORES } from './retencao';

export const L = 1080;
export const A = 1920;

export type Layout = 'cheio' | 'dividida';
export type EstiloGancho = 'nenhum' | 'titulo' | 'voce-sabia' | 'pov' | 'manchete' | 'lista';

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

/** gancho no topo: entra com um "pop" no primeiro 0,25 s e fica até o fim */
function desenharGancho(ctx: CanvasRenderingContext2D, g: Quadro['gancho'], t: number): number {
  const texto = g.texto.trim();
  if (g.estilo === 'nenhum' || !texto) return TOPO;
  const pop = Math.min(1, 0.85 + 0.15 * (t / 0.25));
  // grande nos primeiros 4 s; depois vira título fixo, menor (ajuda quem entra no meio do loop)
  const encolhe = 1 - 0.3 * Math.min(1, Math.max(0, (t - GANCHO_S) / 0.3));
  const k = pop * encolhe;
  ctx.save();
  ctx.translate(L / 2, TOPO);
  ctx.scale(k, k);
  ctx.translate(-L / 2, -TOPO);
  const larg = L - 2 * MARGEM - 60;
  let y = TOPO;
  if (g.estilo === 'titulo') {
    ctx.font = `72px "${FONTE}"`;
    y = placa(ctx, quebrar(ctx, texto.toUpperCase(), larg), y, 72, '#FFFFFF', '#111');
  } else if (g.estilo === 'voce-sabia') {
    ctx.font = `64px "${FONTE}"`;
    y = placa(ctx, ['VOCÊ SABIA?'], y, 64, '#FFD633', '#111', 14) + 10;
    ctx.font = `72px "${FONTE}"`;
    y = placa(ctx, quebrar(ctx, texto.toUpperCase(), larg), y, 72, '#FFFFFF', '#111');
  } else if (g.estilo === 'pov') {
    ctx.font = `80px "${FONTE}"`;
    const linhas = quebrar(ctx, `POV: ${texto}`.toUpperCase(), larg);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 12;
    ctx.strokeStyle = '#000';
    ctx.fillStyle = '#FFF';
    linhas.forEach((l, i) => { ctx.strokeText(l, L / 2, y + i * 84); ctx.fillText(l, L / 2, y + i * 84); });
    y += linhas.length * 84 + 10;
  } else if (g.estilo === 'manchete') {
    ctx.font = `78px "${FONTE}"`;
    y = placa(ctx, quebrar(ctx, texto.toUpperCase(), larg), y, 78, '#E0242B', '#FFFFFF', 8);
  } else if (g.estilo === 'lista') {
    ctx.font = `76px "${FONTE}"`;
    y = placa(ctx, quebrar(ctx, texto.toUpperCase(), larg), y, 76, '#111827', '#FFD633', 22);
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
