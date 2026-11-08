// receitas/novela-da-caatinga/kit/efeitos.js
// Presets oficiais dos 11 efeitos visuais da serie "Novela da Caatinga".
// 100% deterministicos em funcao pura de (ctx, dt, dur, params), usando exclusivamente
// a PALETA oficial, zero contorno (stroke="none"), zero preto puro, com antecipacao e follow-through.

import { PALETA } from './paleta.js'
import {
  r,
  lim,
  mix,
  emDois,
  suave,
  entrada,
  saida,
  entradaSaida,
  arco,
  antecipar,
  mola,
  followThrough,
  hash,
  ruidoSuave,
  caminhoBlob,
} from '../../../motores/animacao/timeline.js'
import {
  gotaOrganica,
  estrelaQuatroPontas,
  nuvemOrganica,
  cunhaRadial,
  fitaOndulada,
  folhaOrganica,
  defsEfeitos,
  criarRegistroEfeitos,
} from '../../../motores/animacao/efeitos.js'

function obterPaleta(ctx) {
  return ctx?.paleta || PALETA
}

/**
 * 1. poeira_pouso
 * Nuvens organicas em PALETA.cenario.chao_terra (sombra, meio, base, luz).
 * Nos primeiros 12% (dt/dur < 0.12), achata junto ao chao (antecipacao do impacto);
 * depois abre lobulos laterais esquerdo e direito em arco raso com saida(u),
 * subindo levemente e dissipando com followThrough.
 */
export function poeira_pouso(ctx, dt, dur, params = {}) {
  const pal = obterPaleta(ctx)
  const terra = pal.cenario.chao_terra
  const { x, y, escala = 1, semente = 1 } = ctx
  const u = lim(dt / dur)
  const larguraBase = (params.largura ?? 155) * escala

  const partes = []

  if (u < 0.12) {
    // Antecipacao do impacto: compressao achatada junto ao chao
    const ua = u / 0.12
    const rx = larguraBase * mix(0.38, 0.72, saida(ua))
    const ry = (14 + 6 * (1 - ua)) * escala
    const op = mix(0.45, 0.85, ua)
    partes.push(
      nuvemOrganica(
        x,
        y + 4 * escala,
        rx,
        ry,
        { sombra: terra.sombra, base: terra.meio, luz: terra.base },
        op,
        semente
      )
    )
    return `<g data-efeito="poeira_pouso" stroke="none">${partes.join('')}</g>`
  }

  const uExp = (u - 0.12) / 0.88
  const avanco = saida(uExp)
  const ft = followThrough(dt - dur * 0.12, dur * 0.58, 0.02, 2.2, 4.8)
  const opBase = uExp < 0.35 ? mix(0.78, 0.86, uExp / 0.35) : mix(0.86, 0, entrada((uExp - 0.35) / 0.65))

  // Sombra de poeira baixa na linha de impacto
  const rxChao = larguraBase * mix(0.55, 1.15, avanco)
  const ryChao = 14 * escala * mix(1.0, 0.45, uExp)
  if (opBase > 0.04) {
    const dSombraChao = caminhoBlob(x, y + 6 * escala, rxChao, ryChao, 8, 0.12, semente + 31)
    partes.push(
      `<path d="${dSombraChao}" fill="${terra.sombra}" opacity="${r(opBase * 0.42, 2)}" stroke="none"/>`
    )
  }

  // Lobulos laterais esquerdo e direito + tufos secundarios
  const lobulos = [
    { dir: -1, distMax: 1.05, altMax: 42, rx0: 32, ry0: 22, atraso: 0.0, sem: semente + 1 },
    { dir: 1, distMax: 1.08, altMax: 44, rx0: 34, ry0: 23, atraso: 0.02, sem: semente + 5 },
    { dir: -1, distMax: 0.62, altMax: 28, rx0: 24, ry0: 18, atraso: 0.05, sem: semente + 9 },
    { dir: 1, distMax: 0.65, altMax: 30, rx0: 25, ry0: 18, atraso: 0.06, sem: semente + 13 },
    { dir: 0, distMax: 0.12, altMax: 22, rx0: 28, ry0: 16, atraso: 0.03, sem: semente + 17 },
  ]

  for (let i = 0; i < lobulos.length; i++) {
    const lb = lobulos[i]
    const uLb = lim((uExp - lb.atraso) / (1 - lb.atraso))
    if (uLb <= 0) continue
    const avLb = saida(uLb)
    const varDist = 0.92 + hash(i + 1, lb.sem) * 0.18
    const dx = lb.dir * larguraBase * lb.distMax * varDist * avLb
    const arcoSubida = arco(uLb) * 14 * escala + avLb * lb.altMax * escala * ft * 0.85
    const lx = x + dx
    const ly = y - arcoSubida
    const escalaTufo = mix(0.58, 1.28, avLb) * (1 + 0.06 * mola(dt, 2.5, 5.0))
    const rx = lb.rx0 * escala * escalaTufo
    const ry = lb.ry0 * escala * escalaTufo * mix(0.75, 1.04, avLb)
    const opTufo = opBase * (i < 2 ? 0.82 : 0.68)

    partes.push(
      nuvemOrganica(
        lx,
        ly,
        rx,
        ry,
        {
          sombra: i % 2 === 0 ? terra.sombra : terra.meio,
          base: terra.base,
          luz: terra.luz,
        },
        opTufo,
        lb.sem
      )
    )
  }

  return `<g data-efeito="poeira_pouso" stroke="none">${partes.join('')}</g>`
}

/**
 * 2. poeira_passo
 * 3 a 5 tufos organicos assimetricos em chao_terra.luz / base / meio
 * expulsos na direcao oposta ao passo (params.direcao = -1 ou 1).
 */
