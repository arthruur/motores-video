# exemplo: karaokê de um discurso (Ulysses Guimarães, 5/10/1988)

Um trecho de discurso de arquivo vira um reel 9:16 com legenda palavra a palavra, crédito e fonte na tela, por um comando só:

```bash
python exemplos/karaoke-discurso/gerar.py            # baixa o trecho se faltar, alinha, compõe, legenda
python exemplos/karaoke-discurso/gerar.py --zonas    # folha de contato com a zona segura em vermelho
python exemplos/karaoke-discurso/baixar.py           # só o download (o gerar.py já chama)
python exemplos/karaoke-discurso/gerar.py --help
```

Rode da raiz do repositório, com o venv ativo (`pip install -r requirements.txt`) e **`pip install yt-dlp`**, que só os exemplos com vídeo de terceiros usam. Precisa de `ffmpeg` com libass no PATH. Não usa o motor de render nem o Chrome.

O trecho é o da [TV Câmara](https://www.youtube.com/watch?v=B-kYyLSJ3mY) entre 1:38 e 2:08: *"Temos ódio à ditadura. Ódio e nojo. [...] A Nação quer mudar, a Nação deve mudar, a Nação vai mudar."*

## Mídia de terceiros: crédito e direito de citação

- **O vídeo não está no repositório e nunca deve entrar nele.** O `baixar.py` baixa só os 30 s do trecho para `entrada/`, que o git ignora. Crédito, URL, trecho e aviso ficam em [`fontes.json`](fontes.json).
- **Os direitos do vídeo são dos seus titulares** (TV Câmara / Câmara dos Deputados). O exemplo usa um trecho curto como **citação**, com o nome de quem fala, a ocasião, o crédito e a origem na tela o tempo todo, para fins de estudo. É o que a Lei 9.610/98 permite no art. 46, III: citar passagens de uma obra "para fins de estudo, crítica ou polêmica, na medida justificada para o fim a atingir, indicando-se o nome do autor e a origem da obra". Isto não é orientação jurídica. Se for publicar, mantenha o crédito na tela e na descrição (o `gerar.py` imprime o texto pronto) e respeite os termos da plataforma.
- **O vídeo de origem já é uma montagem.** A TV Câmara (2023) cobriu o áudio com fotos de arquivo e emendou trechos do discurso fora da ordem original. No trecho baixado, o Whisper ouve antes de "Temos ódio" o fim de outra frase ("mandar os patriotas para a cadeia, o exílio, o cemitério"), e as quatro frases da revisão vêm emendadas pela edição. Por isso a tela avisa: "áudio em trechos e fotos de arquivo: montagem da TV Câmara". As fotos não são da sessão.

## O que acontece

```
fontes.json ─► 0. baixar.py (yt-dlp, só o trecho) ─► entrada/ulysses-1988.mp4
revisao.txt ─► 1. motores/voz alinhar: o texto revisado manda, o Whisper empresta os tempos ─► alinhamento.json (cache)
                  + qa: o Whisper sem dica × revisão (precisão e divergências)
               2. corte: da 1ª à última palavra revisada, 0,35 s antes e 0,8 s depois
               3. ffmpeg: 16:9 sobre o próprio vídeo desfocado em 9:16 + data, nome, aviso e fonte ─► fundo.mp4
               4. motores/legenda: palavras ─► legenda.ass (zona universal) + .srt/.vtt; queimar ─► ulysses-1988.mp4
               5. mixagem: só a voz original, loudnorm em 2 passagens (−14 LUFS) ─► mix.m4a
```

- **`revisao.txt` é a fonte da verdade da legenda**, uma frase por linha. O Whisper escreve "esbravadora"; a legenda sai "desbravadora" porque o alinhador (`motores/voz/alinhar.py`) casa o que ouviu com o texto e reparte o tempo da palavra trocada. Trocar o trecho é editar o `.txt` (e o `trecho` do `fontes.json`, se precisar de outra parte do vídeo).
- **Textos fixos** (data e ocasião, nome, aviso, fonte) são desenhados em PNG com a Barlow Condensed do repositório, centrados na faixa livre da interface e encolhidos se não couberem (`textos_na_tela` no relatório traz a posição e o corpo de cada um).
- **O fundo desfocado** é calculado em 1/4 da resolução e ampliado. O `boxblur` direto em 1080×1920 levava 42,6 s para 23 s de vídeo; assim, a composição e a mixagem juntas levam ~9,5 s.
- **Mixagem:** reaproveita `mixar()` e `loudness()` do exemplo explicativo, com volume da trilha 0 (só a voz) e fade de 0,15 s na entrada e de 0,4 s na saída do corte.

Saídas em `saida/karaoke-discurso/`: `ulysses-1988.mp4`, `legenda.ass`/`.srt`/`.vtt`, `folha.png` (início de cada frase + o fim), `relatorio.json`, `palavras.json` (tempos já no corte), `alinhamento.json`, `fundo.mp4`, `textos.png`, `voz.wav` e `mix.m4a`.

Para outro discurso: acrescente uma entrada em `fontes.json` (com `na_tela`), escreva a revisão e rode `gerar.py --id SEU_ID --revisao sua-revisao.txt`.

## Medições

Notebook Ryzen 7 5700U (16 threads, sem GPU dedicada), 19 GB, Windows 11, Python 3.13, faster-whisper `small` int8 (modelo já no cache), yt-dlp 2026.08.19, ffmpeg 9.0.2. Rodadas seguidas em 07/10/2026, não médias controladas.

| Etapa | Tempo |
|---|---|
| `baixar.py` (30 s de vídeo 1920×1080, corte com reencode nas pontas) | 21,6 s |
| Alinhar + QA (uma transcrição serve aos dois) | 12,6–16,3 s |
| Composição 9:16 + mixagem | 9,3–9,6 s |
| Legenda (.ass/.srt/.vtt) | 0,1 s |
| Queimar + juntar o áudio | 5,2–5,6 s |
| **Total** (vídeo já baixado) | **31,2 s** com alinhamento novo; **17,5 s** com o alinhamento em cache |

- **Alinhamento:** 39 palavras revisadas, 38 casadas exatamente e 1 repartida ("desbravadora"), 0 estimadas. Whisper sem dica × revisão: **97,4%**; as outras divergências são palavras fora da revisão (o fim da frase anterior e o começo da seguinte).
- **Corte:** 5,95–29,08 s do trecho baixado, **23,1 s** de vídeo.
- **Legenda:** 17 blocos, 4 órfãos (um deles "NÃO", antes de "É A CONSTITUIÇÃO"), 0 curtos, 0 quebras ruins, 0 fora da zona. `.srt` com 5 cues, maior linha com 38 caracteres, nenhuma acima de 17 caracteres/s.
- **Loudness medido no final:** −14,0 LUFS integrado, pico verdadeiro −1,5 dBTP, LRA 4,7 LU.
- **Arquivo:** 1080×1920, H.264 `yuv420p`, `color_range=tv`, BT.709, 29,97 fps, AAC; 5,6 MB.
- **Conferido a olho** na folha de contato com `--zonas` e num quadro em 540×960: data, nome, aviso e fonte ficam dentro da zona livre, a legenda não cobre o vídeo nem os textos e a fonte é a Barlow.

## Origem

Refaz o laboratório 01 da Fábrica de reels (`reels-fabric/laboratorio/01-legenda-karaoke`) com os motores deste repositório. O que mudou: alinhamento e QA pelo `motores/voz`, legenda pelo `motores/legenda` (blocos medidos na fonte, destaque da palavra, zona segura, .srt/.vtt) em vez do `\kf` do ASS com a Bahnschrift, crédito e aviso de montagem na tela, e loudness em duas passagens.
