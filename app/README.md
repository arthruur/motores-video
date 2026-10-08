# Prensa

**Seu vídeo vira reels em 3 toques, no próprio celular.** Escolha o vídeo, toque numa receita e aperte **Prensar**: sai um MP4 9:16 com gancho, legenda dinâmica, som limpo e a fonte na tela, um arquivo para cada rede, e o botão de compartilhar.

Tudo roda no aparelho, no navegador: decodificar, transcrever, desenhar e codificar. **Nenhum vídeo é enviado para servidor.** A internet só é usada na 1ª visita, para baixar o app e o modelo de legenda (77 MB), que ficam em cache e depois funcionam offline.

Do mesmo jeito que a prensa de tipos móveis tirou a impressão das mãos de poucos, a Prensa quer que qualquer pessoa, com o celular que já tem, faça vídeo no formato que circula, sem pagar ferramenta fechada.

## Como usar

```bash
cd app
npm install
npm run dev        # http://localhost:5173, e no celular http://<ip-do-pc>:5173 na mesma rede
npm run build      # gera app/dist/, que pode ser hospedado em qualquer lugar estático
```

No celular, abra o endereço e use **"Adicionar à tela inicial"**: a Prensa vira um app. No Android, depois de instalada, ela aparece no menu **Compartilhar** da galeria e recebe o vídeo direto.

## O que ela faz

**Tela 1:** um botão, "Escolher vídeo". Na 1ª visita, um onboarding de 3 passos ("Como funciona") e a janela "Por que Prensa?", com a história da prensa e o papel dela na informação.

**Tela 2: a receita.** Assim que o vídeo chega, a Prensa começa a ouvir a fala em segundo plano. Uma receita já vem marcada. Quando a legenda fica pronta, o **gancho já aparece sugerido a partir da própria fala**. Falta só dizer de onde é o vídeo e apertar **Prensar**. O resto fica em "Mais opções": trecho, vídeo de baixo, estilo da legenda e redes.

| Receita | Para | O que monta |
|---|---|---|
| Corte direto (padrão) | Fala, dica, opinião | Tela cheia, título com a frase mais forte, legenda em bloco |
| Você sabia? | Curiosidade | Gancho "Você sabia?" |
| Dica rápida | "3 erros", "5 passos" | Gancho de lista, legenda palavra por palavra |
| Estímulo duplo | Podcast, história longa | Tela dividida 58/42, vídeo de retenção embaixo |
| Mito ou fato | Ciência, checagem | Manchete |
| Frase de impacto | Trecho marcante | A própria frase como título, legenda palavra por palavra |
| Cívico | Política, jornalismo | Modo seguro: só ganchos tirados da fala, sem tela dividida |

O porquê de cada escolha, com o nível de evidência e as fontes, está em [docs/receitas.md](../docs/receitas.md). Exemplo: a tela dividida é opção e não padrão, porque o único estudo controlado não achou ganho de compreensão nem de memória.

**Vídeo de baixo:**
- **Animações geradas na hora** (Pêndulos, Bolinhas, Tinta, Encaixe), sem download e sem direito autoral de ninguém.
- **Acervo de clipes reais com licença livre** (Wikimedia Commons), revisados por uma pessoa; ver [docs/acervo.md](../docs/acervo.md).
- **Ou o seu próprio vídeo.**

**Tela 3:** um arquivo por rede (TikTok, Reels, Shorts, Kwai, status do WhatsApp), com Compartilhar e Baixar, mais o texto do post com a fonte e a legenda `.srt`. Limites e fontes em [docs/plataformas.md](../docs/plataformas.md).

A prévia usa a **mesma função de desenho** do export (`desenharQuadro` em `src/formatos.ts`): o que aparece nela é o que sai no arquivo. Toque nela para ver tocando.

