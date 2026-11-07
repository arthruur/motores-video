// receitas/novela-da-caatinga/kit/legenda.js
// Legenda da série "Novela da Caatinga" em função 100% pura de `t`.
// - Fonte: CaveatBrush (receitas/novela-da-caatinga/fontes/CaveatBrush-Regular.ttf)
// - Zona segura 9:16 (motores/render/CONTRATO.md): left: 120px; width: 660px; top: 1095px (x ∈ [120, 780], y ∈ [1090, 1220] < 1248)
// - Placa orgânica creme quente (#F7E8C6 com borda suave #E2B97E em camada cheia sem stroke)
// - Cor por personagem exclusivamente da PALETA (zero preto #000000).

import { r, lim, fase, saida, mola } from '../../../motores/animacao/timeline.js'
import { PALETA } from './paleta.js'

export const CORES_PERSONAGEM = {
  narrador:      '#462416', // PALETA.tinta.escuro
  dona_mandioca: '#93261B', // PALETA.materiais.lenco_vermelho.sombra
  umbu:          '#3F6925', // PALETA.materiais.folha.meio
  licuri:        '#B0601C', // PALETA.materiais.licuri.sombra
  maxixe:        '#2B5627', // PALETA.materiais.folha.sombra
  quiabo:        '#335722', // PALETA.materiais.quiabo.profunda
  realcador:     '#A61472', // PALETA.materiais.sache_rosa.sombra
  mandacaru:     '#294526', // PALETA.materiais.mandacaru.profunda
  jatai:         '#B5812C', // PALETA.materiais.jatai.sombra
  seu_caju:      '#A3281E', // PALETA.materiais.caju_fruto.sombra
  seu_sacolao:   '#123CA3', // PALETA.materiais.sache_azul.sombra
}

export const NOMES_PERSONAGEM = {
  narrador:      'Narrador',
  dona_mandioca: 'Dona Mandioca',
  umbu:          'Umbu',
  licuri:        'Licuri',
  maxixe:        'Maxixe',
  quiabo:        'Quiabo',
  realcador:     'Realçador',
  mandacaru:     'Mandacaru',
  jatai:         'Jataí',
  seu_caju:      'Seu Caju',
  seu_sacolao:   'Seu Sacolão',
}

// Zona segura 9:16 estrita quando y >= 840: x ∈ [120, 780] (width = 660), y < 1248
export const ZONA_LEGENDA = {
  left: 120,
  width: 660,
  top: 1136,
  height: 98,
  cx: 450, // centro horizontal de [120, 780]
  cy: 1185,
}

const PALAVRAS_LIGACAO = new Set([
  'o', 'a', 'os', 'as', 'de', 'do', 'da', 'dos', 'das',
  'e', 'no', 'na', 'nos', 'nas', 'ao', 'aos', 'um', 'uma',
  'que', 'se', 'em', 'é', 'para', 'pra', 'por', 'com', 'sem', 'não',
])

/**
 * Garante que uma fala tenha o vetor `palavras` com `{ texto, inicio, fim }`
 * relativos ao início da cena. Se não houver alinhamento prévio, reparte `fala.dur`
 * proporcionalmente ao comprimento das palavras (e pontuação).
 */
export function alinharPalavrasFala(fala) {
  const iniFala = fala.ini ?? 0
  const textoBruto = String(fala.texto || '').trim()
  if (!textoBruto) return []

  if (Array.isArray(fala.palavras) && fala.palavras.length > 0) {
    return fala.palavras.map(p => ({
      texto: String(p.texto),
      inicio: r(p.inicio ?? iniFala, 3),
      fim: r(p.fim ?? ((p.inicio ?? iniFala) + 0.22), 3),
    }))
  }

  const tokens = textoBruto.split(/\s+/).filter(Boolean)
  const durTotal = Math.max(0.4, fala.dur ?? Math.max(1.2, tokens.length * 0.34))
  const pesos = tokens.map(tok => {
    const base = Math.max(2, tok.replace(/[^\p{L}\p{N}]/gu, '').length)
    const pausaPontuacao = /[.?!…:;]$/.test(tok) ? 2.2 : /[,]$/.test(tok) ? 1.2 : 0
    return base + pausaPontuacao
  })
  const somaPesos = pesos.reduce((a, b) => a + b, 0) || 1

  let cursor = iniFala
  return tokens.map((tok, i) => {
    const fatia = (pesos[i] / somaPesos) * durTotal
    const wIni = r(cursor, 3)
    const wFim = r(cursor + fatia, 3)
    cursor += fatia
    return { texto: tok, inicio: wIni, fim: wFim }
  })
}

/**
 * Compila todas as falas das cenas em blocos curtos (máx. 4 palavras / ~24 caracteres)
 * com tempos globais (`ini`, `fim`) para o episódio inteiro.
 *
 * @param {Array<object>} cenas - Lista de cenas com `{ ini, dur, falas }`
 * @returns {Array<object>} Lista de blocos compilados
 */
