"""Folha da Dona Mandioca (model sheet v2), no formato da folha do Mangaio.

v2 (2026-11-07, depois da revisão de arte): nada é rastreado. Corpo, casca em faixas, lascas,
lenço, avental, pernas-toco, braços-patinha, colher e rosto são desenhados à mão em código
(dona_mandioca_rig.py), com a vista como parâmetro: frente, 3/4, perfil e costas são rigs
próprios com os mesmos ids. Cada expressão, boca e pose é troca de peça.

Saídas (rodar de qualquer pasta):
  python arte/folhas/dona_mandioca_folha.py
  -> arte/folhas/dona-mandioca-folha.svg / .png
  -> arte/fonte/dona-mandioca-folha.vectorcraft (uma prancheta por seção)
  -> arte/banco/dona-mandioca/*.svg  (frente, rig de cada vista, expressões, bocas, poses)
A geração do GPT (referencias/dona-mandioca-frente.png) é só referência de design. O caminho
antigo (dona_mandioca_limpar.py + rastreamento) ficou como registro e não alimenta mais o rig.
"""
import copy
import json
import re
import subprocess
import sys
from pathlib import Path
import xml.etree.ElementTree as ET

AQUI = Path(__file__).resolve().parent
sys.path.insert(0, str(AQUI))
import dona_mandioca_rig as dm  # noqa: E402
from dona_mandioca_rig import el, g, path, suave, oval  # noqa: E402

ARTE, SERIE = dm.ARTE, dm.SERIE
BANCO = ARTE / "banco" / "dona-mandioca"
VC = r"C:/Users/Arthur/AppData/Local/Programs/ArtCraft/VectorCraft/vectorcraft-cli.exe"
T = dm.T
PAPEL, TINTA_GUIA, ESCURO = "#F7E8C6", "#C9946A", dm.ESCURO

# ---------------------------------------------------------------- medidas
ALTURA_PX = dm.CHAO - dm.TOPO_CABECA      # pés ao topo do lenço sem o nó = 1,35 Mangaio
MANGAIO_ALT = 626.0 - 254.0                # mascote.svg: fundo até a borda = 1,0
RAZAO = 1.35


def rotulo(x, y, txt, tam=26, cor=ESCURO, anchor="middle"):
    t = el("text", x=f"{x:.0f}", y=f"{y:.0f}", fill=cor)
    t.set("font-family", "Caveat Brush, Segoe Print, sans-serif")
    t.set("font-size", str(tam)); t.set("text-anchor", anchor)
    t.text = txt
    return t


def mangaio():
    """O Mangaio oficial (mascote.svg, design travado), sem nenhuma alteração."""
    raiz = ET.parse(SERIE / "mascote.svg").getroot()
    return copy.deepcopy(raiz.find(T("g")))


def sem_ids(no):
    """Na folha os ids se repetem a cada célula; o VectorCraft esconde TODOS os elementos de um id quando
    um deles tem display=none (o rosto vazio das costas apagava o rosto da folha inteira). Ids só no banco/."""
    no = copy.deepcopy(no)
    for e in no.iter():
        e.attrib.pop("id", None)
    for pai in list(no.iter()):
        for f in list(pai):
            if f.get("display") == "none":
                pai.remove(f)
    return no


def silhueta(no):
    s = copy.deepcopy(no)
    for e in s.iter():
        if e.get("fill") and e.get("fill") != "none":
            e.set("fill", ESCURO)
        e.attrib.pop("opacity", None)
    for e in s.iter():
        if e.get("id") == "sombra":
            e.clear()
    return s


