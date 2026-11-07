"""Dona Mandioca, passo 1: limpa a geração do GPT antes de vetorizar.

A frente aprovada (referencias/dona-mandioca-frente.png) tem textura granulada,
rosto fora do padrão, braços e colher grudados no corpo. Este script:
  1. tira o granulado (mean shift + mediana);
  2. classifica cada pixel em material x tom (casca, miolo, lenço, bolinha,
     avental) pelas amostras de cor da própria geração + máscaras de região;
  3. APAGA o que vai ser redesenhado como peça de rig (rosto, braços, colher,
     letreiro FARINHA) e reconstrói o corpo por baixo (borda do corpo à mão);
  4. suaviza as fronteiras (blur de one-hot + argmax) e funde manchinhas;
  5. grava um PNG chapado só com as cores finais da paleta.json, pronto para o
     imageTrace do VectorCraft, + um PNG de rótulos (índice da classe).

  python arte/folhas/dona_mandioca_limpar.py
  -> arte/fonte/dona-mandioca-trabalho/limpo.png, classes.npy
"""
import json
from pathlib import Path

import cv2
import numpy as np
from scipy import ndimage as ndi

AQUI = Path(__file__).resolve().parent
ARTE = AQUI.parent
TRAB = ARTE / "fonte" / "dona-mandioca-trabalho"
REF = ARTE / "referencias" / "dona-mandioca-frente.png"

_PALETA = json.loads((ARTE / "paleta.json").read_text(encoding="utf-8"))
PAL = _PALETA["materiais"]
CENARIO = _PALETA["cenario"]
TONS = ["luz", "base", "meio", "sombra", "profunda"]

# amostras de cor da geração (k-means em Lab, 18 centros) e família de cada uma
AMOSTRAS = {
    "#F7C383": "claro", "#DE3C23": "verm", "#F9EECF": "fundo", "#C56125": "casca",
    "#772713": "verm", "#E07D30": "casca", "#AA4A1A": "casca", "#F8C990": "claro",
    "#4A2412": "escuro", "#E8AA69": "claro", "#D76F2A": "casca", "#A8301A": "verm",
    "#B9541F": "casca", "#8C2B17": "verm", "#9B4019": "casca", "#FBDDA8": "claro",
    "#F3B875": "claro", "#D1905A": "claro",
}
# tom de cada amostra dentro do material
TOM_CASCA = {"#E07D30": "base", "#D76F2A": "base", "#C56125": "base", "#B9541F": "meio",
             "#AA4A1A": "sombra", "#9B4019": "sombra", "#4A2412": "sombra"}
TOM_VERM = {"#DE3C23": "base", "#A8301A": "meio", "#8C2B17": "sombra", "#772713": "profunda"}
TOM_CLARO_MIOLO = {"#FBDDA8": "luz", "#F9EECF": "luz", "#F8C990": "base", "#F7C383": "base",
                   "#F3B875": "meio", "#E8AA69": "sombra", "#D1905A": "sombra"}
TOM_CLARO_AVENTAL = {"#FBDDA8": "luz", "#F9EECF": "luz", "#F8C990": "base", "#F7C383": "base",
                     "#F3B875": "meio", "#E8AA69": "sombra", "#D1905A": "sombra"}

# ---- classes finais (ordem = índice no classes.npy)
CLASSES = [("fundo", None)]
for mat in ("mandioca_casca", "mandioca_miolo", "algodao_cru", "lenco_vermelho"):
    for t in TONS:
        CLASSES.append((mat, t))
CLASSES.append(("bolinha", "luz"))
for t in TONS:
    CLASSES.append(("madeira_banca", t))       # colher (só na 3/4: na frente ela é peça de rig)
IDX = {c: i for i, c in enumerate(CLASSES)}


def cor_classe(c, pal):
    mat, t = c
    if mat == "fundo":
        return "#00FF00"   # cor-chave, só para o rastreamento (o papel da folha é quase igual ao miolo)
    if mat == "bolinha":
        return pal["mandioca_miolo"]["luz"]
    if mat == "madeira_banca":
        return CENARIO[mat][t]
    return pal[mat][t]


def hex2bgr(h):
    h = h.lstrip("#")
    return (int(h[4:6], 16), int(h[2:4], 16), int(h[0:2], 16))


