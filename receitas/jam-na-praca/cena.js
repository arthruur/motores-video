// Reel "Saudade da Jam": o filme cortado na batida (montar_reel1.py → saida/jam-na-praca/quadros)
// com escrita à mão e desenhos em stop-motion por cima (kit dos promos: ../promo/kit.js),
// o palco que abre em zoom out e o solo de conga em silhueta sobre campos de cor (homenagem às
// aberturas de anime jazzísticas dos anos 90). Tudo vem de roteiro.json; som.py lê os mesmos tempos.
// Regra do motor: a tela é função pura de t (motores/render/CONTRATO.md).

const NS = 'http://www.w3.org/2000/svg'
const COR = { branco: '#ffffff', ciano: '#00baf2', azul: '#005dba', amarelo: '#ffd23f' }
const QUADROS = '../../saida/jam-na-praca/quadros/'
const QUADROS_PALCO = '../../saida/jam-na-praca/quadros_palco/'

const svg = K.el('#desenhos')
const caixaTextos = K.el('#textos')
const filme = K.el('#filme')
const quadro = K.el('#quadro')

const no = (tag, attrs = {}, pai = svg) => {
  const e = document.createElementNS(NS, tag)
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v)
  pai.appendChild(e)
  return e
}
const dentro = (t, it) => t >= it.ini && t < it.fim
const mostra = (e, v) => { e.style.display = v ? 'block' : 'none'; return v }

// escrita à mão em passos de 1/12 s, que sempre fecha em 100% no fim de dur
function escreve(e, t, ini, dur) {
  const v = t >= ini + dur ? 1 : K.lim(K.passo(Math.max(0, t - ini)) / dur)
  e.style.clipPath = v >= 1 ? 'none' : `inset(-30% ${K.r((1 - v) * 100, 1)}% -30% -8%)`
  return v
}
function animaTraco(linhas, t, ini, dur) { let v; for (const l of linhas) v = K.traca(l, t, ini, dur); return v }

// ---------------------------------------------------------------- elementos desenhados
function textoEl(it) {
  const e = document.createElement('div')
  e.className = 'txt' + (it.cor === 'ciano' ? ' ciano' : '') + (it.centro ? ' centro' : '')
  e.textContent = it.txt
  e.style.fontSize = it.tam + 'px'
  caixaTextos.appendChild(e)
  const max = it.max || 760
  const w = e.getBoundingClientRect().width
  if (w > max) e.style.fontSize = (it.tam * max / w).toFixed(1) + 'px'
  if (it.centro) {
    const r = e.getBoundingClientRect()
    e.style.left = (it.x - r.width / 2) + 'px'; e.style.top = (it.y - r.height / 2) + 'px'
  } else { e.style.left = it.x + 'px'; e.style.top = it.y + 'px' }
  return e
}

// traço com contorno azul por baixo (a linha "de caneta" com a sombra da marca)
function tracoEl(d, cor = COR.branco, larg = 11) {
  const g = no('g')
  const sombra = no('path', { d, stroke: COR.azul, 'stroke-width': larg + 9, pathLength: 1, 'stroke-dasharray': 1 }, g)
  const p = no('path', { d, stroke: cor, 'stroke-width': larg, pathLength: 1, 'stroke-dasharray': 1 }, g)
  return { g, linhas: [sombra, p] }
}

// círculo de caneta: um pouco mais de uma volta, com o raio oscilando como na mão
function circuloD({ cx, cy, rx, ry, rot }) {
  const pts = [], n = 64, a0 = -2.2, voltas = 1.12, r = rot * Math.PI / 180
  for (let i = 0; i <= n; i++) {
    const a = a0 + (i / n) * voltas * Math.PI * 2
    const k = 1 + Math.sin(i * 0.31 + 1.7) * 0.035 + (i / n) * 0.06
    const x = Math.cos(a) * rx * k, y = Math.sin(a) * ry * k
    pts.push(`${(cx + x * Math.cos(r) - y * Math.sin(r)).toFixed(1)},${(cy + x * Math.sin(r) + y * Math.cos(r)).toFixed(1)}`)
  }
  return 'M' + pts.join(' L')
}

