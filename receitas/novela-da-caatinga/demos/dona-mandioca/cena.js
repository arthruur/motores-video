// Demo de animação da Dona Mandioca (reel de estúdio, 9:16, 39,5 s).
// Contrato do motor (motores/render/CONTRATO.md): tudo é função de t, sem relógio, sem estado.
// A atriz atua "em dois" (pose nova a cada 2 quadros, 15/s, arte/animacao.md §1); câmera e letreiro a 30/s.
//
// Assets: vistas.js (gerado por montar.py a partir de arte/folhas/dona_mandioca_rig.py): 24 rigs completos,
// um a cada 15° (0 = frente, 90 = perfil olhando para a direita da tela, 180 = costas), todos com os mesmos ids.
// Só UMA vista fica no palco; virar é trocar de vista em dois, como recorte de stop-motion.
// fala.json / fala.wav: a frase dela (Gemini TTS, voz Gacrux), com o tempo de cada palavra.
// Os tempos das seções estão em T e REG (abaixo) e os sons em tempos.json; mexeu num, confira o outro.

const DURACAO = 39.5            // 1,5 s de respiro no letreiro final
const CHAO = 1380, CX = 540, K = 0.82            // pés no quadro e escala do rig (quadro de 1254 px)
const RIG_CHAO = 1195, RIG_MEIO = 640
const ROSTO_TELA = CHAO - (RIG_CHAO - (window.DM_META ? DM_META.rosto_y : 404)) * K    // altura dos olhos na tela (câmera em 1)

// ---------------------------------------------------------------- utilidades
const cl = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v))
const lerp = (a, b, u) => a + (b - a) * u
const suave = u => { u = cl(u); return u * u * (3 - 2 * u) }
const faixa = (t, a, b) => cl((t - a) / (b - a))
const mola = (dt, f, am) => dt < 0 ? 0 : Math.exp(-am * dt) * Math.cos(2 * Math.PI * f * dt)
const voltaBack = u => { u = cl(u); const c = 1.7; return 1 + (c + 1) * (u - 1) ** 3 + c * (u - 1) ** 2 }
const r = (v, d = 1) => Number(v.toFixed(d))
const dentro = (t, a, b) => t >= a && t < b
const piscar = (t, t0, d = 0.3) => { const u = faixa(t, t0, t0 + d); return u > 0 && u < 1 ? Math.sin(Math.PI * u) : 0 }

// ---------------------------------------------------------------- linha do tempo
const T = {
  andar: { t0: 0.25, passo: 0.58, n: 8, xa: -30, xb: 540 },     // entra em perfil, passos curtos e pesados
  para: 4.89,                                                     // = t0 + n*passo: último contato
  vira: [[5.35, 90], [5.75, 45], [6.25, 0]],   // 2D: troca de desenho (perfil → 3/4 → frente), segura em cada um
  marca: 6.85,                                                    // a sobrancelha dela aparece
  nome: 7.5, giro: 11.0, regente: 16.4, expr: 22.2, fala: 28.3, fecho: 33.6,
  exprs: [[22.2, 'neutra'], [23.0, 'sobrancelha levantada'], [23.85, 'irônica'], [24.7, 'desconfiada'],
          [25.55, 'brava'], [26.4, 'ri segurando o riso'], [27.25, 'empolgada']],
}
// turnaround 2D: só os desenhos-chave (frente, 3/4, perfil, costas), um corte para cada, sem vistas intermediárias
const GIRO = (() => {
  const chaves = [[11.0, 0, 'frente'], [11.95, 45, '3/4'], [12.75, 90, 'perfil'], [13.75, 180, 'costas'],
                  [14.75, 270, 'perfil'], [15.55, 315, '3/4'], [16.05, 360, 'frente']]
  const passos = []
  for (let i = 0; i < chaves.length; i++) {
    const [t, th] = chaves[i]
    passos.push([t, th % 360])
    const prox = chaves[i + 1]
    if (!prox) break
    const n = 0          // 2D: sem intermediárias (decisão 2026-11-07)
    for (let k = 1; k <= n; k++) passos.push([prox[0] - (n - k + 1) * (2 / 15), (th + 15 * k) % 360])
  }
  passos.sort((a, b) => a[0] - b[0])
  return { chaves, passos }
})()
// regente: antecipação e batida da colher (2x), aponta, rege o xote, corta
const REG = { ant1: 16.55, bat1: 16.95, ant2: 17.35, bat2: 17.7, aponta: 18.25, xote: 19.4, corte: 21.55 }
const BPM_XOTE = 120

// ---------------------------------------------------------------- fala: visemas a partir das palavras
let FALA = null, VIS = []
function visemas(f) {
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
    return null            // d t n l r c g q h: coarticula com a vogal vizinha
  }
  for (const p of f.palavras) {
    let w = p.texto.toLowerCase().replace(/[^a-záàâãéêíóôõúç]/g, '')
    w = w.replace(/qu/g, 'k').replace(/nh/g, 'i').replace(/lh/g, 'i').replace(/ch/g, 'x')
    const seq = []
    for (const ch of w) { const v = mapa(ch); if (v && (!seq.length || seq[seq.length - 1][0] !== v[0])) seq.push(v) }
    if (!seq.length) seq.push(['boca-E', 1])
    const tot = seq.reduce((a, s) => a + s[1], 0)
    let t = p.inicio
    for (const [b, peso] of seq) { const d = (p.fim - p.inicio) * peso / tot; out.push([t, t + d, b]); t += d }
  }
  return out
}
function bocaFala(tf) {               // tf: segundos desde o começo do fala.wav
  if (!FALA || tf < 0 || tf > FALA.duracao) return null
  const e = FALA.env[Math.min(FALA.env.length - 1, Math.floor(tf * 30))] || 0
  for (const [a, b, v] of VIS) if (tf >= a && tf < b) return e < 0.04 ? 'boca-MBP' : v
  return null
}

