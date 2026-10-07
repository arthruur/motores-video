# Como contribuir

Obrigado pelo interesse. Este repositório é pequeno de propósito: três motores independentes, bem medidos e bem explicados. Contribuições que mantêm isso são muito bem-vindas.

## Como propor

1. **Abra uma issue antes de código grande.** Conte o problema, o que você mediu e o que pretende mudar. Os [problemas em aberto](docs/direcoes.md#problemas-em-aberto-bons-para-contribuir) são bons pontos de partida.
2. **Correções pequenas** (erro de digitação, mensagem de erro, documentação) podem ir direto num pull request.
3. **Um PR, um assunto.** Diga no texto do PR o que mudou, como você testou e os números antes/depois quando houver desempenho envolvido.
4. **Pesquisa do testbed de agentes sintéticos**: só por issue, para discutir desenho e ética **antes** de qualquer código. Leia as regras em [docs/direcoes.md](docs/direcoes.md#2-linha-de-pesquisa-testbed-ético-de-agentes-sintéticos).

## Estilo

- **Português do Brasil** em código (nomes de funções e variáveis), comentários, mensagens de erro e documentação. Termos técnicos consagrados podem ficar em inglês (`seek`, `stdin`, *ducking*).
- **Comentários curtos** que explicam o *porquê*, não o *o quê*.
- **Sem caminhos fixos.** Tudo por argumento de CLI, variável de ambiente ou relativo ao repositório.
- **CLI com `--help` claro** e **função importável** para cada operação: o motor precisa funcionar como comando e como biblioteca.
- **Mensagens de erro que dizem o que fazer** (por exemplo, apontar para o `CONTRATO.md` quando a cena não responde).
- **Dependências leves.** Antes de adicionar uma, veja se a biblioteca padrão ou o ffmpeg resolvem. Dependência **GPL** só como opcional, fora do `requirements.txt`, e registrada no [THIRD_PARTY.md](THIRD_PARTY.md). Serviço pago só com chave **e** confirmação explícita (`--permitir-pago`).
- JavaScript: ESM, Node 20+, sem etapa de build. Python: 3.10+, `pathlib`, `argparse`, tipagem quando ajuda a ler.
- Exemplos e testes com conteúdo **neutro** (ciência, cotidiano).

## Testes

Não há suíte automatizada ainda (contribuição bem-vinda). Antes de abrir o PR, rode o que a sua mudança toca e confira **olhando**:

```bash
# render
node motores/render/render.mjs exemplos/ola-mundo --teste 0.5,1.5,3,5 --zonas   # abra a folha de contato
node motores/render/render.mjs exemplos/ola-mundo --verificar                    # 0 quadros pulados diferentes

# voz
python -m motores.voz.cli sintetizar exemplos/voz/frase.txt --provedor edge --saida saida/voz/frase.wav --qa

# legenda
python motores/legenda/gerar.py exemplos/legenda/palavras.json -o saida/legenda/lua.ass --relatorio saida/legenda/lua.json

# tudo junto
python exemplos/explicativo/gerar.py
```

- Mudou desempenho? **Meça** antes e depois na mesma máquina, diga qual máquina e quantas rodadas. Não arredonde para cima.
- Mudou algo visual (render, legenda)? Anexe a folha de contato (`--teste`) ao PR.
- O que não foi testado fica escrito como **não testado**.

## Ética: o que não aceitamos

Estes motores fazem vídeo, voz e legenda de forma barata e em escala. Por isso há limites que valem para contribuições, exemplos e para o uso que este projeto apoia:

- **Proibido deepfake de pessoa real.** Nada de imitar voz, rosto ou identidade de alguém real, vivo ou morto, com ou sem a intenção de enganar. Vozes sintéticas são de narrador.
- **Proibida automação de contas em plataformas reais.** Nada de postar, comentar, curtir, seguir ou transmitir automaticamente em redes sociais ou plataformas de streaming reais, nem criar perfis falsos, nem burlar limites de taxa ou moderação.
- **Proibido conteúdo nocivo**: desinformação, golpe, assédio, ódio, conteúdo sexual envolvendo menores (em qualquer forma) ou material que exponha pessoas reais sem consentimento.
- **Rótulo de IA.** Exemplos que usam voz ou imagem sintética dizem isso no vídeo e na descrição (o motor de voz devolve o rótulo pronto).
- **Pesquisa de defesa só em ambiente fechado.** A linha do testbed de agentes sintéticos simula fenômenos (Sybil, evasão de filtros, fake streamers etc.) **para estudar e mitigar**, numa instância própria isolada, com conteúdo marcador inofensivo, nunca contra plataformas ou pessoas reais. Ver as regras em [docs/direcoes.md](docs/direcoes.md).

PRs ou issues que contrariem esses pontos serão fechados.

## Licença das contribuições

Ao contribuir, você concorda que a sua contribuição seja licenciada sob a [Apache-2.0](LICENSE), como o resto do repositório (seção 5 da licença).
