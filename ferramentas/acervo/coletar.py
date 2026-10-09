"""Coleta vídeos de retenção com licença livre para o acervo da Prensa.

Fontes: Wikimedia Commons (por categoria exata, que traz muito menos lixo que busca por termo) e a
NASA Image and Video Library (domínio público). Aceita só licenças que permitem re-hospedar (CC0,
domínio público, CC BY; CC BY-SA só com --aceitar-sa, num balde marcado), corta 15 s em 9:16 720p
sem áudio e grava o crédito de cada clipe em acervo.json. Nada entra no app sem revisão humana:
cada clipe nasce "revisado": false.

  python ferramentas/acervo/coletar.py                         # coleta o plano inteiro (~60 clipes)
  python ferramentas/acervo/coletar.py --categorias espaco ceu  # só algumas
  python ferramentas/acervo/coletar.py --folha                  # folha de contato para revisar
  python ferramentas/acervo/coletar.py --aprovar ceu-01 espaco-02
  python ferramentas/acervo/coletar.py --rejeitar maquinas-03   # apaga e não baixa de novo
  python ferramentas/acervo/coletar.py --restaurar              # num clone novo: refaz os aprovados

Biblioteca padrão + ffmpeg/ffprobe no PATH; --folha usa o Pillow. Para publicar no Hugging Face, use
ferramentas/acervo/huggingface.py. Plano e fontes em docs/acervo.md.
"""
from __future__ import annotations

import argparse
import hashlib
import html
import http.client
import json
import re
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import date
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[2]
SAIDA = RAIZ / "app" / "public" / "acervo"
COMMONS = "https://commons.wikimedia.org/w/api.php"
NASA = "https://images-api.nasa.gov"
UA = "Prensa-acervo/0.2 (https://github.com/arthruur/motores-video; coletor de clipes com licença livre)"

# Plano de coleta (pesquisa de 08/10/2026, docs/acervo.md): categoria -> (alvo, consultas).
# Commons: busca "filetype:video incategory:..." com categorias que existem e têm pouco lixo.
# Nunca deepcat em categorias amplas ("First-person videos" traz bodycam de polícia, por exemplo).
PLANO: dict[str, tuple[int, list[tuple[str, str]]]] = {
    "espaco": (8, [("nasa", "Earth Views"), ("nasa", "ISS earth views"),
                   ("commons", 'incategory:"Videos of Earth from space"'),
                   ("commons", 'incategory:"Ultra High Definition videos from NASA"')]),
    "ceu": (9, [("commons", 'incategory:"Time-lapse videos of clouds"'),
                ("commons", 'incategory:"Time-lapse videos of sunsets"'),
                ("commons", 'incategory:"Time-lapse videos of astronomy"')]),
    "agua": (5, [("commons", 'incategory:"Videos of waterfalls"'),
                 ("commons", 'incategory:"Slow motion videos of fluid mechanics"')]),
    "impressao3d": (5, [("commons", 'incategory:"Time-lapse videos of machines"'),
                        ("commons", 'incategory:"Videos of 3D printing"')]),
    "maquinas": (6, [("commons", 'incategory:"Videos of cutting machines"'), ("commons", '"CNC lathe"'),
                     ("commons", '"laser cutting"'), ("commons", "forging"),
                     ("commons", 'incategory:"Videos of agricultural machines"')]),
    "artesanato": (6, [("commons", 'incategory:"Videos of pottery manufacturing"'),
                       ("commons", 'incategory:"Videos of glassblowing"'),
                       ("commons", 'incategory:"Videos of the manufacture of candy"'), ("commons", '"latte art"')]),
    "mecanismos": (4, [("commons", 'incategory:"Videos of domino effect"'), ("commons", '"Newton\'s cradle"'),
                       ("commons", '"Rube Goldberg"'), ("commons", '"kinetic sculpture"')]),
    "pov": (8, [("commons", 'incategory:"First-person videos on bicycle"'),
                ("commons", 'incategory:"First-person videos on foot"'),
                ("commons", 'incategory:"Videos of rail transport with onboard view"'), ("commons", '"cab ride"'),
                ("commons", 'incategory:"Videos of roller coasters"'), ("commons", 'incategory:"Hyperlapse videos"')]),
}
LICENCAS_OK = re.compile(r"^(cc0|cc-zero|public domain|pd\b|pd-|cc by \d|cc-by-\d)", re.I)
LICENCA_SA = re.compile(r"^cc[ -]by-sa", re.I)
# títulos que nunca servem como vídeo de retenção (artigos científicos, violência, acidentes, polícia)
TITULO_RUIM = re.compile(r"pone|journal|weeknummer|bodycam|police|polícia|killing|crash|accident|war\b|guerra|protest", re.I)
DUR_CLIPE = 15.0
DUR_MIN = 20.0
ALTURA_MIN = 720


