"""Som da peça Guerra Verde: narração, efeitos nos tempos da animação, ambiente da floresta e música. Só numpy e ffmpeg.

    python receitas/guerra-verde/som/mixar.py      → saida/guerra-verde/som.wav (−14 LUFS)

O gerar.mjs chama este script e junta o áudio ao vídeo. Os tempos vêm de tempos.json (a narração e as marcas,
como o "cai" da árvore) e os instantes dentro de cada cena espelham cena.js: mudou lá, muda aqui.
Cada som é levado a um nível RMS de referência (NIVEL) antes de entrar, para os arquivos de origens diferentes
ficarem coerentes; a música e a floresta baixam enquanto a voz fala.
Créditos: som/creditos.json (floresta, motores, música), receitas/promo/som/creditos.json e receitas/unboxing/som/creditos.json.
"""
from __future__ import annotations

import json
import subprocess
from pathlib import Path

import numpy as np

AQUI = Path(__file__).parent
RECEITA = AQUI.parent
RAIZ = AQUI.parents[2]
PROMO = RAIZ / "receitas" / "promo" / "som" / "bruto"
UNBOX = RAIZ / "receitas" / "unboxing" / "som" / "bruto"
BRUTO = AQUI / "bruto"
SAIDA = RAIZ / "saida" / "guerra-verde"
SR = 48000

# som: (arquivo, início e duração do trecho útil em s — medidos com o perfil de RMS —, nível RMS alvo em dBFS, filtro do ffmpeg)
SONS = {
    "lapis1": (PROMO / "lapis-1.mp3", 0.00, 0.78, -33, None),
    "lapis2": (PROMO / "lapis-2.mp3", 0.00, 0.89, -33, None),
    "lapis3": (PROMO / "lapis-3.mp3", 0.00, 0.93, -33, None),
    "risco": (PROMO / "lapis-2.mp3", 0.00, 0.89, -22, f"aresample={SR},asetrate={int(SR * 0.7)},aresample={SR}"),
    "papel": (PROMO / "papel-1.mp3", 0.15, 0.95, -34, None),
    "folha": (PROMO / "papel-2.mp3", 0.00, 1.30, -31, None),
    "carimbo": (PROMO / "carimbo-1.mp3", 0.00, 0.19, -20, None),
    "vento": (PROMO / "vento-1.mp3", 0.00, 1.40, -30, None),
    "baque": (PROMO / "baque-2.mp3", 0.10, 0.22, -24, None),
    "tombo": (PROMO / "baque-1.mp3", 0.00, 0.60, -19, f"aresample={SR},asetrate={int(SR * 0.55)},aresample={SR},lowpass=f=900"),
    "pop": (UNBOX / "pop-2.mp3", 0.00, 0.145, -31, None),
    "brilho": (UNBOX / "brilho-1.mp3", 0.18, 1.80, -36, None),
    "estalo": (BRUTO / "estalo.ogg", 24.30, 0.60, -20, "highpass=f=120"),
    "estalo2": (BRUTO / "estalo.ogg", 43.90, 0.60, -24, "highpass=f=120"),
    "motosserra": (BRUTO / "motosserra.ogg", 30.50, 2.40, -36, "lowpass=f=3500"),
    "carro": (BRUTO / "carro.ogg", 29.00, 2.60, -31, None),
    "barco": (BRUTO / "barco.ogg", 80.00, 2.60, -33, None),
    "helicoptero": (BRUTO / "helicoptero.ogg", 8.00, 3.20, -28, None),
}
CAMAS = {  # sons longos de fundo: (arquivo, início, nível RMS alvo)
    "floresta": (BRUTO / "floresta.ogg", 17.5, -40),
    "musica": (BRUTO / "musica.ogg", 0.6, -37),
}


def ler(arq: Path, ini: float, dur: float | None, af: str | None = None) -> np.ndarray:
    bruto = subprocess.run(["ffmpeg", "-v", "error", "-ss", str(ini), *(["-t", str(dur)] if dur else []), "-i", str(arq),
                            *(["-af", af] if af else []), "-f", "f32le", "-ac", "2", "-ar", str(SR), "-"],
                           capture_output=True, check=True).stdout
    a = np.frombuffer(bruto, np.float32).reshape(-1, 2).copy()
    n = min(len(a), int(0.005 * SR)), min(len(a), int(0.08 * SR))
    a[:n[0]] *= np.linspace(0, 1, n[0])[:, None]              # pontas suaves, sem estalo
    a[len(a) - n[1]:] *= np.linspace(1, 0, n[1])[:, None]
    return a


