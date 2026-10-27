"""Som dos promos do Bistrô 153: efeitos reais (CC0) no tempo de cada animação + trilha por baixo. Só ffmpeg.

    python receitas/promo/som/mixar.py pimenta              # trilha + efeitos
    python receitas/promo/som/mixar.py pimenta --sem-trilha # só efeitos (para usar a música do Instagram)

Junta o áudio ao vídeo já renderizado em saida/receitas-bistro/promo-<nome>.mp4.
Créditos e licenças em creditos.json (a trilha é CC BY: crédito obrigatório no texto do post).
"""
from __future__ import annotations

import argparse
import json
import subprocess
from pathlib import Path

AQUI = Path(__file__).parent
SAIDA = AQUI.parents[2] / "saida" / "receitas-bistro"

# som: arquivo em bruto/, início e duração do trecho útil (medidos com silencedetect), volume em dB
SONS = {
    "papel":     ("papel-1", 0.15, 0.95, -12),
    "lapis":     ("lapis-1", 0.00, 0.78, -6),
    "lapis2":    ("lapis-2", 0.00, 0.89, -6),
    "lapis3":    ("lapis-3", 0.00, 0.93, -6),
    "carimbo":   ("carimbo-1", 0.00, 0.19, -4),
    "carimbao":  ("carimbo-2", 0.00, 0.48, -3),
    "baque":     ("baque-1", 0.00, 0.25, -2),
    "baque2":    ("baque-2", 0.10, 0.22, -2),
    "vidro":     ("pote-1", 0.00, 0.39, -3),
    "fita":      ("fita-1", 1.63, 0.55, -8),
    "triangulo": ("triangulo-1", 2.17, 0.75, -10),
    "vento":     ("vento-1", 0.00, 0.49, -6),
    "vento2":    ("vento-2", 0.00, 0.36, -6),
    "ventos":    ("vento-3", 0.00, 1.20, -12),
}

PECAS = json.loads((AQUI.parent / "pecas.json").read_text(encoding="utf-8"))["pecas"]


def roteiro(nome: str) -> dict:
    """Eventos sonoros nos mesmos tempos de promo.js (A, cortina, B, estrela, C)."""
    p = PECAS[nome]
    linha = p.get("tipo") == "linha"
    B = 5.2
    C = B + (6.2 if linha else 4.35)
    l1 = len(p["titulo"][0].replace(" ", ""))
    ev = [(0.00, "papel"), (0.35, "lapis"),
          *([(0.9 + len("".join(p["titulo"]).replace(" ", "")) * 0.075 + 0.25, "lapis3")] if p.get("subtitulo") else []),
          (0.95, "carimbo"), (0.95 + l1 * 0.075, "carimbo"),          # letras do título (cada linha)
          (1.83, "baque"),                                              # renda na mesa
          (2.62, "carimbao"), (2.70, "triangulo"),                      # estrela "artesanal"
          (4.75, "ventos"), (5.40, "papel"),                            # cortina de azulejos
          (B + 0.42, "vento2")]
    if linha:
        for i in range(len(p["potes"])):
            t = B + 0.5 + i * (0.42 if len(p["potes"]) > 6 else 0.55)
            ev += [(t + 0.17, "vidro"), (t + 0.4, "lapis")]
        ev += [(B + 3.65, "triangulo")]
    else:
        ev += [(B + 1.3 + i * 0.45, "lapis") for i in range(len(p.get("rabiscos", [])))]
        ev += [(B + 0.82, "vidro"), (B + 1.18, "fita"), (B + 1.35, "fita"),
               (B + 1.15, "lapis2"), (B + 1.95, "lapis3"), (B + 1.65, "triangulo"), (B + 2.85, "triangulo")]
    ev += [(C - 0.55, "vento"), (C + 0.07, "vento2"),                   # estrela cresce e revela o fim
           (C + 0.25, "papel"), (C + 0.38, "carimbao"),                 # monograma carimbado
           (C + 0.85, "lapis"), (C + 1.6, "carimbo"), (C + 1.95, "carimbo"), (C + 2.75, "triangulo")]
    if not linha:
        ev += [(C + 2.17 + i * 0.12, "vidro") for i in range(5)]       # prateleira
    return {"duracao": round(C + 3.45, 3), "trilha": ("musica-forro", 0.0), "eventos": ev}


