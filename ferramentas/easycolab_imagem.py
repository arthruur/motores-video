"""Gera imagens com Qwen-Image-2.1 / Z-Image-Turbo num servidor EasyColab rodando no Colab.

A interface web do EasyColab só faz vídeo (MiniMax-H3); imagem só pela API. Este script usa a API.

uso:
  python easycolab_imagem.py URL status
  python easycolab_imagem.py URL preparar --modelo qwen      # baixa (1ª vez) e carrega na GPU
  python easycolab_imagem.py URL gerar "prompt..." --modelo qwen [--largura 1328 --altura 1328 --passos 40 --qtd 1]
  python easycolab_imagem.py URL desligar                     # libera a máquina do Colab (para de gastar unidades)

modelos: qwen (Qwen-Image-2.1, ~31 GB, melhor qualidade e texto) | zimage (Z-Image-Turbo, 8 passos, rápido)
As imagens vão para ./imagens_colab/ (e também ficam no Drive em MyDrive/Aevix_Outputs).
"""
from __future__ import annotations

import argparse
import sys
import time
from pathlib import Path

import requests

for s in (sys.stdout, sys.stderr):
    s.reconfigure(encoding="utf-8")

MODELOS = {"qwen": "qwen_image_21", "zimage": "z_image_turbo"}
PASSOS_PADRAO = {"qwen": 40, "zimage": 8}


def api(url: str, metodo: str, caminho: str, **kw):
    r = requests.request(metodo, url.rstrip("/") + caminho, timeout=120, **kw)
    r.raise_for_status()
    return r


def status(url: str, model_id: str | None = None) -> dict:
    return api(url, "GET", "/minimax_api/status", params={"model_id": model_id} if model_id else None).json()


def mostrar_status(s: dict) -> None:
    print(f"GPU: {s.get('gpu_name')} | VRAM livre {s.get('vram_free_gb')} / {s.get('vram_total_gb')} GB")
    print(f"Carregados na GPU: {s.get('loaded_model_ids') or 'nenhum'}")
    print(f"Unidades: {s.get('cu_burn_rate_per_hour')} /h | gastas nesta sessão: {s.get('session_cu_used')}")
    resto = s.get("idle_remaining_seconds", -1)
    if resto is not None and resto >= 0:
        print(f"Desliga sozinho por inatividade em {resto // 60} min")


def esperar_tarefa(url: str, model_id: str, chave: str, rotulo: str) -> dict:
    ultimo = ""
    while True:
        s = status(url, model_id)
        msg = f"{rotulo}: {round(100 * float(s.get('task_progress') or 0))}% · {s.get('task_message', '')}"
        if msg != ultimo:
            print(msg, flush=True)
            ultimo = msg
        if not s.get(chave):
            return s
        time.sleep(5)


def preparar(url: str, modelo: str, hf_token: str) -> None:
    mid = MODELOS[modelo]
    print(f"Baixando {mid} (se já estiver no Drive, é rápido)...")
    api(url, "POST", "/minimax_api/download_model", json={"model_id": mid, "hf_token": hf_token})
    time.sleep(3)
    esperar_tarefa(url, mid, "is_downloading", "download")
    print("Carregando na GPU...")
    api(url, "POST", "/minimax_api/load_model",
        json={"model_id": mid, "precision_mode": "bf16", "offload_mode": "disk", "hf_token": hf_token})
    time.sleep(3)
    s = esperar_tarefa(url, mid, "is_loading_vram", "carga")
    if mid in (s.get("loaded_model_ids") or []):
        print(f"✅ {mid} pronto na GPU.")
    else:
        print(f"❌ não carregou. Última mensagem: {s.get('task_message')}")
        sys.exit(1)


