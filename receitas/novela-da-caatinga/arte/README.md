# Novela da Caatinga · Bíblia de Arte e Animação

A [`biblia.md`](../biblia.md) decide a **história** (mundo, elenco, tom, roteiros). Esta pasta decide **como tudo se parece e se move**. O alvo é uma animação de nível de estúdio, com direção de arte única: elenco, cenários, frutas, objetos e efeitos no mesmo nível de acabamento do Cesto.

## O que tem aqui

| Arquivo | O que decide | Quem usa |
|---|---|---|
| [`ARTE.md`](ARTE.md) | **Guia de estilo**: a regra-mãe, forma, cor, luz, textura, rosto, proporção | Todo mundo, sempre primeiro |
| [`paleta.json`](paleta.json) | Cores com nome: rampas de material, luz de cada lugar, cor de cada personagem (`paleta-caatinga.vcswatches` e `.ase` gerados) | VectorCraft, Ilustração, motor |
| [`pipeline.py`](pipeline.py) | **Automação VectorCraft CLI + Gemini API**: pré-processamento cel-shaded, vetorização sem contorno, simplificação de nós, auditoria/rig via Gemini Vision e gerador de lineup | Quem produz e vetoriza os assets |
| [`personagens/`](personagens/) | **Bíblia de cada personagem**: personalidade visual, silhueta, cores, model sheet pedido, expressões, poses, nunca | Design de personagem |
| [`cenarios.md`](cenarios.md) | Lugares, layout vertical, luz e color script por arco | Cenário |
| [`objetos-e-efeitos.md`](objetos-e-efeitos.md) | Frutas de cena, acessórios, props e efeitos (poeira, néon, chuva, brilho) | Props, FX |
| [`animacao.md`](animacao.md) | Atuação, timing, princípios, rig (peças e pivôs), bocas, repertório do Cesto, câmera | Animação, motor |
| [`producao-de-arte.md`](producao-de-arte.md) | **Pipeline**: Gemini/GPT → VectorCraft (`vectorcraft-cli`) → SVG em camadas → rig → lineup. Prompts, comandos CLI, checklist | Quem produz os assets (você + agente) |
| [`folhas/`](folhas/) | Pranchas de escala ([`lineup-escala.png`](folhas/lineup-escala.png)) e silhueta ([`lineup-silhuetas.png`](folhas/lineup-silhuetas.png)) no padrão Warner *Main Model Size Comparison* | Direção de arte, motor |
| [`banco/`](banco/) | SVGs finais vetorizados, limpos e rigados por personagem (`<id>-frente.svg`, `.png` e `relatorio.json`) | Motor de animação |

## O plano

