// A dança do Mangaio: um vídeo de retenção em que o cesto dança no palco da feira, com cortes de câmera
// como os edits de dança de anime (plano aberto, plano fechado, corte seco na batida). A coreografia veio
// de um desses edits e foi traduzida para um cesto sem pernas:
//   1. soquinho (b 0–8): quique em cada batida, quadril de um lado pro outro, punhos alternando na frente;
//   2. rodopio (b 8–16): braço aberto e um pulo com pirueta, duas vezes, uma para cada lado;
//   3. colado (b 16–24): plano fechado, balança de um lado pro outro com os braços abertos, olhinho fechado;
//   4. arretado (b 24–32): quatro pulinhos, um em cada batida, e o pulão com pirueta dupla que fecha o laço.
//
// As frutas do cesto são do arturo.ai, soltas, cada uma com o seu peso (cesto.ts): elas sentem o impulso,
// sobem no pulo e quicam no pouso por conta própria, sem curva desenhada à mão.
//
// Mesmo relógio da Aventura (116 BPM, 32 batidas = 8 compassos): a trilha "Baião da Dança" (trilhas.ts) tem
// o mesmo laço, com os pulos e pousos daqui gravados dentro.
import { cestoDeFrutas } from './cesto';
import { type FormaBoca, POSE_NEUTRA, type Pose, marionete } from './marionete';

export const BPM = 116;
export const CICLO = 32; // batidas

const seg = (batidas: number) => (batidas * 60) / BPM;
const DURACAO = seg(CICLO);

// --- o roteiro ----------------------------------------------------------------------
// TODO(arthur): a coreografia é sua. Cada pulo: começa em `ini`, dura `dur` batidas, sobe `alto` alturas do
// cesto e dá `voltas` piruetas (o sinal escolhe o lado). O agachamento vem antes de `ini`, o pouso depois.
type Pulo = { ini: number; dur: number; alto: number; voltas: number };
const PULOS: Pulo[] = [
  { ini: 9, dur: 1.5, alto: 0.6, voltas: 1 },
  { ini: 13, dur: 1.5, alto: 0.6, voltas: -1 },
  { ini: 24, dur: 0.6, alto: 0.2, voltas: 0 },
  { ini: 25, dur: 0.6, alto: 0.2, voltas: 0 },
  { ini: 26, dur: 0.6, alto: 0.2, voltas: 0 },
  { ini: 27, dur: 0.6, alto: 0.25, voltas: 0 },
  { ini: 28.5, dur: 2, alto: 0.85, voltas: 2 },
];
const AGACHA = 0.4; // batidas de agachamento antes de cada pulo
const PARTES = { soquinho: 0, rodopio: 8, colado: 16, arretado: 24 };
const PISCADAS = [2.5, 6.5, 12.2, 27.6];

// os planos: corte seco na batida, como no edit. zoom = altura do cesto / altura do quadro; foco = que
// altura do Mangaio fica no meio (0 = pé, 1 = topo da alça)
type Plano = { de: number; zoom: number; foco: number; fundo: 'feira' | 'raios' };
const PLANOS: Plano[] = [
  { de: 0, zoom: 0.36, foco: 0.55, fundo: 'feira' },
  { de: 4, zoom: 0.46, foco: 0.5, fundo: 'raios' },
  { de: 8, zoom: 0.36, foco: 0.7, fundo: 'feira' },
  { de: 12, zoom: 0.36, foco: 0.7, fundo: 'feira' },
  { de: 16, zoom: 0.62, foco: 0.85, fundo: 'raios' },
  { de: 20, zoom: 0.5, foco: 0.6, fundo: 'feira' },
  { de: 22, zoom: 0.62, foco: 0.85, fundo: 'raios' },
  { de: 24, zoom: 0.36, foco: 0.75, fundo: 'feira' },
];

// --- molas e curvas ------------------------------------------------------------------
const amortece = (τ: number, a: number, k: number, c: number) => (τ < 0 ? 0 : a * Math.exp((-c * τ) / 2) * Math.cos(Math.sqrt(k - (c * c) / 4) * τ));
const suave = (p: number) => p * p * (3 - 2 * p);
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const mistura = (a: number, b: number, p: number) => a + (b - a) * p;

/** gravidade e velocidade de saída do pulo: g = 8h/D², v₀ = 4h/D (em alturas do cesto e segundos) */
const balistica = (p: Pulo) => { const D = seg(p.dur); return { D, g: (8 * p.alto) / D ** 2, v0: (4 * p.alto) / D }; };

