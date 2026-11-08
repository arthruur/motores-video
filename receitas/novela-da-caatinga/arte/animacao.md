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

Os personagens são **2D** e atuam **de frente** quase o tempo todo; andar é deslizar de lado com a vista de frente (o pé sobe e assenta no lugar), como no 2D clássico. Cada um tem um conjunto pequeno de **desenhos-chave** (frente, 3/4, perfil, costas; espelhar dá o outro lado), cada um com o rig de peças (olhos, boca, braços…). **Virar é trocar de desenho**, segurando cada um alguns quadros, como na animação 2D tradicional; nada de giro contínuo de 15 em 15° por projeção 3D. O rig "360" da Dona Mandioca foi testado e atrapalhou: rosto e acessórios deformavam nas vistas intermediárias. Nas vistas que existem, o **rosto é rígido**: é o rosto de frente, que só desliza e achata como um bloco (no perfil, o olho de trás some).

### 2c. Pulo e giro permanecendo em 2D (pirueta de recorte 2D vs. turnaround 3D) {#giro-2d}

Nos vídeos de referência [`saida/mangaio-loop.mp4`](../../../saida/mangaio-loop.mp4) ([`app/src/mangaio/aventura.ts`](../../../app/src/mangaio/aventura.ts)) e [`saida/mangaio-danca.mp4`](../../../saida/mangaio-danca.mp4) ([`app/src/mangaio/danca.ts`](../../../app/src/mangaio/danca.ts)), quando o Mangaio pula e gira no ar (`pulo_duplo`, `rodopio` e `arretado`), ele **não troca para vistas 3/4, perfil ou costas**: ele **permanece 100% na vista 2D de frente (`mascote.svg`)** e gira **como se fosse um recorte 2D plano girando no próprio eixo vertical** (*paper-cutout spin*):

$$\text{fase} = \text{suave}\!\left(\frac{b - b_{\text{ini}}}{D}\right), \qquad s_x = \frac{\cos(2\pi \cdot \text{voltas} \cdot \text{fase})}{s}, \qquad s_y = s$$

- **Como funciona visualmente:** enquanto o cesto sobe na parábola balística, a escala horizontal `sx` segue o cosseno de $+1 \to 0 \to -1 \to 0 \to +1$ (para 1 volta, ou duas vezes para `voltas = 2`), dividida por `s` para compensar o stretch vertical (`sy = s`). Em $90^\circ$ o desenho 2D afina até uma lâmina (`sx = 0`); entre $90^\circ$ e $270^\circ$ ele aparece **espelhado horizontalmente** (`sx < 0`, permanecendo um desenho 2D plano visto pelo verso do recorte, sem tentar simular costas 3D); e em $360^\circ$ reabre para `+1` cravado no pouso.
- **Por que funciona melhor que um giro 3D:** combinado com (1) agachamento de antecipação (`AGACHA = 0.4` batida, `sy * 0.80, sx * 1.18`), (2) arco balístico no ar com inclinação pela velocidade vertical (`r = clamp(-vy * vel * 3.5, -18°, 18°)`), (3) braços levantados (`-55°..-70°`), (4) onda das 11 frutas descolando no ápice (`cesto.ts`) e (5) squash elástico no pouso (`amortece`), o olho lê um rodopio de desenho animado cheio de energia sem nunca quebrar a estética 2D plana da marca.

### 2d. Rig interno das 11 frutas e braços independentes do Mangaio (`frutas.svg` / `cesto.ts` / `marionete.ts`) {#rig-frutas-cesto}

Nos vídeos [`saida/mangaio-danca.mp4`](../../../saida/mangaio-danca.mp4) e [`saida/mangaio-loop.mp4`](../../../saida/mangaio-loop.mp4), o rig do Mangaio traz dois recursos essenciais para incorporar na demo (`receitas/novela-da-caatinga/demos/mangaio/cena.js`) e nos episódios:

