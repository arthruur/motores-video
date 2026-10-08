// Legenda falada: palavras com tempo -> blocos curtos com a palavra atual destacada.
// Porte enxuto de motores/legenda/gerar.py (mesmas regras de quebra, mesma fonte e cores).

export type Palavra = { texto: string; inicio: number; fim: number };
export type Bloco = { palavras: Palavra[]; ini: number; fim: number };

export const FONTE = 'Barlow Condensed ExtraBold';
const CORPO = 84; // px num quadro 1080x1920
const MAX_PALAVRAS = 4;
const MIN_DUR = 0.5;
const CPS_MAX = 20;
const DESTAQUE = 1.06;
const POP = 0.12;
const COR_TEXTO = '#FFFFFF';
const COR_ATUAL = '#FFD633';
const COR_PLACA = 'rgba(21, 33, 59, 0.92)';

const ARTIGO = new Set(['o', 'a', 'os', 'as', 'um', 'uma', 'uns', 'umas', 'do', 'da', 'dos', 'das', 'no', 'na', 'nos',
  'nas', 'ao', 'à', 'aos', 'às', 'pelo', 'pela', 'seu', 'sua', 'seus', 'suas', 'meu', 'minha', 'teu', 'tua', 'esse',
  'essa', 'este', 'esta', 'aquele', 'aquela']);
const PREP_CONJ = new Set(['de', 'em', 'por', 'para', 'pra', 'com', 'sem', 'sob', 'sobre', 'entre', 'até', 'e', 'ou',
  'mas', 'que', 'se', 'porque', 'quando', 'como', 'nem']);

