// Guerra Verde, "Do alerta à operação": nove cenas desenhadas à mão em papel kraft, com aguada de aquarela,
// narração e legenda. Uma árvore cai; a câmera se afasta até o mapa; o satélite passa; o alerta é carimbado;
// a equipe planeja a rota; estrada, rio e helicóptero; o campo; a máquina riscada; de volta ao mapa; a série.
// Contrato do motor (motores/render/CONTRATO.md): a tela é 100% função de t, sem relógio nem estado.
// Os tempos vêm de tempos.json (preparar.py). Os efeitos sonoros (som/mixar.py) espelham os instantes daqui:
// mudou aqui, muda lá.

const { COR, quadro, grupo, linha, linhas, lava, tracejado, desenho, DES, F } = window.D

const lim = x => Math.min(1, Math.max(0, x))
const fase = (t, ini, dur) => lim((t - ini) / dur)
const suave = x => x * x * (3 - 2 * x)
const saida = x => 1 - (1 - x) ** 3                        // easeOutCubic
const volta = x => 1 + 2.2 * (x - 1) ** 3 + 1.2 * (x - 1) ** 2 // easeOutBack, suave
const mix = (a, b, p) => a + (b - a) * p
const r = (x, c = 2) => +x.toFixed(c)

// chave de estado: tudo o que muda na tela passa por st()/sa(), e a lista vira a chave do quadro
let CH = []
const st = (e, k, v) => { e.style[k] = v; CH.push(v) }
const sa = (e, k, v) => { e.setAttribute(k, v); CH.push(v) }

const el = (tag, cls, pai, txt) => {
  const e = document.createElement(tag)
  if (cls) e.className = cls
  if (txt != null) e.textContent = txt
  pai.appendChild(e)
  return e
}
// texto à mão centrado em (x, y); a escrita revela da esquerda para a direita (o recorte anda sobre o span do texto)
function mao(pai, txt, x, y, fs = 80, rot = 0, cor) {
  const e = el('div', 'mao', pai)
  el('span', null, e, txt).style.display = 'inline-block'
  Object.assign(e.style, { left: `${x - 500}px`, width: '1000px', top: `${y - fs * 0.6}px`, fontSize: `${fs}px`, transform: `rotate(${rot}deg)` })
  if (cor) e.style.color = cor
  return e
}
const escreve = (e, tl, t0, dur) => st(e.firstChild, 'clipPath', `inset(-60px ${r((1 - fase(tl, t0, dur)) * 100, 1)}% -60px -30px)`)
// traços que se desenham em sequência (cada um começa um pouco antes do anterior acabar)
const desenha = (ls, tl, t0, dur) => ls.forEach((p, k) => {
  const ini = t0 + dur * k / ls.length, d = Math.max(0.14, dur / ls.length * 1.6)
  sa(p, 'stroke-dashoffset', r(1 - suave(fase(tl, ini, d)), 3))
})
const aparece = (ls, tl, t0, dur) => [].concat(ls).forEach(e => sa(e, 'opacity', r(suave(fase(tl, t0, dur)), 3)))
const pronto = ls => [].concat(ls).forEach(p => p.setAttribute(p.tagName === 'g' ? 'opacity' : 'stroke-dashoffset', p.tagName === 'g' ? 1 : 0))
// letras que pulam no lugar, uma de cada vez
function titulo(pai, txt, x, y, fs) {
  const e = mao(pai, '', x, y, fs)
  e.classList.add('titulo')
  return { e, letras: [...txt].map(ch => el('span', null, e, ch === ' ' ? ' ' : ch)) }
}
const letras = (ls, tl, t0, passo = 0.05) => ls.forEach((s, j) => {
  const q = fase(tl, t0 + j * passo, 0.45)
  st(s, 'opacity', r(lim(q * 3)))
  st(s, 'transform', `translateY(${r((1 - saida(q)) * 50, 1)}px) scale(${r(mix(0.5, 1, volta(q)), 3)}) rotate(${r((1 - saida(q)) * (j % 2 ? 10 : -10), 1)}deg)`)
})

// ---------- o mapa (cenas satélite, alerta, planejamento e volta) ----------

