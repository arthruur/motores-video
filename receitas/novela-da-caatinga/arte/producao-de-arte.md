# Produção de arte · do gerador de imagem ao VectorCraft e ao motor

> O pipeline de cada asset. A API de IA (**Gemini Image + Gemini Vision** ou GPT) **explora, gera e audita**; o **VectorCraft (`vectorcraft-cli`)** (ou Illustrator) **vetoriza, limpa, simplifica nós e aplica paleta**; o script [`pipeline.py`](pipeline.py) **automatiza o rigging SVG e os lineups**; o motor **anima**. Nada pula etapa.

## 1. Pipeline

```
1. Briefing       → a ficha do personagem/cenário (personagens/*.md) está completa
2. Exploração     → Gemini Image API (`pipeline.py gerar <id>`) ou GPT: 3–4 variações com o Cesto de referência
3. Escolha        → você escolhe uma (ou combina); registra na ficha, em "Decisões"
4. Model sheet    → turnaround, expressões e poses a partir do design escolhido
5. Vetor (CLI)    → `pipeline.py vetorizar <id>`: pré-processamento cel-shaded + `vectorcraft-cli` (imageTrace + cleanup + simplify + recolor)
6. Auditoria & Rig→ Gemini Vision localiza caixas das peças (`rosto`, `olho-esq`, `olho-dir`, `boca`, `sombra`, membros) + montagem SVG com `<circle id="pivo"/>`
7. Lineup & Teste → `pipeline.py lineup`: Main Model Size Comparison (`lineup-escala.svg/.png`) + teste de silhueta (`lineup-silhuetas.png`)
8. Portão         → aprovação → status ✅ no README e o asset vai para `arte/banco/<id>/`
```

## 2. Automação com `pipeline.py` (`vectorcraft-cli` + Gemini API) {#pipeline-cli}

O arquivo [`arte/pipeline.py`](pipeline.py) integra o **VectorCraft 0.22.0** (`C:\Program Files\ArtCraft\VectorCraft\vectorcraft-cli.exe`, com 933 comandos de edição vetorial e servidor MCP em `vectorcraft-cli mcp`) com a **API Gemini** (`gemini-3.8-flash` para visão/auditoria e `gemini-3.1-flash-image` / `gemini-3-pro-image` para geração de folhas com referência multimodal).

### Comandos disponíveis

```powershell
# 1. Exportar paleta.json para bibliotecas nativas do VectorCraft (.vcswatches) e Adobe (.ase)
python receitas/novela-da-caatinga/arte/pipeline.py paleta

# 2. Vetorizar, limpar nós, auditar com Gemini Vision e montar rig SVG de um personagem
python receitas/novela-da-caatinga/arte/pipeline.py vetorizar dona-mandioca

# 3. Vetorizar todas as referências aprovadas em arte/referencias/ de uma vez
python receitas/novela-da-da-caatinga/arte/pipeline.py vetorizar-todos

# 4. Gerar pranchas de Lineup de Escala (padrão Warner Main Model Size Comparison) e Silhuetas
python receitas/novela-da-caatinga/arte/pipeline.py lineup

# 5. Gerar folhas novas via Gemini Image API passando o Cesto como referência multimodal
python receitas/novela-da-caatinga/arte/pipeline.py gerar realcador --folha exploration
python receitas/novela-da-caatinga/arte/pipeline.py gerar dona-mandioca --folha turnaround --ref-extra receitas/novela-da-caatinga/arte/referencias/dona-mandioca-frente.png
```

### Como funciona o `vetorizar <id>` por baixo dos panos

1. **Pré-processamento Cel-Shaded (`remover_fundo_e_suavizar`):**
   - Detecta a cor do fundo de papel quente (`#FBEDCC`) nos cantos e remove tanto o fundo externo quanto os furos internos fechados da cor lisa do papel (ex.: vão entre braço e tronco ou entre as pernas).
   - Aplica 3 passadas de filtro bilateral preservador de bordas (`cv2.bilateralFilter`) + segmentação `cv2.pyrMeanShiftFiltering` para converter o granulado de aquarela/papel em zonas tonais limpas sem borrar as quinas (reduzindo a contagem de ~1.650 paths sujos para **170–460 formas cheias limpas**).
2. **Batch no `vectorcraft-cli run`:**
   - Cria prancheta `2000 × 2000 px` transparente (`file.new`) e posiciona a arte (`file.place`).
   - Roda `imageTrace.makeAndExpand` com `mode: "color"`, `palette: "limited"`, `strokes: false`, `fills: true`, `method: "abutting"`, `ignoreWhite: true`.
   - Roda `addon.cleanup.fix` (remove pontos isolados, objetos vazios e duplicatas) e `addon.cleanup.simplify` (`tolerance: 18`, `protectCorners: true`), cortando ~35% dos nós redundantes.
   - Roda `swatch.addUsedColors` (`global: true`) e `recolor.colors` para extrair a paleta real medida do vetor.
   - Exporta simultaneamente:
     - `arte/banco/<id>/<id>-frente.svg` (vetor para o motor)
     - `arte/banco/<id>/<id>-frente.png` (renderização de conferência)
     - `arte/fonte/<id>-frente.ai` (arquivo editável para abrir no VectorCraft ou Illustrator)
