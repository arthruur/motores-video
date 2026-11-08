"""Limpeza dos arquivos intermediários do projeto, por grupo de risco.

    python ferramentas/limpar.py                      relatório: o que existe, quanto ocupa, o que seria apagado
    python ferramentas/limpar.py --apagar             apaga o grupo "seguro" e corta o cache das APIs no limite
    python ferramentas/limpar.py --apagar --incluir build,baixados   também esses grupos
    python ferramentas/limpar.py --auto               o mesmo que --apagar, sem perguntar e com saída curta (para agendar)

Grupos:
  seguro     refazer é grátis e rápido: __pycache__, páginas _*.html das receitas, intermediários _* em saida/,
             prévias (teste*.png, quadro-*.png) com mais de 7 dias
  cache      refazer custa crédito de API: laboratorio/*/saida/cache e receitas/*/voz. Por padrão só sai o que
             passa do limite (--limite-cache, padrão 1 GB), do mais antigo para o mais novo, e nunca o de menos de 7 dias
  baixados   sons baixados (receitas/*/som/bruto): refazer leva minutos e depende do site de origem
  build      app/dist: refazer com npm run build
  finais     vídeos em saida/: NUNCA apagados por aqui; o relatório lista os maiores e mais antigos para você decidir

Arquivos versionados no git nunca são apagados, mesmo que caiam num padrão acima.
Fora do repositório (só relatório, nada é apagado): modelos do Hugging Face, Chrome do Playwright, cache do pip.
"""
from __future__ import annotations

import argparse
import os
import shutil
import subprocess
import sys
import time
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[1]
DIA = 86400
sys.stdout.reconfigure(encoding="utf-8")


def tam(p: Path) -> int:
    if p.is_file():
        return p.stat().st_size
    return sum(f.stat().st_size for f in p.rglob("*") if f.is_file())


def idade_dias(p: Path) -> float:
    m = p.stat().st_mtime if p.is_file() else max([f.stat().st_mtime for f in p.rglob("*") if f.is_file()] or [p.stat().st_mtime])
    return (time.time() - m) / DIA


def mb(n: int) -> str:
    return f"{n / 1048576:8.1f} MB" if n < 1 << 30 else f"{n / (1 << 30):8.2f} GB"


def rastreados() -> set[Path]:
    """Arquivos que o git versiona: nunca são apagados por aqui, mesmo que pareçam intermediários."""
    r = subprocess.run(["git", "ls-files", "-z"], cwd=RAIZ, capture_output=True)
    return {(RAIZ / f).resolve() for f in r.stdout.decode("utf-8", "replace").split("\0") if f} if r.returncode == 0 else set()


GIT: set[Path] = set()


def protegido(p: Path) -> bool:
    p = p.resolve()
    return p in GIT if p.is_file() else any(f.is_relative_to(p) for f in GIT)


def achar(padroes: list[str], idade_min: float = 0) -> list[Path]:
    vistos, saida = set(), []
    for pad in padroes:
        for p in RAIZ.glob(pad):
            if "node_modules" in p.parts or p in vistos or protegido(p):
                continue
            vistos.add(p)
            if idade_dias(p) >= idade_min:
                saida.append(p)
    return saida


def grupos(limite_cache: int) -> dict[str, list[Path]]:
    g = {
        "seguro": achar(["**/__pycache__", "receitas/*/_*.html", "exemplos/*/_*.html", "saida/**/_*", "saida/**/*.partes", "**/*.f32"])
                  + achar(["saida/**/teste*.png", "saida/**/quadro-*.png"], idade_min=7),
        "baixados": achar(["receitas/*/som/bruto"]),
        "build": achar(["app/dist"]),
    }
    # cache das APIs: só o excedente ao limite, do mais antigo para o mais novo, poupando a última semana
    itens = sorted((f for f in achar(["laboratorio/*/saida/cache/*", "receitas/*/voz/*"]) if f.is_file()), key=lambda f: f.stat().st_mtime)
    total, sai = sum(f.stat().st_size for f in itens), []
    for f in itens:
        if total <= limite_cache:
            break
        if idade_dias(f) < 7:
            continue
        sai.append(f)
        total -= f.stat().st_size
    g["cache"] = sai
    g["_cache_total"] = itens
    return g


