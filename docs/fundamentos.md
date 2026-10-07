# Fundamentos: como se gera vídeo (e onde a IA entra)

> Texto de referência do repositório. Explica as formas de produzir vídeo, como elas se combinam, onde os três motores daqui se encaixam e como dividir o trabalho entre quem cria e a máquina. Estado de outubro de 2026: nomes de ferramentas e modelos mudam todo mês; os fundamentos não.

## 1. O que é um vídeo

Um vídeo é **uma sequência de quadros (imagens) mais uma faixa de áudio**, em geral a 24, 30 ou 60 quadros por segundo. Um vídeo vertical de 30 s a 30 fps tem 900 imagens de 1080×1920. Gerar vídeo é, portanto, **produzir essas 900 imagens e um áudio que case com elas**, e depois comprimir tudo num arquivo (H.264 + AAC num MP4, quase sempre).

## 2. As quatro formas de obter quadros

| # | Forma | Como funciona | Exemplos | Ponto forte | Ponto fraco |
|---|---|---|---|---|---|
| **1** | **Capturar** | Registrar o mundo real (câmera, gravador de tela) | celular, gravação de tela, material de arquivo | **Autenticidade**: é real | Você só tem o que foi filmado |
| **2** | **Descrever e renderizar** | Formas, posições e movimento descritos em código; um renderizador desenha cada quadro | **`motores/render`**, Remotion, HyperFrames, p5.js, three.js, Blender, Manim | **Controle e determinismo**: o mesmo código gera o mesmo vídeo, versiona como texto e escala para mil variações | Fotorrealismo é muito difícil; tudo precisa ser modelado |
| **3** | **Amostrar de um modelo** | Uma rede treinada em milhões de vídeos "sonha" quadros a partir de texto ou imagem | Veo, Kling, Seedance, Wan, LTX | **Realismo e liberdade**: qualquer cena sem filmar nem modelar | Pouco controle (cada geração sai diferente), custo por segundo, falhas de texto e continuidade, **nenhum compromisso com a verdade** |
| **4** | **Transformar quadros existentes** | Pegar quadros de 1, 2 ou 3 e modificá-los | corte, montagem, **legenda queimada (`motores/legenda`)**, cor, recorte (SAM), profundidade, upscale | Reaproveita material e liga as outras formas | Depende de matéria-prima |

Este repositório trabalha nas formas **2 e 4**, que são as que rodam num PC sem GPU. A forma 3 entra, se você quiser, como camada de imagem dentro de uma cena HTML (um `<img>` ou um vídeo pré-renderizado e decodificado quadro a quadro).

### O compositor

Por cima das quatro formas existe o **compositor**: a linha do tempo que empilha camadas e mixa o áudio. Um vídeo típico de redes sociais junta tudo:

```
camada 4  legenda palavra a palavra        ← forma 4 (libass, depois do render)
camada 3  títulos, grafismos, diagramas    ← forma 2 (cena HTML)
camada 2  imagem ou B-roll gerado          ← forma 3 (opcional)
camada 1  fundo, gravação própria          ← forma 1 ou 2
áudio     narração + trilha + efeitos, com ducking e loudness normalizado
```

Aqui o compositor é o próprio ffmpeg: o `exemplos/explicativo/gerar.py` mostra a ordem (cena → legenda queimada → áudio mixado).

### Dois estilos dentro da forma 2

- **Keyframes:** "em t = 2 s o objeto está aqui", e o software interpola o resto. É o que fazem o After Effects, o GSAP, o Remotion e o `seek(t)` das cenas daqui. O movimento é previsível e desenhado.
- **Simulação:** você define forças e regras (molas, gravidade, partículas) e o movimento emerge. O resultado é orgânico, com menos controle fino. Para caber no contrato do `motores/render` (a tela é função de `t`), a simulação precisa ser recalculável: passo fixo e semente fixa, simulando de 0 até `t` (ou guardando estados intermediários).

## 3. Mapa de ferramentas por forma

### Forma 2: motores de código

