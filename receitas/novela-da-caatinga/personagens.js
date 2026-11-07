// Elenco da Novela da Caatinga em SVG gerado em código. Um RIG DE ROSTO só (olhos, sobrancelhas, boca)
// para todo mundo, sobre corpos diferentes: desenhar um personagem novo é desenhar um corpo.
// Cada função devolve uma string SVG; o estado vem de fora, a cada quadro (sem relógio aqui dentro):
//   P.umbu(x, y, s, st)  (x, y) = meio dos pés no chão; s = escala (1 ≈ 300 px de altura)
//   st = { fala: 0..1 (boca aberta pela voz), pisca: 0..1, olhar: [-1..1, -1..1], expr, sx, sy, giro,
//          passo: fase da caminhada (ou null), braco: graus }
;(() => {
  const TINTA = '#2b2118'
  const f = n => (+n).toFixed(1)
  const h = (a, b = 0) => { const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return s - Math.floor(s) }
  const traco = (w = 5) => `stroke="${TINTA}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"`

  // ---------- o rosto ----------
  // expr: neutra, sorriso, sorriso_propaganda, ironica, sobrancelha_levantada, olhos_semicerrados,
  //       olhos_arregalados, encantado, empolgado, brava, triste
  function rosto(cx, cy, k, st = {}) {
    const e = st.expr || 'neutra'
    const [ox, oy] = st.olhar || [0, 0]
    const dx = 19 * k
    let abre = 1 - (st.pisca || 0)
    if (e === 'olhos_semicerrados' || e === 'ironica') abre *= 0.5
    const grande = e === 'olhos_arregalados' || e === 'encantado' ? 1.25 : 1
    let s = ''
    for (const lado of [-1, 1]) {
      const x = cx + lado * dx
      const rx = 10 * k * grande, ry = 12.5 * k * grande * Math.max(abre, 0.08)
      if (abre < 0.12) s += `<path d="M${f(x - rx)} ${f(cy)} q${f(rx)} ${f(4 * k)} ${f(2 * rx)} 0" fill="none" ${traco(3.2 * k)}/>`
      else {
        s += `<ellipse cx="${f(x)}" cy="${f(cy)}" rx="${f(rx)}" ry="${f(ry)}" fill="#fffaf0" ${traco(2.6 * k)}/>`
        const pr = 5.6 * k * grande
        s += `<circle cx="${f(x + ox * rx * 0.45)}" cy="${f(cy + oy * ry * 0.4 + ry * 0.12)}" r="${f(Math.min(pr, ry * 0.9))}" fill="${TINTA}"/>`
        s += `<circle cx="${f(x + ox * rx * 0.45 + 2 * k)}" cy="${f(cy + oy * ry * 0.4 - 1.2 * k)}" r="${f(1.8 * k)}" fill="#fff"/>`
        if (e === 'encantado') // estrelinhas nos olhos
          s += `<path d="M${f(x + 7 * k)} ${f(cy - 14 * k)} l${f(2 * k)} ${f(5 * k)} l${f(5 * k)} ${f(2 * k)} l${f(-5 * k)} ${f(2 * k)} l${f(-2 * k)} ${f(5 * k)} l${f(-2 * k)} ${f(-5 * k)} l${f(-5 * k)} ${f(-2 * k)} l${f(5 * k)} ${f(-2 * k)}z" fill="#fff6b0" ${traco(1.2 * k)}/>`
        if (abre < 0.75) // pálpebra
          s += `<path d="M${f(x - rx - 1)} ${f(cy - ry * 0.2)} L${f(x + rx + 1)} ${f(cy - ry * 0.2)}" ${traco(3 * k)}/>`
      }
      // sobrancelhas
      let by = cy - 20 * k * grande, inc = 0
      if (e === 'sobrancelha_levantada' && lado === 1) by -= 9 * k
      if (e === 'brava') inc = lado * 5 * k
      if (e === 'triste') inc = -lado * 4 * k
      if (e === 'ironica' && lado === -1) by -= 6 * k
      s += `<path d="M${f(x - 8 * k)} ${f(by - inc)} Q${f(x)} ${f(by - 4 * k)} ${f(x + 8 * k)} ${f(by + inc)}" fill="none" ${traco(3.4 * k)}/>`
    }
    // boca: a voz manda; calada, a expressão manda
    const my = cy + 25 * k, a = st.fala || 0
    if (a > 0.06) {
      const rx = (7 + 5 * a) * k, ry = (2.5 + 11 * a) * k
      s += `<ellipse cx="${f(cx)}" cy="${f(my + ry * 0.4)}" rx="${f(rx)}" ry="${f(ry)}" fill="#5a1f1a" ${traco(2.6 * k)}/>`
      if (ry > 6 * k) s += `<ellipse cx="${f(cx)}" cy="${f(my + ry * 0.9)}" rx="${f(rx * 0.55)}" ry="${f(ry * 0.35)}" fill="#d0605a"/>`
    } else if (e === 'sorriso_propaganda' || e === 'empolgado') {
      s += `<path d="M${f(cx - 18 * k)} ${f(my - 3 * k)} Q${f(cx)} ${f(my + 18 * k)} ${f(cx + 18 * k)} ${f(my - 3 * k)} Z" fill="#fff" ${traco(2.6 * k)}/>`
      s += `<path d="M${f(cx - 16 * k)} ${f(my)} L${f(cx + 16 * k)} ${f(my)}" ${traco(1.6 * k)}/>`
    } else if (e === 'olhos_arregalados' || e === 'encantado') {
      s += `<ellipse cx="${f(cx)}" cy="${f(my + 2 * k)}" rx="${f(4.5 * k)}" ry="${f(5.5 * k)}" fill="#5a1f1a" ${traco(2.4 * k)}/>`
    } else if (e === 'brava' || e === 'triste') {
      s += `<path d="M${f(cx - 10 * k)} ${f(my + 5 * k)} Q${f(cx)} ${f(my - 4 * k)} ${f(cx + 10 * k)} ${f(my + 5 * k)}" fill="none" ${traco(3.2 * k)}/>`
    } else if (e === 'ironica' || e === 'olhos_semicerrados') {
      s += `<path d="M${f(cx - 10 * k)} ${f(my + 2 * k)} Q${f(cx + 2 * k)} ${f(my + 5 * k)} ${f(cx + 11 * k)} ${f(my - 3 * k)}" fill="none" ${traco(3.2 * k)}/>`
    } else {
      const c = e === 'neutra' ? 4 : 9
      s += `<path d="M${f(cx - 11 * k)} ${f(my)} Q${f(cx)} ${f(my + c * k)} ${f(cx + 11 * k)} ${f(my)}" fill="none" ${traco(3.2 * k)}/>`
    }
    // bochechas
    s += `<ellipse cx="${f(cx - 30 * k)}" cy="${f(cy + 16 * k)}" rx="${f(7 * k)}" ry="${f(4 * k)}" fill="#e0705a" opacity=".35"/>`
    s += `<ellipse cx="${f(cx + 30 * k)}" cy="${f(cy + 16 * k)}" rx="${f(7 * k)}" ry="${f(4 * k)}" fill="#e0705a" opacity=".35"/>`
    return s
  }

  // pernas de palito com pé oval (o jeito pré-escolar); passo = fase da caminhada em ciclos, ou null
  function pernas(x, y, k, abert, comp, passo) {
    let s = ''
    for (const lado of [-1, 1]) {
      const fase = passo == null ? 0 : Math.sin((passo + (lado > 0 ? 0.5 : 0)) * Math.PI * 2)
      const px = x + lado * abert * k + fase * 14 * k
      const lev = passo == null ? 0 : Math.max(0, fase) * 10 * k
      s += `<path d="M${f(x + lado * abert * k)} ${f(y - comp * k)} L${f(px)} ${f(y - 6 * k - lev)}" fill="none" ${traco(5 * k)}/>`
      s += `<ellipse cx="${f(px + lado * 6 * k)}" cy="${f(y - 4 * k - lev)}" rx="${f(12 * k)}" ry="${f(6 * k)}" fill="${TINTA}"/>`
    }
    return s
  }
  // braço de palito: do ombro, num ângulo (graus, 0 = para baixo), com mãozinha
  function braco(x, y, k, ang, comp = 55, lado = 1) {
    const a = (ang * Math.PI) / 180
    const ex = x + Math.sin(a) * comp * k * lado, ey = y + Math.cos(a) * comp * k
    return `<path d="M${f(x)} ${f(y)} L${f(ex)} ${f(ey)}" fill="none" ${traco(5 * k)}/><circle cx="${f(ex)}" cy="${f(ey)}" r="${f(6.5 * k)}" fill="${TINTA}"/>`
  }

  // envelopa um corpo: squash/stretch e giro em volta dos pés
  const corpo = (x, y, s, st, dentro) => {
    const sx = (st.sx ?? 1) * s, sy = (st.sy ?? 1) * s
    return `<g transform="translate(${f(x)} ${f(y)}) rotate(${f(st.giro || 0)}) scale(${sx.toFixed(3)} ${sy.toFixed(3)})">${dentro}</g>`
  }

  const P = {}

  // Umbu: redondo, verde-amarelado, chapéu de palha, devagar
  P.umbu = (x, y, s, st = {}) => corpo(x, y, s, st, `
    ${pernas(0, 0, 1, 26, 46, st.passo)}
    <circle cx="0" cy="-150" r="105" fill="#b9c25a" ${traco()}/>
    <path d="M-60 -215 q25 -22 58 -18" fill="none" stroke="#f4f0b0" stroke-width="10" stroke-linecap="round" opacity=".6"/>
    ${[[-40, -60], [35, -95], [-55, -120], [50, -50], [10, -40]].map(([a, b]) => `<circle cx="${a}" cy="${b - 70}" r="3.2" fill="#7d8a35"/>`).join('')}
    <ellipse cx="0" cy="-245" rx="120" ry="20" fill="#d9b25c" ${traco()}/>
    <path d="M-62 -248 Q-58 -305 0 -308 Q58 -305 62 -248 Z" fill="#e5c271" ${traco()}/>
    <path d="M-60 -262 Q0 -250 60 -262" fill="none" stroke="#9b4523" stroke-width="10"/>
    ${braco(-92, -150, 1, 20, 50, -1)}${braco(92, -150, 1, st.braco ?? 20, 50, 1)}
    ${rosto(0, -165, 1.35, st)}`)

  // Licuri: coquinho pequeno, ovalado, ponta em cima, casca laranja com veios
  P.licuri = (x, y, s, st = {}) => corpo(x, y, s, st, `
    ${pernas(0, 0, 1, 18, 38, st.passo)}
    <path d="M0 -255 C40 -250 78 -190 78 -125 C78 -70 45 -36 0 -36 C-45 -36 -78 -70 -78 -125 C-78 -190 -40 -250 0 -255 Z" fill="#e39b3a" ${traco()}/>
    <path d="M0 -255 L0 -275" ${traco(6)}/>
    <path d="M-30 -225 C-50 -170 -50 -100 -32 -50 M30 -225 C50 -170 50 -100 32 -50" fill="none" stroke="#b86d22" stroke-width="4"/>
    ${braco(-70, -120, 0.85, st.bracoE ?? 15, 45, -1)}${braco(70, -120, 0.85, st.braco ?? 15, 45, 1)}
    ${st.reflexo ? `<path d="M-60 -200 C-30 -160 30 -160 60 -200 L60 -90 C30 -60 -30 -60 -60 -90 Z" fill="${st.reflexo}" opacity=".28"/>` : ''}
    ${rosto(0, -140, 1.15, st)}`)

  // Dona Mandioca: raiz comprida e larga, casca marrom, miolo claro no topo, lenço vermelho de bolinha
  P.dona_mandioca = (x, y, s, st = {}) => corpo(x, y, s, st, `
    ${pernas(0, 0, 1, 30, 40, st.passo)}
    <path d="M-80 -330 C-110 -250 -95 -120 -40 -45 C-15 -25 15 -25 40 -45 C95 -120 110 -250 80 -330 Z" fill="#8a5a33" ${traco()}/>
    ${[...Array(9)].map((_, i) => `<path d="M${-70 + h(i, 3) * 140} ${-300 + i * 28} q${10 + h(i, 4) * 10} -4 ${22 + h(i, 5) * 10} 2" fill="none" stroke="#5e3a1e" stroke-width="3.5"/>`).join('')}
    <path d="M-92 -320 Q0 -400 92 -320 Q100 -300 80 -290 Q0 -320 -80 -290 Q-100 -300 -92 -320 Z" fill="#c8402e" ${traco()}/>
    ${[[-50, -330], [-10, -350], [30, -338], [60, -318], [-70, -310]].map(([a, b]) => `<circle cx="${a}" cy="${b}" r="5" fill="#f3e2c0"/>`).join('')}
    <path d="M78 -305 l30 18 l-8 -30 z" fill="#c8402e" ${traco(4)}/>
    ${braco(-88, -200, 1, st.bracoE ?? 25, 60, -1)}
    ${st.leque != null ? `<g transform="rotate(${f(st.leque)} 92 -200)"><path d="M92 -200 L140 -150" ${traco(5)}/><path d="M140 -150 C120 -230 175 -250 205 -200 C220 -160 180 -135 140 -150 Z" fill="#6f8c4b" ${traco(4)}/><path d="M140 -150 L190 -205" stroke="#4d6a33" stroke-width="3"/></g>` : braco(88, -200, 1, st.braco ?? 25, 60, 1)}
    ${rosto(0, -230, 1.35, st)}`)

  // Maxixe: oval verde-claro, coberto de espinhos moles, flor no "cabelo"
  P.maxixe = (x, y, s, st = {}) => corpo(x, y, s, st, `
    ${pernas(0, 0, 1, 22, 40, st.passo)}
    ${[...Array(22)].map((_, i) => { const a = (i / 22) * Math.PI * 2, rx = 82, ry = 98; return `<path d="M${f(Math.cos(a) * rx * .96)} ${f(-138 + Math.sin(a) * ry * .96)} L${f(Math.cos(a) * (rx + 14))} ${f(-138 + Math.sin(a) * (ry + 14))}" ${traco(4)}/>` }).join('')}
    <ellipse cx="0" cy="-138" rx="82" ry="98" fill="#9cbf5a" ${traco()}/>
    ${[...Array(10)].map((_, i) => `<circle cx="${f(-55 + h(i, 8) * 110)}" cy="${f(-205 + h(i, 9) * 140)}" r="4" fill="#6f8c3b"/>`).join('')}
    <g transform="translate(48 -222)">${[0, 72, 144, 216, 288].map(a => `<ellipse cx="0" cy="-12" rx="8" ry="13" fill="#f2c53d" transform="rotate(${a})" ${traco(2.5)}/>`).join('')}<circle r="7" fill="#c8402e"/></g>
    ${braco(-80, -130, 0.9, st.bracoE ?? 20, 50, -1)}${braco(80, -130, 0.9, st.braco ?? 20, 50, 1)}
    ${rosto(0, -150, 1.2, st)}`)

  // Quiabo: vagem comprida e fina, com quinas, cálice no topo feito chapéu
  P.quiabo = (x, y, s, st = {}) => corpo(x, y, s, st, `
    ${pernas(0, 0, 1, 18, 42, st.passo)}
    <path d="M-48 -330 C-62 -230 -52 -110 -10 -42 Q0 -30 10 -42 C52 -110 62 -230 48 -330 Z" fill="#7aa24a" ${traco()}/>
    <path d="M-20 -325 C-26 -230 -20 -120 -4 -50 M20 -325 C26 -230 20 -120 4 -50" fill="none" stroke="#557a32" stroke-width="4"/>
    <path d="M-55 -330 Q0 -360 55 -330 L42 -312 Q0 -330 -42 -312 Z" fill="#4d6a33" ${traco()}/>
    <path d="M0 -352 Q6 -380 -6 -395" fill="none" ${traco(7)}/>
    ${braco(-55, -190, 0.9, st.bracoE ?? 20, 50, -1)}${braco(55, -190, 0.9, st.braco ?? 20, 50, 1)}
    ${rosto(0, -245, 1.1, { ...st, expr: st.expr || 'olhos_semicerrados' })}`)

  // Realçador: sachê de plástico, bordas serrilhadas, rosa-choque e azul elétrico, estrela "SABOR JÁ!"
  P.realcador = (x, y, s, st = {}) => {
    let serra = ''
    for (let i = 0; i <= 12; i++) serra += `${i ? 'L' : 'M'}${-120 + i * 20} ${i % 2 ? -372 : -360} `
    let serraB = ''
    for (let i = 0; i <= 12; i++) serraB += `L${120 - i * 20} ${i % 2 ? -38 : -50} `
    const brilho = st.brilho ?? 0
    return corpo(x, y, s, st, `
    ${pernas(0, 0, 1, 34, 44, st.passo)}
    <defs><linearGradient id="sache" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff3fa4"/><stop offset=".55" stop-color="#8a3cff"/><stop offset="1" stop-color="#1f6bff"/></linearGradient></defs>
    <path d="${serra} L120 -50 ${serraB} Z" fill="url(#sache)" ${traco()}/>
    <path d="M${f(-130 + brilho * 300)} -360 l50 0 l-90 310 l-50 0 z" fill="#fff" opacity=".35"/>
    <g transform="translate(0 -110) rotate(-8)"><path d="M0 -48 L13 -16 L48 -14 L20 8 L30 42 L0 22 L-30 42 L-20 8 L-48 -14 L-13 -16 Z" fill="#ffe54a" ${traco(3)}/>
    <text x="0" y="6" text-anchor="middle" font-family="Arial Black, Arial" font-weight="900" font-size="15" fill="#d01870">SABOR JÁ!</text></g>
    ${braco(-120, -230, 1, st.bracoE ?? 40, 60, -1)}${braco(120, -230, 1, st.braco ?? 40, 60, 1)}
    ${rosto(0, -270, 1.45, { ...st, expr: st.expr || 'sorriso_propaganda' })}`)
  }

  // Sachê sozinho (a amostra grátis)
  P.sache = (x, y, s, giro = 0) => {
    let d = ''
    for (let i = 0; i <= 6; i++) d += `${i ? 'L' : 'M'}${-30 + i * 10} ${i % 2 ? -4 : 0} `
    for (let i = 0; i <= 6; i++) d += `L${30 - i * 10} ${i % 2 ? 76 : 80} `
    return `<g transform="translate(${f(x)} ${f(y)}) rotate(${f(giro)}) scale(${s})"><path d="${d}Z" fill="url(#sacheP)" ${traco(3)}/>
      <defs><linearGradient id="sacheP" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff3fa4"/><stop offset="1" stop-color="#1f6bff"/></linearGradient></defs>
      <path d="M0 22 L5 34 L18 35 L8 43 L12 56 L0 48 L-12 56 L-8 43 L-18 35 L-5 34 Z" fill="#ffe54a"/>
      <path d="M-24 8 l10 0 l-14 60 l-6 0 z" fill="#fff" opacity=".45"/></g>`
  }

  // Mandacaru (cenário): coluna com braços
  P.mandacaru = (x, y, s, cor = '#5f8a4a') => `<g transform="translate(${f(x)} ${f(y)}) scale(${s})" >
    <path d="M-28 0 L-28 -330 Q-28 -360 0 -360 Q28 -360 28 -330 L28 0 Z" fill="${cor}" ${traco()}/>
    <path d="M-28 -150 L-70 -150 Q-90 -150 -90 -175 L-90 -250 Q-90 -270 -75 -270 Q-60 -270 -60 -250 L-60 -180 L-28 -180" fill="${cor}" ${traco()}/>
    <path d="M28 -200 L65 -200 Q85 -200 85 -225 L85 -290 Q85 -305 72 -305 Q58 -305 58 -290 L58 -228 L28 -228" fill="${cor}" ${traco()}/>
    <path d="M-10 -340 L-10 -10 M10 -340 L10 -10" stroke="#3e6334" stroke-width="3"/></g>`

  window.P = P
  window.P_rosto = rosto
  window.P_h = h
  window.TINTA = TINTA
})()