export function poeira_passo(ctx, dt, dur, params = {}) {
  const pal = obterPaleta(ctx)
  const terra = pal.cenario.chao_terra
  const { x, y, escala = 1, semente = 1 } = ctx
  const direcao = params.direcao === -1 ? -1 : 1
  const dirExpulsao = -direcao
  const u = lim(dt / dur)
  const qtd = Math.max(3, Math.min(5, params.quantidade ?? 4))

  const partes = []

  // Compressao curta nos primeiros 10%
  if (u < 0.1) {
    const ua = u / 0.1
    const rx = 20 * escala * mix(0.6, 1.1, ua)
    const ry = 9 * escala * (1.1 - 0.25 * ua)
    partes.push(
      nuvemOrganica(
        x + dirExpulsao * 8 * escala,
        y + 2 * escala,
        rx,
        ry,
        { sombra: terra.meio, base: terra.base, luz: terra.luz },
        0.72 * ua,
        semente
      )
    )
    return `<g data-efeito="poeira_passo" stroke="none">${partes.join('')}</g>`
  }

  const uMov = (u - 0.1) / 0.9
  for (let i = 0; i < qtd; i++) {
    const atraso = i * 0.06
    const uTufo = lim((uMov - atraso) / (1 - atraso))
    if (uTufo <= 0) continue

    const av = saida(uTufo)
    const ft = followThrough(dt - atraso * dur, dur * 0.55, 0.01, 2.4, 5.2)
    const dist = (34 + i * 22 + hash(i * 3, semente) * 18) * escala * av
    const alt = (14 + i * 11 + hash(i * 5, semente) * 10) * escala * (av * 0.75 + arco(uTufo) * 0.35) * ft
    const tx = x + dirExpulsao * dist
    const ty = y - alt
    const rx = (16 + (qtd - i) * 4.5) * escala * mix(0.55, 1.18, av)
    const ry = rx * (0.72 + hash(i + 9, semente) * 0.18)
    const op = (uTufo < 0.25 ? uTufo / 0.25 : 1 - entrada((uTufo - 0.25) / 0.75)) * 0.76

    partes.push(
      nuvemOrganica(
        tx,
        ty,
        rx,
        ry,
        { sombra: terra.meio, base: terra.base, luz: terra.luz },
        op,
        semente + i * 11
      )
    )
  }

  return `<g data-efeito="poeira_passo" stroke="none">${partes.join('')}</g>`
}

/**
 * 3. chuva
 * Ambiente continuo durante dur. Duas camadas de gotas diagonais cheias
 * (agua_acude.luz, agua_acude.base, agua_acude.sombra) caindo com inclinacao de vento
 * + coroas de respingo organicas abrindo no chao (y em torno de ctx.y ou 1190..1380).
 */
export function chuva(ctx, dt, dur, params = {}) {
  const pal = obterPaleta(ctx)
  const agua = pal.cenario.agua_acude
  const { escala = 1, semente = 1 } = ctx
  const angVento = params.anguloDeg ?? 14
  const radVento = (angVento * Math.PI) / 180
  const sinV = Math.sin(radVento)
  const cosV = Math.cos(radVento)

  const uGlobal = lim(dt / dur)
  const envCena = uGlobal < 0.06 ? suave(uGlobal / 0.06) : uGlobal > 0.94 ? suave((1 - uGlobal) / 0.06) : 1

  const chaoMin = params.chaoMin ?? (ctx.y > 900 ? Math.max(1160, ctx.y - 40) : 1190)
  const chaoMax = params.chaoMax ?? Math.max(chaoMin + 140, 1380)

  const partes = []

  // Camada 1 (fundo/meio): gotas menores e mais suaves em agua.sombra e agua.base
  const qtdFundo = params.gotasFundo ?? 22
  for (let i = 0; i < qtdFundo; i++) {
    const vel = 1150 + hash(i * 3 + 1, semente) * 320
    const fase0 = hash(i * 3 + 2, semente)
    const prog = (fase0 + (dt * vel) / 1650) % 1
    const gx0 = -120 + hash(i * 3 + 3, semente) * 1240
    const gy = -80 + prog * 1520
    const gx = gx0 - prog * 340 * sinV
    const rx = (2.2 + hash(i * 5, semente) * 1.1) * escala
    const ry = (18 + hash(i * 7, semente) * 10) * escala
    const cor = i % 2 === 0 ? agua.sombra : agua.base
    const op = (0.36 + hash(i * 11, semente) * 0.22) * envCena
    partes.push(gotaOrganica(gx, gy, rx, ry, angVento, cor, op))
  }

  // Camada 2 (frente): gotas grossas da primeira chuva da caatinga em agua.base e agua.luz
  const qtdFrente = params.gotasFrente ?? 18
  for (let i = 0; i < qtdFrente; i++) {
    const vel = 1580 + hash(i * 4 + 19, semente + 5) * 420
    const fase0 = hash(i * 4 + 20, semente + 5)
    const prog = (fase0 + (dt * vel) / 1650) % 1
    const gx0 = -80 + hash(i * 4 + 21, semente + 5) * 1200
    const gy = -100 + prog * 1580
    const gx = gx0 - prog * 380 * sinV
    const rx = (3.4 + hash(i * 6, semente + 5) * 1.6) * escala
    const ry = (26 + hash(i * 8, semente + 5) * 14) * escala
    const cor = i % 3 === 0 ? agua.base : agua.luz
    const op = (0.55 + hash(i * 10, semente + 5) * 0.28) * envCena
    partes.push(gotaOrganica(gx, gy, rx * cosV, ry, angVento, cor, op))
  }

  // Coroas de respingo organicas abrindo no chao (y = 1190..1380)
  const qtdRespingos = params.respingos ?? 12
  const periodoResp = 0.38
  for (let i = 0; i < qtdRespingos; i++) {
    const defasagem = hash(i * 7 + 1, semente + 19) * periodoResp
    const tCiclo = dt + defasagem
    const cicloIdx = Math.floor(tCiclo / periodoResp)
    const uResp = (tCiclo % periodoResp) / periodoResp

    const rxChao = 90 + hash(i * 13 + cicloIdx * 5, semente + 23) * 900
    const ryChao = mix(chaoMin, chaoMax, hash(i * 17 + cicloIdx * 3, semente + 29))

    const av = saida(uResp)
    const opResp = arco(uResp) * 0.78 * envCena
    if (opResp <= 0.03) continue

    // Anel achatado de impacto no chao + 3 gotinhas de coroa abrindo em arco
    const dAnel = caminhoBlob(
      rxChao,
      ryChao,
      (10 + 22 * av) * escala,
      (3.2 + 5.5 * av) * escala,
      8,
      0.12,
      semente + i + cicloIdx
    )
    partes.push(`<path d="${dAnel}" fill="${agua.luz}" opacity="${r(opResp * 0.65, 2)}" stroke="none"/>`)

    const gotinhas = [-1, 0, 1]
    for (let k = 0; k < gotinhas.length; k++) {
      const dir = gotinhas[k]
      const kx = rxChao + dir * (8 + 20 * av) * escala
      const ky = ryChao - arco(uResp) * (14 + (k === 1 ? 8 : 0)) * escala
      const rotGota = dir * 32
      partes.push(
        gotaOrganica(
          kx,
          ky,
          2.6 * escala * (1 - 0.3 * uResp),
          5.2 * escala * (1 - 0.25 * uResp),
          rotGota,
          k === 1 ? agua.luz : agua.base,
          opResp
        )
      )
    }
  }

  return `<g data-efeito="chuva" stroke="none">${partes.join('')}</g>`
}

