# O Mangaio (o cesto) · bíblia do personagem

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

- [x] Turnaround: frente ✅ (oficial) · **3/4, perfil e costas v2** montados à mão com as peças oficiais em [`cesto_folha.py`](../folhas/cesto_folha.py) (`tres_quartos`, `perfil`, `costas` → `banco/cesto/cesto-*.svg`, raiz `mangaio` com `data-vista`). A v1 rastreada do Qwen reprovou na revisão e ficou como rascunho em `referencias/cesto/teste-qwen/rastreio-v1-*.svg` · falta **de cima** (refazer com câmera levemente de cima, `将镜头向上移动`)
- [x] Folha de expressões de **olhos + braços** (v1): desconfiado, assustado, triste, encantado, decidido, rindo, envergonhado, "não vai". Falta aprovar
- [x] Poses do repertório: antecipação, no ar, pouso, carregar_tudo, **apontar**, **dança** (com os braços novos). Falta `pegar`
- [x] Estados de conteúdo: cheio, pouco, vazio, transbordando. Falta `entrega` e `+ palha_licuri`
- [x] **Rig para o motor:** [`../banco/cesto/mangaio-rig.svg`](../banco/cesto/mangaio-rig.svg), todas as peças trocáveis com ids estáveis (lista no topo do arquivo). v2: braço gira o grupo `.giro` com (0,0) no ombro; grupo `sombra`
- [x] **Teste de movimento:** demo [`../../demos/mangaio/`](../../demos/mangaio/) → `saida/novela-da-caatinga/demo-mangaio.mp4` (quique, virada, expressões, conteúdo, xote)
- [x] Lineup de silhuetas das vistas e das poses com braço novo (seção "Silhuetas" da folha)
- [ ] Mangaio visto **de cima** (cap. 14, estrada)
- [ ] Detalhe: close (trançado completo), médio, geral

Folha v2: [`../folhas/cesto-folha.png`](../folhas/cesto-folha.png), gerada por [`../folhas/cesto_folha.py`](../folhas/cesto_folha.py) (`--vectorcraft` refaz o `.vectorcraft`, uma prancheta por seção, e o PNG). Seções: vistas, expressões, conteúdo, quique e poses, silhuetas, braços.

### Peças novas (a aprovar)
| Peça | O que é | Usado em |
|---|---|---|
| Olho `meia` | Pálpebra reta por cima | desconfiado, antecipação |
| Olho `triste` / `decidido` | Pálpebra inclinada para fora / para dentro | triste, vazio / decidido |
| Olho `arco` | `^` fechado feliz | rindo, pouso, carregar_tudo, dança |
| Olho `fechado` | Linha apertada | "não vai" |
| Olho `grande` / `pequeno` | O oval oficial a 125% / 85% | assustado, encantado / envergonhado |
| Bocas `o`, `o_pequeno`, `triste`, `firme`, `torta`, `ondulada`, `reta`, `sorriso_fechado` | Formas cheias `#462416`, interior `#C5441E` | expressões |
| Bochecha | Mancha `tomate.luz` a 55% | encantado, envergonhado |
| `interior` | Fundo do cesto e borda de trás em `palha_cesto` meio/sombra/profunda | vazio, pouco |
| Braço `alto` (v2) | Antebraço curto e grosso, luva redonda acima do ombro, aberta para fora, com polegar ([`mangaio_bracos.py`](../folhas/mangaio_bracos.py)) | assustado, encantado, no ar, dança, aceno |
| Braço `aponta` (v2) | Estica de lado, luva mais estreita com polegar para cima | apontar, "não vai" |
| Braço `segura` (v2) | Sobe e a luva vira para dentro, palma para cima, na borda | carregar_tudo |
| Braço `punho` (v2) | Curto, luva fechada e redonda | decidido |

Os braços v2 seguem as medidas do oficial: ombro → luva ≤ 1,2× o oficial, antebraço de ~60 px, luva de ~100 × 90 px (a do oficial tem ~95). Cor: base `#E49340` e borda `#B0581E` do braço oficial (registradas em `paleta.json` como `palha_braco`), a borda como meia-lua do lado de dentro/de baixo. O da esquerda é o espelho do da direita.

