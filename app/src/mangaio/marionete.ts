// O Mangaio no canvas: o mesmo SVG do site (traço do Figma), virado marionete.
// No site, cada peça é um <g> do DOM e a pose é um `style.transform`. Aqui não tem DOM no quadro:
// os <path> viram Path2D (uma vez só) e, a cada quadro, a árvore de grupos é desenhada de novo,
// aplicando a transformação de cada peça nomeada em volta do seu pivô, como o `transform-origin` do CSS.
import svgMascote from './mascote.svg?raw';

/** A pose de um instante. Mesmos nomes e unidades do mascote.ts do site. */
export type Pose = {
  giro: number; // graus, em volta da base
  sx: number;
  sy: number;
  braco: number; // graus; o direito gira ao contrário
  alca: number; // escala Y da alça (follow-through)
  frutasY: number; // deslocamento das frutas, em % da altura delas
  boca: FormaBoca;
  bocaY: number; // escala Y da boca desenhada (abre no ar)
  abertura: number; // olhos: 1 aberto, ~0,1 fechado
  frutas: number[]; // escala de cada pedaço de fruta no cesto, de baixo para cima (0 = não aparece)
};

export type FormaBoca = 'aberta' | 'meia' | 'sorriso' | 'o';

export const POSE_NEUTRA: Pose = {
  giro: 0, sx: 1, sy: 1, braco: 0, alca: 1, frutasY: 0, boca: 'sorriso', bocaY: 1, abertura: 1, frutas: [],
};

type Caixa = { x: number; y: number; w: number; h: number };
type No = { tipo: 'path'; id: string | null; p: Path2D; cor: string } | { tipo: 'g'; id: string | null; filhos: No[] };

export type Marionete = {
  /** caixa do desenho inteiro (#mascote), no espaço do SVG */
  caixa: Caixa;
  /** quantos pedaços de fruta cabem no cesto */
  pedacos: number;
  /** desenha com a base (meio de baixo) em (x, y) e `altura` px de alto */
  desenhar: (ctx: CanvasRenderingContext2D, pose: Pose, x: number, y: number, altura: number) => void;
};

// Pivôs, em fração da caixa de cada peça: os mesmos do mascote.css do site.
const PIVO: Record<string, [number, number]> = {
  mascote: [0.5, 1], rosto: [0.5, 0.5], boca: [0.5, 0], alca: [0.5, 1], frutas: [0.5, 1],
  'braco-esq': [0.8, 0.1], 'braco-dir': [0.2, 0.1], 'olho-esq': [0.5, 0.55], 'olho-dir': [0.5, 0.55],
};
const AREA_MINIMA = 40; // px² do SVG: ignora restos minúsculos da exportação (como no site)

let unica: Marionete | null = null;

/** Monta na primeira chamada (precisa do DOM só para medir as caixas, uma vez). */
export function marionete(): Marionete {
  return (unica ??= montar());
}

