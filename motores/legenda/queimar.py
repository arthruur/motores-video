"""Queima uma legenda .ass num vídeo com ffmpeg + libass, usando as fontes da pasta fontes/ do repositório.

uso: python motores/legenda/queimar.py video.mp4 legenda.ass -o saida.mp4
     python motores/legenda/queimar.py video.mp4 legenda.ass --teste 1,2.5,4 --zonas   # folha de contato

Antes de queimar, confere qual arquivo de fonte o libass escolheu para cada estilo: se ele caiu
numa fonte do sistema (Arial etc.), avisa; com --estrito, para. O áudio é copiado sem reencode.
"""
import argparse
import re
import struct
import subprocess
import sys
import tempfile
import time
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[2]
FONTES = RAIZ / "fontes"
# zonas cobertas pela interface (x, y, l, a) em 1080x1920: as mesmas do motores/render (ZONAS_9x16)
ZONAS_9x16 = [(0, 0, 1080, 288), (0, 1248, 1080, 672), (0, 288, 120, 960), (888, 288, 192, 552), (780, 840, 300, 408)]


def escapar_filtro(caminho):
    """caminho -> valor seguro para opção de filtro do ffmpeg. São dois níveis: a opção (':' separa chaves,
    '\\' e "'" escapam) e o grafo de filtros ('[]', ',' e ';' separam). 'C:\\a b\\x.ass' vira 'C\\\\:/a b/x.ass'."""
    s = str(Path(caminho).resolve()).replace("\\", "/")
    s = re.sub(r"([\\':])", r"\\\1", s)        # nível 1: valor da opção
    return re.sub(r"([\\'\[\],;])", r"\\\1", s)  # nível 2: grafo


def filtro_legenda(ass, fontes=FONTES):
    return f"subtitles=filename={escapar_filtro(ass)}:fontsdir={escapar_filtro(fontes)}"


def sondar(video):
    """(largura, altura, duração) do vídeo"""
    r = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries",
                        "stream=width,height:format=duration", "-of", "default=nw=1", str(video)],
                       capture_output=True, text=True)
    if r.returncode:
        raise RuntimeError(f"ffprobe não leu {video}: {r.stderr.strip()}")
    d = dict(l.split("=", 1) for l in r.stdout.split())
    return int(d["width"]), int(d["height"]), float(d.get("duration", 0) or 0)


def play_res(ass):
    txt = Path(ass).read_text(encoding="utf-8-sig")
    g = lambda k: re.search(rf"^{k}:\s*(\d+)", txt, re.M)
    return (int(g("PlayResX")[1]), int(g("PlayResY")[1])) if g("PlayResX") and g("PlayResY") else None


def nome_postscript(ttf):
    """nameID 6 da tabela name (é o nome que o libass escreve no log)"""
    b = Path(ttf).read_bytes()
    for i in range(struct.unpack(">H", b[4:6])[0]):
        tag, _, off, _ = struct.unpack(">4sIII", b[12 + 16 * i:28 + 16 * i])
        if tag == b"name":
            cont, base = struct.unpack(">HH", b[off + 2:off + 6])
            for j in range(cont):
                plat, _, _, nid, ln, o = struct.unpack(">6H", b[off + 6 + 12 * j:off + 18 + 12 * j])
                if nid == 6:
                    s = b[off + base + o:off + base + o + ln]
                    return s.decode("utf-16-be" if plat in (0, 3) else "latin-1")
    return None


def conferir_fontes(ass, fontes=FONTES):
    """desenha um quadro com um evento por estilo e lê o log do libass ('fontselect: (nome, ...) -> arquivo').
    Devolve [(fonte pedida, fonte escolhida (nome PostScript), veio de --fontes?)]."""
    txt = Path(ass).read_text(encoding="utf-8-sig")
    estilos = re.findall(r"^Style:\s*([^,]+),", txt, re.M)
    corpo = txt.split("[Events]")[0] + "[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n"
    corpo += "".join(f"Dialogue: 0,0:00:00.00,0:00:01.00,{e},,0,0,0,,ÁÇÃ Teste\n" for e in estilos)
    with tempfile.TemporaryDirectory(prefix="motores-legenda-") as tmp:
        t = Path(tmp) / "fontes.ass"
        t.write_text(corpo, encoding="utf-8")
        r = subprocess.run(["ffmpeg", "-v", "verbose", "-f", "lavfi", "-i", "color=black:s=320x240:d=0.1",
                            "-vf", filtro_legenda(t, fontes), "-frames:v", "1", "-f", "null", "-"],
                           capture_output=True, text=True, encoding="utf-8", errors="replace")
    if r.returncode:
        raise RuntimeError("ffmpeg falhou ao abrir a legenda (o ffmpeg tem libass?):\n" + r.stderr[-800:])
    achados = re.findall(r"fontselect: \((.+?), \d+, \d+\) -> ([^,\s]+)", r.stderr)
    nossas = {nome_postscript(f) for f in Path(fontes).glob("*.[ot]tf")}
    return [(nome, ps, ps in nossas) for nome, ps in dict(achados).items()]


