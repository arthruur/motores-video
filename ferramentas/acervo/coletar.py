"""Coleta vídeos de retenção com licença livre do Wikimedia Commons para o acervo da Prensa.

Busca por categoria, aceita só licenças que permitem re-hospedar (CC0, domínio público, CC BY;
CC BY-SA só com --aceitar-sa), corta um trecho em 9:16 720p sem áudio e grava o crédito de cada
clipe em acervo.json. Nada entra no app sem revisão humana: cada clipe nasce "revisado": false.

  python ferramentas/acervo/coletar.py                     # coleta (padrão: app/public/acervo/)
  python ferramentas/acervo/coletar.py --por-categoria 3
  python ferramentas/acervo/coletar.py --folha              # folha de contato para revisar
  python ferramentas/acervo/coletar.py --aprovar areia-01 bolinhas-02
  python ferramentas/acervo/coletar.py --rejeitar slime-01  # apaga o clipe e lembra de não baixar de novo
  python ferramentas/acervo/coletar.py --restaurar          # refaz os .mp4 aprovados a partir do acervo.json (clone novo)

Só biblioteca padrão + ffmpeg no PATH. Plano e regras em docs/acervo.md.
"""
from __future__ import annotations

import argparse
import hashlib
import html
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
API = "https://commons.wikimedia.org/w/api.php"
UA = "Prensa-acervo/0.1 (https://github.com/arthruur/motores-video; coletor de clipes com licença livre)"

# categoria -> termos de busca (inglês rende mais no Commons)
CATEGORIAS = {
    "areia": ["kinetic sand", "sand art"],
    "slime": ["slime"],
    "tinta": ["paint mixing", "ink in water", "marbling paint"],
    "bolinhas": ["marble run", "marble machine", "rube goldberg"],
    "maquinas": ["hydraulic press", "machine timelapse", "factory production line"],
    "ceramica": ["pottery wheel", "potter's wheel"],
    "natureza": ["waterfall", "timelapse clouds", "ocean waves"],
    "viagem": ["cab ride", "driver's view train", "drone flight"],
    "cozinha": ["cooking", "dough kneading"],
}
LICENCAS_OK = re.compile(r"^(cc0|public domain|pd\b|cc by \d|cc-by-\d)", re.I)
LICENCA_SA = re.compile(r"^cc[ -]by-sa", re.I)
DUR_CLIPE = 15.0


def api(**params) -> dict:
    params |= {"format": "json", "formatversion": "2"}
    req = urllib.request.Request(f"{API}?{urllib.parse.urlencode(params)}", headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.load(r)


def texto(v: str | None) -> str:
    return html.unescape(re.sub(r"<[^>]+>", "", v or "")).strip()


def buscar(termo: str, limite: int) -> list[dict]:
    d = api(action="query", generator="search", gsrnamespace=6, gsrsearch=f"filetype:video {termo}", gsrlimit=limite,
            prop="videoinfo", viprop="url|size|mime|extmetadata",
            viextmetadatafilter="Artist|LicenseShortName|LicenseUrl|AttributionRequired|Restrictions|ObjectName|Credit")
    return d.get("query", {}).get("pages", [])


def aceitavel(p: dict, aceitar_sa: bool) -> tuple[bool, str]:
    v = (p.get("videoinfo") or [{}])[0]
    m = v.get("extmetadata", {})
    lic = texto(m.get("LicenseShortName", {}).get("value"))
    if texto(m.get("Restrictions", {}).get("value")):
        return False, "tem restrições (pessoas, marcas...)"
    if LICENCA_SA.match(lic) and not aceitar_sa:
        return False, f"{lic}: share-alike (use --aceitar-sa)"
    if not LICENCAS_OK.match(lic) and not LICENCA_SA.match(lic):
        return False, f"licença {lic or '?'} fora da lista"
    if not str(v.get("mime", "")).startswith("video/") or not v.get("width"):
        return False, "não é vídeo"
    if (v.get("duration") or 0) < 6:
        return False, "curto demais"
    if (v.get("size") or 0) > 400e6:
        return False, "arquivo grande demais"
    return True, lic


def baixar(url: str, destino: Path, tentativas: int = 5) -> None:
    """um pedido só por arquivo; em 429, espera o que o servidor pedir"""
    for i in range(tentativas):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=120) as r, open(destino, "wb") as f:
                while bloco := r.read(1 << 20):
                    f.write(bloco)
            return
        except urllib.error.HTTPError as e:
            if e.code != 429 or i + 1 == tentativas:
                raise
            espera = int(e.headers.get("Retry-After") or 30 * (i + 1))
            print(f"    429: espero {espera} s")
            time.sleep(espera)


def cortar(url: str, dur: float, destino: Path) -> None:
    ini = max(0.0, min(dur * 0.2, dur - DUR_CLIPE))
    filtro = "scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280,fps=30,format=yuv420p"
    with tempfile.TemporaryDirectory() as tmp:
        original = Path(tmp) / "original"
        baixar(url, original)
        _ffmpeg(original, ini, filtro, destino)
    dur_saida = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(destino)],
                               capture_output=True, text=True).stdout.strip()
    if not dur_saida or float(dur_saida) < 5:
        destino.unlink(missing_ok=True)
        raise OSError(f"clipe saiu com {dur_saida or 0} s")


def _ffmpeg(original: Path, ini: float, filtro: str, destino: Path) -> None:
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", f"{ini:.2f}", "-t", f"{DUR_CLIPE}", "-i", str(original),
                    "-vf", filtro, "-an", "-c:v", "libx264", "-preset", "veryfast", "-crf", "28",
                    "-movflags", "+faststart", str(destino)], check=True, timeout=600)


