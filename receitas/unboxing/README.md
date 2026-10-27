# Unboxing de maquiagem: vídeo motion

Vídeo vertical (1080×1920, 45 s, com efeitos sonoros) que apresenta 10 produtos como um unboxing. Uma capa de pele de onça com uma etiqueta ("abre comigo?" e uma marca de beijo) rasga e revela a onça desenhada à mão. Depois, cada produto é pousado solto, só com a borda de papel do recorte, sobre papel rasgado (pele de onça ou papel vinho). Na troca de um produto para o outro, a folha inteira rasga: o rasgo começa numa ponta, corre até a outra e mostra a fibra branca do papel. No fim, o kit todo junto, com a onça espiando. A estética segue o convite de referência: creme, vinho, letra de pincel com contorno e rabisco vinho à mão. Os traços "tremem" como animação feita à mão.

```bash
python receitas/unboxing/preparar.py "C:/pasta/com/as/fotos"   # recortes + texturas (~1,5 min)
python receitas/unboxing/som/baixar.py                          # efeitos CC0 que faltavam (uma vez)
node receitas/unboxing/gerar.mjs                                # → saida/unboxing/unboxing-maquiagem.mp4 (~2 min, com som)
node receitas/unboxing/gerar.mjs --mudo                         # sem som
node receitas/unboxing/gerar.mjs --teste                        # folha de contato (prévia em segundos)
node receitas/unboxing/gerar.mjs --quadro 11.85                 # um quadro em tamanho real
```

- `produtos.json` concentra tudo o que se edita:
  - `tempos`: duração de cada cena e do rasgo, em segundos.
  - A lista `produtos`, na ordem do vídeo. Cada item tem `foto` (nome do recorte), `nome`, `marca`, `nota` (frase escrita à mão), `enfeite` (`onca`, `beijo`, `flor` ou `estrelas`) e `brilho` (rabisco e som de brilho).
- `preparar.py` faz três coisas:
  - Tira o fundo das fotos com rembg e põe a borda de papel recortado (`recortes/`).
  - Gera a pele de onça: um mapa de rosetas pintado com pelos que seguem um campo de direção (`texturas/onca.jpg`).
  - Gera o papel creme e o papel vinho, com fibras.
- `desenhos.js` tem a onça (traço vinho com giz deslocado, como risografia), o beijo e os rabiscos.
- `cena.js` e `cena.css` têm a coreografia (contrato em `motores/render/CONTRATO.md`).
- `som/mixar.py` põe os efeitos nos tempos da animação e normaliza para −14 LUFS: rasgo de papel, "whoosh", pouso do produto, lápis escrevendo e desenhando, carimbo do beijo, "pop" das letras e brilho. Os tempos dentro de cada cena espelham `cena.js`. Sons CC0 do Freesound, com créditos em `som/creditos.json` e em `receitas/promo/som/creditos.json`.
- Fontes: Pacifico e Caveat Brush (OFL, em `fontes/`).
