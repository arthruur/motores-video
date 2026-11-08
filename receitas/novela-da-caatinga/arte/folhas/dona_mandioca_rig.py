"""Dona Mandioca · rig v2 (2026-11-07): desenhada à mão em código, peça por peça, em qualquer vista.

Por que v2: a v1 era o rastreamento da geração do GPT. A revisão de arte reprovou (casca de raster
posterizado, emenda do quadril que abria, 3/4 achatado num grupo só, braços de régua, rosto pequeno).
A v2 não rastreia nada: cada forma é desenhada aqui, com curvas lisas de pincel (Catmull-Rom),
leve tremor de mão e volume por tons empilhados da paleta (ARTE.md §1). A geração aprovada
(referencias/dona-mandioca-frente.png) é a referência de design: lenço de bolinha com o nó para
cima, miolo branco no topo, avental de saco FARINHA, colher de pau, base larga e pés-toco.

Como o corpo é uma raiz (um cilindro torto), o desenho é PARAMÉTRICO NA VISTA: tudo o que está na
superfície (rosto, avental, bolinhas, faixas da casca, lascas, nó do lenço) é posto em coordenadas
de superfície (u = arco em px a partir da frente, y) e projetado para a vista theta. A luz é de tela
(cima-esquerda), então o volume não gira com ela. theta: 0 = frente, 90 = perfil olhando para a
direita da tela, 180 = costas. Cada vista é um rig próprio com os MESMOS ids (animacao.md §2).

Coordenadas: px no quadro 1254 da geração. Chão em y=1195, meio em x=640.
Quem usa: dona_mandioca_folha.py (folha, banco/) e demos/dona-mandioca/montar.py (vídeo).
"""
import copy
import json
import math
import random
import sys
from pathlib import Path
import xml.etree.ElementTree as ET

import numpy as np

AQUI = Path(__file__).resolve().parent
ARTE = AQUI.parent
SERIE = ARTE.parent
TRAB = ARTE / "fonte" / "dona-mandioca-trabalho"
sys.path.insert(0, str(AQUI))
import rosto_padrao as rp  # noqa: E402  (rosto do elenco, congelado; não depende do cesto_folha.py)

NS = "http://www.w3.org/2000/svg"
ET.register_namespace("", NS)
T = lambda tag: f"{{{NS}}}{tag}"  # noqa: E731

PAL = json.loads((ARTE / "paleta.json").read_text(encoding="utf-8"))
M = PAL["materiais"]
C = M["mandioca_casca"]; MI = M["mandioca_miolo"]; L = M["lenco_vermelho"]; A = M["algodao_cru"]
MAD = PAL["cenario"]["madeira_banca"]; FO = M["folha"]
ESCURO, BOCA_IN = rp.ESCURO, rp.BOCA_IN
CHAO_PROF = PAL["cenario"]["chao_terra"]["profunda"]

CHAO, MEIO = 1195.0, 640.0
QUADRIL_Y = 1040.0                  # pivô do tronco (squash/stretch, inclinação)
TOPO_CABECA = 172.0                 # topo do lenço sem o nó (medida de altura 1,35)
VIEWBOX = (170, 0, 920, 1254)

# rosto: tamanho (px por unidade do mascote). 1,18 = ~0,58 do tamanho absoluto do Mangaio
# (1,0 Mangaio = 2,05 px/unidade aqui). PROPOSTA pendente de aprovação: ver ficha, Decisões.
ROSTO_K = 1.10                      # tamanho das peças (olhos, boca, sobrancelha) em unidades do mascote
ESPACO_K = 1.06                     # espaçamento entre as peças: rosto proporcional à cabeça (decisão 2026-11-07)
ROSTO_Y = 404.0                     # altura dos olhos
ROSTO_INCL = -2.0
BOCA_K = 0.97                       # as bocas sobem um pouco mais que o rosto (legíveis no celular)
OMBRO_Y = 618.0


# ================================================================ util
def el(tag, **kw):
    e = ET.Element(T(tag))
    for k, v in kw.items():
        if v is None:
            continue
        e.set(k.rstrip("_").replace("_", "-"), str(v))
    return e


def path(d, fill, **kw):
    return el("path", d=d, fill=fill, **kw)


def g(id_=None, transform=None, *filhos, **kw):
    e = el("g", id=id_, transform=transform, **kw)
    for f in filhos:
        if f is not None:
            e.append(f)
    return e


def fmt(v):
    return f"{v:.1f}".rstrip("0").rstrip(".")


def suave(pts, fechado=True):
    """Catmull-Rom -> cúbicas: contorno liso de pincel a partir de pontos."""
    n = len(pts)
    P = [np.array(p, float) for p in pts]
    d = f"M{fmt(P[0][0])} {fmt(P[0][1])}"
    rng = range(n) if fechado else range(n - 1)
    for i in rng:
        p0 = P[(i - 1) % n] if (fechado or i > 0) else P[i]
        p1, p2 = P[i], P[(i + 1) % n]
        p3 = P[(i + 2) % n] if (fechado or i + 2 < n) else p2
        c1 = p1 + (p2 - p0) / 6
        c2 = p2 - (p3 - p1) / 6
        d += f"C{fmt(c1[0])} {fmt(c1[1])} {fmt(c2[0])} {fmt(c2[1])} {fmt(p2[0])} {fmt(p2[1])}"
    return d + ("Z" if fechado else "")


def tremer(pts, amp, seed):
    r = random.Random(seed)
    return [(x + r.uniform(-amp, amp), y + r.uniform(-amp, amp)) for x, y in pts]


def oval(cx, cy, rx, ry, rot=0.0, n=14, bojo=None):
    pts = []
    for k in range(n):
        a = 2 * math.pi * k / n
        ex = 1.0
        for (ab, extra, larg) in (bojo or []):
            da = math.atan2(math.sin(a - math.radians(ab)), math.cos(a - math.radians(ab)))
            ex += extra * math.exp(-(da / larg) ** 2)
        x, y = rx * ex * math.cos(a), ry * ex * math.sin(a)
        c, s = math.cos(math.radians(rot)), math.sin(math.radians(rot))
        pts.append((cx + x * c - y * s, cy + x * s + y * c))
    return pts


def deslocar(pts, dx, dy, enc=1.0, centro=None):
    if centro is None:
        cx = sum(p[0] for p in pts) / len(pts); cy = sum(p[1] for p in pts) / len(pts)
    else:
        cx, cy = centro
    return [(cx + (x - cx) * enc + dx, cy + (y - cy) * enc + dy) for x, y in pts]


