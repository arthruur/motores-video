// Demo de animação do Mangaio (reel de estúdio, 9:16, ~35 s).
// Contrato do motor (motores/render/CONTRATO.md): tudo é função de t, sem relógio, sem estado.
// O personagem atua "em dois" (pose nova a cada 2 quadros, 15/s, como pede arte/animacao.md §1);
// câmera, letreiro e poeira correm a 30/s.
//
// Assets (servidos com --raiz na pasta da série):
//   arte/banco/cesto/mangaio-rig.svg          frente, com todas as peças trocáveis
//   arte/banco/cesto/cesto-tres-quartos.svg   vistas (cada uma é um rig próprio)
//   arte/banco/cesto/cesto-perfil.svg
//   arte/banco/cesto/cesto-costas.svg
// Os tempos das seções estão em T (abaixo) e os sons em tempos.json; mexeu num, confira o outro.

const BANCO = '../../arte/banco/cesto/'
const W = 534, H = 627                    // coordenadas do mascote.svg
const CHAO = 1250, CX = 540, K = 1.12      // pé do Mangaio no quadro e escala (1 = 627 px de altura)
const DURACAO = 35

// ---------------------------------------------------------------- utilidades
const cl = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v))
const lerp = (a, b, u) => a + (b - a) * u
const suave = u => { u = cl(u); return u * u * (3 - 2 * u) }
const faixa = (t, a, b) => cl((t - a) / (b - a))
const mola = (dt, f, am) => dt < 0 ? 0 : Math.exp(-am * dt) * Math.cos(2 * Math.PI * f * dt)
const voltaBack = u => { u = cl(u); const c = 1.7; return 1 + (c + 1) * (u - 1) ** 3 + c * (u - 1) ** 2 }
const r = (v, d = 1) => Number(v.toFixed(d))
const dentro = (t, a, b) => t >= a && t < b

// ---------------------------------------------------------------- linha do tempo
const T = {
  entrada: 0, nome: 4.1, giro: 8.1, expr: 13.8, cont: 25.0, fecho: 31.4,
  // pulos: t0 = decolagem, d = tempo no ar, h = altura, xa → xb, ant = antecipação, peso = quanto achata
  pulos: [
    { t0: -0.15, d: 0.75, h: 300, xa: -760, xb: 300, ant: 0.2, peso: 1 },   // já entra no ar, de fora do quadro
    { t0: 1.75, d: 0.50, h: 190, xa: 300, xb: 430, ant: 0.18, peso: 1 },
    { t0: 2.85, d: 0.60, h: 210, xa: 430, xb: 540, ant: 0.24, peso: 1.1 },
    { t0: 12.9, d: 0.45, h: 150, xa: 540, xb: 540, ant: 0.18, peso: 0.9 },
    { t0: 16.05, d: 0.32, h: 70, xa: 540, xb: 540, ant: 0.0, peso: 0.6 },     // o susto tira do chão
    { t0: 30.55, d: 0.42, h: 60, xa: 540, xb: 540, ant: 0.26, peso: 1.6 },    // carregar_tudo: baixo e pesado
  ],
  vistas: [[8.1, 'frente', 1], [8.75, 'tres-quartos', 1], [9.45, 'perfil', 1], [10.2, 'costas', 1],
           [10.95, 'perfil', -1], [11.65, 'tres-quartos', -1], [12.35, 'frente', 1]],
  exprs: [[13.8, 'desconfiado'], [16.0, 'assustado'], [18.2, 'triste'], [20.4, 'encantado'], [22.6, 'não vai']],
  sai: 25.2,                                   // as frutas pulam fora
  cai: [26.8, 27.3, 27.8, 28.3],               // e voltam uma a uma (plim)
  extra: [29.2, 29.55, 29.9],                  // e transborda
  queda: 0.38,
}

