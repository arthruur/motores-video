# exemplo: colagem "O que é democracia?"

Quatro falas reais, de quatro pessoas e ocasiões diferentes, montadas num reel 9:16 de 66 s por sentido (promessa → condição → exigência → movimento), com nome, data, ocasião e **fonte com o minuto** em cada fragmento, e o cartão final com todas as fontes:

1. **Ulysses Guimarães**, 5/10/1988: "Hoje, 5 de outubro de 1988, no que tange à Constituição, a Nação mudou."
2. **Lélia Gonzalez**, 20/11/1983: "[...] para ser uma democracia racial, esse país tem que ser efetivamente uma democracia."
3. **Marielle Franco**, 8/3/2018: "[...] socialmente igual, humanamente diferente e totalmente livre [...]"
4. **Paulo Freire**, 17/4/1997: "[...] essas marchas nos afirmam como gente, como sociedade, querendo democratizar-se."

```bash
python exemplos/colagem-democracia/baixar.py                                   # yt-dlp: os 4 trechos em entrada/ (~32 MB)
python -m motores.colagem.cli montar exemplos/colagem-democracia/colagem.json  # -> saida/colagem-democracia/
python -m motores.colagem.cli folha  saida/colagem-democracia/colagem-o-que-e-democracia.mp4
```

Rode da raiz do repositório, com o venv ativo (`pip install -r requirements.txt`), **`pip install yt-dlp`** e `ffmpeg` com libass no PATH. O `montar` não precisa de Whisper nem de modelo de embedding: a transcrição palavra a palavra já está em `palavras/`. Não usa o Chrome.

Para experimentar a **busca por tema**, instale os opcionais do motor (`pip install -r motores/colagem/requisitos.txt`, ~1,5 GB de modelo na 1ª vez) e:

```bash
python -m motores.colagem.cli indexar exemplos/colagem-democracia/fontes.json --opcionais    # + Krenak, Brizola, Carolina
python -m motores.colagem.cli sugerir exemplos/colagem-democracia/fontes.json "o que é democracia" --opcionais
#   abra saida/colagem-democracia/candidatos-o-que-e-democracia.html, ouça, escolha e edite o colagem.json
```

Com `--opcionais`, o `baixar` também traz as outras 3 falas, e o `indexar` transcreve as que não têm `palavras/` (o passo caro: o Whisper `small` levou de 0,5 a 1,5× a duração do áudio no notebook do README).

## Mídia de terceiros: crédito e direito de citação

- **Os vídeos não estão no repositório e nunca devem entrar nele.** O `baixar.py` baixa só os trechos para `entrada/`, que o git ignora. URL, trecho e crédito de cada fala estão em [`fontes.json`](fontes.json).
- **Os direitos dos vídeos são dos seus titulares** (tabela abaixo). O exemplo usa trechos curtos como **citação**, para estudo, com o nome de quem fala, a data, a ocasião e o link com o minuto na tela o tempo todo, e o cartão final com todas as fontes. É o que a Lei 9.610/98 permite no art. 46, III: citar passagens de uma obra "para fins de estudo, crítica ou polêmica, na medida justificada para o fim a atingir, indicando-se o nome do autor e a origem da obra". Isto não é orientação jurídica. Se for publicar, mantenha os créditos e respeite os termos da plataforma.
- **O que está no repositório é texto:** a transcrição automática (Whisper `small`) dos trechos em `palavras/` e a fala conferida de cada fragmento em `revisao/`. Nenhuma imagem, nenhum áudio.
- **É uma montagem, e ela diz isso.** As quatro pessoas não fizeram este argumento juntas. O cartão final avisa: "falas de ocasiões diferentes, postas lado a lado"; "o sentido do conjunto é da montagem, não de quem falou". Ver a ética da montagem em [docs/colagem.md](../../docs/colagem.md).

| Fala | Canal (crédito) | Vídeo | Trecho baixado |
|---|---|---|---|
| Ulysses Guimarães, promulgação da Constituição, Plenário da Câmara, 5/10/1988 | Câmara dos Deputados (TV Câmara), publicado em 6/10/2023 | [B-kYyLSJ3mY](https://www.youtube.com/watch?v=B-kYyLSJ3mY) | inteiro (2:24) |
| Lélia Gonzalez, Marcha do Movimento Negro no Dia da Consciência Negra, Rio de Janeiro, 20/11/1983 | Cultne, publicado em 14/11/2012 | [BFnvKcsLqJI](https://www.youtube.com/watch?v=BFnvKcsLqJI) | inteiro (3:44) |
| Marielle Franco, grande expediente do Dia Internacional da Mulher, Câmara Municipal do Rio, 8/3/2018 | Instituto Marielle Franco, publicado em 11/5/2022 | [fl8czAgJGUE](https://www.youtube.com/watch?v=fl8czAgJGUE) | 4:25–5:00 |
| Paulo Freire, última entrevista, TV PUC-SP (Luciana Burlamaqui), 17/4/1997 | Daniel Caires, publicado em 29/12/2018 (produção TV PUC-SP) | [LN43PJCBG2M](https://www.youtube.com/watch?v=LN43PJCBG2M) | 4:15–4:40 |

O vídeo do Ulysses já é **uma montagem da TV Câmara** (2023): fotos de arquivo sobre o áudio e trechos do discurso emendados fora da ordem. Por isso o fragmento começa em "Hoje" (o vocativo que vinha antes no vídeo é emenda da TV Câmara, não do discurso) e a etiqueta avisa: "áudio em trechos e fotos de arquivo".

## Arquivos

| Arquivo | O que é |
|---|---|
| `fontes.json` | As 4 falas da colagem e, em `fontes_opcionais`, mais 3 (Ailton Krenak, Leonel Brizola, Carolina Maria de Jesus) para experimentar a busca. Formato no [README do motor](../../motores/colagem/README.md) |
| `colagem.json` | A montagem: abertura, os 4 fragmentos (tempos dentro do trecho baixado), o porquê de cada um, cartão final e nota de ética |
| `revisao/<id>.txt` | O texto que vai para a legenda. Conferido contra um segundo Whisper (`large-v3-turbo`) e, no Ulysses, contra o discurso publicado; **ainda não de ouvido** |
| `palavras/<slug>.json` | Transcrição palavra a palavra (Whisper `small`) de cada trecho, para o `montar` não precisar transcrever |
| `baixar.py` | Atalho para `python -m motores.colagem.cli baixar` com este `fontes.json` (`--de PASTA` copia vídeos já baixados) |

O `autor` do `colagem.json` é "Claude (simulando o criador)": no laboratório, quem escolheu e ordenou foi o Claude, a partir da página de candidatos. Numa oficina, quem monta escreve o próprio `colagem.json` e assina.

## Números

No notebook do README (Ryzen 7 5700U, sem GPU):

| O quê | Resultado |
|---|---|
| `baixar.py` com yt-dlp (4 trechos, 32 MB) | 62,3 s |
| `montar` | 64,4 s numa rodada, 147,3 s noutra com a CPU dividida |
| Vídeo final | 66,3 s (faixa pedida: 45–75 s), 1080×1920, 30 fps, 38,4 MB |
| Áudio final | −14,1 LUFS, pico −1,4 dBTP |
| Revisão × Whisper | 1, 7, 0 e 0 trechos diferentes (Ulysses, Lélia, Marielle, Freire) |

A ficha (`ficha-o-que-e-democracia.json`) acusa `"Inclusive,"` cortada na Marielle. No laboratório isso foi conferido como alarme falso: o Whisper `small` põe a palavra 0,2 s antes do lugar onde ela está, e o áudio está em silêncio no corte.