def volume(pts, ramp, seed, luz=True, desloc=(-4, -5), enc=0.86, amp=1.2, tons=("sombra", "base", "luz")):
    """Cel shading em tons empilhados: sombra (forma toda) -> base deslocada p/ cima-esquerda -> luz."""
    pts = tremer(pts, amp, seed)
    out = [path(suave(pts), ramp[tons[0]]),
           path(suave(deslocar(pts, desloc[0], desloc[1], enc)), ramp[tons[1]])]
    if luz:
        out.append(path(suave(deslocar(pts, desloc[0] * 2.6, desloc[1] * 2.6, 0.42)), ramp[tons[2]]))
    return out


def reamostrar(pts, passo=18.0, fechado=True):
    """Pontos a cada ~passo px ao longo da poligonal (para a projeção acompanhar o cilindro)."""
    out = []
    n = len(pts)
    for i in range(n if fechado else n - 1):
        a, b = np.array(pts[i], float), np.array(pts[(i + 1) % n], float)
        k = max(1, int(np.linalg.norm(b - a) / passo))
        for j in range(k):
            out.append(tuple(a + (b - a) * j / k))
    if not fechado:
        out.append(tuple(pts[-1]))
    return out


def tubo(curva, r0, r1, n=16):
    """Contorno de um 'braço' orgânico: tubo ao longo da curva (pontos), raio afinando de r0 a r1,
    pontas redondas. Devolve pontos do contorno."""
    P = [np.array(p, float) for p in curva]
    # amostra a curva suave
    amostras = []
    for i in range(len(P) - 1):
        p0 = P[i - 1] if i > 0 else P[i]
        p1, p2 = P[i], P[i + 1]
        p3 = P[i + 2] if i + 2 < len(P) else P[i + 1]
        for k in range(n):
            t = k / n
            t2, t3 = t * t, t * t * t
            amostras.append(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2
                                   + (-p0 + 3 * p1 - 3 * p2 + p3) * t3))
    amostras.append(P[-1])
    m = len(amostras)
    esq, dir_ = [], []
    for i, p in enumerate(amostras):
        a = amostras[max(0, i - 1)]; b = amostras[min(m - 1, i + 1)]
        tg = b - a; tg = tg / (np.linalg.norm(tg) or 1)
        nm = np.array([-tg[1], tg[0]])
        r = r0 + (r1 - r0) * (i / (m - 1)) ** 0.8
        esq.append(p + nm * r); dir_.append(p - nm * r)
    # tampas redondas
    def tampa(c, tg, r, sinal):
        ang = math.atan2(tg[1], tg[0])
        return [c + r * np.array([math.cos(ang + sinal * (math.pi / 2 - math.pi * k / 6)),
                                  math.sin(ang + sinal * (math.pi / 2 - math.pi * k / 6))]) for k in range(1, 6)]
    tg_fim = amostras[-1] - amostras[-2]; tg_fim /= np.linalg.norm(tg_fim) or 1
    tg_ini = amostras[0] - amostras[1]; tg_ini /= np.linalg.norm(tg_ini) or 1
    pts = esq[::2] + tampa(amostras[-1], tg_fim, r1, 1) + dir_[::-2] + tampa(amostras[0], tg_ini, r0, 1)
    return [tuple(p) for p in pts]


# ================================================================ corpo: o cilindro torto
_YS = [104, 112, 130, 160, 200, 250, 310, 420, 560, 720, 880, 980, 1050, 1090, 1110]
_RS = [0, 52, 92, 128, 154, 174, 188, 197, 204, 208, 205, 197, 188, 172, 140]


def raio(y):
    return float(np.interp(y, _YS, _RS))


def eixo(y):
    """x do eixo da raiz: levemente torta (nenhuma mandioca é reta)."""
    return MEIO + 9 * math.sin(math.pi * (y - 140) / 970) - 0.014 * (y - 640)


class Vista:
    def __init__(self, theta):
        self.theta = float(theta)
        self.th = math.radians(self.theta)

    def rel(self, phi):
        return phi + self.th

    def proj(self, u, y, r=None, recuo=0.0, clamp=True):
        """superfície (u = arco em px a partir da frente, y) -> (x, y, profundidade)."""
        R = (raio(y) if r is None else r) - recuo
        R = max(R, 1)
        a = self.rel(u / R)
        prof = math.cos(a)
        if clamp:
            s = math.sin(a)
            if prof < 0:
                s = 1.0 if s >= 0 else -1.0
            return eixo(y) + R * s, y, prof
        return eixo(y) + R * math.sin(a), y, prof

    def ang(self, phi_graus, y, recuo=0.0):
        R = raio(y) - recuo
        return self.proj(math.radians(phi_graus) * R, y, recuo=recuo, clamp=False)

    def forma(self, pts_uv, passo=16, recuo=0.0):
        """Forma de superfície -> pontos na tela (+ profundidade média)."""
        pts = reamostrar(pts_uv, passo)
        out, profs = [], []
        for u, y in pts:
            x, yy, p = self.proj(u, y, recuo=recuo)
            out.append((x, yy)); profs.append(p)
        return out, max(profs), sum(profs) / len(profs)


def silhueta_corpo(seed=1, amp=1.6):
    """Contorno do corpo (tela, igual em toda vista: é um cilindro)."""
    ys = list(np.concatenate([np.linspace(112, 330, 12), np.linspace(360, 1100, 24)]))
    dir_ = [(eixo(y) + raio(y), y) for y in ys]
    esq = [(eixo(y) - raio(y), y) for y in ys[::-1]]
    fundo = [(eixo(1110) + 110, 1112), (eixo(1112), 1118), (eixo(1110) - 110, 1112)]
    pts = [(eixo(104), 102)] + dir_ + fundo + esq
    return tremer(pts, amp, seed)


def corpo_tons(v):
    """Volume do corpo por tons de tela (luz de cima-esquerda): sombra -> base -> luz; profunda embaixo-direita."""
    sil = silhueta_corpo()
    out = [path(suave(sil), C["sombra"])]
    out.append(path(suave(deslocar(sil, -11, -7, 0.935, centro=(MEIO, 640))), C["base"]))
    # banda de luz alta à esquerda (ARTE.md §5)
    ys = np.linspace(300, 760, 14)
    luz_e = [(eixo(y) - raio(y) * 0.86, y) for y in ys]
    luz_d = [(eixo(y) - raio(y) * (0.50 + 0.12 * math.sin(math.pi * (y - 300) / 460)), y) for y in ys[::-1]]
    out.append(path(suave(tremer(luz_e + luz_d, 2.0, 7)), C["luz"]))
    # meio-tom vertical à direita (passagem para a sombra)
    ys = np.linspace(260, 1080, 16)
    m_e = [(eixo(y) + raio(y) * (0.50 + 0.06 * math.sin(y / 90)), y) for y in ys]
    m_d = [(eixo(y) + raio(y) * 0.80, y) for y in ys[::-1]]
    out.append(path(suave(tremer(m_e + m_d, 2.0, 8)), C["meio"]))
    # profunda: embaixo e à direita
    ys = np.linspace(820, 1104, 10)
    p_e = [(eixo(y) + raio(y) * (0.88 - 0.10 * (y - 820) / 284), y) for y in ys]
    p_d = [(eixo(y) + raio(y) * 0.985, y) for y in ys[::-1]]
    out.append(path(suave(tremer(p_e + p_d, 1.5, 9)), C["profunda"]))
    return out


