"""Braços novos do Mangaio (peças de rig), v2: derivados das medidas do braço oficial.

Revisão de arte (2026-11-07) reprovou a v1 (remo comprido, bastão, bengala). A v2
segue o braço oficial do mascote.svg, que é um bracinho curto e grosso com uma luva
redonda na ponta:
  - comprimento ombro -> centro da luva <= 1,2x o oficial (~105 px no oficial)
  - antebraço com ~60 px de grossura (raio 28-33) e luva de ~100 x 90 px (o oficial
    tem ~95 px de luva)
  - patinha em #E49340 (a base do braço oficial) com a borda em #B0581E (a sombra
    do oficial) do lado de dentro e de baixo: desenhamos a forma inteira na cor da
    borda e, por cima, a mesma forma um pouco menor e deslocada para a luz
    (de cima, da esquerda). Sobra uma meia-lua de sombra, como no oficial.
  - leve irregularidade no raio (pincel), nada de círculo de régua

Cada peça é gerada a partir de uma "espinha" (ombro -> cotovelo -> punho) e de uma
luva (elipse orientada pela espinha, com polegar opcional).

Coordenadas locais: ombro em (0,0) = pivô. A peça é do braço da DIREITA de quem
olha (fora = +x, cima = -y); o da esquerda é o espelho (scale(-1 1)).

Estrutura do <g> gerado (o motor gira o grupo .giro, cujo (0,0) é o ombro):
  <g id="braco-dir-alto" data-pivo="x y" transform="translate(x y)">
    <g class="giro" transform="rotate(a)"> <g transform="scale(±1 1)"> paths </g> </g>
  </g>
"""
import math

BASE, BORDA = "#E49340", "#B0581E"
# Ombro real (onde a patinha sai do corpo), nas coordenadas do mascote.svg.
# Medido no contorno do braço oficial (o pivô antigo do cena.js, 448/97, cai fora da patinha).
OMBRO = {"dir": (490.0, 446.0), "esq": (46.0, 452.0)}

# Cada peça: espinha (3 pontos de Bézier quadrática), raios do antebraço (ombro, punho),
# luva (comprimento ao longo da espinha, largura, avanço do centro além do punho),
# polegar opcional (posição relativa à luva em coords da luva: u ao longo, v de lado, raio).
PECAS = {
    # alto: luva acima do ombro, aberta para fora (susto, encanto, no ar, dança)
    "alto":   dict(esp=[(0, 0), (46, -14), (54, -84)], r=(33, 29), luva=(100, 90, 16), polegar=(-4, -44, 17)),
    # aponta: estica para o lado, luva mais estreita com polegar para cima (apontar, "não vai")
    "aponta": dict(esp=[(0, 0), (52, 10), (100, -2)], r=(32, 28), luva=(98, 72, 16), polegar=(-14, -40, 16)),
    # segura: sobe e a luva vira para dentro, palma para cima, encostada na borda (carregar_tudo)
    "segura": dict(esp=[(0, 0), (46, -36), (16, -88)], r=(33, 29), luva=(84, 100, 12), polegar=(6, 48, 16)),
    # punho: curto, luva fechada e redonda (decidido)
    "punho":  dict(esp=[(0, 0), (34, -10), (38, -58)], r=(33, 30), luva=(90, 88, 14), polegar=None),
}
# giro padrão de cada peça (graus, para fora), quando usada como pose
GIRO = {"alto": 0, "aponta": -6, "segura": 0, "punho": 0}


def _bez(p, s):
    (x0, y0), (x1, y1), (x2, y2) = p
    a, b, c = (1 - s) ** 2, 2 * (1 - s) * s, s * s
    return a * x0 + b * x1 + c * x2, a * y0 + b * y1 + c * y2


def _tan(p, s):
    (x0, y0), (x1, y1), (x2, y2) = p
    dx = 2 * (1 - s) * (x1 - x0) + 2 * s * (x2 - x1)
    dy = 2 * (1 - s) * (y1 - y0) + 2 * s * (y2 - y1)
    n = math.hypot(dx, dy) or 1
    return dx / n, dy / n


def _suave(pts):
    """Polígono fechado -> path com curvas Catmull-Rom (bordas de pincel, sem quinas)."""
    n = len(pts)
    d = [f"M{pts[0][0]:.1f} {pts[0][1]:.1f}"]
    for i in range(n):
        p0, p1, p2, p3 = pts[i - 1], pts[i], pts[(i + 1) % n], pts[(i + 2) % n]
        c1 = (p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6)
        c2 = (p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6)
        d.append(f"C{c1[0]:.1f} {c1[1]:.1f} {c2[0]:.1f} {c2[1]:.1f} {p2[0]:.1f} {p2[1]:.1f}")
    return "".join(d) + "Z"


