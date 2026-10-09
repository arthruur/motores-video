// Demonstração da tela inicial: um reel de exemplo desenhado ao vivo pelo MESMO motor do export
// (desenharQuadro). Os 3 passos de "Como funciona" mudam o que a demonstração mostra.
import { A, L, type Quadro, desenharQuadro, faixaLegenda } from './formatos';
import { type Palavra, montarBlocos } from './legenda';

export type Passo = 0 | 1 | 2;

const FALA = 'A prensa de Gutenberg barateou a cópia. De repente, muita gente podia falar com muita gente. Hoje essa prensa cabe no seu bolso.';
const CICLO = 9; // s

/** palavras com tempo inventado para a demonstração (≈ 2,6 palavras por segundo) */
function palavrasDemo(): Palavra[] {
  let t = 0.4;
  return FALA.split(' ').map((texto) => {
    const dur = 0.16 + texto.length * 0.035;
    const w = { texto, inicio: t, fim: t + dur };
    t += dur + (/[.,]$/.test(texto) ? 0.28 : 0.05);
    return w;
  });
}

/** o "vídeo cru" de exemplo: alguém falando para a câmera num vídeo deitado, desenhado em canvas */
function desenharFalante(c: CanvasRenderingContext2D, t: number, palavras: Palavra[]) {
  const w = 1280, h = 720;
  const g = c.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#2c3a4a'); g.addColorStop(1, '#16202b');
  c.fillStyle = g; c.fillRect(0, 0, w, h);
  // luz de janela e estante ao fundo
  const luz = c.createRadialGradient(260, 160, 10, 260, 160, 420);
  luz.addColorStop(0, 'rgba(255, 214, 150, 0.35)'); luz.addColorStop(1, 'rgba(255, 214, 150, 0)');
  c.fillStyle = luz; c.fillRect(0, 0, w, h);
  c.fillStyle = '#3d2e25'; c.fillRect(80, 170, 380, 14); c.fillRect(80, 330, 380, 14);
  const lombadas = ['#d7301f', '#ffd633', '#3f7cac', '#e8e1d2', '#5c8a4a', '#9a5b8c', '#e07a2e'];
  for (let i = 0; i < 11; i++) {
    const alt = 92 + ((i * 37) % 40);
    c.fillStyle = lombadas[i % lombadas.length];
    c.fillRect(96 + i * 31, 170 - alt, 25, alt);
    c.fillRect(110 + i * 30, 330 - alt + 18, 24, alt - 18);
  }
  c.fillStyle = '#4a7a3a';
  for (let k = 0; k < 7; k++) { c.beginPath(); c.ellipse(1150 + Math.cos(k) * 40, 470 - k * 22, 46, 16, k * 0.7, 0, Math.PI * 2); c.fill(); }
  c.fillStyle = '#7a4a32'; c.fillRect(1110, 480, 80, 120);

  const falando = palavras.some((p) => t >= p.inicio && t < p.fim);
  const abre = falando ? 0.35 + 0.65 * Math.abs(Math.sin(t * 17)) : 0.1;
  const bob = Math.sin(t * 1.4) * 5;
  const cx = 700, cy = 300 + bob;
  // tronco, gola e microfone de lapela
  c.fillStyle = '#d7301f';
  c.beginPath(); c.moveTo(cx - 250, h); c.quadraticCurveTo(cx - 240, cy + 170, cx, cy + 165); c.quadraticCurveTo(cx + 240, cy + 170, cx + 250, h); c.fill();
  c.fillStyle = '#f2ece2';
  c.beginPath(); c.moveTo(cx - 60, cy + 168); c.lineTo(cx, cy + 250); c.lineTo(cx + 60, cy + 168); c.fill();
  c.fillStyle = '#1a1a1a'; c.beginPath(); c.arc(cx - 95, cy + 235, 9, 0, Math.PI * 2); c.fill();
  // pescoço e rosto
  c.fillStyle = '#c98b63'; c.fillRect(cx - 42, cy + 90, 84, 85);
  c.fillStyle = '#e0a57c';
  c.beginPath(); c.ellipse(cx, cy, 118, 138, 0, 0, Math.PI * 2); c.fill();
  // cabelo
  c.fillStyle = '#231712';
  c.beginPath(); c.ellipse(cx, cy - 70, 132, 92, 0, Math.PI, 0); c.fill();
  c.beginPath(); c.ellipse(cx - 112, cy - 10, 30, 80, 0.2, 0, Math.PI * 2); c.fill();
  c.beginPath(); c.ellipse(cx + 112, cy - 10, 30, 80, -0.2, 0, Math.PI * 2); c.fill();
  // olhos (piscam) e sobrancelhas que acompanham a fala
  const pisca = (t % 3.7) < 0.12 ? 0.15 : 1;
  const sobe = falando ? Math.abs(Math.sin(t * 3)) * 6 : 0;
  c.fillStyle = '#231712';
  c.beginPath(); c.ellipse(cx - 45, cy - 5, 11, 13 * pisca, 0, 0, Math.PI * 2); c.ellipse(cx + 45, cy - 5, 11, 13 * pisca, 0, 0, Math.PI * 2); c.fill();
  c.lineWidth = 9; c.lineCap = 'round'; c.strokeStyle = '#231712';
  c.beginPath(); c.moveTo(cx - 68, cy - 40 - sobe); c.lineTo(cx - 24, cy - 46 - sobe); c.moveTo(cx + 24, cy - 46 - sobe); c.lineTo(cx + 68, cy - 40 - sobe); c.stroke();
  // boca
  c.fillStyle = '#7a2e22';
  c.beginPath(); c.ellipse(cx, cy + 62, 30, 6 + 18 * abre, 0, 0, Math.PI * 2); c.fill();
  // mão que gesticula de vez em quando
  const gesto = Math.max(0, Math.sin(t * 0.9)) ** 3;
  if (gesto > 0.05) {
    c.fillStyle = '#e0a57c';
    c.beginPath(); c.ellipse(cx + 250, h - 40 - gesto * 170, 48, 58, -0.4, 0, Math.PI * 2); c.fill();
  }
}

