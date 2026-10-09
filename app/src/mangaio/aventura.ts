// A aventura do Mangaio: um vídeo de retenção para a tela dividida, gerado na hora como os Pêndulos.
// O Mangaio atravessa o sertão a caminho da feira: pula uma pedra, pega três umbus que caem do
// umbuzeiro, dá um pulo duplo com pirueta por cima de um mandacaru e chega à barraca para dançar.
//
// Tudo é função do tempo (`t` → quadro), sem estado entre quadros: a galeria chama com o relógio da
// parede, o export chama quadro a quadro, e os dois dão a mesma imagem para o mesmo t. Por isso as
// molas do site (integradas com dt) viram aqui a SOLUÇÃO FECHADA da mola amortecida:
//   x(τ) = A · e^(−cτ/2) · cos(ω τ),  ω = √(k − c²/4)
// que é o que a integração do site aproxima. Ref.: The Nature of Code, cap. 3; Juice it or lose it (2012).
//
// O roteiro é marcado em BATIDAS do baião (116 BPM). Um ciclo = 32 batidas = 8 compassos de 4/4,
// o mesmo laço da trilha "Baião do Mangaio" (trilhas.ts): escolhendo essa trilha, os pulos, os pousos
// e os "plins" das frutas caem no tempo da música, e o vídeo emenda sem corte com a íris fechada.
import { type FormaBoca, POSE_NEUTRA, type Pose, marionete } from './marionete';

export const BPM = 116;
export const CICLO = 32; // batidas

// --- o roteiro ----------------------------------------------------------------------
// TODO(arthur): o roteiro é seu. Mudar uma batida aqui move a cena inteira (o cenário é posto no
// mundo a partir destes números) e o som junto (trilhas.ts lê SONS).
const S = 0.9; // velocidade da caminhada, em alturas do cesto por batida
const FREIA = 20; // começa a frear...
const PARA = 22; // ...e para na barraca
const PEDRA = { em: 6, dur: 1.6, alto: 0.75 }; // pulo simples: no alto bem em cima da pedra
const CACTO = { em: 17, ini: 15.7, dur1: 1.4, corta: 0.6, alto1: 0.7, alto2: 0.85 }; // pulo duplo com pirueta
const UMBUS = [10, 11, 12]; // batidas em que cada umbu cai no cesto
const QUEDA = 0.8; // batidas que o umbu leva caindo
const PISCADAS = [3.5, 13.5, 20.5, 24.5, 27.5];
const DANCA = { balanco: PARA, arretado: 26 };
const IRIS = { abre: 1.5, fecha: 30 }; // abre de 0 a 1,5; fecha de 30 a 32

const posMundo = (b: number) => (b < FREIA ? S * b : b < PARA ? S * (FREIA + (b - FREIA) - (b - FREIA) ** 2 / 4) : S * (FREIA + 1));
const X_BARRACA = posMundo(PARA);

// --- física do pulo (balística) ---------------------------------------------------------
// Pulo de duração D e altura h: g = 8h/D², v₀ = 4h/D. Em alturas do cesto e segundos.
const seg = (batidas: number) => (batidas * 60) / BPM;
type Voo = { y: number; vy: number; pirueta: number | null; pousou: number | null; vPouso: number };

