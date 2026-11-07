"""Folha do Cesto (model sheet v0), derivada do mascote.svg oficial.

O Cesto é design travado: este script NÃO redesenha nada. Ele só recombina as
peças do mascote.svg (olhos, boca, braços, frutas) em vistas, expressões,
estados de conteúdo e poses de quique. Peças novas (formas de olho e boca,
fundo do cesto vazio) usam só cores da paleta.json.

Saídas (rodar da pasta da série):
  python arte/folhas/cesto_folha.py
  -> arte/folhas/cesto-folha.svg            (as 4 pranchas numa folha só)
  -> arte/banco/cesto/cesto-<variante>.svg  (cada variação, avulsa, 534x627)
Depois o VectorCraft vira isso em .vectorcraft editável e PNG (ver README).
"""
import copy
import math
import re
from pathlib import Path
import xml.etree.ElementTree as ET

AQUI = Path(__file__).resolve().parent
SERIE = AQUI.parent.parent
NS = "http://www.w3.org/2000/svg"
ET.register_namespace("", NS)
T = lambda tag: f"{{{NS}}}{tag}"

ESCURO, BOCA_IN = "#462416", "#C5441E"
PALHA = dict(luz="#F5B058", base="#E99C46", meio="#D27C32", sombra="#C06726", profunda="#AF561E")
LARANJA = ["#FB991D", "#F5831B", "#E06F14", "#C45C10", "#9E4A10"]
TOMATE = ["#F2683A", "#EB4B20", "#D23E1A", "#B0331A", "#8A2716"]
FOLHA = ["#669630", "#50812F", "#3F6925", "#2B5627", "#1F4020"]
CHAO_PROF = "#7A532E"
PAPEL, TINTA_GUIA = "#F7E8C6", "#C9946A"

W, H = 534, 627                      # mascote.svg
OLHO = {"esq": (185.0, 490.0), "dir": (364.0, 477.0)}   # centros medidos
INCL = -4.0                          # o rosto sobe para a direita (graus)
BOCA = (277.0, 512.0)
PIVO = {"esq": (97.0, 451.0), "dir": (448.0, 444.0)}    # como no cena.js (80%/20% 10%)


# ---------------------------------------------------------------- peças base
def carregar():
    raiz = ET.parse(SERIE / "mascote.svg").getroot()
    m = raiz.find(T("g"))
    pecas = {g.get("id"): g for g in m}
    return m, pecas


def por_id(no, id_):
    for e in no.iter():
        if e.get("id") == id_:
            return e
    raise KeyError(id_)


def path(d, fill, **kw):
    e = ET.Element(T("path"), d=d, fill=fill)
    for k, v in kw.items():
        e.set(k.replace("_", "-"), str(v))
    return e


def grupo(id_=None, transform=None, *filhos):
    g = ET.Element(T("g"))
    if id_:
        g.set("id", id_)
    if transform:
        g.set("transform", transform)
    for f in filhos:
        g.append(f)
    return g


# ---------------------------------------------------------------- olhos
# Formas em coordenadas locais (centro 0,0; olho padrão ~42x60), lado "esq".
# Para o lado "dir" a forma é espelhada (o canto de dentro fica do outro lado).
OLHOS = {
    # olho fechado feliz, arco ^
    "arco": "M-22 9C-21-15 21-15 22 9C22 15 14 16 13 10C10-4-10-4-13 10C-14 16-22 15-22 9Z",
    # pálpebra reta por cima: desconfiado (metade de baixo do oval)
    "meia": "M-21-3C-8-6 8-7 21-6C23 13 13 30 0 30C-13 30-23 15-21-3Z",
    # pálpebra caída para fora: triste (canto de dentro alto)
    "triste": "M-21 5C-6-2 8-9 20-15C25 3 15 30 0 30C-14 30-23 18-21 5Z",
    # pálpebra caída para dentro: decidido (canto de dentro baixo)
    "decidido": "M-20-15C-8-9 6-2 21 4C23 18 13 30 0 30C-14 30-24 10-20-15Z",
    # linha fechada, apertada ("não vai")
    "fechado": "M-21 0C-9 6 9 6 21 0C23 5 22 11 19 11C9 15-9 15-19 11C-22 11-23 5-21 0Z",
}


