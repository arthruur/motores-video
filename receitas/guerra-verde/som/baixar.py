"""Baixa os sons da peça Guerra Verde do Wikimedia Commons e grava os créditos.

    python receitas/guerra-verde/som/baixar.py

Todos são CC0 ou domínio público, menos o motor de barco e a música (CC BY: o crédito vai na descrição do post,
ver creditos.json). Papel, lápis, carimbo, vento e baque vêm de receitas/promo/som/bruto (CC0). O "bip" do satélite
é sintetizado no mixar.py.
"""
import json
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

AQUI = Path(__file__).parent
UA = {"User-Agent": "motores-video (receitas/guerra-verde)"}
# nome local → arquivo no Commons
SONS = {
    "floresta": "404114 felix-blume toucans-singing-in-the-amazonian-rainforest-brazil.ogg",
    "motosserra": "Chainsaw 4.ogg",
    "estalo": "Bones breaking wood fire ice crackling.ogg",
    "carro": "Starting a car and driving.ogg",
    "barco": "WWS Seffleboatengine.ogg",
    "helicoptero": "Helicopter over a lake.ogg",
    "musica": "Scott Buckley – The Long Dark (Ambient Neoclassical Piano).ogg",
}


def pegar(url: str, timeout: int = 60) -> bytes:
    # o Commons devolve 429 quando vem pedido demais seguido: espera e tenta de novo
    for k in range(6):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=timeout) as r:
                return r.read()
        except urllib.error.HTTPError as e:
            if e.code != 429 or k == 5:
                raise
            time.sleep(10 * (k + 1))


def info(titulo: str) -> dict:
    url = ("https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo"
           "&iiprop=url|extmetadata&iiextmetadatafilter=LicenseShortName|LicenseUrl|Artist&titles="
           + urllib.parse.quote("File:" + titulo))
    pag = next(iter(json.loads(pegar(url))["query"]["pages"].values()))
    return pag["imageinfo"][0]


if __name__ == "__main__":
    (AQUI / "bruto").mkdir(exist_ok=True)
    creditos = {}
    for nome, titulo in SONS.items():
        ii = info(titulo)
        m = ii.get("extmetadata", {})
        arq = AQUI / "bruto" / f"{nome}{Path(urllib.parse.urlparse(ii['url']).path).suffix}"
        if not arq.exists():
            arq.write_bytes(pegar(ii["url"], 300))
            time.sleep(3)
        creditos[nome] = {
            "arquivo": titulo,
            "autor": m.get("Artist", {}).get("value", ""),
            "licenca": m.get("LicenseShortName", {}).get("value", ""),
            "licenca_url": m.get("LicenseUrl", {}).get("value", ""),
            "pagina": ii["descriptionurl"],
        }
        print(nome, creditos[nome]["licenca"], arq.stat().st_size)
    (AQUI / "creditos.json").write_text(json.dumps(creditos, ensure_ascii=False, indent=1), encoding="utf-8")
