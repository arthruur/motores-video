"""Pipeline de Arte da Novela da Caatinga: Gemini API (Imagem + Visão) + VectorCraft CLI.

Comandos:
    python receitas/novela-da-caatinga/arte/pipeline.py paleta
    python receitas/novela-da-caatinga/arte/pipeline.py vetorizar <id> [--entrada caminho.png]
    python receitas/novela-da-caatinga/arte/pipeline.py vetorizar-todos
    python receitas/novela-da-caatinga/arte/pipeline.py lineup
    python receitas/novela-da-caatinga/arte/pipeline.py gerar <id> [--folha exploration|turnaround|expressions|poses]

Etapas de `vetorizar <id>`:
1. Pré-processamento cel-shaded: remove o fundo externo e furos internos da cor do papel,
   aplica filtragem bilateral + mean-shift preservando bordas vivas (elimina granulado de papel).
2. VectorCraft CLI (`vectorcraft-cli run`):
   - `imageTrace.makeAndExpand` (sem contorno, só preenchimento em formas cheias)
   - `addon.cleanup.fix` (remove pontos soltos, duplicatas, objetos vazios)
   - `addon.cleanup.simplify` (reduz nós preservando cantos e curvas)
   - `recolor.colors` (extrai a paleta medida real do vetor)
   - Exporta `.svg` para `arte/banco/<id>/<id>-frente.svg`, `.ai` para `arte/fonte/<id>.ai` e `.png`.
3. Segmentação e Auditoria via Gemini Vision (`gemini-3.8-flash` / `gemini-2.5-flash`):
   - Localiza caixas delimitadoras das peças do rig (`rosto`, `olho-esq`, `olho-dir`, `sobr-esq`,
     `sobr-dir`, `boca`, `braco-esq`, `braco-dir`, `perna-esq`, `perna-dir`, `sombra`, `acess-*`, `prop-*`)
   - Avalia o Portão de Aprovação (`ARTE.md`) e extrai a rampa de 5 tons medida.
4. Rigging SVG (`animacao.md` §2):
   - Agrupa os `<path>` nos grupos semânticos do rig e injeta `<circle id="pivo" r="2"/>` em cada grupo.
"""
from __future__ import annotations

import argparse
import base64
import json
import os
import re
import subprocess
import sys
import urllib.error
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path

import cv2
import numpy as np
from PIL import Image
from scipy.ndimage import label

sys.stdout.reconfigure(encoding="utf-8")

ARTE_DIR = Path(__file__).resolve().parent
RECEITA_DIR = ARTE_DIR.parent
RAIZ = RECEITA_DIR.parents[1]
VC_CLI = next((p for p in (Path(r"C:\Program Files\ArtCraft\VectorCraft\vectorcraft-cli.exe"),
                            Path.home() / "AppData/Local/Programs/ArtCraft/VectorCraft/vectorcraft-cli.exe")
               if p.exists()), Path("vectorcraft-cli"))

# Escalas oficiais em "cestos" (ARTE.md §3)
ESCALAS_CESTO: dict[str, dict] = {
    "cesto":         {"altura": 1.00, "largura": 1.15, "nome": "O Cesto",         "ref": "cesto-frente.png"},
    "dona-mandioca": {"altura": 1.35, "largura": 0.60, "nome": "Dona Mandioca",   "ref": "dona-mandioca-frente.png"},
    "umbu":          {"altura": 0.75, "largura": 0.75, "nome": "Umbu",            "ref": "umbu-frente.png"},
    "licuri":        {"altura": 0.55, "largura": 0.40, "nome": "Licuri",          "ref": "licuri.png", "recorte_box": (0.04, 0.02, 0.43, 0.33)},
    "mandacaru":     {"altura": 2.20, "largura": 0.90, "nome": "Mandacaru",       "ref": "mandacaru-frente.png"},
    "jatai":         {"altura": 0.28, "largura": 0.35, "nome": "Jataí/Mandaçaia", "ref": "mandassaia-frente.png", "voa": True},
    "seu-caju":      {"altura": 0.95, "largura": 0.70, "nome": "Seu Caju",        "ref": None},
    "realcador":     {"altura": 1.10, "largura": 0.80, "nome": "Realçador",       "ref": None},
    "seu-sacolao":   {"altura": 1.60, "largura": 1.20, "nome": "Seu Sacolão",     "ref": None},
    "maxixe":        {"altura": 0.55, "largura": 0.45, "nome": "Maxixe",          "ref": None},
    "quiabo":        {"altura": 1.15, "largura": 0.30, "nome": "Quiabo",          "ref": None},
}


def carregar_chave_gemini() -> str:
    """Procura GEMINI_API_KEY ou GOOGLE_API_KEY no ambiente e nos arquivos .env de C:\\LIA."""
    for k in ("GEMINI_API_KEY", "GOOGLE_API_KEY"):
        if os.environ.get(k):
            return os.environ[k]
    candidatos = [
        RAIZ / ".env",
        RAIZ.parent / "adk_tutorial" / ".env",
        RAIZ.parent / "social-agents" / ".env",
    ]
    for env_file in candidatos:
        if env_file.exists():
            for ln in env_file.read_text(encoding="utf-8", errors="ignore").splitlines():
                if "=" in ln and not ln.lstrip().startswith("#"):
                    k, _, v = ln.partition("=")
                    k, v = k.strip(), v.strip().strip("\"'")
                    if k in ("GEMINI_API_KEY", "GOOGLE_API_KEY") and v:
                        os.environ["GEMINI_API_KEY"] = v
                        return v
    return ""


