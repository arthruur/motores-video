"""Sintetizador expressivo do trompete com surdina plunger do Cesto (Mangaio)
e vinheta em baião (zabumba + triângulo + sanfona + trompete).

Não altera `receitas/novela-da-caatinga/som/mixar.py`.
Se existir gravação real em `receitas/novela-da-caatinga/som/trompete/<id>.wav`,
carrega-a automaticamente; caso contrário, gera por síntese determinística em 48 kHz.

Licença: Apache-2.0 (síntese determinística própria com semente fixa).
"""
from __future__ import annotations

from pathlib import Path
from typing import Callable

import numpy as np

from motores.animacao.som.sintese import (
    SR,
    criar_rng,
    env,
    fade_anticlique,
    filtro,
    ler_wav,
    norm,
)

AQUI = Path(__file__).resolve().parent
PASTA_SERIE = AQUI.parents[1]
PASTA_GRAVACOES = PASTA_SERIE / "som" / "trompete"


def mnota(midi: float) -> float:
    """Converte nota MIDI para frequência em Hz (A4 = 69 = 440 Hz)."""
    return float(440.0 * (2.0 ** ((midi - 69.0) / 12.0)))


def wah_wah(u: np.ndarray) -> np.ndarray:
    """Curva de abertura/fechamento da surdina plunger ('uá-uá')."""
    return (0.5 - 0.5 * np.cos(2.0 * np.pi * 2.0 * u)).astype(np.float32)


def sopro_trompete(
    notas: list[tuple[float, float, float]],
    wah: Callable[[np.ndarray], np.ndarray] | None = None,
    vib: float = 5.5,
    semente: int = 5,
    sr: int = SR,
) -> np.ndarray:
    """Sintetiza frase de trompete com harmônicos dinâmicos, vibrato e surdina plunger.

    Args:
        notas: Lista de tuplas `(midi, duracao_s, glide_final_semitons)`.
        wah: Função opcional `wah(u)` em `[0, 1]` que modula a abertura da surdina.
        vib: Frequência do vibrato expressivo em Hz.
        semente: Semente fixa para o sopro de ar.
        sr: Taxa de amostragem (48000 Hz).
    """
    rng = criar_rng(semente)
    partes: list[np.ndarray] = []

    for m, d, glide in notas:
        n = max(16, int(round(d * sr)))
        t = np.arange(n, dtype=np.float32) / sr
        u = t / max(d, 1e-4)

        # Portamento/glide expressivo no terço final da nota
        curva_glide = np.clip((u - 0.58) / 0.42, 0.0, 1.0)
        f0 = mnota(m) * (2.0 ** (glide * curva_glide / 12.0))
        # Vibrato progressivo que entra após o ataque
        f0 = f0 * (
            1.0 + 0.0065 * np.sin(2.0 * np.pi * vib * t) * np.clip(t / 0.14, 0.0, 1.0)
        )
        fase = 2.0 * np.pi * np.cumsum(f0) / sr

        # Abertura de brilho do metal com o ataque do sopro
        brilho = np.clip(t / 0.038, 0.0, 1.0) * (0.76 + 0.24 * np.exp(-t / 0.13))
        if wah is not None:
            brilho = brilho * (0.24 + 0.76 * wah(u))

        y = np.zeros(n, dtype=np.float32)
        for k in range(1, 15):
            peso_k = (1.0 / (k ** 1.08)) * (brilho ** ((k - 1) / 2.15))
            y += (peso_k * np.sin(k * fase)).astype(np.float32)

        # Ressonância formântica de campana/surdina (~950 Hz e ~2100 Hz)
        campana = 0.22 * filtro(y, "bandpass", [700.0, 2400.0], sr=sr)
        ar = 0.018 * rng.normal(0.0, 1.0, n).astype(np.float32) * brilho
        nota_sinal = (y + campana + ar) * env(n, ataque=0.012, retorno=0.042, sr=sr)
        partes.append(nota_sinal.astype(np.float32))

    frase = np.concatenate(partes) if partes else np.zeros(int(0.5 * sr), dtype=np.float32)
    filtrado = filtro(frase, "lowpass", 5200.0, sr=sr)
    return fade_anticlique(norm(filtrado, pico=0.82), fade_s=0.006, sr=sr)


