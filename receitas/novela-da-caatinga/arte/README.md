# Novela da Caatinga · Bíblia de Arte e Animação

A [`biblia.md`](../biblia.md) decide a **história** (mundo, elenco, tom, roteiros). Esta pasta decide **como tudo se parece e se move**. O alvo é uma animação de nível de estúdio, com direção de arte única: elenco, cenários, frutas, objetos e efeitos no mesmo nível de acabamento do Cesto.

## O que tem aqui

| Arquivo | O que decide | Quem usa |
|---|---|---|
| [`ARTE.md`](ARTE.md) | **Guia de estilo**: a regra-mãe, forma, cor, luz, textura, rosto, proporção | Todo mundo, sempre primeiro |
| [`paleta.json`](paleta.json) | Cores com nome: rampas de material, luz de cada lugar, cor de cada personagem | Ilustração, motor |
| [`personagens/`](personagens/) | **Bíblia de cada personagem**: personalidade visual, silhueta, cores, model sheet pedido, expressões, poses, nunca | Design de personagem |
| [`cenarios.md`](cenarios.md) | Lugares, layout vertical, luz e color script por arco | Cenário |
| [`objetos-e-efeitos.md`](objetos-e-efeitos.md) | Frutas de cena, acessórios, props e efeitos (poeira, néon, chuva, brilho) | Props, FX |
| [`animacao.md`](animacao.md) | Atuação, timing, princípios, rig (peças e pivôs), bocas, repertório do Cesto, câmera | Animação, motor |
| [`producao-de-arte.md`](producao-de-arte.md) | **Pipeline**: gerador de imagem → Illustrator → SVG em camadas → rig → teste. Prompts, nomes de camada, exportação, checklist | Quem produz os assets (você + agente) |

## O plano

O trabalho segue a ordem de um estúdio: **fundação → âncora → elenco → mundo → integração**. Nada entra no motor sem passar pelo portão de aprovação (ver [`producao-de-arte.md`](producao-de-arte.md#portao)).

| Fase | Entrega | Pronto quando |
|---|---|---|
| **0. Fundação** | `ARTE.md`, `paleta.json` e fichas aprovados por você | Você lê e assina embaixo das regras |
| **1. Âncora: o Cesto** | Model sheet completo do Cesto (5 vistas, expressões, poses do repertório) a partir do `mascote.svg` | O Cesto existe em todas as vistas sem perder a marca |
| **2. Lineup de silhuetas** | Todo o elenco em silhueta preta, lado a lado, na escala certa | Cada um se reconhece só pela sombra |
| **3. Elenco do arco 1** | Por personagem: exploração → design aprovado → model sheet → vetor em camadas → rig → teste de movimento | Passa no lineup ao lado do Cesto |
| **4. Cenários do arco 1** | Feira, Mercadinho, açude, umbuzeiro, estrada, casa de farinha (cap. 4 em diante) | Elenco pousado no cenário sem "colar" |
| **5. Props e efeitos** | Frutas de cena, sachê, mala, óculos, colher, cuia, poeira, néon, brilho | Tudo na rampa de tons |
| **6. Integração** | Cap. 1 refeito com os assets novos | Folha de contato aprovada lado a lado com a versão antiga |

**Ordem do elenco (fase 3)**, pela necessidade do arco 1: Dona Mandioca → Licuri → Realçador → Maxixe e Quiabo → Umbu → Mandacaru → Jataí → Seu Caju → Seu Sacolão (arco 2).

## Quadro de status

Atualize a cada entrega. Estados: `—` não começou · `explorando` · `design ok` · `model sheet` · `vetor` · `rig` · `✅ aprovado`.

| Asset | Design | Model sheet | Vetor | Rig | Teste |
|---|---|---|---|---|---|
| Cesto | ✅ (marca) | v0 (expressões, conteúdo, quique; faltam 3/4, perfil, de cima) | ✅ frente | parcial (olhos, braços) | — |
| Dona Mandioca | — | — | — | — | — |
| Licuri | — | — | — | — | — |
| Realçador | — | — | — | — | — |
| Maxixe | — | — | — | — | — |
| Quiabo | — | — | — | — | — |
| Umbu | — | — | — | — | — |
| Mandacaru | — | — | — | — | — |
| Jataí | — | — | — | — | — |
| Seu Caju | — | — | — | — | — |
| Seu Sacolão | — | — | — | — | — |
| Feira de sábado | — | — | — | — | — |
| Mercadinho Sabor Já | — | — | — | — | — |
| Beira do açude | — | — | — | — | — |

## Como o agente trabalha nesta pasta

1. Lê `ARTE.md` e a ficha do que vai fazer. Sem isso, não produz nada.
2. Trabalha **um asset por vez** e não pula etapa do quadro de status.
3. Escreve os prompts para o gerador de imagem a partir dos blocos de [`producao-de-arte.md`](producao-de-arte.md#prompts), sempre com o Cesto como imagem de referência.
4. Gera a **folha de comparação** (o asset novo ao lado do Cesto, na escala da tabela de proporções) antes de pedir aprovação.
5. Registra cada decisão na ficha do personagem (seção "Decisões") e atualiza o quadro de status.
6. Quando uma regra de `ARTE.md` atrapalhar, propõe a mudança para você. Não abre exceção sozinho.

## Estado atual (7 nov. 2026)

O cap. 1 já roda inteiro no motor, mas o elenco foi desenhado em código: contorno escuro, cor chapada, rosto de rig genérico. Ao lado do Cesto, que é ilustração de marca com volume e textura, parece outra série. Esta bíblia existe para fechar essa distância. A folha de contato de referência ("antes") é `saida/novela-da-caatinga/teste.png`.