# casca rugosa em faixas: anéis curtos que abraçam o cilindro (u0, comprimento, y, espessura, tom)
FAIXAS = [
    (-250, 120, 345, 10, "meio"), (190, 140, 352, 9, "meio"), (-40, 90, 525, 8, "meio"),
    (-205, 70, 392, 8, "meio"), (210, 64, 410, 8, "sombra"), (-190, 80, 532, 9, "sombra"), (176, 70, 516, 8, "meio"),
    (-300, 140, 560, 11, "sombra"), (250, 160, 540, 10, "sombra"), (60, 110, 600, 8, "meio"),
    (-330, 150, 720, 10, "meio"), (300, 170, 700, 11, "sombra"), (-280, 120, 880, 9, "meio"),
    (290, 140, 900, 10, "sombra"), (-260, 160, 1030, 10, "sombra"), (260, 150, 1050, 9, "meio"),
    # costas
    (560, 170, 380, 11, "meio"), (650, 150, 470, 10, "sombra"), (520, 160, 650, 11, "meio"),
    (680, 140, 760, 10, "sombra"), (560, 180, 880, 11, "meio"), (650, 150, 990, 10, "sombra"),
    (-560, 160, 430, 10, "sombra"), (-640, 140, 600, 10, "meio"), (-560, 170, 820, 11, "sombra"),
    (-650, 140, 960, 10, "meio"),
]
# lascas descascadas mostrando o miolo (u, y, largura, altura, rot) — longe do rosto
LASCAS = [(-275, 600, 46, 24, -12), (300, 470, 40, 20, 14), (-300, 960, 50, 26, 8), (320, 820, 38, 22, -10),
          (600, 560, 52, 26, -6), (-610, 520, 46, 22, 10), (660, 900, 44, 22, 12), (-600, 1000, 40, 20, -8)]


def faixa_pts(u0, comp, y, esp):
    """Anel curto: borda de cima e de baixo acompanham o cilindro (curvam para baixo na frente)."""
    us = np.linspace(u0 - comp / 2, u0 + comp / 2, 9)
    topo, baixo = [], []
    for i, u in enumerate(us):
        t = i / (len(us) - 1)
        e = (esp * 1.35) * math.sin(math.pi * t) ** 0.6 + 1.5
        topo.append((u, y))
        baixo.append((u, y + e))
    return topo + baixo[::-1]


def faixas_casca(v, seed=40, so=None):
    out = []
    for i, (u0, comp, y, esp, tom) in enumerate(FAIXAS):
        if so and not (so[0] <= y <= so[1]):
            continue
        uv = faixa_pts(u0, comp, y, esp)
        # curva do anel na vista: desce na frente (vista de leve de cima)
        pts = []
        for u, yy in uv:
            x, _, p = v.proj(u, yy)
            pts.append((x, yy + 12 * max(p, 0)))
        _, pmax, pmed = v.forma(uv)
        if pmed < 0.12:
            continue
        out.append(path(suave(tremer(pts, 0.8, seed + i)), C[tom]))
    for i, (u, y, w, h, rot) in enumerate(LASCAS):
        x, _, p = v.proj(u, y)
        if p < 0.2:
            continue
        sq = max(p, 0.3) ** 0.7
        r = random.Random(90 + i)
        ww, hh = w * 1.15 * sq, h * 0.85
        c, s_ = math.cos(math.radians(rot * 0.5)), math.sin(math.radians(rot * 0.5))
        loc = [(-ww, 2), (-ww * 0.55, -hh * 0.55), (0, -hh * (0.6 + r.uniform(0, 0.2))), (ww * 0.6, -hh * 0.5),
               (ww, -1), (ww * 0.5, hh * 0.55), (-ww * 0.1, hh * 0.45 + r.uniform(0, 4)), (-ww * 0.6, hh * 0.5)]
        pts = [(x + a * c - b * s_, y + a * s_ + b * c) for a, b in loc]
        out.append(path(suave(tremer(pts, 0.8, 90 + i)), MI["sombra"]))
        out.append(path(suave(deslocar(pts, -2, 2, 0.74)), MI["base"]))
        labio = [pts[0], pts[1], pts[2], pts[3], pts[4], (pts[3][0], pts[3][1] - 7), (pts[2][0], pts[2][1] - 8), (pts[1][0], pts[1][1] - 7)]
        out.append(path(suave(tremer(labio, 0.6, 120 + i)), C["profunda"]))
    return out


def miolo_topo():
    """O corte da raiz: miolo branco no topo, acima do lenço (e por baixo dele)."""
    ys = np.linspace(112, 240, 8)
    d = [(eixo(y) + raio(y), y) for y in ys]
    e = [(eixo(y) - raio(y), y) for y in ys[::-1]]
    pts = tremer(reamostrar([(eixo(104), 101)] + d + e, 30), 1.0, 11)
    return [path(suave(pts), MI["sombra"]),
            path(suave(deslocar(pts, -6, -4, 0.9)), MI["base"]),
            path(suave(tremer(oval(eixo(120) - 28, 122, 40, 11, rot=-14, n=10), 1, 12)), MI["luz"])]


# ================================================================ lenço
def lenco_faixa(v, seed=20):
    """A faixa do lenço em volta da cabeça (anel): visível de ponta a ponta em toda vista."""
    def borda(y0, sag, extra, n=13):
        xs = []
        for k in range(n):
            t = -1 + 2 * k / (n - 1)
            R = raio(y0 + sag * (1 - t * t)) + extra
            x = eixo(y0) + R * math.sin(t * math.pi / 2)
            xs.append((x, y0 + sag * (1 - t * t) + 5 * t))
        return xs
    lado = lambda s: [(eixo(y) + s * (raio(y) + 9), y) for y in np.linspace(160, 290, 6)]
    topo = borda(150, 22, 9)
    baixo = borda(290, 26, 4)
    pts = tremer(reamostrar(topo + lado(1)[1:-1] + baixo[::-1] + lado(-1)[::-1][1:-1], 22), 1.0, seed)
    out = [path(suave(pts), L["sombra"])]
    out.append(path(suave(deslocar(pts, -10, -5, 0.94)), L["base"]))
    # dobra de baixo (meio-tom) e brilho de cima-esquerda
    dob = borda(262, 24, 4)[1:-1]
    dob2 = borda(287, 26, 2)[1:-1]
    out.append(path(suave(tremer(dob + dob2[::-1], 1.2, seed + 1)), L["meio"]))
    brilho = [(x, y + 10) for x, y in borda(160, 22, -24)[1:6]] + [(x, y + 30) for x, y in borda(160, 22, -24)[1:6]][::-1]
    out.append(path(suave(tremer(brilho, 1.0, seed + 2)), L["luz"]))
    # bolinhas (na superfície: somem e achatam com a vista)
    k = 0
    for linha, (y, desl) in enumerate(((196, 0), (252, 46))):
        for u in np.arange(-640 + desl, 640, 92):
            x, _, p = v.proj(u, y, r=raio(y) + 10)
            if p < 0.18:
                continue
            k += 1
            sq = p ** 0.6
            yy = y + 20 * max(p, 0) - 6
            out.append(path(suave(tremer(oval(x, yy, 11.5 * sq + 1.5, 11.5, n=9), 0.6, 200 + k)), MI["luz"]))
    return out


