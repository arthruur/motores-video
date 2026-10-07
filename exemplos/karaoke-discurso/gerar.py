"""Legenda karaokê de um trecho de discurso, num reel 9:16, por um comando só.

uso: python exemplos/karaoke-discurso/gerar.py                  # Ulysses, 5/10/1988; saída em saida/karaoke-discurso/
     python exemplos/karaoke-discurso/gerar.py --zonas          # folha de contato com a zona segura
     python exemplos/karaoke-discurso/gerar.py --help

Etapas (reusa os motores do repositório):
  0. baixar.py         o trecho (yt-dlp) em entrada/, se ainda não estiver lá
  1. motores/voz       alinhar: o texto revisado (revisao.txt) manda; o Whisper só empresta os tempos
                       + qa: o que o Whisper ouviu sem dica, comparado com a revisão
  2. corte             da 1ª à última palavra revisada, com respiro
  3. ffmpeg            vídeo 16:9 sobre o próprio vídeo desfocado em 9:16 + data, nome, aviso e fonte na tela
  4. motores/legenda   palavras -> legenda.ass (zona segura) + .srt/.vtt, queimada com libass
  5. mixagem           a voz original com loudnorm em 2 passagens (-14 LUFS), sem trilha
"""
from __future__ import annotations

import argparse
import hashlib
import json
import subprocess
import sys
import time
from pathlib import Path

AQUI = Path(__file__).resolve().parent
RAIZ = AQUI.parents[1]
sys.path.insert(0, str(RAIZ))
sys.path.insert(0, str(AQUI))

from baixar import baixar, carregar_fonte  # noqa: E402
from exemplos.explicativo.gerar import loudness, mixar  # noqa: E402
from motores.legenda.gerar import Config, gerar as gerar_legenda  # noqa: E402
from motores.legenda.queimar import folha_de_contato, queimar  # noqa: E402
from motores.voz.audio import WHISPER_PADRAO, duracao, para_wav  # noqa: E402

for s in (sys.stdout, sys.stderr):
    s.reconfigure(encoding="utf-8")

L, A = 1080, 1920
FONTE_TTF = RAIZ / "fontes" / "BarlowCondensed-ExtraBold.ttf"
# faixas livres da interface (motores/render/CONTRATO.md): x 120-888 acima de y 840, x 120-780 abaixo
FAIXA_ALTO, FAIXA_BAIXO = (120, 888), (120, 780)
Y_VIDEO = 450                       # topo do vídeo 16:9 (1080x608): termina em 1058, acima da placa da legenda (~1130)


def seg(t0: float) -> float:
    return round(time.perf_counter() - t0, 1)


# ---------------------------------------------------------------- 1. alinhar (com cache: o Whisper é a etapa cara)
def alinhar_trecho(video: Path, texto: str, pasta: Path, modelo: str, refazer: bool) -> dict:
    st = video.stat()
    impressao = hashlib.sha256(json.dumps([texto, st.st_size, modelo]).encode()).hexdigest()[:16]
    arq = pasta / "alinhamento.json"
    if not refazer and arq.exists():
        r = json.loads(arq.read_text(encoding="utf-8"))
        if r.get("impressao") == impressao:
            r["reaproveitado"] = True
            return r
    from motores.voz.alinhar import alinhar
    from motores.voz.qa import precisao

    wav = pasta / "trecho.wav"
    para_wav(video, wav, 16000)
    r = alinhar(wav, texto, modelo)
    pct, difs = precisao(texto, r["ouvido"])   # o Whisper ouviu sem dica: checagem independente da revisão
    r.update(impressao=impressao, reaproveitado=False, qa={"precisao": round(pct, 1), "divergencias": difs})
    wav.unlink()
    arq.write_text(json.dumps(r, ensure_ascii=False, indent=1), encoding="utf-8")
    return r