def vc_run(commands: list[dict], exports: list[Path] | None = None, in_file: Path | None = None) -> list[dict]:
    """Executa uma lista de comandos no vectorcraft-cli e retorna os resultados JSON passo a passo."""
    (ARTE_DIR / "banco" / "_tmp").mkdir(parents=True, exist_ok=True)
    cmd_path = ARTE_DIR / "banco" / "_tmp" / "vc_batch.json"
    cmd_path.write_text(json.dumps(commands, ensure_ascii=False, indent=2), encoding="utf-8")
    args = [str(VC_CLI), "run"]
    if in_file:
        args += ["--in", str(in_file)]
    args += ["--commands", str(cmd_path)]
    for ex in exports or []:
        ex.parent.mkdir(parents=True, exist_ok=True)
        args += ["--export", str(ex)]
    res = subprocess.run(args, capture_output=True, text=True, encoding="utf-8")
    if res.returncode != 0:
        raise RuntimeError(f"Erro no vectorcraft-cli ({res.returncode}):\n{res.stderr}\n{res.stdout}")
    out = []
    for line in res.stdout.splitlines():
        line = line.strip()
        if line.startswith("{"):
            out.append(json.loads(line))
    return out


def remover_fundo_e_suavizar(
    img_path: Path,
    out_png: Path,
    recorte_celula: tuple[int, int, int, int] | None = None,
    recorte_box: tuple[float, float, float, float] | None = None,
) -> tuple[Path, str]:
    """Remove o fundo de papel creme (externo + furos internos da cor exata do fundo) e aplica
    filtragem bilateral + mean-shift para converter textura de papel em formas cheias cel-shaded."""
    im = Image.open(img_path).convert("RGBA")
    arr = np.array(im)
    if recorte_box:
        y0f, x0f, y1f, x1f = recorte_box
        h, w = arr.shape[:2]
        arr = arr[int(y0f * h) : int(y1f * h), int(x0f * w) : int(x1f * w)].copy()
    elif recorte_celula:
        r, c, rows, cols = recorte_celula
        h, w = arr.shape[:2]
        ch, cw = h // rows, w // cols
        arr = arr[r * ch : (r + 1) * ch, c * cw : (c + 1) * cw].copy()

    # Amostra a cor do fundo nos 4 cantos
    cantos = np.vstack([arr[:8, :8, :3].reshape(-1, 3), arr[:8, -8:, :3].reshape(-1, 3)])
    bg_rgb = np.median(cantos, axis=0).astype(np.uint8)
    bg_hex = "#{:02X}{:02X}{:02X}".format(*bg_rgb)

    # Distância máxima por canal até a cor de fundo
    diff = np.abs(arr[:, :, :3].astype(int) - bg_rgb.astype(int)).max(axis=2)
    candidato_bg = diff < 16
    labeled, num_features = label(candidato_bg)

    # Rótulos conectados à borda da imagem são fundo externo garantido
    borda_labels = set(np.unique(np.concatenate([
        labeled[0, :], labeled[-1, :], labeled[:, 0], labeled[:, -1]
    ]))) - {0}
    bg_mask = np.isin(labeled, list(borda_labels))

    # Também remove furos internos que têm exatamente a cor lisa do fundo (ex.: vão entre braço e corpo, entre pernas)
    # desde que tenham variância interna mínima (papel liso, não roupa texturizada) e diferença < 14 do bg_rgb
    diff_estrito = np.abs(arr[:, :, :3].astype(int) - bg_rgb.astype(int)).max(axis=2)
    labeled_estrito, n_est = label(diff_estrito < 14)
    h, w = arr.shape[:2]
    for lbl in range(1, n_est + 1):
        reg = (labeled_estrito == lbl)
        area = int(reg.sum())
        if 120 < area < (h * w * 0.08):
            std_cor = arr[:, :, :3][reg].astype(float).std(axis=0).mean()
            if std_cor < 7.5:
                bg_mask |= reg

    # Suavização preservadora de bordas (elimina granulado mantendo quinas nítidas)
    bgr = cv2.cvtColor(arr[:, :, :3], cv2.COLOR_RGB2BGR)
    for _ in range(3):
        bgr = cv2.bilateralFilter(bgr, d=9, sigmaColor=35, sigmaSpace=35)
    bgr = cv2.pyrMeanShiftFiltering(bgr, sp=11, sr=20)
    rgb_clean = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)

    # Pinta o fundo de branco puro (#FFFFFF) e alfa 0 para `ignoreWhite: True` descartar sem afetar tons creme do personagem
    rgb_clean[bg_mask] = [255, 255, 255]
    alpha = np.where(bg_mask, 0, 255).astype(np.uint8)

    # Recorta para a caixa delimitadora do personagem com margem limpa
    ys, xs = np.where(~bg_mask)
    if len(ys) > 100:
        pad = 24
        y0, y1 = max(0, int(ys.min()) - pad), min(h, int(ys.max()) + pad)
        x0, x1 = max(0, int(xs.min()) - pad), min(w, int(xs.max()) + pad)
        rgb_clean = rgb_clean[y0:y1, x0:x1]
        alpha = alpha[y0:y1, x0:x1]

    out_png.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(np.dstack([rgb_clean, alpha]), "RGBA").save(out_png)
    return out_png, bg_hex