1. **Braços independentes (`braco` e `bracoDir`):** cada braço possui seu próprio canal de ângulo em graus (pivô no ombro: esquerdo em `[178, 430]`, direito em `[412, 430]` no `viewBox 0 0 600 845`), permitindo socos alternados, um braço chamando o giro enquanto o outro equilibra, ou ambos abanando no close.
2. **Monte de 11 frutas individualizadas ([`app/src/mangaio/frutas.svg`](../../../app/src/mangaio/frutas.svg) + [`app/src/mangaio/cesto.ts`](../../../app/src/mangaio/cesto.ts)):** em vez de mover `#frutas` como um único bloco rígido (ou 4 subgrupos com atraso linear simples), as **11 peças vetoriais** extraídas de `arturo.ai` por [`ferramentas/mangaio/extrair_frutas.py`](../../../ferramentas/mangaio/extrair_frutas.py) ficam posicionadas atrás da borda frontal da boca do cesto (`y ≈ 330..380`, recortadas na base `y = 375`), cada uma com sua caixa `(cx, cy)`, pivô na base (`[0.5, 0.9]`) e **peso relativo (`peso`)**:

| `id` da peça (`frutas.svg`) | Papel na pilha | Caixa `(x, y, w, h)` no `mascote.svg` | `peso` (`0..1`) | Comportamento físico |
|---|---|---|---|---|
| `folhas-3`, `folha-1`, `folha-2` | Folhagem leve de topo/fundo | Topo esquerdo e centro | `0.05` – `0.08` | Mais leves da pilha: saltam mais alto (`escalaPeso ≈ 1.22`), inclinam mais na onda |
| `morango-1`, `morango-2` | Frutas miúdas de preenchimento | Topo/meio-esquerda e meio-direita | `0.25` – `0.30` | Quique vivo e rápido, preenchem as frestas entre as frutas grandes |
| `banana-1`, `banana-2` | Pencas alongadas na esquerda | Lado esquerdo (`x ≈ 178..274`) | `0.40` – `0.45` | Balanço médio, dão leitura clara da inclinação da onda |
| `tomate-1`, `tomate-2`, `tomate-grande` | Tomates de corpo médio/pesado | Centro-esquerda e direita | `0.55` – `0.85` | Inércia alta; comprimem visivelmente na base ao pousar |
| `laranja` | Fruta âncora mais pesada | Centro-direita (`x ≈ 286..394`) | `1.00` | Menor amplitude vertical (`escalaPeso = 0.75`), ancora o centro de massa |
| `fruta-extra-0..3` | Frutas colhidas em cena (`aventura.ts`) | Brotam com pivô `[0.5, 1.0]` | — | Entram com mola de degrau `pop(τ, k=420, c=14)` ao aparar umbus |

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

### 5.1. Física em forma fechada, onda das frutas e pulo balístico (`mangaio-loop` e `mangaio-danca`) {#fisica-cesto}

Para manter o contrato determinístico (`window.seek(t)` 100% puro em função de `t`) com física orgânica de desenho animado, o motor do Mangaio ([`app/src/mangaio/aventura.ts`](../../../app/src/mangaio/aventura.ts), [`danca.ts`](../../../app/src/mangaio/danca.ts) e [`cesto.ts`](../../../app/src/mangaio/cesto.ts)) combina duas técnicas complementares:

