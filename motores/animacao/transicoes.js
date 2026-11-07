// motores/animacao/transicoes.js
// Transições determinísticas entre cenas em função pura de `uTransicao` (0..1):
// - `corte`: troca direta
// - `funde`: cross-dissolve suave (`suave(u)`)
// - `chicote`: desliza cena que sai (±1080 * entradaSaida(u)) e traz a próxima do lado oposto com #blur-chicote
// - `iris`: máscara circular SVG (`clip-path`) centrada em `foco: [cx, cy]` (padrão [540, 1100])
//           fechando de r = 2100 até r = 0 (ou abrindo de 0 a 2100), com fundo #462416 (nunca #000000).
// Segue motores/animacao/ARQUITETURA.md §6 e motores/render/CONTRATO.md.

import { r, lim, mix, suave, entradaSaida, arco } from './timeline.js'

export const COR_FUNDO_IRIS = '#462416' // PALETA.tinta.escuro (nunca #000000)

/**
 * Calcula os parâmetros puros da transição para `uTransicao` em [0, 1].
 *
 * @param {object} transicao - { tipo: 'corte'|'funde'|'chicote'|'iris', dur, direcao, foco, modo, corFundo }
 * @param {number} uTransicao - Progresso normalizado da transição (0..1)
 * @param {object} opcoes - { largura = 1080, altura = 1920 }
 */
export function calcularTransicao(transicao = { tipo: 'corte', dur: 0 }, uTransicao = 0, opcoes = {}) {
  const largura = opcoes.largura || 1080
  const altura = opcoes.altura || 1920
  const tipo = transicao?.tipo || 'corte'
  const u = lim(uTransicao, 0, 1)
  const ativa = u > 1e-4 && u < 1 - 1e-4 && (transicao?.dur ?? 0) > 0

  if (tipo === 'corte' || (transicao?.dur ?? 0) <= 0 || u <= 0) {
    return {
      tipo: 'corte',
      ativa: false,
      u: 0,
      blurX: 0,
      atual: { visivel: true, opacidade: 1, dx: 0, dy: 0, usarBlur: false, clipIris: false },
      proxima: { visivel: false, opacidade: 0, dx: 0, dy: 0, usarBlur: false, clipIris: false },
      iris: null,
    }
  }

  if (tipo === 'funde') {
    const s = suave(u)
    return {
      tipo: 'funde',
      ativa: true,
      u: r(u, 4),
      blurX: 0,
      atual: { visivel: true, opacidade: r(1 - s, 3), dx: 0, dy: 0, usarBlur: false, clipIris: false },
      proxima: { visivel: true, opacidade: r(s, 3), dx: 0, dy: 0, usarBlur: false, clipIris: false },
      iris: null,
    }
  }

  if (tipo === 'chicote') {
    const dir = transicao.direcao === 'dir' ? 1 : -1 // 'esq' (padrão) desliza a atual para -1080 e traz a próxima de +1080
    const s = entradaSaida(u)
    const dxAtual = r(dir * largura * s, 2)
    const dxProx = r(dir * largura * (s - 1), 2)
    const blurMax = transicao.blurMax ?? 38
    const blurX = r(blurMax * arco(u), 2)
    return {
      tipo: 'chicote',
      ativa: true,
      u: r(u, 4),
      direcao: dir < 0 ? 'esq' : 'dir',
      blurX,
      atual: { visivel: s < 0.999, opacidade: 1, dx: dxAtual, dy: 0, usarBlur: blurX > 0.5, clipIris: false },
      proxima: { visivel: s > 0.001, opacidade: 1, dx: dxProx, dy: 0, usarBlur: blurX > 0.5, clipIris: false },
      iris: null,
    }
  }

  if (tipo === 'iris') {
    const [cx = 540, cy = 1100] = Array.isArray(transicao.foco) ? transicao.foco : [540, 1100]
    const rMax = transicao.raioMax ?? 2100
    const rMin = transicao.raioMin ?? 0
    const corFundo = transicao.corFundo || COR_FUNDO_IRIS
    const modo = transicao.modo || 'fechar' // 'fechar' (2100 -> 0), 'abrir' (0 -> 2100) ou 'fechar_abrir'

    let raio = rMax
    let mostrarProxima = false

    if (modo === 'abrir') {
      raio = mix(rMin, rMax, entradaSaida(u))
      mostrarProxima = true
    } else if (modo === 'fechar_abrir') {
      if (u < 0.5) {
        raio = mix(rMax, rMin, entradaSaida(u * 2))
        mostrarProxima = false
      } else {
        raio = mix(rMin, rMax, entradaSaida((u - 0.5) * 2))
        mostrarProxima = true
      }
    } else {
      // 'fechar' padrão: fecha de r = 2100 até r = 0 sobre o foco (cx, cy)
      raio = mix(rMax, rMin, entradaSaida(u))
      mostrarProxima = false
    }

    return {
      tipo: 'iris',
      ativa: true,
      u: r(u, 4),
      blurX: 0,
      atual: {
        visivel: !mostrarProxima,
        opacidade: 1,
        dx: 0,
        dy: 0,
        usarBlur: false,
        clipIris: !mostrarProxima,
      },
      proxima: {
        visivel: mostrarProxima,
        opacidade: 1,
        dx: 0,
        dy: 0,
        usarBlur: false,
        clipIris: mostrarProxima,
      },
      iris: {
        cx: r(cx, 1),
        cy: r(cy, 1),
        raio: r(Math.max(0, raio), 2),
        rMax,
        rMin,
        modo,
        corFundo,
        largura,
        altura,
      },
    }
  }

  return {
    tipo: 'corte',
    ativa: false,
    u: 0,
    blurX: 0,
    atual: { visivel: true, opacidade: 1, dx: 0, dy: 0, usarBlur: false, clipIris: false },
    proxima: { visivel: false, opacidade: 0, dx: 0, dy: 0, usarBlur: false, clipIris: false },
    iris: null,
  }
}

