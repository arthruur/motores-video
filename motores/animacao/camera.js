// motores/animacao/camera.js
// Câmera 2D determinística (pan, push_in, tremida, chicote com motion blur) e paralaxe por camada.
// 100% puro em função de `t` (segundos da cena), sem estado mutável entre quadros.
// Segue motores/animacao/ARQUITETURA.md §5 e motores/render/CONTRATO.md.

import { r, lim, mix, fase, suave, entradaSaida, arco, hash, ruidoSuave } from './timeline.js'

/**
 * Calcula o estado instantâneo da câmera em função pura de `t` (segundos relativos à cena).
 *
 * @param {Array<object>} eventosCamera - Lista de eventos de câmera da cena
 * @param {number} t - Tempo local da cena em segundos
 * @param {number} largura - Largura do quadro (padrão 1080)
 * @param {number} altura - Altura do quadro (padrão 1920)
 * @returns {{ dx: number, dy: number, zoom: number, giro: number, focoX: number, focoY: number, blurX: number }}
 */
export function calcularCamera(eventosCamera = [], t = 0, largura = 1080, altura = 1920) {
  let panDx = 0
  let panDy = 0
  let extraDx = 0
  let extraDy = 0
  let zoom = 1.0
  let giro = 0
  let focoX = largura / 2
  let focoY = Math.round(altura * 0.573) // ~1100 em 1920px (altura de atuação na linha do chão)
  let blurX = 0

  if (!Array.isArray(eventosCamera) || eventosCamera.length === 0) {
    return { dx: 0, dy: 0, zoom: 1, giro: 0, focoX, focoY, blurX: 0 }
  }

  // Ordena de forma estável pelo instante de início
  const ordenados = eventosCamera
    .map((ev, idx) => ({ ...ev, _idx: idx, t: ev.t ?? 0, dur: ev.dur ?? 1.0 }))
    .sort((a, b) => (a.t - b.t) || (a._idx - b._idx))

  let iniciouPan = false
  let iniciouZoom = false

  for (const ev of ordenados) {
    const tipo = ev.tipo || 'pan'
    const t0 = ev.t
    const dur = Math.max(1e-4, ev.dur)

    if (tipo === 'pan') {
      const [dx0 = 0, dy0 = 0] = ev.de || [0, 0]
      const [dx1 = 0, dy1 = 0] = ev.para || [0, 0]

      if (t >= t0 || !iniciouPan) {
        const u = t < t0 ? 0 : fase(t, t0, dur)
        const s = suave(u)
        const curX = mix(dx0, dx1, s)
        const curY = mix(dy0, dy1, s)
        if (ev.aditivo) {
          extraDx += curX
          extraDy += curY
        } else {
          panDx = curX
          panDy = curY
        }
        iniciouPan = true

        if (typeof ev.zoom === 'number' && !iniciouZoom) {
          zoom = ev.zoomDe != null ? mix(ev.zoomDe, ev.zoom, s) : ev.zoom
          iniciouZoom = true
        } else if (ev.zoomDe != null && ev.zoomPara != null) {
          zoom = mix(ev.zoomDe, ev.zoomPara, s)
          iniciouZoom = true
        }
        if (Array.isArray(ev.foco) && ev.foco.length >= 2) {
          focoX = ev.foco[0]
          focoY = ev.foco[1]
        }
      }
    } else if (tipo === 'push_in' || tipo === 'zoom') {
      const z0 = ev.zoomDe ?? zoom ?? 1.0
      const z1 = ev.zoomPara ?? ev.zoom ?? 1.15

      if (t >= t0 || !iniciouZoom) {
        const u = t < t0 ? 0 : fase(t, t0, dur)
        const s = suave(u)
        if (ev.aditivo) {
          zoom *= mix(1.0, z1 / Math.max(0.01, z0), s)
        } else {
          zoom = mix(z0, z1, s)
        }
        iniciouZoom = true

        if (Array.isArray(ev.foco) && ev.foco.length >= 2) {
          const pesoFoco = t < t0 ? 0 : s
          focoX = mix(focoX, ev.foco[0], pesoFoco)
          focoY = mix(focoY, ev.foco[1], pesoFoco)
        }
        if (Array.isArray(ev.de) && Array.isArray(ev.para)) {
          panDx = mix(ev.de[0] ?? 0, ev.para[0] ?? 0, s)
          panDy = mix(ev.de[1] ?? 0, ev.para[1] ?? 0, s)
          iniciouPan = true
        }
      }
    } else if (tipo === 'tremida') {
      if (t >= t0 && t <= t0 + dur) {
        const dt = t - t0
        const u = lim(dt / dur)
        const intensidade = ev.intensidade ?? 12
        const semente = ev.semente ?? (ev._idx * 13 + 7)
        const freq = ev.frequencia ?? 28
        // Decaimento exponencial amortecido que zera exatamente em u = 1
        const env = Math.exp(-3.8 * u) * (1 - u)
        const nx = ruidoSuave(dt * freq, semente) + 0.35 * (hash(Math.floor(dt * 60), semente + 3) * 2 - 1)
        const ny = ruidoSuave(dt * freq + 19.3, semente + 11) + 0.35 * (hash(Math.floor(dt * 60), semente + 9) * 2 - 1)
        extraDx += nx * intensidade * env
        extraDy += ny * intensidade * 0.85 * env
        giro += ruidoSuave(dt * (freq * 0.7), semente + 23) * (intensidade * 0.08) * env
      }
    } else if (tipo === 'chicote') {
      const dirPadrao = ev.direcao === 'dir' ? -1 : 1
      const [dx0 = 0, dy0 = 0] = ev.de || [0, 0]
      const [dx1 = dirPadrao * 240, dy1 = 0] = ev.para || [dirPadrao * 240, 0]

      if (t >= t0) {
        const u = fase(t, t0, dur)
        const s = entradaSaida(u)
        const curX = mix(dx0, dx1, s)
        const curY = mix(dy0, dy1, s)
        if (ev.aditivo) {
          extraDx += curX
          extraDy += curY
        } else {
          panDx = curX
          panDy = curY
        }
        iniciouPan = true

        if (t <= t0 + dur) {
          // Derivada de entradaSaida(u) é 6*u*(1-u) = 1.5 * arco(u) (pico em u = 0.5)
          const dist = Math.hypot(dx1 - dx0, dy1 - dy0)
          const blurPico = ev.blurMax ?? lim(dist * 0.09 + 18, 12, 46)
          const blurAtual = arco(u) * blurPico
          if (blurAtual > blurX) blurX = blurAtual
        }
      }
    }
  }

  return {
    dx: r(panDx + extraDx, 2),
    dy: r(panDy + extraDy, 2),
    zoom: r(Math.max(0.2, zoom), 4),
    giro: r(giro, 3),
    focoX: r(focoX, 1),
    focoY: r(focoY, 1),
    blurX: r(blurX, 2),
  }
}

