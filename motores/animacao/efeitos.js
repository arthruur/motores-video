// motores/animacao/efeitos.js
// Biblioteca generica de primitivas e registro de efeitos vetoriais deterministicos
// em funcao pura de t (dt, dur).
// Regra de arte: formas vetoriais cheias, sem contorno (stroke="none"),
// volume por sobreposicao de tons e excecao de gradiente exclusiva para o neon do vilao.

import {
  r,
  lim,
  mix,
  fase,
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
} from './timeline.js'

/**
 * Forma de gota desenhada a mao com ponta superior e barriga assimetrica, sem contorno.
 */
export function gotaOrganica(x, y, rx, ry, rotDeg = 0, cor = '#A9D3D6', opacidade = 1) {
  const op = r(lim(opacidade, 0, 1), 2)
  if (op <= 0.01 || rx <= 0.1 || ry <= 0.1) return ''
  const lx = r(rx * 1.06, 1)
  const dx = r(rx * 0.94, 1)
  const topoY = r(-ry * 1.32, 1)
  const baseY = r(ry, 1)
  const barrigaY = r(ry * 0.28, 1)
  const ombroY = r(-ry * 0.42, 1)
  const pontaX = r(rx * 0.08, 1)

  const d = [
    `M ${pontaX} ${topoY}`,
    `C ${r(dx * 0.48, 1)} ${ombroY}, ${dx} ${r(-ry * 0.05, 1)}, ${dx} ${barrigaY}`,
    `C ${dx} ${r(ry * 0.78, 1)}, ${r(dx * 0.52, 1)} ${baseY}, 0 ${baseY}`,
    `C ${r(-lx * 0.56, 1)} ${baseY}, ${-lx} ${r(ry * 0.74, 1)}, ${-lx} ${r(barrigaY * 0.92, 1)}`,
    `C ${-lx} ${r(-ry * 0.1, 1)}, ${r(-lx * 0.42, 1)} ${ombroY}, ${pontaX} ${topoY}`,
    'Z',
  ].join(' ')

  const tf = rotDeg
    ? `translate(${r(x, 1)} ${r(y, 1)}) rotate(${r(rotDeg, 1)})`
    : `translate(${r(x, 1)} ${r(y, 1)})`

  return `<path d="${d}" fill="${cor}" opacity="${op}" stroke="none" transform="${tf}"/>`
}

/**
 * Estrela de 4 pontas levemente irregular desenhada a mao, com curvas concavas suaves.
 */
export function estrelaQuatroPontas(x, y, raio, rotDeg = 0, cor = '#FFF8EA', opacidade = 1, semente = 1) {
  const op = r(lim(opacidade, 0, 1), 2)
  if (op <= 0.01 || raio <= 0.2) return ''

  const pNorte = raio * (1.04 + (hash(1, semente) - 0.5) * 0.16)
  const pSul = raio * (0.98 + (hash(2, semente) - 0.5) * 0.16)
  const pLeste = raio * (0.92 + (hash(3, semente) - 0.5) * 0.16)
  const pOeste = raio * (0.95 + (hash(4, semente) - 0.5) * 0.16)
  const cintura = raio * (0.22 + (hash(5, semente) - 0.5) * 0.05)

  const desvioN = (hash(6, semente) - 0.5) * raio * 0.08
  const desvioS = (hash(7, semente) - 0.5) * raio * 0.08

  const d = [
    `M ${r(desvioN, 1)} ${r(-pNorte, 1)}`,
    `Q ${r(cintura, 1)} ${r(-cintura, 1)} ${r(pLeste, 1)} 0`,
    `Q ${r(cintura, 1)} ${r(cintura, 1)} ${r(desvioS, 1)} ${r(pSul, 1)}`,
    `Q ${r(-cintura, 1)} ${r(cintura, 1)} ${r(-pOeste, 1)} 0`,
    `Q ${r(-cintura, 1)} ${r(-cintura, 1)} ${r(desvioN, 1)} ${r(-pNorte, 1)}`,
    'Z',
  ].join(' ')

  const tf = rotDeg
    ? `translate(${r(x, 1)} ${r(y, 1)}) rotate(${r(rotDeg, 1)})`
    : `translate(${r(x, 1)} ${r(y, 1)})`

  return `<path d="${d}" fill="${cor}" opacity="${op}" stroke="none" transform="${tf}"/>`
}

/**
 * Nuvem organica cel-shaded por sobreposicao de 3 formas cheias em rampa:
 * sombra embaixo, base no meio e luz no topo-esquerdo, sem contorno.
 */