def poly_mask(shape, *polys):
    m = np.zeros(shape, np.uint8)
    for p in polys:
        cv2.fillPoly(m, [np.array(p, np.int32)], 1)
    return m.astype(bool)


def ellipse_mask(shape, cx, cy, rx, ry, ang=0):
    m = np.zeros(shape, np.uint8)
    cv2.ellipse(m, (int(cx), int(cy)), (int(rx), int(ry)), ang, 0, 360, 1, -1)
    return m.astype(bool)


# ---- regiões (px da geração 1254x1254), medidas na grade
AVENTAL = [
    # peitilho + alças
    [(428, 548), (472, 552), (548, 642), (838, 640), (850, 522), (868, 524), (864, 742), (540, 744), (520, 700)],
    # saia
    [(530, 736), (866, 736), (936, 996), (922, 1036), (760, 1064), (600, 1062), (496, 1032), (486, 1000), (520, 880)],
    # laço e lateral (atrás, à esquerda)
    [(470, 730), (440, 758), (360, 838), (366, 900), (392, 954), (436, 956), (488, 905), (500, 770)],
]
ROSTO_APAGAR = [  # (cx, cy, rx, ry): olhos, boca, sobrancelhas, bochechas
    (575, 440, 40, 50), (757, 415, 42, 52), (668, 462, 62, 46),
    (570, 380, 50, 22), (742, 352, 50, 26), (520, 492, 34, 22), (812, 458, 30, 22),
]
BRACO_ESQ = [(220, 330), (390, 330), (395, 520), (432, 528), (472, 544), (505, 590), (505, 720), (440, 830),
             (370, 830), (300, 750), (290, 560), (220, 520)]
BRACO_DIR = [(846, 548), (930, 560), (1010, 640), (1005, 700), (965, 830), (870, 830), (846, 760)]
LETREIRO = [(598, 868), (892, 862), (896, 966), (600, 972)]
# borda do corpo por baixo dos braços (x da borda em função de y)
BORDA_ESQ = [(500, 458), (560, 450), (640, 445), (720, 444), (800, 446), (860, 442), (920, 432), (970, 424)]
BORDA_DIR = [(520, 852), (600, 859), (700, 863), (745, 862)]
SAIA_DIR = [(742, 864), (830, 884)]   # borda da saia do avental (desce para fora)
PES = [(430, 1155, 62, 45), (828, 1160, 58, 42)]


def borda(pts, y):
    ys = [p[0] for p in pts]
    xs = [p[1] for p in pts]
    return np.interp(y, ys, xs)


def suavizar(cl, n, sigma):
    """Blur do one-hot de cada classe e argmax: fronteira lisa, sem manchinha."""
    acc = np.zeros(cl.shape + (n,), np.float32)
    for i in range(n):
        acc[..., i] = cv2.GaussianBlur((cl == i).astype(np.float32), (0, 0), sigma)
    return acc.argmax(-1).astype(np.int16)


def fundir_pequenos(cl, area_min, poupar=()):
    """Componente menor que area_min vira a classe vizinha mais comum."""
    out = cl.copy()
    for i in np.unique(cl):
        if i in poupar:
            continue
        lab, n = ndi.label(cl == i)
        if n == 0:
            continue
        areas = ndi.sum(np.ones_like(lab), lab, index=np.arange(1, n + 1))
        for k, a in enumerate(areas, start=1):
            if a >= area_min:
                continue
            comp = lab == k
            anel = cv2.dilate(comp.astype(np.uint8), np.ones((5, 5), np.uint8)).astype(bool) & ~comp
            viz = out[anel]
            viz = viz[viz != i]
            if viz.size:
                out[comp] = np.bincount(viz).argmax()
    return out


def preencher_vizinho(cl, buraco):
    """Pixel marcado como buraco recebe a classe do pixel válido mais próximo."""
    _, (iy, ix) = ndi.distance_transform_edt(buraco, return_indices=True)
    return cl[iy, ix]


