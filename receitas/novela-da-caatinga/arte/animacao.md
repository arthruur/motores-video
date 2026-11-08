# Animação · atuação, rig e câmera

> Como os assets se movem. Este arquivo é a ponte entre a arte (Illustrator) e o motor (`../cena.js`, `../personagens.js`).

## 1. Técnica: *cut-out* 2D

A série é animada como **recorte digital** (a técnica de séries como *Peppa Pig* e *South Park*, e do After Effects com marionete): cada personagem é um conjunto de **peças vetoriais separadas** (corpo, olhos, sobrancelhas, boca, braços, pernas, acessórios), giradas em **pivôs**, com squash and stretch no corpo inteiro. É o que o motor já faz com o Cesto.

**Taxa de quadros:** render a 30 fps, mas a **atuação em "dois"**: a pose muda a cada 2 quadros (15 poses/s). Câmera, partículas e lábios correm em "um" (30/s). Isso dá o toque artesanal sem ficar travado.

## 2. Rig: peças e pivôs {#rig}

Toda arte entregue para o motor segue esta lista de grupos. Os nomes são os `id` do SVG e vêm dos nomes de camada do Illustrator (ver `producao-de-arte.md`).

| Grupo (`id`) | O que é | Pivô |
|---|---|---|
| `<id>` | O personagem inteiro | Meio dos pés, no chão |
| `corpo` | Volume principal com todas as camadas de tom | Base |
| `rosto` | Grupo do rosto (move junto para olhar) | Centro do rosto |
| `olho-esq`, `olho-dir` | Cada olho: oval cheio, com as formas alternativas como subgrupos (`olho-oval`, `olho-arco`, `olho-meia-lua`, `olho-fechado`, `olho-grande`); só uma visível | Centro do olho |
| `sobr-esq`, `sobr-dir` | Sobrancelhas (ocultas por padrão; ver ARTE.md §6) | Ponta interna |
| `boca` | Contém as 8 bocas como subgrupos `boca-A` … `boca-repouso` (só uma visível) | Centro da boca |
| `braco-esq`, `braco-dir` | Braço inteiro (+ `mao-*` se a mão gira) | Ombro |
| `perna-esq`, `perna-dir` | Se o personagem anda | Quadril |
| `acess-<nome>` | Cada acessório (`acess-lenco`, `acess-oculos`) | Ponto de fixação |
| `prop-<nome>` | Objeto na mão | Ponto de pega |
| `sombra` | Sombra de contato | Centro |

**O pivô é marcado no Illustrator** com um círculo minúsculo chamado `pivo` dentro de cada grupo. O motor lê a posição e apaga o círculo.

