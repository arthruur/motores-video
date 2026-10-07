# motores/colagem

Colagem por sentido: fragmentos de **falas reais** achados por tema, cortados **entre frases** e montados num reel 9:16, com nome, data, ocasião e **fonte (link e minuto)** em cada fragmento. A máquina acha e sugere; quem monta escolhe, ordena e assina.

Conceito, referências e a ética da montagem em [docs/colagem.md](../../docs/colagem.md). Exemplo pronto em [exemplos/colagem-democracia](../../exemplos/colagem-democracia).

```bash
python -m motores.colagem.cli baixar  exemplos/colagem-democracia/fontes.json            # yt-dlp, só os trechos
python -m motores.colagem.cli indexar exemplos/colagem-democracia/fontes.json            # Whisper + janelas + vetores
python -m motores.colagem.cli sugerir exemplos/colagem-democracia/fontes.json "o que é democracia"
python -m motores.colagem.cli montar  exemplos/colagem-democracia/colagem.json           # MP4 + .srt/.vtt + ficha
python -m motores.colagem.cli folha   saida/colagem-democracia/colagem-o-que-e-democracia.mp4
python -m motores.colagem.cli <subcomando> --help
```

A saída vai para `saida/<nome da pasta do JSON>/` (mude com `--saida`). O `montar` deixa os intermediários (cartões e fragmentos já renderizados, ~36 MB no exemplo) em `tmp-<tema>/`; pode apagar.

## O que cada passo faz

| Passo | Arquivo | O que faz | Reusa |
|---|---|---|---|
| baixar | `fontes.py` | yt-dlp baixa só `trecho.ini`–`trecho.fim` de cada fonte para `arquivo` (padrão `entrada/<slug>.mp4`). `--de PASTA` copia `<slug>.mp4` já baixados; se o arquivo for maior que o trecho, corta com o ffmpeg (onde ele começa no original vem do `fontes.json` de `PASTA` ou da pasta acima; sem ele, conta como vídeo inteiro) | — |
| indexar | `indice.py` | Palavras com tempo pelo Whisper (VAD; repete sem VAD se sair pouca palavra), ou lidas de `palavras` se a fonte já trouxer. Janelas de 15 s com passo de 5 s. As `frases` conhecidas são achadas na transcrição pelo texto e entram junto da janela (corrigem o ouvido do Whisper sem mexer no modelo). Cada janela vira um vetor do EmbeddingGemma 2 (prefixo `Document`). Cache por fonte | `motores/voz` (Whisper) |
| sugerir | `sugerir.py` | O tema vira vetor (prefixo `SearchQuery`); MMR entre relevância e diversidade, no máximo 2 por fonte, sem janelas sobrepostas; cada candidato é levado à fronteira de frase. Grava `candidatos-<tema>.json` e uma página `.html` com player em cada trecho | `frases.py` |
| montar | `montar.py` | Para cada fragmento do `colagem.json`: o texto de `revisao/<id>.txt` alinhado aos tempos do Whisper (o texto manda), legenda karaokê, vídeo 16:9 sobre o fundo desfocado dele mesmo, etiqueta com nome, data, ocasião e fonte, áudio original a −14 LUFS (loudnorm em 2 passagens). Cartão de abertura, 0,4 s de textura entre fragmentos e cartão final com **todas** as fontes e "montagem de <autor>". Saída: `colagem-<tema>.mp4`, `.srt`/`.vtt` da colagem inteira e `ficha-<tema>.json` | `casar()` de `motores/voz/alinhar.py`, `gerar()` de `motores/legenda`, `filtro_legenda()` de `queimar.py` |
| folha | `cli.py` | Folha de contato do MP4 pronto com as zonas da interface pintadas | `folha_de_contato()` de `motores/legenda` |

`frases.py` é o corte por respiração: frase termina em `. ! ? …` ou numa pausa de 1 s seguida de maiúscula; frase longa demais é dividida em respiros de pelo menos 0,5 s. O corte cai sempre entre palavras.

Se `revisao/<id>.txt` não existir, o `montar` cria a partir do Whisper e avisa: confira de ouvido e rode de novo. A legenda segue **o que a pessoa disse**, não a versão de catálogo da frase.

## `fontes.json`

