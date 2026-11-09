// Episódio "O Mapa da Fome" (9:16, ~66 s): formato explicativo em três lugares.
//   mapa (vetor, malha do IBGE em mapa.js) · canavial (fundos/canavial.png) · sertão (fundos/sertao.png)
// O Mangaio viaja de um lugar a outro; o narrador conta. Contrato do motor: tudo é função de t.
// Dados: linha.json (som.py), roteiro.json (rótulos). Personagem atua "em dois" (15/s); o resto a 30/s.

// ---------------------------------------------------------------- utilidades
const cl = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v))
const lerp = (a, b, u) => a + (b - a) * u
const suave = u => { u = cl(u); return u * u * (3 - 2 * u) }
const faixa = (t, a, b) => cl((t - a) / (b - a))
const mola = (dt, f, am) => dt < 0 ? 0 : Math.exp(-am * dt) * Math.cos(2 * Math.PI * f * dt)
const voltaBack = u => { u = cl(u); const c = 1.7; return 1 + (c + 1) * (u - 1) ** 3 + c * (u - 1) ** 2 }
const r = (v, d = 1) => Number(v.toFixed(d))
const dentro = (t, a, b) => t >= a && t < b
const piscar = (t, t0, d = 0.32) => { const u = faixa(t, t0, t0 + d); return u > 0 && u < 1 ? Math.sin(Math.PI * u) : 0 }
const entra = (t, t0, d = 0.38) => t < t0 ? 0 : voltaBack(faixa(t, t0, t0 + d))
const sai = (t, t1, d = 0.25) => 1 - suave(faixa(t, t1, t1 + d))
const vida = (t, t0, t1, d0 = 0.38, d1 = 0.25) => t < t0 || t > t1 + d1 ? 0 : entra(t, t0, d0) * sai(t, t1, d1)
const mistura = (c1, c2, u) => {
  const a = [1, 3, 5].map(i => parseInt(c1.slice(i, i + 2), 16)), b = [1, 3, 5].map(i => parseInt(c2.slice(i, i + 2), 16))
  return '#' + a.map((x, i) => Math.round(lerp(x, b[i], cl(u))).toString(16).padStart(2, '0')).join('')
}
const rng = s => () => { s = (s * 16807) % 2147483647; return s / 2147483647 }
const $ = s => document.querySelector(s)
const NS = 'http://www.w3.org/2000/svg'
const mostra = (el, sim) => { const v = sim ? '' : 'none'; if (el.style.display !== v) el.style.display = v }
function G(pai, svg) { const g = document.createElementNS(NS, 'g'); g.innerHTML = svg; $(pai).appendChild(g); return g }
const tr = (el, x, y, s = 1, rot = 0, sy = null) =>
  el.setAttribute('transform', `translate(${r(x)} ${r(y)}) rotate(${r(rot, 2)}) scale(${r(s, 3)} ${r(sy ?? s, 3)})`)

const C = {
  tinta: '#462416', creme: '#F7E8C6', branco: '#FFF8EA',
  neutro: '#C29A62', neutro2: '#D6B886',
  area: { amazonia: '#50812F', mata: '#82AB58', sertao: '#E99C46', centro: '#B9874F', sul: '#7FB5BC' },
  madeira: ['#B57A48', '#9A6238', '#83512E', '#6A4125'], folha: ['#669630', '#50812F', '#3F6925', '#2B5627'],
  agua: ['#A9D3D6', '#7FB5BC', '#5A8E98'], vermelho: ['#E8573A', '#CF3B27', '#B52F20'],
  milho: ['#FFD15A', '#F7B733', '#E59A28'], castanha: ['#A88A6A', '#8A6C4E', '#73583E', '#5C4430'],
  algodao: ['#F6E6C0', '#EBD3A0', '#DDBE85', '#C6A06A'],
}

// ---------------------------------------------------------------- quadro
const CHAO = 1110
const MAPA_X = 190, MAPA_Y = 400
let L = null, R = null, DUR = 66
const B = id => L.beats[id]
const Wt = (id, k) => { const w = B(id).w; return w[k < 0 ? w.length + k : k][1] }
const We = (id, k) => { const w = B(id).w; return w[k < 0 ? w.length + k : k][2] }
function lugarEm(t) { let l = L.lugares[0]; for (const x of L.lugares) if (t >= x.ini) l = x; return l }
// opacidade de um lugar com uma troca curta (0,3 s)
function opLugar(t, nome) {
  let o = 0
  for (const x of L.lugares) if (x.lugar === nome) o = Math.max(o, faixa(t, x.ini - 0.01, x.ini + 0.3) * (1 - faixa(t, x.fim, x.fim + 0.3)))
  return o
}