/**
 * 4. brilho_plim
 * Estrela de 4 pontas principal + 3 estrelinhas satelites e particulas em
 * PALETA.tinta.brilho_olho (#FFF8EA), PALETA.materiais.jatai.luz (#FFE08A) e
 * PALETA.materiais.caju_amarelo.luz (#FFD15A).
 * Antecipa encolhendo nos primeiros 15%, abre com mola e gira suavemente antes de sumir.
 */
export function brilho_plim(ctx, dt, dur, params = {}) {
  const pal = obterPaleta(ctx)
  const corBrilho = pal.tinta.brilho_olho
  const corJatai = pal.materiais.jatai.luz
  const corCaju = pal.materiais.caju_amarelo.luz
  const { x, y, escala = 1, semente = 1 } = ctx

  const u = lim(dt / dur)
  const raioMax = (params.raio ?? 46) * escala

  // Antecipacao: encolhe nos primeiros 15% e depois abre com mola elastica
  let escEstrela
  if (u < 0.15) {
    const ua = u / 0.15
    escEstrela = mix(0.45, 0.18, Math.sin(ua * Math.PI))
  } else {
    const ub = (u - 0.15) / 0.85
    const pulsoMola = 1 + 0.32 * mola(dt - dur * 0.15, 3.2, 5.0)
    const saidaFinal = ub > 0.65 ? 1 - entrada((ub - 0.65) / 0.35) : 1
    escEstrela = saida(Math.min(1, ub * 2.2)) * pulsoMola * saidaFinal
  }

  const opPrincipal = u < 0.72 ? 1 : 1 - entrada((u - 0.72) / 0.28)
  const giroPrincipal = mix(-18, 28, suave(u))

  const partes = []

  // Halo cel-shaded externo em caju_amarelo.luz + jatai.luz + nucleo em brilho_olho
  const rPrincipal = Math.max(0.5, raioMax * escEstrela)
  partes.push(
    estrelaQuatroPontas(x, y, rPrincipal * 1.18, giroPrincipal - 6, corCaju, opPrincipal * 0.75, semente + 1),
    estrelaQuatroPontas(x, y, rPrincipal * 0.92, giroPrincipal, corJatai, opPrincipal * 0.92, semente + 2),
    estrelaQuatroPontas(x, y, rPrincipal * 0.58, giroPrincipal + 4, corBrilho, opPrincipal, semente + 3)
  )

  // 3 estrelinhas satelites com follow-through
  const angSatelites = [-0.65, 1.45, 3.55]
  const coresSat = [corJatai, corBrilho, corCaju]
  for (let i = 0; i < 3; i++) {
    const atraso = 0.12 + i * 0.07
    const uSat = lim((u - atraso) / (1 - atraso))
    if (uSat <= 0) continue
    const ft = followThrough(dt - atraso * dur, dur * 0.45, 0.02, 2.8, 5.2)
    const ang = angSatelites[i] + (hash(i + 1, semente) - 0.5) * 0.3
    const dist = (38 + i * 14) * escala * saida(uSat) * ft
    const sx = x + Math.cos(ang) * dist
    const sy = y + Math.sin(ang) * dist
    const rSat = (13 - i * 2) * escala * arco(uSat) * 1.15
    const opSat = arco(uSat)
    partes.push(
      estrelaQuatroPontas(sx, sy, rSat, giroPrincipal * 1.3 + i * 25, coresSat[i], opSat, semente + 10 + i)
    )
  }

  // 4 pontinhos dourados de polen/brilho que se espalham
  for (let i = 0; i < 4; i++) {
    const uPt = lim((u - 0.1) / 0.9)
    if (uPt <= 0) continue
    const ang = (i * Math.PI) / 2 + 0.38 + (hash(i * 5, semente) - 0.5) * 0.25
    const dist = (24 + 44 * saida(uPt)) * escala
    const px = x + Math.cos(ang) * dist
    const py = y + Math.sin(ang) * dist - 8 * escala * uPt
    const rp = (4.8 - 2.6 * uPt) * escala
    const opPt = (1 - entrada(uPt)) * 0.92
    const corPt = i % 2 === 0 ? corJatai : corCaju
    const dPt = caminhoBlob(px, py, rp, rp * 0.9, 6, 0.12, semente + 30 + i)
    partes.push(`<path d="${dPt}" fill="${corPt}" opacity="${r(opPt, 2)}" stroke="none"/>`)
  }

  return `<g data-efeito="brilho_plim" stroke="none">${partes.join('')}</g>`
}

