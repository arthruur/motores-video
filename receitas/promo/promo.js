// Coreografia dos promos do Bistrô 153 (cada peça é uma ficha em pecas.json; window.PECA diz qual).
// A: retrato na renda + título carimbado · cortina de azulejos ·
// B: o pote preso com fita e anotado à mão (ou, na "linha", os cinco potes com nome) ·
// estrela que cresce · C: monograma, chamada e prateleira.
// Os tempos daqui são espelhados em som/mixar.py: mudou aqui, muda lá.
const { passo, fase, mix, quadros, CARIMBO, CAI, tremor, pos, escreve, traca, ferve, r } = K

const DUR_B = { produto: 4.35, linha: 6.2 }
function tempos(tipo) {
  const B = 5.2, C = B + DUR_B[tipo]
  return { cortina: 4.75, cortina_sai: 5.35, B, estrela: C - 0.55, C, FIM: C + 3.45 }
}
window.TEMPOS = tempos

const h = (html) => { const d = document.createElement('div'); d.innerHTML = html.trim(); return d.firstChild }
const $ = (s) => document.querySelector(s)

function letras(e, linhas) {
  const ls = []
  linhas.forEach((l, i) => {
    if (i) e.appendChild(document.createElement('br'))
    ;[...l].forEach(ch => {
      const s = document.createElement('span'); s.className = 'letra'; s.textContent = ch === ' ' ? ' ' : ch
      e.appendChild(s); if (ch !== ' ') ls.push(s)
    })
  })
  return ls
}
function faixa(pai, y) {
  return Array.from({ length: 6 }, (_, i) => {
    const a = document.createElement('div'); a.className = 'azulejo'
    a.style.left = `${i * 180}px`; a.style.top = `${y}px`; pai.appendChild(a); return a
  })
}
// texto que não cabe encolhe (títulos longos como "Geleia de Manga com Maracujá")
function caber(e, larg) {
  let fs = parseFloat(getComputedStyle(e).fontSize)
  while (fs > 60 && e.scrollWidth > larg) e.style.fontSize = `${(fs -= 4)}px`
}