Issues atendidas (1ª versão): [#2](https://github.com/arthruur/motores-video/issues/2), [#3](https://github.com/arthruur/motores-video/issues/3), [#4](https://github.com/arthruur/motores-video/issues/4), [#5](https://github.com/arthruur/motores-video/issues/5).

## Como funciona

| Arquivo | O que faz |
|---|---|
| `src/prensa.ts` | Lê o vídeo ([mediabunny](https://mediabunny.dev), WebCodecs), desenha quadro a quadro num canvas 1080×1920, codifica H.264 + AAC a 30 fps e recorta por rede |
| `src/fxtor/` | **Motor de áudio do [Audio FXtor](https://github.com/matheustdo/audio-fxtor)**: loudness BS.1770 (−14 LUFS), limitador de pico real (−1 dBTP) e remoção de ruído de voz (RNNoise). Origem de cada arquivo no [README da pasta](src/fxtor/README.md) |
| `src/receitas.ts` | Receitas, banco de ganchos com lacuna e a escolha das frases da fala que dão bom gancho |
| `src/formatos.ts` | Layouts, ganchos (grandes por 4 s, depois título fixo), fonte e crédito. Faixa segura comum a TikTok, Reels e Shorts |
| `src/legenda.ts` | Porte do `motores/legenda/gerar.py` (blocos por sintagma, palavra atual em amarelo) e o estilo palavra por palavra; `.srt` |
| `src/retencao.ts` | As animações de retenção, cada uma uma função do tempo |
| `src/transcrever.worker.ts` | Whisper `base` com tempo por palavra ([transformers.js](https://huggingface.co/docs/transformers.js), WASM, 8 bits), num worker |
| `src/plataformas.ts` | Perfis de exportação |
| `public/sw.js` | Offline e recebimento pelo menu Compartilhar (Android) |

## Números

Medidos num notebook Ryzen 7 5700U (sem GPU dedicada), Chrome 64 bits sem janela, com o Playwright. **Ainda não foi medido num celular**: espere números mais lentos, sobretudo na legenda.

| O quê | Resultado |
|---|---|
| Apertar **Prensar** → 5 arquivos (vídeo de 33 s, tela cheia, legenda já pronta) | 15,9 s |
| O mesmo, tela dividida com clipe do acervo e som limpo (RNNoise), em tela de celular simulada | 25,9–26,4 s |
| Vídeo de 20 s, tela dividida com animação gerada / receita "Dica rápida" | 15,1 s / 17,2 s |
| Legenda de 33 s de fala (Whisper `base` 8 bits, WASM, modelo em cache) | ~45 s, em segundo plano enquanto a pessoa escolhe o formato |
| 1ª vez: baixar o modelo (77 MB) | 25–50 s, depende da rede |
| Vídeo de 75 s sem legenda → 6 arquivos (WhatsApp em 2 partes, Kwai cortado em 60 s) | 35,6 s |
| Saída | H.264 High 1080×1920 30 fps, AAC 48 kHz estéreo; **−14,0 LUFS** integrado, pico −2,5 dBFS (motor do FXtor) |
| Modelo 8 bits × fp32 + q4 | 77 MB × 206 MB; no teste, o 8 bits transcreveu melhor ("longas" em vez de "londas", com vírgulas) |

## Limites conhecidos

- **Não baixa por link.** O navegador não pode buscar vídeo do X, YouTube ou Instagram de outra página (CORS). Por enquanto, o vídeo entra como arquivo; o download por link está na issue [#11](https://github.com/arthruur/motores-video/issues/11).
- **Não foi testada em celular real**, nem no Safari do iPhone. No iPhone, um app instalado pela tela inicial não aparece no menu Compartilhar (limite do iOS): escolha o vídeo pela galeria.
- **Vídeos longos.** A legenda é feita no trecho, e o trecho é limitado a 3 min (o limite dos Shorts). Uma fala de 1 h deve ser cortada antes ou ir para os motores em Python.
- **Tempo até prensar:** a legenda leva mais que a própria fala no navegador (~45 s para 33 s, mais num celular). Ela começa assim que o vídeo chega; se a pessoa apertar Prensar antes, a Prensa espera a legenda terminar.
- **Ainda não faz** corte de silêncio, zoom de ênfase, loop nem A/B de ganchos (ver [docs/receitas.md](../docs/receitas.md)).
- **WhatsApp:** dividido em partes de até 60 s, o limite mais conservador (90 s ainda não confirmados em fonte oficial).

## Regras

As mesmas do repositório: **fonte visível** quando for fato (o campo "Fonte" vai para a tela e para o texto do post), **crédito** do vídeo de baixo, e **nunca** imitar voz ou rosto de pessoa real. A Prensa não gera voz nem imagem sintética: só reorganiza o vídeo que você deu, com a legenda do que foi dito.
