// Trilhas geradas na hora: sintetizadas no próprio aparelho (Web Audio), sem gravação de ninguém e sem
// direito autoral de terceiros. Cada uma é um laço de 8 compassos que se repete o quanto precisar.
import { SONS, BPM as BPM_MANGAIO } from './mangaio/aventura';

export type Trilha = { id: string; nome: string; clima: string; bpm: number; acordes: number[][]; batida: 'nenhuma' | 'lofi' | 'pulso' | 'reta' | 'baiao' };

// acordes em semitons a partir de A2 (110 Hz)
const AM = [0, 3, 7], F = [-4, 0, 3], C = [3, 7, 10], G = [-2, 2, 5], DM = [5, 8, 12], E = [7, 11, 14], A7 = [0, 4, 7, 10];
export const TRILHAS: Trilha[] = [
  { id: 'calma', nome: 'Calma', clima: 'pad suave, para explicar', bpm: 70, acordes: [AM, F, C, G], batida: 'nenhuma' },
  { id: 'lofi', nome: 'Lo-fi', clima: 'batida leve, para conversar', bpm: 82, acordes: [F, AM, DM, E], batida: 'lofi' },
  { id: 'tensao', nome: 'Tensão', clima: 'grave e pulso, para revelar', bpm: 120, acordes: [AM, AM, F, E], batida: 'pulso' },
  { id: 'animada', nome: 'Animada', clima: 'pra cima, para listas', bpm: 112, acordes: [C, G, AM, F], batida: 'reta' },
  // o laço (8 compassos de 4/4 = 32 batidas) tem a duração exata de um ciclo da Aventura do Mangaio,
  // e os pulos, pousos e plins dela estão gravados dentro: escolhendo os dois, tudo cai junto
  { id: 'baiao-mangaio', nome: 'Baião do Mangaio', clima: 'zabumba e triângulo, casa com a Aventura do Mangaio', bpm: BPM_MANGAIO, acordes: [DM, DM, A7, A7, G, G, A7, DM], batida: 'baiao' },
];

const hz = (semitom: number) => 110 * 2 ** (semitom / 12);

function nota(ctx: BaseAudioContext, destino: AudioNode, f: number, ini: number, dur: number, tipo: OscillatorType, vol: number, ataque = 0.4) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = tipo;
  o.frequency.value = f;
  g.gain.setValueAtTime(0, ini);
  g.gain.linearRampToValueAtTime(vol, ini + ataque);
  g.gain.setValueAtTime(vol, ini + Math.max(ataque, dur - 0.3));
  g.gain.linearRampToValueAtTime(0, ini + dur);
  o.connect(g).connect(destino);
  o.start(ini);
  o.stop(ini + dur + 0.05);
}

function ruido(ctx: BaseAudioContext, dur: number): AudioBuffer {
  const b = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate);
  const d = b.getChannelData(0);
  let s = 1234567;
  for (let i = 0; i < d.length; i++) { s = (s * 16807) % 2147483647; d[i] = s / 1073741823.5 - 1; } // determinístico
  return b;
}

function bumbo(ctx: BaseAudioContext, destino: AudioNode, t: number, vol: number) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.frequency.setValueAtTime(140, t);
  o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
  o.connect(g).connect(destino);
  o.start(t); o.stop(t + 0.4);
}

function chiado(ctx: BaseAudioContext, destino: AudioNode, ruidoBuf: AudioBuffer, t: number, dur: number, vol: number, corte: number) {
  const s = ctx.createBufferSource();
  s.buffer = ruidoBuf;
  const f = ctx.createBiquadFilter();
  f.type = 'highpass';
  f.frequency.value = corte;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  s.connect(f).connect(g).connect(destino);
  s.start(t, (t * 0.37) % 1);
  s.stop(t + dur + 0.02);
}

// O baião em 2/4, dividido em 8 semicolcheias (dois compassos de baião por compasso de 4/4):
//   zabumba    X . . X . . . .   a "pisada": colcheia pontuada + semicolcheia
//   bacalhau   . . . . X . X .   o agudo da zabumba
//   triângulo  x x X x x x X x   fechado o tempo todo, aberto nos contratempos
//   baixo      X . . X . . X .   fundamental, fundamental, quinta
//   sanfona    . . X . . . X .   acorde curto no contratempo
const BAIAO = { zabumba: [0, 3], bacalhau: [4, 6], aberto: [2, 6], baixo: [0, 3, 6], sanfona: [2, 6] };