def nivel(a: np.ndarray, alvo_db: float) -> np.ndarray:
    """Leva o trecho ao RMS alvo, medindo só a parte que soa (acima de −50 dB do pico)."""
    m = np.abs(a).max(axis=1)
    ativo = a[m > m.max() * 10 ** (-50 / 20)] if m.max() > 0 else a
    rms = np.sqrt(np.mean(ativo ** 2)) + 1e-9
    return a * (10 ** (alvo_db / 20) / rms)


def bip() -> np.ndarray:
    """Dois bipes curtos e macios (sintetizados): o satélite."""
    t = np.arange(int(0.09 * SR)) / SR
    env = np.sin(np.pi * t / t[-1]) ** 2
    um = lambda f: np.sin(2 * np.pi * f * t) * env * 0.5
    a = np.zeros(int(0.3 * SR))
    a[:len(t)] += um(1760)
    a[int(0.13 * SR):int(0.13 * SR) + len(t)] += um(2349)
    return nivel(np.stack([a, a], 1).astype(np.float32), -34)


def roteiro(T: dict) -> list[tuple[float, str, float]]:
    """(instante absoluto, som, ganho extra em dB). Os instantes dentro de cada cena espelham cena.js."""
    ev: list[tuple[float, str, float]] = []
    C = {c["id"]: c for c in T["cenas"]}

    def em(cid: str, lista):
        c = C[cid]
        ev.extend((c["ini"] + t, s, g) for t, s, g in ((x + (0,))[:3] for x in lista))

    M = C["arvore"]["marcas"]
    em("arvore", [(0.0, "motosserra", 0), (0.1, "lapis1"), (0.35, "lapis3"), (0.6, "lapis2"),
                  (M["cai"], "estalo"), (M["cai"] + 0.5, "vento", -4), (M["cai"] + 1.08, "tombo"), (M["cai"] + 1.15, "lapis3"),
                  (M["quase"] - 0.3, "lapis1"), (M["quase"] + 0.45, "bip"), (M["quase"] + 0.45, "brilho")])
    M = C["satelite"]["marcas"]
    em("satelite", [(0.9, "lapis2", -3), (1.0, "lapis1"), (M["inpe"] - 0.1, "lapis3"), (M["inpe"], "bip"), (M["inpe"] + 0.6, "bip", -4)])
    M = C["alerta"]["marcas"]
    em("alerta", [(M["some"], "papel"), (M["some"] + 0.7, "lapis1"), (M["deter"] - 0.15, "lapis2"), (M["deter"] + 0.4, "lapis3"),
                  (M["alerta"] + 0.08, "carimbo"), (M["alerta"] + 0.35, "lapis1")])
    M = C["planejamento"]["marcas"]
    em("planejamento", [(0.0, "folha"), (0.5, "lapis2"), (M["ibama"] - 0.3, "lapis3"), (M["ibama"] + 0.2, "lapis1"),
                        (M["rota"] - 1.9, "lapis2"), (M["rota"] - 1.45, "baque"), (M["rota"] - 1.2, "lapis3"), (M["rota"] - 0.4, "lapis1"),
                        (M["rota"] + 0.1, "lapis2"), (M["rota"] + 0.55, "baque")])
    M = C["caminho"]["marcas"]
    em("caminho", [(0.3, "lapis1"), (0.9, "lapis3"), (M["estrada"] - 0.2, "carro"), (M["estrada"], "lapis2"),
                   (M["rio"] - 0.2, "barco"), (M["rio"] + 0.05, "lapis1"), (M["helicoptero"] - 0.1, "helicoptero"), (M["helicoptero"] + 0.1, "lapis3")])
    M = C["campo"]["marcas"]
    em("campo", [(0.0, "lapis1"), (0.4, "lapis2"), (0.8, "lapis3"), (1.3, "lapis1"),
                 *[(M["confirmam"] + k * 0.22, "lapis1", -3) for k in range(4)],
                 (M["autuam"] - 0.2, "papel"), (M["autuam"] - 0.1, "lapis2"), (M["autuam"] + 0.7, "lapis3")])
    M = C["maquina"]["marcas"]
    em("maquina", [(0.0, "lapis1"), (0.5, "lapis2"), (1.1, "lapis3"), (M["lei"] - 0.1, "lapis2"),
                   (M["inutiliza"], "risco"), (M["inutiliza"] + 0.1, "baque"), (M["inutiliza"] + 0.42, "risco"), (M["inutiliza"] + 0.52, "baque")])
    M = C["volta"]["marcas"]
    em("volta", [(M["espaco"] - 0.1, "lapis2"), (M["espaco"], "bip"), (M["espaco"], "brilho"), (M["chao"], "lapis3")])
    M = C["serie"]["marcas"]
    em("serie", [(0.3, "lapis1"), (0.8, "lapis2"), (M["operacao"] - 0.05, "pop"), (M["verde"] - 0.4, "pop"), (M["verde"] - 0.2, "papel"),
                 (M["hbo"] - 0.5, "lapis3"), (M["hbo"] + 0.4, "lapis1"), (M["hbo"] + 0.3, "brilho", 3)])
    # transições: o zoom leva um "whoosh"; a troca por fusão, um farfalhar de papel
    for c in T["cenas"][:-1]:
        tr = c["transicao"]
        if tr["tipo"] == "zoom":
            ev.append((c["ini"] + c["dur"] - tr["dur"], "vento", 0))
        else:
            ev.append((c["ini"] + c["dur"] - tr["dur"], "papel", -5))
    return ev


