# motores/voz

Narração com **provedores trocáveis**, o **tempo de cada palavra** (para a legenda palavra a palavra) e uma **nota de precisão pelo Whisper**. Tudo roda em CPU, sem GPU.

```
texto ──► provedor (edge, kokoro, piper, azure, elevenlabs ou a sua gravação) ──► voz.wav
                │ tem tempo por palavra? ── sim ──► usa o do motor
                └──────────────────────── não ──► alinhador (faster-whisper + texto)
                                                     └──► voz.json: [{texto, inicio, fim}] com a grafia do texto
qa: o Whisper ouve de novo, sem dica, e compara com o texto ──► precisão % + divergências
```

Três ideias vêm dos laboratórios da Fábrica de reels:

1. **O texto manda; o Whisper só empresta os tempos.** O alinhador casa o que foi ouvido com o texto revisado (difflib), então a legenda sai com a grafia certa mesmo quando o Whisper erra uma palavra.
2. **O Whisper mede se a fala está *certa*, não se está *boa*.** Entonação e naturalidade quem julga é o ouvido.
3. **Pronúncia é por motor.** A grafia "sús" conserta o "SUS" no Kokoro e piora o Piper. Por isso o `pronuncia.json` tem uma seção por motor.

## Instalar

Precisa de Python 3.10+ e `ffmpeg` no PATH. Na raiz do repositório:

```powershell
python -m venv .venv
.venv\Scripts\activate             # Linux/macOS: source .venv/bin/activate
pip install -r requirements.txt    # núcleo: faster-whisper, num2words, numpy, edge-tts
```

Opcionais, só se for usar:

```powershell
pip install -r motores/voz/requisitos-kokoro.txt   # Kokoro local
pip install -r motores/voz/requisitos-piper.txt    # Piper local (GPL-3.0)
pip install -r motores/voz/requisitos-azure.txt    # Azure AI Speech
```

Na primeira execução, o faster-whisper baixa o modelo `small` (~460 MB) para o cache do Hugging Face.

### Modelos locais (Kokoro e Piper)

Os modelos não ficam no repositório (`modelos/` está no `.gitignore`). O motor procura nesta ordem: opção `--modelos`, variável `MOTORES_VOZ_MODELOS` e a pasta `modelos/` na raiz do repositório.

```powershell
mkdir modelos
# Kokoro-82M (~355 MB)
curl -L -o modelos/kokoro-v1.0.onnx https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/kokoro-v1.0.onnx
curl -L -o modelos/voices-v1.0.bin  https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/voices-v1.0.bin
# Piper: cada voz é um .onnx + .onnx.json (~63 MB). Troque "faber" por "cadu" ou "jeff".
curl -L -o modelos/pt_BR-faber-medium.onnx      https://huggingface.co/rhasspy/piper-voices/resolve/main/pt/pt_BR/faber/medium/pt_BR-faber-medium.onnx
curl -L -o modelos/pt_BR-faber-medium.onnx.json https://huggingface.co/rhasspy/piper-voices/resolve/main/pt/pt_BR/faber/medium/pt_BR-faber-medium.onnx.json
```

Se você já tem os modelos em outro lugar, aponte para eles: `$env:MOTORES_VOZ_MODELOS = "C:\caminho\modelos"`.

## Usar

```powershell
python -m motores.voz.cli provedores                 # o que está disponível e o que falta
python -m motores.voz.cli sintetizar exemplos/voz/frase.txt --provedor edge --saida saida/voz/edge.wav --qa
python -m motores.voz.cli sintetizar exemplos/voz/frase.txt -p kokoro -v pm_alex -o saida/voz/kokoro.wav --qa
python -m motores.voz.cli sintetizar exemplos/voz/frase.txt -p gravacao --arquivo minha-voz.m4a --limpar --qa
python -m motores.voz.cli alinhar saida/voz/kokoro.wav exemplos/voz/frase.txt      # só os tempos
python -m motores.voz.cli qa saida/voz/edge.wav exemplos/voz/frase.txt             # só a nota
```

Cada comando tem `--help`. O texto pode ir entre aspas ou num arquivo `.txt` (UTF-8). O `sintetizar` grava o WAV (mono, 48 kHz por padrão) e, ao lado, um `.json` com `palavras`, `duracao`, `provedor`, `voz`, `sintetica`, `rotulo` e, com `--qa`, a nota.

