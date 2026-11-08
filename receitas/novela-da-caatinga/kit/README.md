# `receitas/novela-da-caatinga/kit` · Kit Reutilizável da Série

Este diretório contém os presets visuais, o catálogo sonoro, as estruturas de episódio (legenda por personagem, vinheta de abertura, cartela `"continua..."`, assinatura do Mangaio, camadas de cenário e formas de marcação) e os roteiros-modelo da série **Novela da Caatinga**.

---

## 1. Como Gerar os Vídeos do Kit

```powershell
# Vídeo-vitrine (48 s, 9:16, 1080x1920): demonstra os 11 efeitos visuais, 29 sons, câmera, paralaxe e transições
python motores/animacao/montador.py receitas/novela-da-caatinga/kit/vitrine.json --saida saida/kit/vitrine.mp4 --teste --verificar

# Cena-modelo do Episódio 1 ("Serra Pequena e o Mangaio", 18 s): a feira acordando com formas de marcação
python motores/animacao/montador.py receitas/novela-da-caatinga/kit/ep01-feira-acordando.json --saida saida/kit/ep01-feira-acordando.mp4 --teste --verificar

# Exportar todos os 29 efeitos sonoros, ambiências e frases de trompete para WAV 48 kHz individuais
python -m motores.animacao.som.cli exportar-catalogo --saida saida/kit/sons
```

---

## 2. Catálogo de Efeitos Visuais ([`efeitos.js`](efeitos.js))

Todos os efeitos seguem a regra-mãe de [`SERIE/arte/ARTE.md`](../arte/ARTE.md): **formas vetoriais cheias, zero contorno (`stroke="none"`), zero preto (`#000000`), sombras quentes (`#462416`), antecipação e follow-through**, usando apenas cores de [`paleta.js`](paleta.js) ([`SERIE/arte/paleta.json`](../arte/paleta.json)).

| `id` do Efeito | Som padrão casado | Camada típica | Parâmetros opcionais (`params`) | Descrição visual |
|---|---|---|---|---|
| `poeira_pouso` | `pouso_cheio` | `frente` | `{}` | Compressão inicial nos primeiros 12% (antecipação) seguida de lóbulos orgânicos em 3 tons de `chao_terra` abrindo em arco raso |
| `poeira_passo` | `passo_leve` | `frente` | `{ direcao: -1 \| 1 }` | 4 tufos assimétricos de terra expulsos na direção oposta à passada |
| `chuva` | `chuva` | `frente_sobreposta` | `{ inclinacao: -9 }` | Duas camadas de gotas diagonais cheias em `agua_acude` + coroas de respingo abrindo no chão |
| `brilho_plim` | `plim_fruta` | `frente` | `{}` | Estrela de 4 pontas desenhada à mão (`#FFF8EA` / `jatai.luz`) com antecipação de escala, mola e 3 estrelinhas satélites |
| `gota_nervoso` | `gota_suor` | `frente` | `{}` | Gota orgânica em 3 camadas de tom (`agua_acude`) que infla na têmpora, escorrega acelerando e pinga com squash |
| `linhas_susto` | `toc_colher` | `frente` | `{}` | Coroa de 8 cunhas radiais cheias irregulares em `#462416`, `lenco_vermelho.luz` e `caju_amarelo.luz`, animada "em dois" (15 fps) |
| `fumaca_farinha` | `amb_casa_farinha` | `meio` | `{}` | Fita térmica + volutas acolhedoras em `flor_mandacaru` subindo em S a partir do forno de barro |
| `mormaco` | `vento_seco` | `meio` | `{}` | Ondas térmicas translúcidas (`ceu_dia.alto` e `chao_terra.luz`) subindo lentamente do chão quente |
| `folhas_caindo` | `vento_seco` | `frente_sobreposta` | `{}` | 11 folhas em `folha` e `umbu` caindo em pêndulo largo com rotação atrasada de follow-through |
| `confete_bandeirinhas` | `festa_fole` | `frente` | `{}` | Cordão em catenária de bandeirinhas de São João em 2 tons + chuva de confetes nas cores da feira |
| `neon_mercadinho` | `zumbido_neon` | `meio` | `{ texto: "SABOR JÁ" }` | **Única exceção com brilho/gradiente (mundo do vilão):** letreiro e halo radial em `neon_mercadinho` com flicker elétrico cravado nos cortes `0.08..0.16s` e `0.24..0.28s` |

