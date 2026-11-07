"""Som da demo do Mangaio: trompete do Mangaio + efeitos sintetizados, sem fala.

    python receitas/novela-da-caatinga/demos/mangaio/som.py   → saida/novela-da-caatinga/demo-mangaio-som.wav (−14 LUFS)

Reaproveita o sintetizador do capítulo (../../som/mixar.py: trompete, pouso, brilho, vento) e
acrescenta os efeitos da demo: mola (decolagem), palha (cada troca de vista), plim (fruta que cai
dentro, afinado), fiu (frutas pulam fora), risco (pincel escrevendo o nome), xote (zabumba e
triângulo da dança) e ambiente (feira ao longe, bem baixo). As deixas estão em tempos.json.
"""
from __future__ import annotations

import json
import subprocess
import sys
import wave
from pathlib import Path

import numpy as np

AQUI = Path(__file__).resolve().parent
SERIE = AQUI.parents[1]
sys.path.insert(0, str(SERIE / "som"))
import mixar as M  # noqa: E402

SR = M.SR
rng = np.random.default_rng(11)
SAIDA = SERIE.parents[1] / "saida" / "novela-da-caatinga"


def mola():
    """'Boing' curto de decolagem: seno que sobe com vibrato de mola."""
    n = int(0.32 * SR); t = np.arange(n) / SR
    f = 180 + 260 * (t / 0.32) + 40 * np.sin(2 * np.pi * 22 * t) * np.exp(-t / 0.15)
    y = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.12)
    return M.norm(y * M.env(n, 0.004, 0.06), 0.5)


def palha():
    """Farfalhar de palha (troca de vista): ruído em banda que varre para cima."""
    n = int(0.28 * SR); t = np.arange(n) / SR
    x = rng.normal(0, 1, n).astype(np.float32)
    a = M.filtro(x, "bandpass", [1200, 3500]) * np.sin(np.pi * t / 0.28) ** 2
    b = M.filtro(x, "bandpass", [3500, 8000]) * np.sin(np.pi * np.clip(t / 0.28 * 1.2, 0, 1)) ** 4 * 0.6
    grao = (rng.random(n) < 0.004) * rng.normal(0, 1, n) * 2      # estalinhos da trança
    return M.norm((a + b + M.filtro(grao.astype(np.float32), "highpass", 2000)) * M.env(n, 0.01, 0.05), 0.45)


def plim(nota=84):
    """Sino curto de fruta caindo dentro do cesto (afinado, sobe a cada fruta)."""
    n = int(0.9 * SR); t = np.arange(n) / SR
    f = M.mnota(nota)
    y = (np.sin(2 * np.pi * f * t) + 0.45 * np.sin(2 * np.pi * f * 2.76 * t) * np.exp(-t / 0.08)
         + 0.25 * np.sin(2 * np.pi * f * 5.4 * t) * np.exp(-t / 0.03)) * np.exp(-t / 0.28)
    baque = np.sin(2 * np.pi * np.cumsum(90 + 120 * np.exp(-t / 0.02)) / SR) * np.exp(-t / 0.05) * 0.5
    return M.norm(y + baque, 0.55)


def fiu():
    """Frutas pulam fora: assobio que sobe + ar."""
    n = int(0.55 * SR); t = np.arange(n) / SR
    f = 500 * 2 ** (2.2 * t / 0.55)
    tom = np.sin(2 * np.pi * np.cumsum(f) / SR) * 0.4
    ar = M.filtro(rng.normal(0, 1, n).astype(np.float32), "bandpass", [800, 4000])
    return M.norm((tom + ar) * np.sin(np.pi * t / 0.55), 0.5)


def risco():
    """Pincel seco no papel escrevendo o nome (~1 s, em 3 traços)."""
    n = int(1.1 * SR); t = np.arange(n) / SR
    x = M.filtro(rng.normal(0, 1, n).astype(np.float32), "bandpass", [2500, 7000])
    tracos = np.zeros(n, np.float32)
    for a, b in ((0.0, 0.32), (0.38, 0.7), (0.76, 1.05)):
        m = (t >= a) & (t < b)
        tracos[m] = np.sin(np.pi * (t[m] - a) / (b - a)) ** 0.7
    return M.norm(x * tracos, 0.25)


