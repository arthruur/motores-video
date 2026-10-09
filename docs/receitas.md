# Receitas da Prensa: o que funciona em vídeo curto, e com que evidência

As receitas da Prensa (`app/src/receitas.ts`) juntam técnicas de vídeo curto viral num toque. Esta página registra **de onde vem cada escolha** e quão forte é a evidência. Pesquisa feita em 08/10/2026.

**Como ler as marcas:**
- **[forte]**: estudo revisado por pares ou experimento grande.
- **[plataforma]**: dado da própria empresa, sem método publicado.
- **[fraca]**: blog de ferramenta, guru ou opinião.

**Conclusão geral:** há evidência sólida sobre **emoção e compartilhamento** (estudos com texto e manchete), **legenda e consumo sem som**, e **riscos do vídeo curto para a atenção**. Quase todo o resto (duração ideal, zoom, ritmo de cortes, loop) é saber de praticante, sem estudo controlado. Por isso as receitas são **pontos de partida**, não fórmulas.

## O que a Prensa aplica, e por quê

| Técnica | O que a Prensa faz | Evidência |
|---|---|---|
| **Gancho nos primeiros segundos** | Texto no topo desde o quadro 0. Fica grande por 4 s e depois vira título fixo | **[plataforma]** TikTok: mais de 63% dos vídeos com maior taxa de clique mostram a mensagem principal nos 3 primeiros segundos ([TikTok](https://ads.tiktok.com/business/en-US/blog/9-creative-tips-to-drive-auction-ad-performance)). **[forte, teórica]** a curiosidade nasce de uma lacuna **pequena e fechável** ([Loewenstein 1994](https://stafforini.com/works/loewenstein-1994-psychology-curiosity-review/)) |
| **Gancho tirado da própria fala** | A Prensa sugere as frases da transcrição com número, pergunta, "você" ou contraste. Os modelos com lacuna (`___`) só valem com o que o vídeo diz | **[forte]** manchetes em pergunta ou exageradas **perdem credibilidade**, e as de "lacuna" não engajaram mais que as normais ([journalism.co.uk](https://www.journalism.co.uk/readers-perceive-question-based-headlines-more-negatively-study-shows/), [CHI 2021](https://pike.psu.edu/publications/chi21.pdf)). O gancho funciona quando o vídeo cumpre a promessa |
| **Legenda dinâmica** | "Bloco": 2 a 4 palavras, com a atual em amarelo e um pop. "Palavra por palavra": uma palavra grande, com as de peso em amarelo | **[pesquisa, autorrelato]** 69% veem sem som em lugar público e 80% de quem usa legenda não é surdo ([Verizon/Publicis 2019](https://www.streamingmedia.com/Articles/News/Online-Video-News/80-of-Video-Caption-Users-Arent-Hearing-Impaired-Finds-Verizon-131860.aspx)). **[plataforma]** no TikTok, 88% dizem que o som é essencial ([Kantar](https://ads.tiktok.com/business/vi/blog/kantar-report-how-brands-are-making-noise-and-driving-impact-with-sound-on-tiktok)). **[forte]** pessoas surdas preferem linhas mais longas a uma palavra por vez, e o destaque estilo karaokê ajuda ([Rochester](https://www.cs.rochester.edu/hci/pubs/pdfs/caption_readability.pdf), [arXiv 2501.02233](https://arxiv.org/pdf/2501.02233)). Por isso o **padrão é o bloco**, e a palavra solta fica para frases curtas |
| **Estímulo duplo (tela dividida)** | Opção, **não padrão**: fala em 58% de cima, retenção sem som embaixo, legenda na junção | **[forte, pequeno]** dois experimentos pré-registrados **não acharam diferença** em memória nem em compreensão com Subway Surfers ou Minecraft embaixo, e o interesse caiu um pouco ([Schuetze 2026](https://pmc.ncbi.nlm.nih.gov/articles/PMC13018501/)). Que o formato "retém mais" é afirmação de criadores, sem estudo publicado |
| **Emoção** | Receitas "Mito ou fato" e "Você sabia?" (surpresa e espanto) | **[forte]** conteúdo de alta ativação (espanto, raiva, ansiedade) é mais compartilhado; tristeza, menos ([Berger & Milkman 2012](https://faculty.wharton.upenn.edu/wp-content/uploads/2011/11/Virality.pdf)). **[forte]** palavras moral-emocionais (+20% de retweets) e menções ao grupo político adversário (+67% de compartilhamento) espalham mais ([Brady et al. 2017](https://pmc.ncbi.nlm.nih.gov/articles/PMC5514704), [Rathje et al. 2021](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC8256037/)). Notícia falsa se espalha mais longe e mais rápido que a verdadeira ([Vosoughi et al. 2018](https://news.mit.edu/2018/study-twitter-false-news-travels-faster-true-stories-0308)) |
| **Fonte na tela** | Campo "De onde é o vídeo?" sempre visível, também no texto do post | É o que separa informação de boato (ver "Por que Prensa?" no app) |
| **Volume parelho** | −14 LUFS e pico real em −1 dBTP, com o motor do Audio FXtor, mais remoção de ruído da voz (RNNoise) | Prática de streaming. **[forte, para TV]** a música atrapalha a fala, então deve ficar bem abaixo dela ([Salford](https://salford-repository.worktribe.com/OutputFile/1489990)) |

## O limite: provocar ≠ enganar

O mesmo motor que faz um vídeo circular (emoção, novidade, "nós contra eles") é o motor da desinformação. Na Prensa, um gancho é legítimo quando:
1. é verdadeiro e o vídeo entrega o que promete;
2. não põe na boca de ninguém algo que não está na fala;
3. não inventa urgência;
4. critica ideias e fatos, não pessoas ou grupos.

**Receita "Cívico" (modo seguro):** só ganchos tirados da fala, legenda clássica, sem tela dividida. Serve para política, mandato e jornalismo. Período eleitoral: a Res. TSE 23.732/2024 obriga a rotular conteúdo sintético feito por IA na propaganda e proíbe deepfake. Para 2026, a Res. 23.755/2026 também veda conteúdo novo de IA com imagem ou voz de candidato entre 72 h antes e 24 h depois da votação ([TSE](https://www.tse.jus.br/comunicacao/noticias/2026/Abril/por-dentro-das-eleicoes-conheca-as-regras-sobre-uso-de-ia-na-campanha-eleitoral-de-2026)). A Prensa não gera voz nem imagem sintética. Mas **cortar uma fala de um jeito que mude o sentido** é descontextualização, com ou sem IA.

**Riscos do formato:** uma meta-análise (71 estudos, cerca de 98 mil pessoas) associa o uso de vídeo curto a pior atenção e pior controle inibitório. É correlação ([Nguyen et al. 2025, resumo](https://www.psypost.org/large-meta-analysis-links-tiktok-and-instagram-reels-to-poorer-cognitive-and-mental-health/)). Por isso a tela dividida não é o padrão e a receita avisa: evite em vídeo para crianças.

## As receitas

| Receita | Para | Layout | Gancho | Legenda |
|---|---|---|---|---|
| Corte direto (padrão) | Fala, dica, opinião | Tela cheia | Título com a frase mais forte | Bloco |
| Você sabia? | Curiosidade, explicação | Tela cheia | "Você sabia?" | Bloco |
| Dica rápida | "3 erros", "5 passos" | Tela cheia | Lista | Palavra |
| Pergunta e resposta | Responder uma dúvida | Tela cheia | Balão com a pergunta | Bloco |
| Estímulo duplo | Podcast, história longa | Dividida 58/42 | "Você sabia?" | Bloco |
| Mito ou fato | Ciência, checagem | Tela cheia | Manchete | Bloco |
| Frase de impacto | Trecho marcante | Tela cheia | Título com a própria frase | Palavra |
| Cívico | Política, jornalismo | Tela cheia, sem dividida | Só frases da fala | Bloco |

## Banco de ganchos (modelos com lacuna)

Ficam em `app/src/receitas.ts`, por receita. A lacuna `___` se preenche **com o que o vídeo diz**. Exemplos: "O que quase ninguém percebe sobre ___", "___ não funciona do jeito que te contaram", "___ erros comuns em ___", "Ninguém te conta que ___".

**Fora do banco, por serem enganosos por natureza:**
- "Você não vai acreditar…" sem nada de surpreendente;
- "URGENTE" sem prazo real;
- "Fulano admitiu que…" sem a fala;
- "Isso vai ser apagado";
- números inventados.

## Outros formatos: o que serve a quem parte de uma fala real

Segunda pesquisa, de 08/10/2026. Os tempos "segundo a segundo" que circulam vêm de blogs de fornecedores (evidência fraca). Nenhum formato abaixo usa voz sintética nem imita alguém.

| Formato | Estrutura | Serve para a Prensa? |
|---|---|---|
| **Pergunta e resposta** | 0–2 s: balão com a pergunta. Em seguida, a resposta falada. No fim, "mande a sua" | **Sim. Já é uma receita.** É a promessa cumprida na hora |
| **Storytime** | 0–3 s: a frase mais intrigante do trecho, posta na frente. Depois a narrativa com legenda dinâmica. Final com desfecho ou "parte 2?" | Sim. Precisa detectar o trecho narrativo e montar o teaser |
| **Tutorial em 3 passos** | 0–3 s: o resultado. Depois três blocos de 8 a 12 s marcados "1/3, 2/3, 3/3" e uma recapitulação de 2 s | Sim. Precisa de um contador de passos na tela |
| **X vs Y** | 0–2 s: "X ou Y?". Rótulo e cor para cada lado e um veredito | Sim, quando a fala compara |
| **Quiz** | 0–3 s: a pergunta. Cronômetro de 3 a 5 s, a resposta falada, loop | Sim. Combina com "Mito ou fato" |
| **Série ("parte N")** | Termina em suspense, com "parte 2" fixo na tela | Sim, é barato de fazer. Evidência anedótica |
| **Contagem regressiva / Top N** | Números de 5 a 1, com o melhor por último | Sim. É uma variante de "Dica rápida" |
| Tier list | Grade S–D com os itens entrando enquanto são citados | Parcial: só texto. Imagens de terceiros esbarram em direitos |
| Antes e depois | Abre com o "depois" e revela o "antes" | Parcial: depende de a pessoa ter as duas imagens |
| Reddit stories | Post de outra pessoa lido em voz sintética, com gameplay embaixo | **Não**: voz sintética e texto alheio |
| Reação | Vídeo alheio em cima, rosto embaixo | **Não**, por direitos (só com material livre) |

## Ainda não está na Prensa (próximos passos)

Técnicas das ferramentas de corte (Opus Clip, Submagic, CapCut) sem estudo controlado, todas **[fraca/opinião]**:
- **corte de silêncio:** pausas acima de ~350 ms, pelos tempos do Whisper;
- **zoom de ênfase:** 1,12× nas palavras-chave;
- **loop:** o fim emenda no começo;
- **barra de progresso;**
- **CTA:** "manda pra quem…", já que envios por DM pesam no Instagram, segundo fonte secundária;
- **A/B de ganchos:** duas versões para comparar nas métricas da plataforma. É a forma honesta de lidar com números de "duração ideal" que não têm método.