function pulo(t) {
  for (const p of T.pulos) {
    const ini = p.t0 - p.ant, fim = p.t0 + p.d + 0.7
    if (t < ini || t >= fim) continue
    if (t < p.t0) {                           // antecipação: agacha
      const u = suave(faixa(t, ini, p.t0))
      return { y: 0, sx: 1 + 0.12 * u * p.peso, sy: 1 - 0.14 * u * p.peso, ar: 0, x: p.xa }
    }
    const u = (t - p.t0) / p.d
    if (u <= 1) {                             // no ar: arco e estica nas pontas
      const v = Math.abs(1 - 2 * u)
      return { y: -4 * p.h * u * (1 - u), sx: 1 - 0.08 * v, sy: 1 + 0.13 * v, ar: 1 - v, x: lerp(p.xa, p.xb, u), noAr: true }
    }
    const m = mola(t - p.t0 - p.d, 2.6, 7)    // pouso: achata e volta como mola
    return { y: 0, sx: 1 + 0.16 * m * p.peso, sy: 1 - 0.17 * m * p.peso, ar: 0, x: p.xb, pousou: t - p.t0 - p.d }
  }
  return null
}
function xBase(t) {
  let x = T.pulos[0].xa
  for (const p of T.pulos) if (t >= p.t0 + p.d) x = p.xb
  return x
}
const yCorpo = t => (pulo(t) || { y: 0 }).y

// ---------------------------------------------------------------- montagem (antes de pronto)
const $ = s => document.querySelector(s)
const NS = 'http://www.w3.org/2000/svg'
let ator, P = {}, VISTAS = {}, cheio = [], extras = [], poeira = [], brilhos = [], voo = [], vooC = []
// fruta inteira para o voo: o desenho do rig é só a metade que aparece acima da borda,
// então completamos a parte de baixo (tons empilhados da paleta) e recortamos pela boca do cesto
const COMPLETA = [
  null,                                                                   // folhas de trás
  '<ellipse cx="386" cy="292" rx="98" ry="74" transform="rotate(-14 386 292)" fill="#D23E1A"/>'
  + '<ellipse cx="382" cy="284" rx="92" ry="66" transform="rotate(-14 382 284)" fill="#EB4B20"/>',   // tomate
  '<ellipse cx="197" cy="318" rx="99" ry="97" fill="#E06F14"/>'
  + '<ellipse cx="192" cy="310" rx="93" ry="90" fill="#F5831B"/>',        // laranja
  null,                                                                   // folhas da frente
]
// borda da frente da boca (a mesma curva do #interior): o que está abaixo dela fica atrás do trançado
const BOCA = 'M-900 330L14 330C120 352 470 334 518 276L1400 276L1400 -5000L-900 -5000Z'
// saída (dx, giro) e volta (dx, giro) de cada punhado, em coordenadas do rig
const VOO = [[-420, -220, -130, -80], [440, 260, 150, 110], [-140, -120, -70, -50], [230, 190, 100, 70]]

async function carregarSvg(arq) {
  const txt = await (await fetch(BANCO + arq)).text()
  return new DOMParser().parseFromString(txt, 'image/svg+xml').documentElement
}
function embrulhar(filhos, pai, antes) {
  const g = document.createElementNS(NS, 'g')
  pai.insertBefore(g, antes)
  for (const f of filhos) g.appendChild(f)
  return g
}

