// receitas/novela-da-caatinga/kit/cenario_base.js
// Construtores determinísticos de camadas de cenário (fundo 0.3, meio 0.7, frente 1.0, frente_sobreposta 1.15),
// chave de luz (luz_de_cena) e formas simples de marcação (blocagem) do elenco + Cesto do Mangaio.
// Segue rigorosamente ARTE.md, cenarios.md, animacao.md e ARQUITETURA.md §5 e §10:
// - Zero contorno (stroke="none" em absolutamente todas as formas)
// - Volume por sobreposição de 3 a 5 tons da rampa de PALETA
// - Zero preto (#000000); tom mais escuro é #462416 (PALETA.tinta.escuro).

import {
  r, lim, mix, fase, emDois, suave, entrada, saida, entradaSaida,
  arco, antecipar, mola, hash, ruidoSuave,
} from '../../../motores/animacao/timeline.js'
import { PALETA } from './paleta.js'

export const PARALAXE_PADRAO = {
  fundo: 0.3,
  meio: 0.7,
  frente: 1.0,
  frente_sobreposta: 1.15,
  ui: 0.0,
}

export const ALTURA_CESTO_PX = 210 // 1.0 cesto = 210 px na cena 1080x1920

// Tabela oficial de proporções em "cestos" e rampas de cor (ARTE.md §2, §3 e §4)
export const FICHA_MARCADORES = {
  cesto:         { tipo: 'cesto',     alturaCestos: 1.00, larguraCestos: 1.15, rampa: 'palha_cesto',    rotulo: 'Mangaio' },
  mangaio:       { tipo: 'cesto',     alturaCestos: 1.00, larguraCestos: 1.15, rampa: 'palha_cesto',    rotulo: 'Mangaio' },
  dona_mandioca: { tipo: 'retangulo', alturaCestos: 1.35, larguraCestos: 0.62, rampa: 'mandioca_casca', rotulo: 'Dona Mandioca' },
  umbu:          { tipo: 'oval',      alturaCestos: 0.75, larguraCestos: 0.75, rampa: 'umbu',           rotulo: 'Umbu' },
  licuri:        { tipo: 'gota',      alturaCestos: 0.55, larguraCestos: 0.42, rampa: 'licuri',         rotulo: 'Licuri' },
  maxixe:        { tipo: 'oval',      alturaCestos: 0.55, larguraCestos: 0.46, rampa: 'maxixe',         rotulo: 'Maxixe' },
  quiabo:        { tipo: 'coluna',    alturaCestos: 1.15, larguraCestos: 0.34, rampa: 'quiabo',         rotulo: 'Quiabo' },
  mandacaru:     { tipo: 'coluna',    alturaCestos: 2.20, larguraCestos: 0.48, rampa: 'mandacaru',      rotulo: 'Mandacaru' },
  realcador:     { tipo: 'triangulo', alturaCestos: 1.10, larguraCestos: 0.80, rampa: 'sache_rosa',     rotulo: 'Realçador' },
  seu_caju:      { tipo: 'retangulo', alturaCestos: 0.95, larguraCestos: 0.70, rampa: 'caju_fruto',     rotulo: 'Seu Caju' },
  seu_sacolao:   { tipo: 'triangulo', alturaCestos: 1.60, larguraCestos: 1.15, rampa: 'sacola_plastico', rotulo: 'Seu Sacolão' },
  jatai:         { tipo: 'oval',      alturaCestos: 0.24, larguraCestos: 0.32, rampa: 'jatai',          rotulo: 'Jataí' },
}

function normalizarLugar(lugar = 'feira') {
  const l = String(lugar).toLowerCase()
  if (l.includes('acude') || l.includes('açude')) return 'acude'
  if (l.includes('farinha') || l.includes('forno')) return 'casa_farinha'
  if (l.includes('mercadinho') || l.includes('neon') || l.includes('praca')) return 'mercadinho'
  return 'feira'
}

// ============================================================================
// ELEMENTOS DE CENÁRIO EM FORMAS VETORIAIS CHEIAS (ZERO STROKE)
// ============================================================================

function renderizarCeuESol(lugar, luz, tl, opcoes = {}) {
  const ehTarde = luz === 'fim_de_tarde'
  const ehNoite = luz === 'acude_noite'
  const ehChuva = luz === 'chuva'
  const ehMercadinho = lugar === 'mercadinho' || luz === 'mercadinho'

  const ceu = ehTarde ? PALETA.cenario.ceu_tarde : PALETA.cenario.ceu_dia
  const corAlto = ehNoite ? PALETA.cenario.neon_mercadinho.fundo : ceu.alto
  const corBaixo = ehNoite ? PALETA.luz_de_cena.acude_noite.multiplicar : ceu.baixo

  // Panorâmica larga (-360..1440) para suportar pan e chicote sem cortar bordas
  let svg = `<rect x="-360" y="-120" width="1800" height="1450" fill="${corAlto}" stroke="none" />` +
    `<path d="M-360 460 Q540 410 1440 460 L1440 1320 L-360 1320 Z" fill="${corBaixo}" opacity="${ehNoite ? 0.45 : 0.82}" stroke="none" />` +
    `<path d="M-360 760 Q540 720 1440 760 L1440 1320 L-360 1320 Z" fill="${corBaixo}" stroke="none" />`

  if (ehChuva) {
    // Nuvens carregadas em camadas cheias usando agua_acude.sombra e ceu_dia.alto
    svg += `<path d="M-360 -120 H1440 V780 Q1080 830 720 770 Q360 830 0 775 Q-200 810 -360 780 Z" fill="${PALETA.cenario.agua_acude.sombra}" opacity="0.55" stroke="none" />` +
      `<ellipse cx="260" cy="310" rx="340" ry="110" fill="${PALETA.cenario.agua_acude.base}" opacity="0.45" stroke="none" />` +
      `<ellipse cx="780" cy="280" rx="390" ry="125" fill="${PALETA.cenario.agua_acude.sombra}" opacity="0.48" stroke="none" />`
    return svg
  }

  // Sol do sertão (ou lua suave à noite) em 3 discos sobrepostos sem contorno
  const solX = opcoes.solX ?? (lugar === 'acude' ? 780 : 810)
  const subida = opcoes.solSubindo ? saida(lim(tl / 6, 0, 1)) * 75 : 0
  const solY = (opcoes.solY ?? (ehTarde ? 520 : 370)) - subida
  const raio = opcoes.solRaio ?? (ehTarde ? 112 : 92)

  if (ehNoite) {
    svg += `<circle cx="${solX}" cy="${r(solY, 1)}" r="${r(raio * 1.4, 1)}" fill="${PALETA.materiais.flor_mandacaru.meio}" opacity="0.18" stroke="none" />` +
      `<circle cx="${solX}" cy="${r(solY, 1)}" r="${r(raio * 0.78, 1)}" fill="${PALETA.materiais.flor_mandacaru.base}" opacity="0.88" stroke="none" />`
  } else if (!ehMercadinho) {
    const corHalo = ehTarde ? PALETA.materiais.laranja.luz : PALETA.materiais.caju_amarelo.luz
    const corDisco = ehTarde ? PALETA.materiais.laranja.base : PALETA.materiais.caju_amarelo.base
    svg += `<circle cx="${solX}" cy="${r(solY, 1)}" r="${r(raio * 1.85, 1)}" fill="${corHalo}" opacity="0.20" stroke="none" />` +
      `<circle cx="${solX}" cy="${r(solY, 1)}" r="${r(raio * 1.32, 1)}" fill="${corHalo}" opacity="0.42" stroke="none" />` +
      `<circle cx="${solX}" cy="${r(solY, 1)}" r="${r(raio, 1)}" fill="${corDisco}" stroke="none" />` +
      `<circle cx="${r(solX - raio * 0.18, 1)}" cy="${r(solY - raio * 0.18, 1)}" r="${r(raio * 0.65, 1)}" fill="${corHalo}" opacity="0.65" stroke="none" />`
  }

  return svg
}

