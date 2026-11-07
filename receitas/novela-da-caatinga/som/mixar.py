"""Som do capítulo: vozes nas falas, trompete do Cesto e efeitos nas deixas de tempos.json, tudo sintetizado aqui.

    python receitas/novela-da-caatinga/som/mixar.py      → saida/novela-da-caatinga/som.wav (−14 LUFS)

O TROMPETE É PROVISÓRIO. Pela bíblia, as frases do Cesto são gravadas à mão. Até lá, este sintetizador
de metal (harmônicos que abrem com o sopro, vibrato e "wah" de surdina) marca o lugar e o ritmo de cada frase.
Para trocar por gravação: ponha som/trompete/<frase>.wav (ex.: trompete_grave.wav) e ele passa a ser usado.
Efeitos sintéticos (plof, vento, grilo, neon, jingle, passos, brilho, zíper), sem arquivo baixado.
Música: só o "Baião do Mangaio" (receitas/mangaio) na vinheta do título e na assinatura.
"""
from __future__ import annotations

import json
import re
import subprocess
import sys
import wave
from pathlib import Path

import numpy as np
from scipy.signal import butter, sosfilt

AQUI = Path(__file__).parent
REC = AQUI.parent
RAIZ = REC.parents[1]
SAIDA = RAIZ / "saida" / "novela-da-caatinga"
SR = 48000
rng = np.random.default_rng(5)


def ler(p: Path) -> np.ndarray:
    with wave.open(str(p)) as w:
        x = np.frombuffer(w.readframes(w.getnframes()), np.int16).astype(np.float32) / 32768
        if w.getnchannels() == 2:
            x = x.reshape(-1, 2).mean(1)
        if w.getframerate() != SR:
            n = int(len(x) * SR / w.getframerate())
            x = np.interp(np.linspace(0, len(x) - 1, n), np.arange(len(x)), x).astype(np.float32)
    return x


def filtro(x, tipo, f, ordem=2):
    return sosfilt(butter(ordem, f, tipo, fs=SR, output="sos"), x).astype(np.float32)


def env(n, a=0.005, r=0.05):
    e = np.ones(n, np.float32)
    na, nr = max(1, int(a * SR)), max(1, int(r * SR))
    e[:na] = np.linspace(0, 1, na)
    e[-nr:] *= np.linspace(1, 0, nr)
    return e


def norm(x, pico=0.9):
    m = np.abs(x).max()
    return x / m * pico if m else x


# ---------------------------------------------------------------- trompete do Cesto
def mnota(m):
    return 440 * 2 ** ((m - 69) / 12)


def sopro(notas, wah=None, vib=5.5):
    """notas: [(midi, dur, glide_final_semitons)], wah: função 0..1 do tempo normalizado (abertura da surdina)."""
    partes = []
    for m, d, glide in notas:
        n = int(d * SR)
        t = np.arange(n) / SR
        f0 = mnota(m) * 2 ** (glide * np.clip((t / d - 0.6) / 0.4, 0, 1) / 12)
        f0 = f0 * (1 + 0.006 * np.sin(2 * np.pi * vib * t) * np.clip(t / 0.15, 0, 1))
        fase = 2 * np.pi * np.cumsum(f0) / SR
        brilho = np.clip(t / 0.04, 0, 1) * (0.75 + 0.25 * np.exp(-t / 0.12))
        if wah:
            brilho = brilho * (0.25 + 0.75 * wah(t / d))
        y = np.zeros(n, np.float32)
        for k in range(1, 14):
            y += (1 / k ** 1.1) * brilho ** ((k - 1) / 2.2) * np.sin(k * fase)
        y += 0.02 * rng.normal(0, 1, n) * brilho          # ar do sopro
        partes.append(y * env(n, 0.012, 0.04))
    return norm(filtro(np.concatenate(partes), "lowpass", 5200), 0.8)


def wah_wah(u):  # fecha, abre, fecha, abre: o "uá-uá" da surdina
    return 0.5 - 0.5 * np.cos(2 * np.pi * 2 * u)


