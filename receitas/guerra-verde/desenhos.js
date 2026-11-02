// Desenhos à mão da peça Guerra Verde: traço de nanquim que "treme" (boil de animação feita à mão),
// aguada de aquarela com borda escura e granulação de pigmento, e o tracejado da rota.
// Tudo em SVG do tamanho da tela (1080×1920); os filtros são globais, então um só "seed" faz todo traço tremer junto.
// Usado por cena.js (window.D). Coordenadas sempre na tela.

;(() => {
  const COR = {
    tinta: '#2b2118', musgo: '#6f8c4b', musgoEsc: '#4d6a33', ocre: '#c27a2e', ferrugem: '#9b4523',
    agua: '#7f9fa3', caqui: '#b49a5f', creme: '#f2e5c9',
  }
  const NS = 'http://www.w3.org/2000/svg'

  // filtros globais: "traco" treme o nanquim; "aquarela" espalha a borda e granula o pigmento; "giz" falha a tinta do carimbo
  function filtros() {
    const s = document.createElementNS(NS, 'svg')
    s.setAttribute('width', 0); s.setAttribute('height', 0)
    s.style.position = 'absolute'
    s.innerHTML = `<defs>
  <filter id="traco" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="1" result="w"/>
    <feDisplacementMap in="SourceGraphic" in2="w" scale="5" xChannelSelector="R" yChannelSelector="G"/></filter>
  <filter id="aquarela" x="-15%" y="-15%" width="130%" height="130%">
    <feTurbulence type="fractalNoise" baseFrequency="0.011" numOctaves="3" seed="3" result="n"/>
    <feDisplacementMap in="SourceGraphic" in2="n" scale="30" xChannelSelector="R" yChannelSelector="G" result="d"/>
    <feGaussianBlur in="d" stdDeviation="1.4" result="b"/>
    <feTurbulence type="fractalNoise" baseFrequency="0.07" numOctaves="2" seed="9" result="g"/>
    <feColorMatrix in="g" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -1.6 1.55" result="gm"/>
    <feComposite in="b" in2="gm" operator="in"/></filter>
  <filter id="giz" x="-10%" y="-10%" width="120%" height="120%"><feTurbulence type="fractalNoise" baseFrequency="0.6" numOctaves="2" seed="4" result="g"/>
    <feColorMatrix in="g" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -2.6 2.0" result="m"/>
    <feComposite in="SourceGraphic" in2="m" operator="in" result="f"/>
    <feTurbulence type="fractalNoise" baseFrequency="0.03" numOctaves="2" seed="1" result="w"/>
    <feDisplacementMap in="f" in2="w" scale="5" xChannelSelector="R" yChannelSelector="G"/></filter>
</defs>`
    document.body.appendChild(s)
    return [...s.querySelectorAll('#traco feTurbulence, #giz feTurbulence[baseFrequency="0.03"]')]
  }

  // uma folha de desenho: embaixo as aguadas, em cima o nanquim
  function quadro(pai) {
    const s = document.createElementNS(NS, 'svg')
    s.setAttribute('class', 'arte')
    s.setAttribute('width', 1080); s.setAttribute('height', 1920)
    s.innerHTML = '<g filter="url(#aquarela)"></g><g filter="url(#traco)"></g>'
    pai.appendChild(s)
    const [lav, tr] = s.children
    return { svg: s, lav, tr }
  }
  // grupo que se move junto nas duas camadas (a árvore que tomba, um veículo)
  function grupo(q) {
    const g = { svg: q.svg, lav: document.createElementNS(NS, 'g'), tr: document.createElementNS(NS, 'g') }
    q.lav.appendChild(g.lav); q.tr.appendChild(g.tr)
    return g
  }
  const no = (pai, tag, at) => {
    const e = document.createElementNS(NS, tag)
    for (const [k, v] of Object.entries(at)) e.setAttribute(k, v)
    pai.appendChild(e)
    return e
  }
  // traço de nanquim que se desenha (stroke-dashoffset de 1 a 0)
  const linha = (g, d, larg = 5, cor = COR.tinta) => no(g.tr, 'path', {
    d, pathLength: 1, 'stroke-dasharray': '1 1', 'stroke-dashoffset': 1, fill: 'none', stroke: cor,
    'stroke-width': larg, 'stroke-linecap': 'round', 'stroke-linejoin': 'round',
  })
  const linhas = (g, ds, larg, cor) => ds.map(d => linha(g, d, larg, cor))
  // aguada: miolo translúcido e borda mais carregada, como a tinta que seca na beira
  function lava(g, d, cor, opac = 0.55) {
    const e = no(g.lav, 'g', { opacity: 0 })
    no(e, 'path', { d, fill: cor, 'fill-opacity': opac, stroke: cor, 'stroke-opacity': Math.min(1, opac + 0.25), 'stroke-width': 7, 'stroke-linejoin': 'round' })
    return e
  }
  // tracejado (rota) que avança: o tracejado fica visível só onde a máscara já foi desenhada
  let nm = 0
  function tracejado(g, d, larg = 6, cor = COR.tinta, passo = '16 18') {
    const id = `m${nm++}`
    const m = no(g.tr, 'mask', { id, maskUnits: 'userSpaceOnUse', x: -200, y: -200, width: 1480, height: 2320 })
    const guia = no(m, 'path', { d, pathLength: 1, 'stroke-dasharray': '1 1', 'stroke-dashoffset': 1, fill: 'none', stroke: '#fff', 'stroke-width': larg + 14, 'stroke-linecap': 'round' })
    no(g.tr, 'path', { d, fill: 'none', stroke: cor, 'stroke-width': larg, 'stroke-dasharray': passo, 'stroke-linecap': 'round', mask: `url(#${id})` })
    return guia
  }

  // ---------- formas à mão (devolvem o "d" do caminho) ----------
  const n = v => v.toFixed(1)
  function sorteio(semente) {
    let a = semente >>> 0
    return () => {
      a = (a + 0x6D2B79F5) >>> 0
      let t = Math.imul(a ^ (a >>> 15), a | 1)
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
  }
  const F = {
    // copa de árvore: contorno de nuvem, com gomos de tamanho sorteado
    copa(cx, cy, rx, ry, gomos = 11, semente = 1) {
      const rnd = sorteio(semente)
      const pts = Array.from({ length: gomos }, (_, i) => {
        const a = (i + rnd() * 0.3) / gomos * Math.PI * 2 - Math.PI / 2
        return [cx + Math.cos(a) * rx * (0.9 + rnd() * 0.12), cy + Math.sin(a) * ry * (0.9 + rnd() * 0.12)]
      })
      let d = `M${n(pts[0][0])} ${n(pts[0][1])}`
      pts.forEach((p, i) => {
        const q = pts[(i + 1) % gomos], mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2
        const ox = mx - cx, oy = my - cy, k = 0.32 + rnd() * 0.18
        d += `Q${n(mx + ox * k)} ${n(my + oy * k)} ${n(q[0])} ${n(q[1])}`
      })
      return d
    },
    // círculo rabiscado: mais de uma volta, sem fechar certinho
    roda(x, y, rx, ry, voltas = 1.15) {
      let d = ''
      for (let i = 0; i <= 44; i++) {
        const a = -2.2 + i / 44 * Math.PI * 2 * voltas, k = 1 + 0.06 * Math.sin(i * 0.7)
        d += `${i ? 'L' : 'M'}${n(x + Math.cos(a) * rx * k)} ${n(y + Math.sin(a) * ry * k)}`
      }
      return d
    },
    // círculo fechado e levemente torto (rodas, cabeças, alfinetes)
    circ(x, y, r, semente = 2) {
      const rnd = sorteio(semente)
      let d = ''
      for (let i = 0; i <= 24; i++) {
        const a = i / 24 * Math.PI * 2, k = 1 + (rnd() - 0.5) * 0.06
        d += `${i ? 'L' : 'M'}${n(x + Math.cos(a) * r * k)} ${n(y + Math.sin(a) * r * k)}`
      }
      return d
    },
    // retângulo à mão: cada lado é um traço que passa um pouco do canto
    ret(x0, y0, x1, y1, sobra = 7) {
      return `M${n(x0 - sobra)} ${n(y0)}L${n(x1 + sobra * 0.4)} ${n(y0 + 1.5)}M${n(x1)} ${n(y0 - sobra)}L${n(x1 - 1.5)} ${n(y1 + sobra * 0.6)}` +
        `M${n(x1 + sobra)} ${n(y1)}L${n(x0 - sobra * 0.3)} ${n(y1 - 1)}M${n(x0)} ${n(y1 + sobra)}L${n(x0 + 1)} ${n(y0 - sobra * 0.5)}`
    },
    // sublinhado em onda, como caneta passando rápido
    onda(x, y, w, amp = 9, n6 = 6) {
      let d = `M${n(x)} ${n(y)}`
      for (let i = 1; i <= n6; i++) d += `Q${n(x + w * (i - 0.5) / n6)} ${n(y + (i % 2 ? -amp : amp))} ${n(x + w * i / n6)} ${n(y)}`
      return d
    },
    // seta curva de (x0,y0) a (x1,y1), com a ponta aberta
    seta(x0, y0, x1, y1, curva = 0.3) {
      const mx = (x0 + x1) / 2 - (y1 - y0) * curva, my = (y0 + y1) / 2 + (x1 - x0) * curva
      const a = Math.atan2(y1 - my, x1 - mx)
      const p = da => `${n(x1 - Math.cos(a + da) * 28)} ${n(y1 - Math.sin(a + da) * 28)}`
      return `M${n(x0)} ${n(y0)}Q${n(mx)} ${n(my)} ${n(x1)} ${n(y1)}M${p(0.5)}L${n(x1)} ${n(y1)}L${p(-0.5)}`
    },
    brilho(x, y, s) {
      return `M${n(x)} ${n(y - s)}L${n(x)} ${n(y - s * 0.35)}M${n(x)} ${n(y + s * 0.35)}L${n(x)} ${n(y + s)}` +
        `M${n(x - s)} ${n(y)}L${n(x - s * 0.35)} ${n(y)}M${n(x + s * 0.35)} ${n(y)}L${n(x + s)} ${n(y)}`
    },
    // toco: tronco cortado visto de lado, com o topo em elipse e os anéis
    toco(x, y, w, h) {
      const a = w / 2, e = w * 0.22
      return [`M${n(x - a)} ${n(y)}L${n(x - a + 2)} ${n(y - h)}M${n(x + a)} ${n(y)}L${n(x + a - 2)} ${n(y - h)}`,
        `M${n(x - a + 2)} ${n(y - h)}C${n(x - a + 2)} ${n(y - h - e)} ${n(x + a - 2)} ${n(y - h - e)} ${n(x + a - 2)} ${n(y - h)}C${n(x + a - 2)} ${n(y - h + e)} ${n(x - a + 2)} ${n(y - h + e)} ${n(x - a + 2)} ${n(y - h)}`,
        `M${n(x - a * 0.45)} ${n(y - h)}C${n(x - a * 0.45)} ${n(y - h - e * 0.45)} ${n(x + a * 0.45)} ${n(y - h - e * 0.45)} ${n(x + a * 0.45)} ${n(y - h)}`,
        `M${n(x - a - 10)} ${n(y + 2)}Q${n(x - a)} ${n(y - 4)} ${n(x - a + 4)} ${n(y)}M${n(x + a - 4)} ${n(y)}Q${n(x + a)} ${n(y - 4)} ${n(x + a + 12)} ${n(y + 3)}`]
    },
    // capim: tracinhos ao longo do chão
    capim(x0, x1, y, semente = 5, qtd = 9) {
      const rnd = sorteio(semente)
      let d = ''
      for (let i = 0; i < qtd; i++) {
        const x = x0 + (x1 - x0) * (i + rnd() * 0.6) / qtd
        d += `M${n(x)} ${n(y)}l${n(-4 - rnd() * 6)} ${n(-12 - rnd() * 10)}M${n(x + 6)} ${n(y)}l${n(2 + rnd() * 5)} ${n(-10 - rnd() * 10)}`
      }
      return d
    },
  }

  // ---------- desenhos prontos (listas de traços, em coordenadas locais: o centro é 0,0) ----------
  const DES = {
    satelite: {
      tracos: [
        'M-26 -20L26 -21L27 20L-25 21Z',
        'M-38 -15L-112 -14L-111 15L-37 14Z', 'M-62 -15L-61 14M-87 -14L-86 15M-112 0L-38 0',
        'M38 -15L112 -14L111 15L37 14Z', 'M62 -15L61 14M87 -14L86 15M38 0L112 0',
        'M-26 0L-38 0M26 0L38 0', 'M0 21L0 38', 'M-14 50C-8 38 8 38 14 50',
      ],
      lavas: [['M-112 -14L-38 -15L-37 14L-111 15Z', 'agua'], ['M38 -15L112 -14L111 15L37 14Z', 'agua'], ['M-26 -20L26 -21L27 20L-25 21Z', 'ocre']],
    },
    caminhonete: {
      tracos: [
        'M-132 14C-134 -4 -130 -16 -120 -20L-32 -22L-12 -58C0 -64 58 -64 70 -58L88 -22L126 -18C134 -10 134 4 132 14',
        'M-132 14L-108 14M-52 14L60 14M116 14L132 14',
        'M-2 -26L12 -52L54 -52L70 -26Z', 'M-120 -20L-118 10', 'M30 -22L30 10', 'M42 -6L54 -6',
        'M-108 14C-108 -14 -52 -14 -52 14', 'M60 14C60 -14 116 -14 116 14',
      ],
      rodas: [[-80, 18, 24], [88, 18, 24]],
      lavas: [['M-130 14C-132 -4 -128 -16 -120 -20L-32 -22L-12 -58C0 -64 58 -64 70 -58L88 -22L126 -18C134 -10 134 4 132 14Z', 'caqui']],
    },
    barco: {
      tracos: [
        'M-136 -10L132 -12C124 12 96 30 44 32L-104 32C-124 22 -132 8 -136 -10',
        'M-136 -10L-154 -16L-158 30L-142 34', 'M-120 6L110 4',
        'M-40 -12L-40 -46', 'M-56 -30L-24 -30', 'M20 -12L22 -50', 'M8 -32L36 -34',
      ],
      rodas: [[-40, -60, 13], [21, -64, 13]],
      lavas: [['M-136 -10L132 -12C124 12 96 30 44 32L-104 32C-124 22 -132 8 -136 -10Z', 'ocre']],
    },
    helicoptero: {
      tracos: [
        'M-60 0C-60 -40 -20 -56 30 -56C70 -56 92 -30 92 0C92 26 60 36 20 36L-40 36C-56 30 -60 18 -60 0',
        'M-60 -8L-190 -16L-190 -2L-60 10', 'M-196 -34L-184 18', 'M30 -50C58 -50 78 -30 82 -6L30 -6Z',
        'M10 -56L10 -74', 'M-40 36L-48 60M60 36L68 60', 'M-92 60C-40 63 60 63 112 58',
      ],
      helice: 'M-150 -78C-60 -84 80 -84 170 -76',
      lavas: [['M-60 0C-60 -40 -20 -56 30 -56C70 -56 92 -30 92 0C92 26 60 36 20 36L-40 36C-56 30 -60 18 -60 0Z', 'musgo']],
    },
  }
  // monta um desenho pronto num grupo, já posicionado em (x, y) com escala s
  function desenho(q, def, x, y, s = 1) {
    const g = grupo(q)
    const t = `translate(${x} ${y}) scale(${s})`
    g.lav.setAttribute('transform', t); g.tr.setAttribute('transform', t)
    g.lavas = (def.lavas || []).map(([d, c]) => lava(g, d, COR[c], 0.5))
    g.tracos = linhas(g, def.tracos, 5 / s)
    g.tracos.push(...(def.rodas || []).map(([rx, ry, r], k) => linha(g, F.circ(rx, ry, r, 3 + k), 5 / s)))
    if (def.helice) g.helice = linha(g, def.helice, 6 / s)
    g.base = t
    return g
  }

  window.D = { COR, filtros, quadro, grupo, linha, linhas, lava, tracejado, desenho, DES, F, sorteio }
})()