async function montar() {
  ator = $('#ator')
  const rig = await carregarSvg('mangaio-rig.svg')
  const frente = document.importNode(rig.querySelector('[id="mangaio"]'), true)
  ator.appendChild(frente)
  VISTAS.frente = frente
  const q = id => frente.querySelector(`[id="${id}"]`)
  for (const id of ['rosto', 'bochechas', 'interior', 'frutas-cheio', 'frutas-extra', 'frutas-pouco', 'olho-esq', 'olho-dir'])
    P[id] = q(id)
  P.olhoCentro = {}
  for (const l of ['esq', 'dir']) P.olhoCentro[l] = P['olho-' + l].getAttribute('data-pivo').split(' ').map(Number)
  P.bocas = [...q('boca').children]
  P.olhos = { esq: [...q('olho-esq').children], dir: [...q('olho-dir').children] }
  P.bracos = { esq: [...q('braco-esq').children], dir: [...q('braco-dir').children] }
  // frutas: 4 punhados que caem um a um (folhas de trás, tomate, laranja, folhas da frente)
  const fc = [...P['frutas-cheio'].children]
  const grupos = [[0, 1, 2], [3, 4], [5], [6, 7, 8]]
  P.cheioMolde = embrulhar([], P['frutas-cheio'], null)     // camada que leva o follow-through
  for (const gi of grupos) cheio.push(embrulhar(gi.map(i => fc[i]), P.cheioMolde, null))
  for (const f of [...P['frutas-extra'].children]) extras.push(embrulhar([f], P['frutas-extra'], null))
  const defs = document.createElementNS(NS, 'defs')
  defs.innerHTML = `<clipPath id="boca-do-cesto"><path d="${BOCA}"/></clipPath>`
  frente.insertBefore(defs, frente.firstChild)
  const camada = document.createElementNS(NS, 'g')
  camada.setAttribute('clip-path', 'url(#boca-do-cesto)')
  P['frutas-cheio'].after(camada)
  cheio.forEach((g, i) => {
    const b = g.getBBox()
    vooC.push([b.x + b.width / 2, b.y + b.height / 2])
    const s = document.createElementNS(NS, 'g')
    if (COMPLETA[i]) s.innerHTML = COMPLETA[i]
    const c = g.cloneNode(true)
    for (const e of [c, ...c.querySelectorAll('[id]')]) e.removeAttribute('id')
    s.appendChild(c); s.style.display = 'none'
    camada.appendChild(s); voo.push(s)
  })
  P['frutas-extra'].style.display = ''
  // vistas: ids com prefixo para não colidir com o rig da frente
  for (const v of ['tres-quartos', 'perfil', 'costas']) {
    const s = await carregarSvg(`cesto-${v}.svg`)
    const g = document.importNode(s.querySelector('[id="mangaio"]'), true)
    for (const e of [g, ...g.querySelectorAll('[id]')]) e.id = `v-${v}-${e.id}`
    g.style.display = 'none'
    ator.appendChild(g)
    VISTAS[v] = g
  }
  // poeira do pouso (atrás do ator) e brilhos do encanto (na frente)
  const pg = $('#poeira'); $('#cam').insertBefore(pg, $('#sombra-chao').nextSibling)
  for (let i = 0; i < 8; i++) {
    const c = document.createElementNS(NS, 'path')
    c.setAttribute('d', 'M-20 0C-20-13-9-21 0-21C12-21 21-12 20 0C20 12 10 19 0 19C-11 19-20 11-20 0Z')
    c.setAttribute('fill', i % 2 ? '#E2B97E' : '#CF9F63')
    pg.appendChild(c); poeira.push(c)
  }
  for (let i = 0; i < 5; i++) {
    const s = document.createElementNS(NS, 'path')
    s.setAttribute('d', 'M0-26C3-8 8-3 26 0C8 3 3 8 0 26C-3 8-8 3-26 0C-8-3-3-8 0-26Z')
    s.setAttribute('fill', i % 2 ? '#FFF8EA' : '#F5B058')
    $('#brilhos').appendChild(s); brilhos.push(s)
  }
}

// ---------------------------------------------------------------- estado em função de t
function neutro() {
  return {
    x: CX, y: 0, sx: 1, sy: 1, rot: 0, k: 1, flip: 1, vista: 'frente',
    olho: 'oval', olhoD: null, pisca: 0, olhar: [0, 0], boca: 'aberta', rubor: 0,
    bE: ['oficial', 0], bD: ['oficial', 0],
    interior: 0, frutas: [0, 0, 0, 0], voo: [null, null, null, null], extras: [null, null, null], lag: 0, ar: 0, sombra: 1,
  }
}

// piscada lenta: fecha e abre em ~0,35 s
const piscar = (t, t0, d = 0.36) => { const u = faixa(t, t0, t0 + d); return u > 0 && u < 1 ? Math.sin(Math.PI * u) : 0 }