def main():
    TRAB.mkdir(parents=True, exist_ok=True)
    pal = PAL
    im = cv2.imread(str(REF))
    H, W = im.shape[:2]
    ms = cv2.medianBlur(cv2.pyrMeanShiftFiltering(im, 12, 22), 5)
    lab = cv2.cvtColor(ms, cv2.COLOR_BGR2LAB).reshape(-1, 3).astype(np.float32)
    nomes = list(AMOSTRAS)
    cen = np.array([hex2bgr(h) for h in nomes], np.uint8).reshape(1, -1, 3)
    cen = cv2.cvtColor(cen, cv2.COLOR_BGR2LAB).reshape(-1, 3).astype(np.float32)
    d = ((lab[:, None, :] - cen[None]) ** 2).sum(-1)
    amostra = d.argmin(1).reshape(H, W)

    yy, xx = np.mgrid[0:H, 0:W]
    m_avental = poly_mask((H, W), AVENTAL[0], AVENTAL[1])
    m_pes = np.zeros((H, W), bool)
    for p in PES:
        m_pes |= ellipse_mask((H, W), *p)

    cl = np.zeros((H, W), np.int16)
    fam = np.array([AMOSTRAS[n] for n in nomes])[amostra]
    hexs = np.array(nomes)[amostra]
    for h in nomes:
        sel = hexs == h
        f = AMOSTRAS[h]
        if f in ("casca", "escuro"):
            cl[sel] = IDX[("mandioca_casca", TOM_CASCA[h])]
        elif f == "verm":
            cl[sel] = IDX[("lenco_vermelho", TOM_VERM[h])]
        elif f in ("claro", "fundo"):
            cl[sel & m_avental] = IDX[("algodao_cru", TOM_CLARO_AVENTAL[h])]
            cl[sel & ~m_avental] = IDX[("mandioca_miolo", TOM_CLARO_MIOLO[h])]
    # fundo: o que é cor de fundo e está ligado à borda da imagem
    fundo = (hexs == "#F9EECF")
    lab_f, _ = ndi.label(fundo)
    bordas = np.unique(np.concatenate([lab_f[0], lab_f[-1], lab_f[:, 0], lab_f[:, -1]]))
    fundo = np.isin(lab_f, bordas[bordas > 0])
    # sombra de chão: claro abaixo de y 1150 fora dos pés
    fundo |= (yy > 1148) & (fam == "claro") & ~m_pes
    fundo |= (yy > 1205)
    cl[fundo] = IDX[("fundo", None)]

    # bolinhas: claro cercado de vermelho
    claro = (fam == "claro") | ((fam == "fundo") & ~fundo)
    lab_c, n = ndi.label(claro & (yy < 470))
    verm = fam == "verm"
    for k in range(1, n + 1):
        comp = lab_c == k
        if comp.sum() > 2500:
            continue
        anel = cv2.dilate(comp.astype(np.uint8), np.ones((9, 9), np.uint8)).astype(bool) & ~comp
        if verm[anel].mean() > 0.55:
            cl[comp] = IDX[("bolinha", "luz")]

    # ---- apagar peças que serão redesenhadas
    apagar = np.zeros((H, W), bool)
    for e in ROSTO_APAGAR:
        apagar |= ellipse_mask((H, W), *e)
    m_be = poly_mask((H, W), BRACO_ESQ)
    m_bd = poly_mask((H, W), BRACO_DIR)
    m_let = poly_mask((H, W), LETREIRO)
    buraco = apagar | m_be | m_bd | m_let
    # o que fica por baixo dos braços: corpo (casca base) até a borda; fora é fundo
    base_c = IDX[("mandioca_casca", "base")]
    sombra_c = IDX[("mandioca_casca", "sombra")]
    fixo = np.full((H, W), -1, np.int16)
    be = borda(BORDA_ESQ, yy)
    fixo[m_be & (xx >= be)] = base_c
    fixo[m_be & (xx >= be) & (xx < be + 16)] = sombra_c
    fixo[m_be & (xx < be)] = IDX[("fundo", None)]
    bd = borda(BORDA_DIR, yy)
    sd = borda(SAIA_DIR, yy)
    corpo_dir = (xx <= bd)
    fixo[m_bd & corpo_dir] = base_c
    fixo[m_bd & corpo_dir & (xx > bd - 16)] = sombra_c
    saia = m_bd & (yy >= 742) & (xx <= sd)
    fixo[saia] = IDX[("algodao_cru", "base")]
    fixo[saia & (xx > sd - 12)] = IDX[("algodao_cru", "meio")]
    fixo[m_bd & ~corpo_dir & ~saia] = IDX[("fundo", None)]
    # alça esquerda do avental continua por baixo do braço
    # laço do avental: sai (é redesenhado à mão); fora do corpo vira fundo
    m_laco = poly_mask((H, W), AVENTAL[2]) & ~poly_mask((H, W), AVENTAL[1])
    buraco |= m_laco
    fixo[m_laco & (xx < be)] = IDX[("fundo", None)]
    fixo[m_laco & (xx >= be) & (xx < be + 14)] = sombra_c
    alca = poly_mask((H, W), [(452, 552), (476, 552), (562, 690), (530, 702)])
    fixo[m_be & alca & (xx >= be)] = IDX[("algodao_cru", "base")]
    cl = np.where(fixo >= 0, fixo, cl)
    buraco &= fixo < 0
    cl = preencher_vizinho(cl, buraco)
    # rosto: preenche com a base da casca (o rosto novo vai por cima)
    rosto_area = np.zeros((H, W), bool)
    for e in ROSTO_APAGAR[:5]:
        rosto_area |= ellipse_mask((H, W), *e)
    cl[rosto_area] = base_c
    # letreiro: base do avental (o lettering novo vai por cima)
    cl[m_let] = IDX[("algodao_cru", "base")]

    # ---- limpar
    n = len(CLASSES)
    cl = suavizar(cl, n, 2.2)
    cl = fundir_pequenos(cl, 160, poupar=(IDX[("bolinha", "luz")],))
    cl = suavizar(cl, n, 1.6)
    # casca em faixas: só os tons da casca, blur maior
    casca = [IDX[("mandioca_casca", t)] for t in TONS]
    m = np.isin(cl, casca)
    sub = np.zeros_like(cl)
    for j, i in enumerate(casca):
        sub[cl == i] = j
    acc = np.stack([cv2.GaussianBlur(((sub == j) & m).astype(np.float32), (0, 0), 3.4) for j in range(5)], -1)
    cl[m] = np.array(casca)[acc.argmax(-1)][m]
    cl = fundir_pequenos(cl, 350, poupar=(IDX[("bolinha", "luz")],))

    np.save(TRAB / "classes.npy", cl)
    cores = np.array([hex2bgr(cor_classe(c, pal)) for c in CLASSES], np.uint8)
    cv2.imwrite(str(TRAB / "limpo.png"), cores[cl])
    usadas = sorted({cor_classe(CLASSES[i], pal) for i in np.unique(cl)})
    print("classes usadas:", len(usadas), usadas)


