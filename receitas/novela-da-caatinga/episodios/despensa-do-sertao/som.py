"""Linha do tempo e som do piloto "A Despensa do Sertão".

    python receitas/novela-da-caatinga/episodios/despensa-do-sertao/som.py
    -> linha.json (tempos globais de cada beat e de cada palavra, lidos pela cena.js)
    -> saida/novela-da-caatinga/despensa-do-sertao-som.wav (-14 LUFS, mixador do kit)

A narração é uma tomada só; aqui ela é cortada antes do beat "goma" e a fala da Dona Mandioca entra no meio.
As deixas de som usam as mesmas âncoras que a cena (palavra k do beat X): mexeu numa, confira a outra.
"""
from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

AQUI = Path(__file__).resolve().parent
SERIE = AQUI.parents[1]
RAIZ = SERIE.parents[1]
sys.path.insert(0, str(RAIZ))
sys.stdout.reconfigure(encoding="utf-8")
SAIDA = RAIZ / "saida" / "novela-da-caatinga"

A0 = 0.5          # a narração começa já no gancho
FOLGA_DONA = 0.55  # respiro antes do "Ei!"
FOLGA_VOLTA = 0.45
CAUDA = 5.6        # trompete + cartela final


def linha() -> dict:
    N = json.loads((AQUI / "narracao.json").read_text(encoding="utf-8"))
    D = json.loads((AQUI / "dona.json").read_text(encoding="utf-8"))
    corte = N["beats"]["goma"]["ini"] - 0.03
    dona0 = A0 + corte + FOLGA_DONA
    b0 = dona0 + D["duracao"] + FOLGA_VOLTA
    # o lado do corte é decidido pelo início da palavra; o fim vai junto (e não passa do corte no lado A)
    def gw(p):
        if p["inicio"] < corte:
            return [p["texto"], round(A0 + p["inicio"], 3), round(A0 + min(p["fim"], corte), 3)]
        return [p["texto"], round(b0 + p["inicio"] - corte, 3), round(b0 + p["fim"] - corte, 3)]
    g = lambda s: round(A0 + s if s < corte else b0 + (s - corte), 3)  # noqa: E731
    beats = {}
    for k, b in N["beats"].items():
        w = [gw(p) for p in N["palavras"][b["p0"]:b["p0"] + b["n"]]]
        beats[k] = {"ini": w[0][1], "fim": w[-1][2], "w": w}
    dona_w = [[p["texto"], round(dona0 + p["inicio"], 3), round(dona0 + p["fim"], 3)] for p in D["palavras"]]
    beats["dona"] = {"ini": dona_w[0][1], "fim": dona_w[-1][2], "w": dona_w}
    fim_narr = g(N["duracao"])
    L = {"a0": A0, "corte": round(corte, 3), "dona0": round(dona0, 3), "b0": round(b0, 3),
         "fim_narr": fim_narr, "duracao": round(fim_narr + CAUDA, 2), "beats": beats,
         "dona_env": D["env"], "narr_env": N["env"]}
    (AQUI / "linha.json").write_text(json.dumps(L, ensure_ascii=False), encoding="utf-8")
    return L


def W(L, beat, k):
    w = L["beats"][beat]["w"]
    return w[k if k >= 0 else len(w) + k][1]


