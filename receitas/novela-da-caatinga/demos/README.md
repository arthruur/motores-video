# Demos de personagem · Novela da Caatinga

Uma demo por personagem: um vídeo curto (9:16, 1080x1920, 30 fps) que condensa o model sheet e mostra o **potencial de animação** do personagem, como uma reel de estúdio. Cada demo é uma cena do motor de render (`motores/render/CONTRATO.md`: tudo em função de `t`, chave de estado) servida com a raiz na pasta da série, para ler `arte/banco/`, `texturas/` e `fontes/` direto.

## Mangaio

Pasta: [`mangaio/`](mangaio/) · saída: `saida/novela-da-caatinga/demo-mangaio.mp4` (35 s) e `demo-mangaio-contato.png`.

Rodar da raiz do repositório:

```
node receitas/novela-da-caatinga/demos/mangaio/gerar.mjs            # som + vídeo
node receitas/novela-da-caatinga/demos/mangaio/gerar.mjs --mudo     # só o vídeo
node receitas/novela-da-caatinga/demos/mangaio/gerar.mjs --teste    # folha de contato (24 instantes)
python receitas/novela-da-caatinga/demos/mangaio/som.py             # só o som (-14 LUFS)
```

| Arquivo | O que é |
|---|---|
| `index.html` | Palco: kraft + luz de cena, letreiro em Caveat Brush, rótulos da reel |
| `cena.js` | A animação. `T` tem a linha do tempo; o personagem atua "em dois" (15 poses/s), câmera e letreiro a 30/s |
| `tempos.json` | Deixas de som (casam com `T` do `cena.js`; mexeu num, confira o outro) |
| `som.py` | Trompete do Mangaio e efeitos, reaproveitando `../../som/mixar.py` + mola, palha, plim, fiu, risco, xote e ambiente |
| `gerar.mjs` | Chama o `som.py` e o motor com `--raiz` na pasta da série |

Roteiro (35 s, sem fala):

| Tempo | Beat | O que mostra | Som |
|---|---|---|---|
| 0–4 | quique | 3 pulos com antecipação, stretch no ar, squash no pouso, frutas atrasadas (follow-through), sombra que encolhe no ar, poeira | mola, pouso |
| 4–8 | nome | acena com o braço `alto`; "Mangaio" escrito à mão + "o cesto da feira de Serra Pequena" | trompete `oi`, pincel |
| 8–14 | virada | frente → 3/4 → perfil → costas → perfil → 3/4 → frente (troca de vista cut-out, com "pop") | palha a cada troca |
| 14–25 | olhos e braços | desconfiado (olhar de canto, piscada lenta), assustado (tremer, braços `alto`), triste (murchar), encantado (rubor, brilhos), "não vai" (`aponta`, balança a cabeça). Push-in para close | trompete `desconfianca`, `comedia`, `grave`, `suspensa`, `nao_vai` |
| 25–31 | o que vai dentro | frutas pulam fora, vazio murcha; caem de volta uma a uma; transborda; `carregar_tudo` com quique pesado | fiu, vento, plim afinado (sobe a cada fruta), pouso pesado |
| 31–35 | xote e fecho | dança com braços alternados; pose final com o nome e "Novela da Caatinga" | xote (zabumba e triângulo), trompete `esperanca` |

Assets usados: `arte/banco/cesto/mangaio-rig.svg` (frente, peças trocáveis; braço gira o grupo `.giro`, cujo (0,0) é o ombro) e as vistas `cesto-tres-quartos.svg`, `cesto-perfil.svg`, `cesto-costas.svg`. O trompete é sintetizado e provisório (a bíblia pede frases gravadas à mão; ponha `som/trompete/<frase>.wav` e o `mixar.py` passa a usar).

### Referências para evolução da demo do Mangaio: `mangaio-loop.mp4` e `mangaio-danca.mp4`