def analisar_com_gemini(img_path: Path, char_id: str, cores_extraidas: list[dict]) -> dict:
    """Usa Gemini Vision API para localizar as peças do rig (0..1000) e validar o Portão de Aprovação."""
    key = carregar_chave_gemini()
    if not key:
        return {}
    ficha_path = ARTE_DIR / "personagens" / f"{char_id}.md"
    ficha_txt = ficha_path.read_text(encoding="utf-8") if ficha_path.exists() else ""

    img_b64 = base64.b64encode(img_path.read_bytes()).decode("ascii")
    prompt_txt = f"""Você é o diretor técnico de arte e rigging da série 'Novela da Caatinga'.
Analise esta imagem já recortada do personagem `{char_id}` e as cores extraídas do vetor: {json.dumps(cores_extraidas[:15], ensure_ascii=False)}.

Ficha resumida do personagem:
{ficha_txt[:1500]}

Devolva APENAS um JSON válido com a estrutura:
{{
  "portao_aprovacao": {{
    "estilo_cesto_1s": true,
    "sem_contorno_preto": true,
    "ingrediente_reconhecivel": true,
    "rosto_padrao_kawaii": true,
    "observacoes": "string curta"
  }},
  "rampa_medida": {{
    "luz": "#RRGGBB",
    "base": "#RRGGBB",
    "meio": "#RRGGBB",
    "sombra": "#RRGGBB",
    "profunda": "#RRGGBB"
  }},
  "pecas_rig": {{
    "rosto": [ymin, xmin, ymax, xmax],
    "olho-esq": [ymin, xmin, ymax, xmax],
    "olho-dir": [ymin, xmin, ymax, xmax],
    "boca": [ymin, xmin, ymax, xmax],
    "sobr-esq": [ymin, xmin, ymax, xmax] ou null,
    "sobr-dir": [ymin, xmin, ymax, xmax] ou null,
    "braco-esq": [ymin, xmin, ymax, xmax] ou null,
    "braco-dir": [ymin, xmin, ymax, xmax] ou null,
    "perna-esq": [ymin, xmin, ymax, xmax] ou null,
    "perna-dir": [ymin, xmin, ymax, xmax] ou null,
    "sombra": [ymin, xmin, ymax, xmax] ou null
  }}
}}
Use coordenadas normalizadas de 0 a 1000 [ymin, xmin, ymax, xmax] relativas à imagem enviada."""

    corpo = json.dumps({
        "contents": [{
            "parts": [
                {"inlineData": {"mimeType": "image/png", "data": img_b64}},
                {"text": prompt_txt},
            ]
        }],
        "generationConfig": {"responseMimeType": "application/json", "temperature": 0.1},
    }).encode("utf-8")

    for modelo in ("gemini-3.8-flash", "gemini-3.7-flash", "gemini-3.5-flash"):
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{modelo}:generateContent"
        req = urllib.request.Request(url, data=corpo, headers={"x-goog-api-key": key, "Content-Type": "application/json"})
        try:
            with urllib.request.urlopen(req, timeout=45) as r:
                resp = json.loads(r.read())
            txt = resp["candidates"][0]["content"]["parts"][0]["text"]
            return json.loads(txt)
        except Exception as e:
            print(f"  [aviso] Gemini Vision ({modelo}): {e}")
    return {}


