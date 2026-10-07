"""Sugerir: tema -> candidatos diversos, já cortados em fronteira de frase, numa página para ouvir e escolher.

Busca: o tema vira vetor (prefixo "SearchQuery") e é comparado com as janelas do índice. MMR
(relevância − parecença com o que já entrou), no máximo N por fonte e sem janelas sobrepostas.
O corte é levado às fronteiras de frase pelos tempos das palavras (frases.py).
A máquina sugere; quem monta decide.
"""
from __future__ import annotations

import html
import json
import os
import time
from pathlib import Path

from .frases import ajustar
from .fontes import minutos
from .indice import arquivo_palavras, carregar_modelo, ler_palavras

JANELA_MIN = 15.0  # duas janelas da mesma fonte a menos disso são o mesmo trecho


def sugerir(tema: str, fontes: dict, pasta_indice: Path, n: int = 8, lam: float = 0.7, por_fonte: int = 2) -> dict:
    import numpy as np

    t_total = time.perf_counter()
    por_slug = {f["slug"]: f for f in fontes["fontes"]}
    idx = json.loads((pasta_indice / "indice.json").read_text(encoding="utf-8"))["janelas"]
    V = np.load(pasta_indice / "indice.npy")
    falta = {j["fonte"] for j in idx} - set(por_slug)
    if falta:
        raise ValueError(f"o índice tem fontes que não foram carregadas ({', '.join(sorted(falta))}): use --opcionais")
    palavras = {s: ler_palavras(arquivo_palavras(f, pasta_indice)) for s, f in por_slug.items()}

    m, carga = carregar_modelo()
    t0 = time.perf_counter()
    q = m.encode([tema], prompt_name="SearchQuery", normalize_embeddings=True)[0]
    nota = V @ q

    escolha, conta = [], {}
    ordem = [int(k) for k in np.argsort(-nota)[:200]]

    def mmr(k):
        sim = max((float(V[k] @ V[e]) for e in escolha), default=0.0)
        return lam * nota[k] - (1 - lam) * sim

    while len(escolha) < n:
        ok = [k for k in ordem if conta.get(idx[k]["fonte"], 0) < por_fonte
              and not any(idx[e]["fonte"] == idx[k]["fonte"] and abs(idx[e]["ini"] - idx[k]["ini"]) < JANELA_MIN
                          for e in escolha)]
        if not ok:
            break
        k = max(ok, key=mmr)
        escolha.append(k)
        conta[idx[k]["fonte"]] = conta.get(idx[k]["fonte"], 0) + 1
        ordem.remove(k)
    t_busca = time.perf_counter() - t0

    cands = []
    for pos, k in enumerate(escolha, 1):
        j = idx[k]
        f = por_slug[j["fonte"]]
        # janela com frase conhecida: o corte mira a frase, não a janela inteira
        c = ajustar(palavras[j["fonte"]], *(j["alvo"] or (j["ini"], j["fim"])))
        ini_orig = f["trecho"].get("ini", 0) + c["ini"]
        cands.append({"pos": pos, "fonte": j["fonte"], "figura": f["figura"], "data": f.get("data"),
                      "ocasiao": f["rotulo"], "nota": round(float(nota[k]), 3), "janela": [j["ini"], j["fim"]],
                      "ini": c["ini"], "fim": c["fim"], "dur": round(c["fim"] - c["ini"], 1),
                      "unidades": c["unidades"], "comeca_em": c["comeca_em"], "termina_em": c["termina_em"],
                      "pausa_antes": c["pausa_antes"], "pausa_depois": c["pausa_depois"],
                      "frases_na_janela": j["frases"], "texto": c["texto"],
                      "no_original": f"{f['url']}{'&' if '?' in f['url'] else '?'}t={int(ini_orig)}s"})
    return {"tema": tema, "n": n, "lambda": lam, "max_por_fonte": por_fonte, "janelas_no_indice": len(idx),
            "medidas": {"importar_s": carga["importar_s"], "carga_modelo_s": carga["carga_s"], "busca_s": round(t_busca, 3),
                        "total_s": round(time.perf_counter() - t_total, 1)},
            "candidatos": cands}