def pedir(url: str) -> dict:
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.load(r)


def commons(**params) -> dict:
    params |= {"format": "json", "formatversion": "2"}
    return pedir(f"{COMMONS}?{urllib.parse.urlencode(params)}")


def texto(v: str | None) -> str:
    return html.unescape(re.sub(r"<[^>]+>", "", v or "")).strip()


# ---------------------------------------------------------------- candidatos: um dicionário igual para toda fonte
def candidatos_commons(consulta: str, aceitar_sa: bool):
    d = commons(action="query", generator="search", gsrnamespace=6, gsrsearch=f"filetype:video {consulta}", gsrlimit=40,
                prop="videoinfo", viprop="url|size|mime|extmetadata|derivatives",
                viextmetadatafilter="Artist|LicenseShortName|LicenseUrl|Restrictions|ObjectName")
    for p in d.get("query", {}).get("pages", []):
        v = (p.get("videoinfo") or [{}])[0]
        m = v.get("extmetadata", {})
        lic = texto(m.get("LicenseShortName", {}).get("value"))
        motivo = None
        if texto(m.get("Restrictions", {}).get("value")):
            motivo = "tem restrições (pessoas, marcas...)"
        elif LICENCA_SA.match(lic) and not aceitar_sa:
            motivo = f"{lic}: share-alike (use --aceitar-sa)"
        elif not LICENCAS_OK.match(lic) and not LICENCA_SA.match(lic):
            motivo = f"licença {lic or '?'} fora da lista"
        elif not str(v.get("mime", "")).startswith("video/"):
            motivo = "não é vídeo"
        elif (v.get("height") or 0) < ALTURA_MIN:
            motivo = f"baixa resolução ({v.get('height')} px)"
        elif (v.get("duration") or 0) < DUR_MIN:
            motivo = "curto demais"
        url = menor_derivado(v)
        if not motivo and not url:
            motivo = "sem versão leve para baixar"
        elif TITULO_RUIM.search(p["title"]):
            motivo = "título fora do tema"
        autor = texto(m.get("Artist", {}).get("value")) or ""
        yield {
            "titulo": (texto(m.get("ObjectName", {}).get("value")) or p["title"].removeprefix("File:").rsplit(".", 1)[0])[:60],
            "pagina": v.get("descriptionurl", ""), "url": url, "duracao": v.get("duration"),
            "licenca": lic, "licenca_url": texto(m.get("LicenseUrl", {}).get("value")),
            "credito": f"{autor[:60]}, via Wikimedia Commons" if autor else "",
            "fonte": "wikimedia-commons", "motivo": motivo or (None if autor else "sem autor (a licença exige crédito)"),
        }


def menor_derivado(v: dict) -> str | None:
    """o Commons guarda versões recodificadas (720p, 1080p...): a menor com 720p ou mais poupa banda e tempo"""
    boas = [d for d in v.get("derivatives", []) if (d.get("height") or 0) >= ALTURA_MIN and "video/" in d.get("type", "")]
    if boas:
        return min(boas, key=lambda d: d.get("height") or 0)["src"]
    return v.get("url") if (v.get("size") or 0) < 250e6 else None