// ---------------------------------------------------------------- peças
const LIVRO = `<rect x="-120" y="-160" width="240" height="320" rx="10" fill="${C.vermelho[2]}"/>
  <rect x="-120" y="-160" width="30" height="320" rx="8" fill="#93261B"/>
  <rect x="-80" y="-120" width="180" height="150" rx="8" fill="${C.creme}"/>
  <text x="10" y="-62" text-anchor="middle" font-family="Caveat Brush" font-size="44" fill="${C.tinta}">Geografia</text>
  <text x="10" y="-14" text-anchor="middle" font-family="Caveat Brush" font-size="44" fill="${C.tinta}">da Fome</text>
  <text x="10" y="90" text-anchor="middle" font-family="Caveat Brush" font-size="30" fill="${C.creme}">Josué de Castro</text>
  <text x="10" y="126" text-anchor="middle" font-family="Caveat Brush" font-size="28" fill="${C.creme}">1946</text>`
const XIS = `<rect x="-70" y="-11" width="140" height="22" rx="11" fill="${C.vermelho[1]}" transform="rotate(45)"/>
  <rect x="-70" y="-11" width="140" height="22" rx="11" fill="${C.vermelho[1]}" transform="rotate(-45)"/>`
const CERCA = (larg, alt) => {
  let s = `<rect x="${-larg / 2}" y="${-alt * 0.7}" width="${larg}" height="7" fill="${C.madeira[3]}"/><rect x="${-larg / 2}" y="${-alt * 0.35}" width="${larg}" height="7" fill="${C.madeira[3]}"/>`
  for (let x = -larg / 2; x <= larg / 2; x += 70) s += `<rect x="${x - 6}" y="${-alt}" width="12" height="${alt}" rx="4" fill="${C.madeira[2]}"/>`
  return s
}
const FEIJAO = `<path d="M-3 0V-70H3V0Z" fill="${C.folha[2]}"/>
  <ellipse cx="-20" cy="-60" rx="20" ry="10" fill="${C.folha[0]}" transform="rotate(-30 -20 -60)"/>
  <ellipse cx="20" cy="-46" rx="20" ry="10" fill="${C.folha[1]}" transform="rotate(30 20 -46)"/>`
const CANA = `${[0, 1, 2, 3, 4].map(i => `<rect x="-10" y="${-80 * (i + 1)}" width="20" height="76" rx="6" fill="${i % 2 ? '#82AB58' : '#9CC46E'}"/>`).join('')}
  <path d="M0 -380C-60 -420 -110 -400 -150 -360C-100 -390 -50 -390 0 -370Z" fill="${C.folha[0]}"/>
  <path d="M0 -300C60 -350 120 -340 160 -300C110 -320 50 -310 0 -290Z" fill="${C.folha[1]}"/>
  <path d="M0 -400C20 -460 10 -500 -10 -530C20 -500 30 -460 6 -400Z" fill="${C.folha[0]}"/>`
const MILHO = `<ellipse rx="24" ry="52" fill="${C.milho[1]}"/>${[-30, -10, 10, 30].map(y => `<rect x="-20" y="${y - 3}" width="40" height="6" rx="3" fill="${C.milho[2]}"/>`).join('')}
  <path d="M-26 10C-40 40 -20 70 0 70C-10 50 -14 30 -26 10Z" fill="${C.folha[1]}"/><path d="M26 10C40 40 20 70 0 70C10 50 14 30 26 10Z" fill="${C.folha[0]}"/>`
const TIGELA = `<path d="M-50 -10C-50 26 -24 34 0 34C24 34 50 26 50 -10Z" fill="${C.madeira[1]}"/><ellipse cy="-10" rx="50" ry="10" fill="${C.madeira[0]}"/>
  ${[-26, -10, 6, 22, -18, 0, 16].map((x, i) => `<ellipse cx="${x}" cy="${-14 - (i > 3 ? 8 : 0)}" rx="8" ry="6" fill="${i % 2 ? '#6C321A' : '#8F4523'}"/>`).join('')}`
const LEITE = `<path d="M-30 30V-30C-30 -44 -18 -50 -18 -60H18C18 -50 30 -44 30 -30V30C30 40 -30 40 -30 30Z" fill="${C.algodao[0]}"/>
  <rect x="-30" y="-6" width="60" height="18" fill="${C.agua[1]}"/><rect x="-20" y="-70" width="40" height="12" rx="4" fill="${C.madeira[2]}"/>`