| Motor | Estética e uso | Observação |
|---|---|---|
| **DOM/SVG/CSS**: `motores/render`, [HyperFrames](https://github.com/heygen-com/hyperframes) (Apache-2.0), [Remotion](https://www.remotion.dev) (licença própria) | motion design, tipografia, UI, diagramas | Os três fotografam o Chrome headless. O HyperFrames usa HTML + GSAP e exige Node ≥ 22; o Remotion usa React e é grátis só para indivíduos, empresas pequenas e sem fins lucrativos. O `motores/render` é pequeno, em HTML puro; na pesquisa de origem, o HyperFrames levou ~0,43 s por quadro numa cena simples neste notebook, contra ~20–40 ms do caminho daqui (o Remotion foi lido no código, não rodado; ver [render.md](render.md)). |
| **Canvas 2D / p5.js** | visual desenhado à mão, arte generativa | Cabe numa cena HTML: desenhe no `<canvas>` dentro do `seek(t)`. |
| **Shaders / three.js** | 3D, partículas, transições, textura | Também cabe numa cena; sem GPU dedicada, o custo por quadro sobe. |
| **Blender via Python (bpy)** | 3D e 2D com Grease Pencil | Renderizador próprio, fora deste repositório. |
| **Manim / Motion Canvas** | vídeos explicativos: matemática, dados | Feitos para didática. |
| **Rive / Lottie** | personagem com rig e máquina de estados | O Lottie (`lottie-web`) tem `goToAndStop(quadro)`, que cabe no `seek(t)`. |
| **ffmpeg** | montagem: cortes, mixagem, legenda queimada, conversão de cor | A ilha de edição programável. Todos os motores daqui terminam nele. |

### Forma 3: modelos generativos

- **Vídeo:** fechados via API (Veo, Kling, Seedance e outros) e com pesos abertos (Wan, LTX, HunyuanVideo). Nenhum roda bem sem GPU: via API o custo é cobrado por segundo de vídeo. Os rankings e preços mudam todo mês; confira antes de escolher e leia a licença de cada um (vários pesos "abertos" têm restrição comercial).
- **Imagem:** para quadros-chave, estilos e B-roll.
- **Áudio:** TTS (ver [voz.md](voz.md)), música e efeitos gerados.

### Forma 4: modelos de análise e transformação

Para trabalhar com material real, estes modelos rendem mais que os generativos, porque **transformam o que existe em vez de inventar**:

| Modelo | O que faz | Uso no vídeo |
|---|---|---|
| **Whisper** (faster-whisper, WhisperX) | dá o tempo de cada palavra falada | legenda palavra a palavra; o `motores/voz` usa para alinhar e para medir a precisão da fala |
| **SAM 2** | recorta pessoas e objetos | pessoa sobre um fundo desenhado |
| **Depth Anything** | estima a profundidade de uma foto | parallax 2.5D |
| **Real-ESRGAN** | restaura e aumenta a resolução | material antigo, sempre rotulado como restaurado |
| **Detecção de batida** (librosa) | dá o instante dos tempos fortes da música | cortes no ritmo |

## 4. Quem faz o quê: o criador no centro

Estes motores **não** existem para uma IA gerar vídeos sem parar. Existem para **potencializar quem cria**. A pergunta certa não é "o que a máquina consegue fazer sozinha", e sim **como dividir o trabalho** para que a pessoa faça só o que é insubstituível e a máquina faça o resto.

| O criador (insubstituível) | A máquina (braços) |
|---|---|
| **Intenção:** o que quero dizer e para quem | Pesquisar, organizar fontes, propor roteiros |
| **Olhar:** o ritmo, o momento certo do corte | Gerar prévias (folha de contato), cortar, sincronizar, testar variações |
| **Ouvido:** a emoção da fala, a pausa, o silêncio | Transcrever palavra a palavra, alinhar a legenda, medir loudness |
| **Gosto:** a estética própria, as referências | Executar o estilo em código, aplicar paleta e tipografia |
| **Verdade:** responder pelo que está dizendo | Conferir se o que foi dito bate com o texto (QA pelo Whisper) |
| **Voz e rosto:** gravar o próprio comentário | Limpar o áudio, legendar e compor |

O que a máquina "não sabe fazer" (assistir em movimento, ouvir, ter gosto, ter compromisso com a verdade) é exatamente **o lugar do criador**. Por isso os motores devolvem essas decisões à pessoa de forma rápida: folha de contato em ~3 s, legenda refeita em menos de 1 s sem renderizar a cena de novo, voz trocada com um parâmetro.

### O agente de código como oficina

Um agente de código (Claude Code, Cursor e afins) **não gera pixels**, porque não é um modelo de vídeo. Ele é a **oficina que constrói e opera as ferramentas**: escreve cenas e efeitos (forma 2), integra APIs e modelos (forma 3), opera ffmpeg e Whisper em lote (forma 4) e fecha o ciclo renderizando a folha de contato, olhando e ajustando. O contrato simples da cena (`DURACAO`, `seek(t)`, `pronto`) foi pensado para isso: um agente consegue escrever uma cena nova e conferir o resultado sozinho.

### Onde a máquina acelera mais

| Tipo de vídeo | Aceleração |
|---|---|
| Motion graphics e tipografia cinética | ★★★★★ |
| Vídeos explicativos e de dados | ★★★★★ |
| Variações em lote (uma por frase, por formato) | ★★★★★ |
| Edição de gravação (cortes, legenda sincronizada) | ★★★★☆ |
| Arte generativa 2D | ★★★★☆ |
| 3D estilizado | ★★★☆☆ |
| Cenas realistas e B-roll cinematográfico | ★★★☆☆ (depende do modelo) |
| Personagem atuando com emoção | ★★☆☆☆ |

## 5. Hardware: o que roda onde

| Recurso | PC sem GPU dedicada (ex.: notebook, 8–16 GB) | GPU NVIDIA com 12 GB ou mais | API / nuvem |
|---|---|---|---|
| `motores/render` e cenas HTML | ✅ (medido aqui; 2 workers com 8 GB, estimado) | ✅ | — |
| ffmpeg, libass, montagem | ✅ | ✅ | — |
| Whisper `small`/`base` (alinhador, QA) | ✅ (segundos por frase) | ✅ | ✅ |
| TTS local (Kokoro, Piper) | ✅ (medido: Piper gera 12,6 s de áudio em ~1 s; Kokoro, 13 s de áudio em 7–17 s) | ✅ | — |
| SAM 2, Depth Anything | ⚠️ lento, clipes curtos | ✅ | ✅ |
| Vídeo generativo aberto | ❌ | ⚠️ minutos por clipe, muita VRAM | ✅ pago |
| Vídeo generativo fechado | ❌ | ❌ | ✅ pago |

Uma alternativa gratuita para os modelos pesados é a GPU do Google Colab ou do Kaggle, com as limitações de cota de cada um.

## 6. Limite ético

- **Pessoas reais:** pode transformar o **entorno** (legenda, grafismo, recorte sobre outro fundo, restauração rotulada). **Não pode** alterar **a pessoa**: voz sintética imitando alguém, boca, rosto ou falas que ela não disse. Sempre credite a fonte original.
- **Voz sintética é de narrador.** Diga no vídeo que a voz é sintética; o `motores/voz` devolve o rótulo pronto.
- **Personagens próprios e ficção:** todas as formas valem, com rótulo de conteúdo gerado quando for o caso.
- **Nada de automação de contas em plataformas reais** nem produção em massa para enganar recomendação ou audiência. A linha de pesquisa sobre esses fenômenos é de **defesa**, em ambiente fechado (ver [direcoes.md](direcoes.md)).

## Leituras

- [HyperFrames (GitHub, HeyGen)](https://github.com/heygen-com/hyperframes)
- [Remotion](https://www.remotion.dev) e a [licença do Remotion](https://www.remotion.dev/docs/license)
- [Chrome DevTools Protocol: Page.captureScreenshot](https://chromedevtools.github.io/devtools-protocol/tot/Page/#method-captureScreenshot)
- [faster-whisper](https://github.com/SYSTRAN/faster-whisper)
- [libass](https://github.com/libass/libass) e o [formato ASS (Aegisub)](https://aegisub.org/docs/latest/ass_tags/)
