# Produção de arte · do gerador de imagem ao motor

> O pipeline de cada asset. O gerador de imagem (GPT ou outro modelo SOTA) **explora e rascunha**; o Illustrator **decide e limpa**; o motor **anima**. Nada pula etapa.

## 1. Pipeline

```
1. Briefing       → a ficha do personagem/cenário (personagens/*.md) está completa
2. Exploração     → gerador de imagem: 3–4 variações, sempre com o Cesto de referência
3. Escolha        → você escolhe uma (ou combina); registra na ficha, em "Decisões"
4. Model sheet    → gerador de imagem: turnaround e expressões a partir do design escolhido
5. Vetor          → Illustrator: redesenho/vetorização, rampas da paleta.json, sem contorno
6. Rig            → camadas nomeadas e pivôs (animacao.md §2), exportação SVG
7. Teste          → motor: lineup com o Cesto + ciclo de movimento curto
8. Portão         → aprovação → status ✅ no README e o asset vai para o banco
```

## 2. Prompts {#prompts}

Cada prompt é a soma de **blocos fixos**. Os blocos de personagem estão nas fichas; os outros ficam aqui. Escreva em inglês (os geradores respondem melhor) e **anexe sempre a imagem do Cesto** (`referencias/cesto-frente.png`) e, depois de aprovados, os model sheets já prontos.

### Bloco de estilo (sempre)
```
STYLE: professional 2D animated series character design, flat vector
illustration built ONLY from filled shapes, NO outlines and NO strokes, volume
made with 4–5 stacked flat tones of the same color (cel-shaded vector), no
gradients, warm shadows that shift toward red-brown (never grey or black),
darkest color is a deep warm brown, soft organic hand-drawn curves, top-left
warm sunlight, painted hand-drawn texture details. Match EXACTLY the style,
rendering, face design and level of detail of the attached reference
character (the woven basket). FACE: exactly like the basket: two solid
dark-brown vertical oval eyes with no eye whites and no highlights, no nose,
no eyebrows, a wide open dark-brown mouth with a red-orange inside. LIMBS:
short, thick, rounded mitten-like paws in the body's own colors, like the
basket's arms; never thin stick arms.
```

### Bloco de folha (escolha um)
```
SHEET — EXPLORATION: 4 design variations of the same character side by side,
full body, front view, plain light warm-paper background, same scale.

SHEET — TURNAROUND: character model sheet, the SAME character in 5 views in a
row: front, three-quarter, side profile, three-quarter back, back. Neutral
pose, arms relaxed, same height in all views, horizontal guide lines at top
and bottom, plain light background, no text.

SHEET — EXPRESSIONS: expression sheet, the SAME character's head and upper
body in a 4x3 grid: neutral, smile, ironic, one eyebrow raised, half-closed
eyes, wide eyes, enchanted, excited, sad, angry, + <expressões da ficha>.
Plain background, no text.

SHEET — MOUTHS: 8 mouth shapes for lip sync on the same face, in a row:
rest, M/B/P, A, E, I, O, U, F/V. Same face design as the reference.

SHEET — POSES: 4 key poses of the same character: <poses da ficha>.

SHEET — LINEUP: the full cast standing side by side on one ground line, to
scale, with the basket as the size reference: <lista e alturas>.
```

### Bloco de proibições (sempre)
```
AVOID: black outlines, line art, gradients for shading, 3D render, plastic
CGI look, realistic human features (nose, ears, hair), sexualized body shapes,
text, logos, real brands, watermark.
```
Exceção: Realçador e Sacolão **podem** ter brilho de plástico. Tire `plastic CGI look` do AVOID e descreva o reflexo no bloco do personagem.

### Bloco de cenário
```
BACKGROUND for a vertical 9:16 animated series (1080x1920): <lugar, da tabela
de cenarios.md>. Same flat-tone vector style, NO outlines, lower contrast and
lower saturation than the characters, three clear depth layers (far, middle,
foreground), ground line at about 62% of the height, empty of characters,
lighting: <chave de luz>.
```