# ================================================================ vista 3/4 (Qwen, 1024x1024)
REF34 = ARTE / "referencias" / "dona-mandioca" / "qwen-tres-quartos.png"
AVENTAL34 = [
    [(400, 455), (445, 445), (520, 525), (668, 520), (670, 470), (690, 470), (702, 640), (470, 640), (440, 560)],
    [(460, 606), (706, 598), (732, 800), (722, 842), (600, 864), (478, 842), (468, 760)],
    [(288, 702), (330, 620), (402, 610), (412, 700), (378, 792), (318, 792)],
]
COLHER34 = [
    [(316, 262), (360, 250), (408, 272), (414, 330), (402, 440), (410, 488), (384, 492), (366, 440), (328, 410), (310, 330)],
    [(410, 588), (440, 586), (458, 650), (446, 670), (424, 668)],
]
ROSTO34 = [(537, 360, 26, 36), (645, 345, 22, 34), (602, 382, 36, 28), (522, 306, 36, 16), (634, 296, 26, 16),
           (500, 396, 24, 15), (666, 378, 14, 15)]
LETREIRO34 = [(560, 716), (722, 708), (724, 790), (562, 792)]
PES34 = [(420, 945, 52, 36), (656, 940, 38, 26)]


def limpar_tres_quartos():
    im = cv2.imread(str(REF34))
    H, W = im.shape[:2]
    ms = cv2.medianBlur(cv2.pyrMeanShiftFiltering(im, 12, 22), 5)
    lab = cv2.cvtColor(ms, cv2.COLOR_BGR2LAB).reshape(-1, 3).astype(np.float32)
    nomes = list(AMOSTRAS)
    cen = np.array([hex2bgr(h) for h in nomes], np.uint8).reshape(1, -1, 3)
    cen = cv2.cvtColor(cen, cv2.COLOR_BGR2LAB).reshape(-1, 3).astype(np.float32)
    amostra = ((lab[:, None, :] - cen[None]) ** 2).sum(-1).argmin(1).reshape(H, W)
    yy, xx = np.mgrid[0:H, 0:W]
    m_av = poly_mask((H, W), *AVENTAL34)
    m_col = poly_mask((H, W), *COLHER34)
    m_pes = np.zeros((H, W), bool)
    for p in PES34:
        m_pes |= ellipse_mask((H, W), *p)
    hexs = np.array(nomes)[amostra]
    fam = np.array([AMOSTRAS[n] for n in nomes])[amostra]
    cl = np.zeros((H, W), np.int16)
    for h in nomes:
        sel = hexs == h
        f = AMOSTRAS[h]
        if f in ("casca", "escuro"):
            cl[sel & ~m_col] = IDX[("mandioca_casca", TOM_CASCA[h])]
            cl[sel & m_col] = IDX[("madeira_banca", {"luz": "base", "base": "base", "meio": "meio"}.get(TOM_CASCA[h], "sombra"))]
        elif f == "verm":
            cl[sel] = IDX[("lenco_vermelho", TOM_VERM[h])]
        else:
            cl[sel & m_av] = IDX[("algodao_cru", TOM_CLARO_AVENTAL[h])]
            cl[sel & ~m_av] = IDX[("mandioca_miolo", TOM_CLARO_MIOLO[h])]
            cl[sel & m_col] = IDX[("madeira_banca", "luz")]
    fundo = hexs == "#F9EECF"
    lab_f, _ = ndi.label(fundo)
    bordas = np.unique(np.concatenate([lab_f[0], lab_f[-1], lab_f[:, 0], lab_f[:, -1]]))
    fundo = np.isin(lab_f, bordas[bordas > 0])
    fundo |= (yy > 935) & (fam == "claro") & ~m_pes & ~m_av
    fundo |= (yy > 990)
    cl[fundo] = IDX[("fundo", None)]
    claro = (fam == "claro") | ((fam == "fundo") & ~fundo)
    lab_c, n = ndi.label(claro & (yy < 330))
    verm = fam == "verm"
    for k in range(1, n + 1):
        comp = lab_c == k
        if comp.sum() > 1800:
            continue
        anel = cv2.dilate(comp.astype(np.uint8), np.ones((9, 9), np.uint8)).astype(bool) & ~comp
        if verm[anel].mean() > 0.5:
            cl[comp] = IDX[("bolinha", "luz")]
    rosto = np.zeros((H, W), bool)
    for e in ROSTO34:
        rosto |= ellipse_mask((H, W), *e)
    cl[rosto] = IDX[("mandioca_casca", "base")]
    cl[poly_mask((H, W), LETREIRO34)] = IDX[("algodao_cru", "base")]
    n = len(CLASSES)
    cl = suavizar(cl, n, 2.0)
    cl = fundir_pequenos(cl, 120, poupar=(IDX[("bolinha", "luz")],))
    cl = suavizar(cl, n, 1.4)
    casca = [IDX[("mandioca_casca", t)] for t in TONS]
    m = np.isin(cl, casca)
    sub = np.zeros_like(cl)
    for j, i in enumerate(casca):
        sub[cl == i] = j
    acc = np.stack([cv2.GaussianBlur(((sub == j) & m).astype(np.float32), (0, 0), 2.8) for j in range(5)], -1)
    cl[m] = np.array(casca)[acc.argmax(-1)][m]
    cl = fundir_pequenos(cl, 250, poupar=(IDX[("bolinha", "luz")],))
    np.save(TRAB / "classes34.npy", cl)
    cores = np.array([hex2bgr(cor_classe(c, PAL)) for c in CLASSES], np.uint8)
    cv2.imwrite(str(TRAB / "limpo34.png"), cores[cl])
    print("3/4:", len(np.unique(cl)), "classes")


if __name__ == "__main__":
    import sys
    if "34" in sys.argv[1:]:
        limpar_tres_quartos()
    else:
        main()
