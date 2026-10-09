# Licenças de terceiros

O código deste repositório é Apache-2.0 (ver [LICENSE](LICENSE) e [NOTICE](NOTICE)). Ele **não redistribui** nenhuma dependência além da fonte em `fontes/`: tudo o mais é instalado por você (`npm install`, `pip install`, ffmpeg, navegador). Mesmo assim, a licença do que você instala pesa no que você pode fazer com o conjunto, então ela está registrada aqui.

Conferido em outubro de 2026 nos metadados dos pacotes instalados (`importlib.metadata`, `package.json`, `ffmpeg -version`). Licenças mudam entre versões: confira de novo antes de redistribuir.

## Redistribuído neste repositório

| Item | Licença | Onde |
|---|---|---|
| Barlow Condensed ExtraBold | SIL Open Font License 1.1 | `fontes/BarlowCondensed-ExtraBold.ttf`, texto em `fontes/OFL.txt`. Copyright 2017 The Barlow Project Authors |

## Núcleo (instalado por `npm install` e `pip install -r requirements.txt`)

| Pacote | Versão testada | Licença | Usado por | Observação |
|---|---|---|---|---|
| playwright-core | 1.63.0 | Apache-2.0 | render | Só o protocolo; usa o Chrome/Edge já instalado |
| faster-whisper | 1.2.1 | MIT | voz (alinhador, QA) | Puxa ctranslate2 (MIT), av/PyAV (BSD-3-Clause, com bibliotecas do FFmpeg embutidas, LGPL), tokenizers e huggingface-hub (Apache-2.0), onnxruntime (MIT) |
| Modelos Whisper | `small` | MIT | voz | Pesos da OpenAI, convertidos pela Systran; baixados na 1ª execução |
| edge-tts | 7.2.8 | LGPL-3.0 | voz (provedor padrão) | Puxa aiohttp (Apache-2.0 e MIT) e certifi (MPL-2.0). **Aviso abaixo** |
| num2words | 0.5.14 | LGPL-2.1 | voz (QA), legenda | Números por extenso |
| numpy | 2.5.3 | BSD-3-Clause (e componentes 0BSD, MIT, Zlib, CC0) | voz | |
| Pillow | 12.3.0 | MIT-CMU (HPND) | legenda | Mede o texto na fonte real; folha de contato |

As dependências LGPL (edge-tts, num2words) são usadas como bibliotecas importadas, sem modificação, o que é compatível com um projeto Apache-2.0.

### Aviso sobre o edge-tts

O edge-tts é uma biblioteca livre, mas o **serviço** que ela chama é o endpoint de leitura em voz alta do navegador Microsoft Edge. Não é uma API oficial e não tem termos de uso comercial publicados: pode mudar, limitar ou parar sem aviso. Use para protótipo, estudo e projetos sem fins comerciais. Para produção, troque de provedor (Kokoro local, Azure AI Speech, ElevenLabs ou gravação própria): é um parâmetro.

## Prensa (`app/`, instalado por `cd app && npm install`)

Diferente dos motores, o app **é redistribuído** quando alguém publica o `app/dist/`: o build empacota estas bibliotecas no JavaScript e no WASM servidos ao navegador.

