// Novela da Caatinga, cap. 1 "A Inauguração": as cenas, quadro a quadro, a partir de tempos.json.
// Tudo é função de t (window.seek), sem relógio: cada quadro redesenha o SVG da cena inteira.
// O Cesto é o mascote do Mangaio (mascote.svg), mexido pelos grupos nomeados (olhos, braços), como no site.
// As falas dão o tempo (c.falas[i].ini/dur, em segundos da cena), o "env" abre a boca de quem fala,
// e as deixas de som (c.sons) dão o tempo das ações que precisam cair junto com o som.

const W = 1080, H = 1920
const r = (x, n = 2) => +(+x).toFixed(n)
const lim = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x))
const fase = (t, a, d) => lim((t - a) / d)
const suave = q => q * q * (3 - 2 * q)
const saida = q => 1 - (1 - q) ** 3
const mix = (a, b, q) => a + (b - a) * q
const mola = (t, f = 2.6, k = 5) => (t < 0 ? 0 : Math.exp(-k * t) * Math.cos(2 * Math.PI * f * t))
const h = (a, b = 0) => { const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return s - Math.floor(s) }
const el = (tag, cls, pai, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; pai?.appendChild(e); return e }
const T_ = window.TINTA

// ---------- ajudantes de tempo de cada cena ----------
function relogio(c) {
  const F = i => c.falas[i]
  return {
    ini: i => F(i).ini,
    fim: i => F(i).ini + F(i).dur,
    som: (id, k = 0) => (c.sons.filter(s => s.id === id)[k] || {}).t ?? 1e9,
    // boca aberta de quem fala agora (o env da fala, 30 por segundo)
    boca: (quem, t) => {
      for (const f of c.falas) if (f.quem === quem && t >= f.ini && t < f.ini + f.dur) return f.env[Math.floor((t - f.ini) * 30)] ?? 0
      return 0
    },
    falando: (quem, t) => c.falas.some(f => f.quem === quem && t >= f.ini - 0.1 && t < f.ini + f.dur + 0.15),
    // instante em que uma palavra é dita na fala i
    palavra: (i, p) => (F(i).palavras.find(w => w.texto.toLowerCase().replace(/[^\p{L}]/gu, '') === p) || { inicio: F(i).ini }).inicio,
  }
}
const pisca = (t, sem) => { const p = 2.9 + (sem % 1.4); const u = (t + sem * 1.7) % p; return u < 0.15 ? Math.sin((u / 0.15) * Math.PI) : 0 }
// respiração parada + balanço da fala
function vivo(R, quem, t, sem, extra = {}) {
  const b = R.boca(quem, t)
  const res = Math.sin(t * 2.3 + sem) * 0.012
  return { fala: b, pisca: pisca(t, sem), sx: 1 - res - b * 0.02, sy: 1 + res + b * 0.035, ...extra }
}