type Voo = { y: number; vy: number; fase: number; pulo: Pulo } | null;
function noAr(b: number): Voo {
  for (const p of PULOS) {
    const { D, g, v0 } = balistica(p);
    const τ = seg(b - p.ini);
    if (τ >= 0 && τ <= D) return { y: v0 * τ - (g * τ * τ) / 2, vy: v0 - g * τ, fase: τ / D, pulo: p };
  }
  return null;
}
/** o agachamento antes do pulo, de 0 a 1 */
function agachado(b: number) {
  for (const p of PULOS) {
    const u = (b - (p.ini - AGACHA)) / AGACHA;
    if (u >= 0 && u < 1) return { u: suave(u), pulo: p };
  }
  return null;
}
/** segundos desde o último pouso (e a velocidade dele), se foi há pouco */
function pousou(b: number) {
  for (const p of PULOS) {
    const { D, g, v0 } = balistica(p);
    const τ = seg(b - p.ini) - D;
    if (τ >= 0 && τ < 1.6) return { τ, v: g * D - v0 };
  }
  return null;
}

// --- os passos (fora do ar) ----------------------------------------------------------
type Corpo = { x: number; y: number; giro: number; sx: number; sy: number; braco: number; bracoDir: number };

/** quique na batida: achata no tempo, estica no contratempo (o "pulinho" do site, sem sair do chão) */
function quique(b: number, forca: number) {
  const f = b - Math.floor(b);
  const desce = Math.exp(-f * 7) * Math.cos(f * Math.PI * 2); // pico no tempo, devolve na metade
  return { y: forca * 0.05 * Math.max(0, Math.sin(Math.PI * f)) ** 2, sx: 1 + forca * 0.07 * desce, sy: 1 - forca * 0.08 * desce };
}

function soquinho(b: number): Corpo {
  const q = quique(b, 0.8);
  const lado = Math.sin((Math.PI * b) / 2); // o quadril vai e volta a cada 2 batidas
  // punhos alternados, devagar: um vem para a frente enquanto o outro volta
  // (braço: negativo = mão para a frente do corpo, positivo = para fora; a mão não tem braço, então giro pequeno)
  const soco = (fase: number) => -8 - 14 * Math.sin((Math.PI * (b + fase)) / 2) ** 2;
  return { x: lado * 0.07, y: q.y, giro: lado * 4, sx: q.sx, sy: q.sy, braco: soco(0), bracoDir: soco(1) };
}

function rodopio(b: number): Corpo {
  const q = quique(b, 0.6);
  const lado = Math.sin((Math.PI * b) / 2);
  // braço direito aberto (chama o rodopio), o esquerdo quieto na cintura
  return { x: 0, y: q.y, giro: lado * 3, sx: q.sx, sy: q.sy, braco: -5, bracoDir: 40 + Math.sin((Math.PI * b) / 2) * 5 };
}

function colado(b: number): Corpo {
  const q = quique(b, 0.6);
  // de um lado pro outro, um lado por batida, chegando devagar em cada ponta
  const f = b % 2, lado = f < 1 ? -1 + 2 * suave(f) : 1 - 2 * suave(f - 1);
  const torcida = 30 + 6 * Math.sin(Math.PI * b); // os dois braços abertos, balançando junto com o corpo
  return { x: lado * 0.04, y: q.y, giro: lado * 7, sx: q.sx, sy: q.sy, braco: torcida, bracoDir: torcida };
}

function arretado(b: number): Corpo {
  const q = quique(b, 0.9);
  return { x: 0, y: q.y, giro: Math.sin(Math.PI * b) * 3, sx: q.sx, sy: q.sy, braco: -15, bracoDir: -15 };
}

const PASSOS: [number, (b: number) => Corpo][] = [
  [PARTES.soquinho, soquinho], [PARTES.rodopio, rodopio], [PARTES.colado, colado], [PARTES.arretado, arretado],
];
const TROCA = 0.5; // batidas de mistura entre um passo e o próximo

function passo(b: number): Corpo {
  let i = PASSOS.length - 1;
  while (i > 0 && b < PASSOS[i][0]) i--;
  const atual = PASSOS[i][1](b);
  // mistura com o anterior no começo de cada passo (o primeiro mistura com o último: o laço emenda)
  const ini = PASSOS[i][0], p = (b - ini) / TROCA;
  if (p >= 1) return atual;
  const ant = PASSOS[(i + PASSOS.length - 1) % PASSOS.length][1](b);
  const s = suave(clamp01(p));
  const r = {} as Corpo;
  for (const k of Object.keys(atual) as (keyof Corpo)[]) r[k] = mistura(ant[k], atual[k], s);
  return r;
}

