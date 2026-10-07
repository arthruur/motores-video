"""Linha de comando do motor de colagem.

  python -m motores.colagem.cli baixar  exemplos/colagem-democracia/fontes.json
  python -m motores.colagem.cli indexar exemplos/colagem-democracia/fontes.json
  python -m motores.colagem.cli sugerir exemplos/colagem-democracia/fontes.json "o que é democracia"
  python -m motores.colagem.cli montar  exemplos/colagem-democracia/colagem.json
  python -m motores.colagem.cli folha   saida/colagem-democracia/colagem-o-que-e-democracia.mp4
"""
from __future__ import annotations

import argparse
import json
import subprocess
import sys
import time
from pathlib import Path


def _pasta_saida(a, arquivo: str) -> Path:
    """padrão: saida/<nome da pasta do fontes.json ou do colagem.json>"""
    return Path(a.saida) if a.saida else Path("saida") / Path(arquivo).resolve().parent.name


def _fontes(arquivo: str, opcionais: bool = False):
    from .fontes import carregar

    if not Path(arquivo).is_file():
        sys.exit(f"erro: não achei {arquivo}")
    return carregar(arquivo, opcionais)


def cmd_baixar(a) -> None:
    from .fontes import baixar

    t0 = time.perf_counter()
    baixar(_fontes(a.fontes, a.opcionais), Path(a.de) if a.de else None)
    print(f"pronto em {time.perf_counter() - t0:.1f} s")


def cmd_indexar(a) -> None:
    from .indice import indexar

    indexar(_fontes(a.fontes, a.opcionais), _pasta_saida(a, a.fontes) / "indice", whisper=a.whisper)


def cmd_sugerir(a) -> None:
    from .fontes import minutos
    from .montar import slug
    from .sugerir import pagina, sugerir

    fontes = _fontes(a.fontes, a.opcionais)
    pasta = _pasta_saida(a, a.fontes)
    if not (pasta / "indice" / "indice.json").exists():
        sys.exit(f"erro: falta o índice em {pasta / 'indice'}: rode o subcomando indexar")
    r = sugerir(a.tema, fontes, pasta / "indice", n=a.n, lam=a.lam, por_fonte=a.por_fonte)
    base = pasta / f"candidatos-{slug(a.tema)}"
    base.with_suffix(".json").write_text(json.dumps(r, ensure_ascii=False, indent=1), encoding="utf-8")
    base.with_suffix(".html").write_text(pagina(r, fontes, base.with_suffix(".html")), encoding="utf-8")
    for c in r["candidatos"]:
        marca = "" if c["comeca_em"] == c["termina_em"] == "frase" else f" [{c['comeca_em']}→{c['termina_em']}]"
        print(f"{c['pos']}. {c['nota']:.3f} {c['figura']:24s} {minutos(c['ini'])}-{minutos(c['fim'])} "
              f"({c['dur']} s){marca} {c['texto'][:100]}")
    m = r["medidas"]
    print(f"busca {m['busca_s']} s · total {m['total_s']} s (import {m['importar_s']} s, carga do modelo {m['carga_modelo_s']} s) -> {base}.html")


def cmd_montar(a) -> None:
    from .montar import montar

    if not Path(a.colagem).is_file():
        sys.exit(f"erro: não achei {a.colagem}")
    pasta = _pasta_saida(a, a.colagem)
    indice = Path(a.indice) if a.indice else pasta / "indice"
    lo, hi = (float(x) for x in a.faixa.split(","))
    try:
        montar(Path(a.colagem), indice, pasta, alvo=a.lufs, faixa_s=(lo, hi))
    except (ValueError, RuntimeError, FileNotFoundError) as e:
        sys.exit(f"erro: {e}")


