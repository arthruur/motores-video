"""Prepara os recortes dos potes (adesivo de papel) e a textura de grão dos promos.

    python receitas/promo/preparar.py

- recortes/<foto>.png: pote sem fundo (rembg), com borda branca de papel e sombra leve.
- marca/grao.png: ruído para dar textura de papel impresso.
"""
from pathlib import Path

from PIL import Image, ImageFilter
import numpy as np

AQUI = Path(__file__).parent
FOTOS = AQUI.parent / "motion" / "fotos"
POTES = ["6904", "6903", "6905", "6906", "6908", "6911", "6913"]  # fotos herói de cada pote


def recortar(foto: str, sessao) -> None:
    from rembg import remove
    im = Image.open(FOTOS / f"{foto}.jpg").convert("RGB")
    m = remove(im, session=sessao, only_mask=True).point(lambda v: 255 if v > 128 else 0)
    # fica só a maior mancha (o pote), sem pedaços soltos do pano
    from scipy import ndimage
    lab, n = ndimage.label(np.array(m) > 0)
    if n > 1:
        maior = 1 + int(np.argmax(ndimage.sum(np.ones_like(lab), lab, range(1, n + 1))))
        m = Image.fromarray(((lab == maior) * 255).astype("uint8"))
    m = m.filter(ImageFilter.GaussianBlur(1.2))
    x0, y0, x1, y1 = m.getbbox()
    pad = 60
    caixa = (max(0, x0 - pad), max(0, y0 - pad), min(im.width, x1 + pad), min(im.height, y1 + pad))
    im, m = im.crop(caixa), m.crop(caixa)
    esc = 1000 / im.height
    im, m = im.resize((round(im.width * esc), 1000), Image.LANCZOS), m.resize((round(m.width * esc), 1000), Image.LANCZOS)
    # borda de papel: máscara dilatada, levemente irregular (recorte de tesoura)
    borda = m.filter(ImageFilter.MaxFilter(29)).filter(ImageFilter.GaussianBlur(1.5)).point(lambda v: 255 if v > 100 else 0)
    papel = Image.new("RGBA", im.size, (255, 253, 240, 0))
    papel.putalpha(borda)
    pote = im.convert("RGBA")
    pote.putalpha(m)
    papel.alpha_composite(pote)
    papel.save(AQUI / "recortes" / f"{foto}.png", optimize=True)
    print(foto, papel.size)


def grao() -> None:
    rng = np.random.default_rng(153)
    r = rng.normal(128, 38, (720, 720)).clip(0, 255).astype("uint8")
    Image.fromarray(r, "L").filter(ImageFilter.GaussianBlur(0.6)).save(AQUI / "marca" / "grao.png")


if __name__ == "__main__":
    (AQUI / "recortes").mkdir(exist_ok=True)
    grao()
    from rembg import new_session
    s = new_session("isnet-general-use")
    for f in POTES:
        recortar(f, s)