function baiao(ctx: BaseAudioContext, filtro: AudioNode, mestre: AudioNode, ruidoBuf: AudioBuffer, t0: number, tempo: number, acorde: number[]) {
  const passo = tempo / 4;
  for (let metade = 0; metade < 2; metade++) {
    const base = t0 + metade * 2 * tempo;
    for (let k = 0; k < 8; k++) {
      const t = base + k * passo;
      if (BAIAO.zabumba.includes(k)) bumbo(ctx, mestre, t, 0.55);
      if (BAIAO.bacalhau.includes(k)) chiado(ctx, mestre, ruidoBuf, t, 0.05, 0.12, 2500);
      chiado(ctx, mestre, ruidoBuf, t, BAIAO.aberto.includes(k) ? 0.14 : 0.03, BAIAO.aberto.includes(k) ? 0.06 : 0.03, 8000);
      if (BAIAO.baixo.includes(k)) nota(ctx, filtro, hz(acorde[0] - 12 + (k === 6 ? 7 : 0)), t, passo * 2.5, 'triangle', 0.16, 0.01);
      if (BAIAO.sanfona.includes(k)) for (const s of acorde) nota(ctx, filtro, hz(s + 12), t, passo * 1.6, 'sawtooth', 0.022, 0.01);
    }
  }
}

/** os sons da aventura, no mesmo laço: o roteiro (mangaio/aventura.ts) diz em que batida cai cada um */
function sonsDaAventura(ctx: BaseAudioContext, destino: AudioNode, ruidoBuf: AudioBuffer, tempo: number, acordes: number[][]) {
  for (const s of SONS) {
    const t = s.batida * tempo;
    if (s.tipo === 'pulo' || s.tipo === 'pirueta') {
      // "boing": senoide que sobe de afinação (a pirueta sobe mais)
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(220, t);
      o.frequency.exponentialRampToValueAtTime(s.tipo === 'pirueta' ? 990 : 660, t + 0.16);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.22, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
      o.connect(g).connect(destino); o.start(t); o.stop(t + 0.25);
    } else if (s.tipo === 'pouso') {
      bumbo(ctx, destino, t, 0.35);
      chiado(ctx, destino, ruidoBuf, t, 0.18, 0.1, 600);
    } else {
      // "plim": uma nota do acorde que está soando, subindo o arpejo a cada umbu
      const acorde = acordes[Math.floor(s.batida / 4) % acordes.length];
      const grau = s.grau ?? 0;
      const semitom = acorde[grau % acorde.length] + 24 + 12 * Math.floor(grau / acorde.length);
      nota(ctx, destino, hz(semitom), t, 0.35, 'triangle', 0.18, 0.005);
    }
  }
}

/** renderiza o laço (8 compassos 4/4) em estéreo na taxa pedida */
export async function gerarTrilha(id: string, taxa = 48000): Promise<AudioBuffer> {
  const tr = TRILHAS.find((t) => t.id === id) ?? TRILHAS[0];
  const tempo = 60 / tr.bpm;
  const compasso = tempo * 4;
  const dur = compasso * 8;
  const ctx = new OfflineAudioContext(2, Math.ceil(dur * taxa), taxa);
  const mestre = ctx.createGain();
  mestre.gain.value = 0.9;
  const filtro = ctx.createBiquadFilter();
  filtro.type = 'lowpass';
  filtro.frequency.value = tr.batida === 'reta' ? 2400 : 1400;
  filtro.connect(mestre).connect(ctx.destination);
  const ruidoBuf = ruido(ctx, 1.2);

  for (let c = 0; c < 8; c++) {
    const t0 = c * compasso;
    const acorde = tr.acordes[c % tr.acordes.length];
    if (tr.batida === 'baiao') { baiao(ctx, filtro, mestre, ruidoBuf, t0, tempo, acorde); continue; }
    // pad: três vozes um pouco desafinadas entre si (fica mais "cheio")
    for (const s of acorde) {
      nota(ctx, filtro, hz(s), t0, compasso, 'triangle', 0.06, tr.batida === 'nenhuma' ? 1.2 : 0.25);
      nota(ctx, filtro, hz(s) * 1.004, t0, compasso, 'sawtooth', 0.012, tr.batida === 'nenhuma' ? 1.2 : 0.25);
    }
    // baixo
    const raiz = hz(acorde[0] - 12);
    if (tr.batida === 'pulso') for (let k = 0; k < 8; k++) nota(ctx, filtro, raiz, t0 + k * tempo / 2, tempo / 2 * 0.8, 'sawtooth', 0.05, 0.01);
    else nota(ctx, filtro, raiz, t0, compasso * 0.95, 'sine', 0.12, 0.05);
    // batida
    for (let b = 0; b < 4; b++) {
      const t = t0 + b * tempo;
      if (tr.batida === 'reta') { bumbo(ctx, mestre, t, 0.5); chiado(ctx, mestre, ruidoBuf, t + tempo / 2, 0.05, 0.08, 7000); if (b % 2) chiado(ctx, mestre, ruidoBuf, t, 0.18, 0.18, 1500); }
      if (tr.batida === 'lofi') { if (b === 0 || b === 2) bumbo(ctx, mestre, t + (b === 2 ? tempo * 0.25 : 0), 0.4); if (b % 2) chiado(ctx, mestre, ruidoBuf, t, 0.2, 0.12, 1200); chiado(ctx, mestre, ruidoBuf, t + tempo * 0.5, 0.04, 0.05, 8000); }
      if (tr.batida === 'pulso' && b % 2 === 0) bumbo(ctx, mestre, t, 0.45);
    }
  }
  if (tr.batida === 'baiao') sonsDaAventura(ctx, mestre, ruidoBuf, tempo, tr.acordes);
  if (tr.batida === 'lofi') { // chiado de vinil, bem baixo
    const v = ctx.createBufferSource();
    v.buffer = ruidoBuf; v.loop = true;
    const g = ctx.createGain(); g.gain.value = 0.008;
    v.connect(g).connect(ctx.destination); v.start(0);
  }
  return ctx.startRendering();
}