### Dicas de consistência
- **Uma conversa por personagem** no gerador. Ele se lembra do design e varia menos.
- Depois de aprovar o design, **sempre** anexe o model sheet aprovado e peça "the same character".
- Turnaround sai melhor gerado **inteiro numa imagem** do que vista por vista.
- O gerador **não** acerta as cores exatas. As cores são corrigidas no Illustrator, com a `paleta.json`.
- Guarde **todos** os prompts e imagens em `referencias/<id>/` com data. Imagem boa sem o prompt não se repete.

## 3. Illustrator: da imagem ao vetor

1. **Prancheta:** 2000 × 2000 px por vista; o personagem em pé sobre a linha de chão, com o Cesto em camada de referência travada na escala da tabela (`ARTE.md` §3).
2. **Vetorizar:** Rastreamento de Imagem como base para as formas grandes, mas **redesenhe** rosto, mãos e silhueta à mão (o traço automático deixa nós demais e bordas tremidas). Meta: cada forma com o mínimo de nós que mantém a curva.
3. **Cores:** aplique só as cores da `paleta.json`. Faça amostras globais com os nomes da paleta (`mandioca_casca/base`), para trocar a rampa inteira de uma vez.
4. **Construção do volume:** forma `base` → `meio` → `sombra` → `profunda` → `luz` por cima, cada uma como forma cheia recortada (como no Cesto). Sem contorno, sem gradiente, sem efeitos do Illustrator (sombra projetada, desfoque).
5. **Camadas:** os nomes de camada são exatamente os `id` de `animacao.md` §2. Marque o pivô de cada grupo com um círculo de 2 px chamado `pivo`.
6. **Exportar:** *Exportar como → SVG*. Estilo: **Atributos de apresentação**. IDs de objeto: **Nomes de camada**. Decimais: 2. Fonte: converter em contornos. Desmarque "Minificar" para o arquivo continuar legível.
7. **Arquivos:** `arte/banco/<id>/<id>-<vista>.svg` (ex.: `dona-mandioca-frente.svg`), mais o `.ai` de origem em `arte/fonte/` (fora do git se ficar grande; ver abaixo).

## 4. Organização dos arquivos

```
arte/
  referencias/<id>/      ← gerações (PNG) + prompts.md com data; fotos reais do ingrediente
  folhas/                ← model sheets aprovados (PNG) e lineups
  banco/<id>/            ← SVG final, um por vista, pronto para o motor
  fonte/                 ← .ai (fora do git se ficar grande: ver .gitignore)
```
**Nomes:** minúsculas, sem acento, com hífen (`seu-caju`, `banca-mandioca`). Versões aprovadas ganham sufixo só quando substituem outra: `-v2`.

## 5. Portão de aprovação {#portao}

Um asset só ganha ✅ quando passa em tudo:

- [ ] **Teste de 1 segundo:** ao lado do Cesto, parece do mesmo desenhista
- [ ] **Silhueta:** reconhecível em preto, no tamanho de um celular
- [ ] **Escala:** bate com a tabela de proporções no lineup
- [ ] **Sem contorno, sem gradiente, sem preto** (exceto as exceções documentadas)
- [ ] **Só cores da `paleta.json`** (o agente confere os `fill` do SVG automaticamente)
- [ ] **Ingrediente reconhecível** por alguém de feira
- [ ] **Camadas com os nomes do rig** e pivôs marcados
- [ ] **Teste de movimento:** pisca, fala, respira e faz uma pose sem quebrar
- [ ] **Nenhum "nunca"** da ficha e do `ARTE.md` violado

## 6. O que o agente faz em cada etapa

| Etapa | Agente | Você |
|---|---|---|
| Briefing | Completa a ficha a partir da bíblia e da pesquisa do ingrediente | Revisa |
| Exploração | Escreve os prompts completos (blocos) | Gera no GPT e traz as imagens |
| Escolha | Compara as variações com o `ARTE.md` e recomenda | Decide |
| Model sheet | Escreve os prompts; confere a consistência entre as vistas | Gera |
| Vetor | Checa o SVG exportado: cores fora da paleta, contornos, nomes de camada, nº de nós | Desenha no Illustrator |
| Rig e teste | Liga o SVG no motor, gera lineup e teste de movimento | Aprova |
| Registro | Atualiza ficha, quadro de status e banco | — |