def _antebraco(esp, r0, r1, encolhe=0.0, desl=(0.0, 0.0), semente=0.0):
    """Contorno do antebraço: a espinha com raio que vai de r0 a r1, pontas redondas."""
    esq, dir_ = [], []
    N = 14
    for i in range(N + 1):
        s = i / N
        x, y = _bez(esp, s)
        tx, ty = _tan(esp, s)
        nx, ny = -ty, tx
        r = (r0 + (r1 - r0) * s) * (1 + 0.035 * math.sin(6.3 * s + semente)) - encolhe
        esq.append((x + nx * r + desl[0], y + ny * r + desl[1]))
        dir_.append((x - nx * r + desl[0], y - ny * r + desl[1]))
    # tampa do ombro (fica escondida no corpo) e tampa do punho (fica dentro da luva)
    x0, y0 = esp[0]
    tx, ty = _tan(esp, 0)
    r = r0 - encolhe
    cap0 = [(x0 - tx * r * 0.9 + desl[0], y0 - ty * r * 0.9 + desl[1])]
    return esq + list(reversed(dir_)) + cap0


def _elipse(cx, cy, a, b, ang, encolhe=0.0, desl=(0.0, 0.0), semente=0.0, n=16):
    pts = []
    ca, sa = math.cos(ang), math.sin(ang)
    for i in range(n):
        t = 2 * math.pi * i / n
        k = 1 + 0.03 * math.sin(3 * t + semente)
        u, v = (a / 2 * k - encolhe) * math.cos(t), (b / 2 * k - encolhe) * math.sin(t)
        pts.append((cx + u * ca - v * sa + desl[0], cy + u * sa + v * ca + desl[1]))
    return pts


# a luz vem de cima e da esquerda; no braço da direita a borda fica à esquerda/embaixo
LUZ = (7.0, -5.0)
ENCOLHE = 7.0


def formas(nome):
    """(sombra, base): duas listas de paths, em coords locais do braço da direita."""
    p = PECAS[nome]
    esp, (r0, r1) = p["esp"], p["r"]
    comp, larg, avanco = p["luva"]
    tx, ty = _tan(esp, 1)
    px, py = esp[2]
    cx, cy = px + tx * avanco, py + ty * avanco
    ang = math.atan2(ty, tx)
    sombra, base = [], []
    for alvo, enc, desl in ((sombra, 0.0, (0.0, 0.0)), (base, ENCOLHE, LUZ)):
        alvo.append(_suave(_antebraco(esp, r0, r1, enc, desl, semente=len(nome))))
        alvo.append(_suave(_elipse(cx, cy, comp, larg, ang, enc, desl, semente=len(nome) * 1.7)))
        if p["polegar"]:
            u, v, rp = p["polegar"]
            gx = cx + u * math.cos(ang) - v * math.sin(ang)
            gy = cy + u * math.sin(ang) + v * math.cos(ang)
            alvo.append(_suave(_elipse(gx, gy, rp * 2.2, rp * 1.8, ang + 0.6, enc * 0.6, desl, n=10)))
    return sombra, base


def paths_svg(nome):
    sombra, base = formas(nome)
    return "".join(f'<path d="{d}" fill="{BORDA}"/>' for d in sombra) + \
           "".join(f'<path d="{d}" fill="{BASE}"/>' for d in base)


def peca_svg(nome, lado, x=None, y=None, giro=None, escala=1.0, id_=None):
    """<g> do braço: o grupo externo põe o ombro em (x,y); .giro gira em volta do ombro."""
    ox, oy = OMBRO[lado]
    x = ox if x is None else x
    y = oy if y is None else y
    esp = 1 if lado == "dir" else -1
    giro = GIRO[nome] if giro is None else giro
    id_attr = f' id="{id_}"' if id_ else ""
    return (f'<g{id_attr} data-pivo="{x:.0f} {y:.0f}" transform="translate({x:.1f} {y:.1f})">'
            f'<g class="giro" transform="rotate({giro * esp:.1f})">'
            f'<g transform="scale({esp * escala:g} {escala:g})">{paths_svg(nome)}</g></g></g>')


if __name__ == "__main__":
    # prova: as 4 peças, nos dois lados, sobre o mascote (python mangaio_bracos.py prova.svg)
    import re
    import sys
    from pathlib import Path
    serie = Path(__file__).resolve().parents[2]
    m = (serie / "mascote.svg").read_text(encoding="utf-8")
    corpo = m[m.index('<g id="mascote">'):m.rindex("</svg>")]
    corpo = re.sub(r'<g id="braco-(dir|esq)">.*?</g>\s*</g>', "", corpo, flags=re.S)
    out = []
    for i, nome in enumerate(PECAS):
        out.append(f'<g transform="translate({i * 600 + 40} 60)">{corpo}'
                   f'{peca_svg(nome, "dir")}{peca_svg(nome, "esq")}</g>')
    svg = (f'<svg xmlns="http://www.w3.org/2000/svg" width="{600 * len(PECAS)}" height="720" viewBox="0 0 {600 * len(PECAS)} 720">'
           f'<rect width="100%" height="100%" fill="#F7E8C6"/>{"".join(out)}</svg>')
    Path(sys.argv[1]).write_text(svg, encoding="utf-8")