# ---------------------------------------------------------------- 3. textos fixos (PNG transparente, fonte do repositório)
def sobreposicao(na_tela: dict, saida: Path) -> list[dict]:
    """Desenha data, nome, aviso e fonte; encolhe o que não cabe na faixa livre. Devolve as caixas para o relatório."""
    from PIL import Image, ImageDraw, ImageFont

    img = Image.new("RGBA", (L, A), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    caixas = []

    def linha(txt, y, corpo, cor, faixa):
        if not txt:
            return
        esq, dir_ = faixa
        f = ImageFont.truetype(str(FONTE_TTF), corpo)
        while f.getlength(txt) > dir_ - esq and corpo > 18:
            corpo -= 1
            f = ImageFont.truetype(str(FONTE_TTF), corpo)
        w = f.getlength(txt)
        x = (esq + dir_ - w) / 2
        d.text((x + 2, y + 3), txt, font=f, fill=(0, 0, 0, 150))     # sombra leve: legível sobre o fundo desfocado
        d.text((x, y), txt, font=f, fill=cor)
        caixas.append({"texto": txt, "x": round(x), "y": y, "largura": round(w), "corpo": corpo})

    linha(na_tela.get("data", "").upper(), 300, 38, (230, 230, 230, 255), FAIXA_ALTO)
    linha(na_tela.get("nome", "").upper(), 344, 76, (255, 214, 51, 255), FAIXA_ALTO)
    linha(na_tela.get("aviso", ""), 1068, 26, (200, 200, 200, 255), FAIXA_BAIXO)
    linha(na_tela.get("fonte", ""), 1098, 26, (200, 200, 200, 255), FAIXA_BAIXO)
    img.save(saida)
    return caixas


def compor(video: Path, ini: float, fim: float, png: Path, saida: Path) -> None:
    """16:9 inteiro sobre o próprio vídeo ampliado, desfocado e escurecido (sem barras pretas), + textos. Sem áudio."""
    filtro = (f"[0:v]split[a][b];"
              # desfoque em 1/4 da resolução e ampliado: mesmo efeito, ~10x mais barato que o boxblur em 1080x1920
              f"[a]scale={L // 4}:{A // 4}:force_original_aspect_ratio=increase,crop={L // 4}:{A // 4},boxblur=8:2,"
              f"scale={L}:{A},eq=brightness=-0.25[fundo];"
              f"[b]scale={L}:-2[frente];[fundo][frente]overlay=0:{Y_VIDEO}[v1];[v1][1:v]overlay=0:0:eof_action=repeat,format=yuv420p[v]")
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-ss", f"{ini:.3f}", "-to", f"{fim:.3f}", "-i", str(video),
                    "-i", str(png), "-filter_complex", filtro, "-map", "[v]", "-an",
                    "-c:v", "libx264", "-crf", "16", "-preset", "veryfast",
                    "-color_range", "tv", "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709",
                    str(saida)], check=True)


