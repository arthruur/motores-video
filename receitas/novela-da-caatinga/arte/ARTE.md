# Guia de estilo · Novela da Caatinga

> Tudo aqui deriva do Cesto (`../mascote.svg`), o mascote do Mangaio. Ele é a âncora: o resto da série se ajusta a ele, nunca o contrário.

## 1. A regra-mãe

**Ilustração vetorial em formas cheias, sem contorno, com volume construído por camadas de tom.**

O que isso quer dizer, medido no `mascote.svg`:
- **Zero contornos.** O Cesto tem 94 formas e nenhum `stroke`. A borda de cada forma é a mudança de cor.
- **Zero gradientes.** O volume vem de **formas sobrepostas em tons de uma mesma rampa**: luz, base, meio-tom, sombra e sombra profunda. É *cel shading* em vetor.
- **O escuro é marrom, nunca preto.** O tom mais escuro do rosto é `#462416`. Preto puro (`#000`) e cinza neutro não existem na série.
- **Formas orgânicas, desenhadas à mão.** As curvas têm leve irregularidade, como se viessem de um pincel. Nada de círculo perfeito, retângulo de régua ou simetria espelhada exata.
- **Textura vem do desenho, não de filtro.** A palha do Cesto é trançado desenhado, faixa por faixa. Granulado de papel pode entrar na pós da cena inteira, nunca no personagem.

**Teste de 1 segundo.** Ponha o asset novo ao lado do Cesto. Se alguém disser "é do mesmo desenhista", passou.

## 2. Forma e silhueta

- **Cada personagem é o próprio ingrediente.** A anatomia da fruta ou planta tem que ser reconhecível: o miolo branco da mandioca, as quinas do quiabo, a castanha embaixo do caju. Quem conhece a feira tem que reconhecer na hora.
- **Linguagem de forma conta caráter:**

  | Forma dominante | Lê-se como | Quem |
  |---|---|---|
  | Círculo, oval, gota | Acolhedor, confiável | Cesto, Umbu, Licuri, Jataí, Maxixe |
  | Retângulo, base larga | Firme, estável, mandão | Dona Mandioca, Seu Caju |
  | Coluna alta, verticais | Velho, sábio, resistente | Mandacaru, Quiabo |
  | Triângulo, serrilha, quina dura | Artificial, perigoso | Realçador, Seu Sacolão |

- **Silhueta legível em preto.** Cada personagem precisa ser reconhecido só pela silhueta, no tamanho de um celular. Toda aprovação começa pelo lineup de silhuetas.
- **Peso para baixo.** Todos têm base no chão (exceto Jataí, que voa). Squash and stretch acontece em volta dos pés.
- **Membros.** Como os do Cesto: **curtos, grossos e arredondados, em forma de patinha (luva sem dedos)**, na rampa do próprio corpo, com a borda em `sombra`. Nada de braço de palito. Pernas (quem anda) seguem a mesma lógica: tocos curtos e redondos. Exceções em ficha: Realçador e Sacolão (plástico dobrado), Jataí (patas de inseto estilizadas).

## 3. Proporção: tudo medido em "cestos"

O Cesto vale **1,0** (altura do fundo até a borda, sem alça e sem frutas). A tabela é proposta e será validada no lineup de silhuetas.

| Personagem | Altura | Largura | Nota |
|---|---|---|---|
| Cesto | 1,0 | 1,15 | Âncora |
| Dona Mandioca | 1,35 | 0,6 | A mais alta da feira, depois do Mandacaru |
| Umbu | 0,75 | 0,75 | Redondo, quase esfera |
| Licuri | 0,55 | 0,4 | Pequeno, o "caçula" |
| Mandacaru | 2,2 | 0,9 com braços | Cenário e personagem ao mesmo tempo |
| Seu Caju | 0,95 | 0,7 | Pera de cabeça para baixo + castanha |
| Realçador | 1,1 | 0,8 | Um sachê grande demais para um sachê |
| Seu Sacolão | 1,6 | 1,2 | Inflado; murcha ao longo do arco 2 |
| Maxixe | 0,55 | 0,45 | Baixinha |
| Quiabo | 1,15 | 0,3 | Comprido, contraste com Maxixe |
| Jataí | 0,2 | 0,3 com asas | Voa à altura dos olhos de quem fala com ela |

**Tamanho do rosto.** Olhos e boca têm **o mesmo tamanho absoluto em todos**, igual ao rosto do Cesto. Personagem pequeno fica com "rosto grande" (fofo), grande fica com "rosto pequeno" (imponente). Isso unifica o elenco e permite um rig de rosto só.

## 4. Cor

As cores com código ficam em [`paleta.json`](paleta.json). As regras:

- **Rampa de 5 tons por material:** `luz`, `base`, `meio`, `sombra`, `profunda`. Toda forma usa só tons da rampa do seu material. Exemplo, a palha do Cesto: `#F5B058` → `#E99C46` → `#D27C32` → `#C06726` → `#AF561E`.
- **Sombra esquenta, não acinzenta.** A sombra puxa para o vermelho e o marrom, como no Cesto. Nunca escureça misturando cinza ou preto.
- **Dois mundos de cor:**
  - **Feira (o lado certo):** terra, palha, ocre, verde-caatinga, amarelo de flor, vermelho de tomate. Saturação média, tudo quente.
  - **Mercadinho Sabor Já (o vilão):** azul elétrico, rosa-choque, roxo, branco de néon. Saturação alta, tudo frio, com **brilho especular duro** (reflexo de plástico), algo que só o mundo do vilão tem.
