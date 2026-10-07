"""Motor de voz: narração com provedores trocáveis, tempo de cada palavra e nota pelo Whisper.

    from motores.voz import sintetizar, alinhar, avaliar
"""
from .alinhar import alinhar, casar
from .provedores import PROVEDORES, sintetizar
from .qa import avaliar, precisao

__all__ = ["sintetizar", "alinhar", "casar", "avaliar", "precisao", "PROVEDORES"]