1. **Física do monte de frutas + onda de *follow-through* (`cesto.ts` + `frutas.svg`):**
   - **Referencial acelerado do Cesto:** o monte de frutas sente a aceleração $(a_x, a_y)$ e a inclinação $r$ do cesto como força inercial aparente: $g_x = -a_x$, $g_y = -G_{\text{fruta}} - a_y$ (rotacionados por $-r$).
   - **Gravidade de desenho animado maior nas frutas (`G_FRUTA = 14` vs `~9` do cesto):** faz as frutas atingirem o ápice e começarem a cair um pouco antes do cesto pousar, gerando descolamento claro no topo do salto e impacto atrasado na chegada.
   - **Cama elástica unilateral (`wCama = 22`, `zCama = 0.45`):** o fundo do cesto empurra as frutas para cima quando `v < 0` (comprimidas), mas **nunca puxa para baixo** quando `v > 0`, permitindo que as frutas descolem em voo livre nos pulos fortes, contidas pelas paredes laterais (`wLado = 7`, `zLado = 0.55`) e mola de giro (`wGiro = 8`, `zGiro = 0.5`).
   - **Propagação em onda da esquerda para a direita (`ONDA`):** cada fruta amostra a trajetória do monte no instante atrasado $t - \Delta t_i$, onde $\Delta t_i = 0{,}20\,\text{s} \cdot \frac{cx_i - X_{\min}}{X_{\max} - X_{\min}}$. Isso cria uma **onda viajante** pela boca do cesto:
     - **Inclinação na crista da onda:** cada peça gira proporcionalmente à derivada espacial da onda (`rot = rot_monte * 0.6 - dv * 1.2`).
     - **Escala por peso:** peças leves saltam mais e pesadas menos (`escalaPeso = 1.25 - 0.5 * peso`: folhas `~1.22×`, laranja `0.75×`).
     - **Aperto no fundo (`aperto`):** quando `v < 0`, cada fruta sofre squash horizontal/vertical (`sx = 1 + aperto`, `sy = 1 - aperto * 0.8`) em torno da própria base (`[0.5, 0.9]`).
   - **Pré-simulação periódica determinística:** o sistema integra 3 voltas completas do loop a `960 Hz` (`VOLTAS = 3`) para eliminar o transiente inicial e grava a 3ª volta a `240 Hz` com emenda exata (`quadro[N] = quadro[0]`), mantendo `seek(t)` uma consulta `O(1)` pura e sem costura.
2. **Molas amortecidas em forma fechada (`aventura.ts` / `danca.ts`):**
   - **Oscilação amortecida de impacto (`amortece`):**
     $$\text{amortece}(\tau, a, k, c) = a \cdot e^{-\frac{c\tau}{2}} \cos\!\left(\sqrt{k - \frac{c^2}{4}}\,\tau\right)$$
     Usada no squash & stretch de pouso (`amasso = amortece(dt, vPouso * 0.08, 180, 11)` aplicando `sy *= 1 - amasso` e `sx *= 1 + amasso`), no *follow-through* da alça (`alca = amortece(dt, -vPouso * 1.8, 140, 8)`), no engolir fruta (`k = 240, c = 14`) e no zoom-soco da câmera (`k = 220, c = 12`).
   - **Resposta ao degrau para brotar elementos (`pop`):**
     $$\text{pop}(\tau, k=420, c=14) = 1 - e^{-\frac{c\tau}{2}}\left(\cos(\omega\tau) + \frac{c}{2\omega}\sin(\omega\tau)\right)$$
     Usada quando uma fruta nova cai dentro do Cesto e brota da base (`pivô [0.5, 1.0]`) com overshoot elástico.
3. **Pulo balístico, pulo duplo e pirueta 2D:**
   - Dado o tempo de voo $D$ (em batidas) e a altura $h$ (em cestos), a parábola é cravada na música por $g = \frac{8h}{D^2}$ e $v_0 = \frac{4h}{D}$, com inclinação no ar proporcional à velocidade vertical (`r = clamp(-vy * vel * 3.5, -18°, 18°)`).
   - No **pulo duplo (`pulo_duplo`)**, o segundo impulso corta o primeiro em `corta = 0.6` da duração e dispara a **pirueta 2D** no ar modulando a escala horizontal por cosseno (`sx = Math.cos(2π * voltas * suave(fase)) / s`, ver §2c).
4. **Piscada assimétrica e olho em arco feliz (`◡`):**
   - A piscada dura `0.28 s`, fechando rápido (`35%` do tempo) e abrindo com calma (`65%`). Quando a abertura cai abaixo de `0.45` (ou em batidas pares de alegria na dança), o olho oval dá lugar ao arco curvo `◡` em Bézier quadrática (`#462416`).

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