// ---------------------------------------------------------------- montagem
const $ = s => document.querySelector(s)
const NS = 'http://www.w3.org/2000/svg'
let ator, vistaAtual = null, P = {}, poeira = [], notas = []

function trocarVista(th) {
  if (vistaAtual === th) return
  vistaAtual = th
  ator.innerHTML = window.DM_VISTAS[th]
  const q = id => ator.querySelector(`[id="${id}"]`)
  const pv = el => el.getAttribute('data-pivo').split(' ').map(Number)
  P = { tronco: q('tronco'), lenco: q('acess-lenco'), pontas: q('lenco-pontas'),
        rosto: q('rosto'), boca: q('boca'), bochechas: q('bochechas'), pernas: {}, olhos: {}, sobr: {}, bracos: {} }
  P.pvTronco = pv(P.tronco); P.pvLenco = pv(P.lenco); P.pvPontas = pv(P.pontas); P.pvRosto = pv(P.rosto)
  P.bocas = P.boca ? [...P.boca.children] : []
  for (const l of ['esq', 'dir']) {
    const pe = q('perna-' + l); P.pernas[l] = { el: pe, pv: pv(pe) }
    const o = q('olho-' + l)
    P.olhos[l] = o ? { el: o, pv: pv(o), filhos: [...o.children], vis: o.getAttribute('display') !== 'none' } : null
    const s = q('sobr-' + l)
    P.sobr[l] = s ? { el: s, pv: pv(s), filhos: [...s.children] } : null
    const b = q('braco-' + l)
    const vars = {}
    for (const v of ['reto', 'cintura', 'cruzado']) vars[v] = q(`braco-${l}-${v}`)
    const giro = vars.reto.querySelector('.giro')
    const props = {}
    for (const n of ['colher', 'abano']) {
      const p = q(`prop-${n}-${l}`)
      p.removeAttribute('display')
      props[n] = { el: p, base: p.getAttribute('transform').replace(/rotate\([^)]*\)/, '').trim() }
    }
    for (const el of Object.values(vars)) el.removeAttribute('display')
    P.bracos[l] = { el: b, ombro: pv(b), sent: Number(b.getAttribute('data-sentido')), vars, giro, props }
  }
}

function montar() {
  ator = $('#ator')
  const pg = $('#poeira')
  for (let i = 0; i < 6; i++) {
    const c = document.createElementNS(NS, 'path')
    c.setAttribute('d', 'M-20 0C-20-13-9-21 0-21C12-21 21-12 20 0C20 12 10 19 0 19C-11 19-20 11-20 0Z')
    c.setAttribute('fill', i % 2 ? '#E2B97E' : '#CF9F63')
    pg.appendChild(c); poeira.push(c)
  }
  // notinhas do xote (cabeça em gota + haste + bandeirinha), saem da colher quando ela rege
  for (let i = 0; i < 4; i++) {
    const n = document.createElementNS(NS, 'path')
    n.setAttribute('d', 'M-14 6C-16-4-6-11 4-9C12-7 14 2 8 8C2 13-12 15-14 6ZM6-6L10-62C10-66 16-66 16-62L14-5Z'
      + 'M12-64C24-58 34-50 36-36C30-44 22-48 13-50Z')
    n.setAttribute('fill', i % 2 ? '#8F4523' : '#C5441E')
    $('#notas').appendChild(n); notas.push(n)
  }
  trocarVista(0)
}

// ---------------------------------------------------------------- estado em função de t
function neutro() {
  return {
    x: CX, th: 0,
    tr: { tx: 0, ty: 0, rot: 0, sx: 1, sy: 1 },
    pernas: { esq: [0, 0, 0], dir: [0, 0, 0] },
    lenco: 0, pontas: 0,
    olhos: ['oval', 'oval'], pisca: 0, olhar: [0, 0], rr: 0,
    sobr: [null, null], sobrK: [1, 1],
    boca: 'boca-repouso', rubor: 1,
    bE: ['reto', 58, ['colher', -8]], bD: ['cintura', 0, null],
  }
}
// braço dobrado (cintura/cruzado) só existe de frente e 3/4
const ladoDir = th => { const s = Math.sin(th * Math.PI / 180), c = Math.cos(th * Math.PI / 180); return Math.abs(s) > 0.8 || c < -0.2 }

function passo(t) {
  const A = T.andar
  const fi = (t - A.t0) / A.passo
  if (fi < 0 || fi >= A.n) return null
  return { n: Math.floor(fi), f: fi - Math.floor(fi), fi }
}

