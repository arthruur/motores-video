# motores/legenda

Recebe palavras com tempo e devolve três arquivos: a **legenda falada** em `.ass`, para queimar no vídeo com libass e ser lida por quem assiste sem som, e a **legenda acessível** em `.srt` e `.vtt`, para subir como legenda nativa. Tudo roda em Python, com Pillow e o ffmpeg. Não usa navegador nem GPU.

```bash
python -m venv .venv && .venv\Scripts\activate        # Linux/macOS: source .venv/bin/activate
pip install "pillow>=10.1"                             # ou: pip install -r requirements.txt (inclui o motor de voz)

python motores/legenda/gerar.py exemplos/legenda/palavras.json -o saida/legenda/lua.ass
python motores/legenda/queimar.py video.mp4 saida/legenda/lua.ass --teste 1,4.5,17.2 --zonas   # prévia PNG
python motores/legenda/queimar.py video.mp4 saida/legenda/lua.ass -o saida/legenda/lua.mp4
python motores/legenda/gerar.py --help
```

Requisitos: Python 3.10 ou mais novo, Pillow 10.1 ou mais novo, e `ffmpeg`/`ffprobe` no PATH compilados com **libass** (o filtro `subtitles`). As builds "full" do gyan.dev e do BtbN já trazem.

Como função (rodando a partir da raiz do repositório):

```python
from motores.legenda.gerar import gerar, Config, carregar_palavras
from motores.legenda.queimar import queimar, folha_de_contato

r = gerar(carregar_palavras("palavras.json"), "saida/legenda.ass", Config(modo="surgir", zona="shorts"))
print(r["qc"])                       # também: r["blocos"], r["cues"], r["arquivos"]
queimar("video.mp4", "saida/legenda.ass", "saida/final.mp4")
```

## Entrada

É uma lista de palavras, solta ou dentro de `{"palavras": [...]}`, que é o formato do `motores/voz`:

```json
{"palavras": [{"texto": "Lua", "inicio": 0.188, "fim": 0.475}, {"texto": "Terra.", "inicio": 4.1, "fim": 4.6, "cena": "fim"}]}
```

- **`texto`** é a grafia que vai para a tela, com a pontuação, porque é a pontuação que fecha a frase.
- **`inicio` e `fim`** são em segundos.
- **`cena`** é opcional. Um bloco nunca cruza troca de cena, e `--ocultar id1,id2` tira a legenda dessas cenas (por exemplo, um cartão final que já traz o texto).

Os tempos podem vir do motor de voz (`python -m motores.voz.cli sintetizar texto.txt -o saida/voz.wav` grava `saida/voz.json`) ou de uma gravação sua alinhada a um texto conhecido (`python -m motores.voz.cli alinhar gravacao.m4a texto.txt`). Nos dois casos o **texto revisado manda e o reconhecimento só empresta os tempos**, a lição do laboratório 01. O exemplo `exemplos/legenda/palavras.json` saiu do edge-tts, com a grafia do `texto.txt`.

## Especificação da legenda falada (padrão)