// ---------------------------------------------------------------- efeitos sonoros, também gerados na hora
export type Efeito = { id: string; nome: string; dur: number };
export const EFEITOS: Efeito[] = [
  { id: 'whoosh', nome: 'Whoosh', dur: 0.9 },
  { id: 'impacto', nome: 'Impacto', dur: 1.2 },
  { id: 'pop', nome: 'Pop', dur: 0.25 },
  { id: 'ding', nome: 'Ding', dur: 1.4 },
  { id: 'notificacao', nome: 'Notificação', dur: 0.5 },
  { id: 'clique', nome: 'Máquina de escrever', dur: 1.2 },
  { id: 'subida', nome: 'Subida', dur: 1.5 },
  { id: 'rufar', nome: 'Rufar e prato', dur: 2.2 },
  { id: 'boing', nome: 'Boing', dur: 0.55 },
  { id: 'glitch', nome: 'Glitch', dur: 0.45 },
  { id: 'arranhao', nome: 'Disco arranhado', dur: 0.6 },
];

/** um sino: parciais inarmônicos que somem devagar */
function sino(ctx: BaseAudioContext, destino: AudioNode, t: number, f: number, vol: number, dur: number) {
  for (const [mult, v] of [[1, 1], [2.76, 0.4], [5.4, 0.18]]) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.value = f * mult;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol * v, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur / mult ** 0.3);
    o.connect(g).connect(destino);
    o.start(t); o.stop(t + dur);
  }
}