const P = [560, 820]      // onde a árvore caiu
const BASE = [400, 708]   // a base do Ibama (no encontro dos rios)
const MAPA = {
  contorno: 'M170 560C230 500 330 470 420 480C470 440 540 430 600 452C660 420 740 430 790 470C840 470 900 500 930 560C950 620 920 680 940 740C930 820 880 880 800 900C740 960 640 990 560 970C480 990 380 960 320 910C250 890 190 840 170 770C140 700 160 630 170 560',
  rios: ['M190 700C290 690 360 720 450 700C540 680 620 700 700 680C780 662 850 640 925 600', 'M330 520C350 590 380 650 400 708',
    'M330 905C380 830 440 770 480 702', 'M650 950C645 860 652 770 662 690', 'M770 915C755 830 765 750 760 668'],
  rota: 'M400 708C440 760 490 812 560 820',
  orbita: 'M80 560C280 300 800 300 1000 560',
}
function mapa(pai, { arvore = true, mancha = false, rota = false } = {}) {
  const q = quadro(pai)
  const o = { q }
  o.fundo = lava(q, MAPA.contorno + 'Z', COR.musgo, 0.42)
  o.contorno = linha(q, MAPA.contorno, 5)
  o.rios = linhas(q, MAPA.rios, 3.5, '#3d5a63')
  o.rio = mao(pai, 'rio Amazonas', 790, 690, 34, -12)
  o.nome = mao(pai, 'Amazônia', 250, 962, 56, -5)
  if (arvore) {
    // a árvore caída, pequenininha, no lugar da queda
    const g = grupo(q)
    o.arvore = [lava(g, F.copa(P[0] + 34, P[1] - 6, 17, 12, 7, 2) + 'Z', COR.musgo, 0.7), linha(g, F.copa(P[0] + 34, P[1] - 6, 17, 12, 7, 2), 3), linha(g, `M${P[0] - 8} ${P[1] + 6}L${P[0] + 18} ${P[1] - 2}`, 3)]
  }
  if (mancha) {
    // a área desmatada: aguada ocre por cima do verde, com hachura
    const g = grupo(q)
    o.mancha = g
    o.manchaLava = lava(g, F.copa(P[0], P[1], 66, 48, 9, 12) + 'Z', COR.ocre, 0.62)
    o.hachura = linhas(g, [`M${P[0] - 40} ${P[1] + 14}l26 -30`, `M${P[0] - 20} ${P[1] + 26}l40 -46`, `M${P[0] + 4} ${P[1] + 30}l40 -46`, `M${P[0] + 28} ${P[1] + 26}l26 -30`], 3, COR.ferrugem)
  }
  if (rota) {
    o.bandeira = linhas(q, [`M${BASE[0]} ${BASE[1]}L${BASE[0]} ${BASE[1] - 58}`, `M${BASE[0]} ${BASE[1] - 58}L${BASE[0] + 40} ${BASE[1] - 46}L${BASE[0]} ${BASE[1] - 34}`], 4)
    o.bandeiraLava = lava(q, `M${BASE[0]} ${BASE[1] - 58}L${BASE[0] + 40} ${BASE[1] - 46}L${BASE[0]} ${BASE[1] - 34}Z`, COR.ferrugem, 0.7)
    o.rota = tracejado(q, MAPA.rota, 6, COR.ferrugem)
  }
  return o
}
const mapaPronto = o => {
  pronto([o.fundo, o.contorno, ...o.rios, ...(o.arvore || []), ...(o.hachura || []), ...(o.bandeira || []), o.manchaLava, o.bandeiraLava, o.rota].filter(Boolean))
}

// ---------- a árvore (abertura e final) ----------

function arvore(g) {
  const copa = F.copa(540, 690, 185, 150, 11, 4)
  const o = {
    lavas: [lava(g, copa + 'Z', COR.musgo, 0.55), lava(g, 'M524 975C527 920 525 870 530 818L551 818C557 870 555 920 558 975Z', COR.ocre, 0.5)],
    tracos: linhas(g, ['M524 975C527 920 525 870 530 818', 'M558 975C555 920 557 870 551 818', copa,
      'M531 850C506 826 480 812 452 806', 'M550 834C576 808 604 796 632 790', 'M540 900C522 884 506 880 492 882',
      'M470 660q20 -18 40 0', 'M560 620q22 -16 42 2', 'M600 720q18 -14 36 2', 'M470 745q16 -12 32 0'], 5),
  }
  return o
}

// ---------- cenas ----------
// cada cena recebe o "mundo" (div) e a sua entrada de tempos.json (c.marcas em segundos da cena)
// e devolve { anim(tl), ancora (de onde a câmera sai no zoom), alvo (onde a câmera chega) }

