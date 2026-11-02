"""Prepara a peça Guerra Verde: texturas de papel e a narração de cada cena, com os tempos do vídeo.

    python receitas/guerra-verde/preparar.py            texturas + narração (edge-tts) + tempos.json
    python receitas/guerra-verde/preparar.py --texturas só as texturas

- texturas/kraft.jpg: papel kraft com manchas e fibras (o fundo de todas as cenas).
- texturas/grao.png: ruído que dá textura de papel impresso.
- voz/<cena>.wav e .json: a fala de cada cena, sintetizada separada (assim cada cena tem o tempo da própria fala).
- tempos.json: início e duração de cada cena, quando a fala começa, as palavras (para a legenda) e as "marcas",
  o instante de palavras-chave (a árvore cai em "cai", o carimbo bate em "alerta"). cena.js e som/mixar.py leem daqui.

Regra dos tempos: a cena dura o que a fala pede (folga antes e depois), nunca menos que "minimo"; a próxima
começa na transição da anterior, e a fala dela espera a transição andar (metade da transição + 0,35 s).
"""
from __future__ import annotations

import json
import os
import re
import subprocess
import sys
import unicodedata
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

AQUI = Path(__file__).parent
RAIZ = AQUI.parents[1]


def campo(rng, g: int, L: int) -> np.ndarray:
    """Ruído suave entre -1 e 1 (grade g×g ampliada)."""
    c = rng.normal(0, 1, (g, g))
    c = np.asarray(Image.fromarray(((c - c.min()) / np.ptp(c) * 255).astype("uint8")).resize((L, L), Image.BICUBIC), float)
    return (c / 255 - 0.5) * 2


def kraft(arq: str = "kraft.jpg", base: str = "#d9c09a", semente: int = 7, w: int = 1080, h: int = 1920) -> None:
    """Papel kraft: manchas largas, fibras claras e escuras e alguns pontinhos de celulose."""
    rng = np.random.default_rng(semente)
    c = np.array([int(base[i:i + 2], 16) for i in (1, 3, 5)], float)
    L = max(w, h)
    mancha = campo(rng, 7, L)[:h, :w] * 0.05 + campo(rng, 30, L)[:h, :w] * 0.025 + campo(rng, 160, L)[:h, :w] * 0.012
    img = Image.fromarray(np.clip(c[None, None] * (1 + mancha[..., None]), 0, 255).astype("uint8"))
    d = ImageDraw.Draw(img, "RGBA")
    for _ in range(2600):
        x, y = rng.uniform(0, w), rng.uniform(0, h)
        a, n = rng.uniform(0, 2 * np.pi), rng.uniform(10, 46)
        claro = rng.random() < 0.45
        tinta = (250, 236, 210, 46) if claro else (int(c[0] * .62), int(c[1] * .58), int(c[2] * .5), 40)
        pts = [(x, y)]
        for _ in range(5):
            a += rng.normal(0, 0.45)
            x, y = x + np.cos(a) * n / 5, y + np.sin(a) * n / 5
            pts.append((x, y))
        d.line(pts, fill=tinta, width=1)
    for _ in range(500):
        x, y, r = rng.uniform(0, w), rng.uniform(0, h), rng.uniform(0.6, 1.8)
        d.ellipse((x - r, y - r, x + r, y + r), fill=(90, 62, 36, 70))
    img.filter(ImageFilter.GaussianBlur(0.45)).save(AQUI / "texturas" / arq, quality=90)
    print(arq)


def grao() -> None:
    rng = np.random.default_rng(25)
    r = rng.normal(128, 38, (720, 720)).clip(0, 255).astype("uint8")
    Image.fromarray(r, "L").filter(ImageFilter.GaussianBlur(0.6)).save(AQUI / "texturas" / "grao.png")


def chave(p: str) -> str:
    """Palavra sem acento, pontuação e maiúscula, para achar as marcas na fala."""
    p = unicodedata.normalize("NFD", p.lower())
    return re.sub(r"[^a-z0-9-]", "", "".join(ch for ch in p if unicodedata.category(ch) != "Mn"))


def carregar_env() -> None:
    """Chaves de API do .env na raiz do repositório (fora do git), sem sobrescrever o que já está no ambiente."""
    env = RAIZ / ".env"
    if env.exists():
        for ln in env.read_text(encoding="utf-8").splitlines():
            if "=" in ln and not ln.lstrip().startswith("#"):
                k, v = ln.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip())


