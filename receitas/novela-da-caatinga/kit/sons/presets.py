"""Presets de síntese sonora determinística da série "Novela da Caatinga" (48 kHz).

Inclui:
- 18 efeitos pontuais obrigatórios da Caatinga e da feira;
- 3 ambiências em loop sem emenda audível (`amb_feira`, `amb_acude_noite`, `amb_casa_farinha`);
- Aliases de compatibilidade com `roteiro.json` e `cap01-inauguracao.json`.

Licença: Apache-2.0 (síntese determinística própria com semente fixa).
"""
from __future__ import annotations

from typing import Callable

import numpy as np

from motores.animacao.som.sintese import (
    SR,
    criar_rng,
    env,
    fade_anticlique,
    filtro,
    norm,
    tornar_loop_sem_emenda,
)
from .trompete import mnota


# ==============================================================================
# 1. EFEITOS PONTUAIS DA CAATINGA (18 presets obrigatórios)
# ==============================================================================


def pouso_cheio(dur: float | None = None, semente: int = 11) -> np.ndarray:
    """Baque encorpado + ranger de palha trançada + frutas se acomodando (0.50 s)."""
    rng = criar_rng(semente)
    d = float(dur) if dur is not None else 0.50
    n = int(round(d * SR))
    t = np.arange(n, dtype=np.float32) / SR

    # 1. Baque grave do fundo do cesto no chão de terra batida
    f_baque = 54.0 + 135.0 * np.exp(-t / 0.032)
    fase_b = 2.0 * np.pi * np.cumsum(f_baque) / SR
    baque = np.sin(fase_b) * np.exp(-t / 0.095) * 0.85

    # 2. Ranger de fibras de palha de licurizeiro sob peso (bursts filtrados)
    ruido_palha = filtro(rng.normal(0, 1, n).astype(np.float32), "bandpass", [950.0, 3400.0])
    mod_palha = (
        np.exp(-((t - 0.045) ** 2) / (2.0 * 0.022 ** 2))
        + 0.65 * np.exp(-((t - 0.125) ** 2) / (2.0 * 0.028 ** 2))
    )
    palha = ruido_palha * mod_palha * 0.45

    # 3. Frutas se acomodando (3 micro-impactos internos ocos)
    frutas = np.zeros(n, dtype=np.float32)
    for t0, freq_f, amp_f in [(0.08, 210.0, 0.32), (0.16, 265.0, 0.25), (0.24, 185.0, 0.18)]:
        dt = np.clip(t - t0, 0.0, None)
        ativo = (t >= t0).astype(np.float32)
        f_inst = freq_f + 65.0 * np.exp(-dt / 0.015)
        frutas += np.sin(2.0 * np.pi * f_inst * dt) * np.exp(-dt / 0.042) * ativo * amp_f

    # 4. Sopro curto de poeira levantando
    poeira = filtro(rng.normal(0, 1, n).astype(np.float32), "lowpass", 750.0) * np.exp(-t / 0.18) * 0.22

    sinal = (baque + palha + frutas + poeira) * env(n, ataque=0.004, retorno=0.045)
    return fade_anticlique(norm(sinal, pico=0.85))


def pouso_vazio(dur: float | None = None, semente: int = 12) -> np.ndarray:
    """Quique oco e leve de cesto de palha vazio (0.38 s)."""
    rng = criar_rng(semente)
    d = float(dur) if dur is not None else 0.38
    n = int(round(d * SR))
    t = np.arange(n, dtype=np.float32) / SR

    # Ressonância oca de cesto leve (dois quiques rápidos)
    cesto = (
        0.75 * np.sin(2.0 * np.pi * (135.0 + 60.0 * np.exp(-t / 0.02)) * t) * np.exp(-t / 0.065)
        + 0.35 * np.sin(2.0 * np.pi * 285.0 * t) * np.exp(-t / 0.045)
    )
    dt2 = np.clip(t - 0.13, 0.0, None)
    q2 = 0.35 * np.sin(2.0 * np.pi * 150.0 * dt2) * np.exp(-dt2 / 0.045) * (t >= 0.13)
    palha = filtro(rng.normal(0, 1, n).astype(np.float32), "bandpass", [320.0, 1850.0]) * np.exp(-t / 0.048) * 0.55

    sinal = (cesto + q2 + palha) * env(n, ataque=0.004, retorno=0.04)
    return fade_anticlique(norm(sinal, pico=0.78))


def passo_pesado(dur: float | None = None, semente: int = 13) -> np.ndarray:
    """Passo firme e grave da Dona Mandioca na terra batida (0.28 s)."""
    rng = criar_rng(semente)
    d = float(dur) if dur is not None else 0.28
    n = int(round(d * SR))
    t = np.arange(n, dtype=np.float32) / SR

    f_impacto = 58.0 + 95.0 * np.exp(-t / 0.022)
    fase = 2.0 * np.pi * np.cumsum(f_impacto) / SR
    sub = np.sin(fase) * np.exp(-t / 0.075) * 0.85
    terra = filtro(rng.normal(0, 1, n).astype(np.float32), "bandpass", [180.0, 1450.0]) * np.exp(-t / 0.055) * 0.50
    cascalho = filtro(rng.normal(0, 1, n).astype(np.float32), "bandpass", [600.0, 2600.0]) * np.exp(-t / 0.028) * 0.16

    sinal = (sub + terra + cascalho) * env(n, ataque=0.005, retorno=0.035)
    return fade_anticlique(norm(sinal, pico=0.82))


