"""Catálogo de links da busca da Prensa: anime, edits de phonk, memes... de terceiros, sem re-hospedar nada.

O acervo (acervo.json) só guarda mídia com licença livre. Edit de anime e vídeo com phonk quase nunca têm, então
estes vídeos entram de outro jeito: o catálogo guarda só o link e os dados públicos (título, @, duração, tema). O
vídeo é baixado na hora, pelo baixador (servidor/baixador), quando alguém escolhe, e os direitos continuam de
quem publicou (o app mostra o @ como crédito). Mesma postura do "cole um link", só que com curadoria.

  python ferramentas/acervo/catalogar.py URL [URL...] --tema anime --tags phonk luta
  python ferramentas/acervo/catalogar.py --de links.txt --tema phonk     # um link por linha (# comenta)
  python ferramentas/acervo/catalogar.py --de ferramentas/acervo/listas/mangaio.txt --tema mangaio --receita mangaio

Com --receita, os links não vão para a busca do vídeo de baixo: são vídeos de cima, a fala, e entram na fila
daquela receita no app. Numa lista, "URL - texto" guarda o texto como gancho daquele vídeo.
  python ferramentas/acervo/catalogar.py --listar
  python ferramentas/acervo/catalogar.py --remover anime-03              # e não aceita o link de novo
  python ferramentas/acervo/huggingface.py --upload                      # publica: o app lê do dataset

Só TikTok e X: são as redes que o baixador no Render consegue baixar (YouTube e Instagram barram servidores de
nuvem). Cada link é lido pelo próprio baixador (GET /info), que é quem vai baixá-lo depois: se ele não consegue
ler, o link não entra. Sem o baixador no ar, usa o yt-dlp local (pip install yt-dlp); --local força isso.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import date
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[2]
CATALOGO = RAIZ / "app" / "public" / "acervo" / "catalogo.json"
REDES = re.compile(r"^https://(www\.|m\.|vm\.|vt\.)?(tiktok\.com|x\.com|twitter\.com)/", re.I)
BARRADAS = re.compile(r"(youtube\.com|youtu\.be|instagram\.com)", re.I)
DUR_MAX = 20 * 60  # o mesmo limite do baixador
ARROBA = {"TikTok", "Twitter"}
BAIXADOR = os.environ.get("PRENSA_BAIXADOR", "https://prensa-baixador.onrender.com").rstrip("/")


class Recusado(Exception):
    """o baixador leu o link e disse que não dá"""


def carregar() -> dict:
    return json.loads(CATALOGO.read_text("utf-8")) if CATALOGO.exists() else {"links": [], "removidos": []}


def gravar(cat: dict) -> None:
    CATALOGO.parent.mkdir(parents=True, exist_ok=True)
    CATALOGO.write_text(json.dumps(cat, ensure_ascii=False, indent=2) + "\n", "utf-8")


def slug(texto: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", texto.lower()).strip("-")[:20] or "link"


def info_servidor(url: str) -> dict | None:
    """os dados pelo baixador; None se ele não estiver no ar ou ainda não tiver o /info"""
    try:
        with urllib.request.urlopen(f"{BAIXADOR}/info?{urllib.parse.urlencode({'url': url})}", timeout=90) as r:
            d = json.load(r)
    except urllib.error.HTTPError as e:
        if e.code in (400, 422):
            raise Recusado(json.loads(e.read() or b"{}").get("detail", f"erro {e.code}")) from None
        return None
    except (urllib.error.URLError, TimeoutError):
        return None
    return {"webpage_url": d["url"], "title": d["titulo"], "uploader_id": d["autor"], "extractor_key": d["plataforma"],
            "duration": d["duracao"]}


def info_local(url: str) -> dict:
    import yt_dlp

    with yt_dlp.YoutubeDL({"quiet": True, "no_warnings": True, "noplaylist": True, "socket_timeout": 30}) as ydl:
        return ydl.extract_info(url, download=False, process=False)


def adicionar(urls: list[str], tema: str, tags: list[str], local: bool, receita: str = "", ganchos: dict[str, str] | None = None) -> None:
    cat = carregar()
    vistos = {l["url"] for l in cat["links"]} | set(cat.get("removidos", []))
    ganchos = ganchos or {}
    for url in urls:
        url = url.strip()
        gancho = ganchos.get(url, "")
        if not url.startswith(("http://", "https://")):
            url = f"https://{url}"
        url = url.replace("http://", "https://", 1).split("?", 1)[0]  # o ?s=20 do X só marca de onde veio o link
        if BARRADAS.search(url):
            print(f"  pula {url}: YouTube e Instagram não deixam o servidor baixar; o app falharia")
            continue
        if not REDES.match(url):
            print(f"  pula {url}: só links do TikTok ou do X")
            continue
        try:
            i = (None if local else info_servidor(url)) or info_local(url)
        except Exception as e:  # noqa: BLE001 — o yt-dlp levanta muitos tipos
            print(f"  pula {url}: {str(e).splitlines()[0][:150]}")
            continue
        canonico = i.get("webpage_url") or url
        if url in vistos or canonico in vistos:
            print(f"  já está: {url}")
            continue
        if (i.get("duration") or 0) > DUR_MAX:
            print(f"  pula {url}: mais de {DUR_MAX // 60} min")
            continue
        plataforma = i.get("extractor_key") or i.get("ie_key") or ""
        autor = (i.get("uploader_id") if plataforma in ARROBA else None) or i.get("uploader") or i.get("channel") or ""
        if plataforma in ARROBA and autor and not autor.startswith("@"):
            autor = f"@{autor}"
        numero = max([int(l["id"].rsplit("-", 1)[1]) for l in cat["links"] if l["tema"] == tema] + [0]) + 1
        link = {
            "id": f"{slug(tema)}-{numero:02d}",
            "url": canonico,
            "tema": tema,
            "tags": tags,
            "titulo": re.sub(r"\s+", " ", i.get("title") or i.get("description") or "").strip()[:80],
            "autor": autor,
            "plataforma": {"Twitter": "X"}.get(plataforma, plataforma),
            "duracao_s": round(i["duration"]) if i.get("duration") else None,
            "adicionado_em": date.today().isoformat(),
        }
        if receita:
            link["receita"] = receita
        if gancho:
            link["gancho"] = gancho
        cat["links"].append(link)
        vistos |= {url, canonico}
        gravar(cat)
        print(f"  + {link['id']}: {link['titulo'][:50]} ({link['autor']} · {link['plataforma']})")
    print(f"{len(cat['links'])} links no catálogo. Publique com: python ferramentas/acervo/huggingface.py --upload")


def remover(ids: list[str]) -> None:
    cat = carregar()
    for l in list(cat["links"]):
        if l["id"] in ids:
            cat["links"].remove(l)
            cat.setdefault("removidos", []).append(l["url"])
    gravar(cat)
    print(f"removidos: {', '.join(ids)}")


def listar() -> None:
    for l in carregar()["links"]:
        print(f"{l['id']:<14} {l['plataforma']:<7} {l['autor'][:20]:<20} {l['titulo'][:50]}")


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("urls", nargs="*")
    ap.add_argument("--de", type=Path, metavar="ARQUIVO", help="um link por linha")
    ap.add_argument("--tema", default="anime", help="o grupo que aparece no app (anime, phonk, meme, esporte...)")
    ap.add_argument("--tags", nargs="*", default=[], help="palavras extras para a busca")
    ap.add_argument("--local", action="store_true", help="lê os links com o yt-dlp daqui, sem o baixador")
    ap.add_argument("--receita", default="", help="id da receita (ex.: mangaio): o link vira vídeo de cima na fila dela")
    ap.add_argument("--listar", action="store_true")
    ap.add_argument("--remover", nargs="+", metavar="ID")
    a = ap.parse_args()
    if a.listar:
        listar()
    elif a.remover:
        remover(a.remover)
    else:
        urls, ganchos = list(a.urls), {}
        if a.de:
            for linha in a.de.read_text("utf-8").splitlines():
                if not linha.strip() or linha.lstrip().startswith("#"):
                    continue
                url, _, gancho = linha.strip().partition(" - ")
                urls.append(url.strip())
                if gancho.strip():
                    ganchos[url.strip()] = gancho.strip()
        if not urls:
            ap.print_help()
            return
        adicionar(urls, a.tema.strip().lower(), [t.lower() for t in a.tags], a.local, a.receita.strip(), ganchos)


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    main()