const VAPOR = c => `<path d="M0 0C-22 -30 22 -50 0 -80C-18 -104 14 -124 0 -150C12 -124 -6 -104 10 -80C30 -50 -10 -30 12 0Z" fill="${c}"/>`
const GOTA = c => `<path d="M0 -16C6 -7 10 -1 10 5C10 12 5 16 0 16C-5 16 -10 12 -10 5C-10 -1 -6 -7 0 -16Z" fill="${c}"/>`

let M = {}, MV = null, P = {}, areas = {}, chips = {}, gotas = [], fumacas = []

async function montarMangaio() {
  const txt = await (await fetch('../../arte/banco/cesto/mangaio-rig.svg')).text()
  const doc = new DOMParser().parseFromString(txt, 'image/svg+xml').documentElement
  MV = document.importNode(doc.querySelector('[id="mangaio"]'), true)
  $('#mangaio').appendChild(MV)
  const q = id => MV.querySelector(`[id="${id}"]`)
  M.rosto = q('rosto'); M.boch = q('bochechas')
  M.bocas = [...q('boca').children]
  M.olhos = { esq: [...q('olho-esq').children], dir: [...q('olho-dir').children] }
  M.olhoEl = { esq: q('olho-esq'), dir: q('olho-dir') }
  M.olhoC = { esq: q('olho-esq').getAttribute('data-pivo').split(' ').map(Number), dir: q('olho-dir').getAttribute('data-pivo').split(' ').map(Number) }
  M.bracos = { esq: [...q('braco-esq').children], dir: [...q('braco-dir').children] }
  M.cheio = q('frutas-cheio'); M.pouco = q('frutas-pouco'); M.extra = q('frutas-extra')
  M.sombra = G('#m-sombra', `<ellipse rx="150" ry="20" fill="#7A532E" opacity=".35"/>`)
}

function montar() {
  // mapa: cada área é um grupo de polígonos (mesorregiões do IBGE); o traço da mesma cor fecha as frestas
  const mg = $('#mapa-g')
  const corpo = document.createElementNS(NS, 'g'); corpo.setAttribute('clip-path', 'url(#revela)'); mg.appendChild(corpo)
  for (const [id, ds] of Object.entries(window.MAPA.areas)) {
    const g = document.createElementNS(NS, 'g')
    g.innerHTML = ds.map(d => `<path d="${d}"/>`).join('')
    g.setAttribute('stroke-width', '1.4'); g.setAttribute('stroke-linejoin', 'round')
    corpo.appendChild(g); areas[id] = g
  }
  P.estradas = G('#mapa-g', `<path d="M120 200C220 260 300 240 380 330C440 400 520 420 600 520" fill="none" stroke="${C.castanha[1]}" stroke-width="10" stroke-dasharray="22 14" stroke-linecap="round"/>`)
  P.rios = G('#mapa-g', `<path d="M20 120C120 150 200 110 300 140C380 160 440 120 520 130" fill="none" stroke="${C.agua[2]}" stroke-width="12" stroke-linecap="round"/>`)
  P.xis1 = G('#mapa-g', XIS); P.xis2 = G('#mapa-g', XIS)
  P.livro = G('#frente', LIVRO)
  // canavial
  P.cerca1 = G('#lugar', CERCA(1500, 70)); P.cerca2 = G('#lugar', CERCA(1500, 50))
  P.feijao = G('#lugar', FEIJAO); P.cana = G('#lugar', CANA)
  // sertão
  P.milho = G('#frente', MILHO); P.tigela = G('#frente', TIGELA); P.leite = G('#frente', LEITE)
  for (let i = 0; i < 26; i++) gotas.push(G('#frente', GOTA(i % 2 ? C.agua[0] : C.agua[1])))
  for (let i = 0; i < 4; i++) fumacas.push(G('#lugar', VAPOR('#C9C4BA')))
  const chip = (id, txt, extra = '') => {
    const d = document.createElement('div'); d.className = 'chip' + extra; d.textContent = txt
    $('#chips').appendChild(d); chips[id] = d
  }
  chip('josue', 'Josué de Castro · 1946')
  for (const [id, nome] of [['amazonia', 'Amazônia'], ['mata', 'Zona da Mata'], ['sertao', 'Sertão'], ['centro', 'Centro-Oeste'], ['sul', 'Extremo Sul']]) chip('a-' + id, nome, ' claro')
  chip('rica', 'terra mais rica'); chip('funda', 'fome mais funda')
  chip('donos', 'poucos donos'); chip('todo', 'fome de todo dia'); chip('sobra', 'sem sobra'); chip('seca', 'fome com a seca')
  chip('natureza', 'natureza', ' risca'); chip('dividida', 'como a terra é usada e dividida', ' grande')
  chip('onu', '2025 · ONU/FAO')
  chip('simpl', 'mapa simplificado · IBGE', ' claro')
}