| Item | Padrão | Por quê |
|---|---|---|
| Motor | ASS + libass via ffmpeg, depois do render | Mudar a legenda não exige renderizar as cenas de novo, e o libass custa ~2 ms por quadro (medido abaixo) |
| Fonte | Barlow Condensed ExtraBold, TTF **estático**, OFL, em `fontes/` | Fonte condensada cabe 2 a 4 palavras em 660 px. O libass ignora o peso de fonte **variável** e cai no Regular ou no Arial |
| Corpo | 84 px de em em 1080 de largura (versal de ~59 px na Barlow) | Mínimo de legibilidade no celular. Abaixo de 85% de encolhimento o bloco é re-quebrado |
| Caixa | ALTA (`--caixa normal` para mista) | Prática de reels. Não há estudo controlado nesse formato |
| Bloco | 2 a 4 palavras, por programação dinâmica dentro de cada frase | Blocos por sintagma geram menos idas e vindas do olhar que palavra por palavra (Rajendran et al., 2013) |
| Quebra | Nunca cruza fim de frase nem troca de cena. Não separa artigo do nome, nome próprio nem número da unidade ("27 dias"). Evita terminar em "de", "que" ou "pra". Prefere quebrar depois de `, ; : —` e antes de preposição ou conjunção | Guia de legendas pt-BR da Netflix |
| Largura | Medida com a fonte real (Pillow). O espaço entre palavras ganha a folga do destaque | O bloco não "anda" quando a palavra atual cresce |
| Exibição | `visivel`: o bloco inteiro aparece ao entrar e só o destaque anda. `surgir`: a palavra aparece quando é dita | A evidência favorece `visivel`. O `surgir` existe para teste A/B |
| Destaque | Palavra atual em amarelo `#FFD633` e 106%, com troca instantânea | Cor sozinha não basta: branco × amarelo dá contraste 1,4:1 (daltonismo, WCAG 1.4.1) |
| Placa | Azul-noite `#15213B` a 92%, raio de 20 px, folga de 0,45 em nos lados e 0,30 em em cima e embaixo | Branco sobre a placa dá 16:1 e amarelo 11,4:1. O til precisa da folga de cima. `--sem-placa` usa contorno preto de 5 px |
| Tempo | ≥ 0,5 s por bloco e ≤ 20 caracteres/s. O bloco sai quando a próxima fala começa (ou até 0,8 s depois da última palavra). Entrada de 90% para 100% em 120 ms, sem movimento depois | Convenção de reels, com o mínimo de leitura |
| Números | "vinte e sete" vira 27, "trezentos e oitenta e quatro mil" vira 384.000, "sessenta por cento" vira 60%, "décimo terceiro" vira 13º. Até 10 continua por extenso. De 1000 a 9999 sai sem ponto (1988, 2026, e também 1500). Milhão redondo vira "2 milhões". `--numeros falados` desliga | O TTS precisa do número por extenso, mas na tela ele não cabe |

Cada palavra é um evento `Dialogue` com `\pos` fixo e três estados (antes, atual, depois), e a placa é um desenho vetorial (`\p1`). Assim o layout é decidido no Python e o libass só desenha.

### Zonas seguras (`--zona`)

A faixa da legenda (esquerda, direita, base) é dada em px de um quadro 1080×1920 e escala com `--tamanho`. A legenda fica com a base 8 px acima do limite.

