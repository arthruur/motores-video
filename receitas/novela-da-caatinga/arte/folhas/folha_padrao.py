"""Folha padrão de personagem (molde) — monta o esqueleto no VectorCraft.

Todo personagem da série tem a MESMA folha: mesmas 6 pranchetas, mesma largura, mesma grade de
células, mesmos rótulos, mesma régua de escala (1 cesto = 250 px). A arte entra na camada "arte";
molduras, réguas e linhas de chão ficam na camada "guias" (travada); textos na camada "rotulos".

Ao vivo, no app aberto com o servidor de controle:
  vectorcraft.exe --control 7979 ...
  python arte/folhas/folha_padrao.py --vivo [--nome "Dona Mandioca"] [--salvar arte/fonte/folha-padrao.vectorcraft]
Sem app (CLI headless):
  python arte/folhas/folha_padrao.py --salvar arte/fonte/folha-padrao.vectorcraft

O .vectorcraft é a versão oficial da folha; este script só monta o esqueleto uma vez.
"""
import argparse
import json
import socket
import subprocess
import sys
import tempfile
from pathlib import Path

ESCURO, GUIA, PAPEL, CAIXA = "#462416", "#C9946A", "#F7E8C6", "#EFDDB4"
FONTE = "Caveat Brush"
L = 3600                     # largura de toda prancheta
M = 80                       # margem
CESTO = 250                  # px por "cesto" (a unidade da série) na régua de escala
VAO = 200                    # espaço entre pranchetas

EXPRESSOES = ["neutra", "desconfiado", "assustado", "triste", "encantado", "decidido", "rindo", "envergonhado", "\"não vai\""]
BOCAS = ["repouso", "M B P", "A", "E", "I S Z CH", "O", "U Ô", "F V"]
VISTAS = ["frente (obrigatória)", "3/4", "perfil", "costas"]
RAMPA = ["luz", "base", "meio", "sombra", "profunda"]

# (nome, altura, subtítulo)
PRANCHETAS = [
    ("1 · Identidade", 1560, "quem é, em um olhar: frente de apresentação, silhueta, escala no elenco e cores"),
    ("2 · Vistas", 920, "frente primeiro (ARTE.md §2): as outras vistas só entram aprovadas · rosto rígido nas vistas laterais"),
    ("3 · Expressões", 860, "as 9 do Mangaio, sempre nesta ordem · só troca olho, boca e braço: o corpo não muda · sem sobrancelha"),
    ("4 · Bocas", 700, "sincronia labial (animacao.md §4) · quem não fala (Mangaio): gestos de trompete no lugar"),
    ("5 · Repertório", 960, "4 a 6 poses ou movimentos que só ele faz (ex.: o quique do Mangaio, a colher da Dona Mandioca)"),
    ("6 · Peças do rig", 1240, "cada peça solta, com o id do grupo e o pivô (círculo) · é daqui que o motor tira as peças"),
]


class Vivo:
    """Manda os comandos para o app aberto (servidor de controle)."""
    def __init__(self, porta=7979):
        self.porta = porta

    def __call__(self, cmd, **p):
        s = socket.create_connection(("127.0.0.1", self.porta), timeout=120)
        f = s.makefile("rwb")
        f.write((json.dumps({"id": 1, "method": "command", "params": {"command": cmd, "params": p}}) + "\n").encode())
        f.flush()
        r = json.loads(f.readline().decode("utf-8", "replace"))
        s.close()
        if not r.get("ok"):
            raise RuntimeError(f"{cmd}: {r.get('error')}")
        return r.get("result")


class Lote:
    """Acumula os comandos para o vectorcraft-cli run (sem app)."""
    def __init__(self):
        self.cmds = []

    def __call__(self, cmd, **p):
        self.cmds.append({"command": cmd, "params": p})
        return {"id": None}


