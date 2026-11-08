// O que vai dentro do cesto: as frutas do arturo.ai (frutas.svg, gerado por ferramentas/mangaio/extrair_frutas.py).
// O monte de frutas sente o cesto como um corpo só, vivendo DENTRO dele:
//
//   - o fundo é uma cama macia (mola amortecida): segura o monte parado e o devolve numa subida só, redonda;
//   - o cesto acelera e o monte sente o contrário (a pseudoforça do referencial do cesto): no impulso do pulo
//     ele afunda, no ar sobe um pouco, no pouso mergulha e volta;
//   - a gravidade das frutas é um pouco mais forte que a do Mangaio (exagero de desenho animado): no ar elas
//     sobem e já começam a voltar antes de ele chegar ao chão, em vez de flutuar o pulo inteiro.
//
// E cada fruta repete esse movimento um pouco depois da vizinha da esquerda: o sobe-e-desce atravessa o
// cesto como uma ONDA (a da esquerda sobe primeiro, a da direita por último), e cada fruta inclina seguindo
// a crista. O peso só muda o tamanho: a folha sobe um pouco mais, a laranja um pouco menos.
//
// Tudo continua função do tempo: a simulação roda UMA vez, no primeiro quadro, por três voltas do laço
// (até assentar no regime), e a última volta fica gravada em 240 Hz. Cada quadro só interpola a tabela.
// Ref.: Disney, "The Illusion of Life" (follow-through e overlapping action); Glenn Fiedler, "Fix Your Timestep!".
import svgFrutas from './frutas.svg?raw';

/** a base do Mangaio no mundo, em alturas do cesto (y para cima), o giro (graus) e o achatamento, no instante s (segundos) */
export type Trajeto = (s: number) => { x: number; y: number; giro: number; sy: number };

/** uma fruta no cesto, no espaço do mascote.svg (534 × 627): base = onde o pé dela encosta */
type Lugar = { id: string; cx: number; base: number; escala: number; giro: number; peso: number };

// de trás para frente (quem vem depois é desenhado por cima). O fundo de cada uma fica abaixo da borda
// da frente (y ≈ 330 no mascote.svg): a borda esconde, como fruta de verdade dentro do cesto.
// TODO(arthur): a arrumação é sua. peso vai de 0 (folha, quica muito e devagar) a 1 (laranja, firme).
const ARRUMACAO: Lugar[] = [
  { id: 'folhas-3', cx: 300, base: 380, escala: 0.62, giro: 12, peso: 0.05 },
  { id: 'folha-1', cx: 150, base: 372, escala: 0.6, giro: -28, peso: 0.1 },
  { id: 'folha-2', cx: 420, base: 368, escala: 0.55, giro: 38, peso: 0.1 },
  { id: 'banana-1', cx: 360, base: 345, escala: 0.55, giro: -18, peso: 0.55 },
  { id: 'banana-2', cx: 120, base: 350, escala: 0.5, giro: 24, peso: 0.55 },
  { id: 'tomate-grande', cx: 395, base: 362, escala: 0.6, giro: 6, peso: 0.8 },
  { id: 'laranja', cx: 205, base: 365, escala: 0.72, giro: 0, peso: 1 },
  { id: 'tomate-1', cx: 300, base: 352, escala: 0.6, giro: -8, peso: 0.7 },
  { id: 'morango-1', cx: 100, base: 345, escala: 0.55, giro: -20, peso: 0.35 },
  { id: 'tomate-2', cx: 455, base: 345, escala: 0.48, giro: 14, peso: 0.6 },
  { id: 'morango-2', cx: 255, base: 340, escala: 0.55, giro: 10, peso: 0.3 },
];

const ALTURA_SVG = 627; // altura do mascote.svg: 1 altura do cesto em unidades do SVG
const ASSENTO = 0.45; // altura do fundo das frutas acima da base do Mangaio, em alturas do cesto
const HZ_SIM = 960, HZ_TABELA = 240, VOLTAS = 3;
const G_FRUTA = 14; // alturas do cesto / s² (o pulo do Mangaio fica em ~9: a fruta "pesa" mais)

type Peca = { lugar: Lugar; caminhos: { p: Path2D; cor: string }[]; caixa: { x: number; y: number; w: number; h: number } };
type Estado = { u: number; v: number; vu: number; vv: number; a: number; va: number };

let pecas: Peca[] | null = null;

