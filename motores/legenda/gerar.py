"""Palavras com tempo -> legenda falada (.ass, para queimar com libass) + legenda acessível (.srt e .vtt).

uso: python motores/legenda/gerar.py palavras.json -o saida/legenda.ass [opções]   (--help para todas)

Entrada: lista de palavras {"texto", "inicio", "fim"} (segundos), solta ou em {"palavras": [...]}.
"texto" leva a grafia e a pontuação ("terceiro?"); "cena" é opcional (um bloco nunca cruza troca de cena).

A legenda falada segue a especificação em motores/legenda/README.md:
- blocos por sintagma (programação dinâmica por frase), largura medida com a fonte real (Pillow);
- nunca cruza fim de frase; não separa artigo do nome nem parte nome próprio; evita terminar em "de", "que";
- bloco inteiro visível ao entrar (modo 'visivel') ou palavra que aparece ao ser dita ('surgir');
- palavra atual em cor + 106% (cor sozinha não basta: daltonismo, WCAG 1.4.1);
- placa arredondada atrás do texto, dentro da zona segura escolhida (padrão 'universal');
- número falado vira algarismo ("vinte e sete" -> "27"), opcional.
O .srt/.vtt é outra coisa: até 2 linhas de 42 caracteres, caixa normal, para subir como legenda nativa.
"""
import argparse
import json
import re
import struct
import sys
from dataclasses import dataclass, field, replace
from pathlib import Path

from PIL import ImageFont

RAIZ = Path(__file__).resolve().parents[2]
FONTE_PADRAO = RAIZ / "fontes" / "BarlowCondensed-ExtraBold.ttf"

# Faixa da legenda (esquerda, direita, base) num quadro 1080x1920, por perfil. Fontes no README.
# 'universal' = interseção de Meta, TikTok e YouTube: abaixo de y 840 a coluna de botões do TikTok ocupa x > 780.
ZONAS = {
    "universal": (120, 780, 1248),
    "reels": (65, 1015, 1248),     # Meta: 6% dos lados, 35% de baixo
    "tiktok": (120, 780, 1260),    # modelo In-Feed, faixa abaixo de y 840
    "shorts": (48, 888, 1247),     # sobreposição oficial do YouTube
    "livre": (54, 1026, 1824),     # sem interface por cima: só 5% de margem
}


# ---------------------------------------------------------------- fonte: nome e métricas lidos do próprio TTF
def ler_fonte(arquivo):
    """nome completo, unidades por em, winAscent/winDescent e altura da versal (tabelas name, head, OS/2)"""
    b = Path(arquivo).read_bytes()
    n = struct.unpack(">H", b[4:6])[0]
    tab = {}
    for i in range(n):
        tag, _, off, ln = struct.unpack(">4sIII", b[12 + 16 * i:28 + 16 * i])
        tab[tag.decode("latin-1")] = b[off:off + ln]
    upm = struct.unpack(">H", tab["head"][18:20])[0]
    os2 = tab["OS/2"]
    wa, wd = struct.unpack(">HH", os2[74:78])
    versal = struct.unpack(">h", os2[88:90])[0] if len(os2) >= 90 else 0
    nomes, nm = {}, tab["name"]
    cont, base = struct.unpack(">HH", nm[2:6])
    for i in range(cont):
        plat, _, lang, nid, ln, off = struct.unpack(">6H", nm[6 + 12 * i:18 + 12 * i])
        s = nm[base + off:base + off + ln]
        if plat == 3 and nid in (1, 4) and (nid not in nomes or lang == 0x409):
            nomes[nid] = s.decode("utf-16-be")
    return {"nome": nomes.get(4) or nomes.get(1), "upm": upm, "win": (wa, wd), "versal": versal}


@dataclass
class Config:
    """Tudo em px de um quadro 1080x1920; outro tamanho escala junto (x pela largura, y pela altura)."""
    largura: int = 1080
    altura: int = 1920
    fonte: Path = FONTE_PADRAO
    nome_fonte: str | None = None          # padrão: nome completo lido do TTF
    corpo: float = 84                      # em da fonte, em px (84 px = versal de ~59 px na Barlow)
    zona: str | tuple = "universal"        # nome de ZONAS ou (esq, dir, base)
    centro: str | float = "auto"           # auto: centro da tela se couber na faixa, senão encosta no limite
    modo: str = "visivel"                  # visivel (bloco inteiro ao entrar) · surgir (palavra aparece ao ser dita)
    deslocar: float = 0.0                  # atraso somado a todos os tempos (s)
    algarismos: bool = True                # "mil novecentos e oitenta e oito" -> "1988"
    caixa_alta: bool = True
    placa: bool = True                     # False: sem placa, texto com contorno
    contorno: float = 5                    # px, só sem placa
    cor_texto: str = "#FFFFFF"
    cor_atual: str = "#FFD633"
    cor_placa: str = "#15213B"
    opacidade_placa: float = 0.92
    raio: float = 20
    destaque: float = 1.06                 # escala da palavra atual
    pop: float = 0.12                      # entrada 90% -> 100% (s); 0 desliga
    max_palavras: int = 4
    min_dur: float = 0.5
    cps_max: float = 20
    ultima_min: float = 0.4                # última palavra do bloco fica ao menos isso na tela
    encolhe_min: float = 0.85              # abaixo disso o bloco é re-quebrado
    ocultar: set = field(default_factory=set)  # cenas sem legenda (ex.: cartão final que já traz o texto)
    lse_linha: int = 42                    # .srt/.vtt: caracteres por linha, 2 linhas, 17 cps
    lse_cps: float = 17


