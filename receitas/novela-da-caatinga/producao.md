# Novela da Caatinga · notas de produção

Como a bíblia ([`biblia.md`](biblia.md)) vira vídeo no motor. A bíblia decide **o quê**; este arquivo decide **como**, e onde fica cada escolha entre IA, procedural e banco.

## 1. O Cesto é o mascote do Mangaio

O Cesto **é o `mascote.svg`** do site, que já vira marionete no canvas (`app/src/mangaio/marionete.ts`, `aventura.ts`). Ele não fala; atua com um **repertório fixo de movimentos**, e cada roteiro escreve com esse repertório, como um ator com marcas de palco.

| Movimento (`id`) | Existe? | Na bíblia |
|---|---|---|
| `quicar` / `pulo` | ✅ pulo balístico com mola | "O Cesto vem quicando pela estrada" (cap. 4) |
| `pulo_duplo` (com pirueta) | ✅ | Vitórias da comunidade |
| `pegar` (fruta cai no cesto, plim) | ✅ | Carregar a feira, recolher a palha (cap. 2) |
| `danca` | ✅ | Festa (arco 4) |
| `piscar`, `olhar` | ✅ | "O Cesto viu" (cap. 1), olhar o néon |
| `apontar` | novo: um braço gira e estica (`braco` já é pose) | "aponta para os pés do Umbu" (cap. 4) |
| `carregar_tudo` | novo: frutas empilhadas acima da borda, andar mais pesado | Mutirão (cap. 4), entregador (cap. 12) |
| `murchar` | novo: `sy` 0,85, boca "o", alças caem | Tristeza, ausência do Licuri (arco 4) |

**Regra:** no máximo **um movimento novo por capítulo**. O movimento vai para o banco e fica disponível para os seguintes.

## 2. Um rosto para todo o elenco

São dez personagens, e desenhar dez marionetes completas é o maior custo da série. A saída é um **rig de rosto único**, reaproveitado sobre **corpos diferentes**:

- **Rosto (procedural, compartilhado):** olhos, sobrancelhas e boca, com o mesmo sistema de olho e boca da marionete. Um vocabulário fixo de expressões (abaixo).
- **Corpo (SVG desenhado, um por personagem):** mandioca com lenço, umbu redondo, licuri pequeno de casca dura, mandacaru alto, sachê, saco plástico. Corpos simples, no traço da série, sem braços articulados. Os gestos saem de squash e stretch, como no Cesto.
- **Acessórios:** óculos do Licuri, colher da Dona Mandioca, mala do Umbu, flor do Mandacaru. Itens soltos no banco.

Expressões (`expressao`): `neutra`, `sorriso`, `sorriso_propaganda`, `ironica`, `sobrancelha_levantada`, `olhos_semicerrados`, `olhos_arregalados`, `encantado`, `empolgado`, `triste`, `brava`.
Lábios: a boca segue o envelope da voz de cada fala, alternando aberta, meia e fechada. É procedural, sem IA.

## 3. Vozes: uma fala, uma geração

- O Gemini TTS faz **no máximo dois falantes por chamada**, e o capítulo tem até seis. Por isso cada fala vira **uma geração com uma voz só**: ficha do personagem + `direcao_voz` da batida.
- **Cache por fala** (texto + direção + voz). Mudar uma fala regera só aquela fala, e falas repetidas, como bordões, vinheta e "No capítulo anterior", vêm do banco.
- **Elenco de vozes do Gemini (candidatos, a ouvir no lab):**

  | Personagem | Voz candidata |
  |---|---|
  | Dona Mandioca | Gacrux (madura) |
  | Jataí | Leda ou Laomedeia |
  | Umbu | Algieba (macia) |
  | Mandacaru | Algenib (rouca) |
  | Licuri | Puck |
  | Seu Caju | Fenrir |
  | Realçador | Sadachbia ou Pulcherrima |
  | Maxixe | Autonoe |
  | Quiabo | Umbriel ou Zubenelgenubi |

- **Maior risco: o sotaque do semiárido baiano.** O TTS pode soar genérico ou, pior, caricato, e a bíblia proíbe humilhar quem fala "errado". O sotaque é pedido na direção e decidido no ouvido. Se não convencer, a bíblia já prevê vozes reais da região; dá para começar por uma ou duas personagens.
- **O Cesto:** trompete gravado por você. São seis frases, que entram no banco **como gravação própria** e nunca passam por IA. Ids: `trompete_cesto_desconfianca`, `_nao_vai`, `_comedia`, `_grave`, `_suspensa`, `_esperanca`.

## 4. IA, procedural ou banco: cada peça da série

| Peça | Como | Por quê |
|---|---|---|
| Falas do elenco | IA (Gemini TTS), cache por fala | O texto muda sempre |
| Trompete do Cesto, vinheta, trilha em xote e baião | **Feito à mão**, banco próprio | É a identidade da série e do Mangaio |
| Corpos dos personagens, lugares | SVG desenhado uma vez, banco | Consistência; a IA de imagem pode servir de esboço |
| Rosto, lábios, movimentos, câmera | Procedural | Determinístico e barato |
| Poeira, néon, brilho do sachê, chuva, nível do açude | Procedural (shader ou filtro SVG) | Efeitos de natureza sintética |
| Foley: plof, vento, fila, panelas | Banco livre (CC0) primeiro, IA só no que faltar | Comum e abundante |
| Jingle do Mercadinho | Feito à mão ou procedural, de propósito brega | Não pode lembrar nenhum jingle real |
| Inserto em xilogravura (cap. 4) | Procedural: filtro de gravura sobre SVG | Vira um estilo reutilizável |

## 5. Ficha de fatos do arco 1

| Cap. | Fato | Grau |
|---|---|---|
| 3 | A piada da lista de ingredientes: nenhum dado real, nenhuma marca | ✅ ficção |
| 4 | Raízes do umbuzeiro com batatas que guardam água (xilopódios) | ✅ Embrapa Semiárido |
| 4–5 | Flor de mandacaru "prevê chuva" | ✅ tratado como saber popular, como manda a bíblia |
| 2, 6, 7 | A jataí **ocorre** na Caatinga baiana (UESB), mas é generalista. As abelhas-símbolo são a mandaçaia e a jandaíra (ver bíblia, "Fatos conferidos"). Pode continuar Jataí. | ✅ com ressalva |
| 6 | Perfume ou spray afastando abelhas: tratar como ficção, sem afirmar mecanismo | ⚠️ |

## 6. Ordem sugerida

1. **Lab V1: rig do elenco.** Rosto compartilhado + dois corpos (Dona Mandioca e Realçador), com expressões e lábios por envelope. É a pergunta mais cara da série.
2. **Lab A3: elenco de vozes.** As falas do cap. 1 com as vozes candidatas e o sotaque na direção. Seu ouvido escolhe. Junto vão os efeitos (banco livre × IA) e o primeiro catálogo do banco.
3. **Trompete:** você grava as seis frases. Enquanto não grava, uso um marcador sintetizado.
4. **Cap. 1 completo**, a partir de `cap01-inauguracao.json`.
