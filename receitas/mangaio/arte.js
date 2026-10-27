// Ilustrações em papel recortado para o vídeo da parceria (SVG gerado em código, cores do manual do Bistrô).
// Bordas levemente tortas (ruído com semente) para parecer corte de tesoura.
const ARTE = {}
;(() => {
  const h = (a, b = 0) => { const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return s - Math.floor(s) }
  const f = n => n.toFixed(1)

  // silhueta de serra: de x0 a x1, base em yb, picos aleatórios
  ARTE.serra = (x0, x1, yTopo, yb, passo, amp, semente, cor) => {
    let d = `M${x0} ${yb} L${x0} ${yTopo}`
    for (let x = x0, i = 0; x <= x1; x += passo, i++) {
      const y = yTopo + Math.sin(i * 0.9 + semente) * amp * 0.6 + (h(i, semente) - 0.5) * amp
      d += ` Q${f(x + passo / 2)} ${f(y - amp * 0.5 * h(i + 7, semente))} ${f(x + passo)} ${f(y)}`
    }
    return `<path d="${d} L${x1 + passo} ${yb} Z" fill="${cor}"/>`
  }
  // faixa de chão com borda de cima ondulada
  ARTE.chao = (x0, x1, y, yb, cor, semente, amp = 10) => {
    let d = `M${x0} ${yb} L${x0} ${y}`
    for (let x = x0, i = 0; x <= x1; x += 60, i++) d += ` L${x + 60} ${f(y + (h(i, semente) - 0.5) * amp)}`
    return `<path d="${d} L${x1 + 60} ${yb} Z" fill="${cor}"/>`
  }
  // moita redonda (círculos juntos)
  ARTE.moita = (cx, yb, r, cor, semente) => {
    let s = ''
    for (let i = 0; i < 5; i++) {
      const a = (i / 4 - 0.5) * 1.9, rr = r * (0.55 + h(i, semente) * 0.3)
      s += `<circle cx="${f(cx + Math.sin(a) * r * 0.75)}" cy="${f(yb - rr - Math.cos(a) * r * 0.35)}" r="${f(rr)}" fill="${cor}"/>`
    }
    return s
  }
  // mandacaru: tronco com dois braços, pontas arredondadas
  ARTE.mandacaru = (x, yb, alt, cor) => {
    const w = alt * 0.13
    const braco = (lado, yb2, al) => `<path d="M${x} ${yb2} h${lado * alt * 0.22} v${-al}" stroke="${cor}" stroke-width="${f(w * 0.8)}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`
    return `<g>${braco(-1, yb - alt * 0.38, alt * 0.3)}${braco(1, yb - alt * 0.55, alt * 0.28)}
      <path d="M${x} ${yb} V${yb - alt}" stroke="${cor}" stroke-width="${f(w)}" stroke-linecap="round"/></g>`
  }
  // umbuzeiro: copa larga e baixa, tronco torto
  ARTE.umbuzeiro = (x, yb, l, cor, tronco) =>
    `<path d="M${x - 12} ${yb} C${x - 8} ${yb - l * 0.25} ${x - 30} ${yb - l * 0.35} ${x - 20} ${yb - l * 0.45} L${x + 22} ${yb - l * 0.45} C${x + 26} ${yb - l * 0.3} ${x + 10} ${yb - l * 0.2} ${x + 14} ${yb} Z" fill="${tronco}"/>` +
    ARTE.moita(x, yb - l * 0.38, l * 0.42, cor, x)

  // ingredientes (caixa ~120×120, centro em 0,0)
  ARTE.ingrediente = {
    pimenta: `<path d="M-38 -30 C-10 -40 34 -20 40 30 C 42 46 30 50 22 34 C 10 6 -12 -10 -38 -14 Z" fill="#c0261a"/><path d="M-50 -34 C-42 -44 -30 -40 -30 -30 C -34 -20 -46 -20 -50 -26 Z M-44 -40 l -10 -16" fill="#396600" stroke="#396600" stroke-width="6" stroke-linecap="round"/>`,
    manga: `<ellipse cx="0" cy="6" rx="40" ry="50" transform="rotate(-25)" fill="#f2a93b"/><ellipse cx="14" cy="-6" rx="20" ry="30" transform="rotate(-25)" fill="#e8622c" opacity=".55"/><path d="M0 -44 C 18 -66 44 -62 50 -50 C 30 -40 14 -40 0 -44 Z" fill="#396600"/>`,
    maracuja: `<circle r="44" fill="#f5c542"/><circle cx="-14" cy="-12" r="4" fill="#b8862a"/><circle cx="12" cy="4" r="4" fill="#b8862a"/><circle cx="-4" cy="20" r="4" fill="#b8862a"/><circle cx="20" cy="-18" r="3" fill="#b8862a"/><path d="M0 -44 C 4 -56 10 -60 16 -62" stroke="#396600" stroke-width="6" fill="none" stroke-linecap="round"/>`,
    manjericao: `<path d="M0 40 C -40 20 -44 -24 -6 -46 C 4 -10 6 14 0 40 Z" fill="#3f8a2e"/><path d="M4 40 C 40 26 50 -14 20 -40 C 8 -8 4 16 4 40 Z" fill="#5aa03f"/><path d="M0 40 L -6 -30 M4 40 L 18 -26" stroke="#2c6620" stroke-width="3"/>`,
    limao: `<circle r="42" fill="#6fa83a"/><circle cx="-12" cy="-14" r="12" fill="#a6d16e" opacity=".8"/><path d="M30 -30 C 40 -44 54 -44 58 -38 C 48 -30 40 -28 30 -30 Z" fill="#396600"/>`,
    alho: `<path d="M0 -50 C 6 -36 14 -30 30 -18 C 52 0 44 40 0 44 C -44 40 -52 0 -30 -18 C -14 -30 -6 -36 0 -50 Z" fill="#f7f1e3"/><path d="M0 -40 C -12 -10 -12 20 0 44 M0 -40 C 12 -10 12 20 0 44 M -26 -14 C -36 10 -30 30 -14 42 M 26 -14 C 36 10 30 30 14 42" stroke="#cfc3a6" stroke-width="3" fill="none"/>`,
    tamarindo: `<path d="M-52 10 C -50 -14 -30 -10 -24 0 C -18 -16 4 -16 6 0 C 12 -14 34 -14 36 4 C 50 6 56 20 44 30 C 20 40 -30 36 -52 10 Z" fill="#8a5a2b"/><path d="M-40 14 C -10 22 20 22 40 18" stroke="#5e3b1b" stroke-width="3" fill="none"/>`,
    alecrim: `<path d="M-6 50 C -2 10 4 -20 10 -54" stroke="#4f6b33" stroke-width="5" fill="none"/>` +
      Array.from({ length: 9 }, (_, i) => { const y = 40 - i * 11, x = -4 + i * 1.6; return `<path d="M${x} ${y} l -26 -10 M${x} ${y} l 22 -14" stroke="#5f8a3e" stroke-width="5" stroke-linecap="round"/>` }).join(''),
  }

  // casinha de platibanda (Serrinha): corpo, platibanda recortada, porta e janelas
  ARTE.casa = (x, yb, l, a, cor, porta, janela, semente) => {
    const pl = a * 0.16, topo = yb - a
    const ondas = l / 4
    let plat = `M${x} ${topo} `
    for (let i = 0; i < 4; i++) plat += `q${f(ondas / 2)} ${f(-pl * (h(i, semente) > 0.5 ? 0.9 : 0.5))} ${f(ondas)} 0 `
    return `<g>
      <path d="${plat} V${yb} H${x} Z" fill="${cor}"/>
      <rect x="${x}" y="${yb - a * 0.12}" width="${l}" height="${a * 0.12}" fill="#3d2f29" opacity=".25"/>
      <rect x="${x + l * 0.4}" y="${yb - a * 0.55}" width="${l * 0.2}" height="${a * 0.55}" rx="6" fill="${porta}"/>
      <rect x="${x + l * 0.1}" y="${yb - a * 0.66}" width="${l * 0.2}" height="${a * 0.26}" rx="4" fill="${janela}"/>
      <rect x="${x + l * 0.7}" y="${yb - a * 0.66}" width="${l * 0.2}" height="${a * 0.26}" rx="4" fill="${janela}"/>
      <rect x="${x - 6}" y="${topo + pl * 0.2}" width="${l + 12}" height="10" fill="#fffdea" opacity=".7"/>
    </g>`
  }
})()
window.ARTE = ARTE
