// Trilha do edit de Canudos, sintetizada no Web Audio (sem gravação de ninguém, sem direitos de terceiros).
// Segue as seções do roteiro: cada plano diz se é tensão, batida, drop, calmo ou fim, e os golpes caem nos cortes.
//   window.trilhaWav({ bpm, planos: [{ ini, dur, secao, flash }], duracao }) → WAV 16 bits em base64

const hz = s => 73.42 * 2 ** (s / 12)                    // semitons a partir de Ré 2
const DM = [0, 3, 7, 10], BB = [-4, 0, 3, 7], GM = [-7, -4, 0, 3]
const ARPEJO = [12, 15, 19, 22, 24, 22, 19, 15]

function ruido(ctx, dur) {
  const b = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate), d = b.getChannelData(0)
  let s = 1234567
  for (let i = 0; i < d.length; i++) { s = (s * 16807) % 2147483647; d[i] = s / 1073741823.5 - 1 }
  return b
}
function nota(ctx, dest, f, ini, dur, tipo, vol, ataque = 0.4, solta = 0.3) {
  const o = ctx.createOscillator(), g = ctx.createGain()
  o.type = tipo; o.frequency.value = f
  g.gain.setValueAtTime(0, ini)
  g.gain.linearRampToValueAtTime(vol, ini + ataque)
  g.gain.setValueAtTime(vol, ini + Math.max(ataque, dur - solta))
  g.gain.linearRampToValueAtTime(0, ini + dur)
  o.connect(g).connect(dest); o.start(ini); o.stop(ini + dur + 0.05)
}
function tecla(ctx, dest, f, t, vol) {                   // "piano": ataque seco e queda longa
  const o = ctx.createOscillator(), g = ctx.createGain()
  o.type = 'triangle'; o.frequency.value = f
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + 1.6)
  o.connect(g).connect(dest); o.start(t); o.stop(t + 1.7)
}
function bumbo(ctx, dest, t, vol, grave = 45, cauda = 0.4) {
  const o = ctx.createOscillator(), g = ctx.createGain()
  o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(grave, t + 0.14)
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + cauda)
  o.connect(g).connect(dest); o.start(t); o.stop(t + cauda + 0.05)
}
function chiado(ctx, dest, buf, t, dur, vol, corte, tipo = 'highpass') {
  const s = ctx.createBufferSource(); s.buffer = buf
  const f = ctx.createBiquadFilter(); f.type = tipo; f.frequency.value = corte
  const g = ctx.createGain()
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur)
  s.connect(f).connect(g).connect(dest); s.start(t, (t * 0.37) % 1); s.stop(t + dur + 0.02)
}
// golpe de cinema: bumbo fundo + estouro de ruído + "braam" de serras desafinadas
function golpe(ctx, dest, buf, t, forte = 1) {
  bumbo(ctx, dest, t, 0.95 * forte, 38, 1.6)
  chiado(ctx, dest, buf, t, 0.9, 0.35 * forte, 900, 'lowpass')
  const f = ctx.createBiquadFilter(); f.type = 'lowpass'
  f.frequency.setValueAtTime(1800, t); f.frequency.exponentialRampToValueAtTime(220, t + 2.2)
  f.connect(dest)
  for (const [s, d] of [[-12, 0], [-12, 7], [-5, -6], [0, 5], [3, -4]]) {
    const o = ctx.createOscillator(), g = ctx.createGain()
    o.type = 'sawtooth'; o.frequency.value = hz(s); o.detune.value = d
    g.gain.setValueAtTime(0.06 * forte, t); g.gain.exponentialRampToValueAtTime(0.001, t + 2.4)
    o.connect(g).connect(f); o.start(t); o.stop(t + 2.5)
  }
}
// subida de ruído antes do corte
function subida(ctx, dest, buf, t, dur) {
  const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true
  const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 3
  f.frequency.setValueAtTime(300, t); f.frequency.exponentialRampToValueAtTime(6000, t + dur)
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.001, t); g.gain.exponentialRampToValueAtTime(0.25, t + dur)
  s.connect(f).connect(g).connect(dest); s.start(t); s.stop(t + dur)
}