function renderizarSerraDoisPlanos(semente = 1) {
  const S = PALETA.cenario.serra
  // Plano distante (serra.longe)
  let dLonge = 'M-360 1220 L-360 880'
  for (let x = -360, i = 0; x <= 1440; x += 180, i++) {
    const cx = x + 90
    const cy = r(820 - hash(i, semente) * 115, 1)
    const nx = x + 180
    const ny = r(875 + (hash(i + 5, semente) - 0.5) * 45, 1)
    dLonge += ` Q${cx} ${cy} ${nx} ${ny}`
  }
  dLonge += ' L1440 1220 Z'

  // Plano próximo (serra.perto)
  let dPerto = 'M-360 1240 L-360 955'
  for (let x = -360, i = 0; x <= 1440; x += 150, i++) {
    const cx = x + 75
    const cy = r(900 - hash(i + 11, semente + 2) * 90, 1)
    const nx = x + 150
    const ny = r(950 + (hash(i + 19, semente + 2) - 0.5) * 38, 1)
    dPerto += ` Q${cx} ${cy} ${nx} ${ny}`
  }
  dPerto += ' L1440 1240 Z'

  return `<path d="${dLonge}" fill="${S.longe}" stroke="none" />` +
    `<path d="${dPerto}" fill="${S.perto}" stroke="none" />`
}

function renderizarReguaAcudeFundo(x = 210, yBase = 1140, nivel = 0.18, escala = 1.0) {
  const M = PALETA.cenario.madeira_banca
  const A = PALETA.cenario.agua_acude
  let marcas = ''
  for (let i = 0; i < 8; i++) {
    const my = -32 - i * 28
    const mw = i % 2 === 0 ? 22 : 13
    marcas += `<rect x="-14" y="${my}" width="${mw}" height="5" rx="2" fill="${M.profunda}" stroke="none" />`
  }
  const yAgua = r(-28 - lim(nivel, 0.04, 0.95) * 210, 1)
  return `<g transform="translate(${r(x, 1)} ${r(yBase, 1)}) scale(${r(escala, 3)})" stroke="none">` +
    // Poste de madeira em 3 tons sobrepostos
    `<rect x="-18" y="-275" width="36" height="285" rx="6" fill="${M.sombra}" />` +
    `<rect x="-18" y="-275" width="27" height="283" rx="5" fill="${M.luz}" />` +
    `<rect x="-18" y="-275" width="10" height="280" rx="4" fill="${PALETA.cenario.chao_terra.luz}" opacity="0.65" />` +
    marcas +
    // Marca da lâmina d'água ao redor da régua (formas cheias sem stroke)
    `<ellipse cx="0" cy="${yAgua}" rx="56" ry="8" fill="${A.sombra}" />` +
    `<ellipse cx="-4" cy="${r(yAgua - 2, 1)}" rx="46" ry="5" fill="${A.luz}" />` +
    `</g>`
}

function renderizarUmbuzeiro(x = 220, yBase = 1165, escala = 1.0) {
  const F = PALETA.materiais.folha
  const M = PALETA.cenario.madeira_banca
  const U = PALETA.materiais.umbu

  // Frutinhas de umbu penduradas na copa
  const coordenadasFrutas = [
    [-145, -245], [-85, -310], [-15, -275], [55, -320],
    [115, -255], [-50, -215], [35, -225], [90, -195],
  ]
  const frutas = coordenadasFrutas.map(([fx, fy]) =>
    `<circle cx="${fx}" cy="${fy}" r="10" fill="${U.sombra}" />` +
    `<circle cx="${fx - 1.5}" cy="${fy - 1.5}" r="8.5" fill="${U.base}" />` +
    `<circle cx="${fx - 3.5}" cy="${fy - 3.5}" r="3.5" fill="${U.luz}" />`
  ).join('')

  return `<g transform="translate(${r(x, 1)} ${r(yBase, 1)}) scale(${r(escala, 3)})" stroke="none">` +
    // Sombra fresca larga no chão (cenarios.md: "Sombra fresca: o único lugar frio do lado bom")
    `<ellipse cx="0" cy="8" rx="235" ry="26" fill="${PALETA.cenario.chao_terra.profunda}" opacity="0.38" />` +
    // Raízes aparentes e tronco tortuoso em formas cheias (madeira_banca)
    `<path d="M-75 10 Q-42 -15 -34 -60 L-58 -195 Q-85 -235 -125 -255 L-102 -272 Q-55 -242 -24 -195 L-4 -235 Q32 -255 82 -278 L95 -258 Q45 -232 14 -182 L24 -55 Q38 -12 72 10 Z" fill="${M.profunda}" />` +
    `<path d="M-58 8 Q-34 -18 -28 -62 L-50 -195 Q-72 -228 -110 -248 L-94 -262 Q-48 -232 -18 -190 L2 -180 L14 -55 Q24 -15 46 8 Z" fill="${M.base}" />` +
    `<path d="M-46 4 Q-28 -25 -24 -65 L-42 -190 L-26 -190 L-10 -60 Q-8 -20 -18 4 Z" fill="${M.luz}" opacity="0.7" />` +
    // Copa larga em guarda-chuva (5 tons da rampa folha sobrepostos)
    `<ellipse cx="0" cy="-245" rx="225" ry="88" fill="${F.profunda}" />` +
    `<ellipse cx="-85" cy="-265" rx="135" ry="78" fill="${F.sombra}" />` +
    `<ellipse cx="80" cy="-260" rx="130" ry="74" fill="${F.sombra}" />` +
    `<ellipse cx="-10" cy="-295" rx="165" ry="86" fill="${F.meio}" />` +
    `<ellipse cx="-65" cy="-310" rx="120" ry="68" fill="${F.base}" />` +
    `<ellipse cx="55" cy="-305" rx="115" ry="64" fill="${F.base}" />` +
    `<ellipse cx="-35" cy="-335" rx="110" ry="52" fill="${F.luz}" />` +
    `<ellipse cx="40" cy="-330" rx="85" ry="42" fill="${F.luz}" opacity="0.85" />` +
    frutas +
    `</g>`
}

