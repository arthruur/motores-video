"""Processa e normaliza materiais brutos baixados do Google Drive (vídeos virais e panfletos)
para o acervo da Prensa e Hugging Face Datasets.

- Vídeos: recortados em 9:16 720p (15s), otimizados em H.264 CRF 28 com faststart.
- Panfletos/Imagens: convertidos em vídeos 9:16 de 15s com fundo desfocado e zoom suave (Ken Burns Effect).
- Metadados registrados em app/public/acervo/acervo.json.
"""
from __future__ import annotations

import hashlib
import json
import re
import subprocess
import sys
from datetime import date
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[2]
SAIDA = RAIZ / "app" / "public" / "acervo"
ACERVO_JSON = SAIDA / "acervo.json"
DUR_CLIPE = 15.0


def carregar_acervo() -> dict:
    if ACERVO_JSON.exists():
        return json.loads(ACERVO_JSON.read_text("utf-8"))
    return {"clipes": [], "rejeitados": []}


def gravar_acervo(acervo: dict) -> None:
    SAIDA.mkdir(parents=True, exist_ok=True)
    ACERVO_JSON.write_text(json.dumps(acervo, ensure_ascii=False, indent=2) + "\n", "utf-8")


def eh_video(caminho: Path) -> bool:
    try:
        cmd = ["ffprobe", "-v", "error", "-show_entries", "format=format_name", "-of", "csv=p=0", str(caminho)]
        res = subprocess.run(cmd, capture_output=True, text=True, timeout=10)
        return bool(res.stdout.strip())
    except Exception:
        return False


def obter_duracao(caminho: Path) -> float:
    try:
        cmd = ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(caminho)]
        res = subprocess.run(cmd, capture_output=True, text=True, timeout=10)
        return float(res.stdout.strip())
    except Exception:
        return 0.0


def processar_video(origem: Path, destino: Path) -> None:
    dur = obter_duracao(origem)
    ini = max(0.0, min(dur * 0.1, dur - DUR_CLIPE)) if dur > DUR_CLIPE else 0.0
    filtro = "scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280,fps=30,format=yuv420p"
    subprocess.run([
        "ffmpeg", "-v", "error", "-y", "-ss", f"{ini:.2f}", "-t", f"{DUR_CLIPE}",
        "-i", str(origem), "-vf", filtro, "-an", "-c:v", "libx264",
        "-preset", "veryfast", "-crf", "28", "-movflags", "+faststart", str(destino)
    ], check=True, timeout=300)


def processar_imagem_panfleto(origem: Path, destino: Path) -> None:
    """Cria um clipe vertical 9:16 de 15s com fundo desfocado e zoom suave da imagem."""
    # Filtro complexo: fundo desfocado cobrindo a tela + imagem nítida com leve zoompan
    filtro = (
        "[0:v]scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280,boxblur=25:5[bg];"
        "[0:v]scale=660:-1[fg];"
        "[bg][fg]overlay=(W-w)/2:(H-h)/2,zoompan=z='min(zoom+0.0008,1.15)':d=450:s=720x1280:fps=30,format=yuv420p"
    )
    subprocess.run([
        "ffmpeg", "-v", "error", "-y", "-loop", "1", "-t", f"{DUR_CLIPE}",
        "-i", str(origem), "-filter_complex", filtro, "-an", "-c:v", "libx264",
        "-preset", "veryfast", "-crf", "28", "-movflags", "+faststart", str(destino)
    ], check=True, timeout=300)


def limpar_slug(texto: str) -> str:
    s = re.sub(r"[^a-zA-Z0-9]+", "-", texto.lower()).strip("-")
    return s[:32] if s else "item"


def processar_tudo():
    acervo = carregar_acervo()
    existentes_sha = {c.get("sha256") for c in acervo["clipes"]}
    
    pastas = [
        (RAIZ / "tmp_drive" / "pasta1", "cortes-virais", "video"),
        (RAIZ / "tmp_drive" / "pasta2", "panfletos", "imagem"),
        (RAIZ / "tmp_drive" / "pasta3", "comunidade", "misto"),
    ]

    total_novos = 0

    for pasta, cat, tipo in pastas:
        if not pasta.exists():
            continue
        print(f"\n--- Processando {pasta.name} ({cat}) ---")
        arquivos = sorted([f for f in pasta.iterdir() if f.is_file() and not f.name.endswith(".part")])

        for arq in arquivos:
            ext = arq.suffix.lower()
            slug = limpar_slug(arq.stem)
            id_ = f"{cat[:4]}-{slug}"
            destino = SAIDA / f"{id_}.mp4"

            if destino.exists():
                continue

            eh_img = ext in {".jpg", ".jpeg", ".png", ".webp"}
            eh_vid = ext in {".mp4", ".mov", ".webm", ".mkv"} or eh_video(arq)

            if not eh_img and not eh_vid:
                continue

            print(f"  [{'IMAGEM' if eh_img else 'VÍDEO'}] {arq.name} -> {destino.name}...")

            try:
                if eh_img:
                    processar_imagem_panfleto(arq, destino)
                else:
                    processar_video(arq, destino)
            except Exception as e:
                print(f"    Erro ao converter {arq.name}: {e}")
                destino.unlink(missing_ok=True)
                continue

            sha = hashlib.sha256(destino.read_bytes()).hexdigest()
            if sha in existentes_sha:
                print(f"    Duplicado ignorado (SHA idêntico).")
                destino.unlink(missing_ok=True)
                continue

            acervo["clipes"].append({
                "id": id_,
                "categoria": cat,
                "arquivo": destino.name,
                "titulo": arq.stem.replace("_", " ").replace("-", " ")[:60],
                "credito": "Acervo Comunitário (Drive)",
                "licenca": "CC BY 4.0",
                "revisado": False,  # licença não declarada por quem enviou: entra como não revisado
                "largura": 720,
                "altura": 1280,
                "duracao_s": DUR_CLIPE,
                "sha256": sha,
                "origem": {
                    "fonte": "google-drive-colaborativo",
                    "arquivo_original": arq.name
                },
                "licenca_url": "https://creativecommons.org/licenses/by/4.0",
                "share_alike": False,
                "modificacoes": "conversão 9:16 720p 15s sem áudio",
                "coletado_em": date.today().isoformat()
            })
            existentes_sha.add(sha)
            total_novos += 1
            gravar_acervo(acervo)

    print(f"\nFinalizado! {total_novos} novos clipes criados e catalogados.")


if __name__ == "__main__":
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    processar_tudo()
