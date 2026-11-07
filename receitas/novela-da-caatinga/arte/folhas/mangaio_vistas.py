"""Vistas do Mangaio (3/4, perfil) vetorizadas a partir das gerações do Qwen. RASCUNHO (v1).

SUBSTITUÍDO em 2026-11-07: a revisão de arte reprovou a v1 rastreada (perfil com frutas
trocadas e rosto cortado; 3/4 com manchas do inpaint). As vistas do banco agora são
montadas à mão com as peças oficiais em cesto_folha.py (tres_quartos, perfil, costas).
Este script fica para quando houver geração melhor; ele escreve em
referencias/cesto/teste-qwen/rastreio-<vista>.svg e NÃO toca no banco.

Pipeline (rodar da raiz do repositório ou de qualquer lugar):
  python receitas/novela-da-caatinga/arte/folhas/mangaio_vistas.py
1. PNG da geração -> tira o rosto (inpaint), fundo vira branco, cada pixel vai
   para a cor mais próxima da paleta (palha_cesto, folha, tomate, laranja) e um
   filtro de maioria tira o serrilhado.
2. VectorCraft rastreia (imageTrace, abutting, ignorando o branco).
3. Pós: cor de cada forma travada na paleta, manchinhas fora, formas agrupadas
   em corpo / alca / frutas / braco-esq / braco-dir pela região, e o rosto
   (olho-esq, olho-dir, boca) REDESENHADO com as formas oficiais do mascote.svg
   por cima do corpo limpo. Embaixo de cada braço vai um remendo de palha
   (recortado pela silhueta do corpo) para o braço poder girar sem abrir buraco.
Saída: arte/referencias/cesto/teste-qwen/rastreio-<vista>.svg, 534x627 como o mascote (pé no chão
em y=627, centro x=267), escala igual à da frente.
Lado: esq/dir = lado de quem olha (a mesma convenção do mascote.svg).
"""
import json
import re
import subprocess
import tempfile
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

AQUI = Path(__file__).resolve().parent
SERIE = AQUI.parent.parent
REF = SERIE / "arte" / "referencias"
BANCO = SERIE / "arte" / "referencias" / "cesto" / "teste-qwen"   # rascunho; o banco é do cesto_folha.py
VC = r"C:/Users/Arthur/AppData/Local/Programs/ArtCraft/VectorCraft/vectorcraft-cli.exe"

PAL = json.loads((SERIE / "arte" / "paleta.json").read_text(encoding="utf-8"))["materiais"]
RAMPAS = {k: PAL[k] for k in ("palha_cesto", "folha", "tomate", "laranja")}
TONS = ["luz", "base", "meio", "sombra", "profunda"]
CORES = [(m, t, RAMPAS[m][t]) for m in RAMPAS for t in TONS]
# cores do braço oficial (o mascote usa estas, um pouco fora da rampa)
BRACO_BASE, BRACO_BORDA = "#E49340", "#B0581E"
ESCURO, BOCA_IN = "#462416", "#C5441E"


def rgb(h):
    h = h.lstrip("#")
    return np.array([int(h[i:i + 2], 16) for i in (0, 2, 4)], float)


def lab(arr):
    a = np.clip(arr, 0, 255).astype(np.uint8).reshape(-1, 1, 3)
    return cv2.cvtColor(a, cv2.COLOR_RGB2LAB).reshape(-1, 3).astype(float)


PAL_RGB = np.array([rgb(c) for _, _, c in CORES])
PAL_LAB = lab(PAL_RGB)


def mais_proxima(cor_rgb, so=None):
    """índice da cor da paleta mais próxima (em Lab); `so` restringe as rampas."""
    d = ((lab(np.array([cor_rgb])) - PAL_LAB) ** 2).sum(1)
    if so:
        d = np.where([m in so for m, _, _ in CORES], d, 1e12)
    return int(d.argmin())


