"""Folha do Mangaio (o cesto; model sheet v1), derivada do mascote.svg oficial.

O Mangaio é design travado: este script NÃO redesenha nada. Ele só recombina as
peças do mascote.svg (olhos, boca, braços, frutas) em vistas, expressões,
estados de conteúdo e poses. Peças novas (formas de olho e boca, fundo do cesto
vazio, braços levantados de mangaio_bracos.py) usam só cores da paleta.json e
do braço oficial. As vistas 3/4 e perfil vêm de mangaio_vistas.py.

Saídas (rodar de qualquer pasta):
  python arte/folhas/cesto_folha.py
  -> arte/folhas/cesto-folha.svg              (as pranchas numa folha só)
  -> arte/folhas/cesto-folha-secoes.json      (retângulo de cada prancha, para o VectorCraft)
  -> arte/banco/cesto/cesto-<variante>.svg    (cada variação, avulsa, 534x627)
  -> arte/banco/cesto/mangaio-rig.svg         (o rig com todas as peças trocáveis)
Depois o VectorCraft vira a folha em .vectorcraft (uma prancheta por seção) e PNG:
  python arte/folhas/cesto_folha.py --vectorcraft
"""
import copy
import json
import math
import re
import subprocess
import sys
from pathlib import Path
import xml.etree.ElementTree as ET

AQUI = Path(__file__).resolve().parent
sys.path.insert(0, str(AQUI))
import mangaio_bracos as MB  # noqa: E402
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
PIVO = MB.OMBRO                     # ombro real (o 80%/20% 10% do cena.js cai fora da patinha)


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

    # braços por último: levantados, passam na frente das frutas.
    # cada braço é um ângulo (gira o oficial, até ~60°) ou o nome de uma peça nova
    # de mangaio_bracos ("alto", "aponta", "segura"), ou (nome, giro).
    for lado, ang in zip(("esq", "dir"), braco):
        if isinstance(ang, (str, tuple)):
            nome, giro = (ang, None) if isinstance(ang, str) else ang
            g.append(ET.fromstring(f'<g xmlns="{NS}">' + MB.peca_svg(nome, lado, giro=giro, id_=f"braco-{lado}") + "</g>")[0])
            continue
        g.append(braco_oficial(pecas, lado, ang))
    return g


def braco_oficial(pecas, lado, ang=0, id_=None, desloc=(0, 0), escala=(1, 1)):
    """O braço oficial dentro da mesma estrutura das peças novas: o grupo externo põe o
    ombro no lugar, o .giro gira em volta do ombro (ang > 0 = para fora)."""
    px, py = PIVO[lado]
    x, y = px + desloc[0], py + desloc[1]
    b = copy.deepcopy(pecas[f"braco-{lado}"])
    b.attrib.pop("id", None)
    a = ang if lado == "esq" else -ang
    gi = grupo(None, f"rotate({a:g})", grupo(None, f"scale({escala[0]:g} {escala[1]:g}) translate({-px:g} {-py:g})", b))
    gi.set("class", "giro")
    g = grupo(id_ or f"braco-{lado}", f"translate({x:g} {y:g})", gi)
    g.set("data-pivo", f"{x:.0f} {y:.0f}")
    return g


def _rosto_vista(pecas, cx_novo, sx, olho_dir_sx=1.0, so_um_olho=False, boca_sx=1.0):
    """Rosto oficial deslocado na frente que gira: tudo comprimido em x (perspectiva),
    o olho de longe ainda mais estreito. Coordenadas do mascote."""
    cx = BOCA[0]
    r = grupo("rosto", f"translate({cx_novo:g} 0) scale({sx:g} 1) translate({-cx:g} 0)")
    r.set("data-pivo", f"{cx_novo:.0f} {BOCA[1] - 20:.0f}")
    ob = copy.deepcopy(por_id(pecas["rosto"], "boca"))
    bx, by = BOCA
    ob.set("transform", f"translate({bx:g} {by:g}) scale({boca_sx:g} 1) translate({-bx:g} {-by:g})")
    r.append(ob)
    for lado in ("esq", "dir"):
        if so_um_olho and lado == "dir":
            continue
        o = olho(lado, "oval", original=por_id(pecas["rosto"], f"olho-{lado}"))
        if lado == "dir" and olho_dir_sx != 1.0:
            ox, oy = OLHO["dir"]
            o = grupo(None, f"translate({ox:g} {oy:g}) scale({olho_dir_sx:g} 1) translate({-ox:g} {-oy:g})", o)
        r.append(o)
    return r