// ---------- cenário ----------
const traco = (w = 5) => `stroke="${T_}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"`
function serra(y, cor, sem, amp = 60) {
  let d = `M-20 ${y + 200} L-20 ${y}`
  for (let x = -20, i = 0; x <= W + 60; x += 90, i++) d += ` Q${x + 45} ${r(y - amp * h(i, sem))} ${x + 90} ${r(y + (h(i + 3, sem) - 0.5) * amp * 0.5)}`
  return `<path d="${d} L${W + 80} ${y + 200} Z" fill="${cor}"/>`
}
function chao(y, cor = '#c99e62', sem = 1) {
  let d = `M-20 ${H} L-20 ${y}`
  for (let x = -20, i = 0; x <= W + 60; x += 70, i++) d += ` L${x + 70} ${r(y + (h(i, sem) - 0.5) * 12)}`
  let riscos = ''
  for (let i = 0; i < 28; i++) {
    const x = h(i, sem + 5) * W, yy = y + 30 + h(i, sem + 6) * (H - y - 60)
    riscos += `<path d="M${r(x)} ${r(yy)} q14 -4 ${r(26 + h(i, 9) * 30)} 0" fill="none" stroke="#8a6638" stroke-width="3" opacity=".5"/>`
  }
  return `<path d="${d} L${W + 80} ${H} Z" fill="${cor}" ${traco(4)}/>${riscos}`
}
const sol = (x, y, rr) => `<circle cx="${x}" cy="${y}" r="${rr}" fill="#f2b84a" opacity=".85"/><circle cx="${x}" cy="${y}" r="${rr * 1.35}" fill="#f2b84a" opacity=".18"/>`
function banca(x0, x1, yTampo, listras = ['#c8402e', '#f2e5c9']) {
  const toldoY = yTampo - 430
  let toldo = ''
  const n = 8, w = (x1 - x0 + 80) / n
  for (let i = 0; i < n; i++) {
    const x = x0 - 40 + i * w
    toldo += `<path d="M${r(x)} ${toldoY} L${r(x + w)} ${toldoY} L${r(x + w)} ${toldoY + 70} Q${r(x + w / 2)} ${toldoY + 100} ${r(x)} ${toldoY + 70} Z" fill="${listras[i % 2]}" ${traco(4)}/>`
  }
  return {
    fundo: `<path d="M${x0 + 20} ${toldoY + 60} L${x0 + 20} ${yTampo + 200} M${x1 - 20} ${toldoY + 60} L${x1 - 20} ${yTampo + 200}" ${traco(14)}/><path d="M${x0 + 20} ${toldoY + 60} L${x0 + 20} ${yTampo + 200} M${x1 - 20} ${toldoY + 60} L${x1 - 20} ${yTampo + 200}" stroke="#9a6a3a" stroke-width="8"/>${toldo}`,
    frente: `<rect x="${x0}" y="${yTampo}" width="${x1 - x0}" height="34" rx="6" fill="#b07a42" ${traco(5)}/>
      <rect x="${x0 + 30}" y="${yTampo + 34}" width="${x1 - x0 - 60}" height="150" fill="#9a6a3a" ${traco(5)}/>
      ${[1, 2, 3].map(i => `<path d="M${x0 + 30} ${yTampo + 34 + i * 38} L${x1 - 30} ${yTampo + 34 + i * 38}" stroke="#7a5230" stroke-width="4"/>`).join('')}`,
  }
}
const caixote = (x, y, s = 1) => `<g transform="translate(${x} ${y}) scale(${s})"><rect x="-70" y="-90" width="140" height="90" fill="#c99a5a" ${traco(4)}/>${[-60, -30].map(yy => `<path d="M-70 ${yy} L70 ${yy}" stroke="#8a6638" stroke-width="4"/>`).join('')}</g>`
function poeira(t, sem, n = 18, y0 = 900, y1 = 1500, vel = 60) {
  let s = ''
  for (let i = 0; i < n; i++) {
    const x = ((h(i, sem) * (W + 200) + t * vel * (0.6 + h(i, sem + 1))) % (W + 200)) - 100
    const y = y0 + h(i, sem + 2) * (y1 - y0) + Math.sin(t * 1.3 + i) * 10
    s += `<circle cx="${r(x)}" cy="${r(y)}" r="${r(2 + h(i, sem + 3) * 4)}" fill="#a8824e" opacity="${r(0.25 + h(i, 5) * 0.3)}"/>`
  }
  return s
}
function nuvemPoeira(x, y, q, escala = 1) { // q 0..1: cresce e some
  if (q <= 0 || q >= 1) return ''
  let s = ''
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI - Math.PI, d = 30 + 90 * saida(q)
    s += `<circle cx="${r(x + Math.cos(a) * d * 1.4 * escala)}" cy="${r(y + Math.sin(a) * d * 0.5 * escala)}" r="${r((18 + 26 * q) * escala)}" fill="#d8bb8c" opacity="${r(0.7 * (1 - q))}" ${traco(3)}/>`
  }
  return s
}
function rachaduras(y0, sem) {
  let s = ''
  for (let i = 0; i < 26; i++) {
    let x = h(i, sem) * W, y = y0 + 40 + h(i, sem + 1) * (H - y0 - 60), d = `M${r(x)} ${r(y)}`
    let a = h(i, sem + 2) * Math.PI * 2
    for (let k = 0; k < 5; k++) { a += (h(i * 7 + k, sem) - 0.5) * 1.6; x += Math.cos(a) * 46; y += Math.sin(a) * 22; d += ` L${r(x)} ${r(y)}` }
    s += `<path d="${d}" fill="none" ${traco(3.5)} opacity=".75"/>`
  }
  return s
}
function regua(x, yb, nivel) { // a régua do açude: o relógio da seca (bíblia: "o nível do açude aparece no fundo")
  let m = ''
  for (let i = 0; i < 9; i++) m += `<path d="M${x - 14} ${yb - 30 - i * 32} l${i % 2 ? 14 : 28} 0" ${traco(4)}/>`
  return `<rect x="${x - 16}" y="${yb - 320}" width="32" height="330" fill="#d9b682" ${traco(4)}/>${m}
    <path d="M${x - 70} ${yb - 30 - nivel * 260} q35 -10 70 0 q35 10 70 0" fill="none" stroke="#5f8aa0" stroke-width="7" stroke-linecap="round"/>`
}
function umbuzeiro(x, y, s = 1) {
  return `<g transform="translate(${x} ${y}) scale(${s})"><path d="M-30 0 C-24 -120 -60 -190 -90 -230 M-10 0 C-10 -140 30 -200 70 -250 M-30 0 L-10 0" fill="none" ${traco(26)}/>
    <path d="M-30 0 C-24 -120 -60 -190 -90 -230 M-10 0 C-10 -140 30 -200 70 -250" fill="none" stroke="#7a5a3a" stroke-width="18" stroke-linecap="round"/>
    ${[[-160, -290, 120], [-40, -360, 150], [110, -300, 125], [10, -250, 110], [-110, -230, 90]].map(([a, b, c]) => `<circle cx="${a}" cy="${b}" r="${c}" fill="#7c9a4e" ${traco(5)}/>`).join('')}
    ${[...Array(10)].map((_, i) => `<circle cx="${r(-180 + h(i, 4) * 330)}" cy="${r(-400 + h(i, 6) * 220)}" r="11" fill="#c6c25a" ${traco(3)}/>`).join('')}</g>`
}
function mercadinho(x0, y0, x1, yb, aceso, t) {
  // néon: apaga e acende igual ao som (som/mixar.py: apagado de 0,08 a 0,16 s e de 0,24 a 0,28 s)
  const u = t - aceso
  const liga = u >= 0 && !(u > 0.08 && u < 0.16) && !(u > 0.24 && u < 0.28)
  let prat = ''
  for (let i = 0; i < 4; i++) for (let j = 0; j < 6; j++) {
    const px = x0 + 70 + j * ((x1 - x0 - 140) / 5), py = y0 + 260 + i * 95
    prat += `<rect x="${r(px - 16)}" y="${r(py - 50)}" width="32" height="46" rx="3" fill="${['#ff3fa4', '#1f6bff', '#8a3cff', '#ffe54a'][(i + j) % 4]}" ${traco(2)}/>`
  }
  const cor = liga ? '#ff4fb0' : '#6a5a6a', cor2 = liga ? '#4fd8ff' : '#5a6070'
  const brilho = liga ? `filter="url(#neon)"` : ''
  return `<rect x="${x0}" y="${y0 + 120}" width="${x1 - x0}" height="${yb - y0 - 120}" fill="#2c3f9a" ${traco(5)}/>
    <rect x="${x0 + 40}" y="${y0 + 190}" width="${x1 - x0 - 80}" height="${yb - y0 - 330}" fill="${liga ? '#cfe9ff' : '#8a98b8'}" ${traco(4)}/>${prat}
    <rect x="${x0 + 20}" y="${y0}" width="${x1 - x0 - 40}" height="110" rx="14" fill="#1a1f3a" ${traco(5)}/>
    <text x="${(x0 + x1) / 2}" y="${y0 + 82}" text-anchor="middle" font-family="Arial Black, Arial" font-weight="900" font-size="64" fill="none" stroke="${cor}" stroke-width="7" ${brilho}>SABOR JÁ</text>
    <path d="M${x0 + 50} ${y0 + 24} L${x1 - 50} ${y0 + 24}" stroke="${cor2}" stroke-width="5" ${brilho}/>
    ${liga ? `<rect x="${x0 - 60}" y="${y0 - 60}" width="${x1 - x0 + 120}" height="${yb - y0 + 120}" fill="url(#luzNeon)" opacity=".5"/>` : ''}`
}
const fila = (t, x0, yb) => [...Array(5)].map((_, i) => { // fregueses em silhueta (a fila do Mercadinho)
  const x = x0 + i * 62, b = Math.abs(Math.sin(t * 5 + i)) * 8
  return `<g transform="translate(${x} ${yb - b})"><ellipse cx="0" cy="-70" rx="${32 + h(i, 2) * 10}" ry="${48 + h(i, 3) * 14}" fill="#7d7a9a" ${traco(4)}/><path d="M-10 -22 L-12 0 M10 -22 L12 0" ${traco(5)}/></g>`
}).join('')

