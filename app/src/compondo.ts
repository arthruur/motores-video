// O que a prévia mostra enquanto o conversor trabalha em segundo plano: um tipógrafo compondo "PRENSA",
// letra por letra, e a conversa de sempre: montar a prensa demora; fazer circular, não.
import { A, L } from './formatos';
import { FONTE } from './legenda';

const LETRAS = 'PRENSA';

export function desenharCompondo(ctx: CanvasRenderingContext2D, t: number, texto: string, fracao?: number) {
  ctx.fillStyle = '#f3ede2';
  ctx.fillRect(0, 0, L, A);
  // composidor (a régua onde o tipógrafo alinha os tipos)
  const lado = 128, gap = 14, total = LETRAS.length * lado + (LETRAS.length - 1) * gap;
  const x0 = (L - total) / 2, y0 = 640;
  ctx.fillStyle = '#d6ccba';
  ctx.fillRect(x0 - 30, y0 + lado + 10, total + 60, 18);
  const ciclo = 4.2; // s para compor a palavra inteira, e recomeça
  const tc = t % ciclo;
  LETRAS.split('').forEach((letra, i) => {
    const entra = i * 0.45;
    const p = Math.max(0, Math.min(1, (tc - entra) / 0.35));
    if (p === 0) return;
    const e = 1 - (1 - p) ** 3;
    const x = x0 + i * (lado + gap);
    const y = y0 - (1 - e) * 260;
    ctx.save();
    ctx.globalAlpha = Math.min(1, p * 2);
    ctx.fillStyle = i === 3 ? '#d7301f' : '#1f1b16';
    ctx.beginPath(); ctx.roundRect(x, y, lado, lado * 1.25, 12); ctx.fill();
    ctx.fillStyle = '#f3ede2';
    ctx.font = `${lado * 1.05}px "${FONTE}"`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    // tipo de prensa: a letra fica espelhada até assentar
    ctx.translate(x + lado / 2, y + lado * 0.66);
    ctx.scale(e < 1 ? -1 : 1, 1);
    ctx.fillText(letra, 0, 0);
    ctx.restore();
  });
  ctx.fillStyle = '#16130f';
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.font = `88px "${FONTE}"`;
  ctx.fillText('MONTAR A PRENSA', L / 2, 1080);
  ctx.fillText('LEVA TEMPO.', L / 2, 1170);
  ctx.fillStyle = '#d7301f';
  ctx.fillText('FAZER CIRCULAR, NÃO.', L / 2, 1270);
  ctx.fillStyle = '#776d60';
  ctx.font = '44px Georgia, serif';
  ctx.fillText('Seu vídeo está sendo convertido', L / 2, 1420);
  ctx.fillText('para um formato que o navegador lê.', L / 2, 1476);
  // barra
  const bx = 180, bw = L - 360, by = 1560;
  ctx.fillStyle = '#e2d8c6';
  ctx.beginPath(); ctx.roundRect(bx, by, bw, 22, 11); ctx.fill();
  ctx.fillStyle = '#d7301f';
  const w = fracao === undefined ? bw * 0.3 : Math.max(22, bw * fracao);
  const desloca = fracao === undefined ? ((t * 0.6) % 1) * (bw - w) : 0;
  ctx.beginPath(); ctx.roundRect(bx + desloca, by, w, 22, 11); ctx.fill();
  ctx.fillStyle = '#4a4339';
  ctx.font = '40px system-ui, sans-serif';
  ctx.fillText(fracao === undefined ? `${texto}…` : `${texto} · ${Math.round(fracao * 100)}%`, L / 2, 1660);
}
