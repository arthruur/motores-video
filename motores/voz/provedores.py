"""Camada de provedores de voz: a mesma chamada para qualquer motor (generaliza os labs 02 e 03).

    from motores.voz import sintetizar
    r = sintetizar("A água ferve a cem graus.", "edge", "pt-BR-AntonioNeural", "saida/voz.wav")
    r["palavras"]  # [{"texto": "A", "inicio": 0.1, "fim": 0.2}, ...] com a grafia do texto

Trocar grátis por pago, ou local por nuvem, é só trocar o nome do provedor. Quem devolve
tempo por palavra (edge, azure, elevenlabs) usa o seu; os outros passam pelo alinhador
(faster-whisper + texto). Provedores que podem cobrar só rodam com a chave no ambiente
E com `permitir_pago=True`: nada é cobrado sem você pedir.

Regra do projeto: vozes sintéticas são de NARRADOR. Nunca para imitar pessoa real.
"""
from __future__ import annotations

import asyncio
import base64
import json
import os
import tempfile
import time
import urllib.error
import urllib.request
import wave
from dataclasses import dataclass, field
from pathlib import Path
from typing import Callable

from .audio import WHISPER_PADRAO, duracao, para_wav
from .texto import aplicar_pronuncia

RAIZ = Path(__file__).resolve().parents[2]


def pasta_modelos(opcao: str | Path | None = None) -> Path:
    """Onde ficam os modelos locais (Kokoro, Piper): opção > $MOTORES_VOZ_MODELOS > <repo>/modelos."""
    return Path(opcao or os.environ.get("MOTORES_VOZ_MODELOS") or RAIZ / "modelos")


def _velocidade_pct(v: float) -> str:
    return f"{round((v - 1) * 100):+d}%"


# ---------------------------------------------------------------- motores
# Cada um: (texto falado, voz, wav, opcoes) -> marcas [{texto, inicio, fim}] ou None (sem tempos nativos).

def _edge(texto: str, voz: str, wav: Path, op: dict) -> list[dict]:
    """Edge TTS: grátis, sem chave, nuvem. Endpoint NÃO oficial e sem termos de uso: só protótipo."""
    import edge_tts

    async def falar():
        com = edge_tts.Communicate(texto, voz, rate=_velocidade_pct(op.get("velocidade", 1.0)),
                                   boundary="WordBoundary")
        audio, marcas = bytearray(), []
        async for ch in com.stream():
            if ch["type"] == "audio":
                audio += ch["data"]
            elif ch["type"] == "WordBoundary":
                ini = ch["offset"] / 1e7  # unidades de 100 ns
                marcas.append({"texto": ch["text"], "inicio": ini, "fim": ini + ch["duration"] / 1e7})
        return bytes(audio), marcas

    try:
        mp3, marcas = asyncio.run(falar())
    except Exception as e:  # o endpoint muda e a biblioteca quebra (403) de tempos em tempos
        raise RuntimeError(f"edge-tts falhou ({e}). É um serviço não oficial: atualize o edge-tts "
                           "(pip install -U edge-tts) ou use outro provedor (kokoro, gravacao).") from e
    with tempfile.TemporaryDirectory() as tmp:
        bruto = Path(tmp) / "edge.mp3"
        bruto.write_bytes(mp3)
        para_wav(bruto, wav, op["taxa"])  # sem aparar: os tempos do WordBoundary contam do início
    return marcas


_kokoro: dict[Path, object] = {}


def _kokoro_motor(texto: str, voz: str, wav: Path, op: dict) -> None:
    """Kokoro-82M: local, CPU, pesos Apache-2.0. Vozes pt-BR: pf_dora (fem.), pm_alex, pm_santa (masc.)."""
    import soundfile as sf
    from kokoro_onnx import Kokoro

    pasta = pasta_modelos(op.get("modelos"))
    if pasta not in _kokoro:
        onnx, vozes = pasta / "kokoro-v1.0.onnx", pasta / "voices-v1.0.bin"
        if not onnx.exists() or not vozes.exists():
            raise RuntimeError(f"modelos do Kokoro não encontrados em {pasta} (veja motores/voz/README.md)")
        _kokoro[pasta] = Kokoro(str(onnx), str(vozes))
    amostras, sr = _kokoro[pasta].create(texto, voice=voz, speed=op.get("velocidade", 1.0), lang="pt-br")
    with tempfile.TemporaryDirectory() as tmp:
        bruto = Path(tmp) / "kokoro.wav"
        sf.write(str(bruto), amostras, sr)
        para_wav(bruto, wav, op["taxa"], aparar=True)