# ---------------------------------------------------------------- medidas derivadas da fonte e da zona
class Medidas:
    def __init__(self, cfg: Config):
        sx, sy = cfg.largura / 1080, cfg.altura / 1920
        f = ler_fonte(cfg.fonte)
        self.nome = cfg.nome_fonte or f["nome"]
        self.em = cfg.corpo * sx
        wa, wd = f["win"]
        # libass dimensiona a fonte pela altura winAscent+winDescent (medido no README: erro < 0,5%)
        self.fs = round(self.em * (wa + wd) / f["upm"], 1)
        self.base_an5 = (wa - (wa + wd) / 2) / (wa + wd)  # com \an5, linha de base = \pos + isto·Fontsize
        self.pil = ImageFont.truetype(str(cfg.fonte), round(self.em))
        self.k = self.em / round(self.em)                 # Pillow só aceita corpo inteiro
        versal = f["versal"] / f["upm"] * self.em if f["versal"] else self.pil.getbbox("H")[3] - self.pil.getbbox("H")[1]
        z = ZONAS[cfg.zona] if isinstance(cfg.zona, str) else cfg.zona
        self.esq, self.dir, base = z[0] * sx, z[1] * sx, z[2] * sy
        self.folga_x, self.folga_y = round(0.45 * self.em), round(0.30 * self.em)  # o til precisa de folga em cima
        self.base_placa = base - 8 * sy
        self.linha_base = self.base_placa - self.folga_y
        self.topo_placa = self.linha_base - versal - self.folga_y
        if cfg.centro == "auto":
            self.cx, self.larg_placa = None, self.dir - self.esq
        else:
            self.cx = float(cfg.centro) * sx
            self.larg_placa = 2 * min(self.cx - self.esq, self.dir - self.cx)
            if self.larg_placa <= 0:
                raise ValueError(f"--centro {cfg.centro} fora da faixa da zona ({z[0]}–{z[1]})")
        self.larg_max = self.larg_placa - 2 * self.folga_x
        self.espaco = self.larg(" ")
        if not cfg.placa:  # o contorno engorda cada palavra para os dois lados: soma no espaço
            self.espaco += 2 * cfg.contorno * sx

    def larg(self, s):
        return self.pil.getlength(s) * self.k


def arranjo(textos, M, destaque):
    """largura total e centro de cada palavra. O espaço ganha a folga do destaque (+6% em volta do centro),
    senão a palavra atual encosta na vizinha; nas pontas a folga da placa absorve."""
    ls = [M.larg(t) for t in textos]
    folga = lambda l: (destaque - 1) / 2 * l
    centros, x = [], 0.0
    for k, l in enumerate(ls):
        if k:
            x += M.espaco + max(folga(ls[k - 1]), folga(l))
        centros.append(x + l / 2)
        x += l
    return x, centros


# ---------------------------------------------------------------- texto exibido: número falado vira algarismo
UNID = {"zero": 0, "um": 1, "uma": 1, "dois": 2, "duas": 2, "três": 3, "tres": 3, "quatro": 4, "cinco": 5, "seis": 6,
        "sete": 7, "oito": 8, "nove": 9, "dez": 10, "onze": 11, "doze": 12, "treze": 13, "catorze": 14, "quatorze": 14,
        "quinze": 15, "dezesseis": 16, "dezessete": 17, "dezoito": 18, "dezenove": 19, "vinte": 20, "trinta": 30,
        "quarenta": 40, "cinquenta": 50, "sessenta": 60, "setenta": 70, "oitenta": 80, "noventa": 90, "cem": 100,
        "cento": 100, "duzentos": 200, "duzentas": 200, "trezentos": 300, "trezentas": 300, "quatrocentos": 400,
        "quatrocentas": 400, "quinhentos": 500, "quinhentas": 500, "seiscentos": 600, "seiscentas": 600,
        "setecentos": 700, "setecentas": 700, "oitocentos": 800, "oitocentas": 800, "novecentos": 900,
        "novecentas": 900, "mil": 1000, "milhão": 10 ** 6, "milhões": 10 ** 6}
