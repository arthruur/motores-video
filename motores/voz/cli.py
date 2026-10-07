"""Linha de comando do motor de voz.

  python -m motores.voz.cli provedores
  python -m motores.voz.cli sintetizar "A água ferve a cem graus." --provedor edge --saida saida/voz.wav --qa
  python -m motores.voz.cli sintetizar texto.txt --provedor gravacao --arquivo minha-voz.m4a --limpar
  python -m motores.voz.cli alinhar saida/voz.wav texto.txt
  python -m motores.voz.cli qa saida/voz.wav texto.txt
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from .audio import WHISPER_PADRAO


def _texto(arg: str) -> str:
    p = Path(arg)
    if p.suffix.lower() in {".txt", ".md"} or (len(arg) < 260 and p.is_file()):
        if not p.is_file():
            raise SystemExit(f"arquivo de texto não encontrado: {arg}")
        return p.read_text(encoding="utf-8").strip()
    return arg.strip()


def _escrever(caminho: Path, dados: dict) -> None:
    caminho.parent.mkdir(parents=True, exist_ok=True)
    caminho.write_text(json.dumps(dados, ensure_ascii=False, indent=1), encoding="utf-8")


def _mostrar_qa(q: dict) -> None:
    print(f"QA Whisper: {q['precisao']:.1f}% em {q['segundos']:.1f}s"
          + (f" · {'; '.join(q['divergencias'])}" if q["divergencias"] else " · sem divergências"))


def cmd_provedores(a) -> None:
    from .provedores import PROVEDORES, pasta_modelos

    print(f"modelos locais em: {pasta_modelos(a.modelos)}\n")
    for p in PROVEDORES.values():
        falta = p.falta(a.modelos)
        print(f"{p.id:11s} {'ok ' if not falta else '-- '} {p.onde:6s} {p.custo}")
        print(f"{'':15s}tempos por palavra: {'nativos' if p.tempos_nativos else 'pelo alinhador (Whisper)'}"
              f" · licença: {p.licenca}")
        if p.vozes:
            print(f"{'':15s}vozes: {', '.join(p.vozes)}")
        if falta:
            print(f"{'':15s}indisponível: {falta}")


def cmd_sintetizar(a) -> None:
    from .provedores import sintetizar
    from .qa import avaliar, precisao

    texto = _texto(a.texto)
    try:
        r = sintetizar(texto, a.provedor, a.voz, a.saida, pronuncia=False if a.sem_pronuncia else (a.pronuncia or True),
                       alinhar=not a.sem_alinhar, whisper=a.whisper, velocidade=a.velocidade, taxa=a.taxa,
                       modelos=a.modelos, arquivo=a.arquivo, limpar=a.limpar, permitir_pago=a.permitir_pago)
    except (RuntimeError, ValueError) as e:
        raise SystemExit(f"erro: {e}")
    print(f"{r['provedor']}/{r['voz'] or '-'}: {r['duracao']:.1f}s de áudio em {r['gerar_s']:.1f}s -> {r['wav']}")
    al = r.get("alinhamento", {})
    if r["palavras"]:
        print(f"tempos: {r['tempos']} · {len(r['palavras'])} palavras "
              f"({al.get('exatas', 0)} exatas, {al.get('repartidas', 0)} repartidas, {al.get('estimadas', 0)} estimadas)")
    if a.qa:
        if "ouvido" in al:  # o alinhador já ouviu sem dica: reaproveita a transcrição
            pct, difs = precisao(texto, al["ouvido"])
            r["qa"] = {"precisao": round(pct, 1), "divergencias": difs, "ouvido": al["ouvido"],
                       "modelo": al["modelo"], "segundos": 0.0}
        else:
            r["qa"] = avaliar(r["wav"], texto, a.whisper)
        _mostrar_qa(r["qa"])
    saida_json = Path(a.json) if a.json else Path(a.saida).with_suffix(".json")
    _escrever(saida_json, r)
    print(f"palavras: {saida_json}")
    print(f"rótulo: {r['rotulo']}")


def cmd_alinhar(a) -> None:
    from .alinhar import alinhar
    from .audio import duracao

    r = alinhar(a.audio, _texto(a.texto), a.whisper, dica=a.dica, vad=a.vad)
    r["duracao"] = round(duracao(Path(a.audio)), 3)
    st = r["alinhamento"]
    print(f"{len(r['palavras'])} palavras em {r['segundos']:.1f}s · {st['exatas']} exatas, "
          f"{st['repartidas']} repartidas, {st['estimadas']} estimadas · {st['trechos_corrigidos']} trechos corrigidos")
    saida_json = Path(a.json) if a.json else Path(a.audio).with_suffix(".json")
    _escrever(saida_json, r)
    print(f"palavras: {saida_json}")


def cmd_qa(a) -> None:
    from .qa import avaliar

    q = avaliar(a.audio, _texto(a.texto), a.whisper)
    _mostrar_qa(q)
    print(f"ouvido: {q['ouvido']}")
    if a.json:
        _escrever(Path(a.json), q)


def principal(argv: list[str] | None = None) -> None:
    for fluxo in (sys.stdout, sys.stderr):  # terminal do Windows (cp1252) não imprime "→"
        try:
            fluxo.reconfigure(encoding="utf-8")
        except AttributeError:
            pass

    ap = argparse.ArgumentParser(prog="python -m motores.voz.cli",
                                 description="Motor de voz: narração com provedores trocáveis, tempo de cada palavra "
                                             "e nota de precisão pelo Whisper.")
    sub = ap.add_subparsers(dest="comando", required=True, metavar="comando")
    texto_ajuda = "o texto entre aspas, ou o caminho de um arquivo .txt (UTF-8)"
    whisper_ajuda = f"modelo do faster-whisper: tiny, base, small, medium, large-v3 (padrão: {WHISPER_PADRAO})"

    p = sub.add_parser("provedores", help="lista provedores, licenças e o que falta para cada um rodar")
    p.add_argument("--modelos", help="pasta dos modelos locais (padrão: $MOTORES_VOZ_MODELOS ou <repo>/modelos)")
    p.set_defaults(func=cmd_provedores)

    p = sub.add_parser("sintetizar", help="texto -> WAV + palavras com tempo (JSON)",
                       description="Gera a narração e o tempo de cada palavra. Motores sem tempos nativos "
                                   "passam pelo alinhador (faster-whisper + texto).")
    p.add_argument("texto", help=texto_ajuda)
    p.add_argument("--provedor", "-p", default="edge",
                   help="edge, kokoro, piper, azure, elevenlabs ou gravacao (padrão: edge)")
    p.add_argument("--voz", "-v", help="nome da voz (padrão: a do provedor; veja o comando provedores)")
    p.add_argument("--saida", "-o", default="saida/voz.wav", help="WAV de saída (padrão: saida/voz.wav)")
    p.add_argument("--json", help="onde salvar as palavras (padrão: ao lado do WAV, .json)")
    p.add_argument("--velocidade", type=float, default=1.0, help="1.0 = normal; 1.1 = 10%% mais rápido")
    p.add_argument("--taxa", type=int, default=48000, help="taxa do WAV em Hz (padrão: 48000)")
    p.add_argument("--modelos", help="pasta dos modelos do Kokoro/Piper")
    p.add_argument("--pronuncia", help="outro dicionário de pronúncia (padrão: motores/voz/pronuncia.json)")
    p.add_argument("--sem-pronuncia", action="store_true", help="não aplica o dicionário de pronúncia")
    p.add_argument("--sem-alinhar", action="store_true", help="não roda o alinhador nos motores sem tempos nativos")
    p.add_argument("--qa", action="store_true", help="dá a nota de precisão pelo Whisper no fim")
    p.add_argument("--whisper", default=WHISPER_PADRAO, help=whisper_ajuda)
    p.add_argument("--arquivo", help="provedor gravacao: o áudio gravado (WAV, M4A, MP3...)")
    p.add_argument("--limpar", action="store_true", help="provedor gravacao: highpass + redução de ruído (ffmpeg)")
    p.add_argument("--permitir-pago", action="store_true", help="autoriza provedores que podem cobrar (azure, elevenlabs)")
    p.set_defaults(func=cmd_sintetizar)

    p = sub.add_parser("alinhar", help="áudio + texto conhecido -> palavras com tempo (grafia do texto)",
                       description="Alinhador universal: o Whisper ouve palavra a palavra e o texto revisado "
                                   "manda na grafia (difflib).")
    p.add_argument("audio", help="qualquer áudio ou vídeo que o ffmpeg leia")
    p.add_argument("texto", help=texto_ajuda)
    p.add_argument("--json", help="saída (padrão: ao lado do áudio, .json)")
    p.add_argument("--whisper", default=WHISPER_PADRAO, help=whisper_ajuda)
    p.add_argument("--dica", action="store_true", help="passa o texto como prompt ao Whisper (nomes raros)")
    p.add_argument("--vad", action="store_true", help="ignora silêncio longo e ruído (gravações com aplauso)")
    p.set_defaults(func=cmd_alinhar)

    p = sub.add_parser("qa", help="nota de precisão: o que foi dito bate com o texto?",
                       description="Transcreve sem dica e compara com o texto (números por extenso, sem acento).")
    p.add_argument("audio")
    p.add_argument("texto", help=texto_ajuda)
    p.add_argument("--whisper", default=WHISPER_PADRAO, help=whisper_ajuda)
    p.add_argument("--json", help="salva o resultado em JSON")
    p.set_defaults(func=cmd_qa)

    a = ap.parse_args(argv)
    a.func(a)


if __name__ == "__main__":
    principal()
