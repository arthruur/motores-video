# O Cesto · bíblia do personagem

**Tipo:** guardião · **Altura:** 1,0 cesto (a unidade da série) · **Rampas:** `palha_cesto`, `folha`, `tomate`, `laranja` · **Arquivo-fonte:** `../../mascote.svg`

> **Design travado.** O Cesto é o mascote do Mangaio. A série não redesenha o Cesto; ela **completa** o Cesto: vistas, poses e expressões que a marca ainda não tem. Qualquer mudança na frente oficial passa pelo dono da marca.

## Em uma frase
O único objeto vivo de Serra Pequena: carrega a feira inteira, não diz uma palavra e todo mundo entende o que ele quer dizer.

## Anatomia
Cesto de palha trançada, boca larga, alça em arco, cheio de frutas e folhas (tomate, laranja, folhas verdes). O rosto fica no trançado da frente. Dois bracinhos curtos saem dos lados.

O SVG já vem separado em grupos: `corpo`, `rosto` (com `boca`), `alca`, `braco-dir`, `braco-esq`, `frutas` (com `tomate`, `laranja`). Os olhos `olho-esq` e `olho-dir` já são usados pelo motor (`../../cena.js`).

## Da personalidade ao desenho
- **Guardião, coração da feira** → é a forma mais redonda e mais quente do elenco. Nada nele é pontudo.
- **Não fala** → tudo está no **olhar e nos braços**. Os olhos precisam de mais variação que os de qualquer outro (ver expressões).
- **Carrega a comunidade** → o conteúdo do cesto é narrativo. Muda por capítulo: vazio na seca, cheio no mutirão, transbordando na festa. A palha do licurizeiro do cap. 2 fica guardada nele a temporada toda.

## Silhueta
Trapézio arredondado (boca mais larga que o fundo) + arco da alça + montanha de frutas. É a silhueta mais reconhecível da série e não pode ser coberta por outro personagem em plano de apresentação.

## Rosto
É **o** rosto da série. O rosto padrão do elenco (ARTE.md §6) é este: dois ovais cheios `#462416`, sem branco e sem brilho, e boca cheia `#462416` com interior `#C5441E`. Sem sobrancelha e sem nariz. Os braços são patinhas grossas e redondas, com a borda em `palha_cesto.sombra`.

## Estados do conteúdo (props do Cesto)
| Estado | Quando | Conteúdo |
|---|---|---|
| `cheio` | Padrão (= mascote.svg) | Tomate, laranja, folhas |
| `vazio` | Seca, tristeza | Só o fundo de palha à mostra |
| `pouco` | Arco 1 | Uma ou duas frutas murchas |
| `transbordando` | Mutirão, festa | Pilha acima da borda (movimento `carregar_tudo`) |
| `entrega` | Arco 3 (entregador) | Encomenda amarrada com fita de palha |
| `+ palha_licuri` | Do cap. 2 em diante | Um pedacinho de palha sempre visível na lateral |

## Model sheet pedido
Folha v0: [`../folhas/cesto-folha.png`](../folhas/cesto-folha.png), gerada por [`../folhas/cesto_folha.py`](../folhas/cesto_folha.py) a partir do `mascote.svg` (fonte editável no VectorCraft: `../fonte/cesto-folha.vectorcraft`, uma prancheta por seção; variações avulsas em `../banco/cesto/`).

- [ ] Turnaround de 5 vistas. Frente ✅ (oficial) · costas: rascunho espelhado · **3/4, perfil e de cima: gerar no GPT** ([`../referencias/cesto/prompts.md`](../referencias/cesto/prompts.md)) e vetorizar no VectorCraft
- [x] Folha de expressões de **olhos + braços** (v0): desconfiado, assustado, triste, encantado, decidido, rindo, envergonhado, "não vai". Falta aprovar
- [ ] Poses do repertório: quique (antecipação, ar, pouso) e carregar_tudo na v0; **apontar, dança, pegar dependem do braço levantado** (peça nova, prompt 3)
- [x] Estados de conteúdo: cheio, pouco, vazio, transbordando (v0). Falta `entrega` e `+ palha_licuri`
- [ ] Cesto visto **de cima** (cap. 14, estrada) e **de costas** (saindo de cena)
- [ ] Detalhe: close (trançado completo), médio, geral

### Peças novas da v0 (a aprovar)
| Peça | O que é | Usado em |
|---|---|---|
| Olho `meia` | Pálpebra reta por cima | desconfiado, antecipação |
| Olho `triste` / `decidido` | Pálpebra inclinada para fora / para dentro | triste, vazio / decidido |
| Olho `arco` | `^` fechado feliz | rindo, pouso |
| Olho `fechado` | Linha apertada | "não vai" |
| Bocas `o`, `o_pequeno`, `triste`, `firme`, `torta`, `ondulada`, `reta`, `sorriso_fechado` | Formas cheias `#462416`, interior `#C5441E` | expressões |
| Bochecha | Mancha `tomate.luz` a 55% | encantado, envergonhado |
| `interior` | Fundo do cesto e borda de trás em `palha_cesto` meio/sombra/profunda | vazio, pouco |

## Atuação e movimento
- **Quica**, não anda. Squash na chegada, stretch na subida. O conteúdo sacode atrasado (*follow-through*).
- Os braços são a voz: cada frase de trompete tem um gesto (ver `../animacao.md`).
- Piscada lenta quando entende algo; olhar de canto quando desconfia.
- Peso: cheio, quica baixo e devagar; vazio, alto e leve.

## Arco visual
O conteúdo acompanha a temporada: `pouco` (estiagem) → `cheio` (chuva) → `transbordando` (safra) → festa com fitas. No cap. 14, ele volta da estrada **gasto**: palha desfiada em um ponto, poeira. Essa marca fica até o fim.

## Nunca
- Fala, boca sincronizada com voz, legenda com fala dele.
- Ganha pernas. Ele quica.
- Fica bravo de verdade com alguém. No máximo desconfiado ou triste.
- Muda de cores, proporção ou rosto em relação ao mascote oficial.

## Prompt base
```
THE BASKET (main character): a friendly woven straw basket with a wide mouth,
a twisted arched handle, full of a tomato, an orange and green leaves. Two solid
dark-brown oval eyes (no whites, no highlights) and a wide open smile on the
front weave. Two short, thick, rounded mitten-like arms on the sides. Use the attached reference image as the exact design: same colors,
same weave, same face, same proportions. Do not redesign it.
```

## Decisões
| Data | Decisão | Por quê |
|---|---|---|
| 2026-11-07 | O Cesto é a âncora de estilo de toda a série | É marca do Mangaio e já tem o acabamento-alvo |
| 2026-11-07 | Folha v0 por recombinação do `mascote.svg`, sem redesenho | O design é travado; só se acrescentam peças (olhos, bocas, interior) |
| 2026-11-07 | Braço oficial gira no máximo ~60° | Acima disso a patinha vira "orelha". Pose com braço alto pede peça nova |
| 2026-11-07 | Sobrancelha: o Cesto não usa | Expressões da v0 leram só com pálpebra e boca (ARTE.md §6: então ninguém usa como neutra) |