ORD = {"primeiro": 1, "segundo": 2, "terceiro": 3, "quarto": 4, "quinto": 5, "sexto": 6, "sétimo": 7, "oitavo": 8,
       "nono": 9, "décimo": 10, "vigésimo": 20, "trigésimo": 30}
limpa = lambda w: re.sub(r"[^\wº%]", "", w.lower())
pont = lambda w: re.search(r"[^\wº%]*$", w).group()


def ordinal(t):
    """'terceira' -> (3, 'ª'); None se não for ordinal"""
    for k, v in ORD.items():
        if t in (k, k[:-1] + "a"):
            return v, "ª" if t.endswith("a") else "º"
    return None


def valor_cardinal(ts):
    total = atual = 0
    for x in ts:
        if UNID[x] == 10 ** 6:
            total += (atual or 1) * 10 ** 6
            atual = 0
        elif x == "mil":
            total += (atual or 1) * 1000
            atual = 0
        else:
            atual += UNID[x]
    return total + atual


def escreve_numero(v):
    """1988 fica 1988 (ano); de 10 mil para cima, ponto de milhar; milhão redondo por extenso"""
    if v >= 10 ** 6 and v % 10 ** 6 == 0:
        n = v // 10 ** 6
        return f"{n} {'milhão' if n == 1 else 'milhões'}"
    return f"{v:,}".replace(",", ".") if v >= 10000 else str(v)


def funde_numeros(P):
    """junta 'mil novecentos e oitenta e oito' num token só ('1988'), com o tempo da 1ª à última palavra.
    Cardinal só vira algarismo acima de 10 (norma de legenda); 'por cento' vira '%';
    ordinal composto ('décimo terceiro') vira '13º'."""
    out, i = [], 0
    while i < len(P):
        t = limpa(P[i]["texto"])
        tipo = "card" if t in UNID else "ord" if ordinal(t) else None
        j = i
        if tipo:
            ok = (lambda x: x in UNID) if tipo == "card" else ordinal
            while j + 1 < len(P) and not pont(P[j]["texto"]):
                n1 = limpa(P[j + 1]["texto"])
                if ok(n1):
                    j += 1
                elif n1 == "e" and j + 2 < len(P) and ok(limpa(P[j + 2]["texto"])) and not pont(P[j + 1]["texto"]):
                    j += 2
                else:
                    break
        ts = [limpa(w["texto"]) for w in P[i:j + 1] if limpa(w["texto"]) != "e"]
        exibe, pc = None, False
        if tipo == "card":
            v = valor_cardinal(ts)
            pc = (j + 2 < len(P) and not pont(P[j]["texto"]) and limpa(P[j + 1]["texto"]) == "por"
                  and limpa(P[j + 2]["texto"]) == "cento")
            if v > 10 or pc:
                exibe = escreve_numero(v) + ("%" if pc else "")
        elif tipo == "ord" and (len(ts) > 1 or ordinal(ts[0])[0] >= 10):
            exibe = f"{sum(ordinal(x)[0] for x in ts)}{ordinal(ts[-1])[1]}"
        if exibe:
            j += 2 if pc else 0
            grupo = P[i:j + 1]
            out.append(dict(grupo[0], texto=exibe + pont(grupo[-1]["texto"]), fim=grupo[-1]["fim"], num=True,
                            falado=" ".join(w["texto"] for w in grupo)))
            i = j + 1
        else:
            out.append(dict(P[i], num=False))
            i += 1
    return out


# ---------------------------------------------------------------- quebra em blocos (programação dinâmica por frase)
ARTIGO = {"o", "a", "os", "as", "um", "uma", "uns", "umas", "do", "da", "dos", "das", "no", "na", "nos", "nas", "ao",
          "à", "aos", "às", "pelo", "pela", "seu", "sua", "seus", "suas", "meu", "minha", "teu", "tua", "esse", "essa",
          "este", "esta", "aquele", "aquela"}
PREP_CONJ = {"de", "em", "por", "para", "pra", "com", "sem", "sob", "sobre", "entre", "até", "e", "ou", "mas", "que",
             "se", "porque", "quando", "como", "nem"}
fim_frase = lambda w: bool(re.search(r'[.!?…]["”»)]?$', w["texto"]))