> **Exceção do Mangaio** (`banco/cesto/mangaio-rig.svg`): subgrupos com o lado no id (`olho-esq-oval`, `braco-dir-alto`), bocas expressivas no lugar dos visemas (ele não fala), pivô em `data-pivo="x y"` em vez do círculo `pivo`, e cada peça de braço gira só o filho `.giro`, cujo (0,0) é o ombro. Detalhes em [`personagens/cesto.md`](personagens/cesto.md#rig-convenções-do-mangaio-exceções-ao-animacaomd-2).

**Ordem das camadas** (de trás para frente): `sombra` → `perna-*` e `braco-*` de trás → `corpo` → `rosto` → `acess-*` → `braco-*` da frente → `prop-*`.

**Vistas:** cada vista do turnaround (frente, 3/4, perfil, costas) é um rig separado, com os mesmos nomes. O motor troca de vista; não existe interpolação 3D.

## 2b. Vistas: 2D, não 360 (decisão 2026-11-07)

Os personagens são **2D**. Cada um tem um conjunto pequeno de **desenhos-chave** (frente, 3/4, perfil, costas; espelhar dá o outro lado), cada um com o rig de peças (olhos, boca, braços…). **Virar é trocar de desenho**, segurando cada um alguns quadros, como na animação 2D tradicional; nada de giro contínuo de 15 em 15° por projeção 3D. O rig "360" da Dona Mandioca foi testado e atrapalhou: rosto e acessórios deformavam nas vistas intermediárias.

## 3. Expressões {#expressoes}

Vocabulário fixo, igual para todos (o motor já usa estes nomes):

`neutra` · `sorriso` · `sorriso_propaganda` · `ironica` · `sobrancelha_levantada` · `olhos_semicerrados` · `olhos_arregalados` · `encantado` · `empolgado` · `triste` · `brava`

Cada expressão é **uma combinação de peças** (forma de olho, posição da sobrancelha, boca em repouso), não um desenho inteiro. Expressão nova entra pela ficha do personagem e depois vem para esta lista.

## 4. Bocas: sincronia labial

**8 formas** (o padrão de estúdio derivado de Preston Blair), na linguagem do rosto do Cesto:

| `id` | Sons | Forma |
|---|---|---|
| `boca-repouso` | silêncio | Fechada, segue a expressão |
| `boca-MBP` | m, b, p | Lábios apertados |
| `boca-A` | a | Bem aberta, língua visível |
| `boca-E` | e, i (aberto) | Larga, meio aberta |
| `boca-I` | i, s, z, ch | Dentes quase juntos, cantos para fora |
| `boca-O` | o | Redonda, média |
| `boca-U` | u, ô | Redonda, pequena e projetada |
| `boca-FV` | f, v | Lábio de baixo sob os dentes de cima |

Hoje o motor abre a boca pelo **volume** da voz. O próximo passo é escolher a forma pelo **fonema**, com o alinhamento palavra a palavra do Whisper que o `preparar.py` já faz, mais uma tabela letra → boca em português. Até lá, volume baixo usa `boca-repouso`/`MBP`, médio usa `E`/`O` e alto usa `A`.

## 5. Princípios aplicados à série

| Princípio | Como aparece aqui |
|---|---|
| Squash and stretch | Todo pouso e todo susto. O Cesto quica; o Licuri estica de orgulho; o Sacolão murcha |
| Antecipação | Antes de qualquer movimento grande, um contra-movimento de 3 a 6 quadros |
| Follow-through | Frutas do Cesto, lenço da Dona Mandioca, espinhos da Maxixe, alças do Sacolão: chegam atrasados |
| Arcos | Mãos e cabeças andam em arco, nunca em linha reta. Exceção: o Realçador, que é artificial |
| Timing como personagem | Umbu lento, Seu Caju rápido, Mandacaru quase parado, Jataí sem parar (ver fichas) |
| Pose clara | Toda fala tem uma pose que se lê em silhueta |
| Respiração | Em cena, todo personagem respira: escala vertical de ±1,5% a cada 3 a 4 s. Ninguém fica congelado |
| Piscar | A cada 3 a 6 s, irregular; sempre no corte de olhar |

## 6. Repertório do Cesto {#repertorio-do-cesto}

O Cesto atua com um repertório fixo (ver também `../producao.md` §1). Cada frase de trompete tem um gesto.

| Movimento | Gesto | Trompete que casa |
|---|---|---|
| `quicar` | Pulo com mola, squash na chegada | — |
| `pulo_duplo` | Pulo com pirueta | `esperanca` |
| `pegar` | Fruta cai dentro, "plim" | — |
| `danca` | Balanço de xote, braços alternados | `esperanca` |
| `piscar`, `olhar` | Olhar de canto, piscada lenta | `desconfianca` |
| `apontar` | Um braço estica e aponta | `nao_vai` |
| `carregar_tudo` | Pilha acima da borda, quique baixo e pesado | — |
| `murchar` | Achata (`sy` 0,85), braços caem, olhos para baixo | `grave` |
| `tremer` | Vibração curta, olhos arregalados | `comedia` |
| `suspenso` | Fica imóvel com olhar fixo, só respirando | `suspensa` (gancho) |

## 7. Câmera e linguagem de plano

- **Planos:** geral (apresenta o lugar, 2 a 3 s), médio (diálogo, o padrão), close (reação e gancho), detalhe (o sachê no chão, o bolso do Licuri).
- **Movimentos permitidos:** pan pela panorâmica do cenário, zoom lento (*push-in*) em momentos de tensão, tremida curta em impacto, e o "chicote" (pan rápido com borrão) para virar de um lado da praça ao outro.
- **Paralaxe:** `fundo` a 0,3×, `meio` a 0,7×, `frente` a 1× da câmera.
- **Corte no olhar:** quem olha para fora do quadro "chama" o próximo plano.
- **Gancho final:** sempre um *push-in* lento em close + trompete + cartela "continua...".
- **Regra dos 15 s** (bíblia): uma piada visual a cada 15 s, no máximo. Marque no animatic.

## 8. Do roteiro ao animatic

1. **Roteiro** (`../cap0X-*.json`) com cenas, falas, ação e som.
2. **Storyboard:** 1 quadro por plano, em esboço. Pode ser gerado com IA, porque é descartável.
3. **Animatic:** o storyboard cronometrado com as vozes TTS. É aqui que o ritmo é aprovado, antes de qualquer arte final.
4. **Layout:** posição de câmera e personagens em cada plano, com os cenários finais.
5. **Animação** no motor.
6. **Folha de contato** → aprovação → render final.
