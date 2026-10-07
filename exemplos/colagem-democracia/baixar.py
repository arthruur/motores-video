"""Baixa (yt-dlp) só os trechos das fontes deste exemplo em entrada/, que o git ignora.

uso: python exemplos/colagem-democracia/baixar.py              # baixa o que falta (4 trechos, ~32 MB, 62 s medidos)
     python exemplos/colagem-democracia/baixar.py --de PASTA   # copia <slug>.mp4 de PASTA, se existir

Os vídeos são de terceiros e nunca entram no repositório: os direitos são dos titulares (README).
É o mesmo que: python -m motores.colagem.cli baixar exemplos/colagem-democracia/fontes.json
"""
import sys
from pathlib import Path

AQUI = Path(__file__).resolve().parent
sys.path.insert(0, str(AQUI.parents[1]))

from motores.colagem.cli import principal  # noqa: E402

if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    if {"-h", "--help"} & set(sys.argv[1:]):
        print(__doc__)
        sys.exit(0)
    principal(["baixar", str(AQUI / "fontes.json"), *sys.argv[1:]])