// ---------------------------------------------------------------- mapa: câmera e cores
const NE = () => window.MAPA.nordeste
function zoomMapa(t) {          // 0 = mapa inteiro, 1 = perto do Nordeste
  const ini = B('duas').ini, fim = B('tese').ini + 0.4
  return suave(faixa(t, ini, ini + 0.9)) * (1 - suave(faixa(t, fim, fim + 1.0)))
}
function mapaXform(t) {
  const u = zoomMapa(t), z = lerp(1, 2.1, u)
  const [nx, ny] = NE()
  const alvo = [lerp(MAPA_X + nx, 560, u), lerp(MAPA_Y + ny, 780, u)]
  return { s: z, tx: alvo[0] - z * nx, ty: alvo[1] - z * ny }
}
const tela = (X, x, y) => [X.tx + X.s * x, X.ty + X.s * y]

function corArea(id, t) {
  const ar = B('areas'), ordem = ['amazonia', 'mata', 'sertao', 'centro', 'sul']
  const i = ordem.indexOf(id)
  const t0 = Wt('areas', 7) + 0.35 * i
  let c = mistura(C.neutro, C.area[id], suave(faixa(t, t0, t0 + 0.3)))
  // "duas fomes": o resto apaga, mata e sertão piscam
  const duas = faixa(t, Wt('duas', 6), Wt('duas', 6) + 0.3) * (1 - faixa(t, B('hoje').ini, B('hoje').ini + 0.5))
  let op = 1
  if (id !== 'mata' && id !== 'sertao') op = 1 - 0.6 * duas
  else c = mistura(c, '#FFF6E3', 0.25 * duas * Math.max(0, Math.sin((t - Wt('duas', 6)) * 8 + (id === 'mata' ? 0 : Math.PI))) * (t < B('duas').fim + 0.5))
  // paradoxo: a mata escurece ("fome mais funda")
  const pd = suave(faixa(t, Wt('paradoxo', 6), Wt('paradoxo', 6) + 0.6)) * (1 - suave(faixa(t, B('hoje').ini, B('hoje').ini + 0.6)))
  if (id === 'mata') c = mistura(c, '#4E2F1B', pd)
  if (id === 'sertao') c = mistura(c, '#F6CF8E', 0.6 * pd)
  // 2025: tudo clareia
  const hj = suave(faixa(t, Wt('hoje', 1), Wt('hoje', 1) + 0.8))
  c = mistura(c, '#9CC46E', 0.35 * hj)
  return [c, op]
}

// ---------------------------------------------------------------- Mangaio
function pulo(t, t0, d, h, x0, x1) {
  if (t < t0 - 0.14 || t > t0 + d + 0.4) return null
  const S = { x: x0, y: 0, sx: 1, sy: 1, rot: 0 }
  if (t < t0) { const u = faixa(t, t0 - 0.14, t0); S.sy = 1 - 0.12 * u; S.sx = 1 + 0.08 * u; return S }
  if (t < t0 + d) {
    const u = (t - t0) / d
    S.x = lerp(x0, x1, suave(u)); S.y = -h * 4 * u * (1 - u); S.sy = 1 + 0.1 * Math.sin(Math.PI * u); S.sx = 1 - 0.05 * Math.sin(Math.PI * u)
    S.rot = 8 * Math.sign(x1 - x0) * Math.sin(Math.PI * u); return S
  }
  const dl = t - t0 - d
  S.x = x1; S.sy = 1 - 0.14 * mola(dl, 2.6, 7); S.sx = 1 + 0.1 * mola(dl, 2.6, 7)
  return S
}
// sequência de pulos: [[t0, x1], ...] partindo de x0
function caminho(t, x0, pulos, d = 0.4, h = 70) {
  let x = x0, S = null
  for (const [t0, x1] of pulos) { const q = pulo(t, t0, d, h, x, x1); if (q) S = q; if (t >= t0 + d) x = x1 }
  return S || { x, y: 0, sx: 1, sy: 1, rot: 0 }
}