def candidatos_nasa(consulta: str, _aceitar_sa: bool):
    d = pedir(f"{NASA}/search?{urllib.parse.urlencode({'q': consulta, 'media_type': 'video'})}")
    for it in d.get("collection", {}).get("items", [])[:40]:
        meta = (it.get("data") or [{}])[0]
        nasa_id = meta.get("nasa_id", "")
        titulo = meta.get("title", nasa_id)
        motivo = None
        if TITULO_RUIM.search(titulo):
            motivo = "título fora do tema"
        elif "credit" in (meta.get("description") or "").lower() and "nasa" not in (meta.get("description") or "").lower().split("credit", 1)[1][:80]:
            motivo = "crédito de terceiros na descrição"
        yield {
            "titulo": titulo[:60], "pagina": f"https://images.nasa.gov/details/{urllib.parse.quote(nasa_id)}",
            "nasa_id": nasa_id, "url": None, "duracao": None,
            "licenca": "Public domain (NASA)", "licenca_url": "https://www.nasa.gov/nasa-brand-center/images-and-media/",
            "credito": f"NASA{(' / ' + meta['center']) if meta.get('center') else ''}", "fonte": "nasa", "motivo": motivo,
        }


def url_nasa(nasa_id: str) -> str:
    """o manifesto do item lista os arquivos; o ~medium basta para 720p e é bem menor que o ~orig"""
    arquivos = pedir(f"{NASA}/asset/{urllib.parse.quote(nasa_id)}")["collection"]["items"]
    hrefs = [a["href"] for a in arquivos if a["href"].endswith(".mp4")]
    for sufixo in ("~medium.mp4", "~large.mp4", "~orig.mp4"):
        for h in hrefs:
            if h.endswith(sufixo):
                return urllib.parse.quote(h.replace("http://", "https://"), safe=":/~%")
    raise OSError("item da NASA sem mp4")


FONTES = {"commons": candidatos_commons, "nasa": candidatos_nasa}


# ---------------------------------------------------------------- baixar e cortar
def baixar(url: str, destino: Path, tentativas: int = 5) -> None:
    """um pedido só por arquivo; em 429, espera o que o servidor pedir"""
    for i in range(tentativas):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=180) as r, open(destino, "wb") as f:
                while bloco := r.read(1 << 20):
                    f.write(bloco)
            return
        except urllib.error.HTTPError as e:
            if e.code != 429 or i + 1 == tentativas:
                raise
            espera = int(e.headers.get("Retry-After") or 30 * (i + 1))
            print(f"    429: espero {espera} s")
            time.sleep(espera)


def duracao(arquivo: Path) -> float:
    s = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(arquivo)],
                       capture_output=True, text=True).stdout.strip()
    return float(s) if s and s != "N/A" else 0.0


def cortar(url: str, destino: Path) -> None:
    """15 s a partir de 20% do vídeo, em 9:16 720x1280, 30 fps, sem áudio"""
    filtro = "scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280,fps=30,format=yuv420p"
    with tempfile.TemporaryDirectory() as tmp:
        original = Path(tmp) / "original"
        baixar(url, original)
        dur = duracao(original)
        if dur < DUR_MIN:
            raise OSError(f"original com {dur:.0f} s")
        ini = max(0.0, min(dur * 0.2, dur - DUR_CLIPE))
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", f"{ini:.2f}", "-t", f"{DUR_CLIPE}", "-i", str(original),
                        "-vf", filtro, "-an", "-c:v", "libx264", "-preset", "veryfast", "-crf", "26",
                        "-movflags", "+faststart", str(destino)], check=True, timeout=900)
    if duracao(destino) < 5:
        destino.unlink(missing_ok=True)
        raise OSError("o clipe saiu vazio")