def custo_quebra(a, b):
    """custo de quebrar ENTRE a e b (b abre o próximo bloco)"""
    ta, tb = limpa(a["texto"]), limpa(b["texto"])
    if re.search(r"[,;:—]$", a["texto"]): return 0.0           # depois de pontuação: ótimo
    if a["texto"][:1].isupper() and b["texto"][:1].isupper(): return 30  # nome próprio
    if ta in ARTIGO: return 20                                   # artigo/possessivo + nome
    if a.get("num"): return 20                                   # número + unidade ("27 | dias")
    if ta in PREP_CONJ: return 6                                 # bloco terminando em "de", "pra", "que"...
    if tb in PREP_CONJ: return 0.5                               # antes de prep./conj.: bom (Netflix pt-BR)
    if b["inicio"] - a["fim"] > 0.25: return 0.2                 # pausa real na fala
    return 2.0


def frases_de(P):
    """fecha a frase no ponto final ou na troca de cena"""
    frases, cur = [], []
    for i, w in enumerate(P):
        cur.append(w)
        if fim_frase(w) or i + 1 == len(P) or P[i + 1].get("cena") != w.get("cena"):
            frases.append(cur)
            cur = []
    return frases


def blocos_frase(F, M, cfg):
    up = (lambda s: s.upper()) if cfg.caixa_alta else (lambda s: s)
    n = len(F)
    best, de = [0.0] + [1e9] * n, [0] * (n + 1)
    for e in range(1, n + 1):
        for s in range(max(0, e - cfg.max_palavras), e):
            ws, c = F[s:e], 1.0
            L = arranjo([up(w["texto"]) for w in ws], M, cfg.destaque)[0]
            if L > M.larg_max:
                if L * cfg.encolhe_min > M.larg_max and e - s > 1: continue   # nem encolhendo cabe
                c += (L - M.larg_max) / 20 if e - s > 1 else 0
            dur = (F[e]["inicio"] if e < n else ws[-1]["fim"] + .4) - ws[0]["inicio"]
            if dur < cfg.min_dur: c += (cfg.min_dur - dur) * 40
            chars = sum(len(w["texto"]) for w in ws)
            if dur > 0 and chars / dur > cfg.cps_max: c += chars / dur - cfg.cps_max
            if e - s == 1 and n > 1: c += 1.5                    # evita palavra órfã
            if e < n: c += custo_quebra(F[e - 1], F[e])
            if best[s] + c < best[e]: best[e], de[e] = best[s] + c, s
    out, e = [], n
    while e > 0:
        out.insert(0, F[de[e]:e])
        e = de[e]
    return out


def preparar(palavras, cfg):
    P = [dict(w, inicio=float(w["inicio"]) + cfg.deslocar, fim=float(w["fim"]) + cfg.deslocar) for w in palavras]
    return funde_numeros(P) if cfg.algarismos else [dict(w, num=False) for w in P]


# ---------------------------------------------------------------- tempo e geometria de cada bloco
def montar_blocos(palavras, cfg: Config, M: Medidas | None = None):
    M = M or Medidas(cfg)
    P = preparar(palavras, cfg)
    frases = [F for F in frases_de(P) if F[0].get("cena") not in cfg.ocultar]
    B = [b for F in frases for b in blocos_frase(F, M, cfg)]
    # cena oculta logo depois: a legenda some 0,2 s antes dela
    ocultas = [w["inicio"] for w in P if w.get("cena") in cfg.ocultar]
    blocos = []
    for i, ws in enumerate(B):
        ini = ws[0]["inicio"]
        fim = min(B[i + 1][0]["inicio"] if i + 1 < len(B) else 1e9, ws[-1]["fim"] + 0.8)  # sai quando a próxima fala começa
        fim = max(fim, ini + cfg.min_dur, ws[-1]["inicio"] + cfg.ultima_min) if i + 1 == len(B) else max(fim, ini)
        prox_oculta = min((t for t in ocultas if t > ini), default=None)
        if prox_oculta is not None:
            fim = min(fim, prox_oculta - 0.2)
        textos = [w["texto"].upper() if cfg.caixa_alta else w["texto"] for w in ws]
        L, centros = arranjo(textos, M, cfg.destaque)
        escala = min(1.0, M.larg_max / L)
        lp = L * escala + 2 * M.folga_x                     # largura da placa
        if M.cx is not None:
            cx = M.cx
        else:                                               # centro da tela se couber; senão encosta no limite
            cx = min(max(cfg.largura / 2, M.esq + lp / 2), M.dir - lp / 2)
        x0 = cx - lp / 2
        pos = [cx - L * escala / 2 + c * escala for c in centros]  # centro de cada palavra, medido
        blocos.append(dict(palavras=ws, textos=textos, ini=ini, fim=fim, escala=escala, cx=cx,
                           placa=[round(x0, 1), round(M.topo_placa, 1), round(x0 + lp, 1), round(M.base_placa, 1)],
                           pos=pos))
    return blocos