def passo_leve(dur: float | None = None, semente: int = 14) -> np.ndarray:
    """Passinho curto e ágil na terra (Licuri, Maxixe, Quiabo) (0.18 s)."""
    rng = criar_rng(semente)
    d = float(dur) if dur is not None else 0.18
    n = int(round(d * SR))
    t = np.arange(n, dtype=np.float32) / SR

    toque = np.sin(2.0 * np.pi * (165.0 + 90.0 * np.exp(-t / 0.012)) * t) * np.exp(-t / 0.032) * 0.55
    areia = filtro(rng.normal(0, 1, n).astype(np.float32), "bandpass", [420.0, 2900.0]) * np.exp(-t / 0.028) * 0.65

    sinal = (toque + areia) * env(n, ataque=0.003, retorno=0.025)
    return fade_anticlique(norm(sinal, pico=0.72))


def plim_fruta(dur: float | None = None, semente: int = 15) -> np.ndarray:
    """Harmônicos cristalinos quentes de fruta caindo no cesto / flor abrindo (0.65 s)."""
    rng = criar_rng(semente)
    d = float(dur) if dur is not None else 0.65
    n = int(round(d * SR))
    t = np.arange(n, dtype=np.float32) / SR
    y = np.zeros(n, dtype=np.float32)

    # Arpejo cristalino quente em Ré maior com 9ª (marimba de vidro / kalimba doce)
    notas_plim = [
        (0.00, mnota(74), 0.22, 0.65),   # D5
        (0.055, mnota(78), 0.24, 0.72),  # F#5
        (0.110, mnota(81), 0.28, 0.80),  # A5
        (0.165, mnota(86), 0.34, 0.90),  # D6
    ]
    for t0, freq, dec, amp in notas_plim:
        dt = np.clip(t - t0, 0.0, None)
        ativo = (t >= t0).astype(np.float32)
        env_nota = (1.0 - np.exp(-dt / 0.004)) * np.exp(-dt / dec) * ativo
        parcial = (
            np.sin(2.0 * np.pi * freq * dt)
            + 0.38 * np.sin(2.0 * np.pi * 2.0 * freq * dt) * np.exp(-dt / (dec * 0.6))
            + 0.14 * np.sin(2.0 * np.pi * 3.0 * freq * dt) * np.exp(-dt / (dec * 0.35))
        )
        y += (parcial * env_nota * amp).astype(np.float32)

    # Cintilância suave
    cintila = filtro(rng.normal(0, 1, n).astype(np.float32), "bandpass", [3200.0, 6500.0]) * np.exp(-t / 0.14) * 0.04
    sinal = (y + cintila) * env(n, ataque=0.005, retorno=0.06)
    return fade_anticlique(norm(sinal, pico=0.80))


def toc_colher(dur: float | None = None, semente: int = 16) -> np.ndarray:
    """Impacto seco e ressonante de colher de pau em madeira (0.22 s)."""
    rng = criar_rng(semente)
    d = float(dur) if dur is not None else 0.22
    n = int(round(d * SR))
    t = np.arange(n, dtype=np.float32) / SR

    # Modos inarmônicos típicos de madeira maciça (umbuzeiro / aroeira)
    modos = (
        1.00 * np.sin(2.0 * np.pi * 385.0 * t) * np.exp(-t / 0.032)
        + 0.72 * np.sin(2.0 * np.pi * 612.0 * t) * np.exp(-t / 0.024)
        + 0.48 * np.sin(2.0 * np.pi * 1140.0 * t) * np.exp(-t / 0.015)
        + 0.25 * np.sin(2.0 * np.pi * 1890.0 * t) * np.exp(-t / 0.009)
    )
    transiente = filtro(rng.normal(0, 1, n).astype(np.float32), "bandpass", [800.0, 4200.0]) * np.exp(-t / 0.007) * 0.55

    sinal = (modos + transiente) * env(n, ataque=0.002, retorno=0.025)
    return fade_anticlique(norm(sinal, pico=0.85))


def sacolejo_frutas(dur: float | None = None, semente: int = 17) -> np.ndarray:
    """Chocalho orgânico de frutas e folhas dentro do cesto (0.60 s)."""
    rng = criar_rng(semente)
    d = float(dur) if dur is not None else 0.60
    n = int(round(d * SR))
    t = np.arange(n, dtype=np.float32) / SR
    y = np.zeros(n, dtype=np.float32)

    # Sequência de pequenos impactos de coquinhos/frutas + farfalhar de folhas
    tempos_chocalho = [0.03, 0.09, 0.15, 0.23, 0.30, 0.38, 0.45]
    for k, t0 in enumerate(tempos_chocalho):
        if t0 >= d:
            break
        dt = np.clip(t - t0, 0.0, None)
        ativo = (t >= t0).astype(np.float32)
        f_fruta = 260.0 + 45.0 * ((k * 3) % 5)
        toque = np.sin(2.0 * np.pi * f_fruta * dt) * np.exp(-dt / 0.024) * ativo * 0.42
        folha = (
            filtro(rng.normal(0, 1, n).astype(np.float32), "bandpass", [1400.0, 4800.0])
            * np.exp(-dt / 0.032)
            * ativo
            * 0.35
        )
        y += (toque + folha).astype(np.float32)

    sinal = y * env(n, ataque=0.006, retorno=0.05)
    return fade_anticlique(norm(sinal, pico=0.78))