function personagem(t) {
  const S = neutro()
  // respiração (±1,5% a cada ~3,5 s) e piscadas irregulares de fundo
  S.sy *= 1 + 0.015 * Math.sin(2 * Math.PI * t / 3.4)
  S.pisca = Math.max(piscar(t, 3.95, 0.5), piscar(t, 7.2), piscar(t, 13.55), piscar(t, 26.2), piscar(t, 33.0),
    piscar(t, 18.08, 0.26), piscar(t, 20.28, 0.26))   // piscada na troca: esconde o corte de expressão

  // ----- 1. entrada aos pulos
  if (t < T.nome) {
    S.x = xBase(t)
    S.olhar = [0.5, -0.1]
    if (t > 3.6) S.olhar = [0, 0]
  }
  // ----- 2. "oi": acena com a peça alta
  if (dentro(t, T.nome, T.giro)) {
    const u = t - T.nome
    if (u > 0.1 && u < 2.8) {
      S.bD = ['alto', 8 + 20 * Math.sin(u * 7.5) * suave(faixa(u, 0.1, 0.4))]
      S.olho = 'arco'; S.boca = 'aberta_grande'; S.rot = -2 * Math.sin(u * 3.75)
    } else if (u >= 2.8) S.bD = ['oficial', 0]
  }
  // ----- 3. virada: troca de vista (cut-out), com um "pop" em cada troca
  if (dentro(t, T.giro, T.expr)) {
    let atual = T.vistas[0]
    for (const v of T.vistas) if (t >= v[0]) atual = v
    S.vista = atual[1]; S.flip = atual[2]
    const dt = t - atual[0]
    if (atual[0] > T.giro) { S.sy *= 1 - 0.06 * mola(dt, 3.2, 9); S.sx *= 1 + 0.05 * mola(dt, 3.2, 9); S.rot = 3 * S.flip * mola(dt, 2, 6) }
    // a próxima troca chama: leve antecipação
    const prox = T.vistas.find(v => v[0] > t)
    if (prox) { const a = suave(faixa(t, prox[0] - 0.14, prox[0])); S.sx *= 1 - 0.2 * a; S.sy *= 1 + 0.03 * a }
    // e chega ainda estreito, abrindo: lê como giro, não como troca de slide
    if (atual[0] > T.giro) S.sx *= 1 - 0.2 * (1 - suave(faixa(dt, 0, 0.16)))
    // pulinho de apoio em cada troca
    for (const v of T.vistas.slice(1)) S.y -= 22 * Math.sin(Math.PI * faixa(t, v[0] - 0.14, v[0] + 0.18))
  }
  // ----- 4. olhos e braços (expressões com micro-atuação)
  if (dentro(t, T.expr, T.cont)) {
    let e = T.exprs[0]
    for (const x of T.exprs) if (t >= x[0]) e = x
    const u = t - e[0]
    switch (e[1]) {
      case 'desconfiado': {                 // olhar de canto, braço cruza, piscada lenta
        S.olho = 'meia'; S.boca = 'torta'
        const canto = suave(faixa(u, 0.3, 0.7)) - suave(faixa(u, 1.4, 1.7)) * 1.6
        S.olhar = [canto, 0]; S.bD = ['oficial', 14 * suave(faixa(u, 0.2, 0.5))]
        S.rot = -2.5 * canto; S.pisca = Math.max(S.pisca, piscar(u, 1.05, 0.5))
        const pre = suave(faixa(u, 2.0, 2.2))           // o susto vem: encolhe e arregala antes
        S.sy *= 1 - 0.08 * pre; S.sx *= 1 + 0.05 * pre; if (pre > 0.5) { S.olho = 'oval'; S.olhar = [0, 0] }
        break
      }
      case 'assustado': {                   // tremer + braços para cima
        S.olho = 'grande'; S.boca = 'o'
        S.bE = ['alto', 30 - 18 * suave(faixa(u, 0.2, 0.9))]; S.bD = ['alto', 30 - 18 * suave(faixa(u, 0.2, 0.9))]
        const tr = u < 0.9 ? (1 - u / 0.9) : 0
        S.x += 9 * tr * Math.sin(u * 95); S.rot = 2 * tr * Math.sin(u * 71)
        if (u > 1.4) { S.olho = 'oval'; S.boca = 'o_pequeno'; S.bE = ['oficial', -10]; S.bD = ['oficial', -10] }
        break
      }
      case 'triste': {                      // murchar: achata, braços caem, olhar para baixo
        const inspira = Math.sin(Math.PI * faixa(u, 0.0, 0.7))      // suspiro: enche...
        const m = suave(faixa(u, 0.5, 1.4))                          // ...e murcha devagar
        S.olho = 'triste'; S.boca = 'triste'
        S.sy *= (1 + 0.06 * inspira) * (1 - 0.15 * m); S.sx *= (1 - 0.02 * inspira) * (1 + 0.06 * m)
        S.olhar = [-0.7 * suave(faixa(u, 1.5, 1.9)), -0.4 * inspira + 0.9 * m]
        S.bE = ['oficial', -8 * inspira + 18 * m]; S.bD = ['oficial', -8 * inspira + 18 * m]
        S.rot = -2 * suave(faixa(u, 1.5, 1.9)) * m
        break
      }
      case 'encantado': {                   // flutua, rubor, brilhos, piscada lenta
        S.olho = 'grande'; S.boca = 'o_pequeno'; S.rubor = suave(faixa(u, 0, 0.4))
        const b = Math.sin(u * 2.6)
        S.bE = ['alto', -6 + 6 * b]; S.bD = ['alto', -6 - 6 * b]
        S.y = -14 * suave(faixa(u, 0, 0.5)) - 8 * Math.sin(u * 2.6); S.sy *= 1.03 + 0.07 * Math.sin(Math.PI * faixa(u, 0, 0.3))
        S.olhar = [0.2 * b, -0.5]; S.pisca = Math.max(S.pisca, piscar(u, 1.25, 0.6))
        break
      }
      case 'não vai': {                     // aponta e balança a cabeça
        S.olho = 'fechado'; S.boca = 'reta'
        const pre = Math.sin(Math.PI * faixa(u, 0, 0.16))           // antecipação: encolhe antes de estufar
        const ap = voltaBack(faixa(u, 0.12, 0.42))
        S.bE = ['aponta', lerp(34, -16, ap)]
        S.sy *= (1 - 0.06 * pre) * (1 + 0.05 * ap); S.sx *= (1 + 0.04 * pre) * (1 - 0.02 * ap)
        const nao = u > 0.6 && u < 1.9 ? Math.sin((u - 0.6) * 14) * (1 - (u - 0.6) / 1.3) : 0
        S.olhar = [nao * 1.4, -0.35 * ap]; S.rot = -4 * ap + 5 * nao; S.x += 14 * nao
        S.x += 40 * (suave(faixa(u, 0, 0.3)) - suave(faixa(u, 2.05, 2.4)))
        if (u > 1.95) S.bE = ['aponta', -16 + 6 * Math.sin((u - 1.95) * 9) * Math.exp(-(u - 1.95) * 3)]   // reafirma
        break
      }
    }
  }
  // ----- 5. o que vai dentro: esvazia, murcha, enche (plim) e transborda
  if (dentro(t, T.cont, T.fecho)) {
    const u = t - T.cont
    for (let i = 0; i < 4; i++) {
      const s = T.sai + i * 0.08, [c0, c1] = vooC[i], [dx, gi, dxv, giv] = VOO[i]
      if (t < s) continue
      if (t < T.cai[i]) {                    // pula fora num arco, girando, e sai do quadro
        S.frutas[i] = null
        const u = (t - s) / 0.75
        if (u < 1) S.voo[i] = { x: c0 + dx * u, y: c1 - 1500 * u + 560 * u * u, rot: gi * u }
      } else {                               // cai de volta por cima e afunda atrás da borda
        const u = (t - T.cai[i]) / T.queda
        if (u < 1) { S.frutas[i] = null; const w = (1 - u) * (1 - u); S.voo[i] = { x: c0 + dxv * w, y: c1 - 1100 * w, rot: giv * (1 - u) } }
        else S.frutas[i] = quedaFruta(t, T.cai[i])
      }
    }
    if (t > T.sai - 0.15 && t < T.sai + 0.25) { const a = Math.sin(Math.PI * faixa(t, T.sai - 0.15, T.sai + 0.25)); S.sy *= 1 + 0.08 * a; S.sx *= 1 - 0.05 * a; S.olho = 'grande'; S.boca = 'o' }
    S.interior = t >= T.sai && t < T.cai[3] + T.queda + 0.05 ? 1 : 0
    const vazio = suave(faixa(t, T.sai + 0.5, T.sai + 1.3))
    const caidas = T.cai.filter(c => t >= c + T.queda).length
    const ultima = Math.max(...T.cai.filter(c => t >= c + T.queda).map(c => c + T.queda), -9)
    const animo = caidas / 4
    if (t > T.sai + 0.25) {
      S.sy *= 1 - 0.14 * vazio * (1 - animo) + 0.05 * mola(t - ultima, 3, 8)
      S.olho = caidas >= 4 ? 'grande' : caidas ? 'oval' : 'triste'
      S.boca = caidas >= 4 ? 'aberta_grande' : caidas ? 'aberta' : 'triste'
      S.bE = ['oficial', 14 * vazio * (1 - animo)]; S.bD = ['oficial', 14 * vazio * (1 - animo)]
      // olha para cima quando a próxima fruta vem
      const vem = T.cai.find(c => t >= c - 0.25 && t < c + T.queda)
      S.olhar = vem ? [0, -1] : [0, caidas ? 0 : 0.8 * vazio]
    }
    for (let i = 0; i < 3; i++) S.extras[i] = t >= T.extra[i] ? quedaFruta(t, T.extra[i], 0.35) : null
    if (t >= T.extra[0]) { S.olho = 'grande'; S.boca = 'aberta_grande'; S.olhar = [0, -0.8] }
    if (t >= T.extra[2] + 0.4) {             // carregar_tudo
      S.olho = 'arco'; S.olhar = [0, 0]
      const seg = suave(faixa(t, T.extra[2] + 0.4, T.extra[2] + 0.6))
      S.bE = seg > 0.5 ? ['segura', 0] : ['oficial', -30 * seg]; S.bD = S.bE
    }
  }
  // ----- 6. fecho: xote e pose final
  if (t >= T.fecho) {
    S.extras = [0, 0, 0]
    const u = t - T.fecho
    S.olho = 'arco'; S.boca = 'aberta_grande'
    if (u < 2.0) {
      const f = Math.sin(2 * Math.PI * u / 1.0)
      S.rot = 6 * f * suave(faixa(u, 0, 0.3)); S.x += 14 * f
      S.y = -16 * Math.abs(Math.sin(2 * Math.PI * u / 1.0))
      S.bD = f > 0 ? ['alto', 6 + 10 * f] : ['oficial', -20 * f]
      S.bE = f < 0 ? ['alto', 6 - 10 * f] : ['oficial', 20 * f]
    } else {
      const v = u - 2.0
      S.olho = v > 0.5 ? 'oval' : 'arco'; S.boca = 'aberta'
      S.bD = ['alto', 10 + 10 * Math.sin(v * 7) * Math.exp(-v * 0.9)]; S.bE = ['oficial', 0]
      S.rot = -3 * mola(v, 1.2, 3)
    }
  }

  // pulos por cima de tudo
  const p = pulo(t)
  if (p) {
    S.y += p.y; S.sx *= p.sx; S.sy *= p.sy; S.ar = p.ar
    if (t < T.nome) S.x = p.x
    if (p.noAr && t < T.nome) { S.bE = ['alto', -4]; S.bD = ['alto', -4]; S.olho = 'grande' }
    if (p.pousou !== undefined && p.pousou < 0.25 && t < T.nome) S.olho = 'arco'
  }
  S.sombra = 1 - 0.55 * cl(-S.y / 300)
  // follow-through do conteúdo: as frutas chegam atrasadas
  S.lag = cl(0.35 * (yCorpo(t - 0.08) - yCorpo(t)), -34, 34)
  return S
}