# ------------------------------------------------------------ vistas
# Coordenadas no PNG 1024 da geração. Caixas: (x, y, w, h).
VISTAS = {
    "tres-quartos": dict(
        png=REF / "cesto/teste-qwen/qwen2511-tres-quartos.png",
        olhos=[(484, 723, 56, 88), (697, 689, 42, 81)],
        boca=(570, 743, 104, 77),
        tirar=[(560, 735, 124, 120)],              # boca + interior vermelho
        alca_max_y=[(0, 520), (330, 470), (680, 470), (1024, 520)],  # palha acima disto = alça
        bracos={"braco-esq": [(212, 688), (335, 688), (398, 790), (392, 912), (248, 912), (210, 790)],
                "braco-dir": [(770, 662), (862, 662), (862, 866), (770, 866)]},
        frutas_y=600,
        pivos={"braco-esq": (300, 700), "braco-dir": (800, 676)},
    ),
    "perfil": dict(
        png=REF / "cesto/teste-qwen/qwen2511-perfil.png",
        olhos=[(783, 693, 26, 84)],
        boca=(821, 698, 25, 78),
        tirar=[(815, 690, 40, 100), (836, 645, 14, 66)],
        alca_max_y=[(0, 480), (1024, 480)],
        bracos={"braco-esq": [(150, 660), (262, 660), (262, 840), (150, 840)],
                "braco-dir": [(552, 712), (690, 700), (748, 800), (742, 912), (600, 912), (552, 820)]},
        frutas_y=580,
        pivos={"braco-esq": (240, 672), "braco-dir": (590, 722)},
        # o braço de perto se fundiu ao corpo no rastreio: redesenhado com a peça oficial
        braco_feijao={"braco-dir": (566, 712, 180, 196)},
    ),
}


def preparar(v, saida):
    img = np.array(Image.open(v["png"]).convert("RGB"))
    fundo = img[5, 5].astype(int)
    # 1. tira o rosto (vai ser redesenhado)
    m = np.zeros(img.shape[:2], np.uint8)
    for (x, y, w, h) in v["olhos"] + [v["boca"]] + v["tirar"]:
        m[y - 4:y + h + 4, x - 4:x + w + 4] = 255
    escuro = (np.abs(img.astype(int) - rgb(ESCURO)).sum(2) < 120) | (np.abs(img.astype(int) - rgb(BOCA_IN)).sum(2) < 80)
    m = ((m > 0) & escuro).astype(np.uint8) * 255
    m = cv2.dilate(m, np.ones((7, 7), np.uint8))
    img = cv2.inpaint(img, m, 9, cv2.INPAINT_TELEA)
    img = cv2.medianBlur(img, 7)
    # 2. fundo
    bg = np.abs(img.astype(int) - fundo).sum(2) < 48
    # 3. cor mais próxima da paleta (Lab) + filtro de maioria
    L = lab(img.reshape(-1, 3).astype(float))
    idx = np.empty(len(L), int)
    for i in range(0, len(L), 200000):
        idx[i:i + 200000] = ((L[i:i + 200000, None, :] - PAL_LAB[None]) ** 2).sum(2).argmin(1)
    idx = idx.reshape(img.shape[:2])
    idx[bg] = len(CORES)
    votos = np.stack([cv2.blur((idx == k).astype(np.float32), (11, 11)) for k in range(len(CORES) + 1)])
    idx = votos.argmax(0)
    out = np.full(img.shape, 255, np.uint8)
    for k, (_, _, c) in enumerate(CORES):
        out[idx == k] = rgb(c).astype(np.uint8)
    Image.fromarray(out).save(saida)
    return (idx != len(CORES))


