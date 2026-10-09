"""Módulo de transcrição acelerada por GPU (RTX / CUDA) usando faster-whisper.

Detecta automaticamente suporte a CUDA e carrega as bibliotecas da NVIDIA.
"""
from __future__ import annotations

import io
import os
import sys
import wave
from pathlib import Path
from typing import Any

# Adiciona DLLs CUDA do PyTorch no Windows se necessário
try:
    import torch
    torch_lib = os.path.join(os.path.dirname(torch.__file__), "lib")
    if os.path.exists(torch_lib) and hasattr(os, "add_dll_directory"):
        os.add_dll_directory(torch_lib)
except Exception:
    pass

_modelo_global = None
_modelo_nome = os.environ.get("WHISPER_MODEL", "small")


def obter_modelo():
    global _modelo_global
    if _modelo_global is not None:
        return _modelo_global

    from faster_whisper import WhisperModel
    import torch

    device = "cuda" if torch.cuda.is_available() else "cpu"
    compute_type = "float16" if device == "cuda" else "int8"

    print(f"[*] Carregando Whisper '{_modelo_nome}' no dispositivo '{device}' ({compute_type})...")
    _modelo_global = WhisperModel(_modelo_nome, device=device, compute_type=compute_type)
    print(f"[OK] Whisper pronto no dispositivo: {device.upper()}")
    return _modelo_global


def transcrever_audio_bytes(dados: bytes, idioma: str = "pt") -> list[dict[str, Any]]:
    """Recebe bytes de áudio (WAV, MP4, MP3 ou Float32 PCM) e retorna lista de palavras com timestamps."""
    modelo = obter_modelo()
    bio = io.BytesIO(dados)
    
    segmentos, info = modelo.transcribe(
        bio,
        language=idioma,
        word_timestamps=True,
        vad_filter=True,
    )

    palavras = []
    for s in segmentos:
        if hasattr(s, "words") and s.words:
            for w in s.words:
                texto = w.word.strip()
                if texto:
                    palavras.append({
                        "texto": texto,
                        "inicio": round(w.start, 2),
                        "fim": round(w.end, 2),
                    })
        else:
            # fallback se não vier palavra por palavra
            for w in s.text.strip().split():
                palavras.append({
                    "texto": w,
                    "inicio": round(s.start, 2),
                    "fim": round(s.end, 2),
                })

    return palavras
