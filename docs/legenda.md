# Legenda: falada (queimada) e acessível (.srt/.vtt)

> Conceito, decisões e números do `motores/legenda`. A especificação completa, a CLI e a calibração estão no [README do motor](../motores/legenda/README.md).

## Duas legendas diferentes

Vídeo vertical em rede social é assistido **sem som** boa parte do tempo. Por isso ele precisa de uma legenda **queimada** na imagem, grande, em blocos curtos, com a palavra falada destacada: a **legenda falada**. Ela é parte do desenho do vídeo.

Isso não substitui a **legenda acessível**, que é um arquivo à parte (`.srt`/`.vtt`), em caixa normal, com linhas de leitura confortável, para subir como legenda nativa e para leitor de tela. O motor gera as duas a partir das mesmas palavras com tempo.

## As decisões

### Queimar depois do render, com libass

A legenda poderia ser desenhada na própria cena HTML. A pesquisa de origem mediu o contrário: o libass custa **~1,7 ms por quadro** (medido aqui: ~1,2 s em 714 quadros), contra ~1,2 s por quadro no render HTML do laboratório antes das otimizações (hoje ~25 ms por quadro, ver [render.md](render.md)). E, sobretudo, separar dá **liberdade**: mudar a quebra, a cor ou o tempo da legenda leva segundos e não exige fotografar as cenas de novo. Na prática, o que pesa ao queimar é o reencode x264, não a legenda.

### Blocos por sintagma, com o bloco inteiro visível

A evidência controlada favorece blocos curtos por unidade de sentido, com o bloco inteiro aparecendo de uma vez e só o destaque andando: palavras surgindo uma a uma fazem o olho ir e voltar mais vezes entre cena e legenda (Rajendran et al., 2013). Caixa alta e destaque colorido são prática de mercado, não resultado de estudo. O motor faz o padrão bem fundamentado (`visivel`) e deixa o outro (`surgir`) para teste A/B.

A quebra é uma **programação dinâmica dentro de cada frase**: blocos de 2 a 4 palavras, medidos com a **fonte real** (Pillow), que nunca cruzam fim de frase nem troca de cena, não separam artigo do nome, nome próprio nem número da unidade ("27 dias"), evitam terminar em "de" ou "que" e preferem quebrar depois de pontuação.

### Zona segura: a faixa útil é estreita e não é centrada

Somando os guias oficiais de anúncio de Meta, TikTok e YouTube, a legenda precisa terminar até **y ≈ 1248** (em 1080×1920) e, na altura da legenda, a coluna de botões do TikTok ocupa x > 780. Sobra uma faixa de **660 px (x 120–780)**, deslocada para a esquerda. É a zona `universal`, padrão do motor. Para caber nela com 84 px de corpo, a fonte precisa ser **condensada** (Barlow Condensed ExtraBold, OFL). Nenhuma plataforma publica zona para post orgânico; as de anúncio são o limite conservador.

### Fonte estática e medida

O libass **ignora o peso de fonte variável** e cai no Regular ou até no Arial. Por isso a fonte em `fontes/` é um TTF estático, e o `queimar.py` confere no log do libass qual arquivo foi realmente usado (com `--estrito`, para se cair numa fonte do sistema).

O `Fontsize` do ASS também **não** é o tamanho em px: o libass escala a fonte para `winAscent + winDescent` medir `Fontsize`. O motor lê essas métricas do próprio TTF e acerta o corpo com erro abaixo de 0,5% (conferido com Barlow, Arial e Georgia). A constante do laboratório de origem estava ~1% baixa.

### Números: o TTS precisa de extenso, a tela precisa de algarismo

"Trezentos e oitenta e quatro mil quilômetros" não cabe num bloco. O motor converte números falados para algarismos na tela ("384.000", "60%", "13º", "2 milhões"), mantendo até dez por extenso. Isso combina com a regra do motor de voz: **escreva por extenso no roteiro**.

### Legenda acessível

Até 2 linhas de 42 caracteres e 17 caracteres por segundo (guia de legendas pt-BR da Netflix e o Guia para Produções Audiovisuais Acessíveis do MinC), cada cue com pelo menos 5/6 s. Não identifica quem fala nem descreve sons: não substitui uma LSE feita por gente.

## Números medidos

Notebook Ryzen 7 5700U, 19 GB, Windows 11, Python 3.13, Pillow 12.3.0, ffmpeg 9.0.2 (gyan.dev, libass).

| O quê | Resultado |
|---|---|
| Gerar .ass/.srt/.vtt (72 palavras, 24 s; processo inteiro) | 0,43–0,45 s; a função sozinha, 0,12 s |
| Gerar no exemplo explicativo (105 palavras) | 0,2 s |
| Queimar 24 s em 1080×1920 | 3,8–5,4 s (o x264 domina: 5,2–5,6 s sem legenda sobre `testsrc2`) |
| Custo do libass sozinho | ~1,2 s em 714 quadros (~1,7 ms por quadro) |
| Folha de contato, 6 instantes | 3,3 s |
| QC do exemplo da Lua (zona universal) | 24 blocos, 1 órfão, 1 quebra ruim (número longo + unidade longa), 0 fora da zona |
| QC do exemplo explicativo | 38 blocos, 0 órfãos, 0 quebras ruins, 0 fora da zona; `.srt` com 10 cues |
| Cores no MP4, sobre cinza | placa #15213B a 92% → (28, 40, 62), previsto (29,6, 40,6, 64,5); amarelo #FFD633 → (254, 213, 51) |

## Limites

- Não trata siglas soletradas pelo TTS, nome próprio com minúscula ("de Gaulle") nem número de 4 dígitos que não é ano.
- Com fala rápida (~188 palavras/min), a última palavra de muitos blocos fica menos de 0,4 s na tela; uma penalidade na programação dinâmica foi testada e não melhorou.
- A conferência de fonte depende do texto do log do libass; se ele mudar, a conferência deixa de avisar.

Origem: laboratórios 01 (karaokê alinhado) e 03 (blocos .ass medidos com a fonte, zona segura, destaque) da Fábrica de reels, e a pesquisa "legenda e layout" (06/10/2026).
