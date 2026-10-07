"""Corte por respiração: fronteiras de frase a partir das palavras com tempo (pontuação + pausa).

Frase termina em . ! ? ou numa pausa longa seguida de maiúscula (o Whisper às vezes esquece o ponto,
mas põe maiúscula na frase nova). Frase longa demais (há falas com períodos de 30 s sem ponto) é
dividida nos respiros: pausas internas de pelo menos RESPIRO s. O corte cai sempre entre palavras.
"""
from __future__ import annotations

import re

FIM = re.compile(r'[.!?…]["”»]?$')
PAUSA_FRASE, RESPIRO = 1.0, 0.5


def frases(palavras: list[dict]) -> list[tuple[int, int]]:
    """lista de (i, j): índices da 1ª e da última palavra de cada frase"""
    out, i = [], 0
    for k, p in enumerate(palavras):
        prox = palavras[k + 1] if k + 1 < len(palavras) else None
        pausa = (prox is not None and prox["inicio"] - p["fim"] >= PAUSA_FRASE
                 and not p["texto"].endswith((",", ";", ":")) and prox["texto"][:1].isupper())
        if FIM.search(p["texto"]) or prox is None or pausa:
            out.append((i, k))
            i = k + 1
    return out


def dividir(palavras, i, j, max_s):
    """parte [i, j] na maior pausa até cada pedaço caber em max_s (um período de 47 s sem nenhuma pausa
    de 0,5 s virava um candidato de 47 s)"""
    if j == i or palavras[j]["fim"] - palavras[i]["inicio"] <= max_s:
        return [(i, j)]
    k = max(range(i, j), key=lambda k: palavras[k + 1]["inicio"] - palavras[k]["fim"])
    return dividir(palavras, i, k, max_s) + dividir(palavras, k + 1, j, max_s)


def unidades(palavras, max_s):
    """frases, e as longas demais divididas nos respiros: (i, j, começa_em_frase, termina_em_frase)"""
    out = []
    for i, j in frases(palavras):
        if palavras[j]["fim"] - palavras[i]["inicio"] <= max_s:
            out.append((i, j, True, True))
            continue
        cortes = [k for k in range(i, j) if palavras[k + 1]["inicio"] - palavras[k]["fim"] >= RESPIRO]
        a = i
        for k in cortes + [j]:
            for x, y in dividir(palavras, a, k, max_s):
                out.append((x, y, x == i, y == j))
            a = k + 1
    return out


def pausas(palavras, i, j):
    antes = palavras[i]["inicio"] - palavras[i - 1]["fim"] if i > 0 else 9.9
    depois = palavras[j + 1]["inicio"] - palavras[j]["fim"] if j + 1 < len(palavras) else 9.9
    return antes, depois


def cortes(palavras, i, j):
    """tempos de corte: metade da pausa antes/depois, no máximo 0,3 s antes e 0,6 s depois
    (assim o corte nunca entra na palavra vizinha)"""
    antes, depois = pausas(palavras, i, j)
    return (round(palavras[i]["inicio"] - min(0.3, antes / 2), 2),
            round(palavras[j]["fim"] + min(0.6, depois / 2), 2))


def ajustar(palavras, ini, fim, folga=3.0, min_s=6.0, max_s=24.0) -> dict:
    """Leva a janela [ini, fim] para fronteiras de frase: começa no início de uma unidade e termina no fim
    de outra. Aceita unidade até `folga` s fora da janela; estica até min_s juntando a vizinha e encurta
    até max_s tirando do fim."""
    us = unidades(palavras, max_s)
    t = lambda a, b: palavras[us[b][1]]["fim"] - palavras[us[a][0]]["inicio"]
    dentro = [n for n, (i, j, _, _) in enumerate(us)
              if palavras[i]["inicio"] >= ini - folga and palavras[j]["fim"] <= fim + folga]
    if not dentro:  # janela no meio de uma unidade longa: fica com a que mais cobre a janela
        cobre = lambda n: min(fim, palavras[us[n][1]]["fim"]) - max(ini, palavras[us[n][0]]["inicio"])
        dentro = [max(range(len(us)), key=cobre)]
    a, b = dentro[0], dentro[-1]
    while b > a and t(a, b) > max_s:
        b -= 1
    while t(a, b) < min_s:
        if b + 1 < len(us) and t(a, b + 1) <= max_s:
            b += 1
        elif a > 0 and t(a - 1, b) <= max_s:
            a -= 1
        else:
            break
    i, j = us[a][0], us[b][1]
    c0, c1 = cortes(palavras, i, j)
    antes, depois = pausas(palavras, i, j)
    return {"i": i, "j": j, "ini": c0, "fim": c1, "unidades": b - a + 1,
            "comeca_em": "frase" if us[a][2] else "respiro", "termina_em": "frase" if us[b][3] else "respiro",
            "pausa_antes": round(antes, 2), "pausa_depois": round(depois, 2),
            "texto": " ".join(p["texto"] for p in palavras[i:j + 1])}
