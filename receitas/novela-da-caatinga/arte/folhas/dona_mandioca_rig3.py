"""Dona Mandioca v3, etapa 2: separa o vetor fiel (etapa 1) em peças de rig.

    python arte/folhas/dona_mandioca_rig3.py
    -> arte/fonte/dona-mandioca-v3/rig-frente.svg   (o rig, coordenadas da referência 1254 x 1254)
    -> arte/fonte/dona-mandioca-v3/camadas/*.png    (cada camada chapada, antes do rastreio)

Trabalha na imagem chapada da etapa 1 (limpo.png, só cores da paleta):
  - corpo: casca + miolo; onde estavam braços, colher e rosto, a casca é completada pela vizinha mais
    próxima, e as laterais do corpo seguem o contorno da referência (interpolado acima/abaixo dos braços);
  - pernas esq/dir: a parte de baixo, separada no vão e estendida para dentro do avental (o tronco pode subir);
  - avental e lenço: como estão na referência;
  - rosto: o padrão do Mangaio (rosto_padrao.py), na posição e no tamanho do rosto da referência;
  - braços: novos, retos, peça única com ponta redonda (dona_mandioca_rig.braco_formas); a colher na ponta.
Cada camada é rastreada sozinha no VectorCraft e vira um grupo com o id do rig (animacao.md §2).
"""
import json
import re
import subprocess
import sys
from pathlib import Path

import cv2
import numpy as np
from scipy import ndimage as ndi

AQUI = Path(__file__).resolve().parent
ARTE = AQUI.parent
sys.path.insert(0, str(AQUI))
import dona_mandioca_rig as dm  # noqa: E402  (tubo/volume/colher/braço)
import rosto_padrao as rp  # noqa: E402

V3 = ARTE / "fonte" / "dona-mandioca-v3"
CAM = V3 / "camadas"
VC = Path.home() / "AppData/Local/Programs/ArtCraft/VectorCraft/vectorcraft-cli.exe"
PAL = json.loads((ARTE / "paleta.json").read_text(encoding="utf-8"))
M = PAL["materiais"]
ESCURO = PAL["tinta"]["escuro"]

# ---- medidas da referência (px da imagem 1254 x 1254)
OMBRO = {"esq": (482.0, 600.0), "dir": (872.0, 590.0)}
OLHO_REF = {"esq": (573.0, 440.0), "dir": (757.0, 418.0)}
BOCA_REF = (670.0, 462.0)
BOCHECHA_REF = {"esq": (528.0, 488.0), "dir": (810.0, 456.0)}
VAO_X, AVENTAL_FIM = 655, 1065
CHAO = 1196


def hex2rgb(h):
    h = h.lstrip("#")
    return np.array([int(h[i:i + 2], 16) for i in (0, 2, 4)])


def familia_de(cor_hex):
    for fam in ("mandioca_casca", "mandioca_miolo", "lenco_vermelho", "algodao_cru"):
        for t, v in M[fam].items():
            if isinstance(v, str) and v.upper() == cor_hex.upper():
                return fam
    for t, v in PAL["cenario"]["madeira_banca"].items():
        if v.upper() == cor_hex.upper():
            return "madeira"
    return "tinta"


def carregar():
    im = cv2.cvtColor(cv2.imread(str(V3 / "limpo.png"), cv2.IMREAD_UNCHANGED), cv2.COLOR_BGRA2RGBA)
    rgb, alfa = im[:, :, :3], im[:, :, 3] > 0
    cores = {}
    cls = np.full(alfa.shape, -1, int)
    chave = rgb[:, :, 0].astype(int) * 65536 + rgb[:, :, 1].astype(int) * 256 + rgb[:, :, 2]
    for k in np.unique(chave[alfa]):
        hx = "#%06X" % k
        cores[len(cores)] = hx
        cls[(chave == k) & alfa] = len(cores) - 1
    fam = {i: familia_de(h) for i, h in cores.items()}
    return rgb, alfa, cls, cores, fam


def preencher_vizinho(cls, buraco, fonte):
    """pixels de `buraco` herdam a classe do pixel de `fonte` mais próximo."""
    _, (iy, ix) = ndi.distance_transform_edt(~fonte, return_indices=True)
    out = cls.copy()
    out[buraco] = cls[iy[buraco], ix[buraco]]
    return out


def bordas_interpoladas(mask, y0, y1, ref=None):
    """entre y0 e y1 o corpo é EXATAMENTE a faixa entre as bordas de cima e de baixo, ligadas em reta
    (tira os restos do braço antigo que ficavam grudados na lateral). `ref`: máscara de onde medir as bordas."""
    def borda(y):
        xs = np.nonzero(mask[y])[0]
        return (xs.min(), xs.max()) if len(xs) else None
    fonte_bordas = mask if ref is None else ref
    def borda_ref(y):
        xs = np.nonzero(fonte_bordas[y])[0]
        return (xs.min(), xs.max()) if len(xs) else None
    a, b = borda_ref(y0), borda_ref(y1)
    out = mask.copy()
    for y in range(y0, y1 + 1):
        u = (y - y0) / (y1 - y0)
        xl = int(a[0] + (b[0] - a[0]) * u)
        xr = int(a[1] + (b[1] - a[1]) * u)
        out[y, :] = False
        out[y, xl:xr + 1] = True
    return out


