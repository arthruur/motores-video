"""Dona Mandioca v4: montagem SIMPLES de peças, desenhadas em código, com as proporções da referência.

    python arte/folhas/dona_mandioca_simples.py  -> arte/banco/dona-mandioca/dona-mandioca-v4.svg (+ .png)

A vetorização automática fazia formas estranhas. Aqui cada peça é UMA forma limpa (pontos de controle
ligados por curva suave) com no máximo 2 ou 3 tons: base, uma sombra (embaixo/à direita) e uma luz
(em cima/à esquerda). Coordenadas = as da referência (referencias/dona-mandioca-frente.png, 1254 x 1254).
Ids do rig (animacao.md §2): dona-mandioca > sombra, perna-esq, perna-dir, tronco > corpo, acess-avental,
acess-lenco, rosto (bochechas, olho-esq, olho-dir, boca), braco-esq (prop-colher), braco-dir.
"""
import json
import subprocess
import sys
from pathlib import Path

AQUI = Path(__file__).resolve().parent
ARTE = AQUI.parent
sys.path.insert(0, str(AQUI))
import dona_mandioca_rig3 as r3  # noqa: E402  (rosto padrão e braços já posicionados na referência)

PAL = json.loads((ARTE / "paleta.json").read_text(encoding="utf-8"))
M = PAL["materiais"]
C, MI, L, A = M["mandioca_casca"], M["mandioca_miolo"], M["lenco_vermelho"], M["algodao_cru"]
CHAO = 1196


def suave(pts):
    """polígono fechado -> path com curvas Catmull-Rom (sem quinas)."""
    n = len(pts)
    d = [f"M{pts[0][0]:.1f} {pts[0][1]:.1f}"]
    for i in range(n):
        p0, p1, p2, p3 = pts[i - 1], pts[i], pts[(i + 1) % n], pts[(i + 2) % n]
        c1 = (p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6)
        c2 = (p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6)
        d.append(f"C{c1[0]:.1f} {c1[1]:.1f} {c2[0]:.1f} {c2[1]:.1f} {p2[0]:.1f} {p2[1]:.1f}")
    return "".join(d) + "Z"


def P(pts, cor, extra=""):
    return f'<path d="{suave(pts)}" fill="{cor}"{extra}/>'


def elipse(cx, cy, rx, ry, cor, rot=0):
    return f'<ellipse cx="{cx}" cy="{cy}" rx="{rx}" ry="{ry}" fill="{cor}" transform="rotate({rot} {cx} {cy})"/>'


# ------------------------------------------------------------------ corpo: raiz com topo redondo
CORPO = [(665, 188), (748, 200), (812, 248), (846, 330), (858, 450), (862, 600), (872, 780), (884, 960), (884, 1045),
         (660, 1052), (436, 1045), (440, 950), (452, 780), (456, 600), (462, 440), (480, 320), (528, 238), (590, 200)]
CORPO_SOMBRA = [(812, 262), (846, 340), (858, 460), (862, 610), (872, 790), (884, 965), (884, 1045), (800, 1050),
                (812, 960), (806, 780), (800, 600), (796, 450), (786, 340)]
CORPO_LUZ = [(520, 290), (548, 250), (570, 262), (548, 330), (528, 450), (522, 600), (500, 620), (494, 470), (500, 360)]
LASCAS = [[(500, 690), (540, 676), (556, 700), (528, 722), (496, 716)],
          [(806, 520), (838, 510), (848, 540), (820, 556), (800, 546)],
          [(470, 900), (506, 890), (514, 916), (480, 930)]]
MIOLO_TOPO = [(590, 214), (665, 196), (744, 210), (770, 238), (720, 262), (665, 270), (604, 262), (566, 240)]


def corpo():
    s = P(CORPO, C["base"]) + P(CORPO_SOMBRA, C["sombra"]) + P(CORPO_LUZ, C["luz"])
    for l in LASCAS:
        s += P(l, MI["base"])
    s += P(MIOLO_TOPO, MI["luz"])
    return f'<g id="corpo">{s}</g>'


# ------------------------------------------------------------------ pernas: tocos com a ponta de miolo
def perna(lado):
    if lado == "esq":
        pts = [(448, 1000), (626, 1000), (628, 1110), (606, 1186), (500, 1196), (388, 1190), (372, 1150), (412, 1060)]
        ponta, piv = (440, 1166, 60, 30), (530, 1040)
        sombra = [(560, 1040), (626, 1030), (628, 1110), (606, 1184), (560, 1190)]
    else:
        pts = [(684, 1000), (868, 1000), (890, 1070), (904, 1150), (886, 1190), (770, 1196), (698, 1186), (682, 1110)]
        ponta, piv = (846, 1166, 58, 30), (775, 1040)
        sombra = [(830, 1030), (890, 1060), (904, 1150), (886, 1188), (830, 1192)]
    cx, cy, rx, ry = ponta
    s = P(pts, C["base"]) + P(sombra, C["sombra"]) + elipse(cx, cy, rx, ry, MI["base"]) + elipse(cx - 12, cy - 8, rx * 0.5, ry * 0.4, MI["luz"])
    return f'<g id="perna-{lado}" data-pivo="{piv[0]} {piv[1]}">{s}</g>'