export function criarDemo(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d')!;
  const cru = document.createElement('canvas');
  cru.width = 1280; cru.height = 720;
  const ctxCru = cru.getContext('2d')!;
  const palavras = palavrasDemo();
  const f = faixaLegenda('cheio');
  const blocos = montarBlocos(palavras, ctx, f.dir - f.esq - 56);
  let passo: Passo = 0;
  let t0 = performance.now();
  let rodando = true;
  const reduzido = matchMedia('(prefers-reduced-motion: reduce)').matches;

  function quadro(t: number) {
    desenharFalante(ctxCru, t, palavras);
    const fonte = { img: cru, w: 1280, h: 720 };
    if (passo === 0) {
      // o vídeo como chegou: deitado, sem nada
      ctx.fillStyle = '#0c0b0a'; ctx.fillRect(0, 0, L, A);
      const hh = (L * 720) / 1280;
      ctx.drawImage(cru, 0, A / 2 - hh / 2, L, hh);
      return;
    }
    const q: Quadro = {
      layout: 'cheio',
      gancho: { estilo: 'voce-sabia', texto: 'que o celular é uma prensa?' },
      fonte: 'Prensa, demonstração',
      creditoBaixo: '',
      legenda: blocos,
      estiloLegenda: 'bloco',
      gerador: null,
    };
    desenharQuadro(ctx, q, t, fonte, null);
  }

  function laco(agora: number) {
    if (!rodando) return;
    const t = reduzido ? 2.2 : ((agora - t0) / 1000) % CICLO;
    quadro(t);
    if (!reduzido) requestAnimationFrame(laco);
  }
  requestAnimationFrame(laco);

  return {
    ir(p: Passo) { passo = p; t0 = performance.now(); if (reduzido) quadro(2.2); },
    parar() { rodando = false; },
    continuar() { if (!rodando) { rodando = true; requestAnimationFrame(laco); } },
  };
}
