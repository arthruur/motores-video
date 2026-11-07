"""Reel "Saudade da Jam": corte 9:16 dos brutos da Jam (tmp_drive/jam150) na batida de "Olhos Coloridos".

Uso: python receitas/jam-na-praca/montar_reel1.py [--previa]
A prévia sai em 540x960. Sem a flag, sai em 1080x1920 e exporta os quadros e a trilha para a cena
(cena.html, que põe os desenhos por cima; ver gerar.mjs).
"""
import subprocess
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[2]
BRUTOS = RAIZ / "tmp_drive" / "jam150"
SAIDA = RAIZ / "saida" / "jam-na-praca"
COMPASSO = 1.8  # ~133 BPM, 4 batidas

# (arquivo, início no bruto, compassos, centro do recorte 0..1)
PLANOS = [
    ("C1346", 27.5, 2, 0.45),   # palco olhando a plateia
    ("C1341", 20.0, 2, 0.47),   # a roda sob a árvore
    ("C1346", 15.5, 1, 0.55),   # violino
    ("C1347", 0.5, 1, 0.40),    # trompete
    ("C1347", 12.0, 1, 0.50),   # flauta
    ("C1346", 54.0, 1, 0.50),   # praça cheia
    # solo de conga
    ("C1347", 16.6, 1, 0.25),   # mãos no couro
    ("C1346", 60.5, 1, 0.45),   # baqueta (ponto de vista)
    ("C1346", 25.0, 1, 0.50),   # pratos
    ("C1361", 9.5, 1, 0.50),    # solo de trompete
    ("C1347", 25.5, 1, 0.25),   # flauta e sax
    ("C1346", 42.5, 1, 0.60),   # sorriso
    ("C1341", 152.0, 1, 0.45),  # a banda junta
    ("C1346", 51.5, 1, 0.50),   # bateria de costas
    # volta da banda: espaço do cartão final
    ("C1346", 53.5, 2, 0.50),   # fachada e varal de luzes
    ("C1341", 176.0, 2, 0.47),  # plano aberto, fade
]

# trilha: refrão (8 compassos) + conga (8) + volta (4), cortes na batida
TRILHA = [(78.00, 8), (152.16, 8), (174.31, 4)]
# transições suaves: o áudio cruza em CRUZA[j] s antes de cada emenda (o trecho anterior é estendido
# para a emenda continuar no compasso); a volta do solo dissolve a imagem em DISSOLVE s
CRUZA = [0.45, 0.3]
DISSOLVE = (14, 0.6)  # (índice do primeiro plano depois do solo, duração)


def main():
    previa = "--previa" in sys.argv
    W, H = (540, 960) if previa else (1080, 1920)
    SAIDA.mkdir(parents=True, exist_ok=True)
    total = sum(c for *_, c, _ in PLANOS) * COMPASSO

    args = ["ffmpeg", "-v", "error", "-y"]
    filtros, rotulos = [], []
    di, dd = DISSOLVE
    for i, (arq, ini, comp, cx) in enumerate(PLANOS):
        dur = comp * COMPASSO
        if i == di:  # começa antes para a dissolução terminar exatamente na emenda
            ini, dur = ini - dd, dur + dd
        args += ["-ss", f"{ini}", "-t", f"{dur + 0.1}", "-i", str(BRUTOS / f"{arq}.MP4")]
        filtros.append(
            f"[{i}:v]trim=0:{dur},setpts=PTS-STARTPTS,fps=30,"
            f"crop=ih*9/16:ih:(iw-ih*9/16)*{cx}:0,scale={W}:{H}:flags=lanczos,"
            # leve correção: tira o verde da câmera e aquece
            f"colorbalance=gm=-0.04:gh=-0.03:rh=0.03:bm=-0.02,eq=contrast=1.06:saturation=1.08,setsar=1[v{i}]"
        )
        rotulos.append(f"[v{i}]")
    n = len(PLANOS)
    filtros.append(f"{''.join(rotulos[:di])}concat=n={di}:v=1:a=0[va]")
    filtros.append(f"{''.join(rotulos[di:])}concat=n={n - di}:v=1:a=0[vb]")
    emenda = sum(c for *_, c, _ in PLANOS[:di]) * COMPASSO
    filtros.append(f"[va][vb]xfade=transition=fade:duration={dd}:offset={emenda - dd}[v]")

    args += ["-i", str(BRUTOS / "C1341.MP4")]
    a = n
    partes = []
    for j, (ini, comp) in enumerate(TRILHA):
        fim = ini + comp * COMPASSO + (CRUZA[j] if j < len(CRUZA) else 0)
        filtros.append(f"[{a}:a]atrim={ini}:{fim},asetpts=PTS-STARTPTS[a{j}]")
        partes.append(f"[a{j}]")
    filtros.append(f"[a0][a1]acrossfade=d={CRUZA[0]}:c1=tri:c2=tri[a01]")
    filtros.append(f"[a01][a2]acrossfade=d={CRUZA[1]}:c1=tri:c2=tri,afade=t=in:d=0.15,afade=t=out:st={total-2.8}:d=2.6,"
                   f"loudnorm=I=-14:TP=-1.5,aresample=48000[a]")

    nome = "reel1-saudade" + ("-previa" if previa else "") + ".mp4"
    args += ["-filter_complex", ";".join(filtros), "-map", "[v]", "-map", "[a]",
             "-c:v", "libx264", "-preset", "medium", "-crf", "20" if not previa else "26",
             "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k", "-t", f"{total}",
             "-movflags", "+faststart", str(SAIDA / nome)]
    subprocess.run(args, check=True)
    print(SAIDA / nome, f"{total:.1f}s")
    if not previa:
        # quadros para o fundo da cena (cena.js troca a imagem a cada 1/30 s) e a trilha separada
        q = SAIDA / "quadros"
        q.mkdir(exist_ok=True)
        for f in q.glob("*.jpg"):
            f.unlink()
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(SAIDA / nome), "-q:v", "3",
                        str(q / "%04d.jpg")], check=True)
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(SAIDA / nome), "-vn", "-c:a", "pcm_s16le",
                        str(SAIDA / "reel1-trilha.wav")], check=True)
        print(q, len(list(q.glob("*.jpg"))), "quadros")
        # plano do palco inteiro em 16:9 para o zoom out (cena.js abre do recorte 9:16 até o quadro todo)
        arq, ini, comp, _ = PLANOS[1]
        qp = SAIDA / "quadros_palco"
        qp.mkdir(exist_ok=True)
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", f"{ini}", "-t", f"{comp * COMPASSO}",
                        "-i", str(BRUTOS / f"{arq}.MP4"), "-map", "0:v:0", "-vf",
                        "fps=30,scale=1920:1080:flags=lanczos,colorbalance=gm=-0.04:gh=-0.03:rh=0.03:bm=-0.02,"
                        "eq=contrast=1.06:saturation=1.08", "-q:v", "3", str(qp / "%04d.jpg")], check=True)
        print(qp, len(list(qp.glob("*.jpg"))), "quadros do palco")


if __name__ == "__main__":
    main()