def deixas(L) -> list[dict]:
    B = L["beats"]
    s = []
    add = lambda i, t, v=0.8, **kw: s.append({"id": i, "t": round(t, 3), "vol": v, **kw})  # noqa: E731
    # 1. terra / arranca / roça
    add("pouso_vazio", W(L, "terra", 0) + 0.05, 0.45)                       # a maniva brota
    add("pouso_cheio", W(L, "arranca", 0) + 0.35, 0.7)                       # o puxão
    add("trompete_comedia", W(L, "arranca", 2), 0.55)                       # "estraga"
    for i in range(5):
        add("pouso_vazio", B["roca"]["ini"] + 0.15 + 0.18 * i, 0.42)        # raízes caindo na mesa
    # 2. rala / massa / manipueira
    add("gota_suor", W(L, "rala", 3), 0.6)                                   # lava
    add("sacolejo_frutas", W(L, "rala", 5), 0.5)                             # rala
    add("gota_suor", B["massa"]["ini"] + 0.6, 0.5); add("gota_suor", B["massa"]["ini"] + 1.2, 0.45)
    add("trompete_grave", W(L, "manipueira", -1), 0.55)
    # 3. tipiti
    add("pouso_vazio", B["tipiti"]["ini"] + 0.1, 0.55)
    add("whoosh_camera", W(L, "espreme", 2) - 0.1, 0.5)                      # puxa
    for i in range(4):
        add("gota_suor", W(L, "espreme", 5) + 0.25 * i, 0.55)               # o caldo escorre
    # 4. Dona Mandioca
    for i in range(3):
        add("passo_pesado", L["dona0"] - 0.45 + 0.17 * i, 0.6)
    add("toc_colher", W(L, "dona", 0) + 0.05, 0.9)
    add("toc_colher", W(L, "dona", -3) + 0.05, 0.85)                         # "perde"
    add("trompete_oi", B["dona"]["fim"] + 0.15, 0.5)
    # 5. goma / tapioca
    add("plim_fruta", W(L, "tapioca", -1), 0.7)
    # 6. forno / mexe / fogo
    add("whoosh_camera", B["forno"]["ini"] - 0.05, 0.6)
    add("pouso_cheio", B["forno"]["ini"] + 0.3, 0.55)
    for k in (2, 3, 4):
        add("sacolejo_frutas", W(L, "mexe", k), 0.45)
    # 7. seca / meses / farinha / parabéns
    add("whoosh_camera", B["seca"]["ini"] - 0.05, 0.5)
    add("pouso_vazio", B["meses"]["ini"] + 0.2, 0.5)
    add("plim_fruta", W(L, "farinha", -1), 0.7)
    add("festa_fole", W(L, "parabens", 0), 0.55)
    add("pouso_cheio", W(L, "parabens", 0) + 0.45, 0.6)
    add("pouso_cheio", W(L, "parabens", 0) + 1.15, 0.5)
    add("trompete_esperanca", L["fim_narr"] + 0.25, 0.75)
    add("vinheta_mangaio", L["fim_narr"] + 2.2, 0.7)
    return s


def main() -> None:
    L = linha()
    nar = AQUI / "narracao.wav"
    a, b = AQUI / "narracao-a.wav", AQUI / "narracao-b.wav"
    c = L["corte"]
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(nar), "-af", f"atrim=0:{c},afade=t=out:st={c - 0.04}:d=0.04", str(a)], check=True)
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(nar), "-af", f"atrim={c},asetpts=PTS-STARTPTS,afade=t=in:d=0.03", str(b)], check=True)
    D = json.loads((AQUI / "dona.json").read_text(encoding="utf-8"))
    plano = {
        "duracao": L["duracao"],
        "cenas": [{
            "id": "casa_de_farinha", "ini": 0, "dur": L["duracao"],
            "ambiencia": {"id": "amb_casa_farinha", "vol": 0.3},
            "falas": [
                {"quem": "narrador", "wav": str(a), "ini": L["a0"], "dur": c},
                {"quem": "dona_mandioca", "wav": str(AQUI / "dona.wav"), "ini": L["dona0"], "dur": D["duracao"]},
                {"quem": "narrador", "wav": str(b), "ini": L["b0"], "dur": L["fim_narr"] - L["b0"]},
            ],
            "sons": deixas(L),
        }],
    }
    (AQUI / "plano-som.json").write_text(json.dumps(plano, ensure_ascii=False, indent=1), encoding="utf-8")
    SAIDA.mkdir(parents=True, exist_ok=True)
    from motores.animacao.som.mixador import mixar_timeline
    out = mixar_timeline(plano, SAIDA / "despensa-do-sertao-som.wav", diretorio_base=AQUI)
    print(out, L["duracao"], "s")


if __name__ == "__main__":
    main()