def lenco_no(v, seed=30):
    """Nó do lenço com as pontas para cima (a silhueta dela). Devolve (grupo, profundidade, (x, y) do nó)."""
    x, y, p = v.proj(46, 168, r=raio(168) + 8, clamp=False)
    abre = 0.45 + 0.55 * abs(p)
    no = g("lenco-no")
    pontas = g("lenco-pontas", None)
    pontas.set("data-pivo", f"{x:.1f} {y - 10:.1f}")
    folhas = [  # pontas: folhas de tecido a partir do nó (relativas), dobra na ponta
        [(-10, -4), (-64, -40), (-122, -98), (-150, -156), (-112, -146), (-70, -128), (-40, -84), (8, -30)],
        [(10, -10), (52, -66), (112, -116), (164, -140), (142, -98), (102, -56), (56, -24), (16, 6)],
    ]
    for i, f in enumerate(folhas):
        pts = [(x + dx * abre, y + dy) for dx, dy in f]
        for e in volume(pts, L, seed + i, desloc=(-3, -4), enc=0.82, tons=("sombra", "base", "luz")):
            pontas.append(e)
        # bolinhas nas pontas
        for j, (fx, fy) in enumerate(((0.55, 0.52), (0.82, 0.8))):
            bx = x + f[3][0] * abre * fx; by = y + f[3][1] * fy
            pontas.append(path(suave(tremer(oval(bx, by, 7.5, 7.5, n=8), 0.5, 300 + i * 2 + j)), MI["luz"]))
    no.append(pontas)
    nucleo = oval(x, y + 6, 52 * (0.6 + 0.4 * abs(p)), 40, rot=-6, n=12)
    for e in volume(nucleo, L, seed + 5, desloc=(-3, -4), enc=0.8, tons=("sombra", "meio", "base")):
        no.append(e)
    no.append(path(suave(tremer(oval(x - 4, y + 30, 34 * (0.6 + 0.4 * abs(p)), 8, n=8), 0.6, seed + 6)), L["profunda"]))
    return no, p, (x, y)


# ================================================================ avental (na superfície)
BIB = [(-122, 574), (-40, 580), (40, 580), (120, 570), (136, 664), (152, 752), (0, 760), (-152, 756), (-138, 664)]
SAIA = [(-182, 776), (0, 784), (182, 772), (198, 900), (214, 1058), (150, 1072), (80, 1064), (0, 1078),
        (-80, 1066), (-150, 1074), (-216, 1060), (-198, 900)]
BOLSO = [(-110, 868), (0, 874), (110, 864), (112, 946), (104, 1004), (0, 1012), (-106, 1006), (-114, 946)]
ALCAS = [[(-122, 576), (-96, 572), (-190, 548), (-300, 528), (-330, 548), (-214, 570)],
         [(96, 572), (122, 568), (214, 566), (330, 544), (300, 524), (190, 544)]]
COSTAS_X = [[(-200 + 655, 520), (-172 + 655, 512), (170 + 655, 760), (138 + 655, 768)],
            [(200 + 655, 520), (172 + 655, 512), (-170 + 655, 760), (-138 + 655, 768)]]


def peca_avental(v, uv, seed, tons=("sombra", "base", "luz"), luz=True, enc=0.9, desloc=(-6, -6), recuo=-3):
    pts, pmax, pmed = v.forma(uv, recuo=recuo)
    if pmax < 0.08:
        return []
    pts = tremer(pts, 1.0, seed)
    out = [path(suave(pts), A[tons[0]]), path(suave(deslocar(pts, desloc[0], desloc[1], enc)), A[tons[1]])]
    if luz:
        out.append(path(suave(deslocar(pts, desloc[0] * 3, desloc[1] * 2.4, 0.5)), A[tons[2]]))
    return out


def cos_avental(v, seed=50):
    """Cós: anel inteiro na cintura (aparece em toda vista)."""
    def borda(y0, sag, n=13):
        out = []
        for k in range(n):
            t = -1 + 2 * k / (n - 1)
            R = raio(y0) + 4
            out.append((eixo(y0) + R * t, y0 + sag * (1 - t * t)))
        return out
    pts = tremer(borda(748, 14) + borda(782, 16)[::-1], 1.0, seed)
    return [path(suave(pts), A["sombra"]), path(suave(deslocar(pts, -6, -4, 0.95)), A["meio"]),
            path(suave(tremer(borda(752, 14)[2:-2] + [(x, y + 9) for x, y in borda(752, 14)[2:-2]][::-1], 0.8, seed + 1)), A["base"])]


def letreiro(v, seed=3):
    """'FARINHA' em lettering de pincel (Caveat Brush tremida letra a letra) no bolso, na superfície."""
    from fontTools.ttLib import TTFont
    from fontTools.pens.svgPathPen import SVGPathPen
    f = TTFont(SERIE / "fontes" / "CaveatBrush-Regular.ttf")
    gs = f.getGlyphSet(); cmap = f.getBestCmap()
    esc = 0.082
    larg = sum(gs[cmap[ord(ch)]].width * esc + 4 for ch in "FARINHA")
    u = -larg / 2
    r = random.Random(seed)
    out = g("letreiro")
    for ch in "FARINHA":
        nome = cmap[ord(ch)]
        w = gs[nome].width * esc
        x, _, p = v.proj(u + w / 2, 950, recuo=-4)
        rot = r.uniform(-5, 5); dy = r.uniform(-4, 4)
        if p > 0.15:
            pen = SVGPathPen(gs); gs[nome].draw(pen)
            out.append(g(None, f"translate({x:.1f} {958 + dy - 0.04 * (u):.1f}) rotate({rot:.1f}) scale({esc * p:.4f} {-esc}) translate({-gs[nome].width / 2:.0f} 0)",
                         path(pen.getCommands(), A["profunda"], opacity="0.75")))
        u += w + 4
    return out