// ---------- o Cesto (mascote.svg) ----------
let MASCOTE = ''
function cesto(pai) {
  const caixa = el('div', 'cesto', pai)
  caixa.innerHTML = MASCOTE
  const q = id => caixa.querySelector(`[id="${id}"]`)
  const olhos = [q('olho-esq'), q('olho-dir')], bracos = [q('braco-esq'), q('braco-dir')]
  for (const o of [...olhos, ...bracos]) o.style.transformBox = 'fill-box'
  olhos.forEach(o => (o.style.transformOrigin = '50% 55%'))
  bracos[0].style.transformOrigin = '80% 10%'; bracos[1].style.transformOrigin = '20% 10%'
  // (x, y) = meio da base no chão; alt = altura em px. pose: sx, sy, giro, pisca, piscaDir, olhar[x,y], braco
  return (x, y, alt, p = {}) => {
    const w = alt * 534 / 627
    caixa.style.display = alt > 0 ? 'block' : 'none'
    caixa.style.width = `${r(w)}px`; caixa.style.height = `${r(alt)}px`
    caixa.style.left = `${r(x - w / 2)}px`; caixa.style.top = `${r(y - alt)}px`
    caixa.style.transform = `rotate(${r(p.giro || 0)}deg) scale(${r(p.sx ?? 1, 3)},${r(p.sy ?? 1, 3)})`
    const [ox, oy] = p.olhar || [0, 0]
    olhos.forEach((o, i) => {
      const fecha = Math.max(p.pisca || 0, i === 1 ? p.piscaDir || 0 : 0, p.aperta || 0)
      o.style.transform = `translate(${r(ox * 9)}px,${r(oy * 6)}px) scaleY(${r(1 - fecha * 0.9, 3)})`
    })
    bracos.forEach((b, i) => (b.style.transform = `rotate(${r((p.braco || 0) * (i ? -1 : 1))}deg)`))
  }
}
// pulo: no ar entre t0 e t0+d, altura a; no pouso, achata e volta como mola
function pulo(t, t0, d, a) {
  const u = (t - t0) / d
  if (u < 0) return { y: 0, sx: 1, sy: 1 }
  if (u <= 1) return { y: -4 * a * u * (1 - u), sx: 0.94, sy: 1.08 }
  const m = mola(t - t0 - d, 2.4, 6)
  return { y: 0, sx: 1 + 0.16 * m, sy: 1 - 0.16 * m }
}

