"""Exemplo de ponta a ponta: roteiro.json -> voz -> cena HTML -> render -> legenda -> mixagem -> MP4 final.

uso: python exemplos/explicativo/gerar.py                        # edge-tts, saída em saida/explicativo/
     python exemplos/explicativo/gerar.py --provedor kokoro --voz pf_dora
     python exemplos/explicativo/gerar.py --help

Usa os três motores do repositório:
  1. motores/voz       texto das cenas -> voz.wav + tempo de cada palavra (cada palavra sabe a sua cena)
  2. motores/render    cena.html (as cenas entram na palavra-gatilho) -> cenas.mp4, sem áudio
  3. motores/legenda   palavras -> legenda.ass (queimada com libass) + .srt/.vtt
e o ffmpeg para a mixagem: trilha sintetizada (sem direitos de terceiros) com ducking sob a voz e loudnorm.
Render e mixagem rodam em paralelo. No fim, mede o loudness do arquivo final e grava relatorio.json.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import shutil
import subprocess
import sys
import threading
import time
import unicodedata
from pathlib import Path

AQUI = Path(__file__).resolve().parent
RAIZ = AQUI.parents[1]
sys.path.insert(0, str(RAIZ))

from motores.legenda.gerar import Config, gerar as gerar_legenda  # noqa: E402
from motores.legenda.queimar import folha_de_contato, queimar  # noqa: E402

for s in (sys.stdout, sys.stderr):
    s.reconfigure(encoding="utf-8")


def chave(s: str) -> str:
    """'Moléculas,' -> 'moleculas' (para achar a palavra-gatilho)"""
    s = unicodedata.normalize("NFD", s.lower())
    return re.sub(r"[^a-z0-9]", "", "".join(c for c in s if not unicodedata.combining(c)))


def seg(t0: float) -> float:
    return round(time.perf_counter() - t0, 1)


# ---------------------------------------------------------------- 1. voz
def narrar(roteiro: dict, pasta: Path, provedor: str, voz: str | None, velocidade: float, refazer: bool) -> dict:
    """Uma tomada contínua com o texto de todas as cenas. Reaproveita voz.json se nada mudou (o edge é rede)."""
    texto = " ".join(c["fala"].strip() for c in roteiro["cenas"])
    impressao = hashlib.sha256(json.dumps([texto, provedor, voz, velocidade]).encode()).hexdigest()[:16]
    arq = pasta / "voz.json"
    if not refazer and arq.exists():
        r = json.loads(arq.read_text(encoding="utf-8"))
        if r.get("impressao") == impressao and Path(r["wav"]).exists():
            r["reaproveitada"] = True
            return r
    from motores.voz import sintetizar

    r = sintetizar(texto, provedor, voz, pasta / "voz.wav", velocidade=velocidade)
    r["impressao"], r["reaproveitada"] = impressao, False
    arq.write_text(json.dumps(r, ensure_ascii=False, indent=1), encoding="utf-8")
    return r


def marcar_cenas(roteiro: dict, palavras: list[dict]) -> list[dict]:
    """Cada palavra ganha a sua cena (pela ordem: o motor de voz devolve uma palavra por palavra do texto).
    Devolve as cenas com início, fim e o instante de cada palavra-gatilho."""
    ids = [c["id"] for c in roteiro["cenas"] for _ in c["fala"].split()]
    if len(ids) != len(palavras):
        raise RuntimeError(f"o motor de voz devolveu {len(palavras)} palavras e o roteiro tem {len(ids)}")
    for p, i in zip(palavras, ids):
        p["cena"] = i
    cenas = []
    for c in roteiro["cenas"]:
        ps = [p for p in palavras if p["cena"] == c["id"]]
        gat = {}
        for nome, inicio in c.get("gatilhos", {}).items():
            achou = next((p for p in ps if chave(p["texto"]).startswith(chave(inicio))), None)
            if not achou:
                raise RuntimeError(f"cena {c['id']}: gatilho '{inicio}' não está na fala")
            gat[nome] = round(achou["inicio"], 3)
        cenas.append({"id": c["id"], "inicio": round(ps[0]["inicio"], 3), "fim": round(ps[-1]["fim"], 3), "gatilhos": gat})
    return cenas


# ---------------------------------------------------------------- 4. mixagem
def mixar(voz_wav: Path, dur: float, saida: Path, volume: float, ducking: bool, lufs: float) -> dict:
    """voz + acorde grave sintetizado (aevalsrc) com ducking (sidechaincompress) e loudnorm em 2 passagens.
    A trilha é código, não gravação: sem direitos de terceiros. Devolve o que a 1ª passagem mediu."""
    acorde = ("aevalsrc=0.5*sin(2*PI*110*t)*(0.6+0.4*sin(2*PI*0.25*t))+0.35*sin(2*PI*164.8*t)"
              f"+0.3*sin(2*PI*220*t)*(0.5+0.5*sin(2*PI*0.5*t)):s=48000:d={dur:.3f}")
    # apad: sem ele o sidechaincompress termina junto com a voz e corta o fim
    filtro = (f"[1:a]volume={volume},afade=t=in:d=1.5,afade=t=out:st={dur - 2:.2f}:d=2,lowpass=f=900[trilha];"
              f"[0:a]apad=whole_dur={dur:.3f},asplit[voz][sc];")
    filtro += ("[trilha][sc]sidechaincompress=threshold=0.02:ratio=8:attack=20:release=300[fundo];" if ducking
               else "[trilha]anull[fundo];[sc]anullsink;")
    filtro += "[voz][fundo]amix=inputs=2:normalize=0,"
    entrada = ["ffmpeg", "-y", "-hide_banner", "-i", str(voz_wav), "-f", "lavfi", "-i", acorde, "-filter_complex"]
    alvo = f"loudnorm=I={lufs}:TP=-1.5:LRA=11"
    # 1ª passagem: só mede. Em 1 passagem o loudnorm é dinâmico e erra o alvo (medido: −15,6 em vez de −14 no Kokoro)
    r = subprocess.run(entrada + [filtro + alvo + ":print_format=json[a]", "-map", "[a]", "-t", f"{dur:.3f}", "-f", "null", "-"],
                       capture_output=True, text=True, encoding="utf-8", errors="replace")
    if r.returncode:
        raise RuntimeError("mixagem (medição) falhou:\n" + r.stderr[-800:])
    m = json.loads(r.stderr[r.stderr.rindex("{"):r.stderr.rindex("}") + 1])
    # 2ª passagem: ganho linear calculado com o que foi medido
    filtro += (f"{alvo}:measured_I={m['input_i']}:measured_TP={m['input_tp']}:measured_LRA={m['input_lra']}"
               f":measured_thresh={m['input_thresh']}:offset={m['target_offset']}:linear=true,aresample=48000[a]")
    subprocess.run(entrada + [filtro, "-v", "error", "-map", "[a]", "-t", f"{dur:.3f}", "-c:a", "aac", "-b:a", "160k",
                    str(saida)], check=True)
    return m


def loudness(arq: Path) -> dict:
    """loudness medido no arquivo final (ebur128 com pico verdadeiro), não o alvo pedido ao loudnorm"""
    r = subprocess.run(["ffmpeg", "-nostats", "-hide_banner", "-i", str(arq), "-map", "0:a", "-af", "ebur128=peak=true",
                        "-f", "null", "-"], capture_output=True, text=True, encoding="utf-8", errors="replace")
    resumo = r.stderr[r.stderr.rfind("Summary:"):]
    num = lambda rx: float(m[1]) if (m := re.search(rx, resumo)) else None
    return {"integrado_lufs": num(r"I:\s+(-?[\d.]+) LUFS"), "lra_lu": num(r"LRA:\s+(-?[\d.]+) LU"),
            "pico_verdadeiro_dbtp": num(r"Peak:\s+(-?[\d.]+) dBFS")}


# ---------------------------------------------------------------- tudo
def main(argv=None) -> dict:
    ap = argparse.ArgumentParser(description="Exemplo de ponta a ponta dos três motores: roteiro -> MP4 narrado e legendado.")
    ap.add_argument("--roteiro", type=Path, default=AQUI / "roteiro.json", help="roteiro (padrão: o deste exemplo)")
    ap.add_argument("--saida", type=Path, default=RAIZ / "saida" / "explicativo", help="pasta de saída")
    ap.add_argument("-p", "--provedor", help="provedor de voz (padrão: o do roteiro; ex.: edge, kokoro, piper, gravacao)")
    ap.add_argument("-v", "--voz", help="voz do provedor (padrão: a do roteiro, ou a padrão do provedor)")
    ap.add_argument("--velocidade", type=float, help="1.0 = normal (padrão: a do roteiro)")
    ap.add_argument("--refazer-voz", action="store_true", help="gera a voz de novo mesmo se nada mudou")
    ap.add_argument("--workers", type=int, help="processos Chrome no render (padrão: pela RAM)")
    ap.add_argument("--sem-trilha", action="store_true", help="só a voz, sem a trilha sintetizada")
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
    dur = round(v["duracao"] + roteiro.get("segurar_fim", 2.5), 3)
    print(f"    {v['duracao']:.1f} s de fala, {len(palavras)} palavras, tempos {v['tempos']}"
          f"{' (reaproveitada)' if v['reaproveitada'] else f', {tempos['voz_s']} s'}")
    (pasta / "palavras.json").write_text(json.dumps({"duracao": v["duracao"], "palavras": palavras, "cenas": cenas},
                                                    ensure_ascii=False, indent=1), encoding="utf-8")

    # 2. pasta da cena: cena.html + dados.json (o render serve só a pasta da cena)
    obra = pasta / "cena"
    obra.mkdir(exist_ok=True)
    shutil.copy(AQUI / "cena.html", obra / "cena.html")
    (obra / "dados.json").write_text(json.dumps({
        "titulo": roteiro["titulo"], "duracao": dur, "fala_s": v["duracao"], "cenas": cenas,
        "rotulo": v["rotulo"], "fonte": roteiro.get("fonte", "")}, ensure_ascii=False, indent=1), encoding="utf-8")

    # 2 e 4 em paralelo: render (Chrome) e mixagem (ffmpeg) não dependem um do outro
    print("2/5 render das cenas e 4/5 mixagem, em paralelo ...", flush=True)
    mix = pasta / "mix.m4a"
    erro_mix = []

    def fazer_mix():
        tm = time.perf_counter()
        try:
            tr = roteiro.get("trilha", {})
            mixar(Path(v["wav"]), dur, mix, 0 if a.sem_trilha else tr.get("volume", 0.06),
                  tr.get("ducking", True) and not a.sem_trilha, roteiro.get("lufs", -14))
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

    # 3. legenda
    t = time.perf_counter()
    print("3/5 legenda ...", flush=True)
    leg = gerar_legenda(palavras, pasta / "legenda.ass", Config())
    tempos["legenda_s"] = seg(t)
    q = leg["qc"]
    print(f"    {q['blocos']} blocos · {q['orfaos']} órfãos · {q['quebras_ruins']} quebras ruins · "
          f"{q['fora_da_zona']} fora da zona · .srt com {q['lse']['cues']} cues")

    # 5. queimar a legenda e juntar o áudio
    t = time.perf_counter()
    print("5/5 legenda queimada + áudio ...", flush=True)
    legendado = pasta / "legendado.mp4"
    queimar(pasta / "cenas.mp4", pasta / "legenda.ass", legendado, estrito=True, log=lambda m: print("    " + m))
    final = pasta / "explicativo.mp4"
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", str(legendado), "-i", str(mix), "-map", "0:v", "-map", "1:a",
                    "-c", "copy", "-shortest", "-movflags", "+faststart", str(final)], check=True)
    legendado.unlink()
    tempos["queimar_e_juntar_s"] = seg(t)

    # conferências: loudness medido e folha de contato (um quadro por cena, logo depois do gatilho)
    loud = loudness(final)
    instantes = [round(min(max(c["gatilhos"].values(), default=c["inicio"]) + 0.6, c["fim"] + 0.2), 2) for c in cenas]
    instantes.append(round(dur - 0.3, 2))
    folha = folha_de_contato(pasta / "cenas.mp4", pasta / "legenda.ass", instantes, pasta / "explicativo-teste.png",
                             zonas=a.zonas, escala=0.25)
    tempos["total_s"] = seg(t0)

    rel = {"titulo": roteiro["titulo"], "final": str(final), "duracao_s": dur,
           "voz": {k: v.get(k) for k in ("provedor", "voz", "tempos", "duracao", "rotulo", "reaproveitada")},
           "cenas": cenas, "render": {k: render[k] for k in ("quadros", "fotos", "workers", "tempos", "chrome", "maquina")},
           "legenda": {"qc": {k: q[k] for k in ("blocos", "orfaos", "curtos", "quebras_ruins", "fora_da_zona", "lse")}},
           "loudness": {**loud, "alvo_lufs": roteiro.get("lufs", -14)}, "tempos": tempos, "folha": str(folha)}
    (pasta / "relatorio.json").write_text(json.dumps(rel, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"\nvídeo: {final}\nlegendas: legenda.srt, legenda.vtt · folha de contato: {folha.name}")
    print(f"loudness: {loud['integrado_lufs']} LUFS, pico {loud['pico_verdadeiro_dbtp']} dBTP · total {tempos['total_s']} s")
    print(f"rótulo para a descrição do vídeo: {v['rotulo']}")
    return rel


if __name__ == "__main__":
    main()
