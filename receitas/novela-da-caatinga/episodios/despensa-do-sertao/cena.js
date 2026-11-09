// Piloto "A Despensa do Sertão" (9:16, ~64 s): formato explicativo num cenário fixo (a casa de farinha).
// O narrador fala em 2ª pessoa e o Mangaio é o "você" que faz cada passo; a Dona Mandioca entra uma vez.
// Contrato do motor (motores/render/CONTRATO.md): tudo é função de t, sem relógio, sem estado.
// Personagens atuam "em dois" (15/s); objetos, legenda e câmera a 30/s.
//
// Dados: linha.json (som.py: tempo global de cada beat e de cada palavra), roteiro.json (rótulos).
// Fundo: se existir fundo.png (cenário vazio gerado no Qwen-Image a partir das artes aprovadas), ele entra;
// senão, o cenário provisório em vetor abaixo.

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
const mistura = (c1, c2, u) => {           // cor hex -> hex
  const a = [1, 3, 5].map(i => parseInt(c1.slice(i, i + 2), 16)), b = [1, 3, 5].map(i => parseInt(c2.slice(i, i + 2), 16))
  return '#' + a.map((x, i) => Math.round(lerp(x, b[i], cl(u))).toString(16).padStart(2, '0')).join('')
}
const rng = s => () => { s = (s * 16807) % 2147483647; return s / 2147483647 }
// entrada com mola (0 -> 1, passando de 1) e saída (1 -> 0)
const entra = (t, t0, d = 0.38) => t < t0 ? 0 : voltaBack(faixa(t, t0, t0 + d))
const sai = (t, t1, d = 0.25) => 1 - suave(faixa(t, t1, t1 + d))
const vida = (t, t0, t1, d0 = 0.38, d1 = 0.25) => t < t0 || t > t1 + d1 ? 0 : entra(t, t0, d0) * sai(t, t1, d1)

const $ = s => document.querySelector(s)
const NS = 'http://www.w3.org/2000/svg'
const mostra = (el, sim) => { const v = sim ? '' : 'none'; if (el.style.display !== v) el.style.display = v }
function G(pai, svg, id) {
  const g = document.createElementNS(NS, 'g')
  if (id) g.id = id
  g.innerHTML = svg
  $(pai).appendChild(g)
  return g
}
const tr = (el, x, y, s = 1, rot = 0, sy = null) =>
  el.setAttribute('transform', `translate(${r(x)} ${r(y)}) rotate(${r(rot, 2)}) scale(${r(s, 3)} ${r(sy ?? s, 3)})`)

// ---------------------------------------------------------------- paleta (arte/paleta.json)
const C = {
  tinta: '#462416', creme: '#F7E8C6', branco: '#FFF8EA',
  casca: ['#D98A4E', '#C46C36', '#AC582B', '#8F4523', '#6C321A'],
  miolo: ['#FFF6E3', '#F6E7C8', '#E9D2A6', '#D6B886', '#B8956A'],
  terra: ['#E2B97E', '#CF9F63', '#B9874F', '#9C6E3E', '#7A532E'],
  madeira: ['#B57A48', '#9A6238', '#83512E', '#6A4125', '#4E2F1B'],
  palha: ['#F5B058', '#E99C46', '#D27C32', '#C06726', '#AF561E'],
  folha: ['#669630', '#50812F', '#3F6925', '#2B5627', '#1F4020'],
  castanha: ['#A88A6A', '#8A6C4E', '#73583E', '#5C4430', '#462416'],
  algodao: ['#F6E6C0', '#EBD3A0', '#DDBE85', '#C6A06A', '#A07C4E'],
  licuri: ['#F7B24A', '#EA952E', '#D27A22', '#B0601C', '#844516'],
  fogo: ['#FFD15A', '#FB991D', '#F5831B', '#EB4B20'],
  agua: ['#A9D3D6', '#7FB5BC', '#5A8E98'],
  maxixe: ['#B7D98A', '#9CC46E', '#82AB58', '#678E45'],
  vermelho: ['#E8573A', '#CF3B27', '#B52F20'],
}

// ---------------------------------------------------------------- quadro
const CHAO = 1110, MX = 250, MK = 0.5            // pé dos personagens, Mangaio
const MESA_X = 560, MESA_Y = 905
const TIP_X = 640, TIP_Y = 430                   // ponto onde o tipiti pendura
const DX = 765, DK = 0.4                         // Dona Mandioca (atrás da bancada)
let L = null, R = null, DUR = 64
const B = id => L.beats[id]
const Wt = (id, k) => { const w = B(id).w; return w[k < 0 ? w.length + k : k][1] }
const We = (id, k) => { const w = B(id).w; return w[k < 0 ? w.length + k : k][2] }

// ---------------------------------------------------------------- cenário provisório (vetor)
function cenario() {
  const t = C.terra, m = C.madeira
  return `
  <rect x="0" y="0" width="1080" height="${CHAO}" fill="${t[1]}"/>
  <path d="M0 0H1080V250C900 270 700 240 540 262C360 286 180 250 0 268Z" fill="${t[2]}"/>
  ${[420, 610, 800, 980].map((y, i) => `<path d="M0 ${y}C200 ${y - 14} 420 ${y + 10} 640 ${y - 6}C820 ${y - 18} 960 ${y + 6} 1080 ${y - 4}V${y + 12}C900 ${y + 22} 760 ${y + 4} 600 ${y + 14}C400 ${y + 26} 180 ${y + 4} 0 ${y + 14}Z" fill="${t[2]}" opacity=".55"/>`).join('')}
  <rect x="0" y="292" width="1080" height="40" fill="${m[3]}"/><rect x="0" y="292" width="1080" height="10" fill="${m[2]}"/>
  <path d="M120 0L200 292H170L92 0Z M960 0L880 292H910L988 0Z" fill="${m[3]}"/>
  <rect x="96" y="470" width="214" height="250" rx="10" fill="${m[3]}"/>
  <rect x="116" y="490" width="174" height="210" fill="#F7E8C6"/>
  <path d="M116 490H290V560C240 540 170 548 116 580Z" fill="#FFF6E3"/>
  <rect x="198" y="490" width="12" height="210" fill="${m[3]}"/><rect x="116" y="590" width="174" height="12" fill="${m[3]}"/>
  <path d="M790 ${CHAO}C790 930 860 840 960 840C1030 840 1080 870 1080 900V${CHAO}Z" fill="${t[3]}"/>
  <path d="M812 ${CHAO}C812 950 870 868 960 866C1020 866 1080 890 1080 920V${CHAO}Z" fill="${t[2]}"/>
  <path d="M900 ${CHAO}V1040C900 1000 1010 1000 1010 1040V${CHAO}Z" fill="${C.tinta}"/>
  <path d="M916 ${CHAO}C920 1070 940 1050 955 1070C966 1046 990 1060 996 ${CHAO}Z" fill="${C.fogo[1]}" opacity=".85"/>
  <rect x="0" y="${CHAO}" width="1080" height="${1920 - CHAO}" fill="${t[2]}"/>
  <rect x="0" y="${CHAO}" width="1080" height="26" fill="${t[1]}"/>
  <path d="M0 1500C300 1480 700 1520 1080 1490V1920H0Z" fill="${t[3]}" opacity=".6"/>`
}

