# Render: de uma página HTML para um MP4

> Conceito, decisões e números do `motores/render`. A referência de uso (CLI, opções, função) está no [README do motor](../motores/render/README.md) e o contrato da cena em [CONTRATO.md](../motores/render/CONTRATO.md).

## A ideia

Uma **cena é uma página HTML que sabe se desenhar em qualquer instante `t`**. O motor não sabe o que a cena desenha: ele abre a página no Chrome headless, chama `window.seek(t)` para cada quadro, fotografa e manda a foto para o ffmpeg.

Por que HTML: é a linguagem visual que mais gente (e mais agente de código) sabe escrever. Tipografia, SVG, gradientes, `<canvas>`, imagens e fontes funcionam como num site. E dá para abrir a mesma página no navegador para ver.

Por que `seek(t)` em vez de gravar a página tocando: uma página "tocando" depende do relógio, e o relógio de uma máquina ocupada atrasa. Com `seek(t)`, o quadro 512 é sempre o mesmo, não importa quanto tempo levou para fotografar o 511. Isso é o que permite o resto: vários processos em paralelo, cada um com a sua fatia, pulo de quadros repetidos e testes reproduzíveis.

## As decisões, em ordem de impacto

O ponto de partida foi o laboratório de origem: uma cena de 47 s (1.407 quadros, com textura de grão em SVG) levava **~25 minutos** com `page.screenshot()` do Playwright. A pesquisa mediu cada troca isoladamente, na mesma máquina:

| Mudança | Por quê | Efeito medido (cena de 47 s) |
|---|---|---|
| **Foto em JPEG pelo CDP**, com `optimizeForSpeed: true` | O `page.screenshot()` pede PNG sem esse parâmetro, e a textura de grão deixa o PNG incompressível: ~1 s por foto. O culpado não era o grão em si (trocá-lo por uma imagem estática não mudou nada), era o PNG lento. | ~1.056 → ~81 ms por quadro (13×) |
| **Bytes direto pelo stdin do ffmpeg** (`image2pipe`), sem pasta de quadros | Nada de gravar e reler milhares de arquivos. | parte do ganho acima |
| **N processos Chrome**, não abas | Abas no mesmo Chrome dividem o mesmo compositor: 4 abas deram 58 ms/quadro contra 37 ms com 4 processos. Cada processo pega uma **fatia contígua** de quadros e tem o seu ffmpeg; no fim, `concat` sem reencode. | 110 s (1 processo) → 46 s (4) |
| **Pulo de quadros pela chave de estado** | Em vídeos com pausas, boa parte dos quadros é igual à anterior (61% na cena de 47 s). A cena devolve uma chave em `seek(t)`; se repete, o motor reenvia a foto anterior. | 46 s → **28 s** (549 fotos de 1.407) |
| Mais de 4 processos | Os x264 começam a disputar a CPU. | 6 processos ficaram mais lentos que 4 |

Resultado: **~25 min → 28 s** para a mesma cena, mais rápido que a duração do próprio vídeo. Os números vêm da pesquisa do laboratório de origem (ver "Origem" abaixo); o motor deste repositório é a generalização desse caminho.

### Cor: por que o motor converte para "faixa de TV"