def vento_seco(dur: float | None = None, semente: int = 18) -> np.ndarray:
    """Rajada de vento quente modulada na caatinga (dur configurável, padrão 3.0 s)."""
    rng = criar_rng(semente)
    d = float(dur) if dur is not None else 3.0
    n = max(64, int(round(d * SR)))
    t = np.arange(n, dtype=np.float32) / SR

    ruido = rng.normal(0, 1, n).astype(np.float32)
    corpo = filtro(ruido, "bandpass", [160.0, 780.0])
    assobio = filtro(ruido, "bandpass", [820.0, 1950.0]) * (
        0.35 + 0.35 * np.sin(2.0 * np.pi * 0.42 * t + 0.6)
    )
    mod = (
        0.55
        + 0.28 * np.sin(2.0 * np.pi * 0.22 * t)
        + 0.17 * np.sin(2.0 * np.pi * 0.53 * t + 1.1)
    ).astype(np.float32)

    atq = min(0.45, d * 0.2)
    ret = min(0.55, d * 0.25)
    sinal = (0.78 * corpo + 0.22 * assobio) * mod * env(n, ataque=atq, retorno=ret)
    return fade_anticlique(norm(sinal, pico=0.68))


def chuva(dur: float | None = None, semente: int = 19) -> np.ndarray:
    """Chuva grossa caindo no chão de barro com pingos discretos (padrão 3.5 s)."""
    rng = criar_rng(semente)
    d = float(dur) if dur is not None else 3.5
    n = max(64, int(round(d * SR)))
    t = np.arange(n, dtype=np.float32) / SR

    # Cortina contínua de chuva na terra (ruído rosa/marrom filtrado)
    base_ruido = rng.normal(0, 1, n).astype(np.float32)
    barro = filtro(base_ruido, "bandpass", [280.0, 1800.0]) * 0.55
    chiado = filtro(base_ruido, "bandpass", [1800.0, 5200.0]) * 0.28
    cortina = barro + chiado

    # Pingos grossos individuais batendo nas poças e folhas
    pingos = np.zeros(n, dtype=np.float32)
    n_pingos = int(d * 26)
    for _ in range(n_pingos):
        i0 = int(rng.integers(0, max(1, n - int(0.05 * SR))))
        np_len = min(int(0.038 * SR), n - i0)
        if np_len <= 4:
            continue
        tp = np.arange(np_len, dtype=np.float32) / SR
        f0 = float(rng.uniform(680.0, 1950.0))
        f_var = f0 * (1.0 + 0.35 * (tp / 0.038))
        fase_p = 2.0 * np.pi * np.cumsum(f_var) / SR
        amp_p = float(rng.uniform(0.12, 0.32))
        pingos[i0 : i0 + np_len] += np.sin(fase_p) * np.exp(-tp / 0.009) * amp_p * env(np_len, 0.001, 0.008)

    atq = min(0.35, d * 0.15)
    ret = min(0.45, d * 0.18)
    sinal = (cortina + pingos) * env(n, ataque=atq, retorno=ret)
    return fade_anticlique(norm(sinal, pico=0.75))


def trovao_distante(dur: float | None = None, semente: int = 20) -> np.ndarray:
    """Ribombo grave e longo rolando pela serra (2.8 s)."""
    rng = criar_rng(semente)
    d = float(dur) if dur is not None else 2.8
    n = int(round(d * SR))
    t = np.arange(n, dtype=np.float32) / SR

    ruido = rng.normal(0, 1, n).astype(np.float32)
    sub = filtro(ruido, "lowpass", 115.0, ordem=3)
    medio_grave = filtro(ruido, "bandpass", [90.0, 310.0], ordem=2)

    # Ecos rolando entre os morros da serra
    env_rolo = (
        0.95 * np.exp(-((t - 0.32) ** 2) / (2.0 * 0.18 ** 2))
        + 0.75 * np.exp(-((t - 0.85) ** 2) / (2.0 * 0.32 ** 2))
        + 0.50 * np.exp(-((t - 1.55) ** 2) / (2.0 * 0.48 ** 2))
    ) * np.exp(-t / 1.95)

    sinal = (0.72 * sub + 0.38 * medio_grave) * env_rolo * env(n, ataque=0.05, retorno=0.35)
    return fade_anticlique(norm(sinal, pico=0.82))


def galo_caatinga(dur: float | None = None, semente: int = 21) -> np.ndarray:
    """Canto de galo / ave do sertão ao longe com reverberação natural de vale (1.6 s)."""
    rng = criar_rng(semente)
    d = float(dur) if dur is not None else 1.6
    n = int(round(d * SR))
    t = np.arange(n, dtype=np.float32) / SR
    y = np.zeros(n, dtype=np.float32)

    # 4 sílabas do canto ("co-co-ri-cóóó") com contorno de frequência
    silabas = [
        (0.05, 0.13, 620.0, 740.0, 0.55),
        (0.21, 0.13, 680.0, 790.0, 0.65),
        (0.37, 0.16, 760.0, 960.0, 0.80),
        (0.56, 0.72, 880.0, 690.0, 0.90),
    ]
    for t0, ds, f_ini, f_fim, amp in silabas:
        i0 = int(round(t0 * SR))
        ns = min(int(round(ds * SR)), max(0, n - i0))
        if ns <= 16:
            continue
        ts = np.arange(ns, dtype=np.float32) / SR
        u = ts / ds
        # Subida rápida e sustentação com queda no fim da última nota
        curva_f = f_ini + (f_fim - f_ini) * np.clip(u * 1.4, 0.0, 1.0)
        curva_f *= 1.0 + 0.015 * np.sin(2.0 * np.pi * 24.0 * ts)
        fase = 2.0 * np.pi * np.cumsum(curva_f) / SR
        vozeado = (
            0.55 * np.sin(fase)
            + 0.85 * np.sin(2.0 * fase + 0.3)
            + 0.42 * np.sin(3.0 * fase + 0.7)
            + 0.18 * np.sin(4.0 * fase + 1.2)
        ).astype(np.float32)
        y[i0 : i0 + ns] += vozeado * env(ns, ataque=0.018, retorno=0.05) * amp

    y = filtro(y, "bandpass", [480.0, 3200.0])
    # Reverberação natural de vale (dois ecos suaves e filtrados)
    eco1 = np.zeros_like(y)
    eco2 = np.zeros_like(y)
    d1, d2 = int(0.14 * SR), int(0.29 * SR)
    if d1 < n:
        eco1[d1:] = filtro(y[:-d1], "lowpass", 1800.0) * 0.28
    if d2 < n:
        eco2[d2:] = filtro(y[:-d2], "lowpass", 1200.0) * 0.14

    sinal = (y + eco1 + eco2) * env(n, ataque=0.02, retorno=0.15)
    return fade_anticlique(norm(sinal, pico=0.68))