function quedaFruta(t, t0, d = T.queda) {
  const u = (t - t0) / d
  if (u < 0) return -1300
  if (u < 1) return -1100 * (1 - u) * (1 - u)
  const dt = (u - 1) * d
  return -22 * Math.exp(-dt * 8) * Math.abs(Math.sin(dt * 16))
}

function camera(t) {
  // push-in nas expressões (plano médio -> close) e volta
  // (em volta do meio do corpo, para a alça não subir até o rótulo)
  const z = 1 + 0.18 * (suave(faixa(t, T.expr - 0.2, T.expr + 0.7)) - suave(faixa(t, T.cont - 0.4, T.cont + 0.4)))
  // entrada: plano aberto para os pousos caberem no quadro; fecha no último pulo
  const ze = lerp(0.8, 1, suave(faixa(t, 2.7, 3.75)))
  // abre um pouco enquanto o nome está escrito (em volta do pé)
  const zn = ze * (1 - 0.2 * (suave(faixa(t, T.nome + 0.1, T.nome + 0.7)) - suave(faixa(t, T.giro - 0.6, T.giro)))
    - 0.2 * suave(faixa(t, T.fecho + 1.9, T.fecho + 2.6)))
  // tremida curta no pouso pesado
  const pesado = T.pulos[5].t0 + T.pulos[5].d
  const tre = t > pesado && t < pesado + 0.25 ? 6 * (1 - (t - pesado) / 0.25) * Math.sin((t - pesado) * 80) : 0
  return { z, zn, dy: tre }
}

