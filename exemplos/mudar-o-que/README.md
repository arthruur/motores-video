# exemplo: "Mudar o quê?" (explicativo de opinião, com fontes)

Um vídeo vertical de ~47 s com narração sintética, cenas que entram na palavra dita, legenda palavra a palavra, trilha com *ducking*, **a fonte de cada fato na tela** e rótulo de IA, por um comando só:

```bash
python exemplos/mudar-o-que/gerar.py            # edge-tts (padrão do roteiro); saída em saida/mudar-o-que/
python exemplos/mudar-o-que/gerar.py --qa       # + o Whisper confere se o que foi dito bate com o roteiro
python exemplos/mudar-o-que/gerar.py --zonas    # folha de contato com a zona segura
python exemplos/mudar-o-que/gerar.py --help
```

Rode da raiz do repositório, com o venv ativo (`pip install -r requirements.txt`) e `npm install` feito. Precisa de Node 20+, Chrome ou Edge e `ffmpeg` com libass no PATH.

## Nota de contexto

- **Feito em 06/10/2026, em período eleitoral.** Nesse dia, num ato em Goiânia, Flávio Bolsonaro disse querer maioria no Congresso "pra gente mudar a Constituição e redemocratizar esse país", sem dizer o que quer mudar (Meio News e Tribuna de Jundiaí, 06/10/2026). O vídeo mostra a fala **literal**, com data, local e veículo, mostra quais direitos estão na Constituição e devolve a pergunta. Ele não atribui ao político intenções que ele não declarou.
- **É conteúdo de opinião do autor** (Arthur Teles). A cena `cheque` é marcada `"tipo": "opiniao"` no roteiro; as outras afirmações têm fonte.
- **Rótulo de IA o tempo todo.** A narração é voz sintética de narrador (edge-tts, `pt-BR-AntonioNeural`), nunca a voz de uma pessoa real. O topo diz "narração gerada por IA" do primeiro ao último quadro, e o cartão final traz o rótulo completo que o motor de voz devolve. As regras do TSE para conteúdo político com IA em período eleitoral pedem esse aviso.
- **Não impulsionar.** Em período eleitoral, impulsionamento pago de conteúdo político é só para candidatos, partidos, federações e coligações.
- **Antes de publicar:** as duas matérias estão no roteiro sem URL e com `"situacao": "a conferir"` (o `gerar.py` avisa no fim). Confira de novo, ponha a URL e, se houver vídeo da fala, prefira o áudio original como citação. Ouça a narração inteira: o Whisper marcou "quer → que a", que pode ser erro de escuta dele.

O exemplo está aqui porque mostra o formato que os motores fazem bem: fala curta, uma ideia por cena e fonte visível. Use-o como molde para o seu tema; o conteúdo político é do autor, não do projeto.

## Fontes