/**
 * 5. gota_nervoso
 * Gota de suor em agua_acude.sombra / base / luz (3 camadas de tom sobrepostas sem contorno).
 * Nasce inflando na tempora (antecipacao), escorrega para baixo acelerando com gravidade e achata ao pingar.
 */
export function gota_nervoso(ctx, dt, dur, params = {}) {
  const pal = obterPaleta(ctx)
  const agua = pal.cenario.agua_acude
  const { x, y, escala = 1, semente = 1 } = ctx
  const u = lim(dt / dur)
  const quedaMax = (params.queda ?? 68) * escala

  let dy = 0
  let escX = 1
  let escY = 1
  let op = 1

  if (u < 0.24) {
    // Antecipacao: nasce inflando na tempora com leve recuo para cima
    const ua = u / 0.24
    const inflar = saida(ua) + 0.14 * Math.sin(ua * Math.PI)
    escX = mix(0.2, 1.08, inflar)
    escY = mix(0.2, 0.95, inflar)
    dy = -4 * escala * Math.sin(ua * Math.PI)
    op = suave(ua)
  } else if (u < 0.82) {
    // Escorrega acelerando com gravidade e esticando (stretch)
    const ub = (u - 0.24) / 0.58
    const grav = entrada(ub)
    dy = grav * quedaMax
    escX = mix(1.04, 0.78, ub)
    escY = mix(0.96, 1.32, ub)
  } else {
    // Impacto / pingo final com achatamento (squash) e mola
    const uc = (u - 0.82) / 0.18
    dy = quedaMax
    const osc = mola(dt - dur * 0.82, 4.0, 6.0)
    escX = mix(1.45, 1.75, uc) + 0.12 * osc
    escY = mix(0.52, 0.24, uc) - 0.08 * osc
    op = 1 - entrada(uc)
  }

  const rx = 13 * escala * escX
  const ry = 19 * escala * escY
  const gx = x
  const gy = y + dy
  const rot = params.rotDeg ?? -4

  // 3 camadas sobrepostas sem contorno: sombra na base/direita, base no corpo, luz no topo-esquerdo
  const partes = [
    gotaOrganica(gx + 1.8 * escala, gy + 2.4 * escala, rx * 0.98, ry * 0.96, rot, agua.sombra, op * 0.92),
    gotaOrganica(gx, gy, rx, ry, rot, agua.base, op),
    gotaOrganica(
      gx - rx * 0.22,
      gy - ry * 0.18,
      rx * 0.48,
      ry * 0.46,
      rot - 6,
      agua.luz,
      op * 0.96
    ),
  ]

  // Brilho especular quente de gotinha no topo
  const dBrilho = caminhoBlob(
    gx - rx * 0.26,
    gy - ry * 0.42,
    Math.max(1.2, rx * 0.18),
    Math.max(1.6, ry * 0.16),
    6,
    0.1,
    semente + 5
  )
  partes.push(
    `<path d="${dBrilho}" fill="${pal.tinta.brilho_olho}" opacity="${r(op * 0.85, 2)}" stroke="none"/>`
  )

  return `<g data-efeito="gota_nervoso" stroke="none">${partes.join('')}</g>`
}

/**
 * 6. linhas_susto
 * Coroa de 7 a 9 cunhas radiais cheias irregulares ao redor de (ctx.x, ctx.y)
 * em PALETA.tinta.escuro (#462416), PALETA.materiais.lenco_vermelho.luz e
 * PALETA.materiais.caju_amarelo.luz, animadas "em dois" (emDois(dt)) com vibracao de impacto.
 */
export function linhas_susto(ctx, dt, dur, params = {}) {
  const pal = obterPaleta(ctx)
  const corEscuro = pal.tinta.escuro
  const corVermelho = pal.materiais.lenco_vermelho.luz
  const corAmarelo = pal.materiais.caju_amarelo.luz
  const { x, y, escala = 1, semente = 1 } = ctx

  const dt2 = emDois(dt, 30)
  const u = lim(dt2 / dur)
  const qtd = Math.max(7, Math.min(9, params.quantidade ?? 8))
  const raioInternoBase = (params.raioInterno ?? 58) * escala
  const comprBase = (params.comprimento ?? 52) * escala

  // Antecipacao: contrai no 1o passo e explode com vibracao em dois
  const av = antecipar(u, 0.22, 0.14)
  const vibracao = mola(dt2, 5.5, 4.2) * 8 * escala
  const op = u < 0.7 ? 1 : 1 - entrada((u - 0.7) / 0.3)

  const cores = [corEscuro, corAmarelo, corVermelho, corEscuro, corAmarelo, corEscuro, corVermelho, corAmarelo, corEscuro]
  const partes = []

  // Arco superior de ~220 graus ao redor da cabeca/ponto de susto
  const angIni = -Math.PI * 1.12
  const angFim = Math.PI * 0.12

  for (let i = 0; i < qtd; i++) {
    const frac = qtd === 1 ? 0.5 : i / (qtd - 1)
    const jitterAng = (hash(i * 3 + 1, semente) - 0.5) * 0.16
    const ang = mix(angIni, angFim, frac) + jitterAng
    const varComp = 0.8 + hash(i * 5 + 2, semente) * 0.45
    const varLarg = 0.85 + hash(i * 7 + 3, semente) * 0.35

    const dist = Math.max(8 * escala, raioInternoBase * mix(0.72, 1.18, lim(av)) + (i % 2 === 0 ? vibracao : -vibracao * 0.7))
    const compr = comprBase * varComp * mix(0.45, 1.15, arco(lim(u * 1.15)) + 0.35)
    const larg = (12 + (i % 2) * 4) * escala * varLarg

    partes.push(cunhaRadial(x, y, dist, compr, larg, ang, cores[i % cores.length], op))
  }

  return `<g data-efeito="linhas_susto" stroke="none">${partes.join('')}</g>`
}

