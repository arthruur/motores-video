// Unboxing de maquiagem: a capa de pele de onça com a etiqueta rasga e revela a onça desenhada à mão;
// cada produto entra solto, com a borda de papel do recorte, sobre papel rasgado, e a troca de um produto
// para o outro é a folha inteira rasgando (o rasgo começa numa ponta e corre até a outra). No fim, o kit todo.
// Estética do convite de referência: creme, vinho, letra de pincel com contorno, rabisco vinho à mão.
// Contrato do motor (motores/render/CONTRATO.md): a tela é 100% função de t, sem relógio nem estado.
// Os tempos de cada animação são espelhados em som/mixar.py: mudou aqui, muda lá.

const { ONCA, BEIJO, ilustra, rabiscos, R: Rb } = window.D

const lim = x => Math.min(1, Math.max(0, x))
const fase = (t, ini, dur) => lim((t - ini) / dur)
const suave = x => x * x * (3 - 2 * x)
const saida = x => 1 - (1 - x) ** 3                        // easeOutCubic
const volta = x => 1 + 2.2 * (x - 1) ** 3 + 1.2 * (x - 1) ** 2 // easeOutBack, suave
const mix = (a, b, p) => a + (b - a) * p
const r = (x, c = 2) => +x.toFixed(c)

// sorteio com semente (mulberry32): as duas metades de uma folha rasgada são a mesma cena
function sorteio(semente) {
  let a = semente >>> 0
  return () => {
    a = (a + 0x6D2B79F5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), a | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

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
const poligono = pts => `polygon(${pts.map(([x, y]) => `${x.toFixed(1)}px ${y.toFixed(1)}px`).join(',')})`

// ---------- papel rasgado ----------

// pedaço rasgado: a cor e, um pouco maior e com outro serrilhado, o miolo branco do papel
function pedaco(rnd, cx, cy, rx, ry, rot = 0, ru = 0.14, n = 120) {
  const f = Array.from({ length: 4 }, () => rnd() * 6.3)
  const base = Array.from({ length: n }, (_, i) => {
    const a = i / n * 2 * Math.PI
    return [a, 1 + ru * (0.5 * Math.sin(2 * a + f[0]) + 0.35 * Math.sin(3 * a + f[1]) + 0.22 * Math.sin(5 * a + f[2]) + 0.12 * Math.sin(9 * a + f[3]))]
  })
  const forma = (extra, serra) => base.map(([a, w]) => {
    const k = w + (rnd() - 0.5) * serra
    const x = Math.cos(a) * (rx * k + extra()), y = Math.sin(a) * (ry * k + extra())
    return [cx + x * Math.cos(rot) - y * Math.sin(rot), cy + x * Math.sin(rot) + y * Math.cos(rot)]
  })
  return { cor: forma(() => 0, 0.03), miolo: forma(() => 5 + rnd() * 13, 0.02) }
}
function rasgado(pai, rnd, cls, cx, cy, rx, ry, rot) {
  const p = pedaco(rnd, cx, cy, rx, ry, rot)
  const e = el('div', 'rasgado', pai)
  e.style.transformOrigin = `${cx}px ${cy}px`
  el('div', 'miolo', e).style.clipPath = poligono(p.miolo)
  el('div', `cor ${cls}`, e).style.clipPath = poligono(p.cor)
  return e
}

// linha do rasgo que atravessa a tela, em coordenadas (u ao longo, v através), girada por ang
function corte(rnd, cx, cy, ang) {
  const n = 110, U = 1500, f = [rnd() * 6.3, rnd() * 6.3, rnd() * 6.3]
  const c = Math.cos(ang), s = Math.sin(ang)
  const xy = (u, v) => [cx + u * c - v * s, cy + u * s + v * c]
  const linha = Array.from({ length: n }, (_, i) => {
    const q = i / (n - 1)
    return [mix(-U, U, q), 34 * (0.5 * Math.sin(q * 9 + f[0]) + 0.3 * Math.sin(q * 23 + f[1]) + 0.2 * Math.sin(q * 41 + f[2])) + (rnd() - 0.5) * 14]
  })
  const fibra = sinal => linha.map(([u, v]) => [u, v + sinal * (7 + rnd() * 16)])
  const cima = l => poligono([xy(-U, -2600), xy(U, -2600), ...l.slice().reverse().map(([u, v]) => xy(u, v))])
  const baixo = l => poligono([...l.map(([u, v]) => xy(u, v)), xy(U, 2600), xy(-U, 2600)])
  // o rasgo começa na ponta esquerda: as metades giram em torno da ponta direita, que solta por último
  return { a: cima(linha), fa: cima(fibra(1)), b: baixo(linha), fb: baixo(fibra(-1)), normal: [s, -c], pivo: xy(620, 0) }
}

// ---------- texto ----------

const CONTORNO = [...Array.from({ length: 24 }, (_, i) => {
  const a = i / 24 * 2 * Math.PI
  return `${(Math.cos(a) * 10).toFixed(1)}px ${(Math.sin(a) * 10).toFixed(1)}px 0 #8e1029`
}), '0 12px 0 #6a0a1d', '0 18px 24px rgba(60,10,20,.25)'].join(',')
function titulo(pai, txt, top, fs = 140) {
  const e = el('div', 'titulo', pai)
  Object.assign(e.style, { top: `${top}px`, fontSize: `${fs}px`, textShadow: CONTORNO })
  return { e, letras: [...txt].map(ch => el('span', null, e, ch === ' ' ? ' ' : ch)) }
}
function caber(e, larg) {
  let fs = parseFloat(getComputedStyle(e).fontSize)
  while (fs > 50 && e.scrollWidth > larg) e.style.fontSize = `${(fs -= 4)}px`
}
const letras = (ls, tl, t0, passo = 0.06) => ls.forEach((s, j) => {
  const q = fase(tl, t0 + j * passo, 0.5)
  st(s, 'opacity', r(lim(q * 3)))
  st(s, 'transform', `translateY(${r((1 - saida(q)) * 60, 1)}px) scale(${r(mix(0.4, 1, volta(q)), 3)}) rotate(${r((1 - saida(q)) * (j % 2 ? 12 : -12), 1)}deg)`)
})
// escrita à mão: a palavra se revela da esquerda para a direita
const escreve = (e, tl, t0, dur) => st(e, 'clipPath', `inset(-40px ${r((1 - fase(tl, t0, dur)) * 100, 1)}% -40px -40px)`)
const desenha = (linhas, tl, t0, dur) => linhas.forEach((p, k) => {
  const ini = t0 + dur * k / linhas.length, d = Math.max(0.14, dur / linhas.length * 1.6)
  st(p, 'strokeDashoffset', r(1 - suave(fase(tl, ini, d)), 3))
})
// o traço "treme" como desenho animado à mão: semente nova 8 vezes por segundo
const treme = (turb, t) => turb.forEach(f => sa(f, 'seed', String(1 + Math.floor(t * 8) % 24)))

// ilustração desenhada: traços em sequência, depois o giz e os pontos
function desenhaIlustra(o, tl, t0, dur) {
  desenha(o.linhas, tl, t0, dur * 0.75)
  st(o.cheios, 'opacity', r(suave(fase(tl, t0 + dur * 0.55, dur * 0.45)), 3))
  o.pontos.forEach((p, k) => st(p, 'opacity', r(fase(tl, t0 + dur * (0.6 + 0.35 * k / o.pontos.length), 0.12), 3)))
}

// ---------- cenas ----------

function capa(m, C, ini) {
  const rnd = sorteio(31)
  el('div', 'capa', m)
  const g = el('div', 'grupo', m); g.style.transformOrigin = '540px 900px'
  rasgado(g, rnd, 'creme', 540, 900, 390, 260, -0.06)
  const nota = el('div', 'nota', g, C.nota)
  Object.assign(nota.style, { left: '120px', width: '840px', textAlign: 'center', top: '815px', fontSize: '116px', transform: 'rotate(-4deg)' })
  const bj = ilustra(g, BEIJO, 750, 1030, 210, 14)
  const rb = rabiscos(g, [Rb.coracao(300, 1030, 28), Rb.tracos(215, 790, Math.PI * 1.2, 70), Rb.onda(310, 950, 460)])
  return tl => {
    const t = ini + tl
    const q = fase(tl, 0.15, 0.7)
    st(g, 'transform', `translateY(${r((1 - saida(q)) * -900, 1)}px) rotate(${r(mix(-14, 0, saida(q)), 2)}deg) scale(${r(mix(1.25, 1, volta(q)), 3)})`)
    escreve(nota, tl, 0.7, 0.6)
    // beijo carimbado: chega grande e bate no papel
    const qb = fase(tl, 1.15, 0.18)
    st(bj.svg, 'opacity', r(lim(qb * 3)))
    st(bj.svg, 'transform', `rotate(14deg) scale(${r(mix(1.6, 1, suave(qb)), 3)})`)
    desenha(rb.linhas, tl, 1.2, 0.5)
    treme([...rb.turb, ...bj.turb], t)
  }
}

function abertura(m, A, ini) {
  const rnd = sorteio(25)
  const fundo = rasgado(m, rnd, 'vinho', 760, 470, 360, 300, 0.3)
  const retalho = rasgado(m, rnd, 'onca', 830, 1460, 330, 170, -0.16)
  const tit = titulo(m, A.titulo, 270, 165)
  const onca = ilustra(m, ONCA, 530, 820, 740)
  const nota = el('div', 'nota', m, A.nota)
  Object.assign(nota.style, { left: '120px', width: '760px', textAlign: 'center', top: '1150px', fontSize: '86px', transform: 'rotate(-3deg)' })
  const rb = rabiscos(m, [Rb.brilho(170, 640, 40), Rb.brilho(870, 760, 30), Rb.brilho(850, 1080, 20), Rb.tracos(170, 560, Math.PI * 1.2, 70), Rb.onda(300, 1245, 400), Rb.coracao(200, 1420, 30), Rb.brilho(260, 1520, 22)])
  return tl => {
    const t = ini + tl
    const q0 = saida(fase(tl, 0.3, 0.9))
    st(fundo, 'transform', `translate(${r((1 - q0) * 500, 1)}px,${r((1 - q0) * -200, 1)}px) rotate(${r((1 - q0) * 10, 2)}deg)`)
    st(retalho, 'transform', `translate(${r(-(1 - saida(fase(tl, 0.4, 0.9))) * 600, 1)}px,0)`)
    letras(tit.letras, tl, 0.6, 0.07)
    desenhaIlustra(onca, tl, 1.0, 1.8)
    escreve(nota, tl, 2.6, 0.7)
    desenha(rb.linhas, tl, 2.3, 0.9)
    treme([...onca.turb, ...rb.turb], t)
  }
}

const MATERIAL = ['onca', 'vinho']
function produto(m, P, i, img, total, ini) {
  const rnd = sorteio(100 + i * 7)
  const lado = i % 2 ? -1 : 1
  const SX = 500, SY = 740
  const mat = MATERIAL[i % 2], outro = MATERIAL[(i + 1) % 2]
  const fundo = rasgado(m, rnd, mat, SX + lado * 120, 920, 330, 540, lado * 0.1)
  const retalho = rasgado(m, rnd, outro, SX - lado * 230, 1500, 280, 150, -lado * 0.2)
  const etq = rasgado(m, rnd, 'creme', 500, 1218, 270, 44, lado * 0.02)
  // produto solto: cabe em 600×680, com a borda de papel do próprio recorte
  const k = Math.min(600 / img.naturalWidth, 680 / img.naturalHeight)
  const aw = img.naturalWidth * k, ah = img.naturalHeight * k
  const ad = el('img', 'adesivo', m)
  ad.src = img.src
  Object.assign(ad.style, { width: `${r(aw, 1)}px`, height: `${r(ah, 1)}px`, left: `${r(SX - aw / 2, 1)}px`, top: `${r(SY - ah / 2, 1)}px` })
  const giro = lado * (2 + rnd() * 3)

  const nota = el('div', 'nota', m, P.nota)
  const nx = lado > 0 ? 130 : 880
  if (lado > 0) Object.assign(nota.style, { left: '130px', top: '300px', transform: 'rotate(-5deg)', transformOrigin: '0 50%' })
  else Object.assign(nota.style, { right: '200px', top: '300px', transform: 'rotate(4deg)', transformOrigin: '100% 50%' })
  const num = el('div', 'num', m, `nº ${i + 1}`)
  const ux = lado > 0 ? 800 : 200
  Object.assign(num.style, { left: `${ux - 60}px`, top: '296px', width: '120px', textAlign: 'center', transform: `rotate(${lado * 6}deg)` })
  const nome = titulo(m, P.nome, 1000)
  const marca = el('div', 'marca', m, P.marca)
  marca.style.top = '1186px'

  // rabiscos: seta da nota para o produto, roda em volta do número, onda embaixo do nome
  const topo = SY - ah / 2
  const ponta = [SX + (lado > 0 ? -1 : 1) * Math.min(aw / 2 - 30, 120), topo + 40]
  const sx0 = lado > 0 ? 260 : 740
  const caminhos = [Rb.seta(sx0, 395, ponta[0] - lado * 30, ponta[1] - 10, lado * -0.3), Rb.roda(ux, 338, 80, 52), Rb.onda(330, 1176, 340)]
  let enfeite = null
  const ex = SX - lado * 300
  if (P.enfeite === 'onca') enfeite = ilustra(m, ONCA, ex + lado * 20, 880, 330, -lado * 4)
  else if (P.enfeite === 'beijo') enfeite = ilustra(m, BEIJO, ex + lado * 20, 940, 220, -lado * 16)
  else if (P.enfeite === 'flor') caminhos.push(Rb.flor(ex, 900, 34), Rb.flor(ex + lado * 70, 980, 20), Rb.brilho(ex - lado * 40, 820, 22))
  else caminhos.push(Rb.brilho(ex, 880, 46), Rb.brilho(ex + lado * 70, 960, 24), Rb.brilho(ex - lado * 30, 990, 16))
  caminhos.push(Rb.brilho(SX - lado * 330, 1660, 26), Rb.coracao(SX + lado * 300, 1440, 24))
  if (P.brilho) caminhos.push(Rb.brilho(SX + lado * (aw / 2 + 40), topo + 60, 30), Rb.brilho(SX + lado * (aw / 2 + 80), topo + 130, 16))
  const rb = rabiscos(m, caminhos)
  const [seta, roda, onda, ...extras] = rb.linhas

  return tl => {
    const t = ini + tl
    // o papel de trás desliza devagar; a câmera chega um pouco mais perto durante a cena
    const q0 = saida(fase(tl, 0, 1.0))
    st(fundo, 'transform', `translate(${r(lado * (1 - q0) * 560, 1)}px,0) rotate(${r((1 - q0) * lado * 8, 2)}deg)`)
    st(retalho, 'transform', `translate(${r(-lado * (1 - saida(fase(tl, 0.15, 1.0))) * 500, 1)}px,0) rotate(${r((1 - q0) * -lado * 12, 2)}deg)`)
    const qe = saida(fase(tl, 1.5, 0.5))
    st(etq, 'opacity', r(qe)); st(etq, 'transform', `scaleX(${r(mix(0.6, 1, qe), 3)})`)
    st(m, 'transform', `scale(${r(mix(1, 1.035, suave(fase(tl, 0, 4.4))), 4)})`)
    // o produto é pousado: vem de cima, um pouco maior e com sombra longa (no ar), e assenta no papel
    const qa = fase(tl, 0.3, 0.9), e = saida(qa)
    const boia = Math.sin((tl - 1.2) * 1.7) * 4 * fase(tl, 1.0, 0.6)
    st(ad, 'opacity', r(lim(qa * 4)))
    st(ad, 'transform', `translate(${r(lado * (1 - e) * 140, 1)}px,${r(mix(-520, 0, e) + boia, 1)}px) rotate(${r(mix(giro + lado * 14, giro, e) + Math.sin(tl * 1.3) * 0.6, 2)}deg) scale(${r(mix(1.14, 1, e), 4)})`)
    const alto = 1 - e
    st(ad, 'filter', `drop-shadow(${r(lado * -10 * alto, 1)}px ${r(12 + 40 * alto, 1)}px ${r(12 + 30 * alto, 1)}px rgba(40,14,10,${r(0.3 - 0.12 * alto, 3)}))`)
    st(num, 'opacity', r(fase(tl, 1.0, 0.3)))
    letras(nome.letras, tl, 1.05, 0.07)
    const qm = saida(fase(tl, 1.6, 0.5))
    st(marca, 'opacity', r(qm)); st(marca, 'transform', `translateY(${r((1 - qm) * 24, 1)}px)`)
    escreve(nota, tl, 1.3, 0.7)
    desenha([roda], tl, 1.05, 0.45)
    desenha([onda], tl, 1.75, 0.35)
    desenha([seta], tl, 1.95, 0.4)
    desenha(extras, tl, 2.2, 0.6)
    if (enfeite) {
      if (P.enfeite === 'onca') desenhaIlustra(enfeite, tl, 2.0, 1.1)
      else {
        const qb = fase(tl, 2.1, 0.18)
        st(enfeite.svg, 'opacity', r(lim(qb * 3)))
        st(enfeite.svg, 'transform', `rotate(${-lado * 16}deg) scale(${r(mix(1.6, 1, suave(qb)), 3)})`)
      }
      treme(enfeite.turb, t)
    }
    treme(rb.turb, t)
  }
}

function final(m, F, imgs, ini) {
  const rnd = sorteio(2026)
  const faixa = rasgado(m, rnd, 'onca', 540, 890, 700, 350, -0.1)
  const retalho = rasgado(m, rnd, 'vinho', 930, 300, 220, 130, 0.2)
  const tit = titulo(m, F.titulo, 262, 165)
  const nota = el('div', 'nota', m, F.nota)
  Object.assign(nota.style, { left: '120px', width: '760px', textAlign: 'center', top: '440px', fontSize: '74px', transform: 'rotate(-3deg)' })
  // colagem 4 + 3 + 3, cada produto cabe em 190×200, com giro sorteado
  const pos = [[225, 680], [405, 670], [590, 685], [770, 675], [300, 880], [500, 870], [700, 885], [300, 1070], [500, 1060], [700, 1075]]
  const ads = imgs.map((img, i) => {
    const k = Math.min(190 / img.naturalWidth, 200 / img.naturalHeight)
    const w = img.naturalWidth * k, h = img.naturalHeight * k
    const e = el('img', 'adesivo', m)
    e.src = img.src
    const [x, y] = pos[i]
    Object.assign(e.style, { width: `${r(w, 1)}px`, height: `${r(h, 1)}px`, left: `${r(x - w / 2, 1)}px`, top: `${r(y - h / 2, 1)}px`,
      filter: 'drop-shadow(0 10px 10px rgba(40,14,10,.28))' })
    return { e, rot: (rnd() - 0.5) * 20 }
  })
  const onca = ilustra(m, ONCA, 540, 1330, 380)
  const tira = rasgado(m, rnd, 'creme', 540, 1730, 820, 260, 0.02)
  const rb = rabiscos(m, [Rb.brilho(160, 330, 36), Rb.brilho(215, 410, 18), Rb.coracao(820, 520, 26), Rb.brilho(870, 1250, 30), Rb.flor(200, 1260, 30)])
  return tl => {
    const t = ini + tl
    const q0 = saida(fase(tl, 0, 1.0))
    st(faixa, 'transform', `translate(${r(-(1 - q0) * 900, 1)}px,0) rotate(${r((1 - q0) * -6, 2)}deg)`)
    st(retalho, 'transform', `translate(${r((1 - saida(fase(tl, 0.2, 0.9))) * 500, 1)}px,0)`)
    st(tira, 'transform', `translateY(${r((1 - saida(fase(tl, 0.1, 0.9))) * 400, 1)}px)`)
    letras(tit.letras, tl, 0.5, 0.08)
    escreve(nota, tl, 1.0, 0.6)
    ads.forEach((a, i) => {
      const q = fase(tl, 0.9 + i * 0.22, 0.5)
      st(a.e, 'opacity', r(lim(q * 4)))
      st(a.e, 'transform', `translateY(${r((1 - saida(q)) * -120, 1)}px) scale(${r(mix(1.5, 1, saida(q)), 3)}) rotate(${r(mix(a.rot * 2.5, a.rot, saida(q)) + Math.sin(tl * 1.5 + i) * 1.2 * q, 2)}deg)`)
    })
    desenhaIlustra(onca, tl, 3.2, 1.3)
    desenha(rb.linhas, tl, 3.6, 0.8)
    treme([...onca.turb, ...rb.turb], t)
  }
}

// ---------- montagem e desenho ----------

async function montar() {
  const D = await (await fetch('produtos.json')).json()
  const T = D.tempos
  const carrega = src => { const i = new Image(); i.src = src; return i.decode().then(() => i) }
  const imgs = await Promise.all(D.produtos.map(p => carrega(`recortes/${p.foto}.png`)))
  await Promise.all(['texturas/onca.jpg', 'texturas/vinho.jpg', 'texturas/papel.jpg', 'texturas/grao.png'].map(carrega))
  await document.fonts.load('100px "Titulo"')
  await document.fonts.load('100px "Mao"')
  await document.fonts.ready

  const palco = document.getElementById('palco')
  const roteiro = [
    { dur: T.capa, faz: (m, ini) => capa(m, D.capa, ini), ang: 0.07, cy: 900 },
    { dur: T.abertura, faz: (m, ini) => abertura(m, D.abertura, ini), ang: Math.PI / 2 + 0.05, cy: 960 },
    ...D.produtos.map((p, i) => ({ dur: T.produto, faz: (m, ini) => produto(m, p, i, imgs[i], D.produtos.length, ini),
      ang: (i % 2 ? -1 : 1) * (0.07 + 0.05 * (i % 3)), cy: 880 + (i % 3) * 90 })),
    { dur: T.final, faz: (m, ini) => final(m, D.final, imgs, ini) },
  ]
  let ini = 0
  const cenas = roteiro.map((c, k) => {
    const ultima = k === roteiro.length - 1
    // duas cópias idênticas da cena: inteira, uma basta; no rasgo, cada uma vira uma metade
    const copia = () => {
      const peca = el('div', 'peca', palco)
      peca.style.zIndex = 100 - k
      const fibra = el('div', 'fibra', peca)
      const cena = el('div', 'cena', peca)
      const mundo = el('div', 'mundo', cena)
      const anim = c.faz(mundo, ini)
      el('div', 'grao', mundo)
      return { peca, fibra, cena, anim }
    }
    const o = { ini, dur: c.dur, ultima, copias: ultima ? [copia()] : [copia(), copia()] }
    if (!ultima) o.corte = corte(sorteio(500 + k), 540, c.cy, c.ang)
    ini += c.dur - (ultima ? 0 : T.rasgo)
    return o
  })
  document.querySelectorAll('.titulo').forEach(e => caber(e, 760))
  await Promise.all([...document.images].map(i => i.decode()))
  return { cenas, duracao: ini, rasgo: T.rasgo }
}

function desenhar(cena, t) {
  CH = []
  const RASGO = cena.rasgo
  for (const c of cena.cenas) {
    const tl = t - c.ini
    const vis = t >= c.ini && (c.ultima || tl < c.dur)
    const [A, B] = c.copias
    st(A.peca, 'display', vis ? 'block' : 'none')
    if (B) st(B.peca, 'display', 'none')
    if (!vis) continue
    A.anim(tl)
    const p = c.ultima ? 0 : fase(tl, c.dur - RASGO, RASGO)
    if (p <= 0) {
      st(A.cena, 'clipPath', 'none'); st(A.fibra, 'display', 'none'); st(A.peca, 'transform', 'none'); st(A.peca, 'filter', 'none')
      continue
    }
    // rasgo: primeiro abre em cunha a partir da ponta esquerda (giro em torno da ponta direita),
    // depois as metades se soltam e saem pela normal da linha
    B.anim(tl)
    const K = c.corte, [nx, ny] = K.normal
    const abre = suave(fase(p, 0, 0.5)), sai = fase(p, 0.35, 0.65) ** 2
    const metade = (X, clip, cfib, sinal) => {
      st(X.peca, 'display', 'block')
      st(X.cena, 'clipPath', clip); st(X.fibra, 'clipPath', cfib); st(X.fibra, 'display', 'block')
      X.peca.style.transformOrigin = `${r(K.pivo[0], 1)}px ${r(K.pivo[1], 1)}px`
      const d = sai * 1700
      st(X.peca, 'transform', `translate(${r(sinal * nx * d, 1)}px,${r(sinal * ny * d, 1)}px) rotate(${r(sinal * (abre * 6 + sai * 14), 2)}deg)`)
      st(X.peca, 'filter', 'drop-shadow(0 14px 18px rgba(50,14,10,.35))')
    }
    metade(A, K.a, K.fa, 1)
    metade(B, K.b, K.fb, -1)
  }
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