_piper: dict[Path, object] = {}


def _piper_motor(texto: str, voz: str, wav: Path, op: dict) -> None:
    """Piper: local, CPU, o mais leve. Motor piper-tts é GPL-3.0 (OPCIONAL); cada voz tem licença própria."""
    from piper import PiperVoice, SynthesisConfig

    onnx = pasta_modelos(op.get("modelos")) / f"{voz}.onnx"
    if not onnx.exists():
        raise RuntimeError(f"voz do Piper não encontrada: {onnx} (precisa do .onnx e do .onnx.json)")
    if onnx not in _piper:
        _piper[onnx] = PiperVoice.load(str(onnx))
    with tempfile.TemporaryDirectory() as tmp:
        bruto = Path(tmp) / "piper.wav"
        with wave.open(str(bruto), "wb") as f:
            _piper[onnx].synthesize_wav(texto, f, syn_config=SynthesisConfig(
                length_scale=1 / op.get("velocidade", 1.0)))
        para_wav(bruto, wav, op["taxa"], aparar=True)


def _azure(texto: str, voz: str, wav: Path, op: dict) -> list[dict]:
    """Azure AI Speech: as mesmas vozes do edge pelo caminho oficial. Cota grátis F0 (0,5 M car./mês).

    Precisa de AZURE_SPEECH_KEY e AZURE_SPEECH_REGION e do SDK (azure-cognitiveservices-speech).
    NÃO TESTADO por falta de chave: escrito pela documentação do SDK.
    """
    import azure.cognitiveservices.speech as sdk

    cfg = sdk.SpeechConfig(subscription=os.environ["AZURE_SPEECH_KEY"], region=os.environ["AZURE_SPEECH_REGION"])
    cfg.speech_synthesis_voice_name = voz
    cfg.set_speech_synthesis_output_format(sdk.SpeechSynthesisOutputFormat.Riff48Khz16BitMonoPcm)
    marcas = []

    def marca(evt):
        if evt.boundary_type == sdk.SpeechSynthesisBoundaryType.Word:
            ini = evt.audio_offset / 1e7  # ticks de 100 ns
            marcas.append({"texto": evt.text, "inicio": ini, "fim": ini + evt.duration.total_seconds()})

    with tempfile.TemporaryDirectory() as tmp:
        bruto = Path(tmp) / "azure.wav"
        sint = sdk.SpeechSynthesizer(speech_config=cfg, audio_config=sdk.audio.AudioOutputConfig(filename=str(bruto)))
        sint.synthesis_word_boundary.connect(marca)
        v = op.get("velocidade", 1.0)
        if v != 1.0:
            ssml = (f'<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="pt-BR">'
                    f'<voice name="{voz}"><prosody rate="{_velocidade_pct(v)}">{_xml(texto)}</prosody></voice></speak>')
            r = sint.speak_ssml_async(ssml).get()
        else:
            r = sint.speak_text_async(texto).get()
        if r.reason != sdk.ResultReason.SynthesizingAudioCompleted:
            raise RuntimeError(f"Azure não sintetizou: {r.reason} {getattr(r, 'cancellation_details', '')}")
        del sint  # libera o arquivo no Windows
        para_wav(bruto, wav, op["taxa"])
    return marcas


