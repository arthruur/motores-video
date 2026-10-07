# motores/render

Transforma uma cena HTML em MP4 vertical, no Chrome headless, num PC sem GPU dedicada. A cena é uma página que sabe se desenhar em qualquer instante `t`; o motor fotografa cada quadro e entrega ao ffmpeg. O contrato está em [CONTRATO.md](CONTRATO.md).

```bash
npm install                      # só o playwright-core; usa o Chrome (ou Edge) já instalado
node motores/render/render.mjs exemplos/ola-mundo --saida saida/ola-mundo.mp4
node motores/render/render.mjs exemplos/ola-mundo --teste 0.5,1.5,3,5 --zonas   # folha de contato
node motores/render/render.mjs --help
```

Requisitos: Node 20+, Chrome ou Edge instalado (ou `--chrome <executável>`), `ffmpeg` no PATH (com `libx264`; a folha de contato usa `drawtext`).

Como função:

```js
import { renderizar } from './motores/render/render.mjs'
const r = await renderizar('exemplos/ola-mundo', { saida: 'saida/ola.mp4', workers: 2, audio: 'voz.wav' })
console.log(r.quadros, r.fotos, r.tempos.total_s)
```

## Como funciona

1. Servidor estático local com a pasta da cena (as fontes do repo ficam em `/_fontes/`).
2. **N processos Chrome** (não abas: abas no mesmo Chrome quase não escalam). Cada um pega uma fatia contígua de quadros.
3. Captura **JPEG pelo CDP** (`Page.captureScreenshot` com `optimizeForSpeed: true`). O `page.screenshot()` do Playwright pede PNG sem esse parâmetro e chega a ~1 s por quadro em cena com textura; por CDP em JPEG cai para ~70–80 ms.
4. Os bytes vão direto pelo **stdin** de um ffmpeg por processo (sem pasta de quadros). Se a chave de estado devolvida por `seek(t)` repete, a foto anterior é reenviada.
5. Conversão para **yuv420p faixa de TV, BT.709** (marcada no arquivo), `concat` sem reencode e, se houver, o áudio com `apad`.

Workers padrão pela RAM: 4 com 16 GB ou mais, 2 com 8 GB ou mais, 1 abaixo (limitado à metade das threads). Com 4 processos em 1080×1920 o pico medido foi de ~5,5 GB.

## Medições

Máquina: notebook Ryzen 7 5700U (8 núcleos / 16 threads, Radeon integrada), 19 GB, Windows 11, Chrome 154, Node 20.20.1, playwright-core 1.63.0, ffmpeg 9.0.2. Notebook sujeito a variação térmica e de energia: os números são de rodadas seguidas no mesmo estado, não médias controladas.

**`exemplos/ola-mundo`** (6 s, 180 quadros, 1080×1920, 30 fps; MP4 de ~196 KB):

| Configuração | Fotos | Tempo total |
|---|---|---|
| 4 workers + pulo de quadros (padrão) | 118 | 6,8–7,5 s (5 rodadas); 8,0–8,3 s em 3 rodadas de outro dia |
| 2 workers + pulo | 118 | 7,9 s |
| 1 worker + pulo | 117 | 9,6–10,9 s |
| 4 workers, `--sem-dedup` | 180 | 7,7 s |
| 1 worker, `--sem-dedup` | 180 | 14,2–14,4 s |
| 4 workers + `--verificar` (62 pulados conferidos, 0 diferentes) | 118 | 8,4 s |
| Folha de contato (`--teste`, 1 a 6 instantes) | — | 2,5–3,4 s |

Numa cena tão curta boa parte do tempo é abrir os Chrome (a folha de contato, que abre um só, leva ~2,5 s). Conferências: o vídeo com e sem pulo de quadros dá SSIM 1,000000; as cores sólidas voltam do MP4 com no máximo 2 níveis de diferença (#f2b84b → 242,184,77; #7fd1c7 → 127,208,198); `ffprobe` mostra `yuv420p`, `color_range=tv`, `bt709` nos três campos.

**Cena mais pesada, no laboratório de origem** (47 s, 1.407 quadros, textura de grão em SVG, mesma máquina): ~25 min com `page.screenshot()` em PNG; 110 s com captura JPEG por CDP em 1 processo; 46 s com 4 processos; **28 s com 4 processos + pulo de quadros** (549 fotos). 6 processos ficaram mais lentos que 4 (os x264 disputam a CPU).

## Limites conhecidos

- O pulo de quadros confia na chave da cena. Animação fora do `seek` (CSS, GIF, `<video>`) quebra isso sem aviso; use `--verificar` ao criar uma cena nova.
- Não medido em PC modesto (4 núcleos / 8 GB). O padrão de 2 workers com 8 GB é estimativa a partir da memória medida aqui.
- `HeadlessExperimental.beginFrame` (compositor determinístico, `chrome-headless-shell`) funcionou no Windows nos testes de origem (~60 ms/quadro em 1 processo), mas não está no motor.
