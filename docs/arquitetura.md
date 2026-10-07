# Arquitetura: como os quatro motores se encaixam

Os motores são **independentes**: cada um tem a sua CLI, funciona sozinho e troca dados com os outros por **arquivos simples** (JSON, HTML, ASS, WAV, MP4). Não há um "framework" no meio. O `exemplos/explicativo/gerar.py` é um exemplo de orquestração, com ~250 linhas, não uma peça obrigatória.

Render, voz e legenda são as três peças de base. O quarto motor, **colagem**, é de outro tipo: não desenha cena nenhuma, monta vídeo de terceiros, e por isso é construído **em cima** da voz e da legenda (ver [Onde entra a colagem](#onde-entra-a-colagem)).

## Visão geral

```
                    ┌──────────────────────────── seu roteiro (qualquer formato) ───────────────────────────┐
                    │ texto da fala                         │ o que desenhar                                 │
                    ▼                                       ▼                                                │
         ┌─────────────────────┐   palavras.json   ┌─────────────────────┐                                   │
 texto ─►│  motores/voz (Py)   │──────────────────►│ sua cena HTML       │  window.DURACAO                    │
         │  edge│kokoro│piper  │  [{texto,inicio,  │ (lê dados.json:     │  window.seek(t) -> chave           │
         │  azure│11labs│grav. │     fim}]         │  cenas e gatilhos)  │  window.pronto                     │
         └──────┬──────────────┘         │         └─────────┬───────────┘                                   │
                │ voz.wav                │                   │                                               │
                │                        │                   ▼                                               │
                │                        │         ┌─────────────────────┐                                   │
                │                        │         │ motores/render (JS) │  N × Chrome headless → JPEG (CDP)  │
                │                        │         │                     │  → ffmpeg stdin → x264, BT.709     │
                │                        │         └─────────┬───────────┘                                   │
                │                        │                   │ cenas.mp4 (sem áudio, ou com --audio)         │
                │                        ▼                   │                                               │
                │              ┌─────────────────────┐       │                                               │
                │              │ motores/legenda (Py)│       │                                               │
                │              │ gerar.py            │──► legenda.ass ──┐   + legenda.srt / legenda.vtt      │
                │              └─────────────────────┘                  ▼                                    │
                │                                            ┌─────────────────────┐                         │
                └──► mixagem (ffmpeg: trilha, ducking, ────► │ queimar.py + ffmpeg │──► final.mp4            │
                     loudnorm) → mix.m4a                     └─────────────────────┘                         │
```

Repare em duas coisas:

1. **A legenda não passa pela cena.** O `.ass` é queimado depois do render. Mudar a legenda custa segundos; mudar a cena não muda a legenda.
2. **A voz manda no tempo.** A duração do vídeo, o instante em que cada cena entra e o destaque da legenda saem das palavras com tempo. Trocar a voz (outro provedor, a sua gravação) re-cronometra tudo sem tocar no código da cena.

## Formatos trocados

### Palavras com tempo (`voz.json`, `palavras.json`)

É o formato central, produzido pelo `motores/voz` e lido pelo `motores/legenda` (direto, sem conversão):

```json
{
 "duracao": 30.648,
 "palavras": [
  {"texto": "Por", "inicio": 0.098, "fim": 0.229},
  {"texto": "que", "inicio": 0.252, "fim": 0.383, "cena": "pergunta"}
 ]
}
```

- `texto` é a **grafia do roteiro**, com pontuação (é a pontuação que fecha a frase na legenda).
- `inicio` e `fim` em segundos, a partir do começo do WAV.
- **Uma entrada por palavra do texto** (`texto.split()`), na mesma ordem. Isso vale para todos os provedores, com tempos nativos ou do alinhador.
- `cena` é opcional: a legenda nunca cruza troca de cena e pode ocultar cenas (`--ocultar`).
- A lista pode vir solta (`[...]`) ou dentro de `{"palavras": [...]}`. O `voz.json` completo também traz `provedor`, `voz`, `sintetica`, `rotulo` (texto pronto para o rótulo de IA), `tempos` (nativos ou alinhador) e `alinhamento` (`exatas`, `repartidas`, `estimadas`).

### A cena (HTML + contrato)

Qualquer página que cumpra o [contrato](../motores/render/CONTRATO.md):

| Definição | O que é |
|---|---|
| `window.DURACAO` | segundos (> 0) |
| `window.seek(t)` | deixa a tela como ela é em `t`; pode devolver uma **chave de estado** (string ou número) para o pulo de quadros |
| `window.pronto = true` | fontes, imagens e dados carregados |

O motor serve a pasta da cena num servidor local (então `fetch('dados.json')` funciona) e as fontes do repositório em `/_fontes/`. A cena não sabe nada do motor de voz: quem junta os dois é o orquestrador, escrevendo um JSON que a cena lê. No exemplo explicativo:

```json
{
 "titulo": "Por que o céu é azul?", "duracao": 33.248, "fala_s": 30.648,
 "cenas": [{"id": "pergunta", "inicio": 0.098, "fim": 2.788, "gatilhos": {"azul": 0.836, "resto": 1.669}}],
 "rotulo": "Narração gerada por IA (...)", "fonte": "..."
}
```

### A legenda (`.ass`)

Um arquivo ASS com `PlayResX/PlayResY` iguais ao tamanho do vídeo, dois estilos (`Fala` e `Placa`) e **um evento por palavra e por estado** (antes, atual, depois), cada um com `\pos` fixo. A placa é um desenho vetorial (`\p1`). Todo o layout é decidido em Python (medido com a fonte real); o libass só desenha. Você pode editar o `.ass` à mão ou no Aegisub antes de queimar.

### Áudio e vídeo

- WAV mono 48 kHz da voz; a mixagem final em AAC 160 kb/s.
- MP4 H.264 `yuv420p`, faixa de TV, BT.709 marcado. O `queimar.py` mantém isso.

## Criando o seu formato

### Sua própria cena

1. Copie `exemplos/ola-mundo/cena.html` para uma pasta nova.
2. Escreva o desenho em HTML/CSS/SVG e toda a mudança dentro de `seek(t)`.
3. `node motores/render/render.mjs minha-pasta --teste 0.5,2,4 --zonas` até ficar bom; `--verificar` uma vez; depois o vídeo.

Para cenas guiadas pela fala, leia os tempos de um JSON (como o `exemplos/explicativo/cena.html` faz com `dados.json`) em vez de escrever números à mão.

### Seu próprio roteiro e orquestrador

O roteiro do exemplo (`exemplos/explicativo/roteiro.json`) é de propósito pequeno: título, voz, trilha, alvo de loudness e uma lista de cenas com `fala` e `gatilhos`. Para outro formato (lista, quiz, comparação, vídeo de dados), escreva o seu JSON e um orquestrador que:

1. junte o texto falado e chame `sintetizar(...)` (ou `alinhar(...)` sobre a sua gravação);
2. reparta as palavras pelas partes do seu formato (a ordem basta);
3. escreva o JSON que a sua cena lê e chame o render;
4. chame `gerar(...)` da legenda e `queimar(...)`;
5. mixe o áudio.

Os passos 2 e 3 são o que muda de formato para formato. O resto é o mesmo.

### Seu próprio provedor de voz

Um provedor é uma função `(texto_falado, voz, wav, opcoes) -> marcas | None` registrada em `PROVEDORES` (`motores/voz/provedores.py`). Devolva as marcas `[{texto, inicio, fim}]` se o serviço der tempos; devolva `None` e o alinhador cuida do resto. Declare o pacote, a chave de ambiente e se pode cobrar.

## Onde entra a colagem

O `motores/colagem` não tem roteiro nem voz sintética: a fala já existe, em vídeos de arquivo. O que ele precisa dos outros motores é o mesmo formato central, **palavras com tempo**, e por isso reusa as peças em vez de copiar:

```
fontes.json ─► baixar (yt-dlp, só o trecho) ─► entrada/<slug>.mp4
                 │
                 ▼
            indexar ── Whisper do motores/voz ──► palavras-<slug>.json  (mesmo formato do voz.json)
                 │      + janelas de 15 s ── EmbeddingGemma 2 ──► índice (vetores)
                 ▼
            sugerir "tema" ──► candidatos-<tema>.html  ──►  quem monta escreve colagem.json + revisao/<id>.txt
                                                                      │
                                                                      ▼
            montar, por fragmento:  casar() de motores/voz/alinhar.py   (o texto revisado manda, o Whisper empresta os tempos)
                                    gerar() de motores/legenda           (legenda karaokê na zona universal)
                                    filtro_legenda() de motores/legenda/queimar.py
                                    + ffmpeg: fundo desfocado, etiqueta ASS, loudnorm em 2 passagens
                    no fim:         cartões, concat, .srt/.vtt da colagem inteira (gerar() de novo) e ficha.json
            folha ── folha_de_contato() de motores/legenda
```

- **Não passa pelo render.** Cartões, etiqueta e legenda são ASS; a textura vem do `lavfi`. Não precisa de Chrome.
- **A voz aqui é a do arquivo.** O mesmo alinhador que cronometra uma gravação própria cronometra o discurso de 1988: o texto conferido por uma pessoa é a legenda, o Whisper só dá os tempos.
- **As dependências pesadas são opcionais.** Só `indexar` e `sugerir` precisam de torch e sentence-transformers. O `montar` roda com o núcleo quando as palavras já estão prontas (o exemplo traz `palavras/`).

Os exemplos `karaoke-discurso` (um trecho de discurso com legenda palavra a palavra) e `mudar-o-que` (explicativo com fonte de cada fato) usam as mesmas peças. Hoje `mixar()` e `loudness()` moram em `exemplos/explicativo/gerar.py` e são importados pelos outros dois exemplos; o lugar natural deles é um módulo comum de áudio.

Conceito e ética da montagem em [colagem.md](colagem.md).

## Linguagens e dependências

| Motor | Linguagem | Precisa de |
|---|---|---|
| render | Node 20+ (ESM) | `playwright-core` (só o protocolo; usa o Chrome/Edge instalado), ffmpeg |
| voz | Python 3.10+ | núcleo: faster-whisper, num2words, numpy, edge-tts; opcionais por provedor; ffmpeg |
| legenda | Python 3.10+ | Pillow; ffmpeg com libass |
| colagem | Python 3.10+ | voz e legenda; ffmpeg com libass; opcionais: yt-dlp (baixar), torch + sentence-transformers + EmbeddingGemma 2 (indexar, sugerir) |

A divisão Node × Python segue o que cada ecossistema faz melhor: o controle do Chrome é nativo em Node; Whisper, TTS e medição de fonte são nativos em Python. Os dois conversam por arquivo e subprocesso.
