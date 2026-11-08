"""Som da demo da Dona Mandioca: a fala dela + efeitos sintetizados.

    python receitas/novela-da-caatinga/demos/dona-mandioca/som.py
    -> saida/novela-da-caatinga/demo-dona-mandioca-som.wav (-14 LUFS)

Reaproveita o capítulo (../../som/mixar.py: filtros, envelope, brilho, vento) e a demo do Mangaio
(../mangaio/som.py: risco do pincel e xote de zabumba e triângulo), e acrescenta os efeitos dela:
passo (pé-toco pesado no chão de terra), toc (colher de pau batendo na mesa), zum (o braço que desce),
tic (bloco de madeira afinado: a sobrancelha que aparece, cada troca de expressão), tecido (o lenço e o
avental quando ela vira), sanfona (acorde de fole no fecho, comovida) e ambiente (casa de farinha:
forno crepitando, vento baixo). A fala é demos/dona-mandioca/fala.wav (Gemini TTS, voz Gacrux; sem
ele a demo sai sem fala). As deixas estão em tempos.json.
"""
from __future__ import annotations

import json
import re
import subprocess
import sys
import wave
from pathlib import Path

import numpy as np

AQUI = Path(__file__).resolve().parent
SERIE = AQUI.parents[1]
sys.path.insert(0, str(SERIE / "som"))
import importlib.util  # noqa: E402
import mixar as M  # noqa: E402

# demo do Mangaio (risco, xote): carregada pelo caminho, porque este arquivo também se chama som.py
_spec = importlib.util.spec_from_file_location("som_mangaio", SERIE / "demos" / "mangaio" / "som.py")
SM = importlib.util.module_from_spec(_spec); _spec.loader.exec_module(SM)

SR = M.SR
rng = np.random.default_rng(23)
SAIDA = SERIE.parents[1] / "saida" / "novela-da-caatinga"


def passo():
    """Pé-toco no chão de terra: baque grave que cai de tom + poeira."""
    n = int(0.4 * SR); t = np.arange(n) / SR
    baque = np.sin(2 * np.pi * np.cumsum(55 + 90 * np.exp(-t / 0.025)) / SR) * np.exp(-t / 0.08)
    terra = M.filtro(rng.normal(0, 1, n).astype(np.float32), "bandpass", [250, 1800]) * np.exp(-t / 0.03) * 0.5
    arrasto = M.filtro(rng.normal(0, 1, n).astype(np.float32), "bandpass", [600, 3000]) * np.exp(-t / 0.12) * 0.12
    return M.norm(baque + terra + arrasto, 0.8)


def toc():
    """Colher de pau na mesa: dois modos de madeira + estalo."""
    n = int(0.35 * SR); t = np.arange(n) / SR
    y = (np.sin(2 * np.pi * 410 * t) * np.exp(-t / 0.05) + 0.6 * np.sin(2 * np.pi * 1130 * t) * np.exp(-t / 0.025)
         + 0.3 * np.sin(2 * np.pi * 2380 * t) * np.exp(-t / 0.012))
    estalo = M.filtro(rng.normal(0, 1, n).astype(np.float32), "highpass", 2500) * np.exp(-t / 0.006) * 0.8
    mesa = np.sin(2 * np.pi * np.cumsum(90 + 60 * np.exp(-t / 0.02)) / SR) * np.exp(-t / 0.07) * 0.6
    return M.norm(y + estalo + mesa, 0.85)


def tic(nota=76):
    """Bloco de madeira afinado, curtinho."""
    n = int(0.25 * SR); t = np.arange(n) / SR
    f = M.mnota(nota)
    y = np.sin(2 * np.pi * f * t) * np.exp(-t / 0.04) + 0.4 * np.sin(2 * np.pi * f * 2.7 * t) * np.exp(-t / 0.015)
    return M.norm(y, 0.5)


def zum():
    """O braço que desce com a colher: ar curto que sobe de altura."""
    n = int(0.12 * SR); t = np.arange(n) / SR
    x = rng.normal(0, 1, n).astype(np.float32)
    y = M.filtro(x, "bandpass", [900, 3800]) * np.sin(np.pi * t / 0.12) ** 2
    return M.norm(y, 0.4)


def tecido(dur=0.5):
    """Lenço e avental quando ela vira: farfalhar macio de algodão (mais grave que a palha do Mangaio)."""
    n = int(dur * SR); t = np.arange(n) / SR
    x = rng.normal(0, 1, n).astype(np.float32)
    a = M.filtro(x, "bandpass", [500, 2200]) * np.sin(np.pi * t / dur) ** 2
    b = M.filtro(x, "bandpass", [2200, 5000]) * np.sin(np.pi * t / dur) ** 6 * 0.3
    return M.norm((a + b) * M.env(n, 0.02, 0.05), 0.35)


