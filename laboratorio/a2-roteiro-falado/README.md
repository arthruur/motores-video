# A2 · Roteiro falado: dicionário de siglas, normalização no fim, direção com limites e checagem de fidelidade

**Pergunta:** os quatro problemas do A1 (siglas faladas errado, normalização desfeita pelo diálogo, direção teatral, fato distorcido) se resolvem com regra e processo, sem trocar de modelo?

**Resposta curta:** a maior parte, sim.
- **Siglas e números:** a conversão da forma escrita para a falada passou a ser uma regra, aplicada no último passo e com o dicionário da série. Funcionou em todas as amostras.
- **Fato distorcido:** um segundo LLM, como checador, **pegou a distorção do A1**.
- **Novo problema:** explicar cada sigla dobra o tamanho do texto.

## Caminho

O roteiro fica sempre na **forma escrita**, a mesma da legenda. A conversão para a **forma falada** é o último passo antes do TTS e não usa LLM: `falar()` aplica `siglas.json`, frações, porcentagens e números por extenso.

| Amostra | O que muda |
|---|---|
| E1 · Escrito + normalização | O texto original, só com a conversão por regra. Sem LLM |
| E2 · Ouvido + normalização | 1ª passada com o dicionário da série (o LLM explica a sigla, mas a pronúncia sai da regra) |
| E3 · Dirigido: contida, média, expressiva | O mesmo texto do E2; a direção vem com limites (nada teatral, no máximo 5 notas, sem devolver o texto) |
| E4 · Diálogo | Regras de fidelidade no prompt; conversão por regra fala a fala |
| Checagem de fidelidade | LLM checador: fatos da origem × roteiro (mantido, alterado, ausente, acrescentado) |

```powershell
python laboratorio/a2-roteiro-falado/lab.py            # tudo + Whisper + saida/escuta.html
python laboratorio/a2-roteiro-falado/lab.py --sem-qa
```

Reaproveita as funções do A1: cache, Gemini, página de escuta e a troca para modelo reserva.

## Resultado

| Amostra | Áudio |
|---|---|
| E1 · Escrito + normalização | 41,8 s |
| E2 · Ouvido + normalização | 79,7 s |
| E3 · Contida / média / expressiva | 87,7 / 85,9 / 84,4 s |
| E4 · Diálogo | 75,8 s |

Checagem de fidelidade (1ª rodada, antes de dar o dicionário ao checador):

| Roteiro | Problemas reais encontrados |
|---|---|
| Diálogo do A1 | **"77% dos estabelecimentos" tratado como "a maior parte da produção"** (a distorção que tinha passado) e "pode percorrer centenas de km" virando certeza |
| Diálogo do E4 | "pode percorrer" virando certeza. A troca de "estabelecimentos" por "produção" não se repetiu |
| Ouvido do E2 | Nenhum (os apontamentos eram só explicações de sigla) |

Na 1ª rodada, o checador marcou como "acrescentado" toda explicação de sigla vinda do dicionário. Isso é falso positivo: o prompt agora recebe o dicionário como contexto permitido. A 2ª rodada não terminou: as cotas e a sobrecarga do Gemini (ver abaixo) a interromperam.

## O que aprendi

- **A pronúncia não é trabalho do LLM.** Com o roteiro sempre na forma escrita e a conversão por regra no fim, siglas e números saem certos em todas as amostras, inclusive no diálogo. E a legenda já tem a grafia correta, sem esforço extra.
- **Explicar toda sigla dobra o tamanho.** O E2 foi de 42 para 80 s. Num episódio de 60 a 90 s, cada sigla precisa de uma decisão: explicar, trocar por uma palavra comum ("a merenda escolar" em vez de "PNAE") ou cortar. O dicionário deve ter um campo para isso (`tratamento: explicar | trocar | manter`).
- **O checador de fidelidade funciona** e pega o tipo de erro que o autor não vê: o número que passa a medir outra coisa, e o "pode" que vira certeza. Ele precisa receber o dicionário, ou acusa as explicações como fato novo.
- **A direção com limites ficou sóbria.** Nada de suspiro nem de "tom enfadado". A diferença entre as três intensidades está para o seu ouvido decidir.
- **O TTS pode recusar um prompt por segurança.** Uma das gerações do "expressivo" voltou sem áudio (`SAFETY`) e passou na segunda tentativa. O motor precisa tentar de novo.
- **O nível gratuito do Gemini não aguenta uma pipeline.**
  - O `gemini-3.5-flash` tem **20 pedidos por dia**.
  - Os modelos de texto devolveram 503 ("high demand") por vários minutos, inclusive os reservas.
  - O Lyria (música) também não tem cota grátis.

  Para produção, ou se paga o nível pago (que é barato), ou se distribui o trabalho: o LLM local da Prensa (Qwen) para as passadas de roteiro e o Gemini só para o TTS.

## Pendente

- Rodar de novo a checagem de fidelidade (com o dicionário) e o Whisper, quando a cota voltar.
- A sua escuta das intensidades do E3 e do diálogo do E4: `saida/escuta.html`.