def burburinho_feira(dur: float | None = None, semente: int = 22) -> np.ndarray:
    """Textura coral formântica de feira livre ao fundo (dur configurável, padrão 4.0 s)."""
    rng = criar_rng(semente)
    d = float(dur) if dur is not None else 4.0
    n = max(64, int(round(d * SR)))
    t = np.arange(n, dtype=np.float32) / SR
    y = np.zeros(n, dtype=np.float32)

    # 6 camadas de murmúrio formântico indistinto em diferentes alturas e ritmos
    vozes_cfg = [
        (135.0, 3.8, 520.0, 1480.0),
        (178.0, 4.6, 610.0, 1720.0),
        (215.0, 5.2, 680.0, 1950.0),
        (152.0, 3.3, 480.0, 1360.0),
        (195.0, 4.9, 590.0, 1680.0),
        (122.0, 2.9, 440.0, 1250.0),
    ]
    for k, (f0_m, r_sil, f1_c, f2_c) in enumerate(vozes_cfg):
        fase0 = float(rng.uniform(0.0, 6.28))
        f0 = f0_m * (
            1.0
            + 0.09 * np.sin(2.0 * np.pi * (0.7 + 0.15 * k) * t + fase0)
            + 0.05 * np.sin(2.0 * np.pi * (1.8 + 0.2 * k) * t)
        )
        fase = 2.0 * np.pi * np.cumsum(f0) / SR
        fonte = (
            np.sin(fase)
            + 0.55 * np.sin(2.0 * fase)
            + 0.30 * np.sin(3.0 * fase)
            + 0.15 * np.sin(4.0 * fase)
        ).astype(np.float32)
        v_f1 = filtro(fonte, "bandpass", [f1_c * 0.8, f1_c * 1.25])
        v_f2 = filtro(fonte, "bandpass", [f2_c * 0.85, f2_c * 1.2])
        env_sil = np.clip(
            0.45
            + 0.45 * np.sin(2.0 * np.pi * r_sil * t + fase0 * 1.7)
            + 0.25 * np.sin(2.0 * np.pi * (r_sil * 0.37) * t + k),
            0.0,
            1.0,
        ).astype(np.float32)
        y += (0.7 * v_f1 + 0.3 * v_f2) * env_sil * 0.18

    # Ambiência leve de barraca/passos ao fundo
    ar_feira = filtro(rng.normal(0, 1, n).astype(np.float32), "bandpass", [220.0, 1200.0]) * 0.12
    atq = min(0.35, d * 0.15)
    ret = min(0.45, d * 0.18)
    sinal = (y + ar_feira) * env(n, ataque=atq, retorno=ret)
    return fade_anticlique(norm(sinal, pico=0.62))


def porta_madeira(dur: float | None = None, semente: int = 23) -> np.ndarray:
    """Ranger de dobradiça + batida de porta de madeira (0.65 s)."""
    rng = criar_rng(semente)
    d = float(dur) if dur is not None else 0.65
    n = int(round(d * SR))
    t = np.arange(n, dtype=np.float32) / SR

    # 1. Ranger de dobradiça (0.02 .. 0.38 s): stick-slip modulando frequência
    n_r = min(n, int(0.38 * SR))
    tr = t[:n_r]
    f_ranger = 440.0 + 180.0 * np.sin(2.0 * np.pi * 2.2 * tr) + 35.0 * np.sin(2.0 * np.pi * 19.0 * tr)
    fase_r = 2.0 * np.pi * np.cumsum(f_ranger) / SR
    ranger_sinal = (
        0.65 * np.sin(fase_r)
        + 0.35 * np.sin(2.0 * fase_r + 0.5)
        + 0.18 * np.sin(3.0 * fase_r)
    ).astype(np.float32) * env(n_r, ataque=0.02, retorno=0.05) * 0.42

    y = np.zeros(n, dtype=np.float32)
    y[:n_r] += ranger_sinal

    # 2. Batida seca de madeira no batente em t = 0.40 s
    i_bat = min(n - 16, int(0.40 * SR))
    nb = n - i_bat
    if nb > 16:
        tb = np.arange(nb, dtype=np.float32) / SR
        batida = (
            0.85 * np.sin(2.0 * np.pi * (95.0 + 70.0 * np.exp(-tb / 0.015)) * tb) * np.exp(-tb / 0.055)
            + 0.50 * np.sin(2.0 * np.pi * 310.0 * tb) * np.exp(-tb / 0.028)
            + 0.45 * filtro(rng.normal(0, 1, nb).astype(np.float32), "bandpass", [400.0, 2600.0]) * np.exp(-tb / 0.018)
        ) * env(nb, ataque=0.003, retorno=0.04)
        y[i_bat:] += batida.astype(np.float32)

    sinal = y * env(n, ataque=0.005, retorno=0.04)
    return fade_anticlique(norm(sinal, pico=0.82))


