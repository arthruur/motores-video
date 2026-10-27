"""Baixa as fotos do edit de Canudos (domínio público e CC) para fotos/, já reduzidas a 2000 px no lado maior.

    python receitas/canudos/baixar.py

O original baixado vai para uma pasta temporária e é apagado depois de reduzido: só fica o JPG de trabalho.
Créditos e licenças em README.md.
"""
import subprocess
import tempfile
from pathlib import Path

AQUI = Path(__file__).parent
FOTOS = AQUI / "fotos"
BN = "https://brasilianafotografica.bn.gov.br/brasiliana/bitstream/20.500.12156.1"
WM = "https://upload.wikimedia.org/wikipedia/commons"

FONTES = {
    "conselheiro": f"{WM}/f/fd/Conselheiro_Revista_Ilustrada.jpg",
    "vila": f"{WM}/5/56/Canudos_village.jpg",
    "mapa": f"{WM}/d/d8/Canudos_%28Cartogr%C3%A1fico%29_%E2%80%94_plano_de_opera%C3%A7%C3%B5es_de_Guerra_no_Estado_da_Bahia.jpg",
    "tropa": f"{WM}/7/7d/40th_infantry_batallion_canudos_1897.jpg",
    "incendio": f"{BN}/4862/1/P001FBAC67.jpg",
    "prisioneiros": f"{BN}/4860/1/P001FBAC65.jpg",
    "ruinas": f"{WM}/0/02/Ruins_church_in_canudos_1897.jpg",
    "seca": # miniatura de 2000 px: o arquivo original (3216 px) costuma voltar 429
        "https://commons.wikimedia.org/wiki/Special:FilePath/XXX_Celebra%C3%A7%C3%A3o_Popular_de_Canudos_(Ruinas_e_Seca_no_A%C3%A7ude)._Foto_Rita_Barreto_-_Bahiatursa_(10157922225).jpg?width=2000",
    "acude": f"{WM}/d/d4/Dam_Cocorob%C3%B3_A%C3%A7ude_Cocorob%C3%B3_%2823798031281%29.jpg",
}


def main() -> None:
    FOTOS.mkdir(exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        for nome, url in FONTES.items():
            alvo = FOTOS / f"{nome}.jpg"
            if alvo.exists():
                continue
            bruto = Path(tmp) / "bruto"
            # curl, e não urllib: a Brasiliana (Cloudflare) recusa o cliente do Python
            subprocess.run(["curl", "-sSfL", "--max-time", "120", "--retry", "4", "--retry-delay", "8", "-A", "motores-video/1.0 (receita canudos)",
                            "-o", str(bruto), url], check=True)
            subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", str(bruto),
                            "-vf", "scale='if(gt(iw,ih),min(2000,iw),-2)':'if(gt(iw,ih),-2,min(2000,ih))'",
                            "-q:v", "3", str(alvo)], check=True)
            print(alvo.name)


if __name__ == "__main__":
    main()
