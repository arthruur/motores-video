"""Primitivas de síntese sonora determinística em 48 kHz (Python + NumPy + SciPy).

Fornece filtros Butterworth (SOS), envelopes suaves sem clique, normalização,
construção de loops de ambiência sem emenda audível (seamless loops) e I/O WAV.

Licença: Apache-2.0 (síntese determinística própria com semente fixa).
"""
from __future__ import annotations

import wave
from pathlib import Path

import numpy as np
from scipy.signal import butter, sosfilt

SR: int = 48000


def criar_rng(semente: int = 5) -> np.random.Generator:
    """Cria gerador pseudoaleatório determinístico com semente fixa."""
    return np.random.default_rng(int(semente))


def filtro(
    x: np.ndarray,
    tipo: str,
    freq: float | list[float] | tuple[float, float],
    ordem: int = 2,
    sr: int = SR,
) -> np.ndarray:
    """Aplica filtro Butterworth em cascata SOS (estável em qualquer ordem).

    Args:
        x: Sinal 1D (ou 2D com amostras no eixo 0).
        tipo: 'lowpass', 'highpass', 'bandpass' ou 'bandstop'.
        freq: Frequência de corte em Hz (ou par [f_baixa, f_alta] para bandpass).
        ordem: Ordem do filtro Butterworth.
        sr: Taxa de amostragem em Hz (padrão 48000).
    """
    nyq = 0.5 * sr
    if isinstance(freq, (list, tuple, np.ndarray)):
        f_lim = [ float(np.clip(f, 5.0, nyq * 0.98)) for f in freq ]
        if f_lim[0] >= f_lim[1]:
            f_lim[0] = max(5.0, f_lim[1] * 0.5)
    else:
        f_lim = float(np.clip(freq, 5.0, nyq * 0.98))
    sos = butter(ordem, f_lim, btype=tipo, fs=sr, output="sos")
    return sosfilt(sos, x, axis=0).astype(np.float32)


