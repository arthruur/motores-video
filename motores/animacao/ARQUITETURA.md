# Arquitetura do Kit de Animação (`motores/animacao` + `SERIE/kit`)

Este documento define o contrato técnico e as APIs entre os módulos genéricos (`motores/animacao/`) e o kit específico da série **Novela da Caatinga** (`receitas/novela-da-caatinga/kit/`).

Todos os módulos obedecem estritamente a:
1. **[`motores/render/CONTRATO.md`](../render/CONTRATO.md):** a cena HTML expõe `window.DURACAO`, `window.seek(t)` **100% puro em função de `t`** (sem `setTimeout`, `requestAnimationFrame`, CSS `animation`/`transition`, `Date.now()` ou `Math.random()` sem semente) e `window.pronto = true`.
2. **[`SERIE/arte/ARTE.md`](../../receitas/novela-da-caatinga/arte/ARTE.md) e [`paleta.json`](../../receitas/novela-da-caatinga/arte/paleta.json):** formas vetoriais cheias, **zero contornos (`stroke="none"`)**, volume por sobreposição de tons da rampa, sombras quentes (`#462416` como tom mais escuro, nunca `#000000`), e exceção de brilho/gradiente **apenas** para o néon e plástico do mundo do vilão (Mercadinho Sabor Já).

---

## 1. Mapa de Arquivos e Responsabilidades

```text
motores/animacao/                    # Motor genérico (reutilizável por qualquer série/vídeo)
├── ARQUITETURA.md                   # Este contrato técnico
├── README.md                        # Guia de uso, API e integração
├── timeline.js                      # Easing, física determinística, PRNG, timeline e resolução de deixas
├── camera.js                        # Câmera 2D (pan, push-in, tremida, chicote com blur) e paralaxe
├── transicoes.js                    # Transições entre cenas (corte, funde, chicote, íris circular)
├── efeitos.js                       # Primitivas e fábrica de partículas/efeitos vetoriais sem contorno
├── montador.py                      # Compilador: roteiro-de-cena JSON -> plano.json + HTML + som.wav
└── som/                             # Motor de síntese e mixagem de áudio (Python + numpy, 48 kHz)
    ├── __init__.py                  # API pública: sintetizar_som, mixar_timeline, medir_audio
    ├── sintese.py                   # Geradores determinísticos base (filtros, envelopes, loops sem emenda)
    ├── mixador.py                   # Mixagem por deixas, ducking sob fala, loudnorm (-14 LUFS / -1 dBTP)
    └── cli.py                       # CLI para gerar banco de sons, mixar roteiro e rodar auditoria QA

receitas/novela-da-caatinga/kit/     # Kit específico da série "Novela da Caatinga"
├── README.md                        # Catálogo visual/sonoro da série + pendências de integração
├── paleta.js                        # Exporta SERIE/arte/paleta.json para uso direto no navegador (ES module/window)
├── efeitos.js                       # Presets dos 11+ efeitos visuais da série na paleta.json
├── cenario_base.js                  # Construtores de camadas (fundo 0.3, meio 0.7, frente 1.0) e blocagem do elenco
├── legenda.js                       # Legenda da série (CaveatBrush, cor por personagem, zona segura 9:16)
├── cartelas.js                      # Abertura/vinheta, cartela "continua..." e assinatura do Mangaio
├── vitrine.json                     # Roteiro-de-cena do vídeo-vitrine (45–55 s) demonstrando todo o kit
├── ep01-feira-acordando.json        # Roteiro-de-cena modelo do Ep. 1 ("Serra Pequena e o Mangaio")
└── sons/                            # Presets sonoros da Caatinga + trompete do Mangaio
    ├── __init__.py                  # Registra todos os presets no motor de som
    ├── catalogo.json                # Catálogo oficial: id, duracao, tags, efeito_visual, volume_relativo
    ├── presets.py                   # Síntese determinística dos efeitos e ambiências无缝 (seamless loops)
    └── trompete.py                  # Frases de trompete do Mangaio (módulo novo, sem editar som/mixar.py)
```

---

## 2. Timeline, Matemática Determinística e `seek(t)` (`motores/animacao/timeline.js`)

O módulo `timeline.js` funciona tanto como ES Module (`import { ... } from '/motores/animacao/timeline.js'`) quanto pendurado em `window.AnimTimeline`.

