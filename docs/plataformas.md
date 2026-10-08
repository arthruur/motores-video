# Limites de cada plataforma

O que a Prensa (`app/`) usa para exportar, com a fonte de cada número. Pesquisado em **08/10/2026**. As plataformas mudam esses limites sem aviso: confira antes de confiar, e atualize esta página com a fonte quando mudar.

**"Não confirmado"** quer dizer que não achamos o número numa página oficial que conseguimos ler. As páginas de ajuda do TikTok e do WhatsApp só carregam o texto com JavaScript, então várias informações vêm de terceiros que as citam.

## O que a Prensa faz

Um único arquivo serve a todas: **1080×1920, H.264 + AAC, 30 fps**, com a legenda e o gancho dentro da **faixa segura comum** (a interseção das três abaixo). Para cada plataforma, a Prensa só corta ou divide quando o vídeo passa do limite.

| Plataforma | Limite usado | O que acontece acima dele | Confirmado? |
|---|---|---|---|
| TikTok | 10 min | corta | Não (é o limite de gravação no app; envio pode ir a 60 min) |
| Reels | 15 min (aviso acima de 3 min) | corta | Não (20 min pela câmera; o Instagram recomenda até 3 min para distribuição plena) |
| Shorts | 3 min | corta | **Sim** |
| Kwai | 60 s | corta | Não |
| Status do WhatsApp | 60 s por parte | divide em partes iguais | Não (90 s em beta; 60 s é o valor conservador) |

## Duração e arquivo

| Plataforma | Duração máxima | Tamanho | Codificação | Fontes |
|---|---|---|---|---|
| **TikTok** | 10 min gravando no app. Envio de até 60 min: **não confirmado** (era teste em 2024) | Anúncios: 500 MB. API: 4 GB | MP4, H.264 recomendado, 23–60 fps (API) | [Especificação de anúncios](https://ads.tiktok.com/help/article/video-ads-specifications), [API de envio](https://developers.tiktok.com/doc/content-posting-api-media-transfer-guide), [teste de 60 min](https://searchengineland.com/tiktok-testing-60-minute-video-uploads-440588) |
| **Instagram Reels** | 20 min pela câmera (anúncio de nov/2025). Envio da galeria: **não confirmado**. Até 3 min para distribuição plena | Anúncios: 4 GB | MP4/MOV, H.264, fps fixo, AAC estéreo ≥128 kbps (anúncios) | [Meta: especificação de Reels](https://www.facebook.com/business/ads-guide/update/video/instagram-reels), [post do Instagram](https://www.instagram.com/p/DRR5Ol2ACna/), [MacMagazine](https://macmagazine.com.br/post/2025/11/26/instagram-libera-reels-de-ate-20-minutos-e-testa-ajuste-do-seu-algoritmo/) |
| **YouTube Shorts** | **3 min** (vertical ou quadrado, desde 15/10/2024). Shorts com mais de 1 min e com reivindicação de direitos autorais ficam bloqueados | 256 GB ou 12 h | MP4, H.264 High, moov no início, AAC-LC 48 kHz | [Ajuda do YouTube: Shorts de 3 min](https://support.google.com/youtube/answer/15424877?hl=pt-BR), [tamanho](https://support.google.com/youtube/answer/71673?hl=pt-BR), [codificação](https://support.google.com/youtube/answer/1722171?hl=pt-BR) |
| **Kwai** | **Não confirmado**. Terceiros falam em 60 s | **Não confirmado** | **Não confirmado** | [Nerdweb](https://nerdweb.com.br/artigos/tamanho-videos-redes-sociais.html). Nenhuma documentação oficial encontrada |
| **Status do WhatsApp** | 90 s por status: **não confirmado** (beta de 2025; antes eram 60 s). O app **não divide sozinho**: abre o editor para cortar | **Não confirmado** (o WhatsApp recomprime) | **Não confirmado** | [WABetaInfo](https://wabetainfo.com/whatsapp-beta-for-android-2-25-12-9-whats-new/), [Gizbot](https://www.gizbot.com/apps/news/whatsapp-extends-video-status-limit-to-90-seconds-report-011-113357.html) |

## Faixa segura (o que a interface cobre num quadro 1080×1920)

| Plataforma | Topo | Base | Laterais | Fonte |
|---|---|---|---|---|
| Reels (Meta) | 14% (~269 px) | 35% (~672 px) | 6% (~65 px) | **Oficial**, para anúncios: [Meta](https://www.facebook.com/business/ads-guide/update/video/instagram-reels) |
| TikTok | ~240 px | ~660 px | ~120 px; a coluna de botões ocupa a direita abaixo de y≈840 | Oficial só como modelo para baixar; números de terceiros: [trymypost](https://www.trymypost.com/blog/tiktok-ad-specs-2026-safe-zones) |
| Shorts | ~240 px | ~380–670 px | ~190–200 px à direita | Terceiros: [adkit](https://adkit.so/tools/safe-zones/youtube) |

**Na Prensa:** o gancho começa em y = 270 (os 14% da Meta), e a legenda fica na faixa x 120–780 com base em y = 1248 (35% de baixo). É a mesma faixa `universal` do `motores/legenda` (ver [README da legenda](../motores/legenda/README.md)).