# ---------------------------------------------------------------- .ass
def ts_ass(s):
    cs = max(0, round(s * 100))
    return f"{cs // 360000}:{cs // 6000 % 60:02d}:{cs // 100 % 60:02d}.{cs % 100:02d}"


def cor_ass(hexa, opacidade=1.0):
    """'#RRGGBB' -> '&HAABBGGRR' (no ASS, alfa 00 = opaco)"""
    h = hexa.lstrip("#")
    if not re.fullmatch(r"[0-9a-fA-F]{6}", h):
        raise ValueError(f"cor inválida: {hexa} (use #RRGGBB)")
    return f"&H{round((1 - opacidade) * 255):02X}{h[4:6]}{h[2:4]}{h[0:2]}".upper()


def placa_desenho(w, h, r):
    """retângulo de cantos arredondados em desenho ASS (\\p1), origem no canto de cima"""
    r = min(r, w / 2, h / 2)
    k = r * 0.45  # controle da curva (aprox. de quarto de círculo)
    f = lambda v: f"{v:g}"
    return (f"m {f(r)} 0 l {f(w - r)} 0 b {f(w - k)} 0 {w} {f(k)} {w} {f(r)} l {w} {f(h - r)} "
            f"b {w} {f(h - k)} {f(w - k)} {h} {f(w - r)} {h} l {f(r)} {h} b {f(k)} {h} 0 {f(h - k)} 0 {f(h - r)} "
            f"l 0 {f(r)} b 0 {f(k)} {f(k)} 0 {f(r)} 0")


def tags_pos(b, t0, x, y, cfg, extra=1.0):
    """posição/escala de um evento que começa em t0: nos primeiros cfg.pop s do bloco, escala em volta do
    centro da placa (90% -> 100%) movendo o \\pos junto, para o bloco crescer inteiro e não cada palavra"""
    yc = (b["placa"][1] + b["placa"][3]) / 2
    k0 = (t0 - b["ini"]) / cfg.pop if cfg.pop > 0 else 1
    s100 = 100 * b["escala"] * extra  # bloco encolhido: escala uniforme (não achata ainda mais a condensada)
    if k0 >= 1:
        return f"\\pos({x:.1f},{y:.1f})\\fscx{s100:.1f}\\fscy{s100:.1f}"
    s0 = 0.9 + 0.1 * max(0.0, k0)
    resta = round((1 - max(0.0, k0)) * cfg.pop * 1000)
    px = lambda s: (b["cx"] + (x - b["cx"]) * s, yc + (y - yc) * s)
    (xa, ya), (xb, yb) = px(s0), px(1)
    return (f"\\move({xa:.1f},{ya:.1f},{xb:.1f},{yb:.1f},0,{resta})\\fscx{s100 * s0:.1f}\\fscy{s100 * s0:.1f}"
            f"\\t(0,{resta},\\fscx{s100:.1f}\\fscy{s100:.1f})")


def gerar_ass(blocos, cfg: Config, M: Medidas | None = None):
    """Cada palavra é um evento próprio com \\pos fixo: o destaque cresce em volta do próprio centro e o
    bloco não "anda". Três estados por palavra: antes (branca), atual (cor + destaque), depois (branca)."""
    M = M or Medidas(cfg)
    ev = []
    y_txt = M.linha_base - M.base_an5 * M.fs
    c_txt, c_atual = cor_ass(cfg.cor_texto), cor_ass(cfg.cor_atual)
    for b in blocos:
        if cfg.placa:
            x0, y0, x1, y1 = b["placa"]
            w, h = round(x1 - x0), round(y1 - y0)
            cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
            pop = f"\\fscx90\\fscy90\\t(0,{round(cfg.pop * 1000)},\\fscx100\\fscy100)" if cfg.pop > 0 else ""
            ev.append(f"Dialogue: 0,{ts_ass(b['ini'])},{ts_ass(b['fim'])},Placa,,0,0,0,,{{\\an5\\pos({cx:.1f},{cy:.1f})"
                      f"{pop}\\p1}}{placa_desenho(w, h, cfg.raio)}{{\\p0}}")
        ws = b["palavras"]
        for k, (w_, t, x) in enumerate(zip(ws, b["textos"], b["pos"])):
            prox = ws[k + 1]["inicio"] if k + 1 < len(ws) else None
            fim_atual = prox if prox is not None and prox - w_["fim"] < 0.25 else w_["fim"] + 0.05
            fim_atual = min(fim_atual, b["fim"])
            estados = [(b["ini"], w_["inicio"], "antes"), (w_["inicio"], fim_atual, "atual"),
                       (fim_atual, b["fim"], "depois")]
            for a, z, est in estados:
                if round(z * 100) <= round(a * 100):
                    continue
                if est == "antes" and cfg.modo == "surgir":
                    continue
                cor = c_atual if est == "atual" else c_txt
                extra = cfg.destaque if est == "atual" else 1.0
                t_ass = t.replace("{", "(").replace("}", ")").replace("\\", "/")  # o ASS trata {} e \ como código
                ev.append(f"Dialogue: 1,{ts_ass(a)},{ts_ass(z)},Fala,,0,0,0,,"
                          f"{{\\an5{tags_pos(b, a, x, y_txt, cfg, extra)}\\1c{cor[:2]}{cor[4:]}&}}{t_ass}")
    contorno = 0 if cfg.placa else round(cfg.contorno * cfg.largura / 1080, 1)
    placa = cor_ass(cfg.cor_placa, cfg.opacidade_placa)
    return f"""[Script Info]
; gerado por motores/legenda/gerar.py (não edite à mão: rode de novo)
ScriptType: v4.00+
PlayResX: {cfg.largura}
PlayResY: {cfg.altura}
WrapStyle: 2
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Fala,{M.nome},{M.fs},{c_txt},{c_txt},&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,{contorno},0,5,0,0,0,1
Style: Placa,{M.nome},{M.fs},{placa},&H00000000,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,0,0,5,0,0,0,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
""" + "\n".join(ev) + "\n"