---

## 3. Catálogo de Sons, Ambiências e Trompete ([`sons/catalogo.json`](sons/catalogo.json))

Todos os 29 sons são gerados em **48 kHz estéreo** de forma 100% determinística (síntese física/espectral com semente fixa em NumPy + SciPy, licença **Apache-2.0** própria do repositório):

### 3.1. Efeitos Pontuais ([`sons/presets.py`](sons/presets.py))
- **Pousos e passos:** `pouso_cheio` (`0.50 s`), `pouso_vazio` (`0.38 s`), `passo_pesado` (`0.28 s`, Dona Mandioca), `passo_leve` (`0.18 s`).
- **Objetos e feira:** `plim_fruta` (`0.65 s`), `toc_colher` (`0.22 s`), `sacolejo_frutas` (`0.60 s`), `porta_madeira` (`0.65 s`), `burburinho_feira` (`4.00 s`), `festa_fole` (`1.20 s`), `gota_suor` (`0.30 s`).
- **Clima e sertão:** `vento_seco` (`3.00 s`), `chuva` (`3.50 s`), `trovao_distante` (`2.80 s`), `galo_caatinga` (`1.60 s`).
- **Vilão, câmera e narrativa:** `zumbido_neon` (`1.20 s`), `whoosh_camera` (`0.42 s`), `cartela_continua` (`1.40 s`).

### 3.2. Ambiências em Loop Sem Emenda ([`sons/presets.py`](sons/presets.py))
Geradas com crossfade circular de potência constante + ponte $C^1$ (`salto_emenda = 0.000000`), com **ducking automático** (-9 dB) sob falas:
- `amb_feira` (`6.00 s`, loop): brisa + murmúrio distante de feira + madeira + pássaros.
- `amb_acude_noite` (`6.00 s`, loop): grilos da caatinga em estéreo + vento noturno + sapo ao longe.
- `amb_casa_farinha` (`6.00 s`, loop): crepitar de lenha no forno + roda/prensa de madeira cadenciada.

### 3.3. Frases de Trompete do Mangaio ([`sons/trompete.py`](sons/trompete.py))
Módulo novo (não altera `SERIE/som/mixar.py`) com síntese de metal + surdina plunger e suporte automático a gravações reais em `SERIE/som/trompete/<id>.wav`:
- `trompete_esperanca` (`1.72 s`), `trompete_desconfianca` (`0.86 s`), `trompete_nao_vai` (`0.88 s`), `trompete_grave` (`1.35 s`), `trompete_comedia` (`1.35 s`), `trompete_suspensa` (`1.82 s`), `trompete_oi` (`0.78 s`) e `vinheta_mangaio` (`2.80 s`, trompete + zabumba, triângulo e sanfona em baião).

---

## 4. Estruturas de Episódio

- **[`legenda.js`](legenda.js):** legenda na fonte `CaveatBrush`, posicionada na zona segura 9:16 (`left: 120px; width: 660px; top: 1136px; height: 98px`), sobre placa creme `#F7E8C6` sem contorno preto, com a cor oficial de quem fala (`narrador: #462416`, `dona_mandioca: #93261B`, `umbu: #3F6925`, `licuri: #B0601C`, `maxixe: #2B5627`, `quiabo: #335722`, `realcador: #A61472`, `mandacaru: #294526`).
- **[`cartelas.js`](cartelas.js):** `renderizarVinhetaAbertura`, `renderizarCartelaContinua` (`"continua..."` inclinado com mola) e `renderizarAssinaturaMangaio` (`"Novela da Caatinga, uma história do Mangaio"` + `logo.svg` + Cesto pulando).
- **[`cenario_base.js`](cenario_base.js):** camadas `fundo` (`0.3`), `meio` (`0.7`), `frente` (`1.0`) e `frente_sobreposta` (`1.15`) sem contorno, chaves de luz (`luz_de_cena`) e formas simples de marcação para blocagem do elenco + repertório de 10 movimentos do Mangaio.