TROMPETE = {
    "trompete_grave": lambda: sopro([(50, 1.3, -1.5)]),
    "trompete_oi": lambda: sopro([(55, 0.16, 0), (59, 0.16, 0), (62, 0.42, 0.6)]),
    "trompete_comedia": lambda: sopro([(m, 0.075, 0) for m in (74, 72, 71, 69, 67, 65, 64, 62)] + [(50, 0.7, -2)],
                                      wah=lambda u: np.where(u > 0.6, wah_wah((u - 0.6) / 0.4), 1)),
    "trompete_desconfianca": lambda: sopro([(57, 0.32, 0), (56, 0.5, -1)], wah=wah_wah),
    "trompete_nao_vai": lambda: sopro([(64, 0.3, 0), (60, 0.55, 0)]),
    "trompete_suspensa": lambda: sopro([(60, 0.2, 0), (64, 0.2, 0), (66, 1.4, 0)]),
    "trompete_esperanca": lambda: sopro([(60, 0.17, 0), (64, 0.17, 0), (67, 0.17, 0), (69, 0.3, 0), (67, 0.15, 0), (72, 0.7, 0)]),
}


# ---------------------------------------------------------------- efeitos
def plof():
    n = int(0.45 * SR); t = np.arange(n) / SR
    baque = np.sin(2 * np.pi * np.cumsum(60 + 140 * np.exp(-t / 0.03)) / SR) * np.exp(-t / 0.09)
    plastico = filtro(rng.normal(0, 1, n), "highpass", 2500) * np.exp(-t / 0.035) * 0.35
    poeira = filtro(rng.normal(0, 1, n), "lowpass", 900) * np.exp(-t / 0.18) * 0.25
    return norm(baque + plastico + poeira, 0.85)


def vento(dur):
    n = int(dur * SR); t = np.arange(n) / SR
    x = filtro(rng.normal(0, 1, n), "bandpass", [180, 900])
    m = 0.55 + 0.3 * np.sin(2 * np.pi * 0.13 * t) + 0.15 * np.sin(2 * np.pi * 0.37 * t + 1)
    return norm(x * m * env(n, 0.8, 0.8), 0.35)


def grilo():
    n = int(1.3 * SR); t = np.arange(n) / SR
    y = np.zeros(n, np.float32)
    for k in range(4):
        for j in range(3):
            t0 = k * 0.33 + j * 0.045
            e = np.exp(-np.clip(t - t0, 0, None) / 0.012) * (t >= t0)
            y += np.sin(2 * np.pi * 4300 * t) * e
    return norm(y, 0.35)


def pouso():
    n = int(0.35 * SR); t = np.arange(n) / SR
    x = filtro(rng.normal(0, 1, n), "bandpass", [200, 1400]) * np.exp(-t / 0.04)
    x += 0.8 * np.sin(2 * np.pi * 110 * t) * np.exp(-t / 0.07)
    return norm(x, 0.6)


def neon():
    n = int(1.0 * SR); t = np.arange(n) / SR
    zumbido = (np.sign(np.sin(2 * np.pi * 120 * t)) * 0.3 + np.sin(2 * np.pi * 240 * t) * 0.3)
    pisca = np.ones(n); pisca[(t > 0.08) & (t < 0.16)] = 0; pisca[(t > 0.24) & (t < 0.28)] = 0
    clique = filtro(rng.normal(0, 1, n), "highpass", 1500) * np.exp(-t / 0.01)
    return norm(filtro(zumbido * pisca, "lowpass", 2500) * env(n, 0.01, 0.4) * 0.5 + clique * 0.6, 0.6)


def jingle():
    notas = [72, 76, 79, 84, 79, 84]
    durs = [0.12, 0.12, 0.12, 0.24, 0.1, 0.45]
    partes = []
    for m, d in zip(notas, durs):
        n = int(d * SR); t = np.arange(n) / SR
        f = mnota(m)
        quad = np.sign(np.sin(2 * np.pi * f * t)) * 0.4 + np.sin(2 * np.pi * 2 * f * t) * 0.2
        partes.append(quad * np.exp(-t / 0.25) * env(n, 0.003, 0.02))
    x = np.concatenate(partes)
    sino_t = np.arange(int(0.9 * SR)) / SR
    sino = (np.sin(2 * np.pi * 2093 * sino_t) + 0.5 * np.sin(2 * np.pi * 2093 * 2.76 * sino_t)) * np.exp(-sino_t / 0.3)
    y = np.zeros(len(x) + len(sino), np.float32); y[: len(x)] += x; y[len(x):] += sino * 0.5
    return norm(filtro(y, "lowpass", 6000), 0.6)


def passos():
    n = int(1.5 * SR); t = np.arange(n) / SR
    y = np.zeros(n, np.float32)
    for k, t0 in enumerate(np.arange(0, 1.4, 0.11)):
        e = np.exp(-np.clip(t - t0, 0, None) / 0.018) * (t >= t0)
        y += filtro(rng.normal(0, 1, n), "bandpass", [300, 2500]) * e * (0.6 + 0.4 * (k % 2))
    return norm(y * env(n, 0.05, 0.3), 0.45)