def mixar(nome: str, sem_trilha: bool) -> Path:
    r = roteiro(nome)
    dur = r["duracao"]
    ent, filtros, rotulos = [], [], []
    for i, (t, som) in enumerate(r["eventos"]):
        arq, ini, d, db = SONS[som]
        ent += ["-i", str(AQUI / "bruto" / f"{arq}.mp3")]
        ms = round(t * 1000)
        # corta o trecho, suaviza as pontas, ajusta o volume e põe no instante certo (mono → centro)
        filtros.append(f"[{i}:a]atrim={ini}:{ini + d},asetpts=PTS-STARTPTS,aformat=sample_rates=48000:channel_layouts=stereo,"
                       f"afade=t=in:d=0.005,afade=t=out:st={max(0, d - 0.08):.3f}:d=0.08,volume={db}dB,adelay={ms}|{ms}[e{i}]")
        rotulos.append(f"[e{i}]")
    n = len(rotulos)
    filtros.append(f"{''.join(rotulos)}amix=inputs={n}:normalize=0:duration=longest,apad=whole_dur={dur}[efeitos]")
    final = "[efeitos]"
    if not sem_trilha:
        arq, ini = r["trilha"]
        ent += ["-ss", str(ini), "-t", str(dur), "-i", str(AQUI / "bruto" / f"{arq}.mp3")]
        # trilha baixa por baixo dos efeitos, com entrada rápida e saída longa
        filtros.append(f"[{n}:a]aformat=sample_rates=48000:channel_layouts=stereo,volume=-9dB,afade=t=in:d=0.25,"
                       f"afade=t=out:st={dur - 1.6}:d=1.6[trilha]")
        filtros.append("[efeitos][trilha]amix=inputs=2:normalize=0[mix]")
        final = "[mix]"
    alvo = "loudnorm=I=-14:TP=-1.5:LRA=11"
    base = ["ffmpeg", "-y", "-hide_banner", *ent, "-filter_complex"]
    fc = ";".join(filtros) + f";{final}"
    # 1ª passagem mede, 2ª aplica ganho linear (como em exemplos/explicativo)
    m = subprocess.run(base + [fc + alvo + ":print_format=json[a]", "-map", "[a]", "-t", str(dur), "-f", "null", "-"],
                       capture_output=True, text=True, encoding="utf-8", errors="replace")
    if m.returncode:
        raise SystemExit(m.stderr[-1500:])
    j = json.loads(m.stderr[m.stderr.rindex("{"):m.stderr.rindex("}") + 1])
    fc += (f"{alvo}:measured_I={j['input_i']}:measured_TP={j['input_tp']}:measured_LRA={j['input_lra']}"
           f":measured_thresh={j['input_thresh']}:offset={j['target_offset']}:linear=true,aresample=48000[a]")
    wav = SAIDA / f"som-{nome}{'-efeitos' if sem_trilha else ''}.wav"
    subprocess.run(base + [fc, "-v", "error", "-map", "[a]", "-t", str(dur), str(wav)], check=True)
    return wav


def juntar(nome: str, wav: Path, sem_trilha: bool) -> Path:
    video = SAIDA / f"promo-{nome}.mp4"
    # com trilha vai para uma pasta à parte; só efeitos fica ao lado do vídeo mudo
    pasta = SAIDA if sem_trilha else SAIDA / "com-musica"
    pasta.mkdir(exist_ok=True)
    out = pasta / f"promo-{nome}-com-{'som-so-efeitos' if sem_trilha else 'musica'}.mp4"
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", str(video), "-i", str(wav), "-map", "0:v", "-map", "1:a",
                    "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-shortest", str(out)], check=True)
    return out


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("nome", choices=PECAS)
    ap.add_argument("--sem-trilha", action="store_true")
    a = ap.parse_args()
    w = mixar(a.nome, a.sem_trilha)
    print(juntar(a.nome, w, a.sem_trilha))
