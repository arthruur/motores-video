# Histórico

Formato inspirado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/); versões seguem [SemVer](https://semver.org/lang/pt-BR/).

## [Não lançado]

## [0.2.0] - 2026-10-07

### Adicionado

- **`motores/colagem`**: o quarto motor. Colagem por sentido: fragmentos de falas reais achados por tema, cortados entre frases e montados em 9:16. Subcomandos `baixar` (yt-dlp, só o trecho; `--de` copia vídeos já baixados), `indexar` (Whisper do `motores/voz`, com VAD e repetição sem VAD; janelas de 15 s; frases conferidas localizadas pelo texto; vetores do EmbeddingGemma 2 com cache), `sugerir` (MMR, no máximo 2 por fonte, corte em fronteira de frase, página HTML para ouvir e escolher), `montar` e `folha`. O `montar` reusa `casar()` do `motores/voz` (o texto revisado manda, o Whisper empresta os tempos), `gerar()` e `filtro_legenda()` do `motores/legenda`, e faz etiqueta com nome, data, ocasião e fonte (link e minuto), cartões de abertura e final com todas as fontes e o autor da montagem, loudnorm em 2 passagens, `.srt`/`.vtt` da colagem inteira e `ficha.json` com o porquê de cada escolha. Dependências pesadas (torch, sentence-transformers) são opcionais, em `motores/colagem/requisitos.txt`.
- **`exemplos/colagem-democracia`**: "O que é democracia?", 66,3 s, com Ulysses Guimarães, Lélia Gonzalez, Marielle Franco e Paulo Freire. Traz a transcrição pronta (`palavras/`), então o `montar` roda só com o núcleo; mais 3 falas em `fontes_opcionais` para experimentar a busca.
- **`exemplos/karaoke-discurso`**: 23 s do discurso de Ulysses Guimarães na promulgação da Constituição, com legenda palavra a palavra alinhada ao áudio original, crédito, fonte e aviso de montagem na tela.
- **`exemplos/mudar-o-que`**: "Mudar o quê?", explicativo de opinião de 47 s com a fonte de cada fato na tela, rótulo de IA e nota de contexto (feito em 06/10/2026, período eleitoral). A cena segue o contrato do render.
- **Mídia de terceiros**: os vídeos dos exemplos são baixados em `exemplos/*/entrada/` (ignorada pelo git) e nunca versionados; o crédito de cada um fica no `fontes.json`, e os READMEs explicam o direito de citação. Seção nova no README e em `THIRD_PARTY.md`.
- **Documentação**: `docs/colagem.md` (conceito, caminho e ética da montagem), `motores/colagem/README.md` (formatos e números) e a colagem em `docs/arquitetura.md`.
- **Dependências opcionais registradas**: yt-dlp (Unlicense), sentence-transformers (Apache-2.0), torch (BSD-3-Clause) e os pesos do EmbeddingGemma 2 (Apache-2.0).

### Corrigido

- **`exemplos/legenda`**: o texto dizia que "cerca de 60% da face oculta nunca aparece daqui", o que está errado. Com a libração, vemos ~59% da superfície da Lua; ~41% nunca aparece. O texto agora diz "cerca de quarenta por cento da superfície dela", e o `palavras.json` foi refeito com o edge-tts (72 palavras e 24 s, como antes). O QC mudou pouco: 2 curtos e 6 encolhidos.
- **`exemplos/explicativo/gerar.py`**: provedor sem pacote ou sem chave agora dá uma mensagem curta, sem traceback.
- **README**: o `winget` instala um pacote por linha, com aviso para reabrir o terminal e sobre a política de scripts do PowerShell. Os exemplos de `alinhar` e `queimar` agora rodam com arquivos do próprio repositório. O exemplo com Kokoro avisa que precisa da instalação opcional. O GIF da demonstração foi incluído (`docs/img/demo.gif`, 415 KB).
- **Números**: as faixas medidas foram atualizadas com a verificação feita num clone limpo. `ola-mundo` ficou em 8,0–8,3 s, o render do explicativo em 30,2 s e a mixagem em 8,2 s.

## [0.1.0] - 2026-10-07

Primeira versão pública. Os motores foram separados dos laboratórios da Fábrica de reels, generalizados e documentados.

### Adicionado

- **`motores/render`**: cena HTML → MP4. Captura JPEG pelo CDP, N processos Chrome com fatias contíguas de quadros, ffmpeg por stdin, pulo de quadros por chave de estado devolvida por `window.seek(t)`, conversão para faixa de TV BT.709, áudio com `apad`/`atrim`, folha de contato (`--teste`) com zonas seguras (`--zonas`), conferência do pulo de quadros (`--verificar`). CLI e função `renderizar()`. Contrato da cena em `CONTRATO.md`.
- **`motores/voz`**: provedores trocáveis (edge, Kokoro, Piper, Azure, ElevenLabs, gravação) com o tempo de cada palavra; alinhador universal pelo faster-whisper + difflib; nota de precisão (QA) com num2words; pronúncia por motor (`pronuncia.json`); rótulo de IA pronto. Serviços pagos só rodam com chave e `--permitir-pago`.
- **`motores/legenda`**: blocos por sintagma medidos com a fonte real, destaque da palavra falada, zonas seguras (universal, Reels, TikTok, Shorts), calibração do tamanho de fonte do libass lida do próprio TTF, `.ass` + `.srt`/`.vtt`, QC com relatório, queima com conferência da fonte usada.
- **`exemplos/`**: `ola-mundo` (cena mínima), entradas de teste da voz e da legenda e `explicativo` ("Por que o céu é azul?"), de ponta a ponta com os três motores, trilha sintetizada, *ducking* e loudnorm a −14 LUFS.
- **Documentação**: fundamentos, arquitetura, render, voz, legenda e direções (incluindo a linha de pesquisa do testbed ético de agentes sintéticos), `CONTRIBUTING.md` e `THIRD_PARTY.md`.

### Corrigido (em relação ao laboratório de origem)

- Folha de contato: com `-framerate 1` a base de tempo do ffmpeg é 1 s e o `setpts` truncava o instante pedido (2,8 s desenhava 2 s). Corrigido com `settb=1/90000`.
- Calibração da legenda: o fator fixo 0,734 estava ~1% baixo para a Barlow; agora sai de `winAscent + winDescent` da fonte (0,741).