// --- a pose do Mangaio ------------------------------------------------------------------
type Quadro = { pose: Pose; x: number; y: number };

function abertura(b: number) {
  const DUR = 0.28;
  for (const p of PISCADAS) {
    const u = seg(b - p) / DUR;
    if (u >= 0 && u <= 1) return u < 0.35 ? 1 - 0.9 * suave(u / 0.35) : 0.1 + 0.9 * suave((u - 0.35) / 0.65);
  }
  return 1;
}

function quadro(b: number): Quadro {
  const c = passo(b);
  let pose: Pose = { ...POSE_NEUTRA, giro: c.giro, sx: c.sx, sy: c.sy, braco: c.braco, bracoDir: c.bracoDir, abertura: abertura(b) };
  let y = c.y;
  let boca: FormaBoca = Math.floor(b) % 2 === 0 ? 'aberta' : 'meia';

  // no colado, olhinho fechado de alegria nas batidas pares, como no close do edit
  if (b >= PARTES.colado && b < PARTES.arretado) {
    const f = b % 4;
    if (f >= 1.5 && f < 3.5) pose.abertura = 0.1 + 0.9 * (1 - suave(clamp01((f - 1.5) / 0.3))) + 0.9 * suave(clamp01((f - 3.2) / 0.3));
    boca = 'aberta';
  }

  const ag = agachado(b);
  if (ag) {
    // antecipação: afunda e alarga antes de subir; braços descem juntando força
    const fundo = 0.16 + 0.06 * ag.pulo.alto;
    pose = { ...pose, sy: pose.sy * (1 - fundo * ag.u), sx: pose.sx * (1 + fundo * 0.8 * ag.u), braco: mistura(pose.braco, 10, ag.u), giro: pose.giro * (1 - ag.u) };
    pose.bracoDir = mistura(pose.bracoDir!, 10, ag.u);
    boca = 'sorriso';
  }

  const v = noAr(b);
  if (v) {
    // estica com a velocidade (até 18%), braços abrem; a pirueta é o cesto virando de lado (sx passa por 0)
    const s = 1 + Math.min(0.18, Math.abs(v.vy) * 0.03);
    const alto = Math.min(1, v.y / 0.4);
    const volta = v.pulo.voltas === 0 ? 1 : Math.cos(2 * Math.PI * Math.abs(v.pulo.voltas) * suave(v.fase));
    y = v.y;
    const braco = 10 + alto * 30; // abre devagar com a altura, sem chacoalhar
    pose = {
      ...pose, sx: volta / s, sy: s, giro: -v.vy * 0.8 * Math.sign(v.pulo.voltas || 1),
      braco, bracoDir: braco, alca: 1 - v.vy * 0.025,
    };
    boca = alto > 0.6 ? 'o' : 'aberta';
    pose.bocaY = 1 + 0.4 * alto;
  }

  const po = pousou(b);
  if (po) {
    // achata de uma vez e volta numa mola; a alça segue balançando
    const amasso = amortece(po.τ, Math.min(0.28, 0.06 * po.v), 260, 14);
    pose = { ...pose, sy: pose.sy * (1 - amasso), sx: pose.sx * (1 + amasso) };
    pose.alca = 1 + amortece(po.τ, po.v * 0.03, 320, 9);
  }
  return { pose: { ...pose, boca }, x: c.x, y };
}

// o fundo do cesto no mundo, para a física das frutas (a mesma pose que vai para a tela)
const cesto = cestoDeFrutas((s) => {
  const q = quadro((s * BPM) / 60);
  return { x: q.x, y: q.y, giro: q.pose.giro, sy: q.pose.sy };
}, DURACAO);

/** quando cada coisa soa, em batidas do ciclo (trilhas.ts agenda o som a partir daqui) */
export const SONS: { tipo: 'pulo' | 'pouso' | 'plim' | 'pirueta'; batida: number; grau?: number }[] = PULOS.flatMap((p) => [
  { tipo: p.voltas ? ('pirueta' as const) : ('pulo' as const), batida: p.ini },
  { tipo: 'pouso' as const, batida: p.ini + p.dur },
]);

// --- o palco -------------------------------------------------------------------------
const COR = {
  ceu: '#F8F4D0', horizonte: '#F7D88A', sol: '#F0B400', chao: '#C9733A', chaoBorda: '#9C5023', tabua: '#B5642F',
  verde: '#4F7F45', verdeEscuro: '#3F6925', marrom: '#4A2A15', creme: '#F8F4D0', tomate: '#D2461F', laranja: '#F59A1E', mostarda: '#F0B400',
};