async function gerar({ bpm, planos, duracao }, taxa = 48000) {
  const seg = 60 / bpm
  const ctx = new OfflineAudioContext(2, Math.ceil((duracao + 0.5) * taxa), taxa)
  const comp = ctx.createDynamicsCompressor()
  comp.threshold.value = -16; comp.ratio.value = 4; comp.attack.value = 0.005; comp.release.value = 0.25
  const mestre = ctx.createGain(); mestre.gain.value = 0.8
  comp.connect(mestre).connect(ctx.destination)
  const grave = ctx.createBiquadFilter(); grave.type = 'lowpass'; grave.frequency.value = 520
  grave.connect(comp)
  const buf = ruido(ctx, 2)

  planos.forEach((p, i) => {
    const prox = planos[i + 1]
    const fim = p.ini + p.dur
    const batidas = Math.round(p.dur / seg)
    const ac = [DM, BB, GM, DM][i % 4]
    if (p.secao !== 'fim') {
      // tapete grave que segura tudo, mais forte no drop
      const v = p.secao === 'drop' ? 0.07 : p.secao === 'calmo' ? 0.035 : 0.05
      for (const s of [ac[0] - 12, ac[0] - 5]) nota(ctx, grave, hz(s), p.ini, p.dur + 0.05, 'sawtooth', v, 0.05, 0.05)
    }
    if (p.secao === 'tensao') {
      for (let b = 0; b < batidas; b++) {                // batimento: dois toques por batida
        bumbo(ctx, comp, p.ini + b * seg, 0.45, 50, 0.3)
        bumbo(ctx, comp, p.ini + (b + 0.28) * seg, 0.25, 50, 0.25)
      }
      if (prox && prox.secao !== 'tensao') subida(ctx, comp, buf, fim - Math.min(2 * seg, p.dur), Math.min(2 * seg, p.dur))
    }
    if (p.secao === 'batida') {
      golpe(ctx, comp, buf, p.ini, 0.8)
      for (let b = 1; b < batidas; b++) bumbo(ctx, comp, p.ini + b * seg, 0.5, 48, 0.35)
      if (prox && prox.secao === 'drop') subida(ctx, comp, buf, fim - seg, seg)
    }
    if (p.secao === 'drop') {
      if (p.flash) golpe(ctx, comp, buf, p.ini, 1)
      for (let k = 0; k < batidas * 4; k++) {
        const t = p.ini + k * seg / 4
        if (k % 4 === 0 && k) bumbo(ctx, comp, t, 0.7, 45, 0.45)
        if (k % 8 === 6) bumbo(ctx, comp, t, 0.45, 55, 0.3)
        if (k % 8 === 4) chiado(ctx, comp, buf, t, 0.22, 0.32, 1500)   // caixa
        chiado(ctx, comp, buf, t, k % 2 ? 0.03 : 0.06, k % 2 ? 0.04 : 0.07, 8000)
      }
      for (const s of ac) nota(ctx, comp, hz(s + 12), p.ini, p.dur, 'sawtooth', 0.012, 0.02, 0.1)
    }
    if (p.secao === 'calmo') {
      for (const s of ac) nota(ctx, comp, hz(s + 12), p.ini, p.dur + 0.4, 'triangle', 0.035, 0.5, 0.6)
      for (let k = 0; k < batidas * 2; k++) tecla(ctx, comp, hz(ac[0] + ARPEJO[k % ARPEJO.length]), p.ini + k * seg / 2, 0.07)
    }
    if (p.secao === 'fim') {
      golpe(ctx, comp, buf, p.ini, 1)
      for (const s of DM) nota(ctx, comp, hz(s + 12), p.ini, Math.min(p.dur, 4), 'triangle', 0.03, 0.02, 2.5)
    }
  })
  return ctx.startRendering()
}

window.trilhaWav = async roteiro => {
  const b = await gerar(roteiro)
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