# ---------------------------------------------------------------- .srt / .vtt (legenda acessível, caixa normal)
def _linhas(ws, n):
    """1 linha se couber; senão a melhor quebra em 2 linhas de até n caracteres (None se não houver)"""
    txt = " ".join(w["texto"] for w in ws)
    if len(txt) <= n:
        return [txt]
    melhor = None
    for k in range(1, len(ws)):
        a, b = " ".join(w["texto"] for w in ws[:k]), " ".join(w["texto"] for w in ws[k:])
        if len(a) <= n and len(b) <= n:
            c = custo_quebra(ws[k - 1], ws[k]) + abs(len(a) - len(b)) / 10
            if melhor is None or c < melhor[0]:
                melhor = (c, [a, b])
    return melhor and melhor[1]


def montar_cues(palavras, cfg: Config):
    """frases -> cues de até 2 linhas, por programação dinâmica: poucas trocas, ≤ 17 cps, quebra em sintagma"""
    P = preparar(palavras, cfg)
    cues = []
    for F in [F for F in frases_de(P) if F[0].get("cena") not in cfg.ocultar]:
        n = len(F)
        best, de = [0.0] + [1e9] * n, [0] * (n + 1)
        for e in range(1, n + 1):
            for s in range(e - 1, -1, -1):
                ws = F[s:e]
                if len(" ".join(w["texto"] for w in ws)) > 2 * cfg.lse_linha + 1:
                    break
                if _linhas(ws, cfg.lse_linha) is None and e - s > 1:
                    continue
                dur = max(ws[-1]["fim"] - ws[0]["inicio"], 0.01)
                chars = sum(len(w["texto"]) for w in ws)
                c = 3.0 + max(0, chars / dur - cfg.lse_cps) + (max(0, 0.83 - dur) * 10)
                if e < n: c += custo_quebra(F[e - 1], F[e])
                if best[s] + c < best[e]: best[e], de[e] = best[s] + c, s
        partes, e = [], n
        while e > 0:
            partes.insert(0, F[de[e]:e])
            e = de[e]
        cues += [dict(ini=ws[0]["inicio"], fim=ws[-1]["fim"], linhas=_linhas(ws, cfg.lse_linha)
                      or [" ".join(w["texto"] for w in ws)]) for ws in partes]
    # tempo: fica até a próxima começar (no máximo +0,6 s depois da fala), mínimo de 5/6 s (Netflix)
    for i, c in enumerate(cues):
        prox = cues[i + 1]["ini"] if i + 1 < len(cues) else 1e9
        c["fim"] = min(prox, max(c["fim"] + 0.6, c["ini"] + 0.83))
    return cues


def _ts(s, sep):
    ms = max(0, round(s * 1000))
    return f"{ms // 3600000:02d}:{ms // 60000 % 60:02d}:{ms // 1000 % 60:02d}{sep}{ms % 1000:03d}"


def gerar_srt(cues):
    return "\n".join(f"{i}\n{_ts(c['ini'], ',')} --> {_ts(c['fim'], ',')}\n" + "\n".join(c["linhas"]) + "\n"
                     for i, c in enumerate(cues, 1))


def gerar_vtt(cues):
    return "WEBVTT\n\n" + "\n".join(f"{_ts(c['ini'], '.')} --> {_ts(c['fim'], '.')}\n" + "\n".join(c["linhas"]) + "\n"
                                    for c in cues)


