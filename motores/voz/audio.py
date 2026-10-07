"""Áudio: conversões com ffmpeg e o Whisper (faster-whisper, CPU) compartilhado por alinhar e qa."""
from __future__ import annotations

import os
import shutil
import subprocess
from pathlib import Path

WHISPER_PADRAO = os.environ.get("MOTORES_VOZ_WHISPER", "small")


def _ffmpeg(*args: str, saida_binaria: bool = False) -> bytes:
    if not shutil.which("ffmpeg"):
        raise RuntimeError("ffmpeg não encontrado no PATH (https://ffmpeg.org/download.html)")
    r = subprocess.run(["ffmpeg", "-v", "error", *args], capture_output=True)
    if r.returncode:
        raise RuntimeError(f"ffmpeg falhou: {r.stderr.decode(errors='replace').strip()}")
    return r.stdout if saida_binaria else b""


def para_wav(origem: Path, destino: Path, taxa: int = 48000, aparar: bool = False, filtro: str = "") -> None:
    """Qualquer formato -> WAV PCM mono. `aparar` tira o silêncio das pontas (nunca o do meio)."""
    filtros = [f for f in [filtro] if f]
    if aparar:
        filtros.append("silenceremove=start_periods=1:start_threshold=-45dB,areverse,"
                       "silenceremove=start_periods=1:start_threshold=-45dB,areverse")
    destino.parent.mkdir(parents=True, exist_ok=True)
    _ffmpeg("-y", "-i", str(origem), *(["-af", ",".join(filtros)] if filtros else []),
            "-ar", str(taxa), "-ac", "1", "-c:a", "pcm_s16le", str(destino))


def duracao(arquivo: Path) -> float:
    r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(arquivo)],
                       capture_output=True, text=True)
    return float(r.stdout.strip() or 0)


def pcm16k(arquivo: Path):
    """Áudio como array float32 16 kHz mono. O ffmpeg decodifica: o PyAV às vezes quebra o faster-whisper (lab 01)."""
    import numpy as np

    return np.frombuffer(_ffmpeg("-i", str(arquivo), "-ac", "1", "-ar", "16000", "-f", "f32le", "-",
                                 saida_binaria=True), dtype=np.float32)


_modelos: dict[str, object] = {}


def whisper(modelo: str = WHISPER_PADRAO):
    # int8 na CPU: roda em qualquer PC, sem GPU. Baixa o modelo na 1ª vez (small: ~460 MB).
    if modelo not in _modelos:
        from faster_whisper import WhisperModel

        _modelos[modelo] = WhisperModel(modelo, device="cpu", compute_type="int8")
    return _modelos[modelo]


def transcrever(arquivo: Path, modelo: str = WHISPER_PADRAO, palavras: bool = False,
                dica: str | None = None, vad: bool = False) -> tuple[str, list[dict]]:
    """-> (texto ouvido, [{texto, inicio, fim, confianca}] se `palavras`)."""
    segs, _ = whisper(modelo).transcribe(pcm16k(arquivo), language="pt", word_timestamps=palavras,
                                         initial_prompt=dica, vad_filter=vad)
    texto, lista = [], []
    for s in segs:
        texto.append(s.text.strip())
        for p in (s.words or []) if palavras else []:
            lista.append({"texto": p.word.strip(), "inicio": round(float(p.start), 3), "fim": round(float(p.end), 3),
                          "confianca": round(float(p.probability), 2)})
    return " ".join(texto), lista