def xote(dur=2.0):
    """Zabumba e triângulo a 120 bpm (o xote da dança)."""
    n = int(dur * SR); t = np.arange(n) / SR
    y = np.zeros(n, np.float32)
    batida = 0.5
    for k in range(int(dur / batida * 2)):
        t0 = k * batida / 2
        i = int(t0 * SR)
        if i >= n:
            break
        tt = t[: n - i]
        if k % 2 == 0:   # zabumba no tempo
            z = np.sin(2 * np.pi * np.cumsum(70 + 60 * np.exp(-tt / 0.03)) / SR) * np.exp(-tt / 0.16)
            y[i:] += z * (1.0 if k % 4 == 0 else 0.7)
        tri = np.sin(2 * np.pi * 4200 * tt) * np.exp(-tt / (0.25 if k % 2 else 0.05))
        y[i:] += tri * 0.12
    return M.norm(y * M.env(n, 0.01, 0.2), 0.6)


def ambiente(dur):
    """Feira ao longe: vento baixo + burburinho grave (ruído filtrado modulado)."""
    n = int(dur * SR); t = np.arange(n) / SR
    v = M.vento(dur) * 0.6
    burb = M.filtro(rng.normal(0, 1, n).astype(np.float32), "bandpass", [250, 700])
    burb *= 0.5 + 0.5 * np.abs(np.sin(2 * np.pi * 0.7 * t) * np.sin(2 * np.pi * 1.9 * t + 1))
    return M.norm(v + M.norm(burb, 0.15), 0.3) * M.env(n, 1.0, 1.5)


NIVEL = {"mola": 0.45, "pouso": 0.55, "palha": 0.55, "plim": 0.5, "fiu": 0.45, "risco": 0.4,
         "xote": 0.45, "ambiente": 0.35, "brilho": 0.4, "vento": 0.45}


def gerar(s):
    i = s["id"]
    if i.startswith("trompete"):
        return M.som(i, None)
    if i == "plim":
        return plim(s.get("nota", 84))
    if i == "ambiente":
        return ambiente(s["dur"])
    if i == "xote":
        return xote(s.get("dur", 2.0))
    if i == "vento":
        return M.vento(s.get("dur", 2.0))
    if i == "brilho":
        return M.brilho()
    if i == "pouso":
        return M.pouso()
    return {"mola": mola, "palha": palha, "fiu": fiu, "risco": risco}[i]()


def principal():
    T = json.loads((AQUI / "tempos.json").read_text(encoding="utf-8"))
    total = np.zeros(int((T["duracao"] + 0.5) * SR), np.float32)
    for s in T["sons"]:
        x = gerar(s)
        nivel = 0.6 if s["id"].startswith("trompete") else NIVEL.get(s["id"], 0.5)
        i = int(s["t"] * SR)
        x = x[: max(0, len(total) - i)]
        total[i: i + len(x)] += x * nivel * s.get("vol", 1.0)
    SAIDA.mkdir(parents=True, exist_ok=True)
    bruto = SAIDA / "_demo_mangaio_bruto.wav"
    est = np.repeat(np.clip(total, -1, 1)[:, None], 2, 1)
    with wave.open(str(bruto), "wb") as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((est * 32767).astype(np.int16).tobytes())
    med = subprocess.run(["ffmpeg", "-hide_banner", "-i", str(bruto), "-af", "loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json",
                          "-f", "null", "-"], capture_output=True, text=True).stderr
    import re
    m = json.loads(re.search(r"\{[^{}]*\"input_i\"[^{}]*\}", med, re.S).group(0))
    af = (f"loudnorm=I=-14:TP=-1.5:LRA=11:measured_I={m['input_i']}:measured_TP={m['input_tp']}:"
          f"measured_LRA={m['input_lra']}:measured_thresh={m['input_thresh']}:offset={m['target_offset']}:linear=true")
    out = SAIDA / "demo-mangaio-som.wav"
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(bruto), "-af", af, "-ar", str(SR), str(out)], check=True)
    bruto.unlink()
    print(out)


if __name__ == "__main__":
    principal()
