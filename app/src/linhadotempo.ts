// Linha do tempo: o vídeo inteiro numa faixa, com miniaturas, a onda do som, as alças do trecho, o cursor e
// as marcas dos efeitos sonoros. Arrastar as alças muda o começo e o fim; arrastar uma marca muda o efeito de lugar.
import { CanvasSink } from 'mediabunny';
import { type Midia, audioParaFala, temSom } from './prensa';

export type Marca = { id: number; em: number; nome: string }; // em: segundos no vídeo original

type Opcoes = {
  ini: () => number;
  fim: () => number;
  agora: () => number;
  marcas: () => Marca[];
  /** final = a pessoa soltou o dedo (aí vale refazer a legenda) */
  aoMudarTrecho: (ini: number, fim: number, final: boolean) => void;
  aoBuscar: (t: number) => void;
  aoMoverMarca: (id: number, em: number, final: boolean) => void;
};

const REGUA = 16, FILME = 48, ONDA = 30, EFEITOS = 24;
const ALTURA = REGUA + FILME + ONDA + EFEITOS;
const PEGA = 16; // px de folga para pegar uma alça ou marca com o dedo
const MAX_ONDA_S = 15 * 60; // acima disso a onda não é lida (memória do celular)

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

export function criarLinhaDoTempo(canvas: HTMLCanvasElement, o: Opcoes) {
  const ctx = canvas.getContext('2d')!;
  let midia: Midia | null = null;
  let dur = 0;
  let miniaturas: { t: number; img: HTMLCanvasElement | OffscreenCanvas }[] = [];
  let picos: Float32Array | null = null;
  let vez = 0;
  let arrasto: { tipo: 'ini' | 'fim' | 'cursor' } | { tipo: 'marca'; id: number } | null = null;

  const largura = () => canvas.clientWidth;
  const xDe = (t: number) => (dur ? (t / dur) * largura() : 0);
  const tDe = (x: number) => Math.min(dur, Math.max(0, (x / Math.max(1, largura())) * dur));
  const cor = (nome: string, padrao: string) => getComputedStyle(canvas).getPropertyValue(nome).trim() || padrao;

  async function lerMiniaturas(m: Midia, minha: number) {
    const n = Math.max(6, Math.min(24, Math.round(largura() / 34)));
    const tempos = Array.from({ length: n }, (_, i) => m.inicio + ((i + 0.5) / n) * m.dur);
    try {
      const sink = new CanvasSink(m.video, { height: FILME * 2, poolSize: 0 });
      for await (const c of sink.canvasesAtTimestamps(tempos)) {
        if (minha !== vez) return;
        if (c) miniaturas.push({ t: c.timestamp - m.inicio, img: c.canvas });
        desenhar();
      }
    } catch { /* sem miniaturas: a faixa fica lisa */ }
  }

  async function lerOnda(m: Midia, minha: number) {
    if (!temSom(m) || m.dur > MAX_ONDA_S) return;
    try {
      const a = await audioParaFala(m, 0, m.dur);
      if (!a || minha !== vez) return;
      const n = 800, passo = a.length / n;
      const p = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        let max = 0;
        for (let j = Math.floor(i * passo); j < Math.floor((i + 1) * passo); j += 4) max = Math.max(max, Math.abs(a[j]));
        p[i] = max;
      }
      const topo = Math.max(0.05, ...p);
      picos = p.map((v) => Math.sqrt(v / topo)); // raiz: a fala baixa também aparece
      desenhar();
    } catch { /* sem onda */ }
  }

  function definir(m: Midia) {
    midia = m;
    dur = m.dur;
    miniaturas = [];
    picos = null;
    const minha = ++vez;
    desenhar();
    // a onda espera um pouco: a legenda também lê o som e vai primeiro
    lerMiniaturas(m, minha).then(() => setTimeout(() => lerOnda(m, minha), 1500));
  }

  function desenhar() {
    const dpr = devicePixelRatio || 1;
    const w = largura();
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(ALTURA * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(ALTURA * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, ALTURA);
    if (!midia || !dur) return;
    const tinta = cor('--tinta', '#16130f'), suave = cor('--suave', '#776d60'), vermelho = cor('--vermelho', '#d7301f');
    const linha = cor('--linha', '#d6ccba'), amarelo = cor('--amarelo', '#ffd633');

    // régua: marcas de tempo a cada passo "redondo"
    const passos = [1, 2, 5, 10, 15, 30, 60, 120, 300];
    const passo = passos.find((p) => xDe(p) >= 46) ?? 600;
    ctx.fillStyle = suave;
    ctx.font = '11px system-ui, sans-serif';
    ctx.textBaseline = 'top';
    for (let t = 0; t <= dur; t += passo) {
      ctx.fillRect(xDe(t), REGUA - 4, 1, 4);
      ctx.fillText(fmt(t), xDe(t) + 3, 1);
    }

    // filme
    const yF = REGUA;
    ctx.fillStyle = cor('--papel-2', '#e9e1d2');
    ctx.fillRect(0, yF, w, FILME);
    if (miniaturas.length) {
      const fatia = w / miniaturas.length;
      [...miniaturas].sort((a, b) => a.t - b.t).forEach((mi, i) => {
        const iw = mi.img.width, ih = mi.img.height;
        const k = Math.max(fatia / iw, FILME / ih);
        const sw = fatia / k, sh = FILME / k;
        ctx.drawImage(mi.img, (iw - sw) / 2, (ih - sh) / 2, sw, sh, i * fatia, yF, fatia + 0.5, FILME);
      });
    }

    // onda
    const yO = REGUA + FILME;
    ctx.fillStyle = cor('--cartao', '#fbf8f2');
    ctx.fillRect(0, yO, w, ONDA);
    if (picos) {
      ctx.fillStyle = tinta;
      const meio = yO + ONDA / 2;
      for (let x = 0; x < w; x++) {
        const v = picos[Math.min(picos.length - 1, Math.floor((x / w) * picos.length))];
        const h = Math.max(1, v * (ONDA - 6));
        ctx.fillRect(x, meio - h / 2, 1, h);
      }
    } else if (!temSom(midia)) {
      ctx.fillStyle = suave;
      ctx.fillText('sem som', 6, yO + 9);
    }

    // faixa dos efeitos
    const yE = REGUA + FILME + ONDA;
    ctx.fillStyle = cor('--papel', '#f3ede2');
    ctx.fillRect(0, yE, w, EFEITOS);
    ctx.fillStyle = linha;
    ctx.fillRect(0, yE, w, 1);

    // fora do trecho: escurecido
    const xi = xDe(o.ini()), xf = xDe(o.fim());
    ctx.fillStyle = 'rgba(22,19,15,0.55)';
    ctx.fillRect(0, yF, xi, FILME + ONDA);
    ctx.fillRect(xf, yF, w - xf, FILME + ONDA);
    // moldura e alças do trecho
    ctx.strokeStyle = amarelo;
    ctx.lineWidth = 3;
    ctx.strokeRect(xi, yF + 1.5, xf - xi, FILME + ONDA - 3);
    for (const x of [xi, xf]) {
      ctx.fillStyle = amarelo;
      ctx.beginPath();
      ctx.roundRect(x - 6, yF, 12, FILME + ONDA, 4);
      ctx.fill();
      ctx.fillStyle = '#16130f';
      ctx.fillRect(x - 1, yF + (FILME + ONDA) / 2 - 8, 2, 16);
    }

    // marcas de efeito
    ctx.font = '600 11px system-ui, sans-serif';
    ctx.textBaseline = 'middle';
    for (const m of o.marcas()) {
      const x = xDe(m.em);
      ctx.fillStyle = vermelho;
      ctx.fillRect(x - 1, yF, 2, FILME + ONDA);
      ctx.beginPath();
      ctx.arc(x, yE + EFEITOS / 2, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = tinta;
      ctx.fillText(m.nome, x + 10, yE + EFEITOS / 2);
    }

    // cursor
    const xc = xDe(o.agora());
    ctx.fillStyle = vermelho;
    ctx.fillRect(xc - 1, 0, 2, ALTURA);
    ctx.beginPath();
    ctx.moveTo(xc - 6, 0); ctx.lineTo(xc + 6, 0); ctx.lineTo(xc, 8); ctx.fill();
  }

  const xDoEvento = (e: PointerEvent) => e.clientX - canvas.getBoundingClientRect().left;
  const yDoEvento = (e: PointerEvent) => e.clientY - canvas.getBoundingClientRect().top;

  function mover(e: PointerEvent, final: boolean) {
    if (!arrasto) return;
    const t = tDe(xDoEvento(e));
    if (arrasto.tipo === 'ini') o.aoMudarTrecho(t, o.fim(), final);
    else if (arrasto.tipo === 'fim') o.aoMudarTrecho(o.ini(), t, final);
    else if (arrasto.tipo === 'marca') o.aoMoverMarca(arrasto.id, t, final);
    else o.aoBuscar(t);
    desenhar();
  }

  canvas.addEventListener('pointerdown', (e) => {
    if (!dur) return;
    const x = xDoEvento(e), y = yDoEvento(e);
    const naFaixaDeEfeitos = y >= REGUA + FILME + ONDA - 4;
    const marca = naFaixaDeEfeitos
      ? o.marcas().map((m) => ({ m, d: Math.abs(xDe(m.em) - x) })).filter((c) => c.d < PEGA).sort((a, b) => a.d - b.d)[0]?.m
      : undefined;
    const di = Math.abs(x - xDe(o.ini())), df = Math.abs(x - xDe(o.fim()));
    if (marca) arrasto = { tipo: 'marca', id: marca.id };
    else if (!naFaixaDeEfeitos && Math.min(di, df) < PEGA && y >= REGUA) arrasto = { tipo: di <= df ? 'ini' : 'fim' };
    else arrasto = { tipo: 'cursor' };
    canvas.setPointerCapture(e.pointerId);
    e.preventDefault();
    mover(e, false);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (arrasto) { mover(e, false); return; }
    // o cursor do mouse mostra o que dá para arrastar
    const x = xDoEvento(e);
    const perto = Math.min(Math.abs(x - xDe(o.ini())), Math.abs(x - xDe(o.fim()))) < PEGA;
    canvas.style.cursor = perto ? 'ew-resize' : 'pointer';
  });
  const soltar = (e: PointerEvent) => { if (arrasto) { mover(e, true); arrasto = null; } };
  canvas.addEventListener('pointerup', soltar);
  canvas.addEventListener('pointercancel', soltar);
  new ResizeObserver(() => desenhar()).observe(canvas);

  return { definir, desenhar };
}
