"""Dona Mandioca v3, etapa 1: vetor FIEL da referência (a imagem inteira, como ela é), limpo.

    python arte/folhas/dona_mandioca_vetor.py
    -> arte/fonte/dona-mandioca-v3/limpo.png      (chapado nas cores da paleta, sem granulado nem letreiro)
    -> arte/fonte/dona-mandioca-v3/frente-fiel.svg (rastreado no VectorCraft, cores travadas na paleta)

O que faz:
  1. tira o fundo de papel (cor dos cantos, conectado à borda);
  2. tira o granulado (bilateral + mean shift), sem borrar as quinas;
  3. leva cada pixel ao tom mais próximo das rampas da paleta (em Lab), por família de material;
  4. apaga o letreiro "FARINHA" do bolso (ARTE.md: nada de texto no figurino);
  5. funde manchinhas (voto da vizinhança) e some com ilhas pequenas;
  6. rastreia no VectorCraft (formas cheias, sem contorno) e trava cada fill no tom da paleta.
A etapa 2 (separar em peças do rig, braços retos sem mão, rosto padrão) parte deste vetor.
"""
import json
import re
import subprocess
from pathlib import Path

import cv2
import numpy as np
from scipy import ndimage as ndi

AQUI = Path(__file__).resolve().parent
ARTE = AQUI.parent
REF = ARTE / "referencias" / "dona-mandioca-frente.png"
OUT = ARTE / "fonte" / "dona-mandioca-v3"
VC = Path.home() / "AppData/Local/Programs/ArtCraft/VectorCraft/vectorcraft-cli.exe"
PAL = json.loads((ARTE / "paleta.json").read_text(encoding="utf-8"))
M = PAL["materiais"]

# cores permitidas (família, nome, hex). A ordem só importa para desempate.
CORES = []
for fam, tons in (("mandioca_casca", ["luz", "base", "meio", "sombra", "profunda"]),   # poucos tons por material
                  ("mandioca_miolo", ["luz", "base"]),
                  ("lenco_vermelho", ["base", "sombra", "profunda"]),
                  ("algodao_cru", ["luz", "base", "sombra"])):
    for t in tons:
        CORES.append((fam, t, M[fam][t]))
for t in ("luz", "base", "sombra"):
    CORES.append(("madeira_banca", t, PAL["cenario"]["madeira_banca"][t]))
CORES.append(("bochecha", "luz", M["lenco_vermelho"]["luz"]))
CORES.append(("tinta", "escuro", PAL["tinta"]["escuro"]))
CORES.append(("tinta", "boca_interior", PAL["tinta"]["boca_interior"]))