export function compilarBlocosLegenda(cenas = []) {
  const blocos = []

  for (const c of cenas) {
    const iniCena = c.ini ?? 0
    const fimCena = iniCena + (c.dur ?? 5)
    for (const f of c.falas || []) {
      const quem = f.quem || f.personagem || 'narrador'
      const cor = CORES_PERSONAGEM[quem] || PALETA.tinta.escuro
      const palavrasCena = alinharPalavrasFala(f)
      let atual = []

      const fecharBloco = () => {
        const sobra = []
        while (
          atual.length > 1 &&
          PALAVRAS_LIGACAO.has(atual.at(-1).texto.toLowerCase().replace(/[^\p{L}]/gu, ''))
        ) {
          sobra.unshift(atual.pop())
        }
        if (atual.length > 0) {
          blocos.push({
            quem,
            nome: NOMES_PERSONAGEM[quem] || quem,
            cor,
            cenaId: c.id,
            fimCena,
            palavras: atual,
            texto: atual.map(w => w.texto).join(' '),
          })
        }
        atual = sobra
      }

      for (const p of palavrasCena) {
        const wGlobal = {
          texto: p.texto,
          inicio: r(iniCena + p.inicio, 3),
          fim: r(iniCena + p.fim, 3),
        }
        const candidatoTxt = [...atual, wGlobal].map(x => x.texto).join(' ')
        if (atual.length > 0 && (atual.length >= 4 || candidatoTxt.length > 24)) {
          fecharBloco()
        }
        atual.push(wGlobal)
        if (/[.?!:…]$/.test(p.texto)) {
          fecharBloco()
        }
      }
      fecharBloco()
    }
  }

  return blocos.map((b, idx) => {
    const proxIni = blocos[idx + 1]?.palavras[0]?.inicio ?? Infinity
    const ini = r(Math.max(0, b.palavras[0].inicio - 0.04), 3)
    const fimNatural = b.palavras.at(-1).fim + 0.55
    const fim = r(Math.min(fimNatural, proxIni - 0.04, b.fimCena - 0.02), 3)
    return {
      ...b,
      indice: idx,
      ini,
      fim: Math.max(ini + 0.18, fim),
    }
  })
}

/**
 * Retorna o estado instantâneo da legenda em `t` (segundos globais do vídeo).
 */
export function estadoLegendaEm(blocos, t) {
  for (const b of blocos) {
    if (t >= b.ini && t < b.fim) {
      const uEntrada = fase(t, b.ini, 0.14)
      const uSaida = fase(t, b.fim - 0.12, 0.12)
      const opacidadePlaca = r(saida(uEntrada) * (1 - uSaida), 3)
      const escalaPlaca = r(0.96 + 0.04 * saida(uEntrada) + 0.025 * mola(t - b.ini, 2.5, 6), 3)
      const palavras = b.palavras.map(w => {
        const q = fase(t, w.inicio - 0.04, 0.14)
        const s = saida(q)
        const dy = r((1 - s) * 10, 1)
        const esc = r(0.92 + 0.08 * s + 0.04 * mola(t - w.inicio, 3.0, 7.0), 3)
        return {
          texto: w.texto,
          opacidade: r(q, 3),
          dy,
          escala: esc,
        }
      })
      return {
        ativo: true,
        bloco: b,
        opacidadePlaca,
        escalaPlaca,
        palavras,
      }
    }
  }
  return { ativo: false, bloco: null, opacidadePlaca: 0, escalaPlaca: 1, palavras: [] }
}