function mangaio(t) {
  const S = { x: 250, y: 0, k: 0.45, sx: 1, sy: 1, rot: 0, olho: 'oval', boca: 'aberta', olhar: [0.6, -0.3], rubor: 0,
              bE: ['oficial', 0], bD: ['oficial', 0], pisca: 0, frutas: 'cheio', vis: true }
  S.sy *= 1 + 0.015 * Math.sin(2 * Math.PI * t / 2.4)
  S.pisca = Math.max(...[3.1, 9.4, 16.2, 23.5, 29.8, 35.6, 41.7, 49.2, 55.6, 62.3].map(x => piscar(t, x)))
  const lg = lugarEm(t).lugar
  if (lg === 'mapa' && t < L.lugares[1].ini) {
    Object.assign(S, caminho(t, -120, [[0.3, 250]]))
    if (t > Wt('livro', 7)) { S.olho = 'grande'; S.boca = 'o' }
    if (t > B('areas').ini) { S.olho = 'oval'; S.boca = 'aberta'; S.olhar = [1, -0.6] }
    if (t > B('duas').ini) { S.olho = 'meia'; S.boca = 'torta' }
  } else if (lg === 'canavial') {
    S.k = 0.55
    const l0 = L.lugares[1].ini
    Object.assign(S, caminho(t, -150, [[l0 + 0.15, 150], [l0 + 0.6, 360]]))
    S.olhar = [0.2, -1]
    if (t > B('cana').ini) { S.olho = 'grande'; S.olhar = [0.8, -0.6] }
    if (dentro(t, B('roca').ini, B('endemica').ini)) {            // procura dos dois lados
      const lado = Math.sin((t - B('roca').ini) * 4.5) > 0 ? 1 : -1
      S.olhar = [lado, 0]; S.olho = 'oval'; S.boca = 'torta'; S.rot = 4 * lado
    }
    if (t > B('endemica').ini) { S.olho = 'triste'; S.boca = 'triste'; S.olhar = [0, 1]; S.frutas = 'pouco'; S.sy *= 0.97 }
  } else if (lg === 'sertao') {
    S.k = 0.55
    const l0 = L.lugares[2].ini
    Object.assign(S, caminho(t, -150, [[l0 + 0.15, 170], [l0 + 0.6, 420]]))
    S.frutas = t > Wt('suficiente', 5) + 0.6 ? 'cheio' : 'pouco'
    if (t > Wt('suficiente', 5)) { S.olho = 'arco'; S.boca = 'aberta_grande'; S.rubor = 0.6 }
    const seca = dentro(t, Wt('epidemica', 5) - 0.2, Wt('epidemica', 11) - 0.1)
    if (seca) { S.olho = 'triste'; S.boca = 'triste'; S.frutas = 'pouco'; S.rubor = 0 }
    if (t >= Wt('epidemica', 11) - 0.1) { S.olho = 'arco'; S.boca = 'aberta'; S.olhar = [0, -1]; S.bE = ['alto', 0]; S.bD = ['alto', 0] }
  } else {                                                         // de volta ao mapa
    const l0 = L.lugares[3].ini
    Object.assign(S, caminho(t, -120, [[l0 + 0.1, 250]]))
    S.olho = 'meia'; S.boca = 'torta'; S.olhar = [1, -0.4]
    if (t > B('tese').ini) { S.olho = 'oval'; S.boca = 'reta' }
    if (t > Wt('hoje', 1)) {
      S.olho = 'arco'; S.boca = 'aberta_grande'; S.rubor = 0.5
      const q = pulo(t, Wt('hoje', 1) + 0.1, 0.35, 80, 250, 250); if (q) { S.y = q.y; S.sx *= q.sx; S.sy *= q.sy; S.bE = ['alto', 0]; S.bD = ['alto', 0] }
    }
    // a pergunta: vem para o meio e cresce, olhando para quem assiste
    const pg = suave(faixa(t, B('pergunta').ini, B('pergunta').ini + 0.8))
    if (pg > 0) {
      S.x = lerp(250, 540, pg); S.k = lerp(0.45, 0.8, pg); S.olho = 'oval'; S.boca = 'sorriso_fechado'; S.olhar = [0, 0]; S.frutas = 'extra'
      if (t > Wt('pergunta', 12)) { S.olho = 'meia'; S.boca = 'torta'; S.rot = 4 }
    }
  }
  return S
}

