"""Indexar: fontes -> palavras com tempo (Whisper, via motores/voz) -> janelas de 15 s -> vetores de texto.

Cada janela vira um vetor do EmbeddingGemma 2 (só o codificador de texto, prefixo "Document").
As frases conhecidas da fonte (campo `frases`, texto já conferido) são localizadas na transcrição
pelo texto e entram junto da janela que as cobre: corrigem o ouvido do Whisper ("demografia racial"
-> "democracia racial") sem mexer no modelo.

Cache em <indice>/: palavras-<slug>.json (Whisper) e vetores-<slug>.npy (refeito só se o texto mudar).
"""
from __future__ import annotations

import difflib
import hashlib
import json
import os
import re
import time
import unicodedata
from pathlib import Path

MODELO = "google/embeddinggemma-2"
JANELA, PASSO, MIN_PALAVRAS = 15.0, 5.0, 5


def norm(s: str) -> str:
    s = unicodedata.normalize("NFD", s.lower())
    return re.sub(r"[^a-z0-9]", "", "".join(c for c in s if unicodedata.category(c) != "Mn"))


# ---------------------------------------------------------------- 1. palavras com tempo
def transcrever(arquivo: Path, modelo: str) -> tuple[list[dict], bool]:
    """Whisper do motores/voz, palavra a palavra. Com VAD primeiro; se sair menos de 20 palavras por
    minuto, refaz sem VAD (num discurso de rua, o VAD tomou a fala com o barulho da marcha por ruído)."""
    from motores.voz.audio import duracao, transcrever as whisper

    minutos = duracao(arquivo) / 60
    for vad in (True, False):
        _, ps = whisper(arquivo, modelo, palavras=True, vad=vad)
        if len(ps) >= 20 * minutos:
            break
    return [{"texto": p["texto"], "inicio": p["inicio"], "fim": p["fim"]} for p in ps], vad


def arquivo_palavras(fonte: dict, pasta: Path) -> Path:
    """palavras prontas da fonte (campo `palavras`) ou o cache do Whisper em <pasta>"""
    return fonte.get("_palavras") or pasta / f"palavras-{fonte['slug']}.json"


def ler_palavras(arq: Path) -> list[dict]:
    d = json.loads(arq.read_text(encoding="utf-8"))
    return d["palavras"] if isinstance(d, dict) else d


# ---------------------------------------------------------------- 2. janelas
def localizar(frase: str, palavras: list[dict], t_aprox: float | None, raio: float = 40.0):
    """acha a frase conhecida na transcrição por semelhança de texto num raio de `raio` s em volta de
    t_aprox (tempo de catálogo costuma ser aproximado). Devolve (ini, fim, semelhança) ou None."""
    alvo = [norm(w) for w in frase.split()]
    perto = [k for k, p in enumerate(palavras) if t_aprox is None or abs(p["inicio"] - t_aprox) <= raio]
    melhor = (0.0, None)
    for k in perto:
        trecho = [norm(p["texto"]) for p in palavras[k:k + len(alvo)]]
        r = difflib.SequenceMatcher(None, alvo, trecho, autojunk=False).ratio()
        if r > melhor[0]:
            melhor = (r, k)
    r, k = melhor
    if k is None or r < 0.5:
        return None
    return palavras[k]["inicio"], palavras[min(k + len(alvo), len(palavras)) - 1]["fim"], round(r, 2)


def janelas(fonte: dict, palavras: list[dict]) -> tuple[list[dict], list[dict]]:
    excluir = fonte.get("excluir") or []  # trechos de outra voz (entrevistador, narrador, mesa)
    palavras = [p for p in palavras if not any(a <= p["inicio"] < b for a, b in excluir)]
    achadas = []
    for f in fonte.get("frases") or []:
        if onde := localizar(f["texto"], palavras, f.get("no_trecho")):
            achadas.append({"id": f.get("id"), "texto": f["texto"], "ini": onde[0], "fim": onde[1],
                            "semelhanca": onde[2]})
    out, t, fim = [], 0.0, max((p["fim"] for p in palavras), default=0)
    while t < fim:
        ps = [p for p in palavras if t <= p["inicio"] < t + JANELA]
        if len(ps) >= MIN_PALAVRAS:  # pula silêncio, aplauso e música
            txt = " ".join(p["texto"] for p in ps)
            # a frase conhecida entra na janela que cobre pelo menos metade dela
            extra = [a for a in achadas
                     if min(t + JANELA, a["fim"]) - max(t, a["ini"]) >= 0.5 * (a["fim"] - a["ini"])]
            out.append({"fonte": fonte["slug"], "ini": t, "fim": t + JANELA, "texto": txt,
                        "frases": [a["id"] for a in extra], "alvo": [extra[0]["ini"], extra[0]["fim"]] if extra else None,
                        "texto_indice": " ".join([txt] + [a["texto"] for a in extra])})
        t += PASSO
    return out, achadas


# ---------------------------------------------------------------- 3. vetores (EmbeddingGemma 2, texto)
def _no_cache(modelo: str) -> bool:
    hub = Path(os.environ.get("HF_HUB_CACHE") or Path(os.environ.get("HF_HOME") or Path.home() / ".cache" / "huggingface") / "hub")
    return any((hub / f"models--{modelo.replace('/', '--')}" / "snapshots").glob("*/config.json"))