function montarPecas(): Peca[] {
  const fora = document.createElement('div');
  fora.style.cssText = 'position:absolute;left:-9999px;top:0;visibility:hidden';
  fora.innerHTML = svgFrutas;
  document.body.append(fora);
  const r = ARRUMACAO.map((lugar) => {
    const g = fora.querySelector(`#${lugar.id}`) as SVGGElement;
    const b = g.getBBox();
    const caminhos = [...g.querySelectorAll('path')].map((el) => ({ p: new Path2D(el.getAttribute('d') ?? ''), cor: el.getAttribute('fill') ?? '#000' }));
    return { lugar, caminhos, caixa: { x: b.x, y: b.y, w: b.width, h: b.height } };
  });
  fora.remove();
  return r;
}

// a onda: quanto a fruta da ponta direita atrasa em relação à da esquerda, e o quanto ela inclina na crista
const ONDA = { atraso: 0.2, inclina: 0.1, amplitude: 0.75 }; // s, rad por (altura do cesto / s), escala da subida
const XS = ARRUMACAO.map((l) => l.cx);
const X_MIN = Math.min(...XS), X_MAX = Math.max(...XS);

/** a mola do monte de frutas: cama macia (quase sem quique), as vizinhas empurrando de volta para o lugar */
const MOLA = { wCama: 22, zCama: 0.45, wLado: 7, zLado: 0.35, wGiro: 8, zGiro: 0.3, torque: 0.35 };
type Mola = typeof MOLA;

/** simula o monte sobre o trajeto e grava a última volta: [quadro][monte] → u, v, ângulo */
function simular(trajeto: Trajeto, duracao: number, ms: Mola[]): Float32Array {
  const n = ms.length;
  const dt = 1 / HZ_SIM;
  const passos = Math.round(duracao * HZ_SIM);
  const cada = HZ_SIM / HZ_TABELA;
  const quadros = Math.round(duracao * HZ_TABELA) + 1;
  const tabela = new Float32Array(quadros * n * 3);
  const est: Estado[] = Array.from({ length: n }, () => ({ u: 0, v: -G_FRUTA / (24 * 24), vu: 0, vv: 0, a: 0, va: 0 }));

  // posição do fundo das frutas no mundo (x, y para cima) e a inclinação, em radianos
  const assento = (s: number) => {
    const q = trajeto(((s % duracao) + duracao) % duracao);
    const r = (q.giro * Math.PI) / 180;
    // o fundo das frutas fica a ASSENTO da base: achatar o cesto também desce as frutas
    return { x: q.x + Math.sin(r) * ASSENTO * q.sy, y: q.y + Math.cos(r) * ASSENTO * q.sy, r };
  };
  // o cesto que as frutas sentem passa por uma mola criticamente amortecida (ω = SEGUE): os saltos de pose do
  // desenho (agachado → esticado num quadro) viram um empurrão forte mas finito, em vez de um tranco infinito
  const SEGUE = 34;
  const ini = assento(0);
  const f = { x: ini.x, y: ini.y, vx: 0, vy: 0 };
  let p0 = { ...ini }, p1 = { ...ini };
  for (let volta = 0; volta < VOLTAS; volta++) {
    for (let k = 0; k < passos; k++) {
      const s = k * dt;
      const alvo = assento(s);
      f.vx += (SEGUE * SEGUE * (alvo.x - f.x) - 2 * SEGUE * f.vx) * dt; f.x += f.vx * dt;
      f.vy += (SEGUE * SEGUE * (alvo.y - f.y) - 2 * SEGUE * f.vy) * dt; f.y += f.vy * dt;
      const p2 = { x: f.x, y: f.y, r: alvo.r };
      // aceleração do cesto (diferença segunda): no pouso vira um tranco de um passo só, que é o certo
      const ax = (p2.x - 2 * p1.x + p0.x) / (dt * dt), ay = (p2.y - 2 * p1.y + p0.y) / (dt * dt);
      // gravidade aparente no referencial do cesto, levada para os eixos dele (u: direita, v: cima)
      const gx = -ax, gy = -G_FRUTA - ay;
      const c = Math.cos(p2.r), sn = Math.sin(p2.r);
      const gu = gx * c - gy * sn, gv = gx * sn + gy * c;
      for (let i = 0; i < n; i++) {
        const e = est[i], m = ms[i];
        let fu = gu - m.wLado * m.wLado * e.u - 2 * m.zLado * m.wLado * e.vu;
        let fv = gv;
        if (e.v < 0) {
          // a cama só empurra, nunca puxa: a fruta pode sair voando do cesto
          fv += Math.max(0, -m.wCama * m.wCama * e.v - 2 * m.zCama * m.wCama * e.vv);
          fu -= 6 * e.vu; // atrito com o fundo
        }
        // o empurrão de lado vira a fruta; no ar ela gira mais solta
        const solta = e.v > 0.01 ? 0.35 : 1;
        const fa = -m.wGiro * m.wGiro * solta * e.a - 2 * m.zGiro * m.wGiro * e.va + m.torque * gu;
        // Euler semi-implícito: velocidade primeiro, posição com a velocidade nova (estável com molas duras)
        e.vu += fu * dt; e.vv += fv * dt; e.va += fa * dt;
        e.u += e.vu * dt; e.v += e.vv * dt; e.a += e.va * dt;
        e.a = Math.max(-0.9, Math.min(0.9, e.a));
      }
      p0 = p1; p1 = p2;
      if (volta === VOLTAS - 1 && k % cada === 0) {
        const q = (k / cada) * n * 3;
        for (let i = 0; i < n; i++) { tabela[q + i * 3] = est[i].u; tabela[q + i * 3 + 1] = est[i].v; tabela[q + i * 3 + 2] = est[i].a; }
      }
    }
  }
  // último quadro = primeiro (fecha o laço)
  tabela.copyWithin((quadros - 1) * n * 3, 0, n * 3);
  return tabela;
}