function personagem(t) {
  const S = neutro()
  S.tr.sy *= 1 + 0.012 * Math.sin(2 * Math.PI * t / 3.6)            // respira
  S.pisca = Math.max(...[4.95, 8.9, 10.6, 16.25, 20.6, 27.9, 31.05, 35.3, 38.55].map(x => piscar(t, x)))
  const A = T.andar

  // ----- 1. entra andando (perfil, olhando para a direita): passo curto, pesado e decidido
  if (t < T.vira[0][0]) {
    S.th = 90
    S.olhos = ['decidido', 'decidido']; S.boca = 'boca-firme'; S.sobr = ['baixa', 'baixa']
    S.bD = ['reto', 10, null]
    const p = passo(t)
    const L = (A.xb - A.xa) / A.n / K                                  // passada no quadro do rig = o quanto ela anda (pé não escorrega)
    if (p) {
      S.x = A.xa + (A.xb - A.xa) * (p.fi / A.n)
      const ida = p.n % 2 ? 'esq' : 'dir', fica = p.n % 2 ? 'dir' : 'esq'
      const ini = p.n === 0 ? 0 : 1                                     // primeiro passo sai dos pés juntos
      const ult = p.n === A.n - 1                                       // último passo: junta os pés
      const sw = suave(p.f)
      const ergue = Math.sin(Math.PI * cl(p.f / 0.8))
      S.pernas[ida] = [lerp(-L / 2 * ini, ult ? 0 : L / 2, sw), -26 * ergue, 7 * ergue]
      S.pernas[fica] = [lerp(p.n === 0 ? 0 : L / 2, ult ? 0 : -L / 2, p.f), 0, 0]
      // contato (f=0): afunda e achata; passagem (f=.5): sobe
      const bob = Math.cos(2 * Math.PI * p.f)
      S.tr.ty = 9 * bob; S.tr.sy *= 1 - 0.025 * Math.max(bob, 0); S.tr.sx *= 1 + 0.015 * Math.max(bob, 0)
      S.tr.rot = 3.5 + 1.2 * Math.sin(2 * Math.PI * p.f)               // inclina para a frente, decidida
      // braços balançam ao contrário das pernas; a colher marca o passo
      const bal = Math.sin(Math.PI * p.fi)
      S.bE = ['reto', 26 * bal, ['colher', -8 - 10 * bal]]; S.bD = ['reto', -22 * bal, null]
      // follow-through: pontas do lenço chegam atrasadas
      S.pontas = -7 * Math.cos(2 * Math.PI * (p.f - 0.18)); S.lenco = 1.5 * Math.cos(2 * Math.PI * (p.f - 0.12))
    } else if (t < A.t0) {
      S.x = A.xa
    } else {                                                            // parou: arrasto e assentamento
      S.x = A.xb
      const d = t - T.para
      S.tr.rot = 3.5 * mola(d, 1.6, 4.5) + 2.5 * Math.exp(-d * 6) * Math.sin(d * 14)
      S.tr.ty = 10 * mola(d, 2.2, 7); S.tr.sy *= 1 - 0.04 * Math.max(mola(d, 2.2, 7), 0)
      S.pontas = 14 * mola(d - 0.06, 1.7, 3.5); S.lenco = 3 * mola(d - 0.04, 1.7, 4)
      S.bE = ['reto', 10 * mola(d, 1.4, 4), ['colher', -8]]; S.bD = ['reto', -8 * mola(d, 1.4, 4), null]
      S.boca = 'boca-repouso'; S.sobr = [null, null]; S.olhos = ['oval', 'oval']
    }
  }
  // ----- 2. vira devagar para a câmera; a sobrancelha dela aparece
  if (dentro(t, T.vira[0][0], T.nome)) {
    S.x = A.xb
    let th = 90
    for (const [tv, v] of T.vira) if (t >= tv) th = v
    S.th = th
    if (ladoDir(th)) S.bD = ['reto', 8, null]
    S.bE = ['reto', 30 + 28 * (1 - th / 90) * 1, ['colher', -8]]
    const tv = Math.max(...T.vira.map(v => v[0]).filter(x => x <= t))
    S.tr.rot = -1.2 * mola(t - tv, 2.4, 8); S.pontas = 8 * mola(t - tv - 0.05, 2, 5)
    S.lenco = 2 * mola(t - tv - 0.03, 2, 6)
    if (t >= T.marca) {                                // a marca dela: a sobrancelha sobe e o olho fecha um tico
      const u = t - T.marca
      S.sobr = ['levantada', null]; S.sobrK = [lerp(0.4, 1, voltaBack(faixa(u, 0, 0.2))), 1]
      S.olhos = ['oval', 'meia-lua']; S.boca = 'boca-firme'
      S.tr.rot = -1.5 * suave(faixa(u, 0, 0.3))
    }
  }
  // ----- 3. nome: se apresenta, colher como cetro
  if (dentro(t, T.nome, T.giro)) {
    const u = t - T.nome
    S.th = 0
    const cet = suave(faixa(u, 0.3, 0.8)) - suave(faixa(u, 2.6, 3.1))
    S.bE = ['reto', lerp(58, 118, voltaBack(faixa(u, 0.3, 0.75)) * (1 - suave(faixa(u, 2.6, 3.1)))), ['colher', lerp(-8, -22, cet)]]
    S.olhos = cet > 0.5 ? ['arco', 'arco'] : ['oval', 'oval']
    S.boca = cet > 0.5 ? 'boca-aberta' : 'boca-repouso'
    S.tr.rot = -2 * cet; S.tr.sy *= 1 + 0.03 * cet
    S.pontas = 7 * mola(u - 0.42, 1.8, 4)
    if (u < 0.25) { S.sobr = ['levantada', null]; S.sobrK = [1 - suave(faixa(u, 0, 0.25)) * 0.6, 1] }   // some
    if (u > 3.2) { S.tr.rot += 2.2 * Math.sin((u - 3.2) * 9) * Math.exp(-(u - 3.2) * 2) }             // assente
  }
  // ----- 4. turnaround
  if (dentro(t, T.giro, T.regente)) {
    let th = 0, tv = T.giro
    for (const [tp, v] of GIRO.passos) if (t >= tp) { th = v; tv = tp }
    S.th = th
    if (ladoDir(th)) S.bD = ['reto', 10, null]
    S.bE = ['reto', 26, ['colher', -6]]
    const chave = GIRO.chaves.some(c => Math.abs(c[0] - tv) < 0.01)
    S.pontas = (chave ? 11 : 4) * mola(t - tv - 0.05, 1.9, 4.5)
    S.tr.rot = 1.2 * mola(t - tv, 2.2, 7)
  }
  // ----- 5. regente: bate a colher, aponta, rege o xote
  if (dentro(t, T.regente, T.expr)) {
    S.th = 0
    S.olhos = ['decidido', 'decidido']; S.sobr = ['brava', 'brava']
    const golpe = (ta, tb) => {           // antecipação (ta→tb) e batida em tb
      if (t < ta) return null
      if (t < tb) {
        const u = suave(faixa(t, ta, tb))
        return { a: lerp(58, 165, u), p: lerp(-8, -35, u), rot: -5 * u, sy: 1 - 0.03 * u, ty: 6 * u, boca: 'boca-MBP', olhos: ['decidido', 'decidido'] }
      }
      const d = t - tb
      const u = cl(d / 0.07)
      return { a: lerp(165, 40, u) + 6 * mola(d - 0.07, 3, 9), p: lerp(-35, -145, u), rot: 4 * (1 - suave(faixa(d, 0.15, 0.4))),
               sy: 1 - 0.05 * (1 - suave(faixa(d, 0.1, 0.35))), ty: 12 * (1 - suave(faixa(d, 0.1, 0.35))), boca: d < 0.3 ? 'boca-O' : 'boca-firme',
               olhos: ['decidido', 'decidido'] }
    }
    const g = t < REG.ant2 ? golpe(REG.ant1, REG.bat1) : golpe(REG.ant2, REG.bat2)
    if (g && t < REG.aponta) {
      S.bE = ['reto', g.a, ['colher', g.p]]; S.tr.rot = g.rot; S.tr.sy *= g.sy; S.tr.ty = g.ty; S.boca = g.boca; S.olhos = g.olhos
      const tb = t < REG.ant2 ? REG.bat1 : REG.bat2
      S.pontas = -14 * mola(t - tb - 0.04, 2.2, 4.5); S.lenco = -3 * mola(t - tb, 2.2, 6)
    } else if (!g) S.boca = 'boca-firme'
    if (t >= REG.aponta && t < REG.xote) {          // aponta para quem está vendo, e reafirma
      const u = t - REG.aponta
      const ap = voltaBack(faixa(u, 0, 0.3)), re = Math.max(0, u - 0.6)
      S.bE = ['reto', lerp(40, 92, ap) + 5 * Math.sin(re * 11) * Math.exp(-re * 3.5), ['colher', lerp(-145, -88, ap)]]
      S.sobr = ['brava', 'levantada']; S.olhos = ['decidido', 'oval']; S.boca = 'boca-firme'
      S.tr.rot = -3 * ap; S.pontas = 9 * mola(u - 0.08, 1.8, 4)
    }
    if (t >= REG.xote && t < REG.corte) {           // rege o xote: a colher marca o 2/4
      const u = t - REG.xote, bt = u * BPM_XOTE / 60
      const fase = bt % 2, lev = suave(faixa(u, 0, 0.3))
      const a = fase < 1 ? lerp(140, 80, suave(fase)) : lerp(80, 140, suave(fase - 1))
      S.bE = ['reto', lerp(92, a, lev), ['colher', lerp(-88, -30 - 0.3 * (a - 80), lev)]]
      S.olhos = ['arco', 'arco']; S.sobr = [null, null]; S.boca = fase < 1 ? 'boca-aberta' : 'boca-repouso'
      const pulso = Math.exp(-((bt % 1) * 5))
      S.tr.sy *= 1 - 0.03 * pulso; S.tr.ty = 6 * pulso; S.tr.rot = 2.5 * Math.sin(Math.PI * bt / 2)
      S.pontas = -6 * Math.sin(Math.PI * bt - 0.9); S.lenco = 1.5 * Math.sin(Math.PI * bt - 0.6)
    }
    if (t >= REG.corte) {                           // corta a música: colher para baixo, segura
      const d = t - REG.corte
      S.bE = ['reto', lerp(140, 30, cl(d / 0.08)) + 5 * mola(d - 0.08, 2.5, 6), ['colher', lerp(-30, -150, cl(d / 0.08))]]
      S.olhos = ['oval', 'meia-lua']; S.sobr = ['levantada', null]; S.boca = 'boca-firme'
      S.tr.rot = 2 * mola(d, 1.5, 4); S.pontas = -10 * mola(d - 0.05, 1.8, 4)
    }
  }
  // ----- 6. expressões (close): troca de peça, a sobrancelha aparece e some
  if (dentro(t, T.expr, T.fala)) {
    S.th = 0
    let e = T.exprs[0]
    for (const x of T.exprs) if (t >= x[0]) e = x
    const u = t - e[0]
    const pop = 1 - 0.05 * Math.sin(Math.PI * faixa(u, 0, 0.14))     // cada troca: um respiro curto
    S.tr.sy *= pop; S.tr.sx *= 2 - pop
    const sk = lerp(0.4, 1, voltaBack(faixa(u, 0.02, 0.2)))          // sobrancelha nova entra crescendo
    S.bE = ['reto', 20, ['colher', -6]]
    switch (e[1]) {
      case 'neutra': {                                                  // vem do corte do xote: a colher sobe sem estalo
        const k = suave(faixa(u, 0.05, 0.45))
        S.bE = ['reto', lerp(30, 20, k), ['colher', lerp(-150, -6, k)]]; S.boca = 'boca-repouso'; break
      }
      case 'sobrancelha levantada':
        S.olhos = ['meia-lua', 'oval']; S.sobr = ['baixa', 'levantada']; S.sobrK = [sk, sk]; S.boca = 'boca-firme'
        S.rr = -2; S.rubor = 0; break
      case 'irônica':
        S.olhos = ['meia-lua', 'oval']; S.sobr = [null, 'levantada']; S.boca = 'boca-torta'
        S.olhar = [lerp(0, 12, suave(faixa(u, 0.1, 0.35))), 0]; S.rr = -3; S.rubor = 0; break
      case 'desconfiada':
        S.olhos = ['meia-lua', 'meia-lua']; S.sobr = ['baixa', 'baixa']; S.sobrK = [sk, sk]; S.boca = 'boca-reta'
        S.olhar = [-10 * Math.sin(Math.PI * faixa(u, 0.15, 0.75)), 0]; S.rubor = 0
        S.bE = ['reto', 14, ['colher', -6]]; S.tr.rot = -1.5; break
      case 'brava':
        S.olhos = ['decidido', 'decidido']; S.sobr = ['brava', 'brava']; S.sobrK = [sk, sk]; S.boca = u < 0.3 ? 'boca-O' : 'boca-triste'; S.rubor = 0
        S.bE = ['reto', lerp(20, 100, voltaBack(faixa(u, 0, 0.25))), ['colher', -70]]
        S.tr.rot = -3; S.tr.tx = 3 * Math.sin(u * 60) * Math.exp(-u * 6); break
      case 'ri segurando o riso': {
        S.olhos = ['arco', 'arco']; S.boca = 'boca-ondulada'; S.rubor = 1.6
        const ri = Math.sin(u * 38) * (0.6 + 0.4 * Math.sin(u * 5))
        S.tr.sy *= 1 + 0.012 * ri; S.tr.ty = -2 * ri; S.rr = 2
        S.bD = ['reto', -100, null]; S.bE = ['reto', 10, ['colher', -6]]; break
      }
      case 'empolgada': {
        const up = voltaBack(faixa(u, 0.08, 0.35))
        S.olhos = ['arco', 'arco']; S.boca = 'boca-A'
        S.bE = ['reto', lerp(20, 150, up), ['colher', -10]]; S.bD = ['reto', lerp(0, 150, up), null]
        S.tr.ty = -26 * up + 8 * Math.sin(Math.PI * faixa(u, 0, 0.08))
        S.tr.sy *= 1 + 0.07 * up - 0.05 * Math.sin(Math.PI * faixa(u, 0, 0.1)); S.tr.sx *= 1 - 0.03 * up
        S.pontas = -12 * mola(u - 0.3, 2, 4); S.rubor = 1.3
        const vol = suave(faixa(u, 0.75, 1.0))                        // volta à compostura (base larga, não se curva)
        S.tr.ty *= 1 - vol; S.tr.sy = lerp(S.tr.sy, 1, vol); S.tr.sx = lerp(S.tr.sx, 1, vol)
        if (vol > 0.5) { S.bE = ['reto', 58, ['colher', -8]]; S.bD = ['cintura', 0, null]; S.olhos = ['oval', 'oval']; S.boca = 'boca-repouso' }
        break
      }
    }
  }
  // ----- 7. fala: "Aqui na casa de farinha quem manda sou eu... mas pode entrar."
  if (dentro(t, T.fala, T.fecho)) {
    S.th = 0
    const u = t - T.fala, tf = u - 0.25
    const w = FALA ? FALA.palavras : []
    const ti = i => w[i] ? w[i].inicio : 99
    S.olhos = ['decidido', 'oval']; S.sobr = ['baixa', 'levantada']; S.boca = 'boca-firme'; S.rubor = 0.6
    // "Aqui": a colher aponta o chão da casa de farinha
    const aqui = suave(faixa(tf, -0.2, 0.15)) - suave(faixa(tf, ti(4), ti(5)))
    S.bE = ['reto', lerp(58, 34, aqui), ['colher', lerp(-8, -150, aqui)]]
    // "quem manda sou eu": cresce, colher como cetro
    const manda = suave(faixa(tf, ti(5) - 0.1, ti(6) + 0.1)) - suave(faixa(tf, ti(8) + 0.25, ti(9)))
    if (manda > 0) {
      S.bE = ['reto', lerp(34, 110, manda), ['colher', -12]]
      S.tr.sy *= 1 + 0.035 * manda; S.tr.rot = -2.5 * manda; S.sobrK = [1, 1 + 0.12 * manda]
    }
    // a pausa: olha de lado antes do "mas"
    if (tf > ti(8) + 0.15 && tf < ti(9)) { S.olhar = [-9, 0]; S.olhos = ['meia-lua', 'meia-lua'] }
    // "mas pode entrar": amolece, convida com a mão aberta
    const conv = suave(faixa(tf, ti(9), ti(10)))
    if (conv > 0) {
      S.sobr = [null, null]; S.olhos = conv > 0.5 ? ['arco', 'arco'] : ['oval', 'oval']; S.rubor = 1 + 0.4 * conv
      S.bD = conv > 0.15 ? ['reto', lerp(10, 66, voltaBack(faixa(tf, ti(9), ti(10) + 0.2))), null] : ['cintura', 0, null]
      S.bE = ['reto', 58 - 20 * conv, ['colher', -8]]
      S.tr.rot = 2.5 * conv; S.rr = 3 * conv
    }
    const bf = bocaFala(tf)
    if (bf) S.boca = bf
    else if (tf > 0.5) S.boca = conv > 0.5 ? 'boca-aberta' : 'boca-repouso'
    S.pontas = 5 * Math.sin(u * 2.2)
  }
  // ----- 8. fecho: comovida — desvia o olhar, ajeita o lenço; volta com a sobrancelha dela
  if (t >= T.fecho) {
    S.th = 0
    const u = t - T.fecho
    const des = suave(faixa(u, 0.1, 0.45))
    S.olhos = ['triste', 'fechado']; S.olhar = [-20 * des, 6 * des]; S.rr = 4 * des; S.rubor = 1 + 0.7 * des
    S.sobr = ['triste', null]; S.sobrK = [lerp(0.4, 1, voltaBack(faixa(u, 0.1, 0.3))), 1]
    S.boca = 'boca-repouso'; S.tr.rot = 3 * des
    // sai do convite da fala sem estalo: braço convidando desce, colher continua de pé
    S.bE = ['reto', lerp(38, 22, des), ['colher', -8]]
    S.bD = ['reto', lerp(66, 12, suave(faixa(u, 0, 0.5))), null]
    const sobe = voltaBack(faixa(u, 0.55, 0.95)), desce = suave(faixa(u, 1.75, 2.15))
    if (u > 0.5 && u < 2.2) {
      const al = sobe * (1 - desce)                  // braço de borracha: estica e o ombro sobe até a borda do lenço
      S.bD = ['reto', lerp(12, 174, al), null, 1 + 0.5 * al, 46 * al]
      const puxa = Math.sin(Math.PI * faixa(u, 1.0, 1.5))
      S.bD[1] -= 6 * puxa                            // a patinha puxa o lenço para baixo
      S.lenco = -5 * puxa + 2.5 * mola(u - 1.5, 1.8, 4); S.pontas = 12 * mola(u - 1.05, 1.6, 3.2)
      S.tr.rot = 3 * des + 2.5 * al                  // a cabeça vai ao encontro da mão
    } else if (u >= 2.2) {
      S.bD = ['reto', lerp(12, 0, suave(faixa(u, 2.2, 2.5))), null]
      if (u >= 2.5) S.bD = ['cintura', 0, null]
      S.pontas = 4 * mola(u - 2.2, 1.6, 3)
    }
    if (u > 2.5) {
      const v = suave(faixa(u, 2.5, 2.8))
      S.olhar = [-20 * (1 - v), 6 * (1 - v)]; S.rr = 4 * (1 - v); S.tr.rot = 3 * (1 - v)
      S.olhos = ['oval', 'meia-lua']; S.sobr = ['levantada', null]; S.sobrK = [lerp(0.4, 1, voltaBack(faixa(u, 2.55, 2.75))), 1]
      S.boca = 'boca-firme'; S.rubor = 1.3
      S.bE = ['reto', lerp(22, 58, v), ['colher', -8]]
    }
  }
  return S
}