/**
 * Gera os elementos `<defs>` SVG necessários para transições (`#blur-chicote` e `#clip-iris`).
 *
 * @param {object} estadoTr - Objeto retornado por `calcularTransicao`
 * @returns {string} Conteúdo SVG para inserir dentro de `<defs>`
 */
export function defsTransicaoSVG(estadoTr) {
  const blurX = estadoTr?.blurX ?? 0
  const iris = estadoTr?.iris
  let defs = `<filter id="blur-chicote" x="-25%" y="-10%" width="150%" height="120%">` +
    `<feGaussianBlur in="SourceGraphic" stdDeviation="${r(blurX, 2)},0" />` +
    `</filter>`

  if (iris) {
    defs += `<clipPath id="clip-iris">` +
      `<circle cx="${iris.cx}" cy="${iris.cy}" r="${iris.raio}" />` +
      `</clipPath>`
  }
  return defs
}

/**
 * Gera uma máscara anelar SVG em `#462416` (`PALETA.tinta.escuro`) cobrindo tudo fora do círculo da íris,
 * útil também como camada sobreposta sem depender apenas de `<clipPath>`.
 *
 * @param {object} iris - `{ cx, cy, raio, corFundo, largura, altura }`
 * @returns {string} Path SVG sem contorno (`stroke="none"`)
 */
export function mascaraIrisSVG(iris) {
  if (!iris) return ''
  const W = iris.largura || 1080
  const H = iris.altura || 1920
  const cx = r(iris.cx, 1)
  const cy = r(iris.cy, 1)
  const R = r(Math.max(0.01, iris.raio), 2)
  const cor = iris.corFundo || COR_FUNDO_IRIS
  if (R <= 0.5) {
    return `<rect x="0" y="0" width="${W}" height="${H}" fill="${cor}" stroke="none" />`
  }
  // Retângulo externo + furo circular interno com fill-rule="evenodd"
  const d = `M0 0 H${W} V${H} H0 Z ` +
    `M${cx} ${r(cy - R, 2)} ` +
    `A${R} ${R} 0 1 0 ${cx} ${r(cy + R, 2)} ` +
    `A${R} ${R} 0 1 0 ${cx} ${r(cy - R, 2)} Z`
  return `<path d="${d}" fill="${cor}" fill-rule="evenodd" stroke="none" />`
}

/**
 * Compõe o conteúdo SVG da cena atual e (se em transição) da próxima cena,
 * aplicando `corte`, `funde`, `chicote` (com `#blur-chicote`) ou `iris` (com `clip-path="url(#clip-iris)"` e fundo `#462416`).
 *
 * @param {string} svgCenaAtual - Conteúdo SVG interno da cena que está saindo
 * @param {string} svgProximaCena - Conteúdo SVG interno da próxima cena (opcional)
 * @param {object} transicao - Configuração da transição da cena
 * @param {number} uTransicao - Progresso `0..1`
 * @param {object} opcoes - `{ largura: 1080, altura: 1920 }`
 * @returns {string} String SVG composta
 */
export function comporTransicaoSVG(svgCenaAtual, svgProximaCena = '', transicao = null, uTransicao = 0, opcoes = {}) {
  const est = calcularTransicao(transicao, uTransicao, opcoes)
  if (!est.ativa) {
    return svgCenaAtual
  }

  const largura = opcoes.largura || 1080
  const altura = opcoes.altura || 1920
  let saida = `<defs>${defsTransicaoSVG(est)}</defs>`

  if (est.tipo === 'iris' && est.iris) {
    // Fundo sólido em #462416 (tinta.escuro, nunca #000000) ao redor da máscara circular
    saida += `<rect x="0" y="0" width="${largura}" height="${altura}" fill="${est.iris.corFundo}" stroke="none" />`
    const conteudoAlvo = (est.proxima.visivel && svgProximaCena) ? svgProximaCena : svgCenaAtual
    saida += `<g clip-path="url(#clip-iris)">${conteudoAlvo}</g>`
    return saida
  }

  if (est.atual.visivel && svgCenaAtual) {
    const attrs = []
    if (est.atual.dx !== 0 || est.atual.dy !== 0) {
      attrs.push(`transform="translate(${est.atual.dx} ${est.atual.dy})"`)
    }
    if (est.atual.opacidade < 1) {
      attrs.push(`opacity="${est.atual.opacidade}"`)
    }
    if (est.atual.usarBlur) {
      attrs.push(`filter="url(#blur-chicote)"`)
    }
    saida += `<g ${attrs.join(' ')}>${svgCenaAtual}</g>`
  }

  if (est.proxima.visivel && svgProximaCena) {
    const attrs = []
    if (est.proxima.dx !== 0 || est.proxima.dy !== 0) {
      attrs.push(`transform="translate(${est.proxima.dx} ${est.proxima.dy})"`)
    }
    if (est.proxima.opacidade < 1) {
      attrs.push(`opacity="${est.proxima.opacidade}"`)
    }
    if (est.proxima.usarBlur) {
      attrs.push(`filter="url(#blur-chicote)"`)
    }
    saida += `<g ${attrs.join(' ')}>${svgProximaCena}</g>`
  }

  return saida
}

if (typeof window !== 'undefined') {
  window.AnimTransicoes = {
    COR_FUNDO_IRIS,
    calcularTransicao,
    defsTransicaoSVG,
    mascaraIrisSVG,
    comporTransicaoSVG,
  }
}
