"""QA pelo Whisper: o que foi DITO bate com o texto?

Mede se a fala está CERTA (palavra trocada, sigla lida errado). Se está BOA (entonação,
ritmo, naturalidade), quem decide é o ouvido (lição do lab 02).
"""
from __future__ import annotations

import difflib
import time
from pathlib import Path

from .audio import WHISPER_PADRAO, transcrever
from .texto import tokens


def precisao(texto: str, ouvido: str) -> tuple[float, list[str]]:
    """% de palavras do texto reconhecidas na ordem certa + lista das divergências ("texto → ouvido")."""
    a, b = tokens(texto), tokens(ouvido)
    sm = difflib.SequenceMatcher(None, a, b, autojunk=False)
    certos = sum(bl.size for bl in sm.get_matching_blocks())
    difs = [f"{' '.join(a[i1:i2]) or '∅'} → {' '.join(b[j1:j2]) or '∅'}"
            for op, i1, i2, j1, j2 in sm.get_opcodes() if op != "equal"]
    return 100 * certos / max(1, len(a)), difs


def avaliar(audio: str | Path, texto: str, modelo: str = WHISPER_PADRAO) -> dict:
    """Transcreve sem dica (checagem independente) e compara com o texto."""
    t0 = time.perf_counter()
    ouvido, _ = transcrever(Path(audio), modelo)
    pct, difs = precisao(texto, ouvido)
    return {"precisao": round(pct, 1), "divergencias": difs, "ouvido": ouvido,
            "modelo": f"faster-whisper {modelo} int8 CPU", "segundos": round(time.perf_counter() - t0, 2)}