def organizar_svg_rig(svg_path: Path, char_id: str, analise: dict) -> dict:
    """Organiza o SVG exportado pelo VectorCraft na hierarquia do rig (`animacao.md` §2)
    e marca `<circle id="pivo" r="2"/>` em cada grupo."""
    ET.register_namespace("", "http://www.w3.org/2000/svg")
    tree = ET.parse(svg_path)
    root = tree.getroot()
    ns = "{http://www.w3.org/2000/svg}"

    vb = root.attrib.get("viewBox", "0 0 2000 2000").split()
    vw, vh = float(vb[2]), float(vb[3])

    # Coleta todos os elementos <path> do SVG
    paths = root.findall(f".//{ns}path")
    pecas_box = analise.get("pecas_rig", {})

    def path_bbox(d_str: str) -> tuple[float, float, float, float] | None:
        nums = [float(x) for x in re.findall(r"[-+]?\d*\.?\d+", d_str)]
        if len(nums) < 4:
            return None
        # Coordenadas absolutas aproximadas (M x y ...): usamos todos os pares ou filtro dentro do viewBox
        xs = [nums[i] for i in range(0, len(nums) - 1, 2) if 0 <= nums[i] <= vw]
        ys = [nums[i + 1] for i in range(0, len(nums) - 1, 2) if 0 <= nums[i + 1] <= vh]
        if not xs or not ys:
            return None
        return min(xs), min(ys), max(xs), max(ys)

    # Calcula bbox global da arte
    all_boxes = []
    path_infos = []
    for p in paths:
        b = path_bbox(p.attrib.get("d", ""))
        fill = p.attrib.get("fill", "").lower()
        # Ignora retângulo de fundo branco se o trace tiver deixado algum na borda total
        if b and fill in ("#ffffff", "white") and (b[2] - b[0]) > vw * 0.92 and (b[3] - b[1]) > vh * 0.92:
            continue
        if b:
            all_boxes.append(b)
        path_infos.append((p, b, fill))

    if all_boxes:
        ax0 = min(b[0] for b in all_boxes)
        ay0 = min(b[1] for b in all_boxes)
        ax1 = max(b[2] for b in all_boxes)
        ay1 = max(b[3] for b in all_boxes)
    else:
        ax0, ay0, ax1, ay1 = 0.0, 0.0, vw, vh
    aw, ah = max(1.0, ax1 - ax0), max(1.0, ay1 - ay0)

    grupos: dict[str, list[ET.Element]] = {
        "sombra": [],
        "perna-esq": [],
        "perna-dir": [],
        "corpo": [],
        "rosto": [],
        "olho-esq": [],
        "olho-dir": [],
        "sobr-esq": [],
        "sobr-dir": [],
        "boca": [],
        "braco-esq": [],
        "braco-dir": [],
    }

    def dentro_caixa(cx: float, cy: float, nome_peca: str, margem: float = 0.04) -> bool:
        box = pecas_box.get(nome_peca)
        if not box or not isinstance(box, list) or len(box) != 4:
            return False
        ymin, xmin, ymax, xmax = [v / 1000.0 for v in box]
        rx = (cx - ax0) / aw
        ry = (cy - ay0) / ah
        return (xmin - margem) <= rx <= (xmax + margem) and (ymin - margem) <= ry <= (ymax + margem)

    for p, b, fill in path_infos:
        if not b:
            grupos["corpo"].append(p)
            continue
        cx, cy = (b[0] + b[2]) / 2.0, (b[1] + b[3]) / 2.0
        ry = (cy - ay0) / ah
        pw, ph = b[2] - b[0], b[3] - b[1]
        is_dark_ink = fill in ("#462416", "#4b2411", "#3d1e10", "#522915", "#294526") or (
            fill.startswith("#") and len(fill) == 7 and int(fill[1:3], 16) < 95 and int(fill[3:5], 16) < 60
        )
        is_mouth_red = fill in ("#c5441e", "#ad301a", "#df3c23", "#b52f20", "#c93324")

        # Sombra de contato no pé (últimos 8% da altura, achatada)
        if ry > 0.92 and pw > ph * 2.2:
            grupos["sombra"].append(p)
        elif (is_dark_ink or is_mouth_red) and pw < aw * 0.35 and ph < ah * 0.25:
            if dentro_caixa(cx, cy, "olho-esq"):
                grupos["olho-esq"].append(p)
            elif dentro_caixa(cx, cy, "olho-dir"):
                grupos["olho-dir"].append(p)
            elif dentro_caixa(cx, cy, "boca"):
                grupos["boca"].append(p)
            elif dentro_caixa(cx, cy, "sobr-esq"):
                grupos["sobr-esq"].append(p)
            elif dentro_caixa(cx, cy, "sobr-dir"):
                grupos["sobr-dir"].append(p)
            elif dentro_caixa(cx, cy, "rosto"):
                grupos["rosto"].append(p)
            else:
                grupos["corpo"].append(p)
        else:
            grupos["corpo"].append(p)

    # Reconstrói o SVG limpo com os grupos do rig (`animacao.md` §2)
    novo_svg = ET.Element(f"{ns}svg", {
        "viewBox": f"0 0 {int(vw)} {int(vh)}",
        "xmlns": "http://www.w3.org/2000/svg",
    })
    char_g = ET.SubElement(novo_svg, f"{ns}g", {
        "id": char_id,
        "data-pivot": f"{round((ax0 + ax1) / 2, 1)},{round(ay1, 1)}",
        "data-bounds": f"{round(ax0, 1)},{round(ay0, 1)},{round(ax1, 1)},{round(ay1, 1)}",
    })
    ET.SubElement(char_g, f"{ns}circle", {
        "id": "pivo", "cx": str(round((ax0 + ax1) / 2, 1)), "cy": str(round(ay1, 1)), "r": "2", "fill": "none"
    })

    ordem_camadas = ["sombra", "perna-esq", "perna-dir", "braco-esq", "corpo", "rosto", "braco-dir"]
    sub_rosto = ["olho-esq", "olho-dir", "sobr-esq", "sobr-dir", "boca"]

    for gid in ordem_camadas:
        if gid == "rosto":
            tem_rosto = any(grupos[k] for k in ["rosto"] + sub_rosto)
            if not tem_rosto:
                continue
            rg = ET.SubElement(char_g, f"{ns}g", {"id": "rosto"})
            for el in grupos["rosto"]:
                rg.append(ET.Element(f"{ns}path", {k: v for k, v in el.attrib.items() if k in ("d", "fill", "opacity")}))
            for sg in sub_rosto:
                if grupos[sg]:
                    sub_el = ET.SubElement(rg, f"{ns}g", {"id": sg})
                    for el in grupos[sg]:
                        sub_el.append(ET.Element(f"{ns}path", {k: v for k, v in el.attrib.items() if k in ("d", "fill", "opacity")}))
        else:
            if not grupos[gid]:
                continue
            g_el = ET.SubElement(char_g, f"{ns}g", {"id": gid})
            for el in grupos[gid]:
                g_el.append(ET.Element(f"{ns}path", {k: v for k, v in el.attrib.items() if k in ("d", "fill", "opacity")}))

    ET.indent(novo_svg, space="  ")
    svg_txt = ET.tostring(novo_svg, encoding="unicode")
    svg_path.write_text(svg_txt, encoding="utf-8")
    return {
        "bounds": [round(ax0, 1), round(ay0, 1), round(ax1, 1), round(ay1, 1)],
        "contagem_grupos": {k: len(v) for k, v in grupos.items() if v},
    }