def externos() -> list[tuple[str, Path]]:
    casa = Path.home()
    loc = Path(os.environ.get("LOCALAPPDATA", casa / "AppData/Local"))
    return [("modelos do Hugging Face (Whisper, EmbeddingGemma)", casa / ".cache/huggingface/hub"),
            ("Chrome do Playwright", loc / "ms-playwright"),
            ("cache do pip", loc / "pip/cache")]


def apagar(p: Path) -> None:
    if p.is_dir():
        shutil.rmtree(p, ignore_errors=True)
    else:
        p.unlink(missing_ok=True)


def rel(p: Path) -> str:
    return str(p.relative_to(RAIZ)).replace("\\", "/")


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--apagar", action="store_true", help="apaga o grupo seguro e o excedente do cache")
    ap.add_argument("--auto", action="store_true", help="como --apagar, com saída curta (para tarefa agendada)")
    ap.add_argument("--incluir", default="", help="grupos extras a apagar: baixados, build")
    ap.add_argument("--limite-cache", type=float, default=1.0, help="tamanho máximo do cache das APIs, em GB (padrão 1)")
    a = ap.parse_args()
    GIT.update(rastreados())
    G = grupos(int(a.limite_cache * (1 << 30)))
    alvo = ["seguro", "cache"] + [x.strip() for x in a.incluir.split(",") if x.strip() in ("baixados", "build")]
    executar = a.apagar or a.auto

    if a.auto:
        livre = 0
        for k in alvo:
            for p in G[k]:
                livre += tam(p)
                apagar(p)
        print(f"limpar --auto: {mb(livre).strip()} liberados ({', '.join(alvo)})")
        sys.exit(0)

    print(f"Projeto: {RAIZ}\n")
    for k, titulo in [("seguro", "SEGURO (refazer é grátis)"), ("cache", "CACHE DAS APIs (excedente ao limite)"),
                      ("baixados", "BAIXADOS (sons de origem)"), ("build", "BUILD (app/dist)")]:
        itens = G[k]
        soma = sum(tam(p) for p in itens)
        marca = "→ será apagado" if executar and k in alvo else ("→ apagado com --apagar" if k in ("seguro", "cache") else f"→ só com --incluir {k}")
        print(f"{titulo}: {len(itens)} itens, {mb(soma).strip()}  {marca}")
        for p in sorted(itens, key=tam, reverse=True)[:6]:
            print(f"   {mb(tam(p))}  {rel(p)}")
    ct = G["_cache_total"]
    print(f"\n   (cache das APIs no total: {len(ct)} arquivos, {mb(sum(f.stat().st_size for f in ct)).strip()}; limite {a.limite_cache:g} GB)")

    finais = sorted(RAIZ.glob("saida/**/*.mp4"), key=lambda f: f.stat().st_size, reverse=True)
    print(f"\nFINAIS em saida/ (nunca apagados por aqui): {len(finais)} vídeos, {mb(sum(f.stat().st_size for f in finais)).strip()}")
    for f in finais[:8]:
        print(f"   {mb(f.stat().st_size)}  {idade_dias(f):5.0f} dias  {rel(f)}")

    print("\nFORA DO REPOSITÓRIO (só relatório):")
    for nome, p in externos():
        if p.exists():
            print(f"   {mb(tam(p))}  {nome}  ({p})")
            if p.name == "hub":
                for m in sorted(p.glob("models--*"), key=tam, reverse=True):
                    print(f"      {mb(tam(m))}  {m.name.replace('models--', '').replace('--', '/')}")
    livre = shutil.disk_usage(RAIZ).free
    print(f"\nDisco livre: {mb(livre).strip()}")

    if executar:
        liberado = 0
        for k in alvo:
            for p in G[k]:
                liberado += tam(p)
                apagar(p)
        print(f"Apagado: {mb(liberado).strip()} ({', '.join(alvo)})")
    else:
        print("Nada foi apagado. Use --apagar para limpar o grupo seguro e o excedente do cache.")
