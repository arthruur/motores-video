#!/usr/bin/env python3
"""Compilador e Montador do Kit de Animação (`motores/animacao/montador.py`).

Lê um roteiro-de-cena JSON (tanto no formato de `deixas` explícitas como `vitrine.json`
e `ep01-feira-acordando.json`, quanto no formato sequencial de `batidas` como
`cap01-inauguracao.json`), resolve todos os tempos de cenas, falas, palavras e deixas
(`plano_compilado.json`), gera a página HTML autocontida (`saida/kit/_<nome>.html`),
chama o mixador de áudio (`motores.animacao.som.mixador`) para sintetizar e normalizar
`saida/kit/<nome>-som.wav` (-14 LUFS / <= -1 dBTP), e opcionalmente invoca
`node motores/render/render.mjs` para gerar o `.mp4` e a folha de contato (`--teste`).
"""
from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
from pathlib import Path
from typing import Any

RAIZ_REPO = Path(__file__).resolve().parents[2]
if str(RAIZ_REPO) not in sys.path:
    sys.path.insert(0, str(RAIZ_REPO))

CAMINHO_CATALOGO_PADRAO = (
    RAIZ_REPO / "receitas" / "novela-da-caatinga" / "kit" / "sons" / "catalogo.json"
)

POSICOES_PADRAO_ELENCO: dict[str, tuple[int, int, str, float]] = {
    "dona_mandioca": (265, 1195, "retangulo", 1.35),
    "cesto": (540, 1215, "cesto", 1.00),
    "mangaio": (540, 1215, "cesto", 1.00),
    "umbu": (815, 1200, "oval", 0.75),
    "maxixe": (320, 1205, "oval", 0.55),
    "quiabo": (780, 1200, "coluna", 1.15),
    "licuri": (760, 1205, "gota", 0.55),
    "realcador": (560, 1205, "triangulo", 1.10),
    "mandacaru": (240, 1195, "coluna", 2.20),
    "seu_caju": (300, 1200, "retangulo", 0.95),
    "jatai": (480, 980, "oval", 0.24),
}


def carregar_catalogo_sons(caminho: Path = CAMINHO_CATALOGO_PADRAO) -> dict[str, Any]:
    """Carrega o catálogo de sons da série para resolução de atalhos e aliases."""
    if caminho.is_file():
        return json.loads(caminho.read_text(encoding="utf-8"))
    return {"efeito_para_som": {}, "aliases": {}, "sons": []}


def alinhar_palavras_fala(texto: str, ini_fala: float, dur_fala: float) -> list[dict[str, Any]]:
    """Divide `dur_fala` proporcionalmente ao comprimento das palavras e pontuação."""
    tokens = [t for t in str(texto).strip().split() if t]
    if not tokens:
        return []

    pesos: list[float] = []
    for tok in tokens:
        letras = len(re.sub(r"[^\wÀ-ÿ]", "", tok))
        pausa = 2.2 if re.search(r"[.?!…:;]$", tok) else (1.2 if tok.endswith(",") else 0.0)
        pesos.append(max(2.0, float(letras)) + pausa)

    soma = sum(pesos) or 1.0
    cursor = float(ini_fala)
    palavras: list[dict[str, Any]] = []
    for tok, peso in zip(tokens, pesos):
        fatia = (peso / soma) * float(dur_fala)
        w_ini = round(cursor, 3)
        w_fim = round(cursor + fatia, 3)
        cursor += fatia
        palavras.append({"texto": tok, "inicio": w_ini, "fim": w_fim})
    return palavras


def resolver_instante_deixa(deixa: dict[str, Any], falas: list[dict[str, Any]]) -> float:
    """Resolve o instante `t` (em segundos relativos ao início da cena) de uma deixa."""
    if "t" in deixa and deixa["t"] is not None:
        return round(max(0.0, float(deixa["t"])), 3)

    anc = deixa.get("ancora")
    if not isinstance(anc, dict) and isinstance(deixa.get("fala"), int):
        anc = deixa

    if isinstance(anc, dict) and "fala" in anc:
        idx = int(anc.get("fala", 0))
        ref = str(anc.get("ref", "ini"))
        delta = float(anc.get("d", 0.0))
        if 0 <= idx < len(falas):
            fl = falas[idx]
            f_ini = float(fl.get("ini", 0.0))
            f_dur = float(fl.get("dur", 1.5))
            if ref == "fim":
                return round(max(0.0, f_ini + f_dur + delta), 3)
            if ref == "palavra" and anc.get("palavra"):
                alvo = re.sub(r"[^\wÀ-ÿ]", "", str(anc["palavra"]).lower())
                for p in fl.get("palavras", []):
                    cand = re.sub(r"[^\wÀ-ÿ]", "", str(p.get("texto", "")).lower())
                    if cand == alvo:
                        return round(max(0.0, float(p.get("inicio", f_ini)) + delta), 3)
            return round(max(0.0, f_ini + delta), 3)

    return 0.0