---

## 5. Pendências de Integração com `SERIE/cena.js`, `personagens.js`, `gerar.mjs` e `som/mixar.py`

Como os arquivos existentes da série pertencem a outra frente e **não foram editados**, ficam registradas abaixo as pendências exatas para quando as duas frentes forem unificadas:

1. **Remoção do contorno escuro (`stroke` + filtro `#traco`) em `SERIE/cena.js` e `SERIE/personagens.js`:**
   - Atualmente, `SERIE/cena.js` usa `const traco = (w = 5) => 'stroke="${T_}" stroke-width="${w}"...'` e aplica `filter="url(#traco)"` sobre todo o SVG, além de `SERIE/personagens.js` desenhar personagens procedurais com contorno.
   - **Como integrar:** substituir os cenários e efeitos inline de `cena.js` (`poeira`, `nuvemPoeira`, `mercadinho`) pelas chamadas de `SERIE/kit/efeitos.js` (`renderizarEfeitoSerie`) e `SERIE/kit/cenario_base.js` (`construirCamadasCenario`), e trocar os desenhos procedurais de `personagens.js` pelos SVGs rigados de `SERIE/arte/banco/<id>/<id>-frente.svg` (que já estão sem contorno e com grupos nomeados).
2. **Unificação das Deixas (`sons` -> `deixas`) em `SERIE/roteiro.json` e `SERIE/preparar.py`:**
   - Hoje `roteiro.json` e `tempos.json` guardam apenas `c.sons` (`{"id": "plof", "t": 6.932}`), obrigando `cena.js` a procurar o instante do som pelo nome (`R.som('plof')`) para sincronizar a queda do sachê ou o pulo do Cesto.
   - **Como integrar:** usar o campo `deixas` compilado por `motores/animacao/montador.py`, onde um único evento já declara `acao` + `efeito` + `som` no mesmo instante `t` (o catálogo `SERIE/kit/sons/catalogo.json` já inclui todos os aliases antigos `plof`, `pouso`, `vento`, `neon`, `brilho`, `passos`, `vinheta`, `jingle`, `grilo`, `zip` para retrocompatibilidade imediata).
3. **Migração de `SERIE/som/mixar.py` para `motores/animacao/som/mixador.py` + `SERIE/kit/sons/`:**
   - `SERIE/som/mixar.py` não aplica *ducking* na ambiência durante as falas e sintetiza apenas 9 efeitos básicos sem loop contínuo sem emenda.
   - **Como integrar:** substituir a chamada `run('python', [join(aqui, 'som', 'mixar.py')])` em `SERIE/gerar.mjs` por `python -m motores.animacao.som.cli mixar tempos.json -o saida/novela-da-caatinga/som.wav` (o `mixador.py` já lê tanto `cenas[].deixas` quanto `cenas[].sons` e `cenas[].falas` do formato atual de `tempos.json`).
4. **Zona Segura 9:16 e Cor da Legenda em `SERIE/cena.js` e `SERIE/cena.css`:**
   - Em `SERIE/cena.css`, `#legenda` está em `top: 1480px` e `#rotulo` em `top: 1590px`, que ficam dentro da faixa inferior coberta pela interface do Reels/TikTok/Shorts (`y >= 1248` segundo `motores/render/CONTRATO.md`), e a cor do narrador usa `#2b2118` em vez de `paleta.json > tinta.escuro` (`#462416`).
   - **Como integrar:** substituir `legenda()` e `desenhaLegenda()` de `SERIE/cena.js` por `criarLegendaDOM(T.cenas, palco)` de `SERIE/kit/legenda.js`, que posiciona os blocos em `left: 120px; width: 660px; top: 1136px` (100% dentro da zona segura 9:16) e usa as cores oficiais da `paleta.json`.