// ---------- as cenas ----------
const svgCena = pai => {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  s.setAttribute('class', 'arte'); s.setAttribute('width', W); s.setAttribute('height', H)
  pai.appendChild(s)
  return s
}
const CENAS = {
  acude(m, c) {
    const R = relogio(c), s = svgCena(m), cai = R.som('plof')
    const fixo = `${sol(830, 360, 105)}${serra(860, '#c7a27a', 2, 70)}${P.mandacaru(140, 905, 0.42, '#7a8f5a')}${P.mandacaru(950, 895, 0.3, '#7a8f5a')}
      <path d="M-20 900 Q540 870 1100 900 L1100 1920 L-20 1920 Z" fill="#c99a62" ${traco(4)}/>${rachaduras(900, 3)}`
    return t => {
      const z = 1 + 0.07 * suave(fase(t, 0, c.dur))
      m.style.transform = `scale(${r(z, 4)})`; m.style.transformOrigin = '540px 1150px'
      const poca = 1 - 0.18 * fase(t, 0, c.dur)
      let sa = ''
      const u = (t - (cai - 0.75)) / 0.75
      if (u >= 0) {
        const y = u < 1 ? -150 + 1330 * u * u : 1180 - Math.abs(mola(t - cai, 3, 7)) * 40 * (t - cai < 0.5 ? 1 : 0)
        sa = P.sache(560, y - 80, 1.6, u < 1 ? u * 340 : 18 + 6 * mola(t - cai, 2, 5))
      }
      s.innerHTML = `<g filter="url(#traco)">${fixo}<ellipse cx="540" cy="1215" rx="${r(170 * poca)}" ry="${r(36 * poca)}" fill="#8fa6a0" ${traco(4)}/>
        ${regua(220, 1290, 0.12)}${sa}${nuvemPoeira(560, 1185, fase(t, cai, 0.9), 1.2)}${poeira(t, 7, 12, 950, 1400, 40)}</g>`
    }
  },

  titulo(m, c) {
    const s = svgCena(m)
    const t1 = el('div', 'mao titulo', m), t2 = el('div', 'mao subtitulo', m)
    const pal = ['Novela', 'da', 'Caatinga']
    pal.forEach(p => { const e = el('span', null, t1, p); e.style.margin = '0 .14em' })
    t2.textContent = 'Capítulo 1 · A Inauguração'
    return t => {
      ;[...t1.children].forEach((sp, i) => {
        const q = fase(t, 0.15 + i * 0.17, 0.4)
        sp.style.opacity = r(q, 3)
        sp.style.transform = `translateY(${r((1 - saida(q)) * 50)}px) rotate(${r((1 - q) * (i % 2 ? 6 : -6))}deg) scale(${r(1 + 0.08 * mola(t - 0.15 - i * 0.17 - 0.4, 3, 6), 3)})`
      })
      t2.style.opacity = r(fase(t, 0.9, 0.5), 3)
      s.innerHTML = `<g filter="url(#traco)">${sol(540, 560, 80)}${P.mandacaru(150, 1400, 0.7)}${P.mandacaru(940, 1400, 0.55)}${chao(1380, '#c99e62', 4)}</g>`
    }
  },

  feira(m, c) {
    const R = relogio(c), s = svgCena(m)
    const b = banca(150, 930, 1060)
    const fixo = `${sol(880, 330, 80)}${serra(820, '#cfae84', 5, 50)}${chao(1200, '#c99e62', 2)}${b.fundo}`
    const rolo = R.som('grilo') - 0.3
    return t => {
      const fM = R.falando('maxixe', t), fQ = R.falando('quiabo', t)
      const apres = t > R.ini(4)
      const pM = t > R.ini(2) - 0.25 ? pulo(t, R.ini(2) - 0.35, 0.3, 30) : { y: 0, sx: 1, sy: 1 }
      const maxixe = P.maxixe(380, 1060 + pM.y, 1.05, vivo(R, 'maxixe', t, 1, {
        sx: pM.sx, sy: pM.sy, olhar: apres ? [0, 0.2] : fM ? [1, 0] : fQ ? [0.8, 0] : [Math.sin(t * 0.8) * 0.8, 0],
        expr: fM ? 'olhos_arregalados' : apres ? 'sorriso' : 'neutra',
        braco: apres ? 150 + 25 * Math.sin((t - R.ini(4)) * 9) : 20 }))
      const quiabo = P.quiabo(700, 1062, 1.0, vivo(R, 'quiabo', t, 2.5, {
        giro: apres ? 4 : 14, olhar: apres ? [0, 0.2] : fQ ? [-1, 0.2] : [-0.3, 0.6],
        expr: 'olhos_semicerrados', bracoE: apres ? 100 : 20 }))
      // "Hoje, não.": um rolo de mato seco atravessa a feira vazia
      const q = fase(t, rolo, 2.6)
      const x = mix(-160, W + 160, q), rot = q * 900
      const mato = q > 0 && q < 1 ? `<g transform="translate(${r(x)} ${r(1330 - Math.abs(Math.sin(q * 12)) * 40)}) rotate(${r(rot)})">${[0, 1, 2, 3].map(k => `<circle r="${42 - k * 8}" cx="${k * 3}" cy="${-k * 2}" fill="none" ${traco(3)}/>`).join('')}<path d="M-40 0 L40 0 M0 -40 L0 40 M-28 -28 L28 28" ${traco(3)}/></g>` : ''
      s.innerHTML = `<g filter="url(#traco)">${fixo}${maxixe}${quiabo}${b.frente}${caixote(130, 1330, 0.9)}${caixote(980, 1300, 0.8)}${mato}${poeira(t, 3, 10, 1100, 1450, 50)}</g>`
    }
  },

  mandioca(m, c) {
    const R = relogio(c), s = svgCena(m)
    const b = banca(120, 960, 1080, ['#e0a83a', '#f2e5c9'])
    const tPo = R.palavra(1, 'poeira')
    const saco = (x, y) => `<g transform="translate(${x} ${y})"><path d="M-70 0 Q-80 -110 -50 -150 L50 -150 Q80 -110 70 0 Z" fill="#efe2c4" ${traco(4)}/><path d="M-50 -150 Q0 -175 50 -150" fill="none" ${traco(4)}/><text x="0" y="-60" text-anchor="middle" font-family="Mao" font-size="30" fill="#9b4523">FARINHA</text></g>`
    const fixo = `${sol(160, 330, 70)}${serra(830, '#cfae84', 8, 55)}${chao(1210, '#c99e62', 6)}${b.fundo}`
    return t => {
      const fD = R.falando('dona_mandioca', t)
      const dm = P.dona_mandioca(560, 1085, 1.05, vivo(R, 'dona_mandioca', t, 3, {
        leque: -10 + 28 * Math.sin(t * (fD ? 9 : 6)), olhar: t < R.ini(1) ? [0, 0.3] : [0.3, 0.1],
        expr: fD ? 'ironica' : t > R.fim(0) ? 'ironica' : 'neutra' }))
      s.innerHTML = `<g filter="url(#traco)">${fixo}${dm}${b.frente}${saco(250, 1080)}${saco(870, 1080)}
        ${poeira(t, 9, 22, 950, 1480, 90)}${nuvemPoeira(mix(-100, 1200, fase(t, tPo - 0.4, 1.8)), 1250, fase(t, tPo - 0.4, 1.8) * 0.85, 1.6)}</g>`
    }
  },

  cesto(m, c) {
    const R = relogio(c), s = svgCena(m), C = cesto(m)
    const pousa = R.som('pouso'), oi = R.som('trompete_oi'), com = R.som('trompete_comedia')
    const fixo = `${sol(860, 330, 80)}${serra(860, '#cfae84', 11, 50)}${umbuzeiro(250, 1150, 0.9)}${chao(1150, '#c99e62', 9)}`
    return t => {
      s.innerHTML = `<g filter="url(#traco)">${fixo}<ellipse cx="560" cy="1268" rx="${r(170 - 40 * fase(t, pousa - 0.8, 0.4) + 40 * fase(t, pousa - 0.3, 0.3))}" ry="22" fill="#8a6638" opacity=".35"/></g>`
      let p = pulo(t, pousa - 0.8, 0.8, 230)
      // três pulinhos nas três notas do "oi" do trompete
      ;[0, 0.16, 0.32].forEach((d, i) => { if (t > oi + d - 0.02 && t < oi + d + 0.16) { const q = pulo(t, oi + d - 0.02, 0.15, 22 + i * 10); p = q } })
      if (t > oi + 0.32 + 0.15) { const m2 = mola(t - oi - 0.47, 2.4, 6); p = { y: 0, sx: 1 + 0.12 * m2, sy: 1 - 0.12 * m2 } }
      // escala que cai do trompete: o Cesto se desmancha de rir, balançando
      const rindo = t > com && t < com + 1.4
      const giro = rindo ? 9 * Math.sin((t - com) * 16) * (1 - fase(t, com, 1.4)) : 0
      C(560, 1270 + p.y, 560, { sx: p.sx, sy: p.sy, giro, pisca: pisca(t, 4), aperta: rindo ? 0.8 : 0,
        piscaDir: t > com + 1.5 && t < com + 1.9 ? 1 : 0, braco: rindo ? 25 : 0 })
    }
  },

  neon(m, c) {
    const R = relogio(c), s = svgCena(m)
    const aceso = R.som('neon'), sai = R.som('jingle') + 0.5, tAm = R.palavra(2, 'amostra')
    const fixo = `${serra(840, '#b39a86', 13, 40)}${chao(1230, '#bf9a6a', 12)}`
    return t => {
      const noite = fase(t, 0, 1.2) * 0.35
      const q = fase(t, sai, 0.5)
      const pr = q > 0 ? { y: 0, sx: 1 + 0.15 * mola(t - sai - 0.5, 2.5, 5), sy: 1 - 0.15 * mola(t - sai - 0.5, 2.5, 5) } : null
      const falaR = R.falando('realcador', t)
      const real = q > 0 ? P.realcador(mix(800, 560, saida(q)), 1330, mix(0.5, 1.15, saida(q)), vivo(R, 'realcador', t, 6, {
        ...pr, brilho: (t * 0.6) % 1.6, braco: falaR ? 120 + 30 * Math.sin(t * 7) : t > tAm ? 160 : 40,
        bracoE: falaR ? 110 + 30 * Math.sin(t * 7 + 2) : 40, olhar: [0, 0.2] })) : ''
      // amostras grátis jogadas para o alto
      let am = ''
      if (t > tAm) for (let i = 0; i < 6; i++) {
        const u = t - tAm - i * 0.08, vx = (h(i, 3) - 0.5) * 700, vy = -900 - h(i, 4) * 300
        if (u > 0) am += P.sache(700 + vx * u, 1000 + vy * u + 1100 * u * u, 0.9, u * 400 * (i % 2 ? 1 : -1))
      }
      const raios = q > 0 ? [...Array(12)].map((_, i) => { const a = (i / 12) * Math.PI * 2 + t * 0.4; return `<path d="M560 1050 L${r(560 + Math.cos(a) * 900)} ${r(1050 + Math.sin(a) * 900)} L${r(560 + Math.cos(a + 0.12) * 900)} ${r(1050 + Math.sin(a + 0.12) * 900)} Z" fill="#ff7fc8" opacity="${r(0.18 * q)}"/>` }).join('') : ''
      s.innerHTML = `<g filter="url(#traco)">${fixo}${mercadinho(380, 470, 1060, 1240, aceso, t)}</g>
        <rect width="1080" height="1920" fill="#1a1440" opacity="${r(noite, 3)}"/>${raios}<g filter="url(#traco)">${real}${am}</g>`
    }
  },

  fila(m, c) {
    const R = relogio(c), s = svgCena(m), C = cesto(m)
    const corre = R.som('passos'), wah = R.som('trompete_desconfianca')
    const fixo = `${serra(840, '#b39a86', 14, 40)}${chao(1220, '#bf9a6a', 15)}`
    return t => {
      const qc = fase(t, corre, 1.4)
      const fala1 = R.falando('quiabo', t)
      const mx = P.maxixe(mix(450, 770, suave(qc)), 1240, 0.62, vivo(R, 'maxixe', t, 1, {
        passo: qc > 0 && qc < 1 ? (t - corre) * 4 : null, olhar: [1, 0], expr: 'empolgado', giro: qc > 0 && qc < 1 ? 8 : 0 }))
      const qb = P.quiabo(mix(560, 890, suave(qc)), 1245, 0.58, vivo(R, 'quiabo', t, 2, {
        passo: qc > 0 && qc < 1 ? (t - corre) * 4 + 0.3 : null, olhar: fala1 ? [-1, 0] : [1, 0], expr: fala1 || qc > 0 ? 'empolgado' : 'olhos_semicerrados', giro: qc > 0 && qc < 1 ? 10 : 0 }))
      const fD = R.falando('dona_mandioca', t)
      const dm = P.dona_mandioca(330, 1215, 0.68, vivo(R, 'dona_mandioca', t, 3, {
        expr: fD || (t > R.ini(0) && t < R.ini(2)) ? 'brava' : t > R.ini(3) ? 'ironica' : 'neutra', olhar: [1, 0],
        braco: fD ? 150 : 25, bracoE: fD ? 150 : 25 }))
      // o Umbu chega devagar (bíblia: "nunca tem pressa")
      const qu = fase(t, R.ini(3) - 2.2, 2.4)
      const um = P.umbu(mix(-180, 560, qu), 1330, 0.72, vivo(R, 'umbu', t, 5, {
        passo: qu > 0 && qu < 1 ? (t - R.ini(3)) * 1.4 : null, olhar: t > R.fim(3) ? [0, 0.2] : [1, 0], expr: 'olhos_semicerrados',
        pisca: t > R.ini(4) + 1.2 && t < R.ini(4) + 1.9 ? Math.sin(fase(t, R.ini(4) + 1.2, 0.7) * Math.PI) : pisca(t, 5) }))
      s.innerHTML = `<g filter="url(#traco)">${fixo}${mercadinho(760, 760, 1100, 1225, -10, t)}${fila(t, 830, 1235)}${dm}${mx}${qb}${um}</g>`
      // o Cesto olha o néon, desconfiado: inclina no "uá-uá" do trompete
      const w = t > wah ? Math.sin(fase(t, wah, 0.85) * Math.PI * 2) * 7 : 0
      C(150, 1470, 340, { olhar: [1, -0.2], aperta: t > wah - 0.3 ? 0.55 : 0, pisca: pisca(t, 8), giro: 4 + w })
    }
  },

  licuri(m, c) {
    const R = relogio(c), s = svgCena(m)
    const cai = R.som('plof'), br = R.som('brilho')
    const fundo = `<g opacity=".45">${banca(-60, 420, 1050).fundo}${banca(-60, 420, 1050).frente}${banca(700, 1180, 1050, ['#e0a83a', '#f2e5c9']).fundo}${banca(700, 1180, 1050, ['#e0a83a', '#f2e5c9']).frente}</g>`
    return t => {
      const encanta = t > br
      const u = (t - (cai - 0.7)) / 0.7
      const sa = u >= 0 ? P.sache(720, (u < 1 ? -200 + 1430 * u * u : 1230 - Math.abs(mola(t - cai, 3, 7)) * 30) - 50, 1.1, u < 1 ? u * 300 : 70 + 5 * mola(t - cai, 2, 5)) : ''
      const halo = encanta ? `<circle cx="745" cy="1235" r="${r(110 + 10 * Math.sin(t * 6))}" fill="url(#halo)" opacity="${r(fase(t, br, 0.5))}"/>` +
        [...Array(6)].map((_, i) => { const a = i + t * 1.5; return `<path d="M${r(745 + Math.cos(a) * 140)} ${r(1200 + Math.sin(a) * 90)} l6 14 l14 6 l-14 6 l-6 14 l-6 -14 l-14 -6 l14 -6z" fill="#fff6b0" ${traco(1.5)} opacity="${r(fase(t, br, 0.4))}"/>` }).join('') : ''
      const li = P.licuri(470, 1290, 1.65, vivo(R, 'licuri', t, 2, {
        olhar: t < cai + 0.2 ? [-0.6 + Math.sin(t) * 0.4, 0] : [0.8, 0.9], expr: encanta ? 'encantado' : t > cai ? 'olhos_arregalados' : 'neutra',
        reflexo: encanta ? '#ff7fc8' : null, braco: encanta ? 60 : 15, sx: 1, sy: encanta ? 1.03 : 1 }))
      s.innerHTML = `<g filter="url(#traco)">${chao(1150, '#c99e62', 21)}${fundo}${li}${halo}${sa}${nuvemPoeira(730, 1250, fase(t, cai, 0.7), 0.6)}</g>`
    }
  },

  bolso(m, c) {
    const R = relogio(c), s = svgCena(m), C = cesto(m)
    const zip = R.som('zip'), sus = R.som('trompete_suspensa')
    const cont = el('div', 'mao continua', m, 'continua...')
    return t => {
      const olha = t < R.ini(1) ? -1 : t < R.ini(2) ? 1 : 0
      const giro = t > R.ini(0) && t < R.ini(2) ? olha * 5 : 0
      const qz = fase(t, zip - 0.25, 0.35)
      const mao = [mix(620, 545, qz), mix(1060, 1180, qz)]
      const sa = qz < 1 ? P.sache(mao[0], mao[1] - 40, mix(0.8, 0.2, qz), mix(-20, 0, qz)) : ''
      const li = P.licuri(470, 1290, 1.4, vivo(R, 'licuri', t, 2, { olhar: [olha * 0.9, 0], expr: t > zip ? 'sorriso' : 'olhos_semicerrados', giro, braco: qz < 1 ? 70 : 15 }))
      // a bolsinha de palha do Licuri
      const bolsa = `<path d="M420 1060 Q470 1110 520 1060" fill="none" ${traco(4)}/><path d="M500 1150 L590 1150 L600 1225 L490 1225 Z" fill="#d9b25c" ${traco(4)}/><path d="M500 1175 L590 1175 M495 1200 L595 1200" stroke="#9a6a3a" stroke-width="3"/>`
      s.innerHTML = `<g filter="url(#traco)">${chao(1150, '#c99e62', 22)}<g opacity=".4">${banca(650, 1180, 1050).fundo}${banca(650, 1180, 1050).frente}</g>${li}${t < zip + 0.3 || true ? bolsa : ''}${sa}</g>`
      // "O Cesto viu.": o Cesto entra pela direita, de olho apertado
      const qe = fase(t, R.ini(3) - 0.35, 0.45)
      C(mix(1350, 900, saida(qe)), 1520, 720, { olhar: [-1, 0], aperta: 0.5, pisca: t > sus + 0.9 ? pisca(t, 3) : 0, giro: -6 })
      cont.style.opacity = r(fase(t, sus + 0.4, 0.5), 3)
      cont.style.transform = `rotate(-4deg) scale(${r(1 + 0.1 * mola(t - sus - 0.4, 2, 5), 3)})`
    }
  },

  assinatura(m, c) {
    const s = svgCena(m), C = cesto(m)
    const logo = el('img', 'logo', m); logo.src = 'logo.svg'
    const t1 = el('div', 'mao titulo assina', m, 'Novela da Caatinga')
    const t2 = el('div', 'mao subtitulo assina2', m, 'uma história do Mangaio')
    return t => {
      s.innerHTML = `<g filter="url(#traco)">${chao(1300, '#c99e62', 30)}${P.mandacaru(140, 1320, 0.5)}${P.mandacaru(950, 1320, 0.4)}</g>`
      t1.style.opacity = r(fase(t, 0.1, 0.5), 3); t2.style.opacity = r(fase(t, 0.6, 0.5), 3); logo.style.opacity = r(fase(t, 0.9, 0.5), 3)
      let p = { y: 0, sx: 1, sy: 1 }
      ;[0.15, 0.32, 0.49, 0.66, 0.96].forEach(d => { if (t > 0.3 + d - 0.02) p = pulo(t, 0.3 + d - 0.02, 0.16, 26) })
      C(540, 1305 + p.y, 330, { sx: p.sx, sy: p.sy, pisca: pisca(t, 2) })
    }
  },
}

