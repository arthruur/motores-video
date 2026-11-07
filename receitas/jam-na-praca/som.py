"""Som do reel "Saudade da Jam": a trilha do próprio show (montar_reel1.py) + efeitos reais (CC0)
nos tempos de roteiro.json. Créditos dos efeitos em receitas/promo/som/creditos.json.

    python receitas/jam-na-praca/som.py   →  saida/jam-na-praca/reel1-som.wav
"""
import json
import subprocess
from pathlib import Path

AQUI = Path(__file__).parent
BRUTO = AQUI.parent / "promo" / "som" / "bruto"
SAIDA = AQUI.parents[1] / "saida" / "jam-na-praca"

# som: arquivo, início e duração do trecho útil, volume em dB (por cima da música, que vem a -14 LUFS)
SONS = {
    "lapis":     ("lapis-1", 0.00, 0.78, -2),
    "lapis2":    ("lapis-2", 0.00, 0.89, -2),
    "lapis3":    ("lapis-3", 0.00, 0.93, -2),
    "carimbo":   ("carimbo-1", 0.00, 0.19, -2),
    "carimbao":  ("carimbo-2", 0.00, 0.48, 0),
    "papel":     ("papel-1", 0.15, 0.95, -6),
    "triangulo": ("triangulo-1", 2.17, 0.75, -8),
    "vento":     ("vento-1", 0.00, 0.49, -8),
    "vento2":    ("vento-2", 0.00, 0.36, -6),
    "ventos":    ("vento-3", 0.00, 1.20, -6),
    "baque":     ("baque-1", 0.00, 0.25, -4),
}


def eventos(roteiro: dict) -> list[tuple[float, str]]:
    ev = []
    for it in roteiro["itens"]:
        if "som" in it:
            ev.append((it["ini"] + (0.15 if it["tipo"] == "brilho" else 0), it["som"]))
    # solo de conga: um baque seco em cada crédito que entra
    B = roteiro["bebop"]
    for i, pl in enumerate(B["planos"]):
        if pl.get("nome"):
            ev.append((B["ini"] + i * B["compasso"] + 0.05, "baque"))
    return sorted(ev)


def main():
    roteiro = json.loads((AQUI / "roteiro.json").read_text(encoding="utf-8"))
    ev = eventos(roteiro)
    args = ["ffmpeg", "-v", "error", "-y", "-i", str(SAIDA / "reel1-trilha.wav")]
    filtros, rot = [], ["[0:a]"]
    for i, (t, nome) in enumerate(ev, start=1):
        arq, ini, dur, db = SONS[nome]
        args += ["-i", str(BRUTO / f"{arq}.mp3")]
        ms = int(t * 1000)
        filtros.append(f"[{i}:a]atrim={ini}:{ini + dur},asetpts=PTS-STARTPTS,afade=t=out:st={dur - 0.08}:d=0.08,"
                       f"aresample=48000,aformat=channel_layouts=stereo,volume={db}dB,adelay={ms}|{ms}[e{i}]")
        rot.append(f"[e{i}]")
    filtros.append(f"{''.join(rot)}amix=inputs={len(rot)}:normalize=0:duration=first,alimiter=limit=0.8:level=0[a]")
    args += ["-filter_complex", ";".join(filtros), "-map", "[a]", "-ar", "48000", str(SAIDA / "reel1-som.wav")]
    subprocess.run(args, check=True)
    print(SAIDA / "reel1-som.wav", f"{len(ev)} efeitos")


if __name__ == "__main__":
    main()