### 2.1. Funções Matemáticas e Curvas de Animação

```js
// Arredondamento para SVG e chaves de deduplicação
export const r = (x, casas = 2) => +(+x).toFixed(casas);
export const lim = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const mix = (a, b, q) => a + (b - a) * q;
export const fase = (t, ini, dur) => (dur <= 0 ? (t >= ini ? 1 : 0) : lim((t - ini) / dur));

// Quantização de tempo ("animação em dois": 15 poses/s para atuação; 30 fps para câmera e partículas)
export const emDois = (t, fps = 30) => Math.floor(t * (fps / 2)) / (fps / 2);

// Curvas de easing
export const suave = q => { const u = lim(q); return u * u * (3 - 2 * u); };
export const entrada = q => { const u = lim(q); return u * u * u; };
export const saida = q => { const u = lim(q); return 1 - (1 - u) ** 3; };
export const entradaSaida = q => {
  const u = lim(q);
  return u < 0.5 ? 4 * u * u * u : 1 - ((-2 * u + 2) ** 3) / 2;
};
export const arco = q => { const u = lim(q); return 4 * u * (1 - u); };

// Princípios de animação (animacao.md §5):
// Antecipação: recua nos primeiros `pAnt` (padrão 0.18) antes de avançar até 1.0
export function antecipar(q, forca = 0.16, pAnt = 0.18) { ... }

// Follow-through / Mola amortecida determinística para t >= 0 (segundos após o impacto)
export const mola = (dt, freq = 2.6, amort = 5.5) =>
  dt <= 0 ? 0 : Math.exp(-amort * dt) * Math.cos(2 * Math.PI * freq * dt);

// PRNG determinístico com semente (retorna 0..1)
export const hash = (indice, semente = 1) => {
  const s = Math.sin(indice * 127.1 + semente * 311.7 + 74.7) * 43758.5453123;
  return s - Math.floor(s);
};
```

### 2.2. Estrutura de `Timeline`

```js
export function criarTimeline(config) {
  // config: { duracao, fps = 30, cenas = [], deixas = [] }
  return {
    duracao: config.duracao,
    cenas: config.cenas,
    deixas: config.deixas,
    cenaAtiva(t) { ... },          // retorna { cena, indice, tl, emTransicao, proxCena, progressoTransicao }
    deixasAtivas(t, cenaId) { ... }, // retorna deixas ativas no instante t com { ...deixa, dt, u }
    chaveEstado(t) { ... }         // string determinística para deduplicação de quadros no render.mjs
  };
}
```

---

## 3. Conceito de "Deixa" (Sincronia Ação + Efeito Visual + Som)

Uma **deixa** (*cue*) é o átomo de sincronização do kit: um único evento na timeline que dispara simultaneamente uma **ação de personagem/objeto**, um **efeito visual** e um **efeito sonoro** no mesmo instante `t`.

### 3.1. Esquema JSON de uma Deixa

```json
{
  "id": "pouso_mangaio_1",
  "t": 1.80,
  "ancora": { "fala": 0, "ref": "fim", "d": 0.15 },
  "camada": "frente",
  "pos": [540, 1210],
  "acao": {
    "alvo": "mangaio",
    "movimento": "quicar",
    "dur": 0.75,
    "params": { "altura": 210 }
  },
  "efeito": {
    "id": "poeira_pouso",
    "dur": 0.70,
    "escala": 1.15,
    "semente": 12,
    "params": {}
  },
  "som": {
    "id": "pouso_cheio",
    "vol": 0.90,
    "dur": null
  }
}
```

### 3.2. Regras de Resolução Temporal (`t` vs `ancora`)
- Se `"t"` (segundos relativos ao início da cena) for informado diretamente, ele é usado.
- Se `"ancora"` for informado:
  - `{"fala": i, "ref": "ini", "d": delta}` → `t = cena.falas[i].ini + delta`
  - `{"fala": i, "ref": "fim", "d": delta}` → `t = cena.falas[i].ini + cena.falas[i].dur + delta`
  - `{"fala": i, "ref": "palavra", "palavra": "poeira", "d": delta}` → `t = instante_da_palavra + delta`