def laco(cx, cy, abre=1.0, seed=60):
    """Laço do avental no quadril, com as pontas caídas (centro do nó em cx, cy)."""
    out = g("laco")
    alcas = [[(0, -4), (-42 * abre, -34), (-70 * abre, -26), (-66 * abre, 10), (-30 * abre, 18)],
             [(0, 4), (-38 * abre, 32), (-58 * abre, 64), (-30 * abre, 70), (-4, 30)]]
    pontas = [[(-6, 2), (-22 * abre, 58), (-36 * abre, 118), (-14 * abre, 126), (8 * abre, 64), (12, 8)],
              [(6, 4), (12 * abre, 66), (20 * abre, 134), (40 * abre, 128), (30 * abre, 62), (20, 6)]]
    for i, p in enumerate(pontas + alcas):
        pts = [(cx + x, cy + y) for x, y in p]
        for e in volume(pts, A, seed + i, luz=False, desloc=(-3, -3), enc=0.8):
            out.append(e)
    out.append(path(suave(tremer(oval(cx, cy, 18, 16), 1, seed + 10)), A["meio"]))
    out.append(path(suave(tremer(oval(cx - 3, cy - 3, 12, 10), 1, seed + 11)), A["base"]))
    return out


def avental(v):
    """acess-avental: alças, peitilho, cós, saia, bolso, letreiro (frente) ou X das costas, e o laço."""
    grp = g("acess-avental")
    grp.set("data-pivo", f"{eixo(765):.1f} 765")
    for i, a in enumerate(ALCAS):
        for e in peca_avental(v, a, 51 + i, tons=("sombra", "meio", "base"), luz=False, enc=0.8, desloc=(-2, -2)):
            grp.append(e)
    for e in peca_avental(v, BIB, 53):
        grp.append(e)
    for e in peca_avental(v, SAIA, 54):
        grp.append(e)
    for e in cos_avental(v):
        grp.append(e)
    bol = peca_avental(v, BOLSO, 55, tons=("meio", "base", "luz"), luz=False, enc=0.93, desloc=(-3, -4))
    for e in bol:
        grp.append(e)
    # sem o letreiro "FARINHA" no bolso (decisão 2026-11-07): o avental fala por si; letreiro() fica para props
    # X das alças nas costas
    for i, a in enumerate(COSTAS_X):
        for e in peca_avental(v, a, 57 + i, tons=("sombra", "meio", "base"), luz=False, enc=0.8, desloc=(-2, -2)):
            grp.append(e)
    # laço: no quadril direito dela (esquerda da tela na frente), um pouco para trás
    x, y, p = v.ang(-104, 770)
    if p > -0.55:
        grp.append(laco(x + 4 * math.copysign(1, x - MEIO), 772, abre=0.55 + 0.45 * abs(math.sin(v.rel(math.radians(-104))))))
    return grp


# ================================================================ pernas (tocos próprios, não recorte)
PERNA_TOPO, PERNA_R = 972.0, 80.0


def perna(lado, v, seed):
    """Toco curto e redondo; o topo entra ~70 px no tronco (escondido sob a barra do corpo e do avental)."""
    phi = -90 if lado == "esq" else 90
    a = v.rel(math.radians(phi))
    x = MEIO + 108 * math.sin(a)
    prof = math.cos(a)
    frente = math.sin(v.th)                  # para onde aponta a pontinha (perfil: para a frente)
    grp = g(f"perna-{lado}")
    grp.set("data-pivo", f"{x:.1f} {PERNA_TOPO + 38:.1f}")
    grp.set("data-prof", f"{prof:.2f}")
    w = PERNA_R
    pts = [(x - w * 0.92, PERNA_TOPO), (x, PERNA_TOPO - 14), (x + w * 0.92, PERNA_TOPO),
           (x + w * 1.0, 1060), (x + w * 1.02 + 6 * frente, 1150), (x + w * 0.86 + 10 * frente, 1188),
           (x + 20 * frente, CHAO + 1), (x - w * 0.86 + 10 * frente, 1188), (x - w * 1.02 + 6 * frente, 1150),
           (x - w * 1.0, 1060)]
    pts = tremer(pts, 1.2, seed)
    grp.append(path(suave(pts), C["sombra"]))
    grp.append(path(suave(deslocar(pts, -8, -6, 0.88)), C["base"]))
    grp.append(path(suave(tremer([(x - w * 0.70, 1000), (x - w * 0.42, 996), (x - w * 0.46, 1120), (x - w * 0.70, 1130)], 1, seed + 1)), C["luz"]))
    grp.append(path(suave(tremer([(x + w * 0.5, 1010), (x + w * 0.86, 1020), (x + w * 0.9, 1160), (x + w * 0.56, 1170)], 1, seed + 2)), C["meio"]))
    for k, yy in enumerate((1088, 1128)):     # anéis de casca no toco
        fx = [(x - w * 0.8 + 10 * k, yy), (x, yy + 9), (x + w * 0.7, yy + 2), (x + w * 0.66, yy + 10), (x, yy + 18), (x - w * 0.76 + 10 * k, yy + 9)]
        grp.append(path(suave(tremer(fx, 0.8, seed + 3 + k)), C["meio" if k else "sombra"]))
    # pontinha de miolo (o pé é a ponta da raiz): na frente do pé
    px = x + 46 * frente
    rx = 50 * (1 - 0.45 * abs(frente))
    ponta = oval(px, 1166, rx, 25, n=12, bojo=[(-90, 0.15, 0.7)])
    grp.append(path(suave(tremer(ponta, 0.8, seed + 6)), MI["sombra"]))
    grp.append(path(suave(deslocar(tremer(ponta, 0.8, seed + 6), -3, -4, 0.82)), MI["base"]))
    grp.append(path(suave(tremer(oval(px - rx * 0.3, 1158, rx * 0.36, 7, n=8), 0.5, seed + 7)), MI["luz"]))
    return grp, prof


# ================================================================ braços (patinhas)
BR_R0, BR_R1, MAO_R = 48.0, 44.0, 56.0   # MAO_R: legado (sem mão desde 2026-11-07)


def mao(cx, cy, ang, seed, polegar=1):
    """Patinha de luva sem dedos, polegar para dentro. ang: direção do braço (graus)."""
    bojo = [(ang + 90 * polegar + 30 * polegar, 0.30, 0.38)]
    pts = oval(cx, cy, MAO_R, MAO_R * 0.9, rot=ang, n=16, bojo=bojo)
    return volume(pts, C, seed, desloc=(-5, -6), enc=0.84)