def olho(lado, forma, escala=1.0, dx=0.0, dy=0.0, original=None):
    cx, cy = OLHO[lado]
    if forma == "oval":
        e = copy.deepcopy(original)
        e.attrib.pop("id", None)
        e.set("fill", ESCURO)
        t = f"translate({cx+dx:.1f} {cy+dy:.1f}) scale({escala}) translate({-cx} {-cy})"
        return grupo(f"olho-{lado}", t, e)
    espelho = 1 if lado == "esq" else -1
    t = f"translate({cx+dx:.1f} {cy+dy:.1f}) rotate({INCL}) scale({espelho*escala*1.3} {escala*1.3})"
    return grupo(f"olho-{lado}", t, path(OLHOS[forma], ESCURO))


# ---------------------------------------------------------------- bocas
# Coordenadas locais, centro da boca padrão (277,512). Cheias, sem contorno.
BOCAS = {
    "sorriso_fechado": [("M-24-6C-12 7 12 7 24-6C26-2 24 3 21 5C9 15-9 15-21 5C-24 3-26-2-24-6Z", ESCURO)],
    "firme": [("M-18-2C-6 3 8 1 20-5C22-1 21 4 18 5C6 10-6 10-18 6C-21 5-21 0-18-2Z", ESCURO)],
    "triste": [("M-17 8C-10-6 10-6 17 8C18 12 14 13 12 11C6 3-6 3-12 11C-14 13-18 12-17 8Z", ESCURO)],
    "o": [("M0-15C11-15 15-6 15 3C15 12 9 18 0 18C-9 18-15 12-15 3C-15-6-11-15 0-15Z", ESCURO),
          ("M0 4C7 4 11 8 10 12C8 16 4 18 0 18C-4 18-8 16-10 12C-11 8-7 4 0 4Z", BOCA_IN)],
    "o_pequeno": [("M0-9C7-9 9-4 9 2C9 8 5 11 0 11C-5 11-9 8-9 2C-9-4-7-9 0-9Z", ESCURO)],
    "torta": [("M-14 2C-4 0 6-2 16-7C18-3 17 1 14 2C4 6-5 7-13 7C-17 7-17 3-14 2Z", ESCURO)],
    "ondulada": [("M-14 2C-9-3-5-3 0 2C5-3 9-3 14 2C15 5 13 7 11 6C8 3 5 3 2 6C0 8-2 8-4 6C-6 3-9 3-11 6C-13 7-15 5-14 2Z", ESCURO)],
    "reta": [("M-16-1C-5 1 6 1 17-1C19 2 18 6 16 6C6 8-6 8-16 6C-19 6-19 1-16-1Z", ESCURO)],
}


def boca(forma, original, escala=1.0, dx=0.0, dy=0.0):
    cx, cy = BOCA
    if forma == "aberta":
        g = copy.deepcopy(original)
        g.set("transform", f"translate({cx+dx} {cy+dy}) scale({escala}) translate({-cx} {-cy})")
        return g
    g = grupo("boca", f"translate({cx+dx} {cy+dy}) rotate({INCL}) scale({escala*1.7})")
    for d, cor in BOCAS[forma]:
        g.append(path(d, cor))
    return g


def bochechas():
    g = grupo("bochechas")
    for (cx, cy) in ((OLHO["esq"][0] - 4, OLHO["esq"][1] + 44), (OLHO["dir"][0] + 4, OLHO["dir"][1] + 44)):
        g.append(path(f"M{cx-17} {cy}C{cx-17} {cy-8} {cx-8} {cy-11} {cx} {cy-11}C{cx+10} {cy-11} {cx+18} {cy-7} {cx+18} {cy}"
                      f"C{cx+18} {cy+7} {cx+9} {cy+10} {cx} {cy+10}C{cx-9} {cy+10} {cx-17} {cy+7} {cx-17} {cy}Z",
                      TOMATE[0], opacity="0.55"))
    return g


# ---------------------------------------------------------------- montagem
def interior():
    """Fundo do cesto à mostra (vazio/pouco): boca por dentro + borda de trás.
    Vai ATRÁS do corpo, que cobre a metade de baixo com a borda da frente."""
    return grupo("interior", None,
        path("M14 330C6 262 170 214 298 210C428 206 528 224 518 276C470 334 120 352 14 330Z", PALHA["profunda"]),
        path("M14 330C6 262 170 214 298 210C428 206 528 224 518 276C512 262 430 236 300 238C176 240 40 276 22 318Z", PALHA["meio"]),
        path("M40 300C120 266 230 254 300 252C380 250 460 258 500 272C470 262 380 246 300 250C220 252 110 268 40 300Z", PALHA["sombra"]),
    )