function aplicarMangaio(S) {
  const W = 534, H = 627
  MV.setAttribute('transform', `translate(${r(S.x)} ${r(CHAO + S.y)}) rotate(${r(S.rot, 2)}) scale(${r(S.k * S.sx, 3)} ${r(S.k * S.sy, 3)}) translate(${-W / 2} ${-H})`)
  tr(M.sombra, S.x, CHAO, S.k * (1 + S.y / 600), 0)
  for (const l of ['esq', 'dir']) {
    for (const e of M.olhos[l]) mostra(e, e.id === `olho-${l}-${S.olho}`)
    const [cx, cy] = M.olhoC[l]
    const fecha = (S.olho === 'arco' || S.olho === 'fechado') ? 0 : S.pisca
    M.olhoEl[l].setAttribute('transform', `translate(${r(cx + S.olhar[0] * 5)} ${r(cy + S.olhar[1] * 4)}) scale(1 ${r(1 - 0.9 * fecha, 3)}) translate(${-cx} ${-cy})`)
  }
  M.rosto.setAttribute('transform', `translate(${r(S.olhar[0] * 12)} ${r(S.olhar[1] * 8)})`)
  for (const e of M.bocas) mostra(e, e.id === `boca-${S.boca}`)
  mostra(M.boch, S.rubor > 0); M.boch.setAttribute('opacity', r(S.rubor, 2))
  for (const [l, [peca, a]] of [['esq', S.bE], ['dir', S.bD]]) {
    for (const e of M.bracos[l]) {
      const on = e.id === `braco-${l}-${peca}`
      mostra(e, on)
      if (on) e.querySelector('.giro').setAttribute('transform', `rotate(${r(l === 'dir' ? a : -a)})`)
    }
  }
  mostra(M.cheio, S.frutas !== 'pouco'); mostra(M.pouco, S.frutas === 'pouco'); mostra(M.extra, S.frutas === 'extra')
}

// ---------------------------------------------------------------- cena por instante
function cena(t) {
  // fundos
  const oMapa = opLugar(t, 'mapa'), oCan = opLugar(t, 'canavial'), oSer = opLugar(t, 'sertao')
  $('#f-canavial').style.opacity = r(oCan, 3); $('#f-sertao').style.opacity = r(oSer, 3)
  // tinta do sertão: poeira da seca e azul da chuva
  const seca = suave(faixa(t, Wt('epidemica', 5) - 0.3, Wt('epidemica', 5) + 0.2)) * (1 - suave(faixa(t, Wt('epidemica', 11) - 0.2, Wt('epidemica', 11) + 0.3)))
  const chuva = suave(faixa(t, Wt('epidemica', 11) - 0.2, Wt('epidemica', 11) + 0.3)) * (1 - suave(faixa(t, B('epidemica').fim + 0.3, B('epidemica').fim + 0.8)))
  $('#tinta').style.background = `rgba(${seca > chuva ? '214,170,100' : '120,150,170'},${r(oSer * Math.max(0.45 * seca, 0.3 * chuva), 3)})`
  // mapa
  const X = mapaXform(t)
  const mg = $('#mapa-g')
  mostra(mg, oMapa > 0.01); mg.setAttribute('opacity', r(oMapa * (1 - 0.6 * suave(faixa(t, B('pergunta').ini, B('pergunta').ini + 0.8))), 3))
  mg.setAttribute('transform', `translate(${r(X.tx)} ${r(X.ty)}) scale(${r(X.s, 4)})`)
  $('#revela-r').setAttribute('width', r(lerp(0, 760, suave(faixa(t, 0.4, B('gancho').fim - 0.4)))))
  for (const id of Object.keys(areas)) {
    const [c, op] = corArea(id, t)
    areas[id].setAttribute('fill', c); areas[id].setAttribute('stroke', c); areas[id].setAttribute('opacity', r(op, 3))
  }
  // estradas e rios aparecem e são riscados
  const ve = vida(t, Wt('livro', 3) - 0.1, B('livro').fim - 0.2, 0.3, 0.3), vr = vida(t, Wt('livro', 6) - 0.1, B('livro').fim - 0.2, 0.3, 0.3)
  P.estradas.setAttribute('opacity', r(ve, 3)); P.rios.setAttribute('opacity', r(vr, 3))
  const vx = vida(t, Wt('livro', 7), B('livro').fim - 0.2, 0.3, 0.3)
  mostra(P.xis1, vx > 0.001); mostra(P.xis2, vx > 0.001)
  tr(P.xis1, 360, 300, vx * 0.9); tr(P.xis2, 280, 130, vx * 0.9)
  // livro
  const vl = vida(t, Wt('livro', 9), B('duas').ini, 0.45, 0.3)
  mostra(P.livro, vl > 0.001 && oMapa > 0.5)
  tr(P.livro, 820, 1000 - 30 * (1 - vl), vl * 0.8, -8)
  // canavial: cercas ("poucos donos"), feijão sufocado, fumaça da usina, chuva
  const vc = vida(t, Wt('cana', 7), L.lugares[1].fim, 0.35, 0.2)
  mostra(P.cerca1, vc > 0.001); mostra(P.cerca2, vc > 0.001)
  tr(P.cerca1, 540, 1000, 1, 0, vc); tr(P.cerca2, 540, 900, 0.7, 0, vc)
  const fj = t < Wt('roca', 4) ? 0 : entra(t, Wt('roca', 4), 0.4)
  const cn = t < Wt('roca', 6) ? 0 : suave(faixa(t, Wt('roca', 6), Wt('roca', 6) + 0.6))
  const murcha = suave(faixa(t, Wt('roca', 6) + 0.4, Wt('roca', 6) + 1.0))
  mostra(P.feijao, fj > 0.001 && oCan > 0.5); mostra(P.cana, cn > 0.001 && oCan > 0.5)
  tr(P.feijao, 760, CHAO, fj * 1.3, 40 * murcha, fj * 1.3 * (1 - 0.6 * murcha))
  tr(P.cana, 790, CHAO + 6, 1, -3, cn * 1.05)
  fumacas.forEach((f, i) => {
    const u = ((t * 0.5) + i / 4) % 1
    mostra(f, oCan > 0.01)
    tr(f, 222 + 30 * u + 8 * Math.sin(t + i), 470 - 220 * u, 0.7 + 0.9 * u)
    f.setAttribute('opacity', r(oCan * 0.7 * Math.sin(Math.PI * u), 2))
  })
  const rd = rng(11)
  const chovendo = (oCan > 0.01 && dentro(t, B('mata').ini - 0.3, B('cana').ini + 0.5)) || (oSer > 0.01 && chuva > 0.05)
  gotas.forEach((g, i) => {
    const x0 = rd() * 1080, f = rd()
    mostra(g, chovendo)
    if (!chovendo) return
    const u = ((t * 1.3) + f) % 1
    tr(g, x0 - 60 * u, 300 + 1000 * u, 1.2, 12)
  })
  // sertão: milho, feijão e leite aparecem e caem no cesto
  const itens = [[P.milho, 5, 330], [P.tigela, 7, 540], [P.leite, 9, 750]]
  const cesto = [420, CHAO - 0.55 * 400]
  for (const [el, k, x] of itens) {
    const t0 = Wt('suficiente', k), tc = t0 + 0.55
    if (t < t0 || t > tc + 0.4 || oSer < 0.5) { mostra(el, false); continue }
    mostra(el, true)
    if (t < tc) tr(el, x, 720, entra(t, t0, 0.3) * 1.3)
    else { const u = faixa(t, tc, tc + 0.4); tr(el, lerp(x, cesto[0], u), lerp(720, cesto[1], u) - 160 * Math.sin(Math.PI * u), 1.3 * (1 - 0.7 * u)) }
  }
}

