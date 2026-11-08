"""Laboratório A1: do roteiro seco à narração dirigida, no Gemini TTS.

    python laboratorio/a1-gemini-tts/lab.py                 todos os degraus + comparação + página de escuta
    python laboratorio/a1-gemini-tts/lab.py --sem-comparar  só os degraus no Gemini (sem edge e ElevenLabs)
    python laboratorio/a1-gemini-tts/lab.py --sem-qa        sem a checagem pelo Whisper

Degraus (o mesmo trecho, cada um gera um áudio):
  0 seco       o texto como foi escrito para ler, direto no TTS
  1 ouvido     1ª passada de LLM: reescrito para o ouvido (siglas, números, frases de um fôlego)
  2 dirigido   2ª passada de LLM: perfil, cena e notas de direção + o texto do degrau 1
  3 diálogo    o texto do degrau 1 virado diálogo NARRADOR × CESTA, numa chamada multi-falante
  4 modelos    o prompt do degrau 2 em outros TTS do Gemini; o texto do degrau 1 no edge-tts e no ElevenLabs

Tudo fica em cache (saida/cache): rodar de novo só gera o que mudou. Chaves no .env da raiz:
GEMINI_API_KEY (obrigatória) e ELEVENLABS_API_KEY (só para a comparação).
"""
from __future__ import annotations

import argparse
import base64
import hashlib
import html
import json
import os
import sys
import time
import urllib.error
import urllib.request
import wave
from pathlib import Path

AQUI = Path(__file__).parent
RAIZ = AQUI.parents[1]
SAIDA = AQUI / "saida"
CACHE = SAIDA / "cache"
sys.path.insert(0, str(RAIZ))
sys.stdout.reconfigure(encoding="utf-8")

LLM = "gemini-3.5-flash"
LLM_RESERVA = ["gemini-3.8-flash", "gemini-3.1-flash-lite"]   # quando o principal está sobrecarregado (503)
TTS = "gemini-3.1-flash-tts-preview"
OUTROS_TTS = ["gemini-3.8-flash-tts"]   # gemini-2.5-pro-preview-tts: cota zero no nível grátis
NARRADOR, CESTA = "Charon", "Puck"     # vozes prontas do Gemini (Charon: informativa; Puck: animada)


def carregar_env() -> None:
    env = RAIZ / ".env"
    if env.exists():
        for ln in env.read_text(encoding="utf-8").splitlines():
            if "=" in ln and not ln.lstrip().startswith("#"):
                k, v = ln.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip())


# ---------------------------------------------------------------- Gemini

def chamar(modelo: str, corpo: dict, tentativas: int = 6) -> dict:
    """generateContent com nova tentativa em 429/500/503 (o nível grátis limita pedidos por minuto)."""
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{modelo}:generateContent"
    req = lambda: urllib.request.Request(url, data=json.dumps(corpo).encode(),
                                         headers={"Content-Type": "application/json", "x-goog-api-key": os.environ["GEMINI_API_KEY"]})
    for k in range(tentativas):
        try:
            return json.load(urllib.request.urlopen(req(), timeout=300))
        except urllib.error.HTTPError as e:
            msg = e.read().decode(errors="replace")
            # cota do dia esgotada não volta esperando um minuto: desiste logo (texto_llm passa para o reserva)
            if e.code not in (429, 500, 503) or k == tentativas - 1 or "PerDay" in msg or "limit: 20," in msg:
                raise RuntimeError(f"{modelo} respondeu {e.code}: {msg[:400]}") from e
            espera = 20 * (k + 1)
            print(f"  {modelo}: {e.code}, nova tentativa em {espera} s")
            time.sleep(espera)


def em_cache(tipo: str, chave: dict):
    h = hashlib.sha1(json.dumps(chave, ensure_ascii=False, sort_keys=True).encode()).hexdigest()[:16]
    return CACHE / f"{tipo}-{h}"


