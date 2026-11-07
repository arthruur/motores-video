"""Mixador de timeline/roteiro com ducking sob fala, loudnorm 2 passadas e auditoria QA.

Monta a trilha estéreo em 48 kHz a partir de um roteiro compilado (`plano.json` ou
dicionário equivalente), aplicando:
- Ambiência em loop sem emenda por cena (ou global);
- Ducking automático sob falas (ganho 0.32 com ataque de 80 ms e retorno de 250 ms);
- Pista de falas (WAVs de TTS/gravação ou prosódia formântica suave opcional);
- Pista de deixas e efeitos com panorama estéreo e fade anti-clique de 5 ms;
- Normalização EBU R128 em duas passadas via ffmpeg para -14.0 LUFS e <= -1.0 dBTP.
"""
from __future__ import annotations

import json
import re
import subprocess
import tempfile
import wave
from pathlib import Path
from typing import Any, Callable

import numpy as np
from scipy.signal import resample_poly

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
)

ProvedorSom = Callable[[str, float | None, int], np.ndarray]

MAPA_LUGAR_AMBIENCIA = {
    "feira": "amb_feira",
    "feira_de_sabado": "amb_feira",
    "praca_mercadinho": "amb_feira",
    "umbuzeiro": "amb_feira",
    "acude": "amb_acude_noite",
    "beira_do_acude": "amb_acude_noite",
    "acude_noite": "amb_acude_noite",
    "casa_farinha": "amb_casa_farinha",
    "casa_de_farinha": "amb_casa_farinha",
}


def curva_ducking(
    n_amostras: int,
    intervalos_fala: list[tuple[float, float]],
    ganho_duck: float = 0.32,
    ataque_s: float = 0.080,
    retorno_s: float = 0.250,
    sr: int = SR,
) -> np.ndarray:
    """Constrói curva de ganho para ambiência com ducking suave sob falas.

    Reduz o ganho para `ganho_duck` (0.32) durante cada fala, iniciando a queda
    `ataque_s` (80 ms) antes do início da fala e retornando suavemente a 1.0 em
    `retorno_s` (250 ms) após o fim da fala.
    """
    g = np.ones(n_amostras, dtype=np.float32)
    if not intervalos_fala or n_amostras <= 0:
        return g

    n_atq = max(1, int(round(ataque_s * sr)))
    n_ret = max(1, int(round(retorno_s * sr)))
    u_atq = np.linspace(0.0, 1.0, n_atq, dtype=np.float32)
    rampa_atq = 1.0 - (1.0 - ganho_duck) * (0.5 * (1.0 - np.cos(np.pi * u_atq)))
    u_ret = np.linspace(0.0, 1.0, n_ret, dtype=np.float32)
    rampa_ret = ganho_duck + (1.0 - ganho_duck) * (0.5 * (1.0 - np.cos(np.pi * u_ret)))

    for t_ini, t_fim in intervalos_fala:
        if t_fim <= t_ini:
            continue
        i_ini = int(np.clip(round(t_ini * sr), 0, n_amostras))
        i_fim = int(np.clip(round(t_fim * sr), i_ini, n_amostras))

        # Corpo da fala
        if i_fim > i_ini:
            g[i_ini:i_fim] = np.minimum(g[i_ini:i_fim], ganho_duck)

        # Ataque antes da fala (80 ms)
        i_a0 = max(0, i_ini - n_atq)
        tam_a = i_ini - i_a0
        if tam_a > 0:
            trecho_a = rampa_atq[-tam_a:]
            g[i_a0:i_ini] = np.minimum(g[i_a0:i_ini], trecho_a)

        # Retorno depois da fala (250 ms)
        i_r1 = min(n_amostras, i_fim + n_ret)
        tam_r = i_r1 - i_fim
        if tam_r > 0:
            trecho_r = rampa_ret[:tam_r]
            g[i_fim:i_r1] = np.minimum(g[i_fim:i_r1], trecho_r)

    return g