def _xml(s: str) -> str:
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def _elevenlabs(texto: str, voz: str, wav: Path, op: dict) -> list[dict]:
    """ElevenLabs: pago, nuvem. Endpoint /with-timestamps devolve o tempo de cada caractere.

    Precisa de ELEVENLABS_API_KEY; a voz é o voice_id (ou ELEVENLABS_VOICE_ID). O modelo vem de ELEVENLABS_MODEL
    (eleven_multilingual_v2 por padrão; eleven_v3 também devolve os tempos) e o idioma, de ELEVENLABS_LANGUAGE
    ("pt" evita que vozes nativas de inglês leiam com pronúncia inglesa). No plano gratuito, só as vozes padrão
    da conta funcionam pela API; as da biblioteca pública pedem plano pago.
    """
    corpo = {"text": texto, "model_id": os.environ.get("ELEVENLABS_MODEL", "eleven_multilingual_v2")}
    if os.environ.get("ELEVENLABS_LANGUAGE"):
        corpo["language_code"] = os.environ["ELEVENLABS_LANGUAGE"]
    if os.environ.get("ELEVENLABS_SETTINGS"):   # JSON de voice_settings, ex.: {"stability": 0.5, "style": 0.2}
        corpo["voice_settings"] = json.loads(os.environ["ELEVENLABS_SETTINGS"])
    req = urllib.request.Request(
        f"https://api.elevenlabs.io/v1/text-to-speech/{voz}/with-timestamps?output_format=mp3_44100_128",
        data=json.dumps(corpo).encode(),
        headers={"xi-api-key": os.environ["ELEVENLABS_API_KEY"], "Content-Type": "application/json"},
    )
    try:
        resp = json.loads(urllib.request.urlopen(req, timeout=120).read())
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"ElevenLabs respondeu {e.code}: {e.read().decode(errors='replace')[:300]}") from e
    with tempfile.TemporaryDirectory() as tmp:
        bruto = Path(tmp) / "elevenlabs.mp3"
        bruto.write_bytes(base64.b64decode(resp["audio_base64"]))
        para_wav(bruto, wav, op["taxa"])
    # caracteres com tempo -> palavras com tempo
    al, marcas, atual = resp["alignment"], [], None
    for c, ini, fim in zip(al["characters"], al["character_start_times_seconds"], al["character_end_times_seconds"]):
        if c.isspace():
            atual = None
            continue
        if c == "[" or (atual is not None and atual["texto"].startswith("[")):
            # marcação de interpretação do v3 ([whispers], [pause]): não é palavra falada
            atual = atual if c != "[" else {"texto": "", "inicio": ini, "fim": fim, "tag": True}
            atual["texto"] += c
            continue
        if atual is None:
            atual = {"texto": "", "inicio": ini, "fim": fim}
            marcas.append(atual)
        atual["texto"] += c
        atual["fim"] = fim
    return [m for m in marcas if not m.get("tag")]


def _gemini(texto: str, voz: str, wav: Path, op: dict) -> None:
    """Gemini TTS (lab A1). `texto` pode ser só a fala ou um prompt dirigido (perfil, cena, notas e,
    por último, a transcrição): o modelo segue a direção e lê só a transcrição. Sem tempos nativos:
    as palavras saem do alinhador. Modelo em GEMINI_TTS_MODEL. Devolve PCM s16le 24 kHz."""
    modelo = os.environ.get("GEMINI_TTS_MODEL", "gemini-3.1-flash-tts-preview")
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{modelo}:generateContent"
    corpo = json.dumps({"contents": [{"parts": [{"text": texto}]}],
                        "generationConfig": {"responseModalities": ["AUDIO"], "speechConfig": {
                            "voiceConfig": {"prebuiltVoiceConfig": {"voiceName": voz}}}}}).encode()
    espera, ultimo = 15, ""
    for _ in range(6):
        req = urllib.request.Request(url, data=corpo, headers={
            "x-goog-api-key": os.environ["GEMINI_API_KEY"], "Content-Type": "application/json"})
        try:
            r = json.load(urllib.request.urlopen(req, timeout=300))
        except urllib.error.HTTPError as e:
            erro = e.read().decode("utf-8", "replace")
            # cota do dia acabou: não adianta esperar; quem chama pode trocar de modelo
            ultimo = f"{e.code}{' (cota PerDay)' if 'PerDay' in erro else ''}: {erro[:300]}"
            if e.code in (429, 500, 503) and "PerDay" not in ultimo:
                time.sleep(espera)
                espera = min(espera * 2, 120)
                continue
            raise RuntimeError(f"gemini {modelo} respondeu {ultimo}") from e
        partes = r["candidates"][0].get("content", {}).get("parts", [])
        if partes and "inlineData" in partes[0]:   # às vezes volta sem áudio (finishReason OTHER/SAFETY)
            pcm = base64.b64decode(partes[0]["inlineData"]["data"])
            with tempfile.TemporaryDirectory() as d:
                bruto = Path(d) / "g.wav"
                with wave.open(str(bruto), "wb") as w:
                    w.setnchannels(1); w.setsampwidth(2); w.setframerate(24000); w.writeframes(pcm)
                para_wav(bruto, wav, op["taxa"], aparar=True)
            return None
        ultimo = f"sem áudio ({r['candidates'][0].get('finishReason')})"
    raise RuntimeError(f"gemini {modelo}: {ultimo}")