# ---------------------------------------------------------------- catálogo
BRACOS_PADRAO = dict(braco_esq=("reto", 58), prop_esq=("colher", -8), braco_dir=("reto", 14))
Q = (dm.MEIO, dm.QUADRIL_Y)
# As 9 expressões do Mangaio (cesto_folha.py), peça por peça, só adaptadas (decisão 2026-11-07):
# mesmas formas de olho e boca, mesmos deslocamentos (unidades do mascote x ROSTO_K), sem sobrancelha,
# braços traduzidos para os dela (a colher fica na mão esquerda da tela).
_K = dm.ROSTO_K
EXPRESSOES = [  # (id, rótulo, estado)
    ("neutra", "neutra (= Mangaio)", dict(boca="aberta")),
    ("desconfiado", "desconfiada", dict(olhos=("meia-lua", "meia-lua"),
        olho_kw={"esq": {"dx": 9 * _K}, "dir": {"dx": 9 * _K}}, boca="torta", boca_kw={"dx": 10 * _K})),
    ("assustado", "assustada", dict(olho_kw={"esq": {"escala": 1.25}, "dir": {"escala": 1.25}}, boca="o",
        braco_esq=("reto", 140), prop_esq=("colher", -40), braco_dir=("reto", 140),
        tronco_tf="translate(0 -20) scale(0.97 1.05)")),
    ("triste", "triste", dict(olhos=("triste", "triste"), olho_kw={"esq": {"dy": 6 * _K}, "dir": {"dy": 6 * _K}},
        boca="triste", boca_kw={"dy": 6 * _K}, braco_esq=("reto", 4), prop_esq=("colher", 178), braco_dir=("reto", 4),
        tronco_tf=f"translate(0 10) scale(1.03 0.95)")),
    ("encantado", "encantada", dict(olho_kw={"esq": {"escala": 1.18}, "dir": {"escala": 1.18}}, boca="o_pequeno",
        bochechas=True, braco_esq=("reto", 34), prop_esq=("colher", -12), braco_dir=("reto", 34))),
    ("decidido", "decidida", dict(olhos=("decidido", "decidido"), boca="firme", braco_dir=("reto", 150))),
    ("rindo", "rindo", dict(olhos=("arco", "arco"), boca="aberta", boca_kw={"escala": 1.18, "dy": 4 * _K},
        braco_esq=("reto", 60), prop_esq=("colher", -14), braco_dir=("reto", 60))),
    ("envergonhado", "envergonhada", dict(olho_kw={"esq": {"escala": 0.85, "dy": 8 * _K, "dx": 4 * _K},
        "dir": {"escala": 0.85, "dy": 8 * _K, "dx": -4 * _K}}, boca="ondulada", boca_kw={"dy": 4 * _K},
        bochechas=True, braco_esq=("reto", -10), prop_esq=("colher", 178), braco_dir=("reto", -10))),
    ("nao-vai", "\"não vai\"", dict(olhos=("fechado", "fechado"), boca="reta", braco_dir=("reto", 92),
        tronco_tf=f"rotate(4 {Q[0]} {Q[1]})")),
]
BOCAS = [("boca-repouso", "repouso"), ("boca-MBP", "M B P"), ("boca-A", "A"), ("boca-E", "E"),
         ("boca-I", "I S Z CH"), ("boca-O", "O"), ("boca-U", "U Ô"), ("boca-FV", "F V")]
POSES = [
    ("bater-colher-antes", "bater a colher (antecipação)", dict(braco_esq=("reto", 165), prop_esq=("colher", -35),
        olhos=("decidido", "decidido"), sobr=(None, None), boca="boca-MBP", bochechas=False,
        tronco_tf=f"rotate(-5 {Q[0]} {Q[1]}) translate(0 6) scale(1 0.97)")),
    ("bater-colher", "bater a colher (batida)", dict(braco_esq=("reto", 40), prop_esq=("colher", -112),
        olhos=("fechado", "fechado"), sobr=(None, None), boca="boca-A", bochechas=False,
        tronco_tf=f"rotate(4 {Q[0]} {Q[1]}) translate(0 12) scale(1.02 0.95)")),
    ("se-abanar", "se abanar (folha, cap. 1)", dict(braco_dir=("reto", 150), prop_dir=("abano", -24),
        braco_esq=("reto", 8), prop_esq=("colher", 178), olhos=("meia-lua", "meia-lua"), sobr=(None, None),
        boca="boca-O", bochechas=True)),
    ("apontar", "apontar com a colher", dict(braco_esq=("reto", 92), prop_esq=("colher", -88),
        olhos=("decidido", "decidido"), sobr=(None, None), boca="firme", bochechas=False,
        tronco_tf=f"rotate(-3 {Q[0]} {Q[1]})")),
    ("abraco-contido", "abraço contido", dict(braco_esq=("reto", 48), prop_esq=None, braco_dir=("reto", 48),
        olhos=("arco", "arco"), sobr=(None, None), boca="boca-repouso", bochechas=True, rosto_rot=5, olhar=(-12, 4),
        tronco_tf=f"rotate(2 {Q[0]} {Q[1]})")),
    ("comovida", "comovida (ajeita o lenço)", dict(braco_dir=("reto", 168), prop_dir=None, braco_esq=("reto", 10),
        prop_esq=("colher", 178), olhos=("triste", "triste"), sobr=(None, None), boca="boca-repouso",
        bochechas=True, bochechas_esc=1.25, olhar=(-22, 6), rosto_rot=4, tronco_tf=f"rotate(3 {Q[0]} {Q[1]})")),
]
VISTAS = [(0, "frente"), (45, "3/4"), (90, "perfil"), (135, "3/4 de costas"), (180, "costas")]