- O compilador (`montador.py`) resolve todas as âncoras em `t` numérico exato (em segundos da cena) e `t_global = cena.ini + t` (em segundos do episódio) antes de gerar a página HTML e o `som.wav`.
- Atalho por catálogo: se uma deixa especificar `"efeito": "poeira_pouso"` (string) e omitir `"som"`, e `catalogo.json` indicar um som padrão para `poeira_pouso`, o montador preenche automaticamente o som correspondente (a menos que `"som": null` seja explícito).

---

## 4. Formato do Roteiro-de-Cena JSON

O montador (`motores/animacao/montador.py`) aceita **dois estilos** no mesmo formato unificado, mantendo total compatibilidade com [`SERIE/cap01-inauguracao.json`](../../receitas/novela-da-caatinga/cap01-inauguracao.json) e [`SERIE/roteiro.json`](../../receitas/novela-da-caatinga/roteiro.json):

1. **Modo `batidas`** (como em `cap01-inauguracao.json`): lista sequencial de batidas (`acao`, `fala`, `som`, `efeito`, `camera`, `texto_tela`), onde o compilador calcula `ini` e `dur` automaticamente.
2. **Modo `deixas` explícitas + `camadas`**: controle fino de instantes `t`, camadas de paralaxe, câmera e movimentos. Ambos podem coexistir na mesma cena.

### 4.1. Esquema Completo do Roteiro-de-Cena JSON

```json
{
  "serie": "novela-da-caatinga",
  "capitulo": 1,
  "titulo": "Serra Pequena e o Mangaio",
  "arco": "estiagem",
  "saida": "vitrine.mp4",
  "fps": 30,
  "largura": 1080,
  "altura": 1920,
  "acude": 0.18,
  "rotulo": "Animação e áudio sintéticos determinísticos · Novela da Caatinga",
  "cenas": [
    {
      "id": "feira_acordando",
      "titulo_secao": "1. A Feira Acordando",
      "bloco": "abertura",
      "lugar": "feira",
      "luz": "feira_dia",
      "dur": 8.0,
      "ambiencia": { "id": "amb_feira", "vol": 0.35 },
      "camera": [
        { "tipo": "pan", "t": 0.0, "dur": 4.5, "de": [-90, 0], "para": [0, 0], "zoom": 1.04 },
        { "tipo": "push_in", "t": 4.5, "dur": 3.5, "zoomDe": 1.04, "zoomPara": 1.14, "foco": [540, 1120] },
        { "tipo": "tremida", "t": 2.1, "dur": 0.35, "intensidade": 12, "semente": 4 }
      ],
      "camadas": {
        "fundo": { "paralaxe": 0.3, "elementos": ["ceu", "sol", "serra", "regua_acude"] },
        "meio":  { "paralaxe": 0.7, "elementos": ["umbuzeiro", "bancas_feira"] },
        "frente": { "paralaxe": 1.0, "elementos": ["chao_terra", "caixotes"] },
        "frente_sobreposta": { "paralaxe": 1.15, "elementos": [] }
      },
      "marcadores": [
        { "id": "mangaio", "tipo": "cesto", "x": 540, "y": 1220, "escala": 1.0 },
        { "id": "dona_mandioca", "tipo": "retangulo", "x": 270, "y": 1200, "escala": 1.35, "rotulo": "Dona Mandioca" },
        { "id": "umbu", "tipo": "gota", "x": 820, "y": 1210, "escala": 0.75, "rotulo": "Umbu" }
      ],
      "falas": [
        {
          "quem": "narrador",
          "texto": "Em Serra Pequena, a feira acorda junto com o sol.",
          "ini": 0.6,
          "dur": 3.2
        }
      ],
      "deixas": [
        {
          "id": "pouso_abertura",
          "t": 2.1,
          "camada": "frente",
          "pos": [540, 1220],
          "acao": { "alvo": "mangaio", "movimento": "quicar", "dur": 0.75, "params": { "altura": 200 } },
          "efeito": { "id": "poeira_pouso", "dur": 0.75, "escala": 1.2, "semente": 3 },
          "som": { "id": "pouso_cheio", "vol": 0.9 }
        }
      ],
      "batidas": [],
      "cartela": null,
      "transicao": { "tipo": "chicote", "dur": 0.45, "direcao": "esq" }
    }
  ]
}
```

---

## 5. Declaração de Camadas, Paralaxe e Câmera (`motores/animacao/camera.js`)

Conforme [`SERIE/arte/animacao.md` §7](../../receitas/novela-da-caatinga/arte/animacao.md) e [`cenarios.md`](../../receitas/novela-da-caatinga/arte/cenarios.md):