O trabalho segue a ordem de um estúdio: **fundação → âncora → elenco → mundo → integração**. Nada entra no motor sem passar pelo portão de aprovação (ver [`producao-de-arte.md`](producao-de-arte.md#portao)).

| Fase | Entrega | Pronto quando |
|---|---|---|
| **0. Fundação** | `ARTE.md`, `paleta.json`, `paleta-caatinga.vcswatches` e fichas aprovados | Você lê e assina embaixo das regras |
| **1. Âncora: o Cesto** | Model sheet completo do Cesto (5 vistas, expressões, poses do repertório) a partir do `mascote.svg` | O Cesto existe em todas as vistas sem perder a marca |
| **2. Lineup de escala e silhuetas** | Elenco lado a lado na linha de chão na escala certa ([`folhas/lineup-escala.png`](folhas/lineup-escala.png)) + silhueta preta ([`folhas/lineup-silhuetas.png`](folhas/lineup-silhuetas.png)) | Cada um se reconhece só pela sombra |
| **3. Elenco do arco 1** | Por personagem: exploração → design aprovado → model sheet → vetor (`vectorcraft-cli`) → rig → teste de movimento | Passa no lineup ao lado do Cesto |
| **4. Cenários do arco 1** | Feira, Mercadinho, açude, umbuzeiro, estrada, casa de farinha (cap. 4 em diante) | Elenco pousado no cenário sem "colar" |
| **5. Props e efeitos** | Frutas de cena, sachê, mala, óculos, colher, cuia, poeira, néon, brilho | Tudo na rampa de tons |
| **6. Integração** | Cap. 1 refeito com os assets novos | Folha de contato aprovada lado a lado com a versão antiga |

**Ordem do elenco (fase 3)**, pela necessidade do arco 1: Dona Mandioca → Licuri → Realçador → Maxixe e Quiabo → Umbu → Mandacaru → Jataí → Seu Caju → Seu Sacolão (arco 2).

## Quadro de status

Atualize a cada entrega. Estados: `—` não começou · `explorando` · `design ok` · `model sheet` · `vetor` · `rig` · `✅ aprovado`.

| Asset | Design | Model sheet | Vetor (`banco/`) | Rig | Teste |
|---|---|---|---|---|---|
| Cesto (Mangaio) | ✅ (marca) | v2 🟡 aguardando portão (`folhas/cesto-folha.png`: vistas, expressões, conteúdo, poses, silhuetas, braços v2; **falta de cima**) | ✅ frente · 🟡 3/4 · 🟡 perfil · 🟡 costas (v2 montadas à mão com peças oficiais; a v1 rastreada reprovou) | 🟡 `banco/cesto/mangaio-rig.svg` (pivô no ombro via `.giro`; refeito após a falha do braço alto) | 🟡 demo `demos/mangaio` (giro 0/40/-28° nas peças: ok); v1 falhou: braço soltava no giro |
| Dona Mandioca | design ok (`referencias/dona-mandioca-frente.png`) | v2 `folhas/dona-mandioca-folha.png` (rig paramétrico desenhado à mão: frente, 3/4, perfil, 3/4 de costas, costas; 13 expressões, 8 bocas, 8 poses, escala) | 🟡 em revisão (`banco/dona-mandioca/`; falta a vista de cima) | rig v2 em toda vista (`dona-mandioca-rig.svg` e vistas, `data-pivo`); testado no motor na demo `demos/dona-mandioca/` | — (aguarda aprovação: rosto 0,58, rampas `mandioca_casca` v1 e `algodao_cru`) |
| Licuri | ✅ `referencias/licuri.png` | parcial (expressões + poses em `licuri.png`) | ✅ `banco/licuri/licuri-frente.svg` | ✅ grupos + pivô | lineup ok |
| Realçador | — | — | — | — | — |
| Maxixe | — | — | — | — | — |
| Quiabo | — | — | — | — | — |
| Umbu | ✅ `referencias/umbu-frente.png` | — | ✅ `banco/umbu/umbu-frente.svg` | ✅ grupos + pivô | lineup ok |
| Mandacaru | ✅ `referencias/mandacaru-frente.png` | — | ✅ `banco/mandacaru/mandacaru-frente.svg` | ✅ grupos + pivô | lineup ok |
| Jataí / Mandaçaia | ✅ `referencias/mandassaia-frente.png` | — | ✅ `banco/jatai/jatai-frente.svg` | ✅ grupos + pivô | lineup ok |
| Seu Caju | — | — | — | — | — |
| Seu Sacolão | — | — | — | — | — |
| Feira de sábado | — | — | — | — | — |
| Mercadinho Sabor Já | — | — | — | — | — |
| Beira do açude | — | — | — | — | — |

## Como o agente trabalha nesta pasta

1. Lê `ARTE.md` e a ficha do que vai fazer. Sem isso, não produz nada.
2. Trabalha **um asset por vez** e não pula etapa do quadro de status.
3. Usa [`pipeline.py`](pipeline.py) (`vectorcraft-cli` + Gemini API) para gerar folhas novas (`gerar`), vetorizar sem contornos (`vetorizar`), auditar cores/peças do rig e atualizar o lineup (`lineup`).
4. Gera a **folha de comparação** ([`folhas/lineup-escala.png`](folhas/lineup-escala.png) e [`folhas/lineup-silhuetas.png`](folhas/lineup-silhuetas.png)) antes de pedir aprovação final.
5. Registra cada decisão e rampa medida na ficha do personagem e atualiza o quadro de status.
6. Quando uma regra de `ARTE.md` atrapalhar, propõe a mudança para você. Não abre exceção sozinho.

## Estado atual (7 nov. 2026)

As 6 referências visuais em [`referencias/`](referencias/) (`cesto-frente.png`, `dona-mandioca-frente.png`, `umbu-frente.png`, `licuri.png`, `mandacaru-frente.png`, `mandassaia-frente.png`) já foram processadas pelo pipeline **VectorCraft CLI + Gemini Vision**, gerando vetores SVG sem contorno e rigados em [`banco/`](banco/) e as pranchas de comparação em [`folhas/lineup-escala.png`](folhas/lineup-escala.png) e [`folhas/lineup-silhuetas.png`](folhas/lineup-silhuetas.png). Faltam explorar o design inicial de **Realçador**, **Maxixe & Quiabo**, **Seu Caju** e **Seu Sacolão**, além dos turnarounds e cenários do Arco 1.