# ---------------------------------------------------------------- QC (geometria e tempo, sem abrir vídeo)
def qc(blocos, cfg: Config, M: Medidas | None = None, cues=None):
    M = M or Medidas(cfg)
    if not blocos:
        return {"blocos": 0}
    ruim = lambda b, c: not fim_frase(b["palavras"][-1]) and custo_quebra(b["palavras"][-1], c["palavras"][0]) >= 20
    durs = [b["fim"] - b["ini"] for b in blocos]
    r = {
        "blocos": len(blocos),
        "orfaos": sum(len(b["palavras"]) == 1 for b in blocos),
        "curtos": sum(d < cfg.min_dur - 1e-6 for d in durs),
        "quebras_ruins": sum(ruim(b, c) for b, c in zip(blocos, blocos[1:])),
        "encolhidos": sum(b["escala"] < 1 for b in blocos),
        "menor_escala": round(min(b["escala"] for b in blocos), 3),
        "placa_x": [round(min(b["placa"][0] for b in blocos)), round(max(b["placa"][2] for b in blocos))],
        "placa_y": [round(M.topo_placa), round(M.base_placa)],
        "fora_da_zona": sum(b["placa"][0] < M.esq - .5 or b["placa"][2] > M.dir + .5 for b in blocos),
        "ultima_palavra_curta": sum(b["fim"] - b["palavras"][-1]["inicio"] < cfg.ultima_min - 1e-6 for b in blocos),
        "sobreposicoes": sum(a["fim"] > b["ini"] + 1e-6 for a, b in zip(blocos, blocos[1:])),
        "numeros": [f"{w['falado']} -> {w['texto']}" for b in blocos for w in b["palavras"] if w.get("num")],
    }
    if cues:
        r["lse"] = {"cues": len(cues), "maior_linha": max(len(l) for c in cues for l in c["linhas"]),
                    "acima_de_17cps": sum(sum(map(len, c["linhas"])) / max(c["fim"] - c["ini"], .01) > cfg.lse_cps
                                          for c in cues)}
    return r


# ---------------------------------------------------------------- entrada e uso como função
def carregar_palavras(arquivo):
    d = json.loads(Path(arquivo).read_text(encoding="utf-8"))
    P = d["palavras"] if isinstance(d, dict) else d
    for i, w in enumerate(P):
        if not all(k in w for k in ("texto", "inicio", "fim")):
            raise ValueError(f"palavra {i} sem texto/inicio/fim: {w}")
    return P


def gerar(palavras, saida, cfg: Config | None = None, formatos=("ass", "srt", "vtt"), relatorio=None):
    """escreve saida.ass/.srt/.vtt (mesmo nome, extensões diferentes) e devolve o QC"""
    cfg = cfg or Config()
    M = Medidas(cfg)
    saida = Path(saida)
    saida.parent.mkdir(parents=True, exist_ok=True)
    blocos = montar_blocos(palavras, cfg, M)
    cues = montar_cues(palavras, cfg) if {"srt", "vtt"} & set(formatos) else None
    feitos = []
    for fmt, f in (("ass", lambda: gerar_ass(blocos, cfg, M)), ("srt", lambda: gerar_srt(cues)),
                   ("vtt", lambda: gerar_vtt(cues))):
        if fmt in formatos:
            arq = saida.with_suffix("." + fmt)
            arq.write_text(f(), encoding="utf-8")
            feitos.append(arq)
    rel = qc(blocos, cfg, M, cues)
    if relatorio:
        Path(relatorio).write_text(json.dumps({
            "fonte": M.nome, "fontsize_ass": M.fs, "corpo_px": round(M.em, 1), "zona": cfg.zona, "centro": cfg.centro,
            "modo": cfg.modo, "deslocar": cfg.deslocar, "qc": rel,
            "blocos": [{"texto": " ".join(b["textos"]), "ini": round(b["ini"], 3), "fim": round(b["fim"], 3),
                        "escala": round(b["escala"], 3), "placa": b["placa"]} for b in blocos]},
            ensure_ascii=False, indent=1), encoding="utf-8")
    return {"arquivos": feitos, "qc": rel, "blocos": blocos, "cues": cues}


def _zona(s):
    if s in ZONAS:
        return s
    try:
        esq, dir_, base = (float(v) for v in s.split(","))
        return (esq, dir_, base)
    except ValueError:
        raise argparse.ArgumentTypeError(f"zona '{s}': use {', '.join(ZONAS)} ou esq,dir,base (px em 1080x1920)")


def _tamanho(s):
    m = re.fullmatch(r"(\d+)x(\d+)", s)
    if not m:
        raise argparse.ArgumentTypeError("use LxA, ex.: 1080x1920")
    return int(m[1]), int(m[2])