| Camada | Fator de Paralaxe | Conteúdo |
|---|---|---|
| `fundo` | `0.3` | Céu, sol, serra distante, nível do açude ao fundo |
| `meio` | `0.7` | Construções, umbuzeiro, bancas da feira, fachada do Mercadinho, forno |
| `frente` | `1.0` | Chão (linha de apoio em `y = 1190`, ~62% de 1920), marcadores de personagem, sombras de contato e efeitos locais |
| `frente_sobreposta` | `1.15` | Partículas que cruzam na frente da lente (folhas em 1º plano, chuva grossa frontal) |
| `ui` | `0.0` | Fixa na tela: legenda na zona segura, cartela `"continua..."`, vinheta e rótulo |

### 5.1. API de `camera.js`

```js
// Calcula o estado instantâneo da câmera em função pura de t (segundos da cena)
export function calcularCamera(eventosCamera = [], t = 0, largura = 1080, altura = 1920) {
  // Retorna:
  // {
  //   dx: número (px de deslocamento da câmera no plano 1.0),
  //   dy: número (px),
  //   zoom: número (1.0 = neutro),
  //   giro: número (graus),
  //   focoX: número (padrão 540),
  //   focoY: número (padrão 1100),
  //   blurX: número (px de motion blur horizontal quando em "chicote", 0 nos demais)
  // }
}

// Gera o atributo transform SVG para uma camada com fator de paralaxe `p` (0.3, 0.7, 1.0, 1.15)
export function transformCamada(cam, paralaxe = 1.0) {
  // Aplica (-cam.dx * paralaxe, -cam.dy * paralaxe) e escala proporcional ao redor de (cam.focoX, cam.focoY)
}
```

---

## 6. Transições (`motores/animacao/transicoes.js`)

Quatro transições determinísticas suportadas no final de cada cena (`tl` entre `cena.dur - tr.dur` e `cena.dur`):

1. **`corte`** (`dur: 0`): troca direta de cena (de preferência no movimento ou no corte de olhar).
2. **`funde`** (`dur: 0.35..0.6`): *cross-dissolve* suave entre a cena atual e a seguinte.
3. **`chicote`** (`dur: 0.35..0.5`, `direcao: "esq"|"dir"`): *whip pan* rápido em que a cena que sai desliza com curva `entradaSaida(u)` + filtro `<feGaussianBlur stdDeviation="38,0">` enquanto a próxima entra pela borda oposta, casado automaticamente com o som `whoosh_camera`.
4. **`iris`** (`dur: 0.55..0.9`, `foco: [cx, cy]`, `modo: "fechar"|"abrir"`): máscara circular `<clipPath>` que fecha do raio máximo (`2200 px`) até `0` (ou até um raio de destaque de `140 px` antes de fechar) sobre o ponto de interesse `(cx, cy)` em cor `tinta.escuro` (`#462416`, nunca `#000`).

---

## 7. Biblioteca de Efeitos Visuais (`motores/animacao/efeitos.js` + `SERIE/kit/efeitos.js`)

### 7.1. Assinatura Padrão de Todo Efeito Visual

Cada efeito registrado expõe uma função pura que recebe `(ctx, tLocal, dur, params)` e retorna uma string de elementos SVG (`<g>...</g>`):

```js
/**
 * @param {object} ctx - { x, y, escala, semente, camada, paleta }
 * @param {number} dt  - tempo decorrido desde o início da deixa (segundos, 0 <= dt <= dur)
 * @param {number} dur - duração total do efeito (segundos)
 * @param {object} params - parâmetros opcionais do preset
 * @returns {string} SVG puro sem stroke (formas cheias em tons da paleta.json)
 */
```

### 7.2. Catálogo Mínimo Obrigatório em `SERIE/kit/efeitos.js`