export function nuvemOrganica(x, y, rx, ry, tons = {}, opacidade = 1, semente = 1) {
  const op = r(lim(opacidade, 0, 1), 2)
  if (op <= 0.01 || rx <= 0.5 || ry <= 0.5) return ''

  const corSombra = tons.sombra || tons.meio || tons.base || '#9C6E3E'
  const corBase = tons.base || tons.meio || tons.luz || '#CF9F63'
  const corLuz = tons.luz || tons.base || '#E2B97E'

  const rotBase = (hash(11, semente) - 0.5) * 0.35
  const dSombra = caminhoBlob(
    x + rx * 0.06,
    y + ry * 0.16,
    rx * 0.96,
    ry * 0.84,
    8,
    0.15,
    semente + 3,
    rotBase
  )
  const dBase = caminhoBlob(
    x,
    y,
    rx,
    ry,
    9,
    0.16,
    semente,
    rotBase
  )
  const dLuz = caminhoBlob(
    x - rx * 0.14,
    y - ry * 0.18,
    rx * 0.72,
    ry * 0.58,
    7,
    0.14,
    semente + 7,
    rotBase - 0.12
  )

  return [
    `<g opacity="${op}" stroke="none">`,
    `<path d="${dSombra}" fill="${corSombra}" stroke="none"/>`,
    `<path d="${dBase}" fill="${corBase}" stroke="none"/>`,
    `<path d="${dLuz}" fill="${corLuz}" stroke="none"/>`,
    '</g>',
  ].join('')
}

/**
 * Cunha radial cheia e afilada para linhas de susto ou impacto, sem stroke.
 */
export function cunhaRadial(x, y, dist, compr, larg, angRad, cor, opacidade = 1) {
  const op = r(lim(opacidade, 0, 1), 2)
  if (op <= 0.01 || compr <= 0.5 || larg <= 0.2) return ''

  const cos = Math.cos(angRad)
  const sin = Math.sin(angRad)
  const nx = -sin
  const ny = cos

  const r0 = Math.max(0, dist)
  const r1 = r0 + compr * 0.68
  const r2 = r0 + compr

  const p0x = x + cos * r0
  const p0y = y + sin * r0

  const m1x = x + cos * r1 + nx * (larg * 0.52)
  const m1y = y + sin * r1 + ny * (larg * 0.52)

  const m2x = x + cos * r1 - nx * (larg * 0.48)
  const m2y = y + sin * r1 - ny * (larg * 0.48)

  const p2x = x + cos * r2 + nx * (larg * 0.08)
  const p2y = y + sin * r2 + ny * (larg * 0.08)

  const d = [
    `M ${r(p0x, 1)} ${r(p0y, 1)}`,
    `Q ${r(m1x, 1)} ${r(m1y, 1)} ${r(p2x, 1)} ${r(p2y, 1)}`,
    `Q ${r(m2x, 1)} ${r(m2y, 1)} ${r(p0x, 1)} ${r(p0y, 1)}`,
    'Z',
  ].join(' ')

  return `<path d="${d}" fill="${cor}" opacity="${op}" stroke="none"/>`
}

/**
 * Faixa cheia senoidal para mormaco ou fumaca, afilada nas pontas e sem contorno.
 */
export function fitaOndulada(x, y, largura, altura, faseOnda = 0, cor = '#F3D9A4', opacidade = 1) {
  const op = r(lim(opacidade, 0, 1), 2)
  if (op <= 0.01 || largura <= 0.5 || altura <= 0.5) return ''

  const passos = 6
  const ida = []
  const volta = []
  const meiaAlt = altura / 2

  for (let i = 0; i <= passos; i++) {
    const u = i / passos
    const py = y + meiaAlt - u * altura
    const env = Math.sin(u * Math.PI)
    const desvio = Math.sin(faseOnda + u * Math.PI * 2.2) * largura * 0.42
    const espessura = largura * (0.12 + 0.38 * env)
    ida.push([x + desvio - espessura, py])
    volta.unshift([x + desvio + espessura, py])
  }

  const pts = [...ida, ...volta]
  let d = `M ${r(pts[0][0], 1)} ${r(pts[0][1], 1)}`
  for (let i = 1; i < pts.length; i++) {
    const pPrev = pts[i - 1]
    const pCurr = pts[i]
    const mx = (pPrev[0] + pCurr[0]) / 2
    const my = (pPrev[1] + pCurr[1]) / 2
    d += ` Q ${r(pPrev[0], 1)} ${r(pPrev[1], 1)} ${r(mx, 1)} ${r(my, 1)}`
  }
  d += ' Z'

  return `<path d="${d}" fill="${cor}" opacity="${op}" stroke="none"/>`
}

/**
 * Folha organica em duas camadas de tom (corBase + corLuz), sem contorno.
 */