function renderizarBancaFeira(x0 = 160, x1 = 920, yBase = 1185, variante = 'vermelho') {
  const M = PALETA.cenario.madeira_banca
  const corToldoA = variante === 'amarelo'
    ? PALETA.materiais.caju_amarelo.base
    : PALETA.materiais.lenco_vermelho.base
  const corToldoSombra = variante === 'amarelo'
    ? PALETA.materiais.caju_amarelo.sombra
    : PALETA.materiais.lenco_vermelho.sombra
  const corToldoB = PALETA.cenario.ceu_dia.baixo // #F7E8C6

  const larg = x1 - x0
  const yTampo = yBase - 145
  const yToldo = yBase - 465
  const nListras = 8
  const wListra = (larg + 56) / nListras

  let toldo = ''
  for (let i = 0; i < nListras; i++) {
    const lx = r(x0 - 28 + i * wListra, 1)
    const lw = r(wListra + 1, 1)
    const ehPar = i % 2 === 0
    const cPrincipal = ehPar ? corToldoA : corToldoB
    const cSombra = ehPar ? corToldoSombra : PALETA.cenario.chao_terra.luz
    // Parte de trás/sombra da aba do toldo
    toldo += `<path d="M${lx} ${yToldo} H${r(lx + lw, 1)} V${yToldo + 66} Q${r(lx + lw / 2, 1)} ${yToldo + 94} ${lx} ${yToldo + 66} Z" fill="${cSombra}" stroke="none" />`
    // Parte iluminada superior do toldo
    toldo += `<path d="M${lx} ${yToldo} H${r(lx + lw, 1)} V${yToldo + 56} Q${r(lx + lw / 2, 1)} ${yToldo + 82} ${lx} ${yToldo + 56} Z" fill="${cPrincipal}" stroke="none" />`
  }

  // Frutas/produtos expostos sobre o tampo da banca
  const cxBanca = (x0 + x1) / 2
  const produtos =
    // Gamelas e montes de frutas em formas cheias
    `<ellipse cx="${r(cxBanca - 170, 1)}" cy="${yTampo - 4}" rx="56" ry="16" fill="${M.profunda}" />` +
    `<circle cx="${r(cxBanca - 190, 1)}" cy="${yTampo - 18}" r="18" fill="${PALETA.materiais.tomate.base}" />` +
    `<circle cx="${r(cxBanca - 165, 1)}" cy="${yTampo - 22}" r="20" fill="${PALETA.materiais.tomate.luz}" />` +
    `<circle cx="${r(cxBanca - 142, 1)}" cy="${yTampo - 16}" r="17" fill="${PALETA.materiais.tomate.sombra}" />` +
    `<ellipse cx="${r(cxBanca + 165, 1)}" cy="${yTampo - 4}" rx="58" ry="16" fill="${M.profunda}" />` +
    `<circle cx="${r(cxBanca + 145, 1)}" cy="${yTampo - 18}" r="18" fill="${PALETA.materiais.caju_amarelo.base}" />` +
    `<circle cx="${r(cxBanca + 170, 1)}" cy="${yTampo - 22}" r="20" fill="${PALETA.materiais.caju_amarelo.luz}" />` +
    `<circle cx="${r(cxBanca + 192, 1)}" cy="${yTampo - 16}" r="17" fill="${PALETA.materiais.laranja.base}" />`

  return `<g stroke="none">` +
    // Sombra da banca no chão
    `<ellipse cx="${r(cxBanca, 1)}" cy="${yBase + 6}" rx="${r(larg * 0.52, 1)}" ry="18" fill="${PALETA.cenario.chao_terra.profunda}" opacity="0.40" />` +
    // Esteios verticais de madeira (sombra + luz)
    `<rect x="${x0 + 16}" y="${yToldo + 40}" width="22" height="${yBase - yToldo - 40}" fill="${M.profunda}" />` +
    `<rect x="${x0 + 16}" y="${yToldo + 40}" width="13" height="${yBase - yToldo - 40}" fill="${M.base}" />` +
    `<rect x="${x1 - 38}" y="${yToldo + 40}" width="22" height="${yBase - yToldo - 40}" fill="${M.profunda}" />` +
    `<rect x="${x1 - 38}" y="${yToldo + 40}" width="13" height="${yBase - yToldo - 40}" fill="${M.base}" />` +
    // Ripa horizontal superior sob o toldo
    `<rect x="${x0 - 10}" y="${yToldo - 8}" width="${larg + 20}" height="16" rx="6" fill="${M.profunda}" />` +
    toldo +
    produtos +
    // Saia de tábuas da banca (em 3 tons da rampa madeira_banca)
    `<rect x="${x0 + 24}" y="${yTampo + 26}" width="${larg - 48}" height="${yBase - yTampo - 26}" rx="6" fill="${M.sombra}" />` +
    `<rect x="${x0 + 28}" y="${yTampo + 30}" width="${larg - 64}" height="${yBase - yTampo - 32}" rx="4" fill="${M.base}" />` +
    `<rect x="${x0 + 28}" y="${yTampo + 64}" width="${larg - 56}" height="8" fill="${M.profunda}" />` +
    `<rect x="${x0 + 28}" y="${yTampo + 102}" width="${larg - 56}" height="8" fill="${M.profunda}" />` +
    // Tampo de madeira da banca (sombra + base + faixa de luz superior)
    `<rect x="${x0 - 6}" y="${yTampo}" width="${larg + 12}" height="32" rx="8" fill="${M.profunda}" />` +
    `<rect x="${x0 - 6}" y="${yTampo}" width="${larg + 8}" height="24" rx="7" fill="${M.base}" />` +
    `<rect x="${x0 - 2}" y="${yTampo + 2}" width="${larg - 8}" height="10" rx="4" fill="${M.luz}" />` +
    `</g>`
}

function renderizarChaoTerra(yLinhaChao = 1190, rachado = false, semente = 1) {
  const C = PALETA.cenario.chao_terra
  // Perfil orgânico da linha do chão a ~62% da altura (y = 1190)
  let dBase = `M-360 1960 L-360 ${yLinhaChao}`
  for (let x = -360, i = 0; x <= 1440; x += 120, i++) {
    const dy = (hash(i, semente) - 0.5) * 14
    dBase += ` Q${x + 60} ${r(yLinhaChao + dy, 1)} ${x + 120} ${r(yLinhaChao - dy * 0.6, 1)}`
  }
  dBase += ' L1440 1960 Z'

  // Faixa iluminada no topo do chão e manchas de textura em tons de chao_terra
  let detalhes = `<path d="M-360 ${yLinhaChao + 8} Q540 ${yLinhaChao - 8} 1440 ${yLinhaChao + 8} L1440 ${yLinhaChao + 55} Q540 ${yLinhaChao + 40} -360 ${yLinhaChao + 55} Z" fill="${C.luz}" opacity="0.55" stroke="none" />` +
    `<path d="M-360 ${yLinhaChao + 240} Q540 ${yLinhaChao + 215} 1440 ${yLinhaChao + 245} L1440 1960 L-360 1960 Z" fill="${C.meio}" opacity="0.55" stroke="none" />` +
    `<path d="M-360 ${yLinhaChao + 460} Q540 ${yLinhaChao + 435} 1440 ${yLinhaChao + 465} L1440 1960 L-360 1960 Z" fill="${C.sombra}" opacity="0.48" stroke="none" />`

  // Pedrinhas e ondulações orgânicas cheias (zero stroke)
  for (let i = 0; i < 20; i++) {
    const px = r(-180 + hash(i * 3, semente + 4) * 1440, 1)
    const py = r(yLinhaChao + 28 + hash(i * 3 + 1, semente + 4) * 520, 1)
    const rx = r(16 + hash(i * 3 + 2, semente + 4) * 28, 1)
    const ry = r(4 + hash(i * 5, semente + 4) * 6, 1)
    const tom = i % 3 === 0 ? C.luz : (i % 3 === 1 ? C.sombra : C.profunda)
    detalhes += `<ellipse cx="${px}" cy="${py}" rx="${rx}" ry="${ry}" fill="${tom}" opacity="0.45" stroke="none" />`
  }

  // Se for chão rachado de seca (açude), desenha fendas poligonais cheias afuniladas em chao_terra.profunda (zero stroke!)
  if (rachado) {
    for (let i = 0; i < 18; i++) {
      const x0 = r(-80 + hash(i, semente + 10) * 1240, 1)
      const y0 = r(yLinhaChao + 35 + hash(i + 30, semente + 10) * 460, 1)
      const ang = (hash(i + 60, semente + 10) - 0.5) * 1.1
      const comp = 55 + hash(i + 90, semente + 10) * 85
      const x1 = r(x0 + Math.cos(ang) * comp * 0.5, 1)
      const y1 = r(y0 + Math.sin(ang) * comp * 0.35 + 8, 1)
      const x2 = r(x0 + Math.cos(ang - 0.25) * comp, 1)
      const y2 = r(y0 + Math.sin(ang - 0.25) * comp * 0.6, 1)
      detalhes += `<polygon points="${x0},${y0} ${x1},${r(y1 - 4, 1)} ${x2},${y2} ${x1},${r(y1 + 4, 1)}" fill="${C.profunda}" opacity="0.78" stroke="none" />`
    }
  }

  return `<path d="${dBase}" fill="${C.base}" stroke="none" />` + detalhes
}

function renderizarCaixotesFrente() {
  const M = PALETA.cenario.madeira_banca
  const S = PALETA.materiais.mandioca_miolo
  const desenharCaixote = (x, y, esc) =>
    `<g transform="translate(${x} ${y}) scale(${esc})" stroke="none">` +
      `<ellipse cx="0" cy="6" rx="76" ry="14" fill="${PALETA.cenario.chao_terra.profunda}" opacity="0.38" />` +
      `<rect x="-68" y="-84" width="136" height="86" rx="6" fill="${M.sombra}" />` +
      `<rect x="-64" y="-82" width="118" height="82" rx="5" fill="${M.luz}" />` +
      `<rect x="-66" y="-56" width="132" height="7" fill="${M.profunda}" />` +
      `<rect x="-66" y="-28" width="132" height="7" fill="${M.profunda}" />` +
    `</g>`

  const desenharSacoFarinha = (x, y, esc) =>
    `<g transform="translate(${x} ${y}) scale(${esc})" stroke="none">` +
      `<ellipse cx="0" cy="6" rx="64" ry="14" fill="${PALETA.cenario.chao_terra.profunda}" opacity="0.38" />` +
      `<path d="M-56 0 Q-66 -92 -42 -128 L42 -128 Q66 -92 56 0 Z" fill="${S.sombra}" />` +
      `<path d="M-52 -2 Q-60 -90 -38 -126 L32 -126 Q52 -90 44 -2 Z" fill="${S.base}" />` +
      `<ellipse cx="0" cy="-126" rx="42" ry="14" fill="${PALETA.materiais.mandioca_casca.meio}" />` +
    `</g>`

  return desenharCaixote(95, 1295, 0.85) +
    desenharSacoFarinha(975, 1290, 0.82)
}