def recolor(no, mapa):
    for e in no.iter():
        f = (e.get("fill") or "").upper()
        if f in mapa:
            e.set("fill", mapa[f])


def cesto(pecas, *, olhos=("oval", "oval"), olho_kw=None, boca_forma="aberta", boca_kw=None,
          braco=(0, 0), conteudo="cheio", rubor=False, sem_rosto=False):
    """Um Cesto completo (grupo), nas coordenadas do mascote.svg."""
    olho_kw = olho_kw or {}
    boca_kw = boca_kw or {}
    g = grupo("cesto")
    frutas = copy.deepcopy(pecas["frutas"])

    if conteudo in ("vazio", "pouco"):
        g.append(interior())
    if conteudo == "pouco":
        murcha = copy.deepcopy(por_id(frutas, "laranja"))
        murcha.attrib.pop("id")
        recolor(murcha, {LARANJA[0]: LARANJA[2], LARANJA[1]: LARANJA[3], "#F3AD56": LARANJA[1]})
        g.append(grupo("fruta-murcha", "translate(240 318) rotate(18) scale(0.7) translate(-197 -283)", murcha))

    g.append(copy.deepcopy(pecas["corpo"]))

    if not sem_rosto:
        r = grupo("rosto")
        if rubor:
            r.append(bochechas())
        ob = por_id(pecas["rosto"], "boca")
        r.append(boca(boca_forma, ob, **boca_kw))
        for lado, forma in zip(("esq", "dir"), olhos):
            r.append(olho(lado, forma, original=por_id(pecas["rosto"], f"olho-{lado}"), **olho_kw.get(lado, {})))
        g.append(r)

    g.append(copy.deepcopy(pecas["alca"]))

    if conteudo == "transbordando":
        lar = copy.deepcopy(por_id(frutas, "laranja")); lar.attrib.pop("id")
        tom = copy.deepcopy(por_id(frutas, "tomate")); tom.attrib.pop("id")
        g.append(grupo("extra-tomate", "translate(170 150) rotate(-14) scale(0.85) translate(-380 -257)", tom))
        g.append(grupo("extra-laranja", "translate(330 130) rotate(10) scale(0.9) translate(-197 -283)", lar))
        lar2 = copy.deepcopy(lar)
        g.append(grupo("extra-laranja-2", "translate(250 70) rotate(-6) scale(0.7) translate(-197 -283)", lar2))
    if conteudo in ("cheio", "transbordando"):
        g.append(frutas)

    # braços por último: levantados, passam na frente das frutas
    for lado, ang in zip(("esq", "dir"), braco):
        b = copy.deepcopy(pecas[f"braco-{lado}"])
        if ang:
            px, py = PIVO[lado]
            b.set("transform", f"rotate({ang if lado == 'esq' else -ang} {px} {py})")
        g.append(b)
    return g


def silhueta(g):
    s = copy.deepcopy(g)
    for e in s.iter():
        if e.get("fill"):
            e.set("fill", ESCURO)
        e.attrib.pop("opacity", None)
    return s


def sombra_chao(cx, y, larg):
    return path(f"M{cx-larg} {y}C{cx-larg} {y-14} {cx+larg} {y-14} {cx+larg} {y}C{cx+larg} {y+14} {cx-larg} {y+14} {cx-larg} {y}Z",
                CHAO_PROF, opacity="0.4")


