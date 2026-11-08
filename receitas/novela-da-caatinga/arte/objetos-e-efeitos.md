# Objetos, frutas de cena e efeitos

> Mesma regra-mãe (`ARTE.md`). Prop é personagem sem rosto: tem rampa, volume e luz de cima. Efeito é a única área onde gradiente, transparência e brilho são permitidos, e cada um tem uma regra própria.

## Frutas e ingredientes de cena (sem rosto)

Ficam nas bancas, no Cesto e na multidão. São desenhados **no mesmo nível do tomate e da laranja do Cesto**, que são a referência exata.

| Item | Onde | Nota |
|---|---|---|
| Tomate, laranja, folhas | Cesto, bancas | **Já existem** no `mascote.svg`: reaproveitar as formas |
| Kit de 11 frutas individuais do Cesto (`frutas.svg`) | Interior do Cesto (`cesto.ts`) e bancas | Extraídas de `arturo.ai` em peças separadas (`laranja`, `tomate-grande`, `tomate-1`, `tomate-2`, `banana-1`, `banana-2`, `morango-1`, `morango-2`, `folhas-3`, `folha-1`, `folha-2`) com pesos graduados (`0.05` a `1.0`) para animação em onda |
| Umbus soltos, em cacho de banca | Banca do Umbu | Mesma rampa do personagem |
| Cachos de licuri | Ambiente, cap. 2 e 16 | Cacho pendurado da palmeira |
| Mandioca descascada, farinha, beiju, tapioca | Casa de farinha | Arco 3 |
| Caju e castanha soltos | Lanchonete | |
| Feijão, milho, abóbora, pimenta, coentro | Bancas | Variedade de feira; banco genérico |
| Mel em pote | Cap. 7 | |
| Cocada de licuri | Cap. 16 | Prop-herói da temporada |

**Multidão:** fregueses da feira são frutas e legumes **genéricos, sem fala**, desenhados num nível de detalhe menor (plano geral). Um banco de 8 a 10 "figurantes" com cores trocáveis resolve a temporada.

## Props por personagem
Listados em cada ficha (`personagens/*.md`, seção "Figurino e acessórios"). Todo prop é entregue em uma camada própria e com **ponto de pega** (onde a mão segura) marcado.

## Props do mundo do vilão
Sachês (amostra, pilha, chuva de sachês), prateleiras, néon, capa de chuva de plástico, spray de brilho, etiquetas. Regras: plástico chapado, saturado, reflexo branco duro em faixa diagonal, zero textura, **nenhuma marca real**.

## Efeitos

| Efeito | Como | Regra |
|---|---|---|
| Poeira (seca, estrada, pouso do Cesto) | Formas de nuvem em `chao_terra.luz` e `meio`, opacidade 40–80%, que crescem e somem | Sempre com a cor do chão local |
| Rachadura do açude | Desenho no cenário + animação de "abrir" | Cor `chao_terra.profunda` |
| Néon do Mercadinho | Forma + brilho (gradiente radial, modo tela) + piscada irregular | Único "glow" do lado do vilão |
| Brilho de sachê e spray | Estrelas de 4 pontas brancas + reflexo que varre a superfície | Duro, rápido, artificial |
| Chuva (cap. 5) | Traços diagonais em `agua_acude.luz`, 2 camadas de paralaxe, respingo no chão | Primeira chuva é lenta e grossa |
| Flor do mandacaru abrindo | Sequência de 3 poses + partículas de pólen dourado | "Plim" de som |
| Fumaça da casa de farinha | Volutas em `flor_mandacaru.meio`, sobem devagar | Quente |
| Brilho de pólen da Jataí | Pontinhos dourados que ficam no rastro do voo | Mágico, mas discreto |
| Gotas de suor, sustos, "!" | Props de expressão em `tinta.escuro` | Sem contorno |
| Granulado de papel | Textura sobre o **quadro inteiro**, a 4–6% | Nunca por personagem |
| Xilogravura (cap. 4) | Filtro de gravura + papel; preto e branco | Exceção de estilo (ARTE.md §9) |
| Fundo de raios de xilogravura + confetes (`fundoRaios`, `mangaio-danca`) | 16 cunhas radiais girando em 2 tons que invertem paleta a cada 4 batidas (laranja/mostarda ↔ verde-folha) + chuva de confetes retangulares girando | Usado em cortes de close/ação musical e momentos de euforia do Cesto |

## Lettering da série
Logo "Novela da Caatinga", cartela "continua...", legendas, placas e lettering de cenário: **tudo à mão** (fonte da série: Caveat Brush, em `../fontes/`), na cor `tinta.escuro`, nunca preto. Placas de cenário têm o lettering levemente torto, como pintado por quem é da feira. O Mercadinho é a exceção: tipografia "de computador", sem serifa e perfeita.