// ---------------------------------------------------------------- textos
let BLOCOS = []
function blocosLegenda() {
  for (const [, b] of Object.entries(L.beats).sort((a, c) => a[1].ini - c[1].ini)) {
    let cur = []
    const fecha = () => { if (cur.length) BLOCOS.push({ w: cur }); cur = [] }
    for (const w of b.w) { cur.push(w); if (cur.length >= 3 || /[.,!?:]$/.test(w[0]) || cur.map(x => x[0]).join(' ').length > 15) fecha() }
    fecha()
  }
}
function chipEm(id, x, y, v, rot = -3) {
  const c = chips[id]
  mostra(c, v > 0.001)
  if (v > 0.001) { c.style.left = r(x - c.offsetWidth / 2) + 'px'; c.style.top = r(y - c.offsetHeight / 2) + 'px'; c.style.transform = `scale(${r(v, 3)}) rotate(${rot}deg)` }
}
function textos(t) {
  let rot = '', t0r = 0
  for (const b of R.beats) { const lb = L.beats[b.id]; if (lb && t >= lb.ini - 0.2 && t < lb.fim + 0.4 && b.rotulo) rot = b.rotulo }
  for (const b of R.beats) { const lb = L.beats[b.id]; if (b.rotulo === rot && lb && t >= lb.ini - 0.2) { t0r = lb.ini; break } }
  const rt = $('#rotulo span')
  if (rt.textContent !== rot) rt.textContent = rot
  mostra($('#rotulo'), !!rot)
  if (rot) rt.style.transform = `scale(${r(entra(t, t0r - 0.2, 0.35), 3)}) rotate(-2deg)`
  const X = mapaXform(t), oMapa = opLugar(t, 'mapa')
  chipEm('josue', 820, 1120, vida(t, Wt('livro', 11), Wt('areas', 7) - 0.2, 0.35, 0.25) * (oMapa > 0.5))
  const pos = { amazonia: [214, 171], mata: [700, 230], sertao: [570, 260], centro: [430, 380], sul: [440, 560] }
  const ordem = ['amazonia', 'mata', 'sertao', 'centro', 'sul']
  ordem.forEach((id, i) => {
    const t0 = Wt('areas', 7) + 0.35 * i
    const fim = (id === 'mata' || id === 'sertao') ? B('duas').fim + 0.3 : B('duas').ini
    const [x, y] = tela(X, ...pos[id])
    chipEm('a-' + id, x, y, vida(t, t0, fim, 0.3, 0.25) * (oMapa > 0.5), i % 2 ? 3 : -3)
  })
  const [mx, my] = tela(X, ...pos.mata)
  chipEm('rica', mx - 40, my - 120, vida(t, Wt('paradoxo', 1), B('paradoxo').fim + 0.2) * (oMapa > 0.5))
  chipEm('funda', mx - 40, my + 120, vida(t, Wt('paradoxo', 6), B('paradoxo').fim + 0.2) * (oMapa > 0.5), 3)
  chipEm('donos', 700, 760, vida(t, Wt('cana', 10), B('cana').fim + 0.4), 3)
  chipEm('todo', 540, 760, vida(t, Wt('endemica', 5), L.lugares[1].fim - 0.1))
  chipEm('sobra', 760, 600, vida(t, Wt('suficiente', 10), B('suficiente').fim + 0.4), 3)
  chipEm('seca', 540, 760, vida(t, Wt('epidemica', 5), Wt('epidemica', 11) - 0.2))
  chipEm('natureza', 540, 560, vida(t, Wt('tese', 7) - 0.1, B('tese').fim + 0.3))
  chipEm('dividida', 540, 720, vida(t, Wt('tese', 10) - 0.1, B('tese').fim + 0.3), 2)
  chipEm('onu', 600, 700, vida(t, Wt('hoje', 1), B('hoje').fim + 0.3))
  chipEm('simpl', 800, 1100, vida(t, Wt('areas', 7), B('duas').ini) * 0.9, 0)
  // legenda
  let bloco = null
  for (let i = 0; i < BLOCOS.length; i++) {
    const b = BLOCOS[i], ini = b.w[0][1] - 0.06, prox = BLOCOS[i + 1] ? BLOCOS[i + 1].w[0][1] - 0.06 : 1e9
    if (t >= ini && t < Math.min(prox, b.w[b.w.length - 1][2] + 0.7)) { bloco = b; break }
  }
  const lg = $('#legenda')
  let k = 'x'
  if (bloco) {
    const n = bloco.w.filter(w => t >= w[1] - 0.04).length
    const atual = bloco.w.findIndex(w => t >= w[1] - 0.04 && t < w[2] + 0.02)
    k = bloco.w[0][1] + '|' + n + '|' + atual
    if (lg.dataset.k !== k) lg.innerHTML = `<span class="placa">${bloco.w.map((w, i) =>
      `<span class="p" style="opacity:${i < n ? 1 : 0};color:${i === atual ? '#C5441E' : C.tinta}">${w[0]}</span>`).join('')}</span>`
  } else if (lg.dataset.k !== k) lg.innerHTML = ''
  lg.dataset.k = k
  const vc = faixa(t, L.fim_narr + 1.6, L.fim_narr + 2.2)
  const ca = $('#cartela')
  mostra(ca, vc > 0)
  ca.style.opacity = r(vc, 3); ca.style.transform = `scale(${r(lerp(0.85, 1, voltaBack(vc)), 3)}) rotate(-2deg)`
  $('#marca').style.opacity = r((1 - vc) * (opLugar(t, 'mapa') > 0.5 ? 1 : 0.85), 3)
  $('#marca').style.color = opLugar(t, 'mapa') > 0.5 ? '#8F4523' : '#F7E8C6'
}

function seek(t) {
  const tA = Math.floor(t * 15 + 1e-6) / 15
  aplicarMangaio(mangaio(tA))
  cena(t)
  textos(t)
}

;(async () => {
  await document.fonts.load('100px "Caveat Brush"')
  L = await (await fetch('linha.json')).json()
  R = await (await fetch('roteiro.json')).json()
  DUR = L.duracao
  for (const id of ['#f-canavial', '#f-sertao']) await $(id).decode()
  await montarMangaio()
  montar()
  blocosLegenda()
  window.DURACAO = DUR
  window.seek = seek
  seek(0)
  window.pronto = true
})()