def zumbido_neon(dur: float | None = None, semente: int = 24) -> np.ndarray:
    """Hum elétrico de 60/120 Hz + centelhas com cortes em 0.08..0.16s e 0.24..0.28s (1.2 s)."""
    rng = criar_rng(semente)
    d = float(dur) if dur is not None else 1.2
    n = int(round(d * SR))
    t = np.arange(n, dtype=np.float32) / SR

    # Hum de transformador/reator de néon (60 Hz + harmônicos ímpares e pares suaves)
    zumbido = (
        0.38 * np.sin(2.0 * np.pi * 60.0 * t)
        + 0.48 * np.sin(2.0 * np.pi * 120.0 * t)
        + 0.25 * np.sin(2.0 * np.pi * 240.0 * t + 0.3)
        + 0.14 * np.sin(2.0 * np.pi * 360.0 * t + 0.8)
        + 0.08 * np.sin(2.0 * np.pi * 480.0 * t)
    ).astype(np.float32)

    # Envelope de falha/flicker com cortes exatos em 0.08..0.16s e 0.24..0.28s
    # Suavizado com filtro passa-baixa de 250 Hz para evitar degrau de 1 amostra
    pisca = np.ones(n, dtype=np.float32)
    pisca[(t >= 0.08) & (t <= 0.16)] = 0.04
    pisca[(t >= 0.24) & (t <= 0.28)] = 0.04
    pisca_suave = np.clip(filtro(pisca, "lowpass", 280.0, ordem=2), 0.0, 1.05)

    # Centelhas elétricas nas bordas do flicker (0.08s, 0.16s, 0.24s, 0.28s)
    ruido_agudo = filtro(rng.normal(0, 1, n).astype(np.float32), "bandpass", [1600.0, 5800.0])
    env_centelhas = np.zeros(n, dtype=np.float32)
    for tc, amp_c in [(0.01, 0.55), (0.08, 0.45), (0.16, 0.65), (0.24, 0.42), (0.28, 0.60)]:
        dt = np.clip(t - tc, 0.0, None)
        env_centelhas += np.exp(-dt / 0.012) * (t >= tc) * amp_c

    centelhas = ruido_agudo * env_centelhas * 0.45
    corpo = filtro(zumbido * pisca_suave, "lowpass", 2400.0) * 0.65
    sinal = (corpo + centelhas) * env(n, ataque=0.008, retorno=0.18)
    return fade_anticlique(norm(sinal, pico=0.72))


def whoosh_camera(dur: float | None = None, semente: int = 25) -> np.ndarray:
    """Varredura rápida de vento para transição chicote (0.42 s)."""
    rng = criar_rng(semente)
    d = float(dur) if dur is not None else 0.42
    n = int(round(d * SR))
    t = np.arange(n, dtype=np.float32) / SR
    u = t / max(d, 1e-4)

    ruido = rng.normal(0, 1, n).astype(np.float32)
    grave = filtro(ruido, "bandpass", [140.0, 520.0])
    medio = filtro(ruido, "bandpass", [520.0, 1850.0])
    agudo = filtro(ruido, "bandpass", [1850.0, 4600.0])

    # Abertura espectral no meio do movimento (efeito Doppler do whip pan)
    env_arco = np.sin(np.pi * np.clip(u, 0.0, 1.0)) ** 1.6
    varredura = (
        0.55 * grave * np.sin(np.pi * np.clip(u * 1.1, 0.0, 1.0))
        + 0.75 * medio * env_arco
        + 0.45 * agudo * (env_arco ** 2.2)
    )
    # Sub-impacto sutil de velocidade no centro do chicote
    f_sub = 95.0 + 130.0 * env_arco
    sub = np.sin(2.0 * np.pi * np.cumsum(f_sub) / SR) * env_arco * 0.25

    sinal = (varredura + sub) * env(n, ataque=0.025, retorno=0.045)
    return fade_anticlique(norm(sinal, pico=0.78))


def cartela_continua(dur: float | None = None, semente: int = 26) -> np.ndarray:
    """Acorde suspenso quente + batida suave de zabumba para a cartela 'continua...' (1.4 s)."""
    rng = criar_rng(semente)
    d = float(dur) if dur is not None else 1.4
    n = int(round(d * SR))
    t = np.arange(n, dtype=np.float32) / SR

    # 1. Batida macia de zabumba marcando a entrada do carimbo "continua..."
    f_zab = 56.0 + 85.0 * np.exp(-t / 0.025)
    zabumba = np.sin(2.0 * np.pi * np.cumsum(f_zab) / SR) * np.exp(-t / 0.14) * 0.65
    pele = filtro(rng.normal(0, 1, n).astype(np.float32), "bandpass", [220.0, 1400.0]) * np.exp(-t / 0.022) * 0.25

    # 2. Acorde suspenso de sanfona quente (C7sus4/#11: C4, F#4, G4, Bb4, D5)
    notas_susp = [60, 66, 67, 70, 74]
    acorde = np.zeros(n, dtype=np.float32)
    for m in notas_susp:
        f = mnota(m)
        fv = f * (1.0 + 0.003 * np.sin(2.0 * np.pi * 4.8 * t))
        fase = 2.0 * np.pi * np.cumsum(fv) / SR
        acorde += (
            0.55 * np.sin(fase)
            + 0.28 * np.sin(2.0 * fase)
            + 0.12 * np.sin(3.0 * fase)
        ).astype(np.float32)

    acorde = filtro(acorde, "lowpass", 2900.0) * env(n, ataque=0.045, retorno=0.35) * 0.14
    sinal = (zabumba + pele + acorde) * env(n, ataque=0.006, retorno=0.12)
    return fade_anticlique(norm(sinal, pico=0.80))