// ícones de instrumento em traço de caneta, centrados em 0,0 (uns 170 px)
const ICONES = {
  viola: ['M0,-20 C-30,-22 -42,-5 -34,12 C-28,24 -44,34 -40,52 C-36,72 -14,78 0,78 C14,78 36,72 40,52 C44,34 28,24 34,12 C42,-5 30,-22 0,-20 Z',
          'M0,-20 L0,-82 M0,-82 c-9,-3 -11,-14 -3,-16 c6,-1 7,6 2,8 M-12,44 L12,44 M-15,18 c-5,8 4,15 0,22 M15,18 c5,8 -4,15 0,22 M-70,62 L66,-56'],
  trompete: ['M-88,-20 L44,-20 C58,-20 70,-34 82,-50 L82,22 C70,6 58,-6 44,-6 L-40,-6 C-64,-6 -64,26 -40,26 L26,26 C42,26 42,-6 30,-6',
             'M-24,-40 L-24,10 M-4,-40 L-4,10 M16,-40 L16,10 M-31,-44 L-17,-44 M-11,-44 L3,-44 M9,-44 L23,-44 M-88,-27 L-88,-13'],
  flauta: ['M-118,6 L112,-22 M-116,22 L114,-6 M-118,6 L-116,22 M112,-22 L114,-6',
           'M-88,4 a6,5 -7 1,0 0.2,0 M-30,-3 a7,6 -7 1,0 0.2,0 M0,-7 a7,6 -7 1,0 0.2,0 M30,-11 a7,6 -7 1,0 0.2,0 M60,-14 a7,6 -7 1,0 0.2,0'],
}
function iconeEl(nome) {
  const g = no('g')
  const partes = ICONES[nome].map(d => { const tr = tracoEl(d, COR.branco, 8); g.appendChild(tr.g); return tr })
  return { g, partes }
}

function notaEl() {
  const g = no('g')
  const d = 'M-14,0 a15,11 -20 1,0 30,-4 a15,11 -20 1,0 -30,4 Z M15,-4 L15,-78 C30,-66 44,-60 44,-36'
  no('path', { d, stroke: COR.azul, 'stroke-width': 20 }, g)
  no('path', { d, stroke: COR.branco, 'stroke-width': 9 }, g)
  no('ellipse', { cx: 1, cy: -2, rx: 12, ry: 8, transform: 'rotate(-20)', fill: COR.ciano }, g)
  return g
}

function brilhoEl(x, y) {
  const g = no('g')
  const d = 'M0,-34 L0,34 M-34,0 L34,0 M-15,-15 L15,15 M-15,15 L15,-15'
  no('path', { d, stroke: COR.azul, 'stroke-width': 13 }, g)
  no('path', { d, stroke: COR.branco, 'stroke-width': 6 }, g)
  g.dataset.x = x; g.dataset.y = y
  return g
}

// varal de bandeirinhas: a linha se traça, as bandeiras caem uma a uma e balançam na batida
function bandeirinhasEl(it) {
  const [x0, y0] = it.de, [x1, y1] = it.ate
  const ponto = u => [x0 + (x1 - x0) * u, y0 + (y1 - y0) * u + Math.sin(u * Math.PI) * it.flecha]
  const meio = ponto(0.5)
  const linha = tracoEl(`M${x0},${y0} Q${meio[0]},${meio[1] + it.flecha} ${x1},${y1}`, COR.branco, 6)
  const cores = [COR.ciano, COR.branco, COR.amarelo, COR.azul]
  const bandeiras = Array.from({ length: it.n }, (_, i) => {
    const u = (i + 0.5) / it.n, [x, y] = ponto(u)
    const g = no('g')
    const larg = 54, alt = 70
    no('path', { d: `M${-larg / 2},0 L${larg / 2},0 L${larg / 2},${alt} L0,${alt * 0.68} L${-larg / 2},${alt} Z`,
      style: `fill:${cores[i % cores.length]}`, stroke: COR.azul, 'stroke-width': 5, 'stroke-linejoin': 'round' }, g)
    return { g, x, y: y - 4, i }
  })
  return { linha, bandeiras }
}

// canhões de luz: dois fachos que piscam em passos
function luzesEl(it) {
  const [px, py] = it.para
  return it.de.map(([x, y], i) => no('polygon', {
    points: `${x - 18},${y} ${x + 18},${y} ${px + (i ? 190 : -190) + 150},${py} ${px + (i ? 190 : -190) - 150},${py}`,
    fill: '#fff8d8', opacity: 0, style: 'mix-blend-mode:screen'
  }))
}

