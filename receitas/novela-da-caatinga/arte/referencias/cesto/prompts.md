# Cesto · prompts para o gerador de imagem

O Cesto **não** é explorado: o design é o `mascote.svg`. O GPT só desenha o que não dá para tirar da frente: **vistas novas** e **braço levantado**. Anexe sempre `../cesto-frente.png` e, quando existir, `../../folhas/cesto-folha.png`.

Cada geração boa vai para esta pasta como `AAAA-MM-DD-<o-que-e>.png`, com uma linha na tabela do fim.

## 1. Turnaround (3/4, perfil, costas)
```
Character model sheet of the attached character (THE BASKET), the SAME design in
5 views in a row, same height, standing on one ground line: front, three-quarter
left, side profile left, three-quarter back, back. The woven straw pattern must
follow the curvature of the basket in every view. The fruits (orange, tomato,
green leaves) stay in the same places inside the basket and are seen from the
new angle. The face (two solid dark-brown oval eyes, wide open smile) is on the
front weave only: it moves to the side in 3/4 and disappears in the back views.
The twisted handle keeps its arch and is seen in perspective. Short thick mitten
arms on the sides in every view. Neutral pose.
```
+ bloco de estilo e AVOID de `../../producao-de-arte.md#prompts`.

## 2. De cima (cap. 14, estrada)
```
The SAME attached character (THE BASKET) seen from directly above (top-down
view, slight tilt), we see into the basket: the fruits and leaves from above,
the round rim, the twisted handle crossing over as an arch, the two short
mitten arms sticking out on the sides. Contact shadow on dusty ground.
```

## 3. Braço levantado (peça nova do rig)
Os braços oficiais abraçam o corpo. Girados mais de ~60° viram "orelhas" (testado na folha v0), então "assustado", "apontar", "carregar_tudo" e "no ar" precisam de uma peça nova.
```
The SAME attached character (THE BASKET), 4 poses in a row, only the arms
change: both arms raised high above the head (surprise), right arm stretched out
pointing to the side, both arms up holding the fruit pile, one arm raised in a
small fist (determined). Arms are the same short thick rounded mittens, same
straw colors, same edge shading. Body, face and fruits unchanged.
```

## Gerações
| Data | Arquivo | Prompt | Modelo | Nota |
|---|---|---|---|---|
