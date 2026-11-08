"""Monta as peças da demo da Dona Mandioca a partir do rig v2 (arte/folhas/dona_mandioca_rig.py).

    python receitas/novela-da-caatinga/demos/dona-mandioca/montar.py   -> demos/dona-mandioca/vistas.js

O rig é paramétrico na vista (theta). Aqui ele sai como 24 rigs completos, de 15 em 15 graus
(0 = frente, 90 = perfil olhando para a direita da tela, 180 = costas), todos com os mesmos ids e
todas as peças trocáveis (olho-*-<forma>, sobr-*-<modo>, boca-*, braco-*-reto/cintura/cruzado,
prop-colher-*/prop-abano-*). A cena (cena.js) põe UMA vista por vez no palco e anima o rig por
cima dela: virar devagar é trocar de vista "em dois", como num recorte de stop-motion.
"""
import json
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

AQUI = Path(__file__).resolve().parent
SERIE = AQUI.parents[1]
sys.path.insert(0, str(SERIE / "arte" / "folhas"))
import dona_mandioca_rig as dm  # noqa: E402

PASSO = 15


def main():
    vistas = {}
    for th in range(0, 360, PASSO):
        no = dm.dona_mandioca(theta=th, rig_completo=True)
        s = ET.tostring(no, encoding="unicode").replace(' xmlns="http://www.w3.org/2000/svg"', "")
        s = s.replace("ns0:", "").replace(' xmlns:ns0="http://www.w3.org/2000/svg"', "")
        vistas[th] = s
    meta = {"passo": PASSO, "chao": dm.CHAO, "meio": dm.MEIO, "quadril": dm.QUADRIL_Y,
            "topo": dm.TOPO_CABECA, "rosto_y": dm.ROSTO_Y}
    out = AQUI / "vistas.js"
    out.write_text("// gerado por montar.py (não editar à mão)\nwindow.DM_META = " + json.dumps(meta) +
                   ";\nwindow.DM_VISTAS = " + json.dumps(vistas, ensure_ascii=False) + ";\n", encoding="utf-8")
    print(out, f"{out.stat().st_size / 1e6:.1f} MB", len(vistas), "vistas")


if __name__ == "__main__":
    main()