def _compilar_batidas_em_cena(
    cena: dict[str, Any],
    catalogo: dict[str, Any],
) -> tuple[list[dict[str, Any]], list[dict[str, Any]], list[dict[str, Any]], dict[str, Any] | None]:
    """Converte a lista sequencial `batidas` (estilo cap01-inauguracao.json) em
    `(falas, deixas, camera, cartela)`.
    """
    aliases_som = catalogo.get("aliases", {})
    efeito_para_som = catalogo.get("efeito_para_som", {})

    falas: list[dict[str, Any]] = list(cena.get("falas", []))
    deixas: list[dict[str, Any]] = list(cena.get("deixas", []))
    camera: list[dict[str, Any]] = list(cena.get("camera", []))
    cartela = cena.get("cartela")

    batidas = cena.get("batidas", [])
    if not batidas:
        return falas, deixas, camera, cartela

    cursor = 0.45
    for idx_b, bat in enumerate(batidas):
        if not isinstance(bat, dict):
            continue

        # 1. Fala
        if "fala" in bat and isinstance(bat["fala"], dict):
            f_in = bat["fala"]
            quem = str(f_in.get("quem", f_in.get("personagem", "narrador")))
            texto = str(f_in.get("texto", "")).strip()
            n_pal = max(1, len(texto.split()))
            dur_f = float(f_in.get("dur", round(max(1.25, min(5.2, n_pal * 0.34)), 2)))
            ini_f = float(f_in.get("ini", round(cursor, 2)))
            falas.append(
                {
                    "quem": quem,
                    "texto": texto,
                    "ini": ini_f,
                    "dur": dur_f,
                    "expressao": f_in.get("expressao", "neutra"),
                    "palavras": alinhar_palavras_fala(texto, ini_f, dur_f),
                }
            )
            cursor = round(ini_f + dur_f + 0.30, 2)

        # 2. Som explícito na batida
        if "som" in bat and bat["som"]:
            som_bruto = str(bat["som"])
            som_id = aliases_som.get(som_bruto, som_bruto)
            deixas.append(
                {
                    "id": f"bat_som_{idx_b}",
                    "t": round(cursor, 2),
                    "camada": "frente",
                    "pos": [540, 1200],
                    "som": {"id": som_id, "vol": 0.85},
                }
            )
            cursor = round(cursor + 0.55, 2)

        # 3. Movimento / Ação / Efeito na batida
        mov = bat.get("movimento")
        ef = bat.get("efeito")
        if mov or ef:
            acao_cfg = None
            if isinstance(mov, dict):
                alvo = mov.get("quem", "mangaio")
                if alvo == "cesto":
                    alvo = "mangaio"
                acao_cfg = {
                    "alvo": alvo,
                    "movimento": mov.get("id", "quicar"),
                    "dur": 0.85,
                }
            ef_id = None
            if isinstance(ef, str):
                ef_id = "brilho_plim" if "brilho" in ef else ef
            som_auto = efeito_para_som.get(ef_id) if ef_id else None
            deixas.append(
                {
                    "id": f"bat_acao_{idx_b}",
                    "t": round(cursor, 2),
                    "camada": "frente",
                    "pos": [540, 1180],
                    "acao": acao_cfg,
                    "efeito": {"id": ef_id, "dur": 0.85, "escala": 1.1} if ef_id else None,
                    "som": {"id": som_auto, "vol": 0.82} if som_auto else None,
                }
            )
            cursor = round(cursor + 0.50, 2)

        # 4. Câmera na batida
        if bat.get("camera") == "close":
            camera.append(
                {
                    "tipo": "push_in",
                    "t": round(max(0.0, cursor - 0.3), 2),
                    "dur": 2.2,
                    "zoomDe": 1.0,
                    "zoomPara": 1.14,
                    "foco": [540, 1120],
                }
            )

        # 5. Texto de tela / Cartela
        txt_tela = str(bat.get("texto_tela", ""))
        if txt_tela:
            if "continua" in txt_tela.lower():
                cartela = {"tipo": "continua", "t": round(cursor, 2), "texto": txt_tela}
                cursor = round(cursor + 1.2, 2)
            elif "história do mangaio" in txt_tela.lower() or cena.get("bloco") == "assinatura":
                cartela = {"tipo": "assinatura", "t": 0.0, "texto": txt_tela}
                cursor = round(max(cursor, 3.8), 2)

    return falas, deixas, camera, cartela


