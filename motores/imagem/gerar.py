"""Gerador de imagem (Gemini / "Nano Banana") para a produção de arte.

Usa a mesma GEMINI_API_KEY do TTS (.env na raiz). Aceita imagens de referência
(ex.: o Cesto) e grava a imagem, o prompt e os metadados lado a lado, para que
toda geração boa possa ser repetida.

  python -m motores.imagem.gerar --prompt arquivo.txt|"texto" --ref img.png [--ref outra.png]
        --saida pasta/nome.png [--modelo gemini-3-pro-image] [--proporcao 16:9] [--n 1]

Modelos testados: gemini-3-pro-image (melhor fidelidade a referência),
gemini-3.1-flash-image (rápido, barato), gemini-2.5-flash-image.
"""
import argparse
import base64
import datetime as dt
import json
import mimetypes
import os
import re
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[2]
MODELO_PADRAO = "gemini-3-pro-image"


def _chave() -> str:
    if os.environ.get("GEMINI_API_KEY"):
        return os.environ["GEMINI_API_KEY"]
    env = RAIZ / ".env"
    if env.exists():
        m = re.search(r"^GEMINI_API_KEY=(.+)$", env.read_text(encoding="utf-8"), re.M)
        if m:
            return m.group(1).strip().strip('"')
    raise SystemExit("GEMINI_API_KEY não encontrada (.env na raiz do repositório)")


def gerar(prompt: str, refs: list[Path], modelo: str = MODELO_PADRAO, proporcao: str | None = None,
          tamanho: str | None = None) -> tuple[list[bytes], str, dict]:
    """Devolve (imagens PNG/JPEG em bytes, texto que o modelo escreveu, uso)."""
    partes = []
    for r in refs:
        mime = mimetypes.guess_type(r.name)[0] or "image/png"
        partes.append({"inlineData": {"mimeType": mime, "data": base64.b64encode(r.read_bytes()).decode()}})
    partes.append({"text": prompt})
    cfg = {"responseModalities": ["TEXT", "IMAGE"]}
    img = {}
    if proporcao:
        img["aspectRatio"] = proporcao
    if tamanho:
        img["imageSize"] = tamanho
    if img:
        cfg["imageConfig"] = img
    corpo = json.dumps({"contents": [{"parts": partes}], "generationConfig": cfg}).encode()
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{modelo}:generateContent"
    espera, ultimo = 10, ""
    for _ in range(5):
        req = urllib.request.Request(url, data=corpo, headers={"x-goog-api-key": _chave(), "Content-Type": "application/json"})
        try:
            r = json.load(urllib.request.urlopen(req, timeout=300))
        except urllib.error.HTTPError as e:
            ultimo = f"{e.code}: {e.read().decode('utf-8', 'replace')[:500]}"
            if e.code in (429, 500, 503) and "PerDay" not in ultimo and "limit: 0" not in ultimo:
                time.sleep(espera); espera *= 2
                continue
            raise RuntimeError(f"{modelo} respondeu {ultimo}") from e
        cand = (r.get("candidates") or [{}])[0]
        imgs, texto = [], []
        for p in cand.get("content", {}).get("parts", []):
            if "inlineData" in p:
                imgs.append(base64.b64decode(p["inlineData"]["data"]))
            elif p.get("text") and not p.get("thought"):
                texto.append(p["text"])
        if imgs:
            return imgs, "\n".join(texto), r.get("usageMetadata", {})
        ultimo = f"sem imagem (finishReason={cand.get('finishReason')}) {' '.join(texto)[:300]}"
    raise RuntimeError(f"{modelo}: {ultimo}")


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--prompt", required=True, help="texto ou caminho de um .txt/.md")
    ap.add_argument("--ref", action="append", default=[], type=Path, help="imagem de referência (repetível)")
    ap.add_argument("--saida", required=True, type=Path, help="arquivo .png (com --n > 1 ganha -1, -2...)")
    ap.add_argument("--modelo", default=MODELO_PADRAO)
    ap.add_argument("--proporcao", help="1:1, 16:9, 9:16, 3:2, 4:3, 21:9...")
    ap.add_argument("--tamanho", help="1K, 2K ou 4K (modelos que aceitam)")
    ap.add_argument("--n", type=int, default=1, help="quantas gerações independentes")
    a = ap.parse_args(argv)

    p = Path(a.prompt)
    prompt = p.read_text(encoding="utf-8") if p.suffix in (".txt", ".md") and p.exists() else a.prompt
    a.saida.parent.mkdir(parents=True, exist_ok=True)
    for i in range(a.n):
        t0 = time.time()
        imgs, texto, uso = gerar(prompt, a.ref, a.modelo, a.proporcao, a.tamanho)
        for j, b in enumerate(imgs):
            suf = (f"-{i+1}" if a.n > 1 else "") + (f"-{j+1}" if len(imgs) > 1 else "")
            ext = ".jpg" if b[:3] == b"\xff\xd8\xff" else ".png"
            alvo = a.saida.with_name(a.saida.stem + suf + ext)
            alvo.write_bytes(b)
            meta = {"data": dt.datetime.now().isoformat(timespec="seconds"), "modelo": a.modelo,
                    "refs": [str(r) for r in a.ref], "proporcao": a.proporcao, "tamanho": a.tamanho,
                    "segundos": round(time.time() - t0, 1), "uso": uso, "texto_do_modelo": texto, "prompt": prompt}
            alvo.with_suffix(".json").write_text(json.dumps(meta, ensure_ascii=False, indent=1), encoding="utf-8")
            print(f"{alvo}  ({meta['segundos']} s)")


if __name__ == "__main__":
    sys.exit(main())
