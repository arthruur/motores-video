# Direções

Para onde estes motores apontam: as apostas de produto que orientaram o código e uma linha de pesquisa que eles também podem servir. São convites. Se algo aqui te interessa, abra uma issue.

## 1. Apostas de produto

- **A máquina mede, sugere e prepara; o criador decide.** Os motores existem para potencializar quem cria, não para produzir vídeo em massa sem ninguém olhando. Sempre que der, a ferramenta oferece opções lado a lado (inclusive um modo 100% automático) e deixa a escolha com a pessoa.
- **Local e grátis primeiro, pago como opção.** Tudo roda num PC sem GPU. Serviços pagos (vozes neurais, modelos de vídeo) entram por adaptadores trocáveis, nunca como requisito.
- **Determinismo.** Mesma entrada, mesmo vídeo. Cena é função do tempo, e é isso que permite renderizar em paralelo, pular quadros repetidos e testar.
- **Fonte visível e rótulo de IA.** Quem usa voz sintética ou conteúdo gerado diz isso no vídeo. Ninguém imita voz ou rosto de pessoa real.

### Problemas em aberto (bons para contribuir)

| Problema | Por que importa |
|---|---|
| **Emoção na voz sintética** | Vozes grátis (edge-tts, Kokoro, Piper) soam neutras demais. Testar estilos SSML, tags de emoção, controle de expressividade e escrita para a fala. |
| **Alinhador universal** | Dar o tempo de cada palavra para qualquer áudio (gravação própria, qualquer TTS) via Whisper com o roteiro conhecido. |
| **Prévia ao vivo fiel ao export** | Ver a cena no navegador enquanto edita, igual ao que o render vai produzir. |
| **PC modesto** | Medir e ajustar tudo num computador de 4 núcleos e 8 GB, típico de telecentro. |
| **Legenda em fala corrida** | Conciliar "o bloco sai quando a próxima fala começa" com "tempo mínimo de leitura". |
| **Acessibilidade** | Exportar `.srt`/`.vtt` e pensar em Libras. |

## 2. Linha de pesquisa: testbed ético de agentes sintéticos

Os motores fabricam vídeo curto de forma programática e barata. Essa mesma capacidade é usada fora daqui para comportamento inautêntico coordenado: redes de perfis falsos, streams vazios inflando recomendação, golpes com portfólio inventado. A proposta desta linha é **estudar esses fenômenos para aprender a detectá-los e mitigá-los**, simulando-os com agentes sintéticos **dentro de um ambiente fechado**, sem nunca executar o dano de verdade.

### Fenômenos de interesse

| Fenômeno | O que se quer entender (lado da defesa) |
|---|---|
| **Ataque Sybil** | Como muitas identidades controladas por um só operador distorcem votações, curtidas, denúncias e recomendações, e que sinais (tempo de criação, sincronia, grafo de interações) as denunciam. |
| **Evasão de filtros** | Quão robustos são os *nossos próprios* filtros e moderadores automáticos contra variações de texto, imagem e áudio. É red teaming do que nós construímos, com conteúdo marcador inofensivo. |
| **Grooming** | Que padrões de conversa e de escalada de contato os sistemas de proteção de crianças e adolescentes precisam reconhecer. O estudo é de **sinais de detecção** a partir de literatura e conjuntos de dados de pesquisa já existentes e anonimizados; **nunca** se gera conteúdo sexual nem se simula a vitimização de menores. |
| **Golpes de portfólio falso** | Como perfis e trabalhos fabricados (vídeos, "cases", depoimentos) ganham credibilidade, e como verificar autenticidade e procedência. |
| **Fake streamers** | Como transmissões sintéticas ou em loop afetam recomendação e métricas de audiência, e como detectar inatividade e conteúdo repetido. |
| **Fenômenos de coordenação em geral** | Postagem sincronizada, mensagens repetidas, amplificação artificial: o que diferencia coordenação legítima (uma campanha transparente) de manipulação. |

### Tipos de agente para o testbed

São padrões de coordenação simulados **sem dano real**:

- **Agente normal:** comportamento aleatório dentro de distribuições realistas (horários, frequência, tamanho das mensagens). É a linha de base.
- **Agente coordenado benigno:** posta em horários sincronizados com mensagens de uma lista fixa. Serve para medir se a detecção de coordenação funciona.
- **Agente spam:** repete mensagens genéricas para testar limite de taxa (*rate limiting*) e moderação automática.
- **Fake streamer sintético:** transmite um vídeo genérico em loop, gerado por estes motores, para testar recomendação e detecção de inatividade.
- **Agente de teste de moderação:** tenta ações que **devem** ser bloqueadas, usando marcadores inofensivos no lugar de conteúdo nocivo real.

### Regras do testbed

1. **Ambiente fechado e próprio.** Uma instância local de plataforma aberta (por exemplo Mastodon, PeerTube ou Owncast numa rede isolada), sem saída para a internet. **Nunca** em plataformas reais: além de antiético, viola os termos de uso.
2. **Ninguém real como alvo.** Sem pessoas reais, sem dados pessoais, sem interação com usuários reais. Todas as contas são sintéticas e marcadas como tal.
3. **Conteúdo marcador, nunca nocivo.** Mensagens e vídeos são neutros e rotulados (`[TESTE]`). Nenhuma desinformação, ódio, conteúdo sexual ou golpe funcional é produzido.
4. **O objetivo publicado é a defesa.** Os resultados viram métricas, detectores, conjuntos de dados sintéticos rotulados e recomendações de mitigação. Não se publicam receitas de ataque operacionais.
5. **Revisão ética e divulgação responsável.** Pesquisa com qualquer componente humano passa por comitê de ética (no Brasil, CEP/Conep). Fragilidades encontradas em sistemas de terceiros são comunicadas ao responsável antes de qualquer publicação.
6. **Rótulo em tudo.** Todo artefato gerado carrega marca d'água e metadado de "sintético, para pesquisa".

Esta linha é **direção**, não código: o repositório não contém agentes nem automação de contas. Quem quiser colaborar com pesquisa nessa área, abra uma issue para discutirmos desenho e ética antes de qualquer implementação.
