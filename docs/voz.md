# Voz: narração, tempo de cada palavra e nota de precisão

> Conceito, decisões e números do `motores/voz`. A referência de uso (instalação, CLI, função, download dos modelos) está no [README do motor](../motores/voz/README.md).

## O problema

Para um vídeo narrado e legendado palavra a palavra, a voz precisa entregar três coisas:

1. **O áudio.** Grátis, local se possível, com uma voz que não canse.
2. **O instante de cada palavra**, com a grafia do roteiro (não a do reconhecedor), para a legenda destacar a palavra certa e a cena entrar na palavra certa.
3. **Uma conferência**: a voz disse o que estava escrito? TTS engole palavras, lê sigla errado e troca número.

E precisa ser **trocável**: hoje o edge-tts é grátis e bom, amanhã quebra; quem tem uma chave paga quer usar a voz paga; quem grava a própria voz quer usar a gravação.

## As decisões

### Uma chamada, vários provedores

`sintetizar(texto, provedor, voz, saida_wav)` é igual para todos. Trocar grátis por pago, ou nuvem por local, é trocar uma palavra. Cada provedor declara o que precisa (pacote, modelo, chave), e `python -m motores.voz.cli provedores` mostra o que está disponível e o que falta.

| Provedor | Onde | Tempo por palavra | Observação |
|---|---|---|---|
| `edge` | nuvem, grátis | nativo (WordBoundary) | **Só protótipo:** endpoint não oficial, sem termos de uso; já quebrou com erro 403 várias vezes desde 2024 |
| `kokoro` | local, CPU | alinhador | Kokoro-82M; pesos Apache-2.0, mas puxa código GPL-3.0 (phonemizer, espeak-ng). **Opcional** |
| `piper` | local, CPU | alinhador | muito rápido; motor GPL-3.0. **Opcional** |
| `azure` | nuvem, cota grátis mensal | nativo | as mesmas vozes do edge pelo caminho oficial; **não testado** (sem chave) |
| `elevenlabs` | nuvem, pago | nativo (por caractere) | **não testado** (sem chave) |
| `gravacao` | a sua voz | alinhador | `--limpar` aplica highpass + afftdn e apara as pontas |

**Nada é cobrado sem você pedir:** provedores pagos exigem a chave no ambiente **e** `permitir_pago=True` (`--permitir-pago`); a mensagem de erro diz quantos caracteres seriam enviados.

### O texto manda; o Whisper só empresta os tempos

Quando o provedor não dá o tempo de cada palavra, o **alinhador** roda o faster-whisper com `word_timestamps` e casa o que foi ouvido com o texto do roteiro (`difflib`, em subpalavras normalizadas: números por extenso, sem acento, siglas e hífens resolvidos). Cada palavra do roteiro sai com tempo e com um selo: **exata** (casou), **repartida** (uma palavra ouvida cobre várias do texto, ou o contrário) ou **estimada** (interpolada entre vizinhas). A legenda sai com a grafia certa mesmo quando o Whisper erra a palavra.

A mesma função (`casar`) também passa os tempos nativos do edge, do Azure e da ElevenLabs para a grafia original. Resultado: **uma palavra de saída por palavra do texto** (`texto.split()`), sempre. É isso que deixa o `exemplos/explicativo` saber a cena de cada palavra só pela ordem.

### O Whisper mede se a fala está certa, não se está boa

O QA transcreve o áudio de novo, **sem dica** (sem o texto como prompt, para não induzir), e compara com o roteiro: precisão em % e a lista de divergências. Isso pega palavra engolida, sigla lida errado e número trocado. **Não** mede entonação, naturalidade ou emoção: isso é ouvido humano.

Cuidado ao ler a nota: "INPE" vira "impe" em todos os motores, porque é assim que o Whisper escreve uma sigla lida como palavra. Siglas assim derrubam ~2 pontos sem a fala estar errada.

### Pronúncia é por motor

A grafia que conserta um motor estraga outro: "SUS" → "sús" conserta o Kokoro (que dizia "sos") e piora o Piper. Por isso `pronuncia.json` tem uma seção `todos` e uma por motor. A voz recebe a grafia trocada; a legenda e o alinhamento continuam com o texto original. **Só entra no dicionário o que foi medido** (gere com e sem a troca e compare a nota).

