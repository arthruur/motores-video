"""Montar: colagem.json (escrito por quem monta) -> reel 9:16 com cartões, legenda da fala real e ficha.

- Cada fragmento: o vídeo original sobre um fundo desfocado dele mesmo, a legenda karaokê (motores/legenda)
  com o texto de revisao/<id>.txt alinhado aos tempos do Whisper (motores/voz: o texto manda, o Whisper
  só empresta os tempos), etiqueta com nome, data, ocasião e FONTE (link e minuto) e grão leve.
- Áudio original de cada fragmento levado a -14 LUFS com loudnorm em 2 passagens (ganho linear).
- Entre fragmentos, 0,4 s de textura; abre com o tema e fecha com TODAS as fontes e "montagem de <autor>".
- Saída: colagem-<tema>.mp4, .srt/.vtt da colagem inteira e ficha-<tema>.json (o porquê de cada escolha).
"""
from __future__ import annotations

import json
import re
import subprocess
import time
import unicodedata
from pathlib import Path

from PIL import ImageFont

from motores.legenda.gerar import FONTE_PADRAO, ZONAS, Config, gerar as gerar_legenda, ler_fonte, ts_ass
from motores.legenda.queimar import filtro_legenda
from motores.voz.alinhar import casar

from .fontes import carregar as carregar_fontes, minutos
from .frases import frases as achar_frases
from .indice import arquivo_palavras, ler_palavras

W, H, FPS = 1080, 1920, 30
Y_VIDEO = 300                         # topo do vídeo 16:9 (1080x608): fica entre y 300 e 908
X_ESQ, X_DIR = ZONAS["universal"][:2]  # 120-780: abaixo de y 840 a coluna de botões do TikTok ocupa x > 780
Y_NOME, Y_INFO, LINHA_PEQ = 930, 1004, 36  # etiqueta: abaixo do vídeo, acima da placa da legenda (~1130)
TRANSICAO, GRAO = 0.4, 5  # grão é ruído e ruído não comprime: com 7 (e 25 nos cartões) o mp4 deu 400 MB
MESES = "jan. fev. mar. abr. maio jun. jul. ago. set. out. nov. dez.".split()
COD_V = ["-c:v", "libx264", "-preset", "veryfast", "-crf", "21", "-maxrate", "8M", "-bufsize", "16M",
         "-pix_fmt", "yuv420p", "-r", str(FPS), "-colorspace", "bt709", "-color_primaries", "bt709",
         "-color_trc", "bt709", "-color_range", "tv"]
COD_A = ["-c:a", "aac", "-b:a", "160k", "-ar", "48000", "-ac", "2"]

_F = ler_fonte(FONTE_PADRAO)
NOME_FONTE = _F["nome"]


def fs(em: float) -> float:
    """Fontsize do ASS que dá um em de `em` px (o libass mede winAscent+winDescent; ver motores/legenda)"""
    return round(em * sum(_F["win"]) / _F["upm"], 1)


def ff(*args):
    r = subprocess.run(["ffmpeg", "-y", "-v", "error", *map(str, args)], capture_output=True, text=True,
                       encoding="utf-8", errors="replace")
    if r.returncode:
        raise RuntimeError("ffmpeg falhou:\n" + r.stderr[-1500:])
    return r


def slug(s: str) -> str:
    s = unicodedata.normalize("NFKD", s.lower())
    return re.sub(r"[^a-z0-9]+", "-", "".join(c for c in s if not unicodedata.combining(c))).strip("-")


def data_br(iso: str | None) -> str:
    if not iso:
        return "s.d."
    p = iso.split("-")
    if len(p) == 3:
        return f"{int(p[2])} {MESES[int(p[1]) - 1]} {p[0]}"
    return f"{MESES[int(p[1]) - 1]} {p[0]}" if len(p) == 2 else p[0]


def sem_esquema(url: str) -> str:
    return re.sub(r"^https?://(www\.)?", "", url)


def ass_esc(s: str) -> str:
    return s.replace("{", "(").replace("}", ")").replace("\\", "/").replace("\n", r"\N")


# ---------------------------------------------------------------- medida do texto (para caber na zona)
_pil = {}