| id no roteiro | Fonte | Onde aparece |
|---|---|---|
| `cf88-art7` | [Constituição Federal de 1988](https://www.planalto.gov.br/ccivil_03/constituicao/constituicao.htm), art. 7º: VIII (13º salário), XVII (férias com 1/3 a mais), XXIV (aposentadoria) | cenas `lei`, `lista`, `livro` |
| `cf88-art14` | Constituição Federal, art. 14 (voto facultativo aos 16 anos) | `lista`, `livro` |
| `cf88-art196` | Constituição Federal, art. 196 (saúde, direito de todos e dever do Estado: o SUS) | `lista`, `livro` |
| `meio-0610` | Meio News, 06/10/2026 (ato com Ronaldo Caiado, Goiânia), **URL a conferir** | `fala`, `pergunta` |
| `tribuna-jundiai-0610` | Tribuna de Jundiaí, 06/10/2026, **URL a conferir** | `fala`, `pergunta` |

"38 anos de direitos" é calculado pelo `gerar.py`: de 05/10/1988 (promulgação) à `data` do roteiro.

## O que acontece

O encadeamento é o do [exemplo explicativo](../explicativo), e o `gerar.py` importa dele `narrar()`, `marcar_cenas()`, `mixar()` e `loudness()`:

```
roteiro.json ─► 1. voz (motores/voz, uma tomada) ─► voz.wav + palavras com tempo (cada uma sabe a sua cena)
                     ├─► 2. cena/ (cena.html + dados.json) ─► render (motores/render) ─► cenas.mp4   ┐ em
                     ├─► 4. mixagem: voz + acorde sintetizado, ducking, loudnorm −14 LUFS ─► mix.m4a  ┘ paralelo
                     └─► 3. legenda (motores/legenda, sem legenda no cartão final) ─► legenda.ass/.srt/.vtt
                                         5. queimar .ass + juntar mix ─► mudar-o-que.mp4
```

- **`roteiro.json`:** título, data, voz, trilha, alvo de loudness, a lista de **fontes** (com URL quando há) e as cenas. Cada cena tem `fala`, `tipo` (`gancho`, `fato`, `opiniao`, `chamada`), as `fontes` que cita e os `gatilhos` (nome → começo de uma palavra da própria fala). O conteúdo visual vem junto: `itens` (os cartões de direitos, cada um com o artigo), `citacao` (literal, com quem e fonte) e `cartao` (o fecho). `"legenda": false` tira a legenda do cartão final, que já traz o texto.
- **`cena.html`** segue o [contrato do motor de render](../../motores/render/CONTRATO.md): lê `dados.json`, define `window.DURACAO`, `window.seek(t)` devolve uma chave de estado (o estilo inline de cada elemento, arredondado) e `window.pronto` só depois da fonte carregar. Os cartões entram nas palavras "férias", "SUS", "aposentadoria" e "voto"; "É LEI" entra em "lei"; o carimbo "ELE NÃO DISSE" entra em "Ele"; os direitos voltam por trás do cheque em "nela".
- **Zona segura:** todo o desenho fica em x 120–780 abaixo de y 840 e termina acima de y 1125, onde começa a placa da legenda. O rótulo de IA fica em y 292, dentro da zona livre.

Saídas em `saida/mudar-o-que/`: `mudar-o-que.mp4`, `legenda.srt`/`.vtt`/`.ass`, `mudar-o-que-teste.png` (um quadro por cena, depois do último gatilho, mais o cartão final), `relatorio.json` (com as fontes e as que faltam conferir), `palavras.json`, `voz.wav`, `voz.json`, `mix.m4a`, `cenas.mp4` e a pasta `cena/`.

## Medições

Notebook Ryzen 7 5700U (16 threads, sem GPU dedicada), 19 GB, Windows 11, Node 20, Chrome, ffmpeg 9.0.2, Python 3.13, edge-tts 7.2.8, faster-whisper `small` int8. Rodadas seguidas em 07/10/2026, não médias controladas.

| Etapa | Tempo |
|---|---|
| Voz (edge, rede) | 3,6–3,7 s |
| QA pelo Whisper (`--qa`, modelo já no cache) | 21,0 s |
| Render: 1.407 quadros, **276 fotos**, 4 workers | 21,5–25,2 s |
| Mixagem (2 passagens, em paralelo com o render) | 15,2–15,6 s |
| Legenda (.ass/.srt/.vtt) | 0,1 s |
| Queimar + juntar | 7,4 s |
| **Total** | **60,3 s** com voz nova e `--qa`; **40,8 s** com a voz reaproveitada |

- **Fala:** 45,3 s, 107 palavras, tempos nativos do edge. Vídeo: **46,9 s** (o cartão final segura 1,6 s).
- **QA:** 98,1% (divergências "o → os" e "quer → que a").
- **Pulo de quadros:** com `--verificar` no motor de render, os 1.131 quadros pulados foram fotografados e **0 saíram diferentes**.
- **Legenda:** 35 blocos, 3 órfãos, 4 curtos, 0 quebras ruins, 0 fora da zona. `.srt` com 15 cues, maior linha com 39 caracteres, 1 cue acima de 17 caracteres/s.
- **Loudness medido no final:** −14,5 LUFS integrado, pico verdadeiro −1,3 dBTP, LRA 3,2 LU.
- **Arquivo:** 1080×1920, H.264 `yuv420p`, `color_range=tv`, BT.709, AAC 160 kb/s; 4,4 MB.
- **Conferido a olho** nas folhas de contato, com e sem `--zonas`: as cenas entram nas palavras certas, nada passa da zona livre (o cartão final foi apertado depois da primeira folha, porque o rótulo de IA descia até y ~1260) e a legenda não cobre o desenho.

## Origem

Refaz o laboratório 03 da Fábrica de reels (`reels-fabric/laboratorio/03-constituicao`) com os motores deste repositório. Ficaram de fora o esquema `roteiro@1`, a aprovação amarrada ao hash e a ficha técnica do app, que são da Fábrica. Mudou também: a fonte passou da Bahnschrift (do Windows, não redistribuível) para a Barlow Condensed do repositório, e o rótulo de IA saiu do topo (y 72, embaixo da interface do app) para y 292. No lab, o render levava 36–40 s com a composição; aqui, só as cenas, 21,5–25,2 s.