def carregar(saida: Path) -> dict:
    f = saida / "acervo.json"
    return json.loads(f.read_text("utf-8")) if f.exists() else {"clipes": [], "rejeitados": []}


def gravar(saida: Path, acervo: dict) -> None:
    saida.mkdir(parents=True, exist_ok=True)
    (saida / "acervo.json").write_text(json.dumps(acervo, ensure_ascii=False, indent=2) + "\n", "utf-8")


def coletar(saida: Path, por_categoria: int, aceitar_sa: bool, so: list[str] | None) -> None:
    acervo = carregar(saida)
    vistos = {c["origem"]["pagina"] for c in acervo["clipes"]} | set(acervo.get("rejeitados", []))
    for cat, termos in CATEGORIAS.items():
        if so and cat not in so:
            continue
        n = sum(c["categoria"] == cat for c in acervo["clipes"])
        for termo in termos:
            if n >= por_categoria:
                break
            for p in buscar(termo, 20):
                if n >= por_categoria:
                    break
                v = (p.get("videoinfo") or [{}])[0]
                pagina = v.get("descriptionurl", "")
                if pagina in vistos:
                    continue
                vistos.add(pagina)
                ok, motivo = aceitavel(p, aceitar_sa)
                if not ok:
                    print(f"  pula {p['title']}: {motivo}")
                    continue
                m = v["extmetadata"]
                id_ = f"{cat}-{n + 1:02d}"
                destino = saida / f"{id_}.mp4"
                saida.mkdir(parents=True, exist_ok=True)
                print(f"  corta {p['title']} -> {destino.name}")
                try:
                    cortar(v["url"], float(v.get("duration") or DUR_CLIPE), destino)
                except (subprocess.CalledProcessError, subprocess.TimeoutExpired, OSError) as e:
                    print(f"    falhou: {e}")
                    continue
                autor = texto(m.get("Artist", {}).get("value")) or "autor desconhecido"
                titulo = texto(m.get("ObjectName", {}).get("value")) or p["title"].removeprefix("File:").rsplit(".", 1)[0]
                lic = texto(m.get("LicenseShortName", {}).get("value"))
                acervo["clipes"].append({
                    "id": id_, "categoria": cat, "arquivo": destino.name, "titulo": titulo[:60],
                    "credito": f"{autor[:60]}, via Wikimedia Commons", "licenca": lic,
                    "revisado": False,
                    "largura": 720, "altura": 1280, "duracao_s": DUR_CLIPE,
                    "sha256": hashlib.sha256(destino.read_bytes()).hexdigest(),
                    "origem": {"fonte": "wikimedia-commons", "pagina": pagina, "arquivo_original": v["url"]},
                    "licenca_url": texto(m.get("LicenseUrl", {}).get("value")),
                    "share_alike": bool(LICENCA_SA.match(lic)),
                    "modificacoes": "trecho de 15 s, recortado para 9:16, 720p, sem áudio",
                    "coletado_em": date.today().isoformat(),
                })
                gravar(saida, acervo)
                n += 1
                time.sleep(1)  # etiqueta da API: pedidos em série, sem pressa
            time.sleep(1)
    print(f"{len(acervo['clipes'])} clipes em {saida} ({sum(c['revisado'] for c in acervo['clipes'])} revisados)")


def folha(saida: Path) -> None:
    """um quadro de cada clipe, com o id escrito, numa imagem só (precisa do Pillow)"""
    from PIL import Image, ImageDraw, ImageFont

    entradas = [c for c in carregar(saida)["clipes"] if (saida / c["arquivo"]).exists()]
    if not entradas:
        sys.exit("acervo vazio")
    cols = min(6, len(entradas))
    lins = -(-len(entradas) // cols)
    folha_img = Image.new("RGB", (cols * 180, lins * 320), "black")
    fonte = ImageFont.truetype(str(RAIZ / "fontes" / "BarlowCondensed-ExtraBold.ttf"), 26)
    with tempfile.TemporaryDirectory() as tmp:
        for i, c in enumerate(entradas):
            png = Path(tmp) / f"{i}.png"
            subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", "2", "-i", str(saida / c["arquivo"]), "-frames:v", "1",
                            "-vf", "scale=180:320", str(png)])
            if not png.exists():
                print(f"  {c['id']}: sem quadro (clipe quebrado? rejeite)")
                continue
            quadro = Image.open(png).convert("RGB")
            d = ImageDraw.Draw(quadro)
            d.rectangle((0, 0, 180, 34), fill="black")
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
        titulo = urllib.parse.unquote(c["origem"]["pagina"].rsplit("/", 1)[-1])
        d = api(action="query", titles=titulo, prop="videoinfo", viprop="url|size|mime")
        v = (d["query"]["pages"][0].get("videoinfo") or [{}])[0]
        print(f"  refaz {c['id']} <- {titulo}")
        try:
            cortar(v["url"], float(v.get("duration") or DUR_CLIPE), destino)
        except (subprocess.CalledProcessError, subprocess.TimeoutExpired, OSError, KeyError) as e:
            print(f"    falhou: {e}")
        time.sleep(1)
    print(f"{sum((saida / c['arquivo']).exists() for c in acervo['clipes'] if c['revisado'])} clipes aprovados prontos em {saida}")


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--saida", type=Path, default=SAIDA)
    ap.add_argument("--por-categoria", type=int, default=2)
    ap.add_argument("--categorias", nargs="*", help=f"só estas: {', '.join(CATEGORIAS)}")
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
        coletar(a.saida, a.por_categoria, a.aceitar_sa, a.categorias)


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    main()
