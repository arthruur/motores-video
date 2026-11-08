"""Variações da Dona Mandioca v6 (expressões, bocas, poses) para a folha padrão e o motor.

    python arte/folhas/dona_mandioca_variacoes.py
    -> arte/banco/dona-mandioca/dm6-expr-<id>.svg, dm6-boca-<id>.svg, dm6-pose-<id>.svg, dm6-peca-*.svg

Parte de arte/banco/dona-mandioca/dona-mandioca-v6.svg (grupos corpo, avental, lenco, colher, bracos) e
só troca peças: o rosto (as 9 expressões do Mangaio, ARTE.md §6: mesmas formas de olho e boca, sem
sobrancelha) e o giro dos braços no ombro (a colher gira junto com o braço esquerdo).
Quadro das variações: 0 0 1254 1200 (pés na borda de baixo), sem a sombra no chão (a folha põe a dela).
"""
import copy
import re
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

AQUI = Path(__file__).resolve().parent
ARTE = AQUI.parent
sys.path.insert(0, str(AQUI))
import rosto_padrao as rp  # noqa: E402

NS = "http://www.w3.org/2000/svg"
ET.register_namespace("", NS)
BANCO = ARTE / "banco" / "dona-mandioca"
FONTE = BANCO / "dona-mandioca-v6.svg"
QUADRO = "0 0 1254 1200"
ESCURO = "#462416"

K = 1.2                                           # tamanho do rosto (olho da referência / olho do mascote)
OLHO = {"esq": (573.0, 440.0), "dir": (757.0, 418.0)}
BOCA = (670.0, 462.0)
INCL = -6.8                                       # o rosto sobe um pouco para a direita, como na referência
PIVO = {"esq": (500, 600), "dir": (872, 590)}     # ombros

# as 9 do Mangaio (cesto_folha.py), só adaptadas. braços: (giro do esquerdo, giro do direito) em graus;
# esquerdo: + sobe (gira no sentido horário); direito: - sobe/abre.
EXPRESSOES = [
    ("neutra", dict()),
    ("desconfiado", dict(olhos=("meia", "meia"), okw={"esq": {"dx": 9}, "dir": {"dx": 9}}, boca="torta", bkw={"dx": 10})),
    ("assustado", dict(okw={"esq": {"esc": 1.25}, "dir": {"esc": 1.25}}, boca="o", bracos=(25, -55))),
    ("triste", dict(olhos=("triste", "triste"), okw={"esq": {"dy": 6}, "dir": {"dy": 6}}, boca="triste", bkw={"dy": 6}, bracos=(-22, 12))),
    ("encantado", dict(okw={"esq": {"esc": 1.18}, "dir": {"esc": 1.18}}, boca="o_pequeno", rubor=True, bracos=(10, -25))),
    ("decidido", dict(olhos=("decidido", "decidido"), boca="firme", bracos=(0, -75))),
    ("rindo", dict(olhos=("arco", "arco"), bkw={"esc": 1.18, "dy": 4}, bracos=(10, -30))),
    ("envergonhado", dict(okw={"esq": {"esc": 0.85, "dy": 8, "dx": 4}, "dir": {"esc": 0.85, "dy": 8, "dx": -4}},
                          boca="ondulada", bkw={"dy": 4}, rubor=True, bracos=(-15, 10))),
    ("nao-vai", dict(olhos=("fechado", "fechado"), boca="reta", bracos=(0, -88))),
]
POSES = [
    ("bater-colher-antes", dict(olhos=("decidido", "decidido"), boca="firme", bracos=(55, 0))),
    ("bater-colher", dict(olhos=("fechado", "fechado"), bracos=(-35, 0))),
    ("apontar", dict(olhos=("decidido", "decidido"), boca="torta", bracos=(26, 0))),
    ("chamar", dict(olhos=("arco", "arco"), bracos=(0, -110))),
]
BOCAS_SINC = ["boca-repouso", "boca-MBP", "boca-A", "boca-E", "boca-I", "boca-O", "boca-U", "boca-FV"]


def g(tag="g", **kw):
    e = ET.Element(f"{{{NS}}}{tag}")
    for k, v in kw.items():
        e.set(k.replace("_", "-"), str(v))
    return e


def path(d, fill):
    return g("path", d=d, fill=fill)


def olho(lado, forma="oval", esc=1.0, dx=0.0, dy=0.0):
    tx, ty = OLHO[lado]
    tx, ty = tx + dx * K, ty + dy * K
    if forma == "oval":
        cx, cy = rp.OLHO[lado]
        e = g(id=f"olho-{lado}", transform=f"translate({tx} {ty}) scale({K * esc}) translate({-cx} {-cy})")
        e.append(path(rp.OLHO_OVAL[lado], ESCURO))
        return e
    esp = 1 if lado == "esq" else -1
    e = g(id=f"olho-{lado}", transform=f"translate({tx} {ty}) rotate({INCL}) scale({esp * K * 1.3 * esc} {K * 1.3 * esc})")
    e.append(path(rp.OLHOS[forma], ESCURO))
    return e