// ---------------------------------------------------------------- solo de conga (estilo de abertura jazzística)
function montarBebop(B) {
  const jornal = K.el('#bebop .jornal')
  jornal.textContent = B.jornal.repeat(40)
  for (const j of document.querySelectorAll('#cartao .jornal')) j.textContent = B.jornal.repeat(14)
  const faixas = K.el('#faixas')
  for (let i = 0; i < 4; i++) faixas.appendChild(document.createElement('div'))
  return { jornal, faixas: [...faixas.children] }
}

// cartão de entrada: os painéis entram (praça → solo) e saem (abrem o quadro) com movimento suave
function desenharCartao(B, t) {
  const C = B.cartao, ini = C.entra[0], fim = C.sai[0] + C.sai[1]
  const cart = K.el('#cartao')
  if (!mostra(cart, t >= ini && t < fim)) return 0
  const pe = K.saida(K.fase(t, C.entra[0], C.entra[1])), ps = K.suave(K.fase(t, C.sai[0], C.sai[1]))
  const [a, b] = C.fenda, P = B.planos[0]
  const cima = cart.querySelector('.cima'), baixo = cart.querySelector('.baixo')
  cima.style.height = a + 'px'; baixo.style.height = (1920 - b) + 'px'
  const dy = -(1 - pe) * (a + 20) - ps * (a + 20)
  cima.style.transform = `translateY(${K.r(dy, 1)}px)`
  baixo.style.transform = `translateY(${K.r((1 - pe + ps) * (1940 - b), 1)}px)`
  for (const p of [cima, baixo]) { p.style.background = P.cor; p.querySelector('.jornal').style.color = P.cor2 }
  return dy
}

function desenharBebop(B, MB, t) {
  const ativo = t >= B.ini && t < B.fim
  const dyCartao = desenharCartao(B, t)
  mostra(K.el('#bebop'), ativo); mostra(K.el('#faixas'), ativo && t >= B.cartao.sai[0] + B.cartao.sai[1])
  const cred = K.el('#creditos')
  if (!ativo) {
    // aproximação: a praça perde a cor antes do solo
    const pa = K.suave(K.fase(t, B.aproxima[0], B.aproxima[1]))
    quadro.style.filter = t >= B.aproxima[0] && t < B.ini ? `grayscale(${K.r(0.85 * pa, 3)}) contrast(${K.r(1 + 0.5 * pa, 3)})` : ''
    mostra(cred, false); return
  }
  const i = Math.min(B.planos.length - 1, Math.floor((t - B.ini) / B.compasso + 1e-6))
  const P = B.planos[i], desde = t - B.ini - i * B.compasso
  // o filme vira duas cores (o claro some no campo, o escuro vira silhueta); na saída, desfaz aos poucos
  const f = 1 - K.suave(K.fase(t, B.saida[0], B.saida[1]))
  quadro.style.filter = `grayscale(${K.r(f, 3)}) brightness(${K.r(1 + (P.luz - 1) * f, 3)}) contrast(${K.r(1 + ((P.contraste || 5) - 1) * f, 3)})`
  K.el('#bebop').style.opacity = K.r(f, 3); K.el('#faixas').style.opacity = K.r(f, 3)
  K.el('#bebop .campo').style.background = P.cor
  const bl = K.el('#bebop .bloco')
  const h1 = K.hash(i, 3), h2 = K.hash(i, 5)
  Object.assign(bl.style, h1 > 0.5
    ? { left: '0px', top: `${Math.round(300 + h2 * 700)}px`, width: '1080px', height: `${Math.round(260 + h1 * 300)}px` }
    : { left: `${Math.round(h2 * 500)}px`, top: '0px', width: `${Math.round(280 + h1 * 320)}px`, height: '1920px' })
  bl.style.background = P.cor2
  MB.jornal.style.color = P.cor2
  MB.jornal.style.transform = `translateY(${-Math.round(i * 137 % 600)}px)`
  // faixas pretas que dividem o quadro em painéis; entram correndo no começo de cada compasso
  MB.faixas.forEach((f, k) => {
    const vert = (k + i) % 2 === 0
    const pos = Math.round(120 + K.hash(i * 7 + k, 11) * (vert ? 840 : 1680))
    const corre = K.quadros(t, B.ini + i * B.compasso, [0.15, 0.55, 0.9, 1]) ?? 1
    Object.assign(f.style, vert
      ? { left: `${pos}px`, top: '0px', bottom: 'auto', width: `${10 + k * 3}px`, height: `${Math.round(1920 * corre)}px`, right: 'auto' }
      : { top: `${pos}px`, left: '0px', right: 'auto', height: `${10 + k * 3}px`, width: `${Math.round(1080 * corre)}px`, bottom: 'auto' })
    f.style.display = k < 2 + (i % 3) ? '' : 'none'
  })
  // créditos: rótulo pequeno + nome grande, letra a letra
  if (!P.nome) { mostra(cred, false); return }
  mostra(cred, true)
  cred.classList.toggle('grande', !!P.grande)
  if (cred.dataset.i !== String(i)) {
    cred.dataset.i = i
    cred.querySelector('.rotulo').innerHTML = [...P.rotulo].map(c => `<span>${c === ' ' ? '&nbsp;' : c}</span>`).join('')
    cred.querySelector('.nome').innerHTML = P.nome.split(' ').map(p => `<span class="palavra">${[...p].map(c => `<span>${c}</span>`).join('')}</span>`).join(' ')
  }
  cred.style.transform = i === 0 ? `translateY(${K.r(dyCartao, 1)}px)` : ''
  cred.style.top = P.lugar === 'cima' ? '330px' : ''
  cred.style.bottom = P.lugar === 'cima' ? '' : '700px'
  const letras = [...cred.querySelectorAll('span:not(.palavra)')]
  const n = Math.floor(K.lim((desde - 0.05) / 0.35) * letras.length + 1e-6)
  letras.forEach((s, k) => { s.style.visibility = k < n ? 'visible' : 'hidden' })
}