def envelope_voz(voz: np.ndarray) -> np.ndarray:
    """0 a 1: onde a voz fala (suavizado ~0,25 s), para baixar a música e a floresta embaixo dela."""
    m = np.abs(voz).max(axis=1)
    j = int(0.05 * SR)
    blocos = m[:len(m) // j * j].reshape(-1, j).max(axis=1)
    ativo = (blocos > 10 ** (-40 / 20)).astype(float)
    k = np.ones(5) / 5
    ativo = np.convolve(np.convolve(ativo, k, "same"), k, "same")
    return np.interp(np.arange(len(m)), np.arange(len(ativo)) * j + j / 2, ativo)


def mixar() -> Path:
    T = json.loads((RECEITA / "tempos.json").read_text(encoding="utf-8"))
    dur = T["duracao"]
    N = int(dur * SR)
    voz = np.zeros((N, 2), np.float32)
    for c in T["cenas"]:
        a = nivel(ler(RECEITA / "voz" / f"{c['id']}.wav", 0, None), -19)
        i = int((c["ini"] + c["fala"]) * SR)
        voz[i:i + len(a)] += a[:N - i]
    sfx = np.zeros((N, 2), np.float32)
    cache = {k: nivel(ler(a, i, d, af), db) for k, (a, i, d, db, af) in SONS.items()}
    cache["bip"] = bip()
    rng = np.random.default_rng(10)
    ev = roteiro(T)
    for t, s, g in ev:
        a = cache[s] * 10 ** ((g + rng.uniform(-1.5, 1.5)) / 20)   # leve variação, para não soar repetido
        i = max(0, int(t * SR))
        sfx[i:i + len(a)] += a[:N - i]
    # camas: floresta o tempo todo; música entrando devagar e crescendo no fim, quando a voz acaba
    cama = np.zeros((N, 2), np.float32)
    tt = np.arange(N) / SR
    for nome, (arq, ini, db) in CAMAS.items():
        a = nivel(ler(arq, ini, dur + 0.5), db)[:N]
        if nome == "musica":
            ganho = np.clip(tt / 3.0, 0, 1) * (1 + 0.8 * np.clip((tt - (dur - 4.5)) / 1.5, 0, 1))
        else:
            ganho = np.clip(tt / 1.0, 0, 1)
        ganho *= np.clip((dur - tt) / 2.5, 0, 1)            # tudo some nos últimos 2,5 s
        cama[:len(a)] += a * ganho[:len(a), None]
    cama *= (1 - 0.5 * envelope_voz(voz))[:, None]          # −6 dB embaixo da voz
    mix = voz + sfx + cama
    SAIDA.mkdir(parents=True, exist_ok=True)
    bruto = SAIDA / "_som-bruto.f32"
    bruto.write_bytes(mix.astype(np.float32).tobytes())
    ent = ["ffmpeg", "-hide_banner", "-f", "f32le", "-ac", "2", "-ar", str(SR), "-i", str(bruto)]
    alvo = "loudnorm=I=-14:TP=-1.5:LRA=11"
    # 1ª passagem mede, 2ª aplica ganho linear (como em receitas/unboxing/som/mixar.py)
    m = subprocess.run(ent + ["-af", alvo + ":print_format=json", "-f", "null", "-"], capture_output=True, text=True, encoding="utf-8", errors="replace")
    j = json.loads(m.stderr[m.stderr.rindex("{"):m.stderr.rindex("}") + 1])
    af = (f"{alvo}:measured_I={j['input_i']}:measured_TP={j['input_tp']}:measured_LRA={j['input_lra']}"
          f":measured_thresh={j['input_thresh']}:offset={j['target_offset']}:linear=true,aresample={SR}")
    wav = SAIDA / "som.wav"
    subprocess.run(ent + ["-v", "error", "-y", "-af", af, str(wav)], check=True)
    bruto.unlink()
    print(f"{wav} ({dur:.1f} s, {len(ev)} efeitos)")
    return wav


if __name__ == "__main__":
    mixar()