def carregar(saida: Path) -> dict:
    f = saida / "acervo.json"
    return json.loads(f.read_text("utf-8")) if f.exists() else {"clipes": [], "rejeitados": []}


def gravar(saida: Path, acervo: dict) -> None:
    saida.mkdir(parents=True, exist_ok=True)
    (saida / "acervo.json").write_text(json.dumps(acervo, ensure_ascii=False, indent=2) + "\n", "utf-8")


def coletar(saida: Path, aceitar_sa: bool, so: list[str] | None, escala: float) -> None:
    acervo = carregar(saida)
    vistos = {c["origem"]["pagina"] for c in acervo["clipes"]} | set(acervo.get("rejeitados", []))
    for cat, (alvo, consultas) in PLANO.items():
        if so and cat not in so:
            continue
        alvo = max(1, round(alvo * escala))
        n = sum(c["categoria"] == cat for c in acervo["clipes"])
        for fonte, consulta in consultas:
            if n >= alvo:
                break
            print(f"[{cat}] {fonte}: {consulta}")
            try:
                lista = list(FONTES[fonte](consulta, aceitar_sa))
            except (urllib.error.URLError, KeyError, json.JSONDecodeError) as e:
                print(f"  busca falhou: {e}")
                continue
            for c in lista:
                if n >= alvo:
                    break
                if c["pagina"] in vistos:
                    continue
                vistos.add(c["pagina"])
                if c["motivo"]:
                    print(f"  pula {c['titulo']}: {c['motivo']}")
                    continue
                numero = max([int(x["id"].rsplit("-", 1)[1]) for x in acervo["clipes"] if x["categoria"] == cat] + [0]) + 1
                id_ = f"{cat}-{numero:02d}"
                destino = saida / f"{id_}.mp4"
                saida.mkdir(parents=True, exist_ok=True)
                print(f"  corta {c['titulo']} -> {destino.name}")
                try:
                    cortar(c["url"] or url_nasa(c["nasa_id"]), destino)
                except (subprocess.CalledProcessError, subprocess.TimeoutExpired, OSError, KeyError, http.client.HTTPException) as e:
                    print(f"    falhou: {e}")
                    continue
                origem = {"fonte": c["fonte"], "pagina": c["pagina"]}
                if c.get("nasa_id"):
                    origem["nasa_id"] = c["nasa_id"]
                acervo["clipes"].append({
                    "id": id_, "categoria": cat, "arquivo": destino.name, "titulo": c["titulo"],
                    "credito": c["credito"], "licenca": c["licenca"], "licenca_url": c["licenca_url"],
                    "share_alike": bool(LICENCA_SA.match(c["licenca"])), "revisado": False,
                    "largura": 720, "altura": 1280, "duracao_s": DUR_CLIPE,
                    "sha256": hashlib.sha256(destino.read_bytes()).hexdigest(), "origem": origem,
                    "modificacoes": "trecho de 15 s, recortado para 9:16, 720p, sem áudio",
                    "coletado_em": date.today().isoformat(),
                })
                gravar(saida, acervo)
                n += 1
                time.sleep(1)  # etiqueta das APIs: pedidos em série, sem pressa
    total = len(acervo["clipes"])
    print(f"{total} clipes em {saida} ({sum(c['revisado'] for c in acervo['clipes'])} revisados). Revise com --folha.")


