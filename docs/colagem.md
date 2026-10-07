# Colagem por sentido

O motor de colagem (`motores/colagem`) monta um reel 9:16 com **fragmentos de falas reais** de pessoas e ocasiões diferentes, postos lado a lado por sentido. A referência é *Ilha das Flores* (Jorge Furtado, 1989) e os cinejornais de Santiago Álvarez: a montagem cria um argumento com material que já existe e **assume a autoria** desse argumento. O uso pensado é a oficina de cineclube, de escola ou de telecentro, onde montar e discutir a montagem é o conteúdo.

A máquina acha e corta; **quem monta escolhe, ordena e assina.**

## O caminho

```
fontes.json (quem, quando, onde, URL, trecho, crédito)
   │
   ├─ baixar ── yt-dlp, só o trecho ──────────────────────────────▶ entrada/<slug>.mp4  (ignorada pelo git)
   ├─ indexar ─ Whisper palavra a palavra (motores/voz) ── janelas de 15 s, passo de 5 s
   │             + frases conferidas, localizadas pelo texto ── EmbeddingGemma 2 (Document) ──▶ índice
   ├─ sugerir "tema" ── SearchQuery + MMR (no máx. 2 por fonte) + corte entre frases
   │             ──▶ candidatos-<tema>.html (cada vídeo toca só o trecho)
   ├─ colagem.json ── escrito por QUEM MONTA: fragmentos, ordem, porquê, autor
   │  revisao/<id>.txt ── o texto da fala, conferido por uma pessoa (o Whisper só empresta os tempos)
   └─ montar ── por fragmento: casar() da voz + legenda karaokê (motores/legenda) + etiqueta com a fonte
                + loudnorm em 2 passagens; cartões de abertura e final; textura entre fragmentos
                ──▶ colagem-<tema>.mp4 + .srt/.vtt + ficha-<tema>.json
```

Tudo roda em CPU. Não usa o navegador: cartões, etiqueta e legenda são ASS desenhados pelo libass, e a textura vem do `lavfi` do ffmpeg. Formatos e números no [README do motor](../motores/colagem/README.md).

## O que o laboratório ensinou

O motor saiu do laboratório 05 da Fábrica de reels (`reels-fabric`). As lições que viraram código ou regra:

- **A transcrição é o teto da busca.** A Lélia Gonzalez diz "democracia racial" e o Whisper ouviu "demografia racial" três vezes; a melhor frase sobre democracia nem aparecia. Juntar ao índice as **frases conferidas** da fonte (campo `frases`), localizadas **pelo texto** na transcrição, resolveu sem mexer no modelo. Localizar pelo tempo aproximado piorou a busca.
- **"Frase" do Whisper não é frase.** O ponto vem do modelo, que erra para os dois lados. O corte usa pontuação, pausa longa seguida de maiúscula e, como plano B, respiros de pelo menos 0,5 s; a página de candidatos marca quando caiu em respiro. O ouvido de quem monta é a última palavra.
- **O texto da legenda é o que a pessoa disse.** Uma revisão "corrigiu" a Marielle Franco pelo texto de catálogo ("iguais"), que não é o que ela diz no vídeo ("igual"). A legenda segue o áudio.
- **A busca acha o assunto, não a ideia.** "A voz de quem não é ouvido" trouxe "minha voz está embargada". Tema abstrato funciona melhor reescrito em frases concretas.
- **Loudnorm em 2 passagens com ganho linear** leva falas gravadas entre −11 e −26 LUFS para perto do alvo sem comprimir a voz. O chiado do original sobe junto.
- **Grão custa bytes.** Textura de película é ruído novo a cada quadro; a primeira versão tinha 400 MB. Menos grão e teto de 8 Mb/s levaram a ~38 MB.

## Ética da montagem

- **Fragmento inteiro, montagem assumida.** Cada fragmento é uma frase inteira, com o som original e sem edição dentro dela. Mas a ordem cria um argumento que **nenhuma das pessoas fez junto**. O cartão final diz isso ("o sentido do conjunto é da montagem, não de quem falou"), lista **todas** as fontes com o minuto e assina "montagem de <autor>". A ficha guarda o porquê de cada escolha.
- **Efeito Kuleshov.** O sentido de um plano muda com o plano ao lado. No exemplo, a Lélia em 1983, logo depois da promessa da Constituição de 1988, parece responder a ela, mas falou cinco anos antes. Por isso **toda etiqueta tem data**. A ordem cronológica não é obrigatória; a data é.
- **Quem fala é quem está na etiqueta.** O índice **não sabe quem está falando**: no laboratório, entraram entre os candidatos o entrevistador, o narrador de um filme e a presidenta de uma sessão. Pôr a fala de outra pessoa sob o nome da figura é atribuição falsa. Até existir separação de vozes (diarização), **cada candidato precisa ser ouvido** antes de entrar no `colagem.json`.
- **O arquivo também pode já vir montado.** O vídeo do Ulysses Guimarães publicado pela TV Câmara (2023) cobre o áudio com fotos de arquivo e emenda trechos do discurso fora da ordem. Uma versão do exemplo colava o vocativo "Senhoras e senhores constituintes" no "Hoje, 5 de outubro de 1988", mas essa emenda é da TV Câmara, não do discurso. O fragmento passou a começar em "Hoje", e a etiqueta avisa: "áudio em trechos e fotos de arquivo". Fonte editada por terceiros pede conferir o fragmento contra o texto publicado.
- **Direitos.** Os vídeos são de terceiros: não entram no repositório, são baixados por quem roda e citados com nome, ocasião e origem na tela. Ver "Exemplos com material de terceiros" no [README](../README.md).
- **Exercício de oficina.** Montar **a mesma** seleção em duas ordens e discutir o que muda. Assim o Kuleshov vira conteúdo, e não truque.

## Em aberto

- Separar vozes (diarização, ou trechos de cada voz marcados à mão em `fontes.json`) antes de sugerir.
- Transição com o nome da próxima figura (estilo Álvarez) em vez da textura pura.
- Página de candidatos que deixe arrastar, ordenar e gerar o `colagem.json` inteiro.
- Acusar na página o corte que cai com pausa de 0,0 s.