const CENAS = {
  arvore(m, c) {
    const M = c.marcas
    const q = quadro(m)
    const chao = linhas(q, ['M150 1010C330 1002 700 1016 930 1004', F.capim(170, 470, 1008, 3, 8), F.capim(620, 900, 1006, 4, 7)], 5)
    const pe = linhas(q, ['M524 1010L524 975', 'M558 1010L558 975'], 5)
    const corte = linha(q, 'M522 975C530 967 552 967 560 975C552 983 530 983 522 975', 4)
    const g = grupo(q)
    const a = arvore(g)
    const po = linhas(q, ['M880 985c-16 -10 -8 -28 8 -22c14 6 4 24 -8 18', 'M760 1000c-12 -8 -6 -22 6 -18', 'M960 960l26 -20M968 988l32 -4M700 978l-22 -24M988 1010l30 8'], 4)
    const sat = desenho(q, DES.satelite, 760, 500, 0.55)
    const bri = linhas(q, [F.brilho(836, 452, 24), F.brilho(690, 470, 14)], 4)
    q.svg.style.transform = 'translateX(-90px)'
    const txt = mao(m, 'Uma árvore cai.', 540, 360, 96, -2)
    return {
      ancora: [670, 960],
      anim(tl) {
        desenha(chao, tl, 0, 0.6)
        desenha([...pe, ...a.tracos], tl, 0.1, 1.0)
        aparece(a.lavas, tl, 0.6, 0.7)
        escreve(txt, tl, 0.3, 0.7)
        // a árvore tomba devagar e acelera (gravidade); no chão, quica de leve
        const qd = fase(tl, M.cai, 1.1), qb = fase(tl, M.cai + 1.1, 0.4)
        const ang = 82 * qd ** 2.6 - 4 * Math.sin(Math.PI * qb) * (qd >= 1)
        const rot = `rotate(${r(ang, 2)} 541 975)`
        sa(g.lav, 'transform', rot); sa(g.tr, 'transform', rot)
        desenha([corte], tl, M.cai, 0.3)
        desenha(po, tl, M.cai + 1.1, 0.4)
        // "ou quase ninguém": o satélite aparece lá no alto
        desenha(sat.tracos, tl, M.quase - 0.3, 0.7)
        aparece(sat.lavas, tl, M.quase, 0.5)
        desenha(bri, tl, M.quase + 0.45, 0.4)
      },
    }
  },

  satelite(m, c) {
    const M = c.marcas
    const o = mapa(m)
    mapaPronto(o)
    const q = quadro(m)
    const orb = tracejado(q, MAPA.orbita, 3, COR.tinta, '6 14')
    const guia = document.createElementNS('http://www.w3.org/2000/svg', 'path')
    guia.setAttribute('d', MAPA.orbita)
    const L = guia.getTotalLength()
    const varre = linhas(q, ['M0 0', 'M0 0'], 3, COR.ferrugem)
    varre.forEach(v => v.setAttribute('stroke-dasharray', '8 10'))
    const sat = desenho(q, DES.satelite, 0, 0, 0.62)
    const nome = mao(m, 'INPE', 0, 0, 64)
    const ondas = linhas(q, ['M0 0', 'M0 0'], 3)
    return {
      alvo: P,
      anim(tl) {
        desenha([orb], tl, 0.9, 1.0)
        const u = mix(0.04, 0.96, fase(tl, 1.0, c.dur - 1.0))
        const p = guia.getPointAtLength(u * L), p2 = guia.getPointAtLength(Math.min(L, u * L + 1))
        const ang = Math.atan2(p2.y - p.y, p2.x - p.x) * 180 / Math.PI * 0.4
        const tr = `translate(${r(p.x, 1)} ${r(p.y, 1)}) rotate(${r(ang, 1)}) scale(0.62)`
        sa(sat.lav, 'transform', tr); sa(sat.tr, 'transform', tr)
        desenha(sat.tracos, tl, 1.0, 0.7)
        aparece(sat.lavas, tl, 1.4, 0.4)
        // o nome vai junto com o satélite, escrito quando a voz diz "INPE"
        st(nome, 'left', `${r(p.x - 500, 1)}px`); st(nome, 'top', `${r(p.y + 34, 1)}px`)
        escreve(nome, tl, M.inpe - 0.1, 0.5)
        // a varredura: duas linhas do satélite até a floresta, enquanto ele passa por cima
        const qv = fase(tl, M.inpe + 0.3, 0.5) * (1 - fase(tl, M.inpe + 2.6, 0.5))
        varre.forEach((v, k) => {
          sa(v, 'd', `M${r(p.x, 1)} ${r(p.y + 30, 1)}L${P[0] + (k ? 40 : -40)} ${P[1] + (k ? 10 : -10)}`)
          sa(v, 'stroke-dashoffset', 0); sa(v, 'opacity', r(qv, 3))
        })
        // "bip": dois arquinhos saindo da antena
        const qo = fase(tl, M.inpe, 0.6)
        ondas.forEach((w, k) => {
          const rr = 18 + k * 14
          sa(w, 'd', `M${r(p.x - rr, 1)} ${r(p.y - 26 - rr * 0.4, 1)}Q${r(p.x, 1)} ${r(p.y - 26 - rr * 1.2, 1)} ${r(p.x + rr, 1)} ${r(p.y - 26 - rr * 0.4, 1)}`)
          sa(w, 'stroke-dashoffset', 0); sa(w, 'opacity', r(Math.sin(Math.PI * qo), 3))
        })
      },
    }
  },

  alerta(m, c) {
    const M = c.marcas
    const o = mapa(m, { mancha: true })
    mapaPronto(o)
    const g = el('div', null, m)
    const car = el('div', 'carimbo', g, 'ALERTA')
    Object.assign(g.style, { left: '0', top: '0', width: '1080px', height: '1920px' })
    Object.assign(car.style, { position: 'absolute', left: '300px', top: '492px', transformOrigin: '50% 50%' })
    const q = quadro(m)
    const seta = linha(q, F.seta(640, 660, P[0] + 10, P[1] - 62, -0.25), 5, COR.ferrugem)
    const txt = mao(m, 'sistema DETER', 540, 352, 84, -2)
    const sub = linha(q, F.onda(330, 400, 420), 5, COR.ferrugem)
    return {
      anim(tl) {
        // "quando o verde some": a mancha ocre se espalha a partir do ponto
        const qm = saida(fase(tl, M.some, 1.1))
        const s = `translate(${P[0]} ${P[1]}) scale(${r(mix(0.15, 1, qm), 3)}) translate(${-P[0]} ${-P[1]})`
        sa(o.mancha.lav, 'transform', s); sa(o.mancha.tr, 'transform', s)
        sa(o.manchaLava, 'opacity', r(lim(qm * 1.6), 3))
        desenha(o.hachura, tl, M.some + 0.7, 0.6)
        escreve(txt, tl, M.deter - 0.15, 0.6)
        desenha([sub], tl, M.deter + 0.4, 0.35)
        // carimbo: chega grande, bate no papel e fica
        const qc = fase(tl, M.alerta - 0.12, 0.2)
        st(car, 'opacity', r(lim(qc * 3), 3))
        st(car, 'transform', `rotate(-7deg) scale(${r(mix(1.7, 1, suave(qc)), 3)})`)
        desenha([seta], tl, M.alerta + 0.35, 0.45)
      },
    }
  },

  planejamento(m, c) {
    const M = c.marcas
    // a folha com o mapa, sobre a mesa (o kraft): tudo em coordenadas do mapa, reduzido e girado
    const C = [540, 712], S = 0.62, ROT = -3
    const folha = el('div', 'folha', m)
    folha.style.transformOrigin = `${C[0]}px ${C[1]}px`
    const papel = el('div', 'papel', folha)
    const rnd = window.D.sorteio(41)
    const borda = []
    const lados = [[110, 395, 975, 395], [975, 395, 975, 1025], [975, 1025, 110, 1025], [110, 1025, 110, 395]]
    for (const [x0, y0, x1, y1] of lados) for (let i = 0; i < 40; i++) {
      const k = i / 40, nx = -(y1 - y0), ny = x1 - x0, l = Math.hypot(nx, ny), d = (rnd() - 0.5) * 9
      borda.push(`${r(mix(x0, x1, k) + nx / l * d, 1)}px ${r(mix(y0, y1, k) + ny / l * d, 1)}px`)
    }
    papel.style.clipPath = `polygon(${borda.join(',')})`
    const o = mapa(folha, { mancha: true, rota: true })
    mapaPronto(o)
    o.rota.setAttribute('stroke-dashoffset', 1)
    const base = mao(folha, 'base', BASE[0] - 70, BASE[1] - 90, 64, -4)
    const alvo = mao(folha, 'alvo', P[0] + 120, P[1] + 70, 64, 3, COR.ferrugem)
    // pela tela: régua, lápis e alfinetes
    const tela = ([x, y]) => {
      const a = ROT * Math.PI / 180, dx = (x - C[0]) * S, dy = (y - C[1]) * S
      return [C[0] + dx * Math.cos(a) - dy * Math.sin(a), C[1] + dx * Math.sin(a) + dy * Math.cos(a)]
    }
    const q = quadro(m)
    const regua = grupo(q)
    regua.lav.setAttribute('transform', 'rotate(-8 540 1000)'); regua.tr.setAttribute('transform', 'rotate(-8 540 1000)')
    const rLava = lava(regua, 'M190 975L900 975L900 1030L190 1030Z', COR.caqui, 0.55)
    let marcas = ''
    for (let x = 215, i = 0; x < 890; x += 34, i++) marcas += `M${x} 975l0 ${i % 2 ? 16 : 28}`
    const rTracos = linhas(regua, [F.ret(190, 975, 900, 1030), marcas], 4)
    const lapis = grupo(q)
    lapis.lav.setAttribute('transform', 'rotate(-18 800 470)'); lapis.tr.setAttribute('transform', 'rotate(-18 800 470)')
    const lLava = lava(lapis, 'M660 456L900 456L900 484L660 484Z', COR.ocre, 0.6)
    const lTracos = linhas(lapis, ['M660 456L900 456L900 484L660 484', 'M660 456L622 470L660 484', 'M632 466L622 470L632 474', 'M876 456L876 484'], 4)
    const pinos = [tela(BASE), tela(P)].map(([x, y], k) => {
      const g = grupo(q)
      const o = { g, lava: lava(g, F.circ(x + 8, y - 34, 13, 7 + k) + 'Z', COR.ferrugem, 0.85), tracos: linhas(g, [F.circ(x + 8, y - 34, 13, 7 + k), `M${r(x + 4, 1)} ${r(y - 22, 1)}L${r(x, 1)} ${r(y, 1)}`], 3.5) }
      pronto([o.lava, ...o.tracos])
      return o
    })
    const txt = mao(m, 'Ibama · planejamento', 540, 352, 80, -2)
    return {
      anim(tl) {
        // a folha chega deslizando na mesa
        const qf = saida(fase(tl, 0, 0.9))
        st(folha, 'transform', `translate(${r((1 - qf) * 40, 1)}px,${r((1 - qf) * 700, 1)}px) rotate(${r(ROT + (1 - qf) * 8, 2)}deg) scale(${S})`)
        escreve(txt, tl, M.ibama - 0.3, 0.8)
        desenha(rTracos, tl, M.ibama + 0.2, 0.8)
        aparece(rLava, tl, M.ibama + 0.5, 0.5)
        desenha(lTracos, tl, 0.5, 0.6)
        aparece(lLava, tl, 0.8, 0.4)
        sa(o.rota, 'stroke-dashoffset', r(1 - suave(fase(tl, M.rota - 1.6, 1.8)), 3))
        escreve(base, tl, M.rota - 1.9, 0.4)
        escreve(alvo, tl, M.rota + 0.1, 0.4)
        // alfinetes: caem na base e no alvo
        pinos.forEach((p, k) => {
          const t0 = k ? M.rota + 0.2 : M.rota - 1.8, qp = saida(fase(tl, t0, 0.35))
          const tr = `translate(0 ${r((1 - qp) * -90, 1)})`
          sa(p.g.lav, 'transform', tr); sa(p.g.tr, 'transform', tr)
          sa(p.g.lav, 'opacity', r(lim(qp * 3), 3)); sa(p.g.tr, 'opacity', r(lim(qp * 3), 3))
        })
      },
    }
  },

  caminho(m, c) {
    const M = c.marcas
    const q = quadro(m)
    const ROTA = 'M120 532C400 512 700 532 860 572C970 602 930 712 770 744C580 784 380 734 250 794C130 854 170 950 340 974C520 1000 760 970 950 990'
    const rio = lava(q, 'M100 728C300 698 520 752 760 720C860 708 930 720 990 732L990 792C900 782 820 776 760 784C520 814 300 764 100 792Z', COR.agua, 0.55)
    const ondas = linhas(q, [F.onda(150, 768, 200, 5, 4), F.onda(640, 764, 220, 5, 4), F.onda(360, 704, 140, 4, 3)], 3, '#3d5a63')
    const copas = [[200, 1040, 90, 38], [370, 1032, 100, 42], [550, 1044, 95, 38], [730, 1034, 100, 42], [900, 1042, 90, 38]]
      .map(([x, y, rx, ry], k) => F.copa(x, y, rx, ry, 8, 20 + k))
    const mata = { lavas: copas.map(d => lava(q, d + 'Z', COR.musgo, 0.5)), tracos: linhas(q, copas, 4) }
    const capim = linhas(q, [F.capim(140, 330, 536, 8, 6), F.capim(640, 830, 548, 9, 6)], 3)
    const rota = tracejado(q, ROTA, 6, COR.ferrugem)
    const carro = desenho(q, DES.caminhonete, 470, 488, 0.95)
    const barco = desenho(q, DES.barco, 540, 740, 0.9)
    const heli = desenho(q, DES.helicoptero, 600, 880, 0.85)
    const rotulos = [mao(m, 'estrada', 470, 395, 62, -3), mao(m, 'rio', 300, 650, 62, 2), mao(m, 'ar', 850, 820, 62, -4)]
    const veic = [[carro, M.estrada], [barco, M.rio], [heli, M.helicoptero]]
    return {
      anim(tl) {
        aparece(rio, tl, 0.1, 0.6)
        desenha(ondas, tl, 0.3, 0.6)
        desenha(mata.tracos, tl, 0.2, 0.9)
        aparece(mata.lavas, tl, 0.6, 0.6)
        desenha(capim, tl, 0.3, 0.5)
        sa(rota, 'stroke-dashoffset', r(1 - fase(tl, 0.4, M.ponto - 0.2), 3))
        // cada veículo chega quando a voz diz o nome dele
        veic.forEach(([v, t0], k) => {
          const qv = saida(fase(tl, t0 - 0.2, 0.6))
          let dx = (1 - qv) * -60, dy = 0
          if (k === 1) dy = Math.sin(tl * 2.4) * 3
          if (k === 2) { dx += Math.max(0, tl - t0) * 14; dy = Math.sin(tl * 1.6) * 5 }
          const tr = `translate(${r(dx, 1)} ${r(dy, 1)}) ${v.base}`
          sa(v.lav, 'transform', tr); sa(v.tr, 'transform', tr)
          desenha(v.tracos, tl, t0 - 0.2, 0.5)
          aparece(v.lavas, tl, t0 + 0.1, 0.4)
          escreve(rotulos[k], tl, t0 + 0.05, 0.4)
        })
        // hélice: a pá "pisca" como desenho animado
        sa(heli.helice, 'stroke-dashoffset', r(1 - suave(fase(tl, M.helicoptero, 0.3)), 3))
        sa(heli.helice, 'transform', `translate(10 -78) scale(${r(0.55 + 0.45 * Math.abs(Math.sin(tl * 9)), 2)} 1) translate(-10 78)`)
      },
    }
  },

  campo(m, c) {
    const M = c.marcas
    const q = quadro(m)
    const solo = lava(q, 'M250 975C400 935 650 940 850 968C870 1004 700 1036 520 1036C370 1036 250 1012 250 975Z', COR.ocre, 0.42)
    const ce = F.copa(190, 700, 120, 140, 10, 7), cd = F.copa(905, 730, 110, 130, 10, 8)
    const mata = { lavas: [lava(q, ce + 'Z', COR.musgo, 0.55), lava(q, cd + 'Z', COR.musgo, 0.55)],
      tracos: linhas(q, ['M110 962C360 950 720 968 970 954', ce, 'M178 958L182 830M204 958L200 832', cd, 'M894 956L896 850M918 956L916 852'], 5) }
    const tocos = [[330, 990, 54, 34], [450, 945, 40, 26], [820, 992, 50, 32], [545, 1022, 44, 28]]
    const tTracos = linhas(q, tocos.flatMap(([x, y, w, h]) => F.toco(x, y, w, h)), 4)
    const ok = linhas(q, tocos.map(([x, y, w, h]) => `M${x - 16} ${y - h - 34}l12 14l24 -30`), 5, COR.ferrugem)
    // o fiscal, de colete, com a prancheta
    const tronco = 'M628 690C620 760 618 820 624 860L698 860C704 820 702 760 694 690C680 680 642 680 628 690'
    const fiscal = {
      lavas: [lava(q, tronco + 'Z', COR.caqui, 0.75), lava(q, 'M712 760L776 760L776 840L712 840Z', COR.creme, 0.9), lava(q, 'M628 630C634 600 688 598 694 628Z', COR.musgoEsc, 0.7)],
      tracos: linhas(q, [F.circ(660, 640, 32, 6), 'M626 630C632 600 690 598 696 628', 'M690 626L722 633', 'M652 672L652 686M668 672L668 686', tronco,
        'M630 700C604 740 598 790 606 830', 'M694 700C724 730 738 760 726 790', F.ret(712, 760, 776, 840), 'M732 756L756 756',
        'M640 860L634 960M682 860L690 960', 'M620 962L648 962M680 962L708 962', 'M724 780L762 780M724 798L756 798M724 816L748 816'], 4.5),
    }
    const colete = el('div', 'mao', m, 'IBAMA')
    Object.assign(colete.style, { left: '610px', width: '100px', top: '742px', fontSize: '28px', transform: 'rotate(-2deg)' })
    const t1 = mao(m, 'auto de infração', 540, 350, 84, -2)
    const t2 = mao(m, 'embargo da área', 540, 448, 72, 1, COR.ferrugem)
    const sub = linha(q, F.onda(330, 500, 420), 5, COR.ferrugem)
    return {
      anim(tl) {
        desenha(mata.tracos, tl, 0, 1.0)
        aparece(mata.lavas, tl, 0.6, 0.6)
        aparece(solo, tl, 0.4, 0.6)
        desenha(tTracos, tl, 0.4, 1.1)
        desenha(fiscal.tracos, tl, 0.7, 1.2)
        aparece(fiscal.lavas, tl, 1.4, 0.5)
        st(colete, 'opacity', r(fase(tl, 1.6, 0.4), 3))
        desenha(ok, tl, M.confirmam, 0.9)
        escreve(t1, tl, M.autuam - 0.1, 0.7)
        escreve(t2, tl, M.autuam + 0.7, 0.6)
        desenha([sub], tl, M.autuam + 1.3, 0.35)
      },
    }
  },

  maquina(m, c) {
    const M = c.marcas
    const q = quadro(m)
    const chao = linhas(q, ['M120 958C400 948 700 964 960 953', F.capim(130, 230, 956, 11, 4)], 5)
    const monte = lava(q, 'M720 956C770 896 860 896 920 956Z', COR.ocre, 0.6)
    const mq = grupo(q)
    const corpo = 'M280 850L280 760L470 760L490 700L600 700L600 850Z'
    const lavas = [lava(mq, corpo, COR.ocre, 0.7), lava(mq, 'M260 850L640 850C670 850 680 880 662 900L242 900C224 880 232 850 260 850Z', COR.caqui, 0.6),
      lava(mq, 'M498 712L590 712L590 780L510 780Z', COR.agua, 0.5), lava(mq, 'M810 750C800 800 820 830 860 830L880 780Z', COR.ocre, 0.7)]
    const rodas = [280, 348, 416, 484, 552, 620].map((x, k) => F.circ(x, 875, 16, 30 + k))
    const tracos = linhas(mq, ['M260 850L640 850C670 850 680 880 662 900L242 900C224 880 232 850 260 850', ...rodas,
      'M280 850L280 760L470 760L490 700L600 700L600 850', 'M498 712L590 712L590 780L510 780Z', 'M350 760L350 720M340 720L360 720',
      'M590 740C670 640 730 600 770 590', 'M600 760C680 670 740 630 780 620', 'M770 590L830 760', 'M780 620L820 740',
      'M810 750C800 800 820 830 860 830L880 780Z', 'M846 830l2 12M860 830l6 12'], 4.5)
    const xis = linhas(q, ['M220 610C450 750 700 870 910 960', 'M890 600C700 740 470 870 240 965'], 22, COR.ferrugem)
    const txt = mao(m, 'Decreto 6.514/2008, art. 111', 540, 360, 62, -2)
    return {
      ancora: [560, 800],
      anim(tl) {
        desenha(chao, tl, 0, 0.5)
        aparece(monte, tl, 0.3, 0.5)
        desenha(tracos, tl, 0.2, 1.6)
        aparece(lavas, tl, 1.0, 0.7)
        escreve(txt, tl, M.lei - 0.1, 0.8)
        // o X riscado com força; a máquina estremece a cada risco
        desenha([xis[0]], tl, M.inutiliza, 0.22)
        desenha([xis[1]], tl, M.inutiliza + 0.42, 0.22)
        const tre = [M.inutiliza + 0.1, M.inutiliza + 0.52].reduce((s, t0) => s + Math.sin(fase(tl, t0, 0.25) * Math.PI * 4) * (1 - fase(tl, t0, 0.25)) * (tl > t0), 0)
        const tr = `translate(${r(tre * 6, 1)} 0)`
        sa(mq.lav, 'transform', tr); sa(mq.tr, 'transform', tr)
      },
    }
  },

  volta(m, c) {
    const M = c.marcas
    const o = mapa(m, { mancha: true, rota: true })
    mapaPronto(o)
    const q = quadro(m)
    const orb = tracejado(q, MAPA.orbita, 3, COR.tinta, '6 14')
    orb.setAttribute('stroke-dashoffset', 0)
    const sat = desenho(q, DES.satelite, 540, 365, 0.62)
    pronto([...sat.tracos, ...sat.lavas])
    const varre = linhas(q, [`M540 400L${P[0] - 40} ${P[1] - 10}`, `M540 400L${P[0] + 40} ${P[1] + 10}`], 3, COR.ferrugem)
    varre.forEach(v => { v.setAttribute('stroke-dasharray', '8 10'); v.setAttribute('stroke-dashoffset', 0) })
    const bri = linhas(q, [F.brilho(640, 320, 26), F.brilho(450, 330, 16)], 4)
    const roda = linha(q, F.roda(P[0], P[1], 108, 82, 1.2), 6, COR.ferrugem)
    const txt = mao(m, 'do espaço ao chão', 540, 1030, 74, -2)
    return {
      alvo: P,
      anim(tl) {
        aparece(varre, tl, M.espaco - 0.2, 0.5)
        desenha(bri, tl, M.espaco, 0.4)
        desenha([roda], tl, M.chao, 0.7)
        escreve(txt, tl, M.espaco - 0.1, 1.4)
      },
    }
  },

  serie(m, c, extra) {
    const M = c.marcas
    const q = quadro(m)
    const g = grupo(q)
    const a = arvore(g)
    const foto = extra.foto
    if (foto) {
      // quadro oficial da série (se houver quadro-oficial.jpg): solto, com borda de papel rasgado
      const k = Math.min(700 / foto.naturalWidth, 420 / foto.naturalHeight)
      const w = foto.naturalWidth * k, h = foto.naturalHeight * k
      const e = el('img', 'foto', m)
      e.src = foto.src
      const rnd = window.D.sorteio(77), pts = []
      for (let i = 0; i < 120; i++) {
        const s = i / 120 * 4, lado = Math.floor(s), f = s - lado, d = (rnd() - 0.5) * 8
        pts.push(lado === 0 ? [f * w, d + 4] : lado === 1 ? [w - 4 + d, f * h] : lado === 2 ? [w - f * w, h - 4 + d] : [d + 4, h - f * h])
      }
      Object.assign(e.style, { width: `${r(w, 1)}px`, height: `${r(h, 1)}px`, left: `${r(540 - w / 2, 1)}px`, top: `${r(520 - h / 2, 1)}px`,
        clipPath: `polygon(${pts.map(([x, y]) => `${r(x, 1)}px ${r(y, 1)}px`).join(',')})` })
      g.foto = e
    }
    const Y = foto ? 140 : 0
    const tf = foto ? 'translate(540 0) scale(0)' : 'translate(540 470) scale(0.42) translate(-540 -830)'
    g.lav.setAttribute('transform', tf); g.tr.setAttribute('transform', tf)
    const t1 = titulo(m, 'Operação', 540, 650 + Y, 124)
    const swash = lava(q, `M170 ${800 + Y}C300 ${752 + Y} 800 ${762 + Y} 910 ${786 + Y}C925 ${846 + Y} 300 ${862 + Y} 168 ${842 + Y}Z`, COR.musgo, 0.55)
    const t2 = titulo(m, 'Guerra Verde', 540, 790 + Y, 150)
    const info = mao(m, '10 episódios · HBO Max', 540, 940 + Y, 72, -1)
    const sub = linha(q, F.onda(300, 990 + Y, 480), 5, COR.ferrugem)
    return {
      anim(tl) {
        if (foto) {
          const qf = saida(fase(tl, 0.2, 0.8))
          st(g.foto, 'opacity', r(lim(qf * 2), 3))
          st(g.foto, 'transform', `translateY(${r((1 - qf) * -120, 1)}px) rotate(${r(mix(-8, -2, qf), 2)}deg) scale(${r(mix(1.15, 1, qf), 3)})`)
        } else {
          desenha(a.tracos, tl, 0.3, 1.2)
          aparece(a.lavas, tl, 0.9, 0.6)
        }
        letras(t1.letras, tl, M.operacao - 0.1, 0.05)
        letras(t2.letras, tl, M.verde - 0.45, 0.05)
        st(swash, 'clipPath', `inset(0 ${r((1 - saida(fase(tl, M.verde - 0.2, 0.8))) * 100, 1)}% 0 0)`)
        aparece(swash, tl, M.verde - 0.2, 0.3)
        escreve(info, tl, M.hbo - 0.5, 0.8)
        desenha([sub], tl, M.hbo + 0.4, 0.4)
      },
    }
  },
}