# ---------------------------------------------------------------- revisão
def folha(saida: Path) -> None:
    """um quadro de cada clipe ainda não revisado, com o id escrito, numa imagem só (precisa do Pillow)"""
    from PIL import Image, ImageDraw, ImageFont

    entradas = [c for c in carregar(saida)["clipes"] if (saida / c["arquivo"]).exists()]
    if not entradas:
        sys.exit("acervo vazio")
    cols = min(8, len(entradas))
    lins = -(-len(entradas) // cols)
    folha_img = Image.new("RGB", (cols * 180, lins * 320), "black")
    fonte = ImageFont.truetype(str(RAIZ / "fontes" / "BarlowCondensed-ExtraBold.ttf"), 24)
    with tempfile.TemporaryDirectory() as tmp:
        for i, c in enumerate(entradas):
            png = Path(tmp) / f"{i}.png"
            subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", "5", "-i", str(saida / c["arquivo"]), "-frames:v", "1",
                            "-vf", "scale=180:320", str(png)])
            if not png.exists():
                print(f"  {c['id']}: sem quadro (clipe quebrado? rejeite)")
                continue
            quadro = Image.open(png).convert("RGB")
            d = ImageDraw.Draw(quadro)
            d.rectangle((0, 0, 180, 32), fill="black")
            d.text((6, 2), c["id"] + (" OK" if c["revisado"] else ""), font=fonte, fill="#FFD633")
            folha_img.paste(quadro, ((i % cols) * 180, (i // cols) * 320))
    destino = saida / "folha.png"
    folha_img.save(destino)
    print(f"folha de contato: {destino} ({len(entradas)} clipes)")


def marcar(saida: Path, ids: list[str], aprovar: bool) -> None:
    acervo = carregar(saida)
    for c in list(acervo["clipes"]):
        if c["id"] in ids:
            if aprovar:
                c["revisado"] = True
            else:
                (saida / c["arquivo"]).unlink(missing_ok=True)
                acervo.setdefault("rejeitados", []).append(c["origem"]["pagina"])
                acervo["clipes"].remove(c)
    gravar(saida, acervo)
    print(f"{'aprovados' if aprovar else 'rejeitados'}: {', '.join(ids)}")


def restaurar(saida: Path) -> None:
    """o git guarda só o acervo.json; os .mp4 aprovados são refeitos da origem, com o mesmo corte"""
    acervo = carregar(saida)
    for c in acervo["clipes"]:
        destino = saida / c["arquivo"]
        if not c["revisado"] or destino.exists():
            continue
        try:
            if c["origem"]["fonte"] == "nasa":
                url = url_nasa(c["origem"]["nasa_id"])
            else:
                titulo = urllib.parse.unquote(c["origem"]["pagina"].rsplit("/", 1)[-1])
                v = commons(action="query", titles=titulo, prop="videoinfo", viprop="url|size|derivatives")["query"]["pages"][0]["videoinfo"][0]
                url = menor_derivado(v) or v["url"]
            print(f"  refaz {c['id']}")
            cortar(url, destino)
        except (subprocess.CalledProcessError, subprocess.TimeoutExpired, OSError, KeyError, IndexError) as e:
            print(f"    {c['id']} falhou: {e}")
        time.sleep(1)
    print(f"{sum((saida / c['arquivo']).exists() for c in acervo['clipes'] if c['revisado'])} clipes aprovados prontos em {saida}")


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--saida", type=Path, default=SAIDA)
    ap.add_argument("--categorias", nargs="*", help=f"só estas: {', '.join(PLANO)}")
    ap.add_argument("--escala", type=float, default=1.0, help="multiplica o alvo de cada categoria (0.5 = metade)")
    ap.add_argument("--aceitar-sa", action="store_true", help="aceita CC BY-SA (o reel herda a BY-SA)")
    ap.add_argument("--folha", action="store_true", help="gera folha.png para revisar")
    ap.add_argument("--aprovar", nargs="+", metavar="ID")
    ap.add_argument("--rejeitar", nargs="+", metavar="ID")
    ap.add_argument("--restaurar", action="store_true", help="refaz os clipes aprovados que faltam")
    a = ap.parse_args()
    if a.folha:
        folha(a.saida)
    elif a.aprovar:
        marcar(a.saida, a.aprovar, True)
    elif a.rejeitar:
        marcar(a.saida, a.rejeitar, False)
    elif a.restaurar:
        restaurar(a.saida)
    else:
        coletar(a.saida, a.aceitar_sa, a.categorias, a.escala)


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    main()
