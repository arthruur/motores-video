"""Linha do tempo e som do episódio "O Mapa da Fome".

    python receitas/novela-da-caatinga/episodios/mapa-da-fome/som.py
    -> linha.json (tempo global de cada beat e palavra + os trechos de cada lugar), lido pela cena.js
    -> saida/novela-da-caatinga/mapa-da-fome-som.wav (-14 LUFS, mixador do kit)
As deixas usam as mesmas âncoras que a cena (palavra k do beat X): mexeu numa, confira a outra.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

AQUI = Path(__file__).resolve().parent
SERIE = AQUI.parents[1]
RAIZ = SERIE.parents[1]
sys.path.insert(0, str(RAIZ))
sys.stdout.reconfigure(encoding="utf-8")
SAIDA = RAIZ / "saida" / "novela-da-caatinga"
A0, CAUDA, TROCA = 0.6, 4.8, 0.3   # início da fala, cartela final, corte antes do 1º beat de cada lugar


def linha() -> dict:
    N = json.loads((AQUI / "narracao.json").read_text(encoding="utf-8"))
    R = json.loads((AQUI / "roteiro.json").read_text(encoding="utf-8"))
    beats = {}
    for k, b in N["beats"].items():
        w = [[p["texto"], round(A0 + p["inicio"], 3), round(A0 + p["fim"], 3)] for p in N["palavras"][b["p0"]:b["p0"] + b["n"]]]
        beats[k] = {"ini": w[0][1], "fim": w[-1][2], "w": w}
    fim_narr = round(A0 + N["duracao"], 3)
    dur = round(fim_narr + CAUDA, 2)
    lugares, atual = [], None
    for b in R["beats"]:
        if b["lugar"] != atual:
            t0 = 0.0 if not lugares else round(beats[b["id"]]["ini"] - TROCA, 3)
            if lugares:
                lugares[-1]["fim"] = t0
            lugares.append({"lugar": b["lugar"], "ini": t0, "fim": dur})
            atual = b["lugar"]
    L = {"a0": A0, "fim_narr": fim_narr, "duracao": dur, "beats": beats, "lugares": lugares}
    (AQUI / "linha.json").write_text(json.dumps(L, ensure_ascii=False), encoding="utf-8")
    return L


def W(L, beat, k):
    w = L["beats"][beat]["w"]
    return w[k if k >= 0 else len(w) + k][1]


def deixas(L) -> list[dict]:
    B = L["beats"]
    s = []
    add = lambda i, t, v=0.8, **kw: s.append({"id": i, "t": round(max(0, t), 3), "vol": v, **kw})  # noqa: E731
    add("pouso_cheio", 0.35, 0.55)                                        # o Mangaio chega no mapa
    add("whoosh_camera", W(L, "livro", 3), 0.35); add("whoosh_camera", W(L, "livro", 6), 0.35)
    add("pouso_cheio", W(L, "livro", -1) + 0.15, 0.6)                    # o livro cai
    for i in range(5):
        add("pouso_vazio", W(L, "areas", 5) + 0.35 * i, 0.4)              # cada área pinta
    add("whoosh_camera", B["duas"]["ini"], 0.5)                          # zoom no Nordeste
    for lg in L["lugares"][1:]:
        add("whoosh_camera", lg["ini"], 0.6)                               # troca de lugar
    add("chuva", B["mata"]["ini"] - 0.2, 0.35, dur=4.0)
    add("pouso_cheio", B["mata"]["ini"] + 0.6, 0.5)
    add("porta_madeira", W(L, "cana", 7), 0.4)                            # cercas: "poucos donos"
    add("trompete_comedia", W(L, "roca", 5), 0.5)                         # a cana cresce por cima do feijão
    add("trompete_grave", W(L, "endemica", -1), 0.55)
    add("galo_caatinga", B["sertao"]["ini"] - 0.1, 0.4)
    add("pouso_cheio", B["sertao"]["ini"] + 0.45, 0.6)
    for k in (5, 7, 9):
        add("plim_fruta", W(L, "suficiente", k), 0.55)                    # milho, feijão, leite no cesto
    add("vento_seco", W(L, "epidemica", 5) - 0.3, 0.5, dur=2.4)
    add("chuva", W(L, "epidemica", 11) - 0.1, 0.45, dur=2.4)
    add("whoosh_camera", B["paradoxo"]["ini"] - 0.3, 0.5)
    add("pouso_vazio", W(L, "tese", 7), 0.45); add("pouso_vazio", W(L, "tese", 10), 0.5)
    add("trompete_esperanca", W(L, "hoje", 1), 0.6)
    add("pouso_cheio", W(L, "hoje", 1) + 0.3, 0.5)
    add("trompete_suspensa", L["fim_narr"] + 0.2, 0.7)
    add("vinheta_mangaio", L["fim_narr"] + 2.0, 0.65)
    return s


def main() -> None:
    L = linha()
    N = json.loads((AQUI / "narracao.json").read_text(encoding="utf-8"))
    cenas = [{"id": "trilha", "ini": 0, "dur": L["duracao"],
              "falas": [{"quem": "narrador", "wav": str(AQUI / "narracao.wav"), "ini": A0, "dur": N["duracao"]}],
              "sons": deixas(L)}]
    amb = {"canavial": {"id": "amb_feira", "vol": 0.12}, "sertao": {"id": "amb_feira", "vol": 0.16}}
    for lg in L["lugares"]:
        if lg["lugar"] in amb:
            cenas.append({"id": "amb-" + lg["lugar"], "ini": lg["ini"], "dur": lg["fim"] - lg["ini"], "ambiencia": amb[lg["lugar"]], "falas": []})
    plano = {"duracao": L["duracao"], "cenas": cenas}
    (AQUI / "plano-som.json").write_text(json.dumps(plano, ensure_ascii=False, indent=1), encoding="utf-8")
    SAIDA.mkdir(parents=True, exist_ok=True)
    from motores.animacao.som.mixador import mixar_timeline
    print(mixar_timeline(plano, SAIDA / "mapa-da-fome-som.wav", diretorio_base=AQUI), L["duracao"], "s")
    print({lg["lugar"] + "@" + str(lg["ini"]): lg["fim"] for lg in L["lugares"]})


if __name__ == "__main__":
    main()
