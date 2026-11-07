"""Qwen-Image-Edit-2511 pelos Spaces gratuitos do Hugging Face (cota de GPU diária da conta HF logada).

Edita a partir de 1 ou mais imagens de referência. Serve para:
  - girar a câmera de um personagem que já existe  (--lora Multiple-Angles, prompt em chinês)
  - desenhar algo novo no estilo de uma referência  (--lora Style-Transfer, prompt em inglês)
  - mudar pose/expressão mantendo o design         (--lora Multiple-Angles ou Style-Transfer, prompt em inglês)

  python -m motores.imagem.qwen --ref a.png [--ref b.png] --prompt "..." --saida pasta/nome.png
        [--lora Multiple-Angles] [--n 2] [--passos 4]

Prompts de câmera do LoRA Multiple-Angles (testados no Cesto/Mangaio):
  将镜头向左旋转45度  girar 45° (3/4)         -> bom
  将镜头向左旋转90度  girar 90° (perfil)     -> aproveitável
  将镜头转为俯视      vista de cima            -> ruim (virou 3D); prefira inclinação menor
A saída tem a proporção da 1ª referência: para 9:16, entregue a referência num quadro 9:16.
Grava <saida>.png e <saida>.json (prompt, refs, lora, seed, tempo).
"""
import argparse
import base64
import datetime as dt
import json
import sys
import time
from pathlib import Path

SPACE = "prithivMLmods/Qwen-Image-Edit-2511-LoRAs-Fast"


def editar(refs, prompt, lora="Style-Transfer", passos=4, guidance=1.0, seed=0, space=SPACE):
    from gradio_client import Client
    imgs = []
    for r in refs:
        r = Path(r)
        mime = "image/jpeg" if r.suffix.lower() in (".jpg", ".jpeg") else "image/png"
        imgs.append(f"data:{mime};base64," + base64.b64encode(r.read_bytes()).decode())
    c = Client(space, verbose=False)
    res = c.predict(json.dumps(imgs), prompt, lora, int(seed), seed == 0, float(guidance), int(passos),
                    api_name="/edit_image")
    im = res.get("image", "") if isinstance(res, dict) else ""
    if not im.startswith("data:"):
        raise RuntimeError(f"sem imagem: {str(res)[:300]}")
    return base64.b64decode(im.split(",", 1)[1]), res.get("seed")


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--ref", action="append", required=True)
    ap.add_argument("--prompt", required=True, help="texto ou caminho .txt/.md")
    ap.add_argument("--saida", required=True, type=Path)
    ap.add_argument("--lora", default="Style-Transfer")
    ap.add_argument("--passos", type=int, default=4)
    ap.add_argument("--guidance", type=float, default=1.0)
    ap.add_argument("--seed", type=int, default=0, help="0 = aleatória")
    ap.add_argument("--n", type=int, default=1)
    a = ap.parse_args(argv)
    p = Path(a.prompt)
    prompt = p.read_text(encoding="utf-8") if p.suffix in (".txt", ".md") and p.exists() else a.prompt
    a.saida.parent.mkdir(parents=True, exist_ok=True)
    for i in range(a.n):
        t0 = time.time()
        png, seed = editar(a.ref, prompt, a.lora, a.passos, a.guidance, a.seed)
        alvo = a.saida.with_name(a.saida.stem + (f"-{i+1}" if a.n > 1 else "") + ".png")
        alvo.write_bytes(png)
        alvo.with_suffix(".json").write_text(json.dumps({
            "data": dt.datetime.now().isoformat(timespec="seconds"), "modelo": "Qwen-Image-Edit-2511",
            "space": SPACE, "lora": a.lora, "passos": a.passos, "seed": seed, "refs": a.ref,
            "segundos": round(time.time() - t0, 1), "prompt": prompt}, ensure_ascii=False, indent=1), encoding="utf-8")
        print(f"{alvo}  ({time.time()-t0:.0f} s)")


if __name__ == "__main__":
    sys.exit(main())
