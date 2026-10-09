"""Coletor de músicas para a etapa Som da Prensa.

Busca faixas instrumentais com licença CC0 ou CC BY no Openverse (que indexa o Jamendo e outros), corta um
trecho de ~75 s do meio da faixa (a parte com mais energia costuma estar ali), nivela em -14 LUFS e grava em
AAC (m4a) em app/public/acervo/audio/. As entradas vão para a chave "musicas" do acervo.json, com crédito e
licença para o texto do post.

  python ferramentas/acervo/coletar_audio.py                 # coleta o plano inteiro
  python ferramentas/acervo/coletar_audio.py --por-clima 1   # uma faixa por clima (teste rápido)
  python ferramentas/acervo/coletar_audio.py --rejeitar ID   # tira uma faixa do app (revisado: false)
  python ferramentas/acervo/huggingface.py --upload          # publica no dataset (clipes + audio/)

Requer ffmpeg no PATH.
"""
from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
import tempfile
import urllib.parse
import urllib.request
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[2]
ACERVO_DIR = RAIZ / "app" / "public" / "acervo"
ACERVO_JSON = ACERVO_DIR / "acervo.json"
AUDIO_DIR = ACERVO_DIR / "audio"
API = "https://api.openverse.org/v1/audio/"
AGENTE = "Prensa-acervo/1.0 (+https://github.com/arthruur/motores-video)"

# clima mostrado no app -> buscas no Openverse
PLANO: dict[str, list[str]] = {
    "animada · para listas": ["upbeat", "happy pop", "energetic"],
    "batida · para opinião": ["hip hop beat", "trap beat", "funk groove"],
    "tensão · para revelar": ["suspense", "cinematic tension", "dark trailer"],
    "épica · para virada": ["epic cinematic", "inspiring"],
    "calma · para explicar": ["chill lofi", "ambient chill"],
    "emoção · para história": ["emotional piano", "sad piano"],
    "eletrônica · para ritmo": ["electronic dance", "synthwave"],
}
RUINS = re.compile(r"\b(remix|cover|karaoke|vocal|lyrics|feat\.?|ft\.)\b", re.I)


def pedir(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": AGENTE})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read()


def buscar(q: str, pagina: int = 1) -> list[dict]:
    params = {"q": q, "license": "cc0,by", "category": "music", "page_size": 20, "page": pagina, "mature": "false"}
    dados = json.loads(pedir(f"{API}?{urllib.parse.urlencode(params)}"))
    return dados.get("results", [])


def boa(r: dict) -> bool:
    tags = {t["name"].lower() for t in r.get("tags") or []}
    dur = (r.get("duration") or 0) / 1000
    return (
        r.get("url")
        and 75 <= dur <= 600
        and not r.get("mature")
        and not RUINS.search(r.get("title") or "")
        and len(re.findall(r"[^\W\d_]", r.get("title") or "")) >= 4  # título que dá para mostrar no app
        # só instrumental: voz cantada brigaria com a fala do vídeo
        and ("instrumental" in tags or "vocal" not in " ".join(tags))
        and "speech" not in tags
    )


def slug(texto: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "-", texto.lower()).strip("-")
    return s[:40] or "faixa"


def preparar(origem: Path, destino: Path, dur_total: float, trecho: float = 75.0) -> None:
    ini = max(0.0, min(dur_total * 0.25, dur_total - trecho))
    filtro = (f"afade=t=in:st=0:d=1.5,afade=t=out:st={trecho - 3}:d=3,"
              "loudnorm=I=-14:TP=-1.5:LRA=11")
    subprocess.run(
        ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-ss", f"{ini:.2f}", "-t", f"{trecho}",
         "-i", str(origem), "-vn", "-af", filtro, "-ar", "48000", "-ac", "2", "-c:a", "aac", "-b:a", "128k",
         "-movflags", "+faststart", str(destino)],
        check=True,
    )


def carregar() -> dict:
    return json.loads(ACERVO_JSON.read_text("utf-8"))


def salvar(acervo: dict) -> None:
    ACERVO_JSON.write_text(json.dumps(acervo, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def coletar(por_clima: int) -> None:
    AUDIO_DIR.mkdir(parents=True, exist_ok=True)
    acervo = carregar()
    musicas: list[dict] = acervo.setdefault("musicas", [])
    vistas = {m["fonte_id"] for m in musicas if m.get("fonte_id")}
    novas = 0
    for clima, buscas in PLANO.items():
        tem = sum(1 for m in musicas if m.get("clima") == clima)
        for q in buscas:
            if tem >= por_clima:
                break
            try:
                resultados = buscar(q)
            except Exception as e:  # noqa: BLE001
                print(f"  ! busca '{q}' falhou: {e}")
                continue
            for r in resultados:
                if tem >= por_clima:
                    break
                if r["id"] in vistas or not boa(r):
                    continue
                vistas.add(r["id"])
                ident = f"{slug(r['title'])}-{r['id'][:6]}"
                destino = AUDIO_DIR / f"{ident}.m4a"
                print(f"- [{clima}] {r['title']} — {r.get('creator')} ({r['license'].upper()} {r.get('license_version') or ''})")
                try:
                    with tempfile.TemporaryDirectory() as tmp:
                        bruto = Path(tmp) / "faixa"
                        bruto.write_bytes(pedir(r["url"]))
                        preparar(bruto, destino, (r.get("duration") or 75000) / 1000)
                except Exception as e:  # noqa: BLE001
                    print(f"  ! não deu: {e}")
                    continue
                licenca = "CC0" if r["license"] == "cc0" else f"CC BY {r.get('license_version') or '4.0'}"
                musicas.append({
                    "id": ident,
                    "arquivo": destino.name,
                    "titulo": r["title"].strip()[:60],
                    "credito": f"{r['title'].strip()} — {r.get('creator') or 'autor desconhecido'} ({licenca}, {r.get('source')})",
                    "licenca": licenca,
                    "licenca_url": r.get("license_url"),
                    "fonte": r.get("foreign_landing_url"),
                    "fonte_id": r["id"],
                    "clima": clima,
                    "revisado": True,
                })
                tem += 1
                novas += 1
                salvar(acervo)  # a cada faixa, para não perder progresso
    print(f"\n{novas} faixas novas; {sum(1 for m in musicas if m['revisado'])} no app.")


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--por-clima", type=int, default=2, help="quantas faixas por clima (padrão 2)")
    ap.add_argument("--rejeitar", metavar="ID", help="marca a faixa como não revisada (sai do app)")
    a = ap.parse_args()
    if a.rejeitar:
        acervo = carregar()
        for m in acervo.get("musicas", []):
            if m["id"] == a.rejeitar:
                m["revisado"] = False
                salvar(acervo)
                print(f"{a.rejeitar}: fora do app")
                return
        sys.exit(f"não achei {a.rejeitar}")
    coletar(a.por_clima)


if __name__ == "__main__":
    main()
