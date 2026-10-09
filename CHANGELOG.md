# Histórico

Formato inspirado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/); versões seguem [SemVer](https://semver.org/lang/pt-BR/).

## [Não lançado]

### Prensa: fila em grade, para dezenas de vídeos

- **A fila virou grade:** com mais de um vídeo, cada um aparece com capa, número e situação (pendente, pronto ✓, não abriu !, fora do lote). Filtros Todos / Pendentes / Prontos, e a grade rola sozinha, sem empurrar o resto da tela.
- **Ajustar um por um:** tocar num vídeo abre ele; o gancho, a fonte e o trecho ficam guardados por vídeo e voltam quando ele é reaberto. "Próximo pendente" pula os prontos.
- **Lote:** "Prensar os pendentes" faz todos os que faltam com as escolhas atuais (receita, som, redes), respeitando o que foi ajustado em cada um, e pode parar no meio. O ⨯ tira um vídeo do lote.

### Prensa: Aventura do Mangaio

- **Aventura do Mangaio** como vídeo de baixo (`app/src/mangaio/`): o cesto do Mangaio, mascote do TCC sobre venda direta da agricultura familiar de Serrinha (BA), anda, pula e vende, desenhado em código a partir do SVG do site, como os outros geradores de retenção.
- **Trilha "Baião do Mangaio"**: zabumba, triângulo, baixo e sanfona sintetizados a 116 BPM, com os pulos e as piruetas da aventura caindo na batida.
- **Receita "Aventura do Mangaio"**, a primeira da lista: tela dividida com a aventura embaixo. Quem abre a Prensa continua começando no Corte direto.

### Prensa: link direto, música do acervo, efeitos e mais impacto

- **Colar um link** (X, Instagram, TikTok, YouTube, Kwai…) na página inicial ou compartilhar o link para a Prensa (Android). Um serviço pequeno, `servidor/baixador` (FastAPI + yt-dlp), traz o vídeo em MP4 e não guarda nada. A fonte já vem preenchida ("@perfil · X"), e o texto do post ganha "Original: link". O campo só aparece quando o app é construído com `VITE_BAIXADOR_URL`.
- **Música do acervo:**
  - faixas instrumentais CC0/CC BY do Jamendo, encontradas pelo Openverse e coletadas por `ferramentas/acervo/coletar_audio.py`;
  - cada faixa tem ~75 s, sai nivelada em −14 LUFS e tem um clima ("animada · para listas", "tensão · para revelar"…);
  - o crédito entra sozinho no texto do post;
  - as faixas ficam no dataset, em `audio/` (chave `musicas` do `acervo.json`).
- **Música mais alta:** a régua vai de −20 a +4 dB em relação à fala, com padrão −4 dB. A música ainda abaixa 8 dB quando alguém fala.
- **Efeito na entrada do gancho:** Whoosh (padrão), Impacto ou Pop, gerados no aparelho, tocando junto com o carimbo do gancho.
- **Câmera viva:** zoom lento contínuo e um "soco" de zoom quando o gancho entra.
- **Só o acervo revisado** aparece no app.
- **Menos memória no celular** (a página recarregava sozinha no iPhone):
  - o som AAC é extraído só do trecho, não do arquivo inteiro;
  - os quadros da galeria viram imagem e o vídeo é solto;
  - o conversor é encerrado depois do uso;
  - os vídeos prontos vão para o disco do navegador (OPFS);
  - a transcrição usa no máximo 4 threads.

### Prensa: passo a passo guiado, produção em escala e legenda editável

- **A mesa virou um passo a passo:**
  - Receita → Gancho → Fonte → Vídeo de baixo → Som → Legenda → Prensar, uma etapa por vez, com "Voltar" e "Próximo";
  - uma trilha de etapas clicável no topo e o botão **Prensar sempre à mão**, fixo embaixo.
  - Cada receita mostra **para que vídeo ela serve** ("Alguém falando para a câmera…", "Você contando passos ou erros em ordem…").
  - Trocar de receita volta ao padrão o que vinha da receita anterior (gancho de modelo, vídeo de baixo, estilo de legenda) e mantém o que a pessoa escolheu de propósito. Isso corrige as misturas entre receitas.
- **Produção em escala:**
  - dá para escolher vários vídeos de uma vez (fila);
  - a **bandeja "Saiu da prensa"** fica na própria mesa, no lugar da tela de fim, com compartilhar e baixar por rede, o texto do post e o `.srt` de cada vídeo;
  - "Próximo da fila", "Outro corte deste vídeo" (o trecho seguinte, mesmas escolhas) e **"Prensar o resto da fila"** (em lote, com o gancho de cada vídeo tirado da própria fala).
- **Legenda editável:** cada frase vira um campo. A pessoa corrige o texto, o tempo se redistribui dentro da frase, e "▶" toca o trecho.
- **Ganchos mais chamativos:** maiores (90 a 110 px), com contorno e sombra, palavra-chave em amarelo e entrada de carimbo. Na receita Lista, o número aparece gigante; na Manchete, uma faixa vermelha cruza a tela.
- **Arquivos menores:** 3 Mbps em vez de 6 (cerca de 23 MB por minuto em vez de 45). As redes recomprimem de qualquer jeito.
- **Música mais presente:** a régua vai de −24 a 0 dB em relação à fala (padrão −11 dB) e o ducking abaixa 8 dB.
- **Correção: "Este navegador não lê som AAC" no celular.** O navegador do iPhone não decodifica AAC pelo WebCodecs, mas decodifica pelo Web Audio. A Prensa agora usa esse caminho em vez de mandar o vídeo ao conversor, que também não resolvia.
- **Menos avisos espalhados:** a proposta continua no manifesto e na história; as notas repetidas nas etapas saíram.

### Prensa: som, vídeo de baixo à vista e fontes no iPhone

- **Nova etapa "Som"** na mesa de composição:
  - volume do som do vídeo (0 a 150%) e "Som limpo";
  - **música**: sem música, quatro **trilhas geradas na hora** (Calma, Lo-fi, Tensão, Animada; sintetizadas no aparelho, sem direitos de ninguém) ou **a sua música**;
  - volume da música (padrão −18 dB em relação à fala), "Abaixar quando alguém fala" (ducking pela energia da fala) e "Entrar e sair suave".
  - A prévia toca a música junto. A mixagem final sai nivelada em −14 LUFS com pico real em −1 dBTP, pelo motor do Audio FXtor.
  - Vídeo sem som também pode sair com música.
- **Vídeo de baixo saiu de "Mais opções"** e virou a etapa 4: uma galeria em faixas com rolagem lateral. Nela estão Nenhum, Enviar o seu, as quatro animações (tocando ao vivo), o acervo revisado e os **não revisados**, marcados como "licença não confirmada". Os clipes mostram um quadro de prévia, buscado só quando o cartão aparece.
- **"Trocar vídeo"** fica embaixo da prévia. **Legenda** (ligar e estilo) virou a etapa 6. "Mais opções" virou "Trecho e redes".
- **Correção das fontes no iPhone** (Safari e Chrome usam o WebKit):
  - no Space do HF, a fonte Barlow era servida por um redirecionamento para o CDN, e o WebKit a recusava pelo Cross-Origin-Resource-Policy. As fontes agora vão embutidas no CSS;
  - a Fraunces **variável** saía sempre no peso mais grosso no WebKit. Agora é a versão estática (400, 400 itálico, 700).
  - Conferido no WebKit no endereço publicado: todas as fontes carregam, sem nenhuma requisição recusada.

### Prensa: funcionar no celular de verdade

- **Publicada em https://arthruur-prensa.static.hf.space** (Space estático do Hugging Face):
  - HTTPS válido, sem aviso de certificado, em qualquer celular, no Wi-Fi ou no 4G;
  - cabeçalhos COOP/COEP via `custom_headers`, para o Whisper rodar com threads.
  - `ferramentas/publicar_space.py` gera o build, deixa os vídeos do acervo de fora (o app os busca no dataset) e publica.
  - Testado no endereço público, com navegador zerado, incluindo o download do modelo de legenda: vídeo de celular com rotação e 3GP prontos (legenda em 21 a 24 s, Prensar em 11 a 18 s).
- **Correção: no celular, a mesa de composição renderizava com 1044 px de largura.** A faixa de receitas com rolagem lateral esticava a coluna da grade até a largura de todos os cartões juntos. O navegador então reduzia a página inteira, e os toques erravam o alvo. As colunas agora usam `minmax(0, 1fr)`.
- **"Abrir com https" quebrava**: o botão só trocava `http` por `https` no mesmo endereço. Agora aponta para o endereço oficial publicado.
- No celular, o vídeo da tela de resultado fica menor, para os arquivos aparecerem logo abaixo.

- **Correção do erro que impedia usar a Prensa pelo celular.**
  - As instruções mandavam abrir `http://<ip-do-pc>:5173`, um endereço sem conexão segura.
  - Num endereço assim, o navegador desliga o WebCodecs, as threads e o service worker. Todo vídeo, até um MP4 comum, parecia ilegível, ia para o conversor e terminava em "Não consegui converter esse vídeo".
  - O servidor de desenvolvimento e o `preview` agora sobem em **HTTPS** (`@vitejs/plugin-basic-ssl`, certificado gerado na hora).
  - Se a página for aberta sem HTTPS, ou num navegador sem WebCodecs, a tela inicial explica o que fazer, com o link certo, em vez de deixar escolher o vídeo e falhar depois.
- **Correção:** vídeo com som em 8 kHz (3GP, gravações antigas) quebrava o codificador AAC. O som agora sempre sai em 48 kHz, e o conversor também entrega 48 kHz.
- **Testado em HTTPS, com o fluxo completo** (abrir → legenda → Prensar → MP4 H.264 1080×1920 + AAC 48 kHz). Tempos de abrir, legenda pronta e Prensar:

  | Vídeo | Abrir | Legenda | Prensar |
  |---|---|---|---|
  | Vertical com rotação de celular (metadado de −90°) | 0,2 s | 23,6 s | 14,8 s |
  | HEVC de iPhone | 0,2 s | 22,1 s | 14,7 s |
  | Sem som | 0,2 s | — | 6,9 s |
  | 4K60 | 0,2 s | 18,4 s | 24,5 s |
  | 3GP (convertido) | 2,7 s | 19,9 s | 8,8 s |
  | Fala de 12 min | 0,2 s | 45,7 s | 40,9 s |

  O mesmo fluxo passou pelo IP da rede (`https://192.168.x.x`), como o celular acessa.
- **Manifesto do software livre:** agora fica depois de "Ler a história", recolhido.

### Prensa: identidade de prensa, conversor de formatos e acervo no Hugging Face

- **Design refeito com identidade de prensa**:
  - **Visual:** papel e tinta, vermelho tipográfico, o nome em tipos móveis que caem um a um, marcas de registro e um botão de prensa que afunda ao toque. A fonte serifada Fraunces (OFL) vai embutida.
  - **"Como funciona" virou demonstração ao vivo na tela inicial:** um celular toca um reel de exemplo desenhado pelo próprio motor de export, e os 3 passos comandam a demonstração (o vídeo cru, a receita aplicada, uma folha para cada rede). Não há mais janela de tutorial.
  - **"Por que Prensa?" virou uma história em tela cheia com cara de jornal:**
    - os tipos aparecem espelhados e se desviram;
    - os capítulos entram com a rolagem: 1450, 1500, 1517, o contraponto do *Malleus Maleficarum*, 1808 no Brasil e hoje;
    - as datas da Impressão Régia, da *Gazeta do Rio de Janeiro* e do *Correio Braziliense* foram conferidas.
  - **Mesa de composição:**
    - cada cartão de receita mostra o vídeo da própria pessoa naquela receita;
    - as ideias de gancho aparecem como fichas (primeiro as frases da fala);
    - "Mostrar onde a rede cobre" desenha as áreas que a interface da rede tapa;
    - durante o Prensar, uma folha por rede é carimbada;
    - no fim, o reel aparece tocando no celular.
- **Correção: "Este navegador não consegue ler esse vídeo".**
  - Vídeos em MPEG-4 Part 2, 3GP, ProRes ou AVI não abriam; HEVC também não, em aparelho sem suporte.
  - Vídeos com som AC-3 abriam **sem som e sem legenda**, em silêncio.
  - Agora a Prensa converte o arquivo uma vez, no próprio aparelho, com o ffmpeg.wasm. O conversor (GPL, ~31 MB) não vai no build: o navegador o baixa do CDN só quando precisa.
  - Testado: MPEG-4 abriu em 8,6 s, 3GP em 3,0 s, AVI em 8,6 s, ProRes em 15,3 s e AC-3 em 8,7 s.
- **Nova receita "Pergunta e resposta"**: balão com a pergunta no topo e o vídeo como resposta. Os outros formatos pesquisados (storytime, tutorial em 3 passos, X vs Y, quiz, série) estão em `docs/receitas.md`.
- **Acervo**:
  - **Coletor refeito com o plano da pesquisa:**
    - categorias exatas do Commons (timelapse, espaço, água, impressão 3D, máquinas, artesanato, mecanismos, POV) e a API da NASA (domínio público);
    - versões leves (≥720p) em vez dos originais;
    - lista negra de títulos (bodycam, acidente, artigos científicos);
    - balde CC BY-SA marcado à parte.
  - A publicação no Hugging Face fica com `ferramentas/acervo/huggingface.py`, e a leitura no app com `app/src/acervo.ts`, da integração com o HF.
  - O app avisa quando um clipe é CC BY-SA, porque o reel herda a licença.
  - **Clipes não revisados** (os 8 "cortes-virais" vindos do Drive) continuam no app, num grupo à parte, "Não revisados · licença não confirmada". O crédito na tela diz "licença não confirmada" em vez de uma licença que ninguém declarou. O `processar_drive.py` passa a gravar os envios do Drive como não revisados.
  - **Correção em `baixarClipe`:** quando o `.mp4` não existia na pasta local, o servidor devolvia o `index.html` com status 200. O app tratava essa página como se fosse o vídeo e a guardava no cache offline, e o resultado era "não lê o formato MP4". Agora só aceita resposta que seja vídeo e limpa a entrada estragada do cache.

### Prensa: interface fácil, receitas, som do Audio FXtor e acervo

- **Interface refeita para levar menos de 40 s de atenção depois do vídeo:**
  - Fluxo em 3 telas: um botão para escolher o vídeo, depois receita, gancho, fonte e **Prensar**, e por fim compartilhar.
  - Onboarding de 3 passos na 1ª visita e janela "Por que Prensa?", com a história da prensa (Gutenberg, a Reforma, o *Malleus Maleficarum*, a Impressão Régia de 1808) e a regra da fonte visível.
  - Trecho, vídeo de baixo, estilo de legenda e redes ficam em "Mais opções".
- **7 receitas** (Corte direto, Você sabia?, Dica rápida, Estímulo duplo, Mito ou fato, Frase de impacto, Cívico), escolhidas pela evidência. O porquê e as fontes estão em `docs/receitas.md`.
- **Gancho:** sugerido a partir de frases da própria fala, com banco de modelos com lacuna. Fica grande por 4 s e depois vira título fixo.
- **Legenda:** novo estilo "palavra por palavra", com as palavras de peso em destaque.
- **Tela dividida:** passa a 58/42, com a legenda na junção.
- **Som do Audio FXtor** (`app/src/fxtor/`, Apache-2.0 por permissão do autor):
  - loudness BS.1770 em −14 LUFS com limitador de pico real em −1 dBTP (antes era uma aproximação por RMS);
  - "Som limpo" com RNNoise na voz;
  - saída sempre em estéreo.
- **Retenção sem direito autoral de terceiros:** animações geradas na hora (Pêndulos, Bolinhas, Tinta, Encaixe) e um **acervo de clipes do Wikimedia Commons** com licença livre.
  - O coletor `ferramentas/acervo/coletar.py` busca, filtra a licença, corta em 9:16, gera a folha de contato e só publica o que uma pessoa aprovou.
  - O plano, as fontes possíveis e por que não usar o Google Drive estão em `docs/acervo.md`.

### Adicionado

- **`app/`: Prensa**, o app para quem não programa (issues #2, #3, #4 e #5, primeira versão). Vídeo → trecho → formato → plataformas → MP4 9:16 → compartilhar, tudo no navegador do aparelho: decodifica e codifica com WebCodecs (mediabunny), transcreve com o Whisper `base` 8 bits (transformers.js, num worker, 77 MB baixados uma vez) e desenha cada quadro num canvas. Layouts tela cheia (fundo desfocado para vídeo deitado) e tela dividida (vídeo de retenção embaixo, com crédito); ganchos "Você sabia?", "POV", "Manchete" e "Lista"; fonte sempre visível; legenda palavra a palavra portada do `motores/legenda` (mesmas regras de quebra, cores e faixa segura), mais `.srt`. A legenda começa assim que o trecho é escolhido e aparece na prévia, que usa a mesma função de desenho do export. Exporta para TikTok, Reels, Shorts, Kwai e status do WhatsApp: um render, cortado ou dividido em partes por plataforma. Instalável (PWA), funciona offline depois da 1ª visita e, no Android, recebe vídeo pelo menu Compartilhar.
- **Issue [#11](https://github.com/arthruur/motores-video/issues/11)**: receber vídeo por link na Prensa (atalho no celular, instância própria do cobalt ou yt-dlp no PC). Hoje o navegador não pode baixar de outro site (CORS), então o vídeo entra como arquivo.
- **`docs/plataformas.md`**: duração, tamanho, codificação e faixa segura de cada plataforma, com a fonte de cada número e o que não foi confirmado.

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