def _sintetizar_prosodia_suave(
    quem: str,
    dur: float,
    semente: int = 11,
    sr: int = SR,
) -> np.ndarray:
    """Gera murmúrio formântico quente e discreto quando a fala não tem arquivo WAV."""
    n = max(1, int(round(dur * sr)))
    if n < int(0.06 * sr):
        return np.zeros(n, dtype=np.float32)

    rng = criar_rng(semente)
    t = np.arange(n, dtype=np.float32) / sr

    perfis_f0 = {
        "narrador": (125.0, 4.2, [450.0, 1450.0]),
        "dona_mandioca": (185.0, 4.8, [520.0, 1650.0]),
        "umbu": (118.0, 3.5, [420.0, 1280.0]),
        "licuri": (165.0, 5.5, [540.0, 1780.0]),
        "maxixe": (225.0, 6.8, [620.0, 1950.0]),
        "quiabo": (132.0, 3.2, [460.0, 1350.0]),
        "realcador": (158.0, 6.2, [580.0, 1850.0]),
        "mandacaru": (105.0, 2.8, [390.0, 1180.0]),
        "jatai": (255.0, 7.5, [680.0, 2150.0]),
        "seu_caju": (148.0, 5.8, [510.0, 1620.0]),
    }
    f0_base, taxa_silaba, formantes = perfis_f0.get(
        quem, (150.0, 4.5, [480.0, 1550.0])
    )

    # Contorno entoacional suave com queda de afirmação no final
    mod_f0 = (
        1.0
        + 0.08 * np.sin(2.0 * np.pi * 1.7 * t + rng.uniform(0, 3.14))
        + 0.04 * np.sin(2.0 * np.pi * 0.7 * t)
        - 0.10 * np.clip((t / max(dur, 0.1) - 0.65) / 0.35, 0.0, 1.0)
    )
    f0 = f0_base * mod_f0
    fase = 2.0 * np.pi * np.cumsum(f0) / sr

    glote = (
        0.60 * np.sin(fase)
        + 0.28 * np.sin(2.0 * fase + 0.4)
        + 0.12 * np.sin(3.0 * fase + 0.9)
    ).astype(np.float32)

    f1 = filtro(glote, "bandpass", [formantes[0] * 0.75, formantes[0] * 1.35], sr=sr)
    f2 = filtro(glote, "bandpass", [formantes[1] * 0.80, formantes[1] * 1.25], sr=sr)
    voz = 0.72 * f1 + 0.28 * f2

    # Modulação silábica orgânica
    silabas = np.clip(
        0.55
        + 0.45 * np.sin(2.0 * np.pi * taxa_silaba * t + rng.uniform(0, 6.28))
        + 0.20 * np.sin(2.0 * np.pi * (taxa_silaba * 0.47) * t),
        0.08,
        1.0,
    ).astype(np.float32)

    sinal = voz * silabas * env(n, ataque=0.025, retorno=0.06, sr=sr)
    return norm(sinal, pico=0.22)


def _aplicar_pan(mono_ou_est: np.ndarray, pan: float = 0.0) -> np.ndarray:
    """Converte sinal 1D ou 2D para estéreo (N, 2) aplicando pan em [-1, 1]."""
    p = float(np.clip(pan, -1.0, 1.0))
    # Pan de potência constante: p = -1 (esq), p = 0 (centro), p = +1 (dir)
    ang = (p + 1.0) * 0.25 * np.pi
    g_l = float(np.cos(ang)) * np.sqrt(2.0)
    g_r = float(np.sin(ang)) * np.sqrt(2.0)

    if mono_ou_est.ndim == 1:
        return np.column_stack([mono_ou_est * g_l, mono_ou_est * g_r]).astype(
            np.float32
        )
    out = mono_ou_est.astype(np.float32).copy()
    out[:, 0] *= g_l
    out[:, 1] *= g_r
    return out