def _sx(id_, pecas, sx, cx=W / 2, dx=0, dy=0):
    g = copy.deepcopy(pecas[id_])
    g.set("transform", f"translate({cx + dx:g} {dy:g}) scale({sx:g} 1) translate({-cx:g} 0)")
    return g


def raiz_vista(vista, *filhos):
    g = grupo("mangaio", None, *filhos)
    g.set("data-vista", vista)
    g.set("data-pivo", f"{W / 2:.0f} {H}")
    return g


def tres_quartos(pecas):
    """3/4 (vira para a direita da tela), montado à mão com as peças oficiais.
    Giro de ~30° de um cesto redondo: o rosto anda para a direita e estreita, o olho
    de longe estreita mais, a alça estreita (cos 30°), o braço de longe vai para trás
    do corpo (só a luva aparece) e o de perto vem um pouco para a frente."""
    return raiz_vista("tres-quartos",
        braco_oficial(pecas, "dir", 10, desloc=(-14, 2), escala=(0.8, 0.96)),
        copy.deepcopy(pecas["corpo"]),
        _rosto_vista(pecas, BOCA[0] + 58, 0.86, olho_dir_sx=0.8),
        _sx("alca", pecas, 0.86, dx=8),
        _sx("frutas", pecas, 0.95, dx=6),
        braco_oficial(pecas, "esq", 0, desloc=(22, 6)),
    )


def perfil(pecas):
    """Perfil (de frente para a direita), montado à mão com as peças oficiais.
    O corpo estreita um pouco, a alça fica de lado (fina, em pé), o rosto vai para a
    borda da direita mas fica DENTRO do contorno (um olho, meia boca), as frutas são as
    oficiais e o braço de perto (o oficial esquerdo) vira braço da frente, no meio."""
    sx = 0.9
    return raiz_vista("perfil",
        _sx("corpo", pecas, sx),
        _rosto_vista(pecas, 432, 0.5, so_um_olho=True, boca_sx=0.8),
        _sx("alca", pecas, 0.3, dx=-6),
        _sx("frutas", pecas, 0.9, dx=-4),
        braco_oficial(pecas, "esq", -6, desloc=(206, 4)),
    )


def costas(pecas):
    """De costas: sem rosto e espelhado (a luz continua vindo da esquerda da tela).
    As frutas ficam atrás da borda (a palha de trás passa por cima delas) e os braços
    vão para trás do corpo: só a luva aparece dos lados."""
    fr = copy.deepcopy(pecas["frutas"])
    fr.set("transform", "translate(0 -6)")
    g = grupo(None, f"translate({W} 0) scale(-1 1)",
              interior(),
              fr,
              braco_oficial(pecas, "esq", -4, desloc=(16, -6), escala=(0.92, 0.92)),
              braco_oficial(pecas, "dir", -4, desloc=(-16, -6), escala=(0.92, 0.92)),
              copy.deepcopy(pecas["corpo"]),
              copy.deepcopy(pecas["alca"]))
    return raiz_vista("costas", g)


