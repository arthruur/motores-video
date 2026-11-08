"""Laboratório A2: dicionário de siglas, normalização no fim, direção com limites e checagem de fidelidade.

    python laboratorio/a2-roteiro-falado/lab.py            tudo + checagem pelo Whisper + saida/escuta.html
    python laboratorio/a2-roteiro-falado/lab.py --sem-qa   sem o Whisper

Lições do A1 que este lab testa:
  - o LLM não sabe falar siglas → dicionário da série (siglas.json) com a forma falada de cada uma;
  - a passada de diálogo desfez a normalização → o roteiro fica sempre na forma ESCRITA e a conversão para a
    forma falada (siglas, números) é o último passo, determinístico, antes do TTS;
  - a direção saiu teatral → três intensidades com limites, e a direção nunca devolve o texto;
  - o diálogo distorceu um fato → um LLM checador compara os fatos do roteiro com os da origem;
  - a nota do Whisper caía por comparar com a grafia falada → a referência é a forma escrita (a da legenda).

Amostras: E1 escrito + normalização (sem LLM), E2 escrito para o ouvido + normalização, E3 dirigido em três
intensidades, E4 diálogo. Reaproveita as funções do A1 (Gemini, cache, página de escuta).
"""
from __future__ import annotations

import argparse
import importlib.util
import json
import re
from pathlib import Path

from num2words import num2words

AQUI = Path(__file__).parent
spec = importlib.util.spec_from_file_location("a1", AQUI.parent / "a1-gemini-tts" / "lab.py")
a1 = importlib.util.module_from_spec(spec)
spec.loader.exec_module(a1)
a1.SAIDA, a1.CACHE = AQUI / "saida", AQUI / "saida" / "cache"   # cache próprio deste lab
NARRADOR, CESTA, TTS = a1.NARRADOR, a1.CESTA, a1.TTS

DIC = {k: v for k, v in json.loads((AQUI / "siglas.json").read_text(encoding="utf-8")).items() if not k.startswith("_")}
FRACOES = {"1/2": "metade", "1/3": "um terço", "2/3": "dois terços", "1/4": "um quarto", "3/4": "três quartos"}


def falar(texto: str) -> str:
    """Forma escrita → forma falada, sem LLM: siglas pelo dicionário, frações, porcentagens e números por extenso."""
    for s, d in sorted(DIC.items(), key=lambda kv: -len(kv[0])):
        texto = re.sub(rf"(?<![\w-]){re.escape(s)}(?![\w-])", d["fala"], texto)
    for f, ext in FRACOES.items():
        texto = re.sub(rf"(?<!\d){re.escape(f)}(?!\d)", ext, texto)
    texto = re.sub(r"(?<=\d)\.(?=\d{3}\b)", "", texto)                      # 1.000 → 1000
    texto = re.sub(r"(\d+),(\d+)\s*%", lambda m: f"{num2words(int(m[1]), lang='pt_BR')} vírgula {num2words(int(m[2]), lang='pt_BR')} por cento", texto)
    texto = re.sub(r"(\d+)\s*%", lambda m: f"{num2words(int(m[1]), lang='pt_BR')} por cento", texto)
    return re.sub(r"\d+", lambda m: num2words(int(m[0]), lang="pt_BR"), texto)


def dicionario_txt() -> str:
    return "\n".join(f"- {s}: {d['explica']}" for s, d in DIC.items())


def prompt(nome: str, **campos) -> str:
    p = (AQUI / "prompts" / nome).read_text(encoding="utf-8")
    for k, v in campos.items():
        p = p.replace("{" + k + "}", v)
    return p


def dirigido(d: dict, falado: str) -> str:
    notas = "\n".join(f"- {n}" for n in d["notas"])
    return (f"# PERFIL DA VOZ\n{d['perfil']}\n\n## A CENA\n{d['cena']}\n\n### NOTAS DE DIREÇÃO\n{notas}\n\n"
            f"#### TRANSCRIÇÃO (leia só este trecho, em português do Brasil)\n{falado}")