function camera(t) {
  // plano geral; abre ao escrever o nome; fecha no rosto nas expressões; médio na fala
  const nome = suave(faixa(t, T.nome + 0.1, T.nome + 0.7)) - suave(faixa(t, T.giro - 0.5, T.giro))
  const fim = suave(faixa(t, T.fecho + 2.6, T.fecho + 3.3))
  const zn = 1 - 0.14 * nome - 0.14 * fim
  const close = suave(faixa(t, T.expr - 0.3, T.expr + 0.5)) - suave(faixa(t, T.fala - 0.4, T.fala + 0.2))
  const medio = suave(faixa(t, T.fala - 0.4, T.fala + 0.2)) - suave(faixa(t, T.fecho + 2.4, T.fecho + 3.1))
  const reg = 0.12 * (suave(faixa(t, REG.aponta - 0.1, REG.aponta + 0.35)) - suave(faixa(t, REG.xote - 0.1, REG.xote + 0.4)))
  const z = 1 + 0.75 * close + 0.32 * medio + reg
  const dy = 300 * close + 170 * medio
  let tre = 0                                        // tremida curta na batida da colher
  for (const tb of [REG.bat1, REG.bat2, REG.corte]) if (t > tb && t < tb + 0.2) tre = 7 * (1 - (t - tb) / 0.2) * Math.sin((t - tb) * 90)
  return { z, zn, dy: dy + tre }
}