/**
 * 7. fumaca_farinha
 * Volutas quentes e acolhedoras em PALETA.materiais.flor_mandacaru (sombra, meio, base, luz)
 * subindo em S a partir da chamine/forno, crescendo e suavizando a opacidade no topo.
 */
export function fumaca_farinha(ctx, dt, dur, params = {}) {
  const pal = obterPaleta(ctx)
  const flor = pal.materiais.flor_mandacaru
  const { x, y, escala = 1, semente = 1 } = ctx
  const alturaSubida = (params.altura ?? 260) * escala
  const uCena = lim(dt / dur)
  const envCena = uCena < 0.08 ? suave(uCena / 0.08) : uCena > 0.9 ? suave((1 - uCena) / 0.1) : 1

  const partes = []

  // Fita sinuosa de vapor quente na base da chamine
  const faseVapor = dt * 3.4 + semente
  partes.push(
    fitaOndulada(
      x,
      y - alturaSubida * 0.42,
      36 * escala,
      alturaSubida * 0.78,
      faseVapor,
      flor.meio,
      0.34 * envCena
    )
  )

  // Volutas arredondadas subindo em S e alargando no topo
  const qtdVolutas = params.volutas ?? 7
  const periodo = 1.65
  for (let i = 0; i < qtdVolutas; i++) {
    const fase0 = i / qtdVolutas
    const uVol = ((dt / periodo) + fase0) % 1
    const av = suave(uVol)
    const curvaS = Math.sin(uVol * Math.PI * 2.1 + semente + i * 0.7) * (28 + 34 * uVol) * escala
    const derivaVento = ruidoSuave(dt * 0.9 + i, semente) * 16 * escala * uVol

    const vx = x + curvaS + derivaVento
    const vy = y - uVol * alturaSubida
    const rx = mix(18, 56, av) * escala
    const ry = mix(14, 42, av) * escala

    const opVol = (uVol < 0.18 ? suave(uVol / 0.18) : 1 - entrada((uVol - 0.18) / 0.82)) * 0.74 * envCena
    if (opVol <= 0.02) continue

    partes.push(
      nuvemOrganica(
        vx,
        vy,
        rx,
        ry,
        {
          sombra: flor.sombra,
          base: uVol > 0.5 ? flor.base : flor.meio,
          luz: flor.luz,
        },
        opVol,
        semente + i * 9
      )
    )
  }

  return `<g data-efeito="fumaca_farinha" stroke="none">${partes.join('')}</g>`
}

/**
 * 8. mormaco
 * Ondas termicas de calor subindo do chao rachado em PALETA.cenario.ceu_dia.alto
 * e PALETA.cenario.chao_terra.luz (opacidade baixa 0.18..0.38), ondulando suavemente em funcao de dt.
 */
export function mormaco(ctx, dt, dur, params = {}) {
  const pal = obterPaleta(ctx)
  const corCeu = pal.cenario.ceu_dia.alto
  const corTerra = pal.cenario.chao_terra.luz
  const { x, y, escala = 1, semente = 1 } = ctx

  const uCena = lim(dt / dur)
  const envCena = uCena < 0.1 ? suave(uCena / 0.1) : uCena > 0.9 ? suave((1 - uCena) / 0.1) : 1
  const qtdFaixas = params.faixas ?? 7
  const espacamento = (params.larguraTotal ?? 680) * escala

  const partes = []

  for (let i = 0; i < qtdFaixas; i++) {
    const frac = qtdFaixas === 1 ? 0 : i / (qtdFaixas - 1) - 0.5
    const fxBase = x + frac * espacamento + (hash(i * 3, semente) - 0.5) * 42 * escala
    const ciclo = ((dt * 0.55 + hash(i * 5, semente)) % 1)
    const subida = ciclo * 120 * escala
    const fy = y - 70 * escala - subida
    const larguraFaixa = (26 + (i % 3) * 8) * escala
    const alturaFaixa = (160 + (i % 2) * 45) * escala
    const faseOnda = dt * 4.2 + i * 1.3 + ruidoSuave(dt + i, semente) * 0.8
    const cor = i % 2 === 0 ? corCeu : corTerra
    const opBase = mix(0.18, 0.36, hash(i * 7, semente))
    const op = opBase * Math.sin(ciclo * Math.PI) * envCena

    partes.push(fitaOndulada(fxBase, fy, larguraFaixa, alturaFaixa, faseOnda, cor, op))
  }

  return `<g data-efeito="mormaco" stroke="none">${partes.join('')}</g>`
}

/**
 * 9. folhas_caindo
 * 8 a 14 folhas da caatinga em PALETA.materiais.folha (luz, base, meio) e
 * PALETA.materiais.umbu.base caindo em movimento pendular largo (Math.sin)
 * com rotacao atrasada de follow-through.
 */
