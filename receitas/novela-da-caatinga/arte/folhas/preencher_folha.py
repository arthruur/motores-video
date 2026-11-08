"""Preenche a folha padrão (folha_padrao.py) de um personagem, ao vivo no VectorCraft (--control 7979).

    python arte/folhas/preencher_folha.py mangaio [--salvar arte/fonte/mangaio-folha.vectorcraft]

Monta o molde com o nome do personagem e coloca cada SVG do banco na sua célula, com os pés na linha
de chão e a MESMA escala dentro de cada prancheta. Célula sem arte aprovada recebe a nota "pendente".
Os SVGs vêm de arte/banco/<id>/ (gerados pelos scripts de cada personagem).
"""
import argparse
import json
import re
import sys
from pathlib import Path

AQUI = Path(__file__).resolve().parent
ARTE = AQUI.parent
sys.path.insert(0, str(AQUI))
import folha_padrao as fp  # noqa: E402
import rosto_padrao as rp  # noqa: E402

PAL = json.loads((ARTE / "paleta.json").read_text(encoding="utf-8"))
TMP = ARTE / "banco" / "_tmp" / "pecas"
SOMBRA = PAL["cenario"]["chao_terra"]["profunda"]


def tops():
    out, y = [], 0
    for _, alt, _ in fp.PRANCHETAS:
        out.append(y)
        y += alt + fp.VAO
    return out


def celulas(n, w, h, top, y0=230):
    gap = (fp.L - 2 * fp.M - n * w) / max(n - 1, 1)
    return [(fp.M + i * (w + gap), top + y0, w, h) for i in range(n)]


def viewbox(svg):
    m = re.search(r'viewBox="([-\d. ]+)"', svg.read_text(encoding="utf-8")[:2000])
    x, y, w, h = map(float, m.group(1).split())
    return w, h


# ------------------------------------------------------------------ personagens
PERSONAGENS = {
    "mangaio": dict(
        nome="MANGAIO",
        banco=ARTE / "banco" / "cesto",
        ficha="altura: 1,0 cesto (é a unidade) · forma dominante: círculo, trapézio arredondado + arco da alça · "
              "rampas: palha_cesto, folha, tomate, laranja · nunca: fala, ganha pernas, fica bravo de verdade",
        corpo_unid=372.0,           # altura do corpo (fundo à borda, sem alça e frutas) em unidades do SVG
        frente="cesto-expr-neutra.svg",
        vistas=["cesto-expr-neutra.svg", "cesto-tres-quartos.svg", None, None],
        pendente_vistas="aguarda a versão do outro PC (alça)",
        rotulo_vistas={"3/4": "3/4 (rascunho: alça a revisar)"},
        expressoes=["neutra", "desconfiado", "assustado", "triste", "encantado", "decidido", "rindo", "envergonhado", "nao-vai"],
        expr_arq="cesto-expr-{}.svg",
        bocas_nota="o Mangaio não fala: aqui entram os gestos do trompete (a definir)",
        repertorio=[("cesto-pose-antecipacao.svg", None), ("cesto-pose-no-ar.svg", -60), ("cesto-pose-pouso.svg", None),
                    ("cesto-pose-apontar.svg", None), ("cesto-pose-danca.svg", None), None],
        repertorio_rotulos=["antecipação (quique)", "no ar (quique)", "pouso (quique)", "apontar", "dança", "carregar_tudo"],
        pendente_repertorio="aguarda a versão do outro PC (conteúdo)",
        rampas=["palha_cesto", "folha", "tomate", "laranja"],
        bracos_svg=ARTE.parent / "mascote.svg",
        bracos=[("braco-esq", "0 430 125 160"), ("braco-dir", "420 422 120 164")],
        bracos_novos=["alto", "aponta", "segura", "punho"],
    ),
}


def pecas_svgs():
    """SVGs pequenos de cada forma de olho e de boca do rosto padrão (para a prancheta 6)."""
    TMP.mkdir(parents=True, exist_ok=True)
    esc = "#462416"
    out = {"olhos": [], "bocas": []}
    def grava(nome, corpo, vb):
        p = TMP / f"{nome}.svg"
        p.write_text(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vb}">{corpo}</svg>', encoding="utf-8")
        return p
    out["olhos"].append(("oval", grava("olho-oval", f'<path d="{rp.OLHO_OVAL["esq"]}" fill="{esc}"/>', "160 455 50 70")))
    for n, d in rp.OLHOS.items():
        out["olhos"].append((n, grava(f"olho-{n}", f'<path d="{d}" fill="{esc}"/>', "-26 -20 52 54")))
    corpo = "".join(f'<path d="{d}" fill="{c}"/>' for d, c in rp.BOCA_ABERTA)
    out["bocas"].append(("aberta", grava("boca-aberta", corpo, "228 480 100 64")))
    for n, lista in rp.BOCAS.items():
        corpo = "".join(f'<path d="{d}" fill="{c}"/>' for d, c in lista)
        out["bocas"].append((n, grava(f"boca-{n}", corpo, "-28 -20 56 42")))
    return out