def main(argv=None):
    sys.stdout.reconfigure(encoding="utf-8")
    d = Config()
    ap = argparse.ArgumentParser(
        prog="gerar.py", formatter_class=argparse.RawDescriptionHelpFormatter,
        description="Palavras com tempo -> legenda falada .ass (queimar com queimar.py) + .srt/.vtt acessíveis.",
        epilog="exemplo:\n  python motores/legenda/gerar.py exemplos/legenda/palavras.json -o saida/legenda.ass\n"
               "  python motores/legenda/queimar.py fundo.mp4 saida/legenda.ass -o saida/com-legenda.mp4")
    ap.add_argument("palavras", help="JSON com [{texto, inicio, fim, cena?}] (ou {\"palavras\": [...]})")
    ap.add_argument("-o", "--saida", required=True, help="arquivo .ass; .srt e .vtt saem ao lado com o mesmo nome")
    ap.add_argument("--formatos", default="ass,srt,vtt", help="quais escrever (padrão: ass,srt,vtt)")
    ap.add_argument("--relatorio", help="JSON com geometria e tempo de cada bloco + QC")
    ap.add_argument("--tamanho", type=_tamanho, default=(d.largura, d.altura), help="LxA do vídeo (padrão 1080x1920)")
    ap.add_argument("--zona", type=_zona, default=d.zona,
                    help=f"faixa segura: {', '.join(ZONAS)} ou esq,dir,base em px de 1080x1920 (padrão universal)")
    ap.add_argument("--centro", default="auto", help="auto (padrão) ou x do centro em px de 1080 de largura")
    ap.add_argument("--modo", choices=["visivel", "surgir"], default=d.modo,
                    help="visivel: bloco inteiro ao entrar (padrão) · surgir: palavra aparece ao ser dita")
    ap.add_argument("--deslocar", type=float, default=0.0, help="soma este atraso (s) a todos os tempos; aceita negativo")
    ap.add_argument("--numeros", choices=["algarismos", "falados"], default="algarismos",
                    help="'vinte e sete' vira '27' (padrão) ou fica como foi falado")
    ap.add_argument("--caixa", choices=["alta", "normal"], default="alta", help="caixa da legenda falada (padrão alta)")
    ap.add_argument("--fonte", type=Path, default=d.fonte, help="TTF estático (libass ignora o peso de fonte variável)")
    ap.add_argument("--nome-fonte", help="nome para o libass (padrão: nome completo lido do TTF)")
    ap.add_argument("--corpo", type=float, default=d.corpo, help="em da fonte em px num quadro de 1080 (padrão 84)")
    ap.add_argument("--cor-texto", default=d.cor_texto)
    ap.add_argument("--cor-atual", default=d.cor_atual, help="cor da palavra sendo dita")
    ap.add_argument("--cor-placa", default=d.cor_placa)
    ap.add_argument("--opacidade-placa", type=float, default=d.opacidade_placa)
    ap.add_argument("--sem-placa", action="store_true", help="sem placa: texto com contorno preto")
    ap.add_argument("--max-palavras", type=int, default=d.max_palavras, help="palavras por bloco (padrão 4)")
    ap.add_argument("--ocultar", default="", help="ids de cena sem legenda, separados por vírgula")
    a = ap.parse_args(argv)
    if not Path(a.palavras).is_file():
        ap.error(f"não achei {a.palavras}")
    if not a.fonte.is_file():
        ap.error(f"não achei a fonte {a.fonte}")
    cfg = replace(d, largura=a.tamanho[0], altura=a.tamanho[1], fonte=a.fonte, nome_fonte=a.nome_fonte,
                  corpo=a.corpo, zona=a.zona, centro=a.centro, modo=a.modo, deslocar=a.deslocar,
                  algarismos=a.numeros == "algarismos", caixa_alta=a.caixa == "alta", placa=not a.sem_placa,
                  cor_texto=a.cor_texto, cor_atual=a.cor_atual, cor_placa=a.cor_placa,
                  opacidade_placa=a.opacidade_placa, max_palavras=a.max_palavras,
                  ocultar={s for s in a.ocultar.split(",") if s})
    try:
        r = gerar(carregar_palavras(a.palavras), a.saida, cfg,
                  formatos=[f.strip() for f in a.formatos.split(",")], relatorio=a.relatorio)
    except ValueError as e:
        sys.exit(f"erro: {e}")
    print(" | ".join(" ".join(b["textos"]) for b in r["blocos"]))
    print(json.dumps(r["qc"], ensure_ascii=False))
    print("escrito: " + ", ".join(str(p) for p in r["arquivos"]))


if __name__ == "__main__":
    main()
