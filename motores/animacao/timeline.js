// motores/animacao/timeline.js
// Matemática determinística, curvas de easing (antecipação, mola, follow-through),
// quantização "em dois" (15 fps) e controlador puro de timeline e deixas para window.seek(t).
// Segue estritamente motores/render/CONTRATO.md e motores/animacao/ARQUITETURA.md.

export const r = (x, casas = 2) => +(+x).toFixed(casas)
export const lim = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x))
export const mix = (a, b, q) => a + (b - a) * q
export const fase = (t, ini, dur) => (dur <= 0 ? (t >= ini ? 1 : 0) : lim((t - ini) / dur))

// Quantização de tempo: atuação "em dois" (15 poses/s num vídeo a 30 fps)
export const emDois = (t, fps = 30) => {
  const passo = 2 / fps
  return Math.floor((t + 1e-6) / passo) * passo
}

// Curvas de easing puras (0..1 -> 0..1)
export const suave = q => {
  const u = lim(q)
  return u * u * (3 - 2 * u)
}
export const entrada = q => {
  const u = lim(q)
  return u * u * u
}
export const saida = q => {
  const u = lim(q)
  return 1 - (1 - u) ** 3
}
export const entradaSaida = q => {
  const u = lim(q)
  return u < 0.5 ? 4 * u * u * u : 1 - ((-2 * u + 2) ** 3) / 2
}
export const arco = q => {
  const u = lim(q)
  return 4 * u * (1 - u)
}

// Antecipação: nos primeiros `pAnt` (ex.: 18% da duração), recua até `-forca`
// e depois avança suavemente até 1.0.
export function antecipar(q, forca = 0.16, pAnt = 0.18) {
  const u = lim(q)
  if (u <= 0) return 0
  if (u >= 1) return 1
  if (u < pAnt) {
    const a = u / pAnt
    return -forca * Math.sin(a * Math.PI)
  }
  const b = (u - pAnt) / (1 - pAnt)
  return saida(b)
}

// Oscilação de mola amortecida determinística para dt >= 0 (segundos após o impulso)
export const mola = (dt, freq = 2.6, amort = 5.5) =>
  dt <= 0 ? 0 : Math.exp(-amort * dt) * Math.cos(2 * Math.PI * freq * dt)

// Follow-through: responde com pequeno atraso e sobrepasso elástico
export function followThrough(dt, dur = 0.6, atraso = 0.06, freq = 2.4, amort = 5.0) {
  const tEf = dt - atraso
  if (tEf <= 0) return 0
  if (tEf < dur) return saida(tEf / dur)
  return 1 + 0.14 * mola(tEf - dur, freq, amort)
}

// PRNG determinístico com semente fixa (retorna float em [0, 1))
export const hash = (indice, semente = 1) => {
  const s = Math.sin(indice * 127.1 + semente * 311.7 + 74.7) * 43758.5453123
  return s - Math.floor(s)
}

// Ruído 1D contínuo e determinístico (para vento, fumaça, mormaço, tremida)
export function ruidoSuave(t, semente = 1) {
  const i = Math.floor(t)
  const f = t - i
  return mix(hash(i, semente), hash(i + 1, semente), suave(f)) * 2 - 1
}

// Gera polígono / curva Bézier fechada orgânica ("desenhada à mão", nunca círculo perfeito)
export function caminhoBlob(cx, cy, rx, ry, pontas = 8, irregularidade = 0.14, semente = 1, rotRad = 0) {
  const pts = []
  for (let i = 0; i < pontas; i++) {
    const ang = (i / pontas) * Math.PI * 2 + rotRad
    const varR = 1 + (hash(i * 3 + 1, semente) - 0.5) * 2 * irregularidade
    const px = cx + Math.cos(ang) * rx * varR
    const py = cy + Math.sin(ang) * ry * varR
    pts.push([px, py])
  }
  let d = ''
  for (let i = 0; i < pontas; i++) {
    const p0 = pts[i]
    const p1 = pts[(i + 1) % pontas]
    const mx = (p0[0] + p1[0]) / 2
    const my = (p0[1] + p1[1]) / 2
    if (i === 0) d += `M${r(mx, 1)} ${r(my, 1)}`
    const pNext = pts[(i + 2) % pontas]
    const nx = (p1[0] + pNext[0]) / 2
    const ny = (p1[1] + pNext[1]) / 2
    d += ` Q${r(p1[0], 1)} ${r(p1[1], 1)} ${r(nx, 1)} ${r(ny, 1)}`
  }
  return d + ' Z'
}