def rastrear(nome, cls, mascara, cores):
    """grava a camada como PNG chapado e rastreia no VectorCraft; devolve os <path> com cores travadas."""
    h, w = cls.shape
    rgba = np.zeros((h, w, 4), np.uint8)
    rgba[:, :, 1] = 255
    usadas = sorted(set(np.unique(cls[mascara]).tolist()) - {-1})
    for i in usadas:
        sel = mascara & (cls == i)
        rgba[sel, :3] = hex2rgb(cores[i]); rgba[sel, 3] = 255
    png = CAM / f"{nome}.png"
    cv2.imwrite(str(png), cv2.cvtColor(rgba, cv2.COLOR_RGBA2BGRA))
    svg = CAM / f"{nome}.svg"
    cmds = [{"command": "select.all"},
            {"command": "imageTrace.makeAndExpand", "params": {"params": {
                "mode": "color", "palette": "limited", "colors": len(usadas) + 1, "paths": 72, "corners": 55,
                "noise": 10, "method": "abutting", "ignoreWhite": False, "fills": True, "strokes": False}}},
            {"command": "file.saveAs", "params": {"path": str(svg)}}]
    cf = CAM / "_cmds.json"
    cf.write_text(json.dumps(cmds), encoding="utf-8")
    subprocess.run([str(VC), "run", "--in", str(png), "--commands", str(cf)], check=True, capture_output=True)
    s = svg.read_text(encoding="utf-8")
    pal = [(cores[i], hex2rgb(cores[i])) for i in usadas]
    paths = []
    for m in re.finditer(r'<path[^>]*?d="([^"]+)"[^>]*?fill="(#[0-9a-fA-F]{6})"[^>]*/>|<path[^>]*?fill="(#[0-9a-fA-F]{6})"[^>]*?d="([^"]+)"[^>]*/>', s):
        d, f = (m.group(1), m.group(2)) if m.group(1) else (m.group(4), m.group(3))
        c = hex2rgb(f)
        if c[1] > 200 and c[0] < 80 and c[2] < 80:
            continue
        cor = min(pal, key=lambda p: int(((p[1] - c) ** 2).sum()))[0]
        paths.append(f'<path d="{d}" fill="{cor}"/>')
    # o rastreio sai na escala da imagem (1 px = 1 unidade) se a prancheta for a da imagem
    return "".join(paths)


def rosto_svg():
    """rosto padrão do Mangaio na posição e no tamanho do rosto da referência."""
    k = 1.2                        # olho da referência ~72 px de alto / 60 do mascote
    partes = ['<g id="rosto" data-pivo="%.0f %.0f">' % ((OLHO_REF["esq"][0] + OLHO_REF["dir"][0]) / 2, BOCA_REF[1])]
    partes.append('<g id="bochechas" opacity="0.7">')
    for lado, (x, y) in BOCHECHA_REF.items():
        partes.append(f'<ellipse cx="{x}" cy="{y}" rx="30" ry="19" fill="{M["lenco_vermelho"]["luz"]}"/>')
    partes.append("</g>")
    for lado in ("esq", "dir"):
        cx, cy = rp.OLHO[lado]
        tx, ty = OLHO_REF[lado]
        partes.append(f'<g id="olho-{lado}" data-pivo="{tx} {ty}"><g id="olho-{lado}-oval" '
                      f'transform="translate({tx} {ty}) scale({k}) translate({-cx} {-cy})">'
                      f'<path d="{rp.OLHO_OVAL[lado]}" fill="{ESCURO}"/></g></g>')
    bx, by = rp.BOCA
    corpo = "".join(f'<path d="{d}" fill="{c}"/>' for d, c in rp.BOCA_ABERTA)
    partes.append(f'<g id="boca" data-pivo="{BOCA_REF[0]} {BOCA_REF[1]}"><g id="boca-aberta" '
                  f'transform="translate({BOCA_REF[0]} {BOCA_REF[1]}) scale({k * 1.05}) translate({-bx} {-by})">{corpo}</g></g>')
    partes.append("</g>")
    return "".join(partes)


def braco_svg(lado, ang, prop=None, ang_prop=-8):
    """braço reto de peça única (tubo com ponta redonda), girando no ombro; colher presa na ponta."""
    ox, oy = OMBRO[lado]
    sent = -1 if lado == "esq" else 1
    formas, (hx, hy), _ = dm.braco_formas(dm.curva_reto(sent), 3 if lado == "esq" else 7)
    tostr = lambda e: dm.ET.tostring(e, encoding="unicode").replace("ns0:", "").replace(' xmlns:ns0="http://www.w3.org/2000/svg"', "")
    corpo = ""
    if prop == "colher":
        c = dm.colher()
        corpo += f'<g id="prop-colher" data-pivo="{hx:.1f} {hy:.1f}" transform="translate({hx:.1f} {hy:.1f}) rotate({ang_prop + ang * sent:.1f})">{tostr(c)}</g>'
    corpo += "".join(tostr(e) for e in formas)
    return (f'<g id="braco-{lado}" data-pivo="{ox} {oy}" data-sentido="{sent}" transform="translate({ox} {oy})">'
            f'<g class="giro" transform="rotate({-ang * sent:.1f})">{corpo}</g></g>')


