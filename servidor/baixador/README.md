---
title: Prensa · baixador
emoji: 🔗
colorFrom: red
colorTo: gray
sdk: docker
app_port: 7860
short_description: Recebe um link e devolve o vídeo em MP4 para a Prensa.
---

# Prensa · baixador

Serviço pequeno que deixa a [Prensa](https://arthruur-prensa.static.hf.space) aceitar **links** (X, Instagram,
TikTok, YouTube...). O navegador não pode baixar vídeo dessas redes direto, então este serviço faz só isso, com o
[yt-dlp](https://github.com/yt-dlp/yt-dlp), e devolve o MP4. Legenda, receita e render continuam no aparelho de
quem usa. Nada é guardado: o arquivo é apagado assim que a resposta termina.

- `POST /baixar` com `{"url": "..."}` devolve `video/mp4` e os cabeçalhos `X-Titulo`, `X-Autor`, `X-Origem`, `X-Plataforma`.
- Limites (variáveis de ambiente): `DUR_MAX` (20 min), `TAMANHO_MAX` (400 MB), `POR_HORA` (30 pedidos por IP), `ORIGENS` (de onde o app pode chamar).

Código: [motores-video/servidor/baixador](https://github.com/arthruur/motores-video/tree/prensa/servidor/baixador) · Apache-2.0.
