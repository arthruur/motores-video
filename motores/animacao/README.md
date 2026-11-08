# `motores/animacao` · Motor Genérico de Animação, Efeitos e Som

Motor local, determinístico e 100% compatível com o [`motores/render/CONTRATO.md`](../render/CONTRATO.md) para produzir vídeos verticais animados (`1080 × 1920`, 30 fps) a partir de roteiros JSON declarativos.

Toda a animação visual é **função pura de `t`** (`window.seek(t)`) — sem `setTimeout`, `requestAnimationFrame`, CSS `animation`/`transition`, `Date.now()` ou `Math.random()` sem semente — e todo o áudio (`48 kHz`, estéreo, `-14 LUFS`, pico `<= -1.0 dBTP`) é sintetizado e mixado deterministicamente a partir das mesmas **deixas** (*cues*) da timeline.

---

## 1. Uso Rápido

```powershell
# 1. Montar um roteiro-de-cena JSON completo (HTML + som.wav + MP4 + folha de contato + verificação)
python motores/animacao/montador.py receitas/novela-da-caatinga/kit/vitrine.json --saida saida/kit/vitrine.mp4 --teste --verificar

# 2. Montar a cena-modelo do Episódio 1 ("Serra Pequena e o Mangaio")
python motores/animacao/montador.py receitas/novela-da-caatinga/kit/ep01-feira-acordando.json --saida saida/kit/ep01-feira-acordando.mp4 --teste --verificar

# 3. Apenas preparar o plano compilado, a página HTML e o áudio WAV (sem abrir o Chrome)
python motores/animacao/montador.py receitas/novela-da-caatinga/kit/vitrine.json --apenas-preparar

# 4. Exportar e auditar todos os sons do catálogo em WAV 48 kHz
python -m motores.animacao.som.cli exportar-catalogo --saida saida/kit/sons

# 5. Auditar métricas EBU R128 (-14 LUFS, True Peak, emendas) de qualquer WAV
python -m motores.animacao.som.cli auditar saida/kit/vitrine-som.wav
```

---

## 2. Módulos e APIs

| Arquivo | O que faz | Principais símbolos exportados |
|---|---|---|
| [`ARQUITETURA.md`](ARQUITETURA.md) | Especificação completa do contrato de timeline, deixas, camadas, câmera, efeitos e som | — |
| [`timeline.js`](timeline.js) | Matemática determinística, curvas de easing, quantização "em dois" (15 fps), PRNG com semente e controlador de cenas/deixas | `r`, `lim`, `mix`, `fase`, `emDois`, `suave`, `entrada`, `saida`, `entradaSaida`, `arco`, `antecipar`, `mola`, `followThrough`, `hash`, `ruidoSuave`, `caminhoBlob`, `resolverInstante`, `criarTimeline` |
| [`camera.js`](camera.js) | Câmera 2D pura em função de `t` (`pan`, `push_in`, `tremida`, `chicote` com motion blur horizontal) e cálculo de matriz de paralaxe por camada | `calcularCamera`, `transformCamada`, `filtroBlurCamera` |
| [`transicoes.js`](transicoes.js) | Transições determinísticas entre cenas (`corte`, `funde`, `chicote`, `iris` circular em `#462416`) | `calcularTransicao`, `defsTransicaoSVG`, `mascaraIrisSVG`, `comporTransicaoSVG` |
| [`efeitos.js`](efeitos.js) | Primitivas vetoriais sem contorno (`stroke="none"`) desenhadas à mão e fábrica de registros de efeitos | `gotaOrganica`, `estrelaQuatroPontas`, `nuvemOrganica`, `cunhaRadial`, `fitaOndulada`, `folhaOrganica`, `criarRegistroEfeitos` |
| [`montador.py`](montador.py) | Compilador que lê um roteiro JSON (modo `deixas` ou modo `batidas`), resolve âncoras temporais, gera o HTML da cena e o `som.wav` e chama `render.mjs` | `compilar_roteiro`, `gerar_html_cena`, `montar_roteiro` |
| [`som/sintese.py`](som/sintese.py) | Primitivas de síntese de áudio 48 kHz em NumPy + SciPy, filtros Butterworth SOS, envelopes $C^1$ e gerador de loops sem emenda (`salto_emenda = 0`) | `SR`, `filtro`, `env`, `fade_anticlique`, `norm`, `tornar_loop_sem_emenda`, `repetir_loop`, `salvar_wav`, `ler_wav` |
| [`som/mixador.py`](som/mixador.py) | Mixagem multicanal por deixas, ducking automático da ambiência sob fala (-9 dB), normalização `loudnorm` em 2 passadas (-14 LUFS, -1 dBTP) e auditoria | `mixar_timeline`, `curva_ducking`, `normalizar_loudnorm_2passadas`, `auditar_wav` |
| [`som/cli.py`](som/cli.py) | Interface de linha de comando para exportar catálogo, mixar planos e auditar WAVs | `main` |

---

## 3. Conceito de "Deixa" (Ação + Efeito Visual + Som)

Uma **deixa** liga, num único objeto do roteiro JSON, o que o personagem faz, qual partícula/efeito visual nasce na tela e qual efeito sonoro toca no mesmo instante:

```json
{
  "id": "pouso_mangaio_1",
  "t": 2.05,
  "camada": "frente",
  "pos": [465, 1098],
  "acao": { "alvo": "mangaio", "movimento": "quicar", "dur": 0.85, "params": { "altura": 195 } },
  "efeito": { "id": "poeira_pouso", "dur": 0.80, "escala": 1.25, "semente": 5 },
  "som": { "id": "pouso_cheio", "vol": 0.92 }
}
```

Além de `"t"` explícito (em segundos da cena), uma deixa pode usar `"ancora"` relativa a uma fala:
- `{"fala": 0, "ref": "ini", "d": 0.2}` (0,2 s após o início da fala 0)
- `{"fala": 1, "ref": "fim", "d": -0.1}` (0,1 s antes do fim da fala 1)
- `{"fala": 1, "ref": "palavra", "palavra": "poeira", "d": 0.0}` (exatamente na palavra `"poeira"`)

Se `"som"` for omitido na deixa e o efeito visual tiver um som padrão no catálogo (`catalogo.json > efeito_para_som`), o `montador.py` preenche o som automaticamente.

---

## 4. Camadas e Paralaxe

Cada cena organiza o mundo em quatro camadas SVG que respondem à câmera com fatores de paralaxe distintos, mais uma camada de UI fixa:

| Camada | Paralaxe padrão | Uso |
|---|---|---|
| `fundo` | `0.3` | Céu, sol/lua, serra em dois planos, régua distante do açude |
| `meio` | `0.7` | Construções, umbuzeiro, bancas de feira, forno de barro, fachada do Mercadinho |
| `frente` | `1.0` | Chão de terra, marcadores/personagens, props e efeitos de contato (`poeira_pouso`, `poeira_passo`) |
| `frente_sobreposta` | `1.15` | Partículas em primeiro plano (`folhas_caindo`, `chuva`) |
| `ui` | `0.0` | Fixa na tela: legenda na zona segura 9:16, cartela `"continua..."` e assinatura |