3. **Auditoria e Segmentação Semântica via Gemini Vision (`analisar_com_gemini`):**
   - Envia a arte recortada e as cores extraídas para `gemini-3.8-flash` junto com a ficha `arte/personagens/<id>.md`.
   - O modelo valida o Portão de Aprovação (`estilo_cesto_1s`, `sem_contorno_preto`, `ingrediente_reconhecivel`, `rosto_padrao_kawaii`), identifica a rampa de 5 tons medida (`luz`, `base`, `meio`, `sombra`, `profunda`) e devolve as caixas delimitadoras normalizadas (`0..1000`) de cada peça do rig.
4. **Montagem do Rig SVG (`organizar_svg_rig`):**
   - Reorganiza os `<path>` do SVG na hierarquia de `animacao.md` §2 (`sombra`, `perna-esq`, `perna-dir`, `braco-esq`, `corpo`, `rosto` → `olho-esq`, `olho-dir`, `sobr-esq`, `sobr-dir`, `boca`, `braco-dir`) e insere `<circle id="pivo" r="2"/>` no ponto de apoio do personagem.
   - Salva o relatório técnico completo em `arte/banco/<id>/relatorio.json`.

## 3. Prompts {#prompts}

Cada prompt é a soma de **blocos fixos**. Os blocos de personagem estão nas fichas; os outros ficam aqui. Escreva em inglês (os geradores respondem melhor) e **anexe sempre a imagem do Cesto** (`referencias/cesto-frente.png`) e, depois de aprovados, os model sheets já prontos (o comando `pipeline.py gerar` já anexa `cesto-frente.png` automaticamente).

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
- **Uma conversa por personagem** no gerador, ou use `pipeline.py gerar <id> --folha ... --ref-extra ...` passando a vista frontal aprovada.
- Turnaround sai melhor gerado **inteiro numa imagem** do que vista por vista.
- As cores são unificadas no VectorCraft usando `paleta-caatinga.vcswatches` e os comandos `recolor.*`.
- Guarde **todos** os prompts e imagens em `referencias/<id>/` com data.

## 4. Refinamento manual no VectorCraft ou Illustrator

Quando quiser ajustar nós ou separar membros articulados manualmente após rodar `pipeline.py vetorizar <id>`:

1. **Arquivo de origem:** abra `arte/fonte/<id>-frente.ai` ou `arte/banco/<id>/<id>-frente.svg` no **VectorCraft** (`C:\Program Files\ArtCraft\VectorCraft\vectorcraft.exe`) ou no Illustrator.
2. **Biblioteca de Cores:** carregue `arte/paleta-caatinga.vcswatches` (no VectorCraft) ou `arte/paleta-caatinga.ase` (no Illustrator). Todas as 163 amostras da `paleta.json` estão agrupadas por material.
3. **Inspeção via CLI / MCP:** você também pode rodar comandos pontuais sem abrir a interface gráfica:
   ```powershell
   & "C:\Program Files\ArtCraft\VectorCraft\vectorcraft-cli.exe" inspect receitas/novela-da-caatinga/arte/banco/dona-mandioca/dona-mandioca-frente.svg --json
   ```
   Ou iniciar o servidor MCP do VectorCraft (`vectorcraft-cli mcp`) para edição interativa em tempo real.
4. **Camadas e Pivôs:** mantenha os grupos com os IDs de `animacao.md` §2 (`corpo`, `rosto`, `olho-esq`, `olho-dir`, `boca`, `braco-esq`, `braco-dir`, `perna-esq`, `perna-dir`, `sombra`) e o `<circle id="pivo" r="2"/>`.

## 5. Organização dos arquivos

```
arte/
  pipeline.py                  ← CLI integrado: VectorCraft + Gemini Vision/Image + Rig SVG + Lineup
  paleta.json                  ← fonte da verdade das rampas de cor
  paleta-caatinga.vcswatches   ← biblioteca nativa do VectorCraft gerada a partir da paleta.json
  paleta-caatinga.ase          ← biblioteca Adobe Swatch Exchange gerada a partir da paleta.json
  referencias/                 ← imagens de referência aprovadas (PNG) e gerações por personagem
  folhas/                      ← lineups de escala (lineup-escala.svg/.png), silhuetas e model sheets
  banco/<id>/                  ← <id>-frente.svg (vetor rigado), <id>-frente.png e relatorio.json
  fonte/                       ← arquivos .ai editáveis (ignorados no git via .gitignore)
```
**Nomes:** minúsculas, sem acento, com hífen (`seu-caju`, `banca-mandioca`). Versões aprovadas ganham sufixo só quando substituem outra: `-v2`.

## 6. Portão de aprovação {#portao}

Um asset só ganha ✅ quando passa em tudo:

- [ ] **Teste de 1 segundo:** ao lado do Cesto (`folhas/lineup-escala.png`), parece do mesmo desenhista
- [ ] **Silhueta:** reconhecível em preto (`folhas/lineup-silhuetas.png`), no tamanho de um celular
- [ ] **Escala:** bate com a tabela de proporções em cestos (`1.0 cesto = 420 px` no lineup)
- [ ] **Sem contorno, sem gradiente, sem preto** (exceto as exceções documentadas)
- [ ] **Cores auditadas:** rampa de 5 tons registrada em `banco/<id>/relatorio.json` e `paleta.json`
- [ ] **Ingrediente reconhecível** por alguém de feira
- [ ] **Camadas com os nomes do rig** e pivôs marcados
- [ ] **Teste de movimento:** pisca, fala, respira e faz uma pose sem quebrar
- [ ] **Nenhum "nunca"** da ficha e do `ARTE.md` violado