def gota_suor(dur: float | None = None, semente: int = 27) -> np.ndarray:
    """Glissando curto de gota pingando (0.30 s)."""
    d = float(dur) if dur is not None else 0.30
    n = int(round(d * SR))
    t = np.arange(n, dtype=np.float32) / SR

    # Glissando descendente na escorregada (0..0.16s) + pingo ascendente de bolha (0.16..0.29s)
    f_escorrega = 920.0 * np.exp(-t / 0.14)
    jan_esc = np.clip(1.0 - np.clip((t - 0.14) / 0.04, 0.0, 1.0), 0.0, 1.0)
    escorrega = (
        np.sin(2.0 * np.pi * np.cumsum(f_escorrega) / SR)
        * np.exp(-t / 0.11)
        * jan_esc
        * 0.55
    )

    dt_p = np.clip(t - 0.15, 0.0, None)
    ativo_p = (t >= 0.15).astype(np.float32)
    f_pingo = (520.0 + 780.0 * (1.0 - np.exp(-dt_p / 0.025))) * ativo_p
    env_p = (1.0 - np.exp(-dt_p / 0.004)) * np.exp(-dt_p / 0.042) * ativo_p
    pingo = np.sin(2.0 * np.pi * np.cumsum(f_pingo) / SR) * env_p * 0.85

    sinal = (escorrega + pingo) * env(n, ataque=0.005, retorno=0.03)
    return fade_anticlique(norm(sinal, pico=0.78))


def festa_fole(dur: float | None = None, semente: int = 28) -> np.ndarray:
    """Acorde festivo de sanfona e triângulo (1.2 s)."""
    rng = criar_rng(semente)
    d = float(dur) if dur is not None else 1.2
    n = int(round(d * SR))
    t = np.arange(n, dtype=np.float32) / SR

    # Acorde aberto alegre de sanfona em Sol maior / Ré maior (D4, F#4, A4, D5, F#5)
    notas = [62, 66, 69, 74, 78]
    fole = np.zeros(n, dtype=np.float32)
    for m in notas:
        f = mnota(m)
        for det in (-0.9, 0.9):
            fd = f + det
            fole += (
                0.52 * np.sin(2.0 * np.pi * fd * t)
                + 0.30 * np.sin(2.0 * np.pi * 2.0 * fd * t)
                + 0.14 * np.sin(2.0 * np.pi * 3.0 * fd * t)
            ).astype(np.float32)
    tremolo_fole = 0.78 + 0.22 * np.sin(2.0 * np.pi * 5.5 * t)
    fole = filtro(fole * tremolo_fole, "lowpass", 3800.0) * 0.085

    # Levada festiva de triângulo
    tri = np.zeros(n, dtype=np.float32)
    for k, t0 in enumerate(np.arange(0.02, d - 0.08, 0.14)):
        i0 = int(round(t0 * SR))
        aberto = (k % 2) == 1
        nt = min(int((0.11 if aberto else 0.045) * SR), n - i0)
        if nt > 8:
            tt = np.arange(nt, dtype=np.float32) / SR
            metal = (
                np.sin(2.0 * np.pi * 3250.0 * tt)
                + 0.65 * np.sin(2.0 * np.pi * 5120.0 * tt)
                + 0.40 * np.sin(2.0 * np.pi * 7180.0 * tt)
            ).astype(np.float32)
            dec = 0.05 if aberto else 0.015
            tri[i0 : i0 + nt] += metal * np.exp(-tt / dec) * (0.16 if aberto else 0.09)

    sinal = (fole + tri) * env(n, ataque=0.015, retorno=0.18)
    return fade_anticlique(norm(sinal, pico=0.82))


# ==============================================================================
# 2. AMBIÊNCIAS EM LOOP SEM EMENDA (ciclo base de 6.0 s)
# ==============================================================================


def amb_feira(dur: float | None = None, semente: int = 31) -> np.ndarray:
    """Loop sem emenda (6.0 s): brisa leve + murmúrio distante de feira + madeira + passarinhos."""
    rng = criar_rng(semente)
    d = float(dur) if dur is not None else 6.0
    n = int(round(d * SR))
    t = np.arange(n, dtype=np.float32) / SR

    # 1. Brisa morna da praça (frequências moduladoras múltiplas exatas do período d)
    ruido_ar = rng.normal(0, 1, n).astype(np.float32)
    brisa = filtro(ruido_ar, "bandpass", [150.0, 680.0]) * (
        0.55 + 0.30 * np.sin(2.0 * np.pi * (1.0 / d) * t) + 0.15 * np.cos(2.0 * np.pi * (2.0 / d) * t)
    ) * 0.28

    # 2. Murmúrio coral distante da feira
    murmurio = np.zeros(n, dtype=np.float32)
    for k, (f0, f_form) in enumerate([(140.0, 550.0), (185.0, 680.0), (162.0, 610.0)]):
        fase = 2.0 * np.pi * np.cumsum(
            f0 * (1.0 + 0.05 * np.sin(2.0 * np.pi * ((k + 2) / d) * t + k))
        ) / SR
        voz = np.sin(fase) + 0.45 * np.sin(2.0 * fase)
        voz_f = filtro(voz.astype(np.float32), "bandpass", [f_form * 0.8, f_form * 1.3])
        mod_v = 0.5 + 0.5 * np.sin(2.0 * np.pi * ((3 + k) / d) * t + k * 1.3)
        murmurio += voz_f * mod_v * 0.12

    # 3. Passarinhos ao longe no umbuzeiro (bem-te-vi / sabiá estilizado suave)
    passaros = np.zeros(n, dtype=np.float32)
    for t_p, f_a, f_b in [(1.1, 2150.0, 2680.0), (1.32, 2450.0, 1980.0), (3.85, 2280.0, 2750.0), (4.10, 2520.0, 2120.0)]:
        if t_p + 0.25 >= d:
            continue
        i0 = int(round(t_p * SR))
        np_len = int(0.18 * SR)
        tp = np.arange(np_len, dtype=np.float32) / SR
        f_inst = f_a + (f_b - f_a) * (tp / 0.18)
        pio = np.sin(2.0 * np.pi * np.cumsum(f_inst) / SR) * env(np_len, 0.02, 0.04) * 0.075
        passaros[i0 : i0 + np_len] += pio.astype(np.float32)

    # 4. Toques discretos de caixote de madeira e palha sendo arrumados
    madeira = np.zeros(n, dtype=np.float32)
    for t_m, freq_m in [(0.75, 340.0), (2.45, 410.0), (4.85, 365.0)]:
        if t_m + 0.12 >= d:
            continue
        i0 = int(round(t_m * SR))
        nm = int(0.08 * SR)
        tm = np.arange(nm, dtype=np.float32) / SR
        toque = np.sin(2.0 * np.pi * freq_m * tm) * np.exp(-tm / 0.018) * env(nm, 0.003, 0.02) * 0.09
        madeira[i0 : i0 + nm] += toque.astype(np.float32)

    bruto = norm(brisa + murmurio + passaros + madeira, pico=0.58)
    return tornar_loop_sem_emenda(bruto, crossfade_s=0.35, sr=SR)