Como biblioteca:

```python
from motores.voz import sintetizar, alinhar, avaliar

r = sintetizar("A água ferve a cem graus.", "kokoro", "pf_dora", "saida/voz.wav")
r["palavras"]   # [{"texto": "A", "inicio": 0.0, "fim": 0.12}, ...]
r["tempos"]     # "alinhador (faster-whisper + texto)"
r["rotulo"]     # "Narração gerada por IA (voz sintética Kokoro-82M ...), não é a voz de uma pessoa real"

alinhar("gravacao.wav", texto)["palavras"]      # qualquer áudio + texto conhecido
avaliar("voz.wav", texto)["precisao"]           # 97.9
```

`sintetizar(texto, provedor, voz, saida_wav, **opcoes)` aceita `velocidade` (1.0 = normal), `taxa`, `pronuncia` (True, False ou outro .json), `alinhar`, `whisper` (modelo), `modelos`, `arquivo` e `limpar` (gravação) e `permitir_pago`.

## Provedores

| Provedor | Onde roda | Custo | Licença | Tempo por palavra | Estado |
|---|---|---|---|---|---|
| `edge` | nuvem (Microsoft) | grátis, sem chave | código **LGPL-3.0**; o **serviço não tem termos de uso** | nativo (WordBoundary) | testado |
| `kokoro` | local, CPU | grátis | pesos Apache-2.0; `kokoro-onnx` MIT; depende de **phonemizer e espeak-ng (GPL-3.0)** | alinhador | testado |
| `piper` | local, CPU | grátis | motor `piper-tts` **GPL-3.0-or-later**; vozes faber, cadu e jeff: dataset CC0 | alinhador | testado (faber) |
| `azure` | nuvem | cota F0 de 0,5 M caracteres/mês, depois pago | termos do Azure; SDK da Microsoft | nativo (WordBoundary do SDK) | **não testado** (sem chave) |
| `elevenlabs` | nuvem | pago | termos da ElevenLabs | nativo (`/with-timestamps`, por caractere) | **não testado** (sem chave) |
| `gravacao` | local | grátis | do próprio autor | alinhador | testado |

Avisos:

- **edge-tts é só para protótipo.** A biblioteca imita o navegador Edge num endpoint não oficial, sem termos de uso, e já quebrou com erro 403 várias vezes desde 2024. Para publicar, prefira a sua gravação, o Kokoro ou o Azure, que tem as mesmas vozes pelo caminho oficial.
- **Piper e Kokoro puxam código GPL-3.0** (o Piper diretamente; o Kokoro via phonemizer e espeak-ng). Por isso ficam fora do `requirements.txt` e este repositório (Apache-2.0) só os importa se você instalar. Os áudios gerados não herdam a GPL.
- **Nada é cobrado sem você pedir.** `azure` e `elevenlabs` só rodam com a chave no ambiente (`AZURE_SPEECH_KEY` + `AZURE_SPEECH_REGION`, `ELEVENLABS_API_KEY`) **e** com `--permitir-pago`. A mensagem de erro mostra quantos caracteres seriam enviados.
- **Rótulo de IA.** O JSON traz um `rotulo` pronto para pôr no vídeo quando a voz é sintética. Vozes sintéticas são de narrador: nunca use para imitar uma pessoa real.

## Pronúncia

`pronuncia.json` tem a seção `todos` e uma por motor. A voz recebe a grafia trocada; a legenda e o alinhamento continuam com o texto original, porque o casamento compara palavras sem acento ("sús" casa com "SUS") e reparte o tempo quando a troca muda o número de palavras.

Só entra no dicionário o que foi medido. Hoje há uma entrada, `"SUS": "sús"` no Kokoro, vinda do lab 02: sem ela o Kokoro dizia "sos"; a mesma troca piorou o Piper. Antes de acrescentar, gere com e sem a troca e compare com `qa`.

## Medições

Máquina: Ryzen 7 5700U (16 threads), 19 GB, Windows 11, sem GPU; Python 3.13, faster-whisper 1.2.1 (`small`, int8), edge-tts 7.2.8, kokoro-onnx 0.6.1, piper-tts 1.8.0. Outros processos rodavam ao mesmo tempo, então os tempos são indicativos, não médias controladas.