// ---------------------------------------------------------------- peças (desenho em volta de (0,0) = base)
const RAIZ = (casca = true) => {
  const c = casca ? C.casca : C.miolo
  return `<path d="M-78 -4C-70 -20 -30 -22 10 -18C44 -15 70 -10 80 -2C84 2 80 6 72 8C40 16 -20 22 -62 16C-80 13 -86 6 -78 -4Z" fill="${c[1]}"/>
  <path d="M-74 8C-40 16 20 14 72 6C66 12 40 18 -10 21C-44 22 -66 18 -74 8Z" fill="${c[3]}"/>
  <path d="M-60 -10C-30 -16 10 -16 50 -10C20 -12 -20 -10 -60 -6Z" fill="${c[0]}"/>
  ${casca ? '<rect x="-32" y="-14" width="5" height="30" rx="2" fill="' + c[2] + '" transform="rotate(8 -30 0)"/><rect x="8" y="-16" width="5" height="34" rx="2" fill="' + c[2] + '" transform="rotate(6 10 0)"/>' : ''}`
}
const ESTRIAS = `<g class="estrias">${[[-46, -2, 22], [-10, 2, 30], [26, -1, 24], [54, 1, 14]].map(([x, y, w]) =>
  `<ellipse cx="${x}" cy="${y}" rx="${w}" ry="3.2" fill="#3E3A5C" transform="rotate(-4 ${x} ${y})"/>`).join('')}</g>`
const FOLHA = (x, y, rot, s = 1) => `<g transform="translate(${x} ${y}) rotate(${rot}) scale(${s})">${[-70, -35, 0, 35, 70].map((a, i) =>
  `<ellipse cx="0" cy="-38" rx="12" ry="40" fill="${C.folha[i % 2 ? 2 : 1]}" transform="rotate(${a})"/>`).join('')}<circle r="7" fill="${C.folha[3]}"/></g>`
const MANIVA = `<path d="M-6 -60C-8 -140 4 -200 -2 -300L6 -300C12 -200 0 -140 6 -60Z" fill="${C.castanha[1]}"/>
  ${FOLHA(0, -300, 0, 1.15)}${FOLHA(-6, -220, -40, 0.9)}${FOLHA(6, -160, 45, 0.85)}`
const MONTE = `<path d="M-240 0C-200 -70 -90 -96 0 -96C90 -96 200 -70 240 0Z" fill="${C.terra[2]}"/>
  <path d="M-240 0C-200 -70 -90 -96 0 -96C-60 -80 -150 -50 -190 0Z" fill="${C.terra[1]}"/>
  <path d="M-180 0C-150 -46 -80 -62 0 -62C80 -62 150 -46 180 0Z" fill="${C.terra[4]}"/>`
const MESA = `<rect x="-232" y="-26" width="464" height="28" rx="6" fill="${C.madeira[1]}"/><rect x="-232" y="-26" width="464" height="9" rx="4" fill="${C.madeira[0]}"/>
  <rect x="-216" y="2" width="432" height="22" fill="${C.madeira[2]}"/>
  <rect x="-196" y="22" width="26" height="${CHAO - MESA_Y - 22}" fill="${C.madeira[3]}"/><rect x="170" y="22" width="26" height="${CHAO - MESA_Y - 22}" fill="${C.madeira[3]}"/>`
const GAMELA = `<path d="M-112 -40C-112 8 -62 20 0 20C62 20 112 8 112 -40Z" fill="${C.madeira[1]}"/>
  <path d="M40 18C80 12 108 -6 112 -40C104 -14 80 4 40 18Z" fill="${C.madeira[3]}"/>
  <ellipse cx="0" cy="-40" rx="112" ry="16" fill="${C.madeira[0]}"/><ellipse cx="0" cy="-39" rx="98" ry="11" fill="${C.madeira[3]}"/>`
const MASSA = `<path d="M-94 -40C-80 -88 -30 -104 0 -104C40 -104 82 -88 94 -40Z" fill="${C.miolo[1]}"/>
  <path d="M-60 -76C-40 -96 -6 -100 20 -96C-10 -90 -40 -84 -60 -66Z" fill="${C.miolo[0]}"/>
  <path d="M40 -42C70 -50 86 -60 94 -40Z" fill="${C.miolo[2]}"/>`
const GOTA = (c1, c2) => `<path d="M0 -30C10 -14 18 -2 18 8C18 20 9 28 0 28C-9 28 -18 20 -18 8C-18 -2 -10 -14 0 -30Z" fill="${c1}"/>
  <path d="M8 4C14 8 14 18 6 23C10 16 10 10 8 4Z" fill="${c2}"/>`
const AVISO = `<g transform="scale(3.2)">${GOTA(C.miolo[3], C.miolo[4])}</g>
  <g transform="translate(70 40)"><path d="M0 -62L58 40C60 46 56 50 50 50H-50C-56 50 -60 46 -58 40Z" fill="${C.vermelho[1]}"/>
  <rect x="-8" y="-30" width="16" height="48" rx="7" fill="${C.branco}"/><circle cx="0" cy="34" r="9" fill="${C.branco}"/></g>`
const TIPITI = (() => {
  let s = `<path d="M-50 0C-50 -12 50 -12 50 0L46 290C46 306 -46 306 -46 290Z" fill="${C.palha[1]}"/>`
  for (let y = 8; y < 280; y += 26) s += `<path d="M-48 ${y}L0 ${y + 14}L48 ${y}V${y + 9}L0 ${y + 23}L-48 ${y + 9}Z" fill="${C.palha[2]}"/>`
  s += `<path d="M24 0L46 0L44 290C40 300 30 304 24 304Z" fill="${C.palha[3]}" opacity=".7"/>`
  s += `<path d="M-50 0C-50 -14 50 -14 50 0C50 10 -50 10 -50 0Z" fill="${C.palha[0]}"/>`
  s += `<ellipse cx="0" cy="318" rx="22" ry="20" fill="${C.palha[4]}"/><ellipse cx="0" cy="318" rx="11" ry="10" fill="${C.terra[1]}"/>`
  return s
})()
const BACIA = `<path d="M-132 -92H132C128 -20 82 10 0 10C-82 10 -128 -20 -132 -92Z" fill="${C.castanha[1]}"/>
  <path d="M60 4C104 -10 126 -40 132 -92H118C114 -40 96 -12 60 4Z" fill="${C.castanha[3]}"/>
  <path id="janela-bacia" d="M-114 -82H114C110 -26 72 -6 0 -6C-72 -6 -110 -26 -114 -82Z" fill="${C.castanha[2]}"/>
  <g clip-path="url(#corte-bacia)"><rect class="caldo" x="-120" y="-82" width="240" height="90" fill="${C.miolo[3]}"/>
  <rect class="goma" x="-120" y="-6" width="240" height="0" fill="${C.miolo[0]}"/></g>
  <rect x="-140" y="-100" width="280" height="14" rx="7" fill="${C.castanha[0]}"/>`