def amb_acude_noite(dur: float | None = None, semente: int = 32) -> np.ndarray:
    """Loop sem emenda (6.0 s): grilos da caatinga + vento noturno calmo + pingo d'água distante."""
    rng = criar_rng(semente)
    d = float(dur) if dur is not None else 6.0
    n = int(round(d * SR))
    t = np.arange(n, dtype=np.float32) / SR

    # 1. Vento noturno calmo na beira do açude
    ruido = rng.normal(0, 1, n).astype(np.float32)
    vento_noite = filtro(ruido, "bandpass", [130.0, 520.0]) * (
        0.55 + 0.30 * np.sin(2.0 * np.pi * (1.0 / d) * t)
    ) * 0.32

    # 2. Coro de grilos da caatinga (pulsos suaves em 3950 Hz e 4280 Hz longe das bordas)
    grilos = np.zeros(n, dtype=np.float32)
    for t_grupo in np.arange(0.55, d - 0.55, 0.68):
        for j in range(3):
            t0 = t_grupo + j * 0.048
            i0 = int(round(t0 * SR))
            ng = min(int(0.032 * SR), n - i0)
            if ng > 8:
                tg = np.arange(ng, dtype=np.float32) / SR
                cricri = (
                    0.7 * np.sin(2.0 * np.pi * 3960.0 * tg)
                    + 0.3 * np.sin(2.0 * np.pi * 4290.0 * tg)
                ) * env(ng, 0.005, 0.012) * 0.085
                grilos[i0 : i0 + ng] += cricri.astype(np.float32)

    # 3. Pingo d'água solitário / rã distante no açude
    agua = np.zeros(n, dtype=np.float32)
    for t_p, f_base in [(1.85, 580.0), (4.35, 520.0)]:
        if t_p + 0.15 >= d:
            continue
        i0 = int(round(t_p * SR))
        np_len = int(0.09 * SR)
        tp = np.arange(np_len, dtype=np.float32) / SR
        f_p = f_base * (1.0 + 0.45 * (tp / 0.09))
        pingo = np.sin(2.0 * np.pi * np.cumsum(f_p) / SR) * np.exp(-tp / 0.025) * env(np_len, 0.003, 0.02) * 0.12
        agua[i0 : i0 + np_len] += pingo.astype(np.float32)

    bruto = norm(vento_noite + grilos + agua, pico=0.55)
    return tornar_loop_sem_emenda(bruto, crossfade_s=0.35, sr=SR)


def amb_casa_farinha(dur: float | None = None, semente: int = 33) -> np.ndarray:
    """Loop sem emenda (6.0 s): crepitar de lenha no forno + roda de madeira ritmada + calor."""
    rng = criar_rng(semente)
    d = float(dur) if dur is not None else 6.0
    n = int(round(d * SR))
    t = np.arange(n, dtype=np.float32) / SR

    # 1. Calor e brasa do forno de farinha (ressonância grave quente)
    ruido = rng.normal(0, 1, n).astype(np.float32)
    forno = filtro(ruido, "bandpass", [110.0, 440.0]) * (
        0.65 + 0.25 * np.sin(2.0 * np.pi * (2.0 / d) * t)
    ) * 0.34

    # 2. Roda de madeira / mexedor cadenciado (ciclo de 1.0 s -> 6 ciclos exatos em 6.0 s)
    roda = np.zeros(n, dtype=np.float32)
    for tc in np.arange(0.50, d - 0.35, 1.0):
        i0 = int(round(tc * SR))
        nr = min(int(0.24 * SR), n - i0)
        if nr > 16:
            tr = np.arange(nr, dtype=np.float32) / SR
            ranger_roda = (
                0.65 * np.sin(2.0 * np.pi * (215.0 + 35.0 * np.sin(2.0 * np.pi * 4.0 * tr)) * tr)
                + 0.35 * filtro(rng.normal(0, 1, nr).astype(np.float32), "bandpass", [300.0, 1200.0])
            ) * env(nr, 0.03, 0.08) * 0.14
            roda[i0 : i0 + nr] += ranger_roda.astype(np.float32)

    # 3. Estalidos suaves de lenha seca crepitando no forno
    estalidos = np.zeros(n, dtype=np.float32)
    tempos_estalo = np.linspace(0.45, d - 0.45, 16)
    for k, te in enumerate(tempos_estalo):
        i0 = int(round(float(te) * SR))
        ne = min(int(0.022 * SR), n - i0)
        if ne > 6:
            te_arr = np.arange(ne, dtype=np.float32) / SR
            estalo = (
                filtro(rng.normal(0, 1, ne).astype(np.float32), "bandpass", [900.0, 3800.0])
                * np.exp(-te_arr / 0.006)
                * env(ne, 0.002, 0.006)
                * (0.07 + 0.04 * (k % 3))
            )
            estalidos[i0 : i0 + ne] += estalo.astype(np.float32)

    bruto = norm(forno + roda + estalidos, pico=0.56)
    return tornar_loop_sem_emenda(bruto, crossfade_s=0.35, sr=SR)


