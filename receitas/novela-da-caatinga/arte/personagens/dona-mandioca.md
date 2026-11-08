# Dona Mandioca · bíblia do personagem

**Tipo:** positiva (matriarca) · **Altura:** 1,35 cesto · **Rampas:** `mandioca_casca`, `mandioca_miolo`, `lenco_vermelho`

## Em uma frase
A dona da casa de farinha: manda em todo mundo, reclama de tudo e é a primeira a abrir a porta quando alguém precisa.

## Anatomia: o ingrediente real
Raiz de mandioca: comprida, levemente cônica e torta, **casca marrom fina e rugosa em faixas** que descasca em lascas, e **miolo branco** que aparece no corte do topo. Raízes finas na ponta de baixo.

## Da personalidade ao desenho
- **Matriarca, firme** → base larga e estável, postura ereta, quase nunca se curva. Quando se curva, é carinho.
- **Mandona de coração mole** → o corpo é duro (casca), o topo é macio (miolo branco que aparece por baixo do lenço). A "cabeça" é a parte mais clara e mais suave dela.
- **Trabalhadeira** → avental de saco de farinha e a colher de pau sempre à mão.

## Silhueta e proporção
Coluna larga, um pouco mais estreita embaixo, levemente torta (nenhuma mandioca é reta). Rosto no terço superior, logo abaixo do lenço. As pontinhas de raiz embaixo funcionam como "pés" e "barra de saia". A silhueta se reconhece pelo **lenço amarrado com as pontas para cima**.

## Cores
Casca `mandioca_casca`, com lascas descascadas mostrando `mandioca_miolo`. Lenço `lenco_vermelho` com bolinhas brancas (`mandioca_miolo.luz`). Avental de saco de algodão cru, liso, com bolso (sem letreiro: decisão 2026-11-07).

## Rosto
Padrão, igual ao do Mangaio, sem sobrancelha (ARTE.md §6). O jeito mandão dela sai do olho `decidido` com a boca `firme` e do gesto com a colher. Bochechas: duas manchas de `lenco_vermelho.meio` a 30%, sem contorno.

## Figurino e acessórios
| Peça | Fixa? | Uso |
|---|---|---|
| Lenço vermelho de bolinha | Sim | Silhueta |
| Avental de saco de farinha | Sim | Trabalho |
| Colher de pau | Sim, na mão ou no avental | Bate na mesa (cap. 2), aponta, mexe |
| Folha de abano | Cap. 1 | Calor da seca |
| Cuia | Cap. 3 | Deixa cair no gancho |

## Model sheet pedido
Folha v2 (rig desenhado à mão em código, nada rastreado): [`../folhas/dona-mandioca-folha.png`](../folhas/dona-mandioca-folha.png), gerada por [`../folhas/dona_mandioca_folha.py`](../folhas/dona_mandioca_folha.py) (fonte editável: `../fonte/dona-mandioca-folha.vectorcraft`, uma prancheta por seção; peças avulsas em `../banco/dona-mandioca/`).

- [~] Turnaround 🟡 em revisão (portão §6 não passou): frente, 3/4, perfil, 3/4 de costas e costas saem do mesmo rig paramétrico (`dona_mandioca_rig.py`, a vista é o ângulo theta), cada uma com os mesmos ids · de cima: falta · os rascunhos `*-rascunho.svg` da v1 ficam só como registro
- [x] Expressões: as 11 + "ri segurando o riso", "fingindo pouco caso" (cap. 4)
- [x] Bocas (8)
- [x] Poses: mão na cintura, bater a colher (antecipação + batida), se abanar (com a folha do cap. 1), braços cruzados, abraço contido
- [ ] Detalhe: close, médio, geral
- [x] Silhueta (e escala ao lado do Mangaio, 1,35×)

