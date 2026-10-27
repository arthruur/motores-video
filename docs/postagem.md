# Postagem: o texto que acompanha o vídeo em cada rede

A bandeja da Prensa mostra **Sugestões para postar** em cada vídeo pronto (`app/src/postagem.ts`): título, legenda e hashtags de cada rede, para copiar e colar na hora de postar à mão. Esta página registra de onde vem cada regra e quão forte é a evidência. Pesquisa feita em 09/10/2026.

As marcas são as mesmas de [receitas.md](receitas.md):
- **[forte]**: estudo revisado por pares ou experimento grande.
- **[plataforma]**: dado ou regra da própria empresa.
- **[fraca]**: blog de ferramenta, guru ou opinião.

**Conclusão geral:** quase não há estudo controlado sobre o texto do post. O que existe de mais firme são **regras das próprias plataformas** (limites, hashtags) e **declarações de quem comanda o algoritmo**. Os dados de mercado indicam que o número de hashtags pesa pouco ou nada; o que pesa é o vídeo. Por isso as sugestões são curtas, específicas e **saem do que a pessoa disse**: nada é inventado.

## Como a Prensa monta as sugestões

- **Primeira linha:** o gancho, se ele foi escrito. Se não, a frase mais forte da fala, escolhida pela mesma regra dos ganchos (`ganchosDaFala`, em `receitas.ts`).
- **Segunda linha:** outra frase da fala, para o assunto aparecer escrito, porque a busca lê o texto.
- **Créditos:** fonte, original, vídeo de baixo e música, sempre que preenchidos.
- **Hashtags:** primeiro as da pessoa (o campo "Suas hashtags" da bandeja, lembrado no aparelho). Depois as palavras de assunto que ela **repetiu** na fala. Genéricas como #reels, #fyp e #viral são descartadas.
- Os campos são editáveis, têm contador de caracteres com o limite de cada rede e botão de copiar.

## As regras, por rede

| Rede | Regra | Evidência |
|---|---|---|
| **Shorts** | Título até 100 caracteres | **[plataforma]** limite do título na API do YouTube ([videos.insert](https://developers.google.com/youtube/v3/docs/videos/insert)) |
| | Até 3 hashtags: as 3 primeiras da descrição aparecem acima do título. Com mais de 60, todas são ignoradas, e hashtag sem relação com o vídeo conta como enganosa | **[plataforma]** [Ajuda do YouTube: hashtags](https://support.google.com/youtube/answer/6390658?hl=pt-BR) |
| **Reels** | No máximo 5 hashtags, específicas. Evitar #reels e #explore | **[plataforma]** o Instagram limitou a 5 por post em dez/2025 e diz que poucas e direcionadas funcionam melhor ([Social Media Today](https://www.socialmediatoday.com/news/instagram-implements-new-limits-on-hashtag-use/808309/), [Social Samosa](https://www.socialsamosa.com/news-2/instagram-hashtags-five-per-post-10923075)) |
| | Assunto nos primeiros ~125 caracteres, antes do "mais"; legenda até 2.200 | **[fraca]** números de terceiros ([Sendible](https://www.sendible.com/insights/instagram-character-limit)) |
| | Chamada opcional para **mandar** o vídeo a alguém | **[plataforma]** Adam Mosseri, chefe do Instagram, apontou os envios por DM em relação ao alcance entre os sinais mais importantes, ao lado do tempo de exibição e das curtidas por alcance ([Search Engine Journal](https://searchenginejournal.com/instagram-algorithm-shift-why-sends-matter-more-than-ever/521389)). O peso "3 a 5 vezes" que circula **não é dele** |
| **TikTok** | Legenda curta com as palavras do assunto escritas | **[fraca]** a busca do TikTok indexa a legenda, não o texto queimado no vídeo ([Lindsey Gamble](https://lindseygamble.com/blog/tiktok-expands-the-character-limit-for-video-descriptions), [SocialBee](https://socialbee.com/blog/tiktok-captions/)) |
| | Limite de caracteres: a Prensa conta até 2.200 | **Não confirmado:** fontes falam em 2.200 e em 4.000, sem página oficial legível |
| **Todas** | Poucas hashtags, relevantes | **[fraca, dados de mercado]** em 75 milhões de posts do Instagram, o engajamento não mudou com o número de hashtags ([PR Daily, sobre a Socialinsider](https://www.prdaily.com/report-instagram-hashtags-dont-increase-engagement/)). Nenhum estudo revisado por pares testou a quantidade no TikTok |
| **Kwai e Status do WhatsApp** | Legenda curta e a fonte | Limites **não confirmados** em fonte oficial |

## O limite: provocar ≠ enganar

Vale o mesmo de [receitas.md](receitas.md#o-limite-provocar--enganar). A chamada para mandar o vídeo é uma sugestão, não um padrão: só faz sentido quando o vídeo merece ser mandado. "Marca 3 amigos", "comenta SIM" e parecidos ficam de fora, porque são isca de engajamento. A Prensa não sugere horário de postagem: os "melhores horários" que circulam não têm método publicado, e cada perfil vê os seus nas métricas da própria rede.

## Ainda não está na Prensa

- **Variações do texto com um modelo de linguagem**, por exemplo com a chave da Gemini da própria pessoa. Os limites seriam os mesmos: só o que está na fala e a fonte sempre junto.
- **Texto alternativo** para acessibilidade, onde a rede aceitar.
