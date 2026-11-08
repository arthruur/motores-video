"""Dona Mandioca v6: vetoriza a versão no estilo do Mangaio (gerada no Gemini, 2026-11-08) e separa em grupos.

    python arte/folhas/dona_mandioca_v6.py
    -> arte/banco/dona-mandioca/dona-mandioca-v6.svg (+ .png)   e   arte/fonte/dona-mandioca-v6/<camada>.png|.svg

Fonte: arte/referencias/dona-mandioca/gemini-estilo-mangaio.jpg (já chapada, blocos de encaixe na casca).
Grupos (pedido do Arthur): corpo (com as pernas, numa peça só, e o rosto padrão), avental, lenco, colher,
bracos (braco-esq, braco-dir). Coordenadas: quadro 1254 x 1254 (as mesmas da referência original).
Cada camada: pixels levados ao tom mais próximo da rampa do material (paleta.json), manchinhas fundidas,
rastreada sozinha no VectorCraft (formas cheias, sem contorno).
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
import dona_mandioca_rig3 as r3  # noqa: E402  (rosto padrão posicionado, bordas interpoladas, vizinho)

FONTE = ARTE / "referencias" / "dona-mandioca" / "gemini-estilo-mangaio.jpg"
TRAB = ARTE / "fonte" / "dona-mandioca-v6"
VC = Path.home() / "AppData/Local/Programs/ArtCraft/VectorCraft/vectorcraft-cli.exe"
PAL = json.loads((ARTE / "paleta.json").read_text(encoding="utf-8"))
M = PAL["materiais"]
N = 1254
CHAO = 1196

RAMPAS = {
    "casca": [M["mandioca_casca"][t] for t in ("luz", "base", "meio", "sombra", "profunda")],
    "madeira": [PAL["cenario"]["madeira_banca"][t] for t in ("luz", "base", "meio", "sombra")] + [M["laranja"]["sombra"], M["mandioca_casca"]["luz"]],
    "lenco": [M["lenco_vermelho"][t] for t in ("luz", "base", "meio", "sombra", "profunda")],
    "bolinha": [M["mandioca_miolo"]["luz"], M["mandioca_miolo"]["base"]],
    "algodao": [M["algodao_cru"][t] for t in ("luz", "base", "meio", "sombra", "profunda")],
}
ESCURO, BOCA_IN, BOCHECHA = PAL["tinta"]["escuro"], PAL["tinta"]["boca_interior"], M["lenco_vermelho"]["luz"]


def h2rgb(h):
    h = h.lstrip("#")
    return np.array([int(h[i:i + 2], 16) for i in (0, 2, 4)], np.uint8)


def lab(a):
    a = np.asarray(a, np.uint8).reshape(-1, 1, 3)
    return cv2.cvtColor(a, cv2.COLOR_RGB2LAB).reshape(-1, 3).astype(np.float32)


def quantizar(img_lab, mask, rampa):
    """índice do tom mais próximo da rampa, só dentro da máscara (-1 fora)."""
    pal = lab([h2rgb(c) for c in rampa])
    out = np.full(mask.shape, -1, int)
    px = img_lab[mask]
    out[mask] = ((px[:, None, :] - pal[None]) ** 2).sum(2).argmin(1)
    return out


def votar(idx, mask, k, sigma=2.5):
    """funde manchinhas: cada pixel fica com o tom mais votado na vizinhança (só dentro da máscara)."""
    mapa = np.stack([cv2.GaussianBlur((idx == i).astype(np.float32), (0, 0), sigma) for i in range(k)])
    out = np.where(mask, mapa.argmax(0), -1)
    return out


def rastrear(nome, idx, mask, rampa):
    TRAB.mkdir(parents=True, exist_ok=True)
    rgba = np.zeros((N, N, 4), np.uint8)
    rgba[:, :, 1] = 255
    usadas = sorted(set(np.unique(idx[mask]).tolist()) - {-1})
    for i in usadas:
        sel = mask & (idx == i)
        rgba[sel, :3] = h2rgb(rampa[i]); rgba[sel, 3] = 255
    png, svg = TRAB / f"{nome}.png", TRAB / f"{nome}.svg"
    cv2.imwrite(str(png), cv2.cvtColor(rgba, cv2.COLOR_RGBA2BGRA))
    cmds = [{"command": "select.all"},
            {"command": "imageTrace.makeAndExpand", "params": {"params": {
                "mode": "color", "palette": "limited", "colors": len(usadas) + 1, "paths": 70, "corners": 60,
                "noise": 12, "method": "abutting", "ignoreWhite": False, "fills": True, "strokes": False}}},
            {"command": "file.saveAs", "params": {"path": str(svg)}}]
    cf = TRAB / "_cmds.json"
    cf.write_text(json.dumps(cmds), encoding="utf-8")
    subprocess.run([str(VC), "run", "--in", str(png), "--commands", str(cf)], check=True, capture_output=True)
    s = svg.read_text(encoding="utf-8")
    pal = [(rampa[i], h2rgb(rampa[i]).astype(int)) for i in usadas]
    out = []
    for m in re.finditer(r"<path\b[^>]*>", s):
        tag = m.group(0)
        d = re.search(r'\bd="([^"]+)"', tag); f = re.search(r'fill="(#[0-9a-fA-F]{6})"', tag)
        if not d or not f:
            continue
        c = h2rgb(f.group(1)).astype(int)
        if c[1] > 200 and c[0] < 80 and c[2] < 80:
            continue
        cor = min(pal, key=lambda p: int(((p[1] - c) ** 2).sum()))[0]
        out.append(f'<path d="{d.group(1)}" fill="{cor}"/>')
    print(f"{nome}: {len(out)} formas")
    return "".join(out)


def main():
    bgr = cv2.resize(cv2.imread(str(FONTE)), (N, N), interpolation=cv2.INTER_AREA)
    bgr = cv2.bilateralFilter(bgr, 7, 30, 7)                 # tira o ruído do JPEG sem borrar as bordas
    rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
    L = lab(rgb.reshape(-1, 3)).reshape(N, N, 3)
    yy, xx = np.mgrid[0:N, 0:N]

    # fundo (cor dos cantos, ligado à borda) + a sombra no chão (vai ser redesenhada)
    canto = np.median(np.vstack([rgb[:12, :12].reshape(-1, 3), rgb[:12, -12:].reshape(-1, 3)]), 0)
    dif = np.abs(rgb.astype(int) - canto).max(2)
    # barreira na borda direita/de baixo do avental: ali o creme encosta no fundo e é quase da mesma cor;
    # sem ela, a remoção do fundo "vaza" para dentro do avental
    barreira = np.zeros((N, N), np.uint8)
    cv2.polylines(barreira, [np.array([(474, 540), (545, 536), (700, 530), (862, 528), (864, 700), (905, 830),
                                       (935, 975), (928, 1008), (880, 1042), (760, 1066), (600, 1062), (500, 1040),
                                       (466, 960), (450, 800), (466, 640)], np.int32)], True, 1, 4)   # contorno fechado
    lab_f, _ = ndi.label((dif < 11) & (barreira == 0))   # estrito: o peitilho do avental é quase da cor do fundo
    borda = set(np.unique(np.concatenate([lab_f[0], lab_f[-1], lab_f[:, 0], lab_f[:, -1]]))) - {0}
    fundo = np.isin(lab_f, list(borda))
    sombra_cor = rgb[1200, 640].astype(int)                          # entre os pés: só sombra
    sombra = (yy > 1145) & (np.abs(rgb.astype(int) - sombra_cor).max(2) < 34)
    fg = ndi.binary_opening(~fundo & ~sombra, iterations=2)

    # famílias por cor (em Lab) + região
    Lc, a, b = L[:, :, 0] * 100 / 255, L[:, :, 1] - 128, L[:, :, 2] - 128
    vermelho = (a > 38) & (Lc < 70)
    creme = (Lc > 72) & (a < 22)
    escuro = Lc < 26
    cab = yy < 455
    rosto_reg = (yy > 380) & (yy < 530) & (xx > 480) & (xx < 860)
    colher_reg = ((xx < 395) & (yy > 320) & (yy < 560)) | ((xx < 440) & (yy >= 560) & (yy < 830))
    punho_e = (xx - 365) ** 2 + (yy - 665) ** 2 < 66 ** 2
    braco_e = punho_e | ((xx > 395) & (xx < 530) & (yy > 575) & (yy < 735) & ((xx - 395) * 0.75 + (yy - 735) < 40))
    braco_d = (xx > 858) & (yy > 545) & (yy < 860)
    avental_reg = (yy > 540) & (yy < 1070) & (xx > 355) & (xx < 945)

    # peitilho do avental: creme quase igual ao fundo, preso entre o corpo e as alças; entra à força
    peitilho = (yy > 548) & (yy < 748) & (xx > 470) & (xx < 860) & (Lc > 76) & (a < 16)
    peitilho = ndi.binary_fill_holes(ndi.binary_closing(peitilho, iterations=4)) & (yy > 548) & (yy < 748) & (xx > 470) & (xx < 860)
    fg = fg | peitilho
    creme = creme | peitilho
    # lenço: só os vermelhos da cabeça; furos pequenos (as bolinhas) preenchidos, furos grandes (a cabeça) não
    lenco_v = ndi.binary_closing(fg & cab & vermelho, iterations=2)
    furos = ndi.binary_fill_holes(lenco_v) & ~lenco_v
    lab_h, nh = ndi.label(furos)
    if nh:
        tam = ndi.sum(np.ones_like(lab_h), lab_h, index=np.arange(1, nh + 1))
        furos = np.isin(lab_h, np.nonzero(tam < 1500)[0] + 1)
    lenco = ndi.binary_opening(lenco_v | furos, iterations=1)
    lab_l, nl = ndi.label(lenco)                       # só as partes grandes (some o vermelho da boca/bochecha)
    if nl:
        tam = ndi.sum(np.ones_like(lab_l), lab_l, index=np.arange(1, nl + 1))
        lenco = np.isin(lab_l, np.nonzero(tam > 3000)[0] + 1)
    # avental: o creme da região do avental, com os furos internos preenchidos (o creme claro é quase o fundo)
    avental = ndi.binary_closing(fg & avental_reg & creme, iterations=6)              # creme nunca é braço
    avental = ndi.binary_fill_holes(avental) & avental_reg
    avental = ndi.binary_opening(avental, iterations=3)
    # colher: só a madeira clara (o braço é marrom mais escuro); a bola do braço fica inteira
    punho_e = (xx - 365) ** 2 + (yy - 665) ** 2 < 74 ** 2
    madeira = (Lc > 47) & (b > 30)
    colher = ndi.binary_opening(fg & colher_reg & ~punho_e & madeira & ~creme, iterations=2)
    # braço esquerdo: a bola + o trecho até o ombro (por baixo da alça do avental)
    sup_e = np.zeros_like(fg)
    cv2.fillPoly(sup_e.view(np.uint8), [np.array([(398, 612), (470, 572), (545, 588), (548, 650), (478, 724), (408, 724)], np.int32)], 1)
    braco_e = punho_e | (sup_e.astype(bool) & ~creme & ~madeira)     # o trecho até o ombro, qualquer tom de casca
    bracos = fg & (braco_e | braco_d) & ~avental & ~colher & ~creme
    bracos = ndi.binary_opening(bracos, iterations=2)
    corpo_px = fg & ~lenco & ~colher & ~avental & ~bracos

    # corpo inteiro: cabeça até a borda de dentro do lenço; continua por baixo de TODO o avental
    laco = avental & (xx < 470)
    sil = (fg & ~lenco & ~bracos & ~colher & ~laco) | (avental & ~laco)
    sil = ndi.binary_opening(sil, iterations=3)
    sil = r3.bordas_interpoladas(sil, 520, 800, ref=sil)
    sil = ndi.binary_fill_holes(ndi.binary_closing(sil, iterations=4)) & ~laco
    # o pedaço do corpo debaixo do lenço (a cabeça continua por baixo dele, para o lenço poder balançar)
    cabeca = ndi.binary_fill_holes(ndi.binary_closing(sil | lenco, iterations=8)) & ~ndi.binary_dilation(lenco & ~ndi.binary_erosion(lenco, iterations=18), iterations=0)
    sil = sil | (cabeca & (yy > 200) & ndi.binary_erosion(lenco | sil, iterations=22))
    sil = ndi.binary_opening(sil, iterations=2)
    lab_s, ns_ = ndi.label(sil)                         # só a peça maior (some com as sujeirinhas soltas)
    if ns_ > 1:
        tam = ndi.sum(np.ones_like(lab_s), lab_s, index=np.arange(1, ns_ + 1))
        sil = lab_s == (int(np.argmax(tam)) + 1)
    # tons do corpo: casca; onde não é casca (rosto, avental, lenço, braços), herda a casca vizinha
    # o rosto da imagem sai do corpo com folga (olhos, boca, bochechas, risquinho do queixo): o rosto padrão vai por cima
    tracos = rosto_reg & (escuro | (a > 24) | (Lc < 40))
    tracos = ndi.binary_dilation(tracos, iterations=9)
    casca_ok = corpo_px & sil & ~tracos
    idx_c = quantizar(L, casca_ok, RAMPAS["casca"])
    idx_c = r3.preencher_vizinho(idx_c, sil & ~casca_ok, casca_ok)
    idx_c = votar(idx_c, sil, len(RAMPAS["casca"]))

    # lenço: vermelhos + bolinhas
    idx_l = quantizar(L, lenco & ~creme, RAMPAS["lenco"])
    idx_l = r3.preencher_vizinho(idx_l, lenco & creme, lenco & ~creme)
    idx_l = votar(idx_l, lenco, len(RAMPAS["lenco"]), 2.0)
    bolinhas = ndi.binary_opening(lenco & creme, iterations=2)
    idx_b = np.where(bolinhas, 0, -1)

    idx_a = votar(quantizar(L, avental, RAMPAS["algodao"]), avental, len(RAMPAS["algodao"]))
    idx_s = votar(quantizar(L, colher, RAMPAS["madeira"]), colher, len(RAMPAS["madeira"]), 2.0)
    br_e, br_d = bracos & (xx < 640), bracos & (xx >= 640)
    idx_be = votar(quantizar(L, br_e, RAMPAS["casca"]), br_e, 5, 2.0)
    idx_bd = votar(quantizar(L, br_d, RAMPAS["casca"]), br_d, 5, 2.0)

    corpo_svg = rastrear("corpo", idx_c, sil, RAMPAS["casca"])
    lenco_svg = rastrear("lenco", idx_l, lenco, RAMPAS["lenco"]) + rastrear("lenco-bolinhas", idx_b, bolinhas, RAMPAS["bolinha"])
    avental_svg = rastrear("avental", idx_a, avental, RAMPAS["algodao"])
    colher_svg = rastrear("colher", idx_s, colher, RAMPAS["madeira"])
    be_svg = rastrear("braco-esq", idx_be, br_e, RAMPAS["casca"])
    bd_svg = rastrear("braco-dir", idx_bd, br_d, RAMPAS["casca"])

    chao = f'<ellipse cx="632" cy="{CHAO}" rx="300" ry="22" fill="{PAL["cenario"]["chao_terra"]["profunda"]}" opacity="0.4"/>'
    svg = ('<svg xmlns="http://www.w3.org/2000/svg" width="1254" height="1254" viewBox="0 0 1254 1254" fill="none">'
           '<!-- Dona Mandioca v6 · vetorizada da versão no estilo do Mangaio (referencias/dona-mandioca/gemini-estilo-mangaio.jpg) '
           'por arte/folhas/dona_mandioca_v6.py · grupos: sombra, corpo (pernas + rosto), avental, lenco, colher, bracos -->'
           f'<g id="dona-mandioca" data-pivo="632 {CHAO}"><g id="sombra">{chao}</g>'
           f'<g id="corpo" data-pivo="655 1060">{corpo_svg}{r3.rosto_svg()}</g>'
           f'<g id="avental">{avental_svg}</g>'
           f'<g id="lenco" data-pivo="660 115">{lenco_svg}</g>'
           f'<g id="colher" data-pivo="365 665">{colher_svg}</g>'
           f'<g id="bracos"><g id="braco-esq" data-pivo="500 600">{be_svg}</g>'
           f'<g id="braco-dir" data-pivo="872 590">{bd_svg}</g></g>'
           '</g></svg>')
    out = ARTE / "banco" / "dona-mandioca" / "dona-mandioca-v6.svg"
    out.write_text(svg, encoding="utf-8")
    subprocess.run([str(VC), "convert", str(out), str(out.with_suffix(".png")), "--scale", "0.6"], capture_output=True)
    print(out)


if __name__ == "__main__":
    main()