def _somar_no_buffer(
    destino: np.ndarray,
    trecho: np.ndarray,
    t_inicio: float,
    ganho: float = 1.0,
    pan: float = 0.0,
    sr: int = SR,
) -> None:
    """Soma `trecho` (1D ou 2D) no buffer estéreo `destino` a partir de `t_inicio`."""
    if trecho.size == 0 or abs(ganho) <= 1e-7:
        return
    i0 = int(round(float(t_inicio) * sr))
    if i0 < 0:
        corte = -i0
        if corte >= len(trecho):
            return
        trecho = trecho[corte:]
        i0 = 0
    if i0 >= len(destino):
        return

    n_disp = min(len(trecho), len(destino) - i0)
    if n_disp <= 0:
        return

    fatia = fade_anticlique(trecho[:n_disp], fade_s=0.005, sr=sr)
    est = _aplicar_pan(fatia, pan=pan) * float(ganho)
    destino[i0 : i0 + n_disp, :] += est


def _resolver_instante_evento(
    evento: dict[str, Any],
    falas_cena: list[dict[str, Any]],
) -> float:
    """Resolve `t` (em segundos relativos à cena) a partir de `t` ou `ancora`/`fala`."""
    if "t" in evento and evento["t"] is not None:
        return max(0.0, float(evento["t"]))

    anc = evento.get("ancora")
    if isinstance(anc, dict) and "fala" in anc:
        idx = int(anc.get("fala", 0))
        ref = str(anc.get("ref", "ini"))
        delta = float(anc.get("d", 0.0))
        if 0 <= idx < len(falas_cena):
            f = falas_cena[idx]
            f_ini = float(f.get("ini", 0.0))
            f_dur = float(f.get("dur", 1.2))
            base = f_ini + f_dur if ref == "fim" else f_ini
            return max(0.0, base + delta)

    if "fala" in evento and evento["fala"] is not None:
        idx = int(evento["fala"])
        ref = str(evento.get("ref", "ini"))
        delta = float(evento.get("d", 0.0))
        if 0 <= idx < len(falas_cena):
            f = falas_cena[idx]
            f_ini = float(f.get("ini", 0.0))
            f_dur = float(f.get("dur", 1.2))
            base = f_ini + f_dur if ref == "fim" else f_ini
            return max(0.0, base + delta)

    return 0.0


def _normalizar_cenas(plano: dict[str, Any]) -> tuple[float, list[dict[str, Any]]]:
    """Garante que todas as cenas tenham `ini` e `dur` numéricos e calcula duração total."""
    cenas_orig = plano.get("cenas", [])
    cenas_norm: list[dict[str, Any]] = []
    cursor = 0.0

    for c in cenas_orig:
        c_copia = dict(c)
        ini = float(c_copia.get("ini", cursor))
        dur = float(c_copia.get("dur", c_copia.get("minimo", 4.0)))
        c_copia["ini"] = ini
        c_copia["dur"] = dur

        # Normaliza tempos de falas caso não tenham `ini`/`dur`
        falas = []
        t_fala = 0.4
        for f in c_copia.get("falas", []):
            if not isinstance(f, dict):
                continue
            f_c = dict(f)
            if "ini" not in f_c or f_c["ini"] is None:
                f_c["ini"] = t_fala
            if "dur" not in f_c or f_c["dur"] is None:
                palavras = len(str(f_c.get("texto", "")).split())
                f_c["dur"] = max(0.9, min(4.5, palavras * 0.32))
            t_fala = float(f_c["ini"]) + float(f_c["dur"]) + float(f_c.get("pausa", 0.25))
            falas.append(f_c)
        c_copia["falas"] = falas

        cenas_norm.append(c_copia)
        cursor = max(cursor, ini + dur)

    dur_total = float(plano.get("duracao", cursor if cursor > 0 else 5.0))
    return dur_total, cenas_norm