# ------------------------------------------------------------------ avental: peitilho, cós, saia, bolso, laço
def avental():
    peito = [(498, 560), (680, 548), (860, 542), (850, 650), (842, 760), (680, 770), (506, 772), (500, 660)]
    peito_sombra = [(790, 548), (860, 542), (850, 650), (842, 760), (790, 765)]
    saia = [(480, 790), (680, 800), (884, 780), (912, 900), (936, 1000), (880, 1040), (680, 1062), (480, 1050), (430, 1020), (452, 900)]
    saia_sombra = [(840, 790), (884, 782), (912, 900), (936, 1000), (880, 1040), (820, 1050), (850, 920)]
    cos = [(476, 752), (680, 762), (870, 742), (872, 792), (680, 808), (474, 800)]
    bolso = [(590, 870), (860, 862), (864, 990), (596, 998)]
    laco = (P([(472, 790), (420, 770), (372, 800), (380, 840), (440, 830), (472, 812)], A["sombra"])
            + P([(472, 800), (430, 850), (404, 900), (430, 905), (466, 860)], A["sombra"])
            + P([(470, 790), (430, 778), (392, 804), (398, 828), (444, 820)], A["base"]))
    alcas = (P([(500, 566), (470, 520), (452, 470), (474, 466), (500, 510), (524, 560)], A["base"])
             + P([(836, 548), (850, 500), (866, 470), (884, 480), (868, 520), (856, 560)], A["base"]))
    s = (alcas + P(saia, A["base"]) + P(saia_sombra, A["sombra"]) + P(peito, A["luz"]) + P(peito_sombra, A["base"])
         + P(bolso, A["luz"]) + P([(590, 870), (860, 862), (860, 880), (592, 888)], A["base"]) + laco + P(cos, A["base"])
         + P([(476, 788), (680, 798), (872, 780), (872, 792), (680, 808), (474, 800)], A["sombra"]))
    return f'<g id="acess-avental">{s}</g>'


# ------------------------------------------------------------------ lenço: faixa, nó e duas orelhas
def lenco():
    faixa = [(404, 330), (410, 260), (450, 196), (520, 148), (600, 124), (665, 118), (740, 126), (800, 160), (838, 220),
             (846, 290), (820, 268), (780, 226), (720, 206), (665, 202), (600, 208), (540, 236), (494, 286), (468, 340), (440, 400), (412, 392)]
    faixa_sombra = [(404, 330), (412, 392), (440, 400), (468, 340), (494, 286), (470, 300), (436, 340)]
    orelha_e = [(640, 112), (590, 76), (520, 50), (466, 58), (470, 100), (530, 132), (600, 140)]
    orelha_d = [(690, 108), (730, 64), (790, 30), (806, 48), (796, 104), (740, 132), (700, 136)]
    no = [(630, 92), (665, 78), (700, 92), (704, 126), (665, 140), (628, 126)]
    s = (P(orelha_e, L["base"]) + P([(600, 140), (530, 132), (510, 118), (580, 114), (636, 124)], L["sombra"])
         + P(orelha_d, L["base"]) + P([(700, 136), (740, 132), (790, 104), (760, 96), (712, 118)], L["sombra"])
         + P(faixa, L["base"]) + P(faixa_sombra, L["sombra"])
         + P([(720, 206), (780, 226), (820, 268), (846, 290), (838, 220), (810, 200), (770, 196)], L["sombra"])
         + P(no, L["sombra"]) + elipse(665, 104, 22, 16, L["base"]))
    bolinhas = [(526, 72), (580, 104), (476, 290), (432, 330), (520, 200), (600, 150), (742, 152), (800, 210), (750, 86),
                (790, 52), (470, 220), (690, 140), (560, 120)]
    for x, y in bolinhas:
        s += elipse(x, y, 11, 10, MI["luz"])
    return f'<g id="acess-lenco" data-pivo="665 110">{s}</g>'


def main():
    sombra = f'<g id="sombra"><ellipse cx="640" cy="{CHAO}" rx="290" ry="20" fill="{PAL["cenario"]["chao_terra"]["profunda"]}" opacity="0.4"/></g>'
    svg = ('<svg xmlns="http://www.w3.org/2000/svg" width="1254" height="1254" viewBox="0 0 1254 1254" fill="none">'
           '<!-- Dona Mandioca v4 · montagem simples · arte/folhas/dona_mandioca_simples.py -->'
           f'<g id="dona-mandioca" data-pivo="640 {CHAO}">{sombra}{perna("esq")}{perna("dir")}'
           f'<g id="tronco" data-pivo="655 1060">{corpo()}{avental()}{lenco()}{r3.rosto_svg()}'
           f'{r3.braco_svg("esq", 58, "colher")}{r3.braco_svg("dir", 24)}</g></g></svg>')
    banco = ARTE / "banco" / "dona-mandioca"
    out = banco / "dona-mandioca-v4.svg"
    out.write_text(svg, encoding="utf-8")
    vc = Path.home() / "AppData/Local/Programs/ArtCraft/VectorCraft/vectorcraft-cli.exe"
    subprocess.run([str(vc), "convert", str(out), str(out.with_suffix(".png")), "--scale", "0.6"], capture_output=True)
    print(out)


if __name__ == "__main__":
    main()
