# Laboratório de áudio

Experimentos curtos para ganhar intimidade com cada forma de gerar áudio antes que ela vire motor (`motores/audio`). Segue o formato dos laboratórios de vídeo da Fábrica de reels (`reels-fabric/laboratorio`): cada pasta registra uma pergunta, um caminho, um resultado medido e um "o que aprendi".

| # | Experimento | Ferramentas | Estado |
|---|---|---|---|
| A1 | [Do roteiro seco à narração dirigida](a1-gemini-tts/) | Gemini 3.1 Flash TTS, Gemini 3.5 Flash, faster-whisper, edge-tts, ElevenLabs v3 | ✅ |
| A2 | [Roteiro falado: siglas, normalização no fim, direção com limites, fidelidade](a2-roteiro-falado/) | Gemini 3.1 Flash TTS, Gemini 3.5/3.8 Flash | 🟡 checagem final pendente (cota) |

## Regras

- O que é gerado (`saida/`) não vai para o git. As chaves ficam no `.env` da raiz.
- Voz sintética é de narrador ou de personagem. Nunca imita pessoa real, e o vídeo leva o rótulo de IA.
- O Whisper diz se a fala está **certa**; se está **boa**, quem decide é o ouvido.