### 6.1. Vocabulário expandido de Dança (`mangaio-danca`) e Aventura (`mangaio-loop`) {#vocabulario-danca-e-loop}

Os vídeos [`saida/mangaio-danca.mp4`](../../../saida/mangaio-danca.mp4) ([`app/src/mangaio/danca.ts`](../../../app/src/mangaio/danca.ts)) e [`saida/mangaio-loop.mp4`](../../../saida/mangaio-loop.mp4) ([`app/src/mangaio/aventura.ts`](../../../app/src/mangaio/aventura.ts)) estabelecem os blocos coreográficos canônicos do Mangaio a **116 BPM** (compasso 4/4 de baião/xote, ciclos de 32 batidas = `16,55 s`, com mistura suave de `TROCA = 0.5` batida nas transições e no fechamento do loop):

| Sub-movimento (`id`) | Origem | Batidas típicas | Mecânica de atuação (`Pose` + física) |
|---|---|---|---|
| `pulinho` (passo de caminhada) | `mangaio-loop` | Contínuo (1 passo/batida) | Ciclo em 4 chaves por batida: `[0.0: dy=0, sx=1.06, sy=0.93]` → `[0.2: dy=0, sx=1.10, sy=0.88]` (antecipação) → `[0.5: dy=-9%, sx=0.94, sy=1.08]` (ápice no meio-tempo) → `[0.85: dy=-1%, sx=1, sy=1]`, com balanço de corpo `r = sin(2πb) * 4°` e braços a `18°` |
| `engole` (aparar fruta no ar) | `mangaio-loop` | No impacto da captura | Abre `boca = 'o'` na chegada da fruta (`dt ∈ [-0.18, 0.22] s`), aplica mola de engolir no corpo (`amortece(dt, 0.14, 240, 14)`), braços comemoram (`-35°`) e a fruta capturada brota na pilha via `pop()` |
| `soquinho` (dança — parte 1) | `mangaio-danca` | Batidas `0..8` | Quique na cabeça do tempo (`quique = |sin(πb)|`, `sy = 1 + 0.08*c2`, `sx = 1/sy`), ginga lateral a cada 2 batidas (`x = sin(πb/2) * 0.06`, `r = cos(πb/2) * 6°`) e **braços alternados dando soquinhos** na frente (`braco` e `bracoDir` em oposição de fase entre `-15°` e `+50°`) |
| `rodopio` (dança — parte 2) | `mangaio-danca` | Batidas `8..16` | Braço direito abre chamando o giro (`bracoDir = -55°`), agachamento de antecipação (`AGACHA = 0.4` batida antes do salto, `sy * 0.80`, `sx * 1.18`) e dois saltos com **pirueta 2D simples** para a esquerda (`b=9.5`, `voltas: +1`) e para a direita (`b=13.5`, `voltas: -1`, `boca: 'o'`) |
| `colado` (dança — parte 3, close) | `mangaio-danca` | Batidas `16..24` | Plano colado no rosto/boca do cesto: dengo lateral com `suave()` a cada 2 batidas (`x = ±0.08`, inclinação `r = ∓9°`), **braços abertos abanando** (`braco` e `bracoDir` em `-45° ± 30°`) e **olhos fechados em arco feliz (`◡`)** nas batidas pares |
| `arretado` (dança — parte 4, clímax) | `mangaio-danca` | Batidas `24..32` | Sequência de **4 pulinhos rápidos** cravados nas batidas `24, 25, 26, 27` (`dur: 0.85`, `alto: 0.25` alternando esquerda/direita com braços levantados a `-50°`) seguida de **grande salto com pirueta 2D dupla** (`b=28.5`, `dur: 2.3`, `alto: 0.85`, `voltas: 2`, braços a `-70°`) pousando na emenda do loop |

## 7. Câmera e linguagem de plano