| `id` do Efeito | Camada típica | Cores de `paleta.json` | Comportamento (antecipação + follow-through, sem contorno) |
|---|---|---|---|
| `poeira_pouso` | `frente` | `chao_terra.luz`, `base`, `meio` | Compressão inicial (2 quadros), abertura lateral de lóbulos orgânicos em arco raso e subida lenta enquanto dissipa |
| `poeira_passo` | `frente` | `chao_terra.luz`, `base` | Tufos menores e assimétricos expulsos para trás do pé (`direcao: -1 | 1`) |
| `chuva` | `meio` + `frente_sobreposta` | `agua_acude.luz`, `base`, `sombra` | Gotas alongadas diagonais cheias em 2 planos de velocidade + coroa de respingo que abre no chão (`y = 1190..1350`) |
| `brilho_plim` | `frente` | `tinta.brilho_olho` (`#FFF8EA`), `jatai.luz`, `caju_amarelo.luz` | Estrela de 4 pontas assimétrica desenhada à mão: antecipa encolhendo, abre com mola e solta 4 pontinhos dourados |
| `gota_nervoso` | `frente` | `agua_acude.luz`, `base`, `sombra` | Gota cheia orgânica que infla na têmpora (antecipação), escorrega acelerando e pinga com squash |
| `linhas_susto` | `frente` | `tinta.escuro` (`#462416`), `caju_amarelo.luz` | Cunhas radiais cheias irregulares ao redor da cabeça, animadas "em dois" (15 fps) com tremor |
| `fumaca_farinha` | `meio` | `flor_mandacaru.base`, `meio`, `sombra` | Volutas quentes e arredondadas que sobem serpenteando da casa de farinha e se alargam no topo |
| `mormaco` | `meio` | `ceu_dia.alto`, `chao_terra.luz` | Faixas ondulantes translúcidas de ar quente que sobem lentamente do chão seco |
| `folhas_caindo` | `frente_sobreposta` | `folha.luz`, `base`, `meio`, `umbu.base` | Folhas orgânicas caindo em pêndulo (`seno` + rotação atrasada de follow-through) levadas pela brisa |
| `confete_bandeirinhas` | `meio` + `frente` | `tomate.base`, `laranja.base`, `caju_amarelo.luz`, `folha.luz`, `lenco_vermelho.base` | Cordão de bandeirinhas de festa balançando em catenária + chuva alegre de confetes recortados à mão |
| `neon_mercadinho` | `meio` | `neon_mercadinho.rosa`, `azul`, `brilho`, `fundo` | **Único efeito com brilho/gradiente:** letreiro e halo radial com flicker elétrico sincronizado com `zumbido_neon` |

---

## 8. Motor de Som e Catálogo (`motores/animacao/som/` + `SERIE/kit/sons/`)

### 8.1. Especificação de Áudio
- **Taxa de amostragem:** `48000` Hz (`SR = 48000`).
- **Formato final:** WAV PCM 16-bit estéreo (`som.wav`).
- **Determinismo e Licenças:** todos os efeitos, ambiências e frases de trompete são gerados por síntese física/espectral determinística em Python + NumPy + SciPy (`np.random.default_rng(semente)`), com licença **Apache-2.0** própria do repositório (documentada no catálogo e em `README.md`).
- **Normalização e Ducking (`motores/animacao/som/mixador.py`):**
  1. **Ambiências em loop sem emenda:** toda ambiência (`amb_feira`, `amb_acude_noite`, `amb_casa_farinha`) é sintetizada com janela de crossfade circular exata (ou frequências inteiras do período do buffer) para que `x[-1]` e `x[0]` tenham diferença próxima de zero, permitindo repetir por qualquer duração sem clique.
  2. **Ducking sob fala:** quando há falas na cena (`cena.falas`), o ganho da pista de ambiência baixa suavemente para `0.35` (-9 dB) com ataque de `80 ms` antes da fala e retorna a `1.0` em `250 ms` após a fala.
  3. **Fade anti-clique:** todo efeito individual recebe envelope de entrada/saída mínimo de `5 ms` para garantir zero cliques de comutação.
  4. **Loudnorm EBU R128 em 2 passadas (ffmpeg):** alvo **-14.0 LUFS** (`I=-14`), pico verdadeiro máximo **-1.0 dBTP** (`TP=-1.0`), `LRA=11`.

### 8.2. Catálogo Mínimo Obrigatório (`SERIE/kit/sons/catalogo.json`)