// Resolve o tempo `t` (em segundos da cena) de uma deixa ou som a partir de `t` ou `ancora`
export function resolverInstante(item, falas = []) {
  if (typeof item.t === 'number') return item.t
  const anc = item.ancora || (typeof item.fala === 'number' ? item : null)
  if (!anc || typeof anc.fala !== 'number' || !falas[anc.fala]) return 0
  const fl = falas[anc.fala]
  const delta = anc.d ?? 0
  if (anc.ref === 'fim') return r((fl.ini ?? 0) + (fl.dur ?? 0) + delta, 3)
  if (anc.ref === 'palavra' && anc.palavra && Array.isArray(fl.palavras)) {
    const alvo = String(anc.palavra).toLowerCase().replace(/[^\p{L}]/gu, '')
    const achou = fl.palavras.find(w => w.texto.toLowerCase().replace(/[^\p{L}]/gu, '') === alvo)
    if (achou) return r(achou.inicio + delta, 3)
  }
  return r((fl.ini ?? 0) + delta, 3)
}

// Cria o controlador puro de timeline para um episódio ou vitrine
export function criarTimeline(plano) {
  const fps = plano.fps || 30
  const cenas = (plano.cenas || []).map((c, idx) => {
    const falas = c.falas || []
    const deixas = (c.deixas || []).map((dx, k) => {
      const t = resolverInstante(dx, falas)
      const ef = typeof dx.efeito === 'string' ? { id: dx.efeito } : (dx.efeito || null)
      const ac = dx.acao || null
      const durEf = ef?.dur ?? dx.dur ?? 0.8
      const durAc = ac?.dur ?? dx.dur ?? 0.8
      const durTotal = Math.max(durEf, durAc, dx.dur ?? 0.6)
      return {
        ...dx,
        id: dx.id || `deixa_${c.id}_${k}`,
        t,
        dur: durTotal,
        camada: dx.camada || 'frente',
        pos: dx.pos || [540, 1190],
        efeito: ef ? { dur: durEf, escala: 1, semente: k + idx * 17 + 1, params: {}, ...ef } : null,
        acao: ac ? { dur: durAc, params: {}, ...ac } : null,
      }
    })
    return {
      ...c,
      indice: idx,
      ini: c.ini ?? 0,
      dur: c.dur ?? 5,
      transicao: c.transicao || { tipo: 'corte', dur: 0 },
      falas,
      deixas,
    }
  })

  const duracao = plano.duracao ?? (cenas.length ? r(cenas.at(-1).ini + cenas.at(-1).dur, 3) : 5)

  function cenasVisiveis(t) {
    const visiveis = []
    for (let i = 0; i < cenas.length; i++) {
      const c = cenas[i]
      const tl = t - c.ini
      const ultima = i === cenas.length - 1
      if (tl >= -1e-4 && (ultima ? tl <= c.dur + 1e-4 : tl < c.dur)) {
        const tr = c.transicao || { tipo: 'corte', dur: 0 }
        const durTr = !ultima && tr.dur > 0 ? tr.dur : 0
        const emTransicao = durTr > 0 && tl >= c.dur - durTr
        const uTr = emTransicao ? lim((tl - (c.dur - durTr)) / durTr) : 0
        visiveis.push({
          cena: c,
          indice: i,
          tl: Math.max(0, tl),
          emTransicao,
          uTransicao: uTr,
          transicao: tr,
        })
      }
    }
    if (!visiveis.length && cenas.length) {
      const ult = cenas.at(-1)
      visiveis.push({ cena: ult, indice: cenas.length - 1, tl: ult.dur, emTransicao: false, uTransicao: 0, transicao: ult.transicao })
    }
    return visiveis
  }

  function deixasAtivas(cena, tl) {
    const ativas = []
    for (const dx of cena.deixas || []) {
      const dt = tl - dx.t
      if (dt >= -1e-4 && dt <= dx.dur + 1e-4) {
        ativas.push({
          ...dx,
          dt: Math.max(0, dt),
          u: fase(tl, dx.t, dx.dur),
          uEfeito: dx.efeito ? fase(tl, dx.t, dx.efeito.dur) : 0,
          uAcao: dx.acao ? fase(tl, dx.t, dx.acao.dur) : 0,
        })
      }
    }
    return ativas
  }

  function chaveEstado(t) {
    const q = Math.round(t * fps)
    return `f:${q}`
  }

  return {
    fps,
    duracao,
    cenas,
    cenasVisiveis,
    deixasAtivas,
    chaveEstado,
  }
}

if (typeof window !== 'undefined') {
  window.AnimTimeline = {
    r, lim, mix, fase, emDois, suave, entrada, saida, entradaSaida, arco,
    antecipar, mola, followThrough, hash, ruidoSuave, caminhoBlob,
    resolverInstante, criarTimeline,
  }
}