def trompete_grave(semente: int = 101) -> np.ndarray:
    """Nota grave longa e encorpada (perigo, susto no açude)."""
    return sopro_trompete([(50, 1.30, -1.5)], vib=4.8, semente=semente)


def trompete_oi(semente: int = 102) -> np.ndarray:
    """Três notas curtas alegres de saudação."""
    return sopro_trompete(
        [(55, 0.16, 0.0), (59, 0.16, 0.0), (62, 0.42, 0.6)],
        vib=5.8,
        semente=semente,
    )


def trompete_comedia(semente: int = 103) -> np.ndarray:
    """Escala descendente rápida + wah cômico final."""
    escala = [(float(m), 0.075, 0.0) for m in (74, 72, 71, 69, 67, 65, 64, 62)]
    final = [(50.0, 0.70, -2.0)]
    return sopro_trompete(
        escala + final,
        wah=lambda u: np.where(u > 0.58, wah_wah((u - 0.58) / 0.42), 1.0).astype(np.float32),
        vib=6.0,
        semente=semente,
    )


def trompete_desconfianca(semente: int = 104) -> np.ndarray:
    """Wah-wah curto de surdina plunger (olhar desconfiado)."""
    return sopro_trompete(
        [(57, 0.32, 0.0), (56, 0.50, -1.0)],
        wah=wah_wah,
        vib=5.2,
        semente=semente,
    )


def trompete_nao_vai(semente: int = 105) -> np.ndarray:
    """Duas notas descendentes expressivas ('não vai / não faz isso')."""
    return sopro_trompete(
        [(64, 0.30, 0.0), (60, 0.55, -0.4)],
        vib=5.0,
        semente=semente,
    )


def trompete_suspensa(semente: int = 106) -> np.ndarray:
    """Frase de gancho que para na 4ª aumentada suspensa sem resolver."""
    return sopro_trompete(
        [(60, 0.20, 0.0), (64, 0.20, 0.0), (66, 1.40, 0.15)],
        vib=5.5,
        semente=semente,
    )


def trompete_esperanca(semente: int = 107) -> np.ndarray:
    """Frase ascendente em xote (esperança, vitória da comunidade)."""
    return sopro_trompete(
        [
            (60, 0.17, 0.0),
            (64, 0.17, 0.0),
            (67, 0.17, 0.0),
            (69, 0.30, 0.0),
            (67, 0.15, 0.0),
            (72, 0.70, 0.2),
        ],
        vib=5.6,
        semente=semente,
    )


