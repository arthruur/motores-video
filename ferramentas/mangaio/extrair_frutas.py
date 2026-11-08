"""Tira as frutas soltas do arturo.ai (Illustrator, salvo com PDF compatível) e grava um SVG com um
<g id> por fruta, para o cesto do Mangaio (app/src/mangaio/frutas.svg).

O .ai só tem a "Camada 1", sem nomes: as peças são reconhecidas pela ordem de desenho do arquivo
(índices de get_drawings). Se o arte-final mudar, rode com --listar e ajuste PECAS.

    python ferramentas/mangaio/extrair_frutas.py ~/Downloads/arturo.ai
    python ferramentas/mangaio/extrair_frutas.py ~/Downloads/arturo.ai --listar
"""
from __future__ import annotations

import argparse
from pathlib import Path

import pymupdf

RAIZ = Path(__file__).resolve().parents[2]
SAIDA = RAIZ / "app" / "src" / "mangaio" / "frutas.svg"

# id -> índices dos desenhos (de trás para frente, na ordem do arquivo)
PECAS: dict[str, list[int]] = {
    "laranja": [2, 3, 4],
    "tomate-grande": [5, 6, 7, 8],
    "tomate-1": [9, 10, 11, 12, 13],
    "tomate-2": [14, 15, 16, 17, 18],
    "folhas-3": [146, 147, 148, 149, 150],
    "folha-1": [151, 152],
    "folha-2": [153, 154],
    "morango-1": list(range(155, 166)),
    "morango-2": list(range(166, 177)),
    "banana-1": list(range(177, 183)),
    "banana-2": list(range(183, 189)),
}


def cor(rgb) -> str:
    return "#%02X%02X%02X" % tuple(round(v * 255) for v in rgb)


def num(v: float) -> str:
    return f"{v:.2f}".rstrip("0").rstrip(".")


def caminho(desenho: dict, ox: float, oy: float) -> str:
    """itens do PyMuPDF -> atributo d do SVG, com a origem levada para (ox, oy)"""
    P = lambda p: f"{num(p.x - ox)} {num(p.y - oy)}"
    partes: list[str] = []
    fim = None
    for it in desenho["items"]:
        op = it[0]
        if op == "re":
            r = it[1]
            partes.append(f"M{P(r.tl)}H{num(r.x1 - ox)}V{num(r.y1 - oy)}H{num(r.x0 - ox)}Z")
            fim = None
            continue
        if op == "qu":
            q = it[1]
            partes.append(f"M{P(q.ul)}L{P(q.ur)}L{P(q.lr)}L{P(q.ll)}Z")
            fim = None
            continue
        ini = it[1]
        if fim is None or abs(ini.x - fim.x) > 0.01 or abs(ini.y - fim.y) > 0.01:
            if partes and desenho.get("closePath"):
                partes.append("Z")
            partes.append(f"M{P(ini)}")
        if op == "l":
            partes.append(f"L{P(it[2])}")
            fim = it[2]
        elif op == "c":
            partes.append(f"C{P(it[2])} {P(it[3])} {P(it[4])}")
            fim = it[4]
    if desenho.get("closePath"):
        partes.append("Z")
    return "".join(partes)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("ai", type=Path)
    ap.add_argument("--listar", action="store_true", help="só lista os desenhos (índice, cor, caixa)")
    ap.add_argument("--saida", type=Path, default=SAIDA)
    a = ap.parse_args()

    desenhos = pymupdf.open(a.ai)[0].get_drawings()
    if a.listar:
        for i, d in enumerate(desenhos):
            r = d["rect"]
            print(i, cor(d["fill"]) if d.get("fill") else "-", [round(v) for v in (r.x0, r.y0, r.x1, r.y1)])
        return

    # cada fruta vai para a origem da sua própria caixa: o SVG fica com as peças lado a lado,
    # numa fileira, e o código mede cada <g> (como o mascote.svg)
    grupos: list[str] = []
    x = 0.0
    alto = 0.0
    for nome, idx in PECAS.items():
        rects = [desenhos[i]["rect"] for i in idx]
        x0, y0 = min(r.x0 for r in rects), min(r.y0 for r in rects)
        x1, y1 = max(r.x1 for r in rects), max(r.y1 for r in rects)
        caminhos = "\n".join(
            f'<path d="{caminho(desenhos[i], x0 - x, y0)}" fill="{cor(desenhos[i]["fill"])}"'
            + (' fill-rule="evenodd"' if desenhos[i].get("even_odd") else "") + "/>"
            for i in idx
        )
        grupos.append(f'<g id="{nome}">\n{caminhos}\n</g>')
        x += (x1 - x0) + 20
        alto = max(alto, y1 - y0)

    svg = (f'<svg width="{num(x)}" height="{num(alto)}" viewBox="0 0 {num(x)} {num(alto)}" fill="none" '
           f'xmlns="http://www.w3.org/2000/svg">\n<!-- gerado por ferramentas/mangaio/extrair_frutas.py a partir de {a.ai.name} -->\n'
           + "\n".join(grupos) + "\n</svg>\n")
    a.saida.write_text(svg, encoding="utf-8")
    print(f"{len(PECAS)} frutas -> {a.saida} ({len(svg) // 1024} KB)")


if __name__ == "__main__":
    main()