export function folhas_caindo(ctx, dt, dur, params = {}) {
  const pal = obterPaleta(ctx)
  const rampaFolha = pal.materiais.folha
  const rampaUmbu = pal.materiais.umbu
  const { x, y, escala = 1, semente = 1 } = ctx

  const qtd = Math.max(8, Math.min(14, params.quantidade ?? 11))
  const larguraArea = (params.largura ?? 860) * escala
  const alturaQueda = (params.altura ?? 980) * escala
  const uGlobal = lim(dt / dur)
  const env = uGlobal < 0.08 ? suave(uGlobal / 0.08) : uGlobal > 0.92 ? suave((1 - uGlobal) / 0.08) : 1

  const paresCores = [
    [rampaFolha.base, rampaFolha.luz],
    [rampaFolha.meio, rampaFolha.base],
    [rampaUmbu.base, rampaFolha.luz],
    [rampaFolha.base, rampaUmbu.base],
  ]

  const partes = []

  for (let i = 0; i < qtd; i++) {
    const faseInicial = hash(i * 5 + 1, semente)
    const velQueda = 0.55 + hash(i * 5 + 2, semente) * 0.45
    const uFolha = (faseInicial + (dt / Math.max(1.2, dur)) * velQueda) % 1

    const x0 = x + (hash(i * 5 + 3, semente) - 0.5) * larguraArea
    const y0 = y - alturaQueda * 0.45
    const freqPendulo = 2.4 + hash(i * 5 + 4, semente) * 1.4
    const ampPendulo = (65 + hash(i * 7 + 1, semente) * 55) * escala
    const fasePendulo = dt * freqPendulo + i * 1.7

    // Movimento pendular largo + brisa suave
    const deslX = Math.sin(fasePendulo) * ampPendulo + ruidoSuave(dt * 0.7 + i, semente) * 28 * escala
    const fx = x0 + deslX
    const fy = y0 + uFolha * alturaQueda + Math.cos(fasePendulo * 2) * 10 * escala

    // Rotacao atrasada de follow-through (defasagem de fase no pendulo + resposta elastica)
    const rotPendulo = Math.sin(fasePendulo - 0.58) * 42
    const rotFollow = followThrough(dt, dur * 0.7, 0.05, 2.0, 3.5) * 14
    const rotDeg = rotPendulo + rotFollow + (i % 2 === 0 ? 12 : -15)

    const tam = (15 + hash(i * 9, semente) * 9) * escala
    const [corBase, corLuz] = paresCores[i % paresCores.length]
    const op = env * (uFolha < 0.1 ? uFolha / 0.1 : uFolha > 0.9 ? (1 - uFolha) / 0.1 : 0.94)

    partes.push(folhaOrganica(fx, fy, tam, rotDeg, corBase, corLuz, op))
  }

  return `<g data-efeito="folhas_caindo" stroke="none">${partes.join('')}</g>`
}

/**
 * 10. confete_bandeirinhas
 * Cordao em catenaria de bandeirinhas de Sao Joao / Festa da Colheita balancando ao vento
 * + chuva alegre de confetes recortados a mao nas cores da feira
 * (tomate, laranja, caju_amarelo, folha, lenco_vermelho, umbu).
 */
export function confete_bandeirinhas(ctx, dt, dur, params = {}) {
  const pal = obterPaleta(ctx)
  const mat = pal.materiais
  const { x, y, escala = 1, semente = 1 } = ctx

  const coresFeira = [
    { base: mat.tomate.base, luz: mat.tomate.luz },
    { base: mat.caju_amarelo.base, luz: mat.caju_amarelo.luz },
    { base: mat.folha.base, luz: mat.folha.luz },
    { base: mat.laranja.base, luz: mat.laranja.luz },
    { base: mat.lenco_vermelho.base, luz: mat.lenco_vermelho.luz },
    { base: mat.umbu.base, luz: mat.umbu.luz },
  ]

  const u = lim(dt / dur)
  // Entrada com antecipacao e mola festiva
  const escEntrada = u < 0.18
    ? saida(u / 0.18) + 0.15 * mola(dt, 3.5, 4.5)
    : u > 0.88
      ? suave((1 - u) / 0.12)
      : 1

  const partes = []

  // Cordao superior em catenaria (forma cheia fina em palha_cesto.sombra, sem stroke!)
  const yCordao = params.yCordao ?? Math.min(y, 440)
  const xEsq = x - 480 * escala
  const xDir = x + 480 * escala
  const balancoVento = Math.sin(dt * 3.2 + semente) * 14 * escala
  const flecha = (78 + Math.sin(dt * 2.4) * 8) * escala

  const dCordao = [
    `M ${r(xEsq, 1)} ${r(yCordao, 1)}`,
    `Q ${r(x + balancoVento * 0.4, 1)} ${r(yCordao + flecha, 1)} ${r(xDir, 1)} ${r(yCordao - 10 * escala, 1)}`,
    `L ${r(xDir, 1)} ${r(yCordao - 4 * escala, 1)}`,
    `Q ${r(x + balancoVento * 0.4, 1)} ${r(yCordao + flecha + 6 * escala, 1)} ${r(xEsq, 1)} ${r(yCordao + 6 * escala, 1)}`,
    'Z',
  ].join(' ')
  partes.push(
    `<path d="${dCordao}" fill="${mat.palha_cesto.sombra}" opacity="${r(lim(escEntrada), 2)}" stroke="none"/>`
  )

  // Bandeirinhas de Sao Joao ao longo da catenaria
  const qtdBand = params.bandeirinhas ?? 9
  for (let i = 0; i < qtdBand; i++) {
    const s = (i + 0.5) / qtdBand
    const bx = mix(xEsq, xDir, s)
    // Avalia parabola/catenaria da corda em s
    const by = (1 - s) * (1 - s) * yCordao + 2 * (1 - s) * s * (yCordao + flecha * 0.52) + s * s * (yCordao - 8 * escala)
    const corPar = coresFeira[i % coresFeira.length]

    // Rotacao com atraso de follow-through em onda pelo cordao
    const angBand = Math.sin(dt * 4.0 - i * 0.55 + semente) * 14 + balancoVento * 0.15
    const larg = 36 * escala * escEntrada
    const alt = 52 * escala * escEntrada

    // Bandeirinha recortada em duas pontas (rabo de andorinha de Sao Joao) + camada de luz
    const dBandBase = [
      `M ${r(-larg * 0.5, 1)} 0`,
      `L ${r(larg * 0.5, 1)} 0`,
      `L ${r(larg * 0.54, 1)} ${r(alt, 1)}`,
      `L 0 ${r(alt * 0.72, 1)}`,
      `L ${r(-larg * 0.54, 1)} ${r(alt, 1)}`,
      'Z',
    ].join(' ')

    const dBandLuz = [
      `M ${r(-larg * 0.44, 1)} ${r(3 * escala, 1)}`,
      `L ${r(larg * 0.18, 1)} ${r(3 * escala, 1)}`,
      `L ${r(-larg * 0.08, 1)} ${r(alt * 0.64, 1)}`,
      `L ${r(-larg * 0.46, 1)} ${r(alt * 0.86, 1)}`,
      'Z',
    ].join(' ')

    partes.push(
      `<g transform="translate(${r(bx, 1)} ${r(by, 1)}) rotate(${r(angBand, 1)})" opacity="${r(lim(escEntrada), 2)}" stroke="none">`,
      `<path d="${dBandBase}" fill="${corPar.base}" stroke="none"/>`,
      `<path d="${dBandLuz}" fill="${corPar.luz}" stroke="none"/>`,
      '</g>'
    )
  }

  // Chuva alegre de confetes recortados a mao
  const qtdConfetes = params.confetes ?? 26
  for (let i = 0; i < qtdConfetes; i++) {
    const fase0 = hash(i * 7 + 1, semente + 3)
    const vel = 0.65 + hash(i * 7 + 2, semente + 3) * 0.55
    const prog = (fase0 + (dt / Math.max(1.0, dur)) * vel) % 1

    const cx = x + (hash(i * 7 + 3, semente + 3) - 0.5) * 880 * escala + Math.sin(dt * 3.6 + i * 1.9) * 34 * escala
    const cy = yCordao - 40 * escala + prog * 1120 * escala
    const tamX = (8 + (i % 3) * 3.5) * escala
    const tamY = tamX * (0.45 + 0.55 * Math.abs(Math.cos(dt * 4.5 + i)))
    const rotConf = (dt * (90 + (i % 4) * 35) + i * 47) % 360
    const corConf = coresFeira[i % coresFeira.length]
    const opConf = lim(escEntrada) * (prog > 0.88 ? (1 - prog) / 0.12 : 0.95)

    const dConf = caminhoBlob(0, 0, tamX, Math.max(2.2, tamY), 5, 0.18, semente + 40 + i)
    partes.push(
      `<path d="${dConf}" fill="${i % 2 === 0 ? corConf.luz : corConf.base}" opacity="${r(opConf, 2)}" transform="translate(${r(cx, 1)} ${r(cy, 1)}) rotate(${r(rotConf, 1)})" stroke="none"/>`
    )
  }

  return `<g data-efeito="confete_bandeirinhas" stroke="none">${partes.join('')}</g>`
}

