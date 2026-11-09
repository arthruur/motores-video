"""Mapa do Brasil das 5 áreas alimentares de Josué de Castro, em SVG, a partir da malha oficial do IBGE.

    python receitas/novela-da-caatinga/episodios/mapa-da-fome/mapa.py
    -> mapa.js (window.MAPA = {caixa, areas: {id: [d, ...]}, nordeste: [cx, cy]})

Baixa a malha de mesorregiões (API de malhas do IBGE, qualidade mínima) e agrupa nas 5 áreas.
É um mapa SIMPLIFICADO: as áreas de 1946 não seguem as divisas de hoje. Agrupamento:
  amazonia  = AC, AM, RR, RO, PA, AP
  mata      = faixa açucareira do litoral do Nordeste, do Recôncavo ao RN (mesorregiões da Mata/Leste + Recife e Salvador)
  sertao    = o resto do Nordeste (inclui agreste, MA e PI)
  centro    = GO, TO (era Goiás), MT, MS, DF, MG
  sul       = SP, RJ, ES, PR, SC, RS
"""
from __future__ import annotations

import json
import math
import sys
import urllib.request
from pathlib import Path

AQUI = Path(__file__).resolve().parent
sys.stdout.reconfigure(encoding="utf-8")
URL_MALHA = ("https://servicodados.ibge.gov.br/api/v3/malhas/paises/BR?formato=application/vnd.geo+json"
             "&qualidade=minima&intrarregiao=mesorregiao")
URL_NOMES = "https://servicodados.ibge.gov.br/api/v1/localidades/mesorregioes"

MATA = {"2404", "2504", "2604", "2605", "2703", "2803", "2905"}
UF_AREA = {**{u: "amazonia" for u in ("AC", "AM", "RR", "RO", "PA", "AP")},
           **{u: "sertao" for u in ("MA", "PI", "CE", "RN", "PB", "PE", "AL", "SE", "BA")},
           **{u: "centro" for u in ("GO", "TO", "MT", "MS", "DF", "MG")},
           **{u: "sul" for u in ("SP", "RJ", "ES", "PR", "SC", "RS")}}
LARG = 700          # largura do mapa em px
LAT0 = -15.0        # correção do cosseno (equiretangular)


def baixar(url: str):
    import gzip
    with urllib.request.urlopen(url, timeout=60) as r:
        dado = r.read()
    if dado[:2] == b"\x1f\x8b":          # a API do IBGE responde em gzip
        dado = gzip.decompress(dado)
    return json.loads(dado.decode("utf-8"))


def main() -> None:
    malha, nomes = baixar(URL_MALHA), baixar(URL_NOMES)
    uf = {str(n["id"]): n["UF"]["sigla"] for n in nomes}
    k_lon = math.cos(math.radians(LAT0))
    aneis_todos = []
    for f in malha["features"]:
        g = f["geometry"]
        polys = [g["coordinates"]] if g["type"] == "Polygon" else g["coordinates"]
        aneis_todos.append((f["properties"]["codarea"], [p[0] for p in polys]))
    xs = [lon * k_lon for _, ps in aneis_todos for anel in ps for lon, _ in anel]
    ys = [-lat for _, ps in aneis_todos for anel in ps for _, lat in anel]
    x0, y0 = min(xs), min(ys)
    k = LARG / (max(xs) - x0)
    alt = (max(ys) - y0) * k
    proj = lambda lon, lat: ((lon * k_lon - x0) * k, (-lat - y0) * k)  # noqa: E731
    areas: dict[str, list[str]] = {a: [] for a in ("amazonia", "mata", "sertao", "centro", "sul")}
    for cod, ps in aneis_todos:
        area = "mata" if cod in MATA else UF_AREA[uf[cod]]
        for anel in ps:
            pts, ult = [], None
            for lon, lat in anel:
                p = proj(lon, lat)
                if ult is None or abs(p[0] - ult[0]) + abs(p[1] - ult[1]) > 0.8:   # tira pontos colados
                    pts.append(p); ult = p
            if len(pts) > 2:
                areas[area].append("M" + "L".join(f"{x:.1f} {y:.1f}" for x, y in pts) + "Z")
    ne = proj(-38.5, -8.5)
    out = {"caixa": [LARG, round(alt, 1)], "areas": areas, "nordeste": [round(ne[0], 1), round(ne[1], 1)],
           "fonte": "IBGE, API de malhas (mesorregiões, qualidade mínima); agrupamento simplificado das áreas de 1946"}
    (AQUI / "mapa.js").write_text("// gerado por mapa.py (não editar à mão)\nwindow.MAPA = " + json.dumps(out) + ";\n", encoding="utf-8")
    print("mapa.js", LARG, "x", round(alt), {a: len(v) for a, v in areas.items()})


if __name__ == "__main__":
    main()
