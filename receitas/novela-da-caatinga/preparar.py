"""Prepara um capítulo da Novela da Caatinga: texturas, as vozes de cada fala (Gemini TTS) e tempos.json.

    python receitas/novela-da-caatinga/preparar.py

- Cada fala é uma geração separada, com a ficha do personagem (roteiro.json > elenco) + a direção da fala.
  O Gemini TTS faz no máximo 2 falantes por chamada; uma fala por chamada também dá cache por fala:
  mudar uma fala regera só ela (voz/<cena>-<n>.wav + .json com a assinatura).
- O tempo de cada palavra sai do alinhador (faster-whisper + texto), que também serve de checagem:
  se o Whisper ouviu algo muito diferente do texto, o aviso aparece aqui.
- env: o "volume" da fala a 30 quadros/s (0 a 1), que abre e fecha a boca de quem fala (cena.js).
- tempos.json: cenas com início, duração, transição e as falas com início, palavras e env.
"""
from __future__ import annotations

import importlib.util
import json
import os
import shutil
import subprocess
import sys
import wave
from pathlib import Path

import numpy as np

AQUI = Path(__file__).parent
RAIZ = AQUI.parents[1]
GV = RAIZ / "receitas" / "guerra-verde"
FPS = 30
sys.stdout.reconfigure(encoding="utf-8")


def texturas() -> None:
    """Kraft e grão do mesmo gerador do Guerra Verde (papel um pouco mais claro e quente), e a fonte de mão."""
    spec = importlib.util.spec_from_file_location("gv", GV / "preparar.py")
    gv = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(gv)
    gv.AQUI = AQUI
    (AQUI / "texturas").mkdir(exist_ok=True)
    if not (AQUI / "texturas" / "kraft.jpg").exists():
        gv.kraft(base="#e2c9a0", semente=11)
        gv.grao()
    (AQUI / "fontes").mkdir(exist_ok=True)
    for f in (GV / "fontes").iterdir():
        if not (AQUI / "fontes" / f.name).exists():
            shutil.copy(f, AQUI / "fontes" / f.name)


def envelope(wav: Path) -> list[float]:
    with wave.open(str(wav)) as w:
        taxa = w.getframerate()
        x = np.frombuffer(w.readframes(w.getnframes()), np.int16).astype(np.float32) / 32768
    n = taxa // FPS
    q = len(x) // n
    rms = np.sqrt((x[: q * n].reshape(q, n) ** 2).mean(1)) if q else np.zeros(1)
    ref = np.percentile(rms, 90) or 1
    return [round(float(v), 2) for v in np.clip(rms / ref, 0, 1)]


def andamento(wav: Path, r: dict, ritmo: float) -> dict:
    """Acelera (ou desacelera) a fala sem mudar o tom, com o atempo do ffmpeg, e leva tempos e env junto.
    O TTS do Gemini fala devagar (cerca de 2 palavras/s); o desenho pede mais ligeiro. A geração original fica
    no cache; a versão no andamento vira voz/<id>.r<ritmo>.wav, refeita só se faltar."""
    if ritmo == 1.0:
        return {**r, "wav": str(wav)}
    alvo = wav.with_name(f"{wav.stem}.r{ritmo:g}.wav")
    if not alvo.exists() or alvo.stat().st_mtime < wav.stat().st_mtime:
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(wav), "-af", f"atempo={ritmo}", str(alvo)], check=True)
    return {**r, "wav": str(alvo), "duracao": round(r["duracao"] / ritmo, 3), "env": envelope(alvo),
            "palavras": [{**p, "inicio": p["inicio"] / ritmo, "fim": p["fim"] / ritmo} for p in r["palavras"]]}


def prompt(perfil: str, direcao: str | None, texto: str) -> str:
    # estrutura do guia de prompts do Gemini TTS (lab A1): perfil, notas e, por último, só o que deve ser lido
    d = f"\n\n## NOTA DESTA FALA\n{direcao}" if direcao else ""
    return f"# PERFIL DA VOZ\n{perfil}{d}\n\n#### TRANSCRIÇÃO (leia só este trecho, em português do Brasil)\n{texto}"