function renderizarLaminaAguaAcude(tl, nivel = 0.18) {
  const A = PALETA.cenario.agua_acude
  const esc = lim(0.55 + nivel * 0.9, 0.45, 1.35)
  const ond = Math.sin(tl * 2.2) * 6
  const rx = r(340 * esc + ond, 1)
  const ry = r(58 * esc, 1)
  return `<g transform="translate(560 1235)" stroke="none">` +
    `<ellipse cx="0" cy="4" rx="${r(rx * 1.08, 1)}" ry="${r(ry * 1.12, 1)}" fill="${PALETA.cenario.chao_terra.profunda}" opacity="0.55" />` +
    `<ellipse cx="0" cy="0" rx="${rx}" ry="${ry}" fill="${A.sombra}" />` +
    `<ellipse cx="-12" cy="-3" rx="${r(rx * 0.88, 1)}" ry="${r(ry * 0.82, 1)}" fill="${A.base}" />` +
    `<ellipse cx="-38" cy="-8" rx="${r(rx * 0.56, 1)}" ry="${r(ry * 0.48, 1)}" fill="${A.luz}" opacity="0.85" />` +
    `</g>`
}

function renderizarCasaFarinhaMeio(tl) {
  const M = PALETA.cenario.madeira_banca
  const T = PALETA.cenario.chao_terra
  const L = PALETA.materiais.laranja
  const Tom = PALETA.materiais.tomate

  const pulsoBrasa = 0.85 + 0.15 * Math.sin(tl * 7.5)
  const angRoda = r((tl * 48) % 360, 1)

  return `<g stroke="none">` +
    // Parede de taipa quente ao fundo da casa de farinha
    `<rect x="-240" y="240" width="1560" height="960" fill="${T.meio}" />` +
    `<rect x="-240" y="240" width="1560" height="420" fill="${T.luz}" opacity="0.55" />` +
    // Vigas de madeira do telhado
    `<rect x="-240" y="220" width="1560" height="44" fill="${M.profunda}" />` +
    `<rect x="-240" y="250" width="1560" height="18" fill="${M.base}" />` +
    // Janela rústica abrindo para o céu do sertão
    `<rect x="130" y="420" width="210" height="230" rx="16" fill="${M.profunda}" />` +
    `<rect x="144" y="434" width="182" height="202" rx="10" fill="${PALETA.cenario.ceu_dia.alto}" />` +
    `<circle cx="265" cy="495" r="34" fill="${PALETA.materiais.caju_amarelo.luz}" />` +
    // Forno de barro para torrar farinha (centro-direita) com brasa viva em laranja/tomate
    `<path d="M470 1190 L495 880 Q510 820 710 820 Q910 820 925 880 L950 1190 Z" fill="${M.sombra}" />` +
    `<path d="M485 1190 L508 890 Q522 835 695 835 Q870 835 885 890 L908 1190 Z" fill="${M.luz}" />` +
    // Chaminé de barro subindo do forno
    `<rect x="780" y="480" width="96" height="360" rx="10" fill="${M.sombra}" />` +
    `<rect x="780" y="480" width="68" height="360" rx="8" fill="${M.base}" />` +
    // Tachão de cobre/barro no topo do forno com farinha branquinha
    `<ellipse cx="710" cy="832" rx="195" ry="28" fill="${M.profunda}" />` +
    `<ellipse cx="710" cy="828" rx="175" ry="20" fill="${PALETA.materiais.mandioca_miolo.base}" />` +
    `<ellipse cx="690" cy="826" rx="125" ry="12" fill="${PALETA.materiais.mandioca_miolo.luz}" />` +
    // Boca da fornalha com brasa ardendo (tomate + laranja + caju_amarelo)
    `<path d="M600 1190 Q600 1015 710 1015 Q820 1015 820 1190 Z" fill="${PALETA.tinta.escuro}" />` +
    `<ellipse cx="710" cy="1155" rx="${r(88 * pulsoBrasa, 1)}" ry="${r(42 * pulsoBrasa, 1)}" fill="${Tom.base}" />` +
    `<ellipse cx="710" cy="1160" rx="${r(64 * pulsoBrasa, 1)}" ry="${r(28 * pulsoBrasa, 1)}" fill="${L.luz}" />` +
    `<ellipse cx="710" cy="1164" rx="${r(36 * pulsoBrasa, 1)}" ry="${r(16 * pulsoBrasa, 1)}" fill="${PALETA.materiais.caju_amarelo.luz}" />` +
    // Roda / prensa de madeira à esquerda (girando suavemente)
    `<rect x="205" y="880" width="34" height="310" rx="6" fill="${M.profunda}" />` +
    `<rect x="205" y="880" width="22" height="310" rx="5" fill="${M.base}" />` +
    `<g transform="translate(222 935) rotate(${angRoda})">` +
      `<circle cx="0" cy="0" r="105" fill="${M.profunda}" />` +
      `<circle cx="0" cy="0" r="86" fill="${T.meio}" />` +
      `<rect x="-102" y="-10" width="204" height="20" rx="6" fill="${M.luz}" />` +
      `<rect x="-10" y="-102" width="20" height="204" rx="6" fill="${M.luz}" />` +
      `<circle cx="0" cy="0" r="24" fill="${M.sombra}" />` +
    `</g>` +
    `</g>`
}

function renderizarMercadinhoMeio(tl) {
  const N = PALETA.cenario.neon_mercadinho
  const SR = PALETA.materiais.sache_rosa
  const SA = PALETA.materiais.sache_azul
  const SP = PALETA.materiais.sacola_plastico

  // Flicker elétrico determinístico nos cortes 0.08..0.16s e 0.24..0.28s de cada ciclo de 2.4s
  const uCiclo = tl % 2.4
  const aceso = !(uCiclo > 0.08 && uCiclo < 0.15) && !(uCiclo > 0.24 && uCiclo < 0.28)

  let prateleiras = ''
  for (let lin = 0; lin < 3; lin++) {
    const py = 740 + lin * 125
    prateleiras += `<rect x="220" y="${py}" width="640" height="14" rx="4" fill="${SP.sombra}" stroke="none" />`
    for (let col = 0; col < 7; col++) {
      const px = 250 + col * 86
      const mat = (lin + col) % 2 === 0 ? SR : SA
      prateleiras +=
        `<rect x="${px}" y="${py - 68}" width="46" height="66" rx="4" fill="${mat.sombra}" stroke="none" />` +
        `<rect x="${px + 2}" y="${py - 66}" width="38" height="62" rx="3" fill="${mat.base}" stroke="none" />` +
        // Reflexo especular duro de plástico (ARTE.md §4: exclusivo do mundo do vilão)
        `<polygon points="${px + 6},${py - 62} ${px + 16},${py - 62} ${px + 8},${py - 12} ${px + 4},${py - 12}" fill="${mat.reflexo}" opacity="0.88" stroke="none" />`
    }
  }

  const corLetreiro = aceso ? N.rosa : SR.profunda
  const corSub = aceso ? N.azul : SA.profunda

  return `<g stroke="none">` +
    // Fachada fria geométrica do Mercadinho Sabor Já
    `<rect x="150" y="450" width="780" height="745" rx="12" fill="${N.fundo}" />` +
    `<rect x="195" y="620" width="690" height="520" rx="8" fill="${aceso ? SP.base : SP.sombra}" />` +
    prateleiras +
    // Marquise superior escura e letreiro néon
    `<rect x="130" y="430" width="820" height="165" rx="18" fill="${SA.profunda}" />` +
    `<rect x="152" y="448" width="776" height="130" rx="14" fill="${N.fundo}" />` +
    // Barras de tubo néon cheias (sem stroke)
    `<rect x="180" y="460" width="720" height="10" rx="5" fill="${corSub}" />` +
    `<rect x="180" y="556" width="720" height="10" rx="5" fill="${corSub}" />` +
    (aceso ? `<rect x="180" y="462" width="720" height="5" rx="2.5" fill="${N.brilho}" opacity="0.85" />` : '') +
    `<text x="540" y="536" text-anchor="middle" font-family="CaveatBrush, Mao, sans-serif" font-size="78" fill="${corLetreiro}">MERCADINHO SABOR JÁ</text>` +
    (aceso ? `<text x="538" y="534" text-anchor="middle" font-family="CaveatBrush, Mao, sans-serif" font-size="78" fill="${N.brilho}" opacity="0.55">MERCADINHO SABOR JÁ</text>` : '') +
    `</g>`
}

