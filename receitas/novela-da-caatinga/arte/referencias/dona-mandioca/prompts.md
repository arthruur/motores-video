# Dona Mandioca · gerações de referência

Ponto de partida: `../dona-mandioca-frente.png` (GPT, aprovada como design). Toda geração parte dela.

| Data | Arquivo | Prompt | Modelo | Nota |
|---|---|---|---|---|
| 2026-11-07 | `qwen-tres-quartos.png` | `将镜头向左旋转45度` (girar a câmera 45° à esquerda) + `../dona-mandioca-frente.png` | Qwen-Image-Edit-2511 + LoRA Multiple-Angles (Space HF `prithivMLmods/Qwen-Image-Edit-2511-LoRAs-Fast`), 4 passos, seed 1146965705 | **Boa.** Usada na folha v1: limpa (`folhas/dona_mandioca_limpar.py 34`), rastreada no VectorCraft e com o rosto padrão por cima -> `banco/dona-mandioca/dona-mandioca-tres-quartos.svg` |
| 2026-11-07 | (falhou) `qwen-perfil.png` | `将镜头向左旋转90度` | idem | **Sem cota de GPU do HF** ("exceeded your free ZeroGPU quota, 53s left, try again in 23:44"). Perfil ficou em rascunho montado com as peças do rig. Refazer quando a cota voltar |
| 2026-11-07 | (não rodou) `qwen-costas.png` | `将镜头向左旋转180度` | idem | Mesma cota. Costas em rascunho espelhado, com alças em X e laço |

Próximas gerações (quando houver cota): perfil e costas (acima); referências de pose para "se abanar" e "abraço contido", se o rascunho com peças não convencer.
