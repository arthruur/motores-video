# Próximos episódios · formato explicativo

9 de nov. de 2026 · Arthur

> Panorama de temas para a série no **formato explicativo** testado em "A Despensa do Sertão" e "O Mapa da Fome". Não é uma grade fechada: é um banco de ideias, organizado em blocos que podem virar arcos de uma temporada. A bíblia ([`biblia.md`](biblia.md)) continua valendo para tom, elenco e regras.

## O formato

Referência de origem: os reels do perfil *Engenharia do Sertão* (análise com o rea-video em 2026-11-08).

- **60 a 70 s**, vertical, um ou poucos cenários fixos.
- **Narrador em 2ª pessoa** ("você descasca, você mexe"); o **Mangaio é o "você"** que faz cada passo, sem falar. A Dona Mandioca (ou outro do elenco) entra no máximo uma vez, com o bordão.
- **Legenda palavra por palavra**, rótulo do conceito no topo ("TIPITI", "FOME ENDÊMICA"), chips de informação sobre a cena.
- **Gancho = um paradoxo** ("fora da terra, a mandioca estraga em 3 dias"; "a terra mais rica tinha a fome mais funda"). O episódio explica o paradoxo com um saber ou um fato.
- **Fecho sem moral falada**: um "parabéns" que devolve o saber a quem assiste, ou uma pergunta aberta.

**Teste do tema:** tem um paradoxo? tem um saber (ou fato) que o explica? tem um lugar para o Mangaio estar? Três sins, o tema serve.

**IA × feito à mão** (a linha decidida em 2026-11-08):

| Peça | Como |
|---|---|
| Cenário de fundo | Qwen-Image no Colab, sempre a partir de uma arte aprovada como referência (`ferramentas/easycolab_imagem.py`) |
| Personagens | Rigs em vetor (Mangaio, Dona Mandioca); nunca gerados por IA na versão final |
| Objetos, mapas, efeitos | Vetor e procedural; mapa a partir da malha oficial do IBGE |
| Narração | TTS (Gemini hoje, fala natural sem sotaque). Teste do VoxCPM pendente |
| Fatos | Conferidos na fonte antes da voz; tabela de fatos no `roteiro.json` de cada episódio |

**Receita no repositório:** `episodios/<id>/` com `roteiro.json` → `voz.py` (narração em uma tomada) → `som.py` (linha do tempo + mixagem) → `cena.js` → `gerar.mjs`. Modelos: [`episodios/despensa-do-sertao/`](episodios/despensa-do-sertao/) (um lugar, com elenco) e [`episodios/mapa-da-fome/`](episodios/mapa-da-fome/) (três lugares, com mapa).

## Já feitos

| Episódio | Bloco | Status |
|---|---|---|
| A Despensa do Sertão (farinha) | 1 | Vídeo pronto; ouvir a voz e conferir fatos antes de postar |
| O Mapa da Fome (*Geografia da Fome*) | 2 | Vídeo pronto; idem; legenda do post escrita |

## Bloco 1 · Despensas do sertão

*Como o sertão guarda comida, água e futuro.*

| Episódio | Gancho (paradoxo) | Lugar | Conferir |
|---|---|---|---|
| A árvore que tem caixa-d'água | O umbuzeiro guarda água em "batatas" debaixo da terra | sertão (já existe) | Embrapa Semiárido: xilopódios guardam água, mucilagem e amido; **não usar número** |
| Rapadura | Uma barra de cana que atravessa meses de viagem no bolso | engenho de rapadura (fundo novo) | Processo e conservação |
| A despensa de água | Uma cisterna de placa guarda a chuva do ano inteiro | sertão | Programa de cisternas da ASA |
| Semente crioula | A despensa do ano que vem; a semente comprada nem sempre brota de novo | sertão / casa de sementes | Bancos comunitários de sementes do semiárido |
| Manteiga de garrafa e queijo coalho | Como guardar leite sem geladeira | cozinha / curral | Processo e conservação |

## Bloco 2 · A geografia do prato

*Por que cada lugar come o que come.*

| Episódio | Gancho | Lugar | Conferir |
|---|---|---|---|
| Pântanos alimentares | Rua cheia de comida, nenhuma comida de verdade | cidade grande (fundo novo) | MDS 2024/25: 32% em desertos e 19% em pântanos, **nas 91 maiores cidades**; não vale para o sertão rural |
| Quem planta o Brasil | 77% dos estabelecimentos, em só 23% da terra | mapa | Censo Agro 2017 (IBGE); dizer sempre os dois números |
| A merenda que vem da roça | Por lei, 45% da merenda tem que vir da agricultura familiar | escola (fundo novo) | Lei 15.226/2025 (PNAE, em vigor desde 01/01/2026) |
| O que é ultraprocessado | "Sabor carne" sem carne | feira × prateleira | Classificação NOVA (NUPENS/USP); Guia Alimentar |