def silhueta(g):
    s = copy.deepcopy(g)
    for e in s.iter():
        if e.get("fill"):
            e.set("fill", ESCURO)
            if e.tag == T("path"):     # traço da mesma cor fecha as frestas entre formas vizinhas
                e.set("stroke", ESCURO); e.set("stroke-width", "2")
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
     dict(olho_kw={"esq": {"escala": 1.25}, "dir": {"escala": 1.25}}, boca_forma="o", braco=(("alto", 40), ("alto", 40)))),
    ("triste", "triste", "triste",
     dict(olhos=("triste", "triste"), olho_kw={"esq": {"dy": 6}, "dir": {"dy": 6}}, boca_forma="triste", boca_kw={"dy": 6}, braco=(-12, -12))),
    ("encantado", "encantado", "encantado",
     dict(olho_kw={"esq": {"escala": 1.18}, "dir": {"escala": 1.18}}, boca_forma="o_pequeno", braco=(("alto", 16), ("alto", 16)), rubor=True)),
    ("decidido", "decidido", "sobrancelha_levantada",
     dict(olhos=("decidido", "decidido"), boca_forma="firme", braco=(0, ("alto", -14)))),
    ("rindo", "rindo", "empolgado",
     dict(olhos=("arco", "arco"), boca_kw={"escala": 1.18, "dy": 4}, braco=(40, 40))),
    ("envergonhado", "envergonhado", "sorriso",
     dict(olho_kw={"esq": {"escala": 0.85, "dy": 8, "dx": 4}, "dir": {"escala": 0.85, "dy": 8, "dx": -4}},
          boca_forma="ondulada", boca_kw={"dy": 4}, braco=(-28, -28), rubor=True)),
    ("nao-vai", "\"não vai\"", "brava (sem raiva)",
     dict(olhos=("fechado", "fechado"), boca_forma="reta", braco=(0, ("aponta", -28)))),
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


def celula(pai, x, y, conteudo, legenda, *, transform_extra="", sombra=True, pendente=None, escala=ESC):
    """Coloca um Mangaio (coords do mascote) centrado na célula, pé na linha de chão.
    pendente = (linha1, linha2): moldura tracejada no lugar do desenho."""
    chao = y + CEL_H - 70
    cx = x + CEL_W / 2
    if pendente:
        pai.append(path(f"M{x+30} {y+30}H{x+CEL_W-30}V{chao}H{x+30}Z", "none", stroke=TINTA_GUIA,
                        stroke_width=3, stroke_dasharray="14 10"))
        pai.append(rotulo(cx, y + CEL_H / 2 - 30, pendente[0], 28, cor=TINTA_GUIA))
        pai.append(rotulo(cx, y + CEL_H / 2 + 10, pendente[1], 28, cor=TINTA_GUIA))
    else:
        if sombra:
            pai.append(sombra_chao(cx, chao, W * escala * 0.42))
        tf = f"translate({cx:.1f} {chao:.1f}) {transform_extra} scale({escala}) translate({-W/2} {-H})"
        pai.append(grupo(None, tf, conteudo))
    pai.append(path(f"M{x+20} {chao}H{x+CEL_W-20}", "none", stroke=TINTA_GUIA, stroke_width=2))
    pai.append(rotulo(cx, chao + 48, legenda, 30))


def peca_braco(nome):
    """Uma peça de braço sozinha, grande, com o pivô (ombro) marcado, em coords do mascote."""
    g = grupo(None)
    if nome == "oficial":
        b = copy.deepcopy(next(e for e in ET.parse(SERIE / "mascote.svg").getroot().iter() if e.get("id") == "braco-dir"))
        b.attrib.pop("id")
        ox, oy = PIVO["dir"]
        px, py = 210, 330
        g.append(grupo(None, f"translate({px} {py}) scale(2.0) translate({-ox} {-oy})", b))
    else:
        px, py = {"aponta": (90, 440), "alto": (170, 560), "segura": (200, 560), "punho": (190, 560)}[nome]
        el = ET.fromstring(f'<g xmlns="{NS}">' + MB.peca_svg(nome, "dir", x=0, y=0, giro=MB.GIRO[nome]) + "</g>")[0]
        g.append(grupo(None, f"translate({px} {py}) scale(2.0)", el))
    g.append(path(f"M{px-10} {py}C{px-10} {py-13} {px+10} {py-13} {px+10} {py}C{px+10} {py+13} {px-10} {py+13} {px-10} {py}Z", ESCURO))
    return g


def secao(pai, y, titulo, nota, itens):
    pai.append(rotulo(MARGEM, y + 50, titulo, 46, anchor="start"))
    pai.append(rotulo(MARGEM, y + 84, nota, 24, cor=TINTA_GUIA, anchor="start"))
    for i, it in enumerate(itens):
        celula(pai, MARGEM + i * CEL_W, y + TOPO_SECAO, *it[:2], **(it[2] if len(it) > 2 else {}))
    return y + TOPO_SECAO + CEL_H + 40


