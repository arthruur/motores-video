// receitas/novela-da-caatinga/kit/cartelas.js
// Componentes visuais de estrutura de episódio da série "Novela da Caatinga":
// - renderizarVinhetaAbertura(tl, dur, opcoes)
// - renderizarCartelaContinua(tl, tInicio, opcoes)
// - renderizarAssinaturaMangaio(tl, dur, opcoes)
// Tudo 100% puro em função de `t`, formas cheias sem contorno (stroke="none"),
// cores exclusivamente de PALETA e estritamente dentro da zona segura 9:16.

import { r, lim, mix, fase, suave, saida, arco, mola, hash } from '../../../motores/animacao/timeline.js'
import { PALETA } from './paleta.js'

function escaparXML(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * Silhueta em camadas de mandacaru (rampa `PALETA.materiais.mandacaru`, zero stroke).
 */
export function desenharMandacaruSilhueta(x, yBase, escala = 1.0, tom = 'meio') {
  const M = PALETA.materiais.mandacaru
  const cCorpo = M[tom] || M.base
  const cLuz = M.luz
  const cSombra = M.profunda

  return `<g transform="translate(${r(x, 1)} ${r(yBase, 1)}) scale(${r(escala, 3)})" stroke="none">` +
    // Sombra no chão
    `<ellipse cx="0" cy="4" rx="52" ry="12" fill="${PALETA.cenario.chao_terra.profunda}" opacity="0.38" />` +
    // Tronco central em 3 tons sobrepostos (sombra à direita, base no centro, luz no topo-esquerdo)
    `<rect x="-24" y="-340" width="48" height="344" rx="22" fill="${cSombra}" />` +
    `<rect x="-24" y="-340" width="38" height="342" rx="18" fill="${cCorpo}" />` +
    `<rect x="-20" y="-334" width="14" height="320" rx="7" fill="${cLuz}" opacity="0.85" />` +
    // Braço esquerdo
    `<path d="M-22 -165 H-68 Q-86 -165 -86 -185 V-275 Q-86 -295 -68 -295 Q-50 -295 -50 -275 V-200 H-22 Z" fill="${cCorpo}" />` +
    `<rect x="-82" y="-290" width="11" height="95" rx="5" fill="${cLuz}" opacity="0.8" />` +
    // Braço direito
    `<path d="M22 -135 H66 Q84 -135 84 -155 V-240 Q84 -260 66 -260 Q48 -260 48 -240 V-170 H22 Z" fill="${cSombra}" />` +
    `<path d="M22 -140 H60 Q74 -140 74 -156 V-236 Q74 -252 60 -252 Q48 -252 48 -236 V-170 H22 Z" fill="${cCorpo}" />` +
    // Flor de mandacaru no topo
    `<circle cx="-6" cy="-342" r="14" fill="${PALETA.materiais.flor_mandacaru.sombra}" />` +
    `<circle cx="-8" cy="-344" r="10" fill="${PALETA.materiais.flor_mandacaru.luz}" />` +
    `<circle cx="-8" cy="-344" r="4.5" fill="${PALETA.materiais.caju_amarelo.base}" />` +
    `</g>`
}

/**
 * Marcador limpo do Cesto (Mangaio) em formas vetoriais cheias (`palha_cesto`, 3 faixas tonais + alça + olhos `#462416`),
 * usado nas cartelas de abertura e assinatura.
 */
export function desenharMiniCestoCartela(x, yBase, escala = 0.72, pose = {}) {
  const P = PALETA.materiais.palha_cesto
  const T = PALETA.tinta
  const dy = pose.dy || 0
  const sx = pose.sx ?? 1
  const sy = pose.sy ?? 1
  const giro = pose.giro || 0
  const pisca = lim(pose.pisca || 0, 0, 1)
  const bracoAng = pose.braco || 0

  const rxSombra = r(92 * escala * lim(1 - (-dy) / 360, 0.45, 1.15), 1)
  const opSombra = r(0.36 * lim(1 - (-dy) / 360, 0.3, 1), 2)
  const escOlhoY = r(Math.max(0.12, 1 - pisca * 0.88), 2)

  return `<g transform="translate(${r(x, 1)} ${r(yBase, 1)})" stroke="none">` +
    `<ellipse cx="0" cy="4" rx="${rxSombra}" ry="${r(16 * escala, 1)}" fill="${PALETA.cenario.chao_terra.profunda}" opacity="${opSombra}" />` +
    `<g transform="translate(0 ${r(dy, 1)}) rotate(${r(giro, 1)}) scale(${r(escala * sx, 3)} ${r(escala * sy, 3)})">` +
      // Patinhas curtas arredondadas
      `<ellipse cx="-44" cy="-6" rx="20" ry="12" fill="${P.profunda}" />` +
      `<ellipse cx="44" cy="-6" rx="20" ry="12" fill="${P.profunda}" />` +
      // Alça superior em arco cheio (diferença de dois caminhos sem stroke)
      `<path d="M-76 -196 C-72 -292 72 -292 76 -196 L56 -196 C52 -266 -52 -266 -56 -196 Z" fill="${P.sombra}" />` +
      `<path d="M-70 -196 C-66 -282 60 -282 66 -196 L54 -196 C48 -262 -48 -262 -54 -196 Z" fill="${P.luz}" />` +
      // Frutinhas coloridas aparecendo na boca do cesto
      `<circle cx="-38" cy="-196" r="24" fill="${PALETA.materiais.tomate.base}" />` +
      `<circle cx="-44" cy="-202" r="9" fill="${PALETA.materiais.tomate.luz}" />` +
      `<circle cx="4" cy="-204" r="26" fill="${PALETA.materiais.caju_amarelo.base}" />` +
      `<circle cx="-2" cy="-212" r="10" fill="${PALETA.materiais.caju_amarelo.luz}" />` +
      `<ellipse cx="42" cy="-198" rx="25" ry="20" fill="${PALETA.materiais.folha.base}" />` +
      `<ellipse cx="36" cy="-203" rx="12" ry="8" fill="${PALETA.materiais.folha.luz}" />` +
      // Corpo do cesto: trapézio arredondado em 3 faixas tonais de palha (profunda/sombra/base/luz)
      `<path d="M-108 -188 Q-114 -188 -110 -172 L-82 -24 Q-78 -6 -58 -6 H58 Q78 -6 82 -24 L110 -172 Q114 -188 108 -188 Z" fill="${P.sombra}" />` +
      `<path d="M-104 -188 L-78 -26 Q-74 -10 -56 -10 H44 Q62 -10 68 -26 L94 -188 Z" fill="${P.base}" />` +
      // Faixas horizontais de trançado da palha
      `<path d="M-96 -142 H96 L91 -114 H-91 Z" fill="${P.meio}" />` +
      `<path d="M-86 -82 H86 L81 -54 H-81 Z" fill="${P.meio}" />` +
      // Volume de luz no topo-esquerdo
      `<path d="M-102 -184 H-24 L-38 -20 H-60 Q-74 -20 -78 -34 Z" fill="${P.luz}" opacity="0.55" />` +
      // Borda trançada superior do cesto
      `<rect x="-116" y="-202" width="232" height="24" rx="12" fill="${P.sombra}" />` +
      `<rect x="-114" y="-202" width="218" height="18" rx="9" fill="${P.luz}" />` +
      // Braços-patinha
      `<g transform="translate(-98 -110) rotate(${r(-20 - bracoAng, 1)})">` +
        `<rect x="-38" y="-13" width="44" height="26" rx="13" fill="${P.sombra}" />` +
        `<rect x="-36" y="-13" width="40" height="20" rx="10" fill="${P.base}" />` +
      `</g>` +
      `<g transform="translate(98 -110) rotate(${r(20 + bracoAng, 1)})">` +
        `<rect x="-6" y="-13" width="44" height="26" rx="13" fill="${P.sombra}" />` +
        `<rect x="-6" y="-13" width="40" height="20" rx="10" fill="${P.base}" />` +
      `</g>` +
      // Rosto oficial (ARTE.md §6): dois ovais verticais #462416 + boca cheia #462416 com interior #C5441E
      `<ellipse cx="-28" cy="-112" rx="10" ry="${r(16 * escOlhoY, 1)}" fill="${T.escuro}" />` +
      `<ellipse cx="28" cy="-112" rx="10" ry="${r(16 * escOlhoY, 1)}" fill="${T.escuro}" />` +
      `<path d="M-20 -82 Q0 -76 20 -82 Q18 -56 0 -56 Q-18 -56 -20 -82 Z" fill="${T.escuro}" />` +
      `<path d="M-12 -68 Q0 -74 12 -68 Q8 -58 0 -58 Q-8 -58 -12 -68 Z" fill="${T.boca_interior}" />` +
    `</g>` +
  `</g>`
}

/**
 * 1. Vinheta de Abertura da Série ("Novela da Caatinga" + subtítulo + sol + mandacarus + Cesto quicando).
 * Posiciona todos os textos e elementos importantes dentro da zona segura (`x ∈ [140, 860], y ∈ [310, 1180]`).
 *
 * @param {number} tl - Tempo local na cena (segundos)
 * @param {number} dur - Duração da vinheta (segundos, padrão 4.0)
 * @param {object} opcoes - `{ titulo, subtitulo, incluirFundo }`
 * @returns {string} SVG `<g>` puro sem contorno
 */
export function renderizarVinhetaAbertura(tl, dur = 4.0, opcoes = {}) {
  const subtitulo = opcoes.subtitulo || 'Capítulo 1 · Serra Pequena e o Mangaio'
  const incluirFundo = opcoes.incluirFundo !== false

  const uSol = saida(fase(tl, 0.0, 1.1))
  const ySol = mix(540, 420, uSol)
  const rSol = mix(68, 92, uSol)

  // Palavras do título entrando uma a uma com mola
  const palavrasTitulo = [
    { txt: 'Novela',   x: 315, y: 555, ini: 0.12, rot: -3.5, tam: 112 },
    { txt: 'da',       x: 545, y: 552, ini: 0.28, rot: 2.5,  tam: 86 },
    { txt: 'Caatinga', x: 475, y: 668, ini: 0.44, rot: -2.0, tam: 122 },
  ]

  const svgPalavras = palavrasTitulo.map(p => {
    const q = fase(tl, p.ini, 0.38)
    if (q <= 0) return ''
    const s = saida(q)
    const m = mola(tl - p.ini - 0.32, 2.8, 5.5)
    const esc = r(0.75 + 0.25 * s + 0.09 * m, 3)
    const dy = r((1 - s) * 44, 1)
    const ang = r((1 - s) * p.rot * 2 + p.rot * 0.35, 2)
    return `<g opacity="${r(q, 3)}" transform="translate(${p.x} ${r(p.y + dy, 1)}) rotate(${ang}) scale(${esc})">` +
      `<text x="4" y="5" text-anchor="middle" font-family="CaveatBrush, Mao, cursive" font-size="${p.tam}" fill="${PALETA.cenario.chao_terra.luz}" stroke="none">${p.txt}</text>` +
      `<text x="0" y="0" text-anchor="middle" font-family="CaveatBrush, Mao, cursive" font-size="${p.tam}" fill="${PALETA.tinta.escuro}" stroke="none">${p.txt}</text>` +
      `</g>`
  }).join('')

  // Placa de subtítulo na zona segura (x: 170..770, y: 720..792)
  const qSub = fase(tl, 0.78, 0.42)
  const sSub = saida(qSub)
  const mSub = mola(tl - 1.15, 2.5, 6.0)
  const escSub = r(0.9 + 0.1 * sSub + 0.04 * mSub, 3)
  const svgSubtitulo = qSub > 0
    ? `<g opacity="${r(qSub, 3)}" transform="translate(470 758) scale(${escSub}) translate(-470 -758)">` +
      `<rect x="166" y="718" width="608" height="72" rx="22" fill="${PALETA.cenario.chao_terra.luz}" stroke="none" />` +
      `<rect x="172" y="722" width="596" height="64" rx="19" fill="${PALETA.cenario.ceu_dia.baixo}" stroke="none" />` +
      `<text x="470" y="766" text-anchor="middle" font-family="CaveatBrush, Mao, cursive" font-size="44" fill="${PALETA.materiais.lenco_vermelho.sombra}" stroke="none">${escaparXML(subtitulo)}</text>` +
      `</g>`
    : ''

  // Cesto quicando de alegria na abertura (x = 465, y = 1055, dentro da zona segura)
  const period = 0.75
  const fasePulo = (tl % period) / period
  const noAr = fasePulo < 0.58
  const uAr = noAr ? fasePulo / 0.58 : 0
  const dyCesto = noAr ? -78 * arco(uAr) : 0
  const mPouso = !noAr ? mola((fasePulo - 0.58) * period, 3.2, 6.5) : 0
  const sxCesto = noAr ? 0.94 : 1 + 0.14 * mPouso
  const syCesto = noAr ? 1.07 : 1 - 0.14 * mPouso
  const bracoCesto = noAr ? 28 * arco(uAr) : 8

  let fundoSVG = ''
  if (incluirFundo) {
    fundoSVG =
      `<rect x="0" y="0" width="1080" height="1920" fill="${PALETA.cenario.ceu_dia.alto}" stroke="none" />` +
      `<rect x="0" y="520" width="1080" height="720" fill="${PALETA.cenario.ceu_dia.baixo}" opacity="0.65" stroke="none" />` +
      // Sol em 3 discos concêntricos quentes sem contorno
      `<circle cx="670" cy="${r(ySol, 1)}" r="${r(rSol * 1.65, 1)}" fill="${PALETA.materiais.caju_amarelo.luz}" opacity="0.22" stroke="none" />` +
      `<circle cx="670" cy="${r(ySol, 1)}" r="${r(rSol * 1.25, 1)}" fill="${PALETA.materiais.caju_amarelo.luz}" opacity="0.45" stroke="none" />` +
      `<circle cx="670" cy="${r(ySol, 1)}" r="${r(rSol, 1)}" fill="${PALETA.materiais.caju_amarelo.base}" stroke="none" />` +
      // Serras em 2 planos
      `<path d="M-40 1080 Q190 930 430 1010 Q720 890 1120 1020 L1120 1300 L-40 1300 Z" fill="${PALETA.cenario.serra.longe}" stroke="none" />` +
      `<path d="M-40 1120 Q260 995 560 1065 Q840 970 1120 1085 L1120 1350 L-40 1350 Z" fill="${PALETA.cenario.serra.perto}" stroke="none" />` +
      // Chão de terra
      `<path d="M-40 1070 Q540 1045 1120 1075 L1120 1920 L-40 1920 Z" fill="${PALETA.cenario.chao_terra.base}" stroke="none" />` +
      `<path d="M-40 1130 Q540 1105 1120 1135 L1120 1920 L-40 1920 Z" fill="${PALETA.cenario.chao_terra.meio}" opacity="0.55" stroke="none" />` +
      // Silhuetas de mandacarus em rampa mandacaru
      desenharMandacaruSilhueta(195, 1095, 0.68, 'meio') +
      desenharMandacaruSilhueta(735, 1085, 0.56, 'sombra')
  }

  return `<g id="vinheta-abertura" stroke="none">` +
    fundoSVG +
    // Placa creme orgânica atrás do título principal (x: 155..795, y: 445..705)
    `<rect x="155" y="450" width="635" height="252" rx="38" fill="${PALETA.cenario.chao_terra.luz}" opacity="0.88" />` +
    `<rect x="163" y="456" width="619" height="238" rx="34" fill="${PALETA.cenario.ceu_dia.baixo}" opacity="0.95" />` +
    svgPalavras +
    svgSubtitulo +
    desenharMiniCestoCartela(468, 1060, 0.72, {
      dy: dyCesto,
      sx: sxCesto,
      sy: syCesto,
      braco: bracoCesto,
      pisca: (tl % 3.1) < 0.14 ? 1 : 0,
    }) +
    `</g>`
}

/**
 * 2. Cartela artesanal `"continua..."` inclinada (`-4deg`) na fonte `CaveatBrush` em `#93261B`
 * sobre faixa creme `#F7E8C6`, entrando com `mola` dentro da zona segura (`x: 160..760, y: 340..520`).
 *
 * @param {number} tl - Tempo local da cena (segundos)
 * @param {number} tInicio - Instante em que a cartela entra (segundos)
 * @param {object} opcoes - `{ texto = 'continua...', x = 450, y = 430 }`
 * @returns {string} SVG `<g>` puro sem contorno
 */
export function renderizarCartelaContinua(tl, tInicio = 0, opcoes = {}) {
  if (tl < tInicio) return ''
  const dt = tl - tInicio
  const u = fase(tl, tInicio, 0.34)
  const s = saida(u)
  const osc = mola(dt - 0.18, 2.6, 5.2)
  const escala = r(0.45 + 0.55 * s + 0.12 * osc, 3)
  const opacidade = r(lim(u * 1.4, 0, 1), 3)
  const texto = opcoes.texto || 'continua...'
  // Centro (450, 430) mantém toda a placa de 520x136 dentro de x ∈ [190, 710] e y ∈ [362, 498] (dentro de 160..760, 340..520)
  const cx = opcoes.x ?? 450
  const cy = opcoes.y ?? 430
  const ang = opcoes.angulo ?? -4

  return `<g id="cartela-continua" opacity="${opacidade}" transform="translate(${cx} ${cy}) rotate(${ang}) scale(${escala}) translate(${-cx} ${-cy})" stroke="none">` +
    // Sombra quente deslocada em #462416 (tinta.escuro) com baixa opacidade
    `<rect x="${cx - 252}" y="${cy - 58}" width="516" height="128" rx="28" fill="${PALETA.tinta.escuro}" opacity="0.22" />` +
    // Borda artesanal em chao_terra.luz (#E2B97E)
    `<rect x="${cx - 260}" y="${cy - 66}" width="520" height="130" rx="28" fill="${PALETA.cenario.chao_terra.luz}" />` +
    // Faixa creme principal em #F7E8C6 (ceu_dia.baixo)
    `<rect x="${cx - 250}" y="${cy - 58}" width="500" height="114" rx="22" fill="#F7E8C6" />` +
    // Detalhes decorativos de xilogravura/feira nos cantos da placa (losangos quentes sem stroke)
    `<polygon points="${cx - 222},${cy} ${cx - 210},${cy - 12} ${cx - 198},${cy} ${cx - 210},${cy + 12}" fill="${PALETA.materiais.caju_amarelo.base}" />` +
    `<polygon points="${cx + 222},${cy} ${cx + 210},${cy - 12} ${cx + 198},${cy} ${cx + 210},${cy + 12}" fill="${PALETA.materiais.caju_amarelo.base}" />` +
    // Texto "continua..." em #93261B (PALETA.materiais.lenco_vermelho.sombra)
    `<text x="${cx + 3}" y="${cy + 26}" text-anchor="middle" font-family="CaveatBrush, Mao, cursive" font-size="88" fill="${PALETA.cenario.chao_terra.luz}">${escaparXML(texto)}</text>` +
    `<text x="${cx}" y="${cy + 23}" text-anchor="middle" font-family="CaveatBrush, Mao, cursive" font-size="88" fill="#93261B">${escaparXML(texto)}</text>` +
    `</g>`
}

/**
 * 3. Assinatura Final ("Novela da Caatinga" + "uma história do Mangaio" + `logo.svg` + Cesto pulando no compasso do baião).
 * Estritamente dentro da zona segura 9:16 (`x ∈ [140, 770], y ∈ [320, 1210]`).
 *
 * @param {number} tl - Tempo local na cena de assinatura (segundos)
 * @param {number} dur - Duração da cena (segundos, padrão 4.0)
 * @param {object} opcoes - `{ logoUrl = '/receitas/novela-da-caatinga/logo.svg', incluirFundo = true }`
 * @returns {string} SVG `<g>` puro sem contorno
 */
export function renderizarAssinaturaMangaio(tl, dur = 4.0, opcoes = {}) {
  const logoUrl = opcoes.logoUrl || '/receitas/novela-da-caatinga/logo.svg'
  const incluirFundo = opcoes.incluirFundo !== false

  const qTit = fase(tl, 0.08, 0.45)
  const qSub = fase(tl, 0.35, 0.45)
  const qLogo = fase(tl, 0.58, 0.45)

  const escTit = r(0.88 + 0.12 * saida(qTit) + 0.06 * mola(tl - 0.45, 2.6, 5.5), 3)
  const escSub = r(0.90 + 0.10 * saida(qSub) + 0.04 * mola(tl - 0.72, 2.6, 5.5), 3)
  const escLogo = r(0.85 + 0.15 * saida(qLogo) + 0.06 * mola(tl - 0.95, 2.8, 5.5), 3)

  // Compasso do baião: batidas sincopadas a cada ~0.28s / 0.42s
  const batidasBaiao = [0.15, 0.38, 0.62, 0.88, 1.18, 1.42, 1.68, 1.98, 2.25, 2.52, 2.82, 3.12, 3.42]
  let dyCesto = 0
  let sxCesto = 1
  let syCesto = 1
  let giroCesto = 0
  let bracoCesto = 10

  for (let i = 0; i < batidasBaiao.length; i++) {
    const t0 = batidasBaiao[i]
    const dPulo = 0.20
    const u = (tl - t0) / dPulo
    if (u >= 0 && u <= 1) {
      dyCesto = -46 * arco(u)
      sxCesto = 0.93
      syCesto = 1.08
      giroCesto = (i % 2 === 0 ? 1 : -1) * 5 * arco(u)
      bracoCesto = 32 * arco(u)
    } else if (tl > t0 + dPulo && tl < t0 + dPulo + 0.18) {
      const m = mola(tl - (t0 + dPulo), 3.2, 7.0)
      sxCesto = 1 + 0.12 * m
      syCesto = 1 - 0.12 * m
    }
  }

  let fundoSVG = ''
  if (incluirFundo) {
    fundoSVG =
      `<rect x="0" y="0" width="1080" height="1920" fill="${PALETA.cenario.ceu_dia.baixo}" stroke="none" />` +
      `<circle cx="460" cy="480" r="240" fill="${PALETA.materiais.caju_amarelo.luz}" opacity="0.22" stroke="none" />` +
      `<path d="M-40 1120 Q540 1090 1120 1120 L1120 1920 L-40 1920 Z" fill="${PALETA.cenario.chao_terra.base}" stroke="none" />` +
      desenharMandacaruSilhueta(175, 1135, 0.54, 'meio') +
      desenharMandacaruSilhueta(745, 1135, 0.46, 'sombra')
  }

  // Centro em x = 455 para respeitar x ∈ [120, 780] até em y >= 840
  const cx = 455

  return `<g id="assinatura-mangaio" stroke="none">` +
    fundoSVG +
    // Placa superior da assinatura (x: 150..760, y: 340..625)
    `<g opacity="${r(qTit, 3)}" transform="translate(${cx} 445) scale(${escTit}) translate(${-cx} -445)">` +
      `<rect x="148" y="352" width="614" height="176" rx="30" fill="${PALETA.cenario.chao_terra.luz}" />` +
      `<rect x="156" y="358" width="598" height="162" rx="26" fill="#F7E8C6" />` +
      `<text x="${cx}" y="458" text-anchor="middle" font-family="CaveatBrush, Mao, cursive" font-size="82" fill="${PALETA.tinta.escuro}">Novela da Caatinga</text>` +
    `</g>` +
    // Subtítulo "uma história do Mangaio" (y: 555..625)
    `<g opacity="${r(qSub, 3)}" transform="translate(${cx} 588) scale(${escSub}) translate(${-cx} -588)">` +
      `<rect x="210" y="546" width="490" height="76" rx="20" fill="${PALETA.materiais.lenco_vermelho.sombra}" />` +
      `<text x="${cx}" y="598" text-anchor="middle" font-family="CaveatBrush, Mao, cursive" font-size="48" fill="#F7E8C6">uma história do Mangaio</text>` +
    `</g>` +
    // Logo oficial do Mangaio (x: 315..595, y: 650..790)
    `<g opacity="${r(qLogo, 3)}" transform="translate(${cx} 720) scale(${escLogo}) translate(${-cx} -720)">` +
      `<rect x="295" y="648" width="320" height="136" rx="24" fill="#F7E8C6" opacity="0.92" />` +
      `<image href="${escaparXML(logoUrl)}" x="315" y="660" width="280" height="112" preserveAspectRatio="xMidYMid meet" />` +
    `</g>` +
    // Marcador do Cesto pulando no compasso do baião em y = 1090 (acima de 1248 e dentro de x ∈ [120, 780])
    desenharMiniCestoCartela(cx, 1085, 0.76, {
      dy: dyCesto,
      sx: sxCesto,
      sy: syCesto,
      giro: giroCesto,
      braco: bracoCesto,
      pisca: (tl % 2.7) < 0.14 ? 1 : 0,
    }) +
    `</g>`
}

if (typeof window !== 'undefined') {
  window.KitCartelas = {
    desenharMandacaruSilhueta,
    desenharMiniCestoCartela,
    renderizarVinhetaAbertura,
    renderizarCartelaContinua,
    renderizarAssinaturaMangaio,
  }
}