## Peças do rig (frente)
Arquivo: `../banco/dona-mandioca/dona-mandioca-rig.svg` (ids documentados no topo; as outras vistas em `dona-mandioca-tres-quartos.svg`, `-perfil.svg`, `-costas.svg`, mesmos ids). Pés no chão em (640, 1195). Pivô: atributo `data-pivo="x y"` no próprio grupo (a mesma convenção do `mangaio-rig.svg`). Estado padrão do arquivo: olhos `oval`, sobrancelhas ocultas, `boca-repouso`, braço esq. reto com a colher, braço dir. na cintura.

| Grupo | O que é | Pivô |
|---|---|---|
| `dona-mandioca` | ela inteira | meio dos pés |
| `perna-esq`, `perna-dir` | tocos próprios em `mandioca_casca` com a pontinha de miolo; o topo entra ~70 px no tronco, escondido sob a barra | quadril de cada perna |
| `tronco` | tudo acima do quadril: squash, stretch, inclinação | quadril |
| `corpo` | tons empilhados (sombra, base, banda de luz alta à esquerda, meio, profunda embaixo à direita), miolo no topo, faixas de casca e 8 lascas de miolo longe do rosto | quadril |
| `acess-avental` | alças, peitilho, cós, saia, bolso (sem letreiro), X nas costas, laço | cintura |
| `acess-lenco` | lenço de bolinhas (follow-through: ±3°, chega atrasado) | nó |
| `rosto` | rosto padrão do Mangaio: `olho-*` (oval, arco, meia-lua, fechado, grande, triste, decidido), `sobr-*` (some por padrão), `boca` (8 de sincronia + 6 de expressão), `bochechas` | meio dos olhos |
| `braco-esq`, `braco-dir` | patinhas de luva (afinam do ombro à mão); subgrupos `braco-*-reto` (gira o `.giro`), `-cintura`, `-cruzado` | ombro |
| `prop-colher-<lado>` / `prop-abano-<lado>` | colher de pau (`madeira_banca`) / folha de abano (`folha`), dentro do `.giro` do braço reto | pega |

Combinações de cada expressão e pose: `EXPRESSOES` e `POSES` em `dona_mandioca_folha.py`.

## Atuação e movimento
Andar pesado e decidido, passos curtos. Gesticula com a colher como regente. Pausa antes da frase importante e se vira devagar para quem vai levar bronca. Quando está comovida, desvia o olhar e ajeita o lenço.

## Arco visual
Fixa. No tema "Mulheres na agricultura familiar" (temporadas futuras), ganha crachá de cooperativa.

## Nunca
Cintura marcada ou corpo "feminino" de pin-up. Avó caricata de cabelo grisalho humano. Ar de vítima.

## Prompt base
```
DONA MANDIOCA: an anthropomorphic cassava root, tall and slightly crooked,
wide stable base, thin rough brown bark peeling in strips that reveal white
flesh, a red headscarf with white polka dots tied with the knot ends pointing
up, an apron made of a cotton flour sack, holding a wooden spoon. A firm,
caring matriarch. Expression: one eyebrow raised, holding back a smile.
```