## Bloco 3 · Valor e preconceito

*Por que a gente acha que luxo é o que vem embalado.* O tema central da série.

| Episódio | Gancho | Lugar | Conferir |
|---|---|---|---|
| Comida de pobre, preço de gourmet | Tapioca e cuscuz: "simples" na feira, R$ 39,90 no café da cidade | feira × café da cidade | Preços reais de exemplo, sem citar marca |
| A castanha que veio de avião | O licuri do lado de casa contra a castanha importada | feira | Origem e cadeia do licuri |
| Fruta feia | Por que a fruta "feia" sobra e vira desperdício | feira (já existe) | Dados de desperdício; padrões de classificação |
| Quem fica com o preço | O caminho de um caju até a mesa | feira / estrada | Atravessador; exemplo ilustrativo, sem número inventado |
| PANC | Mato ou comida? Palma e ora-pro-nóbis | roça | Embrapa Semiárido |
| Comida trancada | Safra recorde de azeite na Espanha, e o governo manda guardar parte dela para o preço não cair | mapa / armazém (fundo novo) | Notícia vista em 2026-11-08 (BFMTV, 7/11): ~12% da produção (~188 mil t) retida até set/2027. **Conferir na fonte oficial** (governo espanhol, regra de mercado da UE) antes de roteirizar. Tom da bíblia: o alvo é o sistema que precisa de escassez para o preço, nunca o produtor nem quem compra. Liga com o Josué ("o que a gente planta, e pra quem?") |

## Bloco 4 · A terra que dá

*Natureza e convivência com o semiárido.*

| Episódio | Gancho | Lugar | Conferir |
|---|---|---|---|
| A abelha sem ferrão | Sem abelha nativa, não tem umbu | caatinga em flor | Mandaçaia (*Melipona mandacaia*) e jandaíra são as abelhas-símbolo; a Jataí ocorre, mas é generalista |
| O único bioma só nosso | A caatinga só existe no Brasil | caatinga | Fonte oficial do bioma |
| Licuri e a arara-azul-de-lear | Um coquinho que sustenta uma ave rara | Raso da Catarina (fundo novo) | ICMBio/CEMAVE: censo 2024 = 2.548 aves |
| Botei flor, vai chover | O que o povo sabe e o que a ciência diz sobre o mandacaru | alto da serra | Saber popular documentado (Luiz Gonzaga, 1953); **não há estudo que valide a previsão**; tratar com respeito, sem virar ciência |

## Fora do formato explicativo

- **Episódios da Dona Mandioca**, mais perto da sitcom: saberes da avó do Arthur (dia de São José para plantar, comer junto, aproveitar tudo). Servem de intervalo entre os explicativos. Juntar as falas e ditados dela antes de roteirizar.
- **Episódio de prestígio sem fala** (já previsto na bíblia): só imagem e trompete. Ideia: um ano do sertão em 60 s, da seca à colheita.

## Produção

- **Ritmo possível:** um explicativo por semana.
- **Fundos em lote:** uma sessão de Colab (G4, ~10 unidades/h; ~6 min só para carregar o modelo do Drive) gera os cenários de vários episódios. Fundos já prontos: casa de farinha vazia, canavial, sertão. Novos que os blocos pedem: engenho de rapadura, cidade grande, escola, caatinga em flor, Raso da Catarina.
- **Sugestão dos próximos três:** "A árvore que tem caixa-d'água" (reaproveita o sertão), "Comida de pobre, preço de gourmet" (tema central), "Pântanos alimentares" (ponte com o Josué).

## Pendências

- [ ] Ouvir as duas narrações e conferir os fatos antes de postar (ver o `README.md` e o `roteiro.json` de cada episódio).
- [ ] Testar o **VoxCPM** no Colab para a narração (o Gemini ainda soa como IA). Conferir a qualidade em português, que não é o foco do treino dele. Clonar uma voz real da região só com autorização da pessoa.
- [ ] Juntar os saberes e frases da avó para os episódios da Dona Mandioca.
- [ ] Pesquisa de apoio no NotebookLM (Josué de Castro, Guia Alimentar, Embrapa, ASA).