# ---------------------------------------------------------------- catálogo
EXPRESSOES = [  # (id, rótulo, nome no motor, kwargs)
    ("neutra", "neutro (oficial)", "neutra", {}),
    ("desconfiado", "desconfiado", "olhos_semicerrados",
     dict(olhos=("meia", "meia"), olho_kw={"esq": {"dx": 9}, "dir": {"dx": 9}}, boca_forma="torta", boca_kw={"dx": 10}, braco=(0, 25))),
    ("assustado", "assustado", "olhos_arregalados",
     dict(olho_kw={"esq": {"escala": 1.25}, "dir": {"escala": 1.25}}, boca_forma="o", braco=(45, 45))),
    ("triste", "triste", "triste",
     dict(olhos=("triste", "triste"), olho_kw={"esq": {"dy": 6}, "dir": {"dy": 6}}, boca_forma="triste", boca_kw={"dy": 6}, braco=(-12, -12))),
    ("encantado", "encantado", "encantado",
     dict(olho_kw={"esq": {"escala": 1.18}, "dir": {"escala": 1.18}}, boca_forma="o_pequeno", braco=(20, 20), rubor=True)),
    ("decidido", "decidido", "sobrancelha_levantada",
     dict(olhos=("decidido", "decidido"), boca_forma="firme", braco=(0, 60))),
    ("rindo", "rindo", "empolgado",
     dict(olhos=("arco", "arco"), boca_kw={"escala": 1.18, "dy": 4}, braco=(40, 40))),
    ("envergonhado", "envergonhado", "sorriso",
     dict(olho_kw={"esq": {"escala": 0.85, "dy": 8, "dx": 4}, "dir": {"escala": 0.85, "dy": 8, "dx": -4}},
          boca_forma="ondulada", boca_kw={"dy": 4}, braco=(-28, -28), rubor=True)),
    ("nao-vai", "\"não vai\"", "brava (sem raiva)",
     dict(olhos=("fechado", "fechado"), boca_forma="reta", braco=(0, 55))),
]
CONTEUDOS = [("cheio", "cheio (padrão)"), ("pouco", "pouco (estiagem)"), ("vazio", "vazio (seca)"),
             ("transbordando", "transbordando (safra)")]


# ---------------------------------------------------------------- folha
CEL_W, CEL_H, ESC = 420, 520, 0.62
MARGEM, TOPO_SECAO = 60, 130


def rotulo(x, y, txt, tam=26, peso="normal", cor=ESCURO, anchor="middle"):
    t = ET.Element(T("text"), x=f"{x:.0f}", y=f"{y:.0f}", fill=cor)
    t.set("font-family", "Caveat Brush, Segoe Print, sans-serif")
    t.set("font-size", str(tam)); t.set("font-weight", peso); t.set("text-anchor", anchor)
    t.text = txt
    return t


def celula(pai, x, y, conteudo, legenda, *, transform_extra="", sombra=True, pendente=False):
    """Coloca um Cesto (coords do mascote) centrado na célula, pé na linha de chão."""
    chao = y + CEL_H - 70
    cx = x + CEL_W / 2
    if pendente:
        pai.append(path(f"M{x+30} {y+30}H{x+CEL_W-30}V{chao}H{x+30}Z", "none", stroke=TINTA_GUIA,
                        stroke_width=3, stroke_dasharray="14 10"))
        pai.append(rotulo(cx, y + CEL_H / 2 - 30, "a gerar no GPT", 28, cor=TINTA_GUIA))
        pai.append(rotulo(cx, y + CEL_H / 2 + 10, "e vetorizar", 28, cor=TINTA_GUIA))
    else:
        if sombra:
            pai.append(sombra_chao(cx, chao, W * ESC * 0.42))
        tf = f"translate({cx:.1f} {chao:.1f}) {transform_extra} scale({ESC}) translate({-W/2} {-H})"
        pai.append(grupo(None, tf, conteudo))
    pai.append(path(f"M{x+20} {chao}H{x+CEL_W-20}", "none", stroke=TINTA_GUIA, stroke_width=2))
    pai.append(rotulo(cx, chao + 48, legenda, 30))


def secao(pai, y, titulo, nota, itens):
    pai.append(rotulo(MARGEM, y + 50, titulo, 46, anchor="start"))
    pai.append(rotulo(MARGEM, y + 84, nota, 24, cor=TINTA_GUIA, anchor="start"))
    for i, it in enumerate(itens):
        celula(pai, MARGEM + i * CEL_W, y + TOPO_SECAO, *it[:2], **(it[2] if len(it) > 2 else {}))
    return y + TOPO_SECAO + CEL_H + 40


