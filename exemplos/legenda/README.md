# exemplo: legenda

Texto neutro sobre a Lua (`texto.txt`), com 24 s de fala. O `palavras.json` traz o tempo de cada palavra, medido pelo edge-tts (voz `pt-BR-FranciscaNeural`), com a grafia do texto. O áudio não vem junto: o edge-tts usa um serviço da Microsoft sem termos de uso formais (ver `motores/voz`).

Os comandos rodam a partir da raiz do repositório:

```bash
# 1. legenda falada (.ass) + acessível (.srt, .vtt) + relatório
python motores/legenda/gerar.py exemplos/legenda/palavras.json -o saida/legenda/lua.ass --relatorio saida/legenda/lua.json

# 2. um fundo qualquer de 24 s (ou o seu vídeo, ou a saída do motor de render)
ffmpeg -f lavfi -i "color=c=0x2b3a4a:s=1080x1920:r=30:d=24" -pix_fmt yuv420p saida/legenda/fundo.mp4

# 3. prévia: 6 quadros com a zona da interface em vermelho
python motores/legenda/queimar.py saida/legenda/fundo.mp4 saida/legenda/lua.ass --teste 1,4.5,9.6,17.2,20.5,23 --zonas -o saida/legenda/lua-teste.png

# 4. vídeo com a legenda queimada
python motores/legenda/queimar.py saida/legenda/fundo.mp4 saida/legenda/lua.ass -o saida/legenda/lua.mp4
```

Para refazer com outra voz, gere os tempos com o motor de voz: `python -m motores.voz.cli sintetizar exemplos/legenda/texto.txt -o saida/voz.wav`. Os tempos ficam em `saida/voz.json`, que o `gerar.py` lê direto. Para pôr o áudio no vídeo, use `--audio saida/voz.wav` no motor de render ou junte com o ffmpeg.

O resultado esperado, na zona universal:

```
A LUA LEVA CERCA | DE 27 DIAS PARA | DAR UMA VOLTA | COMPLETA EM TORNO | DA TERRA. | NESSE CAMINHO, | ...
numeros: vinte e sete -> 27, trezentos e oitenta e quatro mil -> 384.000, quarenta por cento -> 40%
```