# ---------------------------------------------------------------- rig
OLHO_FORMAS = ["oval", "grande", "pequeno", "meia", "triste", "decidido", "arco", "fechado"]
BOCA_FORMAS = ["aberta", "aberta_grande", "sorriso_fechado", "firme", "triste", "o", "o_pequeno", "torta", "ondulada", "reta"]
BRACO_PECAS = ["oficial", "alto", "aponta", "segura"]

RIG_DOC = """
  Mangaio · rig para o motor (gerado por arte/folhas/cesto_folha.py; não editar à mão)
  Coordenadas do mascote.svg (534x627, pé no chão em y=627); o viewBox tem folga para os braços altos.
  Peça visível por padrão = o mascote oficial. Para trocar: mostre UM filho de cada grupo
  (style.display = '' / 'none'). data-pivo = "x y" do pivô, nas coordenadas do mascote.

  mangaio            o personagem inteiro (pivô: meio da base)
  interior           fundo de palha à mostra (oculto; mostrar em vazio/pouco e esconder frutas-cheio)
  frutas-pouco       uma laranja murcha (oculto; estado pouco)
  corpo              o cesto oficial (trançado)
  rosto              olhos + boca + bochechas (mover junto para olhar)
    bochechas        rubor tomate.luz 55% (oculto)
    boca             boca-aberta (padrão) | boca-aberta_grande | boca-sorriso_fechado | boca-firme | boca-triste
                     | boca-o | boca-o_pequeno | boca-torta | boca-ondulada | boca-reta
    olho-esq/-dir    olho-LADO-oval (padrão) | -grande | -pequeno | -meia | -triste | -decidido | -arco | -fechado
  alca               a alça trançada
  frutas-extra       pilha acima da borda (oculto; transbordando = frutas-cheio + frutas-extra)
  frutas-cheio       fruta-tomate, fruta-laranja e folhas (padrão)
  braco-esq/-dir     braco-LADO-oficial (padrão; gira até ~60°) | -alto | -aponta | -segura
                     esq/dir = lado de quem olha. PIVÔ (v2): cada peça é
                       g#braco-LADO-PECA [data-pivo="x y", transform="translate(x y)"]
                           g.giro [transform="rotate(a)"] > formas
                     o (0,0) do .giro É o ombro: gire SÓ o .giro (atributo transform="rotate(a)"
                     no dir e rotate(-a) no esq; a > 0 = horário no dir: abre as peças altas e
                     encolhe o oficial, que levanta com a < 0). Não gire o braco-LADO com
                     transform-box fill-box: a caixa muda de peça para peça e o braço solta do corpo.
  sombra             sombra de contato (fora do mangaio, para não esticar no squash; encolhe no ar)

  Convenções do Mangaio (exceções ao animacao.md §2, registradas na ficha personagens/cesto.md):
    - subgrupos com o lado no nome (olho-esq-oval, braco-dir-alto): o id tem que ser único no SVG
    - bocas expressivas no lugar dos visemas boca-A…: ele não fala
    - pivô em data-pivo="x y" (coords do mascote) no grupo, em vez do círculo "pivo"
  Vistas (cada uma é um rig próprio, mesmos ids, raiz = grupo "mangaio" com data-vista):
    cesto-tres-quartos.svg, cesto-perfil.svg, cesto-costas.svg (534x627, sem viewBox extra)

  Expressões (olhos + braços + boca), como na folha:
    neutra        oval, oficial, aberta
    desconfiado   meia (desloca +9 em x), oficial 0 / 25°, torta
    assustado     grande, alto (giro 40), o
    triste        triste (desce 6), oficial -12°, triste
    encantado     grande, alto (giro 8), o_pequeno, bochechas
    decidido      decidido, oficial / alto, firme
    rindo         arco, oficial 40°, aberta_grande
    envergonhado  pequeno, oficial -28°, ondulada, bochechas
    nao-vai       fechado, oficial / aponta (giro -28), reta
  Poses: no_ar = alto + alto; carregar_tudo = segura + segura (+ frutas-extra); apontar = aponta de um lado;
         danca = alto num lado e oficial no outro, alternando.
"""


