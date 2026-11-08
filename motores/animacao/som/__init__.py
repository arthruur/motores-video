"""Motor de síntese e mixagem de áudio determinístico em 48 kHz (`motores.animacao.som`).

Expõe a API pública:
- `sintetizar_som(id_som, dur=None, semente=5)`
- `mixar_timeline(plano, caminho_saida, obter_som=None, ...)`
- `auditar_wav(caminho)` / `medir_audio(caminho)`
- Primitivas de `sintese.py` (`SR`, `filtro`, `env`, `norm`, `tornar_loop_sem_emenda`, `repetir_loop`, `salvar_wav`, `ler_wav`)
"""
from __future__ import annotations

import importlib.util
from pathlib import Path
from typing import Callable

import numpy as np

from .mixador import (
    ProvedorSom,
    auditar_wav,
    curva_ducking,
    mixar_timeline as _mixar_timeline_base,
    normalizar_loudnorm_2passadas,
)
from .sintese import (
    SR,
    criar_rng,
    env,
    fade_anticlique,
    filtro,
    ler_wav,
    norm,
    repetir_loop,
    salvar_wav,
    tornar_loop_sem_emenda,
)

_PROVEDOR_REGISTRADO: ProvedorSom | None = None


def registrar_provedor(fn: ProvedorSom) -> None:
    """Registra função provedora padrão `fn(id_som, dur, semente) -> np.ndarray`."""
    global _PROVEDOR_REGISTRADO
    _PROVEDOR_REGISTRADO = fn


def _carregar_provedor_padrao() -> ProvedorSom:
    """Carrega preguiçosamente o provedor de `receitas/novela-da-caatinga/kit/sons`."""
    global _PROVEDOR_REGISTRADO
    if _PROVEDOR_REGISTRADO is not None:
        return _PROVEDOR_REGISTRADO

    raiz = Path(__file__).resolve().parents[3]
    init_kit = raiz / "receitas" / "novela-da-caatinga" / "kit" / "sons" / "__init__.py"
    if init_kit.is_file():
        spec = importlib.util.spec_from_file_location(
            "novela_caatinga_kit_sons",
            str(init_kit),
            submodule_search_locations=[str(init_kit.parent)],
        )
        if spec and spec.loader:
            mod = importlib.util.module_from_spec(spec)
            import sys
            sys.modules["novela_caatinga_kit_sons"] = mod
            spec.loader.exec_module(mod)
            if hasattr(mod, "obter_som"):
                _PROVEDOR_REGISTRADO = getattr(mod, "obter_som")
                return _PROVEDOR_REGISTRADO

    raise RuntimeError(
        "Nenhum provedor de som registrado e kit padrão não encontrado."
    )


def sintetizar_som(
    id_som: str,
    dur: float | None = None,
    semente: int = 5,
) -> np.ndarray:
    """Sintetiza um som pelo `id_som` usando o provedor registrado ou padrão."""
    provedor = _carregar_provedor_padrao()
    return provedor(id_som, dur, semente)


def mixar_timeline(
    plano: dict,
    caminho_saida: str | Path,
    obter_som: Callable[[str, float | None, int], np.ndarray] | None = None,
    diretorio_base: str | Path | None = None,
    sr: int = SR,
) -> Path:
    """Mixa timeline/plano em 48 kHz estéreo com ducking sob fala e loudnorm -14 LUFS."""
    provedor = obter_som or _carregar_provedor_padrao()
    return _mixar_timeline_base(
        plano=plano,
        caminho_saida=caminho_saida,
        obter_som=provedor,
        diretorio_base=diretorio_base,
        sr=sr,
    )


medir_audio = auditar_wav

__all__ = [
    "SR",
    "auditar_wav",
    "criar_rng",
    "curva_ducking",
    "env",
    "fade_anticlique",
    "filtro",
    "ler_wav",
    "medir_audio",
    "mixar_timeline",
    "norm",
    "normalizar_loudnorm_2passadas",
    "registrar_provedor",
    "repetir_loop",
    "salvar_wav",
    "sintetizar_som",
    "tornar_loop_sem_emenda",
]