def compilar_roteiro(roteiro: dict[str, Any], catalogo: dict[str, Any] | None = None) -> dict[str, Any]:
    """Compila um roteiro-de-cena JSON em um `plano_compilado` com todos os tempos resolvidos."""
    if catalogo is None:
        catalogo = carregar_catalogo_sons()

    efeito_para_som = catalogo.get("efeito_para_som", {})
    aliases_som = catalogo.get("aliases", {})

    plano = dict(roteiro)
    plano["fps"] = int(roteiro.get("fps", 30))
    plano["largura"] = int(roteiro.get("largura", 1080))
    plano["altura"] = int(roteiro.get("altura", 1920))

    cenas_compiladas: list[dict[str, Any]] = []
    cursor_global = 0.0

    for idx_cena, cena_bruta in enumerate(roteiro.get("cenas", [])):
        c = dict(cena_bruta)
        c["indice"] = idx_cena
        c["id"] = str(c.get("id", f"cena_{idx_cena + 1}"))
        c["lugar"] = str(c.get("lugar", "feira"))
        c["luz"] = str(c.get("luz", "mercadinho" if "mercadinho" in c["lugar"] else "feira_dia"))
        c["acude"] = float(c.get("acude", roteiro.get("acude", 0.18)))

        falas, deixas_brutas, camera, cartela = _compilar_batidas_em_cena(c, catalogo)
        c["camera"] = camera
        c["cartela"] = cartela

        # Normaliza falas e garante alinhamento palavra por palavra
        falas_norm: list[dict[str, Any]] = []
        cursor_fala = 0.45
        for f in falas:
            f_copia = dict(f)
            quem = str(f_copia.get("quem", f_copia.get("personagem", "narrador")))
            texto = str(f_copia.get("texto", "")).strip()
            ini_f = float(f_copia.get("ini", cursor_fala))
            n_pal = max(1, len(texto.split()))
            dur_f = float(f_copia.get("dur", round(max(1.2, n_pal * 0.34), 2)))
            f_copia["quem"] = quem
            f_copia["texto"] = texto
            f_copia["ini"] = round(ini_f, 3)
            f_copia["dur"] = round(dur_f, 3)
            if not f_copia.get("palavras"):
                f_copia["palavras"] = alinhar_palavras_fala(texto, ini_f, dur_f)
            cursor_fala = round(ini_f + dur_f + 0.30, 3)
            falas_norm.append(f_copia)
        c["falas"] = falas_norm

        # Se a cena não tiver marcadores explícitos, gera a partir de `personagens`
        if not c.get("marcadores"):
            pers = c.get("personagens", [])
            marcadores_gerados = []
            for p_id in pers:
                chave = "mangaio" if p_id == "cesto" else str(p_id)
                if chave in POSICOES_PADRAO_ELENCO:
                    px, py, ptipo, pesc = POSICOES_PADRAO_ELENCO[chave]
                    marcadores_gerados.append(
                        {
                            "id": chave,
                            "tipo": ptipo,
                            "x": px,
                            "y": py,
                            "escala": pesc,
                        }
                    )
            c["marcadores"] = marcadores_gerados

        # Resolve deixas (tempo `t`, `t_global`, atalho de catálogo `efeito -> som` e aliases)
        deixas_norm: list[dict[str, Any]] = []
        max_fim_deixa = 0.0
        for idx_dx, dx_in in enumerate(deixas_brutas):
            if not isinstance(dx_in, dict):
                continue
            dx = dict(dx_in)
            dx["id"] = str(dx.get("id", f"deixa_{c['id']}_{idx_dx}"))
            t_local = resolver_instante_deixa(dx, falas_norm)
            dx["t"] = t_local

            # Normaliza efeito
            ef = dx.get("efeito")
            if isinstance(ef, str):
                ef = {"id": ef, "dur": 0.85, "escala": 1.0, "semente": idx_dx * 7 + idx_cena * 19 + 1}
            elif isinstance(ef, dict):
                ef = {
                    "id": ef.get("id"),
                    "dur": float(ef.get("dur", 0.85)),
                    "escala": float(ef.get("escala", 1.0)),
                    "semente": int(ef.get("semente", idx_dx * 7 + idx_cena * 19 + 1)),
                    "params": ef.get("params", {}),
                }
            dx["efeito"] = ef

            # Atalho de catálogo: se omitiu `som` (chave ausente) e tem `efeito`, preenche som padrão
            if "som" not in dx and ef and ef.get("id") in efeito_para_som:
                som_padrao = efeito_para_som[ef["id"]]
                if som_padrao and not som_padrao.startswith("amb_"):
                    dx["som"] = {"id": som_padrao, "vol": 0.82}

            som = dx.get("som")
            if isinstance(som, str):
                som = {"id": aliases_som.get(som, som), "vol": 0.85}
            elif isinstance(som, dict) and som.get("id"):
                som = dict(som)
                som["id"] = aliases_som.get(str(som["id"]), str(som["id"]))
            dx["som"] = som

            dur_ef = float(ef["dur"]) if isinstance(ef, dict) and ef.get("dur") else 0.0
            dur_ac = (
                float(dx["acao"].get("dur", 0.8))
                if isinstance(dx.get("acao"), dict)
                else 0.0
            )
            dur_total = max(dur_ef, dur_ac, float(dx.get("dur", 0.6)))
            dx["dur"] = round(dur_total, 3)
            max_fim_deixa = max(max_fim_deixa, t_local + dur_total)
            deixas_norm.append(dx)

        # Determina inicio e duração da cena
        ini_cena = round(float(c.get("ini", cursor_global)), 3)
        dur_sugerida = max(3.5, cursor_fala + 0.35, max_fim_deixa + 0.25)
        dur_cena = round(float(c.get("dur", dur_sugerida)), 3)
        c["ini"] = ini_cena
        c["dur"] = dur_cena

        for dx in deixas_norm:
            dx["t_global"] = round(ini_cena + float(dx["t"]), 3)
        c["deixas"] = deixas_norm

        if not c.get("transicao"):
            c["transicao"] = {"tipo": "corte", "dur": 0}

        cursor_global = round(ini_cena + dur_cena, 3)
        cenas_compiladas.append(c)

    plano["cenas"] = cenas_compiladas
    plano["duracao"] = round(float(roteiro.get("duracao", cursor_global or 5.0)), 3)
    return plano