def _limitar_true_peak_4x(
    x: np.ndarray,
    limite_dbtp: float = -1.15,
) -> np.ndarray:
    """Aplica limitador suave com superamostragem 4x para garantir True Peak <= -1.0 dBTP."""
    teto = float(10.0 ** (limite_dbtp / 20.0))  # ~0.8759 para -1.15 dBTP
    arr = x.astype(np.float32)
    if arr.size == 0:
        return arr

    # Mede o envelope de pico real com oversampling 4x
    up = resample_poly(arr, up=4, down=1, axis=0).astype(np.float32)
    pico_up = float(np.abs(up).max())
    if pico_up <= teto:
        return arr

    # Compressão suave apenas nas cristas acima de 82% do teto
    joelho = teto * 0.82
    mag = np.abs(up)
    acima = mag > joelho
    if np.any(acima):
        excesso = (mag[acima] - joelho) / max(1e-6, (teto - joelho))
        mag_lim = joelho + (teto - joelho) * np.tanh(excesso)
        escala = np.ones_like(up)
        escala[acima] = mag_lim / np.maximum(mag[acima], 1e-9)
        up = up * escala

    down = resample_poly(up, up=1, down=4, axis=0)[: len(arr)].astype(np.float32)
    # Garantia final após reamostragem
    up_check = resample_poly(down, up=4, down=1, axis=0)
    pico_pos = float(np.abs(up_check).max())
    if pico_pos > teto:
        down *= (teto * 0.992) / pico_pos

    return np.clip(down, -teto, teto).astype(np.float32)


def _medir_loudnorm_ffmpeg(caminho_wav: Path) -> dict[str, float]:
    """Executa medição EBU R128 via ffmpeg loudnorm e retorna dicionário numérico."""
    cmd = [
        "ffmpeg",
        "-hide_banner",
        "-nostats",
        "-i",
        str(caminho_wav),
        "-af",
        "loudnorm=I=-14:TP=-1.2:LRA=11:print_format=json",
        "-f",
        "null",
        "-",
    ]
    proc = subprocess.run(cmd, capture_output=True, text=True, check=False)
    saida = (proc.stderr or "") + "\n" + (proc.stdout or "")
    m_json = re.search(r"\{[^{}]*\"input_i\"[^{}]*\}", saida, re.S)
    if not m_json:
        raise RuntimeError(f"Não foi possível extrair JSON do loudnorm para {caminho_wav}")
    dados = json.loads(m_json.group(0))

    def _f(chave: str, padrao: float) -> float:
        val = dados.get(chave, padrao)
        try:
            v = float(val)
            return v if np.isfinite(v) else padrao
        except (TypeError, ValueError):
            return padrao

    return {
        "input_i": _f("input_i", -24.0),
        "input_tp": _f("input_tp", -6.0),
        "input_lra": _f("input_lra", 6.0),
        "input_thresh": _f("input_thresh", -34.0),
        "target_offset": _f("target_offset", 0.0),
        "_raw": dados,
    }


