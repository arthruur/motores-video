"""Prepara os recortes dos produtos (adesivo de papel) e as texturas do unboxing.

    python receitas/unboxing/preparar.py "C:/caminho/da/pasta/com/as/fotos"

- recortes/<produto>.png: produto sem fundo (rembg), com borda branca de papel recortado.
- texturas/onca.jpg: pele de onça com pelo, gerada (semente fixa, sem foto de terceiros).
- texturas/papel.jpg e vinho.jpg: papel creme do fundo e papel vinho dos pedaços rasgados.
- texturas/grao.png: ruído para dar textura de papel impresso.

As fotos de entrada são prints do celular (fundo branco, barra de status no topo).
O nome de cada arquivo vem de FOTOS: mudou a foto, muda aqui.
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

AQUI = Path(__file__).parent
FOTOS = {  # final do nome do arquivo → produto
    "00.59.32": "creme",
    "00.59.34": "rimel",
    "00.59.35": "tonico",
    "00.59.36": "blush",
    "00.59.37": "lapis",
    "00.59.39": "primer",
    "00.59.41": "gloss",
    "00.59.42": "contorno",
    "00.59.43": "po",
    "00.59.45": "corretivo",
}


def recortar(origem: Path, nome: str, sessao) -> None:
    from rembg import remove
    from scipy import ndimage
    im = Image.open(origem).convert("RGB")
    # tira a barra de status e o botão de fechar do print
    im = im.crop((0, int(im.height * 0.14), im.width, im.height))
    m = remove(im, session=sessao, only_mask=True).point(lambda v: 255 if v > 128 else 0)
    # fica só o que é grande (produto e tampa, que às vezes estão separados)
    lab, n = ndimage.label(np.array(m) > 0)
    if n > 1:
        tam = ndimage.sum(np.ones_like(lab), lab, range(1, n + 1))
        manter = [i + 1 for i, s in enumerate(tam) if s > tam.max() * 0.04]
        m = Image.fromarray((np.isin(lab, manter) * 255).astype("uint8"))
    m = m.filter(ImageFilter.GaussianBlur(1.0))
    x0, y0, x1, y1 = m.getbbox()
    pad = 40
    caixa = (max(0, x0 - pad), max(0, y0 - pad), min(im.width, x1 + pad), min(im.height, y1 + pad))
    im, m = im.crop(caixa), m.crop(caixa)
    esc = 900 / max(im.size)
    tam = (round(im.width * esc), round(im.height * esc))
    im, m = im.resize(tam, Image.LANCZOS), m.resize(tam, Image.LANCZOS)
    # borda de papel: máscara dilatada e serrilhada, como recorte de tesoura
    borda = m.filter(ImageFilter.MaxFilter(25)).filter(ImageFilter.GaussianBlur(2.5)).point(lambda v: 255 if v > 90 else 0)
    papel = Image.new("RGBA", im.size, (255, 252, 244, 0))
    papel.putalpha(borda)
    prod = im.convert("RGBA")
    prod.putalpha(m)
    papel.alpha_composite(prod)
    papel.save(AQUI / "recortes" / f"{nome}.png", optimize=True)
    print(nome, papel.size)


def campo(rng, g: int, L: int) -> np.ndarray:
    """Ruído suave entre -1 e 1 (grade g×g ampliada)."""
    c = rng.normal(0, 1, (g, g))
    c = np.asarray(Image.fromarray(((c - c.min()) / np.ptp(c) * 255).astype("uint8")).resize((L, L), Image.BICUBIC), float)
    return (c / 255 - 0.5) * 2


def onca(arq: str, semente: int, lado: int = 1600) -> None:
    """Pele de onça com pelo: rosetas (anel quebrado de 3 a 5 manchas, miolo mais escuro que o fundo)
    desenhadas como mapa, depois pintadas com pelos que seguem um campo de direção."""
    rng = np.random.default_rng(semente)
    esc = 2  # o mapa é desenhado grande e reduzido, para a borda sair macia
    L = lado * esc
    fundo, miolo, mancha = 0, 128, 255  # o mapa guarda só "onde é o quê"; a cor vem na pelagem
    img = Image.new("L", (L, L), fundo)
    d = ImageDraw.Draw(img)
    # pontos espalhados por rejeição (distância mínima), com borda de volta (repete sem emenda)
    pts, dmin = [], 108 * esc
    for _ in range(9000):
        p = rng.uniform(0, L, 2)
        if all(np.hypot(*(((p - q) + L / 2) % L - L / 2)) > dmin for q in pts):
            pts.append(p)

    def bolha(x, y, rx, ry, rot, n=22, ru=0.22):
        """Polígono de borda irregular (raio com ruído suave)."""
        fase_ = rng.uniform(0, 6.3, 3)
        pol = []
        for s in np.linspace(0, 2 * np.pi, n, endpoint=False):
            w = 1 + ru * (0.5 * np.sin(2 * s + fase_[0]) + 0.3 * np.sin(3 * s + fase_[1]) + 0.2 * np.sin(5 * s + fase_[2]))
            px, py = np.cos(s) * rx * w, np.sin(s) * ry * w
            pol.append((x + px * np.cos(rot) - py * np.sin(rot), y + px * np.sin(rot) + py * np.cos(rot)))
        return pol

    def arco(x, y, R, e, a0, a1, achata, rot):
        """Mancha em forma de C: faixa curva de espessura variável, pontas afinando."""
        ss = np.linspace(a0, a1, 16)
        prof = np.sin(np.linspace(0, np.pi, 16)) ** 0.6 * e * rng.uniform(0.8, 1.2, 16)
        fora = [(R + w / 2, s) for s, w in zip(ss, prof)]
        dentro = [(R - w / 2, s) for s, w in zip(ss[::-1], prof[::-1])]
        pol = []
        for rr, s in fora + dentro:
            px, py = np.cos(s) * rr, np.sin(s) * rr * achata
            pol.append((x + px * np.cos(rot) - py * np.sin(rot), y + px * np.sin(rot) + py * np.cos(rot)))
        return pol

    for cx, cy in pts:
        R = rng.uniform(30, 52) * esc
        rot, achata = rng.uniform(0, 2 * np.pi), rng.uniform(0.7, 0.95)
        k = int(rng.integers(3, 6))
        cortes = np.sort(rng.uniform(0, 2 * np.pi, k))
        solta = rng.random() < 0.18  # algumas são manchas cheias, sem miolo
        for ox in (-L, 0, L):
            for oy in (-L, 0, L):
                x, y = cx + ox, cy + oy
                if not (-R * 2 < x < L + R * 2 and -R * 2 < y < L + R * 2):
                    continue
                if solta:
                    d.polygon(bolha(x, y, R * 0.5, R * 0.38, rot, ru=0.35), fill=mancha)
                    continue
                d.polygon(bolha(x, y, R * 0.78, R * 0.78 * achata, rot, ru=0.2), fill=miolo)
                for j in range(k):
                    a0 = cortes[j] + rng.uniform(0.08, 0.22)
                    a1 = (cortes[(j + 1) % k] + (2 * np.pi if j == k - 1 else 0)) - rng.uniform(0.08, 0.22)
                    if a1 - a0 > 0.4:
                        d.polygon(arco(x, y, R, R * rng.uniform(0.5, 0.75), a0, a1, achata, rot), fill=mancha)
        # pintinhas soltas entre as rosetas
        for _ in range(int(rng.integers(0, 3))):
            px, py = (cx + rng.uniform(-90, 90) * esc) % L, (cy + rng.uniform(-90, 90) * esc) % L
            rr = rng.uniform(5, 12) * esc
            d.polygon(bolha(px, py, rr, rr * 0.75, rng.uniform(0, 3), n=12, ru=0.3), fill=mancha)
    # distorção suave (domain warp) para as formas não parecerem desenhadas com compasso
    arr = np.asarray(img)
    dx, dy = campo(rng, 14, L) * 18 * esc, campo(rng, 14, L) * 18 * esc
    yy, xx = np.mgrid[0:L, 0:L]
    arr = arr[((yy + dy).astype(int)) % L, ((xx + dx).astype(int)) % L]
    mapa = np.asarray(Image.fromarray(arr).filter(ImageFilter.GaussianBlur(1.5 * esc)).resize((lado, lado), Image.LANCZOS), float) / 255
    pelagem(mapa, rng).save(AQUI / "texturas" / arq, quality=92)
    print(arq)


def pelagem(mapa: np.ndarray, rng) -> Image.Image:
    """Pinta o mapa (0 fundo, .5 miolo, 1 mancha) como pelo curto: direção que varia devagar,
    borda das manchas desfiada no sentido do pelo e fios (convolução ao longo das linhas do campo)."""
    L = mapa.shape[0]
    yy, xx = np.mgrid[0:L, 0:L].astype(float)
    ang = np.deg2rad(70) + campo(rng, 5, L) * 0.7 + campo(rng, 18, L) * 0.25
    ux, uy = np.cos(ang), np.sin(ang)
    pega = lambda a, ox, oy: a[(yy + oy).astype(int) % L, (xx + ox).astype(int) % L]
    # borda desfiada: cada ponto lê o mapa um pouco adiante ou atrás no sentido do pelo
    off = rng.normal(0, 1, (L, L)) * 6
    m = pega(mapa, ux * off, uy * off)
    m = sum(pega(m, ux * k, uy * k) for k in range(-3, 4)) / 7
    # fios: ruído branco somado ao longo da direção (LIC simplificada)
    w = rng.normal(0, 1, (L, L))
    fios = sum(pega(w, ux * k, uy * k) for k in range(-9, 10)) / np.sqrt(19)
    fino = sum(pega(w, ux * k + 0.5, uy * k) for k in range(-4, 5)) / 3
    cor = lambda h: np.array([int(h[i:i + 2], 16) for i in (1, 3, 5)], float)
    tom = (campo(rng, 7, L) + 1) / 2
    fundo = cor("#c98b46")[None, None] * (1 - tom[..., None]) + cor("#e3b878")[None, None] * tom[..., None]
    miolo, mancha = cor("#a2622a"), cor("#2b1a10")
    a = np.clip(m * 2, 0, 1)[..., None]
    b = np.clip(m * 2 - 1, 0, 1)[..., None]
    rgb = fundo * (1 - a) + miolo * a
    rgb = rgb * (1 - b) + mancha * b
    luz = 1 + 0.13 * fios[..., None] + 0.05 * fino[..., None]
    luz += 0.07 * np.clip(fios - 1.4, 0, None)[..., None]          # fios mais claros soltos
    luz *= 1 + 0.06 * campo(rng, 4, L)[..., None]                    # volume, como pele de verdade
    return Image.fromarray(np.clip(rgb * luz, 0, 255).astype("uint8")).filter(ImageFilter.GaussianBlur(0.45))


def papel(arq: str, base: str, semente: int, w: int = 1080, h: int = 1920, fibras: int = 900) -> None:
    """Papel com manchas suaves e fibras finas (o creme do fundo e o vinho dos pedaços rasgados)."""
    rng = np.random.default_rng(semente)
    c = np.array([int(base[i:i + 2], 16) for i in (1, 3, 5)], float)
    L = max(w, h)
    mancha = campo(rng, 9, L)[:h, :w] * 0.035 + campo(rng, 40, L)[:h, :w] * 0.02
    img = Image.fromarray(np.clip(c[None, None] * (1 + mancha[..., None]), 0, 255).astype("uint8"))
    d = ImageDraw.Draw(img, "RGBA")
    for _ in range(fibras):
        x, y = rng.uniform(0, w), rng.uniform(0, h)
        a, n = rng.uniform(0, 2 * np.pi), rng.uniform(8, 34)
        claro = rng.random() < 0.5
        tinta = (255, 255, 255, 40) if claro else (int(c[0] * .7), int(c[1] * .7), int(c[2] * .7), 34)
        pts = [(x, y)]
        for _ in range(4):
            a += rng.normal(0, 0.5)
            x, y = x + np.cos(a) * n / 4, y + np.sin(a) * n / 4
            pts.append((x, y))
        d.line(pts, fill=tinta, width=1)
    img.filter(ImageFilter.GaussianBlur(0.4)).save(AQUI / "texturas" / arq, quality=90)
    print(arq)


def grao() -> None:
    rng = np.random.default_rng(25)
    r = rng.normal(128, 38, (720, 720)).clip(0, 255).astype("uint8")
    Image.fromarray(r, "L").filter(ImageFilter.GaussianBlur(0.6)).save(AQUI / "texturas" / "grao.png")


if __name__ == "__main__":
    (AQUI / "recortes").mkdir(exist_ok=True)
    (AQUI / "texturas").mkdir(exist_ok=True)
    grao()
    onca("onca.jpg", 7)
    papel("papel.jpg", "#f6efe3", 3)
    papel("vinho.jpg", "#8f1129", 5, fibras=1400)
    if len(sys.argv) > 1:
        from rembg import new_session
        s = new_session("isnet-general-use")
        pasta = Path(sys.argv[1])
        for fim, nome in FOTOS.items():
            arq = next(pasta.glob(f"*{fim}*"))
            recortar(arq, nome, s)
