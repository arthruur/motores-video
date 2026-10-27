// "Baião do Mangaio" arranjado para o vídeo da parceria (mesmos timbres de app/src/trilhas.ts):
// sintetizado no Web Audio, sem gravação de ninguém. Tudo marcado em batidas a 116 BPM.
//   compassos 0–1   introdução: sanfona sustentada + triângulo (o mundo amanhece)
//   compassos 2–13  baião completo (o cesto anda, a câmera entra no Bistrô)
//   batidas 28–30   respiro: só triângulo e sanfona enquanto a câmera atravessa a porta
//   batida 56       acorde final com a zabumba, soando até o fim
const BPM = 116, BATIDAS = 60, CAUDA = 1.6
const tempo = 60 / BPM
window.MUSICA = { BPM, BATIDAS, duracao: BATIDAS * tempo + CAUDA }

const hz = s => 110 * 2 ** (s / 12)
const DM = [5, 8, 12], A7 = [0, 4, 7, 10], G = [-2, 2, 5]
const PROG = [DM, DM, A7, A7, G, G, A7, DM]

function nota(ctx, dest, f, ini, dur, tipo, vol, ataque = 0.4) {
  const o = ctx.createOscillator(), g = ctx.createGain()
  o.type = tipo; o.frequency.value = f
  g.gain.setValueAtTime(0, ini)
  g.gain.linearRampToValueAtTime(vol, ini + ataque)
  g.gain.setValueAtTime(vol, ini + Math.max(ataque, dur - 0.3))
  g.gain.linearRampToValueAtTime(0, ini + dur)
  o.connect(g).connect(dest); o.start(ini); o.stop(ini + dur + 0.05)
}
function ruido(ctx, dur) {
  const b = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate), d = b.getChannelData(0)
  let s = 1234567
  for (let i = 0; i < d.length; i++) { s = (s * 16807) % 2147483647; d[i] = s / 1073741823.5 - 1 }
  return b
}
function bumbo(ctx, dest, t, vol) {
  const o = ctx.createOscillator(), g = ctx.createGain()
  o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(45, t + 0.12)
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.35)
  o.connect(g).connect(dest); o.start(t); o.stop(t + 0.4)
}
function chiado(ctx, dest, buf, t, dur, vol, corte) {
  const s = ctx.createBufferSource(); s.buffer = buf
  const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = corte
  const g = ctx.createGain()
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur)
  s.connect(f).connect(g).connect(dest); s.start(t, (t * 0.37) % 1); s.stop(t + dur + 0.02)
}
// baião em 8 semicolcheias por meio compasso de 4/4 (ver trilhas.ts)
const BAIAO = { zabumba: [0, 3], bacalhau: [4, 6], aberto: [2, 6], baixo: [0, 3, 6], sanfona: [2, 6] }

async function gerar(taxa = 48000) {
  const dur = window.MUSICA.duracao
  const ctx = new OfflineAudioContext(2, Math.ceil(dur * taxa), taxa)
  const mestre = ctx.createGain(); mestre.gain.value = 0.9
  const filtro = ctx.createBiquadFilter(); filtro.type = 'lowpass'; filtro.frequency.value = 1400
  filtro.connect(mestre).connect(ctx.destination)
  const buf = ruido(ctx, 1.2)
  const passo = tempo / 4               // semicolcheia: 16 por compasso de 4/4 (dois "compassos" de baião)

  for (let c = 0; c < BATIDAS / 4; c++) {
    const t0 = c * 4 * tempo
    const ac = PROG[(c + 6) % PROG.length]        // começa em DM e cai na tônica no fim
    if (c < 2) {
      // introdução: acorde longo e triângulo leve
      for (const s of ac) { nota(ctx, filtro, hz(s + 12), t0, 4 * tempo, 'sawtooth', 0.014, 0.6); nota(ctx, filtro, hz(s), t0, 4 * tempo, 'triangle', 0.05, 0.6) }
      for (let k = 0; k < 16; k++) chiado(ctx, mestre, buf, t0 + k * passo, k % 4 === 2 ? 0.14 : 0.03, k % 4 === 2 ? 0.05 : 0.025, 8000)
      if (c === 1) { bumbo(ctx, mestre, t0 + 3 * tempo, 0.45); bumbo(ctx, mestre, t0 + 3.5 * tempo, 0.5) }   // entrada
      continue
    }
    if (c === 14) {
      // final: zabumba e acorde soando
      bumbo(ctx, mestre, t0, 0.7); chiado(ctx, mestre, buf, t0, 0.5, 0.08, 6000)
      for (const s of DM) { nota(ctx, filtro, hz(s + 12), t0, 4 * tempo + CAUDA, 'sawtooth', 0.026, 0.01); nota(ctx, filtro, hz(s), t0, 4 * tempo + CAUDA, 'triangle', 0.06, 0.01) }
      nota(ctx, filtro, hz(DM[0] - 12), t0, 3 * tempo, 'triangle', 0.18, 0.01)
      continue
    }
    for (let k = 0; k < 16; k++) {
      const t = t0 + k * passo, b = c * 4 + k / 4             // k em semicolcheias
      const kk = (k % 8)                                      // posição dentro do meio compasso de baião
      const pausa = b >= 28 && b < 30                         // respiro na porta do Bistrô
      if (!pausa && BAIAO.zabumba.includes(kk)) bumbo(ctx, mestre, t, 0.55)
      if (!pausa && BAIAO.bacalhau.includes(kk)) chiado(ctx, mestre, buf, t, 0.05, 0.12, 2500)
      chiado(ctx, mestre, buf, t, BAIAO.aberto.includes(kk) ? 0.14 : 0.03, BAIAO.aberto.includes(kk) ? 0.06 : 0.03, 8000)
      if (!pausa && BAIAO.baixo.includes(kk)) nota(ctx, filtro, hz(ac[0] - 12 + (kk === 6 ? 7 : 0)), t, passo * 2.5, 'triangle', 0.16, 0.01)
      if (BAIAO.sanfona.includes(kk)) for (const s of ac) nota(ctx, filtro, hz(s + 12), t, passo * (pausa ? 3 : 1.6), 'sawtooth', 0.022, 0.01)
    }
  }
  return ctx.startRendering()
}

// AudioBuffer → WAV 16 bits (base64), para o Node gravar
window.trilhaWav = async () => {
  const b = await gerar()
  const n = b.length, ch = b.numberOfChannels, dados = new DataView(new ArrayBuffer(44 + n * ch * 2))
  const str = (o, s) => [...s].forEach((c, i) => dados.setUint8(o + i, c.charCodeAt(0)))
  str(0, 'RIFF'); dados.setUint32(4, 36 + n * ch * 2, true); str(8, 'WAVEfmt ')
  dados.setUint32(16, 16, true); dados.setUint16(20, 1, true); dados.setUint16(22, ch, true)
  dados.setUint32(24, b.sampleRate, true); dados.setUint32(28, b.sampleRate * ch * 2, true)
  dados.setUint16(32, ch * 2, true); dados.setUint16(34, 16, true); str(36, 'data'); dados.setUint32(40, n * ch * 2, true)
  const canais = [...Array(ch)].map((_, i) => b.getChannelData(i))
  let o = 44
  for (let i = 0; i < n; i++) for (const c of canais) { dados.setInt16(o, Math.max(-1, Math.min(1, c[i])) * 32767, true); o += 2 }
  const bytes = new Uint8Array(dados.buffer)
  let s = ''
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(s)
}