# ---------------------------------------------------------------- folha
CEL_W, CEL_H = 400, 560
ESC = 0.37
MARGEM, TOPO_SECAO = 60, 130
MAX_COL = 8
_n = [0]


def novo():
    _n[0] += 1
    return f"c{_n[0]}"


def celula(pai, x, y, conteudo, legenda, *, esc=ESC, foco=None):
    chao = y + CEL_H - 70
    cx = x + CEL_W / 2
    conteudo = sem_ids(conteudo)
    if foco is None:
        tf = f"translate({cx:.1f} {chao:.1f}) scale({esc}) translate({-dm.MEIO} {-dm.CHAO})"
        pai.append(g(None, tf, conteudo))
    else:   # close: centra o ponto 'foco' na célula e recorta
        fx, fy = foco
        cy = y + (CEL_H - 70) / 2 + 10
        cid = f"clip-{novo()}"
        d = el("defs"); cp = el("clipPath", id=cid)
        forma = suave(oval(cx, cy, CEL_W / 2 - 34, (CEL_H - 70) / 2 - 30, n=20))
        cp.append(path(forma, "#F2DDB4")); d.append(cp); pai.append(d)
        pai.append(path(forma, "#F2DDB4"))
        tf = f"translate({cx:.1f} {cy:.1f}) scale({esc}) translate({-fx} {-fy})"
        pai.append(g(None, None, g(None, tf, conteudo), clip_path=f"url(#{cid})"))
    pai.append(path(f"M{x+20} {chao}H{x+CEL_W-20}", "none", stroke=TINTA_GUIA, stroke_width=2))
    pai.append(rotulo(cx, chao + 46, legenda, 28))


def secao(pai, y, titulo, nota, itens):
    pai.append(rotulo(MARGEM, y + 50, titulo, 46, anchor="start"))
    pai.append(rotulo(MARGEM, y + 84, nota, 24, cor=TINTA_GUIA, anchor="start"))
    linhas = [itens[i:i + MAX_COL] for i in range(0, len(itens), MAX_COL)] if itens else []
    for li, linha in enumerate(linhas):
        for i, it in enumerate(linha):
            celula(pai, MARGEM + i * CEL_W, y + TOPO_SECAO + li * CEL_H, *it[:2], **(it[2] if len(it) > 2 else {}))
    return y + TOPO_SECAO + CEL_H * len(linhas) + 40


def prancha_escala(pai, y):
    pai.append(rotulo(MARGEM, y + 50, "Escala", 46, anchor="start"))
    pai.append(rotulo(MARGEM, y + 84, "ao lado do Mangaio · altura do fundo à borda (Mangaio) e dos pés ao topo do lenço sem o nó (Dona Mandioca) · rosto a ~0,58 do absoluto do Mangaio (proposta, ver ficha)",
                      24, cor=TINTA_GUIA, anchor="start"))
    alt = 860
    chao = y + TOPO_SECAO + alt - 60
    um = 470.0
    ec = um / MANGAIO_ALT
    ed = um * RAZAO / ALTURA_PX
    x0 = MARGEM + 120
    for frac, txt in ((0.0, "0"), (1.0, "1,0"), (RAZAO, "1,35")):
        yy = chao - um * frac
        pai.append(path(f"M{x0-40} {yy:.1f}H{x0+1900}", "none", stroke=TINTA_GUIA, stroke_width=2,
                        stroke_dasharray=None if frac == 0 else "12 10"))
        pai.append(rotulo(x0 - 50, yy + 9, txt, 28, cor=TINTA_GUIA, anchor="end"))
    pai.append(g(None, f"translate({x0 + 420} {chao}) scale({ec:.4f}) translate(-267 -626)", sem_ids(mangaio())))
    pai.append(rotulo(x0 + 420, chao + 50, "Mangaio 1,0", 30))
    pai.append(g(None, f"translate({x0 + 1080} {chao}) scale({ed:.4f}) translate({-dm.MEIO} {-dm.CHAO})", sem_ids(dm.dona_mandioca())))
    pai.append(rotulo(x0 + 1080, chao + 50, "Dona Mandioca 1,35", 30))
    pai.append(g(None, f"translate({x0 + 1560} {chao}) scale({ed:.4f}) translate({-dm.MEIO} {-dm.CHAO})",
                 sem_ids(silhueta(dm.dona_mandioca()))))
    pai.append(rotulo(x0 + 1560, chao + 50, "silhueta", 30))
    return y + TOPO_SECAO + alt + 40