// ---------------------------------------------------------------- textos
function textos(t) {
  const L = { nome: 0, nomeOp: 0, nomeY: 0, sub: '', subOp: 0, sec: '', item: '', rotOp: 0 }
  // nome: escreve, segura e sai; volta no fecho
  if (t >= T.nome + 0.4 && t < T.giro) {
    L.nome = faixa(t, T.nome + 0.4, T.nome + 1.4); L.nomeOp = 1 - faixa(t, T.giro - 0.7, T.giro - 0.2)
    L.nomeY = -20 * faixa(t, T.giro - 0.7, T.giro - 0.2)
    L.sub = 'o cesto da feira de Serra Pequena'; L.subOp = faixa(t, T.nome + 1.3, T.nome + 1.9) * L.nomeOp
  }
  if (t >= T.fecho + 2.1) {
    L.nome = faixa(t, T.fecho + 2.1, T.fecho + 2.8); L.nomeOp = 1
    L.sub = 'Novela da Caatinga'; L.subOp = faixa(t, T.fecho + 2.7, T.fecho + 3.2)
  }
  // rótulos da reel (escritos à mão, canto de cima)
  const rot = (sec, item, t0, t1) => {
    if (t < t0 || t >= t1) return
    L.sec = sec; L.item = item; L.rotOp = Math.min(faixa(t, t0, t0 + 0.2), 1 - faixa(t, t1 - 0.15, t1))
  }
  const nomes = { frente: 'frente', 'tres-quartos': '3/4', perfil: 'perfil', costas: 'costas' }
  rot('1 · quique', 'antecipação, pulo e pouso', 0.4, 2.75)
  T.vistas.forEach((v, i) => rot('2 · virada', nomes[v[1]], v[0] + (i ? 0 : 0.2), (T.vistas[i + 1] || [T.giro + 5.5])[0]))
  T.exprs.forEach((e, i) => rot('3 · olhos e braços', e[1], e[0] + 0.1, (T.exprs[i + 1] || [T.cont])[0]))
  rot('4 · o que vai dentro', 'vazio', T.sai + 0.4, T.cai[0])
  rot('4 · o que vai dentro', 'cheio', T.cai[0], T.extra[0])
  rot('4 · o que vai dentro', 'transbordando', T.extra[0], T.fecho)
  rot('5 · xote', 'dança', T.fecho, T.fecho + 2.0)
  return L
}