def _gravacao(texto: str, voz: str, wav: Path, op: dict) -> None:
    """A própria voz, gravada (celular, WAV, M4A, MP3...). `limpar` tira ronco e ruído constante."""
    arquivo = op.get("arquivo")
    if not arquivo or not Path(arquivo).exists():
        raise RuntimeError("provedor 'gravacao' precisa do arquivo gravado (opção arquivo=... / --arquivo)")
    # highpass + afftdn: 0,8 s para 45 s de áudio, ruído das pausas de −42 para −52 dBFS (pesquisa de voz)
    filtro = "highpass=f=80,afftdn=nf=-25:tn=1" if op.get("limpar") else ""
    para_wav(Path(arquivo), wav, op["taxa"], aparar=True, filtro=filtro)


# ---------------------------------------------------------------- registro
@dataclass
class Provedor:
    id: str
    nome: str
    funcao: Callable
    voz_padrao: str
    vozes: list[str]
    onde: str                 # "local" | "nuvem"
    custo: str
    licenca: str              # do motor/pesos e do serviço
    tempos_nativos: bool      # devolve o tempo de cada palavra?
    sintetica: bool = True
    pode_cobrar: bool = False
    chaves: list[str] = field(default_factory=list)  # variáveis de ambiente exigidas
    pacote: str = ""          # módulo Python exigido

    def falta(self, modelos: str | Path | None = None) -> str | None:
        """Motivo de não poder rodar agora, ou None."""
        import importlib.util

        if self.pacote and importlib.util.find_spec(self.pacote.split(".")[0]) is None:
            return f"pacote Python ausente ({self.pacote})"
        sem = [c for c in self.chaves if not os.environ.get(c)]
        if sem:
            return f"falta variável de ambiente: {', '.join(sem)}"
        pasta = pasta_modelos(modelos)
        if self.id == "kokoro" and not (pasta / "kokoro-v1.0.onnx").exists():
            return f"modelo ausente em {pasta}"
        if self.id == "piper" and not any(pasta.glob("*.onnx.json")):
            return f"nenhuma voz Piper em {pasta}"
        return None


PROVEDORES: dict[str, Provedor] = {p.id: p for p in [
    Provedor("edge", "Microsoft Edge (edge-tts)", _edge, "pt-BR-AntonioNeural",
             ["pt-BR-AntonioNeural", "pt-BR-FranciscaNeural", "pt-BR-ThalitaMultilingualNeural"],
             "nuvem", "grátis, sem chave", "código LGPL-3.0; serviço sem termos de uso (não oficial)", True,
             pacote="edge_tts"),
    Provedor("kokoro", "Kokoro-82M (kokoro-onnx)", _kokoro_motor, "pf_dora", ["pf_dora", "pm_alex", "pm_santa"],
             "local", "grátis", "pesos Apache-2.0; kokoro-onnx MIT; usa phonemizer e espeak-ng (GPL-3.0)", False,
             pacote="kokoro_onnx"),
    Provedor("piper", "Piper (piper-tts)", _piper_motor, "pt_BR-faber-medium",
             ["pt_BR-faber-medium", "pt_BR-cadu-medium", "pt_BR-jeff-medium"],
             "local", "grátis", "motor GPL-3.0-or-later (opcional); vozes faber/cadu/jeff: dataset CC0", False,
             pacote="piper"),
    Provedor("azure", "Azure AI Speech", _azure, "pt-BR-AntonioNeural",
             ["pt-BR-AntonioNeural", "pt-BR-FranciscaNeural", "pt-BR-ThalitaMultilingualNeural"],
             "nuvem", "cota grátis F0 (0,5 M car./mês); depois pago", "termos do Azure; SDK proprietário (MS)",
             True, pode_cobrar=True, chaves=["AZURE_SPEECH_KEY", "AZURE_SPEECH_REGION"],
             pacote="azure.cognitiveservices.speech"),
    Provedor("elevenlabs", "ElevenLabs", _elevenlabs, os.environ.get("ELEVENLABS_VOICE_ID", ""), [],
             "nuvem", "pago", "termos da ElevenLabs (uso comercial nos planos pagos)", True,
             pode_cobrar=True, chaves=["ELEVENLABS_API_KEY"]),
    Provedor("gemini", "Gemini TTS (Google)", _gemini, "Charon",
             ["Charon", "Puck", "Kore", "Gacrux", "Leda", "Algieba", "Algenib", "Fenrir", "Sadachbia", "Autonoe", "Umbriel"],
             "nuvem", "cota grátis diária; depois pago (barato)", "termos da Gemini API (Google)", False,
             chaves=["GEMINI_API_KEY"]),
    Provedor("gravacao", "Gravação da própria voz", _gravacao, "", [], "local", "grátis",
             "do próprio autor", False, sintetica=False),
]}