def env(
    n: int,
    ataque: float = 0.006,
    retorno: float = 0.05,
    sr: int = SR,
) -> np.ndarray:
    """Gera envelope com rampas em meio-cosseno (zero clique e derivada zero nas pontas)."""
    if n <= 0:
        return np.zeros(0, dtype=np.float32)
    e = np.ones(n, dtype=np.float32)
    na = max(2, min(n // 2, int(round(ataque * sr))))
    nr = max(2, min(n - na, int(round(retorno * sr))))
    if na > 0:
        u_a = np.linspace(0.0, 1.0, na, dtype=np.float32)
        e[:na] = 0.5 * (1.0 - np.cos(np.pi * u_a))
    if nr > 0:
        u_r = np.linspace(0.0, 1.0, nr, dtype=np.float32)
        e[-nr:] *= 0.5 * (1.0 + np.cos(np.pi * u_r))
    e[0] = 0.0
    e[-1] = 0.0
    return e


def fade_anticlique(x: np.ndarray, fade_s: float = 0.005, sr: int = SR) -> np.ndarray:
    """Garante rampa anti-clique mínima nas duas pontas de um buffer 1D ou 2D."""
    n = len(x)
    if n < 4:
        return x.astype(np.float32)
    nf = max(2, min(n // 4, int(round(fade_s * sr))))
    u = np.linspace(0.0, 1.0, nf, dtype=np.float32)
    curva_in = 0.5 * (1.0 - np.cos(np.pi * u))
    curva_out = 0.5 * (1.0 + np.cos(np.pi * u))
    y = x.astype(np.float32).copy()
    if y.ndim == 1:
        y[:nf] *= curva_in
        y[-nf:] *= curva_out
    else:
        y[:nf, :] *= curva_in[:, None]
        y[-nf:, :] *= curva_out[:, None]
    return y


def norm(x: np.ndarray, pico: float = 0.85) -> np.ndarray:
    """Normaliza o pico absoluto do sinal para `pico`."""
    x_f = x.astype(np.float32)
    m = float(np.abs(x_f).max()) if x_f.size else 0.0
    if m <= 1e-9:
        return x_f
    return (x_f / m * float(pico)).astype(np.float32)


def tornar_loop_sem_emenda(
    x: np.ndarray,
    crossfade_s: float = 0.35,
    sr: int = SR,
) -> np.ndarray:
    """Transforma um buffer `x` em um loop perfeitamente cíclico sem emenda audível.

    Usa crossfade de potência constante em meio-cosseno entre `x` (no centro) e
    uma cópia deslocada em meio período (`np.roll(x, N // 2)`), de modo que:
    1. A descontinuidade original `x[-1] -> x[0]` cai exatamente no centro da cópia
       deslocada, onde o peso dela é zero (`w_shift = 0`).
    2. Na fronteira de repetição (`y[-1] -> y[0]`), o sinal equivale às amostras
       internas contínuas de `x` em `N // 2 - 1 -> N // 2`.
    3. Uma micro-ponte circular de 32 amostras iguala amplitude e derivada na borda.
    """
    y_in = x.astype(np.float32)
    n = len(y_in)
    if n < 64:
        return y_in.copy()

    # Remove eventual offset DC para evitar degraus de fase
    y_in = y_in - np.mean(y_in, axis=0, keepdims=True)

    m = max(16, min(n // 3, int(round(crossfade_s * sr))))
    meio = n // 2
    x_shift = np.roll(y_in, meio, axis=0)

    # Perfil alpha: 0 nas bordas (0 e n-1), 1 no miolo [m .. n-m]
    alpha = np.ones(n, dtype=np.float32)
    u = np.linspace(0.0, 1.0, m, dtype=np.float32)
    rampa_subida = 0.5 * (1.0 - np.cos(np.pi * u))
    rampa_descida = 0.5 * (1.0 + np.cos(np.pi * u))
    alpha[:m] = rampa_subida
    alpha[-m:] = rampa_descida

    # Crossfade de potência constante (sin/cos)
    theta = 0.5 * np.pi * alpha
    w_x = np.sin(theta).astype(np.float32)
    w_shift = np.cos(theta).astype(np.float32)

    if y_in.ndim == 1:
        y = w_x * y_in + w_shift * x_shift
    else:
        y = w_x[:, None] * y_in + w_shift[:, None] * x_shift

    # Micro-ponte circular C1 nas k amostras de cada lado da fronteira para garantir
    # transição y[-1] -> y[0] com amplitude e derivada perfeitamente contínuas
    k = min(64, max(16, m // 16))
    u_k = np.linspace(0.0, 1.0, k, dtype=np.float32)
    peso_fim = 0.5 * (1.0 - np.cos(np.pi * u_k))
    peso_ini = 0.5 * (1.0 + np.cos(np.pi * u_k))
    if y.ndim == 1:
        media_borda = 0.5 * (y[0] + y[-1])
        y[:k] = y[:k] * (1.0 - 0.5 * peso_ini) + media_borda * (0.5 * peso_ini)
        y[-k:] = y[-k:] * (1.0 - 0.5 * peso_fim) + media_borda * (0.5 * peso_fim)
        y[-1] = y[0]
    else:
        media_borda = 0.5 * (y[0, :] + y[-1, :])
        y[:k, :] = y[:k, :] * (1.0 - 0.5 * peso_ini[:, None]) + media_borda[None, :] * (0.5 * peso_ini[:, None])
        y[-k:, :] = y[-k:, :] * (1.0 - 0.5 * peso_fim[:, None]) + media_borda[None, :] * (0.5 * peso_fim[:, None])
        y[-1, :] = y[0, :]

    return y.astype(np.float32)


def repetir_loop(
    loop_buf: np.ndarray,
    duracao_s: float,
    fade_in: float = 0.15,
    fade_out: float = 0.25,
    sr: int = SR,
) -> np.ndarray:
    """Repete um buffer de ambiência em loop sem emenda pela duração exata pedida."""
    n_alvo = max(1, int(round(float(duracao_s) * sr)))
    n_loop = len(loop_buf)
    if n_loop == 0:
        return np.zeros(n_alvo, dtype=np.float32)

    reps = (n_alvo + n_loop - 1) // n_loop
    if loop_buf.ndim == 1:
        estendido = np.tile(loop_buf, reps)[:n_alvo].astype(np.float32)
    else:
        estendido = np.tile(loop_buf, (reps, 1))[:n_alvo, :].astype(np.float32)

    envelope = env(n_alvo, ataque=fade_in, retorno=fade_out, sr=sr)
    if estendido.ndim == 1:
        return (estendido * envelope).astype(np.float32)
    return (estendido * envelope[:, None]).astype(np.float32)


def salvar_wav(
    caminho: str | Path,
    x: np.ndarray,
    sr: int = SR,
    estereo: bool = True,
) -> Path:
    """Salva array float32 [-1, 1] como WAV PCM 16-bit em `sr` Hz."""
    destino = Path(caminho)
    destino.parent.mkdir(parents=True, exist_ok=True)
    arr = np.asarray(x, dtype=np.float32)

    if estereo:
        if arr.ndim == 1:
            arr = np.column_stack([arr, arr])
        elif arr.ndim == 2 and arr.shape[1] == 1:
            arr = np.repeat(arr, 2, axis=1)
        canais = 2
    else:
        if arr.ndim == 2:
            arr = arr.mean(axis=1)
        canais = 1

    pcm = np.clip(arr, -1.0, 1.0)
    pcm_i16 = (pcm * 32767.0).astype(np.int16)

    with wave.open(str(destino), "wb") as w:
        w.setnchannels(canais)
        w.setsampwidth(2)
        w.setframerate(int(sr))
        w.writeframes(pcm_i16.tobytes())

    return destino


def ler_wav(
    caminho: str | Path,
    sr: int = SR,
    mono: bool = True,
) -> np.ndarray:
    """Lê um arquivo WAV e retorna float32 em [-1, 1] reamostrado para `sr` Hz."""
    p = Path(caminho)
    with wave.open(str(p), "rb") as w:
        n_canais = w.getnchannels()
        taxa_orig = w.getframerate()
        n_frames = w.getnframes()
        largura = w.getsampwidth()
        bruto = w.readframes(n_frames)

    if largura == 2:
        x = np.frombuffer(bruto, dtype=np.int16).astype(np.float32) / 32768.0
    elif largura == 4:
        x = np.frombuffer(bruto, dtype=np.int32).astype(np.float32) / 2147483648.0
    else:
        x = (np.frombuffer(bruto, dtype=np.uint8).astype(np.float32) - 128.0) / 128.0

    if n_canais > 1:
        x = x.reshape(-1, n_canais)
        if mono:
            x = x.mean(axis=1)

    if taxa_orig != sr and len(x) > 1:
        n_novo = max(1, int(round(len(x) * sr / taxa_orig)))
        t_antigo = np.arange(len(x), dtype=np.float64)
        t_novo = np.linspace(0.0, len(x) - 1, n_novo, dtype=np.float64)
        if x.ndim == 1:
            x = np.interp(t_novo, t_antigo, x).astype(np.float32)
        else:
            canais_interp = [
                np.interp(t_novo, t_antigo, x[:, c]).astype(np.float32)
                for c in range(x.shape[1])
            ]
            x = np.column_stack(canais_interp)

    return x.astype(np.float32)
