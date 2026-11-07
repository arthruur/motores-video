"""Rosto padrão do elenco (ARTE.md §6), congelado num módulo estável.

As formas vêm do mascote.svg (olho oval e boca aberta oficiais) e das formas novas de olho e boca
do cesto_folha.py (folha do Mangaio), copiadas aqui em 2026-11-07 para que os outros personagens não
quebrem quando a folha do Mangaio mudar. Mudou o rosto do Mangaio? Copie de novo, de propósito.

Coordenadas: as do mascote.svg (534x627). Formas "locais" têm centro (0,0).
Quem usa: dona_mandioca_rig.py (e quem mais quiser o rosto padrão).
"""

ESCURO = "#462416"
BOCA_IN = "#C5441E"
DENTE = "#FFF8EA"              # tinta.brilho_olho (paleta.json): o único branco do rosto

OLHO = {"esq": (185.0, 490.0), "dir": (364.0, 477.0)}   # centros medidos no mascote.svg
MEIO_OLHOS = (274.5, 483.5)
BOCA = (277.0, 512.0)
INCL = -4.0                                              # o rosto do Mangaio sobe para a direita

# olho oval oficial (mascote.svg, ids olho-esq / olho-dir)
OLHO_OVAL = {
    "esq": "M197.339 516.197C174.655 531.275 161.726 499.604 164.843 479.932C182.866 427.571 226.891 490.626 197.339 516.197Z",
    "dir": "M383.07 468.595C392.45 491.02 370.917 521.904 350.775 499.441C328.839 468.201 365.009 420.378 383.07 468.595Z",
}

# boca aberta oficial (mascote.svg, grupo boca): [(d, cor)]
BOCA_ABERTA = [
    ("M302.789 529.376C294.08 505.292 260.97 510.251 251.925 532.992C234.286 522.652 228.004 500.63 233.835 494.895"
     "C257.085 489.485 283.807 494.05 307.364 484.536C329.866 477.352 324.59 510.03 302.779 529.376H302.789Z", ESCURO),
    ("M302.789 529.376C288.574 540.848 266.878 541.749 251.925 532.983C253.814 505.138 306.558 506.241 302.789 529.376Z", BOCA_IN),
]

# formas de olho locais (centro 0,0; lado "esq"; o "dir" é espelhado). Escala de uso: 1,3.
OLHOS = {
    "arco": "M-22 9C-21-15 21-15 22 9C22 15 14 16 13 10C10-4-10-4-13 10C-14 16-22 15-22 9Z",
    "meia": "M-21-3C-8-6 8-7 21-6C23 13 13 30 0 30C-13 30-23 15-21-3Z",
    "triste": "M-21 5C-6-2 8-9 20-15C25 3 15 30 0 30C-14 30-23 18-21 5Z",
    "decidido": "M-20-15C-8-9 6-2 21 4C23 18 13 30 0 30C-14 30-24 10-20-15Z",
    "fechado": "M-21 0C-9 6 9 6 21 0C23 5 22 11 19 11C9 15-9 15-19 11C-22 11-23 5-21 0Z",
}

# bocas de expressão locais (centro 0,0). Escala de uso: 1,7.
BOCAS = {
    "sorriso_fechado": [("M-24-6C-12 7 12 7 24-6C26-2 24 3 21 5C9 15-9 15-21 5C-24 3-26-2-24-6Z", ESCURO)],
    "firme": [("M-18-2C-6 3 8 1 20-5C22-1 21 4 18 5C6 10-6 10-18 6C-21 5-21 0-18-2Z", ESCURO)],
    "triste": [("M-17 8C-10-6 10-6 17 8C18 12 14 13 12 11C6 3-6 3-12 11C-14 13-18 12-17 8Z", ESCURO)],
    "o": [("M0-15C11-15 15-6 15 3C15 12 9 18 0 18C-9 18-15 12-15 3C-15-6-11-15 0-15Z", ESCURO),
          ("M0 4C7 4 11 8 10 12C8 16 4 18 0 18C-4 18-8 16-10 12C-11 8-7 4 0 4Z", BOCA_IN)],
    "o_pequeno": [("M0-9C7-9 9-4 9 2C9 8 5 11 0 11C-5 11-9 8-9 2C-9-4-7-9 0-9Z", ESCURO)],
    "torta": [("M-14 2C-4 0 6-2 16-7C18-3 17 1 14 2C4 6-5 7-13 7C-17 7-17 3-14 2Z", ESCURO)],
    "ondulada": [("M-14 2C-9-3-5-3 0 2C5-3 9-3 14 2C15 5 13 7 11 6C8 3 5 3 2 6C0 8-2 8-4 6C-6 3-9 3-11 6"
                  "C-13 7-15 5-14 2Z", ESCURO)],
    "reta": [("M-16-1C-5 1 6 1 17-1C19 2 18 6 16 6C6 8-6 8-16 6C-19 6-19 1-16-1Z", ESCURO)],
}