def gravar(no, nome, viewbox=dm.VIEWBOX, comentario=None):
    BANCO.mkdir(parents=True, exist_ok=True)
    s = dm.svg_doc(copy.deepcopy(no), viewbox, comentario)
    ET.ElementTree(s).write(BANCO / nome, encoding="unicode")


CABECALHO_RIG = """
Dona Mandioca · rig v2 ({vista}, theta={theta}°) · gerado por arte/folhas/dona_mandioca_folha.py (não editar à mão)
Coordenadas em px do quadro 1254 (pés no chão em 640,1195). Desenho à mão em código, nada rastreado.
Pivô: atributo data-pivo="x y" (coords do quadro) no próprio grupo, a mesma convenção do mangaio-rig.svg.
Trocar peça: mostre UM filho de cada grupo (display), como no Mangaio. Ids iguais em todas as vistas.
Ordem (trás -> frente): sombra, perna-* (a de trás primeiro), tronco[ acess-lenco-tras?, braco-* de trás,
  corpo, acess-avental, acess-lenco, rosto, braco-* da frente ].
  dona-mandioca     pivô: meio dos pés no chão; data-vista = theta
  sombra            sombra de contato (chao_terra.profunda 40%); fora do tronco: não estica no squash
  perna-esq/-dir    toco próprio (não é recorte); o topo entra ~70 px no tronco, escondido sob a barra do corpo
                    e do avental. Pivô no quadril. Aguenta tronco translate(0,-30) scale(1,1.08) e giro de ±25°
  tronco            tudo acima das pernas: squash/stretch e inclinação aqui (pivô no quadril, y=1040)
  corpo             tons empilhados (sombra, base, luz alta à esquerda, meio, profunda embaixo à direita),
                    miolo no topo, faixas de casca e lascas na superfície (somem e achatam com a vista)
  acess-avental     alças, peitilho, cós, saia, bolso com FARINHA (lettering de pincel), X nas costas, laço
  acess-lenco       faixa com bolinhas + lenco-no (nó) > lenco-pontas (follow-through: girar a partir do
                    data-pivo do lenco-pontas, ±6 a 8°, chega atrasado)
  rosto             rosto padrão do elenco (rosto_padrao.py) a 1,18 px/unidade do mascote
    bochechas       lenco_vermelho.meio a 30%
    boca            boca-repouso (padrão) | boca-MBP | boca-A | boca-E | boca-I | boca-O | boca-U | boca-FV (sincronia)
                    | boca-aberta | boca-triste | boca-torta | boca-ondulada | boca-firme | boca-reta (expressão)
    olho-esq/-dir   olho-LADO-oval (padrão) | -arco | -meia-lua | -fechado | -grande | -triste | -decidido
    sobr-esq/-dir   OCULTAS por padrão; variantes sobr-LADO-neutra|levantada|baixa|brava|triste|alta
  braco-esq/-dir    esq/dir = lado de quem olha NA FRENTE (braco-esq segura a colher). transform=translate(ombro).
                    data-sentido = -1 (para fora = esquerda da tela) ou 1. Variantes:
                      braco-LADO-reto > g.giro [rotate(-a*sentido): a>0 = para fora] > formas + prop + mão
                      braco-LADO-cintura, braco-LADO-cruzado (de frente/3/4)
    prop-colher-LADO / prop-abano-LADO   dentro do .giro do reto, transform=translate(mão) rotate(ângulo); visível:
                    a colher na mão esquerda da tela; o abano oculto
Expressões e poses = combinações de peças: EXPRESSOES e POSES em dona_mandioca_folha.py e a ficha.
"""