def hex2rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def lab(rgb_arr):
    a = np.asarray(rgb_arr, np.uint8).reshape(-1, 1, 3)
    return cv2.cvtColor(a, cv2.COLOR_RGB2LAB).reshape(-1, 3).astype(np.float32)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    bgr = cv2.imread(str(REF))
    rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
    h, w = rgb.shape[:2]

    # 1. fundo: parecido com os cantos e ligado à borda
    cantos = np.vstack([rgb[:10, :10].reshape(-1, 3), rgb[:10, -10:].reshape(-1, 3), rgb[-10:, :10].reshape(-1, 3)])
    fundo_rgb = np.median(cantos, axis=0)
    dif = np.abs(rgb.astype(int) - fundo_rgb).max(axis=2)
    cand, n = ndi.label(dif < 22)
    borda = set(np.unique(np.concatenate([cand[0], cand[-1], cand[:, 0], cand[:, -1]]))) - {0}
    fundo = np.isin(cand, list(borda))
    # a sombra de contato no chão (bege um pouco mais escuro) também é fundo
    sombra_chao = (dif < 60) & (np.arange(h)[:, None] > h * 0.88)
    fundo |= sombra_chao
    fundo = ndi.binary_opening(fundo, iterations=2)

    # 2. granulado
    liso = bgr.copy()
    for _ in range(3):
        liso = cv2.bilateralFilter(liso, 9, 40, 9)
    liso = cv2.pyrMeanShiftFiltering(liso, 10, 22)
    liso = cv2.cvtColor(liso, cv2.COLOR_BGR2RGB)

    # 3. tom mais próximo da paleta (Lab)
    pal_lab = lab([hex2rgb(c[2]) for c in CORES])
    px_lab = lab(liso.reshape(-1, 3))
    d = ((px_lab[:, None, :] - pal_lab[None, :, :]) ** 2).sum(axis=2).reshape(h, w, -1)
    # cada material só vale na região onde ele existe na referência (nada de lenço no corpo)
    yy, xx = np.mgrid[0:h, 0:w] / np.array([h, w])[:, None, None]
    regiao = {
        "lenco_vermelho": yy < 0.33,
        "madeira_banca": (xx < 0.40) & (yy > 0.25) & (yy < 0.68),
        "bochecha": (yy > 0.25) & (yy < 0.42) & (xx > 0.30) & (xx < 0.72),
        "tinta": (yy > 0.24) & (yy < 0.42) & (xx > 0.30) & (xx < 0.72),
    }
    for i, (fam, t, _) in enumerate(CORES):
        if fam in regiao:
            d[:, :, i][~regiao[fam]] += 1e6
        if (fam, t) == ("mandioca_miolo", "luz"):     # bolinhas do lenço também são miolo.luz: deixa
            pass
    idx = d.argmin(axis=2)
    d = d.reshape(h * w, -1)

    # 4. letreiro FARINHA: no bolso, tudo que não é algodão vira algodão (o tom mais próximo de algodão)
    bolso = np.zeros((h, w), bool)
    bolso[int(h * 0.68):int(h * 0.79), int(w * 0.46):int(w * 0.73)] = True
    alg = [i for i, c in enumerate(CORES) if c[0] == "algodao_cru"]
    nao_alg = bolso & ~np.isin(idx, alg)
    if nao_alg.any():
        pass
    # o bolso inteiro num tom só (o do contorno do bolso, por maioria): o carimbo some de vez
    dentro = bolso & np.isin(idx, alg) | nao_alg
    if dentro.any():
        vals, cont = np.unique(idx[bolso & np.isin(idx, alg)], return_counts=True)
        idx[dentro] = vals[cont.argmax()]
        # e o tom do bolso fica uniforme (o carimbo some de vez): voto largo só dentro do bolso
    # 5. manchinhas: voto da vizinhança (one-hot borrado + argmax), duas passadas
    def votar(idx, sigma):
        k = len(CORES)
        mapa = np.zeros((k, h, w), np.float32)
        for i in range(k):
            m = (idx == i).astype(np.float32)
            if m.any():
                mapa[i] = cv2.GaussianBlur(m, (0, 0), sigma)
        return mapa.argmax(axis=0)
    idx = votar(idx, 3.2)
    idx_b = votar(idx, 7.0)
    idx[bolso] = idx_b[bolso]
    # ilhas pequenas: herdam a cor da vizinhança
    for _ in range(2):
        for i in range(len(CORES)):
            lab_i, n = ndi.label(idx == i)
            if not n:
                continue
            tam = ndi.sum(np.ones_like(lab_i), lab_i, index=np.arange(1, n + 1))
            peq = np.isin(lab_i, np.nonzero(tam < 260)[0] + 1)
            if peq.any():
                viz = votar(np.where(peq, -1, idx), 3.0)
                idx[peq] = viz[peq]

    # imagem chapada
    cores_rgb = np.array([hex2rgb(c[2]) for c in CORES], np.uint8)
    chapado = cores_rgb[idx]
    alfa = (~fundo).astype(np.uint8) * 255
    alfa = cv2.medianBlur(alfa, 5)
    rgba = np.dstack([chapado, alfa])
    rgba[alfa == 0] = (0, 255, 0, 0)
    limpo = OUT / "limpo.png"
    cv2.imwrite(str(limpo), cv2.cvtColor(rgba, cv2.COLOR_RGBA2BGRA))
    usadas = sorted(set(np.unique(idx[alfa > 0]).tolist()))
    print("cores usadas:", len(usadas), [f"{CORES[i][0]}.{CORES[i][1]}" for i in usadas])

    # 6. rastreio no VectorCraft
    svg = OUT / "frente-fiel.svg"
    cmds = [{"command": "select.all"},
            {"command": "imageTrace.makeAndExpand", "params": {"params": {
                "mode": "color", "palette": "limited", "colors": len(usadas) + 1, "paths": 72, "corners": 55,
                "noise": 10, "method": "abutting", "ignoreWhite": False, "fills": True, "strokes": False}}},
            {"command": "file.saveAs", "params": {"path": str(svg)}}]
    cf = OUT / "_trace.json"
    cf.write_text(json.dumps(cmds), encoding="utf-8")
    subprocess.run([str(VC), "run", "--in", str(limpo), "--commands", str(cf)], check=True, capture_output=True)

    # trava cada fill no tom da paleta mais próximo; tira o verde do fundo
    s = svg.read_text(encoding="utf-8")
    pal_usadas = [(CORES[i][2], hex2rgb(CORES[i][2])) for i in usadas]
    def trava(m):
        c = hex2rgb(m.group(1))
        if c[1] > 200 and c[0] < 80 and c[2] < 80:
            return 'fill="none"'
        melhor = min(pal_usadas, key=lambda p: sum((a - b) ** 2 for a, b in zip(p[1], c)))
        return f'fill="{melhor[0]}"'
    s = re.sub(r'fill="(#[0-9a-fA-F]{6})"', trava, s)
    s = re.sub(r'<path[^>]*fill="none"[^>]*/>', "", s)
    svg.write_text(s, encoding="utf-8")
    print(svg, f"{s.count('<path')} formas")


if __name__ == "__main__":
    main()