def largura_txt(texto, em, esp=1, borda=0):
    """largura como o libass desenha: letras + Spacing do estilo por letra + contorno dos dois lados"""
    if em not in _pil:
        _pil[em] = ImageFont.truetype(str(FONTE_PADRAO), em)
    return _pil[em].getlength(texto) + esp * len(texto) + 2 * borda


def escala_cabe(texto, em, largura=X_DIR - X_ESQ, esp=1, borda=0):
    """escala (≤ 100%) para caber. Folga de 4%: o libass desenha ~2% mais largo que o Pillow mede"""
    return min(100.0, 96 * largura / max(1, largura_txt(texto, em, esp, borda)))


ESTILOS = (
    f"Style: Nome,{NOME_FONTE},{fs(64)},&H00FFFFFF,&H00FFFFFF,&H00000000,&HB4000000,0,0,0,0,100,100,1,0,1,3,0,7,0,0,0,1\n"
    f"Style: Info,{NOME_FONTE},{fs(36)},&H0033D6FF,&H00FFFFFF,&H00000000,&HB4000000,0,0,0,0,100,100,1,0,1,2,0,7,0,0,0,1\n"
    f"Style: Aviso,{NOME_FONTE},{fs(28)},&H00C8C8C8,&H00FFFFFF,&H00000000,&HB4000000,0,0,0,0,100,100,1,0,1,2,0,7,0,0,0,1\n"
    f"Style: Faixa,{NOME_FONTE},20,&H002A2AD8,&H00000000,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,0,0,7,0,0,0,1\n"
    f"Style: Grande,{NOME_FONTE},{fs(150)},&H00FFFFFF,&H00FFFFFF,&H00000000,&H00000000,0,0,0,0,100,100,2,0,1,0,0,7,0,0,0,1\n"
    f"Style: Chapeu,{NOME_FONTE},{fs(40)},&H00FFFFFF,&H00FFFFFF,&H00000000,&H00000000,0,0,0,0,100,100,6,0,1,0,0,7,0,0,0,1\n"
    f"Style: Lista,{NOME_FONTE},{fs(34)},&H00F0F0F0,&H00FFFFFF,&H00000000,&H00000000,0,0,0,0,100,100,1,0,1,0,0,7,0,0,0,1\n"
    f"Style: Amarelo,{NOME_FONTE},{fs(34)},&H0033D6FF,&H00FFFFFF,&H00000000,&H00000000,0,0,0,0,100,100,1,0,1,0,0,7,0,0,0,1\n")


def escrever_ass(eventos: list[str], arq: Path):
    arq.write_text(f"""[Script Info]
; gerado por motores/colagem/montar.py
ScriptType: v4.00+
PlayResX: {W}
PlayResY: {H}
WrapStyle: 2
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
{ESTILOS}
[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
""" + "\n".join(eventos) + "\n", encoding="utf-8")


def ev(estilo, x, y, texto, fim, ini=0.0, escala=100.0, camada=1, extra=""):
    return (f"Dialogue: {camada},{ts_ass(ini)},{ts_ass(fim)},{estilo},,0,0,0,,"
            f"{{\\an7\\pos({x},{y})\\fscx{escala:.0f}\\fscy{escala:.0f}{extra}}}{ass_esc(texto)}")


def faixa(x, y, w, h, fim):
    """retângulo vermelho (marca de "documento" que se repete em toda a colagem)"""
    return f"Dialogue: 0,{ts_ass(0)},{ts_ass(fim)},Faixa,,0,0,0,,{{\\an7\\pos({x},{y})\\p1}}m 0 0 l {w} 0 l {w} {h} l 0 {h}{{\\p0}}"