const TAPIOCA = `<path d="M-86 0C-86 -56 86 -56 86 0Z" fill="${C.miolo[0]}"/><path d="M-86 0C-60 -14 60 -14 86 0Z" fill="${C.miolo[2]}"/>
  ${[[-40, -22], [-6, -34], [30, -20], [52, -30]].map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="7" ry="4" fill="${C.miolo[3]}"/>`).join('')}`
const FORNO = `<rect x="-236" y="-214" width="472" height="214" rx="12" fill="${C.terra[2]}"/>
  <rect x="-236" y="-214" width="472" height="30" rx="10" fill="${C.terra[1]}"/>
  ${[[-200, -160], [-130, -120], [120, -150], [170, -90], [-180, -70]].map(([x, y]) => `<rect x="${x}" y="${y}" width="56" height="28" rx="10" fill="${C.terra[3]}"/>`).join('')}
  <path d="M-80 0V-66C-80 -112 80 -112 80 -66V0Z" fill="${C.tinta}"/>
  <g class="chamas">${[[-34, C.fogo[3], 1], [30, C.fogo[2], 1.1], [0, C.fogo[1], 1.35], [0, C.fogo[0], 0.8]].map(([x, c, s]) =>
    `<path class="chama" data-s="${s}" data-x="${x}" d="M0 -60C14 -40 26 -20 26 -2C26 0 -26 0 -26 -2C-26 -20 -14 -40 0 -60Z" fill="${c}" transform="translate(${x} 0) scale(${s})"/>`).join('')}</g>
  <ellipse cx="0" cy="-216" rx="238" ry="36" fill="${C.castanha[1]}"/><ellipse cx="0" cy="-218" rx="220" ry="28" fill="${C.castanha[3]}"/>
  <ellipse class="farinha" cx="0" cy="-222" rx="204" ry="21" fill="${C.miolo[1]}"/>
  <g class="graos">${Array.from({ length: 16 }, (_, i) => `<ellipse cx="${-180 + i * 24}" cy="${-222 + ((i * 7) % 11) - 5}" rx="6" ry="3" fill="${C.licuri[1]}"/>`).join('')}</g>`
const RODO = `<rect x="-8" y="-250" width="16" height="250" rx="7" fill="${C.madeira[1]}" transform="rotate(-24)"/>
  <rect x="-56" y="-10" width="112" height="22" rx="8" fill="${C.madeira[2]}"/>`
const VAPOR = c => `<path d="M0 0C-22 -30 22 -50 0 -80C-18 -104 14 -124 0 -150C12 -124 -6 -104 10 -80C30 -50 -10 -30 12 0Z" fill="${c}"/>`
const LUPA = `<rect x="140" y="140" width="60" height="190" rx="24" fill="${C.madeira[2]}" transform="rotate(-45 160 160)"/>
  <circle r="214" fill="${C.castanha[2]}"/><circle r="194" fill="${C.miolo[0]}"/>
  <g class="graos-l">${[[-90, 40, 20], [-20, 70, -30], [60, 30, 10], [110, 90, 40], [-120, 110, -10], [10, 130, 25], [70, 140, -20]].map(([x, y, a]) =>
    `<path d="M-28 -16L22 -22L32 10L-6 24L-34 8Z" fill="${C.licuri[(x + y) % 2 ? 0 : 1]}" transform="translate(${x} ${y}) rotate(${a})"/>`).join('')}</g>
  <g class="micros">${[[-120, -90], [-40, -130], [60, -110], [130, -60]].map(([x, y], i) =>
    `<g class="micro" data-x="${x}" data-y="${y}"><path d="M-30 0C-34 -26 -6 -36 12 -28C34 -22 38 6 24 20C8 34 -26 26 -30 0Z" fill="${C.maxixe[i % 2 ? 2 : 1]}"/>
    <ellipse cx="-8" cy="-6" rx="5" ry="7" fill="${C.tinta}"/><ellipse cx="10" cy="-6" rx="5" ry="7" fill="${C.tinta}"/></g>`).join('')}</g>
  <g class="sem-agua" transform="translate(-130 -150)"><g transform="scale(1.6)">${GOTA(C.agua[1], C.agua[2])}</g>
  <rect x="-44" y="-8" width="88" height="14" rx="7" fill="${C.vermelho[1]}" transform="rotate(-40)"/></g>`
const SACO = `<path d="M-124 0C-136 -120 -116 -220 -72 -252H72C116 -220 136 -120 124 0Z" fill="${C.algodao[1]}"/>
  <path d="M40 0C100 -40 110 -160 72 -252H96C130 -200 136 -100 124 0Z" fill="${C.algodao[3]}"/>
  <path d="M-110 -40C-60 -26 60 -26 110 -40V0H-124Z" fill="${C.algodao[2]}" opacity=".6"/>
  <g class="fechado"><path d="M-72 -252C-60 -276 60 -276 72 -252C40 -244 -40 -244 -72 -252Z" fill="${C.algodao[2]}"/>
  <path d="M-30 -262C-50 -300 -10 -310 0 -270C10 -310 50 -300 30 -262Z" fill="${C.algodao[3]}"/></g>
  <g class="aberto"><ellipse cx="0" cy="-252" rx="86" ry="22" fill="${C.algodao[3]}"/><path d="M-76 -254C-40 -300 40 -300 76 -254Z" fill="${C.licuri[0]}"/>
  <path d="M-40 -270C-20 -290 20 -292 36 -276C10 -282 -16 -280 -40 -270Z" fill="#FFE08A"/></g>`

// ---------------------------------------------------------------- montagem
let M = {}, MV = null, D = {}, pecas = {}, confete = [], gotas = [], vapores = [], chips = {}

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
  for (const id of ['frutas-extra']) { const e = q(id); if (e) e.style.display = 'none' }
  G('#mangaio-sombra', `<ellipse rx="150" ry="20" fill="${C.terra[4]}" opacity=".35"/>`, 'sombra-m')
}

function montarDona() {
  const g = $('#dona')
  g.innerHTML = window.DM_VISTAS[0]
  const q = id => g.querySelector(`[id="${id}"]`)
  const pv = el => el.getAttribute('data-pivo').split(' ').map(Number)
  D = { el: g, tronco: q('tronco'), lenco: q('acess-lenco'), pontas: q('lenco-pontas'), rosto: q('rosto'), boca: q('boca'),
        bochechas: q('bochechas'), olhos: {}, bracos: {}, sobr: {} }
  D.pvTronco = pv(D.tronco); D.pvLenco = pv(D.lenco); D.pvPontas = pv(D.pontas); D.pvRosto = pv(D.rosto)
  D.bocas = [...D.boca.children]
  for (const l of ['esq', 'dir']) {
    const o = q('olho-' + l); D.olhos[l] = { el: o, pv: pv(o), filhos: [...o.children] }
    const s = q('sobr-' + l); if (s) s.style.display = 'none'
    const b = q('braco-' + l)
    const vars = {}; for (const v of ['reto', 'cintura', 'cruzado']) { vars[v] = q(`braco-${l}-${v}`); vars[v].removeAttribute('display') }
    const props = {}
    for (const n of ['colher', 'abano']) {
      const p = q(`prop-${n}-${l}`); p.removeAttribute('display')
      props[n] = { el: p, base: p.getAttribute('transform').replace(/rotate\([^)]*\)/, '').trim() }
    }
    D.bracos[l] = { el: b, ombro: pv(b), sent: Number(b.getAttribute('data-sentido')), vars, giro: vars.reto.querySelector('.giro'), props }
  }
}

function montarPecas() {
  const P = pecas
  $('#cenario').innerHTML = cenario()
  $('defs').innerHTML = `<clipPath id="corte-bacia"><path d="M-114 -82H114C110 -26 72 -6 0 -6C-72 -6 -110 -26 -114 -82Z"/></clipPath>`
  P.monte = G('#atras', MONTE)
  P.maniva = G('#atras', `<g class="planta">${MANIVA}</g><g class="raizes">${[[-40, 20, 130], [0, 30, 90], [44, 22, 54]].map(([x, y, a]) =>
    `<g transform="translate(${x} ${-60 + y}) rotate(${a}) translate(60 0) scale(.85)">${RAIZ(true)}${ESTRIAS}</g>`).join('')}</g>`)
  P.mesa = G('#mesa-camada', MESA)
  P.raizes = Array.from({ length: 5 }, (_, i) => G('#sobre-mesa', `<g class="c">${RAIZ(true)}${ESTRIAS}</g><g class="m">${RAIZ(false)}</g>`))
  P.gamela = G('#sobre-mesa', `<g class="massa">${MASSA}</g>${GAMELA}`)
  P.poca = G('#sobre-mesa', `<ellipse rx="120" ry="12" fill="${C.miolo[3]}"/>`)
  P.aviso = G('#info', AVISO)
  P.corda = G('#sobre-mesa', `<rect x="-5" y="-140" width="10" height="140" fill="${C.castanha[1]}"/>`)
  P.tipiti = G('#sobre-mesa', TIPITI)
  P.bacia = G('#sobre-mesa', BACIA)
  P.puxa = G('#frente', `<rect class="fio" x="-4" y="0" width="8" height="100" rx="4" fill="${C.castanha[1]}"/>`)
  P.tapioca = G('#sobre-mesa', TAPIOCA)
  P.forno = G('#mesa-camada', FORNO)
  P.rodo = G('#sobre-mesa', RODO)
  P.lupa = G('#info', LUPA)
  P.saco = G('#info', SACO)
  for (let i = 0; i < 7; i++) gotas.push(G('#frente', GOTA(i % 3 ? C.miolo[3] : C.agua[1], i % 3 ? C.miolo[4] : C.agua[2])))
  for (let i = 0; i < 7; i++) vapores.push(G('#frente', VAPOR(i < 4 ? '#F6F1E4' : C.maxixe[0])))
  const rd = rng(7)
  const cores = [C.vermelho[1], C.licuri[0], C.folha[0], C.palha[0], C.agua[1], C.fogo[0]]
  for (let i = 0; i < 44; i++) confete.push({ el: G('#info', `<rect x="-9" y="-5" width="18" height="10" rx="2" fill="${cores[i % cores.length]}"/>`),
    x: rd() * 1080, v: 240 + rd() * 260, rot: rd() * 360, w: 2 + rd() * 5, atraso: rd() * 0.6, fase: rd() * 6 })
  // chips de informação (HTML): texto, posição, quando entra e quando sai
  const chip = (id, txt, x, y, extra = '') => {
    const d = document.createElement('div'); d.className = 'chip' + extra; d.textContent = txt
    d.style.left = x + 'px'; d.style.top = y + 'px'; $('#chips').appendChild(d); chips[id] = d
  }
  chip('anos', 'até 2 anos', 600, 470)
  chip('dias', '3 dias', 700, 560)
  chip('dias2', '3 dias', 150, 480, ' risca')
  chip('meses', 'meses!', 700, 480)
  chip('terra', 'TERRA', 130, 520); chip('braco', 'BRAÇO', 410, 470); chip('fogo', 'FOGO', 700, 520)
}

// ---------------------------------------------------------------- Mangaio
function pulo(t, t0, d, h, x0, x1) {         // antecipação (0,12 s antes), arco, pouso com squash
  if (t < t0 - 0.14 || t > t0 + d + 0.4) return null
  const S = { x: x0, y: 0, sx: 1, sy: 1, rot: 0, ar: false }
  if (t < t0) { const u = faixa(t, t0 - 0.14, t0); S.sy = 1 - 0.12 * u; S.sx = 1 + 0.08 * u; return S }
  if (t < t0 + d) {
    const u = (t - t0) / d
    S.x = lerp(x0, x1, suave(u)); S.y = -h * 4 * u * (1 - u); S.sy = 1 + 0.1 * Math.sin(Math.PI * u); S.sx = 1 - 0.05 * Math.sin(Math.PI * u)
    S.rot = 8 * Math.sign(x1 - x0) * Math.sin(Math.PI * u); S.ar = true; return S
  }
  const dl = t - t0 - d
  S.x = x1; S.sy = 1 - 0.14 * mola(dl, 2.6, 7); S.sx = 1 + 0.1 * mola(dl, 2.6, 7)
  return S
}

function mangaio(t) {
  const S = { x: MX, y: 0, sx: 1, sy: 1, rot: 0, olho: 'oval', boca: 'aberta', olhar: [0.6, 0], rubor: 0, bE: ['oficial', 0], bD: ['oficial', 0], pisca: 0 }
  S.sy *= 1 + 0.015 * Math.sin(2 * Math.PI * t / 2.4)
  S.pisca = Math.max(...[2.4, 7.6, 13.4, 19.0, 33.2, 39.6, 44.9, 50.2, 56.9, 61.2].map(x => piscar(t, x)))
  const a = B('arranca'), ro = B('roca')
  // 1. olha a maniva; "dois anos": olho grande
  if (t > Wt('terra', 7)) S.olho = 'grande'
  // 2. arranca: pula até a planta, puxa, volta
  const xP = 420
  let p = pulo(t, a.ini - 0.5, 0.42, 70, MX, xP)
  if (t >= a.ini - 0.08 && t < ro.ini - 0.1) {
    S.x = xP
    const pu = Wt('arranca', 0)
    const ant = faixa(t, pu - 0.3, pu), ti = faixa(t, pu, pu + 0.25)
    S.bE = ['alto', 0]; S.bD = ['alto', 0]
    S.rot = -10 * suave(ant) + 14 * voltaBack(ti) * (1 - suave(faixa(t, pu + 0.5, pu + 0.9)))
    S.sy *= 1 - 0.1 * suave(ant) + 0.12 * Math.sin(Math.PI * ti)
    S.olho = t < pu ? 'decidido' : 'grande'; S.boca = t < pu ? 'firme' : 'o'
    if (t > Wt('arranca', 2)) { S.olho = 'triste'; S.boca = 'torta'; S.bE = ['oficial', 0]; S.bD = ['oficial', 0]; S.rot = 0 }
  }
  p = pulo(t, ro.ini - 0.1, 0.42, 60, xP, MX) || p
  if (p) Object.assign(S, { x: p.x, y: p.y, rot: S.rot + p.rot }), S.sx *= p.sx, S.sy *= p.sy
  if (dentro(t, ro.ini - 0.1, B('rala').ini)) { S.olho = 'grande'; S.boca = 'aberta_grande' }
  // 3. rala: trabalha (braços alternando)
  if (dentro(t, B('rala').ini, B('massa').fim)) {
    const f = Math.sin((t - B('rala').ini) * 9)
    S.olho = 'decidido'; S.boca = 'firme'; S.bE = ['segura', 20 + 25 * f]; S.bD = ['segura', 20 - 25 * f]; S.rot = 3 * f
  }
  // 4. manipueira: susto e pulinho para trás
  if (dentro(t, Wt('manipueira', 4), B('tipiti').ini)) {
    S.olho = 'grande'; S.boca = 'o'; S.bE = ['alto', 0]; S.bD = ['alto', 0]
    const q = pulo(t, Wt('manipueira', 4) + 0.05, 0.3, 40, MX, MX - 30); if (q) { S.y = q.y; S.x = q.x; S.sy *= q.sy } else S.x = MX - 30
  }
  if (dentro(t, B('tipiti').ini, Wt('espreme', 2) - 0.3)) { S.x = lerp(MX - 30, MX, faixa(t, B('tipiti').ini, B('tipiti').ini + 0.4)); S.olhar = [0.8, -0.8]; S.olho = 'oval' }
  // 5. puxa a corda do tipiti
  const pu2 = Wt('espreme', 2), solta = We('espreme', -1) + 0.4
  if (dentro(t, pu2 - 0.3, solta)) {
    const ant = faixa(t, pu2 - 0.3, pu2), ti = faixa(t, pu2, pu2 + 0.3)
    S.bE = ['alto', 0]; S.bD = ['alto', 0]; S.olho = 'decidido'; S.boca = 'firme'
    S.rot = -14 * voltaBack(ti) + 4 * Math.sin((t - pu2) * 7) * (t > pu2 + 0.3); S.sy *= 1 - 0.1 * suave(ant) + 0.05 * suave(ti)
    S.x = MX + 30 * suave(ant)
  }
  // 6. Dona Mandioca chega: susto, vergonha, riso
  const d0 = L.dona0
  if (dentro(t, d0 - 0.2, B('goma').ini)) {
    S.x = MX + 30
    if (t < Wt('dona', 1)) {
      S.olho = 'grande'; S.boca = 'o'; S.bE = ['alto', 0]; S.bD = ['alto', 0]
      const q = pulo(t, Wt('dona', 0) + 0.02, 0.28, 50, MX + 30, MX + 30); if (q) { S.y = q.y; S.sy *= q.sy }
    } else if (t < Wt('dona', -2)) { S.olho = 'oval'; S.boca = 'ondulada'; S.olhar = [0.4, 1]; S.rubor = 1 }
    else { S.olho = 'arco'; S.boca = 'sorriso_fechado'; S.rubor = 0.6; S.olhar = [1, 0] }
  }
  if (dentro(t, B('goma').ini, B('forno').ini)) { S.x = lerp(MX + 30, MX, faixa(t, B('goma').ini, B('goma').ini + 0.5)); S.olhar = [1, 0.3] }
  if (dentro(t, Wt('tapioca', 2), B('forno').ini)) { S.olho = 'grande'; S.boca = 'o_pequeno'; S.rubor = 1 }
  // 7. forno: mexe, mexe, mexe
  if (dentro(t, B('forno').ini, B('fogo').ini)) {
    S.olho = 'decidido'; S.boca = 'firme'
    const f = Math.sin(Math.PI * 2 * faixa(t, Wt('mexe', 2), We('mexe', 4)) * 1.5)
    if (t > Wt('mexe', 2) && t < We('mexe', 4) + 0.2) { S.bE = ['segura', 30 + 30 * f]; S.bD = ['segura', 30 - 30 * f]; S.rot = 4 * f; S.boca = 'aberta' }
  }
  if (dentro(t, B('fogo').ini, B('seca').ini)) { S.olhar = [0.8, -0.6] }
  if (dentro(t, B('seca').ini, B('meses').ini)) { S.olho = 'meia'; S.boca = 'torta'; S.olhar = [0.8, -1] }
  if (dentro(t, B('meses').ini, B('farinha').ini)) { S.olho = 'grande'; S.boca = 'aberta' }
  if (dentro(t, B('farinha').ini, DUR)) { S.olho = 'arco'; S.boca = 'aberta_grande'; S.rubor = 0.5 }
  // 8. parabéns: dois pulos de festa
  const pa = Wt('parabens', 0)
  for (const [t0, h] of [[pa + 0.15, 90], [pa + 0.85, 60]]) {
    const q = pulo(t, t0, 0.32, h, MX, MX)
    if (q) { S.y = q.y; S.sx *= q.sx; S.sy *= q.sy; S.bE = ['alto', 0]; S.bD = ['alto', 0] }
  }
  if (t > L.fim_narr) { S.bE = ['alto', 10 * Math.sin(t * 6)]; S.bD = ['oficial', 0] }
  return S
}

function aplicarMangaio(S) {
  const W = 534, H = 627
  MV.setAttribute('transform', `translate(${r(S.x)} ${r(CHAO + S.y)}) rotate(${r(S.rot, 2)}) scale(${r(MK * S.sx, 3)} ${r(MK * S.sy, 3)}) translate(${-W / 2} ${-H})`)
  $('#mangaio').setAttribute('transform', '')
  const so = $('#sombra-m'); tr(so, S.x, CHAO, MK * (1 + S.y / 600), 0)
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
}

// ---------------------------------------------------------------- Dona Mandioca
let VIS = []
function visemas(pal) {
  const out = []
  const mapa = ch => {
    if ('aáãâà'.includes(ch)) return ['boca-A', 2]
    if ('eéê'.includes(ch)) return ['boca-E', 2]
    if ('ií'.includes(ch)) return ['boca-I', 2]
    if ('oóôõ'.includes(ch)) return ['boca-O', 2]
    if ('uú'.includes(ch)) return ['boca-U', 2]
    if ('mbp'.includes(ch)) return ['boca-MBP', 1]
    if ('fv'.includes(ch)) return ['boca-FV', 1]
    if ('szxjç'.includes(ch)) return ['boca-I', 1]
    return null
  }
  for (const [txt, ini, fim] of pal) {
    let w = txt.toLowerCase().replace(/[^a-záàâãéêíóôõúç]/g, '').replace(/qu/g, 'k').replace(/nh/g, 'i').replace(/lh/g, 'i').replace(/ch/g, 'x')
    const seq = []
    for (const ch of w) { const v = mapa(ch); if (v && (!seq.length || seq[seq.length - 1][0] !== v[0])) seq.push(v) }
    if (!seq.length) seq.push(['boca-E', 1])
    const tot = seq.reduce((a, s) => a + s[1], 0)
    let tt = ini
    for (const [b, peso] of seq) { const d = (fim - ini) * peso / tot; out.push([tt, tt + d, b]); tt += d }
  }
  return out
}

function dona(t) {
  const d0 = L.dona0
  const S = { vis: t > d0 - 0.6, x: DX, tr: { tx: 0, ty: 0, rot: 0, sx: 1, sy: 1 }, olhos: ['oval', 'oval'], pisca: 0, olhar: [0, 0],
              boca: 'boca-repouso', rubor: 1, bE: ['reto', 58, ['colher', -8]], bD: ['reto', 14, null], lenco: 0, pontas: 0 }
  if (!S.vis) return S
  S.tr.sy *= 1 + 0.012 * Math.sin(2 * Math.PI * t / 3.4)
  S.pisca = Math.max(...[27.6, 35.1, 42.2, 49.6, 55.4, 60.8].map(x => piscar(t, x)))
  // entra rápido pela direita, três passos pesados
  if (t < d0 + 0.1) {
    const u = faixa(t, d0 - 0.55, d0 + 0.05)
    S.x = lerp(1240, DX, suave(u))
    const f = Math.abs(Math.sin(Math.PI * 3 * u))
    S.tr.ty = -14 * f; S.tr.rot = 3 * Math.sin(Math.PI * 3 * u); S.olhos = ['decidido', 'decidido']; S.boca = 'boca-firme'
    S.bE = ['reto', 20, ['colher', -90]]
  }
  const golpe = tb => {                // colher na mesa: antecipação e batida
    const ta = tb - 0.22
    if (t < ta || t > tb + 0.5) return false
    if (t < tb) { const u = suave(faixa(t, ta, tb)); S.bE = ['reto', lerp(58, 160, u), ['colher', lerp(-8, -35, u)]]; S.tr.rot = -4 * u; return true }
    const dd = t - tb, u = cl(dd / 0.07)
    S.bE = ['reto', lerp(160, 40, u) + 6 * mola(dd - 0.07, 3, 9), ['colher', lerp(-35, -145, u)]]
    S.tr.rot = 4 * (1 - suave(faixa(dd, 0.15, 0.4))); S.tr.ty = 10 * (1 - suave(faixa(dd, 0.1, 0.35)))
    S.pontas = -14 * mola(dd - 0.04, 2.2, 4.5); return true
  }
  if (dentro(t, d0 + 0.1, B('goma').ini)) {
    S.olhos = ['decidido', 'decidido']; S.boca = 'boca-firme'
    // "Esse caldo não vai pro chão": aponta a bacia com a colher
    if (t > Wt('dona', 1) && t < Wt('dona', 7)) {
      const ap = voltaBack(faixa(t, Wt('dona', 1), Wt('dona', 1) + 0.3))
      S.bE = ['reto', lerp(40, 96, ap), ['colher', lerp(-145, -95, ap)]]; S.tr.rot = -3 * ap
    }
    golpe(Wt('dona', 0) + 0.05) || golpe(Wt('dona', -3) + 0.05)
    if (t > Wt('dona', -2)) { S.olhos = ['arco', 'arco']; S.rubor = 1.3 }
    for (const [a, b, v] of VIS) if (t >= a && t < b) { S.boca = v; break }
    const e = L.dona_env[Math.min(L.dona_env.length - 1, Math.max(0, Math.floor((t - d0) * 30)))] || 0
    if (t > d0 && t < B('dona').fim && e < 0.04) S.boca = 'boca-MBP'
  }
  if (t >= B('goma').ini) {            // fica olhando, de colher em pé
    S.olhar = [-12, 4]; S.boca = 'boca-repouso'
    if (dentro(t, Wt('tapioca', 2), B('forno').ini)) { S.olhos = ['arco', 'arco']; S.boca = 'boca-aberta' }
    if (dentro(t, Wt('mexe', 2), We('mexe', 4) + 0.2)) { const f = Math.sin(Math.PI * 2 * faixa(t, Wt('mexe', 2), We('mexe', 4)) * 1.5); S.bE = ['reto', 70 + 20 * f, ['colher', -8]] }
    if (t > B('parabens').ini) { S.olhos = ['arco', 'arco']; S.boca = 'boca-aberta'; S.bD = ['reto', 60 + 30 * Math.sin(t * 7), null]; S.olhar = [-6, 0] }
  }
  return S
}

function aplicarBracoD(l, [varr, a, prop]) {
  const Bd = D.bracos[l]
  Bd.el.setAttribute('transform', `translate(${Bd.ombro[0]} ${Bd.ombro[1]})`)
  for (const [v, el] of Object.entries(Bd.vars)) mostra(el, v === varr)
  Bd.giro.setAttribute('transform', `rotate(${r(-a * Bd.sent, 1)})`)
  for (const [n, p] of Object.entries(Bd.props)) {
    const on = !!prop && prop[0] === n
    mostra(p.el, on)
    if (on) p.el.setAttribute('transform', `${p.base} rotate(${r(prop[1] + a * Bd.sent, 1)})`)
  }
}

function aplicarDona(S) {
  mostra(D.el, S.vis)
  if (!S.vis) return
  D.el.setAttribute('transform', `translate(${r(S.x)} ${CHAO}) scale(${DK}) translate(-640 -1195)`)
  const [hx, hy] = D.pvTronco, T = S.tr
  D.tronco.setAttribute('transform', `translate(${r(T.tx)} ${r(T.ty)}) translate(${hx} ${hy}) rotate(${r(T.rot, 2)}) scale(${r(T.sx, 3)} ${r(T.sy, 3)}) translate(${-hx} ${-hy})`)
  D.lenco.setAttribute('transform', `rotate(${r(S.lenco, 2)} ${D.pvLenco[0]} ${D.pvLenco[1]})`)
  D.pontas.setAttribute('transform', `rotate(${r(S.pontas, 2)} ${D.pvPontas[0]} ${D.pvPontas[1]})`)
  D.rosto.setAttribute('transform', `translate(${r(S.olhar[0])} ${r(S.olhar[1])})`)
  S.olhos.forEach((forma, i) => {
    const l = i ? 'dir' : 'esq', O = D.olhos[l]
    for (const e of O.filhos) { e.removeAttribute('display'); mostra(e, e.id === `olho-${l}-${forma}`) }
    const fecha = (forma === 'arco' || forma === 'fechado') ? 0 : S.pisca
    const [cx, cy] = O.pv
    O.el.setAttribute('transform', `translate(${cx} ${cy}) scale(1 ${r(1 - 0.9 * fecha, 3)}) translate(${-cx} ${-cy})`)
  })
  for (const e of D.bocas) { e.removeAttribute('display'); mostra(e, e.id === S.boca) }
  D.bochechas.setAttribute('opacity', r(cl(S.rubor, 0, 2), 2))
  aplicarBracoD('esq', S.bE); aplicarBracoD('dir', S.bD)
}

// ---------------------------------------------------------------- objetos
function objetos(t) {
  const P = pecas
  const a = B('arranca'), ro = B('roca'), ra = B('rala'), fo = B('forno')
  // monte + maniva: brota no início; arrancada no "Arrancou"; some quando a mesa chega
  const vm = vida(t, 0.1, ro.ini - 0.05, 0.4, 0.3)
  mostra(P.monte, vm > 0.001); tr(P.monte, MESA_X, CHAO, 1, 0, vm)
  const pu = Wt('arranca', 0)
  const sobe = voltaBack(faixa(t, pu, pu + 0.35))
  const vp = vida(t, 0.25, ro.ini - 0.05, 0.5, 0.25)
  mostra(P.maniva, vp > 0.001)
  tr(P.maniva, MESA_X - 10 * sobe, CHAO - 34 - 240 * sobe, vp, -12 * sobe + 3 * Math.sin(t * 2.2) * (1 - sobe))
  const est = suave(faixa(t, Wt('arranca', 2), Wt('arranca', 2) + 1.4))
  for (const e of P.maniva.querySelectorAll('.estrias')) e.setAttribute('opacity', r(est, 2))
  // mesa entra na "roça", sai no forno
  const vmesa = vida(t, ro.ini - 0.05, fo.ini - 0.1, 0.4, 0.25)
  mostra(P.mesa, vmesa > 0.001); tr(P.mesa, MESA_X, MESA_Y, 1, 0, vmesa)
  // raízes: caem na mesa, são descascadas ("descasca"), viram massa ("rala")
  const pos = [[470, -14, -8], [560, -16, 6], [650, -12, -4], [515, -46, 10], [605, -44, -12]]
  const desc = Wt('rala', 1), rala = Wt('rala', 4)
  P.raizes.forEach((g, i) => {
    const t0 = ro.ini + 0.15 + 0.18 * i
    if (t < t0 || t > rala + 1.2) return mostra(g, false)
    mostra(g, true)
    const qd = faixa(t, t0, t0 + 0.3)
    const y = MESA_Y - 26 + pos[i][1] - 500 * (1 - qd * qd) - 10 * mola(t - t0 - 0.3, 3, 9)
    const enc = 1 - suave(faixa(t, rala + 0.12 * i, rala + 0.5 + 0.12 * i))
    tr(g, pos[i][0], y, 0.9 * enc, pos[i][2])
    const pe = suave(faixa(t, desc + 0.1 * i, desc + 0.35 + 0.1 * i))
    g.querySelector('.c').setAttribute('opacity', r(1 - pe, 2)); g.querySelector('.m').setAttribute('opacity', r(pe, 2))
    g.querySelector('.estrias').setAttribute('opacity', r(0.5 * (1 - pe), 2))
  })
  // gamela com a massa: entra no "rala", a massa cresce; esvazia no "enche"
  const en = Wt('espreme', 1)
  const vg = vida(t, rala - 0.25, en + 0.5, 0.35, 0.3)
  mostra(P.gamela, vg > 0.001); tr(P.gamela, 470, MESA_Y - 46, vg)
  const massa = suave(faixa(t, rala, ra.fim + 0.4)) * (1 - suave(faixa(t, en, en + 0.4)))
  tr(P.gamela.querySelector('.massa'), 0, 0, 1, 0, massa)
  // poça de manipueira debaixo da gamela
  const vpo = suave(faixa(t, B('massa').ini + 0.4, B('manipueira').fim)) * (1 - suave(faixa(t, en, en + 0.4)))
  mostra(P.poca, vpo > 0.01); tr(P.poca, 470, MESA_Y - 24, vpo, 0)
  // aviso: gota de manipueira + placa
  const va = vida(t, Wt('manipueira', 4) - 0.1, B('tipiti').ini - 0.1)
  mostra(P.aviso, va > 0.001); tr(P.aviso, 560, 640, va, 4 * Math.sin(t * 3))
  // tipiti: desce pendurado; enche (incha), puxa (estica com mola), espreme; sobe no "goma"
  const ti = B('tipiti')
  const vt = vida(t, ti.ini - 0.05, B('goma').ini + 0.1, 0.5, 0.35)
  const desce = 1 - voltaBack(faixa(t, ti.ini - 0.05, ti.ini + 0.45))
  const sobeT = suave(faixa(t, B('goma').ini + 0.1, B('goma').ini + 0.5))
  const incha = suave(faixa(t, en, en + 0.35))
  const pux = Wt('espreme', 2)
  const est2 = voltaBack(faixa(t, pux, pux + 0.35)) * (1 - suave(faixa(t, We('espreme', -1) + 0.4, We('espreme', -1) + 0.9)))
  const sx = (0.8 + 0.3 * incha) * (1 - 0.32 * est2), sy = 0.85 * (1 + 0.32 * est2 + 0.05 * mola(t - pux - 0.35, 2.2, 5))
  const ty = TIP_Y - 520 * desce - 600 * sobeT
  mostra(P.tipiti, vt > 0.001); mostra(P.corda, vt > 0.001)
  P.tipiti.setAttribute('transform', `translate(${TIP_X} ${r(ty)}) scale(${r(sx, 3)} ${r(sy, 3)})`)
  tr(P.corda, TIP_X, ty, 1)
  const fundoTip = ty + 318 * sy
  // fio do puxão: do pé do tipiti até a mão do Mangaio
  const vf = dentro(t, pux - 0.15, We('espreme', -1) + 0.55)
  mostra(P.puxa, vf)
  if (vf) {
    const mx = MX + 30 + 70, my = CHAO - MK * 600
    const dx = mx - TIP_X, dy = my - fundoTip, len = Math.hypot(dx, dy)
    P.puxa.setAttribute('transform', `translate(${TIP_X} ${r(fundoTip)}) rotate(${r(Math.atan2(dy, dx) * 180 / Math.PI - 90, 2)})`)
    P.puxa.querySelector('.fio').setAttribute('height', r(len))
  }
  // bacia: debaixo do tipiti; o caldo enche no "espreme" e a goma assenta no "goma"
  const vb = vida(t, ti.ini + 0.3, fo.ini - 0.1)
  mostra(P.bacia, vb > 0.001); tr(P.bacia, TIP_X, MESA_Y - 26, vb)
  const ench = suave(faixa(t, Wt('espreme', 5), We('espreme', -1) + 0.6))
  P.bacia.querySelector('.caldo').setAttribute('y', r(-6 - 70 * ench)); P.bacia.querySelector('.caldo').setAttribute('height', r(70 * ench + 2))
  const gm = suave(faixa(t, Wt('goma', 2), We('goma', -1)))
  P.bacia.querySelector('.goma').setAttribute('y', r(-6 - 26 * gm)); P.bacia.querySelector('.goma').setAttribute('height', r(26 * gm))
  P.bacia.querySelector('.caldo').setAttribute('fill', mistura(C.miolo[3], '#E3CD9C', gm))
  // tapioca
  const vtp = vida(t, Wt('tapioca', 2), fo.ini - 0.1)
  mostra(P.tapioca, vtp > 0.001); tr(P.tapioca, 455, MESA_Y - 26, vtp)
  // forno: sobe do chão; a farinha passa de branca a dourada no "mexe"
  const vfo = entra(t, fo.ini - 0.05, 0.45)
  mostra(P.forno, vfo > 0.001); tr(P.forno, MESA_X, CHAO, 1, 0, vfo)
  const doura = suave(faixa(t, Wt('mexe', 2), B('fogo').fim))
  P.forno.querySelector('.farinha').setAttribute('fill', mistura(C.miolo[1], C.licuri[0], doura * 0.85))
  P.forno.querySelector('.graos').setAttribute('opacity', r(doura, 2))
  P.forno.querySelectorAll('.chama').forEach((c, i) => {
    const s = Number(c.dataset.s) * (1 + 0.12 * Math.sin(t * (9 + i * 2.3) + i)), x = Number(c.dataset.x)
    c.setAttribute('transform', `translate(${x} 0) scale(${r(s * (1 + 0.04 * Math.sin(t * 13 + i)), 3)} ${r(s, 3)})`)
  })
  // rodo: entra com a farinha; mexe, mexe, mexe
  const vr = vida(t, fo.ini + 0.4, B('seca').ini)
  mostra(P.rodo, vr > 0.001)
  const mx = Math.sin(Math.PI * 2 * faixa(t, Wt('mexe', 2), We('mexe', 4)) * 1.5)
  tr(P.rodo, MESA_X + 130 * mx, CHAO - 222, vr, 8 * mx)
  // lupa: sem água, micróbio não vive
  const se = B('seca')
  const vl = vida(t, se.ini - 0.1, B('meses').ini - 0.15)
  mostra(P.lupa, vl > 0.001); tr(P.lupa, 560, 735, vl * 0.8)
  const murcha = suave(faixa(t, Wt('seca', 5), Wt('seca', 5) + 0.6))
  P.lupa.querySelectorAll('.micro').forEach((m, i) => {
    const x = Number(m.dataset.x), y = Number(m.dataset.y)
    const vem = faixa(t, se.ini + 0.1, Wt('seca', 5))
    m.setAttribute('transform', `translate(${r(x * (1 - 0.35 * vem) + 6 * Math.sin(t * 8 + i))} ${r(y + 60 * vem + 20 * murcha)}) scale(${r(1 - 0.2 * murcha, 3)} ${r(1 - 0.6 * murcha, 3)})`)
    m.setAttribute('opacity', r(1 - 0.85 * murcha, 2))
  })
  P.lupa.querySelector('.sem-agua').setAttribute('opacity', r(faixa(t, se.ini, se.ini + 0.3), 2))
  // saco: "meses"; abre na "farinha"
  const vs = vida(t, B('meses').ini + 0.15, B('parabens').ini + 0.2)
  mostra(P.saco, vs > 0.001); tr(P.saco, 560, 780, vs * 0.95, 2 * Math.sin(t * 2.5))
  const ab = t > Wt('farinha', -1) - 0.1
  mostra(P.saco.querySelector('.fechado'), !ab); mostra(P.saco.querySelector('.aberto'), ab)
  // gotas: o caldo pingando da massa e escorrendo do tipiti; a água da lavagem
  gotas.forEach((g, i) => {
    let vis = false, x = 0, y = 0, s = 0.8
    const lav = Wt('rala', 2)
    if (dentro(t, lav, lav + 0.7) && i < 6) {              // lava: respingo sobre as raízes
      const u = faixa(t, lav + 0.04 * i, lav + 0.5 + 0.04 * i); vis = u > 0 && u < 1
      const ang = -Math.PI / 2 + (i - 2.5) * 0.45
      x = 560 + Math.cos(ang) * 160 * u; y = MESA_Y - 60 + Math.sin(ang) * 140 * u + 300 * u * u; s = 0.9 - 0.4 * u
      if (i % 3 === 0) vis = false
    } else if (dentro(t, B('massa').ini, B('tipiti').ini) && i < 3) {   // massa encharcada: pinga
      const u = ((t - B('massa').ini) / 0.7 + i / 3) % 1; vis = true
      x = 420 + 50 * i; y = MESA_Y - 30 + 40 * u * u - 10; s = 0.55 * Math.sin(Math.PI * cl(u * 1.2))
    } else if (dentro(t, Wt('espreme', 5), We('espreme', -1) + 0.6)) { // escorre do tipiti para a bacia
      const u = ((t - Wt('espreme', 5)) / 0.45 + i / 7) % 1; vis = true
      x = TIP_X + 4 * Math.sin(i * 2); y = lerp(fundoTip + 10, MESA_Y - 100, u * u); s = 0.6
    }
    mostra(g, vis); if (vis) tr(g, x, y, s)
  })
  // vapor: a água sai da farinha no forno (os verdinhos são o veneno indo embora)
  vapores.forEach((v, i) => {
    const t0 = B('fogo').ini - 0.4, t1 = B('seca').ini
    const ven = i >= 4, inicio = ven ? Wt('fogo', 10) - 0.2 : t0
    if (t < inicio || t > t1 + 0.6) return mostra(v, false)
    const u = ((t - inicio) / 1.6 + i * 0.27) % 1
    mostra(v, true)
    tr(v, MESA_X - 170 + i * 56 + 18 * Math.sin(t * 2 + i), CHAO - 236 - 260 * u, 0.7 + 0.5 * u)
    v.setAttribute('opacity', r(0.75 * Math.sin(Math.PI * u) * sai(t, t1, 0.6), 2))
  })
  // confete do "parabéns"
  const pa = Wt('parabens', 0)
  confete.forEach((c, i) => {
    const u = t - pa - c.atraso
    if (u < 0 || u > 3.4) return mostra(c.el, false)
    mostra(c.el, true)
    tr(c.el, c.x + 30 * Math.sin(u * c.w + c.fase), 220 + c.v * u, 1.2, c.rot + 200 * u, Math.cos(u * c.w * 2))
  })
}

// ---------------------------------------------------------------- textos: rótulo, chips, legenda, cartela
let BLOCOS = []
function blocosLegenda() {
  const ordem = Object.entries(L.beats).sort((a, b) => a[1].ini - b[1].ini)
  for (const [id, b] of ordem) {
    let cur = []
    const quem = id === 'dona' ? 'dona' : 'narrador'
    const fecha = () => { if (cur.length) BLOCOS.push({ quem, w: cur }); cur = [] }
    for (const w of b.w) {
      cur.push(w)
      if (cur.length >= 3 || /[.,!?:]$/.test(w[0]) || cur.map(x => x[0]).join(' ').length > 15) fecha()
    }
    fecha()
  }
}
function textos(t) {
  // rótulo do beat
  let rot = '', t0r = 0
  for (const b of R.beats) { const lb = L.beats[b.id]; if (lb && t >= lb.ini - 0.15 && t < lb.fim + 0.4 && b.rotulo) { rot = b.rotulo; t0r = lb.ini } }
  // o rótulo começa quando o beat com aquele rótulo começa pela primeira vez
  for (const b of R.beats) { const lb = L.beats[b.id]; if (b.rotulo === rot && lb) { t0r = Math.min(t0r, lb.ini); } }
  const rt = $('#rotulo span')
  if (rt.textContent !== rot) rt.textContent = rot
  mostra($('#rotulo'), !!rot)
  if (rot) rt.style.transform = `scale(${r(entra(t, t0r - 0.15, 0.35), 3)}) rotate(-2deg)`
  // chips
  const ch = (id, a, b, rot2 = -3) => {
    const v = vida(t, a, b, 0.35, 0.2)
    mostra(chips[id], v > 0.001)
    if (v > 0.001) chips[id].style.transform = `scale(${r(v, 3)}) rotate(${rot2}deg)`
  }
  ch('anos', Wt('terra', 6), B('arranca').ini - 0.2)
  ch('dias', Wt('arranca', 3), B('roca').ini + 0.6, 4)
  ch('dias2', Wt('meses', 5), B('farinha').ini - 0.1)
  ch('meses', Wt('meses', -3), B('farinha').ini - 0.1, 3)
  ch('terra', Wt('parabens', 8), L.fim_narr + 0.8)
  ch('braco', Wt('parabens', 9), L.fim_narr + 0.8, 2)
  ch('fogo', Wt('parabens', 11), L.fim_narr + 0.8, -2)
  // legenda: blocos de até 3 palavras, cada palavra entra quando é dita; a da vez em vermelho
  let bloco = null
  for (let i = 0; i < BLOCOS.length; i++) {
    const b = BLOCOS[i], ini = b.w[0][1] - 0.06, prox = BLOCOS[i + 1] ? BLOCOS[i + 1].w[0][1] - 0.06 : 1e9
    const fim = Math.min(prox, b.w[b.w.length - 1][2] + 0.7)
    if (t >= ini && t < fim) { bloco = b; break }
  }
  const lg = $('#legenda')
  let k = 'x'
  if (bloco) {
    const n = bloco.w.filter(w => t >= w[1] - 0.04).length
    const atual = bloco.w.findIndex(w => t >= w[1] - 0.04 && t < w[2] + 0.02)
    k = bloco.w[0][1] + '|' + n + '|' + atual
    if (lg.dataset.k !== k) {
      const cor = bloco.quem === 'dona' ? '#93261B' : C.tinta
      lg.innerHTML = `<span class="placa">${bloco.w.map((w, i) =>
        `<span class="p" style="opacity:${i < n ? 1 : 0};color:${i === atual ? '#C5441E' : cor}">${w[0]}</span>`).join('')}</span>`
    }
  } else if (lg.dataset.k !== k) lg.innerHTML = ''
  lg.dataset.k = k
  // cartela final
  const vc = faixa(t, L.fim_narr + 1.7, L.fim_narr + 2.3)
  const ca = $('#cartela')
  mostra(ca, vc > 0)
  ca.style.opacity = r(vc, 3); ca.style.transform = `scale(${r(lerp(0.85, 1, voltaBack(vc)), 3)}) rotate(-2deg)`
  $('#marca').style.opacity = r(1 - vc, 3)
}

function camera(t) {
  // respira devagar; soquinho no "Ei!" da Dona Mandioca; aproxima na lupa
  // zoom-base 1,22 ancorado no chão (o pé fica na mesma altura, a cena cresce para cima e para os lados)
  let z = 1.22 + 0.012 * Math.sin(t * 0.4)
  const ei = Wt('dona', 0)
  z += 0.05 * Math.exp(-Math.max(0, t - ei) * 5) * (t > ei)
  const fx = 560, fy = CHAO
  $('#cam').setAttribute('transform', `translate(${fx} ${fy}) scale(${r(z, 4)}) translate(${-fx} ${-fy})`)
}

function seek(t) {
  const tA = Math.floor(t * 15 + 1e-6) / 15
  aplicarMangaio(mangaio(tA))
  aplicarDona(dona(tA))
  objetos(t)
  textos(t)
  camera(t)
}

;(async () => {
  await document.fonts.load('100px "Caveat Brush"')
  L = await (await fetch('linha.json')).json()
  R = await (await fetch('roteiro.json')).json()
  DUR = L.duracao
  VIS = visemas(L.beats.dona.w)
  // fundo gerado (opcional)
  const img = $('#fundo-img')
  const temFundo = await new Promise(res => { img.onload = () => res(true); img.onerror = () => res(false); img.src = 'fundo.png' })
  if (temFundo) { await img.decode(); img.style.display = 'block'; $('#palco').style.background = 'none' }
  await montarMangaio()
  montarDona()
  montarPecas()
  if (temFundo) $('#cenario').style.display = 'none'
  blocosLegenda()
  window.DURACAO = DUR
  window.seek = seek
  seek(0)
  window.pronto = true
})()
