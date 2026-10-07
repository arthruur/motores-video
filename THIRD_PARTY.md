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

## Ferramentas externas (instaladas por você, não redistribuídas)

| Ferramenta | Licença | Observação |
|---|---|---|
| FFmpeg | LGPL-2.1+ por padrão; **GPL-2.0+ ou GPL-3.0** quando compilado com `--enable-gpl` / `--enable-version3` | Os motores chamam o executável `ffmpeg`. O build testado (gyan.dev 9.0.2 "full") é GPL-3.0, porque inclui libx264 e outras bibliotecas GPL. Os vídeos gerados não herdam a licença |
| libx264 | GPL-2.0+ | Encoder H.264 usado por padrão |
| libass | ISC | Desenha a legenda `.ass` |
| Google Chrome / Microsoft Edge | Proprietário (com componentes de código aberto do Chromium, BSD-3-Clause) | O render usa o navegador instalado. Chromium puro também serve (`--chrome`) |
| Node.js | MIT | |
| Python | PSF License | |