/**
 * Calcula o ganho de flicker eletrico deterministico do neon do Mercadinho Sabor Ja.
 * Apaga/engasga exatamente em 0.08..0.16s e 0.24..0.28s para casar cravado com o som zumbido_neon,
 * alem de micro-oscilacoes de 60 Hz e piscadas curtas.
 */
function calcularFlickerNeon(dt, semente = 1) {
  if (dt >= 0.08 && dt <= 0.16) {
    // Corte eletrico 1 (sincronizado com zumbido_neon)
    const pulsoMeio = Math.abs(dt - 0.12) < 0.012 ? 0.42 : 0.06
    return pulsoMeio
  }
  if (dt >= 0.24 && dt <= 0.28) {
    // Corte eletrico 2 (sincronizado com zumbido_neon)
    return 0.08
  }
  // Piscada curta secundaria deterministica se a deixa for mais longa
  const modCiclo = dt % 1.4
  if (modCiclo >= 0.92 && modCiclo <= 0.95) {
    return 0.22
  }
  const zumbido60Hz = 0.94 + 0.06 * Math.sin(dt * Math.PI * 38 + semente)
  return lim(zumbido60Hz, 0.1, 1)
}

/**
 * 11. neon_mercadinho
 * O UNICO efeito com brilho/gradiente (mundo do vilao).
 * Desenha letreiro/moldura luminosa "SABOR JA" e halo radial usando PALETA.cenario.neon_mercadinho
 * (rosa: #FF3FB4, azul: #3FA0FF, brilho: #FFFFFF, fundo: #1B1F5E),
 * com flicker eletrico deterministico sincronizado com zumbido_neon.
 */