function voo(b: number): Voo {
  const nada: Voo = { y: 0, vy: 0, pirueta: null, pousou: null, vPouso: 0 };
  // pedra
  {
    const ini = PEDRA.em - PEDRA.dur / 2, D = seg(PEDRA.dur), g = (8 * PEDRA.alto) / D ** 2, v0 = (4 * PEDRA.alto) / D;
    const τ = seg(b - ini);
    if (τ >= 0 && τ <= D) return { y: v0 * τ - (g * τ * τ) / 2, vy: v0 - g * τ, pirueta: null, pousou: null, vPouso: 0 };
    if (τ > D && τ < D + 1.5) return { ...nada, pousou: τ - D, vPouso: v0 };
  }
  // cacto: o segundo impulso vem antes de o primeiro pulo terminar (como o pulo duplo das brincadeiras)
  {
    const D1 = seg(CACTO.dur1), g = (8 * CACTO.alto1) / D1 ** 2, v1 = (4 * CACTO.alto1) / D1;
    const t2 = D1 * CACTO.corta;
    const y2 = v1 * t2 - (g * t2 * t2) / 2;
    const v2 = Math.sqrt(2 * g * CACTO.alto2); // sobe mais alto2 a partir de onde está
    const D2 = (v2 + Math.sqrt(v2 * v2 + 2 * g * y2)) / g; // até tocar o chão
    const τ = seg(b - CACTO.ini);
    if (τ >= 0 && τ < t2) return { y: v1 * τ - (g * τ * τ) / 2, vy: v1 - g * τ, pirueta: null, pousou: null, vPouso: 0 };
    const τ2 = τ - t2;
    if (τ2 >= 0 && τ2 <= D2) return { y: y2 + v2 * τ2 - (g * τ2 * τ2) / 2, vy: v2 - g * τ2, pirueta: τ2 / D2, pousou: null, vPouso: 0 };
    if (τ2 > D2 && τ2 < D2 + 1.5) return { ...nada, pousou: τ2 - D2, vPouso: g * D2 - v2 };
  }
  return nada;
}

/** quando cada coisa soa, em batidas do ciclo (trilhas.ts agenda o som a partir daqui) */
export const SONS: { tipo: 'pulo' | 'pouso' | 'plim' | 'pirueta'; batida: number; grau?: number }[] = (() => {
  const pedraIni = PEDRA.em - PEDRA.dur / 2;
  const D1 = seg(CACTO.dur1), g = (8 * CACTO.alto1) / D1 ** 2, v1 = (4 * CACTO.alto1) / D1;
  const t2 = D1 * CACTO.corta, y2 = v1 * t2 - (g * t2 * t2) / 2, v2 = Math.sqrt(2 * g * CACTO.alto2);
  const D2 = (v2 + Math.sqrt(v2 * v2 + 2 * g * y2)) / g;
  const emBatidas = (s: number) => (s * BPM) / 60;
  return [
    { tipo: 'pulo', batida: pedraIni },
    { tipo: 'pouso', batida: pedraIni + PEDRA.dur },
    ...UMBUS.map((batida, i) => ({ tipo: 'plim' as const, batida, grau: i })),
    { tipo: 'pulo', batida: CACTO.ini },
    { tipo: 'pirueta', batida: CACTO.ini + emBatidas(t2) },
    { tipo: 'pouso', batida: CACTO.ini + emBatidas(t2 + D2) },
  ];
})();

// --- molas em forma fechada -----------------------------------------------------------
/** oscilação amortecida que começa em `a` e assenta em 0 */
const amortece = (τ: number, a: number, k: number, c: number) => (τ < 0 ? 0 : a * Math.exp((-c * τ) / 2) * Math.cos(Math.sqrt(k - (c * c) / 4) * τ));
/** resposta ao degrau: sai de 0, passa um pouco do ponto e assenta em 1 (o "pop") */
function pop(τ: number, k = 420, c = 14) {
  if (τ <= 0) return 0;
  const w = Math.sqrt(k - (c * c) / 4);
  return 1 - Math.exp((-c * τ) / 2) * (Math.cos(w * τ) + (c / (2 * w)) * Math.sin(w * τ));
}
const suave = (p: number) => p * p * (3 - 2 * p);
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

// --- a pose do Mangaio ------------------------------------------------------------------
// Quadros-chave do pulinho da caminhada, os mesmos do site: [fase, y (% da altura), sx, sy]
const PULINHO: [number, number, number, number][] = [
  [0, 0, 1.06, 0.93], [0.2, 0, 1.1, 0.88], [0.5, -9, 0.94, 1.08], [0.85, -1, 1, 1], [1, 0, 1.06, 0.93],
];
function pulinho(fase: number, altura: number) {
  for (let i = 0; i < PULINHO.length - 1; i++) {
    const [f0, y0, sx0, sy0] = PULINHO[i], [f1, y1, sx1, sy1] = PULINHO[i + 1];
    if (fase >= f0 && fase <= f1) {
      const p = suave((fase - f0) / (f1 - f0));
      return { y: (y0 + (y1 - y0) * p) * altura, sx: sx0 + (sx1 - sx0) * p, sy: sy0 + (sy1 - sy0) * p };
    }
  }
  return { y: 0, sx: 1, sy: 1 };
}

