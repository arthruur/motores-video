// Formatos: como cada quadro 1080x1920 é desenhado. A prévia e o export usam esta mesma função,
// então o que você vê é o que sai.
import { type Bloco, type EstiloLegenda, type Faixa, FONTE, desenharLegenda, desenharPalavra } from './legenda';
import { GERADORES } from './retencao';

export const L = 1080;
export const A = 1920;

export type Layout = 'cheio' | 'dividida';
export type EstiloGancho = 'nenhum' | 'titulo' | 'voce-sabia' | 'pov' | 'manchete' | 'lista' | 'pergunta' | 'caixa' | 'comentario' | 'citacao' | 'alerta';
export type AnimacaoGancho = 'carimbo' | 'deslizar' | 'digitar' | 'surgir' | 'fixo';
export type DepoisGancho = 'titulo' | 'some' | 'fica';

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
  { id: 'caixa', nome: 'Caixa branca', exemplo: 'o jeito que ninguém usa' },
  { id: 'comentario', nome: 'Comentário', exemplo: 'mas isso funciona mesmo?' },
  { id: 'citacao', nome: 'Citação', exemplo: 'a frase dita no vídeo' },
  { id: 'alerta', nome: 'Atenção', exemplo: 'pare de fazer isso agora' },
];

export const ANIMACOES: { id: AnimacaoGancho; nome: string }[] = [
  { id: 'carimbo', nome: 'Carimbo' },
  { id: 'deslizar', nome: 'Desliza' },
  { id: 'digitar', nome: 'Digitando' },
  { id: 'surgir', nome: 'Surge' },
  { id: 'fixo', nome: 'Sem animação' },
];

export const DEPOIS: { id: DepoisGancho; nome: string }[] = [
  { id: 'titulo', nome: 'Vira título' },
  { id: 'fica', nome: 'Fica grande' },
  { id: 'some', nome: 'Some' },
];

// Faixa segura comum a TikTok, Reels e Shorts (ver docs/plataformas.md): o mesmo arquivo serve em todas.
export const FAIXA_LEGENDA: Faixa = { esq: 120, dir: 780, base: 1248 };
// Tela dividida: fala em 58% de cima, retenção embaixo; a legenda fica na junção
export const CORTE = Math.round(A * 0.58);
const FAIXA_LEGENDA_DIVIDIDA: Faixa = { esq: 120, dir: 780, base: CORTE + 50 };
const TOPO = 270; // Meta: 14% do topo livre (abas Seguindo / Para você)
const MARGEM = 72;
export const GANCHO_S = 4; // quanto tempo o gancho fica grande, se ninguém mudar

export type Fonte = { img: CanvasImageSource; w: number; h: number };

export type Gancho = {
  estilo: EstiloGancho;
  texto: string;
  animacao?: AnimacaoGancho; // como entra (padrão: carimbo)
  dur?: number;              // segundos grande na tela (padrão: GANCHO_S)
  depois?: DepoisGancho;     // o que acontece depois (padrão: vira título)
};

