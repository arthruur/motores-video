// Kit de animação "artesanal" dos promos do Bistrô 153.
// Stop-motion: tudo anda em passos de 1/12 s ("animado em dois"), com tremor de recorte de papel
// e linha que "ferve" (filtro de turbulência que troca a cada passo).
// Regra do motor: a tela é função pura de t (motores/render/CONTRATO.md).

const K = {}
K.PASSOS = 12
K.passo = t => Math.floor(t * K.PASSOS + 1e-6) / K.PASSOS
K.lim = x => Math.min(1, Math.max(0, x))
K.fase = (t, ini, dur) => K.lim((t - ini) / dur)
K.suave = x => x * x * (3 - 2 * x)
K.saida = x => 1 - (1 - x) ** 3
K.mix = (a, b, p) => a + (b - a) * p
K.r = (x, c = 2) => +x.toFixed(c)

// pseudoaleatório com semente: o mesmo (id, passo) dá sempre o mesmo número
K.hash = (a, b = 0) => { const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return s - Math.floor(s) }
K.tremor = (id, t, amp = 1) => {
  const n = Math.floor(t * K.PASSOS + 1e-6)
  return { x: (K.hash(id, n) - 0.5) * 3 * amp, y: (K.hash(id + 50, n) - 0.5) * 3 * amp, rot: (K.hash(id + 99, n) - 0.5) * 0.8 * amp }
}

// sequência de quadros de stop-motion: valores trocados a cada passo, depois fica no último
K.quadros = (t, ini, vals) => {
  const n = Math.floor((t - ini) * K.PASSOS + 1e-6)
  return n < 0 ? null : vals[Math.min(n, vals.length - 1)]
}
K.CARIMBO = [0.45, 1.16, 0.93, 1.03, 1]          // escala de um recorte "batido" na mesa
K.CAI = [-1, -0.42, 0.06, -0.02, 0]              // queda: fração da altura

K.el = (sel) => document.querySelector(sel)
K.pos = (e, { x = 0, y = 0, s = 1, rot = 0, o = 1, tremor = null }) => {
  if (tremor) { x += tremor.x; y += tremor.y; rot += tremor.rot }
  e.style.transform = `translate(${K.r(x, 1)}px,${K.r(y, 1)}px) rotate(${K.r(rot)}deg) scale(${K.r(s, 3)})`
  e.style.opacity = K.r(o, 3)
  return `${K.r(x, 1)},${K.r(y, 1)},${K.r(rot)},${K.r(s, 3)},${K.r(o, 3)}`
}

// texto escrito à mão: revela da esquerda para a direita, em passos
K.escreve = (e, t, ini, dur) => {
  const p = K.passo(K.fase(t, ini, dur) * dur) / dur
  const v = K.lim(p)
  e.style.clipPath = v >= 1 ? 'none' : `inset(-30% ${K.r((1 - v) * 100, 1)}% -30% -5%)`
  e.style.visibility = t < ini ? 'hidden' : 'visible'
  return K.r(v, 3)
}

// traço de caneta (path com pathLength="1")
K.traca = (p, t, ini, dur) => {
  const v = K.lim(K.passo(Math.max(0, t - ini)) / dur)
  p.style.strokeDashoffset = K.r(1 - v, 3)
  p.style.visibility = t < ini ? 'hidden' : 'visible'
  return K.r(v, 3)
}

// filtro que "ferve" a linha: 3 versões com sementes diferentes, troca a cada passo
K.filtros = () => {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  s.setAttribute('width', 0); s.setAttribute('height', 0); s.style.position = 'absolute'
  s.innerHTML = [0, 1, 2].map(i => `<filter id="ferve${i}" x="-5%" y="-5%" width="110%" height="110%">
    <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="${i * 7 + 3}"/>
    <feDisplacementMap in="SourceGraphic" scale="5"/></filter>`).join('')
  document.body.appendChild(s)
}
K.ferve = (t) => `url(#ferve${Math.floor(t * K.PASSOS + 1e-6) % 3})`

// cortina de azulejos: cada peça vira em onda diagonal, cobre a tela e depois sai
K.cortina = (palco, img, colunas = 6) => {
  const lado = 1080 / colunas, linhas = Math.ceil(1920 / lado)
  const c = document.createElement('div')
  c.className = 'cortina'
  const pecas = []
  for (let j = 0; j < linhas; j++) for (let i = 0; i < colunas; i++) {
    const p = document.createElement('div')
    p.className = 'peca'
    Object.assign(p.style, { left: `${i * lado}px`, top: `${j * lado}px`, width: `${lado + 1}px`, height: `${lado + 1}px`, backgroundImage: `url(${img})` })
    c.appendChild(p)
    pecas.push({ p, d: (i + j) * 0.045 })
  }
  palco.appendChild(c)
  return (t, ini, meio) => {        // entra em ini, sai a partir de meio
    const chave = []
    const ativo = t >= ini && t < meio + 0.9
    c.style.display = ativo ? 'block' : 'none'
    if (!ativo) return '0'
    for (const { p, d } of pecas) {
      const e = K.quadros(t, ini + d, [0.2, 0.7, 1.08, 1]) ?? 0
      const s = K.quadros(t, meio + d * 0.6, [0.8, 0.4, 0]) ?? 1
      const v = Math.min(e, s)
      p.style.transform = `scale(${v}) rotate(${K.r((1 - v) * 40, 1)}deg)`
      chave.push(v)
    }
    return chave.join('')
  }
}

// fita crepe: recorte com pontas rasgadas
K.fita = (pai, { x, y, rot, w = 210 }) => {
  const f = document.createElement('div')
  f.className = 'fita'
  f.style.width = `${w}px`
  f.style.left = `${x - w / 2}px`; f.style.top = `${y - 28}px`
  f.dataset.rot = rot
  pai.appendChild(f)
  return f
}

window.K = K