// ---------- legenda: blocos curtos, a cor de quem fala ----------
const COR = { narrador: '#2b2118', maxixe: '#3f6a1e', quiabo: '#3f6a1e', dona_mandioca: '#9b2f1e', realcador: '#c2187a', umbu: '#5d6b12', licuri: '#b05a10' }
const LIGA = new Set(['o', 'a', 'os', 'as', 'de', 'do', 'da', 'e', 'no', 'na', 'ao', 'um', 'uma', 'que', 'se', 'em', 'é', 'para', 'nos'])
function legenda(cenas, palco) {
  const raiz = el('div', null, palco); raiz.id = 'legenda'
  const blocos = []
  for (const c of cenas) for (const f of c.falas) {
    let atual = []
    const fecha = () => {
      const solta = []
      while (atual.length > 1 && LIGA.has(atual.at(-1).texto.toLowerCase())) solta.unshift(atual.pop())
      if (atual.length) blocos.push({ ws: atual, cor: COR[f.quem] })
      atual = solta
    }
    for (const p of f.palavras) {
      const w = { ...p, inicio: c.ini + p.inicio, fim: c.ini + p.fim }
      const txt = [...atual, w].map(x => x.texto).join(' ')
      if (atual.length && (atual.length >= 4 || txt.length > 22)) fecha()
      atual.push(w)
      if (/[.,?!:…]$/.test(p.texto)) fecha()
    }
    fecha()
  }
  return blocos.map((b, k) => {
    const e = el('div', 'bloco', raiz); e.style.color = b.cor
    const prox = blocos[k + 1]?.ws[0].inicio ?? Infinity
    return { e, ini: b.ws[0].inicio - 0.05, fim: Math.min(b.ws.at(-1).fim + 0.8, prox - 0.05), spans: b.ws.map(w => ({ s: el('span', null, e, w.texto), t: w.inicio })) }
  })
}
function desenhaLegenda(blocos, t) {
  for (const b of blocos) {
    const vis = t >= b.ini && t < b.fim
    b.e.style.display = vis ? 'block' : 'none'
    if (!vis) continue
    for (const { s, t: t0 } of b.spans) {
      const q = fase(t, t0 - 0.05, 0.14)
      s.style.opacity = r(q, 3); s.style.transform = `translateY(${r((1 - saida(q)) * 10, 1)}px)`
    }
  }
}