def pagina(res: dict, fontes: dict, destino: Path) -> str:
    """HTML: cada candidato toca só o seu trecho; marcar gera os fragmentos para colar no colagem.json"""
    por_slug = {f["slug"]: f for f in fontes["fontes"]}

    def cartao(c):
        src = Path(os.path.relpath(por_slug[c["fonte"]]["_caminho"], destino.parent)).as_posix()
        dado = html.escape(json.dumps({"id": f"{c['pos']}-{c['fonte']}", "fonte": c["fonte"], "ini": c["ini"],
                                       "fim": c["fim"], "porque": ""}, ensure_ascii=False))
        marca = "" if c["comeca_em"] == c["termina_em"] == "frase" else \
            f" · <b class=av>corte em respiro ({c['comeca_em']} → {c['termina_em']})</b>"
        colado = " · <b class=av>sem pausa na ponta: ouça o corte</b>" if min(c["pausa_antes"], c["pausa_depois"]) < 0.15 else ""
        return f"""<article><label><input type=checkbox data-c="{dado}">
 <b>{c['pos']}. {html.escape(c['figura'])}</b> · {html.escape(c['data'] or 's.d.')} · {html.escape(c['ocasiao'])}</label>
 <video controls preload=metadata data-a="{c['ini']}" data-b="{c['fim']}" src="{html.escape(src)}#t={c['ini']},{c['fim']}"></video>
 <p>“{html.escape(c['texto'])}”</p>
 <small>nota {c['nota']:.3f} · {minutos(c['ini'])}–{minutos(c['fim'])} no arquivo ({c['dur']} s) ·
 pausa antes {c['pausa_antes']} s, depois {c['pausa_depois']} s{marca}{colado} ·
 <a href="{html.escape(c['no_original'])}">no original</a></small></article>"""

    tema = html.escape(res["tema"])
    return f"""<!doctype html><html lang=pt-BR><meta charset=utf-8><meta name=viewport content="width=device-width">
<title>Candidatos: {tema}</title>
<style>:root{{color-scheme:dark}}body{{font:16px system-ui;max-width:760px;margin:2em auto;padding:0 16px;background:#111;color:#eee}}
article{{border-top:1px solid #444;padding:1em 0}}video{{width:100%;background:#000}}small{{color:#aaa}}a{{color:#8cf}}
.av{{color:#fc6;font-weight:600}}textarea{{width:100%;height:12em;background:#222;color:#eee}}</style>
<h1>{tema}</h1>
<p>{len(res['candidatos'])} sugestões, no máximo {res['max_por_fonte']} por fonte, cortadas em fronteira de frase.
Ouça cada uma inteira: o índice <b>não sabe quem fala</b> (entrevistador, narrador e mesa entram como se fossem a figura)
e a transcrição erra. Marque as que quer e cole em <code>"fragmentos"</code> no <code>colagem.json</code>.
A ordem e o sentido da montagem são seus.</p>
{chr(10).join(cartao(c) for c in res['candidatos'])}
<h2>Escolhidos</h2><textarea id=out readonly></textarea>
<script>
for (const v of document.querySelectorAll('video')) {{
  const a = +v.dataset.a, b = +v.dataset.b
  v.addEventListener('play', () => {{ if (v.currentTime < a || v.currentTime >= b - 0.05) v.currentTime = a }})
  v.addEventListener('timeupdate', () => {{ if (v.currentTime >= b) v.pause() }})
}}
document.addEventListener('change', () => {{
  out.value = JSON.stringify([...document.querySelectorAll('input:checked')].map(i => JSON.parse(i.dataset.c)), null, 1)
}})
</script>
"""