def _sintetizar_base_baiao(dur_s: float = 2.8, semente: int = 108, sr: int = SR) -> np.ndarray:
    """Sintetiza levada de baião nordestino: zabumba (bumbo + bacalhau), triângulo e sanfona."""
    rng = criar_rng(semente)
    n = int(round(dur_s * sr))
    t = np.arange(n, dtype=np.float32) / sr
    y = np.zeros(n, dtype=np.float32)

    # Andamento ~108 BPM (compasso 2/4: semínima = 0.555s, colcheia Pontuada = 0.416s)
    passo_compasso = 0.72  # ciclo curto energético de baião

    # 1. Zabumba: pele grave (tum-tum) + vareta de bacalhau no contratempo
    tempos_compasso = np.arange(0.04, dur_s - 0.15, passo_compasso)
    for tc in tempos_compasso:
        for dt_b, f_ini, decaimento, amp in [
            (0.00, 108.0, 0.11, 0.65),          # Primeira batida grave
            (passo_compasso * 0.375, 118.0, 0.13, 0.75),  # Síncopa do baião (3/8)
        ]:
            t0 = tc + dt_b
            if t0 >= dur_s:
                continue
            i0 = int(round(t0 * sr))
            nb = min(int(0.28 * sr), n - i0)
            if nb <= 8:
                continue
            tb = np.arange(nb, dtype=np.float32) / sr
            freq_z = 54.0 + (f_ini - 54.0) * np.exp(-tb / 0.022)
            fase_z = 2.0 * np.pi * np.cumsum(freq_z) / sr
            corpo = np.sin(fase_z) * np.exp(-tb / decaimento)
            pele = filtro(rng.normal(0, 1, nb).astype(np.float32), "lowpass", 420.0, sr=sr) * np.exp(-tb / 0.018) * 0.25
            y[i0 : i0 + nb] += (corpo + pele) * amp * env(nb, 0.003, 0.04, sr=sr)

        # Bacalhau (vareta aguda no contratempo)
        t_bac = tc + passo_compasso * 0.75
        if t_bac < dur_s:
            i0 = int(round(t_bac * sr))
            nb = min(int(0.09 * sr), n - i0)
            if nb > 8:
                tb = np.arange(nb, dtype=np.float32) / sr
                estalo = filtro(
                    rng.normal(0, 1, nb).astype(np.float32),
                    "bandpass",
                    [1200.0, 5400.0],
                    sr=sr,
                ) * np.exp(-tb / 0.016)
                y[i0 : i0 + nb] += estalo * 0.32 * env(nb, 0.002, 0.02, sr=sr)

    # 2. Triângulo (semicolcheias com acento aberto na 3ª)
    sub = passo_compasso / 4.0
    k = 0
    t_tri = 0.04
    while t_tri < dur_s - 0.08:
        i0 = int(round(t_tri * sr))
        aberto = (k % 4) == 2
        dur_t = 0.13 if aberto else 0.045
        nt = min(int(dur_t * sr), n - i0)
        if nt > 8:
            tt = np.arange(nt, dtype=np.float32) / sr
            parciais = (
                np.sin(2.0 * np.pi * 3120.0 * tt)
                + 0.65 * np.sin(2.0 * np.pi * 4890.0 * tt)
                + 0.45 * np.sin(2.0 * np.pi * 6740.0 * tt)
                + 0.25 * np.sin(2.0 * np.pi * 8910.0 * tt)
            ).astype(np.float32)
            dec = 0.055 if aberto else 0.014
            amp_t = 0.14 if aberto else 0.075
            y[i0 : i0 + nt] += parciais * np.exp(-tt / dec) * amp_t * env(nt, 0.002, 0.015, sr=sr)
        t_tri += sub
        k += 1

    # 3. Sanfona (acorde quente em Dó mixolídio / Fá / Sol7 acompanhando a chamada)
    acordes = [
        (0.00, 1.35, [60, 64, 67, 70]),  # C7 (mixolídio nordestino)
        (1.35, 2.75, [60, 64, 67, 72]),  # C maior brilhante na resolução
    ]
    sanfona = np.zeros(n, dtype=np.float32)
    for t_ini, t_fim, notas_m in acordes:
        i0 = int(round(t_ini * sr))
        i1 = min(n, int(round(t_fim * sr)))
        na = i1 - i0
        if na <= 16:
            continue
        ta = np.arange(na, dtype=np.float32) / sr
        bloco = np.zeros(na, dtype=np.float32)
        for nm in notas_m:
            f = mnota(nm)
            # Duas palhetas de sanfona levemente desafinadas (musette sertanejo suave)
            for detune in (-0.8, 0.8):
                fd = f + detune
                bloco += (
                    0.50 * np.sin(2.0 * np.pi * fd * ta)
                    + 0.30 * np.sin(2.0 * np.pi * 2.0 * fd * ta)
                    + 0.15 * np.sin(2.0 * np.pi * 3.0 * fd * ta)
                    + 0.07 * np.sin(2.0 * np.pi * 4.0 * fd * ta)
                ).astype(np.float32)
        # Balanço rítmico do fole
        fole = 0.72 + 0.28 * np.sin(2.0 * np.pi * (2.0 / passo_compasso) * ta)
        sanfona[i0:i1] += bloco * fole * env(na, 0.04, 0.18, sr=sr) * 0.045

    sanfona = filtro(sanfona, "lowpass", 3400.0, sr=sr)
    base = (y + sanfona) * env(n, ataque=0.04, retorno=0.45, sr=sr)
    return base.astype(np.float32)