### Rig: convenções do Mangaio (exceções ao `animacao.md` §2)
- **Pivô do braço:** cada peça é `g#braco-LADO-PECA[transform=translate(ombro)] > g.giro > formas`. O motor gira **só o `.giro`** (atributo `transform="rotate(a)"` no dir, `rotate(-a)` no esq); o (0,0) dele é o ombro real (`OMBRO` em `mangaio_bracos.py`: dir 490,446 · esq 46,452). Girar o `braco-*` com `transform-box: fill-box` (como o `cena.js` do cap. 1 faz no `mascote.svg`) solta o braço do corpo quando a peça muda de tamanho: foi a falha da v1.
- **Formato do pivô:** `data-pivo="x y"` (coords do mascote) no grupo, em vez do círculo `pivo`. Têm pivô: `mangaio`, `sombra`, `rosto`, `boca`, `olho-*`, `braco-*` e cada peça de braço.
- **Ids com lado:** `olho-esq-oval`, `braco-dir-alto` etc., porque o id tem que ser único no SVG.
- **Bocas expressivas** (`boca-aberta`, `boca-o`, `boca-torta`…) no lugar dos visemas `boca-A`…: ele não fala.
- O `cena.js` do cap. 1 continua usando o `mascote.svg` com o pivô antigo (só gira o braço oficial até ~60°, onde funciona). Ao trocar o cap. 1 para o rig, usar o `.giro`.