def normalizar_loudnorm_2passadas(
    x: np.ndarray,
    caminho_saida: str | Path,
    alvo_lufs: float = -14.0,
    teto_dbtp: float = -1.2,
    sr: int = SR,
) -> Path:
    """Normaliza buffer estéreo via ffmpeg loudnorm em duas passadas para -14.0 LUFS
    e garante True Peak <= -1.0 dBTP.
    """
    destino = Path(caminho_saida)
    destino.parent.mkdir(parents=True, exist_ok=True)

    arr = np.asarray(x, dtype=np.float32)
    if arr.ndim == 1:
        arr = np.column_stack([arr, arr])

    # Se o buffer estiver completamente silencioso, injeta ruído térmico inaudível
    # ou uma base mínima para não gerar -inf no loudnorm
    rms = float(np.sqrt(np.mean(arr ** 2)))
    if rms < 1e-6:
        rng = criar_rng(42)
        arr = arr + rng.normal(0.0, 1e-4, arr.shape).astype(np.float32)

    # Pré-condiciona cristas para permitir que o loudnorm opere em modo linear
    arr_pre = _limitar_true_peak_4x(arr, limite_dbtp=-1.5)
    arr_pre = fade_anticlique(arr_pre, fade_s=0.008, sr=sr)

    with tempfile.TemporaryDirectory(prefix="anim_som_") as tmp_dir:
        tmp = Path(tmp_dir)
        bruto = tmp / "bruto.wav"
        pass2 = tmp / "pass2.wav"
        salvar_wav(bruto, arr_pre, sr=sr, estereo=True)

        m1 = _medir_loudnorm_ffmpeg(bruto)
        raw = m1["_raw"]
        af = (
            f"loudnorm=I={alvo_lufs}:TP={teto_dbtp}:LRA=11:"
            f"measured_I={raw['input_i']}:measured_TP={raw['input_tp']}:"
            f"measured_LRA={raw['input_lra']}:measured_thresh={raw['input_thresh']}:"
            f"offset={raw['target_offset']}:linear=true,"
            f"alimiter=limit={10.0 ** (teto_dbtp / 20.0):.4f}:level=false:asc=true"
        )
        subprocess.run(
            [
                "ffmpeg",
                "-v",
                "error",
                "-y",
                "-i",
                str(bruto),
                "-af",
                af,
                "-ar",
                str(sr),
                "-ac",
                "2",
                "-c:a",
                "pcm_s16le",
                str(pass2),
            ],
            check=True,
        )

        # Verifica LUFS e True Peak após a 2ª passada e aplica ajuste fino se necessário
        y_pos = ler_wav(pass2, sr=sr, mono=False)
        m2 = _medir_loudnorm_ffmpeg(pass2)
        erro_lufs = alvo_lufs - m2["input_i"]

        if abs(erro_lufs) > 0.15 or m2["input_tp"] > -1.05:
            ganho_db = float(np.clip(erro_lufs, -12.0, 12.0))
            ganho_lin = float(10.0 ** (ganho_db / 20.0))
            y_pos = _limitar_true_peak_4x(y_pos * ganho_lin, limite_dbtp=-1.18)
            y_pos = fade_anticlique(y_pos, fade_s=0.006, sr=sr)
            salvar_wav(destino, y_pos, sr=sr, estereo=True)

            # Segunda checagem fina após o limitador caso a compressão de pico tenha alterado LUFS
            m3 = _medir_loudnorm_ffmpeg(destino)
            erro_lufs_2 = alvo_lufs - m3["input_i"]
            if abs(erro_lufs_2) > 0.20:
                ganho_lin_2 = float(10.0 ** (np.clip(erro_lufs_2, -6.0, 6.0) / 20.0))
                y_pos = _limitar_true_peak_4x(y_pos * ganho_lin_2, limite_dbtp=-1.12)
                y_pos = fade_anticlique(y_pos, fade_s=0.006, sr=sr)
                salvar_wav(destino, y_pos, sr=sr, estereo=True)
        else:
            y_pos = _limitar_true_peak_4x(y_pos, limite_dbtp=-1.15)
            y_pos = fade_anticlique(y_pos, fade_s=0.006, sr=sr)
            salvar_wav(destino, y_pos, sr=sr, estereo=True)

    return destino


