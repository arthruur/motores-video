"""Alinhador universal: tempo de cada palavra de um texto conhecido em qualquer áudio.

O texto manda; o Whisper (ou o motor de voz) só empresta os tempos (lição do lab 01).
Serve para motores sem tempos nativos (Kokoro, Piper) e para a gravação da própria voz.

    from motores.voz.alinhar import alinhar
    r = alinhar("voz.wav", "Texto que foi falado.")
    r["palavras"]  # [{"texto": "Texto", "inicio": 0.12, "fim": 0.48}, ...] com a grafia do texto
"""
from __future__ import annotations

import difflib
import time
from pathlib import Path

from .audio import WHISPER_PADRAO, transcrever
from .texto import tokens


def casar(marcas: list[dict], texto: str) -> tuple[list[dict], dict]:
    """Passa os tempos de `marcas` (palavras ouvidas/faladas) para as palavras de `texto`.

    Compara sub-palavras normalizadas ("384" vira "trezentos e oitenta e quatro", "guarda-chuva"
    vira duas), então números, siglas trocadas pela pronúncia e hifens casam.
    - igual: copia o tempo; trocada ("esbravadora" -> "desbravadora"): reparte o intervalo;
    - palavra do texto que ninguém ouviu: herda o fim da anterior (marcada como estimada).
    """
    alvo = texto.split()
    a, dono_a = [], []
    for i, m in enumerate(marcas):
        for t in tokens(m["texto"]):
            a.append(t)
            dono_a.append(i)
    b, subs_de = [], []  # subs_de[j]: índices em b das sub-palavras da palavra j
    for w in alvo:
        subs_de.append([])
        for t in tokens(w):
            subs_de[-1].append(len(b))
            b.append(t)

    tempo: list[tuple[float, float] | None] = [None] * len(b)
    exato = [False] * len(b)
    trechos = 0
    for op, i1, i2, j1, j2 in difflib.SequenceMatcher(None, a, b, autojunk=False).get_opcodes():
        if op == "equal":
            for k in range(j2 - j1):
                m = marcas[dono_a[i1 + k]]
                tempo[j1 + k] = (m["inicio"], m["fim"])
                exato[j1 + k] = True
            continue
        trechos += 1
        if op == "replace":
            ini, fim = marcas[dono_a[i1]]["inicio"], marcas[dono_a[i2 - 1]]["fim"]
            passo = (fim - ini) / (j2 - j1)
            for k in range(j2 - j1):
                tempo[j1 + k] = (ini + k * passo, ini + (k + 1) * passo)

    palavras, tipos = [], {"exatas": 0, "repartidas": 0, "estimadas": 0}
    for j, w in enumerate(alvo):
        subs = subs_de[j]
        ts = [tempo[k] for k in subs if tempo[k]]
        if ts:
            ini, fim = min(t[0] for t in ts), max(t[1] for t in ts)
            tipos["exatas" if all(exato[k] for k in subs) else "repartidas"] += 1
        else:
            ini = palavras[-1]["fim"] if palavras else 0.0
            fim = ini + 0.15
            tipos["estimadas"] += 1
        if palavras and ini < palavras[-1]["inicio"]:  # nunca volta no tempo
            ini = palavras[-1]["inicio"]
        palavras.append({"texto": w, "inicio": round(ini, 3), "fim": round(max(fim, ini), 3)})
    # estimadas não podem invadir a palavra seguinte
    for p, prox in zip(palavras, palavras[1:]):
        p["fim"] = min(p["fim"], max(prox["inicio"], p["inicio"]))
    return palavras, {**tipos, "trechos_corrigidos": trechos}


def alinhar(audio: str | Path, texto: str, modelo: str = WHISPER_PADRAO, dica: bool = False,
            vad: bool = False) -> dict:
    """Áudio + texto conhecido -> {palavras, ouvido, alinhamento, modelo, segundos}.

    `dica=True` passa o texto ao Whisper como prompt inicial (ajuda com nomes raros, mas aí
    o texto ouvido deixa de servir como checagem independente). `vad=True` ignora silêncios
    longos e ruído (gravações com aplauso, por exemplo).
    """
    t0 = time.perf_counter()
    ouvido, marcas = transcrever(Path(audio), modelo, palavras=True, dica=texto if dica else None, vad=vad)
    if not marcas:
        raise RuntimeError(f"o Whisper não ouviu fala em {audio}")
    palavras, stats = casar(marcas, texto)
    return {"palavras": palavras, "ouvido": ouvido, "alinhamento": stats,
            "modelo": f"faster-whisper {modelo} int8 CPU" + (" com dica" if dica else ""),
            "segundos": round(time.perf_counter() - t0, 2)}
