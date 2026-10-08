# Motor de áudio do Audio FXtor

Estes arquivos vêm do **[Audio FXtor](https://github.com/matheustdo/audio-fxtor)**, o editor de áudio no navegador de Matheus Teles (commit `5872183`, 08/10/2026). O autor liberou o código para uso aqui sob a mesma licença deste repositório (Apache-2.0).

| Arquivo | Origem no FXtor | Mudança |
|---|---|---|
| `biquad.ts`, `loudness.ts`, `dynamics.ts`, `resample.ts` | `src/audio/dsp/` | nenhuma |
| `rnnoise.ts` | `src/plugins/rnnoise.ts` | as duas funções de `offline.ts` que ele usa foram trazidas para dentro do arquivo |
| `som.ts` | escrito para a Prensa | combina o **Noise Remover** (modo voz) e o **Normalize** (preset "streaming": −14 LUFS, −1 dBTP) do FXtor numa função só |

O que isso dá à Prensa: loudness medida de verdade (ITU-R BS.1770, com ponderação K e gates), limitador de pico real com 4× de sobreamostragem e remoção de ruído de voz com o RNNoise (Xiph.Org, BSD-3-Clause, empacotado em `@shiguredo/rnnoise-wasm`, Apache-2.0).

Para atualizar: copie de novo os arquivos do FXtor e mantenha esta tabela em dia.