# 8 bocas de sincronia (animacao.md §4), locais, mesma escala 1,7. Desenhadas para o elenco que fala,
# na linguagem da boca do Mangaio (cheia, escuro + interior). Diferença de abertura bem marcada:
# A alta com língua, E larga e baixa, I dentes quase juntos, O redonda média, U pequena e projetada,
# FV com a faixa de dentes sobre o lábio de baixo.
BOCAS_SINC = {
    "boca-repouso": BOCAS["sorriso_fechado"],
    "boca-MBP": [("M-19-1C-8-5 8-5 19-1C22 2 20 7 16 7C6 5-6 5-16 7C-20 7-22 2-19-1Z", ESCURO)],
    "boca-A": [("M-22-9C-10-5 10-5 22-9C25 9 15 31 0 31C-15 31-25 9-22-9Z", ESCURO),
               ("M-13 19C-6 12 6 12 13 19C9 27 5 29 0 29C-5 29-9 27-13 19Z", BOCA_IN)],
    "boca-E": [("M-29-6C-12-1 12-1 29-6C29 4 18 15 0 15C-18 15-29 4-29-6Z", ESCURO),
               ("M-14 9C-5 5 5 5 14 9C9 13 5 14 0 14C-5 14-9 13-14 9Z", BOCA_IN)],
    "boca-I": [("M-27-4C-10 0 10 0 27-4C27 4 16 10 0 10C-16 10-27 4-27-4Z", ESCURO),
               ("M-17-1C-6 1 6 1 17-1C15 3 7 4 0 4C-7 4-15 3-17-1Z", DENTE)],
    "boca-O": [("M0-16C12-16 16-6 16 4C16 14 9 21 0 21C-9 21-16 14-16 4C-16-6-12-16 0-16Z", ESCURO),
               ("M0 6C7 6 11 10 10 14C8 18 4 20 0 20C-4 20-8 18-10 14C-11 10-7 6 0 6Z", BOCA_IN)],
    "boca-U": [("M0-8C6-8 8-4 8 1C8 7 5 10 0 10C-5 10-8 7-8 1C-8-4-6-8 0-8Z", ESCURO),
               ("M0 2C3 2 4 4 4 6C4 8 2 9 0 9C-2 9-4 8-4 6C-4 4-3 2 0 2Z", BOCA_IN)],
    "boca-FV": [("M-21-7C-8-3 8-3 21-7C22 2 14 10 0 10C-14 10-22 2-21-7Z", ESCURO),
                ("M-15-4C-5-2 5-2 15-4C14 0 7 2 0 2C-7 2-14 0-15-4Z", DENTE),
                ("M-10 6C-4 4 4 4 10 6C6 9 3 9 0 9C-3 9-6 9-10 6Z", BOCA_IN)],
}

# sobrancelha: forma curta e CHEIA, ponta em gota (ARTE.md §6). Local, pivô na ponta de dentro (+x = para dentro
# no lado "esq"; espelhar no "dir").
SOBR = "M-27 7C-20-9 12-15 28-4C32 1 29 9 22 8C10 3-9 5-17 14C-23 19-31 14-27 7Z"