# ---------------------------------------------------------------- etiqueta e cartões
def etiqueta(fonte: dict, frag: dict, dur: float) -> tuple[list[str], dict]:
    nome = fonte["figura"].upper()
    info = f"{data_br(fonte.get('data'))} · {fonte['rotulo']}".upper()
    # fonte em todo fragmento, não só no cartão final: quem vê um pedaço solto (print, repost) acha o original.
    # Sem upper(): o id do vídeo diferencia maiúsculas
    a = fonte["trecho"].get("ini", 0) + frag["ini"]
    origem = f"fonte: {sem_esquema(fonte['url'])} · {minutos(a)}"
    aviso = (fonte.get("aviso") or "").upper()
    peq = [origem] + ([aviso] if aviso else [])
    larg = X_DIR - X_ESQ - 28
    e1, e2 = escala_cabe(nome, 64, larg, borda=3), escala_cabe(info, 36, larg, borda=2)
    es = [escala_cabe(s, 28, larg, borda=2) for s in peq]
    y_fim = Y_INFO + 44 + LINHA_PEQ * len(peq)
    fad = "\\fad(150,0)"
    eventos = [faixa(X_ESQ, Y_NOME + 6, 12, y_fim - Y_NOME - 10, dur),
               ev("Nome", X_ESQ + 28, Y_NOME, nome, dur, escala=e1, camada=2, extra=fad),
               ev("Info", X_ESQ + 28, Y_INFO, info, dur, escala=e2, camada=2, extra=fad)]
    eventos += [ev("Aviso", X_ESQ + 28, Y_INFO + 44 + LINHA_PEQ * k, s, dur, escala=e, camada=2, extra=fad)
                for k, (s, e) in enumerate(zip(peq, es))]
    direita = max([largura_txt(nome, 64, borda=3) * e1, largura_txt(info, 36, borda=2) * e2]
                  + [largura_txt(s, 28, borda=2) * e for s, e in zip(peq, es)]) / 100
    return eventos, {"nome": nome, "info": info, "fonte": origem, "aviso": aviso or None,
                     "caixa": [X_ESQ, Y_NOME, round(X_ESQ + 28 + direita), y_fim]}


def cartao_abertura(c: dict) -> list[str]:
    dur = c["dur"]
    eventos = [faixa(X_ESQ, 600, 300, 62, dur), ev("Chapeu", X_ESQ + 18, 608, "COLAGEM", dur)]
    y = 700
    for k, linha in enumerate(c["texto"]):
        e = escala_cabe(linha, 150, esp=2)
        # cada linha entra num tranco, como letreiro de cinejornal
        eventos.append(ev("Grande", X_ESQ, y, linha, dur, ini=0.25 + 0.35 * k, escala=e))
        y += round(150 * e / 100 * 1.02)
    if c.get("sub"):
        eventos.append(ev("Info", X_ESQ, min(y + 40, 1180), c["sub"].upper(), dur))
    return eventos


def cartao_final(col: dict, frags: list[dict]) -> list[str]:
    dur = col["final"]["dur"]
    eventos = [faixa(X_ESQ, 330, 230, 62, dur), ev("Chapeu", X_ESQ + 18, 338, "FONTES", dur)]
    y = 430
    for f in frags:
        fo = f["_fonte"]
        a = int(fo["trecho"].get("ini", 0) + f["ini"])
        b = int(fo["trecho"].get("ini", 0) + f["fim"] + 0.999)
        l1 = f"{fo['figura']} · {data_br(fo.get('data'))} · {fo['rotulo']}"
        url = sem_esquema(fo["url"])
        l2 = f"{url}{'&' if '?' in url else '?'}t={a}s  ({minutos(a)}–{minutos(b)})"
        eventos.append(ev("Amarelo", X_ESQ, y, l1, dur, escala=escala_cabe(l1, 34)))
        eventos.append(ev("Lista", X_ESQ, y + 40, l2, dur, escala=escala_cabe(l2, 34)))
        y += 112
    y += 20
    for linha in col["final"].get("aviso", []):
        eventos.append(ev("Lista", X_ESQ, y, linha, dur, escala=escala_cabe(linha, 34)))
        y += 42
    autor = f"montagem de {col['autor']}".upper()
    eventos.append(ev("Nome", X_ESQ, min(y + 30, 1170), autor, dur, escala=escala_cabe(autor, 64, borda=3)))
    if y + 30 > 1170:
        print("aviso: o cartão final está cheio (fontes demais?); confira a folha de contato")
    return eventos