def rodar(qa: bool) -> None:
    a1.CACHE.mkdir(parents=True, exist_ok=True)
    seco = (AQUI.parent / "a1-gemini-tts" / "trecho.txt").read_text(encoding="utf-8").strip()
    A = []

    def amostra(id_, titulo, explica, voz, escrito, prompt_tts, wav, g):
        A.append({"id": id_, "titulo": titulo, "explica": explica, "modelo": TTS, "voz": voz, "esperado": escrito,
                  "prompt": prompt_tts, "wav": str(wav), "gerar_s": g, "duracao": a1.duracao(wav)})
        print(f"  {id_:16} {a1.duracao(wav):5.1f} s")

    print("E1 escrito + normalização (sem LLM)")
    f1 = falar(seco)
    wav, g = a1.tts_gemini(TTS, f1, NARRADOR)
    amostra("E1-normalizado", "E1 · Escrito + normalização (sem LLM)", "O texto original só com siglas e números convertidos por regra.", NARRADOR, seco, f1, wav, g)

    print("E2 ouvido (LLM com dicionário) + normalização")
    ouvido = a1.texto_llm(prompt("1-ouvido.md", dicionario=dicionario_txt(), texto=seco))
    f2 = falar(ouvido)
    wav, g = a1.tts_gemini(TTS, f2, NARRADOR)
    amostra("E2-ouvido", "E2 · Escrito para o ouvido + normalização", "1ª passada com o dicionário da série; a pronúncia sai da regra, não do LLM.", NARRADOR, ouvido, f2, wav, g)

    print("E3 direção em três intensidades")
    dr = a1.texto_llm(prompt("2-direcao.md", texto=ouvido), como_json=True)
    for nivel in ("contida", "media", "expressiva"):
        p = dirigido(dr[nivel], f2)
        wav, g = a1.tts_gemini(TTS, p, NARRADOR)
        amostra(f"E3-{nivel}", f"E3 · Dirigido, {nivel}", "Mesmo texto do E2; só a direção muda (com limites: nada teatral).", NARRADOR, ouvido, p, wav, g)

    print("E4 diálogo")
    dl = a1.texto_llm(prompt("3-dialogo.md", dicionario=dicionario_txt(), texto=ouvido), como_json=True)
    falas = "\n".join(f"{f['quem']}: {falar(f['texto'])}" for f in dl["falas"])
    p = f"{dl['direcao']}\n\nLeia a conversa abaixo entre NARRADOR e CESTA, em português do Brasil:\n{falas}"
    wav, g = a1.tts_gemini(TTS, p, {"NARRADOR": NARRADOR, "CESTA": CESTA})
    amostra("E4-dialogo", "E4 · Diálogo (normalizado no fim)", "Diálogo escrito com regras de fidelidade; siglas e números convertidos por regra no fim.",
            f"{NARRADOR} + {CESTA}", " ".join(f["texto"] for f in dl["falas"]), p, wav, g)

    print("checagem de fidelidade (origem × roteiro)")
    a1_rot = json.loads((AQUI.parent / "a1-gemini-tts" / "saida" / "roteiros.json").read_text(encoding="utf-8"))
    casos = {"A1 diálogo": "\n".join(f"{f['quem']}: {f['texto']}" for f in a1_rot["dialogo"]["falas"]),
             "E2 ouvido": ouvido,
             "E4 diálogo": "\n".join(f"{f['quem']}: {f['texto']}" for f in dl["falas"])}
    fid = {}
    for nome, rot in casos.items():
        r = a1.texto_llm(prompt("4-fidelidade.md", origem=seco, roteiro=rot, dicionario=dicionario_txt()), como_json=True)
        fid[nome] = r
        ruins = [f for f in r["fatos"] if f["status"] != "mantido"] + r.get("acrescentados", [])
        print(f"  {nome:11} {'aprovado' if r['aprovado'] else 'REPROVADO'}: {len(ruins)} problema(s)")
        for f in ruins:
            print(f"     - [{f.get('status', 'acrescentado')}] {f.get('comentario', '')[:150]}")

    if qa:
        a1.checar(A)
    (a1.SAIDA / "roteiros.json").write_text(json.dumps({"seco": seco, "normalizado": f1, "ouvido": ouvido, "ouvido_falado": f2,
                                                        "direcao": dr, "dialogo": dl, "fidelidade": fid}, ensure_ascii=False, indent=1), encoding="utf-8")
    (a1.SAIDA / "resultados.json").write_text(json.dumps(A, ensure_ascii=False, indent=1), encoding="utf-8")
    print(a1.pagina(A))


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--sem-qa", action="store_true")
    a1.carregar_env()
    rodar(not ap.parse_args().sem_qa)