// ---------- montagem ----------
async function montar() {
  const T = await (await fetch('tempos.json')).json()
  MASCOTE = await (await fetch('mascote.svg')).text()
  const carrega = src => { const i = new Image(); i.src = src; return i.decode().then(() => i) }
  await Promise.all(['texturas/kraft.jpg', 'texturas/grao.png', 'logo.svg'].map(carrega))
  await document.fonts.load('100px "Mao"'); await document.fonts.ready
  const defs = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  defs.setAttribute('width', 0); defs.setAttribute('height', 0); defs.style.position = 'absolute'
  defs.innerHTML = `<defs>
    <filter id="traco" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency="0.03" numOctaves="2" seed="1" result="w"/>
      <feDisplacementMap in="SourceGraphic" in2="w" scale="4.5" xChannelSelector="R" yChannelSelector="G"/></filter>
    <filter id="neon" x="-20%" y="-50%" width="140%" height="200%"><feGaussianBlur stdDeviation="6" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    <radialGradient id="luzNeon"><stop offset="0" stop-color="#ff4fb0" stop-opacity=".6"/><stop offset="1" stop-color="#4fd8ff" stop-opacity="0"/></radialGradient>
    <radialGradient id="halo"><stop offset="0" stop-color="#fff6b0" stop-opacity=".9"/><stop offset="1" stop-color="#ff7fc8" stop-opacity="0"/></radialGradient></defs>`
  document.body.appendChild(defs)
  const turb = [...defs.querySelectorAll('#traco feTurbulence')]
  const palco = document.getElementById('palco')
  const cenas = T.cenas.map((c, k) => {
    const camada = el('div', 'camada', palco); camada.style.zIndex = 100 - k
    const mundo = el('div', 'mundo', camada)
    const anim = CENAS[c.id](mundo, c)
    el('div', 'grao', camada)
    return { ...c, camada, anim }
  })
  el('div', null, palco, T.rotulo).id = 'rotulo'
  return { cenas, blocos: legenda(T.cenas, palco), duracao: T.duracao, turb }
}

function desenhar(cena, t) {
  cena.cenas.forEach((c, k) => {
    const tl = t - c.ini, ultima = k === cena.cenas.length - 1
    const vis = tl >= 0 && (ultima || tl < c.dur)
    c.camada.style.display = vis ? 'block' : 'none'
    if (!vis) return
    c.anim(tl)
    const tr = c.transicao
    c.camada.style.opacity = !ultima && tr.dur && tl > c.dur - tr.dur ? r(1 - suave(fase(tl, c.dur - tr.dur, tr.dur)), 3) : 1
  })
  desenhaLegenda(cena.blocos, t)
  const sem = String(1 + (Math.floor(t * 8) % 24)) // o traço treme a 8 desenhos por segundo, como animação à mão
  cena.turb.forEach(f => f.setAttribute('seed', sem))
  return String(Math.round(t * 30))
}

;(async () => {
  const cena = await montar()
  const t0 = window.INICIO ?? 0
  window.DURACAO = window.INICIO != null ? 1 / 30 : cena.duracao
  window.seek = t => desenhar(cena, t0 + t)
  window.seek(0)
  window.pronto = true
})()