# ---------------------------------------------------------------- áudio: loudnorm em 2 passagens
def medir_loudnorm(src: Path, ini: float, dur: float, alvo: float) -> dict:
    r = subprocess.run(["ffmpeg", "-hide_banner", "-ss", f"{ini:.3f}", "-t", f"{dur:.3f}", "-i", str(src), "-vn",
                        "-af", f"loudnorm=I={alvo}:TP=-1.5:LRA=11:print_format=json", "-f", "null", "-"],
                       capture_output=True, text=True, encoding="utf-8", errors="replace")
    return json.loads(r.stderr[r.stderr.rindex("{"):r.stderr.rindex("}") + 1])


def filtro_audio(m: dict, dur: float, alvo: float) -> str:
    ln = (f"loudnorm=I={alvo}:TP=-1.5:LRA=11:linear=true:measured_I={m['input_i']}:measured_TP={m['input_tp']}:"
          f"measured_LRA={m['input_lra']}:measured_thresh={m['input_thresh']}:offset={m['target_offset']}")
    # fades de 40-60 ms ficam dentro do respiro: evitam o estalo do corte sem tocar em palavra
    return f"aresample=48000,{ln},aresample=48000,afade=t=in:d=0.04,afade=t=out:st={max(0, dur - 0.06):.3f}:d=0.06"


def ebur128(arq: Path) -> dict:
    r = subprocess.run(["ffmpeg", "-nostats", "-hide_banner", "-i", str(arq), "-map", "0:a", "-af", "ebur128=peak=true",
                        "-f", "null", "-"], capture_output=True, text=True, encoding="utf-8", errors="replace")
    res = r.stderr[r.stderr.rindex("Summary:"):]
    num = lambda pad: float(re.search(pad, res).group(1))
    return {"integrado_lufs": num(r"I:\s+(-?[\d.]+) LUFS"), "pico_verdadeiro_dbtp": num(r"Peak:\s+(-?[\d.]+) dBFS")}


# ---------------------------------------------------------------- fragmento
def texto_revisado(frag: dict, ps: list[dict], pasta: Path) -> tuple[str, bool]:
    """revisao/<id>.txt manda na legenda. Se não existe, nasce do Whisper (uma frase por linha) e
    precisa ser conferido de ouvido por uma pessoa."""
    arq = pasta / f"{frag['id']}.txt"
    if not arq.exists():
        pasta.mkdir(parents=True, exist_ok=True)
        arq.write_text("\n".join(" ".join(p["texto"] for p in ps[i:j + 1]) for i, j in achar_frases(ps)) + "\n",
                       encoding="utf-8")
        return arq.read_text(encoding="utf-8"), True
    return arq.read_text(encoding="utf-8"), False


def render_fragmento(k: int, frag: dict, todas: list[dict], revisao: Path, tmp: Path, alvo: float) -> tuple[Path, dict]:
    fonte = frag["_fonte"]
    src = fonte["_caminho"]
    dur = frag["fim"] - frag["ini"]
    dentro = [p for p in todas if p["inicio"] >= frag["ini"] and p["fim"] <= frag["fim"]]
    cortadas = [p["texto"] for p in todas
                if p["inicio"] < frag["ini"] < p["fim"] or p["inicio"] < frag["fim"] < p["fim"]]
    rel = [dict(p, inicio=round(p["inicio"] - frag["ini"], 3), fim=round(p["fim"] - frag["ini"], 3)) for p in dentro]
    texto, novo = texto_revisado(frag, dentro, revisao)
    palavras, alinh = casar(rel, " ".join(texto.split()))
    for p in palavras:
        p["cena"] = frag["id"]
    leg = gerar_legenda(palavras, tmp / f"frag{k}.ass", Config(), formatos=("ass",))
    eventos, geo = etiqueta(fonte, frag, dur)
    escrever_ass(eventos, tmp / f"frag{k}-etiqueta.ass")
    medida = medir_loudnorm(src, frag["ini"], dur, alvo)
    fv = (f"[0:v]fps={FPS},split[a][b];"
          f"[a]scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H},boxblur=30:2,eq=brightness=-0.25[fundo];"
          f"[b]scale={W}:-2[frente];[fundo][frente]overlay=0:{Y_VIDEO},noise=alls={GRAO}:allf=t,"
          f"{filtro_legenda(tmp / f'frag{k}.ass')},{filtro_legenda(tmp / f'frag{k}-etiqueta.ass')},format=yuv420p[v]")
    saida = tmp / f"frag{k}.mp4"
    ff("-ss", f"{frag['ini']:.3f}", "-t", f"{dur:.3f}", "-i", src, "-filter_complex", fv, "-map", "[v]",
       "-map", "0:a", "-af", filtro_audio(medida, dur, alvo), *COD_V, *COD_A, saida)
    return saida, {"palavras": palavras, "revisao_nova": novo, "palavras_cortadas": cortadas,
                   "alinhamento": alinh, "loudness_original_lufs": float(medida["input_i"]),
                   "legenda_qc": {x: leg["qc"].get(x) for x in ("blocos", "orfaos", "fora_da_zona", "sobreposicoes",
                                                                "placa_x", "placa_y")},
                   "etiqueta": geo}