// a dança do site (mascote.ts), sem mudança: um lado por batida, quique na batida
const PASSOS = {
  balanco: { balanco: 6, batidasPorLado: 1, quique: 0.06, pulo: 0 },
  arretado: { balanco: 9, batidasPorLado: 0.5, quique: 0.09, pulo: 5 },
};
function danca(b: number, passo: keyof typeof PASSOS) {
  const j = PASSOS[passo];
  const f = b - Math.floor(b);
  const lado = Math.floor(b / j.batidasPorLado) % 2 === 0 ? 1 : -1;
  const p = suave(Math.min(1, ((b / j.batidasPorLado) % 1) * 2));
  const giro = -lado * j.balanco + 2 * lado * j.balanco * p;
  const q = Math.max(0, 1 - f * 4);
  return { y: -j.pulo * Math.sin(Math.PI * f), giro, sx: 1 + j.quique * q, sy: 1 - j.quique * 1.2 * q, braco: giro * 2.5 };
}

/** abertura dos olhos: fecha rápido e abre devagar (a pálpebra cai e sobe com calma) */
function abertura(b: number) {
  const DUR = 0.28; // s
  for (const p of PISCADAS) {
    const u = seg(b - p) / DUR;
    if (u >= 0 && u <= 1) return u < 0.35 ? 1 - 0.9 * suave(u / 0.35) : 0.1 + 0.9 * suave((u - 0.35) / 0.65);
  }
  return 1;
}

function pedacosNoCesto(b: number, n: number): number[] {
  // cada umbu faz aparecer um terço dos pedaços, de baixo para cima, um logo depois do outro
  return Array.from({ length: n }, (_, i) => {
    const qual = Math.floor((i * UMBUS.length) / n);
    const primeiro = Math.ceil((qual * n) / UMBUS.length);
    return pop(seg(b - UMBUS[qual]) - 0.06 * (i - primeiro));
  });
}

function pose(b: number): { pose: Pose; y: number } {
  const m = marionete();
  const v = voo(b);
  const t = seg(b);
  let p: Pose = { ...POSE_NEUTRA, frutas: pedacosNoCesto(b, m.pedacos), abertura: abertura(b) };
  let y = 0; // altura do chão, em alturas do cesto

  if (v.y > 0) {
    // no ar: a forma sai da velocidade (estica correndo, até 18%), como o pulo da colheita
    const s = 1 + Math.min(0.18, Math.abs(v.vy) * 0.025);
    const alto = Math.min(1, v.y / 0.5);
    const volta = v.pirueta == null ? 1 : Math.cos(2 * Math.PI * suave(v.pirueta));
    y = v.y;
    p = {
      ...p, sx: volta / s, sy: s, giro: -v.vy * 1.2 + 2,
      braco: -alto * 35 + Math.sin(t * 28) * 9 * alto,
      alca: 1 - v.vy * 0.035, frutasY: v.vy * 0.9, boca: 'aberta', bocaY: 1 + 0.5 * alto,
    };
  } else if (b >= DANCA.balanco) {
    const d = danca(b, b >= DANCA.arretado ? 'arretado' : 'balanco');
    y = -d.y / 100;
    const ab = Math.floor(b * 2) % 2 === 0;
    p = { ...p, giro: d.giro, sx: d.sx, sy: d.sy, braco: d.braco, boca: ab ? 'aberta' : 'meia' };
  } else {
    // caminhando: um pulinho por batida, o corpo indo na frente e os braços balançando
    const freando = clamp01((b - FREIA) / (PARA - FREIA));
    const h = pulinho(b % 1, 0.7 * (1 - freando));
    y = -h.y / 100;
    p = { ...p, sx: h.sx, sy: h.sy, giro: 3 * (1 - freando) + Math.sin(Math.PI * b) * 2, braco: Math.sin(Math.PI * b) * 14 };
  }

  // o pouso: achata de uma vez e volta numa mola; alça e frutas continuam e balançam
  if (v.pousou !== null) {
    const amasso = amortece(v.pousou, 0.22, 260, 14);
    p = { ...p, sy: p.sy * (1 - amasso), sx: p.sx * (1 + amasso) };
    p.alca = 1 + amortece(v.pousou, v.vPouso * 0.035, 320, 9);
    p.frutasY = -amortece(v.pousou, v.vPouso * 0.9, 320, 9);
  }

  // pegando os umbus: "o!" no instante, sorriso depois, e o cesto engole (achata um pouco)
  let boca: FormaBoca = p.boca;
  for (const u of UMBUS) {
    const τ = seg(b - u);
    if (τ >= -0.12 && τ < 0.3 && v.y <= 0 && b < DANCA.balanco) boca = 'o';
    const engole = amortece(τ, 0.1, 300, 12);
    p = { ...p, sy: p.sy * (1 - engole), sx: p.sx * (1 + engole), frutasY: p.frutasY + amortece(τ, 8, 320, 9) };
  }
  return { pose: { ...p, boca }, y };
}

