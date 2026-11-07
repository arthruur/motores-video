"""Banco de sons determinísticos do kit da série "Novela da Caatinga" (`SERIE/kit/sons`).

Registra todos os efeitos pontuais (`presets.py`), ambiências em loop sem emenda
e frases de trompete do Mangaio (`trompete.py`) no motor `motores.animacao.som`.

Licença: Apache-2.0 (síntese determinística própria com semente fixa).
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import numpy as np

from motores.animacao.som import registrar_provedor
from .presets import (
    ALIASES_PRESETS,
    PRESETS_AMBIENCIAS,
    PRESETS_EFEITOS,
    PRESETS_EXTRAS_LEGADOS,
)
from .trompete import ALIASES_TROMPETE, FRASES_TROMPETE, sintetizar_trompete

AQUI = Path(__file__).resolve().parent
CAMINHO_CATALOGO = AQUI / "catalogo.json"


def carregar_catalogo() -> dict[str, Any]:
    """Lê e retorna o dicionário completo de `catalogo.json`."""
    return json.loads(CAMINHO_CATALOGO.read_text(encoding="utf-8"))


def listar_ids_catalogo() -> list[str]:
    """Retorna a lista ordenada dos 29 IDs canônicos do catálogo oficial."""
    cat = carregar_catalogo()
    return [item["id"] for item in cat.get("sons", [])]


def resolver_id_som(id_som: str) -> str:
    """Resolve aliases de compatibilidade (`plof` -> `pouso_cheio`, etc.) para o ID canônico."""
    if id_som in ALIASES_TROMPETE:
        return ALIASES_TROMPETE[id_som]
    if id_som in ALIASES_PRESETS:
        return ALIASES_PRESETS[id_som]
    return id_som


def obter_som(
    id_som: str,
    dur: float | None = None,
    semente: int = 5,
) -> np.ndarray:
    """Sintetiza ou carrega um som pelo `id_som` (incluindo aliases de compatibilidade)."""
    id_canonico = resolver_id_som(str(id_som))

    if id_canonico in FRASES_TROMPETE or id_som in ALIASES_TROMPETE:
        return sintetizar_trompete(id_canonico, dur=dur, semente=semente)

    if id_canonico in PRESETS_EFEITOS:
        return PRESETS_EFEITOS[id_canonico](dur=dur, semente=semente)

    if id_canonico in PRESETS_AMBIENCIAS:
        return PRESETS_AMBIENCIAS[id_canonico](dur=dur, semente=semente)

    if id_canonico in PRESETS_EXTRAS_LEGADOS:
        return PRESETS_EXTRAS_LEGADOS[id_canonico](dur=dur, semente=semente)

    raise KeyError(
        f"Som '{id_som}' (resolvido: '{id_canonico}') não encontrado no catálogo da Novela da Caatinga."
    )


registrar_provedor(obter_som)

__all__ = [
    "ALIASES_PRESETS",
    "ALIASES_TROMPETE",
    "CAMINHO_CATALOGO",
    "FRASES_TROMPETE",
    "PRESETS_AMBIENCIAS",
    "PRESETS_EFEITOS",
    "carregar_catalogo",
    "listar_ids_catalogo",
    "obter_som",
    "resolver_id_som",
]