def main():
    m, pecas = carregar()
    banco = SERIE / "arte" / "banco" / "cesto"
    banco.mkdir(parents=True, exist_ok=True)

    def avulso(nome, g):
        s = ET.Element(T("svg"), width=str(W), height=str(H), viewBox=f"0 0 {W} {H}", fill="none")
        s.append(g)
        ET.ElementTree(s).write(banco / f"cesto-{nome}.svg", encoding="unicode")

    padrao = cesto(pecas)
    costas = grupo(None, f"translate({W} 0) scale(-1 1)", cesto(pecas, sem_rosto=True))

    secoes = []
    secoes.append(("Vistas", "frente = mascote.svg oficial · costas = rascunho espelhado, sem rosto · 3/4, perfil e de cima vêm do GPT", [
        (padrao, "frente"),
        (None, "3/4", {"pendente": True}),
        (None, "perfil", {"pendente": True}),
        (costas, "costas (rascunho)"),
        (None, "de cima", {"pendente": True}),
        (silhueta(padrao), "silhueta"),
    ]))
    exprs = []
    for id_, rot, motor, kw in EXPRESSOES:
        g = cesto(pecas, **kw)
        avulso(f"expr-{id_}", copy.deepcopy(g))
        extra = ""
        if id_ == "triste":
            extra = "scale(1.04 0.93)"
        elif id_ == "assustado":
            extra = "scale(0.96 1.05)"
        elif id_ == "nao-vai":
            extra = "rotate(4)"
        exprs.append((g, f"{rot}", {"transform_extra": extra}))
    secoes.append(("Expressões", "ele não fala: olhos + braços (+ boca de apoio) · cada uma é troca de peça, o corpo não muda", exprs))
    conts = []
    for id_, rot in CONTEUDOS:
        g = cesto(pecas, conteudo=id_, **({"olhos": ("triste", "triste"), "boca_forma": "triste", "braco": (-12, -12)} if id_ == "vazio" else {}))
        avulso(f"conteudo-{id_}", copy.deepcopy(g))
        conts.append((g, rot))
    secoes.append(("Conteúdo", "o que vai dentro conta a temporada · entrega e palha do licuri ficam para a v1", conts))
    quique = [
        (cesto(pecas, braco=(-10, -10), olhos=("meia", "meia")), "antecipação", {"transform_extra": "scale(1.14 0.84)"}),
        (cesto(pecas, braco=(50, 50), olho_kw={"esq": {"escala": 1.1}, "dir": {"escala": 1.1}}), "no ar", {"transform_extra": "translate(0 -40) scale(0.9 1.1)"}),
        (cesto(pecas, braco=(30, 30), olhos=("arco", "arco")), "pouso", {"transform_extra": "scale(1.16 0.82)"}),
        (cesto(pecas, conteudo="transbordando", braco=(-15, -15)), "carregar_tudo", {"transform_extra": "scale(1.08 0.9)"}),
    ]
    secoes.append(("Quique", "ele quica, não anda · squash no chão, stretch no ar · cheio quica baixo, vazio quica alto", quique))

    larg = MARGEM * 2 + CEL_W * max(len(s[2]) for s in secoes)
    alt_secao = TOPO_SECAO + CEL_H + 40
    alt = 150 + alt_secao * len(secoes) + 40
    svg = ET.Element(T("svg"), width=str(larg), height=str(alt), viewBox=f"0 0 {larg} {alt}", fill="none")
    svg.append(path(f"M0 0H{larg}V{alt}H0Z", PAPEL, id="papel"))
    svg.append(rotulo(MARGEM, 90, "O Cesto · folha de modelo v0", 64, anchor="start"))
    svg.append(rotulo(larg - MARGEM, 90, "Novela da Caatinga · derivada do mascote.svg · nov. 2026", 26, cor=TINTA_GUIA, anchor="end"))
    y = 150
    for titulo, nota, itens in secoes:
        sec = grupo("secao-" + re.sub(r"[^a-z]", "", titulo.lower().replace("õ", "o").replace("ã", "a")))
        svg.append(sec)
        y = secao(sec, y, titulo, nota, itens)
    for e in svg.iter():          # ids repetidos entre cópias confundem editores
        if e.get("id") and e.tag != T("svg"):
            pass
    ET.ElementTree(svg).write(AQUI / "cesto-folha.svg", encoding="unicode")
    print(f"folha {larg}x{alt} · secoes em y: 150 + {alt_secao}*i · banco: {len(list(banco.glob('*.svg')))} svgs")


if __name__ == "__main__":
    main()