def vinheta_mangaio(dur: float | None = None, semente: int = 108) -> np.ndarray:
    """Chamada de trompete do Mangaio + levada de zabumba, triângulo e sanfona em baião (~2.8 s)."""
    dur_alvo = float(dur) if dur is not None else 2.8
    dur_alvo = max(1.6, dur_alvo)
    n = int(round(dur_alvo * SR))

    tr = trompete_esperanca(semente=semente)
    base = _sintetizar_base_baiao(dur_s=dur_alvo, semente=semente, sr=SR)

    mix = np.zeros(n, dtype=np.float32)
    mix[: len(base)] += base * 0.58

    # Trompete entra com leve anacruse em t = 0.12 s
    i_tr = int(round(0.12 * SR))
    n_tr = min(len(tr), max(0, n - i_tr))
    if n_tr > 0:
        mix[i_tr : i_tr + n_tr] += tr[:n_tr] * 0.78

    mix = mix * env(n, ataque=0.015, retorno=0.18, sr=SR)
    return fade_anticlique(norm(mix, pico=0.85), fade_s=0.006, sr=SR)


FRASES_TROMPETE: dict[str, Callable[..., np.ndarray]] = {
    "trompete_esperanca": trompete_esperanca,
    "trompete_desconfianca": trompete_desconfianca,
    "trompete_nao_vai": trompete_nao_vai,
    "trompete_grave": trompete_grave,
    "trompete_comedia": trompete_comedia,
    "trompete_suspensa": trompete_suspensa,
    "trompete_oi": trompete_oi,
    "vinheta_mangaio": vinheta_mangaio,
}

ALIASES_TROMPETE: dict[str, str] = {
    "vinheta": "vinheta_mangaio",
    "trompete_cesto_grave": "trompete_grave",
    "trompete_cesto_desconfianca": "trompete_desconfianca",
    "trompete_cesto_suspensa": "trompete_suspensa",
    "trompete_cesto_risada": "trompete_comedia",
    "trompete_cesto_esperanca": "trompete_esperanca",
    "trompete_cesto_nao_vai": "trompete_nao_vai",
    "trompete_cesto_oi": "trompete_oi",
}


def sintetizar_trompete(
    id_som: str,
    dur: float | None = None,
    semente: int = 5,
) -> np.ndarray:
    """Retorna frase de trompete (gravada se existir em `som/trompete/<id>.wav` ou sintetizada)."""
    id_canonico = ALIASES_TROMPETE.get(id_som, id_som)

    # Verifica gravação real primeiro
    for nome in (id_som, id_canonico):
        arq = PASTA_GRAVACOES / f"{nome}.wav"
        if arq.is_file():
            sinal = ler_wav(arq, sr=SR, mono=True)
            return fade_anticlique(norm(sinal, pico=0.82), fade_s=0.006, sr=SR)

    if id_canonico not in FRASES_TROMPETE:
        raise KeyError(f"Frase de trompete desconhecida: '{id_som}'")

    fn = FRASES_TROMPETE[id_canonico]
    if id_canonico == "vinheta_mangaio":
        return fn(dur=dur, semente=semente)
    return fn(semente=semente)