| Perfil | Faixa x | Base | De onde vem |
|---|---|---|---|
| **`universal`** (padrão) | 120–780 | 1248 | Interseção das três abaixo. Na altura da legenda (abaixo de y 840) a coluna de botões do TikTok ocupa x > 780 |
| `reels` | 65–1015 | 1248 | [Meta Ads Guide, Reels](https://www.facebook.com/business/ads-guide/update/video/instagram-reels): 6% dos lados e 35% de baixo livres |
| `tiktok` | 120–780 | 1260 | Modelo oficial `In-Feed-Standard Version LTR` da [Central de anúncios do TikTok](https://ads.tiktok.com/help/article/tiktok-auction-in-feed-ads), em 720×1280 e medido ×1,5 |
| `shorts` | 48–888 | 1247 | [Universal Video Ad Safe Zones](https://services.google.com/fh/files/misc/universalsafezones-youtube.pdf) do YouTube, sobreposição vertical medida pixel a pixel |
| `livre` | 54–1026 | 1824 | Vídeo sem interface por cima: só 5% de margem |
| `esq,dir,base` | — | — | A sua faixa, por exemplo `--zona 100,800,1300` |

São zonas de **anúncio**: nenhuma das três plataformas publica uma zona para post orgânico. A medição foi feita na pesquisa de origem (Fábrica de reels, `docs/fabrica/pesquisa/legenda-e-layout.md`, 06/10/2026). A zona completa da interface (topo 288, base 1248, esquerda 120, direita 192 e coluna do TikTok) é a mesma de `ZONAS_9x16` do motor de render. `queimar.py --zonas` pinta essa zona de vermelho na folha de contato.

Com `--centro auto` (o padrão), a placa fica centrada na tela quando cabe e, se não cabe, encosta no limite da faixa. Com um número (`--centro 540`), a placa fica centrada nesse x e limitada ao que cabe dos dois lados. Na zona universal isso dá só 480 px, e o exemplo saiu com 31 blocos e 10 órfãos, contra 24 e 1 no `auto`.

### Calibração do libass (Fontsize × px)

O `Fontsize` do ASS **não é** o tamanho em px da fonte. O libass dimensiona a fonte para que `winAscent + winDescent` (tabela OS/2) meça `Fontsize` px. Portanto:

```
em_px    = Fontsize × unitsPerEm / (winAscent + winDescent)
base_an5 = (winAscent − (winAscent + winDescent)/2) / (winAscent + winDescent)   # com \an5, a linha de base fica base_an5·Fontsize abaixo do \pos
```

O `gerar.py` lê essas tabelas do próprio TTF, então funciona com qualquer fonte. Para conferir, desenhei `HHHHHH` com `\an5\pos(540,960)` num quadro 1080×1920 e medi a largura da tinta contra o Pillow:

| Fonte (upm; winAsc+winDesc) | Fórmula: em/Fontsize | Medido, Fontsize 100 / 200 / 400 | Versal medida (Fontsize 100 / 200 / 400) | Base com `\an5`, fórmula × medida |
|---|---|---|---|---|
| Barlow Condensed ExtraBold (1000; 1075+274) | 0,7413 | 0,7423 / 0,7423 / 0,7441 | 52 / 103 / 208 px (Pillow previa 52,0 / 103,9 / 208,3) | 0,297 × 0,295–0,300 |
| Arial (2048; 1854+434) | 0,8951 | 0,8917 / 0,8929 / — | 64 / 128 px | 0,310 × 0,310 |
| Georgia (2048; 1878+449) | 0,8801 | 0,8765 / 0,8775 / — | 61 / 122 px | 0,307 × 0,305–0,310 |

O erro fica abaixo de 0,5%. Em 400, Arial e Georgia passaram da largura do quadro e ficaram fora da tabela. Na Barlow, **84 px de em pedem Fontsize 113,3**. O laboratório de origem usava a constante 0,734 (Fontsize 114,4), medida em tamanho menor, o que deixava o texto ~1% maior que o previsto.

## Legenda acessível (`.srt` e `.vtt`)

É uma legenda diferente da falada: caixa normal, **até 2 linhas de até 42 caracteres** e até 17 caracteres/s (regras da Netflix pt-BR e do Guia para Produções Audiovisuais Acessíveis do MinC). As cues também saem por programação dinâmica dentro da frase, com as mesmas regras de quebra. Cada cue fica na tela pelo menos 5/6 s e sai quando a próxima começa, ou até 0,6 s depois da fala. Os números seguem a opção `--numeros`.

Ela não substitui uma LSE (legenda para surdos e ensurdecidos) feita por gente: não identifica quem fala nem descreve sons (`[música]`, `[risos]`). Esses itens podem ser acrescentados à mão no `.srt`.

## QC

O `gerar.py` imprime, e grava com `--relatorio` (junto com a geometria e o tempo de cada bloco), uma checagem sem abrir vídeo:

| Campo | O que conta |
|---|---|
| `orfaos` | blocos de uma palavra só |
| `curtos` | blocos com menos de 0,5 s |
| `quebras_ruins` | quebras que separam artigo e nome, nome próprio ou número e unidade |
| `encolhidos`, `menor_escala` | blocos que não couberam no corpo cheio, e quanto encolheram (nunca abaixo de 0,85) |
| `fora_da_zona` | placas fora da faixa |
| `sobreposicoes` | blocos que se sobrepõem no tempo |
| `ultima_palavra_curta` | blocos cuja última palavra fica menos de 0,4 s na tela. Depende da velocidade da fala: na voz do exemplo (~188 palavras/min) cada palavra dura ~0,3 s |
| `numeros` | o que virou algarismo, para conferir |
| `lse` | cues, maior linha e cues acima de 17 cps |

O `queimar.py` confere **qual fonte o libass usou** em cada estilo. Ele desenha um quadro de teste e lê o `fontselect` do log. Se a fonte escolhida não for de `--fontes`, avisa, e com `--estrito` para.

## Caminhos no Windows

O filtro `subtitles` do ffmpeg tem dois níveis de escape: o valor da opção (`:` separa chaves) e o grafo de filtros (`,` `;` `[` `]` separam filtros). Um `C:\` cru quebra o comando. O `escapar_filtro()` usa caminho absoluto com `/` e escapa os dois níveis. Foi testado com a pasta `pasta d'Ana, [x];1` (espaço, apóstrofo, vírgula, colchetes e ponto e vírgula) e com `C:\LIA - UEFS\...`.

## Medições

Máquina: notebook Ryzen 7 5700U (16 threads), 19 GB, Windows 11, Python 3.13.12, Pillow 12.3.0, ffmpeg 9.0.2 (gyan.dev, com libass). São rodadas seguidas, não médias controladas.

Exemplo `exemplos/legenda` (72 palavras, 24 s de fala, edge-tts `pt-BR-FranciscaNeural`):

| O quê | Resultado |
|---|---|
| `gerar.py` (processo inteiro: Python, Pillow, .ass, .srt, .vtt) | 0,43–0,45 s (3 rodadas). A função `gerar()` sozinha: 0,12 s |
| Blocos (zona universal) | 24 blocos, 1 órfão, 2 curtos, 1 quebra ruim (`DE 384.000 \| QUILÔMETROS,`: a 84 px não cabe nem encolhida), 6 encolhidos (menor 0,881), 0 fora da zona, 0 sobreposições |
| Blocos (`--zona reels`, 950 px) | 20 blocos, 1 órfão, 0 quebras ruins, 2 encolhidos |
| `.srt` | 6 cues, maior linha com 39 caracteres, 0 acima de 17 cps |
| Queimar 24 s em 1080×1920 (`testsrc2`, x264 `veryfast` crf 19, áudio copiado, com a conferência de fonte) | 5,4 s. Sobre fundo liso: 3,8–4,7 s. Sobre o MP4 de 6 s do `exemplos/ola-mundo`: 2,3 s |
| Custo do libass sozinho (decodificar com e sem o filtro, 714 quadros) | 1,1–1,6 s × 2,4–2,6 s: **~1,2 s, ou ~1,7 ms por quadro**. O que pesa é o reencode x264 (5,2–5,6 s sem legenda) |
| Folha de contato (`--teste`, 6 instantes) | 3,3 s |

Cores no MP4 queimado, sobre cinza `#808080`: a placa `#15213B` a 92% saiu (28, 40, 62), e a conta previa (29,6, 40,6, 64,5). O amarelo `#FFD633` saiu (254, 213, 51) e o branco (255, 253, 252). Sobre o MP4 do motor de render, a saída manteve `yuv420p`, `color_range=tv` e `bt709` nos três campos.

Conferido a olho nas folhas de contato: a fonte é a Barlow, os acentos sobre versal (VÊ, NÃO, É, SUPERFÍCIE, DISTÂNCIA, MÉDIA, QUILÔMETROS) ficam dentro da placa, o destaque segue a fala e nada passa da zona universal. Também conferi `surgir`, `--sem-placa` e 720×1280 (`--tamanho 720x1280`, placa em y 753–827). O contorno começou com 6 px, mas colava as palavras ("NESSE CAMINHO,"). Agora tem 5 px e entra na conta do espaço entre palavras.

## Limites conhecidos

- A quebra **não trata** siglas soletradas pelo TTS ("SUS" falado "esse-u-esse"), nome próprio com minúscula ("de Gaulle") nem número de 4 dígitos que não é ano (sai "1500", não "1.500").
- Um bloco que não cabe nem encolhido a 85% (número longo mais unidade longa) é quebrado mesmo contando como quebra ruim, e o QC mostra o caso.
- As zonas são de anúncio. A interface de post orgânico muda com o tamanho da legenda do post (a verificar com capturas reais).
- `.srt` e `.vtt` sem identificação de falante nem efeitos sonoros (ver acima). Não verifiquei quais plataformas aceitam envio de arquivo de legenda em vídeo vertical.
- A conferência de fonte depende do texto do log do libass (`fontselect: (...) -> NomePostScript`). Se uma versão futura mudar esse texto, a conferência não acha nada e não avisa.

## Licenças

O código é Apache-2.0, como o repositório. As dependências de terceiros:

- **Barlow Condensed** (`fontes/`): SIL OFL 1.1.
- **Pillow:** MIT-CMU (HPND).
- **ffmpeg e libass:** usados como programa externo, não distribuídos aqui. O libass é ISC. O ffmpeg é LGPL ou GPL conforme a build.
