"""Efeitos sonoros do unboxing nos tempos de cada animação. Só numpy e ffmpeg.

    python receitas/unboxing/som/mixar.py            → saida/unboxing/som-unboxing.wav (−14 LUFS)
    python receitas/unboxing/som/mixar.py --rugido rawr   versão com um som quando a oncinha aparece (abertura e final);
                                                          junta ao vídeo já renderizado → unboxing-maquiagem-rugido-rawr.mp4
    Opções de --rugido (em RUGIDOS): onca (rugido de onça de verdade, mais bravo), rawr (o mesmo rugido mais agudo
    e curto, como um filhote), filhote (rosnadinho de gatinho), ronrom (o "trrr" feliz de gato).

O gerar.mjs chama este script e junta o áudio ao vídeo. Os tempos dentro de cada cena espelham cena.js:
mudou lá, muda aqui. Sons CC0: som/creditos.json e receitas/promo/som/creditos.json.
"""
from __future__ import annotations

import argparse
import json
import subprocess
from pathlib import Path

import numpy as np

AQUI = Path(__file__).parent
RAIZ = AQUI.parents[2]
PROMO = RAIZ / "receitas" / "promo" / "som" / "bruto"
SR = 48000

# som: (arquivo, início e duração do trecho útil em s — medidos com silencedetect —, volume em dB)
SONS = {
    "rasgo1": (AQUI / "bruto/rasgo-1.mp3", 0.00, 1.23, -3),
    "rasgo2": (AQUI / "bruto/rasgo-2.mp3", 0.22, 1.30, -3),
    "rasgo3": (AQUI / "bruto/rasgo-3.mp3", 0.00, 1.40, -3),
    "rasguinho": (AQUI / "bruto/rasgo-4.mp3", 0.14, 0.46, -6),
    "pop": (AQUI / "bruto/pop-2.mp3", 0.00, 0.145, -9),
    "brilho": (AQUI / "bruto/brilho-1.mp3", 0.18, 1.80, -15),
    "brilho2": (AQUI / "bruto/brilho-2.mp3", 0.12, 2.24, -13),
    "embrulho": (PROMO / "papel-2.mp3", 0.00, 1.30, -8),
    "papel": (PROMO / "papel-1.mp3", 0.15, 0.95, -12),
    "lapis1": (PROMO / "lapis-1.mp3", 0.00, 0.78, -9),
    "lapis2": (PROMO / "lapis-2.mp3", 0.00, 0.89, -9),
    "lapis3": (PROMO / "lapis-3.mp3", 0.00, 0.93, -9),
    "carimbo": (PROMO / "carimbo-1.mp3", 0.00, 0.19, -5),
    "pouso": (PROMO / "baque-2.mp3", 0.10, 0.22, -8),
    "vento": (PROMO / "vento-2.mp3", 0.00, 0.36, -14),
}
# som da oncinha: (arquivo, início, duração, volume em dB, filtro do ffmpeg)
RUGIDOS = {
    "onca": (AQUI / "bruto/rugido-1.mp3", 0.19, 2.35, -3, None),
    # 1,7× mais agudo (e por isso 1,7× mais curto): o rugido vira um "rawr" de filhote
    "rawr": (AQUI / "bruto/rugido-1.mp3", 0.19, 2.35, -5, f"aresample={SR},asetrate={int(SR * 1.7)},aresample={SR},highpass=f=200"),
    # gravação baixa (rosnado a ~−41 dB RMS): ganho alto e corte só no rosnado
    "filhote": (AQUI / "bruto/rugido-2.mp3", 1.95, 0.85, 18, "highpass=f=150"),
    "ronrom": (AQUI / "bruto/ronrom-1.mp3", 0.00, 0.53, -3, None),
}


def ler(arq: Path, ini: float, dur: float, af: str | None = None) -> np.ndarray:
    bruto = subprocess.run(["ffmpeg", "-v", "error", "-ss", str(ini), "-t", str(dur), "-i", str(arq), *(["-af", af] if af else []),
                            "-f", "f32le", "-ac", "2", "-ar", str(SR), "-"], capture_output=True, check=True).stdout
    a = np.frombuffer(bruto, np.float32).reshape(-1, 2).copy()
    n = min(len(a), int(0.005 * SR)), min(len(a), int(0.06 * SR))
    a[:n[0]] *= np.linspace(0, 1, n[0])[:, None]              # pontas suaves, sem estalo
    a[len(a) - n[1]:] *= np.linspace(1, 0, n[1])[:, None]
    return a