def sintetizar(texto: str, provedor: str, voz: str | None, saida_wav: str | Path, *,
               pronuncia: bool | str | Path = True, alinhar: bool = True, whisper: str = WHISPER_PADRAO,
               velocidade: float = 1.0, taxa: int = 48000, modelos: str | Path | None = None,
               arquivo: str | Path | None = None, limpar: bool = False, permitir_pago: bool = False,
               falado: str | None = None) -> dict:
    """Texto -> WAV mono + palavras com tempo (grafia do texto original).

    -> {wav, palavras: [{texto, inicio, fim}], provedor, voz, sintetica, tempos, duracao, ...}

    pronuncia: True usa motores/voz/pronuncia.json; caminho usa outro arquivo; False desliga.
    alinhar: para motores sem tempos nativos, roda o alinhador (faster-whisper) no fim.
    arquivo/limpar: só para o provedor "gravacao".
    falado: o que a voz recebe, quando difere do texto da legenda (ex.: marcações do ElevenLabs v3 como
    "[whispers]"); a pronúncia é aplicada sobre ele e os tempos continuam casados com `texto`.
    """
    if provedor not in PROVEDORES:
        raise ValueError(f"provedor desconhecido: {provedor} (opções: {', '.join(PROVEDORES)})")
    p = PROVEDORES[provedor]
    falta = p.falta(modelos)
    if falta:
        raise RuntimeError(f"{provedor}: {falta}")
    if p.pode_cobrar and not permitir_pago:
        raise RuntimeError(f"{provedor} pode cobrar ({p.custo}; {len(texto)} caracteres). "
                           "Confirme com permitir_pago=True (--permitir-pago).")
    voz = voz or p.voz_padrao
    if p.sintetica and not voz:
        raise ValueError(f"{provedor}: informe a voz")
    wav = Path(saida_wav)
    wav.parent.mkdir(parents=True, exist_ok=True)

    falado = falado or texto
    if pronuncia and p.sintetica:
        falado = aplicar_pronuncia(falado, provedor, None if pronuncia is True else pronuncia)
    op = {"velocidade": velocidade, "taxa": taxa, "modelos": modelos, "arquivo": arquivo, "limpar": limpar}

    t0 = time.perf_counter()
    marcas = p.funcao(falado, voz, wav, op)
    gerar_s = time.perf_counter() - t0

    r = {"wav": str(wav), "provedor": provedor, "voz": voz, "sintetica": p.sintetica,
         "texto": texto, "texto_falado": falado, "duracao": round(duracao(wav), 3), "gerar_s": round(gerar_s, 2),
         "rotulo": (f"Narração gerada por IA (voz sintética {p.nome}: {voz}), não é a voz de uma pessoa real"
                    if p.sintetica else "Narração gravada pelo autor")}
    if marcas is not None:
        from .alinhar import casar

        r["palavras"], r["alinhamento"] = casar(marcas, texto)
        r["tempos"] = f"nativos ({provedor})"
    elif alinhar:
        from .alinhar import alinhar as alinhar_audio

        al = alinhar_audio(wav, texto, whisper, vad=provedor == "gravacao")
        r["palavras"], r["alinhamento"] = al["palavras"], {**al["alinhamento"], "ouvido": al["ouvido"],
                                                            "modelo": al["modelo"], "segundos": al["segundos"]}
        r["tempos"] = "alinhador (faster-whisper + texto)"
    else:
        r["palavras"], r["tempos"] = [], "nenhum (alinhar=False)"
    return r