// ---------------------------------------------------------------- aplicar
const mostra = (el, sim) => { const v = sim ? '' : 'none'; if (el.style.display !== v) el.style.display = v }

function aplicar(S, C, L, t) {
  const fr = VISTAS.frente
  for (const [v, g] of Object.entries(VISTAS)) mostra(g, v === S.vista)
  ator.setAttribute('transform',
    `translate(${r(S.x)} ${r(CHAO + S.y)}) rotate(${r(S.rot, 2)}) scale(${r(K * S.sx * S.flip, 3)} ${r(K * S.sy, 3)}) translate(${-W / 2} ${-H})`)
  $('#cam').setAttribute('transform', `translate(${CX} ${r(980 + C.dy)}) scale(${r(C.z, 3)}) translate(${-CX} -980) `
    + `translate(${CX} ${CHAO}) scale(${r(C.zn, 3)}) translate(${-CX} ${-CHAO})`)
  $('#sombra-chao').setAttribute('transform', `translate(${r(S.x)} ${CHAO}) scale(${r(K * 0.98 * S.sombra * (0.85 + 0.15 * S.sx), 3)} ${r(K * 0.98 * S.sombra, 3)})`)
  $('#sombra-chao').setAttribute('opacity', r(0.4 * (0.5 + 0.5 * S.sombra), 3))

  if (S.vista === 'frente') {
    // olhos
    for (const l of ['esq', 'dir']) {
      const forma = S.olho
      for (const e of P.olhos[l]) mostra(e, e.id === `olho-${l}-${forma}`)
      const [cx, cy] = P.olhoCentro[l]
      const fecha = (forma === 'arco' || forma === 'fechado') ? 0 : S.pisca
      P['olho-' + l].setAttribute('transform',
        `translate(${r(cx + S.olhar[0] * 5)} ${r(cy + S.olhar[1] * 4)}) scale(1 ${r(1 - 0.9 * fecha, 3)}) translate(${-cx} ${-cy})`)
    }
    P.rosto.setAttribute('transform', `translate(${r(S.olhar[0] * 12)} ${r(S.olhar[1] * 8)})`)
    for (const e of P.bocas) mostra(e, e.id === `boca-${S.boca}`)
    mostra(P.bochechas, S.rubor > 0); P.bochechas.setAttribute('opacity', r(S.rubor, 2))
    // braços: mostra a peça e gira o .giro em volta do ombro
    for (const [l, [peca, a]] of [['esq', S.bE], ['dir', S.bD]]) {
      for (const e of P.bracos[l]) {
        const on = e.id === `braco-${l}-${peca}`
        mostra(e, on)
        if (on) e.querySelector('.giro').setAttribute('transform', `rotate(${r(l === 'dir' ? a : -a)})`)
      }
    }
    // conteúdo
    mostra(P.interior, S.interior || S.lag < -1.5)   // follow-through: a boca do cesto não pode furar
    P.cheioMolde.setAttribute('transform', `translate(0 ${r(S.lag)})`)
    cheio.forEach((g, i) => { mostra(g, S.frutas[i] !== null); if (S.frutas[i] !== null) g.setAttribute('transform', `translate(0 ${r(S.frutas[i])})`) })
    voo.forEach((g, i) => {
      const v = S.voo[i]; mostra(g, !!v); if (!v) return
      const [c0, c1] = vooC[i]
      g.setAttribute('transform', `translate(${r(v.x - c0)} ${r(v.y - c1)}) rotate(${r(v.rot)} ${r(c0)} ${r(c1)})`)
    })
    extras.forEach((g, i) => { mostra(g, S.extras[i] !== null); if (S.extras[i] !== null) g.setAttribute('transform', `translate(0 ${r(S.extras[i] + S.lag)})`) })
  }

  // poeira dos pousos (a 30/s)
  const pousos = T.pulos.map(p => p.t0 + p.d)
  const ult = Math.max(...pousos.filter(x => x <= t), -9)
  const pu = (t - ult) / 0.5
  poeira.forEach((c, i) => {
    const vis = pu >= 0 && pu < 1
    mostra(c, vis)
    if (!vis) return
    const lado = i % 2 ? 1 : -1, n = Math.floor(i / 2)
    const px = xBase(ult + 0.01) + lado * K * (170 + 60 * n + 120 * pu * (1 + n * 0.3))
    const py = CHAO - 8 - 28 * pu * (1 + n * 0.4) - n * 6
    const s = 1.7 * (0.6 + 0.25 * n) * (0.6 + 0.8 * pu)
    c.setAttribute('transform', `translate(${r(px)} ${r(py)}) scale(${r(s, 2)})`)
    c.setAttribute('opacity', r(0.85 * (1 - pu * pu), 2))
  })
  // brilhos do encanto
  const enc = T.exprs[3][0], encFim = T.exprs[4][0]
  brilhos.forEach((s, i) => {
    const vis = t > enc + 0.2 + i * 0.12 && t < encFim - 0.1
    mostra(s, vis)
    if (!vis) return
    const ang = -2.6 + i * 0.55, raio = K * (360 + 25 * Math.sin(t * 2 + i))
    const sc = 0.5 + 0.5 * Math.abs(Math.sin(t * 3.2 + i * 1.3))
    s.setAttribute('transform', `translate(${r(S.x + Math.cos(ang) * raio)} ${r(CHAO - K * 330 + Math.sin(ang) * raio * 0.8)}) scale(${r(sc, 2)})`)
  })

  // letreiro
  const nome = $('#nome')
  nome.style.opacity = r(L.nomeOp, 3)
  nome.style.transform = `translateY(${r(L.nomeY)}px) rotate(-3deg)`
  const corte = `inset(-30% ${r((1 - L.nome) * 100, 1)}% -30% 0)`
  nome.querySelector('.tinta').style.clipPath = corte
  nome.querySelector('svg').style.clipPath = `inset(0 ${r((1 - cl(L.nome * 1.2 - 0.2)) * 100, 1)}% 0 0)`
  const sub = $('#sub'); if (sub.textContent !== L.sub) sub.textContent = L.sub
  sub.style.opacity = r(L.subOp, 3)
  const rt = $('#rotulo')
  if (rt.children[0].textContent !== L.sec) rt.children[0].textContent = L.sec
  if (rt.children[1].textContent !== L.item) rt.children[1].textContent = L.item
  rt.style.opacity = r(L.rotOp, 3)
}

function seek(t) {
  const tA = Math.floor(t * 15 + 1e-6) / 15          // atuação em dois
  const S = personagem(tA), C = camera(t), L = textos(t)
  aplicar(S, C, L, t)
  // chave de estado: tudo que é visível, já arredondado
  return JSON.stringify([tA, r(C.z, 3), r(C.zn, 3), r(C.dy), Object.values(L).map(v => typeof v === 'number' ? r(v, 3) : v),
    t >= 0 && poeiraAtiva(t) ? r(t, 3) : 0, brilhoAtivo(t) ? r(t, 3) : 0])
}
const poeiraAtiva = t => T.pulos.some(p => t >= p.t0 + p.d && t < p.t0 + p.d + 0.5)
const brilhoAtivo = t => t > T.exprs[3][0] && t < T.exprs[4][0]

;(async () => {
  await document.fonts.load('100px "Caveat Brush"')
  await montar()
  window.DURACAO = DURACAO
  window.seek = seek
  seek(0)
  window.pronto = true
})()