- **Personagens do vilão invadem a feira com cor fria.** O Realçador numa cena de feira é a única mancha fria do quadro. É assim que o público lê o perigo sem fala.
- **O Licuri muda de cor com o arco.** Quando se "reembala", ganha brilho especular e sua rampa esfria. Quando volta, perde o brilho. As duas rampas estão na paleta.

## 5. Luz

- **Luz principal de cima**, levemente da esquerda, quente (sol do sertão). A banda de `luz` fica no topo de cada volume, e `sombra` e `profunda` ficam embaixo e no lado oposto. *Confirmar a direção exata no `mascote.svg` antes do primeiro model sheet.*
- **Sombra de contato** (elipse achatada, tom `profunda` do chão a 40%) debaixo de todo personagem pousado. É o que impede o personagem de "flutuar" no cenário.
- **Cada lugar tem uma chave de luz** (ver [`cenarios.md`](cenarios.md)). O personagem não muda de desenho entre lugares: muda a **rampa de luz** aplicada a ele (variante de cor). Ex.: no Mercadinho, todo mundo ganha um *rim light* rosa ou azul.

## 6. Rosto

Um rosto só para todo o elenco, **o rosto do Cesto** (ver `referencias/cesto-frente.png`):
- **Olhos: dois ovais verticais cheios em `#462416`.** Sem branco do olho, sem pupila separada e sem brilho. É o rosto "kawaii" da marca, e ele é o maior fator de unidade do elenco.
- **Boca: forma cheia em `#462416` com interior `#C5441E`.** Larga e aberta no sorriso, como a do Cesto.
- **Sem nariz e sem sobrancelha por padrão.** A expressão sai da **forma do olho** (oval, arco `^ ^`, meia-lua, linha fechada, oval grande) e da boca.
- **Sobrancelha só quando a expressão exige** (`brava`, `sobrancelha_levantada`, `triste`): uma forma curta e cheia em `#462416`, que aparece e some. *A validar no model sheet do Cesto (fase 1): se o Cesto não usar, ninguém usa como neutra.*
- **Bochecha:** opcional, uma mancha cheia um tom acima da `base`, sem contorno.
- 11 expressões fixas (lista em [`animacao.md`](animacao.md#expressoes)). Expressão nova só entra aprovada e para o banco.
- **Exceções que a ficha justifica:** o Realçador tem sorriso de propaganda com dentes brancos demais; o Mandacaru tem sobrancelhas grossas de espinho; a Jataí tem olhos compostos estilizados.

## 7. Detalhe e textura

- **Níveis de detalhe:** close (rosto e textura completos), plano médio (textura simplificada), plano geral (só as formas e 3 tons). Os três níveis são desenhados no model sheet. O motor troca de nível pela escala.
- **Cada material tem sua textura desenhada:** trançado de palha (Cesto), casca rugosa em faixas (Mandioca), pintinhas e lenticelas (Umbu), veios (Licuri), espinhos moles (Maxixe), quinas com brilho (Quiabo), espinhos em tufo (Mandacaru), plástico liso com reflexo duro (Realçador, Sacolão).
- **O mundo do vilão não tem textura.** Plástico liso, cor chapada e reflexo. A falta de textura é a característica dele.

## 8. Composição para 9:16

- **Área segura:** nada importante nos 14% de cima (nome do perfil, botões) nem nos 22% de baixo (legenda e interface do Reels). Rosto de quem fala fica no terço do meio.
- **Legenda** ocupa a faixa de baixo e nunca cobre rosto.
- **Profundidade em 3 planos:** fundo (céu, serra, nível do açude), meio (bancas, cenário), frente (personagens e props). Desfoque leve só no fundo.
- **No máximo 3 personagens com rosto legível por quadro.** Multidão é silhueta ou plano geral.

## 9. Exceções de estilo (planejadas)

| Onde | Estilo | Por quê |
|---|---|---|
| Inserto do cap. 4 (raízes do umbuzeiro) | Xilogravura de cordel: preto e branco, talho de goiva | Mostrar o "saber da terra" com a linguagem da terra |
| Mercadinho Sabor Já | Mesma construção, mas plástico: chapado, saturado, reflexo duro | O contraste é a dramaturgia |
| Cap. 13 (Licuri na cidade grande) | Cenário frio e geométrico, de prateleira | O Licuri fora do mundo dele |

## 10. Nunca

- Contorno preto ou de qualquer cor em personagem, cenário ou prop. Exceção: a xilogravura.
- Gradiente como volume. Gradiente só em luz de cena (céu, brilho de néon) e efeito.
- Preto puro ou cinza neutro.
- Personagem com rosto humano realista, nariz, orelha ou cabelo humano.
- Sexualização: cintura marcada, cílios de "sedução", pose de pin-up. A bíblia proíbe, e a "novela das frutas" é exatamente o que a série não é.
- Marca real, logotipo real, embalagem que lembre produto existente.
- Asset gerado por IA que entra no motor **sem** passar pelo Illustrator e pelo portão de aprovação.