export type Quadro = {
  layout: Layout;
  gancho: Gancho;
  zoom?: boolean; // câmera viva (padrão: ligada)
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

const entre = (x: number) => Math.min(1, Math.max(0, x));
const saiCubica = (p: number) => 1 - (1 - p) ** 3;

/** a entrada do gancho no instante t: escala, giro, deslocamento, opacidade e quanto do texto já apareceu */
function entrada(anim: AnimacaoGancho, t: number, letras: number) {
  const e = { escala: 1, giro: 0, dx: 0, alfa: 1, fracao: 1 };
  if (anim === 'carimbo') Object.assign(e, carimbo(t));
  else if (anim === 'deslizar') { const p = saiCubica(entre(t / 0.4)); e.dx = -L * (1 - p); e.alfa = entre(t / 0.15); }
  else if (anim === 'surgir') { const p = saiCubica(entre(t / 0.5)); e.alfa = p; e.escala = 0.9 + 0.1 * p; }
  else if (anim === 'digitar') e.fracao = entre(t / Math.min(1.6, 0.045 * letras)); // ~22 letras/s, no máximo 1,6 s
  return e;
}

/** gancho no topo: entra (carimbo, deslizando, digitando…), fica grande um tempo e depois vira título, some ou fica */
function desenharGancho(ctx: CanvasRenderingContext2D, g: Gancho, t: number): number {
  const inteiro = g.texto.trim();
  if (g.estilo === 'nenhum' || !inteiro) return TOPO;
  const anim = g.animacao ?? 'carimbo', dur = g.dur ?? GANCHO_S, depois = g.depois ?? 'titulo';
  const { escala, giro, dx, alfa, fracao } = entrada(anim, t, inteiro.length);
  const passou = entre((t - dur) / 0.35);
  if (depois === 'some' && passou >= 1) return TOPO;
  // digitando: o texto aparece letra a letra (por caractere, para não partir um acento)
  const letras = [...inteiro];
  const texto = fracao >= 1 ? inteiro : letras.slice(0, Math.ceil(letras.length * fracao)).join('');
  if (!texto) return TOPO;
  const k = escala * (depois === 'titulo' ? 1 - 0.38 * passou : 1);
  ctx.save();
  ctx.globalAlpha = alfa * (depois === 'some' ? 1 - passou : 1);
  ctx.translate(dx, 0);
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
  } else if (g.estilo === 'caixa') {
    // o texto nativo das redes: cada linha numa caixa branca, letra preta, sem caixa alta
    ctx.font = `78px "${FONTE}"`;
    const linhas = quebrar(ctx, texto, larg - 40);
    const alt = 92, pad = 26;
    ctx.fillStyle = '#FFFFFF';
    linhas.forEach((l, i) => {
      const w = ctx.measureText(l).width;
      ctx.beginPath(); ctx.roundRect(L / 2 - w / 2 - pad, y + i * alt, w + 2 * pad, alt + 2, 18); ctx.fill();
    });
    ctx.fillStyle = '#111111';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    linhas.forEach((l, i) => ctx.fillText(l, L / 2, y + i * alt + alt / 2 + 4));
    y += linhas.length * alt + 12;
  } else if (g.estilo === 'comentario') {
    // resposta a um comentário: cartão com avatar, "respondendo a" e o comentário
    ctx.font = `62px "${FONTE}"`;
    const linhas = quebrar(ctx, texto, larg - 190);
    const alt = linhas.length * 68 + 100;
    const lb = Math.min(larg, Math.max(380, ...linhas.map((l) => ctx.measureText(l).width)) + 190);
    const x0 = L / 2 - lb / 2;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.3)'; ctx.shadowOffsetY = 8; ctx.shadowBlur = 20;
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath(); ctx.roundRect(x0, y, lb, alt, 28); ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#E8E3DA';
    ctx.beginPath(); ctx.arc(x0 + 80, y + 80, 46, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#A59C8E'; // silhueta
    ctx.beginPath(); ctx.arc(x0 + 80, y + 66, 17, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(x0 + 80, y + 112, 30, 22, 0, Math.PI, 0); ctx.fill();
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.fillStyle = '#8A8378';
    ctx.font = `34px "${FONTE}"`;
    ctx.fillText('Respondendo a um comentário', x0 + 152, y + 26);
    ctx.fillStyle = '#16130F';
    ctx.font = `62px "${FONTE}"`;
    linhas.forEach((l, i) => ctx.fillText(l, x0 + 152, y + 70 + i * 68));
    y += alt + 24;
  } else if (g.estilo === 'citacao') {
    // aspas grandes e o texto em itálico com serifa: uma frase dita, não uma manchete
    ctx.font = 'italic 74px "Fraunces"';
    const linhas = quebrar(ctx, texto, larg - 60);
    ctx.fillStyle = AMARELO;
    ctx.font = '300px "Fraunces"';
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.fillText('\u201C', MARGEM - 10, y - 70);
    ctx.font = 'italic 74px "Fraunces"';
    ctx.lineJoin = 'round';
    linhas.forEach((l, i) => {
      const yy = y + 110 + i * 86;
      ctx.lineWidth = 12; ctx.strokeStyle = 'rgba(0,0,0,0.75)';
      ctx.strokeText(l, MARGEM + 30, yy);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(l, MARGEM + 30, yy);
    });
    y += 110 + linhas.length * 86 + 10;
  } else if (g.estilo === 'alerta') {
    // triângulo de aviso e "ATENÇÃO" numa pílula vermelha, o texto embaixo
    ctx.save();
    ctx.translate(L / 2, y + 50);
    ctx.font = `64px "${FONTE}"`;
    const w = ctx.measureText('ATENÇÃO').width + 150;
    ctx.fillStyle = '#E0242B';
    ctx.beginPath(); ctx.roundRect(-w / 2, -48, w, 96, 48); ctx.fill();
    const tx = -w / 2 + 62;
    ctx.fillStyle = AMARELO;
    ctx.beginPath(); ctx.moveTo(tx, -32); ctx.lineTo(tx + 34, 30); ctx.lineTo(tx - 34, 30); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#111';
    ctx.font = `48px "${FONTE}"`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('!', tx, 8);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = `64px "${FONTE}"`;
    ctx.fillText('ATENÇÃO', 36, 4);
    ctx.restore();
    ctx.font = `96px "${FONTE}"`;
    y = textoForte(ctx, quebrar(ctx, caixa, larg), y + 126, 96, chave);
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
/** câmera viva: um zoom lento e contínuo (até 6% em 12 s) e um "soco" de zoom quando o gancho carimba */
function zoomCamera(t: number, temGancho: boolean): number {
  const lento = 0.06 * Math.min(1, t / 12);
  const soco = temGancho ? 0.07 * Math.max(0, 1 - t / 0.35) ** 2 : 0;
  return 1 + lento + soco;
}

/** desenha a fonte com o zoom da câmera, recortado à caixa dela */
function comZoom(ctx: CanvasRenderingContext2D, z: number, x: number, y: number, w: number, h: number, desenho: () => void) {
  ctx.save();
  ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  ctx.translate(x + w / 2, y + h * 0.42);
  ctx.scale(z, z);
  ctx.translate(-(x + w / 2), -(y + h * 0.42));
  desenho();
  ctx.restore();
}

export function desenharQuadro(ctx: CanvasRenderingContext2D, q: Quadro, t: number, principal: Fonte | null, baixo: Fonte | null) {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, L, A);
  const temGancho = q.gancho.estilo !== 'nenhum' && !!q.gancho.texto.trim();
  const z = q.zoom === false ? 1 : zoomCamera(t, temGancho && (q.gancho.animacao ?? 'carimbo') === 'carimbo');
  if (q.layout === 'dividida') {
    if (principal) comZoom(ctx, z, 0, 0, L, CORTE, () => cobrir(ctx, principal, 0, 0, L, CORTE));
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
      comZoom(ctx, z, 0, A * 0.45 - h / 2, L, h, () => ctx.drawImage(principal.img, 0, A * 0.45 - h / 2, L, h));
    } else comZoom(ctx, z, 0, 0, L, A, () => cobrir(ctx, principal, 0, 0, L, A));
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
