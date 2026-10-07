# Histórico

Formato inspirado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/); versões seguem [SemVer](https://semver.org/lang/pt-BR/).

## [0.1.0] - 2026-10-07

Primeira versão pública. Os motores foram separados dos laboratórios da Fábrica de reels, generalizados e documentados.

### Adicionado

- **`motores/render`**: cena HTML → MP4. Captura JPEG pelo CDP, N processos Chrome com fatias contíguas de quadros, ffmpeg por stdin, pulo de quadros por chave de estado devolvida por `window.seek(t)`, conversão para faixa de TV BT.709, áudio com `apad`/`atrim`, folha de contato (`--teste`) com zonas seguras (`--zonas`), conferência do pulo de quadros (`--verificar`). CLI e função `renderizar()`. Contrato da cena em `CONTRATO.md`.
- **`motores/voz`**: provedores trocáveis (edge, Kokoro, Piper, Azure, ElevenLabs, gravação) com o tempo de cada palavra; alinhador universal pelo faster-whisper + difflib; nota de precisão (QA) com num2words; pronúncia por motor (`pronuncia.json`); rótulo de IA pronto. Serviços pagos só rodam com chave e `--permitir-pago`.
- **`motores/legenda`**: blocos por sintagma medidos com a fonte real, destaque da palavra falada, zonas seguras (universal, Reels, TikTok, Shorts), calibração do tamanho de fonte do libass lida do próprio TTF, `.ass` + `.srt`/`.vtt`, QC com relatório, queima com conferência da fonte usada.
- **`exemplos/`**: `ola-mundo` (cena mínima), entradas de teste da voz e da legenda e `explicativo` ("Por que o céu é azul?"), de ponta a ponta com os três motores, trilha sintetizada, *ducking* e loudnorm a −14 LUFS.
- **Documentação**: fundamentos, arquitetura, render, voz, legenda e direções (incluindo a linha de pesquisa do testbed ético de agentes sintéticos), `CONTRIBUTING.md` e `THIRD_PARTY.md`.

### Corrigido (em relação ao laboratório de origem)

- Folha de contato: com `-framerate 1` a base de tempo do ffmpeg é 1 s e o `setpts` truncava o instante pedido (2,8 s desenhava 2 s). Corrigido com `settb=1/90000`.
- Calibração da legenda: o fator fixo 0,734 estava ~1% baixo para a Barlow; agora sai de `winAscent + winDescent` da fonte (0,741).