def cmd_paleta() -> None:
    """Exporta `paleta.json` para uma biblioteca nativa do VectorCraft (`paleta-caatinga.vcswatches` e `.ase`)
    e gera a prancha visual `arte/folhas/paleta-oficial.png`."""
    paleta = json.loads((ARTE_DIR / "paleta.json").read_text(encoding="utf-8"))
    commands: list[dict] = [
        {"command": "file.new", "params": {"name": "Paleta Novela da Caatinga", "width": 1600, "height": 1100, "units": "Pixels", "colorMode": "rgb", "backgroundContents": "white"}},
        {"command": "swatch.newGroup", "params": {"name": "tinta", "colors": [paleta["tinta"]["escuro"], paleta["tinta"]["boca_interior"], paleta["tinta"]["brilho_olho"]]}},
    ]
    for nome_mat, dados in paleta["materiais"].items():
        cores = [v for k, v in dados.items() if isinstance(v, str) and v.startswith("#")]
        if cores:
            commands.append({"command": "swatch.newGroup", "params": {"name": nome_mat, "colors": cores}})

    vc_swatches_path = ARTE_DIR / "paleta-caatinga.vcswatches"
    ase_path = ARTE_DIR / "paleta-caatinga.ase"
    commands.append({"command": "swatch.library.save", "params": {"path": str(vc_swatches_path), "format": "vcswatches", "name": "Novela da Caatinga"}})
    commands.append({"command": "swatch.library.save", "params": {"path": str(ase_path), "format": "ase", "name": "Novela da Caatinga"}})

    res = vc_run(commands)
    print(f"Biblioteca VectorCraft salva em: {vc_swatches_path.relative_to(RAIZ)} e {ase_path.relative_to(RAIZ)}")
    for r in res[-2:]:
        print(" ", r.get("result"))


