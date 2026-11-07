# Cenários · Serra Pequena

> Cenário segue `ARTE.md`: formas cheias, rampas de tom, sem contorno. A diferença é que cenário **recua**: menos contraste e menos saturação que o elenco, para o personagem sempre "saltar" do fundo.

## Regras gerais

- **Três planos, desenhados em camadas separadas** (para paralaxe no motor): `fundo` (céu, serra, sol), `meio` (construções, árvores, bancas), `frente` (chão onde se pisa, props de primeiro plano).
- **Contraste por plano:** o fundo usa 2 a 3 tons, quase sem detalhe. O meio usa a rampa inteira e textura simplificada. A frente tem detalhe completo, mas nunca mais saturação que o personagem.
- **Linha do chão** a cerca de 62% da altura do quadro 9:16, para os pés ficarem acima da faixa da legenda (ARTE.md §8).
- **Formato de entrega:** cada cenário é desenhado em **1080 × 1920 e também em panorâmica 3240 × 1920** (3 telas de largura), para a câmera passear.
- **O açude é o relógio.** Todo cenário externo tem, em algum plano, um sinal do nível da água ou da seca: rachaduras, mato seco ou verde, céu.

## Lugares

| Lugar | `id` | Plano-chave | Luz e clima | Elementos obrigatórios |
|---|---|---|---|---|
| Feira de sábado | `feira` | Corredor de bancas em perspectiva leve, praça ao fundo | `feira_dia`, quente | Toldos listrados (cada banca uma cor da paleta da feira), caixotes, balaios, bandeirinhas na festa |
| Banca da Dona Mandioca | `banca_mandioca` | Frontal, balcão na altura da cintura dela | `feira_dia` | Sacos de FARINHA, gamelas, colher |
| Banca de Maxixe e Quiabo | `banca_fofoca` | Frontal, balcão baixo (a Maxixe tem que aparecer) | `feira_dia` | Placa "FIADO SÓ AMANHÃ" |
| Pé de umbuzeiro da praça | `umbuzeiro` | Árvore larga e baixa, copa em guarda-chuva, banco de pedra | Sombra fresca: o único lugar "frio" do lado bom | Raízes aparentes |
| Casa de farinha | `casa_farinha` | Interior: forno de lenha, roda, tipiti, prensa, fumaça | Luz quente de fogo | Sacos, gamelas, fumaça |
| Oco do pau da Jataí | `oco_jatai` | Tronco oco com a entradinha de cera | Penumbra dourada | Tubo de cera na entrada (as jataís constroem um) |
| Mercadinho Sabor Já | `mercadinho` | Fachada de néon do outro lado da praça; interior de prateleiras infinitas | `mercadinho`: frio, néon, sem sombra natural | Néon "SABOR JÁ", prateleiras de sachês iguais, chão brilhante |
| Lanchonete do Seu Caju | `lanchonete` | Balcão, chapa, panelas | Quente; escurece no cap. 10 | Cardápio de giz |
| Beira do açude | `acude` | Plano aberto, água baixa e chão rachado | Quente e silencioso; noite no cap. 4 | Régua de nível, garças opcionais |
| Estrada de terra | `estrada` | Perspectiva central, horizonte baixo, poeira | Sol a pino ou fim de tarde | Mandacarus de cenário, cerca de arame |
| Alto da serra | `serra` | Mandacaru contra o céu | Fim de tarde, depois noite com flor | Céu grande |
| Cidade grande (cap. 13) | `cidade` | Prateleira de supermercado frio, geométrico | Fluorescente | Fileiras iguais, nenhum verde |

## Color script da temporada

O color script define a temperatura de cada arco. O motor aplica isso como `luz_de_cena` (ver `paleta.json`) por cima dos mesmos cenários.

| Arco | Céu | Chão | Saturação | Sensação |
|---|---|---|---|---|
| 1 · Estiagem | Amarelo-poeira, sol branco | Ocre rachado | Baixa, lavada | Calor, esvaziamento |
| 2 · Primeira chuva | Cinza-azulado → lavado | Terra molhada escura, primeiros verdes | Subindo | Alívio, susto |
| 3 · Safra | Azul limpo | Verde-caatinga, flores amarelas | Alta | Abundância, trabalho |
| 4 · Festa | Fim de tarde laranja → noite com fogueira | Bandeirinhas, luz de festa | Máxima, quente | Celebração |

E o contraponto em todos os arcos: **o Mercadinho não muda**. Fica igual, frio e néon, o ano todo. Ele não pertence ao tempo do sertão.

## Entrega de cada cenário
- [ ] Esboço de layout (posição dos personagens marcada) aprovado
- [ ] Versão em cor com a luz padrão
- [ ] Camadas separadas `fundo`, `meio`, `frente` (+ `frente_sobreposta` para o que passa na frente do personagem)
- [ ] Variantes de luz do color script
- [ ] Teste com o elenco pousado (sombra de contato e escala)