1. **Efeitos pontuais (`presets.py`):**
   - `pouso_cheio`: quique/pouso pesado do Cesto carregado de frutas (baque grave + ranger de palha + acomodação) → casa com `poeira_pouso`.
   - `pouso_vazio`: quique/pouso leve e oco do Cesto vazio → casa com `poeira_pouso`.
   - `passo_pesado`: passos firmes da Dona Mandioca na terra batida → casa com `poeira_passo`.
   - `passo_leve`: passinhos rápidos/leves (Licuri, Maxixe, Quiabo) → casa com `poeira_passo`.
   - `plim_fruta`: brilho cristalino de fruta caindo no cesto ou flor abrindo → casa com `brilho_plim`.
   - `toc_colher`: batida seca e ressonante de colher de pau na madeira → casa com `linhas_susto`.
   - `sacolejo_frutas`: chocalho orgânico de frutas e folhas se acomodando no cesto de palha.
   - `vento_seco`: rajada de vento quente na caatinga → casa com `mormaco` e `folhas_caindo`.
   - `chuva`: chuva grossa caindo na terra com pingos nítidos → casa com `chuva`.
   - `trovao_distante`: ribombo grave e longo rolando pela serra.
   - `galo_caatinga`: canto de galo / ave da caatinga ao longe, anunciando a manhã na feira.
   - `burburinho_feira`: textura coral suave de vozes e pregões indistintos ao fundo (síntese formântica determinística).
   - `porta_madeira`: ranger curto + batida de porta de madeira da casa de farinha / lanchonete.
   - `zumbido_neon`: hum elétrico de 60/120 Hz + centelha nos cortes de luz (`0.08..0.16s` e `0.24..0.28s`) → casa com `neon_mercadinho`.
   - `whoosh_camera`: sopro rápido com varredura de filtro para virada de câmera → casa com transição `chicote`.
   - `cartela_continua`: acorde suspenso de sanfona/zabumba leve + carimbo seco da cartela `"continua..."`.
   - `gota_suor`: pingo curto descendente → casa com `gota_nervoso`.
   - `festa_fole`: acorde curto festivo de feira → casa com `confete_bandeirinhas`.
2. **Ambiências em loop sem emenda (`presets.py`):**
   - `amb_feira`: brisa + murmúrio distante de feira + madeira e cestos + passarinhos ao longe.
   - `amb_acude_noite`: grilos da caatinga em estéreo + brisa noturna calma + sapo distante.
   - `amb_casa_farinha`: crepitar quente de lenha no forno + roda/prensa de madeira cadenciada + fumaça → casa com `fumaca_farinha`.
3. **Frases de trompete do Mangaio (`trompete.py`):**
   - `trompete_esperanca`: frase ascendente em xote (vitória da comunidade / abertura).
   - `trompete_desconfianca`: wah-wah curto de surdina plunger (olhar desconfiado).
   - `trompete_nao_vai`: duas notas descendentes ("não vai / não faz isso").
   - `trompete_grave`: nota longa grave (perigo, susto no açude).
   - `trompete_comedia`: escala descendente rápida + wah final (algo deu errado / risada).
   - `trompete_suspensa`: tríade que para na 4ª aumentada / nota suspensa (gancho do fim do capítulo).
   - `trompete_oi`: três notas curtas alegres de cumprimento.
   - `vinheta_mangaio`: chamada de trompete com acompanhamento percussivo de baião (zabumba + triângulo sintetizados).

---

## 9. Estruturas de Episódio (`SERIE/kit/legenda.js` e `SERIE/kit/cartelas.js`)

### 9.1. Legenda da Série (`legenda.js`)
- Fonte: `CaveatBrush-Regular.ttf` (`SERIE/fontes/CaveatBrush-Regular.ttf`).
- Zona segura 9:16 (`motores/render/CONTRATO.md`): posicionada em `x ∈ [120, 780]` (ou centralizada em `[120, 888]` acima de `y = 1248`, padrão `y = 1120..1210`) para nunca invadir a faixa inferior (`y >= 1248`) nem a coluna de botões da direita (`x >= 780` abaixo de `y = 840`) nem o topo (`y < 288`).
- Cor por personagem (sobre placa creme quente `#F7E8C6` sem contorno preto, ou sombra de papel `#F7E8C6`):
  - `narrador`: `#462416` (`tinta.escuro`)
  - `dona_mandioca`: `#93261B` (`lenco_vermelho.sombra`)
  - `umbu`: `#3F6925` (`folha.meio`)
  - `licuri`: `#B0601C` (`licuri.sombra`)
  - `maxixe` / `quiabo`: `#2B5627` (`folha.sombra`)
  - `realcador`: `#A61472` (`sache_rosa.sombra`)
  - `mandacaru`: `#294526` (`mandacaru.profunda`)