def vetorizar_personagem(char_id: str, entrada: Path | None = None) -> dict:
    """Executa o pipeline completo de vetorização + auditoria IA + rigging SVG para um personagem."""
    info_escala = ESCALAS_CESTO.get(char_id, {"altura": 1.0, "largura": 0.7, "nome": char_id, "ref": f"{char_id}-frente.png"})
    if entrada is None:
        ref_name = info_escala.get("ref")
        if not ref_name:
            raise FileNotFoundError(f"Nenhuma imagem de referência configurada para {char_id}")
        entrada = ARTE_DIR / "referencias" / ref_name
    if not entrada.exists():
        raise FileNotFoundError(f"Arquivo de referência não encontrado: {entrada}")

    print(f"\n=== Vetorizando [{char_id}] a partir de {entrada.name} ===")
    tmp_dir = ARTE_DIR / "banco" / "_tmp"
    clean_png, bg_hex = remover_fundo_e_suavizar(
        entrada,
        tmp_dir / f"{char_id}-pre.png",
        recorte_celula=info_escala.get("recorte_celula"),
        recorte_box=info_escala.get("recorte_box"),
    )

    banco_dir = ARTE_DIR / "banco" / char_id
    fonte_dir = ARTE_DIR / "fonte"
    banco_dir.mkdir(parents=True, exist_ok=True)
    fonte_dir.mkdir(parents=True, exist_ok=True)

    out_svg = banco_dir / f"{char_id}-frente.svg"
    out_png = banco_dir / f"{char_id}-frente.png"
    out_ai = fonte_dir / f"{char_id}-frente.ai"

    cmds = [
        {"command": "file.new", "params": {"name": f"{char_id}-frente", "width": 2000, "height": 2000, "units": "Pixels", "colorMode": "rgb", "backgroundContents": "transparent"}},
        {"command": "file.place", "params": {"path": str(clean_png), "link": False, "rect": [150, 150, 1700, 1700]}},
        {"command": "imageTrace.makeAndExpand", "params": {
            "params": {
                "mode": "color",
                "palette": "limited",
                "colors": 18,
                "paths": 42,
                "corners": 45,
                "noise": 28,
                "method": "abutting",
                "ignoreWhite": True,
                "autoGrouping": True,
                "fills": True,
                "strokes": False,
            }
        }},
        {"command": "addon.cleanup.fix", "params": {"scope": "document"}},
        {"command": "addon.cleanup.simplify", "params": {"tolerance": 18, "protectCorners": True}},
        {"command": "swatch.addUsedColors", "params": {"global": True}},
        {"command": "recolor.colors", "params": {}},
    ]

    res = vc_run(cmds, exports=[out_svg, out_png, out_ai])
    trace_info, simplify_info, cores_info = {}, {}, []
    for step in res:
        c = step.get("command")
        if c == "imageTrace.makeAndExpand":
            trace_info = step.get("result", {})
        elif c == "addon.cleanup.simplify":
            simplify_info = step.get("result", {})
        elif c == "recolor.colors":
            cores_info = step.get("result", {}).get("colors", [])

    print(f"  VectorCraft: {trace_info.get('paths')} paths ({trace_info.get('colors')} cores), "
          f"nós simplificados: {simplify_info.get('before')} -> {simplify_info.get('after')}")

    analise = analisar_com_gemini(clean_png, char_id, cores_info)
    if analise:
        portao = analise.get("portao_aprovacao", {})
        print(f"  Gemini Vision (Portão): {portao.get('observacoes', 'OK')}")

    rig_info = organizar_svg_rig(out_svg, char_id, analise)
    print(f"  Rig SVG organizado: {rig_info['contagem_grupos']} -> {out_svg.relative_to(RAIZ)}")

    relatorio = {
        "id": char_id,
        "referencia": entrada.name,
        "svg": str(out_svg.relative_to(RAIZ)).replace("\\", "/"),
        "ai": str(out_ai.relative_to(RAIZ)).replace("\\", "/"),
        "paths": trace_info.get("paths"),
        "anchors_antes": simplify_info.get("before"),
        "anchors_depois": simplify_info.get("after"),
        "cores_extraidas": cores_info[:12],
        "analise_ia": analise,
        "rig": rig_info,
    }
    (banco_dir / "relatorio.json").write_text(json.dumps(relatorio, ensure_ascii=False, indent=2), encoding="utf-8")
    return relatorio