O JPEG do Chrome é **faixa cheia, BT.601**. Os players de celular esperam **faixa de TV (16–235), BT.709** em vídeo HD. Se ninguém converte, as cores sólidas saem lavadas ou escurecidas, e cada player interpreta de um jeito. O motor converte com arredondamento preciso e **marca** `bt709` e `color_range=tv` no arquivo. Medido: as cores sólidas voltam do MP4 com no máximo 2 níveis de diferença (#f2b84b → 242,184,77).

### Determinismo e o modo `--verificar`

O pulo de quadros confia na cena. Se algo anima fora do `seek` (CSS `animation`, `transition`, GIF, `<video>`, fonte que chega atrasada), a chave repete mas a imagem não, e o vídeo sai errado **sem aviso**. Por isso existe `--verificar`: o motor fotografa também os quadros pulados e conta quantos saíram diferentes. Use ao escrever uma cena nova; precisa dar 0.

### O que ficou de fora (por ora)

- **`HeadlessExperimental.beginFrame`** no `chrome-headless-shell`: compositor determinístico (sem quadro "meio pintado"). Funcionou no Windows na pesquisa (~60 ms/quadro em 1 processo, SSIM 0,993 contra o screenshot), mas o ganho sobre o JPEG por CDP é pequeno e exige baixar outro binário.
- **Canvas + WebCodecs dentro da página:** eliminaria a foto, mas obriga a reescrever a cena como desenho em canvas e perde o HTML editável.
- **Encoder por hardware** (`h264_amf`, `h264_nvenc`, `h264_qsv`): não medido. Pode liberar CPU para mais processos.
- **Prévia ao vivo fiel ao export:** hoje a prévia é a folha de contato (`--teste`), ~2,5–3,4 s.

## Números medidos neste repositório

Notebook Ryzen 7 5700U (8 núcleos / 16 threads, Radeon integrada), 19 GB, Windows 11, Chrome 154, Node 20.20.1, playwright-core 1.63.0, ffmpeg 9.0.2. Rodadas seguidas no mesmo estado; o notebook varia até 2× com temperatura e plano de energia, então leia como ordem de grandeza.

| Cena | Quadros | Fotos | Configuração | Tempo |
|---|---|---|---|---|
| `exemplos/ola-mundo` (6 s) | 180 | 118 | 4 workers + pulo (padrão) | 6,8–7,5 s |
| `exemplos/ola-mundo` | 180 | 180 | 4 workers, `--sem-dedup` | 7,7 s |
| `exemplos/ola-mundo` | 180 | 117 | 1 worker + pulo | 9,6–10,9 s |
| `exemplos/ola-mundo` | 180 | 180 | 1 worker, `--sem-dedup` | 14,2–14,4 s |
| `exemplos/explicativo` (33,2 s) | 998 | 649 | 4 workers + pulo | 22,9–25,8 s |
| `exemplos/explicativo`, `--verificar` | 998 | 649 (+349 conferidas, 0 diferentes) | 4 workers | 25,8 s |
| Folha de contato (`--teste`, 1 a 6 instantes) | — | — | 1 processo | 2,5–3,4 s |

Numa cena curta, abrir os Chrome pesa (~2,5 s). Na cena explicativa o render fica abaixo da duração do vídeo (~0,75× o tempo real). O vídeo com e sem pulo de quadros dá SSIM 1,000000 no `ola-mundo`.

**Memória:** com 4 processos em 1080×1920, a pesquisa mediu ~5,5 GB de pico (Chrome + 4 x264, *working set*, que superestima a memória compartilhada). O padrão do motor é 4 workers com 16 GB ou mais, 2 com 8 GB e 1 abaixo disso. **Não foi medido num PC de 4 núcleos e 8 GB**: é um dos problemas em aberto.

## Escrevendo uma cena

1. Comece do `exemplos/ola-mundo/cena.html` (mínimo) ou do `exemplos/explicativo/cena.html` (várias cenas, dados externos, gatilhos por palavra).
2. Tudo o que muda na tela é calculado dentro de `seek(t)`, a partir de `t`. Funções pequenas ajudam: `fase(t, ini, dur)` dá 0→1 numa janela, `suave(x)` suaviza.
3. Monte a chave de estado com os **mesmos números arredondados** que você aplica no estilo.
4. Confira com `--teste t1,t2,... --zonas` (zona segura em vermelho) e, uma vez, com `--verificar`.

## Origem

Este motor generaliza o render do laboratório 03 da Fábrica de reels (`reels-fabric`) e a pesquisa "render rápido" (06/10/2026), que comparou Playwright, CDP, abas × processos, `beginFrame`, Remotion, HyperFrames, timesnap e puppeteer-capture lendo o código de cada um. Ao generalizar, apareceu um erro no original: na folha de contato, com `-framerate 1`, a base de tempo do ffmpeg é 1 s e o `setpts` truncava o instante (pedir 2,8 s desenhava a legenda de 2 s). Aqui foi corrigido com `settb=1/90000`.
