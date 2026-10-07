"""Baixa só o trecho do discurso listado em fontes.json (yt-dlp) para entrada/.

uso: python exemplos/karaoke-discurso/baixar.py            # baixa o que faltar
     python exemplos/karaoke-discurso/baixar.py --forcar   # baixa de novo
     python exemplos/karaoke-discurso/baixar.py --help

A mídia é de terceiros: fica em entrada/ (fora do git) e nunca é versionada.
Crédito, fonte e trecho ficam em fontes.json; o vídeo final mostra os dois na tela.
Precisa do yt-dlp (pip install yt-dlp) e do ffmpeg no PATH (o corte re-codifica nas pontas).
"""
from __future__ import annotations

import argparse
import importlib.util
import json
import shutil
import subprocess
import sys
from pathlib import Path

AQUI = Path(__file__).resolve().parent


def carregar_fonte(arq: Path = AQUI / "fontes.json", id_: str | None = None) -> dict:
    fontes = json.loads(arq.read_text(encoding="utf-8"))["fontes"]
    if id_ is None:
        return fontes[0]
    for f in fontes:
        if f["id"] == id_:
            return f
    raise SystemExit(f"fonte '{id_}' não está em {arq.name} (há: {', '.join(f['id'] for f in fontes)})")


def ytdlp() -> list[str]:
    if importlib.util.find_spec("yt_dlp"):
        return [sys.executable, "-m", "yt_dlp"]
    if shutil.which("yt-dlp"):
        return ["yt-dlp"]
    raise SystemExit("falta o yt-dlp: pip install yt-dlp")


def baixar(fonte: dict, base: Path = AQUI, forcar: bool = False, log=print) -> Path:
    """-> caminho do trecho. Não baixa de novo se já existe."""
    destino = base / fonte["arquivo"]
    if destino.exists() and not forcar:
        return destino
    destino.parent.mkdir(parents=True, exist_ok=True)
    tr = fonte["trecho"]
    log(f"baixando {tr['ini']}-{tr['fim']} de {fonte['url']} (crédito: {fonte['credito']}) ...")
    subprocess.run([*ytdlp(), "-q", "--no-warnings", "--no-playlist",
                    "--download-sections", f"*{tr['ini']}-{tr['fim']}", "--force-keyframes-at-cuts",
                    "-f", "bv*[height<=1080]+ba/b[height<=1080]/b", "--merge-output-format", "mp4",
                    "--force-overwrites", "-o", str(destino.with_suffix(".%(ext)s")), fonte["url"]], check=True)
    return destino


def main(argv=None):
    ap = argparse.ArgumentParser(description="Baixa o trecho do discurso (fontes.json) para entrada/, com yt-dlp.")
    ap.add_argument("--fontes", type=Path, default=AQUI / "fontes.json", help="lista de fontes (padrão: a deste exemplo)")
    ap.add_argument("--id", help="qual fonte (padrão: a primeira)")
    ap.add_argument("--forcar", action="store_true", help="baixa mesmo se o arquivo já existe")
    a = ap.parse_args(argv)
    f = carregar_fonte(a.fontes, a.id)
    arq = baixar(f, a.fontes.resolve().parent, a.forcar)
    print(f"{arq}\ncrédito: {f['credito']} · {f['url']} ({f['trecho']['ini']}-{f['trecho']['fim']})")


if __name__ == "__main__":
    for s in (sys.stdout, sys.stderr):
        s.reconfigure(encoding="utf-8")
    main()
