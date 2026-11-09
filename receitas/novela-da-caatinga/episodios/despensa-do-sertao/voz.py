"""Vozes do piloto "A Despensa do Sertão" (Gemini TTS).

    python receitas/novela-da-caatinga/episodios/despensa-do-sertao/voz.py
    -> narracao.wav/.json (UMA tomada com todos os beats) e dona.wav/.json (a fala da Dona Mandioca)

Cada json traz as palavras com tempo (grafia do texto), o env da boca (30/s) e, na narração, o início e o fim
de cada beat (contagem de palavras). Cache: só gera de novo se o texto, a voz ou a direção mudarem.
O modelo "lite" lê a direção em voz alta: para ele vai só o texto. Cota pequena: 1 pedido por arquivo.
"""
from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path

AQUI = Path(__file__).resolve().parent
SERIE = AQUI.parents[1]
RAIZ = SERIE.parents[1]
sys.path.insert(0, str(RAIZ))
sys.path.insert(0, str(SERIE))
sys.stdout.reconfigure(encoding="utf-8")


def carregar_env() -> None:
    env = RAIZ / ".env"
    for ln in env.read_text(encoding="utf-8").splitlines() if env.exists() else []:
        if "=" in ln and not ln.lstrip().startswith("#"):
            k, v = ln.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip())


def gerar(nome: str, texto: str, voz: str, perfil: str, direcao: str | None, ritmo: float, modelos: list[str]) -> dict:
    from motores.voz import sintetizar
    import preparar  # envelope(), prompt(), andamento()

    wav, meta = AQUI / f"{nome}.wav", AQUI / f"{nome}.json"
    assinatura = [texto, voz, perfil, direcao, ritmo]
    if meta.exists():
        antigo = json.loads(meta.read_text(encoding="utf-8"))
        if antigo.get("assinatura") == assinatura and wav.exists():
            print(nome, "(cache)", antigo["duracao"], "s")
            return antigo
    bruto = AQUI / f"{nome}.bruto.wav"
    erros = []
    for modelo in modelos:
        os.environ["GEMINI_TTS_MODEL"] = modelo
        falado = texto if "lite" in modelo else preparar.prompt(perfil, direcao, texto)
        try:
            r = sintetizar(texto, "gemini", voz, bruto, falado=falado, pronuncia=False)
            r["modelo"] = modelo
            break
        except Exception as e:  # noqa: BLE001
            erros.append(f"{modelo}: {str(e)[:200]}")
            print("  falhou", modelo, str(e)[:200])
    else:
        raise SystemExit("nenhum modelo de TTS respondeu:\n" + "\n".join(erros))
    # o TTS às vezes lê duas vezes: se o Whisper ouviu bem mais que o texto, corta depois da última palavra
    ouvido = r.get("alinhamento", {}).get("ouvido", "")
    if ouvido and len(ouvido.split()) > 1.4 * len(texto.split()):
        fim = r["palavras"][-1]["fim"] + 0.35
        tmp = bruto.with_name(bruto.stem + "_c.wav")
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(bruto), "-t", f"{fim:.3f}", str(tmp)], check=True)
        tmp.replace(bruto)
        r["cortado"] = True
    if ritmo != 1.0:
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(bruto), "-af", f"atempo={ritmo}", str(wav)], check=True)
        r["duracao"] = round(r["duracao"] / ritmo, 3)
        r["palavras"] = [{**p, "inicio": round(p["inicio"] / ritmo, 3), "fim": round(p["fim"] / ritmo, 3)} for p in r["palavras"]]
    else:
        bruto.replace(wav)
    r["wav"] = str(wav)
    r["env"] = preparar.envelope(wav)
    r["assinatura"] = assinatura
    print(nome, r["modelo"], r["duracao"], "s", "| ouvido:", ouvido[:160])
    return r


def main() -> None:
    carregar_env()
    R = json.loads((AQUI / "roteiro.json").read_text(encoding="utf-8"))
    N, D = R["narrador"], R["dona"]
    beats = [b for b in R["beats"] if b["texto"]]
    texto = " ".join(b["texto"] for b in beats)
    r = gerar("narracao", texto, N["voz"], N["direcao"], None, N["ritmo"], R["tts"]["modelos"])
    # limites de cada beat pela contagem de palavras (o alinhador devolve uma entrada por palavra do texto)
    pal, i, lim = r["palavras"], 0, {}
    for b in beats:
        n = len(b["texto"].split())
        if i + n > len(pal):
            raise SystemExit(f"alinhamento curto: {len(pal)} palavras para o texto inteiro")
        lim[b["id"]] = {"ini": pal[i]["inicio"], "fim": pal[i + n - 1]["fim"], "p0": i, "n": n}
        i += n
    r["beats"] = lim
    (AQUI / "narracao.json").write_text(json.dumps(r, ensure_ascii=False, indent=1), encoding="utf-8")
    d = gerar("dona", D["texto"], D["voz"], D["perfil"], D["direcao"], 1.08, R["tts"]["modelos"])
    (AQUI / "dona.json").write_text(json.dumps(d, ensure_ascii=False, indent=1), encoding="utf-8")


if __name__ == "__main__":
    main()