## Atuação e movimento
- **Quica**, não anda. Squash na chegada, stretch na subida. O conteúdo sacode atrasado (*follow-through*).
- Os braços são a voz: cada frase de trompete tem um gesto (ver `../animacao.md`).
- Piscada lenta quando entende algo; olhar de canto quando desconfia.
- Peso: cheio, quica baixo e devagar; vazio, alto e leve.
- **Pulo e giro permanecendo em 2D (`aventura.ts` e `danca.ts`):** quando o Mangaio faz pirueta no ar (`pulo_duplo`, `rodopio`, `arretado`), ele **não troca para vistas 3/4, perfil ou costas**; ele permanece **100% no desenho 2D de frente (`mascote.svg`)** e gira como um recorte 2D no próprio eixo vertical modulando a escala horizontal por cosseno (`sx = Math.cos(2π * voltas * suave(fase)) / s`, `sy = s`). Ao passar por `sx = 0` → `sx < 0` (espelho 2D) → `sx = 0` → `sx = +1` durante o arco balístico do salto, o giro lê com muito mais fluidez e carisma do que trocar entre vistas estáticas no chão (ver [`../animacao.md` §2c](../animacao.md#giro-2d)).
- **Onda das 11 frutas e hierarquia de peso (`cesto.ts` + `frutas.svg`):** as frutas dentro do cesto nunca se movem como um bloco colado nem apenas em 4 grupos rígidos. As **11 peças vetoriais individuais** extraídas de `arturo.ai` (`laranja`, `tomate-grande`, `tomate-1`, `tomate-2`, `banana-1`, `banana-2`, `morango-1`, `morango-2`, `folhas-3`, `folha-1`, `folha-2`, em [`app/src/mangaio/frutas.svg`](../../../../app/src/mangaio/frutas.svg)) repousam sobre uma cama elástica unilateral (`wCama = 22`, que empurra para cima na compressão mas deixa as frutas descolarem no ar nos saltos) sob gravidade de desenho animado (`G_FRUTA = 14`, maior que a do cesto para começarem a cair antes do pouso). O movimento propaga em **onda da esquerda para a direita** (`atraso = 0,20 s` de ponta a ponta da boca), inclinando cada fruta na crista da onda e escalando o salto pelo peso individual: folhas leves (`peso = 0.05..0.08`) saltam ~22% mais alto, morangos e bananas (`0.25..0.45`) têm quique médio, tomates (`0.55..0.85`) têm inércia pesada e a laranja (`1.00`) ancora o monte (`0.75×`). No pouso (`v < 0`), cada fruta sofre squash na própria base (`[0.5, 0.9]`).
- **Colheita elástica (`aventura.ts`):** quando o Mangaio apara frutas caindo (ex.: umbus em `mangaio-loop`), ele abre a boca em `'o'`, sofre um squash rápido de "engolir" (`amortece(dt, 0.14, 240, 14)`) e a nova fruta brota no topo da pilha com mola de resposta ao degrau (`pop(τ, k=420, c=14)` a partir do pivô `[0.5, 1.0]`).
- **Coreografia de dança (`danca.ts`):** em números musicais e festas (116 BPM), o Mangaio combina 4 passos encadeados com braços independentes (`braco` e `bracoDir`): `soquinho` (quique + ginga + soquinhos alternados), `rodopio` (agachamento + piruetas 2D no ar para esquerda e direita), `colado` (close + dengo lateral + olhos em arco feliz `◡` + braços abanando) e `arretado` (4 pulinhos rápidos + salto duplo de 2 voltas).

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
| 2026-11-07 | Nome visível do mascote: **Mangaio** (arquivos e ids `cesto` ficam) | Pedido do dono da marca; o motor depende dos ids |
| 2026-11-07 | Braço alto = **peça nova** (`alto`, `aponta`, `segura`, `punho`), não o oficial girado | Girado >60° o oficial vira orelha; as peças novas copiam cor e borda do oficial |
| 2026-11-07 | Vistas 3/4 e perfil: Qwen → VectorCraft → cores travadas na paleta, manchinhas fora, rosto redesenhado com as formas do mascote | O rastreio não separa olho/boca; redesenhar mantém o rosto idêntico à frente |
| 2026-11-07 | Perfil: o braço de perto é redesenhado (patinha "feijão") | No rastreio ele se fundia ao corpo |
| 2026-11-07 | Costas: braços passam para trás do corpo | De costas só se vê a curva de fora da patinha; o espelho puro parecia a frente sem rosto |
| 2026-11-07 | De cima: adiado | Cota diária de GPU do Qwen esgotou antes da geração; a de `俯视` virou 3D realista |
| 2026-11-07 | Revisão de arte da v1 reprovada: braços novos refeitos (v2) a partir das medidas do oficial; pivô no ombro via `.giro` | `alto`/`aponta`/`segura` eram remo, bastão e bengala; o braço alto soltava do corpo no giro |
| 2026-11-07 | Vistas 3/4, perfil e costas v2 **montadas à mão** com as peças oficiais (cut-out), não rastreadas | O perfil rastreado mudou as frutas e cortou o rosto; o 3/4 ficou manchado. Recombinar mantém a marca idêntica |
| 2026-11-07 | Costas: frutas atrás da borda de trás, braços atrás do corpo (só a luva aparece) | Para não parecer a frente sem rosto |
| 2026-11-07 | Cores do braço oficial registradas como `palha_braco` na paleta | O portão pede rampa registrada; não se trocam as cores da marca |
| 2026-11-07 | Sobrancelha: o Cesto não usa | Expressões da v0 leram só com pálpebra e boca (ARTE.md §6: então ninguém usa como neutra) |
| 2026-11-07 | **Pendente (aguardando a versão do outro PC):** (1) braços novos (alto, aponta, segura, punho) passam a ser SEM mão, ponta redonda (ARTE.md §2); (2) alça no 3/4 e no perfil; (3) frutas nos estados vazio/transbordando | Revisão do Arthur. Alça e conteúdo já foram resolvidos em outro PC; não refazer aqui antes de puxar essa versão |
| 2026-11-08 | **Vídeos `mangaio-loop.mp4` e `mangaio-danca.mp4` e seus fontes integrados (`app/src/mangaio/`, `ferramentas/mangaio/`, `cenas/mangaio*`)** | Documentado o processo completo em [`../animacao.md` §2c, §2d, §5.1, §6.1 e §9](../animacao.md) e [`../../demos/README.md`](../../demos/README.md): (1) onda física das 11 frutas individuais (`cesto.ts` + `frutas.svg`), (2) pulo e giro permanecendo em 2D (`sx = cos(2π·voltas·fase)/s` em vez de giro 3D por troca de vistas), e (3) coreografia em 4 partes (`soquinho`, `rodopio`, `colado`, `arretado`) + cortes na batida |
