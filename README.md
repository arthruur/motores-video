# motores-video

Motores locais e grátis para fazer vídeo vertical (Reels, TikTok, Shorts) com código, num PC comum, sem GPU dedicada.
São quatro motores: três peças independentes, **render** (cena HTML → MP4), **voz** (texto → narração com o tempo de cada palavra) e **legenda** (palavras → legenda queimada + .srt/.vtt), e a **colagem**, que monta fragmentos de falas reais por tema, cortados entre frases e com a fonte de cada um na tela, em cima da voz e da legenda.
Código e documentação em português do Brasil. Licença Apache-2.0.

**Novo: [Prensa](app), o app para quem não programa. Use em https://arthruur-prensa.static.hf.space.** Escolha um vídeo no celular, marque o trecho, escolha o formato e aperte Prensar: saem reels prontos para TikTok, Reels, Shorts, Kwai e status do WhatsApp, com legenda palavra a palavra, gancho e fonte na tela. Roda inteira no aparelho, no navegador, sem enviar nada para servidor.

> **In English:** local, free engines for vertical video on a CPU-only PC: an HTML-scene renderer (parallel headless Chrome → ffmpeg), a voice engine with swappable TTS providers and per-word timing, a caption engine (burned-in ASS via libass + SRT/VTT), and a collage engine that finds fragments of real speeches by topic (Whisper + EmbeddingGemma 2), cuts them between sentences and assembles a credited 9:16 reel.
> A 33 s narrated, captioned explainer goes from script to final MP4 in 40–50 s on a Ryzen 7 laptop without a dedicated GPU.
> Code and docs are in Brazilian Portuguese. Apache-2.0.

## Por que existe

Fazer um vídeo curto explicativo ainda é caro para quem não tem verba, nem placa de vídeo, nem tempo de aprender um editor profissional. Ao mesmo tempo, quase tudo num vídeo desse tipo pode ser **descrito**: uma página HTML que se desenha em qualquer instante, um texto que vira voz, palavras com tempo que viram legenda. Descrito, o vídeo vira código: versiona como texto, refaz em segundos e escala.

Estes motores nasceram dos laboratórios da Fábrica de reels (projeto `reels-fabric`), onde o render de um vídeo de 47 s levava ~25 minutos. Depois de medir cada gargalo, o mesmo render passou a levar 28 s. Aqui os motores foram separados, generalizados e documentados para a comunidade.

A ideia de fundo: **a máquina mede, sugere e prepara; quem cria decide.** Prévia em segundos, opções lado a lado, uma palavra para trocar a voz. Ver [docs/fundamentos.md](docs/fundamentos.md).

## Demonstração

```bash
python exemplos/explicativo/gerar.py
```

Gera `saida/explicativo/explicativo.mp4`: "Por que o céu é azul?", 33 s, 1080×1920, narrado (edge-tts), com legenda palavra a palavra, trilha sintetizada com *ducking* e loudness em −14 LUFS. As cenas entram na palavra em que são ditas. Leva 40–50 s (~35 s com a voz já gerada). Detalhes em [exemplos/explicativo](exemplos/explicativo).

<!-- GIF refeito com:
     ffmpeg -ss 2 -t 8 -i saida/explicativo/explicativo.mp4 -vf "fps=12,scale=360:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128[p];[b][p]paletteuse=dither=bayer:bayer_scale=4" docs/img/demo.gif -->
![Por que o céu é azul? 8 s do exemplo explicativo, sem som](docs/img/demo.gif)

Um caminho mais curto, só o render: `node motores/render/render.mjs exemplos/ola-mundo` (6 s de vídeo em 7–8 s).

Outros três exemplos de ponta a ponta:

