"""Importa vídeos locais (por exemplo, baixados do Google Drive) para o acervo da Prensa.

Varre uma pasta de arquivos de vídeo (.mp4, .mov, .webm, .mkv), recorta automaticamente
um trecho de 15 segundos em 9:16 (720x1280 sem áudio) e adiciona as entradas em acervo.json
com 'revisado: false' para posterior aprovação via folha de contato.

Uso:
  python ferramentas/acervo/importar_pasta.py caminho/pasta/drive --categoria maquinas
  python ferramentas/acervo/importar_pasta.py caminho/pasta/drive --autor "Nome do Criador" --licenca "CC BY 4.0"
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import subprocess
import sys
import tempfile
from datetime import date
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[2]
if str(RAIZ) not in sys.path:
    sys.path.insert(0, str(RAIZ))
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


def obter_duracao(caminho: Path) -> float:
    cmd = ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(caminho)]
    res = subprocess.run(cmd, capture_output=True, text=True)
    try:
        return float(res.stdout.strip())
    except ValueError:
        return 0.0


def obter_dimensoes(caminho: Path) -> tuple[int, int]:
    cmd = ["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "csv=p=0", str(caminho)]
    res = subprocess.run(cmd, capture_output=True, text=True)
    try:
        parts = res.stdout.strip().split(",")
        return int(parts[0]), int(parts[1])
    except Exception:
        return 720, 1280


def tem_audio(caminho: Path) -> bool:
    cmd = ["ffprobe", "-v", "error", "-select_streams", "a", "-show_entries", "stream=codec_type", "-of", "csv=p=0", str(caminho)]
    res = subprocess.run(cmd, capture_output=True, text=True)
    return bool(res.stdout.strip())


def cortar_video(origem: Path, destino: Path, forcar_9_16: bool = False, sem_audio: bool = False, inteiro: bool = False) -> float:
    dur_total = obter_duracao(origem)
    if inteiro or dur_total <= DUR_CLIPE:
        ini = 0.0
        dur_corte = dur_total
        args_tempo = []
    else:
        ini = max(0.0, min(dur_total * 0.15, dur_total - DUR_CLIPE))
        dur_corte = DUR_CLIPE
        args_tempo = ["-ss", f"{ini:.2f}", "-t", f"{dur_corte:.2f}"]

    if forcar_9_16:
        filtro = "scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280,fps=30,format=yuv420p"
    else:
        filtro = "scale=trunc(iw/2)*2:trunc(ih/2)*2,fps=30,format=yuv420p"

    audio_cmd = ["-an"] if (sem_audio or not tem_audio(origem)) else ["-c:a", "aac", "-b:a", "128k"]

    cmd = [
        "ffmpeg", "-v", "error", "-y", *args_tempo,
        "-i", str(origem), "-vf", filtro, *audio_cmd, "-c:v", "libx264",
        "-preset", "veryfast", "-crf", "28", "-movflags", "+faststart", str(destino)
    ]
    subprocess.run(cmd, check=True, timeout=300)
    return dur_corte


def importar(alvo: Path, categoria: str, autor: str, licenca: str, licenca_url: str, titulo: str | None = None, aprovar_direto: bool = False, upload_hf: bool = False, repo_hf: str = "arthruur/prensa-acervo", forcar_9_16: bool = False, sem_audio: bool = False, inteiro: bool = False) -> None:
    if not alvo.exists():
        sys.exit(f"Arquivo ou pasta não encontrado: {alvo}")

    acervo = carregar_acervo()
    extensoes = {".mp4", ".mov", ".webm", ".mkv", ".m4v"}

    if alvo.is_file():
        arquivos = [alvo]
    else:
        arquivos = [f for f in alvo.iterdir() if f.is_file() and f.suffix.lower() in extensoes]

    if not arquivos:
        sys.exit(f"Nenhum arquivo de vídeo encontrado em {alvo}")

    print(f"Processando {len(arquivos)} arquivo(s)...")

    existentes_sha = {c.get("sha256") for c in acervo["clipes"]}
    importados = 0

    for arq in arquivos:
        nome_base = titulo or arq.stem
        slug = re.sub(r"[^a-z0-9]+", "-", nome_base.lower()).strip("-")[:30]
        id_ = f"{categoria}-{slug}" if categoria else slug
        destino = SAIDA / f"{id_}.mp4"

        possui_som = tem_audio(arq) and not sem_audio
        print(f"  Processando {arq.name} -> {destino.name} (áudio: {'sim' if possui_som else 'não'}, 9:16: {forcar_9_16})...")
        try:
            dur_final = cortar_video(arq, destino, forcar_9_16=forcar_9_16, sem_audio=sem_audio, inteiro=inteiro)
        except Exception as e:
            print(f"    Erro ao cortar {arq.name}: {e}")
            continue

        largura, altura = obter_dimensoes(destino)
        sha = hashlib.sha256(destino.read_bytes()).hexdigest()
        if sha in existentes_sha:
            print(f"    Já existe no acervo (mesmo hash sha256). Pulando.")
            destino.unlink(missing_ok=True)
            continue

        # remove versão anterior com mesmo id se houver
        acervo["clipes"] = [c for c in acervo["clipes"] if c.get("id") != id_]

        acervo["clipes"].append({
            "id": id_,
            "categoria": categoria or "geral",
            "arquivo": destino.name,
            "titulo": nome_base.replace("_", " ").replace("-", " ")[:60],
            "credito": autor or "Acervo colaborativo",
            "licenca": licenca or "CC BY 4.0",
            "revisado": aprovar_direto,
            "largura": largura,
            "altura": altura,
            "duracao_s": round(dur_final, 2),
            "tem_audio": possui_som,
            "sha256": sha,
            "origem": {
                "fonte": "importacao-direta",
                "arquivo_original": arq.name
            },
            "licenca_url": licenca_url,
            "share_alike": "sa" in licenca.lower(),
            "modificacoes": f"otimização H.264{' com áudio AAC' if possui_som else ' sem áudio'}",
            "coletado_em": date.today().isoformat()
        })
        existentes_sha.add(sha)
        importados += 1
        gravar_acervo(acervo)

    print(f"\nSucesso! {importados} clipe(s) processado(s) com 'revisado: {aprovar_direto}'.")

    if upload_hf:
        print("\nSincronizando com o Hugging Face Datasets...")
        from ferramentas.acervo.huggingface import exportar_para_pasta, upload_huggingface
        import tempfile
        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            exportar_para_pasta(tmp_path, repo_hf)
            upload_huggingface(repo_hf, tmp_path)
        # Limpa o mp4 local após upload bem-sucedido para manter o app leve
        for c in acervo["clipes"]:
            (SAIDA / c["arquivo"]).unlink(missing_ok=True)
        print("Clipes sincronizados na nuvem e pasta local mantida limpa!")
    else:
        print("Para enviar ao Hugging Face:")
        print(f"  python ferramentas/acervo/huggingface.py --upload --repo {repo_hf}")


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("alvo", type=Path, help="arquivo de vídeo ou pasta com vídeos")
    ap.add_argument("--categoria", default="geral", help="categoria temática (ex: maquinas, arte, lofi, phonk)")
    ap.add_argument("--titulo", default=None, help="título personalizado para o clipe")
    ap.add_argument("--autor", default="Comunidade", help="crédito do autor")
    ap.add_argument("--licenca", default="CC BY 4.0", help="licença autoral declarada")
    ap.add_argument("--licenca-url", default="", help="link da licença ou da fonte original")
    ap.add_argument("--aprovar", action="store_true", help="já marca o clipe como aprovado/revisado")
    ap.add_argument("--upload", action="store_true", help="já faz upload direto para o Hugging Face")
    ap.add_argument("--repo", default="arthruur/prensa-acervo", help="repositório HF destino")
    ap.add_argument("--forcar-9-16", action="store_true", help="força o recorte em 9:16 (720x1280) em vez de manter a proporção original")
    ap.add_argument("--sem-audio", action="store_true", help="remove a faixa de áudio (silencioso)")
    ap.add_argument("--inteiro", action="store_true", help="mantém a duração inteira do vídeo original (não corta em 15s)")
    args = ap.parse_args()

    importar(args.alvo, args.categoria, args.autor, args.licenca, args.licenca_url, args.titulo, args.aprovar, args.upload, args.repo, forcar_9_16=args.forcar_9_16, sem_audio=args.sem_audio, inteiro=args.inteiro)


if __name__ == "__main__":
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    main()
