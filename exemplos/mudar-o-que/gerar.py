"""'Mudar o quê?': vídeo explicativo narrado, com fonte de cada fato na tela, por um comando só.

uso: python exemplos/mudar-o-que/gerar.py                  # edge-tts; saída em saida/mudar-o-que/
     python exemplos/mudar-o-que/gerar.py --qa             # + nota do Whisper (o que foi dito bate com o roteiro?)
     python exemplos/mudar-o-que/gerar.py --zonas          # folha de contato com a zona segura
     python exemplos/mudar-o-que/gerar.py --help

Mesmo encadeamento do exemplo explicativo (e as mesmas funções, importadas dele):
  1. motores/voz       uma tomada contínua -> voz.wav + tempo de cada palavra (cada palavra sabe a sua cena)
  2. motores/render    cena.html + dados.json (cenas e palavras-gatilho) -> cenas.mp4
  3. motores/legenda   palavras -> legenda.ass (sem legenda no cartão final) + .srt/.vtt
  4. mixagem           voz + acorde sintetizado, ducking, loudnorm -14 LUFS em 2 passagens
  5. queimar a legenda e juntar o áudio
Conteúdo de opinião, feito em 06/10/2026, período eleitoral: ver o README (rótulo de IA, fontes, não impulsionar).
"""
from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
import threading
import time
from datetime import date
from pathlib import Path

AQUI = Path(__file__).resolve().parent
RAIZ = AQUI.parents[1]
sys.path.insert(0, str(RAIZ))

from exemplos.explicativo.gerar import loudness, marcar_cenas, mixar, narrar  # noqa: E402
from motores.legenda.gerar import Config, gerar as gerar_legenda  # noqa: E402
from motores.legenda.queimar import folha_de_contato, queimar  # noqa: E402

for s in (sys.stdout, sys.stderr):
    s.reconfigure(encoding="utf-8")


def seg(t0: float) -> float:
    return round(time.perf_counter() - t0, 1)


def anos_desde(inicio: date, ate: date) -> int:
    return ate.year - inicio.year - ((ate.month, ate.day) < (inicio.month, inicio.day))


def dados_da_cena(roteiro: dict, cenas: list[dict], dur: float, rotulo: str) -> dict:
    """O que a cena.html lê: tempos (do motor de voz) + o conteúdo visual do roteiro."""
    por_id = {c["id"]: c for c in roteiro["cenas"]}
    return {"titulo": roteiro["titulo"], "duracao": dur, "cenas": cenas,
            "itens": por_id["lista"]["itens"], "citacao": por_id["fala"]["citacao"], "cartao": por_id["fecho"]["cartao"],
            "anos": anos_desde(date(1988, 10, 5), date.fromisoformat(roteiro["data"])), "rotulo": rotulo}