def desacelerar(wav: Path, r: dict, ritmo: float) -> None:
    """Muda o andamento da fala sem mudar o tom (atempo do ffmpeg) e leva os tempos das palavras junto.
    O ajuste de velocidade da API do ElevenLabs v3 dá resultado irregular; aqui é exato."""
    tmp = wav.with_name(wav.stem + "_tmp.wav")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(wav), "-af", f"atempo={ritmo}", str(tmp)], check=True)
    tmp.replace(wav)
    for p in r["palavras"]:
        p["inicio"], p["fim"] = round(p["inicio"] / ritmo, 3), round(p["fim"] / ritmo, 3)
    r["duracao"] = round(r["duracao"] / ritmo, 3)
    r["ritmo"] = ritmo


def narrar() -> None:
    sys.path.insert(0, str(RAIZ))
    from motores.voz import sintetizar

    carregar_env()
    R = json.loads((AQUI / "roteiro.json").read_text(encoding="utf-8"))
    V, T = R["voz"], R["tempos"]
    for k, v in V.get("ambiente", {}).items():   # opções do provedor, ex.: ELEVENLABS_MODEL
        os.environ[k] = v
    (AQUI / "voz").mkdir(exist_ok=True)
    cenas, ini, trans_ant, rotulo = [], 0.0, 0.0, ""
    for k, c in enumerate(R["cenas"]):
        wav = AQUI / "voz" / f"{c['id']}.wav"
        meta = wav.with_suffix(".json")
        # só sintetiza de novo se a fala, a voz ou o modelo mudaram
        assinatura = [c["fala"], c.get("fala_voz"), V["provedor"], V["voz"], V.get("ambiente", {}), V.get("ritmo", 1.0)]
        antigo = json.loads(meta.read_text(encoding="utf-8")) if meta.exists() else {}
        if antigo.get("assinatura") == assinatura:
            r = antigo
        else:
            r = sintetizar(c["fala"], V["provedor"], V["voz"], wav, velocidade=V.get("velocidade", 1.0),
                           pronuncia=AQUI / "pronuncia.json", permitir_pago=V.get("permitir_pago", False),
                           falado=c.get("fala_voz"))
            if V.get("ritmo", 1.0) != 1.0:
                desacelerar(wav, r, V["ritmo"])
            r["assinatura"] = assinatura
            meta.write_text(json.dumps(r, ensure_ascii=False, indent=1), encoding="utf-8")
        rotulo = r.get("rotulo", rotulo)
        fala = round(0.6 if k == 0 else trans_ant / 2 + 0.35, 3)
        ultima = k == len(R["cenas"]) - 1
        dur = round(max(c["minimo"], fala + r["duracao"] + (T["final_depois"] if ultima else T["depois_da_fala"])), 3)
        palavras = [{"texto": p["texto"], "inicio": round(fala + p["inicio"], 3), "fim": round(fala + p["fim"], 3)} for p in r["palavras"]]
        marcas = {}
        for nome, palavra in c.get("marcas", {}).items():
            achou = [p for p in palavras if chave(p["texto"]) == chave(palavra)]
            if not achou:
                raise SystemExit(f"cena {c['id']}: não achei a palavra '{palavra}' na fala")
            marcas[nome] = achou[0]["inicio"]
        trans = c.get("transicao", {"tipo": "corte", "dur": 0})
        cenas.append({"id": c["id"], "ini": round(ini, 3), "dur": dur, "fala": fala, "fala_dur": r["duracao"],
                      "transicao": trans, "palavras": palavras, "marcas": marcas})
        print(f"{c['id']:13} {ini:6.2f} s  dura {dur:5.2f} s  fala {r['duracao']:.2f} s")
        ini += dur - trans["dur"]
        trans_ant = trans["dur"]
    duracao = round(cenas[-1]["ini"] + cenas[-1]["dur"], 3)
    (AQUI / "tempos.json").write_text(json.dumps({"duracao": duracao, "rotulo": R.get("rotulo"), "rotulo_voz": rotulo, "cenas": cenas},
                                                 ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"tempos.json: {duracao:.1f} s")


if __name__ == "__main__":
    (AQUI / "texturas").mkdir(exist_ok=True)
    kraft()
    grao()
    if "--texturas" not in sys.argv:
        narrar()