type Cena = { ctx: CanvasRenderingContext2D; x: number; y: number; w: number; h: number; H: number; chao: number; mx: number };

/** raios em cunha girando (xilogravura), em volta de (cx, cy) */
function raios(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, n: number, giro: number, cor: string) {
  ctx.fillStyle = cor;
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(giro);
  for (let i = 0; i < n; i++) {
    ctx.rotate((Math.PI * 2) / n);
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-r * Math.tan(Math.PI / n / 2), r); ctx.lineTo(r * Math.tan(Math.PI / n / 2), r); ctx.fill();
  }
  ctx.restore();
}

function bandeirinhas(c: Cena, b: number, topo: number, curva: number, fase: number) {
  const { ctx, x, w, H } = c;
  const cores = [COR.tomate, COR.mostarda, COR.verde, COR.laranja, COR.creme];
  const y0 = topo, yc = topo + curva;
  ctx.strokeStyle = COR.marrom; ctx.lineWidth = Math.max(1, H * 0.01);
  ctx.beginPath(); ctx.moveTo(x - 10, y0); ctx.quadraticCurveTo(x + w / 2, yc, x + w + 10, y0); ctx.stroke();
  const n = Math.max(6, Math.round(w / (H * 0.32)));
  for (let i = 0; i < n; i++) {
    const u = (i + 0.5) / n, fx = x - 10 + (w + 20) * u;
    const fy = (1 - u) ** 2 * y0 + 2 * u * (1 - u) * yc + u * u * y0;
    // sacodem no tempo, uma atrás da outra
    const sacode = Math.sin(b * Math.PI + i * 0.9 + fase) * 0.18;
    ctx.save(); ctx.translate(fx, fy); ctx.rotate(sacode);
    ctx.fillStyle = cores[(i + Math.round(fase)) % cores.length];
    const l = H * 0.1;
    ctx.beginPath(); ctx.moveTo(-l, 0); ctx.lineTo(l, 0); ctx.lineTo(l, l * 2.2); ctx.lineTo(0, l * 1.5); ctx.lineTo(-l, l * 2.2); ctx.fill();
    ctx.restore();
  }
}

function fundoFeira(c: Cena, b: number) {
  const { ctx, x, y, w, h, H } = c;
  const g = ctx.createLinearGradient(0, y, 0, c.chao);
  g.addColorStop(0, COR.ceu); g.addColorStop(1, COR.horizonte);
  ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
  // o sol grande atrás do Mangaio, pulsando na batida
  const f = b - Math.floor(b), pulsa = 1 + 0.05 * Math.exp(-f * 6);
  const sy = c.chao - H * 1.25;
  raios(ctx, c.mx, sy, Math.hypot(w, h), 20, b * 0.04, 'rgba(240, 180, 0, 0.22)');
  ctx.fillStyle = COR.sol;
  ctx.beginPath(); ctx.arc(c.mx, sy, H * 0.55 * pulsa, 0, Math.PI * 2); ctx.fill();
  // as duas barracas nas pontas do palco, toldo listrado
  for (const lado of [-1, 1]) {
    const px = c.mx + lado * Math.max(H * 2.3, w * 0.42), larg = H * 1.9, topo = c.chao - H * 1.6;
    ctx.fillStyle = COR.marrom;
    ctx.fillRect(px - larg / 2 + H * 0.06, topo, H * 0.06, c.chao - topo);
    ctx.fillRect(px + larg / 2 - H * 0.12, topo, H * 0.06, c.chao - topo);
    const n = 5, faixa = larg / n;
    for (let i = 0; i < n; i++) {
      ctx.fillStyle = i % 2 ? COR.creme : COR.verde;
      ctx.beginPath(); ctx.roundRect(px - larg / 2 + i * faixa, topo, faixa + 0.5, H * 0.4, [0, 0, faixa / 2, faixa / 2]); ctx.fill();
    }
    ctx.fillStyle = '#7A3E1A'; ctx.fillRect(px - larg / 2 + H * 0.1, c.chao - H * 0.45, larg - H * 0.2, H * 0.45);
  }
  bandeirinhas(c, b, y + h * 0.04, h * 0.1, 0);
  bandeirinhas(c, b, y + h * 0.15, h * 0.08, 2);
  // o tablado: tábuas que fogem para o fundo
  ctx.fillStyle = COR.chao; ctx.fillRect(x, c.chao, w, y + h - c.chao);
  ctx.strokeStyle = COR.tabua; ctx.lineWidth = Math.max(1, H * 0.012);
  for (let i = -8; i <= 8; i++) {
    ctx.beginPath(); ctx.moveTo(c.mx + i * H * 0.35, c.chao); ctx.lineTo(c.mx + i * H * 0.8, y + h); ctx.stroke();
  }
  ctx.fillStyle = COR.chaoBorda; ctx.fillRect(x, c.chao, w, Math.max(2, H * 0.03));
}