def main():
    CAM.mkdir(parents=True, exist_ok=True)
    rgb, alfa, cls, cores, fam = carregar()
    h, w = cls.shape
    fam_px = np.vectorize(lambda i: fam.get(i, "fundo"))(cls)
    yy, xx = np.mgrid[0:h, 0:w]

    casca_miolo = np.isin(fam_px, ["mandioca_casca", "mandioca_miolo"])
    lenco = (fam_px == "lenco_vermelho")
    lenco = ndi.binary_fill_holes(lenco) & (yy < 420)          # bolinhas entram no lenço
    avental = (fam_px == "algodao_cru")
    rosto_px = np.isin(fam_px, ["tinta"]) | ((fam_px == "lenco_vermelho") & (yy > 420))  # olhos, boca, sobrancelhas, bochechas

    # braços e colher da referência (o que não é avental, fora do corpo)
    braco_e = (xx < 505) & (yy > 320) & (yy < 845) & ~avental      # largo: leva a sombra do braço junto
    braco_d = (xx > 858) & (yy > 545) & (yy < 835) & ~avental
    fora = braco_e | braco_d

    # silhueta do corpo: tudo que não é fundo, menos braços/colher; lenço e avental contam (o corpo passa por baixo)
    corpo_sil = alfa & ~fora
    corpo_sil = ndi.binary_opening(corpo_sil, iterations=3)
    # laterais onde estavam os braços: bordas medidas sem o laço do avental, de y=535 (acima) a y=980 (abaixo)
    ref_bordas = corpo_sil & ~(avental & (xx < 470))
    corpo_sil = bordas_interpoladas(corpo_sil, 535, 980, ref=ref_bordas)
    corpo_sil = ndi.binary_fill_holes(corpo_sil)
    # o laço do avental e as pontas do lenço saem da silhueta do corpo
    corpo_sil &= ~(avental & (xx < 470)) & ~(lenco & (yy < 200))

    # classes do corpo: onde não é casca/miolo (braço, rosto, avental, lenço, fundo), herda da casca mais próxima
    fonte = casca_miolo & corpo_sil & ~rosto_px & ~fora
    cls_corpo = preencher_vizinho(cls, corpo_sil & ~fonte, fonte)

    tronco = corpo_sil & (yy < AVENTAL_FIM + 10)
    pernas = corpo_sil & (yy >= AVENTAL_FIM - 70)
    perna_e = pernas & (xx < VAO_X)
    perna_d = pernas & (xx >= VAO_X)

    camadas = {
        "corpo": (cls_corpo, tronco),
        "perna-esq": (cls_corpo, perna_e),
        "perna-dir": (cls_corpo, perna_d),
        "acess-avental": (cls, avental),
        "acess-lenco": (cls, lenco),
    }
    svg = {}
    for nome, (c, m) in camadas.items():
        svg[nome] = rastrear(nome, c, m, cores)
        print(nome, svg[nome].count("<path"), "formas")

    sombra = f'<g id="sombra"><ellipse cx="632" cy="{CHAO}" rx="270" ry="20" fill="{PAL["cenario"]["chao_terra"]["profunda"]}" opacity="0.4"/></g>'
    rig = (
        f'<svg xmlns="http://www.w3.org/2000/svg" width="1254" height="1254" viewBox="0 0 1254 1254" fill="none">'
        f'<!-- Dona Mandioca v3 · rig de frente · gerado por arte/folhas/dona_mandioca_rig3.py a partir da referência.\n'
        f'  ids: dona-mandioca > sombra, perna-esq, perna-dir, tronco > [corpo, acess-avental, acess-lenco, rosto > (bochechas,\n'
        f'  olho-esq, olho-dir, boca), braco-esq (prop-colher), braco-dir]. Pivô: data-pivo="x y" no grupo. -->'
        f'<g id="dona-mandioca" data-pivo="632 {CHAO}">{sombra}'
        f'<g id="perna-esq" data-pivo="540 {AVENTAL_FIM}">{svg["perna-esq"]}</g>'
        f'<g id="perna-dir" data-pivo="770 {AVENTAL_FIM}">{svg["perna-dir"]}</g>'
        f'<g id="tronco" data-pivo="{VAO_X} {AVENTAL_FIM}">'
        f'<g id="corpo">{svg["corpo"]}</g>'
        f'<g id="acess-avental">{svg["acess-avental"]}</g>'
        f'<g id="acess-lenco">{svg["acess-lenco"]}</g>'
        f'{rosto_svg()}'
        f'{braco_svg("esq", 58, "colher")}{braco_svg("dir", 24)}'
        f'</g></g></svg>')
    out = V3 / "rig-frente.svg"
    out.write_text(rig, encoding="utf-8")
    print(out)


if __name__ == "__main__":
    main()