/**
 * Gera o atributo `transform` SVG para uma camada com fator de paralaxe `paralaxe`.
 * - `fundo`: 0.3
 * - `meio`: 0.7
 * - `frente`: 1.0
 * - `frente_sobreposta`: 1.15
 * - `ui`: 0.0
 *
 * @param {object} cam - Estado retornado por `calcularCamera`
 * @param {number} paralaxe - Fator de paralaxe da camada (padrão 1.0)
 * @returns {string} String para atributo `transform` de `<g>`
 */
export function transformCamada(cam, paralaxe = 1.0) {
  if (!cam || paralaxe === 0) return ''
  const tx = r(-(cam.dx || 0) * paralaxe, 2)
  const ty = r(-(cam.dy || 0) * paralaxe, 2)
  const z = r(1 + ((cam.zoom ?? 1) - 1) * paralaxe, 4)
  const g = r((cam.giro || 0) * paralaxe, 3)
  const fx = r(cam.focoX ?? 540, 1)
  const fy = r(cam.focoY ?? 1100, 1)

  if (tx === 0 && ty === 0 && z === 1 && g === 0) return ''
  if (z === 1 && g === 0) return `translate(${tx} ${ty})`
  if (g === 0) {
    return `translate(${r(fx + tx, 2)} ${r(fy + ty, 2)}) scale(${z}) translate(${-fx} ${-fy})`
  }
  return `translate(${r(fx + tx, 2)} ${r(fy + ty, 2)}) rotate(${g}) scale(${z}) translate(${-fx} ${-fy})`
}

/**
 * Gera o filtro SVG `<defs>` para motion blur horizontal de câmera/chicote.
 * @param {string} id - ID do filtro SVG (padrão 'blur-camera')
 * @param {number} blurX - Desvio padrão horizontal em px
 * @returns {string} Elemento `<filter>` SVG
 */
export function filtroBlurCamera(id = 'blur-camera', blurX = 0) {
  const bx = r(Math.max(0, blurX), 2)
  return `<filter id="${id}" x="-20%" y="-10%" width="140%" height="120%">` +
    `<feGaussianBlur in="SourceGraphic" stdDeviation="${bx},0" />` +
    `</filter>`
}

if (typeof window !== 'undefined') {
  window.AnimCamera = {
    calcularCamera,
    transformCamada,
    filtroBlurCamera,
  }
}