### Uma tomada contínua

No exemplo explicativo, o texto de todas as cenas vai numa chamada só. Cortar por cena e juntar dá pausas artificiais e muda a entonação de cada começo de frase. O custo é ter de recuperar a cena de cada palavra depois, o que o formato "uma palavra por palavra do texto" resolve.

## Números medidos

Notebook Ryzen 7 5700U, 19 GB, Windows 11, sem GPU; Python 3.13, faster-whisper 1.2.1 (`small`, int8), edge-tts 7.2.8, kokoro-onnx 0.6.1, piper-tts 1.8.0. Outros processos rodavam junto: tempos indicativos.

**Frase neutra de 43 palavras com números e siglas** (`exemplos/voz/frase.txt`), duas rodadas por voz:

| Provedor / voz | Áudio | Gerar | Alinhar | Precisão (Whisper) |
|---|---|---|---|---|
| edge / Antonio | 16,6 s | 1,7–3,7 s | nativo | 91,5% e 93,6% |
| edge / Francisca | 15,0 s | 2,6–2,8 s | nativo | 97,9% |
| kokoro / pf_dora | 13,2 s | 16,5–17,3 s | 10,4–13,3 s | 97,9% |
| kokoro / pm_alex | 13,3 s | 7,3–9,0 s | 6,4–7,3 s | 97,9% |
| piper / faber | 12,6 s | 1,0 s (8,1 s com a carga do modelo) | 5,2–6,2 s | 89,4% e 93,6% |

**Precisão do alinhador:** alinhando pelo Whisper o áudio do edge e comparando com os tempos nativos do próprio edge, palavra a palavra:

| Whisper | Dica | Tempo | Palavras exatas | Erro no início da palavra |
|---|---|---|---|---|
| small | não | 13,2 s | 40 de 43 | mediana 47 ms |
| small | sim | 10,4 s | 43 de 43 | mediana 50 ms |
| base | sim | 3,4 s | 42 de 43 | mediana 55 ms |

A mediana fica abaixo de 2 quadros a 30 fps. O maior erro (1,17 s, em "mil") é do **edge**: o WordBoundary dá duração zero a algarismos ("8", "384") e joga o tempo na palavra seguinte. **Escreva números por extenso** quando usar o edge com legenda palavra a palavra; a legenda converte de volta para algarismo.

**No exemplo explicativo** (105 palavras, ~30 s de fala): edge 3,7–5,5 s; Kokoro `pm_alex` 80,4 s com síntese + alinhamento + carga dos modelos.

**Gravação:** voz com ruído rosa somado, 1,5 s de silêncio antes e codificada em M4A. Com `--limpar`, 0,2 s de conversão, silêncio das pontas removido e a mesma nota do áudio limpo (97,9%).

## Limites e próximos passos

- `azure` e `elevenlabs` foram escritos pela documentação e **nunca rodaram** aqui.
- O Kokoro em ONNX não exporta a duração dos fonemas, então não tem tempos nativos; o `include_alignments` do piper-tts 1.8 não foi testado.
- Sem cache por impressão digital no motor (o exemplo explicativo tem o seu).
- Limpeza de gravação é só `highpass` + `afftdn`; o DeepFilterNet limpa muito mais, mas não está integrado.
- **Emoção na voz sintética** é o maior problema em aberto: as vozes grátis soam neutras demais (ver [direcoes.md](direcoes.md)).

## Ética e licenças

Vozes sintéticas são de **narrador**. Nunca use para imitar uma pessoa real; diga no vídeo que a voz é sintética (o motor devolve o `rotulo` pronto). Kokoro e Piper puxam código GPL-3.0 e por isso ficam fora do `requirements.txt` (o repositório é Apache-2.0); os áudios gerados não herdam a GPL. Detalhes em [THIRD_PARTY.md](../THIRD_PARTY.md).

Origem: laboratórios 01 (alinhamento com difflib), 02 (camada de provedores, QA pelo Whisper, pronúncia por motor) e 03 (WordBoundary do edge) da Fábrica de reels, e a pesquisa de voz de 06/10/2026.