| Pacote | Versão testada | Licença | Usado para | Observação |
|---|---|---|---|---|
| mediabunny | 1.61.3 | MPL-2.0 | Ler e gravar MP4 (WebCodecs) | Copyleft fraco, por arquivo: usado sem modificação |
| @mediabunny/aac-encoder | 1.61.3 | MPL-2.0 | AAC quando o navegador não codifica | Só carregado se preciso. Embute o codificador AAC do **FFmpeg** compilado em WASM (LGPL-2.1-or-later) |
| @huggingface/transformers | 4.3.1 | Apache-2.0 | Whisper no navegador | Puxa onnxruntime-web (MIT) e @huggingface/jinja (MIT) |
| Whisper `base` (onnx-community/whisper-base_timestamped) | 8 bits | MIT (pesos da OpenAI) | Legenda | Baixado do Hugging Face pelo navegador na 1ª vez; não vai no build |
| @shiguredo/rnnoise-wasm | 2025.1.5 | Apache-2.0 | "Som limpo" (remoção de ruído da voz) | Embute o **RNNoise** (Xiph.Org, BSD-3-Clause), com os pesos, compilado em WASM |
| Audio FXtor (arquivos em `app/src/fxtor/`) | commit `5872183` | Apache-2.0, por permissão do autor | Loudness, limitador, reamostragem, RNNoise | De Matheus Teles, [audio-fxtor](https://github.com/matheustdo/audio-fxtor). Origem de cada arquivo em `app/src/fxtor/README.md` |
| @ffmpeg/ffmpeg, @ffmpeg/util | 0.12.15, 0.12.2 | MIT | Conversor de segurança (carregador) | Só o carregador vai no build |
| **@ffmpeg/core** (ffmpeg.wasm) | 0.12.10 | **GPL-2.0-or-later** | Conversor de segurança: vídeo que o navegador não lê (MPEG-4 Part 2, 3GP, ProRes, AVI, HEVC sem suporte) | **Não vai no build nem no repositório.** O navegador baixa do CDN jsdelivr (~31 MB) só quando aparece um vídeo assim, como os componentes GPL opcionais dos motores |
| @fontsource/fraunces | 5.2.8 | OFL-1.1 | Fonte serifada da interface e da história (pesos 400, 400 itálico e 700) | Vai embutida no CSS do build |
| vite, typescript | 7, 5 | MIT, Apache-2.0 | Só desenvolvimento | Não vão no build |

A fonte Barlow Condensed (OFL) fica em `app/src/fontes/`, com o texto da licença, e vai embutida no CSS do build.

**Acervo de vídeos de retenção** (`app/public/acervo/` ou o dataset no Hugging Face): clipes do Wikimedia Commons e da NASA, só com CC0, domínio público ou CC BY (CC BY-SA só marcado à parte). O crédito e a licença de cada um ficam no `acervo.json` e aparecem na tela quando o clipe é usado. O git guarda só o `acervo.json`; os vídeos são refeitos com `python ferramentas/acervo/coletar.py --restaurar`. Detalhes em [docs/acervo.md](docs/acervo.md).

## Opcionais (fora do `requirements.txt`)

| Pacote | Licença | Arquivo | Observação |
|---|---|---|---|
| piper-tts | **GPL-3.0-or-later** | `motores/voz/requisitos-piper.txt` | Opcional. Nunca dependência obrigatória deste repositório. Cada voz Piper tem licença própria no seu `MODEL_CARD`: confira antes de publicar |
| kokoro-onnx | MIT | `motores/voz/requisitos-kokoro.txt` | O pacote é MIT, mas depende de **phonemizer (GPL-3.0-or-later)** e de espeakng-loader, que embute o **espeak-ng (GPL-3.0)**. Por isso também é opcional |
| Kokoro-82M (pesos) | Apache-2.0 | baixados para `modelos/` | |
| soundfile | BSD-3-Clause | `requisitos-kokoro.txt` | |
| azure-cognitiveservices-speech | Licença proprietária da Microsoft (gratuita para uso do serviço) | `motores/voz/requisitos-azure.txt` | O serviço Azure AI Speech é pago, com camada gratuita; exige conta |
| ElevenLabs | — | sem pacote | Chamado por HTTP com a biblioteca padrão do Python. Serviço pago, regido pelos termos da ElevenLabs |

Os áudios gerados por Piper ou Kokoro **não herdam** a GPL: ela se aplica ao programa, não à saída. Se você redistribuir um programa que inclua Piper ou phonemizer/espeak-ng, esse programa fica sujeito à GPL-3.0.

### Motor de colagem e exemplos com vídeo de terceiros

Instalados por `pip install -r motores/colagem/requisitos.txt` (busca por tema) ou só `pip install yt-dlp` (download dos exemplos). O `montar` da colagem usa apenas o núcleo.

| Pacote / modelo | Versão testada | Licença | Usado por | Observação |
|---|---|---|---|---|
| yt-dlp | 2026.8.19 | Unlicense (domínio público) | `colagem baixar`, `exemplos/karaoke-discurso/baixar.py`, `exemplos/colagem-democracia/baixar.py` | Baixa só o trecho citado. Usar o yt-dlp não dá direito sobre o vídeo: ver abaixo |
| sentence-transformers | 6.1.0 | Apache-2.0 | `colagem indexar`, `sugerir` | Puxa transformers e huggingface-hub (Apache-2.0), scikit-learn e scipy (BSD-3-Clause) |
| torch (build para CPU) | 2.14.1 | BSD-3-Clause (licença do PyTorch); o metadado do pacote declara também Apache-2.0, BSD-2-Clause, BSL-1.0 e MIT dos componentes embutidos | `colagem indexar`, `sugerir` | Instale pelo índice CPU para não baixar ~2 GB de CUDA |
| google/embeddinggemma-2 (pesos) | — | Apache-2.0 (cartão do modelo no Hugging Face) | `colagem indexar`, `sugerir` | ~1,5 GB, baixado do Hugging Face na 1ª vez; usado só o codificador de texto |

## Mídia de terceiros nos exemplos

Os exemplos `karaoke-discurso` e `colagem-democracia` usam trechos de vídeos publicados por terceiros (Câmara dos Deputados/TV Câmara, Cultne, Instituto Marielle Franco, Daniel Caires/TV PUC-SP e, nas fontes opcionais da colagem, os canais listados no `fontes.json`). **Esses vídeos não são redistribuídos**: não estão no repositório, são baixados por quem roda o exemplo para `exemplos/*/entrada/` (ignorada pelo git), e **os direitos são dos seus titulares**. O repositório traz só texto: URL, trecho, crédito, a fala conferida (`revisao`) e, na colagem, a transcrição automática dos trechos (`palavras/`). O uso pretendido é a citação para estudo, com crédito e origem na tela (Lei 9.610/98, art. 46, III); o README de cada exemplo explica.

## Ferramentas externas (instaladas por você, não redistribuídas)

| Ferramenta | Licença | Observação |
|---|---|---|
| FFmpeg | LGPL-2.1+ por padrão; **GPL-2.0+ ou GPL-3.0** quando compilado com `--enable-gpl` / `--enable-version3` | Os motores chamam o executável `ffmpeg`. O build testado (gyan.dev 9.0.2 "full") é GPL-3.0, porque inclui libx264 e outras bibliotecas GPL. Os vídeos gerados não herdam a licença |
| libx264 | GPL-2.0+ | Encoder H.264 usado por padrão |
| libass | ISC | Desenha a legenda `.ass` |
| Google Chrome / Microsoft Edge | Proprietário (com componentes de código aberto do Chromium, BSD-3-Clause) | O render usa o navegador instalado. Chromium puro também serve (`--chrome`) |
| Node.js | MIT | |
| Python | PSF License | |