def cmd_lineup() -> None:
    """Monta no VectorCraft a prancha oficial de Comparação de Escala (Main Model Size Comparison)
    e o Lineup de Silhuetas (`ARTE.md` §2 e §3) com o Cesto (1,0) e o elenco vetorizado."""
    folhas_dir = ARTE_DIR / "folhas"
    folhas_dir.mkdir(parents=True, exist_ok=True)

    # Garante que o Cesto oficial também está em arte/banco/cesto/cesto-frente.svg
    cesto_banco = ARTE_DIR / "banco" / "cesto" / "cesto-frente.svg"
    cesto_banco.parent.mkdir(parents=True, exist_ok=True)
    if not cesto_banco.exists():
        cesto_src = RECEITA_DIR / "mascote.svg"
        cesto_banco.write_bytes(cesto_src.read_bytes())

    ordem = ["mandacaru", "dona-mandioca", "cesto", "umbu", "licuri", "jatai"]
    disponiveis = [cid for cid in ordem if (ARTE_DIR / "banco" / cid / f"{cid}-frente.svg").exists()]

    W, H = 3200, 1400
    chao_y = 1160
    unidade_cesto_px = 340.0  # 1,0 cesto = 340 px de altura na prancha

    cmds: list[dict] = [
        {"command": "file.new", "params": {"name": "Main Model Size Comparison - Novela da Caatinga", "width": W, "height": H, "units": "Pixels", "colorMode": "rgb", "backgroundContents": "white"}},
        # Fundo papel quente da série
        {"command": "shape.rectangle", "params": {"x": 0, "y": 0, "width": W, "height": H}},
        {"command": "paint.setFill", "params": {"color": "#FBF0D9"}},
        {"command": "paint.setStroke", "params": {"none": True}},
    ]

    # Linhas horizontais de escala em "cestos" (0.0, 0.5, 1.0, 1.5, 2.0 cestos)
    for mult in (0.0, 0.5, 1.0, 1.5, 2.0, 2.2):
        y = round(chao_y - mult * unidade_cesto_px, 1)
        cmds += [
            {"command": "shape.line", "params": {"x1": 180, "y1": y, "x2": W - 100, "y2": y}},
            {"command": "paint.setStroke", "params": {"color": "#D27C32" if mult in (0.0, 1.0) else "#E2C9A0"}},
            {"command": "stroke.set", "params": {"weight": 3 if mult == 0.0 else (2 if mult == 1.0 else 1)}},
            {"command": "text.create", "params": {"x": 30, "y": y + 6, "size": 18, "color": "#462416", "text": f"{mult:.1f} cesto" if mult != 1.0 else "1.0 CESTO"}},
        ]

    # Posiciona cada personagem na escala exata em cestos
    x_cursor = 260.0
    espaco = 470.0
    for cid in disponiveis:
        esc = ESCALAS_CESTO[cid]
        svg_file = ARTE_DIR / "banco" / cid / f"{cid}-frente.svg"
        alt_px = esc["altura"] * unidade_cesto_px
        larg_px = max(alt_px * 0.85, esc["largura"] * unidade_cesto_px)
        # Jataí voa à altura dos olhos do Cesto
        base_y = (chao_y - 0.85 * unidade_cesto_px) if esc.get("voa") else chao_y
        top_y = base_y - alt_px
        rx = x_cursor
        cmds.append({
            "command": "file.place",
            "params": {"path": str(svg_file), "link": False, "crop": "bounding", "rect": [round(rx, 1), round(top_y, 1), round(larg_px, 1), round(alt_px, 1)]},
        })
        cmds.append({
            "command": "text.create",
            "params": {"x": round(rx + larg_px * 0.5, 1), "y": chao_y + 45, "size": 22, "justify": "center", "color": "#462416", "text": f"{esc['nome'].upper()} ({esc['altura']}x)"},
        })
        x_cursor += espaco

    lineup_svg = folhas_dir / "lineup-escala.svg"
    lineup_png = folhas_dir / "lineup-escala.png"
    vc_run(cmds, exports=[lineup_svg, lineup_png])
    print(f"Lineup de escala salvo em: {lineup_png.relative_to(RAIZ)}")

    # Gera também o Lineup de Silhuetas pretas (#462416) a partir dos SVGs/PNGs na mesma escala
    im_lineup = Image.open(lineup_png).convert("RGBA")
    # Criamos prancha dedicada de silhueta renderizando cada personagem em #462416 puro sobre fundo #FBF0D9
    canvas_sil = Image.new("RGBA", (W, H), (251, 240, 217, 255))
    x_cursor = 260
    for cid in disponiveis:
        esc = ESCALAS_CESTO[cid]
        png_char = ARTE_DIR / "banco" / cid / f"{cid}-frente.png"
        if not png_char.exists():
            vc_run([], exports=[png_char], in_file=ARTE_DIR / "banco" / cid / f"{cid}-frente.svg")
        im_c = Image.open(png_char).convert("RGBA")
        arr_c = np.array(im_c)
        ys, xs = np.where(arr_c[:, :, 3] > 20)
        if len(ys) == 0:
            continue
        crop = arr_c[ys.min():ys.max() + 1, xs.min():xs.max() + 1].copy()
        # Converte todos os pixels opacos para a tinta escura da série (#462416 = RGB 70, 36, 22)
        mask = crop[:, :, 3] > 20
        sil = np.zeros_like(crop)
        sil[mask] = [70, 36, 22, 255]
        ch_orig, cw_orig = sil.shape[:2]
        alt_px = int(esc["altura"] * unidade_cesto_px)
        larg_px = max(1, int(alt_px * (cw_orig / max(1, ch_orig))))
        sil_img = Image.fromarray(sil, "RGBA").resize((larg_px, alt_px), Image.Resampling.LANCZOS)
        base_y = int(chao_y - 0.85 * unidade_cesto_px) if esc.get("voa") else chao_y
        canvas_sil.alpha_composite(sil_img, (int(x_cursor), max(20, int(base_y - alt_px))))
        x_cursor += int(espaco)

    sil_png = folhas_dir / "lineup-silhuetas.png"
    canvas_sil.convert("RGB").save(sil_png)
    print(f"Lineup de silhuetas salvo em: {sil_png.relative_to(RAIZ)}")