def gerar_html_cena(plano: dict[str, Any], caminho_html: Path) -> Path:
    """Gera o arquivo HTML autocontido da cena em `caminho_html` (ex.: `saida/kit/_vitrine.html`)."""
    caminho_html.parent.mkdir(parents=True, exist_ok=True)
    plano_json = json.dumps(plano, ensure_ascii=False, indent=2)
    largura = int(plano.get("largura", 1080))
    altura = int(plano.get("altura", 1920))
    titulo = str(plano.get("titulo", "Novela da Caatinga"))

    html = f"""<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>{titulo} · Kit de Animação</title>
  <style>
    @font-face {{
      font-family: 'CaveatBrush';
      src: url('/receitas/novela-da-caatinga/fontes/CaveatBrush-Regular.ttf') format('truetype');
      font-weight: normal;
      font-style: normal;
    }}
    @font-face {{
      font-family: 'Mao';
      src: url('/receitas/novela-da-caatinga/fontes/CaveatBrush-Regular.ttf') format('truetype');
      font-weight: normal;
      font-style: normal;
    }}
    * {{
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      user-select: none;
    }}
    html, body {{
      width: {largura}px;
      height: {altura}px;
      overflow: hidden;
      background-color: #F3D9A4;
      font-family: 'CaveatBrush', 'Mao', cursive;
    }}
    #palco {{
      position: relative;
      width: {largura}px;
      height: {altura}px;
      overflow: hidden;
      background-color: #F3D9A4;
    }}
    #svg-palco {{
      position: absolute;
      left: 0;
      top: 0;
      width: {largura}px;
      height: {altura}px;
      display: block;
      overflow: hidden;
    }}
    #textura-kraft {{
      position: absolute;
      inset: 0;
      background-image: url('/receitas/novela-da-caatinga/texturas/kraft.jpg');
      background-size: cover;
      opacity: 0.10;
      mix-blend-mode: multiply;
      pointer-events: none;
      z-index: 200;
    }}
    #textura-grao {{
      position: absolute;
      inset: 0;
      background-image: url('/receitas/novela-da-caatinga/texturas/grao.png');
      background-repeat: repeat;
      opacity: 0.06;
      mix-blend-mode: multiply;
      pointer-events: none;
      z-index: 210;
    }}
  </style>
</head>
<body>
  <div id="palco">
    <svg id="svg-palco" viewBox="0 0 {largura} {altura}" width="{largura}" height="{altura}" xmlns="http://www.w3.org/2000/svg"></svg>
    <div id="textura-kraft"></div>
    <div id="textura-grao"></div>
  </div>

  <script type="module">
    import {{ r, lim, criarTimeline }} from '/motores/animacao/timeline.js'
    import {{ calcularCamera, transformCamada, filtroBlurCamera }} from '/motores/animacao/camera.js'
    import {{ comporTransicaoSVG }} from '/motores/animacao/transicoes.js'
    import {{ PALETA }} from '/receitas/novela-da-caatinga/kit/paleta.js'
    import {{ renderizarEfeitoSerie, defsEfeitosSerie }} from '/receitas/novela-da-caatinga/kit/efeitos.js'
    import {{
      PARALAXE_PADRAO,
      construirCamadasCenario,
      renderizarChaveDeLuz,
      renderizarMarcador,
    }} from '/receitas/novela-da-caatinga/kit/cenario_base.js'
    import {{ criarLegendaDOM }} from '/receitas/novela-da-caatinga/kit/legenda.js'
    import {{
      renderizarVinhetaAbertura,
      renderizarCartelaContinua,
      renderizarAssinaturaMangaio,
    }} from '/receitas/novela-da-caatinga/kit/cartelas.js'

    const PLANO = {plano_json}
    const W = {largura}
    const H = {altura}

    const palco = document.getElementById('palco')
    const svgPalco = document.getElementById('svg-palco')
    const timeline = criarTimeline(PLANO)
    const legenda = criarLegendaDOM(timeline.cenas, palco)

    function renderizarCenaIsolada(cena, tl) {{
      // Se a cena inteira for cartela de assinatura ou abertura em tela cheia
      const cart = cena.cartela
      if (cart && cart.tipo === 'assinatura') {{
        const ativasAssin = timeline.deixasAtivas(cena, tl)
        let fxAssin = ''
        for (const dx of ativasAssin) {{
          if (dx.efeito && dx.efeito.id) {{
            fxAssin += renderizarEfeitoSerie(
              dx.efeito.id,
              {{
                x: dx.pos?.[0] ?? 455,
                y: dx.pos?.[1] ?? 720,
                escala: dx.efeito.escala ?? 1,
                semente: dx.efeito.semente ?? 1,
                camada: dx.camada || 'frente',
                paleta: PALETA,
              }},
              dx.dt,
              dx.efeito.dur,
              dx.efeito.params || {{}}
            )
          }}
        }}
        return renderizarAssinaturaMangaio(tl, cena.dur, {{
          logoUrl: '/receitas/novela-da-caatinga/logo.svg',
          incluirFundo: true,
        }}) + fxAssin
      }}

      const cam = calcularCamera(cena.camera || [], tl, W, H)
      const ativas = timeline.deixasAtivas(cena, tl)
      const base = construirCamadasCenario(cena, tl)

      const fxPorCamada = {{
        fundo: '',
        meio: '',
        frente: '',
        frente_sobreposta: '',
      }}

      for (const dx of ativas) {{
        if (!dx.efeito || !dx.efeito.id) continue
        const camadaAlvo = fxPorCamada[dx.camada] !== undefined ? dx.camada : 'frente'
        fxPorCamada[camadaAlvo] += renderizarEfeitoSerie(
          dx.efeito.id,
          {{
            x: dx.pos?.[0] ?? 540,
            y: dx.pos?.[1] ?? 1190,
            escala: dx.efeito.escala ?? 1,
            semente: dx.efeito.semente ?? 1,
            camada: camadaAlvo,
            paleta: PALETA,
          }},
          dx.dt,
          dx.efeito.dur,
          dx.efeito.params || {{}}
        )
      }}

      // Ordena marcadores por y para sobreposição correta no plano de atuação
      const marcadoresOrd = [...(cena.marcadores || [])].sort((a, b) => (a.y ?? 1200) - (b.y ?? 1200))
      const svgMarcadores = marcadoresOrd
        .map(m => renderizarMarcador(m, tl, ativas, cena.falas || []))
        .join('')

      const pFundo = cena.camadas?.fundo?.paralaxe ?? PARALAXE_PADRAO.fundo
      const pMeio = cena.camadas?.meio?.paralaxe ?? PARALAXE_PADRAO.meio
      const pFrente = cena.camadas?.frente?.paralaxe ?? PARALAXE_PADRAO.frente
      const pSobre = cena.camadas?.frente_sobreposta?.paralaxe ?? PARALAXE_PADRAO.frente_sobreposta

      const tfFundo = transformCamada(cam, pFundo)
      const tfMeio = transformCamada(cam, pMeio)
      const tfFrente = transformCamada(cam, pFrente)
      const tfSobre = transformCamada(cam, pSobre)

      let mundoSVG =
        `<g id="camada-fundo-${{cena.id}}" ${{tfFundo ? `transform="${{tfFundo}}"` : ''}}>${{base.fundo}}${{fxPorCamada.fundo}}</g>` +
        `<g id="camada-meio-${{cena.id}}" ${{tfMeio ? `transform="${{tfMeio}}"` : ''}}>${{base.meio}}${{fxPorCamada.meio}}</g>` +
        `<g id="camada-frente-${{cena.id}}" ${{tfFrente ? `transform="${{tfFrente}}"` : ''}}>${{base.frente}}${{svgMarcadores}}${{fxPorCamada.frente}}</g>` +
        `<g id="camada-sobreposta-${{cena.id}}" ${{tfSobre ? `transform="${{tfSobre}}"` : ''}}>${{base.frente_sobreposta}}${{fxPorCamada.frente_sobreposta}}</g>` +
        renderizarChaveDeLuz(cena.luz, W, H)

      if (cam.blurX > 0.5) {{
        const idFiltro = `blur-cam-${{cena.indice}}`
        mundoSVG = `<defs>${{filtroBlurCamera(idFiltro, cam.blurX)}}</defs>` +
          `<g filter="url(#${{idFiltro}})">${{mundoSVG}}</g>`
      }}

      // Cartelas de UI da cena (fixas na tela, paralaxe 0.0)
      let uiSVG = ''
      if (cart) {{
        if (cart.tipo === 'abertura') {{
          const durCart = cart.dur ?? 2.8
          if (tl <= durCart) {{
            uiSVG += renderizarVinhetaAbertura(tl, durCart, {{
              subtitulo: PLANO.subtitulo || PLANO.titulo,
              incluirFundo: Boolean(cart.incluirFundo),
            }})
          }}
        }} else if (cart.tipo === 'continua') {{
          uiSVG += renderizarCartelaContinua(tl, cart.t ?? 0, {{
            texto: cart.texto || 'continua...',
          }})
        }}
      }}

      return mundoSVG + uiSVG
    }}

    function seek(tGlobal) {{
      const t = lim(tGlobal, 0, timeline.duracao)
      const visiveis = timeline.cenasVisiveis(t)
      const principal = visiveis[0]

      if (!principal) {{
        svgPalco.innerHTML = ''
        legenda.atualizar(t)
        return timeline.chaveEstado(t)
      }}

      const {{ cena, indice, tl, emTransicao, uTransicao, transicao }} = principal
      const svgAtual = renderizarCenaIsolada(cena, tl)

      let svgFinal = ''
      if (emTransicao && indice + 1 < timeline.cenas.length) {{
        const proxCena = timeline.cenas[indice + 1]
        // Durante a transição (funde, chicote ou iris), renderiza o início da próxima cena
        const tlProx = Math.max(0, (uTransicao || 0) * (transicao?.dur || 0.45))
        const svgProx = renderizarCenaIsolada(proxCena, tlProx)
        svgFinal = `<defs>${{defsEfeitosSerie()}}</defs>` +
          comporTransicaoSVG(svgAtual, svgProx, transicao, uTransicao, {{ largura: W, altura: H }})
      }} else {{
        svgFinal = `<defs>${{defsEfeitosSerie()}}</defs>` + svgAtual
      }}

      svgPalco.innerHTML = svgFinal
      legenda.atualizar(t)
      return timeline.chaveEstado(t)
    }}

    async function inicializar() {{
      const carregarImagem = src => new Promise(resolve => {{
        const img = new Image()
        img.onload = () => (img.decode ? img.decode().catch(() => {{}}).finally(resolve) : resolve())
        img.onerror = () => resolve()
        img.src = src
      }})

      await Promise.all([
        document.fonts.load('50px "CaveatBrush"'),
        document.fonts.load('80px "Mao"'),
        carregarImagem('/receitas/novela-da-caatinga/texturas/kraft.jpg'),
        carregarImagem('/receitas/novela-da-caatinga/texturas/grao.png'),
        carregarImagem('/receitas/novela-da-caatinga/logo.svg'),
      ])
      await document.fonts.ready

      const t0 = window.INICIO ?? 0
      window.DURACAO = window.INICIO != null ? 1 / (PLANO.fps || 30) : timeline.duracao
      window.seek = t => seek(t0 + t)
      window.seek(0)
      window.pronto = true
    }}

    inicializar()
  </script>
</body>
</html>
"""
    caminho_html.write_text(html, encoding="utf-8")
    return caminho_html


