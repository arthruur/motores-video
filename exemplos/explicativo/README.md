# exemplo: explicativo ("Por que o céu é azul?")

Um vídeo vertical de ~33 s feito do zero com os três motores, por um comando só:

```bash
python exemplos/explicativo/gerar.py                              # edge-tts (padrão do roteiro)
python exemplos/explicativo/gerar.py -p kokoro -v pm_alex --saida saida/explicativo-kokoro
python exemplos/explicativo/gerar.py --zonas                      # folha de contato com a zona segura
python exemplos/explicativo/gerar.py --help
```

Rode da raiz do repositório, com o venv ativo (`pip install -r requirements.txt`) e `npm install` feito. Precisa de Node 20+, Chrome ou Edge e `ffmpeg` com libass no PATH.

## O que acontece

```
roteiro.json ─► 1. voz (motores/voz) ─────────► voz.wav + palavras com tempo (cada uma sabe a sua cena)
                     │
                     ├─► 2. cena/ (cena.html + dados.json) ─► render (motores/render) ─► cenas.mp4   ┐ em
                     ├─► 4. mixagem: voz + trilha sintetizada, ducking, loudnorm −14 LUFS ─► mix.m4a  ┘ paralelo
                     └─► 3. legenda (motores/legenda) ─► legenda.ass / .srt / .vtt
                                         5. queimar .ass + juntar mix ─► explicativo.mp4
```

1. **Voz.** O texto de todas as cenas vira **uma tomada contínua** (fica mais natural que cortar por cena). O motor de voz devolve uma palavra por palavra do roteiro, então o `gerar.py` sabe a cena de cada uma pela ordem. Se o texto, o provedor, a voz e a velocidade não mudaram, a voz é reaproveitada (`--refazer-voz` força).
2. **Cena.** `cena.html` é uma página só, com uma camada por cena. O `gerar.py` escreve `dados.json` com o início e o fim de cada cena e o instante de cada **palavra-gatilho** (`"gatilhos"` no roteiro: nome → começo da palavra). A cena entra 0,15 s antes da sua primeira palavra, e os detalhes entram no gatilho: o leque de cores aparece em "mistura", o céu fica azul em "todos os lados", o sol fica laranja em "laranja".
3. **Legenda.** As mesmas palavras viram a legenda falada (.ass, zona universal) e a acessível (.srt/.vtt).
4. **Mixagem.** Acorde grave sintetizado com `aevalsrc` (código, sem direitos de terceiros), *ducking* com `sidechaincompress` sob a voz e `loudnorm` em **duas passagens** (mede, depois aplica ganho linear).
5. **Final.** A legenda é queimada com libass (com a conferência de fonte em modo estrito) e o áudio entra sem reencode. O `gerar.py` mede o loudness do arquivo final (ebur128) e grava `relatorio.json`.

Saídas em `saida/explicativo/`: `explicativo.mp4`, `legenda.srt`/`.vtt`/`.ass`, `explicativo-teste.png` (um quadro por cena, logo depois do gatilho, mais o cartão final), `relatorio.json`, `palavras.json`, `voz.wav`, `mix.m4a`, `cenas.mp4` e a pasta `cena/`.

O cartão final traz a fonte do conteúdo e o **rótulo de IA** que o motor de voz devolve ("Narração gerada por IA (voz sintética ...)"). O mesmo texto é impresso no fim, para a descrição do post.

## Medições

Notebook Ryzen 7 5700U (16 threads, sem GPU dedicada), 19 GB, Windows 11, Chrome 154, ffmpeg 9.0.2, Python 3.13, edge-tts 7.2.8. Rodadas seguidas, não médias controladas.

| Etapa | edge / Francisca | kokoro / pm_alex |
|---|---|---|
| Fala | 30,6 s, 105 palavras, tempos nativos | 27,8 s, 105 palavras, tempos do alinhador |
| Voz | 3,7–8,3 s (rede) | 80,4 s (síntese + alinhador Whisper `small`, com carga dos modelos) |
| Render (998 / 913 quadros, 4 workers) | 24,7–29,6 s, 649 fotos | 22,9–23,3 s, 636 fotos |
| Mixagem (2 passagens, em paralelo com o render) | 5,5–6,2 s | 6,0 s |
| Legenda (.ass/.srt/.vtt) | 0,2 s | — |
| Queimar + juntar | ~6 s | — |
| **Total** | **39,4–50,9 s** com voz nova; **35,3–36,0 s** com a voz reaproveitada | 113,8 s com voz nova; 32,6 s reaproveitada |
| Loudness medido no final | −14,2 LUFS, pico −1,5 dBTP | −14,9 LUFS, pico −1,5 dBTP |

- **Pulo de quadros:** 649 fotos para 998 quadros. Com `--verificar` no motor de render, os 349 quadros pulados foram fotografados e **0 saíram diferentes**. Na primeira versão da cena, as ondas continuavam andando com a cena invisível e o motor fotografava os 998 quadros; parar a fase fora da cena economizou 35% das fotos.
- **Loudnorm:** em uma passagem, o resultado foi −14,5 LUFS (edge) e **−15,6 LUFS** (Kokoro). Em duas passagens, −14,2 e −14,9. O Kokoro ainda fica ~1 LU abaixo, provavelmente porque o modo linear respeita o pico de −1,5 dBTP (a conferir).
- **Legenda:** 38 blocos, 0 órfãos, 0 quebras ruins, 0 fora da zona; o `.srt` tem 10 cues, maior linha com 41 caracteres e 2 cues acima de 17 caracteres/s (a fala do edge a 1,05× é rápida).
- **Arquivo final:** 1080×1920, H.264 `yuv420p`, `color_range=tv`, BT.709, AAC 160 kb/s, 33,2 s, ~2,8 MB.
- **Conferido a olho** na folha de contato e em quadros de 540×960: a fonte é a Barlow, as cenas entram nas palavras certas, nada passa da zona universal e a legenda não cobre o desenho.

## Para fazer o seu

- Troque o texto e os gatilhos no `roteiro.json`. O gatilho é o começo de uma palavra **da própria cena** (sem acento ou com, tanto faz).
- Escreva números por extenso na fala ("cinco vezes", não "5 vezes"): o edge dá duração zero aos algarismos e a legenda converte para algarismo sozinha.
- `cena.html` segue o [contrato do motor de render](../../motores/render/CONTRATO.md). Para ver uma cena parada sem gerar tudo: `node motores/render/render.mjs saida/explicativo/cena --teste 2,6,10 --zonas`.
- O conteúdo é de divulgação científica simplificada (espalhamento de Rayleigh). Se for publicar algo assim, cite uma fonte de verdade no cartão final.