/**
 * Constrói o conteúdo SVG das camadas `fundo`, `meio`, `frente` e `frente_sobreposta`
 * para a cena especificada em `tl` (segundos relativos ao início da cena).
 */
export function construirCamadasCenario(cena, tl = 0) {
  const lugar = normalizarLugar(cena.lugar || 'feira')
  const luz = cena.luz || (lugar === 'mercadinho' ? 'mercadinho' : 'feira_dia')
  const nivelAcude = cena.acude ?? 0.18
  const semente = (cena.indice ?? 0) * 7 + 1

  let fundo = ''
  let meio = ''
  let frente = ''
  const frente_sobreposta = ''

  if (lugar === 'casa_farinha') {
    fundo = renderizarCeuESol('feira', luz, tl, { solX: 265, solY: 495, solRaio: 46 })
    meio = renderizarCasaFarinhaMeio(tl)
    frente = renderizarChaoTerra(1190, false, semente) + renderizarCaixotesFrente()
  } else if (lugar === 'acude') {
    fundo = renderizarCeuESol('acude', luz, tl) +
      renderizarSerraDoisPlanos(semente) +
      renderizarReguaAcudeFundo(225, 1175, nivelAcude, 0.95)
    meio =
      // Dois mandacarus de cenário vigiando o açude
      `<g stroke="none">` +
        `<rect x="118" y="885" width="32" height="310" rx="15" fill="${PALETA.materiais.mandacaru.sombra}" />` +
        `<rect x="118" y="885" width="22" height="308" rx="11" fill="${PALETA.materiais.mandacaru.base}" />` +
        `<rect x="920" y="910" width="28" height="285" rx="13" fill="${PALETA.materiais.mandacaru.sombra}" />` +
        `<rect x="920" y="910" width="19" height="283" rx="9" fill="${PALETA.materiais.mandacaru.base}" />` +
      `</g>`
    frente = renderizarChaoTerra(1190, true, semente) + renderizarLaminaAguaAcude(tl, nivelAcude)
  } else if (lugar === 'mercadinho') {
    fundo = renderizarCeuESol('mercadinho', luz, tl) + renderizarSerraDoisPlanos(semente)
    meio = renderizarMercadinhoMeio(tl)
    frente = renderizarChaoTerra(1190, false, semente)
  } else {
    // 'feira' (padrão)
    fundo = renderizarCeuESol('feira', luz, tl, { solSubindo: cena.id?.includes('acordando') }) +
      renderizarSerraDoisPlanos(semente) +
      renderizarReguaAcudeFundo(935, 985, nivelAcude, 0.52)
    meio = renderizarUmbuzeiro(215, 1175, 0.92) +
      renderizarBancaFeira(240, 910, 1185, cena.indice % 2 === 1 ? 'amarelo' : 'vermelho')
    frente = renderizarChaoTerra(1190, false, semente) + renderizarCaixotesFrente()
  }

  return { fundo, meio, frente, frente_sobreposta }
}

/**
 * Renderiza a camada de chave de luz (`PALETA.luz_de_cena`: `feira_dia`, `fim_de_tarde`, `mercadinho`, `acude_noite`, `chuva`).
 */
export function renderizarChaveDeLuz(luz = 'feira_dia', largura = 1080, altura = 1920) {
  const cfg = PALETA.luz_de_cena[luz] || PALETA.luz_de_cena.feira_dia
  if (!cfg || (!cfg.multiplicar && !cfg.rim)) return ''

  let svg = ''
  if (cfg.multiplicar) {
    const op = luz === 'acude_noite' ? 0.34 : 0.18
    svg += `<rect x="0" y="0" width="${largura}" height="${altura}" fill="${cfg.multiplicar}" opacity="${op}" stroke="none" />`
  }
  if (cfg.rim) {
    svg += `<rect x="0" y="0" width="${largura}" height="260" fill="${cfg.rim}" opacity="0.12" stroke="none" />`
  }
  return svg
}

// ============================================================================
// FORMAS SIMPLES DE MARCAÇÃO PARA PERSONAGENS (ARTE.md §2, §3 e §6)
// ============================================================================

/**
 * Calcula o estado cinemático de um marcador (posição, squash/stretch, giro, braços, olhar, expressão)
 * puramente em função de `tl` e das `deixasAtivas`.
 */