// ---------------------------------------------------------------- textos
const FRASE = ['Aqui na casa de farinha quem manda sou eu...', 'mas pode entrar.']
function textos(t) {
  const L = { nome: 0, nomeOp: 0, nomeY: 0, sub: '', subOp: 0, sec: '', item: '', rotOp: 0, fala: '', falaOp: 0, falaN: 0 }
  if (t >= T.nome + 0.25 && t < T.giro) {
    L.nome = faixa(t, T.nome + 0.25, T.nome + 1.35); L.nomeOp = 1 - faixa(t, T.giro - 0.6, T.giro - 0.15)
    L.nomeY = -20 * faixa(t, T.giro - 0.6, T.giro - 0.15)
    L.sub = 'a dona da casa de farinha'; L.subOp = faixa(t, T.nome + 1.3, T.nome + 1.9) * L.nomeOp
  }
  if (t >= T.fecho + 2.9) {
    L.nome = faixa(t, T.fecho + 2.9, T.fecho + 3.8); L.nomeOp = 1
    L.sub = 'Novela da Caatinga'; L.subOp = faixa(t, T.fecho + 3.7, T.fecho + 4.2)
  }
  const rot = (sec, item, t0, t1) => {
    if (t < t0 || t >= t1) return
    L.sec = sec; L.item = item; L.rotOp = Math.min(faixa(t, t0, t0 + 0.2), 1 - faixa(t, t1 - 0.15, t1))
  }
  rot('1 · andar', 'passo curto e pesado', 0.5, T.vira[0][0] - 0.1)
  rot('1 · andar', 'vira devagar', T.vira[0][0], T.nome - 0.1)
  GIRO.chaves.forEach((c, i) => rot('2 · virada', c[2], c[0] + (i ? -0.1 : 0.15), (GIRO.chaves[i + 1] || [T.regente])[0] - 0.1))
  rot('3 · regente', 'bate a colher', REG.ant1 - 0.1, REG.aponta)
  rot('3 · regente', 'aponta', REG.aponta, REG.xote)
  rot('3 · regente', 'rege o xote', REG.xote, T.expr - 0.2)
  T.exprs.forEach((e, i) => rot('4 · expressões', e[1], e[0] + 0.05, (T.exprs[i + 1] || [T.fala - 0.3])[0]))
  rot('6 · comovida', 'desvia o olhar, ajeita o lenço', T.fecho + 0.2, T.fecho + 2.7)
  // legenda da fala, escrita à mão palavra por palavra (rótulo "5 · fala" fica no lugar do rótulo)
  if (FALA && t >= T.fala - 0.2 && t < T.fecho - 0.1) {
    const tf = t - T.fala - 0.25
    const n = FALA.palavras.filter(p => tf >= p.inicio - 0.05).length
    const parte = n <= 9 ? 0 : 1
    L.fala = FRASE[parte]; L.falaN = parte ? n - 9 : n
    L.falaOp = Math.min(faixa(t, T.fala - 0.2, T.fala), 1 - faixa(t, T.fecho - 0.4, T.fecho - 0.1))
  }
  return L
}