def preencher(vc, cfg):
    T = tops()
    banco = cfg["banco"]

    def nota(x, y, w, h, txt):
        vc("select.none")
        vc("text.create", x=x + w / 2, y=y + (h - 90) / 2, text=txt, size=26, font=fp.FONTE, color=fp.GUIA, justify="center")

    def sombra(cx, chao, larg):
        vc("select.none"); vc("paint.setStroke", none=True); vc("paint.setFill", color=SOMBRA)
        r = vc("shape.ellipse", x=cx - larg / 2, y=chao - 12, width=larg, height=24)
        vc("object.setProps", id=r["id"], opacity=40)

    def por(arq, cx, chao, esc, sobe=0, com_sombra=True):
        p = banco / arq
        w, h = viewbox(p)
        if com_sombra:
            sombra(cx, chao, w * esc * 0.78)
        vc("select.none")
        r = vc("file.place", path=str(p), link=False, crop="crop",       # encaixa pelo quadro (viewBox), não pelo desenho
               rect=[cx - w * esc / 2, chao - h * esc + sobe, w * esc, h * esc])
        return r

    # 1 · Identidade
    t = T[0]
    x0, y0 = fp.M, t + 240
    por(cfg["frente"], x0 + 550, y0 + 1240 - 90, 1.6)
    sil = banco / "_silhueta.svg"
    txt = (banco / cfg["frente"]).read_text(encoding="utf-8")
    txt = re.sub(r'fill="#[0-9A-Fa-f]{6}"', 'fill="#462416"', txt)
    sil.write_text(txt, encoding="utf-8")
    por("_silhueta.svg", x0 + 1140 + 350, y0 + 1240 - 90, 1.0, com_sombra=False)
    ex = fp.M + 1880
    chao = t + 240 + 760
    esc = fp.CESTO / cfg["corpo_unid"]
    por(cfg["frente"], ex + 420, chao, esc)
    ry = t + 1100
    for r_, nome in enumerate(cfg["rampas"]):
        yy = ry + 30 + r_ * 100
        rampa = PAL["materiais"][nome]
        for k, tom in enumerate(fp.RAMPA):
            vc("select.none"); vc("paint.setStroke", none=True); vc("paint.setFill", color=rampa[tom])
            vc("shape.rectangle", x=ex + 200 + k * 130, y=yy, width=110, height=80, radius=10)
        vc("select.none")
        vc("text.create", x=ex + 870, y=yy + 55, text=nome, size=28, font=fp.FONTE, color=fp.ESCURO, justify="left")

    # 2 · Vistas (célula 800x640, escala 0.8)
    for velho, novo in cfg.get("rotulo_vistas", {}).items():
        ach = [m for m in vc("document.find", kind="Type", text=velho)["matches"] if m["name"] == velho]
        if ach:
            vc("text.setText", ids=[m["id"] for m in ach], text=novo)
    for (x, y, w, h), arq in zip(celulas(4, 800, 640, T[1]), cfg["vistas"]):
        if arq:
            por(arq, x + w / 2, y + h - 90, 0.8)
        else:
            nota(x, y, w, h, cfg["pendente_vistas"])

    # 3 · Expressões (célula 370x580, escala 0.6)
    for (x, y, w, h), e in zip(celulas(9, 370, 580, T[2]), cfg["expressoes"]):
        por(cfg["expr_arq"].format(e), x + w / 2, y + h - 90, 0.6)

    # 4 · Bocas
    cs = celulas(8, 400, 420, T[3])
    if cfg.get("bocas_nota"):
        x, y, w, h = cs[0]
        vc("select.none")
        vc("text.create", x=fp.L / 2, y=y + 180, text=cfg["bocas_nota"], size=34, font=fp.FONTE, color=fp.GUIA, justify="center")

    # 5 · Repertório (célula 540x680, escala 0.8) — os rótulos "pose N" do molde viram os nomes do personagem
    for i, n in enumerate(cfg.get("repertorio_rotulos", []), 1):
        ach = vc("document.find", kind="Type", text=f"pose {i}")["matches"]
        if ach:
            vc("text.setText", ids=[m["id"] for m in ach], text=n)
    for (x, y, w, h), item in zip(celulas(6, 540, 680, T[4]), cfg["repertorio"]):
        if item:
            arq, sobe = item
            por(arq, x + w / 2, y + h - 90, 0.8, sobe=sobe or 0)
        else:
            nota(x, y, w, h, cfg["pendente_repertorio"])

    # 6 · Peças do rig: olhos e bocas do rosto padrão + braços oficiais
    t6 = T[5]
    zw = (fp.L - 2 * fp.M - 3 * 40) / 4
    pc = pecas_svgs()
    for zona, k_esc in (("olhos", 1.6), ("bocas", 1.6)):
        zi = 0 if zona == "olhos" else 1
        zx = fp.M + zi * (zw + 40)
        for i, (n, p) in enumerate(pc[zona]):
            col, lin = i % 3, i // 3
            cx, cy = zx + 130 + col * 260, t6 + 470 + lin * 200
            w, h = viewbox(p)
            vc("select.none")
            vc("file.place", path=str(p), link=False, rect=[cx - w * k_esc / 2, cy - h * k_esc / 2, w * k_esc, h * k_esc])
            vc("select.none")
            vc("text.create", x=cx, y=cy + 80, text=n, size=24, font=fp.FONTE, color=fp.GUIA, justify="center")
    if cfg.get("bracos_svg"):
        import xml.etree.ElementTree as ET
        raiz = ET.parse(cfg["bracos_svg"]).getroot()
        itens = []
        for gid, bb in cfg["bracos"]:
            g = next(e for e in raiz.iter() if e.get("id") == gid)
            corpo = ET.tostring(g, encoding="unicode").replace(' xmlns:ns0="http://www.w3.org/2000/svg"', "").replace("ns0:", "")
            p = TMP / f"{gid}.svg"
            p.write_text(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{bb}">{corpo}</svg>', encoding="utf-8")
            itens.append((f"{gid} (oficial)", p))
        if cfg.get("bracos_novos"):
            import mangaio_bracos as mb
            for n in cfg["bracos_novos"]:
                p = TMP / f"braco-{n}.svg"
                p.write_text(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="-60 -170 230 230">'
                             f'{mb.peca_svg(n, "dir", x=0, y=0)}<circle r="6" fill="{fp.GUIA}"/></svg>', encoding="utf-8")
                itens.append((n, p))
        zx = fp.M + 2 * (zw + 40)
        for i, (rot_, p) in enumerate(itens):
            col, lin = i % 3, i // 3
            cx, cy = zx + 140 + col * 270, t6 + 560 + lin * 250
            w, h = viewbox(p)
            k = 160 / max(w, h)
            vc("select.none")
            vc("file.place", path=str(p), link=False, rect=[cx - w * k / 2, cy - h * k / 2, w * k, h * k])
            vc("select.none")
            vc("text.create", x=cx, y=cy + 110, text=rot_, size=22, font=fp.FONTE, color=fp.GUIA, justify="center")
    vc("select.none")
    vc("text.create", x=fp.M + 2 * (zw + 40) + 30, y=t6 + 420, text="braços: ponta só redonda, sem polegar · ● = pivô no ombro\n(o oficial gira até ~60°; acima disso, troca pela peça)",
       size=24, font=fp.FONTE, color=fp.ESCURO, justify="left")
    vc("select.none")
    vc("text.create", x=fp.M + 3 * (zw + 40) + 30, y=t6 + 420, text="frutas (tomate, laranja, folhas):\nestados do conteúdo — pendente (outro PC)",
       size=24, font=fp.FONTE, color=fp.GUIA, justify="left")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("id", choices=list(PERSONAGENS))
    ap.add_argument("--salvar")
    ap.add_argument("--porta", type=int, default=7979)
    a = ap.parse_args()
    cfg = PERSONAGENS[a.id]
    vc = fp.Vivo(a.porta)
    fp.montar(vc, cfg["nome"], ficha=cfg["ficha"], nome_doc=f"{a.id}-folha")
    preencher(vc, cfg)
    if a.salvar:
        print(vc("file.saveAs", path=str(Path(a.salvar).resolve())))


if __name__ == "__main__":
    main()