def cmd_gerar(char_id: str, tipo_folha: str = "exploration") -> Path:
    """Gera folha de personagem via Gemini Image API (`gemini-3.1-flash-image` / `gemini-3-pro-image`)
    anexando `cesto-frente.png` como âncora visual obrigatória (`producao-de-arte.md` §2)."""
    key = carregar_chave_gemini()
    if not key:
        raise RuntimeError("GEMINI_API_KEY / GOOGLE_API_KEY não encontrada.")

    ficha_path = ARTE_DIR / "personagens" / f"{char_id}.md"
    if not ficha_path.exists():
        raise FileNotFoundError(f"Ficha não encontrada: {ficha_path}")
    ficha_txt = ficha_path.read_text(encoding="utf-8")
    m = re.search(r"## Prompt base\s+```\s*(.*?)\s*```", ficha_txt, re.S)
    bloco_char = m.group(1).strip() if m else f"Character {char_id} from Novela da Caatinga."

    bloco_estilo = (
        "STYLE: professional 2D animated series character design, flat vector illustration built ONLY "
        "from filled shapes, NO outlines and NO strokes, volume made with 4-5 stacked flat tones of the "
        "same color (cel-shaded vector), no gradients, warm shadows that shift toward red-brown (never grey "
        "or black), darkest color is a deep warm brown (#462416), soft organic hand-drawn curves, top-left "
        "warm sunlight. Match EXACTLY the style, rendering, face design and level of detail of the attached "
        "reference character (the woven basket). FACE: two solid dark-brown vertical oval eyes with no eye "
        "whites and no highlights, no nose, wide open dark-brown mouth with a red-orange inside. LIMBS: "
        "short, thick, rounded mitten-like paws in the body's own colors."
    )
    blocos_folha = {
        "exploration": "SHEET — EXPLORATION: 4 design variations of the same character side by side, full body, front view, plain light warm-paper background (#FBF0D9), same scale.",
        "turnaround": "SHEET — TURNAROUND: character model sheet, the SAME character in 5 views in a row: front, three-quarter, side profile, three-quarter back, back. Neutral pose, horizontal guide lines, plain light warm-paper background (#FBF0D9), no text.",
        "expressions": "SHEET — EXPRESSIONS: expression sheet, the SAME character's head and upper body in a 3x3 grid: neutral, smile, ironic, one eyebrow raised, wide eyes, enchanted, sad, angry, laughing. Plain light warm-paper background (#FBF0D9), no text.",
        "poses": "SHEET — POSES: 4 key acting poses of the same character, full body, plain light warm-paper background (#FBF0D9), no text.",
    }
    bloco_avoid = (
        "AVOID: black outlines, line art, gradients for shading, 3D render, realistic human features "
        "(nose, ears, hair), sexualized body shapes, text, logos, watermark."
    )
    prompt_completo = f"{bloco_estilo}\n\n{bloco_char}\n\n{blocos_folha[tipo_folha]}\n\n{bloco_avoid}"

    cesto_ref = ARTE_DIR / "referencias" / "cesto-frente.png"
    cesto_b64 = base64.b64encode(cesto_ref.read_bytes()).decode("ascii")

    corpo = json.dumps({
        "contents": [{
            "parts": [
                {"inlineData": {"mimeType": "image/png", "data": cesto_b64}},
                {"text": prompt_completo},
            ]
        }],
        "generationConfig": {"responseModalities": ["IMAGE", "TEXT"]},
    }).encode("utf-8")

    out_dir = ARTE_DIR / "referencias" / char_id
    out_dir.mkdir(parents=True, exist_ok=True)
    out_png = out_dir / f"{char_id}-{tipo_folha}.png"

    for modelo in ("gemini-3.1-flash-image", "gemini-3-pro-image", "gemini-2.5-flash-image"):
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{modelo}:generateContent"
        req = urllib.request.Request(url, data=corpo, headers={"x-goog-api-key": key, "Content-Type": "application/json"})
        try:
            with urllib.request.urlopen(req, timeout=120) as r:
                resp = json.loads(r.read())
            for part in resp["candidates"][0]["content"]["parts"]:
                if "inlineData" in part:
                    out_png.write_bytes(base64.b64decode(part["inlineData"]["data"]))
                    print(f"Gerado com {modelo} -> {out_png.relative_to(RAIZ)}")
                    return out_png
        except Exception as e:
            print(f"  [aviso] {modelo}: {e}")
    raise RuntimeError(f"Não foi possível gerar imagem para {char_id} ({tipo_folha}).")


def main() -> None:
    ap = argparse.ArgumentParser(description="Pipeline VectorCraft + IA da Novela da Caatinga")
    sub = ap.add_subparsers(dest="acao", required=True)

    sub.add_parser("paleta", help="Exporta paleta.json para bibliotecas VectorCraft (.vcswatches e .ase)")

    p_vet = sub.add_parser("vetorizar", help="Vetoriza, audita com Gemini Vision e monta o rig SVG de um personagem")
    p_vet.add_argument("id", help="ID do personagem (ex.: dona-mandioca, umbu, mandacaru, jatai, licuri)")
    p_vet.add_argument("--entrada", type=Path, default=None, help="PNG de entrada opcional")

    sub.add_parser("vetorizar-todos", help="Vetoriza todas as referências disponíveis em arte/referencias/")
    sub.add_parser("lineup", help="Gera a prancha de comparação de escala e o lineup de silhuetas via VectorCraft")

    p_ger = sub.add_parser("gerar", help="Gera folha de exploração/turnaround via Gemini Image API com o Cesto de âncora")
    p_ger.add_argument("id", help="ID do personagem (ex.: realcador, seu-caju, maxixe-e-quiabo)")
    p_ger.add_argument("--folha", choices=["exploration", "turnaround", "expressions", "poses"], default="exploration")

    args = ap.parse_args()
    if args.acao == "paleta":
        cmd_paleta()
    elif args.acao == "vetorizar":
        vetorizar_personagem(args.id, args.entrada)
    elif args.acao == "vetorizar-todos":
        cmd_paleta()
        for cid, info in ESCALAS_CESTO.items():
            if cid != "cesto" and info.get("ref") and (ARTE_DIR / "referencias" / info["ref"]).exists():
                vetorizar_personagem(cid)
        cmd_lineup()
    elif args.acao == "lineup":
        cmd_lineup()
    elif args.acao == "gerar":
        cmd_gerar(args.id, args.folha)


if __name__ == "__main__":
    main()