def carregar_modelo(modelo: str = MODELO) -> tuple[object, dict]:
    """Só o codificador de texto (~1,3 GB de RAM a mais). Se o modelo já está no cache, carrega sem rede:
    consultando o Hub, a carga levou de 14 s a 35 min (conexão caindo); offline, ~4 s."""
    if _no_cache(modelo):
        os.environ.setdefault("HF_HUB_OFFLINE", "1")
    os.environ.setdefault("HF_HUB_DISABLE_SYMLINKS_WARNING", "1")
    t_imp = time.perf_counter()
    try:
        import torch
        from sentence_transformers import SentenceTransformer
    except ImportError as e:
        raise RuntimeError("faltam sentence-transformers e torch: pip install -r motores/colagem/requisitos.txt") from e
    torch.set_num_threads(os.cpu_count() or 4)
    t0 = time.perf_counter()
    importar = t0 - t_imp  # importar torch + transformers já levou de segundos a minutos (CPU ocupada, disco frio)
    # float32 (o cartão do modelo proíbe float16). No sentence-transformers 6.x, desligar imagem e áudio
    # vai por config_kwargs (model_kwargs={"config": ...} dá TypeError).
    m = SentenceTransformer(modelo, device="cpu", config_kwargs={"vision_config": None, "audio_config": None},
                            model_kwargs={"torch_dtype": torch.float32})
    return m, {"modelo": modelo, "importar_s": round(importar, 1), "carga_s": round(time.perf_counter() - t0, 1)}


def indexar(fontes: dict, pasta: Path, whisper: str = "small", log=print) -> dict:
    """Escreve <pasta>/indice.json (janelas) e <pasta>/indice.npy (vetores normalizados, alinhados)."""
    import numpy as np

    pasta.mkdir(parents=True, exist_ok=True)
    med = {"whisper": {}, "vetores": {}}
    t_total = time.perf_counter()
    for f in fontes["fontes"]:
        arq = arquivo_palavras(f, pasta)
        if arq.exists():
            continue
        if not f["_caminho"].exists():
            raise FileNotFoundError(f"falta {f['_caminho']}: rode o subcomando baixar")
        t0 = time.perf_counter()
        ps, vad = transcrever(f["_caminho"], whisper)
        dt = time.perf_counter() - t0
        arq.write_text(json.dumps({"modelo": f"faster-whisper {whisper} int8", "vad": vad, "palavras": ps},
                                  ensure_ascii=False, indent=0), encoding="utf-8")
        med["whisper"][f["slug"]] = {"palavras": len(ps), "vad": vad, "tempo_s": round(dt, 1)}
        log(f"whisper  {f['slug']:10s} {len(ps):5d} palavras em {dt:6.1f} s" + ("" if vad else " (sem VAD)"))

    todas, achadas = [], {}
    for f in fontes["fontes"]:
        js, achadas[f["slug"]] = janelas(f, ler_palavras(arquivo_palavras(f, pasta)))
        todas.append((f["slug"], js))
        for a in achadas[f["slug"]]:
            log(f"frase    {f['slug']:10s} {a['ini']:6.1f}-{a['fim']:6.1f} s (semelhança {a['semelhanca']}) {a['texto'][:60]}")
        faltaram = len(f.get("frases") or []) - len(achadas[f["slug"]])
        if faltaram:
            log(f"frase    {f['slug']:10s} {faltaram} frase(s) conhecida(s) não achada(s) na transcrição")

    modelo, vetores = None, []
    for slug, js in todas:
        impressao = hashlib.sha256(json.dumps([MODELO, [j["texto_indice"] for j in js]]).encode()).hexdigest()[:16]
        arq, marca = pasta / f"vetores-{slug}.npy", pasta / f"vetores-{slug}.txt"
        if arq.exists() and marca.exists() and marca.read_text().strip() == impressao:
            vetores.append(np.load(arq))
            continue
        if modelo is None:
            modelo, med["carga"] = carregar_modelo()
            log(f"modelo   {MODELO}: import {med['carga']['importar_s']} s + carga {med['carga']['carga_s']} s")
        t0 = time.perf_counter()
        v = modelo.encode([j["texto_indice"] for j in js], prompt_name="Document", batch_size=8,
                          normalize_embeddings=True).astype(np.float32)
        dt = time.perf_counter() - t0
        np.save(arq, v)
        marca.write_text(impressao)
        vetores.append(v)
        med["vetores"][slug] = {"janelas": len(js), "tempo_s": round(dt, 1)}
        log(f"vetores  {slug:10s} {len(js):4d} janelas em {dt:5.1f} s")

    idx = [j for _, js in todas for j in js]
    np.save(pasta / "indice.npy", np.vstack(vetores))
    med["total_s"] = round(time.perf_counter() - t_total, 1)
    (pasta / "indice.json").write_text(json.dumps(
        {"modelo": MODELO, "janela_s": JANELA, "passo_s": PASSO, "frases_localizadas": achadas, "medidas": med,
         "janelas": idx}, ensure_ascii=False, indent=0), encoding="utf-8")
    log(f"índice: {len(idx)} janelas de {JANELA:.0f} s (passo {PASSO:.0f} s), {len(todas)} fontes, "
        f"{sum(bool(j['frases']) for j in idx)} com frase conhecida -> {pasta / 'indice.json'} ({med['total_s']} s)")
    return {"janelas": len(idx), "medidas": med}