Os vídeos [`saida/mangaio-loop.mp4`](../../../saida/mangaio-loop.mp4) e [`saida/mangaio-danca.mp4`](../../../saida/mangaio-danca.mp4) (cujos fontes estão versionados em [`app/src/mangaio/`](../../../app/src/mangaio/), [`ferramentas/mangaio/`](../../../ferramentas/mangaio/) e [`cenas/`](../../../cenas/); ver detalhamento completo em [`../arte/animacao.md` §2c, §2d, §5.1, §6.1 e §9](../arte/animacao.md)) trazem soluções de animação muito bem-vindas para analisar e incorporar em [`demos/mangaio/cena.js`](mangaio/cena.js):

#### 1. Como `mangaio-loop.mp4` e `mangaio-danca.mp4` foram feitos (processo e arquivos-fonte)
1. **Extração das 11 frutas individuais ([`ferramentas/mangaio/extrair_frutas.py`](../../../ferramentas/mangaio/extrair_frutas.py) → [`app/src/mangaio/frutas.svg`](../../../app/src/mangaio/frutas.svg)):** converte `arturo.ai` em SVG via PyMuPDF (`fitz`) e separa as frutas/folhas em **11 grupos independentes** (`laranja`, `tomate-grande`, `tomate-1`, `tomate-2`, `banana-1`, `banana-2`, `morango-1`, `morango-2`, `folhas-3`, `folha-1`, `folha-2`) posicionados atrás da borda frontal da boca do cesto (`y ≈ 330..380`, recortados em `y = 375`).
2. **Marionete 2D e pré-simulação do monte de frutas ([`app/src/mangaio/marionete.ts`](../../../app/src/mangaio/marionete.ts) + [`app/src/mangaio/cesto.ts`](../../../app/src/mangaio/cesto.ts)):** desmonta a vista frontal única (`mascote.svg`) em peças (`alca`, `corpo`, `bracoEsq`, `bracoDir`, `rostoSemOlhosBoca` + as 11 frutas de `frutas.svg`). `cesto.ts` pré-simula 3 voltas completas do loop a `960 Hz` (`VOLTAS = 3`, amostrando a 3ª volta a `240 Hz` com emenda exata) para que `seek(t)` continue 100% puro.
3. **Coreografia e física em forma fechada ([`app/src/mangaio/aventura.ts`](../../../app/src/mangaio/aventura.ts) e [`app/src/mangaio/danca.ts`](../../../app/src/mangaio/danca.ts)):** equações analíticas a 116 BPM (32 batidas = `16,55 s` por ciclo; 2 ciclos = `33,10 s`), empacotadas por [`ferramentas/mangaio/empacotar.mjs`](../../../ferramentas/mangaio/empacotar.mjs) em `cenas/mangaio/mangaio_bundle.js` e `cenas/mangaio_danca/mangaio_bundle.js` e renderizadas via [`cenas/mangaio/cena.html`](../../../cenas/mangaio/cena.html) / [`cenas/mangaio_danca/cena.html`](../../../cenas/mangaio_danca/cena.html) com `motores/render/render.mjs`.