def rig(pecas):
    """mangaio-rig.svg: o mascote com TODAS as peças trocáveis, cada uma num grupo de id
    estável; só a padrão fica visível (as outras com display:none)."""
    def oculto(e):
        e.set("style", "display:none")
        return e

    raiz = ET.Element(T("svg"), width=str(W + 280), height=str(H + 80), viewBox=f"-140 -80 {W + 280} {H + 80}", fill="none")
    raiz.append(ET.Comment(RIG_DOC))
    sombra = grupo("sombra", None, sombra_chao(W / 2, H - 4, W * 0.42))
    sombra.set("data-pivo", f"{W / 2:.0f} {H - 4}")
    raiz.append(sombra)
    m = grupo("mangaio")
    m.set("data-pivo", f"{W / 2:.0f} {H}")
    m.set("data-vista", "frente")
    raiz.append(m)
    it = interior()
    m.append(oculto(it))
    murcha = copy.deepcopy(por_id(pecas["frutas"], "laranja"))
    murcha.attrib.pop("id")
    recolor(murcha, {LARANJA[0]: LARANJA[2], LARANJA[1]: LARANJA[3], "#F3AD56": LARANJA[1]})
    m.append(oculto(grupo("frutas-pouco", "translate(240 318) rotate(18) scale(0.7) translate(-197 -283)", murcha)))
    m.append(copy.deepcopy(pecas["corpo"]))
    r = grupo("rosto")
    r.set("data-pivo", f"{BOCA[0]:.0f} {BOCA[1] - 20:.0f}")
    r.append(oculto(bochechas()))
    ob = por_id(pecas["rosto"], "boca")
    bg = grupo("boca")
    bg.set("data-pivo", f"{BOCA[0]:.0f} {BOCA[1]:.0f}")
    for forma in BOCA_FORMAS:
        if forma == "aberta":
            e = boca("aberta", ob)
        elif forma == "aberta_grande":
            e = boca("aberta", ob, escala=1.18, dy=4)
        else:
            e = boca(forma, ob)
        e.set("id", f"boca-{forma}")
        bg.append(e if forma == "aberta" else oculto(e))
    r.append(bg)
    for lado in ("esq", "dir"):
        og = grupo(f"olho-{lado}")
        og.set("data-pivo", f"{OLHO[lado][0]:.0f} {OLHO[lado][1]:.0f}")
        orig = por_id(pecas["rosto"], f"olho-{lado}")
        for forma in OLHO_FORMAS:
            if forma in ("oval", "grande", "pequeno"):
                e = olho(lado, "oval", escala={"oval": 1.0, "grande": 1.25, "pequeno": 0.85}[forma], original=orig)
            else:
                e = olho(lado, forma, original=orig)
            e.set("id", f"olho-{lado}-{forma}")
            og.append(e if forma == "oval" else oculto(e))
        r.append(og)
    m.append(r)
    m.append(copy.deepcopy(pecas["alca"]))
    ext = grupo("frutas-extra")
    lar = copy.deepcopy(por_id(pecas["frutas"], "laranja")); lar.attrib.pop("id")
    tom = copy.deepcopy(por_id(pecas["frutas"], "tomate")); tom.attrib.pop("id")
    ext.append(grupo(None, "translate(170 150) rotate(-14) scale(0.85) translate(-380 -257)", tom))
    ext.append(grupo(None, "translate(330 130) rotate(10) scale(0.9) translate(-197 -283)", lar))
    ext.append(grupo(None, "translate(250 70) rotate(-6) scale(0.7) translate(-197 -283)", copy.deepcopy(lar)))
    m.append(oculto(ext))
    fr = copy.deepcopy(pecas["frutas"])
    fr.set("id", "frutas-cheio")
    for e in fr.iter():
        if e is not fr and e.get("id") in ("tomate", "laranja"):
            e.set("id", "fruta-" + e.get("id"))
    m.append(fr)
    for lado in ("esq", "dir"):
        bg = grupo(f"braco-{lado}")
        bg.set("data-pivo", f"{PIVO[lado][0]:.0f} {PIVO[lado][1]:.0f}")
        for nome in BRACO_PECAS:
            if nome == "oficial":
                bg.append(braco_oficial(pecas, lado, 0, id_=f"braco-{lado}-oficial"))
            else:
                e = ET.fromstring(f'<g xmlns="{NS}">' + MB.peca_svg(nome, lado, giro=MB.GIRO[nome], id_=f"braco-{lado}-{nome}") + "</g>")[0]
                bg.append(oculto(e))
        m.append(bg)
    return raiz