def main():
    BANCO.mkdir(parents=True, exist_ok=True)
    gravar(dm.dona_mandioca(), "dona-mandioca-frente.svg")
    for theta, nome, rot in ((0, "dona-mandioca-rig.svg", "frente"), (45, "dona-mandioca-tres-quartos.svg", "3/4"),
                             (90, "dona-mandioca-perfil.svg", "perfil"), (180, "dona-mandioca-costas.svg", "costas")):
        gravar(dm.dona_mandioca(theta=theta, rig_completo=True), nome,
               comentario=CABECALHO_RIG.format(vista=rot, theta=theta))

    secoes = []
    secoes.append(("Vistas", "desenhadas à mão em código, a vista é parâmetro: cada uma é um rig com os mesmos ids · luz de tela (cima-esquerda) não gira com ela",
                   [(dm.dona_mandioca(theta=t), r) for t, r in VISTAS] +
                   [(silhueta(dm.dona_mandioca()), "silhueta")]))
    exprs = []
    for id_, rot, est in EXPRESSOES:
        e = dict(BRACOS_PADRAO); e.update(est)
        gravar(dm.dona_mandioca(e), f"dona-mandioca-expr-{id_.replace('_', '-')}.svg")
        exprs.append((dm.dona_mandioca(e), rot))
    secoes.append(("Expressões", "as 9 do Mangaio, só adaptadas: mesmas formas de olho e boca, sem sobrancelha · troca de peça, o corpo não muda", exprs))
    bocas = []
    for id_, rot in BOCAS:
        e = dict(BRACOS_PADRAO, boca=id_, sobr=(None, None))
        gravar(dm.dona_mandioca(e), f"dona-mandioca-{id_}.svg")
        bocas.append((dm.dona_mandioca(e), rot, {"esc": 0.95, "foco": (dm.eixo(470), 470)}))
    secoes.append(("Bocas", "sincronia labial (animacao.md §4) no rosto padrão · A alta com língua, E larga e baixa, I dentes, O redonda, U pequena, FV dentes no lábio", bocas))
    poses = []
    for id_, rot, est in POSES:
        e = dict(BRACOS_PADRAO); e.update(est)
        gravar(dm.dona_mandioca(e), f"dona-mandioca-pose-{id_}.svg")
        poses.append((dm.dona_mandioca(e), rot))
    secoes.append(("Poses", "gesticula com a colher como regente · base larga, quase nunca se curva (quando curva, é carinho)", poses))

    larg = MARGEM * 2 + CEL_W * MAX_COL
    alt_secoes = sum(TOPO_SECAO + CEL_H * ((len(s[2]) - 1) // MAX_COL + 1) + 40 for s in secoes)
    alt = 150 + alt_secoes + TOPO_SECAO + 860 + 40 + 40
    svg = el("svg", width=larg, height=alt, viewBox=f"0 0 {larg} {alt}", fill="none")
    svg.append(path(f"M0 0H{larg}V{alt}H0Z", PAPEL, id="papel"))
    svg.append(rotulo(MARGEM, 90, "Dona Mandioca · folha de modelo v2", 64, anchor="start"))
    svg.append(rotulo(larg - MARGEM, 90, "Novela da Caatinga · desenho à mão em código (rig v2) · nov. 2026", 26,
                      cor=TINTA_GUIA, anchor="end"))
    y = 150
    caixas = []
    for titulo, nota, itens in secoes:
        sec = g("secao-" + re.sub(r"[^a-z]", "", titulo.lower().replace("õ", "o").replace("ã", "a")))
        svg.append(sec)
        y1 = secao(sec, y, titulo, nota, itens)
        caixas.append((titulo, y, y1))
        y = y1
    sec = g("secao-escala")
    svg.append(sec)
    y1 = prancha_escala(sec, y)
    caixas.append(("Escala", y, y1))
    saida = AQUI / "dona-mandioca-folha.svg"
    ET.ElementTree(svg).write(saida, encoding="unicode")
    print(f"folha {larg}x{alt} · banco: {len(list(BANCO.glob('*.svg')))} svgs")

    subprocess.run([VC, "convert", str(saida), str(AQUI / "dona-mandioca-folha.png"), "--scale", "0.5"],
                   check=True, capture_output=True)
    if "--sem-vectorcraft" in sys.argv:
        return
    cmds = [{"command": "artboard.new", "params": {"x": 0, "y": y0, "width": larg, "height": y1 - y0, "name": t}}
            for t, y0, y1 in caixas]
    cmds.append({"command": "artboard.delete", "params": {"index": 0}})
    cmds.append({"command": "file.saveAs", "params": {"path": str(ARTE / "fonte" / "dona-mandioca-folha.vectorcraft")}})
    dm.TRAB.mkdir(parents=True, exist_ok=True)
    cmdf = dm.TRAB / "vc-pranchetas.json"
    cmdf.write_text(json.dumps(cmds, ensure_ascii=False), encoding="utf-8")
    r = subprocess.run([VC, "run", "--in", str(saida), "--commands", str(cmdf)], capture_output=True, text=True,
                       encoding="utf-8", errors="replace")
    print(r.stdout[-400:] if r.returncode == 0 else r.stderr[-800:] + r.stdout[-800:])


if __name__ == "__main__":
    main()