def main(argv=None) -> dict:
    ap = argparse.ArgumentParser(description="'Mudar o quê?': roteiro -> MP4 narrado, legendado e com as fontes na tela.")
    ap.add_argument("--roteiro", type=Path, default=AQUI / "roteiro.json", help="roteiro (padrão: o deste exemplo)")
    ap.add_argument("--saida", type=Path, default=RAIZ / "saida" / "mudar-o-que", help="pasta de saída")
    ap.add_argument("-p", "--provedor", help="provedor de voz (padrão: o do roteiro; ex.: edge, kokoro, piper, gravacao)")
    ap.add_argument("-v", "--voz", help="voz do provedor (padrão: a do roteiro, ou a padrão do provedor)")
    ap.add_argument("--velocidade", type=float, help="1.0 = normal (padrão: a do roteiro)")
    ap.add_argument("--refazer-voz", action="store_true", help="gera a voz de novo mesmo se nada mudou")
    ap.add_argument("--qa", action="store_true", help="o Whisper ouve a voz sem dica e compara com o roteiro")
    ap.add_argument("--workers", type=int, help="processos Chrome no render (padrão: pela RAM)")
    ap.add_argument("--zonas", action="store_true", help="marca a zona segura na folha de contato")
    a = ap.parse_args(argv)

    t0 = time.perf_counter()
    roteiro = json.loads(a.roteiro.read_text(encoding="utf-8"))
    pasta = a.saida.resolve()
    pasta.mkdir(parents=True, exist_ok=True)
    rv = roteiro.get("voz", {})
    provedor = a.provedor or rv.get("provedor", "edge")
    voz = a.voz or (rv.get("voz") if provedor == rv.get("provedor", "edge") else None)
    velocidade = a.velocidade or rv.get("velocidade", 1.0)
    tempos = {}

    # 1. voz
    t = time.perf_counter()
    print(f"1/5 voz: {provedor} {voz or '(padrão)'} ...", flush=True)
    v = narrar(roteiro, pasta, provedor, voz, velocidade, a.refazer_voz)
    tempos["voz_s"] = seg(t)
    palavras = v["palavras"]
    cenas = marcar_cenas(roteiro, palavras)
    dur = round(v["duracao"] + roteiro.get("segurar_fim", 1.6), 3)
    print(f"    {v['duracao']:.1f} s de fala, {len(palavras)} palavras, tempos {v['tempos']}"
          f"{' (reaproveitada)' if v['reaproveitada'] else f', {tempos['voz_s']} s'}")
    qa = None
    if a.qa:
        from motores.voz.qa import avaliar

        t = time.perf_counter()
        qa = avaliar(v["wav"], v["texto"])
        tempos["qa_s"] = seg(t)
        print(f"    QA Whisper: {qa['precisao']}% · " + ("; ".join(qa["divergencias"]) or "sem divergências"))

    # 2. pasta da cena
    obra = pasta / "cena"
    obra.mkdir(exist_ok=True)
    shutil.copy(AQUI / "cena.html", obra / "cena.html")
    (obra / "dados.json").write_text(json.dumps(dados_da_cena(roteiro, cenas, dur, v["rotulo"]), ensure_ascii=False,
                                                indent=1), encoding="utf-8")

    # 2 e 4 em paralelo: render (Chrome) e mixagem (ffmpeg)
    print("2/5 render das cenas e 4/5 mixagem, em paralelo ...", flush=True)
    mix, erro_mix = pasta / "mix.m4a", []

    def fazer_mix():
        tm = time.perf_counter()
        try:
            tr = roteiro.get("trilha", {})
            mixar(Path(v["wav"]), dur, mix, tr.get("volume", 0.06), tr.get("ducking", True), roteiro.get("lufs", -14))
        except Exception as e:  # noqa: BLE001
            erro_mix.append(e)
        tempos["mixagem_s"] = seg(tm)

    th = threading.Thread(target=fazer_mix)
    th.start()
    t = time.perf_counter()
    cmd = ["node", str(RAIZ / "motores" / "render" / "render.mjs"), str(obra), "--saida", str(pasta / "cenas.mp4"), "--json"]
    if a.workers:
        cmd += ["--workers", str(a.workers)]
    r = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace")
    th.join()
    if r.returncode:
        raise SystemExit("render falhou:\n" + (r.stderr or r.stdout)[-1500:])
    if erro_mix:
        raise SystemExit(f"mixagem falhou: {erro_mix[0]}")
    render = json.loads(r.stdout)
    tempos["render_s"] = seg(t)
    print(f"    render: {render['quadros']} quadros, {render['fotos']} fotos, {render['workers']} workers, "
          f"{render['tempos']['total_s']} s · mixagem: {tempos['mixagem_s']} s")

    # 3. legenda (o cartão final já traz o texto: sem legenda nele)
    t = time.perf_counter()
    sem_legenda = {c["id"] for c in roteiro["cenas"] if c.get("legenda") is False}
    leg = gerar_legenda(palavras, pasta / "legenda.ass", Config(ocultar=sem_legenda))
    tempos["legenda_s"] = seg(t)
    q = leg["qc"]
    print(f"3/5 legenda: {q['blocos']} blocos · {q['orfaos']} órfãos · {q['quebras_ruins']} quebras ruins · "
          f"{q['fora_da_zona']} fora da zona · .srt com {q['lse']['cues']} cues")

    # 5. queimar + juntar
    t = time.perf_counter()
    print("5/5 legenda queimada + áudio ...", flush=True)
    legendado = pasta / "legendado.mp4"
    queimar(pasta / "cenas.mp4", pasta / "legenda.ass", legendado, estrito=True, log=lambda m: print("    " + m))
    final = pasta / "mudar-o-que.mp4"
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", str(legendado), "-i", str(mix), "-map", "0:v", "-map", "1:a",
                    "-c", "copy", "-shortest", "-movflags", "+faststart", str(final)], check=True)
    legendado.unlink()
    tempos["queimar_e_juntar_s"] = seg(t)

    # conferências: loudness medido e folha de contato (um quadro por cena, depois do último gatilho)
    loud = loudness(final)
    instantes = [round(min(max(c["gatilhos"].values(), default=c["inicio"]) + 0.6, c["fim"] + 0.2), 2) for c in cenas]
    instantes.append(round(dur - 0.3, 2))
    folha = folha_de_contato(pasta / "cenas.mp4", pasta / "legenda.ass", instantes, pasta / "mudar-o-que-teste.png",
                             zonas=a.zonas, escala=0.25)
    tempos["total_s"] = seg(t0)

    a_conferir = [f["titulo"] for f in roteiro.get("fontes", []) if f.get("situacao") == "a conferir"]
    rel = {"titulo": roteiro["titulo"], "data": roteiro.get("data"), "final": str(final), "duracao_s": dur,
           "voz": {k: v.get(k) for k in ("provedor", "voz", "tempos", "duracao", "rotulo", "reaproveitada")}, "qa": qa,
           "cenas": cenas, "fontes": roteiro.get("fontes", []), "fontes_a_conferir": a_conferir,
           "render": {k: render[k] for k in ("quadros", "fotos", "workers", "tempos", "chrome", "maquina")},
           "legenda": {"qc": {k: q[k] for k in ("blocos", "orfaos", "curtos", "quebras_ruins", "fora_da_zona", "lse")}},
           "loudness": {**loud, "alvo_lufs": roteiro.get("lufs", -14)}, "tempos": tempos, "folha": str(folha)}
    (pasta / "relatorio.json").write_text(json.dumps(rel, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"\nvídeo: {final}\nlegendas: legenda.srt, legenda.vtt · folha de contato: {folha.name}")
    print(f"loudness: {loud['integrado_lufs']} LUFS, pico {loud['pico_verdadeiro_dbtp']} dBTP · total {tempos['total_s']} s")
    print(f"rótulo para a descrição do vídeo: {v['rotulo']}")
    if a_conferir:
        print("antes de publicar, confira e ponha a URL de: " + "; ".join(a_conferir))
    return rel


if __name__ == "__main__":
    try:
        main()
    except RuntimeError as e:
        raise SystemExit(f"erro: {e}\n(provedores e o que falta para cada um: python -m motores.voz.cli provedores)")