// ---------------------------------------------------------------- palco que abre
const palcoQuadros = {}
async function desenharPalco(R, t) {
  const P = R.palco, ativo = t >= P.ini && t < P.fim
  mostra(K.el('#palco16'), ativo)
  if (!ativo) return
  const n = Math.min(108, Math.floor((t - P.ini) * R.fps + 1e-6) + 1)
  const src = QUADROS_PALCO + String(n).padStart(4, '0') + '.jpg'
  const fundo = K.el('#palcoFundo'), frente = K.el('#palcoFrente')
  if (!frente.src.endsWith(src.slice(5))) {
    frente.src = src; fundo.src = src
    await Promise.all([frente.decode(), fundo.decode()])
  }
  // de "cobrir" (o recorte 9:16, centrado em cx) até "caber" na largura, com saída suave
  const p = K.suave(K.fase(t, P.zoom[0], P.zoom[1]))
  const s0 = 1920 / 1080, s1 = 1080 / 1920
  const s = Math.exp(K.mix(Math.log(s0), Math.log(s1), p))
  const dx = (0.5 - P.cx) * 1920 * s * (1 - p)
  frente.style.transform = `translate(-50%,-50%) translateX(${K.r(dx, 1)}px) scale(${K.r(s, 4)})`
  fundo.style.transform = `translate(-50%,-50%) scale(${K.r(s0 * 1.05, 4)})`
}

// ---------------------------------------------------------------- montagem
function montar(R) {
  const objs = []
  for (const it of R.itens) {
    const o = { it }
    if (it.tipo === 'texto') {
      o.e = textoEl(it)
      if (it.icone) {  // o ícone fica preso ao fim da palavra, não ao quadro
        o.ic = iconeEl(it.icone)
        const r = o.e.getBoundingClientRect()
        const meia = { viola: 110, trompete: 165, flauta: 205 }[it.icone]
        o.icPos = [it.x + r.width + meia, it.y + r.height * 0.5 - (r.width + meia) * Math.tan(4 * Math.PI / 180)]
      }
    }
    else if (it.tipo === 'traco') o.tr = tracoEl(it.d, COR[it.cor || 'branco'], it.larg || 11)
    else if (it.tipo === 'circulo') o.tr = tracoEl(circuloD(it), COR.branco, 12)
    else if (it.tipo === 'nota') o.g = notaEl()
    else if (it.tipo === 'brilho') o.bs = it.pts.map(([x, y]) => brilhoEl(x, y))
    else if (it.tipo === 'bandeirinhas') o.b = bandeirinhasEl(it)
    else if (it.tipo === 'luzes') o.ls = luzesEl(it)
    else if (it.tipo === 'logo') {
      o.e = document.createElement('img'); o.e.id = 'logo'; o.e.src = 'logo.png'
      K.el('#palco').insertBefore(o.e, K.el('.grao'))
    } else if (it.tipo === 'rodape') {
      o.e = document.createElement('div'); o.e.className = 'rodape'; o.e.textContent = it.txt
      o.e.style.top = it.y + 'px'; caixaTextos.appendChild(o.e)
    }
    objs.push(o)
  }
  // riscos de vibração do solo (três arcos, como nos quadrinhos)
  const vibra = no('g')
  for (let k = 0; k < 3; k++) {
    const d = `M${k * 26},-40 Q${k * 26 + 22},0 ${k * 26},40`
    no('path', { d, stroke: '#000', 'stroke-width': 17 }, vibra)
    no('path', { d, stroke: COR.branco, 'stroke-width': 8 }, vibra)
  }
  return { objs, vibra, bebop: montarBebop(R.bebop) }
}

