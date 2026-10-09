"""Publica a Prensa num Space estático do Hugging Face: HTTPS válido, de graça, sem servidor.

O Space serve o build do app com os cabeçalhos COOP/COEP (custom_headers), então o Whisper roda com
threads, e o endereço direto (https://USUARIO-prensa.static.hf.space) abre em qualquer celular sem aviso
de certificado.

  pip install huggingface_hub
  hf auth login                                   # token com permissão de escrita (huggingface.co/settings/tokens)
  python ferramentas/publicar_space.py            # padrão: arthruur/prensa
  python ferramentas/publicar_space.py --space usuario/prensa --sem-build

Os vídeos do acervo NÃO vão no Space: o app lê o acervo.json e baixa os clipes do dataset
(arthruur/prensa-acervo), o que também evita publicar clipe que ninguém revisou.
"""
from __future__ import annotations

import argparse
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[1]
APP = RAIZ / "app"

CARTAO = """---
title: Prensa
emoji: 🗞️
colorFrom: red
colorTo: yellow
sdk: static
app_file: index.html
pinned: true
short_description: Seu vídeo vira reels em 3 toques, no seu celular.
tags: [video, reels, legendas, whisper, software-livre, pt-br]
custom_headers:
  cross-origin-embedder-policy: require-corp
  cross-origin-opener-policy: same-origin
  cross-origin-resource-policy: cross-origin
---

# Prensa

**Seu vídeo vira reels em 3 toques, no seu celular.** Escolha um vídeo, toque numa receita e aperte Prensar:
saem reels prontos para TikTok, Reels, Shorts, Kwai e status do WhatsApp, com gancho, legenda palavra a palavra
e a fonte na tela. Tudo roda no aparelho, no navegador: o vídeo não é enviado para servidor nenhum.

**Abra pelo endereço direto, para a experiência completa: {direto}**

Software livre (Apache-2.0): use, estude, mude e compartilhe. Código em
[github.com/arthruur/motores-video](https://github.com/arthruur/motores-video/tree/prensa/app).
"""


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--space", default="arthruur/prensa", help="USUARIO/NOME do Space")
    ap.add_argument("--sem-build", action="store_true", help="usa o app/dist já existente")
    a = ap.parse_args()
    try:
        from huggingface_hub import HfApi
    except ImportError:
        sys.exit("instale o huggingface_hub: pip install huggingface_hub (e faça login: hf auth login)")

    if not a.sem_build:
        npm = "npm.cmd" if sys.platform == "win32" else "npm"
        subprocess.run([npm, "run", "build"], cwd=APP, check=True)
    dist = APP / "dist"
    if not (dist / "index.html").exists():
        sys.exit("falta app/dist: rode sem --sem-build")

    dono, nome = a.space.split("/", 1)
    direto = f"https://{dono}-{nome}.static.hf.space".lower()
    with tempfile.TemporaryDirectory() as tmp:
        pasta = Path(tmp) / "space"
        # vídeos do acervo e a folha de revisão ficam de fora: o app busca os clipes no dataset
        shutil.copytree(dist, pasta, ignore=shutil.ignore_patterns("*.mp4", "folha.png"))
        (pasta / "README.md").write_text(CARTAO.replace("{direto}", direto), "utf-8")
        tamanho = sum(f.stat().st_size for f in pasta.rglob("*") if f.is_file()) / 1e6
        print(f"subindo {tamanho:.1f} MB para o Space {a.space}…")
        api = HfApi()
        api.create_repo(a.space, repo_type="space", space_sdk="static", exist_ok=True)
        # o codificador AAC é um .js com WASM embutido: o Hub o trata como binário, que precisa ir por LFS/Xet.
        # As regras valem a partir do commit seguinte, então o .gitattributes sobe antes do resto.
        atributos = "*.wasm filter=lfs diff=lfs merge=lfs -text\nassets/*encoder*.js filter=lfs diff=lfs merge=lfs -text\n"
        api.upload_file(path_or_fileobj=atributos.encode(), path_in_repo=".gitattributes", repo_id=a.space,
                        repo_type="space", commit_message="LFS para os binários do app")
        api.upload_folder(folder_path=str(pasta), repo_id=a.space, repo_type="space",
                          commit_message="Prensa: publicação do app", delete_patterns=["assets/*"])
    print(f"pronto: https://huggingface.co/spaces/{a.space}")
    print(f"endereço direto (use este no celular e para compartilhar): {direto}")


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    main()