/** um efeito curto (até ~2 s), em estéreo */
export async function gerarEfeito(id: string, taxa = 48000): Promise<AudioBuffer> {
  const dur = EFEITOS.find((e) => e.id === id)?.dur ?? 0.9;
  const ctx = new OfflineAudioContext(2, Math.ceil(dur * taxa), taxa);
  const saida = ctx.destination;
  let semente = 987654321; // aleatório determinístico: o mesmo efeito soa igual toda vez
  const sorte = () => { semente = (semente * 16807) % 2147483647; return semente / 2147483647; };
  if (id === 'ding') {
    sino(ctx, saida, 0, 1318.5, 0.7, dur);
  } else if (id === 'notificacao') {
    nota(ctx, saida, 880, 0, 0.16, 'triangle', 0.5, 0.004);
    nota(ctx, saida, 1318.5, 0.13, 0.3, 'triangle', 0.5, 0.004);
  } else if (id === 'clique') {
    // teclas em ritmo irregular e o sininho do fim da linha
    let t = 0;
    for (let k = 0; k < 11; k++) { chiado(ctx, saida, ruido(ctx, 0.05), t, 0.03, 0.9, 2500); bumbo(ctx, saida, t, 0.08); t += 0.06 + sorte() * 0.06; }
    sino(ctx, saida, Math.min(t + 0.05, dur - 0.4), 2093, 0.25, 0.4);
  } else if (id === 'subida') {
    // tensão que sobe e corta: para pôr logo antes de uma revelação
    const s = ctx.createBufferSource();
    s.buffer = ruido(ctx, dur);
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass'; f.Q.value = 2;
    f.frequency.setValueAtTime(300, 0);
    f.frequency.exponentialRampToValueAtTime(7000, dur * 0.95);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.02, 0);
    g.gain.exponentialRampToValueAtTime(1.2, dur * 0.95);
    g.gain.linearRampToValueAtTime(0, dur);
    s.connect(f).connect(g).connect(saida);
    s.start();
    const o = ctx.createOscillator(), go = ctx.createGain();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(110, 0);
    o.frequency.exponentialRampToValueAtTime(880, dur * 0.95);
    go.gain.setValueAtTime(0.0001, 0);
    go.gain.exponentialRampToValueAtTime(0.12, dur * 0.95);
    go.gain.linearRampToValueAtTime(0, dur);
    o.connect(go).connect(saida);
    o.start(0); o.stop(dur);
  } else if (id === 'rufar') {
    // caixa cada vez mais rápida e o prato no fim
    const r = ruido(ctx, 0.2);
    let t = 0, passo = 0.09;
    while (t < 1.3) { chiado(ctx, saida, r, t, 0.08, 0.25 + 0.35 * (t / 1.3), 1800); t += passo; passo = Math.max(0.035, passo * 0.93); }
    bumbo(ctx, saida, 1.35, 1);
    chiado(ctx, saida, ruido(ctx, 0.9), 1.35, 0.8, 0.5, 5000);
  } else if (id === 'boing') {
    const o = ctx.createOscillator(), g = ctx.createGain(), lfo = ctx.createOscillator(), lg = ctx.createGain();
    o.frequency.setValueAtTime(160, 0);
    o.frequency.exponentialRampToValueAtTime(520, 0.12);
    lfo.frequency.value = 18; lg.gain.value = 40;
    lfo.connect(lg).connect(o.frequency);
    g.gain.setValueAtTime(0.0001, 0);
    g.gain.exponentialRampToValueAtTime(0.6, 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, dur);
    o.connect(g).connect(saida);
    o.start(0); lfo.start(0); o.stop(dur); lfo.stop(dur);
  } else if (id === 'glitch') {
    // pedacinhos de onda quadrada em alturas sorteadas, cortados seco
    let t = 0;
    while (t < dur - 0.03) {
      const d = 0.015 + sorte() * 0.04;
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'square';
      o.frequency.value = 120 + sorte() * 1800;
      g.gain.setValueAtTime(sorte() < 0.25 ? 0 : 0.18, t);
      o.connect(g).connect(saida);
      o.start(t); o.stop(t + d);
      t += d;
    }
  } else if (id === 'arranhao') {
    // a agulha indo e voltando: ruído com filtro que oscila rápido e cai
    const s = ctx.createBufferSource();
    s.buffer = ruido(ctx, dur);
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass'; f.Q.value = 4;
    f.frequency.setValueAtTime(2600, 0);
    [0.08, 0.16, 0.26, 0.4, 0.58].forEach((t, k) => f.frequency.exponentialRampToValueAtTime(k % 2 ? 2600 : 500, t));
    const g = ctx.createGain();
    g.gain.setValueAtTime(1.4, 0);
    g.gain.exponentialRampToValueAtTime(0.001, dur);
    s.connect(f).connect(g).connect(saida);
    s.start();
  } else if (id === 'whoosh') {
    // ruído passando por um filtro que sobe e desce: o "vento" que acompanha o gancho entrando
    const s = ctx.createBufferSource();
    s.buffer = ruido(ctx, dur);
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = 1.2;
    f.frequency.setValueAtTime(250, 0);
    f.frequency.exponentialRampToValueAtTime(5000, dur * 0.55);
    f.frequency.exponentialRampToValueAtTime(900, dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.001, 0);
    g.gain.exponentialRampToValueAtTime(1.6, dur * 0.5);
    g.gain.exponentialRampToValueAtTime(0.001, dur);
    s.connect(f).connect(g).connect(ctx.destination);
    s.start();
  } else if (id === 'impacto') {
    // grave que cai + estalo: a prensa batendo
    bumbo(ctx, ctx.destination, 0, 1.2);
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.setValueAtTime(90, 0);
    o.frequency.exponentialRampToValueAtTime(32, 1.0);
    g.gain.setValueAtTime(0.9, 0);
    g.gain.exponentialRampToValueAtTime(0.001, 1.15);
    o.connect(g).connect(ctx.destination);
    o.start(0); o.stop(1.2);
    chiado(ctx, ctx.destination, ruido(ctx, 0.3), 0, 0.12, 0.6, 2500);
  } else {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.setValueAtTime(900, 0);
    o.frequency.exponentialRampToValueAtTime(420, 0.12);
    g.gain.setValueAtTime(0.9, 0);
    g.gain.exponentialRampToValueAtTime(0.001, 0.2);
    o.connect(g).connect(ctx.destination);
    o.start(0); o.stop(0.22);
  }
  return ctx.startRendering();
}