## Decisões
| Data | Decisão | Por quê |
|---|---|---|
| 2026-11-07 | Frente vetorial = geração do GPT limpa (sem granulado, cores da paleta) e rastreada no VectorCraft; rosto, braços, colher, laço e letreiro redesenhados como peças | O rastreamento não separa peças de rig, e o granulado do GPT é textura de filtro (proibida em ARTE.md §1) |
| 2026-11-07 | `mandioca_casca` esquentada (v1: base `#C46C36`) | A v0 (`#8C5A34`) deixava a raiz parda e apagava o rosto; a profunda era igual ao olho (`#462416`). A v1 segue a frente aprovada e conversa com a palha do Mangaio |
| 2026-11-07 | Nova rampa `algodao_cru` (proposta) para o avental | Não existia; separada do `mandioca_miolo`, que é quase igual ao papel da folha |
| 2026-11-07 | Rosto padrão na escala da largura dela (0,98 px por unidade do mascote, ≈ 0,48 do tamanho absoluto do Mangaio na escala 1,35) | O rosto do Mangaio ocupa ~60% da largura dele; no tamanho absoluto, os olhos dela ficariam mais afastados que a largura do corpo (0,6). **Proposta:** ARTE.md §3 passar a "mesma forma, tamanho pela largura do rosto"; aprovar ou recusar |
| 2026-11-07 | Sobrancelha = forma curta cheia em `#462416`, some na neutra; marca dela é a sobrancelha do lado esquerdo da tela levantada | Caso de teste da ARTE.md §6 |
| 2026-11-07 | Avental com laço desenhado à mão; letreiro "FARINHA" em lettering de pincel (Caveat Brush tremida letra a letra) em `algodao_cru.sombra` | O laço rastreado virava borrão; o carimbo apagado não pode ser marca |
| 2026-11-07 | Pernas = recorte da própria casca abaixo do quadril | Pés-toco: o andar dela é passo curto, sobe e desce, não balança de perna |
| 2026-11-07 | **Rig v2**: tudo desenhado à mão em código (`dona_mandioca_rig.py`), sem rastreamento; a vista é parâmetro (corpo = cilindro torto, peças da superfície projetadas) | Revisão de arte reprovou a v1 (casca de raster posterizado, emenda do quadril abrindo, 3/4 achatado, braços de régua). Substitui as linhas acima sobre rastreamento e pernas-recorte |
| 2026-11-07 | Pernas = tocos próprios com o topo escondido no tronco | A emenda da v1 abria no stretch; testado com tronco `translate(0,-30) scale(1,1.08)` e pernas a ±25° |
| 2026-11-07 | Rosto a 1,18 px/unidade (≈ 0,58 do absoluto do Mangaio), bocas mais 1,15× | Recomendação da revisão. **Ainda proposta**: a ARTE.md §3 pede o mesmo tamanho absoluto; aprovar ou recusar a exceção |
| 2026-11-07 | Bochecha em `lenco_vermelho.meio` a 30% (igual à ficha) | Rig v1 usava 38% |
| 2026-11-07 | **Ajustes finos (revisão do Arthur):** braços sem mão (ponta redonda segura a colher); curvas de "mão na cintura" e "braços cruzados" corrigidas (o braço direito estava invertido, cotovelo para dentro); rosto proporcional à cabeça (`ROSTO_K` 1,55 para o tamanho das peças, `ESPACO_K` 1,02 para o espaçamento, olhos subiram para y=404); sobrancelhas mais baixas para não entrar no lenço; avental sem o letreiro "FARINHA" | Mão separada e braço invertido deixavam os gestos estranhos; com o rosto no tamanho absoluto do Mangaio as expressões não liam numa cabeça alta e estreita; texto no figurino pesa na leitura. Regras levadas para ARTE.md §2, §3 e Nunca |
| 2026-11-07 | **Rosto refeito pela referência** (`referencias/dona-mandioca-frente.png`): olho ≈ 16% da largura da cabeça (`ROSTO_K` 1,10), centros a ≈ 48% (`ESPACO_K` 1,06), boca entre os olhos (`BOCA_K` 0,97), bochechas mais para fora. Corpo e paleta (`mandioca_casca` v1, `algodao_cru`) **aprovados** pelo Arthur. Demo em 2D: só vistas-chave (0/45/90/180/270/315), virada por troca de desenho | A versão anterior (olho 23%, olhos juntos) fazia a boca disputar espaço com os olhos; o giro de 15 em 15° complicava sem ganho (a série é 2D) |
| 2026-11-07 | **Expressões = as 9 do Mangaio, só adaptadas** (neutra com boca aberta, desconfiada, assustada, triste, encantada, decidida, rindo, envergonhada, "não vai"); sem sobrancelha; olhos sempre iguais; `ESPACO_K` = `ROSTO_K` = 1,10 (o rosto do Mangaio em escala uniforme). Folha e demo refeitas | As 13 expressões próprias (sobrancelhas, olhos assimétricos, bocas de fala como expressão) ficaram estranhas; as do Mangaio funcionam |