def vozes() -> None:
    sys.path.insert(0, str(RAIZ))
    from motores.voz import sintetizar
    from motores.voz.qa import precisao

    gv_env = RAIZ / ".env"
    for ln in gv_env.read_text(encoding="utf-8").splitlines() if gv_env.exists() else []:
        if "=" in ln and not ln.lstrip().startswith("#"):
            k, v = ln.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip())
    R = json.loads((AQUI / "roteiro.json").read_text(encoding="utf-8"))
    modelos = R["tts"]["modelos"]   # em ordem: quando a cota diária de um acaba, passa ao próximo
    T, E = R["tempos"], R["elenco"]
    (AQUI / "voz").mkdir(exist_ok=True)
    cenas, ini = [], 0.0
    for c in R["cenas"]:
        t, falas = 0.0, []
        for n, f in enumerate(c["falas"]):
            ficha = E[f["quem"]]
            p = prompt(ficha["perfil"], f.get("direcao"), f["texto"])
            wav = AQUI / "voz" / f"{c['id']}-{n}.wav"
            meta = wav.with_suffix(".json")
            assinatura = [p, ficha["voz"]]   # o modelo usado fica em r["modelo"]
            antigo = json.loads(meta.read_text(encoding="utf-8")) if meta.exists() else {}
            if antigo.get("assinatura", [])[:2] == assinatura and wav.exists():
                r = antigo
            else:
                while True:
                    os.environ["GEMINI_TTS_MODEL"] = modelos[0]
                    try:
                        # o modelo "lite" lê a direção em voz alta (perfil e tudo): para ele vai só o texto
                        falado = f["texto"] if "lite" in modelos[0] else p
                        r = sintetizar(f["texto"], R["tts"]["provedor"], ficha["voz"], wav, falado=falado, pronuncia=False)
                        break
                    except RuntimeError as e:
                        if "PerDay" not in str(e) or len(modelos) == 1:
                            raise
                        print(f"  {modelos[0]}: cota do dia acabou, passando para {modelos[1]}")
                        modelos = modelos[1:]
                r["modelo"] = os.environ["GEMINI_TTS_MODEL"]
                r["assinatura"] = assinatura
                r["env"] = envelope(wav)
                meta.write_text(json.dumps(r, ensure_ascii=False, indent=1), encoding="utf-8")
            ouvido = r.get("alinhamento", {}).get("ouvido", "")
            # o TTS às vezes lê a fala duas vezes (visto no gemini-3.8-flash-tts): a nota por palavras não pega,
            # porque todas as palavras do texto estão lá. Se o Whisper ouviu bem mais palavras que o texto,
            # corta o áudio logo depois da última palavra alinhada.
            if ouvido and len(ouvido.split()) > 1.4 * len(f["texto"].split()) and not r.get("cortado"):
                fim = r["palavras"][-1]["fim"] + 0.3
                tmp = wav.with_name(wav.stem + "_tmp.wav")
                subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(wav), "-t", f"{fim:.3f}", str(tmp)], check=True)
                tmp.replace(wav)
                r.update(duracao=round(fim, 3), env=envelope(wav), cortado=f"repetição: Whisper ouviu {ouvido!r}")
                meta.write_text(json.dumps(r, ensure_ascii=False, indent=1), encoding="utf-8")
                print(f"  {c['id']} {n}: fala repetida pelo TTS, cortada em {fim:.2f} s")
            nota = precisao(f["texto"], ouvido)[0] if ouvido else 100
            aviso = "" if nota >= 80 else f"   ⚠ Whisper ouviu: {ouvido!r}"
            r = andamento(wav, r, ficha.get("ritmo", T.get("ritmo", 1.0)))
            print(f"  {c['id']:10} {n} {f['quem']:13} {r['duracao']:5.2f} s  {nota:.0f}%{aviso}")
            t += f.get("pausa", T["antes"] if n == 0 else T["entre"])
            falas.append({"quem": f["quem"], "texto": f["texto"], "ini": round(t, 3), "dur": r["duracao"],
                          "wav": str(Path(r["wav"]).relative_to(AQUI)).replace("\\", "/"), "env": r["env"],
                          "palavras": [{"texto": w["texto"], "inicio": round(t + w["inicio"], 3), "fim": round(t + w["fim"], 3)}
                                       for w in r["palavras"]]})
            t += r["duracao"]
        tr = c.get("transicao", {"tipo": "corte", "dur": 0})
        dur = round(max(c.get("minimo", 0), t + c.get("depois", T["depois"]) + tr["dur"]), 3)
        # deixas de som (trompete do Cesto, efeitos): em segundos da cena, presas ao início ou ao fim de uma fala.
        # cena.js anima pelas mesmas deixas (o Cesto pula na nota do trompete) e som/mixar.py toca nelas.
        sons = []
        for s in c.get("sons", []):
            if "fala" in s:
                fl = falas[s["fala"]]
                t0 = fl["ini"] + (fl["dur"] if s.get("ref") == "fim" else 0) + s.get("d", 0)
            else:
                t0 = s["t"]
            sons.append({"id": s["id"], "t": round(t0, 3), "vol": s.get("vol", 1.0),
                         "dur": dur if s.get("dur") == "cena" else s.get("dur")})
        cenas.append({"id": c["id"], "ini": round(ini, 3), "dur": dur, "transicao": tr, "falas": falas, "sons": sons})
        print(f"{c['id']:10} {ini:6.2f} s  dura {dur:5.2f} s")
        ini += dur - tr["dur"]
    duracao = round(cenas[-1]["ini"] + cenas[-1]["dur"], 3)
    (AQUI / "tempos.json").write_text(json.dumps({"duracao": duracao, "rotulo": R["rotulo"], "cenas": cenas},
                                                 ensure_ascii=False), encoding="utf-8")
    print(f"tempos.json: {duracao:.1f} s")


if __name__ == "__main__":
    texturas()
    vozes()