def sanfona(dur=4.3):
    """Acorde de fole (Lá maior com 6ª), entra devagar e respira: o momento comovido."""
    n = int(dur * SR); t = np.arange(n) / SR
    y = np.zeros(n, np.float32)
    for m in (57, 61, 64, 66, 69):
        f = M.mnota(m)
        for d in (-0.12, 0.12):                       # palhetas levemente desafinadas (o "musette")
            fase = 2 * np.pi * (f * (1 + d / 100)) * t
            y += (np.sin(fase) + 0.5 * np.sin(2 * fase) + 0.25 * np.sin(3 * fase) + 0.12 * np.sin(4 * fase))
    fole = 0.75 + 0.25 * np.sin(2 * np.pi * 0.35 * t - 1.2)
    y = M.filtro(y * fole, "lowpass", 2600)
    return M.norm(y * M.env(n, 1.0, 1.4), 0.5)


def ambiente(dur):
    """Casa de farinha: forno crepitando (estalinhos raros) + fogo grave + vento baixo."""
    n = int(dur * SR); t = np.arange(n) / SR
    fogo = M.filtro(rng.normal(0, 1, n).astype(np.float32), "lowpass", 300) * (0.7 + 0.3 * np.sin(2 * np.pi * 0.4 * t))
    est = ((rng.random(n) < 0.0009) * rng.normal(0, 1, n)).astype(np.float32)
    est = M.filtro(est, "bandpass", [1500, 6000]) * 3
    v = M.vento(dur) * 0.5
    return M.norm(M.norm(fogo, 0.3) + M.norm(est, 0.25) + v, 0.3) * M.env(n, 1.0, 1.5)


NIVEL = {"passo": 0.7, "toc": 0.75, "tic": 0.4, "zum": 0.35, "tecido": 0.4, "sanfona": 0.35, "ambiente": 0.3,
         "risco": 0.4, "xote": 0.45, "brilho": 0.35, "fala": 0.95}


def gerar(s):
    i = s["id"]
    if i == "fala":
        w = AQUI / "fala.wav"
        return M.ler(w) if w.exists() else np.zeros(1, np.float32)
    if i == "ambiente":
        return ambiente(s["dur"])
    if i == "tecido":
        return tecido(s.get("dur", 0.5))
    if i == "sanfona":
        return sanfona(s.get("dur", 4.3))
    if i == "xote":
        return SM.xote(s.get("dur", 2.0))
    if i == "tic":
        return tic(s.get("nota", 76))
    if i == "risco":
        return SM.risco()
    if i == "brilho":
        return M.brilho()
    return {"passo": passo, "toc": toc, "zum": zum}[i]()


# compressor leve antes do loudnorm: os tocs da colher não seguram o volume da fala no teto de pico
COMP = "acompressor=threshold=-20dB:ratio=3:attack=4:release=90:makeup=2,"


def principal():
    T = json.loads((AQUI / "tempos.json").read_text(encoding="utf-8"))
    total = np.zeros(int((T["duracao"] + 0.5) * SR), np.float32)
    for s in T["sons"]:
        x = gerar(s)
        i = int(s["t"] * SR)
        x = x[: max(0, len(total) - i)]
        total[i: i + len(x)] += x * NIVEL.get(s["id"], 0.5) * s.get("vol", 1.0)
    SAIDA.mkdir(parents=True, exist_ok=True)
    bruto = SAIDA / "_demo_dona_mandioca_bruto.wav"
    est = np.repeat(np.clip(total, -1, 1)[:, None], 2, 1)
    with wave.open(str(bruto), "wb") as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((est * 32767).astype(np.int16).tobytes())
    med = subprocess.run(["ffmpeg", "-hide_banner", "-i", str(bruto), "-af", COMP + "loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json",
                          "-f", "null", "-"], capture_output=True, text=True).stderr
    m = json.loads(re.search(r"\{[^{}]*\"input_i\"[^{}]*\}", med, re.S).group(0))
    af = COMP + (f"loudnorm=I=-14:TP=-1.5:LRA=11:measured_I={m['input_i']}:measured_TP={m['input_tp']}:"
          f"measured_LRA={m['input_lra']}:measured_thresh={m['input_thresh']}:offset={m['target_offset']}:linear=true")
    out = SAIDA / "demo-dona-mandioca-som.wav"
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(bruto), "-af", af, "-ar", str(SR), str(out)], check=True)
    bruto.unlink()
    print(out)


if __name__ == "__main__":
    principal()
