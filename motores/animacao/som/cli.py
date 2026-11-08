"""Interface de linha de comando (CLI) do motor de som (`motores.animacao.som.cli`).

Comandos suportados:
- `python -m motores.animacao.som.cli exportar-catalogo --saida saida/kit/sons`
- `python -m motores.animacao.som.cli auditar <arquivo.wav>`
- `python -m motores.animacao.som.cli mixar <plano.json> -o <som.wav>`
"""
from __future__ import annotations

import argparse
import json
import sys
import wave
from pathlib import Path
from typing import Any

import numpy as np

from . import (
    SR,
    _carregar_provedor_padrao,
    auditar_wav,
    ler_wav,
    mixar_timeline,
    salvar_wav,
)


def _carregar_modulo_kit():
    """Garante o carregamento do pacote `kit/sons` e retorna o módulo."""
    _carregar_provedor_padrao()
    return sys.modules["novela_caatinga_kit_sons"]


def cmd_exportar_catalogo(args: argparse.Namespace) -> int:
    """Gera todos os WAVs do catálogo em 48 kHz e valida cada som e emenda de loop."""
    pasta_saida = Path(args.saida)
    pasta_saida.mkdir(parents=True, exist_ok=True)

    mod_kit = _carregar_modulo_kit()
    catalogo = mod_kit.carregar_catalogo()
    itens = catalogo.get("sons", [])

    resultados: list[dict[str, Any]] = []
    falhas: list[str] = []

    print(f"Exportando {len(itens)} sons do catálogo em {SR} Hz para: {pasta_saida}")
    for item in itens:
        id_som = item["id"]
        eh_loop = bool(item.get("loop", False))
        categoria = item.get("categoria", "efeito")

        sinal = mod_kit.obter_som(id_som, dur=None, semente=5)
        caminho_wav = pasta_saida / f"{id_som}.wav"
        salvar_wav(caminho_wav, sinal, sr=SR, estereo=True)

        # Validação do arquivo salvo no disco
        with wave.open(str(caminho_wav), "rb") as w:
            sr_lido = w.getframerate()
            canais_lidos = w.getnchannels()
            n_frames = w.getnframes()
            dur_s = round(n_frames / float(sr_lido), 4)

        x_lido = ler_wav(caminho_wav, sr=SR, mono=True)
        pico_abs = float(np.max(np.abs(x_lido))) if x_lido.size else 0.0
        rms = float(np.sqrt(np.mean(x_lido ** 2))) if x_lido.size else 0.0
        max_salto_interno = (
            float(np.max(np.abs(np.diff(x_lido)))) if len(x_lido) > 1 else 0.0
        )
        salto_emenda = (
            float(abs(x_lido[0] - x_lido[-1])) if len(x_lido) > 1 else 0.0
        )

        # Verifica repetição dupla para loops
        salto_repeticao_2x = salto_emenda
        if eh_loop and len(x_lido) > 4:
            duplo = np.tile(x_lido, 2)
            idx_costura = len(x_lido) - 1
            salto_repeticao_2x = float(abs(duplo[idx_costura + 1] - duplo[idx_costura]))

        erros_item: list[str] = []
        if sr_lido != SR:
            erros_item.append(f"SR={sr_lido} != {SR}")
        if not np.all(np.isfinite(x_lido)):
            erros_item.append("Contém NaN ou Inf")
        if rms < 1e-4:
            erros_item.append(f"Sinal quase mudo (RMS={rms:.6f})")
        if pico_abs > 0.99:
            erros_item.append(f"Pico excessivo ({pico_abs:.4f})")
        if eh_loop and salto_repeticao_2x > 0.02:
            erros_item.append(
                f"Salto na emenda do loop ({salto_repeticao_2x:.5f}) acima de 0.02"
            )

        ok = len(erros_item) == 0
        if not ok:
            falhas.append(f"{id_som}: {', '.join(erros_item)}")

        info = {
            "id": id_som,
            "categoria": categoria,
            "arquivo": str(caminho_wav),
            "sample_rate": sr_lido,
            "canais": canais_lidos,
            "duracao_s": dur_s,
            "loop": eh_loop,
            "pico": round(pico_abs, 4),
            "rms": round(rms, 4),
            "max_salto_amostra": round(max_salto_interno, 5),
            "salto_emenda_loop": round(salto_repeticao_2x, 6),
            "aprovado": ok,
            "erros": erros_item,
        }
        resultados.append(info)
        status_str = "OK" if ok else f"FALHA ({'; '.join(erros_item)})"
        extra_loop = f" | salto_emenda={salto_repeticao_2x:.6f}" if eh_loop else ""
        print(
            f"  [{status_str}] {id_som:<22} ({categoria:<9}) "
            f"dur={dur_s:>5.2f}s | pico={pico_abs:.2f} | max_salto={max_salto_interno:.4f}{extra_loop}"
        )

    # Também testa todos os aliases de compatibilidade
    aliases = {**mod_kit.ALIASES_PRESETS, **mod_kit.ALIASES_TROMPETE}
    for alias, alvo in sorted(aliases.items()):
        buf = mod_kit.obter_som(alias, dur=None, semente=5)
        if buf.size == 0 or not np.all(np.isfinite(buf)):
            falhas.append(f"Alias '{alias}' -> '{alvo}' falhou")

    relatorio = {
        "total_sons": len(resultados),
        "total_aliases_testados": len(aliases),
        "todos_aprovados": len(falhas) == 0,
        "falhas": falhas,
        "sons": resultados,
    }
    arq_rel = pasta_saida / "relatorio_catalogo.json"
    arq_rel.write_text(
        json.dumps(relatorio, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(f"\nRelatório salvo em: {arq_rel}")
    return 0 if len(falhas) == 0 else 1


def cmd_auditar(args: argparse.Namespace) -> int:
    """Audita um arquivo WAV e exibe métricas EBU R128 + continuidade."""
    metricas = auditar_wav(args.arquivo)
    print(json.dumps(metricas, ensure_ascii=False, indent=2))
    return 0 if metricas["aprovado"] else 1


def cmd_mixar(args: argparse.Namespace) -> int:
    """Mixa um plano/roteiro JSON para WAV estéreo 48 kHz (-14 LUFS) e audita."""
    caminho_plano = Path(args.plano)
    if not caminho_plano.is_file():
        print(f"Erro: arquivo de plano não encontrado: {caminho_plano}", file=sys.stderr)
        return 1

    plano = json.loads(caminho_plano.read_text(encoding="utf-8"))
    saida = Path(args.output)
    mixar_timeline(
        plano=plano,
        caminho_saida=saida,
        diretorio_base=caminho_plano.parent,
    )
    metricas = auditar_wav(saida)
    print(json.dumps(metricas, ensure_ascii=False, indent=2))
    return 0 if metricas["aprovado"] else 1


def construir_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="python -m motores.animacao.som.cli",
        description="CLI de síntese, mixagem e auditoria de som (48 kHz / -14 LUFS).",
    )
    sub = parser.add_subparsers(dest="comando", required=True)

    p_exp = sub.add_parser(
        "exportar-catalogo",
        help="Exporta todos os WAVs do catálogo de sons e valida loops e métricas.",
    )
    p_exp.add_argument(
        "--saida",
        "-o",
        default="saida/kit/sons",
        help="Pasta de saída para os arquivos .wav (padrão: saida/kit/sons).",
    )
    p_exp.set_defaults(func=cmd_exportar_catalogo)

    p_aud = sub.add_parser(
        "auditar",
        help="Mede sample_rate, LUFS integrado, True Peak e saltos de amostra de um WAV.",
    )
    p_aud.add_argument("arquivo", help="Caminho do arquivo .wav a auditar.")
    p_aud.set_defaults(func=cmd_auditar)

    p_mix = sub.add_parser(
        "mixar",
        help="Mixa um arquivo de plano/roteiro JSON em um arquivo .wav normalizado.",
    )
    p_mix.add_argument("plano", help="Caminho do arquivo plano.json ou roteiro.json.")
    p_mix.add_argument(
        "-o",
        "--output",
        required=True,
        help="Caminho do arquivo .wav de saída.",
    )
    p_mix.set_defaults(func=cmd_mixar)

    return parser


def main(argv: list[str] | None = None) -> int:
    parser = construir_parser()
    args = parser.parse_args(argv)
    return int(args.func(args))


if __name__ == "__main__":
    raise SystemExit(main())
