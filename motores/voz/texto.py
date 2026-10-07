"""Texto: normalização para comparar fala com roteiro e dicionário de pronúncia por motor."""
from __future__ import annotations

import json
import re
import unicodedata
from pathlib import Path

PRONUNCIA_PADRAO = Path(__file__).with_name("pronuncia.json")


def _numeros_por_extenso(s: str) -> str:
    # O Whisper escreve "1988"; o roteiro pode dizer "mil novecentos e oitenta e oito".
    # Sem isto, a nota mede convenção de escrita, não erro de fala (lição do lab 02).
    try:
        from num2words import num2words
    except ImportError:  # sem num2words a comparação segue, só fica mais severa com números
        return s

    def extenso(n: str) -> str:
        return f" {num2words(int(n), lang='pt_BR')} "

    s = re.sub(r"(?<=\d)\.(?=\d{3}\b)", "", s)  # 1.500 -> 1500
    s = re.sub(r"(\d+),(\d+)", lambda m: f"{extenso(m.group(1))} vírgula {extenso(m.group(2))}", s)
    return re.sub(r"\d+", lambda m: extenso(m.group()), s)


def tokens(s: str) -> list[str]:
    """Palavras comparáveis: minúsculas, sem acento, sem pontuação, números por extenso."""
    s = unicodedata.normalize("NFD", _numeros_por_extenso(s).lower())
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return [w for w in re.split(r"[^a-z0-9]+", s) if w]


def carregar_pronuncia(arquivo: str | Path | None = None) -> dict[str, dict[str, str]]:
    arq = Path(arquivo) if arquivo else PRONUNCIA_PADRAO
    dados = json.loads(arq.read_text(encoding="utf-8"))
    return {k: v for k, v in dados.items() if not k.startswith("_") and isinstance(v, dict)}


def aplicar_pronuncia(texto: str, motor: str, arquivo: str | Path | None = None) -> str:
    """Grafia que a VOZ recebe. A legenda continua com o texto original.

    Usa a seção "todos" e depois a do motor: a mesma troca pode consertar um motor e
    quebrar outro ("sús" conserta o Kokoro e piora o Piper, lab 02).
    """
    secoes = carregar_pronuncia(arquivo)
    trocas = {**secoes.get("todos", {}), **secoes.get(motor, {})}
    for termo, som in trocas.items():
        texto = re.sub(rf"(?<!\w){re.escape(termo)}(?!\w)", som, texto)
    return texto
