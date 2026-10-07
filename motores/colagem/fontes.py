"""fontes.json: as falas de onde a colagem tira os fragmentos, e o download só do trecho que interessa.

Formato (README do motor): {"fontes": [{"slug", "figura", "data", "ocasiao", "rotulo", "url",
"trecho": {"ini", "fim"}, "arquivo", "palavras"?, "aviso"?, "frases"?, "excluir"?, "creditos"?}],
"fontes_opcionais"?: [...]}.
O tempo dentro do arquivo baixado + trecho.ini = o tempo no vídeo original.
"""
from __future__ import annotations

import importlib.util
import json
import shutil
import subprocess
import sys
from pathlib import Path


def carregar(arquivo: str | Path, opcionais: bool = False) -> dict:
    """lê fontes.json e resolve `arquivo` (e `palavras`, se houver) em relação à pasta do JSON.
    Com `opcionais`, junta as de `fontes_opcionais`."""
    arquivo = Path(arquivo).resolve()
    d = json.loads(arquivo.read_text(encoding="utf-8"))
    if opcionais:
        d["fontes"] = d["fontes"] + d.get("fontes_opcionais", [])
    vistos = set()
    for f in d["fontes"]:
        for k in ("slug", "figura", "url", "trecho"):
            if k not in f:
                raise ValueError(f"fonte sem '{k}' em {arquivo}: {f.get('slug') or f}")
        if f["slug"] in vistos:
            raise ValueError(f"slug repetido em {arquivo}: {f['slug']}")
        vistos.add(f["slug"])
        f.setdefault("arquivo", f"entrada/{f['slug']}.mp4")
        f.setdefault("rotulo", f.get("ocasiao") or "")
        f["_caminho"] = arquivo.parent / f["arquivo"]
        f["_palavras"] = arquivo.parent / f["palavras"] if f.get("palavras") else None
    d["_pasta"] = arquivo.parent
    return d


def hms(s: float) -> str:
    s = int(round(s))
    return f"{s // 3600:02d}:{s % 3600 // 60:02d}:{s % 60:02d}"


def minutos(s: float) -> str:
    s = int(s)
    return f"{s // 60}:{s % 60:02d}"


def duracao(arq: Path) -> float:
    r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(arq)],
                       capture_output=True, text=True)
    return float(r.stdout.strip() or 0)


def _ytdlp() -> list[str]:
    if importlib.util.find_spec("yt_dlp"):
        return [sys.executable, "-m", "yt_dlp"]
    if shutil.which("yt-dlp"):
        return ["yt-dlp"]
    raise RuntimeError("yt-dlp não encontrado: pip install -r motores/colagem/requisitos.txt")


def _ini_em(de: Path) -> dict:
    """trecho.ini de cada slug no fontes.json de `de` (ou da pasta acima), se houver: onde o arquivo de lá começa."""
    for p in (Path(de) / "fontes.json", Path(de).parent / "fontes.json"):
        if p.is_file():
            try:
                d = json.loads(p.read_text(encoding="utf-8"))
                return {f["slug"]: (f.get("trecho") or {}).get("ini", 0) or 0
                        for f in d.get("fontes", []) + d.get("fontes_opcionais", []) if "slug" in f}
            except (ValueError, KeyError, TypeError, AttributeError):
                pass
    return {}


def _copiar(orig: Path, dest: Path, f: dict, ini_orig: float) -> str:
    """copia `orig`; se ele for maior que o trecho, corta o trecho (re-codifica, para o corte cair no quadro certo).
    `ini_orig` = onde `orig` começa no vídeo original (0 = vídeo inteiro)."""
    ini, fim = f["trecho"].get("ini", 0) or 0, f["trecho"].get("fim")
    dur = duracao(orig)
    if not fim or abs(dur - (fim - ini)) <= 3:
        shutil.copy2(orig, dest)
        return "copiado"
    de_s = ini - ini_orig
    if de_s < 0 or de_s + (fim - ini) > dur + 0.5:
        raise ValueError(f"{orig} ({dur:.1f} s a partir de {ini_orig} s do original) não contém o trecho {ini}-{fim} s")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", f"{de_s:.3f}", "-i", str(orig), "-t", f"{fim - ini:.3f}",
                    "-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-c:a", "aac", "-b:a", "192k",
                    "-movflags", "+faststart", str(dest)], check=True)
    return "cortado"


def baixar(fontes: dict, de: Path | None = None, log=print) -> list[dict]:
    """Baixa com yt-dlp o que falta em `arquivo`. Com `de`, antes copia <de>/<slug>.mp4 se existir;
    se esse arquivo for maior que o trecho, corta (onde ele começa no original vem do fontes.json de `de`
    ou da pasta acima, se houver; senão 0, vídeo inteiro).
    trecho.fim null = vídeo inteiro (o corte com --force-keyframes-at-cuts re-codifica e já falhou)."""
    feitos = []
    inis = _ini_em(de) if de else {}
    for f in fontes["fontes"]:
        dest: Path = f["_caminho"]
        dest.parent.mkdir(parents=True, exist_ok=True)
        if dest.exists():
            como = "já estava"
        elif de and (Path(de) / f"{f['slug']}.mp4").exists():
            como = _copiar(Path(de) / f"{f['slug']}.mp4", dest, f, inis.get(f["slug"], 0)) + f" de {de}"
        else:
            ini, fim = f["trecho"].get("ini", 0), f["trecho"].get("fim")
            corte = ["--download-sections", f"*{hms(ini)}-{hms(fim)}", "--force-keyframes-at-cuts"] if fim else []
            subprocess.run([*_ytdlp(), "-q", "--no-warnings", *corte,
                            "-f", "bv*[height<=720][height>=360]+ba/b[height<=720]/b",
                            "--merge-output-format", "mp4", "-o", str(dest.with_suffix(".%(ext)s")), f["url"]],
                           check=True)
            como = "baixado"
        dur = duracao(dest)
        esperado = (f["trecho"]["fim"] - f["trecho"].get("ini", 0)) if f["trecho"].get("fim") else None
        aviso = f"  (esperado ~{esperado:.0f} s)" if esperado and abs(dur - esperado) > 3 else ""
        log(f"{f['slug']:10s} {como:28s} {dur:6.1f} s{aviso}")
        feitos.append({"slug": f["slug"], "como": como, "duracao_s": round(dur, 1)})
    return feitos