export function neon_mercadinho(ctx, dt, dur, params = {}) {
  const pal = obterPaleta(ctx)
  const neon = pal.cenario.neon_mercadinho
  const { x, y, escala = 1, semente = 1 } = ctx

  const u = lim(dt / dur)
  const flicker = calcularFlickerNeon(dt, semente)
  const envSaida = u > 0.92 ? suave((1 - u) / 0.08) : 1
  const energia = flicker * envSaida

  const larg = (params.largura ?? 420) * escala
  const alt = (params.altura ?? 136) * escala
  const texto = params.texto ?? 'SABOR JÁ'

  const partes = []

  // Definicoes locais garantidas mesmo se defsEfeitosSerie() nao tiver sido injetado no SVG pai
  partes.push(`<defs>${defsEfeitos(neon)}</defs>`)

  // Halos radiais externos (rosa e azul) exclusivos do mundo do vilao
  const rHaloX = larg * 0.82
  const rHaloY = alt * 1.15
  partes.push(
    `<ellipse cx="${r(x, 1)}" cy="${r(y, 1)}" rx="${r(rHaloX, 1)}" ry="${r(rHaloY, 1)}" fill="url(#efeito-neon-halo-rosa)" opacity="${r(energia * 0.78, 2)}" stroke="none"/>`,
    `<ellipse cx="${r(x, 1)}" cy="${r(y, 1)}" rx="${r(rHaloX * 0.72, 1)}" ry="${r(rHaloY * 0.76, 1)}" fill="url(#efeito-neon-halo-azul)" opacity="${r(energia * 0.68, 2)}" stroke="none"/>`
  )

  // Placa plastica fria e geometrica de fundo (#1B1F5E)
  const x0 = x - larg / 2
  const y0 = y - alt / 2
  const raioCanto = 16 * escala
  partes.push(
    `<rect x="${r(x0, 1)}" y="${r(y0, 1)}" width="${r(larg, 1)}" height="${r(alt, 1)}" rx="${r(raioCanto, 1)}" fill="${neon.fundo}" opacity="${r(0.94 * envSaida, 2)}" stroke="none"/>`
  )

  // Reflexo especular duro em faixa diagonal (plastico do mundo do vilao)
  const varredura = ((dt * 0.85) % 1) * larg * 0.7 - larg * 0.35
  const lx = x + varredura
  const dReflexo = [
    `M ${r(lx - 38 * escala, 1)} ${r(y0 + 6 * escala, 1)}`,
    `L ${r(lx + 14 * escala, 1)} ${r(y0 + 6 * escala, 1)}`,
    `L ${r(lx - 24 * escala, 1)} ${r(y0 + alt - 6 * escala, 1)}`,
    `L ${r(lx - 76 * escala, 1)} ${r(y0 + alt - 6 * escala, 1)}`,
    'Z',
  ].join(' ')
  partes.push(
    `<path d="${dReflexo}" fill="url(#efeito-neon-reflexo-plastico)" opacity="${r(0.32 * energia, 2)}" stroke="none"/>`
  )

  // Moldura de tubos de neon construidos por barras cheias sobrepostas (sem stroke!)
  const espRosa = 10 * escala
  const espBrilho = 4 * escala
  const m = 10 * escala
  // Tubo superior e inferior (rosa + nucleo branco)
  partes.push(
    `<rect x="${r(x0 + m, 1)}" y="${r(y0 + m, 1)}" width="${r(larg - 2 * m, 1)}" height="${r(espRosa, 1)}" rx="${r(espRosa / 2, 1)}" fill="${neon.rosa}" opacity="${r(energia * 0.95, 2)}" stroke="none"/>`,
    `<rect x="${r(x0 + m + 4 * escala, 1)}" y="${r(y0 + m + 3 * escala, 1)}" width="${r(larg - 2 * m - 8 * escala, 1)}" height="${r(espBrilho, 1)}" rx="${r(espBrilho / 2, 1)}" fill="${neon.brilho}" opacity="${r(energia, 2)}" stroke="none"/>`,
    `<rect x="${r(x0 + m, 1)}" y="${r(y0 + alt - m - espRosa, 1)}" width="${r(larg - 2 * m, 1)}" height="${r(espRosa, 1)}" rx="${r(espRosa / 2, 1)}" fill="${neon.azul}" opacity="${r(energia * 0.95, 2)}" stroke="none"/>`,
    `<rect x="${r(x0 + m + 4 * escala, 1)}" y="${r(y0 + alt - m - espRosa + 3 * escala, 1)}" width="${r(larg - 2 * m - 8 * escala, 1)}" height="${r(espBrilho, 1)}" rx="${r(espBrilho / 2, 1)}" fill="${neon.brilho}" opacity="${r(energia, 2)}" stroke="none"/>`
  )

  // Tipografia "de computador", sem serifa e fria (excecao oficial de objetos-e-efeitos.md)
  const tamFonte = r(52 * escala, 1)
  const ty = r(y + 18 * escala, 1)
  partes.push(
    `<text x="${r(x, 1)}" y="${ty}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-weight="900" font-size="${tamFonte}" letter-spacing="${r(4 * escala, 1)}" fill="${neon.rosa}" opacity="${r(energia * 0.88, 2)}" stroke="none">${texto}</text>`,
    `<text x="${r(x - 1.5 * escala, 1)}" y="${r(y + 16.5 * escala, 1)}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-weight="900" font-size="${tamFonte}" letter-spacing="${r(4 * escala, 1)}" fill="${neon.brilho}" opacity="${r(energia, 2)}" stroke="none">${texto}</text>`
  )

  // Centelhas eletricas durante os cortes de luz (0.08..0.16s e 0.24..0.28s)
  const emCorte = (dt >= 0.07 && dt <= 0.17) || (dt >= 0.23 && dt <= 0.29)
  if (emCorte) {
    for (let i = 0; i < 5; i++) {
      const ang = (i / 5) * Math.PI * 2 + dt * 25
      const sx = x + larg * 0.36 + Math.cos(ang) * 14 * escala
      const sy = y - alt * 0.28 + Math.sin(ang) * 14 * escala
      partes.push(
        cunhaRadial(
          sx,
          sy,
          4 * escala,
          18 * escala,
          5 * escala,
          ang,
          i % 2 === 0 ? neon.brilho : neon.azul,
          0.92
        )
      )
    }
  }

  return `<g data-efeito="neon_mercadinho" stroke="none">${partes.join('')}</g>`
}

export const EFEITOS_SERIE = {
  poeira_pouso,
  poeira_passo,
  chuva,
  brilho_plim,
  gota_nervoso,
  linhas_susto,
  fumaca_farinha,
  mormaco,
  folhas_caindo,
  confete_bandeirinhas,
  neon_mercadinho,
}

const registroSerie = criarRegistroEfeitos(EFEITOS_SERIE)

export function renderizarEfeitoSerie(id, ctx = {}, dt = 0, dur = 0.8, params = {}) {
  const ctxComPaleta = { paleta: PALETA, ...ctx }
  return registroSerie.renderizarEfeito(id, ctxComPaleta, dt, dur, params)
}

export function defsEfeitosSerie() {
  return defsEfeitos(PALETA.cenario.neon_mercadinho)
}

export const KitEfeitos = {
  EFEITOS_SERIE,
  renderizarEfeitoSerie,
  defsEfeitosSerie,
  renderizarEfeito: renderizarEfeitoSerie,
  defsEfeitos: defsEfeitosSerie,
}

if (typeof window !== 'undefined') {
  window.KitEfeitos = KitEfeitos
}