```json
{
 "fontes": [
  {
   "slug": "marielle",                      // obrigatório, único; nome do arquivo e id no colagem.json
   "figura": "Marielle Franco",             // obrigatório
   "data": "2018-03-08",
   "ocasiao": "Grande expediente do Dia Internacional da Mulher",
   "rotulo": "Câmara Municipal do Rio",     // texto curto da etiqueta (padrão: ocasiao)
   "url": "https://www.youtube.com/watch?v=...",   // obrigatório
   "trecho": {"ini": 265, "fim": 300},       // obrigatório; segundos do original; fim null = vídeo inteiro
   "arquivo": "entrada/marielle.mp4",       // padrão entrada/<slug>.mp4, relativo ao JSON
   "palavras": "palavras/marielle.json",    // opcional: transcrição pronta (pula o Whisper)
   "aviso": "montagem da TV Câmara",        // opcional: vai para a etiqueta
   "frases": [{"id": "...", "texto": "frase conferida", "no_trecho": 1.0}],  // opcional: ajudam a busca
   "creditos": {"canal": "...", "titulo": "...", "publicado": "2022-05-11"}
  }
 ],
 "fontes_opcionais": [ ... ]                // só entram com --opcionais
}
```

(Os comentários `//` são só para leitura; o arquivo é JSON puro.) **Tempo dentro do arquivo + `trecho.ini` = tempo no vídeo original.** É assim que a etiqueta e o cartão final mostram o minuto certo do original mesmo quando só um trecho foi baixado.

## `colagem.json`

Escrito por quem monta, olhando a página de candidatos:

```json
{
 "tema": "o que é democracia",
 "autor": "quem montou",                    // aparece no cartão final: "montagem de <autor>"
 "fontes": "fontes.json", "revisao": "revisao",
 "abertura": {"texto": ["O QUE É", "DEMOCRACIA?"], "sub": "quatro vozes, 1983–2018", "dur": 2.5},
 "fragmentos": [
  {"id": "3-marielle", "fonte": "marielle", "ini": 10.02, "fim": 24.72, "porque": "por que este trecho e este corte"}
 ],
 "final": {"dur": 6.5, "aviso": ["Colagem: falas de ocasiões diferentes, postas lado a lado.", "..."]},
 "etica": "o que a montagem cria que nenhuma das pessoas disse junto"
}
```

`ini`/`fim` são segundos **dentro do arquivo baixado**. O `porque` de cada fragmento e a `etica` vão para a ficha: a escolha fica registrada e pode ser contestada.

## Números

Medidos no notebook do README (Ryzen 7 5700U, sem GPU), com `exemplos/colagem-democracia`:

| O quê | Resultado |
|---|---|
| `montar` (4 fragmentos, 66,3 s de vídeo, 38,4 MB) | 64,4 s numa rodada; 147,3 s noutra, com a CPU dividida |
| Áudio final | −14,1 LUFS, pico −1,4 dBTP |
| Alinhamento revisão × Whisper | Ulysses 13 palavras exatas e 1 repartida; Lélia 7 trechos diferentes do Whisper (ele ouviu "demografia racial") |
| `indexar` das 7 fontes (quando nada está em cache) | 403,6 s; só o Whisper do Ulysses (143,7 s de áudio) levou 212,7 s com a CPU dividida |
| Carga do EmbeddingGemma 2 (só texto, offline) | 22,8 s aqui, com a CPU dividida (3,8 s no laboratório de origem) |
| Vetores | 6,1–24,8 s por fonte; 340 janelas de 15 s nas 7 fontes |
| Frases conhecidas achadas na transcrição | 20 de 21 |
| `indexar` das 4 fontes do exemplo, com `palavras/` (sem Whisper) | 32,7 s: import 16,3 s, carga do modelo 6,6 s, vetores 9,6 s (76 janelas) |
| `sugerir "o que é democracia"` com o índice pronto | 22,8 s, quase tudo import e carga do modelo; a busca em si, 0,26 s |
| `baixar --de` (copiar vídeos já baixados) | 1,7 s só copiando; 4,9 s cortando 2 trechos de vídeos inteiros |

O passo caro é a transcrição. Por isso o exemplo traz `palavras/` pronto: o `montar` roda sem Whisper e sem o EmbeddingGemma, só com o `requirements.txt` da raiz.

## Dependências

- `montar` e `folha`: só o núcleo (`requirements.txt` da raiz) e ffmpeg com libass.
- `indexar` e `sugerir`: `pip install -r motores/colagem/requisitos.txt` (torch para CPU, sentence-transformers, yt-dlp). O modelo [`google/embeddinggemma-2`](https://huggingface.co/google/embeddinggemma-2) (Apache-2.0, ~1,5 GB) é baixado do Hugging Face na primeira vez.
- `baixar`: yt-dlp.

Licenças em [THIRD_PARTY.md](../../THIRD_PARTY.md).

## Mídia de terceiros

Os vídeos de origem **nunca** entram no repositório: são baixados em `entrada/`, que o git ignora, e os direitos são dos titulares. Cada fragmento mostra quem fala, quando, onde e o link com o minuto; o cartão final lista todas as fontes. Ver a seção "Exemplos com material de terceiros" do [README](../../README.md).