export function folhaOrganica(x, y, tam, rotDeg = 0, corBase = '#50812F', corLuz = '#669630', opacidade = 1) {
  const op = r(lim(opacidade, 0, 1), 2)
  if (op <= 0.01 || tam <= 0.5) return ''

  const comp = tam
  const larg = tam * 0.54

  const dBase = [
    `M ${r(-comp, 1)} 0`,
    `C ${r(-comp * 0.45, 1)} ${r(-larg * 1.15, 1)}, ${r(comp * 0.45, 1)} ${r(-larg * 0.95, 1)}, ${r(comp, 1)} ${r(-larg * 0.08, 1)}`,
    `C ${r(comp * 0.42, 1)} ${r(larg * 1.05, 1)}, ${r(-comp * 0.48, 1)} ${r(larg * 1.08, 1)}, ${r(-comp, 1)} 0`,
    'Z',
  ].join(' ')

  const dLuz = [
    `M ${r(-comp * 0.86, 1)} ${r(-larg * 0.04, 1)}`,
    `C ${r(-comp * 0.38, 1)} ${r(-larg * 0.98, 1)}, ${r(comp * 0.36, 1)} ${r(-larg * 0.82, 1)}, ${r(comp * 0.84, 1)} ${r(-larg * 0.06, 1)}`,
    `C ${r(comp * 0.25, 1)} ${r(-larg * 0.18, 1)}, ${r(-comp * 0.32, 1)} ${r(-larg * 0.14, 1)}, ${r(-comp * 0.86, 1)} ${r(-larg * 0.04, 1)}`,
    'Z',
  ].join(' ')

  const tf = rotDeg
    ? `translate(${r(x, 1)} ${r(y, 1)}) rotate(${r(rotDeg, 1)})`
    : `translate(${r(x, 1)} ${r(y, 1)})`

  return [
    `<g opacity="${op}" transform="${tf}" stroke="none">`,
    `<path d="${dBase}" fill="${corBase}" stroke="none"/>`,
    `<path d="${dLuz}" fill="${corLuz}" stroke="none"/>`,
    '</g>',
  ].join('')
}

/**
 * Defs SVG exclusivos para o brilho/gradiente do neon do Mercadinho Sabor Ja (mundo do vilao).
 */
export function defsEfeitos(coresNeon = {}) {
  const rosa = coresNeon.rosa || '#FF3FB4'
  const azul = coresNeon.azul || '#3FA0FF'
  const brilho = coresNeon.brilho || '#FFFFFF'

  return [
    '<radialGradient id="efeito-neon-halo-rosa" cx="50%" cy="50%" r="50%">',
    `<stop offset="0%" stop-color="${brilho}" stop-opacity="0.92"/>`,
    `<stop offset="38%" stop-color="${rosa}" stop-opacity="0.65"/>`,
    `<stop offset="100%" stop-color="${rosa}" stop-opacity="0"/>`,
    '</radialGradient>',
    '<radialGradient id="efeito-neon-halo-azul" cx="50%" cy="50%" r="50%">',
    `<stop offset="0%" stop-color="${brilho}" stop-opacity="0.88"/>`,
    `<stop offset="42%" stop-color="${azul}" stop-opacity="0.58"/>`,
    `<stop offset="100%" stop-color="${azul}" stop-opacity="0"/>`,
    '</radialGradient>',
    '<linearGradient id="efeito-neon-reflexo-plastico" x1="0%" y1="0%" x2="100%" y2="100%">',
    `<stop offset="0%" stop-color="${brilho}" stop-opacity="0"/>`,
    `<stop offset="46%" stop-color="${brilho}" stop-opacity="0.78"/>`,
    `<stop offset="56%" stop-color="${brilho}" stop-opacity="0"/>`,
    '</linearGradient>',
  ].join('')
}

/**
 * Cria um registro deterministico de efeitos visuais.
 */
export function criarRegistroEfeitos(presetsIniciais = {}) {
  const mapa = { ...presetsIniciais }

  function registrar(id, fn) {
    if (id && typeof fn === 'function') {
      mapa[id] = fn
    }
    return api
  }

  function renderizarEfeito(id, ctx = {}, dt = 0, dur = 0.8, params = {}) {
    const fn = mapa[id]
    if (typeof fn !== 'function') return ''
    const durSegura = Math.max(0.001, Number(dur) || 0.8)
    const dtNum = Number(dt) || 0
    if (dtNum < -1e-4 || dtNum > durSegura + 1e-4) return ''

    const ctxNorm = {
      x: ctx?.x ?? ctx?.pos?.[0] ?? 540,
      y: ctx?.y ?? ctx?.pos?.[1] ?? 1190,
      escala: ctx?.escala ?? 1,
      semente: ctx?.semente ?? 1,
      camada: ctx?.camada ?? 'frente',
      paleta: ctx?.paleta ?? null,
    }
    const paramsNorm = { ...(ctx?.params || {}), ...(params || {}) }
    return fn(ctxNorm, lim(dtNum, 0, durSegura), durSegura, paramsNorm)
  }

  const api = {
    presets: mapa,
    registrar,
    renderizarEfeito,
    defsEfeitos,
  }

  return api
}

export const AnimEfeitos = {
  gotaOrganica,
  estrelaQuatroPontas,
  nuvemOrganica,
  cunhaRadial,
  fitaOndulada,
  folhaOrganica,
  defsEfeitos,
  criarRegistroEfeitos,
}

if (typeof window !== 'undefined') {
  window.AnimEfeitos = AnimEfeitos
}