function escaparXML(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * Renderiza a legenda ativa como grupo SVG puro dentro da zona segura (`x ∈ [120, 780], y ∈ [1096, 1220]`).
 * Usa placa orgânica em 2 camadas cheias (`#E2B97E` borda quente + `#F7E8C6` miolo creme), zero `stroke`.
 */
export function renderizarLegendaSVG(blocos, t) {
  const est = estadoLegendaEm(blocos, t)
  if (!est.ativo || !est.bloco) return ''

  const { bloco, opacidadePlaca, escalaPlaca, palavras } = est
  const txtCompleto = bloco.texto
  const compEstimado = Math.max(240, Math.min(640, txtCompleto.length * 25 + 68))
  const wPlaca = r(compEstimado, 1)
  const hPlaca = 88
  const cx = ZONA_LEGENDA.cx // 450 (centro exato de 120..780)
  const cy = ZONA_LEGENDA.cy // 1158 (< 1248)
  const x0 = r(cx - wPlaca / 2, 1)
  const y0 = r(cy - hPlaca / 2, 1)

  // Placa orgânica em duas formas cheias sobrepostas (sem stroke):
  // 1) Sombra/borda quente em chao_terra.luz (#E2B97E)
  // 2) Miolo creme claro em ceu_dia.baixo (#F7E8C6)
  const rxBorda = 24
  const placaBorda = `<rect x="${r(x0 - 5, 1)}" y="${r(y0 - 3, 1)}" width="${r(wPlaca + 10, 1)}" height="${r(hPlaca + 8, 1)}" rx="${rxBorda}" fill="#E2B97E" stroke="none" opacity="0.92" />`
  const placaMiolo = `<rect x="${x0}" y="${y0}" width="${wPlaca}" height="${hPlaca}" rx="${rxBorda - 3}" fill="#F7E8C6" stroke="none" opacity="0.96" />`

  // Posiciona cada palavra horizontalmente de forma proporcional ao número de caracteres
  const larguras = palavras.map(p => Math.max(1.4, p.texto.length + 0.55))
  const somaLarg = larguras.reduce((a, b) => a + b, 0) || 1
  const largUtil = Math.min(wPlaca - 44, somaLarg * 23)
  let cursorX = cx - largUtil / 2

  const tspans = palavras.map((p, i) => {
    const fatiaW = (larguras[i] / somaLarg) * largUtil
    const px = r(cursorX + fatiaW / 2, 1)
    const py = r(cy + 16 + p.dy, 1)
    cursorX += fatiaW
    return `<text x="${px}" y="${py}" text-anchor="middle" font-family="CaveatBrush, Mao, cursive" font-size="50" fill="${bloco.cor}" stroke="none" opacity="${p.opacidade}" transform="translate(${px} ${py}) scale(${p.escala}) translate(${-px} ${-py})">${escaparXML(p.texto)}</text>`
  }).join('')

  return `<g id="camada-legenda" opacity="${opacidadePlaca}" transform="translate(${cx} ${cy}) scale(${escalaPlaca}) translate(${-cx} ${-cy})">` +
    placaBorda +
    placaMiolo +
    tspans +
    `</g>`
}

/**
 * Cria e controla a legenda via DOM sobre o palco (garante kerning nativo da fonte CaveatBrush
 * e placa creme orgânica estritamente dentro de `left: 120px; width: 660px; top: 1096px`).
 */
export function criarLegendaDOM(cenas, palco) {
  const blocos = compilarBlocosLegenda(cenas)
  const raiz = document.createElement('div')
  raiz.id = 'legenda-kit'
  Object.assign(raiz.style, {
    position: 'absolute',
    left: `${ZONA_LEGENDA.left}px`,
    top: `${ZONA_LEGENDA.top}px`,
    width: `${ZONA_LEGENDA.width}px`,
    height: `${ZONA_LEGENDA.height}px`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'none',
    zIndex: '500',
  })
  palco.appendChild(raiz)

  const elementos = blocos.map(b => {
    const placa = document.createElement('div')
    placa.className = 'legenda-placa'
    Object.assign(placa.style, {
      display: 'none',
      maxWidth: '648px',
      padding: '10px 26px 12px 26px',
      borderRadius: '24px',
      backgroundColor: '#F7E8C6',
      boxShadow: '0 6px 0 #E2B97E',
      color: b.cor,
      fontFamily: '"CaveatBrush", "Mao", cursive',
      fontSize: '50px',
      lineHeight: '1.06',
      textAlign: 'center',
      whiteSpace: 'nowrap',
      transformOrigin: '50% 50%',
    })

    const spans = b.palavras.map(w => {
      const sp = document.createElement('span')
      sp.textContent = w.texto
      Object.assign(sp.style, {
        display: 'inline-block',
        margin: '0 0.13em',
        transformOrigin: '50% 80%',
      })
      placa.appendChild(sp)
      return { el: sp, inicio: w.inicio }
    })

    raiz.appendChild(placa)
    return { bloco: b, placa, spans }
  })

  function atualizar(t) {
    for (const item of elementos) {
      const { bloco: b, placa, spans } = item
      const vis = t >= b.ini && t < b.fim
      placa.style.display = vis ? 'inline-block' : 'none'
      if (!vis) continue

      const uEntrada = fase(t, b.ini, 0.14)
      const uSaida = fase(t, b.fim - 0.12, 0.12)
      const op = r(saida(uEntrada) * (1 - uSaida), 3)
      const escPlaca = r(0.96 + 0.04 * saida(uEntrada) + 0.02 * mola(t - b.ini, 2.5, 6), 3)
      placa.style.opacity = String(op)
      placa.style.transform = `scale(${escPlaca})`

      for (const s of spans) {
        const q = fase(t, s.inicio - 0.04, 0.14)
        const dy = r((1 - saida(q)) * 10, 1)
        const escPal = r(0.92 + 0.08 * saida(q) + 0.04 * mola(t - s.inicio, 3.0, 7.0), 3)
        s.el.style.opacity = String(r(q, 3))
        s.el.style.transform = `translateY(${dy}px) scale(${escPal})`
      }
    }
  }

  return {
    blocos,
    raiz,
    atualizar,
  }
}

if (typeof window !== 'undefined') {
  window.KitLegenda = {
    CORES_PERSONAGEM,
    NOMES_PERSONAGEM,
    ZONA_LEGENDA,
    alinharPalavrasFala,
    compilarBlocosLegenda,
    estadoLegendaEm,
    renderizarLegendaSVG,
    criarLegendaDOM,
  }
}
