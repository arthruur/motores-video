"""Baixa os efeitos sonoros do unboxing (todos CC0, do Freesound via Openverse) e grava os créditos.

    python receitas/unboxing/som/baixar.py

Os sons de papel, lápis, fita e vento vêm de receitas/promo/som/bruto (também CC0); aqui ficam só os que faltavam.
"""
import json
import urllib.parse
import urllib.request
from pathlib import Path

AQUI = Path(__file__).parent
# nome local → (busca no Openverse, id do som no Freesound)
SONS = {
    "rasgo-1": ("paper tear", "804974"),
    "rasgo-2": ("paper tear", "652982"),
    "rasgo-3": ("paper rip", "234221"),
    "rasgo-4": ("paper rip", "710162"),
    "rasgo-5": ("paper tear", "140461"),
    "pop-1": ("pop", "319107"),
    "pop-2": ("cartoon pop", "221091"),
    "brilho-1": ("crystal twinkle", "639429"),
    "brilho-2": ("glimmer", "521873"),
    "rugido-1": ("jaguar roar", "571287"),
    "rugido-2": ("kitten growl", "460689"),
    "ronrom-1": ("purr", "262307"),
}


def buscar(q: str, fid: str) -> dict:
    url = f"https://api.openverse.org/v1/audio/?q={urllib.parse.quote(q)}&license=cc0&page_size=20"
    with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "motores-video"})) as r:
        for item in json.load(r)["results"]:
            if item["foreign_landing_url"].rstrip("/").endswith(f"/{fid}"):
                return item
    raise SystemExit(f"não achei o som {fid} buscando '{q}'")


if __name__ == "__main__":
    (AQUI / "bruto").mkdir(exist_ok=True)
    creditos = {}
    for nome, (q, fid) in SONS.items():
        it = buscar(q, fid)
        arq = AQUI / "bruto" / f"{nome}.mp3"
        # "url" é a prévia em mp3 (pública); o original em alt_files pede login no Freesound
        url = it["url"]
        with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "motores-video"})) as r:
            arq.write_bytes(r.read())
        creditos[nome] = {k: it.get(k) for k in ("title", "creator", "license", "license_version", "license_url", "foreign_landing_url", "source")}
        print(nome, it["title"], arq.stat().st_size)
    (AQUI / "creditos.json").write_text(json.dumps(creditos, ensure_ascii=False, indent=1), encoding="utf-8")