let P, M, T, cena
async function montar() {
  const dados = await (await fetch('pecas.json')).json()
  P = dados.pecas[window.PECA]; M = dados.marca
  P.tipo = P.tipo || 'produto'
  T = tempos(P.tipo)
  const raiz = document.documentElement.style
  raiz.setProperty('--cor', P.cor); raiz.setProperty('--fundo', P.fundo); raiz.setProperty('--tinta', P.tinta)
  if (P.tinta !== '#fffdea') document.body.classList.add('fundo-claro')
  K.filtros()

  const palco = $('#palco')
  palco.innerHTML = `
  <div class="cena" id="a">
    <div class="papel"></div>
    <div class="abs mao" id="a-assina"></div>
    <div class="abs titulo" id="a-titulo"></div>
    <div class="abs mao" id="a-sub"></div>
    <div class="abs" id="a-oval">
      <div class="foto"><img src="../motion/fotos/${P.retrato}.jpg" style="object-position:${P.retrato_pos}" alt=""></div>
      <img class="renda" src="marca/renda.svg" alt="">
    </div>
    <div class="abs" id="a-estrela"><img src="marca/estrela.svg" alt=""><div class="mao">artesanal</div></div>
  </div>
  <div class="cena" id="b">
    <div class="papel escuro"></div>
    ${P.deco === 'azulejo' ? '<div class="abs azulejo-deco" id="b-deco"></div>' : '<img class="abs" id="b-deco" src="marca/xadrez.svg" alt="">'}
    <img class="abs" id="b-ondas" src="marca/ondas.png" alt="">
    <svg class="abs" id="b-tracos" viewBox="0 0 1080 1920">
      <path id="s1" pathLength="1" d="M420 440 C 470 500, 440 560, 360 590 M 360 590 l 28 -40 M 360 590 l 46 10"/>
      <path id="s2" pathLength="1" d="M280 1380 C 200 1320, 190 1250, 230 1200 M 230 1200 l -42 10 M 230 1200 l -4 42"/>
      <path id="s3" pathLength="1" d="M305 1450 C 440 1436, 620 1456, 800 1438"/>
      <path class="brilho" id="b1" pathLength="1" d="M820 560 l 0 -56 M 792 532 l 56 0 M 802 514 l 36 36 M 838 514 l -36 36"/>
      <path class="brilho" id="b2" pathLength="1" d="M150 860 l 0 -44 M 128 838 l 44 0"/>
      <path class="brilho" id="b3" pathLength="1" d="M860 1150 l 0 -44 M 838 1128 l 44 0"/>
    </svg>
  </div>
  <div class="cena" id="c">
    <div class="papel"></div>
    <div class="abs" id="c-logo"><img src="marca/logo.svg" alt="Bistrô 153"></div>
    <div class="abs mao" id="c-assina"></div>
    <div class="abs titulo" id="c-chamada"></div>
    <div class="abs texto" id="c-contato"></div>
    <div id="c-prateleira"></div>
  </div>
  <div class="abs" id="estrelao"><img src="marca/estrela.svg" alt=""></div>
  <div class="grao"></div>
  <div class="vinheta"></div>`
  $('#a-assina').textContent = P.assina_a || M.assina
  $('#c-assina').textContent = M.assina
  $('#c-contato').textContent = M.contato
  $('#a-sub').textContent = P.subtitulo || ''
  if (P.aviso) $('#c').appendChild(h(`<div class="abs texto" id="c-aviso"></div>`)).textContent = P.aviso

  cena = {
    a: $('#a'), b: $('#b'), c: $('#c'),
    aTopo: faixa($('#a'), -70), aBase: faixa($('#a'), 1810),
    cTopo: faixa($('#c'), -70), cBase: faixa($('#c'), 1810),
    aTitulo: letras($('#a-titulo'), P.titulo),
    cChamada: letras($('#c-chamada'), [M.chamada]),
    cortina: K.cortina(palco, 'marca/azulejo-mostarda.png'),
    tracos: ['s1', 's2', 's3', 'b1', 'b2', 'b3'].map(id => document.getElementById(id)),
    potesC: [],
  }

  const b = $('#b')
  if (P.tipo === 'produto') {
    const rc = P.recorte_css
    b.insertBefore(h(`<div class="abs recorte" id="b-pote" ${rc ? `style="left:${rc.left}px;top:${rc.top}px;width:${rc.width}px"` : ''}><img src="recortes/${P.recorte}.png" alt=""></div>`), $('#b-tracos'))
    cena.fitas = (P.fitas || [{ x: 255, y: 560, rot: -34, w: 250 }, { x: 745, y: 575, rot: 30, w: 250 }]).map(f => K.fita(b, f))
    P.notas.forEach((n, i) => {
      const e = b.appendChild(h(`<div class="abs mao nota" id="b-n${i + 1}"></div>`)); e.textContent = n
      const c = P.notas_css?.[i]; if (c) { e.style.left = `${c.left}px`; e.style.top = `${c.top}px` }
    })
    ;(P.setas || []).forEach((d, i) => { if (d) cena.tracos[i].setAttribute('d', d); else cena.tracos[i].style.display = 'none' })
    cena.rabiscos = (P.rabiscos || []).map(d => {
      const p = document.createElementNS('http://www.w3.org/2000/svg', 'path')
      p.setAttribute('d', d); p.setAttribute('pathLength', '1'); $('#b-tracos').appendChild(p); return p
    })
    if (cena.rabiscos.length) cena.tracos.slice(3, 5).forEach(p => p.style.display = 'none')   // brilhos que cairiam nos rabiscos
    // prateleira do fim: os cinco potes
    cena.potesC = ['6903', '6906', '6904', '6905', '6908'].map((f, i) => {
      const d = h(`<div class="abs recorte" style="left:${30 + i * 205}px"><img src="recortes/${f}.png" alt=""></div>`)
      $('#c-prateleira').appendChild(d); return d
    })
  } else {
    // linha: 3 em cima, 2 embaixo, cada um com o nome escrito à mão
    cena.potesB = P.potes.map((p, i) => {
      const pote = h(`<div class="abs recorte pote-linha" style="left:${p.x - p.w / 2}px;top:${p.top}px;width:${p.w}px"><img src="recortes/${p.recorte}.png" alt=""></div>`)
      const nome = h(`<div class="abs mao rotulo-linha" style="left:${p.x - 220}px"></div>`)
      nome.textContent = p.nome
      b.insertBefore(pote, $('#b-tracos')); b.appendChild(nome)
      return { pote, nome, rot: [-5, 3, -2, 4, -4, 2, -3, 1][i % 8] }
    })
    cena.tracos.slice(0, 4).forEach(p => p.style.display = 'none')   // setas são do produto; o brilho grande cairia num pote
  }

  await document.fonts.load('900 100px Titulo'); await document.fonts.load('40px Mao'); await document.fonts.load('700 40px Raleway')
  await document.fonts.ready
  if (P.titulo_tam) {      // título de uma palavra: maior, e o subtítulo desce junto
    $('#a-titulo').style.fontSize = `${P.titulo_tam}px`
    $('#a-sub').style.top = `${392 + P.titulo_tam * 0.92 * P.titulo.length + 14}px`
  }
  caber($('#a-titulo'), 960); caber($('#c-chamada'), 900)
  await Promise.all([...document.images].map(i => i.decode()))
  ;(cena.potesB || []).forEach(({ pote, nome }) => { nome.style.top = `${pote.offsetTop + pote.offsetHeight + 6}px` })
}