def mixar_timeline(
    plano: dict[str, Any],
    caminho_saida: str | Path,
    obter_som: ProvedorSom | None = None,
    diretorio_base: str | Path | None = None,
    sr: int = SR,
) -> Path:
    """Monta a mixagem estéreo 48 kHz completa de um plano/roteiro e salva em `caminho_saida`."""
    if obter_som is None:
        from . import _carregar_provedor_padrao
        obter_som = _carregar_provedor_padrao()

    base_dir = Path(diretorio_base) if diretorio_base else Path.cwd()
    duracao_total, cenas = _normalizar_cenas(plano)
    n_total = max(int(sr * 1.0), int(round(duracao_total * sr)))

    pista_ambiencia = np.zeros((n_total, 2), dtype=np.float32)
    pista_falas = np.zeros((n_total, 2), dtype=np.float32)
    pista_efeitos = np.zeros((n_total, 2), dtype=np.float32)

    intervalos_fala_globais: list[tuple[float, float]] = []

    for idx_cena, cena in enumerate(cenas):
        c_ini = float(cena.get("ini", 0.0))
        c_dur = float(cena.get("dur", 4.0))
        falas_cena = cena.get("falas", [])

        # 1. Ambiência da cena
        amb_cfg = cena.get("ambiencia", plano.get("ambiencia"))
        amb_id: str | None = None
        amb_vol = 0.36
        if isinstance(amb_cfg, dict):
            amb_id = amb_cfg.get("id")
            amb_vol = float(amb_cfg.get("vol", 0.36))
        elif isinstance(amb_cfg, str) and amb_cfg:
            amb_id = amb_cfg
        elif cena.get("lugar") in MAPA_LUGAR_AMBIENCIA:
            amb_id = MAPA_LUGAR_AMBIENCIA[cena["lugar"]]
            amb_vol = 0.32

        if amb_id:
            loop_base = obter_som(amb_id, None, 100 + idx_cena)
            trecho_amb = repetir_loop(
                loop_base,
                duracao_s=c_dur,
                fade_in=0.15,
                fade_out=0.25,
                sr=sr,
            )
            # Pequena abertura estéreo nas ambiências (decorrelação sutil L/R)
            desloc = int(0.011 * sr)
            amb_l = trecho_amb
            amb_r = np.roll(trecho_amb, desloc)
            amb_est = np.column_stack([amb_l, amb_r])
            _somar_no_buffer(
                pista_ambiencia,
                amb_est,
                t_inicio=c_ini,
                ganho=amb_vol,
                pan=0.0,
                sr=sr,
            )

        # 2. Falas da cena (e registro de intervalos para ducking)
        for idx_fala, fala in enumerate(falas_cena):
            f_ini = float(fala.get("ini", 0.0))
            f_dur = float(fala.get("dur", 1.2))
            t_abs_ini = c_ini + f_ini
            t_abs_fim = t_abs_ini + f_dur
            intervalos_fala_globais.append((t_abs_ini, t_abs_fim))

            wav_rel = fala.get("wav")
            carregou_wav = False
            if wav_rel:
                for candidato in [
                    Path(wav_rel),
                    base_dir / wav_rel,
                    base_dir.parent / wav_rel,
                    Path("receitas/novela-da-caatinga") / wav_rel,
                ]:
                    if candidato.is_file():
                        sinal_fala = ler_wav(candidato, sr=sr, mono=True)
                        _somar_no_buffer(
                            pista_falas,
                            sinal_fala,
                            t_inicio=t_abs_ini,
                            ganho=float(fala.get("vol", 1.0)),
                            pan=float(fala.get("pan", 0.0)),
                            sr=sr,
                        )
                        carregou_wav = True
                        break

            if not carregou_wav and fala.get("prosodia", True) is not False:
                quem = str(fala.get("quem", fala.get("personagem", "narrador")))
                if quem != "cesto":
                    sinal_pros = _sintetizar_prosodia_suave(
                        quem=quem,
                        dur=f_dur,
                        semente=300 + idx_cena * 31 + idx_fala,
                        sr=sr,
                    )
                    _somar_no_buffer(
                        pista_falas,
                        sinal_pros,
                        t_inicio=t_abs_ini,
                        ganho=float(fala.get("vol", 0.55)),
                        pan=float(fala.get("pan", 0.0)),
                        sr=sr,
                    )

        # 3. Deixas da cena (`cena["deixas"]`)
        for idx_deixa, deixa in enumerate(cena.get("deixas", [])):
            if not isinstance(deixa, dict):
                continue
            som_cfg = deixa.get("som")
            if not som_cfg:
                continue
            if isinstance(som_cfg, str):
                som_cfg = {"id": som_cfg, "vol": 0.85}

            som_id = som_cfg.get("id")
            if not som_id:
                continue
            t_rel = _resolver_instante_evento(deixa, falas_cena)
            dur_ev = som_cfg.get("dur")
            if dur_ev == "cena":
                dur_ev = max(0.3, c_dur - t_rel)
            elif dur_ev is not None:
                dur_ev = float(dur_ev)

            vol_ev = float(som_cfg.get("vol", 0.85))
            # Panorama leve proporcional à posição X se disponível (540 = centro)
            pan_ev = som_cfg.get("pan")
            if pan_ev is None and isinstance(deixa.get("pos"), (list, tuple)) and len(deixa["pos"]) >= 1:
                x_pos = float(deixa["pos"][0])
                pan_ev = float(np.clip((x_pos - 540.0) / 540.0 * 0.35, -0.45, 0.45))
            else:
                pan_ev = float(pan_ev or 0.0)

            semente_ev = int(
                som_cfg.get(
                    "semente",
                    (deixa.get("efeito") or {}).get("semente", 500 + idx_cena * 50 + idx_deixa)
                    if isinstance(deixa.get("efeito"), dict)
                    else 500 + idx_cena * 50 + idx_deixa,
                )
            )
            buf_som = obter_som(str(som_id), dur_ev, semente_ev)
            _somar_no_buffer(
                pista_efeitos,
                buf_som,
                t_inicio=c_ini + t_rel,
                ganho=vol_ev,
                pan=pan_ev,
                sr=sr,
            )

        # 4. Sons avulsos da cena (`cena["sons"]`, compatível com roteiro.json)
        for idx_som, s_cfg in enumerate(cena.get("sons", [])):
            if isinstance(s_cfg, str):
                s_cfg = {"id": s_cfg, "t": 0.0, "vol": 0.8}
            if not isinstance(s_cfg, dict) or not s_cfg.get("id"):
                continue
            som_id = str(s_cfg["id"])
            t_rel = _resolver_instante_evento(s_cfg, falas_cena)
            dur_s = s_cfg.get("dur")
            if dur_s == "cena":
                dur_s = max(0.3, c_dur - t_rel)
            elif dur_s is not None:
                dur_s = float(dur_s)

            vol_s = float(s_cfg.get("vol", 0.8))
            pan_s = float(s_cfg.get("pan", 0.0))
            semente_s = int(s_cfg.get("semente", 700 + idx_cena * 40 + idx_som))
            buf_som = obter_som(som_id, dur_s, semente_s)
            _somar_no_buffer(
                pista_efeitos,
                buf_som,
                t_inicio=c_ini + t_rel,
                ganho=vol_s,
                pan=pan_s,
                sr=sr,
            )

        # 5. Transição chicote -> adiciona `whoosh_camera` se não houver no fim da cena
        tr = cena.get("transicao")
        if isinstance(tr, dict) and tr.get("tipo") == "chicote":
            dur_tr = float(tr.get("dur", 0.42))
            t_tr = max(0.0, c_ini + c_dur - dur_tr)
            try:
                buf_whoosh = obter_som("whoosh_camera", dur_tr, 900 + idx_cena)
                _somar_no_buffer(
                    pista_efeitos,
                    buf_whoosh,
                    t_inicio=t_tr,
                    ganho=0.55,
                    pan=-0.25 if tr.get("direcao") == "esq" else 0.25,
                    sr=sr,
                )
            except KeyError:
                pass

    # 6. Deixas de nível raiz (`plano["deixas"]`) caso existam
    for idx_d, d_global in enumerate(plano.get("deixas", [])):
        if not isinstance(d_global, dict):
            continue
        som_cfg = d_global.get("som")
        if not som_cfg:
            continue
        if isinstance(som_cfg, str):
            som_cfg = {"id": som_cfg, "vol": 0.85}
        som_id = som_cfg.get("id")
        if not som_id:
            continue
        t_ev = float(d_global.get("t_global", d_global.get("t", 0.0)))
        dur_ev = float(som_cfg["dur"]) if som_cfg.get("dur") is not None else None
        vol_ev = float(som_cfg.get("vol", 0.85))
        pan_ev = float(som_cfg.get("pan", 0.0))
        buf_som = obter_som(str(som_id), dur_ev, 1200 + idx_d)
        _somar_no_buffer(
            pista_efeitos,
            buf_som,
            t_inicio=t_ev,
            ganho=vol_ev,
            pan=pan_ev,
            sr=sr,
        )

    # 7. Aplica ducking automático na pista de ambiência sob todas as falas
    ganho_duck = curva_ducking(
        n_amostras=n_total,
        intervalos_fala=intervalos_fala_globais,
        ganho_duck=0.32,
        ataque_s=0.080,
        retorno_s=0.250,
        sr=sr,
    )
    pista_ambiencia *= ganho_duck[:, None]

    # 8. Soma as 3 pistas e normaliza via loudnorm em 2 passadas
    mix_bruto = pista_ambiencia + pista_falas + pista_efeitos
    return normalizar_loudnorm_2passadas(
        mix_bruto,
        caminho_saida=caminho_saida,
        alvo_lufs=-14.0,
        teto_dbtp=-1.2,
        sr=sr,
    )