def main():
    m, pecas = carregar()
    banco = SERIE / "arte" / "banco" / "cesto"
    banco.mkdir(parents=True, exist_ok=True)

    def avulso(nome, g):
        # quadro comum com folga para os braços levantados (2026-11-08): toda variação tem o MESMO quadro,
        # então encaixar pelo quadro dá a mesma escala para todas; os pés continuam na borda de baixo
        PX0, PY0 = (0, 0) if nome in ("tres-quartos", "perfil", "costas") else (-140, -70)   # vistas: a demo usa o quadro original
        s = ET.Element(T("svg"), width=str(W - 2 * PX0), height=str(H - PY0), viewBox=f"{PX0} {PY0} {W - 2 * PX0} {H - PY0}", fill="none")
        s.append(g)
        ET.ElementTree(s).write(banco / f"cesto-{nome}.svg", encoding="unicode")

    padrao = cesto(pecas)
    de_costas = costas(pecas)
    vistas = {"tres-quartos": tres_quartos(pecas), "perfil": perfil(pecas), "costas": de_costas}
    for nome, g in vistas.items():
        avulso(nome, copy.deepcopy(g))

    secoes = []
    secoes.append(("Vistas", "frente = mascote.svg oficial · 3/4, perfil e costas: montadas à mão com as peças oficiais (cut-out, cada vista é um rig) · de cima: pendente", [
        (padrao, "frente"),
        (vistas["tres-quartos"], "3/4"),
        (vistas["perfil"], "perfil"),
        (de_costas, "costas"),
        (None, "de cima", {"pendente": ("pendente: gerar com", "将镜头向上移动")}),
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
    secoes.append(("Conteúdo", "o que vai dentro conta a temporada · entrega e palha do licuri ficam para a v2", conts))
    poses = [
        ("antecipacao", cesto(pecas, braco=(-10, -10), olhos=("meia", "meia")), "antecipação", {"transform_extra": "scale(1.14 0.84)"}),
        ("no-ar", cesto(pecas, braco=(("alto", 30), ("alto", 30)), olho_kw={"esq": {"escala": 1.1}, "dir": {"escala": 1.1}}), "no ar",
         {"transform_extra": "translate(0 -40) scale(0.9 1.1)"}),
        ("pouso", cesto(pecas, braco=(30, 30), olhos=("arco", "arco")), "pouso", {"transform_extra": "scale(1.16 0.82)"}),
        ("carregar-tudo", cesto(pecas, conteudo="transbordando", braco=("segura", "segura"), olhos=("arco", "arco")), "carregar_tudo",
         {"transform_extra": "scale(1.08 0.9)"}),
        ("apontar", cesto(pecas, braco=(0, "aponta"), olho_kw={"esq": {"dx": 10}, "dir": {"dx": 10}}, boca_forma="o_pequeno", boca_kw={"dx": 8}),
         "apontar", {"transform_extra": "rotate(3)"}),
        ("danca", cesto(pecas, braco=(-15, ("alto", 20)), olhos=("arco", "arco")), "dança", {"transform_extra": "rotate(-6)"}),
    ]
    for id_, g, *_ in poses:
        avulso(f"pose-{id_}", copy.deepcopy(g))
    secoes.append(("Quique e poses", "ele quica, não anda · squash no chão, stretch no ar · braço alto = peça nova (o oficial gira só até ~60°)",
                   [tuple(p[1:]) for p in poses]))
    sil = [(silhueta(padrao), "frente"), (silhueta(vistas["tres-quartos"]), "3/4"), (silhueta(vistas["perfil"]), "perfil"),
           (silhueta(de_costas), "costas")]
    pose_g = {p[0]: p for p in poses}
    sil.append((silhueta(pose_g["no-ar"][1]), "no ar", {"transform_extra": "translate(0 -40) scale(0.9 1.1)"}))
    sil.append((silhueta(exprs[4][0]), "encantado"))
    sil.append((silhueta(pose_g["apontar"][1]), "apontar", {"transform_extra": "rotate(3)"}))
    sil.append((silhueta(pose_g["danca"][1]), "dança", {"transform_extra": "rotate(-6)"}))
    secoes.append(("Silhuetas", "em #462416: cada vista e cada pose com braço novo tem que se ler só pela sombra, no tamanho de celular", sil))
    nomes = {"oficial": "oficial (abraça)", "alto": "alto", "aponta": "aponta", "segura": "segura"}
    secoes.append(("Braços", "peças do rig, trocáveis · mesma base #E49340 e borda #B0581E do braço oficial · ● = pivô no ombro · o da esquerda é o espelho",
                   [(peca_braco(n), nomes[n], {"sombra": False}) for n in BRACO_PECAS]))

    larg = MARGEM * 2 + CEL_W * max(len(s[2]) for s in secoes)
    alt_secao = TOPO_SECAO + CEL_H + 40
    alt = 150 + alt_secao * len(secoes) + 40
    svg = ET.Element(T("svg"), width=str(larg), height=str(alt), viewBox=f"0 0 {larg} {alt}", fill="none")
    svg.append(path(f"M0 0H{larg}V{alt}H0Z", PAPEL, id="papel"))
    svg.append(rotulo(MARGEM, 90, "Mangaio · folha de modelo v2", 64, anchor="start"))
    svg.append(rotulo(larg - MARGEM, 90, "Novela da Caatinga · derivada do mascote.svg · nov. 2026", 26, cor=TINTA_GUIA, anchor="end"))
    y = 150
    retangulos = []
    for titulo, nota, itens in secoes:
        sid = "secao-" + re.sub(r"[^a-z]", "", titulo.lower().replace("õ", "o").replace("ã", "a").replace("ç", "c"))
        sec = grupo(sid)
        svg.append(sec)
        y0 = 0 if y == 150 else y
        y = secao(sec, y, titulo, nota, itens)
        retangulos.append({"nome": titulo, "x": 0, "y": y0, "width": larg, "height": y - y0})
    ET.ElementTree(svg).write(AQUI / "cesto-folha.svg", encoding="unicode")
    (AQUI / "cesto-folha-secoes.json").write_text(json.dumps(retangulos, ensure_ascii=False, indent=1), encoding="utf-8")
    ET.ElementTree(rig(pecas)).write(banco / "mangaio-rig.svg", encoding="unicode")
    print(f"folha {larg}x{alt} · {len(secoes)} seções · banco: {len(list(banco.glob('*.svg')))} svgs")


VC = r"C:/Users/Arthur/AppData/Local/Programs/ArtCraft/VectorCraft/vectorcraft-cli.exe"


def vectorcraft():
    """Folha -> .vectorcraft com uma prancheta por seção, e PNG da folha inteira."""
    secoes = json.loads((AQUI / "cesto-folha-secoes.json").read_text(encoding="utf-8"))
    fonte = SERIE / "arte" / "fonte" / "cesto-folha.vectorcraft"
    cmds = [{"command": "artboard.new", "params": {"x": r["x"], "y": r["y"], "width": r["width"], "height": r["height"],
                                                   "name": r["nome"]}} for r in secoes]
    cmds += [{"command": "artboard.delete", "params": {"index": 0}},
             {"command": "file.saveAs", "params": {"path": str(fonte)}}]
    arq = AQUI / "_vc.json"
    arq.write_text(json.dumps(cmds, ensure_ascii=False), encoding="utf-8")
    try:
        r = subprocess.run([VC, "run", "--in", str(AQUI / "cesto-folha.svg"), "--commands", str(arq)],
                           capture_output=True, text=True, encoding="utf-8")
        print(r.stdout[-1500:], r.stderr[-800:])
    finally:
        arq.unlink(missing_ok=True)
    r = subprocess.run([VC, "convert", str(AQUI / "cesto-folha.svg"), str(AQUI / "cesto-folha.png"), "--scale", "1"],
                       capture_output=True, text=True, encoding="utf-8")
    print(r.stdout[-400:], r.stderr[-400:])


if __name__ == "__main__":
    if "--vectorcraft" in sys.argv:
        vectorcraft()
    else:
        main()