def braco_formas(curva, seed, polegar=1):
    """Braço (tubo afinando, ombro redondo) + mão no fim da curva. Coordenadas locais (ombro em 0,0)."""
    pts = tremer(tubo(curva, BR_R0, BR_R1), 1.0, seed)
    out = [path(suave(pts), C["sombra"]), path(suave(deslocar(pts, -5, -4, 0.84)), C["base"])]
    # brilho ao longo do lado de cima-esquerda
    P = np.array(curva, float)
    # brilho: um tubo fino deslocado para cima-esquerda, só no começo do braço (dentro da forma)
    meio_c = [tuple(p) for p in P[:max(2, len(P) - 1)]]
    luz = tubo([(x - BR_R0 * 0.38, y + 10) for x, y in meio_c], BR_R0 * 0.26, BR_R1 * 0.18, n=8)
    out.append(path(suave(tremer(luz, 0.6, seed + 1)), C["luz"]))
    fim, antes = P[-1], P[-2]
    ang = math.degrees(math.atan2(fim[1] - antes[1], fim[0] - antes[0]))
    hx, hy = fim - (fim - antes) / (np.linalg.norm(fim - antes) or 1) * 6   # pega da colher: dentro da ponta
    return out, (float(hx), float(hy)), ang


def colher(seed=90):
    """Colher de pau, pega em (0,0), concha para cima (-y)."""
    out = g("colher-desenho")
    cabo = tubo([(0, 150), (2, 20), (0, -150)], 13, 16)
    for e in volume(cabo, MAD, seed, luz=False, desloc=(-3, -2), enc=0.7):
        out.append(e)
    concha = oval(0, -240, 64, 90, n=16)
    for e in volume(concha, MAD, seed + 1, luz=False, desloc=(-5, -5), enc=0.9):
        out.append(e)
    out.append(path(suave(tremer(oval(3, -234, 44, 68, n=14), 1.2, seed + 2)), MAD["meio"]))
    out.append(path(suave(tremer(oval(-20, -258, 10, 32, rot=8, n=10), 1, seed + 3)), MAD["luz"]))
    out.append(path(suave(tremer(tubo([(-5, 110), (-5, -130)], 3.5, 3), 0.6, seed + 4)), MAD["luz"]))
    return out


def folha_abano(seed=95):
    out = g("folha-abano")
    out.append(path(suave(tremer(tubo([(0, 30), (0, -70)], 7, 6), 0.5, seed)), FO["sombra"]))
    lam = [(0, -60), (-60, -110), (-82, -190), (-50, -270), (0, -300), (48, -262), (78, -186), (58, -110)]
    out.append(path(suave(tremer(lam, 2, seed + 1)), FO["sombra"]))
    out.append(path(suave(deslocar(tremer(lam, 2, seed + 1), -4, -4, 0.88)), FO["base"]))
    out.append(path(suave(tremer([(-3, -64), (-6, -180), (-2, -290), (4, -290), (4, -180), (3, -64)], 0.5, seed + 2)), FO["meio"]))
    for k, y in enumerate((-110, -160, -210, -250)):
        out.append(path(suave(tremer([(-2, y), (-50, y - 34), (-52, y - 28), (-2, y + 8)], 0.6, seed + 3 + k)), FO["meio"]))
        out.append(path(suave(tremer([(2, y), (46, y - 34), (48, y - 28), (2, y + 8)], 0.6, seed + 9 + k)), FO["meio"]))
    return out


# curvas dos braços (locais; s = sentido de "para fora" na tela: -1 = para a esquerda)
def curva_reto(s):
    return [(0, 0), (-4 * s, 70), (-2 * s, 165)]


def curva_cintura(s):
    return [(0, 0), (40 * s, 60), (74 * s, 122), (46 * s, 172), (6 * s, 186)]


def curva_cruzado(s):
    return [(0, 0), (-6 * s, 70), (-40 * s, 122), (-110 * s, 132), (-170 * s, 118)]


def braco(lado, v, seed, rig_completo=False, estado=None):
    """braco-<lado> com as variantes reto (gira no .giro, segura a colher/abano), cintura e cruzado.
    O pivô é o ombro; 'para fora' depende da vista (data-sentido)."""
    estado = estado or {}
    phi = -90 if lado == "esq" else 90
    a = v.rel(math.radians(phi))
    s = math.sin(a)
    prof = math.cos(a)
    R = raio(OMBRO_Y)
    ox = eixo(OMBRO_Y) + (R - 44) * s
    sent = -1 if s < -0.05 else (1 if s > 0.05 else (-1 if lado == "esq" else 1))
    grp = g(f"braco-{lado}", f"translate({ox:.1f} {OMBRO_Y})")
    grp.set("data-pivo", f"{ox:.1f} {OMBRO_Y}")
    grp.set("data-sentido", str(sent))
    grp.set("data-prof", f"{prof:.2f}")
    pose = estado.get(f"braco_{lado}", ("reto", 20))
    prop = estado.get(f"prop_{lado}")
    variantes = ["reto", "cintura", "cruzado"] if rig_completo else [pose[0]]
    for var in variantes:
        sub = g(f"braco-{lado}-{var}")
        if rig_completo and var != pose[0]:
            sub.set("display", "none")
        if var == "reto":
            ang = pose[1] if pose[0] == "reto" and len(pose) > 1 else 20
            giro = g(None, f"rotate({-ang * sent:.1f})", **{"class": "giro"})
            formas, (hx, hy), ang_b = braco_formas(curva_reto(sent), seed, polegar=-sent)
            props = []
            if rig_completo:
                props = [("colher", lado == "esq"), ("abano", False)]
            elif prop:
                props = [(prop[0], True)]
            for nome, vis in props:
                ang_p = prop[1] if (prop and prop[0] == nome) else (-12 if nome == "colher" else -20)
                pg = g(f"prop-{nome}-{lado}" if rig_completo else f"prop-{nome}",
                       f"translate({hx:.1f} {hy:.1f}) rotate({ang_p + ang * sent:.1f})")
                pg.set("data-pivo", f"{hx:.1f} {hy:.1f}")
                if not vis or (rig_completo and not (prop and prop[0] == nome)):
                    pg.set("display", "none")
                desenho = colher() if nome == "colher" else folha_abano()
                if rig_completo:          # ids únicos no rig (há uma colher/abano em cada braço)
                    desenho.set("id", f"{desenho.get('id')}-{lado}")
                pg.append(desenho)
                giro.append(pg)
            for e in formas:              # sem mão: a ponta redonda do braço cobre o cabo
                giro.append(e)
            sub.append(giro)
        else:
            curva = curva_cintura(sent) if var == "cintura" else curva_cruzado(sent)
            formas, (hx, hy), ang_b = braco_formas(curva, seed + (30 if var == "cintura" else 50))
            for e in formas:
                sub.append(e)
        grp.append(sub)
    return grp, prof