const limpa = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
const fimFrase = (w: Palavra) => /[.!?…]["”»)]?$/.test(w.texto);

/** custo de quebrar ENTRE a e b (b abre o próximo bloco) */
function custoQuebra(a: Palavra, b: Palavra): number {
  const ta = limpa(a.texto), tb = limpa(b.texto);
  if (/[,;:—]$/.test(a.texto)) return 0;
  if (/^\p{Lu}/u.test(a.texto) && /^\p{Lu}/u.test(b.texto)) return 30; // nome próprio
  if (ARTIGO.has(ta)) return 20;
  if (/\d$/.test(a.texto)) return 20;
  if (PREP_CONJ.has(ta)) return 6;
  if (PREP_CONJ.has(tb)) return 0.5;
  if (b.inicio - a.fim > 0.25) return 0.2; // pausa real na fala
  return 2;
}

function frases(P: Palavra[]): Palavra[][] {
  const out: Palavra[][] = [];
  let cur: Palavra[] = [];
  P.forEach((w, i) => {
    cur.push(w);
    if (fimFrase(w) || i + 1 === P.length) { out.push(cur); cur = []; }
  });
  return out;
}

/** programação dinâmica por frase: menor custo total de quebra */
function blocosFrase(F: Palavra[], medir: (s: string) => number, largMax: number): Palavra[][] {
  const n = F.length;
  const best = [0, ...Array(n).fill(1e9)];
  const de = Array(n + 1).fill(0);
  for (let e = 1; e <= n; e++) {
    for (let s = Math.max(0, e - MAX_PALAVRAS); s < e; s++) {
      const ws = F.slice(s, e);
      let c = 1;
      const L = medir(ws.map((w) => w.texto.toUpperCase()).join(' ')) * DESTAQUE;
      if (L > largMax) {
        if (L * 0.85 > largMax && e - s > 1) continue;
        if (e - s > 1) c += (L - largMax) / 20;
      }
      const dur = (e < n ? F[e].inicio : ws[ws.length - 1].fim + 0.4) - ws[0].inicio;
      if (dur < MIN_DUR) c += (MIN_DUR - dur) * 40;
      const chars = ws.reduce((t, w) => t + w.texto.length, 0);
      if (dur > 0 && chars / dur > CPS_MAX) c += chars / dur - CPS_MAX;
      if (e - s === 1 && n > 1) c += 1.5; // palavra órfã
      if (e < n) c += custoQuebra(F[e - 1], F[e]);
      if (best[s] + c < best[e]) { best[e] = best[s] + c; de[e] = s; }
    }
  }
  const out: Palavra[][] = [];
  for (let e = n; e > 0; e = de[e]) out.unshift(F.slice(de[e], e));
  return out;
}

export function montarBlocos(palavras: Palavra[], ctx: CanvasRenderingContext2D, largMax: number): Bloco[] {
  ctx.save();
  ctx.font = `${CORPO}px "${FONTE}"`;
  const medir = (s: string) => ctx.measureText(s).width;
  const B = frases(palavras.filter((w) => w.texto.trim())).flatMap((F) => blocosFrase(F, medir, largMax));
  ctx.restore();
  return B.map((ws, i) => {
    const ini = ws[0].inicio;
    const ultimo = ws[ws.length - 1];
    let fim = Math.min(i + 1 < B.length ? B[i + 1][0].inicio : 1e9, ultimo.fim + 0.8); // sai quando a próxima fala começa
    fim = i + 1 === B.length ? Math.max(fim, ini + MIN_DUR, ultimo.inicio + 0.4) : Math.max(fim, ini);
    return { palavras: ws, ini, fim };
  });
}

export type Faixa = { esq: number; dir: number; base: number };

/** desenha o bloco do instante t; a placa fica dentro da faixa segura e encostada na base */
export function desenharLegenda(ctx: CanvasRenderingContext2D, blocos: Bloco[], t: number, faixa: Faixa) {
  const b = blocos.find((b) => t >= b.ini && t < b.fim);
  if (!b) return;
  const largMax = faixa.dir - faixa.esq - 2 * 28;
  ctx.save();
  ctx.font = `${CORPO}px "${FONTE}"`;
  ctx.textBaseline = 'alphabetic';
  const textos = b.palavras.map((w) => w.texto.toUpperCase());
  const esp = ctx.measureText(' ').width;
  const larg = textos.map((s) => ctx.measureText(s).width);
  const L = larg.reduce((a, x) => a + x, 0) + esp * (textos.length - 1);
  const escala = Math.min(1, largMax / (L * DESTAQUE));
  const pop = POP > 0 ? Math.min(1, 0.9 + 0.1 * ((t - b.ini) / POP)) : 1;
  const k = escala * pop;
  const versal = CORPO * 0.7 * k;
  const folgaX = 28 * k, folgaY = 22 * k;
  const lp = L * k + 2 * folgaX;
  const cx = Math.min(Math.max(540, faixa.esq + lp / 2), faixa.dir - lp / 2);
  const yBase = faixa.base - folgaY;
  ctx.fillStyle = COR_PLACA;
  ctx.beginPath();
  ctx.roundRect(cx - lp / 2, yBase - versal - folgaY, lp, versal + 2 * folgaY, 20 * k);
  ctx.fill();
  let x = cx - (L * k) / 2;
  textos.forEach((s, i) => {
    const w = b.palavras[i];
    const atual = t >= w.inicio && (i + 1 === textos.length || t < b.palavras[i + 1].inicio);
    const cxPal = x + (larg[i] * k) / 2;
    ctx.save();
    ctx.translate(cxPal, yBase);
    const s2 = atual ? k * DESTAQUE : k;
    ctx.scale(s2, s2);
    ctx.fillStyle = atual ? COR_ATUAL : COR_TEXTO;
    ctx.textAlign = 'center';
    ctx.fillText(s, 0, 0);
    ctx.restore();
    x += (larg[i] + esp) * k;
  });
  ctx.restore();
}

/** .srt para subir como legenda nativa (acessível): até 2 linhas de 42 caracteres */
export function gerarSrt(blocos: Bloco[]): string {
  const ts = (s: number) => {
    const ms = Math.max(0, Math.round(s * 1000));
    const p = (n: number, d = 2) => String(n).padStart(d, '0');
    return `${p(Math.floor(ms / 3600000))}:${p(Math.floor(ms / 60000) % 60)}:${p(Math.floor(ms / 1000) % 60)},${p(ms % 1000, 3)}`;
  };
  return blocos.map((b, i) => `${i + 1}\n${ts(b.ini)} --> ${ts(b.fim)}\n${b.palavras.map((w) => w.texto).join(' ')}\n`).join('\n');
}