def cmd_folha(a) -> None:
    """folha de contato do MP4 pronto, com as zonas da interface 9:16 pintadas (reusa motores/legenda)"""
    from motores.legenda.gerar import Config, gerar_ass
    from motores.legenda.queimar import folha_de_contato

    video = Path(a.video)
    dur = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0",
                                str(video)], capture_output=True, text=True, check=True).stdout)
    ts = [round((k + 0.5) * dur / a.n, 2) for k in range(a.n)]
    vazio = video.with_name(video.stem + "-vazio.ass")
    vazio.write_text(gerar_ass([], Config()), encoding="utf-8")  # o vídeo já tem tudo queimado
    try:
        saida = folha_de_contato(video, vazio, ts, video.with_name(video.stem + "-folha.png"), zonas=True,
                                 escala=a.escala)
    finally:
        vazio.unlink(missing_ok=True)
    print(f"{saida} ({a.n} quadros de {dur:.1f} s)")


def principal(argv: list[str] | None = None) -> None:
    for s in (sys.stdout, sys.stderr):
        s.reconfigure(encoding="utf-8")
    ap = argparse.ArgumentParser(prog="python -m motores.colagem.cli",
                                 formatter_class=argparse.RawDescriptionHelpFormatter,
                                 description="Colagem por sentido: fragmentos de falas reais achados por tema, "
                                             "cortados entre frases e montados em 9:16 com fonte em cada fragmento.",
                                 epilog=__doc__.split("\n", 2)[2])
    sub = ap.add_subparsers(dest="cmd", required=True)
    saida = dict(help="pasta de saída (padrão: saida/<nome da pasta do JSON>)")

    p = sub.add_parser("baixar", help="baixa com yt-dlp só os trechos de fontes.json que faltam")
    p.add_argument("fontes", help="fontes.json")
    p.add_argument("--de", help="pasta com <slug>.mp4 já baixados: copia em vez de baixar")
    p.add_argument("--opcionais", action="store_true", help="inclui as fontes de fontes_opcionais")
    p.set_defaults(f=cmd_baixar)

    p = sub.add_parser("indexar", help="Whisper palavra a palavra + janelas de 15 s + vetores (cache)")
    p.add_argument("fontes", help="fontes.json")
    p.add_argument("--whisper", default="small", help="modelo do faster-whisper (padrão small)")
    p.add_argument("--saida", **saida)
    p.add_argument("--opcionais", action="store_true", help="inclui as fontes de fontes_opcionais")
    p.set_defaults(f=cmd_indexar)

    p = sub.add_parser("sugerir", help="tema -> candidatos diversos cortados entre frases + página HTML")
    p.add_argument("fontes", help="fontes.json")
    p.add_argument("tema", help='o tema, em palavras ("o que é democracia"); frases concretas funcionam melhor')
    p.add_argument("-n", type=int, default=8, help="quantos candidatos (padrão 8)")
    p.add_argument("--lambda", dest="lam", type=float, default=0.7,
                   help="MMR: 1 = só relevância, 0 = só diversidade (padrão 0.7)")
    p.add_argument("--por-fonte", type=int, default=2, help="máximo por fonte (padrão 2)")
    p.add_argument("--saida", **saida)
    p.add_argument("--opcionais", action="store_true", help="inclui as fontes de fontes_opcionais")
    p.set_defaults(f=cmd_sugerir)

    p = sub.add_parser("montar", help="colagem.json -> MP4 9:16 + .srt/.vtt + ficha.json")
    p.add_argument("colagem", help="colagem.json")
    p.add_argument("--indice", help="pasta do índice (padrão: <saida>/indice)")
    p.add_argument("--lufs", type=float, default=-14.0, help="loudness alvo (padrão -14)")
    p.add_argument("--faixa", default="45,75", help="duração esperada em s; fora dela, avisa (padrão 45,75)")
    p.add_argument("--saida", **saida)
    p.set_defaults(f=cmd_montar)

    p = sub.add_parser("folha", help="folha de contato de um MP4 com as zonas da interface pintadas")
    p.add_argument("video")
    p.add_argument("-n", type=int, default=12, help="quadros (padrão 12)")
    p.add_argument("--escala", type=float, default=0.25, help="tamanho de cada quadro (padrão 0.25)")
    p.set_defaults(f=cmd_folha)

    a = ap.parse_args(argv)
    a.f(a)


if __name__ == "__main__":
    principal()