// ---------- legenda (por blocos curtos, a palavra aparece quando é dita) ----------

// palavras curtas que não fecham bloco: vão para o começo do próximo
const LIGA = new Set(['o', 'a', 'os', 'as', 'de', 'do', 'da', 'e', 'no', 'na', 'ao', 'um', 'uma', 'que', 'se', 'em'])
function legenda(cenas) {
  const raiz = el('div', null, document.getElementById('palco'))
  raiz.id = 'legenda'
  const blocos = []
  for (const c of cenas) {
    let atual = []
    const fecha = () => {
      const solta = []
      while (atual.length > 1 && LIGA.has(atual.at(-1).texto.toLowerCase())) solta.unshift(atual.pop())
      if (atual.length) blocos.push(atual)
      atual = solta
    }
    for (const p of c.palavras) {
      const w = { ...p, inicio: c.ini + p.inicio, fim: c.ini + p.fim }
      const txt = [...atual, w].map(x => x.texto).join(' ')
      if (atual.length && (atual.length >= 4 || txt.length > 22)) fecha()
      atual.push(w)
      if (/[.,?!:…]$/.test(p.texto)) fecha()
    }
    fecha()
  }
  // o bloco fica até a primeira palavra do próximo (ou um pouco depois da última fala); a palavra surge quando é dita
  return blocos.map((ws, k) => {
    const e = el('div', 'bloco', raiz)
    const prox = blocos[k + 1]?.[0].inicio ?? Infinity
    return { e, ini: ws[0].inicio - 0.05, fim: Math.min(ws.at(-1).fim + 0.9, prox - 0.05), spans: ws.map(w => ({ s: el('span', null, e, w.texto), t: w.inicio })) }
  })
}
function desenhaLegenda(blocos, t) {
  for (const b of blocos) {
    const vis = t >= b.ini && t < b.fim
    st(b.e, 'display', vis ? 'block' : 'none')
    if (!vis) continue
    b.spans.forEach(({ s, t: t0 }) => {
      const q = fase(t, t0 - 0.05, 0.14)
      st(s, 'opacity', r(q, 3))
      st(s, 'transform', `translateY(${r((1 - saida(q)) * 10, 1)}px)`)
    })
  }
}