# ================================================================ rosto
SOBR_MODOS = {   # (rotação, dy, escala)
    "neutra": (0, 0, 1.0), "levantada": (-12, -16, 1.06), "baixa": (6, 10, 1.0), "brava": (24, 10, 1.06),
    "triste": (-24, -4, 1.0), "alta": (-5, -14, 1.0),
}
OLHO_FORMAS = ("oval", "arco", "meia-lua", "fechado", "grande", "triste", "decidido")
BOCAS_EXPR = ("aberta", "triste", "torta", "ondulada", "firme", "reta")
BOCAS_SINC = ("boca-repouso", "boca-MBP", "boca-A", "boca-E", "boca-I", "boca-O", "boca-U", "boca-FV")


def _pos_rosto(v, u, y, minimo=0.45):
    x, _, p = v.proj(u, y, recuo=-2, clamp=False)
    R = raio(y)
    lim = eixo(y) + R * 0.9 * (1 if x > eixo(y) else -1)
    if abs(x - eixo(y)) > R * 0.9:
        x = lim
    sq = max(p, 0) ** 0.5
    return x, max(sq, minimo), p


def olho_peca(v, lado, forma, escala=1.0, dx=0.0, dy=0.0):
    u = (rp.OLHO[lado][0] - rp.MEIO_OLHOS[0]) * ESPACO_K
    oy = (rp.OLHO[lado][1] - rp.MEIO_OLHOS[1]) * ROSTO_K
    x, sq, p = _pos_rosto(v, u, ROSTO_Y + oy)
    k = ROSTO_K * escala
    if forma in ("oval", "grande"):
        kk = k * (1.24 if forma == "grande" else 1.0)
        cx, cy = rp.OLHO[lado]
        return g(None, f"translate({x + dx:.1f} {ROSTO_Y + oy + dy:.1f}) rotate({ROSTO_INCL}) scale({kk * sq:.3f} {kk:.3f}) translate({-cx} {-cy})",
                 path(rp.OLHO_OVAL[lado], ESCURO)), p
    esp = 1 if lado == "esq" else -1
    nome = {"meia-lua": "meia"}.get(forma, forma)
    return g(None, f"translate({x + dx:.1f} {ROSTO_Y + oy + dy:.1f}) rotate({ROSTO_INCL}) scale({esp * k * 1.3 * sq:.3f} {k * 1.3:.3f})",
             path(rp.OLHOS[nome], ESCURO)), p


def sobr_peca(v, lado, modo):
    u = (rp.OLHO[lado][0] - rp.MEIO_OLHOS[0]) * ESPACO_K
    oy = (rp.OLHO[lado][1] - rp.MEIO_OLHOS[1]) * ROSTO_K
    y = ROSTO_Y + oy - 60 * ROSTO_K / 1.18
    x, sq, p = _pos_rosto(v, u, y)
    esp = 1 if lado == "esq" else -1
    rot, dy, esc = SOBR_MODOS[modo]
    k = ROSTO_K * esc
    return g(None, f"translate({x:.1f} {y + dy:.1f}) rotate({ROSTO_INCL}) scale({esp * sq:.3f} 1) rotate({rot}) scale({k:.3f})",
             path(rp.SOBR, ESCURO)), p


def boca_peca(v, forma, escala=1.0, dx=0.0, dy=0.0):
    ou = (rp.BOCA[0] - rp.MEIO_OLHOS[0]) * ESPACO_K
    oy = (rp.BOCA[1] - rp.MEIO_OLHOS[1]) * ROSTO_K + 8
    x, sq, p = _pos_rosto(v, ou, ROSTO_Y + oy, minimo=0.5)
    k = ROSTO_K * BOCA_K * escala
    if forma == "aberta":
        cx, cy = rp.BOCA
        out = g(None, f"translate({x + dx:.1f} {ROSTO_Y + oy + dy:.1f}) scale({k * sq:.3f} {k:.3f}) translate({-cx} {-cy})")
        for d, cor in rp.BOCA_ABERTA:
            out.append(path(d, cor))
        return out, p
    lista = rp.BOCAS_SINC.get(forma) or rp.BOCAS[forma]
    esc = 1.7
    out = g(None, f"translate({x + dx:.1f} {ROSTO_Y + oy + dy:.1f}) rotate({ROSTO_INCL}) scale({k * esc * sq:.3f} {k * esc:.3f})")
    for d, cor in lista:
        out.append(path(d, cor))
    return out, p


def bochechas(v, escala=1.0, op=0.30):
    out = g("bochechas")
    for lado, su in (("esq", -1), ("dir", 1)):
        by = ROSTO_Y + 40 * ROSTO_K
        x, sq, p = _pos_rosto(v, su * (92 * ESPACO_K + 40 * ROSTO_K), by)
        if p < 0.1:
            continue
        pts = oval(x, by, 22 * ROSTO_K * escala * sq, 14 * ROSTO_K * escala, rot=ROSTO_INCL, n=12)
        out.append(path(suave(tremer(pts, 1, 80 if lado == "esq" else 81)), L["meio"], opacity=f"{op:.2f}"))
    return out


def rosto(v, estado, rig_completo=False):
    """rosto: bochechas, boca (8 de sincronia + 6 de expressão), olho-esq/dir (7 formas), sobr-esq/dir."""
    cx, _, pc = _pos_rosto(v, 0, ROSTO_Y)
    ox, oy = estado.get("olhar", (0, 0))
    rr = estado.get("rosto_rot", 0)
    r = g("rosto", f"translate({ox} {oy}) rotate({rr} {cx:.1f} {ROSTO_Y})" if (ox or oy or rr) else None)
    r.set("data-pivo", f"{cx:.1f} {ROSTO_Y}")
    if pc < -0.15:          # de costas: sem rosto (o grupo fica, vazio, para o motor não quebrar)
        r.set("display", "none")
        return r
    b = bochechas(v, estado.get("bochechas_esc", 1.0))
    if not estado.get("bochechas", True):
        b.set("display", "none")
    r.append(b)
    bo = g("boca")
    if rig_completo:
        for forma in BOCAS_SINC + BOCAS_EXPR:
            p, _ = boca_peca(v, forma)
            p.set("id", forma if forma.startswith("boca-") else f"boca-{forma}")
            if forma != estado.get("boca", "boca-repouso"):
                p.set("display", "none")
            bo.append(p)
    else:
        p, _ = boca_peca(v, estado.get("boca", "boca-repouso"), **estado.get("boca_kw", {}))
        bo.append(p)
    _, by, _ = (0, ROSTO_Y + (rp.BOCA[1] - rp.MEIO_OLHOS[1]) * ROSTO_K + 8, 0)
    bx, _, _ = _pos_rosto(v, (rp.BOCA[0] - rp.MEIO_OLHOS[0]) * ESPACO_K, by)
    bo.set("data-pivo", f"{bx:.1f} {by:.1f}")
    r.append(bo)
    okw = estado.get("olho_kw", {})
    for lado, forma in zip(("esq", "dir"), estado.get("olhos", ("oval", "oval"))):
        o = g(f"olho-{lado}")
        u = (rp.OLHO[lado][0] - rp.MEIO_OLHOS[0]) * ESPACO_K
        oyy = ROSTO_Y + (rp.OLHO[lado][1] - rp.MEIO_OLHOS[1]) * ROSTO_K
        xo, _, po = _pos_rosto(v, u, oyy)
        o.set("data-pivo", f"{xo:.1f} {oyy:.1f}")
        if po < -0.05:
            o.set("display", "none")
        if rig_completo:
            for f in OLHO_FORMAS:
                p, _ = olho_peca(v, lado, f); p.set("id", f"olho-{lado}-{f}")
                if f != forma:
                    p.set("display", "none")
                o.append(p)
        else:
            p, _ = olho_peca(v, lado, forma, **okw.get(lado, {}))
            o.append(p)
        r.append(o)
    for lado, modo in zip(("esq", "dir"), estado.get("sobr", (None, None))):
        s = g(f"sobr-{lado}")
        u = (rp.OLHO[lado][0] - rp.MEIO_OLHOS[0]) * ESPACO_K
        sy = ROSTO_Y + (rp.OLHO[lado][1] - rp.MEIO_OLHOS[1]) * ROSTO_K - 60 * ROSTO_K / 1.18
        xs, _, ps = _pos_rosto(v, u, sy)
        s.set("data-pivo", f"{xs + (22 if lado == 'esq' else -22):.1f} {sy:.1f}")   # ponta de dentro
        if rig_completo:
            for m in SOBR_MODOS:
                p, _ = sobr_peca(v, lado, m); p.set("id", f"sobr-{lado}-{m}")
                if m != modo:
                    p.set("display", "none")
                s.append(p)
            if not modo or ps < -0.05:
                s.set("display", "none")
        elif modo and ps > -0.05:
            p, _ = sobr_peca(v, lado, modo)
            s.append(p)
        else:
            continue
        r.append(s)
    return r