export function calcularPoseMarcador(m, tl, deixasAtivas = [], falas = []) {
  const id = m.id || 'cesto'
  const semente = m.semente ?? (id.charCodeAt(0) * 7 + (id.charCodeAt(1) || 3))

  // Respiração contínua obrigatória (animacao.md §5: ±1.5% vertical a cada 3..4s)
  const tAtuacao = emDois(tl, 30)
  const resp = Math.sin(tl * 1.9 + semente) * 0.015
  let dx = 0
  let dy = 0
  let sx = 1 - resp * 0.65
  let sy = 1 + resp
  let giro = 0
  let bracoEsq = 0
  let bracoDir = 0
  let olharX = 0
  let olharY = 0
  let pisca = ((tl + semente * 0.73) % 3.6) < 0.14 ? 1 : 0
  let aperta = 0
  let frutaExtra = false

  // Se o personagem está falando neste instante, anima leve squash rítmico de fala
  const falandoAgora = (falas || []).some(
    f => (f.quem === id || f.personagem === id) && tl >= (f.ini ?? 0) && tl <= (f.ini ?? 0) + (f.dur ?? 2)
  )
  if (falandoAgora) {
    const pulsoFala = Math.sin(tAtuacao * 14 + semente) * 0.035
    sx *= 1 - pulsoFala * 0.6
    sy *= 1 + pulsoFala
    bracoDir += 18 + Math.sin(tAtuacao * 10) * 12
    bracoEsq += 12 + Math.cos(tAtuacao * 10) * 10
  }

  // Processa deixas ativas que têm este marcador como alvo
  for (const d of deixasAtivas || []) {
    const ac = d.acao
    if (!ac) continue
    const alvos = Array.isArray(ac.alvo) ? ac.alvo : [ac.alvo]
    if (!alvos.includes(id) && !alvos.includes('todos')) continue

    const mov = ac.movimento || ac.id || 'quicar'
    const u = lim(d.uAcao ?? d.u ?? 0, 0, 1)
    const dt = d.dt ?? 0
    const dur = ac.dur ?? d.dur ?? 0.75
    const params = ac.params || {}

    if (mov === 'quicar' || mov === 'saltar') {
      const alt = params.altura ?? 165
      if (u < 0.16) {
        // Antecipação: comprime no chão antes de subir
        const a = Math.sin((u / 0.16) * Math.PI)
        sx *= 1 + 0.18 * a
        sy *= 1 - 0.18 * a
        bracoEsq -= 18 * a
        bracoDir -= 18 * a
      } else if (u < 0.74) {
        // No ar em arco parabólico
        const uAr = (u - 0.16) / 0.58
        const hAr = arco(uAr)
        dy -= alt * hAr
        sx *= 1 - 0.08 * hAr
        sy *= 1 + 0.11 * hAr
        bracoEsq += 36 * hAr
        bracoDir += 36 * hAr
        if (params.dx) dx += params.dx * saida(uAr)
      } else {
        // Pouso com squash & mola amortecida
        const dtPouso = (u - 0.74) * dur
        const m = mola(dtPouso, 3.2, 6.0)
        sx *= 1 + 0.20 * m
        sy *= 1 - 0.20 * m
        if (params.dx) dx += params.dx
      }
    } else if (mov === 'pulo_duplo') {
      const alt = params.altura ?? 195
      if (u < 0.42) {
        // 1º pulo preparatório
        const u1 = u / 0.42
        const h1 = arco(u1)
        dy -= alt * 0.55 * h1
        sx *= 1 - 0.06 * h1
        sy *= 1 + 0.08 * h1
        bracoEsq += 25 * h1
        bracoDir += 25 * h1
      } else if (u < 0.86) {
        // 2º pulo alto com pirueta / alegria
        const u2 = (u - 0.42) / 0.44
        const h2 = arco(u2)
        dy -= alt * h2
        giro += (params.pirueta === false ? 14 * Math.sin(u2 * Math.PI * 2) : 360 * entradaSaida(u2))
        bracoEsq += 55 * h2
        bracoDir += 55 * h2
      } else {
        const dtPouso = (u - 0.86) * dur
        const m = mola(dtPouso, 3.4, 6.0)
        sx *= 1 + 0.22 * m
        sy *= 1 - 0.22 * m
      }
    } else if (mov === 'pegar') {
      frutaExtra = true
      if (u < 0.35) {
        // Abre os braços e estica esperando a fruta cair
        const a = saida(u / 0.35)
        sx *= 1 - 0.07 * a
        sy *= 1 + 0.09 * a
        bracoEsq += 48 * a
        bracoDir += 48 * a
        olharY = -0.7 * a
      } else {
        // Impacto da fruta no cesto + mola alegre
        const m = mola((u - 0.35) * dur, 3.0, 5.5)
        sx *= 1 + 0.18 * m
        sy *= 1 - 0.18 * m
        bracoEsq += 22 * Math.max(0, m)
        bracoDir += 22 * Math.max(0, m)
      }
    } else if (mov === 'danca') {
      // Balanço de xote/baião com braços alternados
      const faseXote = dt * 8.5
      const sen = Math.sin(faseXote)
      const cos = Math.cos(faseXote * 2)
      dx += sen * 22
      dy -= Math.abs(sen) * 28
      giro += sen * 8
      sx *= 1 + 0.07 * cos
      sy *= 1 - 0.07 * cos
      bracoEsq += 35 + sen * 32
      bracoDir += 35 - sen * 32
    } else if (mov === 'olhar' || mov === 'piscar' || mov === 'olhar_lados') {
      const dir = params.direcao === 'esq' ? -1 : (params.direcao === 'dir' ? 1 : Math.sin(u * Math.PI * 2))
      olharX = dir * 0.9
      olharY = params.olharY ?? -0.15
      giro += dir * 4.5 * suave(arco(u))
      aperta = 0.45 * suave(arco(u))
      if (u > 0.35 && u < 0.58) pisca = 1
    } else if (mov === 'apontar') {
      const dir = params.direcao === 'esq' ? -1 : 1
      const s = antecipar(u, 0.15, 0.18)
      giro += dir * 7 * s
      olharX = dir * 0.85
      if (dir > 0) {
        bracoDir += 78 * s
        bracoEsq -= 12 * s
      } else {
        bracoEsq += 78 * s
        bracoDir -= 12 * s
      }
    } else if (mov === 'murchar') {
      const s = suave(u < 0.8 ? u / 0.4 : 1)
      sx *= mix(1, 1.12, lim(s))
      sy *= mix(1, 0.84, lim(s))
      bracoEsq -= 28 * lim(s)
      bracoDir -= 28 * lim(s)
      olharY = 0.7 * lim(s)
      aperta = 0.55 * lim(s)
    } else if (mov === 'tremer' || mov === 'assustar') {
      const env = Math.sin(u * Math.PI)
      const vib = Math.sin(dt * 52) * env
      dx += vib * 11
      dy -= Math.abs(vib) * 8
      giro += vib * 5
      sx *= 1 - 0.06 * env
      sy *= 1 + 0.08 * env
      bracoEsq += 45 * env
      bracoDir += 45 * env
    } else if (mov === 'suspenso') {
      // Imóvel com olhar fixo e olho semicerrado de suspense, apenas respirando
      olharX = params.olharX ?? -0.8
      aperta = 0.48
    } else if (mov === 'correr' || mov === 'passo') {
      const dist = params.dx ?? 180
      const s = entradaSaida(u)
      dx += dist * s
      dy -= Math.abs(Math.sin(dt * 18)) * 24
      giro += (dist >= 0 ? 8 : -8) * Math.sin(u * Math.PI)
      bracoEsq += Math.sin(dt * 18) * 35
      bracoDir -= Math.sin(dt * 18) * 35
    } else if (mov === 'abanar' || mov === 'arremessar') {
      const osc = Math.sin(dt * 14)
      bracoDir += 52 + osc * 28
      giro += osc * 3
    }
  }

  return {
    dx: r(dx, 1),
    dy: r(dy, 1),
    sx: r(sx, 3),
    sy: r(sy, 3),
    giro: r(giro, 2),
    bracoEsq: r(bracoEsq, 1),
    bracoDir: r(bracoDir, 1),
    olharX: r(olharX, 2),
    olharY: r(olharY, 2),
    pisca: r(pisca, 2),
    aperta: r(aperta, 2),
    frutaExtra,
    falandoAgora,
  }
}

