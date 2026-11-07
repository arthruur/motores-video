# A1 · Do roteiro seco à narração dirigida (Gemini TTS)

**Pergunta:** quanto da qualidade de uma narração vem do roteiro e da direção, e quanto vem do modelo de voz? Tese de partida: um TTS perfeito lendo um texto seco produz um áudio seco.

**Resposta curta:** no Gemini 3.1 Flash TTS, o texto seco já sai bom, e reescrever para o ouvido mudou pouco de ouvido. O que mudou de verdade foi a **direção** (perfil, cena e notas antes do texto) e o **diálogo** entre dois personagens. Entre os modelos, a sensação foi de "tanto faz", com uma exceção: o 3.8 se afastou do texto.

## Caminho

O mesmo trecho de *Aventuras do Mangaio* (`trecho.txt`, um parágrafo informativo com siglas, porcentagem, fração e unidade) passa por degraus. Cada degrau gera um áudio:

| Degrau | O que muda | Prompt |
|---|---|---|
| 0 · Seco | O texto como foi escrito para ler, direto no TTS | — |
| 1 · Ouvido | 1ª passada de LLM: siglas e números como se falam, frases de um fôlego | `prompts/1-ouvido.md` |
| 2 · Dirigido | 2ª passada de LLM: perfil da voz, cena e notas de direção antes do texto | `prompts/2-direcao.md` |
| 3 · Diálogo | O texto do degrau 1 virado conversa NARRADOR × CESTA, numa chamada com dois falantes | `prompts/3-dialogo.md` |
| 4 · Modelos | O prompt do degrau 2 no `gemini-3.8-flash-tts`; o texto do degrau 1 no edge-tts e no ElevenLabs v3 | — |

LLM das passadas: `gemini-3.5-flash`. TTS: `gemini-3.1-flash-tts-preview`, vozes prontas Charon (narrador) e Puck (cesta).

```powershell
python laboratorio/a1-gemini-tts/lab.py                 # tudo + checagem pelo Whisper + saida/escuta.html
python laboratorio/a1-gemini-tts/lab.py --sem-comparar  # só o Gemini
python laboratorio/a1-gemini-tts/lab.py --sem-qa        # sem o Whisper (mais leve)
```

Precisa de `GEMINI_API_KEY` no `.env` da raiz. O `ELEVENLABS_API_KEY` só é usado na comparação. Tudo fica em cache (`saida/cache`), então rodar de novo só gera o que mudou.

## Resultado

| Degrau | Áudio | Gerado em | Whisper | De ouvido (Arthur) |
|---|---|---|---|---|
| 0 · Seco | 38,6 s | 17,7 s | 93,5% | Bom; poucas diferenças em relação ao degrau 1 |
| 1 · Ouvido | 53,4 s | 60,7 s | 83,6%* | Parecido com o seco |
| 2 · Dirigido | 67,0 s | 24,9 s | 84,3%* | **Bem interessante** |
| 3 · Diálogo | 68,8 s | 56,5 s | 93,8% | **Interessante** |
| 4 · `gemini-3.8-flash-tts` | 83,1 s | 18,9 s | 84,3%* | Pareceu alucinar e divergir do texto |
| 4 · `gemini-2.5-pro-preview-tts` | — | — | — | Cota zero no nível gratuito |

\* A nota do Whisper caiu nos degraus 1 a 4 por um defeito da métrica, não da fala. O texto de referência estava escrito foneticamente ("O-N-U", "Í-Bê-Gê-É", "por cento"), e o Whisper escreve "ONU", "IBGE" e "%". Para comparar degraus, a referência precisa ser a grafia normal.

## O que aprendi

- **A direção vale mais que a reescrita**, pelo menos no Gemini. O 3.1 já lê siglas e números razoavelmente sozinho; a 1ª passada ajudou pouco de ouvido. Já perfil, cena e notas mudaram a interpretação.
- **O LLM não sabe como cada sigla é falada.** A 1ª passada soletrou "ONU" ("O-N-U") e "CEASA" ("Cê-á-sa"), que se falam como palavra. É preciso um dicionário de siglas da série, com a forma falada de cada uma, entregue ao LLM junto com o prompt. Não dá para confiar na regra genérica.
- **A passada de diálogo desfez a normalização.** Ela trabalhou a partir do texto do degrau 1, mas devolveu as siglas cruas (FAO, IBGE, PAA, PNAE). A normalização tem de ser o **último** passo antes do TTS, e não o primeiro.
- **O LLM distorceu um fato no diálogo.** "77% dos estabelecimentos" virou resposta para "de onde vem a maior parte da produção?", que é outra coisa. Isso aconteceu mesmo com a regra explícita de não mudar fatos. A revisão humana do roteiro é obrigatória, e vale ter uma checagem automática que compare os fatos do diálogo com os do texto de origem.
- **A direção ficou exagerada.** As notas pediram "suspiro de lamentação" e "tom enfadado". Para uma série calma, o prompt de direção precisa de limites (por exemplo, "no máximo X intenções por parágrafo, nada teatral").
- **Diálogo com dois falantes numa chamada só funciona bem** e é o caminho natural para "narrador + personagens". O limite é de dois falantes por chamada; mais personagens exigem várias chamadas, uma por par.
- **Os modelos mais novos não são automaticamente melhores.** O 3.8 durou 25% a mais e se afastou do texto. Para narração com legenda sincronizada, fidelidade ao texto conta mais que expressividade.
- **Limites do nível gratuito:** o TTS do Gemini Pro tem cota zero, e o Flash aceita poucos pedidos por minuto (o lab espera e tenta de novo). O Whisper na CPU, checando vários áudios de cerca de 1 min seguidos, chegou a cair com a memória cheia. O lab guarda cada resultado assim que fica pronto.

## Próximo (A2)

- Um dicionário de siglas e termos da série (forma escrita → forma falada), usado pelo LLM e conferido pelo Whisper com a grafia normal como referência.
- Direção com limites e duas ou três intensidades ("contida", "média", "expressiva") para comparar de ouvido.
- Uma checagem de fidelidade: o LLM lista os fatos do texto de origem e os do roteiro final, e aponta o que mudou.