- Animação: blocos curtos de até 4 palavras (~22 caracteres), surgimento palavra a palavra puramente em função de `t`.

### 9.2. Cartelas, Abertura e Assinatura (`cartelas.js`)
- **Abertura / Vinheta de título:** fundo kraft, sol do sertão, silhuetas de mandacarus em rampa `mandacaru`, título `"Novela da Caatinga"` com entrada palavra por palavra em mola e subtítulo do capítulo.
- **Cartela `"continua..."`:** entra no gancho final com rotação leve (`-4deg`), escala em mola sincronizada com `trompete_suspensa` / `cartela_continua`, dentro da zona segura.
- **Assinatura final:** `"Novela da Caatinga, uma história do Mangaio"`, acompanhada do marcador do Cesto dando pulinhos no compasso da `vinheta_mangaio`.

---

## 10. Formas Simples de Marcação para Elenco (`SERIE/kit/cenario_base.js`)

Como os personagens finais e cenários detalhados pertencem à outra equipe, o kit oferece **formas simples de marcação (blocagem)** que obedecem à linguagem de formas e alturas em "cestos" de [`ARTE.md` §2 e §3](../../receitas/novela-da-caatinga/arte/ARTE.md):
- `cesto` (Mangaio): forma de cesto trapézio arredondado em `palha_cesto` (`1.0 cesto = 260 px` na cena), com alça, olhos ovais `#462416` e braços-patinha para demonstrar os movimentos (`quicar`, `pulo_duplo`, `pegar`, `danca`, `olhar`, `apontar`, `murchar`, `tremer`, `suspenso`), além do vocabulário expandido de [`saida/mangaio-loop.mp4`](../../saida/mangaio-loop.mp4) (`pulinho`, `engole` com brotamento `pop()` e pirueta 2D `sx = cos(2π·voltas·fase)/s`) e [`saida/mangaio-danca.mp4`](../../saida/mangaio-danca.mp4) (`soquinho`, `rodopio`, `colado`, `arretado`, braços independentes `braco`/`bracoDir` e física em onda das 11 frutas individuais de `frutas.svg` / `cesto.ts`; ver [`SERIE/arte/animacao.md` §2.1, §5.1 e §6.1](../../receitas/novela-da-caatinga/arte/animacao.md)).
- Demais personagens quando em cena-modelo: **blocos geométricos de marcação sem rosto detalhado** na forma dominante e rampa oficial da tabela de `ARTE.md` §2 (ex.: `retangulo` em `mandioca_casca` para Dona Mandioca `1.35x`, `oval`/`gota` em `umbu` `0.75x` e `licuri` `0.55x`, `coluna` em `quiabo` `1.15x`, `triangulo` em `sache_rosa` para o Realçador `1.1x`), com sombra de contato no chão e squash & stretch nas deixas.

---

## 11. Montador e Pipeline de QA (`motores/animacao/montador.py`)

### Uso via Linha de Comando

```bash
# Monta HTML + som.wav a partir de um roteiro-de-cena JSON
python motores/animacao/montador.py receitas/novela-da-caatinga/kit/vitrine.json --saida saida/kit/vitrine.mp4 --teste

# Apenas compila a página HTML e o áudio sem chamar o Chrome (útil para inspeção rápida)
python motores/animacao/montador.py receitas/novela-da-caatinga/kit/ep01-feira-acordando.json --apenas-preparar
```

### Checklist Automático do Revisor (QA)
1. Render da folha de contato (`node motores/render/render.mjs <html_gerado> --raiz . --teste <8_instantes> --zonas --saida saida/kit/<nome>-contato.png`) e inspeção visual.
2. Verificação de determinismo e deduplicação (`node motores/render/render.mjs <html_gerado> --raiz . --verificar --saida saida/kit/<nome>.mp4`): **0 quadros divergentes**.
3. Auditoria de som (`python -m motores.animacao.som.cli auditar saida/kit/<nome>-som.wav`):
   - Taxa: `48000 Hz`
   - Loudness integrado: `-14.0 ± 0.5 LUFS`
   - True Peak: `<= -1.0 dBTP`
   - Zero cliques nas emendas de loop.
4. Auditoria de estilo SVG: zero `stroke` (exceto `none`) nos efeitos da caatinga e zero ocorrência de `#000` / `#000000` / `black`.
