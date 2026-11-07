# Jam na Praça: reel "Saudade da Jam"

Reel de 36 s em 1080×1920 para o @jammnapraca, publicado em collab com @bistro153. São imagens da Jam Especial (junho de 2026), cortadas na batida de "Olhos Coloridos". A narrativa da saudade ("quem tá com saudade da Jam?" … "a gente também.") é escrita à mão em stop-motion. O palco abre em zoom out (`roteiro.json` → `palco`), e o solo de conga vira silhueta sobre campos de cor com créditos condensados (`bebop`), inspirado na abertura de Cowboy Bebop. O plano completo está em `PLANO.md`.

```bash
python receitas/jam-na-praca/montar_reel1.py            # corte 9:16 dos brutos → quadros + trilha (saida/jam-na-praca)
python receitas/jam-na-praca/montar_reel1.py --previa   # só o corte, em 540x960
python receitas/jam-na-praca/som.py                     # trilha + efeitos → reel1-som.wav
node motores/render/render.mjs receitas/jam-na-praca/cena.html --raiz . --fps 30 --crf 18 \
     --audio saida/jam-na-praca/reel1-som.wav --saida saida/jam-na-praca/reel1-saudade-da-jam.mp4
# folha de contato: troque --audio/--saida por --teste 1.6,5.2,15,29.75,33.5 --zonas
```

- `montar_reel1.py`: a lista `PLANOS` traz o arquivo, o início, os compassos e o centro do recorte. A lista `TRILHA` traz os trechos da música. Um compasso dura 1,8 s (cerca de 133 BPM).
- `roteiro.json`: os textos, as setas, as notas, os brilhos, a explosão do solo e a logo, com os tempos. O `som` de cada item vira um efeito sonoro em `som.py`. Os campos `conga` (soco de zoom e riscos de vibração na batida) e `tinta` (azul do cartão final) também ficam aqui.
- `cena.js` / `cena.css`: o desenho. Usa o kit dos promos (`../promo/kit.js`), com passos de 1/12 s, linha que ferve e entrada em carimbo. As cores são as da logo: azul `#005dba`, ciano `#00baf2` e branco.
- Os brutos ficam em `tmp_drive/jam150/`, fora do git, e vêm do Drive, conforme o PLANO.md.
- Música: "Olhos Coloridos" (Macau), tocada ao vivo na Jam. O Instagram pode silenciar o áudio. Nesse caso, publique com o áudio da biblioteca do app.