# ==============================================================================
# 3. EXTRAS LEGADOS (compatibilidade integral com roteiro.json / mixar.py)
# ==============================================================================


def jingle_mercadinho(dur: float | None = None, semente: int = 41) -> np.ndarray:
    """Jingle comercial sintético do Mercadinho Sabor Já (compatibilidade com cap01)."""
    notas = [72, 76, 79, 84, 79, 84]
    durs = [0.12, 0.12, 0.12, 0.24, 0.10, 0.45]
    partes = []
    for m, dn in zip(notas, durs):
        nn = int(round(dn * SR))
        tn = np.arange(nn, dtype=np.float32) / SR
        f = mnota(m)
        onda = np.tanh(2.5 * np.sin(2.0 * np.pi * f * tn)) * 0.38 + np.sin(2.0 * np.pi * 2.0 * f * tn) * 0.20
        partes.append((onda * np.exp(-tn / 0.25) * env(nn, 0.004, 0.02)).astype(np.float32))
    x = np.concatenate(partes)
    sino_t = np.arange(int(0.75 * SR), dtype=np.float32) / SR
    sino = (
        np.sin(2.0 * np.pi * 2093.0 * sino_t)
        + 0.45 * np.sin(2.0 * np.pi * 2093.0 * 2.76 * sino_t)
    ) * np.exp(-sino_t / 0.28) * env(len(sino_t), 0.004, 0.06)
    y = np.concatenate([x, (sino * 0.48).astype(np.float32)])
    return fade_anticlique(norm(filtro(y, "lowpass", 5800.0), pico=0.72))


def grilo_curto(dur: float | None = None, semente: int = 42) -> np.ndarray:
    """Canto curto de grilo (compatibilidade com roteiro.json)."""
    d = float(dur) if dur is not None else 1.3
    n = int(round(d * SR))
    t = np.arange(n, dtype=np.float32) / SR
    y = np.zeros(n, dtype=np.float32)
    for k in range(4):
        for j in range(3):
            t0 = 0.04 + k * 0.31 + j * 0.045
            if t0 >= d - 0.04:
                continue
            dt = np.clip(t - t0, 0.0, None)
            ativo = (t >= t0).astype(np.float32)
            env_g = (1.0 - np.exp(-dt / 0.003)) * np.exp(-dt / 0.012) * ativo
            y += (np.sin(2.0 * np.pi * 4150.0 * t) * env_g).astype(np.float32)
    return fade_anticlique(norm(y * env(n, 0.01, 0.05), pico=0.45))


def zip_sache(dur: float | None = None, semente: int = 43) -> np.ndarray:
    """Som rápido de rasgo/zíper de embalagem (compatibilidade com roteiro.json)."""
    rng = criar_rng(semente)
    d = float(dur) if dur is not None else 0.30
    n = int(round(d * SR))
    t = np.arange(n, dtype=np.float32) / SR
    mod = 0.5 + 0.5 * np.sin(2.0 * np.pi * 72.0 * t)
    x = rng.normal(0, 1, n).astype(np.float32) * mod
    return fade_anticlique(norm(filtro(x, "bandpass", [1400.0, 5600.0]) * env(n, 0.015, 0.06), pico=0.55))


# ==============================================================================
# TABELAS DE REGISTRO E ALIASES DE COMPATIBILIDADE
# ==============================================================================

PRESETS_EFEITOS: dict[str, Callable[..., np.ndarray]] = {
    "pouso_cheio": pouso_cheio,
    "pouso_vazio": pouso_vazio,
    "passo_pesado": passo_pesado,
    "passo_leve": passo_leve,
    "plim_fruta": plim_fruta,
    "toc_colher": toc_colher,
    "sacolejo_frutas": sacolejo_frutas,
    "vento_seco": vento_seco,
    "chuva": chuva,
    "trovao_distante": trovao_distante,
    "galo_caatinga": galo_caatinga,
    "burburinho_feira": burburinho_feira,
    "porta_madeira": porta_madeira,
    "zumbido_neon": zumbido_neon,
    "whoosh_camera": whoosh_camera,
    "cartela_continua": cartela_continua,
    "gota_suor": gota_suor,
    "festa_fole": festa_fole,
}

PRESETS_AMBIENCIAS: dict[str, Callable[..., np.ndarray]] = {
    "amb_feira": amb_feira,
    "amb_acude_noite": amb_acude_noite,
    "amb_casa_farinha": amb_casa_farinha,
}

PRESETS_EXTRAS_LEGADOS: dict[str, Callable[..., np.ndarray]] = {
    "jingle": jingle_mercadinho,
    "grilo": grilo_curto,
    "zip": zip_sache,
}

ALIASES_PRESETS: dict[str, str] = {
    # Aliases obrigatórios especificados para roteiro.json e cap01-inauguracao.json
    "plof": "pouso_cheio",
    "plof_sache": "pouso_cheio",
    "pouso": "pouso_vazio",
    "vento": "vento_seco",
    "vento_poeira": "vento_seco",
    "neon": "zumbido_neon",
    "brilho": "plim_fruta",
    "reflexo_brilho": "plim_fruta",
    "passos": "passo_leve",
    "vinheta": "vinheta_mangaio",
    "jingle_mercadinho": "jingle",
}