#### 2. Pontos de análise e ajustes recomendados para `demos/mangaio/cena.js`
1. **Forma como ele pula e gira permanecendo em 2D (como um 2D girando, em vez de 3D):**
   - Em `aventura.ts` (`pulo_duplo`) e `danca.ts` (`rodopio` e `arretado`), o Mangaio **nunca troca para vistas 3/4, perfil ou costas** para girar. Ele **permanece 100% no desenho 2D frontal** e gira no ar como um recorte 2D plano girando em torno do próprio eixo vertical, modulando a escala horizontal por cosseno:
     $$\text{fase} = \text{suave}\!\left(\frac{t - t_{\text{ini}}}{D}\right), \qquad s_x = \frac{\cos(2\pi \cdot \text{voltas} \cdot \text{fase})}{s}, \qquad s_y = s$$
   - Durante o salto balístico ($y = -4h \cdot u(1-u)$), `sx` passa continuamente por $+1 \to 0 \to -1 \text{ (espelho 2D)} \to 0 \to +1$, somado à antecipação agachada (`AGACHA = 0.4` batida, `sy * 0.80, sx * 1.18`), inclinação pela velocidade vertical (`r = clamp(-vy * vel * 3.5, -18°, 18°)`) e braços erguidos (`-55°..-70°`).
   - **Análise para a demo:** comparar esse giro 2D no ar com a seção `2 · virada` (`t = 8.1..13.8` em `demos/mangaio/cena.js`), que hoje faz um turnaround trocando vistas estáticas no lugar (`frente → 3/4 → perfil → costas`). Assim como já foi decidido para a Dona Mandioca (`ARTE.md`: *"Minimalismo e frente primeiro ... sem turnaround na demo"* e `animacao.md` §2b), o giro do Mangaio **permanecendo em 2D durante o pulo** preserva a identidade gráfica plana da marca e evita qualquer sensação de projeção 3D artificial.
2. **Animação das frutas em onda (`cesto.ts` + `frutas.svg` vs. `S.lag` linear em 4 blocos):**
   - Em `demos/mangaio/cena.js` (linhas 123 e 341), `frutas-cheio` hoje é dividido em 4 grupos que apenas transladam verticalmente com o mesmo `S.lag = cl(0.35 * (yCorpo(t - 0.08) - yCorpo(t)), -34, 34)`.
   - **Ajuste:** usar as **11 frutas individuais** (`frutas.svg`) com a **física de onda de `cesto.ts`**: cama elástica unilateral (`wCama = 22`, permitindo que as frutas descolem no topo do pulo), gravidade `G_FRUTA = 14`, atraso espacial da esquerda para a direita (`ONDA.atraso = 0.20 s`, criando uma onda viajante pela boca do cesto), inclinação na crista da onda (`-dv * 1.2`), amplitude escalada pelo `peso` de cada fruta (folhas `0.05..0.08` pulam mais alto que a laranja `1.00`), squash na base quando comprimidas no pouso e mola `pop(τ, k=420, c=14)` quando novas frutas entram no cesto.
3. **Passos de dança (`soquinho`, `rodopio`, `colado`, `arretado`) e zoom-soco no pouso (`danca.ts`):**
   - No bloco `5 · xote` (`t = 31.4..35` de `demos/mangaio/cena.js`), incorporar o repertório de `danca.ts` (soquinhos alternados na batida, rodopio com pirueta 2D no ar, close `colado` com olhos em arco `◡` e braços abanando, e final `arretado` com 4 pulinhos rápidos + salto duplo), além do impulso de zoom na câmera (`soco = amortece(dt, vPouso * 0.014, 220, 12)`) nos pousos.

## Dona Mandioca

Pasta: [`dona-mandioca/`](dona-mandioca/) · saída: `saida/novela-da-caatinga/demo-dona-mandioca.mp4` (39,5 s, com fala) e `demo-dona-mandioca-contato.png`.

Rodar da raiz do repositório:

```
node receitas/novela-da-caatinga/demos/dona-mandioca/gerar.mjs            # vistas + som + vídeo
node receitas/novela-da-caatinga/demos/dona-mandioca/gerar.mjs --mudo     # só o vídeo
node receitas/novela-da-caatinga/demos/dona-mandioca/gerar.mjs --teste    # folha de contato (29 instantes)
python receitas/novela-da-caatinga/demos/dona-mandioca/montar.py          # só as vistas (vistas.js) a partir do rig
python receitas/novela-da-caatinga/demos/dona-mandioca/som.py             # só o som (-14 LUFS)
python receitas/novela-da-caatinga/demos/dona-mandioca/voz.py             # refaz a fala (gasta cota do TTS: não rode à toa)
```