- **Planos:** geral (apresenta o lugar, 2 a 3 s), médio (diálogo, o padrão), close (reação e gancho), detalhe (o sachê no chão, o bolso do Licuri).
- **Movimentos permitidos:** pan pela panorâmica do cenário, zoom lento (*push-in*) em momentos de tensão, tremida curta em impacto, e o "chicote" (pan rápido com borrão) para virar de um lado da praça ao outro.
- **Paralaxe:** `fundo` a 0,3×, `meio` a 0,7×, `frente` a 1× da câmera.
- **Corte no olhar:** quem olha para fora do quadro "chama" o próximo plano.
- **Gancho final:** sempre um *push-in* lento em close + trompete + cartela "continua...".
- **Regra dos 15 s** (bíblia): uma piada visual a cada 15 s, no máximo. Marque no animatic.
- **Cortes secos na batida e alternância de fundo (`feira` × `raios`, estilo *edit* de `mangaio-danca`):**
  - Em momentos musicais, festas (arco 4), vinhetas ou vídeos de retenção (`mangaio-danca`, `demo-mangaio`), a câmera **corta seco na cabeça do compasso** (`PLANOS`) alternando:
    1. **Palco `feira` (planos geral e médio, `zoom ≈ 1.0..1.45`):** chão de tábuas de palco em perspectiva convergindo ao horizonte, barraca de feira listrada, dois cordões de **bandeirinhas em catenária** balançando no vento e sol pulsante na batida com **raios de xilogravura** girando devagar ao fundo.
    2. **Fundo gráfico `raios` (planos médios e closes de impacto/charme, `zoom ≈ 1.35..1.85`):** fundo de ação em xilogravura com **16 cunhas radiais girando** que invertem a paleta a cada 4 batidas (laranja/mostarda `#E8621A / #F4A623` ↔ verde-folha `#2E8B3C / #49A842`) + chuva de **confetes coloridos** girando em queda livre.
- **Zoom-soco no pouso (`soco`):** todo pouso de salto do Cesto aplica um impulso elástico adicional no zoom da câmera proporcional à velocidade de chegada (`soco = amortece(dt, vPouso * 0.014, 220, 12)`), fazendo o quadro inteiro "sentir o peso" do cesto junto com a sombra no chão.
- **Íris de desenho animado (`iris`) e loops de 32 batidas sem costura (`mangaio-loop`):**
  - Abertura (`b = 0..1.5`) e fechamento (`b = 30..32`) com máscara circular centrada diretamente na barriga do Cesto (`#462416` / `#2A1608`), permitindo que vídeos curtos e cenas de transição fechem em loop infinito perfeito a 116 BPM.

## 8. Do roteiro ao animatic

1. **Roteiro** (`../cap0X-*.json`) com cenas, falas, ação e som.
2. **Storyboard:** 1 quadro por plano, em esboço. Pode ser gerado com IA, porque é descartável.
3. **Animatic:** o storyboard cronometrado com as vozes TTS. É aqui que o ritmo é aprovado, antes de qualquer arte final.
4. **Layout:** posição de câmera e personagens em cada plano, com os cenários finais.
5. **Animação** no motor.
6. **Folha de contato** → aprovação → render final.

## 9. Processo de construção de `mangaio-loop.mp4` e `mangaio-danca.mp4` {#processo-mangaio-loop-danca}

Os dois vídeos de referência em `saida/` foram produzidos por um pipeline Canvas 2D + SVG determinístico, cujos fontes estão em [`app/src/mangaio/`](../../../app/src/mangaio/), [`ferramentas/mangaio/`](../../../ferramentas/mangaio/) e [`cenas/`](../../../cenas/):

1. **Extração das 11 frutas individuais ([`ferramentas/mangaio/extrair_frutas.py`](../../../ferramentas/mangaio/extrair_frutas.py) → [`app/src/mangaio/frutas.svg`](../../../app/src/mangaio/frutas.svg)):**
   - Lê o vetor original `arturo.ai` via PyMuPDF (`fitz`), converte a página para SVG, filtra os caminhos da região das frutas e agrupa os caminhos das folhas e frutas nas 11 peças nomeadas (`laranja`, `tomate-grande`, `tomate-1`, `tomate-2`, `banana-1`, `banana-2`, `morango-1`, `morango-2`, `folhas-3`, `folha-1`, `folha-2`).
   - Remapeia as coordenadas para o espaço `viewBox="0 0 600 845"` do [`app/src/mangaio/mascote.svg`](../../../app/src/mangaio/mascote.svg), posicionando a pilha atrás da borda frontal da boca do cesto (`y ≈ 330..380`) e recortando o que passa de `y = 375`.