def roteiro(rugido: str | None = None) -> tuple[float, list[tuple[float, str]]]:
    D = json.loads((AQUI.parent / "produtos.json").read_text(encoding="utf-8"))
    T = D["tempos"]
    durs = [T["capa"], T["abertura"]] + [T["produto"]] * len(D["produtos"]) + [T["final"]]
    inis = [0.0]
    for d in durs[:-1]:
        inis.append(inis[-1] + d - T["rasgo"])
    ev: list[tuple[float, str]] = []
    em = lambda base, lista: ev.extend((base + t, s) for t, s in lista)
    # capa: embrulho, etiqueta pousa, escrita, beijo carimbado, rabiscos
    em(inis[0], [(0.05, "embrulho"), (0.75, "pouso"), (0.7, "lapis1"), (1.2, "carimbo"), (1.25, "lapis2")])
    # abertura: título letra a letra, a onça sendo desenhada, brilho, nota
    em(inis[1], [(0.62, "pop"), (0.9, "pop"), (1.0, "lapis3"), (1.75, "lapis1"), (2.35, "lapis2"), (2.3, "brilho2"), (2.6, "lapis3")])
    for i, p in enumerate(D["produtos"]):
        b = inis[2 + i]
        em(b, [(0.3, "vento"), (1.0, "pouso"), (0.15, "papel"), (1.08, "pop"), (1.05, "lapis1"), (1.3, "lapis2"), (1.95, "lapis3")])
        if p.get("enfeite") == "onca":
            em(b, [(2.0, "lapis1"), (2.5, "lapis2")])
        elif p.get("enfeite") == "beijo":
            em(b, [(2.1, "carimbo")])
        else:
            em(b, [(2.2, "lapis3")])
        if p.get("brilho"):
            em(b, [(2.25, "brilho")])
    # final: título, nota, cada produto que cai, a onça, brilho
    bf = inis[-1]
    em(bf, [(0.55, "pop"), (1.0, "lapis1"), (3.2, "lapis3"), (3.9, "lapis1"), (3.6, "brilho2")])
    em(bf, [(0.9 + i * 0.22 + 0.18, "pop") for i in range(len(D["produtos"]))])
    # rugido: quando a onça começa a ser desenhada na abertura (tl 1.0) e no final (tl 3.2), como em cena.js
    if rugido:
        ev += [(inis[1] + 1.0, "rugido"), (bf + 3.2, "rugido")]
    # rasgos: o papel rasga no começo do rasgo; o "vento" quando as metades saem
    for k in range(len(durs) - 1):
        t = inis[k] + durs[k] - T["rasgo"]
        ev += [(t, f"rasgo{k % 3 + 1}"), (t + 0.5, "vento")]
    return inis[-1] + durs[-1], ev


def mixar(rugido: str | None = None) -> Path:
    dur, ev = roteiro(rugido)
    cache = {k: ler(a, i, d) * 10 ** (db / 20) for k, (a, i, d, db) in SONS.items()}
    if rugido:
        a, i, d, db, af = RUGIDOS[rugido]
        cache["rugido"] = ler(a, i, d, af) * 10 ** (db / 20)
    mix = np.zeros((int(dur * SR) + SR, 2), np.float32)
    rng = np.random.default_rng(10)
    for t, s in ev:
        a = cache[s] * 10 ** (rng.uniform(-1.5, 1.5) / 20)     # leve variação, para não soar repetido
        i = int(t * SR)
        mix[i:i + len(a)] += a[:len(mix) - i]
    mix = mix[:int(dur * SR)]
    bruto = SAIDA / "_som-bruto.f32"
    bruto.write_bytes(mix.astype(np.float32).tobytes())
    ent = ["ffmpeg", "-hide_banner", "-f", "f32le", "-ac", "2", "-ar", str(SR), "-i", str(bruto)]
    alvo = "loudnorm=I=-14:TP=-1.5:LRA=11"
    # 1ª passagem mede, 2ª aplica ganho linear (como em receitas/promo/som/mixar.py)
    m = subprocess.run(ent + ["-af", alvo + ":print_format=json", "-f", "null", "-"], capture_output=True, text=True, encoding="utf-8", errors="replace")
    j = json.loads(m.stderr[m.stderr.rindex("{"):m.stderr.rindex("}") + 1])
    af = (f"{alvo}:measured_I={j['input_i']}:measured_TP={j['input_tp']}:measured_LRA={j['input_lra']}"
          f":measured_thresh={j['input_thresh']}:offset={j['target_offset']}:linear=true,aresample={SR}")
    wav = SAIDA / f"som-unboxing{f'-rugido-{rugido}' if rugido else ''}.wav"
    subprocess.run(ent + ["-v", "error", "-y", "-af", af, str(wav)], check=True)
    bruto.unlink()
    print(f"{wav} ({dur:.1f} s, {len(ev)} efeitos)")
    return wav


SAIDA = RAIZ / "saida" / "unboxing"
if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--rugido", choices=RUGIDOS)
    a = ap.parse_args()
    SAIDA.mkdir(parents=True, exist_ok=True)
    wav = mixar(a.rugido)
    video = SAIDA / "unboxing-maquiagem.mp4"
    if a.rugido and video.exists():
        # mesma imagem, só o áudio novo (sem renderizar de novo)
        out = SAIDA / f"unboxing-maquiagem-rugido-{a.rugido}.mp4"
        subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", str(video), "-i", str(wav), "-map", "0:v", "-map", "1:a",
                        "-c:v", "copy", "-c:a", "aac", "-b:a", "160k", "-shortest", "-movflags", "+faststart", str(out)], check=True)
        print(out)