function azulejos(lista, t, ini, id0) {
  return lista.map((a, i) => {
    const s = quadros(t, ini + i * 0.07, [0.3, 1.12, 0.96, 1]) ?? 0
    return pos(a, { s, rot: (1 - s) * 30, tremor: tremor(id0 + i, t, 0.6) })
  }).join()
}
const carimbar = (e, t, ini, id, extra = {}) => {
  const v = quadros(t, ini, CARIMBO)
  return pos(e, { s: v ?? 0, o: v == null ? 0 : 1, tremor: tremor(id, t, 0.5), ...extra(v) })
}

function cenaB_produto(t, tb) {
  pos($('#b-deco'), { x: (quadros(tb, 0.45, [-260, -60, 12, 0]) ?? -400), rot: -14, tremor: tremor(100, t, 0.6) })
  const y = quadros(tb, 0.65, CAI)
  pos($('#b-pote'), { y: y == null ? -2000 : y * 1300, rot: -4 + (y == null ? 0 : y * 10), tremor: tremor(102, t, 0.7) })
  cena.fitas.forEach((f, i) => {
    const s = quadros(tb, 1.15 + i * 0.17, [1.3, 0.96, 1])
    pos(f, { s: s ?? 0, o: s == null ? 0 : 1, rot: +f.dataset.rot, tremor: tremor(110 + i, t, 0.4) })
  })
  const n1 = $('#b-n1'), n2 = $('#b-n2')
  escreve(n1, tb, 1.15, 0.7); pos(n1, { rot: -6, tremor: tremor(120, t, 0.5) })
  escreve(n2, tb, 1.95, 0.9); pos(n2, { rot: -3, tremor: tremor(121, t, 0.5) })
  const [s1, s2, s3] = cena.tracos
  traca(s1, tb, 1.75, 0.42); traca(s2, tb, 2.75, 0.42); traca(s3, tb, 2.9, 0.35)
  cena.rabiscos.forEach((p, i) => traca(p, tb, 1.3 + i * 0.45, 0.6))
  n1.style.filter = n2.style.filter = ferve(t + 1 / 12)
  brilhos(tb, 1.6)
}

function cenaB_linha(t, tb) {
  pos($('#b-deco'), { x: (quadros(tb, 0.3, [-260, -60, 12, 0]) ?? -400), rot: -14, tremor: tremor(100, t, 0.6) })
  cena.potesB.forEach(({ pote, nome, rot }, i) => {
    const ini = 0.5 + i * (cena.potesB.length > 6 ? 0.42 : 0.55)
    const y = quadros(tb, ini, CAI)
    pos(pote, { y: y == null ? -2000 : y * 1100, rot: rot + (y ?? 0) * 12, tremor: tremor(300 + i, t, 0.7) })
    escreve(nome, tb, ini + 0.4, 0.55); pos(nome, { rot: rot * 0.6, tremor: tremor(320 + i, t, 0.5) })
    nome.style.filter = ferve(t + i / 12)
  })
  if (cena.potesB.length <= 6) brilhos(tb, 3.6)
}

function brilhos(tb, ini) {
  cena.tracos.slice(3).forEach((b, i) => {
    const c = tb - ini - i * 0.33
    b.style.strokeDashoffset = c < 0 ? 1 : r(1 - Math.min(1, (c % 1.2) * 4), 3)
    b.style.visibility = c >= 0 && (c % 1.2) < 0.85 ? 'visible' : 'hidden'
  })
  $('#b-tracos').style.filter = ferve(tb)
}