export type Cesto = {
  /** desenha as frutas no instante s; chamar dentro do `cesto` da marionete (espaço do mascote.svg) */
  desenhar: (ctx: CanvasRenderingContext2D, s: number) => void;
  /** u, v (alturas do cesto) e ângulo (rad) de cada fruta no instante s: para sons e efeitos */
  estado: (s: number) => { u: number; v: number; a: number }[];
};

/** monta um cesto de frutas que segue um trajeto periódico de `duracao` segundos */
export function cestoDeFrutas(trajeto: Trajeto, duracao: number): Cesto {
  let tabela: Float32Array | null = null;
  const ultimo = Math.round(duracao * HZ_TABELA);
  /** o monte no instante s (u, v, ângulo), interpolado na tabela */
  const monte = (s: number) => {
    tabela ??= simular(trajeto, duracao, [MOLA]);
    const f = (((s % duracao) + duracao) % duracao) * HZ_TABELA;
    const q0 = Math.floor(f), w = f - q0;
    const a = q0 * 3, b = Math.min(q0 + 1, ultimo) * 3;
    const t = tabela;
    return { u: t[a] * (1 - w) + t[b] * w, v: t[a + 1] * (1 - w) + t[b + 1] * w, a: t[a + 2] * (1 - w) + t[b + 2] * w };
  };
  const ler = (s: number) => {
    pecas ??= montarPecas();
    return ARRUMACAO.map((l) => {
      // cada fruta vê o monte um pouco no passado, conforme a posição: é isso que faz a onda andar
      const atraso = (ONDA.atraso * (l.cx - X_MIN)) / (X_MAX - X_MIN);
      const m = monte(s - atraso);
      // inclina na crista: subindo, a fruta pende para o lado de onde a onda vem
      const dv = (monte(s - atraso + 0.01).v - monte(s - atraso - 0.01).v) / 0.02;
      const k = ONDA.amplitude * (1.25 - 0.5 * l.peso);
      return { u: m.u * k, v: m.v * k, a: m.a + Math.max(-0.35, Math.min(0.35, -dv * ONDA.inclina)) };
    });
  };

  return {
    estado: ler,
    desenhar(ctx, s) {
      const st = ler(s);
      pecas!.forEach(({ lugar, caminhos, caixa }, i) => {
        const { u, v, a } = st[i];
        const k = lugar.escala;
        // apertada contra o fundo, a fruta achata um pouco (e alarga, mantendo o volume)
        const aperto = v < 0 ? Math.min(0.12, -v * 1.2) : 0;
        ctx.save();
        ctx.translate(lugar.cx + u * ALTURA_SVG, lugar.base - v * ALTURA_SVG);
        ctx.scale(1 + aperto * 0.7, 1 - aperto);
        // gira em volta do meio da fruta, não do pé
        ctx.translate(0, (-caixa.h * k) / 2);
        ctx.rotate((lugar.giro * Math.PI) / 180 + a);
        ctx.scale(k, k);
        ctx.translate(-(caixa.x + caixa.w / 2), -(caixa.y + caixa.h / 2));
        for (const c of caminhos) { ctx.fillStyle = c.cor; ctx.fill(c.p); }
        ctx.restore();
      });
    },
  };
}