function montar(): Marionete {
  // getBBox só mede elemento que está no documento: põe o SVG fora da tela, mede e tira
  const fora = document.createElement('div');
  fora.style.cssText = 'position:absolute;left:-9999px;top:0;visibility:hidden';
  fora.innerHTML = svgMascote;
  document.body.append(fora);
  const svg = fora.querySelector('svg')!;
  const caixas = new Map<Element, Caixa>();
  const porId = new Map<string, Caixa>();
  const medir = (el: Element) => {
    const b = (el as SVGGraphicsElement).getBBox();
    const c = { x: b.x, y: b.y, w: b.width, h: b.height };
    caixas.set(el, c);
    if (el.id) porId.set(el.id, c);
    return c;
  };

  const ler = (el: Element): No | null => {
    if (el.id) medir(el);
    if (el.tagName === 'path') return { tipo: 'path', id: el.id || null, p: new Path2D(el.getAttribute('d') ?? ''), cor: el.getAttribute('fill') ?? '#000' };
    if (el.tagName !== 'g') return null;
    return { tipo: 'g', id: el.id || null, filhos: [...el.children].map(ler).filter((n): n is No => !!n) };
  };
  const raiz = ler(svg.querySelector('#mascote')!) as Extract<No, { tipo: 'g' }>;

  const caixaDe = (id: string) => porId.get(id)!;
  const caixa = caixaDe('mascote');

  // os pedaços de fruta: filhos diretos de #frutas, de baixo para cima (o fundo primeiro)
  const elFrutas = [...svg.querySelector('#frutas')!.children];
  const medidos = elFrutas.map((el, i) => ({ i, c: medir(el) })).filter(({ c }) => c.w * c.h >= AREA_MINIMA);
  const ordem = medidos.sort((a, b) => b.c.y + b.c.h - (a.c.y + a.c.h)).map(({ i }) => i);
  const nosFrutas = (raiz.filhos.find((n) => n.tipo === 'g' && n.id === 'frutas') as Extract<No, { tipo: 'g' }>);
  const pedacoDoNo = new Map<No, { ordem: number; caixa: Caixa }>();
  // os filhos de #frutas no SVG e na árvore estão na mesma ordem (só tem <g> e <path>)
  nosFrutas.filhos.forEach((n, i) => {
    const k = ordem.indexOf(i);
    if (k >= 0) pedacoDoNo.set(n, { ordem: k, caixa: caixas.get(elFrutas[i])! });
  });

  // bocas e arcos dos olhos gerados em código, a partir das caixas (como no mascote.ts do site)
  const cb = caixaDe('boca');
  const extras = criarExtras(cb, caixaDe('olho-esq'), caixaDe('olho-dir'));
  fora.remove();

  function emVolta(ctx: CanvasRenderingContext2D, c: Caixa, piv: [number, number], f: () => void) {
    const px = c.x + c.w * piv[0], py = c.y + c.h * piv[1];
    ctx.translate(px, py);
    f();
    ctx.translate(-px, -py);
  }

  function olho(ctx: CanvasRenderingContext2D, n: Extract<No, { tipo: 'path' }>, pose: Pose) {
    // o olho achata em direção à pálpebra e some enquanto o arco "◡" aparece
    const c = caixaDe(n.id!);
    const fechado = Math.min(1, Math.max(0, (0.45 - pose.abertura) / 0.35));
    ctx.save();
    ctx.globalAlpha = 1 - fechado;
    emVolta(ctx, c, PIVO[n.id!], () => ctx.scale(1, Math.max(0.05, pose.abertura)));
    ctx.fillStyle = n.cor;
    ctx.fill(n.p);
    ctx.restore();
    if (fechado > 0) desenharArco(ctx, extras.arcos[n.id!], n.cor, fechado);
  }

  function noh(ctx: CanvasRenderingContext2D, n: No, pose: Pose) {
    const pedaco = pedacoDoNo.get(n);
    if (pedaco) {
      const e = pose.frutas[pedaco.ordem] ?? 0;
      if (e < 0.01) return;
      ctx.save();
      emVolta(ctx, pedaco.caixa, [0.5, 1], () => ctx.scale(e, e)); // brota do fundo do cesto
      if (n.tipo === 'path') { ctx.fillStyle = n.cor; ctx.fill(n.p); }
      else n.filhos.forEach((f) => noh(ctx, f, pose));
      ctx.restore();
      return;
    }
    if (n.tipo === 'path') {
      if (n.id === 'olho-esq' || n.id === 'olho-dir') return olho(ctx, n, pose);
      ctx.fillStyle = n.cor;
      ctx.fill(n.p);
      return;
    }
    const id = n.id;
    if (!id) return n.filhos.forEach((f) => noh(ctx, f, pose));
    if (id === 'boca') return desenharBoca(ctx, n, pose, cb, extras);
    const c = caixaDe(id);
    ctx.save();
    if (id === 'braco-esq') emVolta(ctx, c, PIVO[id], () => ctx.rotate((pose.braco * Math.PI) / 180));
    else if (id === 'braco-dir') emVolta(ctx, c, PIVO[id], () => ctx.rotate((-pose.braco * Math.PI) / 180));
    else if (id === 'alca') emVolta(ctx, c, PIVO[id], () => ctx.scale(1, pose.alca));
    else if (id === 'frutas') ctx.translate(0, (pose.frutasY / 100) * c.h);
    n.filhos.forEach((f) => noh(ctx, f, pose));
    ctx.restore();
  }

  function desenharBoca(ctx: CanvasRenderingContext2D, n: Extract<No, { tipo: 'g' }>, pose: Pose, c: Caixa, ex: Extras) {
    ctx.save();
    if (pose.boca === 'aberta' || pose.boca === 'meia') {
      const alt = (pose.boca === 'meia' ? 0.55 : 1) * pose.bocaY;
      emVolta(ctx, c, PIVO.boca, () => ctx.scale(1, alt));
      n.filhos.forEach((f) => noh(ctx, f, pose));
    } else if (pose.boca === 'sorriso') {
      ctx.strokeStyle = ex.escuro;
      ctx.lineWidth = c.w * 0.11;
      ctx.lineCap = 'round';
      ctx.stroke(ex.sorriso);
    } else {
      ctx.fillStyle = ex.escuro;
      ctx.fill(ex.o);
      ctx.fillStyle = ex.lingua;
      ctx.fill(ex.linguaO);
    }
    ctx.restore();
  }

  return {
    caixa,
    pedacos: ordem.length,
    desenhar(ctx, pose, x, y, altura) {
      const k = altura / caixa.h;
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(k, k);
      // a raiz: gira e achata em volta da base, como `#mascote { transform-origin: 50% 100% }`
      ctx.rotate((pose.giro * Math.PI) / 180);
      ctx.scale(pose.sx, pose.sy);
      ctx.translate(-(caixa.x + caixa.w / 2), -(caixa.y + caixa.h));
      raiz.filhos.forEach((f) => noh(ctx, f, pose));
      ctx.restore();
    },
  };
}