function desenhar(tReal) {
  const t = passo(tReal)              // stop-motion: 12 passos por segundo
  const vis = (e, a, b) => { const v = t >= a && t < b; e.style.display = v ? 'block' : 'none'; return v }

  if (vis(cena.a, 0, T.B)) {
    azulejos(cena.aTopo, t, 0.0, 1); azulejos(cena.aBase, t, 0.15, 20)
    const as = $('#a-assina'); escreve(as, t, 0.35, 1.0); pos(as, { tremor: tremor(40, t, 0.5) })
    cena.aTitulo.forEach((s, i) => {
      const v = quadros(t, 0.9 + i * 0.075, CARIMBO)
      pos(s, { s: v ?? 0, o: v == null ? 0 : 1, y: v == null ? 0 : (1 - v) * -40, rot: (K.hash(i, 3) - 0.5) * 6 * (v == null ? 1 : Math.abs(1 - v) * 4), tremor: tremor(60 + i, t, 0.35) })
    })
    $('#a-titulo').style.filter = ferve(t)
    const sb = $('#a-sub'); escreve(sb, t, 0.9 + cena.aTitulo.length * 0.075 + 0.25, 1.1); pos(sb, { rot: -2, tremor: tremor(45, t, 0.5) })
    carimbar($('#a-oval'), t, 1.75, 80, v => ({ rot: v == null ? 0 : mix(-9, -2.5, Math.min(1, (t - 1.75) * 2.4)) }))
    $('#a-oval .foto img').style.transform = `scale(${r(mix(1.22, 1.04, K.suave(fase(t, 1.75, 3.4))), 3)})`
    const es = quadros(t, 2.55, [0.3, 1.25, 0.9, 1.05, 1])
    pos($('#a-estrela'), { s: es ?? 0, o: es == null ? 0 : 1, rot: 8 + (es == null ? 0 : Math.floor((t - 2.55) * 12) * 1.5), tremor: tremor(90, t, 0.6) })
  }

  cena.cortina(t, T.cortina, T.cortina_sai)

  if (vis(cena.b, T.B, T.C)) {
    const tb = t - T.B
    pos($('#b-ondas'), { x: (quadros(tb, 0.55, [300, 80, -10, 0]) ?? 500), tremor: tremor(101, t, 0.6) })
    if (P.tipo === 'produto') cenaB_produto(t, tb); else cenaB_linha(t, tb)
  }

  const ee = $('#estrelao')
  const dentro = quadros(t, T.estrela, [0.1, 0.35, 0.8, 1.6, 3.2, 5.5])
  const fora = quadros(t, T.C + 0.05, [4.5, 2.6, 1.2, 0.5, 0.15, 0])
  const se = fora != null ? fora : (dentro ?? 0)
  ee.style.display = se > 0 ? 'block' : 'none'
  pos(ee, { s: se, rot: Math.floor((t - T.estrela) * 12) * 9 })

  if (vis(cena.c, T.C, T.FIM + 1)) {
    const tc = t - T.C
    azulejos(cena.cTopo, tc, 0.2, 200); azulejos(cena.cBase, tc, 0.3, 220)
    carimbar($('#c-logo'), tc, 0.3, 230, () => ({ rot: -3 }))
    const as = $('#c-assina'); escreve(as, tc, 0.85, 1.0); pos(as, { tremor: tremor(231, t, 0.5) })
    cena.cChamada.forEach((s, i) => {
      const v = quadros(tc, 1.55 + i * 0.07, CARIMBO)
      pos(s, { s: v ?? 0, o: v == null ? 0 : 1, y: v == null ? 0 : (1 - v) * -40, tremor: tremor(240 + i, t, 0.35) })
    })
    $('#c-chamada').style.filter = ferve(t)
    cena.potesC.forEach((d, i) => {
      const y = quadros(tc, 2.0 + i * 0.12, CAI)
      pos(d, { y: y == null ? 900 : -y * 500, rot: (i - 2) * 3 + (y ?? 0) * 12, o: y == null ? 0 : 1, tremor: tremor(270 + i, t, 0.6) })
    })
    const ct = quadros(tc, 2.45, [0.4, 1])
    pos($('#c-contato'), { o: ct ?? 0, y: ct == null ? 20 : (1 - ct) * 20, tremor: tremor(260, t, 0.4) })
    if (P.aviso) pos($('#c-aviso'), { o: ct ?? 0 })
  }

  const g = Math.floor(t * 12) % 4
  $('.grao').style.transform = `translate(${[0, -23, 17, -9][g]}px,${[0, 13, -19, 21][g]}px)`
  return t.toFixed(4)                 // a tela só muda a cada passo: a chave é o passo
}

;(async () => {
  await montar()
  window.DURACAO = T.FIM
  window.seek = desenhar
  desenhar(0)
  window.pronto = true
})()