// ---------- montagem e desenho ----------

async function montar() {
  const T = await (await fetch('tempos.json')).json()
  const carrega = src => { const i = new Image(); i.src = src; return i.decode().then(() => i) }
  await Promise.all(['texturas/kraft.jpg', 'texturas/grao.png'].map(carrega))
  const foto = await carrega('quadro-oficial.jpg').catch(() => null)
  await document.fonts.load('100px "Mao"')
  await document.fonts.ready
  const turb = window.D.filtros()

  const palco = document.getElementById('palco')
  const cenas = T.cenas.map((c, k) => {
    const camada = el('div', 'camada', palco)
    camada.style.zIndex = 100 - k
    const camera = el('div', 'camera', camada)
    const mundo = el('div', 'mundo', camera)
    mundo.style.transformOrigin = '540px 760px'
    const s = CENAS[c.id](mundo, c, { foto })
    el('div', 'grao', camada)
    return { ...c, camada, camera, mundo, ...s }
  })
  const rot = el('div', null, palco, T.rotulo)
  rot.id = 'rotulo'
  return { cenas, blocos: legenda(T.cenas), duracao: T.duracao, turb }
}

const K0 = 0.07 // no zoom, o que era a tela inteira vira 7% da cena seguinte
function desenhar(cena, t) {
  CH = []
  const cs = cena.cenas
  cs.forEach((c, k) => {
    const tl = t - c.ini
    const ultima = k === cs.length - 1
    const vis = tl >= 0 && (ultima || tl < c.dur)
    st(c.camada, 'display', vis ? 'block' : 'none')
    if (!vis) return
    c.anim(tl)
    st(c.mundo, 'transform', `scale(${r(1 + 0.025 * suave(fase(tl, 0, c.dur)), 4)})`)
    let cam = 'none', op = 1
    const tr = c.transicao
    const ant = cs[k - 1]
    if (!ultima && tr.dur && tl > c.dur - tr.dur) {
      // saindo
      const p = suave(fase(tl, c.dur - tr.dur, tr.dur))
      if (tr.tipo === 'zoom') {
        const [ax, ay] = c.ancora, [px, py] = cs[k + 1].alvo
        const z = Math.exp(mix(Math.log(1 / K0), 0, p)) * K0
        c.camera.style.transformOrigin = `${ax}px ${ay}px`
        cam = `translate(${px - ax}px,${py - ay}px) scale(${r(z, 4)})`
        op = lim((z - 0.1) / 0.3)
      } else op = 1 - p
    } else if (ant && ant.transicao.tipo === 'zoom' && tl < ant.transicao.dur) {
      // entrando pelo zoom: a câmera começa colada no alvo e se afasta
      const p = suave(fase(tl, 0, ant.transicao.dur))
      const z = Math.exp(mix(Math.log(1 / K0), 0, p))
      c.camera.style.transformOrigin = `${c.alvo[0]}px ${c.alvo[1]}px`
      cam = `scale(${r(z, 4)})`
    }
    st(c.camera, 'transform', cam)
    st(c.camada, 'opacity', r(op, 3))
  })
  desenhaLegenda(cena.blocos, t)
  // o traço "treme" como desenho animado à mão: semente nova 8 vezes por segundo
  const sem = String(1 + Math.floor(t * 8) % 24)
  cena.turb.forEach(f => sa(f, 'seed', sem))
  return CH.join('|')
}

;(async () => {
  const cena = await montar()
  // window.INICIO (modo --quadro do gerar.mjs): um quadro só, a partir desse instante
  const t0 = window.INICIO ?? 0
  window.DURACAO = window.INICIO != null ? 1 / 30 : cena.duracao
  window.seek = t => desenhar(cena, t0 + t)
  window.seek(0)
  window.pronto = true
})()