def auditar_wav(caminho: str | Path) -> dict[str, Any]:
    """Mede métricas de qualidade técnica do WAV via ffmpeg + numpy.

    Retorna:
        dict com `sample_rate`, `canais`, `duracao_s`, `integrated_lufs`,
        `true_peak_dbtp`, `max_salto_amostra`, `aprovado` e `erros`.
    """
    p = Path(caminho)
    if not p.is_file():
        raise FileNotFoundError(f"Arquivo WAV não encontrado: {p}")

    with wave.open(str(p), "rb") as w:
        sr = int(w.getframerate())
        canais = int(w.getnchannels())
        n_frames = int(w.getnframes())
        duracao_s = round(n_frames / float(sr), 4) if sr > 0 else 0.0

    x = ler_wav(p, sr=sr, mono=False)
    if len(x) > 1:
        max_salto = float(np.max(np.abs(np.diff(x, axis=0))))
    else:
        max_salto = 0.0

    med = _medir_loudnorm_ffmpeg(p)
    lufs = round(float(med["input_i"]), 2)
    tp_ffmpeg = float(med["input_tp"])

    # Também calcula True Peak 4x via numpy para máxima precisão
    if x.size > 0:
        up = resample_poly(x, up=4, down=1, axis=0)
        pico_up = float(np.max(np.abs(up)))
        tp_numpy = 20.0 * np.log10(max(pico_up, 1e-9))
        true_peak_dbtp = round(max(tp_ffmpeg, float(tp_numpy)), 2)
    else:
        true_peak_dbtp = -99.0

    erros: list[str] = []
    if sr != SR:
        erros.append(f"sample_rate={sr} (esperado {SR})")
    if abs(lufs - (-14.0)) > 0.6:
        erros.append(f"integrated_lufs={lufs} LUFS fora da faixa -14.0 ± 0.6 LUFS")
    if true_peak_dbtp > -1.0:
        erros.append(f"true_peak_dbtp={true_peak_dbtp} dBTP acima do limite -1.0 dBTP")
    if max_salto > 0.65:
        erros.append(f"max_salto_amostra={max_salto:.4f} indica clique/descontinuidade")

    return {
        "arquivo": str(p),
        "sample_rate": sr,
        "canais": canais,
        "duracao_s": duracao_s,
        "integrated_lufs": lufs,
        "true_peak_dbtp": true_peak_dbtp,
        "max_salto_amostra": round(max_salto, 5),
        "aprovado": len(erros) == 0,
        "erros": erros,
    }