# ================================================================ personagem
ESTADO_PADRAO = dict(
    olhos=("oval", "oval"), sobr=(None, None), boca="boca-repouso", bochechas=True,
    braco_esq=("reto", 58), prop_esq=("colher", -8), braco_dir=("cintura",), prop_dir=None,
)


def dona_mandioca(estado=None, theta=0.0, rig_completo=False, sombra=True, prefixo=None):
    """Personagem inteiro (grupo id=dona-mandioca) na vista theta (graus). prefixo: ignorado (compat. v1)."""
    e = dict(ESTADO_PADRAO)
    e.update(estado or {})
    if theta % 360 not in (0.0,) and not rig_completo:
        # fora da frente, poses de braço dobrado viram braço reto (cintura/cruzado são de frente/3/4)
        if abs(math.sin(math.radians(theta))) > 0.8 or math.cos(math.radians(theta)) < -0.2:
            for lado in ("esq", "dir"):
                if e.get(f"braco_{lado}", ("reto",))[0] != "reto":
                    e[f"braco_{lado}"] = ("reto", 12)
    v = Vista(theta)
    raiz = g("dona-mandioca")
    raiz.set("data-pivo", f"{MEIO} {CHAO}")
    raiz.set("data-vista", f"{theta:g}")
    if sombra:
        sg = g("sombra", None, path(suave(oval(MEIO, CHAO + 2, 236, 20, n=16)), CHAO_PROF, opacity="0.4"))
        sg.set("data-pivo", f"{MEIO} {CHAO + 2}")
        raiz.append(sg)
    pe = e.get("pernas", {})
    pernas = []
    for i, lado in enumerate(("esq", "dir")):
        pg, prof = perna(lado, v, 300 + i * 7)
        dx, dy, rot = pe.get(lado, (0, 0, 0))
        if dx or dy or rot:
            px, py = pg.get("data-pivo").split()
            pg.set("transform", f"translate({dx} {dy}) rotate({rot} {px} {py})")
        pernas.append((prof, pg))
    for _, pg in sorted(pernas, key=lambda t: t[0]):
        raiz.append(pg)

    tronco = g("tronco", e.get("tronco_tf"))
    tronco.set("data-pivo", f"{eixo(QUADRIL_Y):.1f} {QUADRIL_Y}")
    no, prof_no, _ = lenco_no(v)
    bracos = []
    for i, lado in enumerate(("esq", "dir")):
        bg, prof = braco(lado, v, 3 if lado == "esq" else 7, rig_completo=rig_completo, estado=e)
        bracos.append((prof, lado, bg))
    atras = [b for b in bracos if b[0] < -0.3]
    frente = [b for b in bracos if b[0] >= -0.3]
    lenco = g("acess-lenco", e.get("lenco_tf"))
    lenco.set("data-pivo", f"{eixo(240):.1f} 200")
    if prof_no < 0:          # nó atrás da cabeça: as pontas aparecem por cima do topo
        tronco.append(g("acess-lenco-tras", None, no))
    for _, _, bg in atras:
        tronco.append(bg)
    cg = g("corpo")
    cg.set("data-pivo", f"{eixo(QUADRIL_Y):.1f} {QUADRIL_Y}")
    for x in corpo_tons(v) + miolo_topo() + faixas_casca(v):
        cg.append(x)
    # sombra que o lenço projeta na testa
    sl = lambda y0, sag, k: [(eixo(y0) + (raio(y0) - 4) * t, y0 + sag * (1 - t * t)) for t in np.linspace(-1, 1, k)]
    cg.append(path(suave(tremer(sl(296, 26, 11) + sl(318, 34, 11)[::-1][1:-1], 0.8, 13)), C["meio"]))
    tronco.append(cg)
    tronco.append(avental(v))
    for x in lenco_faixa(v):
        lenco.append(x)
    if prof_no >= 0:
        lenco.append(no)
    tronco.append(lenco)
    tronco.append(rosto(v, e, rig_completo=rig_completo))
    ordem = e.get("ordem_bracos")
    frente.sort(key=lambda b: (ordem.index(b[1]) if ordem else b[0]))
    for _, _, bg in frente:
        tronco.append(bg)
    for x in e.get("extra_frente", []):
        tronco.append(x)
    raiz.append(tronco)
    return raiz


def svg_doc(conteudo, viewbox=VIEWBOX, comentario=None):
    x, y, w, h = viewbox
    s = el("svg", width=w, height=h, viewBox=f"{x} {y} {w} {h}", fill="none")
    if comentario:
        s.append(ET.Comment(comentario))
    s.append(conteudo)
    return s


if __name__ == "__main__":
    TRAB.mkdir(parents=True, exist_ok=True)
    for th in (0, 45, 90, 180):
        out = TRAB / f"rig-teste-{th}.svg"
        ET.ElementTree(svg_doc(dona_mandioca(theta=th))).write(out, encoding="unicode")
        print(out)
