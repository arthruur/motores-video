// Vídeos de retenção gerados na hora: cada um é uma função do tempo (mesmo t, mesmo quadro),
// desenhada direto no canvas. Sem download, sem direito autoral de terceiros, funciona offline.
import { desenharAventura } from './mangaio/aventura';

export type Gerador = { id: string; nome: string; desenhar: (ctx: CanvasRenderingContext2D, t: number, x: number, y: number, w: number, h: number) => void };

const TAU = Math.PI * 2;

/** pêndulos com períodos diferentes: a onda se desfaz e se refaz (ciclo de 60 s) */
function pendulos(ctx: CanvasRenderingContext2D, t: number, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#0d1321';
  ctx.fillRect(x, y, w, h);
  const n = 18, ciclo = 60;
  const topo = y + h * 0.08;
  for (let i = 0; i < n; i++) {
    const osc = 51 + i; // oscilações por ciclo
    const ang = 0.6 * Math.cos((TAU * osc * t) / ciclo);
    const comp = h * 0.78 * (51 / osc) ** 2 + h * 0.06;
    const px = x + w / 2 + Math.sin(ang) * comp * 0.9;
    const py = topo + Math.cos(ang) * comp * 0.9;
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x + w / 2, topo); ctx.lineTo(px, py); ctx.stroke();
    ctx.fillStyle = `hsl(${(i * 360) / n}, 85%, 60%)`;
    ctx.beginPath(); ctx.arc(px, py, w * 0.022, 0, TAU); ctx.fill();
  }
}

/** bolinhas quicando dentro de um círculo, com rastro */
function bolinhas(ctx: CanvasRenderingContext2D, t: number, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#10091f';
  ctx.fillRect(x, y, w, h);
  const cx = x + w / 2, cy = y + h / 2, R = Math.min(w, h) * 0.44;
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = 6;
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.stroke();
  const n = 7;
  for (let i = 0; i < n; i++) {
    for (let k = 14; k >= 0; k--) { // rastro: o mesmo caminho um pouco antes
      const tt = t - k * 0.025;
      // trajetória fechada (Lissajous) que encosta na borda: parece quique, é determinística
      const a = 1 + (i % 3), b = 2 + (i % 4), fase = i * 0.9;
      const r = R * 0.86;
      const px = cx + r * Math.sin(a * tt * 0.9 + fase);
      const py = cy + r * Math.sin(b * tt * 0.7 + fase * 1.7) * Math.cos(a * tt * 0.2);
      ctx.fillStyle = `hsla(${(i * 360) / n + t * 20}, 90%, 60%, ${k === 0 ? 1 : 0.35 * (1 - k / 15)})`;
      ctx.beginPath(); ctx.arc(px, py, R * (k === 0 ? 0.06 : 0.05), 0, TAU); ctx.fill();
    }
  }
}

/** manchas de tinta que se misturam devagar (lâmpada de lava) */
function tinta(ctx: CanvasRenderingContext2D, t: number, x: number, y: number, w: number, h: number) {
  const g = ctx.createLinearGradient(x, y, x, y + h);
  g.addColorStop(0, '#1a0b2e'); g.addColorStop(1, '#0b1f2e');
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
  ctx.save();
  ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  ctx.globalCompositeOperation = 'lighter';
  const cores = ['#ff3d7f', '#ffb000', '#00d1ff', '#7c4dff', '#00e676'];
  for (let i = 0; i < 9; i++) {
    const px = x + w * (0.5 + 0.38 * Math.sin(t * (0.21 + i * 0.037) + i * 2.1));
    const py = y + h * (0.5 + 0.4 * Math.sin(t * (0.17 + i * 0.029) + i * 1.3));
    const r = Math.min(w, h) * (0.16 + 0.06 * Math.sin(t * 0.5 + i));
    const rg = ctx.createRadialGradient(px, py, 0, px, py, r);
    rg.addColorStop(0, cores[i % cores.length]);
    rg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = rg;
    ctx.beginPath(); ctx.arc(px, py, r, 0, TAU); ctx.fill();
  }
  ctx.restore();
}

/** blocos caindo e se encaixando numa grade, linha por linha (ciclo de 24 s) */
function encaixe(ctx: CanvasRenderingContext2D, t: number, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(x, y, w, h);
  const cols = 8, lado = w / cols, linhas = Math.floor(h / lado);
  const ciclo = 24, porBloco = ciclo / (cols * linhas);
  const tc = t % ciclo;
  const caidos = Math.floor(tc / porBloco);
  for (let k = 0; k <= Math.min(caidos, cols * linhas - 1); k++) {
    const lin = linhas - 1 - Math.floor(k / cols);
    const col = (k * 5) % cols; // ordem que pula colunas, mais gostosa de ver
    const alvo = y + lin * lado;
    const prog = k < caidos ? 1 : (tc - k * porBloco) / porBloco;
    const e = 1 - (1 - prog) ** 3;
    const py = y - lado + (alvo - y + lado) * e;
    ctx.fillStyle = `hsl(${(k * 37) % 360}, 75%, 58%)`;
    ctx.beginPath(); ctx.roundRect(x + col * lado + 4, py + 4, lado - 8, lado - 8, 10); ctx.fill();
  }
}

export const GERADORES: Gerador[] = [
  { id: 'pendulos', nome: 'Pêndulos', desenhar: pendulos },
  { id: 'bolinhas', nome: 'Bolinhas', desenhar: bolinhas },
  { id: 'tinta', nome: 'Tinta', desenhar: tinta },
  { id: 'encaixe', nome: 'Encaixe', desenhar: encaixe },
  { id: 'mangaio-aventura', nome: 'Aventura do Mangaio', desenhar: desenharAventura },
];