def boca(forma="aberta", esc=1.0, dx=0.0, dy=0.0):
    x, y = BOCA[0] + dx * K, BOCA[1] + dy * K
    if forma == "aberta":
        bx, by = rp.BOCA
        e = g(id="boca", transform=f"translate({x} {y}) scale({K * 1.05 * esc}) translate({-bx} {-by})")
        for d, c in rp.BOCA_ABERTA:
            e.append(path(d, c))
        return e
    lista = rp.BOCAS_SINC.get(forma) or rp.BOCAS[forma]
    e = g(id="boca", transform=f"translate({x} {y}) rotate({INCL}) scale({K * 1.7 * esc})")
    for d, c in lista:
        e.append(path(d, c))
    return e


def rosto(olhos=("oval", "oval"), okw=None, boca_f="aberta", bkw=None, rubor=False):
    okw, bkw = okw or {}, bkw or {}
    r = g(id="rosto")
    bo = g(id="bochechas", opacity="1" if rubor else "0.7")
    for (x, y) in ((528, 488), (810, 456)):
        bo.append(g("ellipse", cx=x, cy=y, rx=30, ry=19, fill="#F2683A" if rubor else "#E8573A"))
    r.append(bo)
    r.append(boca(boca_f, **bkw))
    for lado, f in zip(("esq", "dir"), olhos):
        r.append(olho(lado, f, **okw.get(lado, {})))
    return r


def montar(raiz, olhos=("oval", "oval"), okw=None, boca_f="aberta", bkw=None, rubor=False, bracos=(0, 0), sombra=False):
    dm = copy.deepcopy(raiz.find(f"{{{NS}}}g"))
    if not sombra:
        for e in list(dm):
            if e.get("id") == "sombra":
                dm.remove(e)
    corpo = next(e for e in dm if e.get("id") == "corpo")
    for e in list(corpo):
        if e.get("id") == "rosto":
            corpo.remove(e)
    corpo.append(rosto(olhos, okw, boca_f, bkw, rubor))
    colher = next(e for e in dm if e.get("id") == "colher")
    bracos_g = next(e for e in dm if e.get("id") == "bracos")
    be = next(e for e in bracos_g if e.get("id") == "braco-esq")
    bd = next(e for e in bracos_g if e.get("id") == "braco-dir")
    a, b = bracos
    if a:
        for e in (colher, be):
            e.set("transform", f"rotate({a} {PIVO['esq'][0]} {PIVO['esq'][1]})")
    if b:
        bd.set("transform", f"rotate({b} {PIVO['dir'][0]} {PIVO['dir'][1]})")
    return dm


def gravar(nome, conteudo, quadro=QUADRO):
    s = g("svg", viewBox=quadro, width=quadro.split()[2], height=quadro.split()[3], fill="none")
    s.append(conteudo)
    ET.ElementTree(s).write(BANCO / nome, encoding="unicode")


def main():
    raiz = ET.parse(FONTE).getroot()
    for nome, kw in EXPRESSOES + POSES:
        pref = "dm6-expr" if any(nome == e[0] for e in EXPRESSOES) else "dm6-pose"
        gravar(f"{pref}-{nome}.svg", montar(raiz, kw.get("olhos", ("oval", "oval")), kw.get("okw"), kw.get("boca", "aberta"),
                                              kw.get("bkw"), kw.get("rubor", False), kw.get("bracos", (0, 0))))
    # bocas de sincronia: close do rosto
    for b in BOCAS_SINC:
        gravar(f"dm6-{b}.svg", montar(raiz, boca_f=b), quadro="430 300 470 290")
    # peças soltas para a prancheta 6
    dm = raiz.find(f"{{{NS}}}g")
    for gid, quadro in (("colher", "210 320 240 520"),):
        e = next(x for x in dm if x.get("id") == gid)
        gravar(f"dm6-peca-{gid}.svg", copy.deepcopy(e), quadro)
    bracos_g = next(x for x in dm if x.get("id") == "bracos")
    for gid, quadro in (("braco-esq", "290 560 270 200"), ("braco-dir", "840 530 210 340")):
        e = next(x for x in bracos_g if x.get("id") == gid)
        gravar(f"dm6-peca-{gid}.svg", copy.deepcopy(e), quadro)
    print("ok:", len(EXPRESSOES), "expressões,", len(POSES), "poses,", len(BOCAS_SINC), "bocas")


if __name__ == "__main__":
    main()