def render_cartao(nome: str, eventos: list[str], dur: float, tmp: Path, grao: int = 10) -> Path:
    escrever_ass(eventos, tmp / f"{nome}.ass")
    saida = tmp / f"{nome}.mp4"
    ff("-f", "lavfi", "-i", f"color=c=0x101010:s={W}x{H}:r={FPS}:d={dur}", "-f", "lavfi", "-t", str(dur), "-i",
       "anullsrc=r=48000:cl=stereo", "-vf", f"noise=alls={grao}:allf=t,{filtro_legenda(tmp / f'{nome}.ass')},format=yuv420p",
       "-map", "0:v", "-map", "1:a", "-shortest", *COD_V, *COD_A, saida)
    return saida


def render_transicao(tmp: Path) -> Path:
    """0,4 s de textura: película queimada e chiado baixo (corte seco, como nos cinejornais)"""
    saida = tmp / "transicao.mp4"
    ff("-f", "lavfi", "-i", f"color=c=0x6a5840:s={W}x{H}:r={FPS}:d={TRANSICAO}", "-f", "lavfi", "-i",
       f"anoisesrc=r=48000:c=pink:a=0.05:d={TRANSICAO}",
       "-vf", "noise=alls=80:allf=t+u,eq=contrast=1.5:brightness='0.18*sin(n*2.3)':eval=frame,vignette=PI/4,"
              "drawbox=x=0:y=ih*0.47:w=iw:h=6:color=0xd82a2a@0.9:t=fill,format=yuv420p",
       "-af", "aformat=channel_layouts=stereo,afade=t=out:st=0.3:d=0.1", *COD_V, *COD_A, saida)
    return saida


def duracao(arq: Path) -> float:
    r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(arq)],
                       capture_output=True, text=True)
    return float(r.stdout.strip() or 0)


