# Novela da Caatinga · cap. 1 "A Inauguração" (primeira produção completa)

Série animada do Mangaio. A bíblia está em [`biblia.md`](biblia.md), as decisões de motor em [`producao.md`](producao.md) e a **bíblia de arte e animação** (estilo, personagens, cenários, rig, pipeline de produção) em [`arte/`](arte/README.md). Este capítulo testa a produção inteira:
- narração no estilo Peppa Pig + elenco, com vozes por TTS (Gemini), uma geração por fala;
- personagens desenhados em código, com um rig de rosto compartilhado;
- o Cesto, que é o mascote do Mangaio e não fala, respondendo com trompete;
- efeitos sintetizados.

```powershell
python receitas/novela-da-caatinga/preparar.py        # vozes (cache por fala) + tempos.json
node receitas/novela-da-caatinga/gerar.mjs --teste    # folha de contato
node receitas/novela-da-caatinga/gerar.mjs            # som + vídeo → saida/novela-da-caatinga/cap01-a-inauguracao.mp4
python receitas/novela-da-caatinga/som/mixar.py --frases   # ouvir cada frase do trompete e cada efeito
```

| Arquivo | O que faz |
|---|---|
| `roteiro.json` | Elenco (voz, perfil e andamento de cada personagem), cenas, falas com direção e deixas de som |
| `preparar.py` | TTS por fala, com troca de modelo quando a cota do dia acaba. Alinhamento e checagem pelo Whisper, corte de fala repetida, andamento (atempo), env da boca e tempos.json |
| `personagens.js` | O elenco em SVG: rig de rosto (olhos, sobrancelhas, boca, 11 expressões) e corpos |
| `cena.js` | As 10 cenas, o Cesto (mascote.svg com olhos e braços mexidos) e a legenda na cor de quem fala |
| `som/mixar.py` | Trompete provisório sintetizado, efeitos e mixagem a −14 LUFS. Gravação própria em `som/trompete/<frase>.wav` substitui o sintetizado |

## O que este teste ensinou

- **A cota grátis do Gemini TTS não fecha um capítulo.** O `gemini-3.1-flash-tts-preview` dá **10 pedidos por dia**, e o capítulo tem 27 falas. O preparar passa sozinho para o próximo modelo quando a cota acaba. Resultado: o capítulo saiu com **três modelos misturados**:

  | Modelo | Falas | Problema encontrado |
  |---|---|---|
  | 3.1 flash | 13 | nenhum |
  | 3.8 flash | 10 | Leu a fala **duas vezes** em 5 delas. O Whisper ouve as palavras repetidas e o preparar corta o áudio |
  | 3.8 flash lite | 4 | Leu **o prompt inteiro em voz alta**: perfil, direção e tudo. Para ele vai só o texto, sem direção |

  Para produção, a saída é o nível pago do Gemini, que é barato, ou distribuir as falas por dias.
- **O TTS dirigido fala devagar,** cerca de 1,8 palavra por segundo. O andamento é ajustado depois, com atempo: narrador 1,25×, elenco 1,12×, Umbu 1× (ele "nunca tem pressa").
- **O roteiro ficou longo:** cerca de 120 s para uma meta de 60 a 90 s. A pesquisa da bíblia dá a régua: em Peppa, o narrador fala cerca de 2 vezes por minuto, com frases de cerca de 10 palavras. O piloto tem 18 falas do narrador porque apresenta o elenco inteiro. Nos próximos capítulos, 2 ou 3.
- **A checagem do Whisper precisa de ouvido humano.** Ela aponta trechos suspeitos, como "Cesto" → "sexto", "Tu viu" → "Tô fio" e "Umbu" → "um búu". Alguns são erro do Whisper, outros da voz. Quem decide é a escuta.
- **Rig de rosto compartilhado funciona.** Seis corpos diferentes usam o mesmo rosto, e a boca segue o volume da voz. Um personagem novo custa só o corpo.
