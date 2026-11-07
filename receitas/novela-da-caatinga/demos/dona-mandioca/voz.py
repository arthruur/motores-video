"""Fala da demo da Dona Mandioca (Gemini TTS, voz do roteiro.json > elenco > dona_mandioca).

    python receitas/novela-da-caatinga/demos/dona-mandioca/voz.py
    -> demos/dona-mandioca/fala.wav + fala.json (palavras com tempo, env a 30 q/s)

A cota do TTS é pequena: o script tenta no máximo 2 vezes (um modelo por vez) e para.
Sem fala.wav, a demo (montar.py / cena.js) cai na trilha de sílabas temporizada, sem voz.
"""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path

AQUI = Path(__file__).resolve().parent
SERIE = AQUI.parents[1]
RAIZ = SERIE.parents[1]
sys.path.insert(0, str(RAIZ))
sys.path.insert(0, str(SERIE))
sys.stdout.reconfigure(encoding="utf-8")

TEXTO = "Aqui na casa de farinha quem manda sou eu... mas pode entrar."


def main() -> None:
    from motores.voz import sintetizar
    import preparar  # envelope(), prompt(), andamento()

    env = RAIZ / ".env"
    for ln in env.read_text(encoding="utf-8").splitlines() if env.exists() else []:
        if "=" in ln and not ln.lstrip().startswith("#"):
            k, v = ln.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip())
    R = json.loads((SERIE / "roteiro.json").read_text(encoding="utf-8"))
    ficha = R["elenco"]["dona_mandioca"]
    wav = AQUI / "fala.wav"
    erros = []
    for modelo in R["tts"]["modelos"][:2]:
        os.environ["GEMINI_TTS_MODEL"] = modelo
        falado = TEXTO if "lite" in modelo else preparar.prompt(ficha["perfil"], "Pausa de quem manda antes do 'mas'; o fim amolece, quase um sorriso.", TEXTO)
        try:
            r = sintetizar(TEXTO, R["tts"]["provedor"], ficha["voz"], wav, falado=falado, pronuncia=False)
            r["modelo"] = modelo
            r["env"] = preparar.envelope(wav)
            (AQUI / "fala.json").write_text(json.dumps(r, ensure_ascii=False, indent=1), encoding="utf-8")
            print("ok", modelo, r["duracao"], "s")
            return
        except Exception as e:  # noqa: BLE001
            erros.append(f"{modelo}: {e}")
            print("falhou", modelo, str(e)[:300])
    (AQUI / "fala-erro.txt").write_text("\n".join(erros), encoding="utf-8")


if __name__ == "__main__":
    main()