def main(argv=None) -> dict:
    ap = argparse.ArgumentParser(description="Trecho de discurso -> reel 9:16 com legenda karaokê, crédito e fonte na tela.")
    ap.add_argument("--fontes", type=Path, default=AQUI / "fontes.json", help="crédito, URL e trecho (padrão: o deste exemplo)")
    ap.add_argument("--id", help="qual fonte de fontes.json (padrão: a primeira)")
    ap.add_argument("--revisao", type=Path, default=AQUI / "revisao.txt",
                    help="texto conferido por uma pessoa, uma frase por linha: é ele que vai para a legenda")
    ap.add_argument("--saida", type=Path, default=RAIZ / "saida" / "karaoke-discurso", help="pasta de saída")
    ap.add_argument("--whisper", default=WHISPER_PADRAO, help=f"modelo do faster-whisper (padrão: {WHISPER_PADRAO})")
    ap.add_argument("--refazer", action="store_true", help="alinha de novo mesmo com o cache válido")
    ap.add_argument("--antes", type=float, default=0.35, help="respiro antes da 1ª palavra (s)")
    ap.add_argument("--depois", type=float, default=0.8, help="respiro depois da última palavra (s)")
    ap.add_argument("--zona", default="universal", help="zona segura da legenda (universal, reels, tiktok, shorts)")
    ap.add_argument("--zonas", action="store_true", help="marca a zona segura na folha de contato")
    a = ap.parse_args(argv)

    t0 = time.perf_counter()
    tempos = {}
    fonte = carregar_fonte(a.fontes, a.id)
    pasta = a.saida.resolve()
    pasta.mkdir(parents=True, exist_ok=True)
    texto = " ".join(l.strip() for l in a.revisao.read_text(encoding="utf-8").splitlines() if l.strip())

    # 0. trecho
    t = time.perf_counter()
    video = baixar(fonte, a.fontes.resolve().parent, log=lambda m: print("0/5 " + m, flush=True))
    tempos["baixar_s"] = seg(t)

    # 1. alinhar
    t = time.perf_counter()
    print(f"1/5 alinhando a revisão ({len(texto.split())} palavras) com o Whisper {a.whisper} ...", flush=True)
    al = alinhar_trecho(video, texto, pasta, a.whisper, a.refazer)
    tempos["alinhar_s"] = seg(t)
    st, qa = al["alinhamento"], al["qa"]
    print(f"    {st['exatas']} exatas, {st['repartidas']} repartidas, {st['estimadas']} estimadas · "
          f"{'reaproveitado' if al['reaproveitado'] else str(tempos['alinhar_s']) + ' s'}")
    print(f"    Whisper sem dica × revisão: {qa['precisao']}% · " + ("; ".join(qa["divergencias"]) or "sem divergências"))

    # 2. corte: da 1ª à última palavra revisada
    ps = al["palavras"]
    dur_video = duracao(video)
    ini = max(0.0, ps[0]["inicio"] - a.antes)
    fim = min(dur_video, ps[-1]["fim"] + a.depois)
    dur = round(fim - ini, 3)
    palavras = [{**p, "inicio": round(p["inicio"] - ini, 3), "fim": round(p["fim"] - ini, 3)} for p in ps]
    (pasta / "palavras.json").write_text(json.dumps({"duracao": dur, "corte": [round(ini, 3), round(fim, 3)],
                                                    "palavras": palavras}, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"2/5 corte {ini:.2f}-{fim:.2f} s do trecho baixado ({dur:.1f} s)")

    # 3. vídeo 9:16 + 5. áudio
    t = time.perf_counter()
    print("3/5 composição 9:16 e mixagem ...", flush=True)
    caixas = sobreposicao(fonte.get("na_tela", {}), pasta / "textos.png")
    compor(video, ini, fim, pasta / "textos.png", pasta / "fundo.mp4")
    voz = pasta / "voz.wav"
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-ss", f"{ini:.3f}", "-to", f"{fim:.3f}", "-i", str(video), "-vn",
                    "-af", f"afade=t=in:d=0.15,afade=t=out:st={max(0, dur - 0.4):.3f}:d=0.4",
                    "-ar", "48000", "-ac", "1", str(voz)], check=True)
    mixar(voz, dur, pasta / "mix.m4a", 0, False, -14)       # volume 0 e sem ducking: só a voz original, normalizada
    tempos["compor_e_mixar_s"] = seg(t)

    # 4. legenda
    t = time.perf_counter()
    leg = gerar_legenda(palavras, pasta / "legenda.ass", Config(zona=a.zona))
    q = leg["qc"]
    tempos["legenda_s"] = seg(t)
    print(f"4/5 legenda: {q['blocos']} blocos · {q['orfaos']} órfãos · {q['quebras_ruins']} quebras ruins · "
          f"{q['fora_da_zona']} fora da zona · .srt com {q['lse']['cues']} cues")

    # queimar + juntar o áudio
    t = time.perf_counter()
    print("5/5 legenda queimada + áudio ...", flush=True)
    legendado = pasta / "legendado.mp4"
    queimar(pasta / "fundo.mp4", pasta / "legenda.ass", legendado, estrito=True, log=lambda m: print("    " + m))
    final = pasta / f"{fonte['id']}.mp4"
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", str(legendado), "-i", str(pasta / "mix.m4a"), "-map", "0:v",
                    "-map", "1:a", "-c", "copy", "-shortest", "-movflags", "+faststart", str(final)], check=True)
    legendado.unlink()
    tempos["queimar_e_juntar_s"] = seg(t)

    # conferências: loudness medido e folha de contato (início de cada frase + o fim)
    loud = loudness(final)
    inicios = [p["inicio"] for i, p in enumerate(palavras) if i == 0 or palavras[i - 1]["texto"][-1] in ".!?"]
    instantes = [round(x + 0.5, 2) for x in inicios] + [round(dur - 0.3, 2)]
    folha = folha_de_contato(pasta / "fundo.mp4", pasta / "legenda.ass", instantes, pasta / "folha.png",
                             zonas=a.zonas, escala=0.25)
    tempos["total_s"] = seg(t0)

    rel = {"fonte": {k: fonte.get(k) for k in ("quem", "ocasiao", "data", "credito", "url", "trecho", "aviso", "direitos")},
           "final": str(final), "duracao_s": dur, "corte_no_trecho_s": [round(ini, 3), round(fim, 3)],
           "alinhamento": {**st, "modelo": al["modelo"], "segundos": al.get("segundos")}, "qa": qa,
           "legenda": {"qc": {k: q[k] for k in ("blocos", "orfaos", "curtos", "quebras_ruins", "fora_da_zona", "lse")}},
           "textos_na_tela": caixas, "loudness": {**loud, "alvo_lufs": -14}, "tempos": tempos, "folha": str(folha)}
    (pasta / "relatorio.json").write_text(json.dumps(rel, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"\nvídeo: {final}\nlegendas: legenda.srt, legenda.vtt · folha de contato: {folha.name}")
    print(f"loudness: {loud['integrado_lufs']} LUFS, pico {loud['pico_verdadeiro_dbtp']} dBTP · total {tempos['total_s']} s")
    print(f"crédito para a descrição: {fonte['quem']}, {fonte['ocasiao']} ({fonte['data']}). "
          f"Vídeo: {fonte['credito']}, {fonte['url']}. {fonte['direitos']}")
    return rel


if __name__ == "__main__":
    try:
        main()
    except (RuntimeError, subprocess.CalledProcessError) as e:
        raise SystemExit(f"erro: {e}")