| Exemplo | O que sai | Comando |
|---|---|---|
| [`mudar-o-que`](exemplos/mudar-o-que) | "Mudar o quê?": explicativo de opinião de 47 s, com a fonte de cada fato na tela e rótulo de IA | `python exemplos/mudar-o-que/gerar.py` |
| [`karaoke-discurso`](exemplos/karaoke-discurso) | 23 s do discurso de Ulysses Guimarães na promulgação da Constituição (1988), com legenda palavra a palavra alinhada ao áudio original | `python exemplos/karaoke-discurso/gerar.py` |
| [`colagem-democracia`](exemplos/colagem-democracia) | "O que é democracia?": colagem de 66 s com Ulysses Guimarães, Lélia Gonzalez, Marielle Franco e Paulo Freire | `python exemplos/colagem-democracia/baixar.py` e depois `python -m motores.colagem.cli montar exemplos/colagem-democracia/colagem.json` |

Os dois últimos usam vídeos de terceiros, que **não estão no repositório**: ver [Exemplos com material de terceiros](#exemplos-com-material-de-terceiros).

## Prensa: o app

```bash
cd app && npm install && npm run dev      # abra o endereço no celular, na mesma rede, e "Adicionar à tela inicial"
```

Escolher vídeo → tocar numa receita (Corte direto, Você sabia?, Dica rápida, Estímulo duplo, Mito ou fato, Frase de impacto, Cívico) → **Prensar** → compartilhar. A legenda (Whisper, no próprio aparelho) começa assim que o vídeo chega, e o gancho já vem sugerido a partir da própria fala. O som passa pelo motor do [Audio FXtor](https://github.com/matheustdo/audio-fxtor) (−14 LUFS, remoção de ruído). Com a legenda pronta, um vídeo de 33 s vira 5 arquivos em 16 a 26 s num notebook sem GPU.

Detalhes e números no [README do app](app/README.md). As receitas e a evidência por trás de cada uma estão em [docs/receitas.md](docs/receitas.md), o acervo de vídeos de retenção com licença livre em [docs/acervo.md](docs/acervo.md) (como contribuir em [docs/contribuir_acervo.md](docs/contribuir_acervo.md)) e os limites de cada rede em [docs/plataformas.md](docs/plataformas.md).

## Instalação

Você precisa de **Node 20+**, **Python 3.10+**, **Chrome ou Edge** instalado e **ffmpeg com libass** no PATH.

### Windows

```powershell
winget install OpenJS.NodeJS.LTS
winget install Python.Python.3.13
winget install Gyan.FFmpeg                    # o build do gyan.dev traz libass
# feche e abra o terminal para o PATH novo valer (node, python, ffmpeg)
git clone <url-do-repositório> motores-video
cd motores-video
npm install                                   # só o playwright-core: usa o Chrome/Edge já instalado
python -m venv .venv
.venv\Scripts\activate                        # se o PowerShell bloquear: Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
pip install -r requirements.txt
```

### Linux (Debian/Ubuntu)

```bash
sudo apt install nodejs npm python3 python3-venv ffmpeg     # confira node -v (precisa ser 20+; se não, use o nvm)
# Chrome ou Chromium instalado (ou aponte o executável com --chrome)
git clone <url-do-repositório> motores-video && cd motores-video
npm install
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
```

### macOS

```bash
brew install node python ffmpeg              # o ffmpeg do Homebrew vem com libass
git clone <url-do-repositório> motores-video && cd motores-video
npm install
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
```

Conferências: `ffmpeg -filters` precisa listar o filtro `subtitles` (é o libass), e `python -m motores.voz.cli provedores` mostra quais vozes estão disponíveis. Na primeira vez, o faster-whisper baixa o modelo `small` (~460 MB). Testado só no Windows 11; os passos de Linux e macOS seguem a documentação de cada ferramenta e ainda não foram rodados.

**Vozes locais (opcional):** Kokoro e Piper rodam offline, mas puxam código GPL-3.0 e por isso ficam fora do `requirements.txt`. Instalação e download dos modelos no [README da voz](motores/voz/README.md).

## Uso rápido

```bash
# render: cena HTML -> MP4 (e a folha de contato para conferir)
node motores/render/render.mjs exemplos/ola-mundo --teste 0.5,1.5,3,5 --zonas
node motores/render/render.mjs exemplos/ola-mundo --saida saida/ola-mundo.mp4

# voz: texto -> WAV + tempo de cada palavra (+ nota de precisão pelo Whisper)
python -m motores.voz.cli sintetizar exemplos/voz/frase.txt --provedor edge --saida saida/voz/frase.wav --qa
python -m motores.voz.cli alinhar saida/voz/frase.wav exemplos/voz/frase.txt --json saida/voz/frase-alinhada.json
#   troque pelo seu áudio e o seu texto para ter os tempos da sua própria voz (sem --json, grava ao lado do áudio)

# legenda: palavras -> .ass (queimada) + .srt/.vtt
python motores/legenda/gerar.py exemplos/legenda/palavras.json -o saida/legenda/lua.ass
python motores/legenda/queimar.py saida/ola-mundo.mp4 saida/legenda/lua.ass -o saida/legenda/final.mp4   # ou o seu vídeo

# tudo junto
python exemplos/explicativo/gerar.py                                   # edge-tts: precisa de internet
python exemplos/explicativo/gerar.py --provedor kokoro --voz pm_alex   # offline, depois de instalar o Kokoro (README da voz)

# colagem: fontes.json -> trechos -> índice -> candidatos por tema -> (você escreve o colagem.json) -> MP4
python -m motores.colagem.cli baixar  exemplos/colagem-democracia/fontes.json      # precisa do yt-dlp
python -m motores.colagem.cli indexar exemplos/colagem-democracia/fontes.json      # opcionais: motores/colagem/requisitos.txt
python -m motores.colagem.cli sugerir exemplos/colagem-democracia/fontes.json "o que é democracia"
python -m motores.colagem.cli montar  exemplos/colagem-democracia/colagem.json
```

Todos os comandos têm `--help`, e cada motor também funciona como biblioteca (`renderizar()` em JS; `sintetizar()`, `alinhar()`, `avaliar()`, `gerar()`, `queimar()`, `indexar()`, `sugerir()`, `montar()` em Python). Como os motores conversam: [docs/arquitetura.md](docs/arquitetura.md).

## Mapa do repositório

| Caminho | O que é |
|---|---|
| [`motores/render/`](motores/render) | Cena HTML → MP4: N processos Chrome, captura JPEG por CDP, ffmpeg por stdin, pulo de quadros, cor BT.709. [Contrato da cena](motores/render/CONTRATO.md) |
| [`motores/voz/`](motores/voz) | Provedores trocáveis (edge, Kokoro, Piper, Azure, ElevenLabs, gravação), alinhador pelo Whisper, QA, pronúncia por motor |
| [`motores/legenda/`](motores/legenda) | Blocos medidos com a fonte, destaque da palavra, zona segura, calibração do libass, .srt/.vtt, QC |
| [`motores/colagem/`](motores/colagem) | Fragmentos de falas reais por tema: download só do trecho (yt-dlp), índice (Whisper + EmbeddingGemma 2), sugestão com MMR e corte entre frases, montagem 9:16 com a fonte em cada fragmento e ficha |
| [`exemplos/ola-mundo/`](exemplos/ola-mundo) | A cena mínima (6 s) |
| [`exemplos/voz/`](exemplos/voz), [`exemplos/legenda/`](exemplos/legenda) | Entradas de teste dos motores |
| [`exemplos/explicativo/`](exemplos/explicativo) | O exemplo de ponta a ponta: roteiro → voz → cena → render → legenda → mixagem |
| [`exemplos/mudar-o-que/`](exemplos/mudar-o-que) | Explicativo de opinião com fontes e rótulo de IA (feito em período eleitoral; ver a nota de contexto) |
| [`exemplos/karaoke-discurso/`](exemplos/karaoke-discurso) | Discurso de arquivo com legenda alinhada ao áudio original; vídeo baixado em `entrada/` |
| [`exemplos/colagem-democracia/`](exemplos/colagem-democracia) | Colagem de quatro falas com o motor de colagem; vídeos baixados em `entrada/` |
| [`app/`](app) | **Prensa**: o app no navegador (mediabunny + transformers.js), tudo no aparelho. [README](app/README.md) |
| [`ferramentas/acervo/`](ferramentas/acervo) | Coletor do acervo de vídeos de retenção (Wikimedia Commons, licença livre, revisão humana) |
| [`docs/`](docs) | [Fundamentos](docs/fundamentos.md), [arquitetura](docs/arquitetura.md), [render](docs/render.md), [voz](docs/voz.md), [legenda](docs/legenda.md), [colagem](docs/colagem.md), [direções](docs/direcoes.md), [plataformas](docs/plataformas.md), [receitas](docs/receitas.md), [acervo](docs/acervo.md) |
| `fontes/` | Barlow Condensed ExtraBold (OFL), servida às cenas em `/_fontes/` e usada pela legenda |

## Números

Medidos num notebook Ryzen 7 5700U (8 núcleos / 16 threads, sem GPU dedicada), 19 GB, Windows 11. Rodadas seguidas, não médias controladas: o notebook varia até 2× com temperatura e energia.

| O quê | Resultado |
|---|---|
| Render de uma cena de 47 s (1.407 quadros, com textura), no laboratório de origem | **~25 min → 28 s** (JPEG por CDP, 4 processos, pulo de quadros) |
| `exemplos/ola-mundo` (6 s, 180 quadros) | 6,8–8,3 s |
| `exemplos/explicativo` (33 s): render das cenas, 998 quadros, 649 fotos | 24,7–30,2 s |
| `exemplos/explicativo` de ponta a ponta (voz edge nova → MP4 final) | 39,4–50,9 s; 35,3–36,0 s com a voz reaproveitada |
| Mesmo exemplo com Kokoro local (síntese + alinhamento pelo Whisper) | 113,8 s |
| Legenda: gerar .ass/.srt/.vtt | 0,2–0,45 s |
| Legenda: custo do libass ao queimar | ~1,7 ms por quadro |
| Alinhador (Whisper `small`) contra os tempos nativos do edge | mediana de 47–50 ms no início da palavra |
| Loudness do final (alvo −14 LUFS, 2 passagens) | −14,2 LUFS (edge), −14,9 LUFS (Kokoro); pico −1,5 dBTP |
| `exemplos/mudar-o-que` (47 s) de ponta a ponta | 60,3 s com voz nova e QA pelo Whisper; 40,8 s com a voz reaproveitada |
| `exemplos/karaoke-discurso` (23 s): download do trecho de 30 s / alinhar → MP4 | 21,6 s / 31,2 s (17,5 s com o alinhamento em cache); 38 de 39 palavras com tempo exato |
| `exemplos/colagem-democracia`: download dos 4 trechos (32 MB) / `montar` (66 s de vídeo) | 62,3 s / 64,4–147,3 s; −14,1 LUFS, pico −1,4 dBTP |
| Colagem: `indexar` de 7 falas sem cache (Whisper + EmbeddingGemma 2) | 403,6 s, quase tudo transcrição |
| Colagem: `indexar` / `sugerir` das 4 falas do exemplo (transcrição pronta em `palavras/`) | 32,7 s / 22,8 s (a busca em si: 0,26 s) |

Detalhes e o que ficou de fora em [docs/render.md](docs/render.md), [docs/voz.md](docs/voz.md), [docs/legenda.md](docs/legenda.md) e no [README da colagem](motores/colagem/README.md).

## Exemplos com material de terceiros

`karaoke-discurso` e `colagem-democracia` usam trechos de vídeos publicados por outras pessoas e instituições (TV Câmara, Cultne, Instituto Marielle Franco, TV PUC-SP).

- **Os vídeos não estão no repositório.** O `baixar.py` de cada exemplo baixa só o trecho usado, com o yt-dlp (`pip install yt-dlp`), para `exemplos/<exemplo>/entrada/`, que o git ignora. O repositório guarda só texto: URL, trecho, crédito e a fala conferida.
- **Os direitos são dos titulares.** Os trechos são curtos e usados como citação, para estudo, com quem fala, a data, a ocasião e a origem na tela (Lei 9.610/98, art. 46, III). Isto não é orientação jurídica: se for publicar, mantenha os créditos e respeite os termos da plataforma.
- **O arquivo pode já vir editado.** O vídeo do Ulysses é uma montagem da TV Câmara, com fotos de arquivo e trechos emendados, e os dois exemplos avisam isso na tela.

Crédito de cada fonte no README e no `fontes.json` de cada exemplo; ver também [THIRD_PARTY.md](THIRD_PARTY.md).

## Princípios

- **Local e grátis primeiro, pago como opção.** Tudo roda sem GPU. Serviços pagos entram por adaptadores e só rodam com chave **e** confirmação explícita.
- **Determinismo.** Mesma entrada, mesmo vídeo. A cena é função do tempo: é isso que permite paralelizar, pular quadros e testar.
- **Medir antes de afirmar.** Os números deste README foram medidos; o que não foi testado está escrito como não testado.
- **O criador decide.** Prévia rápida (folha de contato em ~3 s), legenda refeita sem renderizar de novo, voz trocada com um parâmetro.
- **Rótulo de IA e fonte visível.** Voz sintética é de narrador e vem com rótulo pronto. **Nunca** imitar voz ou rosto de pessoa real. Fala real só entra com o som original, a frase inteira, quem, quando e a fonte na tela.
- **Licenças limpas.** O núcleo usa Apache-2.0 e dependências permissivas ou LGPL; o que é GPL (Piper, e o Kokoro via espeak-ng) é opcional. Ver [THIRD_PARTY.md](THIRD_PARTY.md).

## Ideias para construir 🚀

Estes motores são **base**, não produto acabado. O convite é para a comunidade de software livre construir em cima deles as **ferramentas de criação facilitada de vídeo com IA** que hoje só existem fechadas, pagas e em dólar. Ferramentas para qualquer pessoa transformar uma ideia, uma aula ou um discurso em vídeo que circula, rodando no próprio computador.

Cada ideia abaixo virou uma issue com ponto de partida e critério de "pronto". Comente na issue antes de começar, para a gente alinhar.

| Ideia | Issue |
|---|---|
| **Discurso → cortes virais:** achar e cortar os melhores momentos de uma fala longa, prontos para postar | [#1](https://github.com/arthruur/motores-video/issues/1) |
| **Tela dividida de retenção:** conteúdo em cima, vídeo satisfatório embaixo (gameplay, sabão, slime…), com licenças em ordem | [#2](https://github.com/arthruur/motores-video/issues/2) · 1ª versão na [Prensa](app) |
| **Exportação multiplataforma:** TikTok, YouTube Shorts, Kwai, Reels e status de WhatsApp, cada um no formato certo | [#3](https://github.com/arthruur/motores-video/issues/3) · 1ª versão na [Prensa](app) |
| **Templates de gancho e formatos virais:** "você sabia?", POV, lista, edit no beat | [#4](https://github.com/arthruur/motores-video/issues/4) · 1ª versão na [Prensa](app) |
| **Interface web amigável:** para quem não programa, rodando local | [#5](https://github.com/arthruur/motores-video/issues/5) · 1ª versão na [Prensa](app) |
| **Emoção na voz sintética** | [#6](https://github.com/arthruur/motores-video/issues/6) |
| **Prévia ao vivo fiel ao export** | [#7](https://github.com/arthruur/motores-video/issues/7) |
| **Medir num PC modesto** (boa primeira issue) | [#8](https://github.com/arthruur/motores-video/issues/8) |
| **Acessibilidade:** legendas para surdos e Libras | [#9](https://github.com/arthruur/motores-video/issues/9) |
| **[Pesquisa] Testbed ético de agentes sintéticos** | [#10](https://github.com/arthruur/motores-video/issues/10) |
| **Prensa: receber vídeo por link** (X, Instagram, TikTok, YouTube) | [#11](https://github.com/arthruur/motores-video/issues/11) |

Todas as issues: [github.com/arthruur/motores-video/issues](https://github.com/arthruur/motores-video/issues). As regras valem para tudo o que for construído aqui: **fonte visível** quando for fato, **rótulo de IA** quando houver voz ou conteúdo sintético, e **nunca** imitar voz ou rosto de pessoa real.

## Direções

O repositório aponta para dois lados. O texto completo está em [docs/direcoes.md](docs/direcoes.md).

**1. Produto: ferramenta para quem cria.** A máquina mede e prepara; a pessoa decide. Problemas em aberto, bons para contribuir: **emoção na voz sintética** (as vozes grátis soam neutras demais), **alinhador universal** para qualquer áudio, **prévia ao vivo fiel ao export**, **PC modesto** (medir e ajustar tudo em 4 núcleos e 8 GB, típico de telecentro), **legenda em fala corrida** (tempo mínimo de leitura × bloco que sai quando a próxima fala começa) e **acessibilidade** (.srt/.vtt melhores e Libras).

**2. Pesquisa: testbed ético de agentes sintéticos.** Estes motores fabricam vídeo curto de forma programática e barata. A mesma capacidade é usada, fora daqui, para **comportamento inautêntico coordenado**. A linha de pesquisa propõe **estudar esses fenômenos para aprender a detectá-los e mitigá-los**, simulando-os com agentes sintéticos **num ambiente fechado e próprio**, sem nunca executar o ataque de verdade:

- **Ataque Sybil:** como muitas identidades de um só operador distorcem curtidas, votos, denúncias e recomendação, e que sinais (sincronia, idade das contas, grafo de interações) as denunciam.
- **Evasão de filtros:** quão robustos são os **nossos próprios** filtros e moderadores automáticos contra variações de texto, imagem e áudio, testados com conteúdo marcador inofensivo.
- **Grooming:** que padrões de conversa e de escalada de contato os sistemas de proteção de crianças e adolescentes precisam reconhecer, estudados **a partir de literatura e de conjuntos de dados de pesquisa já existentes e anonimizados**. Nunca se gera conteúdo sexual nem se simula a vitimização de menores.
- **Golpes de portfólio falso:** como perfis e trabalhos fabricados ganham credibilidade, e como verificar autenticidade e procedência.
- **Fake streamers:** como transmissões sintéticas ou em loop afetam recomendação e métricas, e como detectar inatividade e conteúdo repetido.
- **Fenômenos de coordenação** em geral: o que separa uma campanha legítima e transparente de manipulação.

Os agentes do testbed simulam padrões **sem dano real**:

| Agente | Comportamento simulado | Para testar |
|---|---|---|
| Normal | aleatório dentro de distribuições realistas | a linha de base |
| Coordenado benigno | posta em horários sincronizados, com mensagens de uma lista fixa | se a detecção de coordenação funciona |
| Spam | repete mensagens genéricas | limite de taxa (*rate limiting*) e moderação automática |
| Fake streamer sintético | transmite um vídeo genérico em loop, feito por estes motores | recomendação e detecção de inatividade |
| Teste de moderação | tenta ações que **devem** ser bloqueadas, com marcadores inofensivos no lugar de conteúdo nocivo | se o bloqueio acontece |

**Regras do testbed:** ambiente fechado (por exemplo uma instância local de Mastodon, PeerTube ou Owncast numa rede isolada; **nunca** plataformas reais); ninguém real como alvo e nenhum dado pessoal; conteúdo marcador rotulado `[TESTE]`, nunca nocivo; resultados publicados como **defesa** (métricas, detectores, dados sintéticos rotulados), sem receitas de ataque operacionais; revisão ética (CEP/Conep quando houver componente humano) e divulgação responsável de qualquer fragilidade em sistemas de terceiros; rótulo de "sintético, para pesquisa" em todo artefato.

Esta linha é **direção, não código**: o repositório não contém agentes nem automação de contas. Quem quiser colaborar, abra uma issue para discutirmos desenho e ética **antes** de qualquer implementação.

## Contribuir

Leia o [CONTRIBUTING.md](CONTRIBUTING.md): como propor, estilo, como testar e as regras éticas (proibido usar os motores para deepfake de pessoa real ou para automação de contas em plataformas reais). Histórico em [CHANGELOG.md](CHANGELOG.md).

## Licença

Apache-2.0, ver [LICENSE](LICENSE) e [NOTICE](NOTICE). Copyright 2026 Arthur Teles. A fonte Barlow Condensed em `fontes/` é SIL OFL 1.1. Licenças das dependências em [THIRD_PARTY.md](THIRD_PARTY.md).