// ---------------------------------------------------------------- aplicar
const mostra = (el, sim) => { const v = sim ? '' : 'none'; if (el.style.display !== v) el.style.display = v }

function aplicarBraco(l, [varr, a, prop, estica = 1, ergue = 0]) {
  const B = P.bracos[l]
  B.el.setAttribute('transform', `translate(${B.ombro[0]} ${r(B.ombro[1] - ergue)})`)
  if (varr !== 'reto' && ladoDir(vistaAtual)) { varr = 'reto'; a = 10 }
  for (const [v, el] of Object.entries(B.vars)) mostra(el, v === varr)
  B.giro.setAttribute('transform', `rotate(${r(-a * B.sent, 1)}) scale(1 ${r(estica, 3)})`)
  for (const [n, p] of Object.entries(B.props)) {
    const on = varr === 'reto' && !!prop && prop[0] === n
    mostra(p.el, on)
    if (on) p.el.setAttribute('transform', `${p.base} rotate(${r(prop[1] + a * B.sent, 1)})`)
  }
}

function aplicar(S, C, L, t) {
  trocarVista(S.th)
  ator.setAttribute('transform', `translate(${r(S.x)} ${CHAO}) scale(${K}) translate(${-RIG_MEIO} ${-RIG_CHAO})`)
  const [hx, hy] = P.pvTronco, tr = S.tr
  P.tronco.setAttribute('transform', `translate(${r(tr.tx)} ${r(tr.ty)}) translate(${hx} ${hy}) rotate(${r(tr.rot, 2)}) scale(${r(tr.sx, 3)} ${r(tr.sy, 3)}) translate(${-hx} ${-hy})`)
  for (const l of ['esq', 'dir']) {
    const pe = P.pernas[l], [dx, dy, rot] = S.pernas[l]
    pe.el.setAttribute('transform', `translate(${r(dx)} ${r(dy)}) rotate(${r(rot, 1)} ${pe.pv[0]} ${pe.pv[1]})`)
  }
  P.lenco.setAttribute('transform', `rotate(${r(S.lenco, 2)} ${P.pvLenco[0]} ${P.pvLenco[1]})`)
  P.pontas.setAttribute('transform', `rotate(${r(S.pontas, 2)} ${P.pvPontas[0]} ${P.pvPontas[1]})`)
  if (P.rosto.getAttribute('display') !== 'none') {
    P.rosto.setAttribute('transform', `translate(${r(S.olhar[0])} ${r(S.olhar[1])}) rotate(${r(S.rr, 1)} ${P.pvRosto[0]} ${P.pvRosto[1]})`)
    S.olhos.forEach((forma, i) => {
      const l = i ? 'dir' : 'esq', O = P.olhos[l]
      if (!O) return
      for (const e of O.filhos) { e.removeAttribute('display'); mostra(e, e.id === `olho-${l}-${forma}`) }
      const fecha = (forma === 'arco' || forma === 'fechado') ? 0 : S.pisca
      const [cx, cy] = O.pv
      O.el.setAttribute('transform', `translate(${cx} ${cy}) scale(1 ${r(1 - 0.9 * fecha, 3)}) translate(${-cx} ${-cy})`)
      const Sb = P.sobr[l], modo = S.sobr[i]
      if (!Sb) return
      const vis = !!modo && O.vis
      Sb.el.removeAttribute('display'); mostra(Sb.el, vis)
      if (vis) {
        for (const e of Sb.filhos) { e.removeAttribute('display'); mostra(e, e.id === `sobr-${l}-${modo}`) }
        const [sx, sy] = Sb.pv, k = S.sobrK[i]
        Sb.el.setAttribute('transform', `translate(${sx} ${sy}) scale(${r(k, 3)}) translate(${-sx} ${-sy})`)
      }
    })
    for (const e of P.bocas) { e.removeAttribute('display'); mostra(e, e.id === S.boca) }
    P.bochechas.setAttribute('opacity', r(cl(S.rubor, 0, 2), 2))
  }
  aplicarBraco('esq', S.bE); aplicarBraco('dir', S.bD)

  // câmera: zoom em volta dos olhos (com dy) e abertura em volta dos pés
  $('#cam').setAttribute('transform', `translate(${CX} ${r(ROSTO_TELA + C.dy)}) scale(${r(C.z, 3)}) translate(${-CX} ${-r(ROSTO_TELA)}) `
    + `translate(${CX} ${CHAO}) scale(${r(C.zn, 3)}) translate(${-CX} ${-CHAO})`)

  // poeira dos passos (a 30/s)
  const A = T.andar
  const contatos = []
  for (let n = 1; n <= A.n; n++) contatos.push(A.t0 + n * A.passo)
  const ult = Math.max(...contatos.filter(x => x <= t), -9)
  const pu = (t - ult) / 0.45
  poeira.forEach((c, i) => {
    const vis = pu >= 0 && pu < 1
    mostra(c, vis)
    if (!vis) return
    const lado = i % 2 ? 1 : -1, n = Math.floor(i / 2)
    const xb = A.xa + (A.xb - A.xa) * ((ult - A.t0) / A.passo / A.n)
    const px = xb + lado * (60 + 34 * n + 70 * pu * (1 + n * 0.3))
    const py = CHAO - 6 - 18 * pu * (1 + n * 0.4) - n * 4
    c.setAttribute('transform', `translate(${r(px)} ${r(py)}) scale(${r((0.45 + 0.2 * n) * (0.6 + 0.7 * pu), 2)})`)
    c.setAttribute('opacity', r(0.6 * (1 - pu), 2))
  })
  // notinhas do xote: saem do lado da colher no tempo e sobem
  notas.forEach((nt, i) => {
    const t0 = REG.xote + 0.25 + i * 0.5
    const u = (t - t0) / 1.1
    const vis = u >= 0 && u < 1 && t < REG.corte + 0.3
    mostra(nt, vis)
    if (!vis) return
    const x = 250 + i * 30 + 50 * u + 14 * Math.sin(u * 7 + i), y = ROSTO_TELA - 140 - 240 * u
    nt.setAttribute('transform', `translate(${r(x)} ${r(y)}) rotate(${r(-12 + 20 * Math.sin(u * 5 + i))}) scale(${r(0.9 + 0.3 * Math.sin(Math.PI * u), 2)})`)
    nt.setAttribute('opacity', r(Math.sin(Math.PI * u), 2))
  })

  // letreiro
  const nome = $('#nome')
  nome.style.opacity = r(L.nomeOp, 3)
  nome.style.transform = `translateY(${r(L.nomeY)}px) rotate(-3deg)`
  nome.querySelector('.tinta').style.clipPath = `inset(-30% ${r((1 - L.nome) * 100, 1)}% -30% 0)`
  nome.querySelector('svg').style.clipPath = `inset(0 ${r((1 - cl(L.nome * 1.2 - 0.2)) * 100, 1)}% 0 0)`
  const sub = $('#sub'); if (sub.textContent !== L.sub) sub.textContent = L.sub
  sub.style.opacity = r(L.subOp, 3)
  const rt = $('#rotulo')
  if (rt.children[0].textContent !== L.sec) rt.children[0].textContent = L.sec
  if (rt.children[1].textContent !== L.item) rt.children[1].textContent = L.item
  rt.style.opacity = r(L.rotOp, 3)
  const fa = $('#fala')
  const chave = L.fala + '|' + L.falaN
  if (fa.dataset.k !== chave) {
    fa.dataset.k = chave
    fa.innerHTML = L.fala.split(' ').map((p, i) => `<span style="opacity:${i < L.falaN ? 1 : 0}">${p}</span>`).join(' ')
  }
  fa.style.opacity = r(L.falaOp, 3)
}

function seek(t) {
  const tA = Math.floor(t * 15 + 1e-6) / 15          // atuação em dois
  const S = personagem(tA), C = camera(t), L = textos(t)
  aplicar(S, C, L, t)
  const vivo = (t > T.andar.t0 && t < T.para + 0.5) || (t > REG.xote && t < REG.corte + 0.4)   // poeira e notas a 30/s
  return JSON.stringify([tA, r(C.z, 3), r(C.zn, 3), r(C.dy), Object.values(L).map(v => typeof v === 'number' ? r(v, 3) : v),
    vivo ? r(t, 3) : 0])
}

;(async () => {
  await document.fonts.load('100px "Caveat Brush"')
  try {
    FALA = await (await fetch('fala.json')).json()
    VIS = visemas(FALA)
  } catch (e) { FALA = null }                         // sem fala.json: a demo roda sem fala (boca em repouso)
  montar()
  window.DURACAO = DURACAO
  window.seek = seek
  seek(0)
  window.pronto = true
})()