def _instantes_teste_padrao(duracao: float, qtd: int = 8) -> str:
    """Escolhe `qtd` instantes bem distribuídos ao longo de `duracao` para folha de contato."""
    if duracao <= 1.0:
        return "0.1,0.5"
    pontos = [
        round(0.35 + (duracao - 0.85) * (i / max(1, qtd - 1)), 2)
        for i in range(qtd)
    ]
    return ",".join(str(p) for p in pontos)


def montar_roteiro(
    caminho_roteiro: str | Path,
    caminho_saida_mp4: str | Path | None = None,
    apenas_preparar: bool = False,
    sem_som: bool = False,
    teste: str | bool | None = None,
    verificar: bool = False,
) -> dict[str, Any]:
    """Pipeline completo do montador:
    1. Compila o roteiro JSON -> `plano_compilado.json` e `<nome>-plano.json`
    2. Gera o HTML autocontido -> `saida/kit/_<nome>.html`
    3. Sintetiza e mixa o áudio 48 kHz -> `saida/kit/<nome>-som.wav`
    4. Se não for `apenas_preparar`, chama `node motores/render/render.mjs` para MP4 e/ou folha de contato.
    """
    arq_roteiro = Path(caminho_roteiro).resolve()
    if not arq_roteiro.is_file():
        raise FileNotFoundError(f"Roteiro não encontrado: {arq_roteiro}")

    roteiro_bruto = json.loads(arq_roteiro.read_text(encoding="utf-8"))
    plano = compilar_roteiro(roteiro_bruto)

    nome_base = arq_roteiro.stem
    if caminho_saida_mp4:
        arq_mp4 = Path(caminho_saida_mp4)
        pasta_saida = arq_mp4.parent
        nome_base = arq_mp4.stem
    else:
        pasta_saida = RAIZ_REPO / "saida" / "kit"
        arq_mp4 = pasta_saida / f"{nome_base}.mp4"

    pasta_saida.mkdir(parents=True, exist_ok=True)

    arq_plano = pasta_saida / f"{nome_base}-plano.json"
    arq_plano_padrao = pasta_saida / "plano_compilado.json"
    arq_html = pasta_saida / f"_{nome_base}.html"
    arq_wav = pasta_saida / f"{nome_base}-som.wav"
    arq_contato = pasta_saida / f"{nome_base}-contato.png"

    texto_plano = json.dumps(plano, ensure_ascii=False, indent=2)
    arq_plano.write_text(texto_plano, encoding="utf-8")
    arq_plano_padrao.write_text(texto_plano, encoding="utf-8")

    gerar_html_cena(plano, arq_html)

    auditoria_som = None
    if not sem_som:
        from motores.animacao.som.mixador import auditar_wav, mixar_timeline

        # Importa o pacote de sons da série para garantir o registro dos presets e frases de trompete
        try:
            import receitas_sons_loader  # noqa: F401
        except ImportError:
            pass
        mixar_timeline(plano, arq_wav, diretorio_base=arq_roteiro.parent)
        auditoria_som = auditar_wav(arq_wav)

    resultado: dict[str, Any] = {
        "roteiro": str(arq_roteiro),
        "plano": str(arq_plano),
        "plano_compilado": str(arq_plano_padrao),
        "html": str(arq_html),
        "som_wav": str(arq_wav) if not sem_som else None,
        "auditoria_som": auditoria_som,
        "duracao": plano["duracao"],
        "mp4": None,
        "contato_png": None,
    }

    if apenas_preparar:
        return resultado

    render_mjs = RAIZ_REPO / "motores" / "render" / "render.mjs"

    # Se `--teste` foi pedido, gera a folha de contato com `--zonas`
    if teste:
        instantes = (
            teste
            if isinstance(teste, str) and teste not in ("true", "1", "sim")
            else _instantes_teste_padrao(float(plano["duracao"]), 8)
        )
        cmd_teste = [
            "node",
            str(render_mjs),
            str(arq_html),
            "--raiz",
            str(RAIZ_REPO),
            "--teste",
            str(instantes),
            "--zonas",
            "--saida",
            str(arq_contato),
        ]
        subprocess.run(cmd_teste, cwd=str(RAIZ_REPO), check=True)
        resultado["contato_png"] = str(arq_contato)

    # Renderiza o vídeo MP4 completo se caminho_saida_mp4 foi informado ou se teste não for exclusivo
    cmd_mp4 = [
        "node",
        str(render_mjs),
        str(arq_html),
        "--raiz",
        str(RAIZ_REPO),
        "--fps",
        str(plano.get("fps", 30)),
        "--saida",
        str(arq_mp4),
    ]
    if not sem_som and arq_wav.is_file():
        cmd_mp4.extend(["--audio", str(arq_wav)])
    if verificar:
        cmd_mp4.append("--verificar")

    subprocess.run(cmd_mp4, cwd=str(RAIZ_REPO), check=True)
    resultado["mp4"] = str(arq_mp4)
    return resultado


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Compilador e montador do Kit de Animação (roteiro JSON -> HTML + WAV + MP4)."
    )
    parser.add_argument(
        "roteiro",
        help="Caminho do roteiro-de-cena JSON (ex.: receitas/novela-da-caatinga/kit/vitrine.json)",
    )
    parser.add_argument(
        "--saida",
        default=None,
        help="Caminho do vídeo .mp4 de saída (padrão: saida/kit/<nome>.mp4)",
    )
    parser.add_argument(
        "--apenas-preparar",
        action="store_true",
        help="Apenas compila o plano JSON, a página HTML e o áudio WAV sem invocar o Chrome/render.mjs",
    )
    parser.add_argument(
        "--sem-som",
        action="store_true",
        help="Não sintetiza o arquivo de áudio WAV",
    )
    parser.add_argument(
        "--teste",
        nargs="?",
        const="auto",
        default=None,
        help="Gera folha de contato com --zonas (opcionalmente informe instantes t1,t2,...)",
    )
    parser.add_argument(
        "--verificar",
        action="store_true",
        help="Passa --verificar ao render.mjs para validar 0 quadros divergentes na deduplicação",
    )

    args = parser.parse_args(argv)
    teste_arg: str | bool | None = None
    if args.teste == "auto":
        teste_arg = True
    elif args.teste:
        teste_arg = args.teste

    res = montar_roteiro(
        caminho_roteiro=args.roteiro,
        caminho_saida_mp4=args.saida,
        apenas_preparar=args.apenas_preparar,
        sem_som=args.sem_som,
        teste=teste_arg,
        verificar=args.verificar,
    )
    print(json.dumps(res, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