function escaparXML(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * Renderiza o marcador do Cesto (Mangaio) em rampa `palha_cesto` (3 faixas tonais sem contorno +
 * alça + dois olhinhos ovais `#462416` e patinhas arredondadas) respondendo a todo o repertório de movimentos.
 */
function renderizarMarcadorCesto(m, pose) {
  const P = PALETA.materiais.palha_cesto
  const T = PALETA.tinta
  const escala = m.escala ?? 1.0
  const x = (m.x ?? 540) + pose.dx
  const yBase = m.y ?? 1210

  const alturaAr = Math.max(0, -pose.dy)
  const fatorSombra = lim(1 - alturaAr / 340, 0.38, 1.15)
  const rxSombra = r(106 * escala * fatorSombra, 1)
  const rySombra = r(18 * escala * fatorSombra, 1)
  const opSombra = r(0.40 * fatorSombra, 2)

  const fechaOlho = Math.max(pose.pisca, pose.aperta)
  const ryOlho = r(Math.max(2.2, 17 * (1 - fechaOlho * 0.85)), 1)
  const ox = r(pose.olharX * 9, 1)
  const oy = r(pose.olharY * 6, 1)

  const frutaPulando = pose.frutaExtra
    ? `<circle cx="0" cy="-232" r="22" fill="${PALETA.materiais.caju_fruto.base}" />` +
      `<circle cx="-6" cy="-238" r="8" fill="${PALETA.materiais.caju_fruto.luz}" />`
    : ''

  return `<g id="marcador-${m.id || 'mangaio'}" transform="translate(${r(x, 1)} ${r(yBase, 1)})" stroke="none">` +
    // Sombra de contato elíptica no chão (ARTE.md §5: tom profunda do chão a 40%)
    `<ellipse cx="0" cy="5" rx="${rxSombra}" ry="${rySombra}" fill="${PALETA.cenario.chao_terra.profunda}" opacity="${opSombra}" />` +
    `<g transform="translate(0 ${r(pose.dy, 1)}) rotate(${pose.giro}) scale(${r(escala * pose.sx, 3)} ${r(escala * pose.sy, 3)})">` +
      // Patinhas inferiores curtas e arredondadas
      `<ellipse cx="-46" cy="-7" rx="22" ry="13" fill="${P.profunda}" />` +
      `<ellipse cx="-48" cy="-9" rx="16" ry="9" fill="${P.sombra}" />` +
      `<ellipse cx="46" cy="-7" rx="22" ry="13" fill="${P.profunda}" />` +
      `<ellipse cx="44" cy="-9" rx="16" ry="9" fill="${P.sombra}" />` +
      // Alça de palha em forma cheia (sem stroke)
      `<path d="M-78 -202 C-74 -304 74 -304 78 -202 L56 -202 C52 -276 -52 -276 -56 -202 Z" fill="${P.sombra}" />` +
      `<path d="M-72 -202 C-68 -294 62 -294 68 -202 L54 -202 C48 -272 -48 -272 -54 -202 Z" fill="${P.luz}" />` +
      // Frutas e folhas do cesto
      `<circle cx="-42" cy="-204" r="26" fill="${PALETA.materiais.tomate.base}" />` +
      `<circle cx="-48" cy="-210" r="10" fill="${PALETA.materiais.tomate.luz}" />` +
      `<circle cx="4" cy="-212" r="28" fill="${PALETA.materiais.caju_amarelo.base}" />` +
      `<circle cx="-3" cy="-220" r="11" fill="${PALETA.materiais.caju_amarelo.luz}" />` +
      `<ellipse cx="46" cy="-204" rx="27" ry="22" fill="${PALETA.materiais.folha.base}" />` +
      `<ellipse cx="40" cy="-210" rx="13" ry="8" fill="${PALETA.materiais.folha.luz}" />` +
      frutaPulando +
      // Corpo do cesto em 3 faixas tonais de palha_cesto + volume de sombra/luz
      `<path d="M-114 -196 Q-120 -196 -116 -178 L-86 -24 Q-82 -6 -62 -6 H62 Q82 -6 86 -24 L116 -178 Q120 -196 114 -196 Z" fill="${P.sombra}" />` +
      `<path d="M-110 -196 L-82 -26 Q-78 -10 -58 -10 H46 Q66 -10 72 -26 L100 -196 Z" fill="${P.base}" />` +
      // Faixas horizontais de trançado (3 faixas tonais limpas)
      `<path d="M-102 -148 H102 L96 -118 H-96 Z" fill="${P.meio}" />` +
      `<path d="M-90 -86 H90 L84 -56 H-84 Z" fill="${P.meio}" />` +
      // Luz principal no topo-esquerdo (ARTE.md §5)
      `<path d="M-108 -192 H-26 L-42 -20 H-64 Q-78 -20 -82 -34 Z" fill="${P.luz}" opacity="0.58" />` +
      // Borda trançada superior do cesto
      `<rect x="-122" y="-210" width="244" height="26" rx="13" fill="${P.sombra}" />` +
      `<rect x="-120" y="-210" width="228" height="19" rx="9.5" fill="${P.luz}" />` +
      // Braços em forma de patinha (luva sem dedos, ARTE.md §2)
      `<g transform="translate(-104 -116) rotate(${r(-22 - pose.bracoEsq, 1)})">` +
        `<rect x="-44" y="-14" width="50" height="28" rx="14" fill="${P.sombra}" />` +
        `<rect x="-42" y="-14" width="44" height="22" rx="11" fill="${P.base}" />` +
        `<rect x="-40" y="-12" width="26" height="9" rx="4.5" fill="${P.luz}" />` +
      `</g>` +
      `<g transform="translate(104 -116) rotate(${r(22 + pose.bracoDir, 1)})">` +
        `<rect x="-6" y="-14" width="50" height="28" rx="14" fill="${P.sombra}" />` +
        `<rect x="-6" y="-14" width="44" height="22" rx="11" fill="${P.base}" />` +
        `<rect x="2" y="-12" width="26" height="9" rx="4.5" fill="${P.luz}" />` +
      `</g>` +
      // Rosto kawaii da marca: dois ovais verticais #462416 + boca cheia #462416 com interior #C5441E
      `<ellipse cx="${r(-30 + ox, 1)}" cy="${r(-118 + oy, 1)}" rx="10.5" ry="${ryOlho}" fill="${T.escuro}" />` +
      `<ellipse cx="${r(30 + ox, 1)}" cy="${r(-118 + oy, 1)}" rx="10.5" ry="${ryOlho}" fill="${T.escuro}" />` +
      `<path d="M${r(-22 + ox * 0.6, 1)} ${r(-86 + oy * 0.5, 1)} Q${r(ox * 0.6, 1)} ${r(-80 + oy * 0.5, 1)} ${r(22 + ox * 0.6, 1)} ${r(-86 + oy * 0.5, 1)} Q${r(20 + ox * 0.6, 1)} ${r(-58 + oy * 0.5, 1)} ${r(ox * 0.6, 1)} ${r(-58 + oy * 0.5, 1)} Q${r(-20 + ox * 0.6, 1)} ${r(-58 + oy * 0.5, 1)} ${r(-22 + ox * 0.6, 1)} ${r(-86 + oy * 0.5, 1)} Z" fill="${T.escuro}" />` +
      `<path d="M${r(-13 + ox * 0.6, 1)} ${r(-70 + oy * 0.5, 1)} Q${r(ox * 0.6, 1)} ${r(-76 + oy * 0.5, 1)} ${r(13 + ox * 0.6, 1)} ${r(-70 + oy * 0.5, 1)} Q${r(9 + ox * 0.6, 1)} ${r(-60 + oy * 0.5, 1)} ${r(ox * 0.6, 1)} ${r(-60 + oy * 0.5, 1)} Q${r(-9 + ox * 0.6, 1)} ${r(-60 + oy * 0.5, 1)} ${r(-13 + ox * 0.6, 1)} ${r(-70 + oy * 0.5, 1)} Z" fill="${T.boca_interior}" />` +
    `</g>` +
  `</g>`
}

/**
 * Renderiza um marcador geométrico de blocagem (`retangulo`, `oval`, `gota`, `coluna`, `triangulo`)
 * para os demais personagens em 3 tons da rampa oficial do ingrediente + sombra de contato + etiqueta discreta opcional.
 */
export function renderizarMarcador(m, tl = 0, deixasAtivas = [], falas = []) {
  const id = (m.id || 'cesto').toLowerCase()
  const ficha = FICHA_MARCADORES[id] || {
    tipo: m.tipo || 'oval',
    alturaCestos: m.escala ?? 0.85,
    larguraCestos: (m.escala ?? 0.85) * 0.65,
    rampa: m.rampa || 'umbu',
    rotulo: m.rotulo || m.id || '',
  }
  const tipo = m.tipo || ficha.tipo
  const pose = calcularPoseMarcador(m, tl, deixasAtivas, falas)

  if (tipo === 'cesto' || id === 'cesto' || id === 'mangaio') {
    return renderizarMarcadorCesto(m, pose)
  }

  const nomeRampa = (id === 'licuri' && m.reembalado) ? 'licuri_reembalado' : (m.rampa || ficha.rampa)
  const mat = PALETA.materiais[nomeRampa] || PALETA.materiais.umbu
  const escalaUsr = m.escala ? (m.escala / (ficha.alturaCestos || 1)) : 1.0
  const altPx = r((ficha.alturaCestos || 1.0) * ALTURA_CESTO_PX * escalaUsr, 1)
  const largPx = r((ficha.larguraCestos || 0.65) * ALTURA_CESTO_PX * escalaUsr, 1)
  const hw = r(largPx / 2, 1)

  const x = (m.x ?? 540) + pose.dx
  const yBase = m.y ?? 1200
  const alturaAr = Math.max(0, -pose.dy)
  const fatorSombra = lim(1 - alturaAr / 340, 0.35, 1.15)
  const rxSombra = r(hw * 1.12 * fatorSombra, 1)
  const rySombra = r(Math.max(10, hw * 0.22) * fatorSombra, 1)

  let corpoSVG = ''

  if (tipo === 'retangulo') {
    // Bloco retangular arredondado firme em 3 tons (ex.: Dona Mandioca 1.35x, Seu Caju 0.95x)
    const rx = r(Math.min(34, hw * 0.42), 1)
    corpoSVG =
      `<rect x="${-hw}" y="${-altPx}" width="${largPx}" height="${altPx}" rx="${rx}" fill="${mat.sombra}" />` +
      `<rect x="${-hw}" y="${-altPx}" width="${r(largPx * 0.84, 1)}" height="${r(altPx - 4, 1)}" rx="${rx}" fill="${mat.base}" />` +
      `<rect x="${r(-hw + 8, 1)}" y="${r(-altPx + 10, 1)}" width="${r(largPx * 0.34, 1)}" height="${r(altPx * 0.78, 1)}" rx="${r(rx * 0.6, 1)}" fill="${mat.luz}" opacity="0.82" />`
    if (id === 'dona_mandioca') {
      // Faixa de marcação do lenço vermelho no topo e detalhe creme do miolo
      const LV = PALETA.materiais.lenco_vermelho
      corpoSVG +=
        `<rect x="${-hw - 2}" y="${r(-altPx + 14, 1)}" width="${largPx + 4}" height="32" rx="12" fill="${LV.sombra}" />` +
        `<rect x="${-hw - 2}" y="${r(-altPx + 14, 1)}" width="${r(largPx * 0.82, 1)}" height="24" rx="10" fill="${LV.base}" />`
    }
  } else if (tipo === 'gota') {
    // Forma de gota acolhedora em 3 tons (ex.: Licuri 0.55x)
    corpoSVG =
      `<path d="M0 ${-altPx} C${r(hw * 0.95, 1)} ${r(-altPx * 0.62, 1)} ${r(hw * 1.12, 1)} ${r(-altPx * 0.14, 1)} 0 0 C${r(-hw * 1.12, 1)} ${r(-altPx * 0.14, 1)} ${r(-hw * 0.95, 1)} ${r(-altPx * 0.62, 1)} 0 ${-altPx} Z" fill="${mat.sombra}" />` +
      `<path d="M${r(-hw * 0.06, 1)} ${r(-altPx + 3, 1)} C${r(hw * 0.78, 1)} ${r(-altPx * 0.62, 1)} ${r(hw * 0.92, 1)} ${r(-altPx * 0.16, 1)} ${r(-hw * 0.08, 1)} -4 C${r(-hw * 1.05, 1)} ${r(-altPx * 0.16, 1)} ${r(-hw * 0.90, 1)} ${r(-altPx * 0.62, 1)} ${r(-hw * 0.06, 1)} ${r(-altPx + 3, 1)} Z" fill="${mat.base}" />` +
      `<ellipse cx="${r(-hw * 0.28, 1)}" cy="${r(-altPx * 0.52, 1)}" rx="${r(hw * 0.24, 1)}" ry="${r(altPx * 0.22, 1)}" fill="${mat.luz}" opacity="0.85" />`
  } else if (tipo === 'coluna') {
    // Coluna alta vertical em 3 tons (ex.: Mandacaru 2.2x, Quiabo 1.15x)
    const rx = r(hw * 0.85, 1)
    corpoSVG =
      `<rect x="${-hw}" y="${-altPx}" width="${largPx}" height="${altPx}" rx="${rx}" fill="${mat.sombra}" />` +
      `<rect x="${-hw}" y="${-altPx}" width="${r(largPx * 0.80, 1)}" height="${r(altPx - 4, 1)}" rx="${rx}" fill="${mat.base}" />` +
      `<rect x="${r(-hw + 6, 1)}" y="${r(-altPx + 12, 1)}" width="${r(largPx * 0.28, 1)}" height="${r(altPx * 0.84, 1)}" rx="${r(rx * 0.45, 1)}" fill="${mat.luz}" opacity="0.82" />`
    if (id === 'mandacaru') {
      // Braços laterais de cacto no bloco de marcação do Mandacaru
      corpoSVG +=
        `<path d="M${-hw} ${r(-altPx * 0.52, 1)} H${r(-hw - 42, 1)} Q${r(-hw - 58, 1)} ${r(-altPx * 0.52, 1)} ${r(-hw - 58, 1)} ${r(-altPx * 0.58, 1)} V${r(-altPx * 0.78, 1)} Q${r(-hw - 58, 1)} ${r(-altPx * 0.83, 1)} ${r(-hw - 42, 1)} ${r(-altPx * 0.83, 1)} Q${r(-hw - 26, 1)} ${r(-altPx * 0.83, 1)} ${r(-hw - 26, 1)} ${r(-altPx * 0.78, 1)} V${r(-altPx * 0.60, 1)} H${-hw} Z" fill="${mat.base}" />` +
        `<path d="M${hw} ${r(-altPx * 0.42, 1)} H${r(hw + 38, 1)} Q${r(hw + 54, 1)} ${r(-altPx * 0.42, 1)} ${r(hw + 54, 1)} ${r(-altPx * 0.48, 1)} V${r(-altPx * 0.68, 1)} Q${r(hw + 54, 1)} ${r(-altPx * 0.73, 1)} ${r(hw + 38, 1)} ${r(-altPx * 0.73, 1)} Q${r(hw + 22, 1)} ${r(-altPx * 0.73, 1)} ${r(hw + 22, 1)} ${r(-altPx * 0.68, 1)} V${r(-altPx * 0.50, 1)} H${hw} Z" fill="${mat.sombra}" />`
    }
  } else if (tipo === 'triangulo') {
    // Triângulo / sachê de quina dura (ex.: Realçador 1.1x no mundo do vilão)
    corpoSVG =
      `<polygon points="0,${-altPx} ${hw},0 ${-hw},0" fill="${mat.sombra}" />` +
      `<polygon points="-4,${r(-altPx + 4, 1)} ${r(hw * 0.78, 1)},-3 ${r(-hw * 0.94, 1)},-3" fill="${mat.base}" />` +
      `<polygon points="-8,${r(-altPx + 18, 1)} ${r(-hw * 0.12, 1)},-14 ${r(-hw * 0.68, 1)},-14" fill="${mat.luz}" />` +
      // Reflexo especular branco duro quando material pertence ao mundo do vilão
      (mat.reflexo
        ? `<polygon points="-12,${r(-altPx * 0.78, 1)} -2,${r(-altPx * 0.78, 1)} ${r(-hw * 0.35, 1)},-22 ${r(-hw * 0.48, 1)},-22" fill="${mat.reflexo}" opacity="0.90" />`
        : '')
  } else {
    // 'oval' (ex.: Umbu 0.75x, Maxixe 0.55x, Jataí 0.24x)
    const cy = r(-altPx / 2, 1)
    const ry = r(altPx / 2, 1)
    corpoSVG =
      `<ellipse cx="0" cy="${cy}" rx="${hw}" ry="${ry}" fill="${mat.sombra}" />` +
      `<ellipse cx="${r(-hw * 0.08, 1)}" cy="${r(cy - 2, 1)}" rx="${r(hw * 0.88, 1)}" ry="${r(ry * 0.94, 1)}" fill="${mat.base}" />` +
      `<ellipse cx="${r(-hw * 0.32, 1)}" cy="${r(cy - ry * 0.28, 1)}" rx="${r(hw * 0.36, 1)}" ry="${r(ry * 0.38, 1)}" fill="${mat.luz}" opacity="0.85" />`
  }

  // Etiqueta discreta opcional na base do bloco (somente se m.rotulo for fornecido e m.mostrarRotulo !== false)
  const rotuloTxt = m.rotulo ?? (m.mostrarRotulo ? ficha.rotulo : '')
  const etiquetaSVG = rotuloTxt
    ? `<g transform="translate(0 28)">` +
        `<rect x="-64" y="-18" width="128" height="26" rx="10" fill="#F7E8C6" opacity="0.88" />` +
        `<text x="0" y="1" text-anchor="middle" font-family="CaveatBrush, Mao, cursive" font-size="22" fill="${PALETA.tinta.escuro}">${escaparXML(rotuloTxt)}</text>` +
      `</g>`
    : ''

  return `<g id="marcador-${id}" transform="translate(${r(x, 1)} ${r(yBase, 1)})" stroke="none">` +
    `<ellipse cx="0" cy="4" rx="${rxSombra}" ry="${rySombra}" fill="${PALETA.cenario.chao_terra.profunda}" opacity="${r(0.38 * fatorSombra, 2)}" />` +
    `<g transform="translate(0 ${r(pose.dy, 1)}) rotate(${pose.giro}) scale(${pose.sx} ${pose.sy})">` +
      corpoSVG +
    `</g>` +
    etiquetaSVG +
  `</g>`
}

if (typeof window !== 'undefined') {
  window.KitCenarioBase = {
    PARALAXE_PADRAO,
    ALTURA_CESTO_PX,
    FICHA_MARCADORES,
    construirCamadasCenario,
    renderizarChaveDeLuz,
    calcularPoseMarcador,
    renderizarMarcador,
  }
}