// --- o cenário ------------------------------------------------------------------------
const COR = {
  ceu: '#F8F4D0', horizonte: '#F7D88A', sol: '#F0B400', serraLonge: '#E8B575', serraPerto: '#D08C4E',
  chao: '#C9733A', chaoBorda: '#9C5023', verde: '#4F7F45', verdeEscuro: '#3F6925', marrom: '#4A2A15',
  creme: '#F8F4D0', terracota: '#9C5023', tomate: '#D2461F', laranja: '#F59A1E', mostarda: '#F0B400', umbu: '#B7C548',
};

/** acaso determinístico: o mesmo número para a mesma posição, quadro após quadro */
const acaso = (i: number) => { const s = Math.sin(i * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

type Cena = { ctx: CanvasRenderingContext2D; x: number; y: number; w: number; h: number; H: number; chao: number; mx: number; pos: number };
/** posição na tela de um ponto do mundo (em alturas do cesto); `fundo` < 1 anda mais devagar (paralaxe) */
const telaX = (c: Cena, X: number, fundo = 1) => c.mx + (X - c.pos * fundo) * c.H;

function ceu(c: Cena, b: number) {
  const { ctx, x, y, w, h, H } = c;
  const g = ctx.createLinearGradient(0, y, 0, c.chao);
  g.addColorStop(0, COR.ceu); g.addColorStop(1, COR.horizonte);
  ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
  // o sol, com raios girando devagar (xilogravura: raios em cunha)
  const sx = x + w * 0.8, sy = y + h * 0.2, r = H * 0.32;
  ctx.fillStyle = COR.sol;
  ctx.save(); ctx.translate(sx, sy); ctx.rotate(b * 0.05);
  for (let i = 0; i < 12; i++) {
    ctx.rotate(Math.PI / 6);
    ctx.beginPath(); ctx.moveTo(-r * 0.18, r * 1.2); ctx.lineTo(0, r * 1.75); ctx.lineTo(r * 0.18, r * 1.2); ctx.fill();
  }
  ctx.restore();
  ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI * 2); ctx.fill();
}

function serra(c: Cena, fundo: number, base: number, alto: number, cor: string, semente: number) {
  const { ctx, x, w, H } = c;
  ctx.fillStyle = cor;
  ctx.beginPath(); ctx.moveTo(x, c.chao + 2);
  for (let px = 0; px <= w + 8; px += 8) {
    const X = (px - (c.mx - x)) / H + c.pos * fundo; // ponto do mundo sob este pixel
    const hh = Math.sin(X * 0.9 + semente) * 0.5 + Math.sin(X * 0.37 + semente * 2) * 0.8 + 1.4;
    ctx.lineTo(x + px, c.chao - base * H - hh * alto * H);
  }
  ctx.lineTo(x + w + 8, c.chao + 2); ctx.fill();
}

function mandacaru(ctx: CanvasRenderingContext2D, px: number, chao: number, alto: number, cor: string, sombra: string) {
  const l = alto * 0.16;
  const tronco = (x0: number, y0: number, hh: number) => { ctx.beginPath(); ctx.roundRect(x0 - l / 2, y0 - hh, l, hh, l / 2); ctx.fill(); };
  ctx.fillStyle = cor;
  tronco(px, chao, alto);
  // braços em "U", como o mandacaru de cordel
  ctx.beginPath(); ctx.roundRect(px - l * 1.9, chao - alto * 0.5, l * 1.9, l * 0.8, l / 2.5); ctx.fill();
  tronco(px - l * 1.5, chao - alto * 0.42, alto * 0.38);
  ctx.beginPath(); ctx.roundRect(px, chao - alto * 0.65, l * 1.7, l * 0.8, l / 2.5); ctx.fill();
  tronco(px + l * 1.3, chao - alto * 0.57, alto * 0.3);
  ctx.strokeStyle = sombra; ctx.lineWidth = Math.max(1, l * 0.12);
  ctx.beginPath(); ctx.moveTo(px, chao - alto * 0.92); ctx.lineTo(px, chao - 2); ctx.stroke();
}

function chao(c: Cena) {
  const { ctx, x, y, w, h, H } = c;
  ctx.fillStyle = COR.chao; ctx.fillRect(x, c.chao, w, y + h - c.chao);
  ctx.fillStyle = COR.chaoBorda; ctx.fillRect(x, c.chao, w, Math.max(2, H * 0.03));
  // pedrinhas e tufos de capim: um a cada 0,6 cesto do mundo
  const de = Math.floor(c.pos - (c.mx - x) / H) - 1, ate = Math.ceil(c.pos + (x + w - c.mx) / H) + 1;
  for (let i = de / 0.6; i <= ate / 0.6; i++) {
    const k = Math.floor(i), X = k * 0.6 + acaso(k) * 0.5, px = telaX(c, X);
    const fundura = c.chao + H * (0.08 + acaso(k + 9) * 0.3);
    if (acaso(k + 3) < 0.55) {
      ctx.fillStyle = COR.chaoBorda;
      ctx.beginPath(); ctx.ellipse(px, fundura, H * (0.03 + acaso(k + 5) * 0.04), H * 0.02, 0, 0, Math.PI * 2); ctx.fill();
    } else if (acaso(k + 7) < 0.5) {
      ctx.strokeStyle = COR.verdeEscuro; ctx.lineWidth = Math.max(1, H * 0.015);
      for (let f = -1; f <= 1; f++) { ctx.beginPath(); ctx.moveTo(px, c.chao + 1); ctx.lineTo(px + f * H * 0.04, c.chao - H * 0.08); ctx.stroke(); }
    }
  }
}

function pedra(c: Cena) {
  const px = telaX(c, S * PEDRA.em), { ctx, H } = c;
  ctx.fillStyle = '#8C7560';
  ctx.beginPath(); ctx.ellipse(px, c.chao, H * 0.32, H * 0.3, 0, Math.PI, 0); ctx.fill();
  ctx.fillStyle = '#A58C72';
  ctx.beginPath(); ctx.ellipse(px - H * 0.08, c.chao - H * 0.14, H * 0.12, H * 0.08, -0.4, 0, Math.PI * 2); ctx.fill();
}

const COPA = { alto: 1.75, rx: 1.45, ry: 0.55 };
function umbuzeiro(c: Cena, b: number) {
  const { ctx, H } = c;
  const px = telaX(c, S * 11), copaY = c.chao - COPA.alto * H;
  ctx.fillStyle = COR.marrom;
  ctx.beginPath();
  ctx.moveTo(px - H * 0.12, c.chao); ctx.lineTo(px - H * 0.06, copaY); ctx.lineTo(px + H * 0.06, copaY); ctx.lineTo(px + H * 0.14, c.chao); ctx.fill();
  ctx.fillStyle = COR.verdeEscuro;
  ctx.beginPath(); ctx.ellipse(px, copaY, COPA.rx * H, COPA.ry * H, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = COR.verde;
  for (let i = 0; i < 6; i++) {
    ctx.beginPath(); ctx.ellipse(px + (i - 2.5) * H * 0.48, copaY - H * 0.12 * Math.sin(i * 1.7), H * 0.42, H * 0.3, 0, 0, Math.PI * 2); ctx.fill();
  }
  // os umbus que ainda não caíram, pendurados embaixo da copa
  UMBUS.forEach((u) => { if (b < u - QUEDA) umbu(ctx, telaX(c, posMundo(u)), copaY + COPA.ry * H * 0.7, H); });
}

function umbu(ctx: CanvasRenderingContext2D, px: number, py: number, H: number) {
  const r = H * 0.075;
  ctx.fillStyle = COR.umbu; ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.beginPath(); ctx.arc(px - r * 0.35, py - r * 0.35, r * 0.3, 0, Math.PI * 2); ctx.fill();
}

/** os umbus caindo: em pé no mundo, retos para baixo; quem chega embaixo na hora é o cesto */
function umbusCaindo(c: Cena, b: number, topoCesto: number) {
  const copaY = c.chao - COPA.alto * c.H + COPA.ry * c.H * 0.7;
  for (const u of UMBUS) {
    const p = (b - (u - QUEDA)) / QUEDA;
    if (p < 0 || p >= 1) continue;
    umbu(c.ctx, telaX(c, posMundo(u)), copaY + (topoCesto - copaY) * p * p, c.H); // p²: cai acelerando
  }
}

function barraca(c: Cena, b: number) {
  const { ctx, H } = c;
  const px = telaX(c, X_BARRACA + 0.15), larg = 3.2 * H, topo = c.chao - 2.15 * H;
  const esq = px - larg / 2;
  // varas
  ctx.fillStyle = COR.marrom;
  ctx.fillRect(esq + H * 0.1, topo, H * 0.07, c.chao - topo);
  ctx.fillRect(esq + larg - H * 0.17, topo, H * 0.07, c.chao - topo);
  // bandeirinhas acima do toldo, sacudindo no tempo
  const cores = [COR.tomate, COR.mostarda, COR.verde, COR.laranja, COR.creme];
  ctx.strokeStyle = COR.marrom; ctx.lineWidth = Math.max(1, H * 0.01);
  ctx.beginPath(); ctx.moveTo(esq - H * 0.4, topo - H * 0.35); ctx.quadraticCurveTo(px, topo + H * 0.05, esq + larg + H * 0.4, topo - H * 0.35); ctx.stroke();
  for (let i = 0; i < 11; i++) {
    const u = (i + 0.5) / 11, fx = esq - H * 0.4 + (larg + H * 0.8) * u;
    // na mesma Bézier do cordão: y = (1−u)²·y0 + 2u(1−u)·yc + u²·y0
    const y0 = topo - H * 0.35, yc = topo + H * 0.05;
    const fy = (1 - u) ** 2 * y0 + 2 * u * (1 - u) * yc + u * u * y0;
    const sacode = Math.sin(b * Math.PI + i) * 0.15;
    ctx.save(); ctx.translate(fx, fy); ctx.rotate(sacode);
    ctx.fillStyle = cores[i % cores.length];
    ctx.beginPath(); ctx.moveTo(-H * 0.09, 0); ctx.lineTo(H * 0.09, 0); ctx.lineTo(H * 0.09, H * 0.2); ctx.lineTo(0, H * 0.14); ctx.lineTo(-H * 0.09, H * 0.2); ctx.fill();
    ctx.restore();
  }
  // toldo listrado verde e creme, com a barra arredondada (o mesmo desenho do toldo.svg)
  const n = 7, faixa = larg / n, alt = H * 0.5;
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = i % 2 ? COR.creme : COR.verde;
    ctx.beginPath(); ctx.roundRect(esq + i * faixa, topo, faixa + 0.5, alt, [0, 0, faixa / 2, faixa / 2]); ctx.fill();
  }
  // bancada com caixotes de frutas
  const bancY = c.chao - H * 0.55;
  ctx.fillStyle = COR.terracota; ctx.fillRect(esq + H * 0.05, bancY, larg - H * 0.1, H * 0.1);
  ctx.fillStyle = '#7A3E1A'; ctx.fillRect(esq + H * 0.15, bancY + H * 0.1, larg - H * 0.3, c.chao - bancY - H * 0.1);
  const frutas = [COR.tomate, COR.laranja, COR.umbu, COR.mostarda];
  for (let k = 0; k < 4; k++) {
    const cx = esq + larg * (0.14 + k * 0.24), cor = frutas[k];
    ctx.fillStyle = '#B9773D'; ctx.fillRect(cx - H * 0.25, bancY - H * 0.16, H * 0.5, H * 0.16);
    ctx.fillStyle = cor;
    for (let f = 0; f < 4; f++) { ctx.beginPath(); ctx.arc(cx - H * 0.18 + f * H * 0.12, bancY - H * 0.17 - (f % 2) * H * 0.04, H * 0.07, 0, Math.PI * 2); ctx.fill(); }
  }
}

/** poeira no pouso: bolinhas que se abrem e somem em meio segundo */
function poeira(c: Cena, b: number) {
  for (const s of SONS) {
    if (s.tipo !== 'pouso') continue;
    const τ = seg(b - s.batida);
    if (τ < 0 || τ > 0.5) continue;
    const u = τ / 0.5;
    c.ctx.fillStyle = `rgba(156, 80, 35, ${0.45 * (1 - u)})`;
    for (let i = 0; i < 6; i++) {
      const lado = i % 2 ? 1 : -1, d = (0.25 + (i >> 1) * 0.12 + u * 0.35) * c.H;
      c.ctx.beginPath(); c.ctx.arc(c.mx + lado * d, c.chao - c.H * (0.03 + u * 0.08 * (1 + (i >> 1))), c.H * 0.06 * (1 - u * 0.5), 0, Math.PI * 2); c.ctx.fill();
    }
  }
}

/** a íris do desenho animado: um círculo que abre no começo e fecha no fim, em volta do Mangaio */
function iris(c: Cena, b: number, cx: number, cy: number) {
  const abre = b < IRIS.abre ? 1 - (1 - b / IRIS.abre) ** 3 : b >= IRIS.fecha ? 1 - suave((b - IRIS.fecha) / (CICLO - IRIS.fecha)) : 1;
  if (abre >= 1) return;
  const { ctx, x, y, w, h } = c;
  const R = Math.hypot(w, h) * abre;
  ctx.fillStyle = '#2A1608';
  ctx.beginPath(); ctx.rect(x, y, w, h); ctx.arc(cx, cy, Math.max(0, R), 0, Math.PI * 2);
  ctx.fill('evenodd');
}

// --- o quadro ---------------------------------------------------------------------------
export function desenharAventura(ctx: CanvasRenderingContext2D, t: number, x: number, y: number, w: number, h: number) {
  const b = (((t * BPM) / 60) % CICLO + CICLO) % CICLO;
  const H = Math.min(h * 0.34, w * 0.42); // altura do cesto na tela
  const c: Cena = { ctx, x, y, w, h, H, chao: y + h * 0.84, mx: x + w * 0.36, pos: posMundo(b) };
  ctx.save();
  ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();

  ceu(c, b);
  serra(c, 0.12, 0.25, 0.45, COR.serraLonge, 1);
  serra(c, 0.3, 0.05, 0.3, COR.serraPerto, 4);
  // mandacarus ao fundo, andando a meia velocidade
  for (let i = Math.floor(c.pos * 0.5 / 2.6) - 2; i < Math.floor(c.pos * 0.5 / 2.6) + 6; i++) {
    const X = i * 2.6 + acaso(i) * 1.2;
    mandacaru(ctx, telaX(c, X, 0.5), c.chao, H * (0.55 + acaso(i + 2) * 0.35), '#7C9A55', '#5E7E40');
  }
  chao(c);
  umbuzeiro(c, b);
  barraca(c, b);
  pedra(c);
  mandacaru(ctx, telaX(c, S * CACTO.em), c.chao, H * 1.15, COR.verde, COR.verdeEscuro);

  const { pose: p, y: alto } = pose(b);
  // sombra: encolhe e clareia com a altura
  const longe = Math.min(1, alto / 1.2);
  ctx.fillStyle = `rgba(74, 42, 21, ${0.22 * (1 - longe * 0.6)})`;
  ctx.beginPath(); ctx.ellipse(c.mx, c.chao + H * 0.01, H * 0.42 * (1 - longe * 0.5), H * 0.06 * (1 - longe * 0.5), 0, 0, Math.PI * 2); ctx.fill();
  poeira(c, b);
  const base = c.chao - alto * H;
  marionete().desenhar(ctx, p, c.mx, base, H);
  umbusCaindo(c, b, base - H * 0.62);

  iris(c, b, c.mx, base - H * 0.5);
  ctx.restore();
}