def texto_llm(prompt: str, como_json: bool = False):
    arq = em_cache("llm", {"m": LLM, "p": prompt, "j": como_json}).with_suffix(".json")
    if arq.exists():
        return json.loads(arq.read_text(encoding="utf-8"))["saida"]
    cfg = {"responseMimeType": "application/json"} if como_json else {}
    for i, modelo in enumerate([LLM] + LLM_RESERVA):
        try:
            r = chamar(modelo, {"contents": [{"parts": [{"text": prompt}]}], "generationConfig": cfg}, tentativas=3 if i < len(LLM_RESERVA) else 6)
            break
        except RuntimeError as e:
            if not any(c in str(e) for c in ("503", "429")) or modelo == ([LLM] + LLM_RESERVA)[-1]:
                raise
            print(f"  {modelo} indisponível, usando {([LLM] + LLM_RESERVA)[i + 1]}")
    s = "".join(p.get("text", "") for p in r["candidates"][0]["content"]["parts"]).strip()
    saida = json.loads(s) if como_json else s
    arq.write_text(json.dumps({"saida": saida, "modelo": modelo, "uso": r.get("usageMetadata")}, ensure_ascii=False, indent=1), encoding="utf-8")
    return saida


def tts_gemini(modelo: str, prompt: str, vozes: str | dict[str, str]) -> tuple[Path, float]:
    """prompt → WAV 24 kHz mono. vozes: nome de uma voz, ou {falante: voz} para diálogo (até 2 falantes)."""
    base = em_cache("tts", {"m": modelo, "p": prompt, "v": vozes})
    wav, meta = base.with_suffix(".wav"), base.with_suffix(".json")
    if wav.exists():
        return wav, json.loads(meta.read_text(encoding="utf-8"))["gerar_s"]
    if isinstance(vozes, str):
        fala = {"voiceConfig": {"prebuiltVoiceConfig": {"voiceName": vozes}}}
    else:
        fala = {"multiSpeakerVoiceConfig": {"speakerVoiceConfigs": [
            {"speaker": q, "voiceConfig": {"prebuiltVoiceConfig": {"voiceName": v}}} for q, v in vozes.items()]}}
    t0 = time.perf_counter()
    for k in range(3):
        # às vezes o TTS devolve um candidato sem áudio (finishReason OTHER): tenta de novo
        r = chamar(modelo, {"contents": [{"parts": [{"text": prompt}]}],
                            "generationConfig": {"responseModalities": ["AUDIO"], "speechConfig": fala}})
        c = r["candidates"][0]
        partes = c.get("content", {}).get("parts", [])
        if partes and "inlineData" in partes[0]:
            break
        print(f"  {modelo}: resposta sem áudio ({c.get('finishReason')}), tentativa {k + 2}")
    else:
        raise RuntimeError(f"{modelo}: sem áudio depois de 3 tentativas ({c.get('finishReason')})")
    gerar_s = round(time.perf_counter() - t0, 2)
    pcm = base64.b64decode(partes[0]["inlineData"]["data"])
    with wave.open(str(wav), "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(24000); w.writeframes(pcm)
    meta.write_text(json.dumps({"gerar_s": gerar_s, "uso": r.get("usageMetadata")}, indent=1), encoding="utf-8")
    return wav, gerar_s


def duracao(wav: Path) -> float:
    with wave.open(str(wav)) as w:
        return round(w.getnframes() / w.getframerate(), 2)


# ---------------------------------------------------------------- degraus

def prompt_dirigido(d: dict) -> str:
    # estrutura do guia de prompts do Gemini TTS: perfil, cena, notas de direção e, por último, a transcrição
    notas = "\n".join(f"- {n}" for n in d["notas"]) if isinstance(d["notas"], list) else d["notas"]
    return (f"# PERFIL DA VOZ\n{d['perfil']}\n\n## A CENA\n{d['cena']}\n\n### NOTAS DE DIREÇÃO\n{notas}\n\n"
            f"#### TRANSCRIÇÃO (leia só este trecho, em português do Brasil)\n{d['texto']}")


def degraus(seco: str, comparar: bool) -> list[dict]:
    P = lambda n: (AQUI / "prompts" / n).read_text(encoding="utf-8")
    A = []

    def amostra(id_, titulo, explica, modelo, voz, esperado, wav, gerar_s, prompt=None):
        A.append({"id": id_, "titulo": titulo, "explica": explica, "modelo": modelo, "voz": voz, "esperado": esperado,
                  "prompt": prompt, "wav": str(wav), "gerar_s": gerar_s, "duracao": duracao(wav)})
        print(f"  {id_:22} {duracao(wav):5.1f} s de áudio, gerado em {gerar_s:5.1f} s")

    print("0 seco")
    wav, g = tts_gemini(TTS, seco, NARRADOR)
    amostra("0-seco", "0 · Seco", "O texto escrito para ler, direto no TTS, sem direção.", TTS, NARRADOR, seco, wav, g, seco)

    print("1 ouvido (1ª passada de LLM)")
    ouvido = texto_llm(P("1-ouvido.md").replace("{texto}", seco))
    wav, g = tts_gemini(TTS, ouvido, NARRADOR)
    amostra("1-ouvido", "1 · Escrito para o ouvido", "1ª passada de LLM: siglas e números como se falam, frases de um fôlego. Sem direção.",
            TTS, NARRADOR, ouvido, wav, g, ouvido)

    print("2 dirigido (2ª passada de LLM)")
    d = texto_llm(P("2-direcao.md").replace("{texto}", ouvido), como_json=True)
    pd = prompt_dirigido(d)
    wav, g = tts_gemini(TTS, pd, NARRADOR)
    amostra("2-dirigido", "2 · Dirigido", "2ª passada de LLM: perfil, cena e notas de direção antes do texto.", TTS, NARRADOR, d["texto"], wav, g, pd)

    print("3 diálogo (narrador × cesta)")
    dl = texto_llm(P("3-dialogo.md").replace("{texto}", ouvido), como_json=True)
    falas = "\n".join(f"{f['quem']}: {f['texto']}" for f in dl["falas"])
    pdl = f"{dl['direcao']}\n\nLeia a conversa abaixo entre NARRADOR e CESTA, em português do Brasil:\n{falas}"
    wav, g = tts_gemini(TTS, pdl, {"NARRADOR": NARRADOR, "CESTA": CESTA})
    amostra("3-dialogo", "3 · Diálogo", "O texto do degrau 1 virado conversa: NARRADOR (Charon) e CESTA (Puck), numa chamada só.",
            TTS, f"{NARRADOR} + {CESTA}", " ".join(f["texto"] for f in dl["falas"]), wav, g, pdl)

    print("4 outros modelos")
    for m in OUTROS_TTS:
        try:
            wav, g = tts_gemini(m, pd, NARRADOR)
            amostra(f"4-{m}", f"4 · Dirigido em {m}", "O mesmo prompt do degrau 2 em outro modelo de TTS do Gemini.", m, NARRADOR, d["texto"], wav, g, pd)
        except RuntimeError as e:
            print(f"  {m}: {e}")
    if comparar:
        from motores.voz import sintetizar
        for prov, voz, amb in [("edge", "pt-BR-AntonioNeural", {}),
                               ("elevenlabs", "JBFqnCBsd6RMkjVDRZzb", {"ELEVENLABS_MODEL": "eleven_v3", "ELEVENLABS_LANGUAGE": "pt"})]:
            if prov == "elevenlabs" and not os.environ.get("ELEVENLABS_API_KEY"):
                continue
            os.environ.update(amb)
            wav = em_cache("cmp", {"p": prov, "v": voz, "t": ouvido, **amb}).with_suffix(".wav")
            t0 = time.perf_counter()
            if not wav.exists():
                sintetizar(ouvido, prov, voz, wav, taxa=24000, alinhar=False, pronuncia=False, permitir_pago=True)
            amostra(f"4-{prov}", f"4 · Texto do degrau 1 no {prov}", "Mesmo texto escrito para o ouvido, em outro motor (sem direção).",
                    prov, voz, ouvido, wav, round(time.perf_counter() - t0, 2), ouvido)
    (SAIDA / "roteiros.json").write_text(json.dumps({"seco": seco, "ouvido": ouvido, "direcao": d, "dialogo": dl},
                                                    ensure_ascii=False, indent=1), encoding="utf-8")
    return A


# ---------------------------------------------------------------- QA e página de escuta

def checar(A: list[dict]) -> None:
    from motores.voz import avaliar
    print("checagem pelo Whisper (o que foi dito bate com o texto?)")
    for a in A:
        q = em_cache("qa", {"wav": a["wav"], "t": a["esperado"]}).with_suffix(".json")
        if q.exists():
            r = json.loads(q.read_text(encoding="utf-8"))
        else:
            r = avaliar(a["wav"], a["esperado"])
            q.write_text(json.dumps(r, ensure_ascii=False, indent=1), encoding="utf-8")
        a["precisao"], a["divergencias"], a["ouvido"] = r["precisao"], r["divergencias"], r["ouvido"]
        print(f"  {a['id']:22} {r['precisao']:5.1f}%  {'; '.join(map(str, r['divergencias'][:4]))}")


def pagina(A: list[dict]) -> Path:
    cards = []
    for a in A:
        rel = os.path.relpath(a["wav"], SAIDA).replace("\\", "/")
        pre = f"{a['precisao']:.1f}%" if "precisao" in a else "—"
        div = html.escape("; ".join(map(str, a.get("divergencias", [])[:6])) or "nenhuma")
        cards.append(f"""<section class="card" id="{a['id']}">
  <h2>{html.escape(a['titulo'])}</h2>
  <p class="exp">{html.escape(a['explica'])}</p>
  <audio controls preload="none" src="{rel}"></audio>
  <p class="met">{html.escape(a['modelo'])} · voz {html.escape(a['voz'])} · {a['duracao']:.1f} s de áudio · gerado em {a['gerar_s']:.1f} s · Whisper {pre}</p>
  <p class="met">divergências: {div}</p>
  <details><summary>texto / prompt enviado</summary><pre>{html.escape(a['prompt'] or a['esperado'])}</pre></details>
  <label>nota (1 a 5) <input type="number" min="1" max="5" data-k="{a['id']}-n"></label>
  <textarea placeholder="o que achou? (fica salvo neste navegador)" data-k="{a['id']}-t"></textarea>
</section>""")
    doc = f"""<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Lab A1 · escuta</title>
<meta name="viewport" content="width=device-width,initial-scale=1"><style>
body{{font:16px/1.5 system-ui,sans-serif;max-width:860px;margin:24px auto;padding:0 16px;background:#f6efe3;color:#2b2118}}
h1{{font-size:1.5rem}} .card{{background:#fffaf1;border:1px solid #e2d3b8;border-radius:10px;padding:14px 18px;margin:14px 0}}
h2{{font-size:1.1rem;margin:0 0 4px}} .exp{{margin:0 0 8px;color:#6b5a45}} audio{{width:100%}} .met{{font-size:.85rem;color:#6b5a45;margin:6px 0}}
pre{{white-space:pre-wrap;font-size:.85rem;background:#f3ead9;padding:10px;border-radius:6px}} textarea{{width:100%;min-height:52px;margin-top:6px}}
</style></head><body><h1>Lab A1 · do roteiro seco à narração dirigida</h1>
<p>Ouça na ordem. A nota do Whisper mede se a fala está <b>certa</b>; se está <b>boa</b>, quem decide é o ouvido.</p>
{''.join(cards)}
<script>document.querySelectorAll('[data-k]').forEach(e=>{{try{{e.value=localStorage.getItem(e.dataset.k)||''}}catch(_){{}}
e.addEventListener('input',()=>{{try{{localStorage.setItem(e.dataset.k,e.value)}}catch(_){{}}}})}})</script></body></html>"""
    arq = SAIDA / "escuta.html"
    arq.write_text(doc, encoding="utf-8")
    return arq


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--sem-comparar", action="store_true")
    ap.add_argument("--sem-qa", action="store_true")
    a = ap.parse_args()
    carregar_env()
    CACHE.mkdir(parents=True, exist_ok=True)
    A = degraus((AQUI / "trecho.txt").read_text(encoding="utf-8").strip(), not a.sem_comparar)
    if not a.sem_qa:
        checar(A)
    (SAIDA / "resultados.json").write_text(json.dumps(A, ensure_ascii=False, indent=1), encoding="utf-8")
    print(pagina(A))