# ---------------------------------------------------------------- colagem inteira
def montar(colagem: Path, pasta_indice: Path, saida: Path, alvo: float = -14.0, faixa_s=(45.0, 75.0), log=print) -> dict:
    t0 = time.perf_counter()
    colagem = Path(colagem).resolve()
    col = json.loads(colagem.read_text(encoding="utf-8"))
    fontes = carregar_fontes(colagem.parent / col.get("fontes", "fontes.json"), opcionais=True)
    por_slug = {f["slug"]: f for f in fontes["fontes"]}
    revisao = colagem.parent / col.get("revisao", "revisao")
    nome = slug(col["tema"])
    tmp = saida / f"tmp-{nome}"
    tmp.mkdir(parents=True, exist_ok=True)
    frags = []
    for f in col["fragmentos"]:
        if f["fonte"] not in por_slug:
            raise ValueError(f"fragmento {f['id']}: fonte '{f['fonte']}' não está no fontes.json")
        if f["fim"] <= f["ini"]:
            raise ValueError(f"fragmento {f['id']}: fim antes do início")
        frags.append(dict(f, _fonte=por_slug[f["fonte"]]))

    pecas = [render_cartao("abertura", cartao_abertura(col["abertura"]), col["abertura"]["dur"], tmp)]
    trans = render_transicao(tmp)
    rel, t_linha, globais = [], col["abertura"]["dur"], []
    for k, f in enumerate(frags, 1):
        t1 = time.perf_counter()
        arq_p = arquivo_palavras(f["_fonte"], pasta_indice)
        if not arq_p.exists():
            raise FileNotFoundError(f"faltam as palavras de '{f['fonte']}' ({arq_p}): rode o subcomando indexar")
        todas = ler_palavras(arq_p)
        arq, info = render_fragmento(k, f, todas, revisao, tmp, alvo)
        if k > 1:
            pecas.append(trans)
            t_linha += TRANSICAO
        pecas.append(arq)
        globais += [dict(p, inicio=p["inicio"] + t_linha, fim=p["fim"] + t_linha) for p in info["palavras"]]
        t_linha += duracao(arq)
        dt = time.perf_counter() - t1
        rel.append((f, info, dt))
        log(f"fragmento {k} ({f['fonte']}): {f['fim'] - f['ini']:.1f} s em {dt:.1f} s, {len(info['palavras'])} palavras, "
            f"{info['alinhamento']['trechos_corrigidos']} trecho(s) diferente(s) do Whisper, "
            f"cortadas: {info['palavras_cortadas'] or 'nenhuma'}")
        if info["revisao_nova"]:
            log(f"  revisao/{f['id']}.txt criado a partir do Whisper: confira de ouvido e rode de novo")
    pecas += [trans, render_cartao("final", cartao_final(col, frags), col["final"]["dur"], tmp)]

    lista = tmp / "lista.txt"
    lista.write_text("".join(f"file '{p.name}'\n" for p in pecas), encoding="utf-8")
    final = saida / f"colagem-{nome}.mp4"
    ff("-f", "concat", "-safe", "0", "-i", lista, "-c", "copy", "-movflags", "+faststart", final)
    # legenda acessível da colagem inteira (para subir como legenda nativa)
    gerar_legenda(globais, saida / f"colagem-{nome}.ass", Config(), formatos=("srt", "vtt"))
    t_render = time.perf_counter() - t0
    dur = duracao(final)
    loud = ebur128(final)

    ficha = {
        "formato": "colagem", "tema": col["tema"], "autor_da_montagem": col["autor"], "arquivo": final.name,
        "duracao_s": round(dur, 2), "faixa_s": list(faixa_s), "render_s": round(t_render, 1), "audio_final": loud,
        "tamanho_mb": round(final.stat().st_size / 2 ** 20, 1),
        "abertura": col["abertura"], "transicao": {"tipo": "textura (película + chiado)", "dur_s": TRANSICAO},
        "fragmentos": [{
            "ordem": k, "id": f["id"], "figura": f["_fonte"]["figura"], "data": f["_fonte"].get("data"),
            "ocasiao": f["_fonte"].get("ocasiao"), "url": f["_fonte"]["url"], "no_arquivo": [f["ini"], f["fim"]],
            "no_original_s": [round(f["_fonte"]["trecho"].get("ini", 0) + f["ini"], 2),
                              round(f["_fonte"]["trecho"].get("ini", 0) + f["fim"], 2)],
            "porque": f.get("porque"), "revisao": f"revisao/{f['id']}.txt", "render_s": round(dt, 1),
            "texto": " ".join(p["texto"] for p in info["palavras"]),
            **{x: info[x] for x in ("palavras_cortadas", "alinhamento", "loudness_original_lufs", "legenda_qc", "etiqueta")},
        } for k, (f, info, dt) in enumerate(rel, 1)],
        "etica": col.get("etica"),
    }
    (saida / f"ficha-{nome}.json").write_text(json.dumps(ficha, ensure_ascii=False, indent=1), encoding="utf-8")
    log(f"colagem: {final} ({dur:.1f} s, {ficha['tamanho_mb']} MB) em {t_render:.1f} s · {loud['integrado_lufs']} LUFS, "
        f"pico {loud['pico_verdadeiro_dbtp']} dBTP · ficha-{nome}.json")
    if not faixa_s[0] <= dur <= faixa_s[1]:
        log(f"AVISO: {dur:.1f} s fora da faixa de {faixa_s[0]:.0f}-{faixa_s[1]:.0f} s")
    return ficha
