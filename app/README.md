# Prensa

**Seu vídeo vira reels prontos para postar, no próprio celular.** Escolha o vídeo, marque o trecho, escolha um formato e aperte **Prensar**: sai um MP4 9:16 com legenda palavra a palavra, gancho e fonte na tela, um arquivo para cada plataforma e o botão de compartilhar.

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

| Passo | O quê | Issue |
|---|---|---|
| 1. Vídeo | Escolher ou arrastar; no Android, receber pelo menu Compartilhar. Marcar o início e o fim do trecho com o vídeo tocando | [#5](https://github.com/arthruur/motores-video/issues/5) |
| 2. Formato | **Tela cheia** (vídeo deitado ganha fundo desfocado) ou **tela dividida** (conteúdo em cima, vídeo de retenção embaixo, com crédito). Gancho: **Você sabia?**, **POV**, **Manchete**, **Lista**. Campo **Fonte** sempre visível no vídeo | [#2](https://github.com/arthruur/motores-video/issues/2), [#4](https://github.com/arthruur/motores-video/issues/4) |
| Legenda | Whisper no aparelho; começa a ouvir **assim que você escolhe o trecho**, enquanto escolhe o formato, e aparece na prévia | — |
| 3. Para onde | TikTok, Reels, Shorts, Kwai, status do WhatsApp. Um render serve a todos; acima do limite o arquivo é cortado (Kwai) ou dividido em partes (WhatsApp). Sai também o texto do post com a fonte e a legenda `.srt` | [#3](https://github.com/arthruur/motores-video/issues/3) |

A prévia usa a **mesma função de desenho** do export (`desenharQuadro` em `src/formatos.ts`): o que aparece nela é o que sai no arquivo.

## Como funciona

| Arquivo | O que faz |
|---|---|
| `src/prensa.ts` | Lê o vídeo ([mediabunny](https://mediabunny.dev), WebCodecs), desenha quadro a quadro num canvas 1080×1920, codifica H.264 + AAC a 30 fps e recorta por plataforma. Volume nivelado (aproximação de −14 LUFS, pico até −1 dBFS) |
| `src/formatos.ts` | Layouts, ganchos, fonte e crédito. Faixa segura comum a TikTok, Reels e Shorts, a mesma do `motores/legenda` |
| `src/legenda.ts` | Porte do `motores/legenda/gerar.py`: blocos por sintagma (programação dinâmica), sem quebrar artigo e nome, palavra atual em amarelo e 106%, placa atrás, `.srt` |
| `src/transcrever.worker.ts` | Whisper `base` com tempo por palavra ([transformers.js](https://huggingface.co/docs/transformers.js), WASM, 8 bits), num worker para a tela não travar |
| `src/plataformas.ts` | Perfis de exportação. Limites e fontes em [docs/plataformas.md](../docs/plataformas.md) |
| `public/sw.js` | Offline e recebimento pelo menu Compartilhar (Android) |

## Números

Medidos num notebook Ryzen 7 5700U (sem GPU dedicada), Chrome 64 bits sem janela, com o Playwright. **Ainda não foi medido num celular**: espere números mais lentos, sobretudo na legenda.

| O quê | Resultado |
|---|---|
| Apertar **Prensar** → 5 arquivos (vídeo de 33 s, tela cheia, legenda já pronta) | 15,9 s |
| Legenda de 33 s de fala (Whisper `base` 8 bits, WASM, modelo em cache) | ~45 s, em segundo plano enquanto a pessoa escolhe o formato |
| 1ª vez: baixar o modelo (77 MB) | 25–50 s, depende da rede |
| Vídeo de 75 s sem legenda → 6 arquivos (WhatsApp em 2 partes, Kwai cortado em 60 s) | 35,6 s |
| Saída | H.264 High 1080×1920 30 fps, AAC 48 kHz; −14,8 LUFS integrado, pico −2,0 dBFS |
| Modelo 8 bits × fp32 + q4 | 77 MB × 206 MB; no teste, o 8 bits transcreveu melhor ("longas" em vez de "londas", com vírgulas) |

## Limites conhecidos

- **Não baixa por link.** O navegador não pode buscar vídeo do X, YouTube ou Instagram de outra página (CORS). Por enquanto, o vídeo entra como arquivo; o download por link está na issue [#11](https://github.com/arthruur/motores-video/issues/11).
- **Não foi testada em celular real**, nem no Safari do iPhone. No iPhone, um app instalado pela tela inicial não aparece no menu Compartilhar (limite do iOS): escolha o vídeo pela galeria.
- **Vídeos longos.** A legenda é feita no trecho, e o trecho é limitado a 3 min (o limite dos Shorts). Uma fala de 1 h deve ser cortada antes ou ir para os motores em Python.
- **Volume:** é uma aproximação por RMS, não uma medida de LUFS com ponderação K.
- **WhatsApp:** dividido em partes de até 60 s, o limite mais conservador (90 s ainda não confirmados em fonte oficial).

## Regras

As mesmas do repositório: **fonte visível** quando for fato (o campo "Fonte" vai para a tela e para o texto do post), **crédito** do vídeo de baixo, e **nunca** imitar voz ou rosto de pessoa real. A Prensa não gera voz nem imagem sintética: só reorganiza o vídeo que você deu, com a legenda do que foi dito.