def queimar(video, ass, saida, fontes=FONTES, crf=19, preset="veryfast", estrito=False, log=print):
    """vídeo + .ass -> MP4 com a legenda queimada (H.264 yuv420p; áudio copiado). Devolve tempos e fontes."""
    t0 = time.perf_counter()
    video, ass, saida = Path(video), Path(ass), Path(saida)
    for p in (video, ass):
        if not p.is_file():
            raise FileNotFoundError(f"não achei {p}")
    L, A, dur = sondar(video)
    pr = play_res(ass)
    if pr and pr != (L, A):
        log(f"aviso: legenda feita para {pr[0]}x{pr[1]} e vídeo é {L}x{A}: o libass vai escalar (gere com --tamanho {L}x{A})")
    fs = conferir_fontes(ass, fontes)
    for nome, ps, nossa in fs:
        log(f"fonte: {nome} -> {ps}{'' if nossa else '  (FORA de --fontes: confira o nome da fonte ou use --estrito)'}")
    if estrito and not all(n for *_, n in fs):
        raise RuntimeError("o libass caiu numa fonte do sistema (--estrito)")
    saida.parent.mkdir(parents=True, exist_ok=True)
    cmd = ["ffmpeg", "-y", "-v", "error", "-i", str(video), "-vf", filtro_legenda(ass, fontes),
           "-map", "0:v:0", "-map", "0:a?", "-c:v", "libx264", "-crf", str(crf), "-preset", preset,
           "-pix_fmt", "yuv420p", "-c:a", "copy", "-movflags", "+faststart", str(saida)]
    r = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace")
    if r.returncode:
        raise RuntimeError("ffmpeg falhou:\n" + r.stderr[-1500:])
    return {"saida": saida, "duracao_video_s": dur, "total_s": round(time.perf_counter() - t0, 2), "fontes": fs}


def folha_de_contato(video, ass, instantes, saida, fontes=FONTES, zonas=False, escala=0.5):
    """quadros do vídeo com a legenda nos instantes pedidos, lado a lado (até 6 por linha), tempo embaixo.
    Não reencoda o vídeo: é a prévia rápida para conferir quebra, cor e zona segura."""
    from PIL import Image, ImageDraw
    L, A, dur = sondar(video)
    quadros = []
    with tempfile.TemporaryDirectory(prefix="motores-legenda-") as tmp:
        for i, t in enumerate(instantes):
            png = Path(tmp) / f"{i}.png"
            vf = filtro_legenda(ass, fontes)
            if zonas:
                sx, sy = L / 1080, A / 1920
                vf += "," + ",".join(f"drawbox=x={round(x * sx)}:y={round(y * sy)}:w={round(w * sx)}:h={round(h * sy)}"
                                     f":color=red@0.3:t=fill" for x, y, w, h in ZONAS_9x16)
            # -copyts: o filtro vê o tempo original do quadro, não o tempo desde o -ss
            subprocess.run(["ffmpeg", "-y", "-v", "error", "-copyts", "-ss", f"{t:.3f}", "-i", str(video), "-vf", vf,
                            "-frames:v", "1", str(png)], check=True)
            quadros.append(Image.open(png).convert("RGB").resize((round(L * escala), round(A * escala))))
    col = min(len(quadros), 6)
    lin = -(-len(quadros) // col)
    w, h, faixa = quadros[0].width, quadros[0].height, 40
    folha = Image.new("RGB", (col * w, lin * (h + faixa)), "black")
    d = ImageDraw.Draw(folha)
    for i, (q, t) in enumerate(zip(quadros, instantes)):
        x, y = i % col * w, i // col * (h + faixa)
        folha.paste(q, (x, y))
        d.text((x + 10, y + h + 8), f"{t:.2f} s", fill="white", font_size=24)
    Path(saida).parent.mkdir(parents=True, exist_ok=True)
    folha.save(saida)
    return saida


def main(argv=None):
    sys.stdout.reconfigure(encoding="utf-8")
    ap = argparse.ArgumentParser(prog="queimar.py", description="Queima uma legenda .ass num vídeo (ffmpeg + libass).")
    ap.add_argument("video")
    ap.add_argument("legenda", help="arquivo .ass (de gerar.py ou outro)")
    ap.add_argument("-o", "--saida", help="MP4 de saída (padrão: <video>-legendado.mp4)")
    ap.add_argument("--fontes", type=Path, default=FONTES, help="pasta com os TTF (padrão: fontes/ do repositório)")
    ap.add_argument("--crf", type=int, default=19)
    ap.add_argument("--preset", default="veryfast", help="preset do x264 (ultrafast para prévia)")
    ap.add_argument("--estrito", action="store_true", help="falha se o libass usar fonte fora de --fontes")
    ap.add_argument("--teste", help="instantes em s (ex.: 1,2.5,4): só a folha de contato PNG, sem reencode")
    ap.add_argument("--zonas", action="store_true", help="na folha de contato, pinta de vermelho as zonas da interface 9:16")
    a = ap.parse_args(argv)
    video = Path(a.video)
    try:
        if a.teste:
            ts = [float(t) for t in a.teste.split(",")]
            saida = Path(a.saida or video.with_name(video.stem + "-teste.png"))
            print(f"folha de contato: {folha_de_contato(video, a.legenda, ts, saida, a.fontes, a.zonas)}")
            return
        saida = Path(a.saida or video.with_name(video.stem + "-legendado.mp4"))
        r = queimar(video, a.legenda, saida, a.fontes, a.crf, a.preset, a.estrito)
        print(f"pronto: {r['saida']} ({r['duracao_video_s']:.1f} s de vídeo em {r['total_s']} s)")
    except (FileNotFoundError, RuntimeError, ValueError, subprocess.CalledProcessError) as e:
        sys.exit(f"erro: {e}")


if __name__ == "__main__":
    main()
