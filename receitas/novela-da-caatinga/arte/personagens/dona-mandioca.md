# Dona Mandioca · bíblia do personagem

**Tipo:** positiva (matriarca) · **Altura:** 1,35 cesto · **Rampas:** `mandioca_casca`, `mandioca_miolo`, `lenco_vermelho`

## Em uma frase
A dona da casa de farinha: manda em todo mundo, reclama de tudo e é a primeira a abrir a porta quando alguém precisa.

## Anatomia: o ingrediente real
Raiz de mandioca: comprida, levemente cônica e torta, **casca marrom fina e rugosa em faixas** que descasca em lascas, e **miolo branco** que aparece no corte do topo. Raízes finas na ponta de baixo.

## Da personalidade ao desenho
- **Matriarca, firme** → base larga e estável, postura ereta, quase nunca se curva. Quando se curva, é carinho.
- **Mandona de coração mole** → o corpo é duro (casca), o topo é macio (miolo branco que aparece por baixo do lenço). A "cabeça" é a parte mais clara e mais suave dela.
- **Trabalhadeira** → avental de saco de farinha e a colher de pau sempre à mão.

## Silhueta e proporção
Coluna larga, um pouco mais estreita embaixo, levemente torta (nenhuma mandioca é reta). Rosto no terço superior, logo abaixo do lenço. As pontinhas de raiz embaixo funcionam como "pés" e "barra de saia". A silhueta se reconhece pelo **lenço amarrado com as pontas para cima**.

## Cores
Casca `mandioca_casca`, com lascas descascadas mostrando `mandioca_miolo`. Lenço `lenco_vermelho` com bolinhas brancas (`mandioca_miolo.luz`). Avental de saco de algodão cru com carimbo apagado "FARINHA" (lettering à mão, nunca marca).

## Rosto
Padrão. É quem mais usa `sobrancelha_levantada`, e é o caso de teste da sobrancelha que aparece e some (ARTE.md §6). Bochechas: duas manchas de `lenco_vermelho.meio` a 30%, sem contorno.

## Figurino e acessórios
| Peça | Fixa? | Uso |
|---|---|---|
| Lenço vermelho de bolinha | Sim | Silhueta |
| Avental de saco de farinha | Sim | Trabalho |
| Colher de pau | Sim, na mão ou no avental | Bate na mesa (cap. 2), aponta, mexe |
| Folha de abano | Cap. 1 | Calor da seca |
| Cuia | Cap. 3 | Deixa cair no gancho |

## Model sheet pedido
Folha v1: [`../folhas/dona-mandioca-folha.png`](../folhas/dona-mandioca-folha.png), gerada por [`../folhas/dona_mandioca_folha.py`](../folhas/dona_mandioca_folha.py) (fonte editável: `../fonte/dona-mandioca-folha.vectorcraft`, uma prancheta por seção; peças avulsas em `../banco/dona-mandioca/`).

- [~] Turnaround: frente ✅ (rig) · 3/4 ✅ (Qwen, rastreada) · perfil e costas: **rascunho** montado com as peças (Qwen sem cota em 07/11; refazer, ver `../referencias/dona-mandioca/prompts.md`) · de cima: falta
- [x] Expressões: as 11 + "ri segurando o riso", "fingindo pouco caso" (cap. 4)
- [x] Bocas (8)
- [x] Poses: mão na cintura, bater a colher (antecipação + batida), se abanar (com a folha do cap. 1), braços cruzados, abraço contido
- [ ] Detalhe: close, médio, geral
- [x] Silhueta (e escala ao lado do Mangaio, 1,35×)

## Peças do rig (frente)
Arquivo: `../banco/dona-mandioca/dona-mandioca-rig.svg` (ids documentados no topo). Pés no chão em (640, 1195), coordenadas da geração.