2. **Desmontagem da marionete e pré-simulação do cesto ([`app/src/mangaio/marionete.ts`](../../../app/src/mangaio/marionete.ts) + [`app/src/mangaio/cesto.ts`](../../../app/src/mangaio/cesto.ts)):**
   - `marionete.ts` separa o `mascote.svg` em camadas independentes (`alca`, `corpo`, `bracoEsq`, `bracoDir`, `rostoSemOlhosBoca`) + as 11 frutas de `frutas.svg`, rasterizadas em `HTMLImageElement` de alta resolução e desenhadas no `<canvas>` com transformações afins em torno do pivô de cada peça (`peca()`). Olhos (com piscada assimétrica e arco `◡`) e bocas (`sorriso`, `'o'`, `'fechada'`) são desenhados vetorialmente no `CanvasRenderingContext2D`.
   - `cesto.ts` recebe a função de trajetória do cesto `traj(t)` e roda uma pré-simulação determinística de **3 voltas completas do loop a `960 Hz`** (`VOLTAS = 3`), gravando a 3ª volta a `240 Hz` com emenda periódica exata (`quadro[N] = quadro[0]`). Na hora de desenhar cada fruta, consulta a tabela com atraso espacial da esquerda para a direita (`ONDA.atraso = 0.20 s`), aplicando a inclinação da crista da onda, o ganho por `peso` e o aperto no fundo.
3. **Coreografia e câmera em função pura de `t` ([`app/src/mangaio/aventura.ts`](../../../app/src/mangaio/aventura.ts) e [`app/src/mangaio/danca.ts`](../../../app/src/mangaio/danca.ts)):**
   - **`mangaio-loop.mp4` (`aventura.ts`):** loop de 32 batidas a 116 BPM (`16,55 s` por ciclo; `33,10 s` com 2 ciclos). Cenário em 5 camadas de paralaxe em loop contínuo (céu, serras, chão de terra, mandacarus e umbuzeiros), caminhada `pulinho`, `pulo_duplo` com pirueta 2D (`sx = cos(...)`) sobre o mandacaru, colheita de 4 umbus com boca `'o'` e `pop()` das frutas extras, e abertura/fechamento em íris circular.
   - **`mangaio-danca.mp4` (`danca.ts`):** loop de 32 batidas a 116 BPM com os 4 passos (`soquinho`, `rodopio` com piruetas 2D esquerda/direita, `colado` em close e `arretado` com 4 pulinhos rápidos + salto duplo de 2 voltas), cortes secos na batida (`PLANOS`) alternando o palco da `feira` e o fundo gráfico `raios` (xilogravura girando + confetes) e zoom-soco (`soco`) nos pousos.
4. **Empacotamento IIFE ([`ferramentas/mangaio/empacotar.mjs`](../../../ferramentas/mangaio/empacotar.mjs)) e páginas de cena ([`cenas/mangaio/cena.html`](../../../cenas/mangaio/cena.html), [`cenas/mangaio_danca/cena.html`](../../../cenas/mangaio_danca/cena.html)):**
   - O script `empacotar.mjs` usa o `esbuild` (com plugin `?raw` para embutir os SVGs) para gerar `mangaio_bundle.js` expondo o global `window.Mangaio`.
   - As páginas `cena.html` implementam o contrato [`motores/render/CONTRATO.md`](../../../motores/render/CONTRATO.md) (`window.DURACAO = 33.1`, `window.seek(t)` e `window.pronto = true`) e são renderizadas pelo [`motores/render/render.mjs`](../../../motores/render/render.mjs) com áudio de baião a 116 BPM (`app/src/trilhas.ts`).
