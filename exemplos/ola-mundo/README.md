# ola-mundo

A cena mínima do motor de render: 6 s, um círculo que entra e vira quadrado, um título que sobe letra por letra e uma frase. Tudo calculado a partir de `t` em `window.seek(t)`, que devolve uma chave de estado (a partir de 4,4 s nada muda e o motor reaproveita a foto).

```bash
node motores/render/render.mjs exemplos/ola-mundo --teste 0.3,0.8,1.5,2.8,4,5.5 --zonas   # prévia
node motores/render/render.mjs exemplos/ola-mundo --saida saida/ola-mundo.mp4             # vídeo
```

Leva ~7 s num notebook Ryzen 7 sem GPU dedicada (180 quadros, 118 fotos). Os elementos ficam dentro da zona segura 9:16 (ver `motores/render/CONTRATO.md`). Fonte: Barlow Condensed (OFL), servida em `/_fontes/`.