| Arquivo | O que é |
|---|---|
| `montar.py` | Gera `vistas.js` a partir de `arte/folhas/dona_mandioca_rig.py`: 24 rigs completos, um a cada 15° (0 frente, 90 perfil para a direita, 180 costas), mesmos ids, todas as peças trocáveis |
| `vistas.js` | Gerado (não editar). Só uma vista fica no palco; virar = trocar de vista em dois |
| `index.html` | Palco: kraft + luz quente de casa de farinha, letreiro e legenda em Caveat Brush |
| `cena.js` | A animação. `T`, `GIRO` e `REG` têm a linha do tempo; a atriz atua "em dois" (15 poses/s), câmera e letreiro a 30/s. Anima o rig pelos ids: `tronco` (squash, inclinação, pivô no quadril), `perna-*`, `acess-lenco` e `lenco-pontas` (follow-through), `rosto` (olhar), `olho-*`, `sobr-*` (aparece crescendo e some), `boca`, `bochechas`, `braco-*` (variante + `.giro` + `prop-colher`) |
| `fala.wav` / `fala.json` | A frase dela (Gemini TTS `gemini-3.8-flash-lite-tts`, voz Gacrux do `roteiro.json`), palavras com tempo (faster-whisper) e envelope a 30/s. Gerada uma vez por `voz.py`; a cota do TTS é pequena |
| `tempos.json` | Deixas de som (casam com `T`/`GIRO`/`REG` do `cena.js`; mexeu num, confira o outro) |
| `som.py` | Fala + efeitos: passo (pé-toco), toc (colher de pau), zum, tic (bloco de madeira afinado), tecido, sanfona (fole), ambiente (forno crepitando); `risco` e `xote` vêm da demo do Mangaio, filtros do `../../som/mixar.py` |
| `gerar.mjs` | Chama `montar.py`, `som.py` e o motor com `--raiz` na pasta da série |

Roteiro (39,5 s):

| Tempo | Beat | O que mostra | Som |
|---|---|---|---|
| 0–5,3 | andar | entra DE FRENTE, deslizando de lado, 8 passos curtos e pesados, colher deitada: pé-toco sobe e assenta, tronco afunda no contato e inclina para a frente, braços ao contrário das pernas, pontas do lenço atrasadas; para com arrasto | passo em cada contato, poeira |
| 5,3–7,5 | vira devagar | perfil → frente em 6 vistas com slow-in/out; assenta em cada uma; a sobrancelha dela aparece | tecido, tic |
| 7,5–11 | nome | "Dona Mandioca" escrito à mão + "a dona da casa de farinha"; a colher sobe como cetro, ela assente | risco |
| 11–16,4 | calor | se abana com a folha (calor da seca), fecha os olhos no ventinho | tecido |
| 16,4–22 | regente | antecipação e batida da colher (2x, câmera treme), aponta para quem vê e reafirma, rege o xote no 2/4 com notinhas, corta a música | zum + toc, xote, toc |
| 22–28 | expressões | close: neutra, sobrancelha levantada, irônica, desconfiada, brava, ri segurando o riso, empolgada (stretch e volta à compostura) | tic afinado em cada troca, brilho |
| 28,3–33,6 | fala | "Aqui na casa de farinha quem manda sou eu... mas pode entrar." Sincronia por forma (A E I O U MBP FV a partir das letras de cada palavra, fechada nos silêncios pelo envelope); a colher aponta o chão, vira cetro; pausa com olhar de lado; amolece e convida com a mão | a fala |
| 33,6–39,5 | comovida e fecho | desvia o olhar, ruboriza, ajeita o lenço (braço de borracha); volta com a sobrancelha dela; o nome e "Novela da Caatinga" | sanfona, tecido, risco |

Notas: a voz é sintética (rotular como "voz gerada por IA" ao publicar). O rig da Dona Mandioca ainda está em revisão (rosto a 0,58 do Mangaio e as rampas `mandioca_casca` v1 e `algodao_cru` aguardam aprovação); se o rig mudar, `gerar.mjs` refaz `vistas.js` sozinho.
