// Desenhos à mão do unboxing: a onça (traço vinho com preenchimento de giz deslocado, como risografia),
// a marca de beijo e os rabiscos. Tudo em SVG, com um filtro que treme o traço ("boil" de animação feita à mão).
// Usado por cena.js (window.D). Coordenadas da onça e do beijo no próprio viewBox; as dos rabiscos, na tela.

;(() => {
  const TINTA = '#8e1029', GIZ = '#e8b877', ROSA = '#e79a93'

  // onça espiando por cima de uma borda (viewBox 400×340): primeiro os traços, na ordem em que são desenhados
  const ONCA = {
    vb: [400, 340],
    cheios: [
      { d: 'M92 178C86 120 130 78 200 78C270 78 314 120 308 178C304 236 262 276 200 278C138 276 96 236 92 178Z', cor: GIZ },
      { d: 'M112 122C98 92 108 62 138 64C156 66 166 82 164 96Z', cor: GIZ },
      { d: 'M288 122C302 92 292 62 262 64C244 66 234 82 236 96Z', cor: GIZ },
      { d: 'M118 320C114 292 138 280 158 284C178 288 186 304 182 320Z', cor: GIZ },
      { d: 'M218 320C214 304 222 288 242 284C262 280 286 292 282 320Z', cor: GIZ },
      { d: 'M114 214a18 14 0 1 0 36 0a18 14 0 1 0 -36 0', cor: ROSA },
      { d: 'M250 214a18 14 0 1 0 36 0a18 14 0 1 0 -36 0', cor: ROSA },
      { d: 'M148 172a14 11 0 1 0 28 0a14 11 0 1 0 -28 0', cor: '#e9b23e' },
      { d: 'M224 172a14 11 0 1 0 28 0a14 11 0 1 0 -28 0', cor: '#e9b23e' },
    ],
    linhas: [
      'M92 178C86 120 130 78 200 78C270 78 314 120 308 178C304 236 262 276 200 278C138 276 96 236 92 178',
      'M112 122C98 92 108 62 138 64C156 66 166 82 164 96', 'M288 122C302 92 292 62 262 64C244 66 234 82 236 96',
      'M124 112C118 92 126 78 142 80', 'M276 112C282 92 274 78 258 80',
      'M138 172C150 158 174 158 184 174C172 186 150 186 138 172', 'M262 172C250 158 226 158 216 174C228 186 250 186 262 172',
      'M186 206C192 200 208 200 214 206C212 216 205 222 200 224C195 222 188 216 186 206',
      'M200 224L200 238', 'M200 238C194 250 180 252 170 244', 'M200 238C206 250 220 252 230 244', 'M186 262C194 267 206 267 214 262',
      'M150 232L98 222', 'M152 244L100 252', 'M250 232L302 222', 'M248 244L300 252',
      'M186 104c6 -7 18 -7 24 0', 'M146 102c5 -6 14 -6 18 1', 'M254 102c-5 -6 -14 -6 -18 1', 'M108 190c4 -9 16 -11 22 -4', 'M292 190c-4 -9 -16 -11 -22 -4',
      'M168 92c4 -5 11 -5 14 0', 'M218 92c4 -5 11 -5 14 0', 'M156 128c3 -6 10 -7 14 -2', 'M230 126c4 -5 11 -4 14 2', 'M184 146c3 -4 9 -4 11 0', 'M205 146c3 -4 9 -4 11 0',
      'M102 160c3 -7 12 -9 17 -3', 'M298 160c-3 -7 -12 -9 -17 -3', 'M108 250c4 -6 11 -6 14 0', 'M292 250c-4 -6 -11 -6 -14 0', 'M126 268c4 -4 10 -4 12 1', 'M274 268c-4 -4 -10 -4 -12 1',
      'M40 322C120 316 280 318 362 322',
      'M118 320C114 292 138 280 158 284C178 288 186 304 182 320', 'M218 320C214 304 222 288 242 284C262 280 286 292 282 320',
      'M140 302L140 318', 'M160 300L160 318', 'M240 300L240 318', 'M260 302L260 318',
    ],
    pontos: [[162, 172, 4, 10], [238, 172, 4, 10], [200, 124, 6, 5], [176, 112, 4, 4], [224, 112, 4, 4], [140, 140, 5, 4], [260, 140, 5, 4],
      [118, 232, 4, 4], [282, 232, 4, 4], [176, 240, 3, 3], [224, 240, 3, 3], [186, 248, 2.5, 2.5], [214, 248, 2.5, 2.5],
      [128, 300, 5, 4], [150, 296, 4, 3], [172, 302, 4, 4], [230, 302, 4, 4], [250, 296, 4, 3], [272, 300, 5, 4]],
  }

  // marca de beijo (viewBox 120×70): lábios cheios com o vinco claro no meio
  const BEIJO = {
    vb: [120, 70],
    cheios: [
      { d: 'M2 30C12 12 28 4 44 14C50 8 58 7 60 12C64 7 72 8 76 14C92 4 108 12 118 30C96 33 74 36 60 33C46 36 24 33 2 30Z', cor: '#a3122f' },
      { d: 'M4 34C24 40 46 40 60 39C74 40 96 40 116 34C102 56 80 66 60 66C40 66 18 56 4 34Z', cor: '#a3122f' },
    ],
    linhas: [],
    vincos: ['M8 32C30 36 50 37 60 36C72 37 92 36 112 32', 'M40 46C44 54 50 58 54 58', 'M78 46C74 54 70 58 66 58', 'M30 20C34 24 38 26 42 26'],
  }

  let uid = 0
  // filtros: "traco" treme a linha; "giz" dá a falha de pigmento do preenchimento e também treme
  function filtros(ns) {
    const a = `f${uid++}`, b = `f${uid++}`
    return {
      a, b,
      html: `<defs>
  <filter id="${a}" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency="0.03" numOctaves="2" seed="1" result="w"/>
    <feDisplacementMap in="SourceGraphic" in2="w" scale="${ns.traco ?? 5}" xChannelSelector="R" yChannelSelector="G"/></filter>
  <filter id="${b}" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="2" seed="4" result="g"/>
    <feColorMatrix in="g" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -3 2.1" result="m"/>
    <feComposite in="SourceGraphic" in2="m" operator="in" result="f"/>
    <feTurbulence type="fractalNoise" baseFrequency="0.03" numOctaves="2" seed="1" result="w"/>
    <feDisplacementMap in="f" in2="w" scale="${ns.giz ?? 7}" xChannelSelector="R" yChannelSelector="G"/></filter></defs>`,
    }
  }

  const NS = 'http://www.w3.org/2000/svg'
  function criaSvg(pai, cls, w, h, vb) {
    const s = document.createElementNS(NS, 'svg')
    s.setAttribute('class', cls)
    s.setAttribute('width', w); s.setAttribute('height', h)
    if (vb) s.setAttribute('viewBox', `0 0 ${vb[0]} ${vb[1]}`)
    pai.appendChild(s)
    return s
  }

  // ilustração (onça ou beijo) em (x, y) = centro, com largura w; devolve as partes para animar
  function ilustra(pai, def, x, y, w, rot = 0) {
    const h = w * def.vb[1] / def.vb[0]
    const s = criaSvg(pai, 'ilustra', w, h, def.vb)
    Object.assign(s.style, { left: `${x - w / 2}px`, top: `${y - h / 2}px`, transform: `rotate(${rot}deg)` })
    const f = filtros({ traco: 3, giz: 4 })
    s.innerHTML = f.html +
      `<g filter="url(#${f.b})" transform="translate(7 6)">${def.cheios.map(c => `<path d="${c.d}" fill="${c.cor}"/>`).join('')}</g>` +
      `<g filter="url(#${f.a})">` +
      def.linhas.map(d => `<path class="tr" d="${d}" pathLength="1" stroke-dasharray="1 1" fill="none" stroke="${TINTA}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>`).join('') +
      (def.pontos || []).map(([cx, cy, rx, ry]) => `<ellipse class="pt" cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${TINTA}"/>`).join('') +
      (def.vincos || []).map(d => `<path class="tr" d="${d}" pathLength="1" stroke-dasharray="1 1" fill="none" stroke="#f3c2c0" stroke-width="3" stroke-linecap="round" opacity=".8"/>`).join('') +
      `</g>`
    return {
      svg: s,
      cheios: s.querySelector(`g[filter="url(#${f.b})"]`),
      linhas: [...s.querySelectorAll('.tr')],
      pontos: [...s.querySelectorAll('.pt')],
      turb: [...s.querySelectorAll('feTurbulence')].filter(t => t.getAttribute('baseFrequency') === '0.03'),
    }
  }

  // rabiscos soltos, em coordenadas da tela
  function rabiscos(pai, caminhos, cor = TINTA, larg = 6) {
    const s = criaSvg(pai, 'rabisco', 1080, 1920)
    const f = filtros({ traco: 5 })
    s.innerHTML = f.html + `<g filter="url(#${f.a})">` +
      caminhos.map(d => `<path d="${d}" pathLength="1" stroke-dasharray="1 1" fill="none" stroke="${cor}" stroke-width="${larg}" stroke-linecap="round" stroke-linejoin="round"/>`).join('') + '</g>'
    return { svg: s, linhas: [...s.querySelectorAll('path')], turb: [...s.querySelectorAll('feTurbulence')] }
  }

  const n = v => v.toFixed(1)
  const R = {
    brilho: (x, y, s) => `M${n(x)} ${n(y - s)}C${n(x + s * .12)} ${n(y - s * .2)} ${n(x + s * .2)} ${n(y - s * .12)} ${n(x + s)} ${n(y)}C${n(x + s * .2)} ${n(y + s * .12)} ${n(x + s * .12)} ${n(y + s * .2)} ${n(x)} ${n(y + s)}C${n(x - s * .12)} ${n(y + s * .2)} ${n(x - s * .2)} ${n(y + s * .12)} ${n(x - s)} ${n(y)}C${n(x - s * .2)} ${n(y - s * .12)} ${n(x - s * .12)} ${n(y - s * .2)} ${n(x)} ${n(y - s)}`,
    coracao: (x, y, s) => `M${n(x)} ${n(y + s * .55)}C${n(x - s * 1.2)} ${n(y - s * .3)} ${n(x - s * .6)} ${n(y - s * 1.2)} ${n(x)} ${n(y - s * .45)}C${n(x + s * .6)} ${n(y - s * 1.2)} ${n(x + s * 1.2)} ${n(y - s * .3)} ${n(x)} ${n(y + s * .55)}`,
    tracos: (x, y, a, s) => [-0.5, 0, 0.5].map(d => {
      const b = a + d
      return `M${n(x + Math.cos(b) * s * .45)} ${n(y + Math.sin(b) * s * .45)}L${n(x + Math.cos(b) * s)} ${n(y + Math.sin(b) * s)}`
    }).join(''),
    // seta curva de (x0,y0) a (x1,y1), com a ponta aberta
    seta: (x0, y0, x1, y1, curva = 0.35) => {
      const mx = (x0 + x1) / 2 - (y1 - y0) * curva, my = (y0 + y1) / 2 + (x1 - x0) * curva
      const a = Math.atan2(y1 - my, x1 - mx)
      const p = (da, l = 26) => `${n(x1 - Math.cos(a + da) * l)} ${n(y1 - Math.sin(a + da) * l)}`
      return `M${n(x0)} ${n(y0)}Q${n(mx)} ${n(my)} ${n(x1)} ${n(y1)}M${p(0.5)}L${n(x1)} ${n(y1)}L${p(-0.5)}`
    },
    // sublinhado em onda, como caneta passando rápido
    onda: (x, y, w) => {
      let d = `M${n(x)} ${n(y)}`
      for (let i = 1; i <= 6; i++) d += `Q${n(x + w * (i - 0.5) / 6)} ${n(y + (i % 2 ? -9 : 9))} ${n(x + w * i / 6)} ${n(y + (i === 6 ? -4 : 0))}`
      return d
    },
    // círculo rabiscado: mais de uma volta, sem fechar certinho
    roda: (x, y, rx, ry) => {
      let d = ''
      for (let i = 0; i <= 44; i++) {
        const a = -2.2 + i / 44 * Math.PI * 2.3, k = 1 + 0.06 * Math.sin(i * 0.7)
        d += `${i ? 'L' : 'M'}${n(x + Math.cos(a) * rx * k)} ${n(y + Math.sin(a) * ry * k)}`
      }
      return d
    },
    flor: (x, y, r) => {
      let d = ''
      for (let i = 0; i < 5; i++) {
        const a = i / 5 * Math.PI * 2 - Math.PI / 2, b = a + 0.62
        d += `M${n(x)} ${n(y)}C${n(x + Math.cos(a) * r * 1.4)} ${n(y + Math.sin(a) * r * 1.4)} ${n(x + Math.cos(b) * r * 1.4)} ${n(y + Math.sin(b) * r * 1.4)} ${n(x)} ${n(y)}`
      }
      return d + `M${n(x - 3)} ${n(y)}a3 3 0 1 0 6 0a3 3 0 1 0 -6 0`
    },
  }

  window.D = { ONCA, BEIJO, ilustra, rabiscos, R, TINTA }
})()