def brilho():
    n = int(1.1 * SR); t = np.arange(n) / SR
    y = np.zeros(n, np.float32)
    for k in range(9):
        t0, f = k * 0.07, rng.uniform(2200, 5200)
        e = np.exp(-np.clip(t - t0, 0, None) / 0.18) * (t >= t0)
        y += np.sin(2 * np.pi * f * t) * e
    return norm(y, 0.35)


def zip_():
    n = int(0.3 * SR); t = np.arange(n) / SR
    x = rng.normal(0, 1, n) * (np.sin(2 * np.pi * 70 * t) > 0)
    return norm(filtro(x, "bandpass", [1500, 6000]) * env(n, 0.02, 0.08), 0.4)


def vinheta():
    """Trompete de esperança por cima de 2,6 s do Baião do Mangaio."""
    tr = TROMPETE["trompete_esperanca"]()
    b = REC.parent / "mangaio" / "som" / "baiao-mangaio.wav"
    if not b.exists():
        return tr
    m = ler(b)[: int(2.8 * SR)]
    m = m * env(len(m), 0.05, 0.8) * 0.35
    y = np.zeros(max(len(m), len(tr)), np.float32)
    y[: len(m)] += m; y[: len(tr)] += tr * 0.75
    return y


EFEITOS = {"plof": plof, "grilo": grilo, "pouso": pouso, "neon": neon, "jingle": jingle, "passos": passos,
           "brilho": brilho, "zip": zip_, "vinheta": vinheta}
NIVEL = {"vento": 0.5, "grilo": 0.5, "plof": 0.7, "pouso": 0.5, "neon": 0.45, "jingle": 0.5, "passos": 0.5,
         "brilho": 0.4, "zip": 0.45, "vinheta": 0.7}


def som(id_: str, dur: float | None) -> np.ndarray:
    gravado = AQUI / "trompete" / f"{id_}.wav"
    if gravado.exists():
        return norm(ler(gravado), 0.8)
    if id_ in TROMPETE:
        return TROMPETE[id_]()
    if id_ == "vento":
        return vento(dur or 4)
    return EFEITOS[id_]()


def principal() -> None:
    T = json.loads((REC / "tempos.json").read_text(encoding="utf-8"))
    total = np.zeros(int((T["duracao"] + 1) * SR), np.float32)

    def por(x, t, g=1.0):
        i = int(t * SR)
        x = x[: max(0, len(total) - i)]
        total[i: i + len(x)] += x * g

    for c in T["cenas"]:
        for f in c["falas"]:
            por(ler(REC / f["wav"]), c["ini"] + f["ini"], 1.0)
        for s in c.get("sons", []):
            nivel = 0.55 if s["id"].startswith("trompete") else NIVEL.get(s["id"], 0.5)
            por(som(s["id"], s.get("dur")), c["ini"] + s["t"], nivel * s.get("vol", 1.0))
    SAIDA.mkdir(parents=True, exist_ok=True)
    bruto = SAIDA / "_som_bruto.wav"
    est = np.repeat(np.clip(total, -1, 1)[:, None], 2, 1)
    with wave.open(str(bruto), "wb") as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((est * 32767).astype(np.int16).tobytes())
    # loudnorm em duas passadas, −14 LUFS (padrão de Reels/TikTok/YouTube)
    med = subprocess.run(["ffmpeg", "-hide_banner", "-i", str(bruto), "-af", "loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json",
                          "-f", "null", "-"], capture_output=True, text=True).stderr
    m = json.loads(re.search(r"\{[^{}]*\"input_i\"[^{}]*\}", med, re.S).group(0))
    af = (f"loudnorm=I=-14:TP=-1.5:LRA=11:measured_I={m['input_i']}:measured_TP={m['input_tp']}:"
          f"measured_LRA={m['input_lra']}:measured_thresh={m['input_thresh']}:offset={m['target_offset']}:linear=true")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(bruto), "-af", af, "-ar", str(SR), str(SAIDA / "som.wav")], check=True)
    bruto.unlink()
    print(SAIDA / "som.wav")


if __name__ == "__main__":
    if "--frases" in sys.argv:   # ouvir cada frase do trompete e cada efeito: saida/novela-da-caatinga/_frases/
        d = SAIDA / "_frases"; d.mkdir(parents=True, exist_ok=True)
        for k in list(TROMPETE) + list(EFEITOS) + ["vento"]:
            x = som(k, 3)
            with wave.open(str(d / f"{k}.wav"), "wb") as w:
                w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes((x * 32767).astype(np.int16).tobytes())
        print(d)
    else:
        principal()