def rastrear(png, svg):
    cmds = [{"command": "select.all"},
            {"command": "imageTrace.makeAndExpand", "params": {"params": {
                "mode": "color", "palette": "limited", "colors": 20, "paths": 60, "corners": 55,
                "noise": 24, "method": "abutting", "ignoreWhite": True}}},
            {"command": "file.saveAs", "params": {"path": str(svg)}}]
    f = Path(tempfile.mkstemp(suffix=".json")[1])
    f.write_text(json.dumps(cmds))
    r = subprocess.run([VC, "run", "--in", str(png), "--commands", str(f)], capture_output=True, text=True)
    if not Path(svg).exists():
        raise RuntimeError(r.stdout[-2000:] + r.stderr[-2000:])


NUM = re.compile(r"-?\d*\.?\d+(?:e-?\d+)?")


def pontos(d):
    n = [float(x) for x in NUM.findall(d)]
    return np.array(n[: len(n) // 2 * 2]).reshape(-1, 2)


def area_poligono(p):
    if len(p) < 3:
        return 0
    x, y = p[:, 0], p[:, 1]
    return 0.5 * abs(np.dot(x, np.roll(y, 1)) - np.dot(y, np.roll(x, 1)))


def limite_y(tabela, x):
    xs, ys = zip(*tabela)
    return float(np.interp(x, xs, ys))


def dentro(poly, x, y):
    return cv2.pointPolygonTest(np.array(poly, np.float32), (float(x), float(y)), False) >= 0


# rosto oficial (mascote.svg), para redesenhar por cima
OLHO_D = ("M197.339 516.197C174.655 531.275 161.726 499.604 164.843 479.932C182.866 427.571 226.891 490.626 197.339 516.197Z",
          (163.0, 451.0, 37.0, 71.0))
BOCA_D = [("M302.789 529.376C294.08 505.292 260.97 510.251 251.925 532.992C234.286 522.652 228.004 500.63 233.835 494.895C257.085 489.485 283.807 494.05 307.364 484.536C329.866 477.352 324.59 510.03 302.779 529.376H302.789Z", ESCURO),
          ("M302.789 529.376C288.574 540.848 266.878 541.749 251.925 532.983C253.814 505.138 306.558 506.241 302.789 529.376Z", BOCA_IN)]
BOCA_CX = (231.0, 479.0, 93.0, 63.0)


def encaixa(caixa_de, caixa_para):
    x0, y0, w0, h0 = caixa_de
    x1, y1, w1, h1 = caixa_para
    return f"translate({x1:.1f} {y1:.1f}) scale({w1 / w0:.4f} {h1 / h0:.4f}) translate({-x0} {-y0})"


def contornos(mask):
    cs, hier = cv2.findContours(mask, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_SIMPLE)
    ds = []
    for c in cs:
        if cv2.contourArea(c) < 200:
            continue
        c = cv2.approxPolyDP(c, 1.5, True).reshape(-1, 2)
        ds.append("M" + "L".join(f"{x} {y}" for x, y in c) + "Z")
    return [" ".join(ds)] if ds else []


# patinha de perfil (caixa 100x100): ombro em cima à esquerda, luva embaixo à direita;
# a borda em sombra corre por baixo, onde a patinha encosta no corpo (como no braço oficial)
FEIJAO = ("M20 6C36 0 50 10 56 28C61 43 76 46 89 57C102 71 97 96 76 99C58 102 41 92 34 78"
          "C28 65 20 57 12 45C3 31 5 13 20 6Z",
          "M12 45C20 57 28 65 34 78C41 92 58 102 76 99C88 97 96 90 97 80C93 89 84 93 74 92"
          "C59 92 47 84 41 73C35 61 27 53 19 44C15 39 11 38 12 45Z")


def braco_oficial(peca, caixa, giro):
    """A patinha oficial do mascote.svg encaixada numa caixa, com um leve giro."""
    import xml.etree.ElementTree as ET
    raiz = ET.parse(SERIE / "mascote.svg").getroot()
    g = next(e for e in raiz.iter() if e.get("id") == peca)
    ds = [(e.get("d"), e.get("fill")) for e in g.iter() if e.tag.endswith("path")]
    pts = np.concatenate([pontos(d) for d, _ in ds])
    x0, y0 = pts.min(0); x1, y1 = pts.max(0)
    cx, cy = caixa[0] + caixa[2] / 2, caixa[1] + caixa[3] / 2
    tf = (f"translate({cx:.1f} {cy:.1f}) rotate({giro}) "
          f"scale({caixa[2] / (x1 - x0):.4f} {caixa[3] / (y1 - y0):.4f}) translate({-(x0 + x1) / 2:.1f} {-(y0 + y1) / 2:.1f})")
    return f'<g transform="{tf}">' + "".join(f'<path d="{d}" fill="{f}"/>' for d, f in ds) + "</g>"


def montar(nome, v):
    tmp = Path(tempfile.mkdtemp())
    png, svg = tmp / f"{nome}.png", tmp / f"{nome}.svg"
    silh = preparar(v, png)
    rastrear(png, svg)
    texto = svg.read_text(encoding="utf-8")
    formas = re.findall(r'<path\b([^>]*?)/?>', texto)
    grupos = {k: [] for k in ("corpo", "alca", "frutas", "braco-esq", "braco-dir")}
    descartadas = 0
    corpo_pts = []
    for attrs in formas:
        d = re.search(r'\bd="([^"]+)"', attrs)
        f = re.search(r'fill="(#[0-9a-fA-F]{6})"', attrs)
        if not d or not f:
            continue
        d = d.group(1)
        p = pontos(d)
        if len(p) < 3:
            continue
        c = rgb(f.group(1))
        if c.min() > 240:          # branco = fundo
            descartadas += 1
            continue
        k = mais_proxima(c)
        mat, tom, cor = CORES[k]
        x0, y0 = p.min(0)
        x1, y1 = p.max(0)
        a = area_poligono(p)
        cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
        no_braco = next((b for b, poly in v["bracos"].items() if dentro(poly, cx, cy)), None)
        if a < 90 or (x1 - x0) < 6 or (y1 - y0) < 6:
            if no_braco and mat == "palha_cesto":
                grupos[no_braco].append(f'<path d="{d}" fill="{cor}"/>')
            else:
                descartadas += 1
            continue
        extra = ' fill-rule="evenodd"' if 'evenodd' in attrs else ''
        el = f'<path d="{d}" fill="{cor}"{extra}/>'
        if mat != "palha_cesto":
            alvo = "frutas" if cy < v["frutas_y"] else "corpo"
        elif y1 < limite_y(v["alca_max_y"], cx) + 40 and cy < limite_y(v["alca_max_y"], cx):
            alvo = "alca"
        else:
            alvo = "corpo"
            for b, poly in v["bracos"].items():
                if dentro(poly, cx, cy) and all(dentro(poly, x, y) for x, y in ((x0 + 4, y0 + 4), (x1 - 4, y1 - 4))):
                    alvo = b
            if alvo == "corpo" and cy > v["frutas_y"] - 80:
                corpo_pts.append(p)
        grupos[alvo].append(el)
    # silhueta do corpo (casca convexa) para recortar o remendo de baixo dos braços
    casca = cv2.convexHull(np.concatenate(corpo_pts).astype(np.float32)).reshape(-1, 2)
    casca_d = "M" + "L".join(f"{x:.1f} {y:.1f}" for x, y in casca) + "Z"
    remendos = []
    for b in ("braco-esq", "braco-dir"):
        if grupos[b]:
            for el in grupos[b]:
                remendos.append(re.sub(r'fill="#[0-9A-Fa-f]{6}"', f'fill="{RAMPAS["palha_cesto"]["meio"]}"', el))
    # escala e posição: igual à frente (altura do personagem na geração = altura da frente)
    ys, xs = np.where(silh)
    bx0, bx1, by0, by1 = xs.min(), xs.max(), ys.min(), ys.max()
    s = 627.0 / 905.0 * 0.98               # 905 px = altura da frente na geração de 3/4 (mesma câmera)
    tf = f"translate({267 - (bx0 + bx1) / 2 * s:.2f} {627 - by1 * s:.2f}) scale({s:.5f})"

    rosto = ['<g id="rosto">']
    lados = ["olho-esq", "olho-dir"] if len(v["olhos"]) == 2 else ["olho-dir"]
    for lado, caixa in zip(lados, sorted(v["olhos"])):
        rosto.append(f'<g id="{lado}"><path d="{OLHO_D[0]}" fill="{ESCURO}" transform="{encaixa(OLHO_D[1], caixa)}"/></g>')
    rosto.append(f'<g id="boca" transform="{encaixa(BOCA_CX, v["boca"])}">' +
                 "".join(f'<path d="{d}" fill="{c}"/>' for d, c in BOCA_D) + "</g>")
    rosto.append("</g>")

    for b, (x, y, w, h) in v.get("braco_feijao", {}).items():
        tfb = f"translate({x} {y}) scale({w / 100:.3f} {h / 100:.3f})"
        grupos[b].append(f'<g transform="{tfb}"><path d="{FEIJAO[0]}" fill="{BRACO_BASE}"/>'
                         f'<path d="{FEIJAO[1]}" fill="{BRACO_BORDA}"/></g>')

    def g(id_, els):
        piv = v.get("pivos", {}).get(id_)
        attr = f' data-pivo="{piv[0]} {piv[1]}"' if piv else ""
        return f'<g id="{id_}"{attr}>' + "".join(els) + "</g>"

    # fundo: silhueta inteira menos os braços, em palha meio, para os furos das manchinhas
    sem_bracos = silh.astype(np.uint8) * 255
    for poly in v["bracos"].values():
        cv2.fillPoly(sem_bracos, [np.array(poly, np.int32)], 0)
    sem_bracos = cv2.erode(sem_bracos, np.ones((5, 5), np.uint8))
    fundo = [f'<path d="{d}" fill="{RAMPAS["palha_cesto"]["meio"]}" fill-rule="evenodd"/>' for d in contornos(sem_bracos)]
    remendo = f'<g id="remendo-bracos" clip-path="url(#casca-{nome})">{"".join(remendos)}</g>'
    corpo = f'<g id="corpo"><g id="fundo">{"".join(fundo)}</g>{"".join(grupos["corpo"])}</g>'
    svg_out = (
        f'<svg xmlns="http://www.w3.org/2000/svg" width="534" height="627" viewBox="0 0 534 627" fill="none">\n'
        f'<!-- Mangaio · vista {nome} · vetorizada da geração Qwen ({v["png"].name}) por mangaio_vistas.py.\n'
        f'     Grupos: corpo, alca, frutas, braco-esq, braco-dir (pivô no ombro: data-pivo, coordenadas da geração), rosto/olho-esq/olho-dir/boca\n'
        f'     redesenhados com as formas do mascote.svg. remendo-bracos fica atrás de tudo: cobre o buraco\n'
        f'     quando um braço gira. esq/dir = lado de quem olha. -->\n'
        f'<defs><clipPath id="casca-{nome}"><path d="{casca_d}"/></clipPath></defs>\n'
        f'<g id="mangaio-{nome}" transform="{tf}">\n'
        f'{remendo}\n{corpo}\n{g("alca", grupos["alca"])}\n{g("frutas", grupos["frutas"])}\n'
        f'{"".join(rosto)}\n{g("braco-esq", grupos["braco-esq"])}\n{g("braco-dir", grupos["braco-dir"])}\n'
        f'</g>\n</svg>\n')
    BANCO.mkdir(parents=True, exist_ok=True)
    (BANCO / f"rastreio-{nome}.svg").write_text(svg_out, encoding="utf-8")
    print(nome, {k: len(x) for k, x in grupos.items()}, "descartadas", descartadas)


if __name__ == "__main__":
    import sys
    for nome in (sys.argv[1:] or VISTAS):
        montar(nome, VISTAS[nome])