function fundoRaios(c: Cena, b: number, cy: number) {
  const { ctx, x, y, w, h } = c;
  // fundo de close: raios girando, que trocam de cor a cada corte
  const par = Math.floor(b / 4) % 2 === 0;
  ctx.fillStyle = par ? COR.laranja : COR.verde; ctx.fillRect(x, y, w, h);
  raios(ctx, c.mx, cy, Math.hypot(w, h), 16, -b * 0.08, par ? COR.mostarda : COR.verdeEscuro);
  // bolinhas de confete que caem no tempo
  for (let i = 0; i < 26; i++) {
    const s = Math.sin(i * 91.7) * 43758.5453, r = s - Math.floor(s);
    const vx = x + w * r, vy = y + ((r * 7.3 + b * 0.12 * (0.6 + r)) % 1) * h;
    ctx.fillStyle = [COR.tomate, COR.creme, COR.mostarda, COR.verde][i % 4];
    ctx.save(); ctx.translate(vx, vy); ctx.rotate(b * (0.5 + r));
    ctx.fillRect(-h * 0.008, -h * 0.004, h * 0.016, h * 0.008);
    ctx.restore();
  }
}

/** poeira no pouso */
function poeira(c: Cena, b: number) {
  const po = pousou(b);
  if (!po || po.τ > 0.5) return;
  const u = po.τ / 0.5, forca = Math.min(1, po.v / 4);
  c.ctx.fillStyle = `rgba(156, 80, 35, ${0.5 * forca * (1 - u)})`;
  for (let i = 0; i < 8; i++) {
    const lado = i % 2 ? 1 : -1, d = (0.3 + (i >> 1) * 0.12 + u * 0.4) * c.H;
    c.ctx.beginPath(); c.ctx.arc(c.mx + lado * d, c.chao - c.H * (0.03 + u * 0.07 * (1 + (i >> 1))), c.H * 0.06 * (1 - u * 0.5), 0, Math.PI * 2); c.ctx.fill();
  }
}

// --- o quadro ---------------------------------------------------------------------------
export function desenharDanca(ctx: CanvasRenderingContext2D, t: number, x: number, y: number, w: number, h: number) {
  const b = ((((t * BPM) / 60) % CICLO) + CICLO) % CICLO;
  const s = seg(b);
  let i = PLANOS.length - 1;
  while (i > 0 && b < PLANOS[i].de) i--;
  const plano = PLANOS[i];
  const q = quadro(b);

  // câmera: zoom do plano e um "soco" no pouso (aperta e solta)
  const po = pousou(b);
  const soco = po ? amortece(po.τ, Math.min(0.06, po.v * 0.012), 200, 16) : 0;
  const H = Math.min(h * plano.zoom, w * (plano.zoom > 0.55 ? 1.05 : 0.75)) * (1 + soco);
  const chao = y + h / 2 + H * plano.foco + (plano.zoom > 0.5 ? 0 : h * 0.1);
  const c: Cena = { ctx, x, y, w, h, H, chao, mx: x + w / 2 };

  ctx.save();
  ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  if (plano.fundo === 'feira') fundoFeira(c, b);
  else fundoRaios(c, b, chao - H * 0.6);

  const mx = c.mx + q.x * H, base = chao - q.y * H;
  // sombra: encolhe e clareia com a altura
  const longe = Math.min(1, q.y / 1.2);
  ctx.fillStyle = `rgba(74, 42, 21, ${0.25 * (1 - longe * 0.6)})`;
  ctx.beginPath(); ctx.ellipse(mx, chao + H * 0.01, H * 0.42 * (1 - longe * 0.5), H * 0.06 * (1 - longe * 0.5), 0, 0, Math.PI * 2); ctx.fill();
  if (plano.fundo === 'feira') poeira(c, b);
  marionete().desenhar(ctx, q.pose, mx, base, H, (cx) => cesto.desenhar(cx, s));
  ctx.restore();
}