def ref_b64(caminho: Path) -> str:
    """PNG com transparência -> fundo branco (o servidor converte para RGB e o transparente viraria preto)."""
    import base64
    import io
    from PIL import Image
    im = Image.open(caminho).convert("RGBA")
    fundo = Image.new("RGBA", im.size, (255, 255, 255, 255))
    fundo.alpha_composite(im)
    buf = io.BytesIO()
    fundo.convert("RGB").save(buf, format="PNG")
    return base64.b64encode(buf.getvalue()).decode("ascii")


def gerar(url: str, modelo: str, prompt: str, negativo: str, largura: int, altura: int,
          passos: int | None, qtd: int, semente: int | None, pasta: Path, refs: list[Path] | None = None) -> None:
    mid = MODELOS[modelo]
    refs = refs or []
    corpo = {
        "model_id": mid, "task_mode": "i2i_edit" if refs else "t2i", "visual_prompt": prompt, "negative_prompt": negativo,
        "first_frame_base64": ref_b64(refs[0]) if len(refs) > 0 else None,
        "last_frame_base64": ref_b64(refs[1]) if len(refs) > 1 else None,
        "width": largura, "height": altura, "num_inference_steps": passos or PASSOS_PADRAO[modelo],
        "seed": semente if semente is not None else 42, "randomize_seed": semente is None, "batch_count": qtd,
    }
    job = api(url, "POST", "/minimax_api/generate", json=corpo).json()
    if job.get("status") == "failed":
        print(f"❌ {job.get('message')}")
        print("   (rode antes: preparar --modelo " + modelo + ")")
        sys.exit(1)
    jid, baixados, ultimo = job["job_id"], set(), ""
    pasta.mkdir(parents=True, exist_ok=True)
    while True:
        j = api(url, "GET", f"/minimax_api/job/{jid}").json()
        msg = f"{round(100 * float(j.get('progress') or 0))}% · {j.get('message', '')}"
        if msg != ultimo:
            print(msg, flush=True)
            ultimo = msg
        for item in j.get("completed_videos") or []:
            nome = item["filename"]
            if nome not in baixados:
                destino = pasta / nome
                destino.write_bytes(api(url, "GET", f"/minimax_api/media/{nome}").content)
                baixados.add(nome)
                print(f"✅ {destino}  (semente {item.get('seed')}, {item.get('elapsed')}s)")
        if j.get("status") in ("done", "completed", "success", "failed", "cancelled"):
            if j.get("status") == "failed":
                print(f"❌ {j.get('message')}")
            break
        time.sleep(3)


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("url", help="o link https://....gradio.live que a Célula 5 mostrou")
    ap.add_argument("acao", choices=["status", "preparar", "gerar", "desligar"])
    ap.add_argument("prompt", nargs="?", default="")
    ap.add_argument("--modelo", choices=list(MODELOS), default="qwen")
    ap.add_argument("--negativo", default="")
    ap.add_argument("--largura", type=int, default=1328)
    ap.add_argument("--altura", type=int, default=1328)
    ap.add_argument("--passos", type=int)
    ap.add_argument("--qtd", type=int, default=1, help="quantas imagens (1 a 8)")
    ap.add_argument("--semente", type=int, help="fixa a semente (padrão: aleatória)")
    ap.add_argument("--ref", type=Path, action="append", help="imagem de referência (até 2; ativa o modo edição)")
    ap.add_argument("--hf-token", default="")
    ap.add_argument("--pasta", type=Path, default=Path("imagens_colab"))
    a = ap.parse_args()

    if a.acao == "status":
        mostrar_status(status(a.url))
    elif a.acao == "preparar":
        preparar(a.url, a.modelo, a.hf_token)
    elif a.acao == "gerar":
        if not a.prompt:
            ap.error("falta o prompt entre aspas")
        gerar(a.url, a.modelo, a.prompt, a.negativo, a.largura, a.altura, a.passos, a.qtd, a.semente, a.pasta, a.ref)
    elif a.acao == "desligar":
        api(a.url, "POST", "/minimax_api/disconnect")
        print("🛑 pedido de desligamento enviado. Confira no Colab se a sessão caiu.")


if __name__ == "__main__":
    main()