def montar(vc, nome_personagem="NOME DO PERSONAGEM"):
    tops = []
    y = 0
    for nome, alt, _ in PRANCHETAS:
        tops.append(y)
        y += alt + VAO
    altura_total = y - VAO
    vc("file.new", name="folha-padrao", width=L, height=PRANCHETAS[0][1], units="Pixels")
    vc("artboard.setProps", index=0, name=PRANCHETAS[0][0], color=PAPEL)
    for (nome, alt, _), top in list(zip(PRANCHETAS, tops))[1:]:
        vc("artboard.new", x=0, y=top, width=L, height=alt, name=nome, color=PAPEL)

    # camadas: guias (embaixo, travada no fim), rotulos, arte (em cima, a corrente)
    vc("layer.setProps", name="guias")
    guias = vc("document.inspect", depth=0)["layers"][0]["id"]

    # ---------- desenho de guias
    def tracejado():
        vc("select.none"); vc("paint.setFill", none=True); vc("paint.setStroke", color=GUIA); vc("stroke.set", weight=3, dash=[14, 10])

    def cheio_guia():
        vc("select.none"); vc("paint.setFill", none=True); vc("paint.setStroke", color=GUIA); vc("stroke.set", weight=2, dash=None)

    def celula(x, y, w, h, chao=True):
        tracejado(); vc("shape.rectangle", x=x, y=y, width=w, height=h, radius=12)
        if chao:
            cheio_guia(); vc("shape.line", x1=x + 20, y1=y + h - 90, x2=x + w - 20, y2=y + h - 90)

    def caixa(x, y, w, h):
        vc("select.none"); vc("paint.setStroke", none=True); vc("paint.setFill", color=CAIXA)
        vc("shape.rectangle", x=x, y=y, width=w, height=h, radius=10)

    textos = []          # (x, y, texto, tamanho, cor, justify) — criados depois, na camada rotulos

    def rot(x, y, t, tam=30, cor=ESCURO, j="center"):
        textos.append((x, y, t, tam, cor, j))

    def linha_celulas(top, rotulos, w, h, y0=230):
        n = len(rotulos)
        gap = (L - 2 * M - n * w) / max(n - 1, 1)
        for i, r in enumerate(rotulos):
            x = M + i * (w + gap)
            celula(x, top + y0, w, h)
            rot(x + w / 2, top + y0 + h - 40, r, 30)

    for (nome, alt, sub), top in zip(PRANCHETAS, tops):
        rot(M, top + 120, nome, 72, ESCURO, "left")
        rot(M, top + 170, sub, 28, GUIA, "left")
        rot(L - M, top + 120, nome_personagem, 40, ESCURO, "right")
        cheio_guia(); vc("shape.line", x1=M, y1=top + 195, x2=L - M, y2=top + 195)

    # 1 · Identidade
    t = tops[0]
    celula(M, t + 240, 1100, 1240); rot(M + 550, t + 1440, "frente · pose de apresentação", 32)
    celula(M + 1140, t + 240, 700, 1240); rot(M + 1490, t + 1440, "silhueta (só a forma, #462416)", 32)
    ex, ew = M + 1880, L - M - (M + 1880)
    celula(ex, t + 240, ew, 820, chao=False)
    chao = t + 240 + 760
    cheio_guia(); vc("shape.line", x1=ex + 30, y1=chao, x2=ex + ew - 30, y2=chao)
    for k, val in enumerate((0.5, 1.0, 1.5, 2.0, 2.5)):
        yy = chao - val * CESTO
        if yy < t + 260:
            break
        tracejado() if val != 1.0 else cheio_guia()
        vc("shape.line", x1=ex + 160, y1=yy, x2=ex + ew - 30, y2=yy)
        rot(ex + 30, yy + 10, f"{val:.1f}".replace(".", ",") + (" cesto" if val == 1.0 else ""), 26, GUIA, "left")
    rot(ex + 30, chao + 10, "0", 26, GUIA, "left")
    rot(ex + 420, chao + 50, "Mangaio (1,0)", 30)
    rot(ex + ew - 520, chao + 50, "o personagem (altura da ficha)", 30)
    rot(ex + 30, t + 290, "escala no elenco · 1 cesto = 250 px · pés na linha de chão", 28, GUIA, "left")
    # rampas de cor: 4 rampas × 5 tons
    ry = t + 1100
    rot(ex, ry, "rampas de cor (paleta.json) · luz → profunda", 30, ESCURO, "left")
    for r in range(4):
        yy = ry + 30 + r * 100
        rot(ex, yy + 55, f"rampa {r + 1}", 26, GUIA, "left")
        for k, tom in enumerate(RAMPA):
            caixa(ex + 200 + k * 130, yy, 110, 80)
            if r == 3:
                rot(ex + 255 + k * 130, yy + 115, tom, 22, GUIA)
    rot(M, t + 1530, "altura: __ cestos · forma dominante: __ · rampas: __ · nunca: __ (ver a ficha em personagens/)", 28, GUIA, "left")

    # 2 · Vistas
    linha_celulas(tops[1], VISTAS, 800, 640)
    # 3 · Expressões
    linha_celulas(tops[2], EXPRESSOES, 370, 580)
    # 4 · Bocas
    linha_celulas(tops[3], BOCAS, 400, 420)
    # 5 · Repertório
    linha_celulas(tops[4], [f"pose {i}" for i in range(1, 7)], 540, 680)
    # 6 · Peças do rig
    t6 = tops[5]
    zonas = [("olhos", "oval · meia · triste · decidido · arco · fechado · grande"),
             ("bocas", "aberta · torta · o · o_pequeno · triste · firme · ondulada · reta"),
             ("braços e pernas", "reto (gira no ombro) · alto · tocos · pivô = ombro / quadril"),
             ("objetos", "o que ele segura ou carrega (colher, folha, frutas…) · pivô = a pega")]
    zw = (L - 2 * M - 3 * 40) / 4
    for i, (z, d) in enumerate(zonas):
        x = M + i * (zw + 40)
        celula(x, t6 + 240, zw, 760, chao=False)
        rot(x + 30, t6 + 300, z, 40, ESCURO, "left")
        rot(x + 30, t6 + 345, d, 22, GUIA, "left")
    rot(M, t6 + 1080, "ids do rig (animacao.md §2): corpo · rosto > olho-esq, olho-dir, boca, bochechas · braco-esq, braco-dir · "
                       "perna-esq, perna-dir · acess-* · prop-* · sombra   |   pivô: data-pivo=\"x y\" no grupo", 28, GUIA, "left")
    rot(M, t6 + 1130, "cores: só as da paleta.json · sem contorno · sem gradiente · escuro = #462416, nunca preto", 28, GUIA, "left")

    # trava as guias, cria rotulos e arte
    vc("layer.setProps", id=guias, locked=True)
    vc("layer.new", name="rotulos", top=True)
    vc("select.none")
    for x, y, tx, tam, cor, j in textos:
        vc("text.create", x=x, y=y, text=tx, size=tam, font=FONTE, color=cor, justify=j)
    vc("layer.new", name="arte", top=True)
    return altura_total


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--vivo", action="store_true", help="mandar para o app aberto (--control 7979)")
    ap.add_argument("--porta", type=int, default=7979)
    ap.add_argument("--nome", default="NOME DO PERSONAGEM")
    ap.add_argument("--salvar", help="caminho .vectorcraft (e .png ao lado)")
    a = ap.parse_args()
    if a.vivo:
        vc = Vivo(a.porta)
        montar(vc, a.nome)
        if a.salvar:
            print(vc("file.saveAs", path=str(Path(a.salvar).resolve())))
    else:
        vc = Lote()
        montar(vc, a.nome)
        if not a.salvar:
            sys.exit("sem --vivo, informe --salvar")
        vc.cmds.append({"command": "file.saveAs", "params": {"path": str(Path(a.salvar).resolve())}})
        cli = Path.home() / "AppData/Local/Programs/ArtCraft/VectorCraft/vectorcraft-cli.exe"
        with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False, encoding="utf-8") as f:
            json.dump(vc.cmds, f, ensure_ascii=False)
        subprocess.run([str(cli), "run", "--commands", f.name], check=True)


if __name__ == "__main__":
    main()