// --- as peças geradas ------------------------------------------------------------------
type Extras = { sorriso: Path2D; o: Path2D; linguaO: Path2D; escuro: string; lingua: string; arcos: Record<string, { p: Path2D; largura: number }> };

function criarExtras(c: Caixa, olhoE: Caixa, olhoD: Caixa): Extras {
  // sorriso "◡": Bézier quadrática com o controle a 2× a fundura (passa a `fundura` da reta)
  const x0 = c.x + c.w * 0.11, x1 = c.x + c.w * 0.89, y = c.y + c.h * 0.18;
  const sorriso = new Path2D(`M ${x0} ${y} Q ${(x0 + x1) / 2} ${y + 2 * c.h * 0.42} ${x1} ${y}`);
  const rx = c.w * 0.23, ry = c.h * 0.5, cx = c.x + c.w / 2, cy = c.y + c.h * 0.5;
  const o = new Path2D();
  o.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  const linguaO = new Path2D();
  linguaO.ellipse(cx, cy + ry * 0.5, rx * 0.6, ry * 0.38, 0, 0, Math.PI * 2);
  const arco = (b: Caixa) => {
    const ya = b.y + b.h * 0.55, fundura = b.w * 0.32;
    return { p: new Path2D(`M ${b.x} ${ya} Q ${b.x + b.w / 2} ${ya + 2 * fundura} ${b.x + b.w} ${ya}`), largura: b.w * 0.2 };
  };
  return { sorriso, o, linguaO, escuro: '#452516', lingua: '#C5441E', arcos: { 'olho-esq': arco(olhoE), 'olho-dir': arco(olhoD) } };
}

function desenharArco(ctx: CanvasRenderingContext2D, a: { p: Path2D; largura: number }, cor: string, fechado: number) {
  ctx.save();
  ctx.globalAlpha = fechado;
  ctx.strokeStyle = cor;
  ctx.lineWidth = a.largura;
  ctx.lineCap = 'round';
  ctx.stroke(a.p);
  ctx.restore();
}
