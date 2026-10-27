"""Som do vídeo da parceria Bistrô 153 + Mangaio: trilha "Baião do Mangaio" (gerada, sem direitos de terceiros)
+ efeitos CC0 dos promos, cada um na batida do roteiro de parceria.html. Só ffmpeg.

    node receitas/mangaio/trilha.mjs          # gera som/baiao-mangaio.wav
    python receitas/mangaio/mixar.py          # junta trilha + efeitos ao vídeo renderizado
"""
import json
import subprocess
import sys
from pathlib import Path

AQUI = Path(__file__).parent
sys.path.insert(0, str(AQUI.parent / "promo" / "som"))
from mixar import SONS  # noqa: E402  (os mesmos recortes de efeitos dos promos)

BRUTO = AQUI.parent / "promo" / "som" / "bruto"
SAIDA = AQUI.parents[1] / "saida" / "receitas-bistro"
SEG = 60 / 116
PEGAS = [10, 12, 13.5, 15, 16.5, 18, 19.5, 21]
EVENTOS = (                                                    # (batida, som)
    [(0.6, "carimbo"), (1.8, "carimbo"), (2.1, "baque2"), (3.4, "lapis3"), (8, "vento2")]
    + [(b, "baque") for b in PEGAS]                             # ingredientes caindo no cesto
    + [(26.5, "vento2"), (28, "ventos"), (31, "carimbao"), (33.2, "baque2"), (36.5, "lapis2")]
    + [(36 + i + 0.02, "vidro") for i in range(8)]              # potes no cesto
    + [(44.6, "vento"), (46.5, "carimbo"), (47.1, "carimbo"), (47.6, "baque2"), (48.4, "lapis"),
       (50.2, "carimbo"), (50.6, "carimbo"), (52.6, "papel")]
    + [(53.8 + i * 0.5 + 0.3, "vidro") for i in range(8)]       # prateleira do fim
    + [(56, "carimbao"), (56.05, "triangulo")]
)
DUR = 60 * SEG + 1.6


def main() -> None:
    ent, filtros, rot = [], [], []
    for i, (b, som) in enumerate(EVENTOS):
        arq, ini, d, db = SONS[som]
        ent += ["-i", str(BRUTO / f"{arq}.mp3")]
        ms = round(b * SEG * 1000)
        filtros.append(f"[{i}:a]atrim={ini}:{ini + d},asetpts=PTS-STARTPTS,aformat=sample_rates=48000:channel_layouts=stereo,"
                       f"afade=t=in:d=0.005,afade=t=out:st={max(0, d - 0.08):.3f}:d=0.08,volume={db - 2}dB,adelay={ms}|{ms}[e{i}]")
        rot.append(f"[e{i}]")
    n = len(rot)
    ent += ["-i", str(AQUI / "som" / "baiao-mangaio.wav")]
    filtros.append(f"{''.join(rot)}amix=inputs={n}:normalize=0:duration=longest,apad=whole_dur={DUR:.3f}[ef]")
    filtros.append(f"[{n}:a]aformat=sample_rates=48000:channel_layouts=stereo,volume=2dB[tr]")
    filtros.append("[ef][tr]amix=inputs=2:normalize=0[mix]")
    alvo = "loudnorm=I=-14:TP=-1.5:LRA=11"
    base = ["ffmpeg", "-y", "-hide_banner", *ent, "-filter_complex"]
    fc = ";".join(filtros) + ";[mix]"
    m = subprocess.run(base + [fc + alvo + ":print_format=json[a]", "-map", "[a]", "-t", f"{DUR:.3f}", "-f", "null", "-"],
                       capture_output=True, text=True, encoding="utf-8", errors="replace")
    if m.returncode:
        raise SystemExit(m.stderr[-1500:])
    j = json.loads(m.stderr[m.stderr.rindex("{"):m.stderr.rindex("}") + 1])
    fc += (f"{alvo}:measured_I={j['input_i']}:measured_TP={j['input_tp']}:measured_LRA={j['input_lra']}"
           f":measured_thresh={j['input_thresh']}:offset={j['target_offset']}:linear=true,aresample=48000[a]")
    wav = AQUI / "som" / "parceria-mix.wav"
    subprocess.run(base + [fc, "-v", "error", "-map", "[a]", "-t", f"{DUR:.3f}", str(wav)], check=True)
    out = SAIDA / "mangaio-parceria.mp4"
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", str(SAIDA / "mangaio-parceria-mudo.mp4"), "-i", str(wav),
                    "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-shortest", str(out)], check=True)
    print(out)


if __name__ == "__main__":
    main()