Frase neutra de 43 palavras, com números e siglas ([`exemplos/voz/frase.txt`](../../exemplos/voz/frase.txt)), duas rodadas por voz:

| Provedor / voz | Áudio | Gerar | Alinhar | Precisão (Whisper) | Divergências |
|---|---|---|---|---|---|
| edge / Antonio | 16,6 s | 1,7–3,7 s | – (nativo) | 91,5% e 93,6% | "NASA" → "nase"/"nasio"; "INPE" → "impe"/"impio"; um "a" engolido |
| edge / Francisca | 15,0 s | 2,6–2,8 s | – (nativo) | 97,9% | "INPE" → "imp"/"impe" |
| kokoro / pf_dora | 13,2 s | 16,5–17,3 s* | 10,4–13,3 s | 97,9% | "INPE" → "impe" |
| kokoro / pm_alex | 13,3 s | 7,3–9,0 s | 6,4–7,3 s | 97,9% | "INPE" → "impe" |
| piper / faber | 12,6 s | 1,0 s (8,1 s na 1ª, com carga) | 5,2–6,2 s | 89,4% e 93,6% | "Terra. A Lua" → "luz" nas duas; "cerca" → "a seca" numa |

\* A 1ª rodada do Kokoro inclui carregar o modelo; a diferença entre pf_dora e pm_alex não se explicou pelo carregamento (provável disputa de CPU com outros processos).

- **Nota do QA:** 4,5 a 14 s por áudio de 13 a 17 s (Whisper `small` já carregado; carregar leva 4 a 6 s). Quando os tempos vêm do alinhador, o `--qa` reaproveita a transcrição e não custa nada a mais.
- **"INPE" vira "impe" em todos os motores.** É grafia do Whisper para uma sigla lida como palavra, não erro de fala. Siglas assim derrubam a nota em ~2 pontos; leia as divergências antes de culpar a voz.
- **Gravação:** a voz do Kokoro com ruído rosa somado, 1,5 s de silêncio antes e codificada em M4A. Com `--limpar`, a conversão levou 0,2 s, o silêncio das pontas saiu e o QA deu os mesmos 97,9% do áudio limpo, com 42 de 43 palavras casadas exatamente.

### Quão preciso é o alinhador?

Para medir, alinhei pelo Whisper o áudio do edge/Antonio e comparei com os tempos que o próprio edge devolve (WordBoundary), palavra a palavra:

| Whisper | Dica (texto como prompt) | Tempo | Palavras exatas | Erro no início da palavra |
|---|---|---|---|---|
| small | não | 13,2 s | 40 de 43 | mediana 47 ms; 6 palavras acima de 100 ms |
| small | sim | 10,4 s | 43 de 43 | mediana 50 ms; 6 acima de 100 ms |
| base | sim | 3,4 s | 42 de 43 | mediana 55 ms; 7 acima de 100 ms |

O maior erro (1,17 s, em "mil") é do **edge**, não do Whisper: o WordBoundary dá duração zero para algarismos ("8", "384") e joga o tempo inteiro na palavra seguinte. Para legenda karaokê com edge, escreva números por extenso, ou alinhe pelo Whisper. Fora isso, as diferenças ficam em dezenas de milissegundos, abaixo de um quadro e meio a 30 fps.

## Limites conhecidos

- `azure` e `elevenlabs` foram escritos pela documentação e **nunca rodaram** aqui (falta chave). Em especial, falta confirmar `evt.duration` no SDK do Azure e o formato do `alignment` da ElevenLabs.
- O Kokoro v1.0 em ONNX não exporta a duração dos fonemas, então não dá tempos nativos; o `piper-tts` 1.8 tem `include_alignments`, que não testei.
- `--velocidade` vale para edge, Kokoro, Piper e Azure (via SSML); na ElevenLabs é ignorada.
- Sem cache: gerar de novo o mesmo texto chama o provedor de novo.
- A limpeza de gravação é só `highpass` + `afftdn` do ffmpeg. Para ruído forte, o DeepFilterNet limpa muito mais (ver a pesquisa de voz da Fábrica), mas não está integrado.
- O alinhador usa os tempos palavra a palavra do Whisper (atenção cruzada). Para precisão de fonema, o caminho seria um alinhador forçado (WhisperX/wav2vec2), mais pesado.