const VIBRA_POS = [[150, 520, -20], [930, 600, 200], [140, 1080, 15], [940, 1150, 165], [520, 330, 90], [250, 820, -5], [880, 880, 185]]

function desenhar(R, M, t) {
  const tp = K.passo(t)
  svg.style.filter = K.ferve(t)
  caixaTextos.style.filter = K.ferve(t + 0.04)

  // soco de zoom na batida durante o solo
  let esc = 1
  const [c0, c1] = R.conga
  const naConga = t >= c0 && t < c1
  if (naConga) {
    const b = Math.floor((t - c0) / R.batida + 1e-6), desde = t - c0 - b * R.batida
    esc = 1 + (b % 4 === 0 ? 0.06 : 0.025) * Math.exp(-desde / 0.11)
    const [x, y, rot] = VIBRA_POS[Math.floor(K.hash(b, 7) * VIBRA_POS.length)]
    const s = 1.7 * K.quadros(t, c0 + b * R.batida, [0.7, 1.15, 1])
    mostra(M.vibra, desde < 0.3)
    M.vibra.setAttribute('transform', `translate(${x},${y}) rotate(${rot}) scale(${s})`)
  } else mostra(M.vibra, false)
  const B = R.bebop
  if (t < B.ini) esc *= 1 + 0.07 * K.suave(K.fase(t, B.aproxima[0], B.aproxima[1]))
  if (t >= B.saida[0] || t < B.cartao.sai[0] + B.cartao.sai[1]) mostra(M.vibra, false)
  filme.style.transform = `scale(${K.r(esc, 4)})`
  desenharBebop(R.bebop, M.bebop, t)

  const [n0, n1, nmax] = R.tinta
  K.el('#tinta').style.opacity = K.r(K.fase(tp, n0, n1 - n0) * nmax, 3)
  K.el('#cortina').style.opacity = K.r(1 - K.fase(t, 0, 0.35), 3)

  for (const o of M.objs) {
    const it = o.it, vis = dentro(t, it)
    if (it.tipo === 'texto') {
      if (o.ic) {
        if (mostra(o.ic.g, vis && t >= it.ini + 0.3)) {
          o.ic.partes.forEach((p, k) => animaTraco(p.linhas, t, it.ini + 0.3 + k * 0.3, 0.3))
          const tri = K.tremor(it.y + 9, t, 1)
          o.ic.g.setAttribute('transform', `translate(${K.r(o.icPos[0] + tri.x, 1)},${K.r(o.icPos[1] + tri.y, 1)}) rotate(${K.r(-8 + tri.rot)}) scale(1.3)`)
        }
      }
      if (!mostra(o.e, vis)) continue
      const tr = K.tremor(it.x + it.y, t, 0.8)
      if (it.carimbo) {
        const s = K.quadros(t, it.ini, K.CARIMBO) ?? 0
        o.e.style.transform = `translate(${K.r(tr.x, 1)}px,${K.r(tr.y, 1)}px) rotate(${it.rot}deg) scale(${s})`
      } else {
        o.e.style.transform = `translate(${K.r(tr.x, 1)}px,${K.r(tr.y, 1)}px) rotate(${K.r(it.rot + tr.rot)}deg)`
        escreve(o.e, t, it.ini, it.dur)
      }
    } else if (it.tipo === 'traco' || it.tipo === 'circulo') {
      if (mostra(o.tr.g, vis)) animaTraco(o.tr.linhas, t, it.ini, it.dur)
    } else if (it.tipo === 'nota') {
      if (!mostra(o.g, vis)) continue
      const s = (K.quadros(t, it.ini, K.CARIMBO) ?? 0) * it.s * 1.7
      const bal = Math.sin(Math.floor((t - it.ini) / R.batida) * Math.PI) * 8
      o.g.setAttribute('transform', `translate(${it.x},${it.y}) rotate(${K.r(bal - 8)}) scale(${K.r(s, 3)})`)
    } else if (it.tipo === 'brilho') {
      o.bs.forEach((g, i) => {
        const ini = it.ini + i * 0.1
        if (!mostra(g, vis && t >= ini)) return
        const b = Math.floor((t - ini) / R.batida), desde = t - ini - b * R.batida
        const s = (K.quadros(t, ini, [0.3, 1.3, 0.9]) ?? 0) * (desde < 0.15 ? 1.2 : 0.8)
        g.setAttribute('transform', `translate(${g.dataset.x},${g.dataset.y}) rotate(${(b * 22) % 90}) scale(${K.r(s, 3)})`)
      })
    } else if (it.tipo === 'bandeirinhas') {
      mostra(o.b.linha.g, vis)
      if (vis) animaTraco(o.b.linha.linhas, t, it.ini, 0.3)
      const b = Math.floor((t - it.ini) / R.batida)
      for (const f of o.b.bandeiras) {
        const ini = it.ini + 0.3 + f.i * 0.06
        if (!mostra(f.g, vis && t >= ini)) continue
        const cai = K.quadros(t, ini, [-0.6, -0.2, 0.08, 0]) ?? 0
        const bal = ((b + f.i) % 2 ? 1 : -1) * 4
        f.g.setAttribute('transform', `translate(${K.r(f.x, 1)},${K.r(f.y + cai * 80, 1)}) rotate(${bal})`)
      }
    } else if (it.tipo === 'luzes') {
      o.ls.forEach((l, i) => {
        const n = Math.floor((t - it.ini) * K.PASSOS)
        const op = vis ? (K.quadros(t, it.ini + i * 0.15, [0.05, 0.3, 0.12, 0.22]) ?? 0) * (0.8 + K.hash(n, i) * 0.4) : 0
        l.setAttribute('opacity', K.r(op, 3))
      })
    } else if (it.tipo === 'logo') {
      if (!mostra(o.e, vis)) continue
      const s = K.quadros(t, it.ini, K.CARIMBO) ?? 0
      const tr = K.tremor(77, t, 1)
      o.e.style.width = it.larg + 'px'
      o.e.style.left = (it.x - it.larg / 2) + 'px'
      o.e.style.top = (it.y - it.larg * 546 / 771 / 2) + 'px'
      o.e.style.transform = `translate(${K.r(tr.x, 1)}px,${K.r(tr.y, 1)}px) rotate(${K.r(-3 + tr.rot)}deg) scale(${s})`
      o.e.style.filter = `${K.ferve(t)} drop-shadow(0 10px 18px rgba(0,20,60,.55))`
    } else if (it.tipo === 'rodape') {
      mostra(o.e, vis)
      o.e.style.opacity = K.r(K.fase(tp, it.ini, 0.4), 3)
    }
  }

  const n = Math.floor(t * K.PASSOS + 1e-6)
  K.el('.grao').style.transform = `translate(${Math.round(K.hash(n, 1) * 60 - 30)}px,${Math.round(K.hash(n, 2) * 60 - 30)}px)`
}

;(async () => {
  const R = await (await fetch('roteiro.json')).json()
  for (const f of ['100px "Caveat Brush"', '600 34px "Raleway"', '800 100px "Barlow Condensed"', '26px "Fraunces"'])
    await document.fonts.load(f)
  K.filtros()
  const M = montar(R)
  await Promise.all([...document.images].filter(i => i.src).map(i => i.decode().catch(() => {})))
  window.DURACAO = R.duracao
  window.seek = async t => {
    const n = Math.min(R.duracao * R.fps, Math.floor(t * R.fps + 1e-6) + 1)
    const src = QUADROS + String(n).padStart(4, '0') + '.jpg'
    if (!quadro.src.endsWith(src.slice(5))) { quadro.src = src; await quadro.decode() }
    await desenharPalco(R, t)
    desenhar(R, M, t)
  }
  await window.seek(0)
  window.pronto = true
})()