| Grupo | O que é | Pivô |
|---|---|---|
| `dona-mandioca` | ela inteira | meio dos pés |
| `perna-esq`, `perna-dir` | a casca abaixo do quadril (recorte), pés-toco | quadril (500 / 780, 1068) |
| `tronco` | tudo acima do quadril: squash, stretch, inclinação | quadril |
| `corpo` | base lisa + casca e miolo rastreados + faixas de casca desenhadas | quadril |
| `acess-avental` | avental rastreado, laço desenhado, letreiro "FARINHA" de pincel | cintura |
| `acess-lenco` | lenço de bolinhas (follow-through: ±3°, chega atrasado) | nó |
| `rosto` | rosto padrão do Mangaio: `olho-*` (oval, arco, meia-lua, fechado, grande, triste, decidido), `sobr-*` (some por padrão), `boca` (8 de sincronia + 6 de expressão), `bochechas` | meio dos olhos |
| `braco-esq`, `braco-dir` | patinhas de luva sem dedos; variantes reto(ângulo), cintura, cruzado | ombro |
| `prop-colher` / `prop-abano` | colher de pau (`madeira_banca`) / folha de abano (`folha`), entre o braço e a mão | pega |

Combinações de cada expressão e pose: `EXPRESSOES` e `POSES` em `dona_mandioca_folha.py`.

## Atuação e movimento
Andar pesado e decidido, passos curtos. Gesticula com a colher como regente. Pausa antes da frase importante e se vira devagar para quem vai levar bronca. Quando está comovida, desvia o olhar e ajeita o lenço.

## Arco visual
Fixa. No tema "Mulheres na agricultura familiar" (temporadas futuras), ganha crachá de cooperativa.

## Nunca
Cintura marcada ou corpo "feminino" de pin-up. Avó caricata de cabelo grisalho humano. Ar de vítima.

## Prompt base
```
DONA MANDIOCA: an anthropomorphic cassava root, tall and slightly crooked,
wide stable base, thin rough brown bark peeling in strips that reveal white
flesh, a red headscarf with white polka dots tied with the knot ends pointing
up, an apron made of a cotton flour sack, holding a wooden spoon. A firm,
caring matriarch. Expression: one eyebrow raised, holding back a smile.
```

## Decisões
| Data | Decisão | Por quê |
|---|---|---|
| 2026-11-07 | Frente vetorial = geração do GPT limpa (sem granulado, cores da paleta) e rastreada no VectorCraft; rosto, braços, colher, laço e letreiro redesenhados como peças | O rastreamento não separa peças de rig, e o granulado do GPT é textura de filtro (proibida em ARTE.md §1) |
| 2026-11-07 | `mandioca_casca` esquentada (v1: base `#C46C36`) | A v0 (`#8C5A34`) deixava a raiz parda e apagava o rosto; a profunda era igual ao olho (`#462416`). A v1 segue a frente aprovada e conversa com a palha do Mangaio |
| 2026-11-07 | Nova rampa `algodao_cru` (proposta) para o avental | Não existia; separada do `mandioca_miolo`, que é quase igual ao papel da folha |
| 2026-11-07 | Rosto padrão na escala da largura dela (0,98 px por unidade do mascote, ≈ 0,48 do tamanho absoluto do Mangaio na escala 1,35) | O rosto do Mangaio ocupa ~60% da largura dele; no tamanho absoluto, os olhos dela ficariam mais afastados que a largura do corpo (0,6). **Proposta:** ARTE.md §3 passar a "mesma forma, tamanho pela largura do rosto"; aprovar ou recusar |
| 2026-11-07 | Sobrancelha = forma curta cheia em `#462416`, some na neutra; marca dela é a sobrancelha do lado esquerdo da tela levantada | Caso de teste da ARTE.md §6 |
| 2026-11-07 | Avental com laço desenhado à mão; letreiro "FARINHA" em lettering de pincel (Caveat Brush tremida letra a letra) em `algodao_cru.sombra` | O laço rastreado virava borrão; o carimbo apagado não pode ser marca |
| 2026-11-07 | Pernas = recorte da própria casca abaixo do quadril | Pés-toco: o andar dela é passo curto, sobe e desce, não balança de perna |

