# Acervo de vídeos de retenção: pesquisa, plano e coletor

A receita "Estímulo duplo" põe um vídeo sem som embaixo da fala. A Prensa oferece três fontes para esse vídeo, e nenhuma usa gameplay de terceiros:

1. **Animações geradas na hora** (`app/src/retencao.ts`): Pêndulos, Bolinhas, Tinta e Encaixe. São desenhadas quadro a quadro, sem download e sem direito autoral de ninguém. É o padrão.
2. **Acervo de clipes reais com licença livre**, coletado automaticamente, **revisado por uma pessoa** e publicado num **dataset do Hugging Face**.
3. **O vídeo da própria pessoa** ("Ou envie o seu").

Pesquisas feitas em 08/10/2026. Isto não é parecer jurídico.

## O que viraliza, e o que dá para ter com licença livre

O YouTube contou mais de 32 bilhões de visualizações relacionadas a "oddly satisfying" nos EUA só nos primeiros 9 meses de 2023. As categorias citadas foram slime, areia cinética, bolinhas caindo, limpeza de piscina e "trabalhadores fazendo seu trabalho" ([YouTube](https://blog.youtube/culture-and-trends/youtube-oddly-satisfying-asmr-videos/)). Não há estudo controlado sobre por que esses vídeos satisfazem. O mais próximo é sobre ASMR: quem sente o efeito teve queda de frequência cardíaca e afeto mais positivo ([Poerio et al. 2018](https://eprints.whiterose.ac.uk/132445/1/Poerio%2C%20Blakey%2C%20Hostler%20%26%20Veltri%20%282018%29%20ASMR.pdf)). Sobre a tela dividida em si, ver [docs/receitas.md](receitas.md).

**A conclusão que orienta o plano:** as categorias que mais viralizam (slime, areia cinética, sabão, lavagem a jato, bolo, tinta) **quase não existem com licença livre**. Achamos de 0 a 3 vídeos de cada no Commons. Para elas, o caminho é **gravar o próprio material** (e publicar como CC0) ou **gerar por procedimento**, como as animações da Prensa. O que existe em volume e com pouco lixo é timelapse de céu, espaço (NASA), água, impressão 3D, máquinas, artesanato, mecanismos e câmera em movimento (POV).

## O plano de coleta (cerca de 60 clipes de 15 s)

Regras para todas as linhas:
- licença CC0, domínio público ou CC BY. CC BY-SA vai para um balde separado, só com `--aceitar-sa`;
- pelo menos 720 px de altura e 20 s de duração;
- sem rosto em primeiro plano, sem logo de marca, áudio descartado.

| Categoria | Fonte | Consulta | Alvo |
|---|---|---|---|
| Espaço | NASA e Commons | API da NASA: "Earth Views", "ISS earth views". Commons: `incategory:"Videos of Earth from space"`, `incategory:"Ultra High Definition videos from NASA"` | 8 |
| Céu | Commons | `incategory:"Time-lapse videos of clouds"`, `"…of sunsets"`, `"…of astronomy"` | 9 |
| Água | Commons | `incategory:"Videos of waterfalls"`, `incategory:"Slow motion videos of fluid mechanics"` | 5 |
| Impressão 3D | Commons | `incategory:"Time-lapse videos of machines"`, `incategory:"Videos of 3D printing"` | 5 |
| Máquinas | Commons | `incategory:"Videos of cutting machines"`, "CNC lathe", "laser cutting", "forging", `incategory:"Videos of agricultural machines"` | 6 |
| Artesanato | Commons | `incategory:"Videos of pottery manufacturing"`, `"…of glassblowing"`, `"…of the manufacture of candy"`, "latte art" | 6 |
| Mecanismos | Commons | `incategory:"Videos of domino effect"`, "Newton's cradle", "Rube Goldberg", "kinetic sculpture" | 4 |
| POV | Commons | `incategory:"First-person videos on bicycle"`, `"…on foot"`, `"Videos of rail transport with onboard view"`, "cab ride", `"Videos of roller coasters"`, `"Hyperlapse videos"` | 8 |

**Nunca usar busca ampla:**
- `deepcat:"First-person videos"` traz vídeo de bodycam de polícia;
- "Dashcam videos" traz agressão;
- `filetype:video slime` traz microscopia e desenho animado de terceiros.

## Onde não buscar, e por quê

| Fonte | Por quê |
|---|---|
| Pexels, Pixabay | Os termos proíbem re-hospedar e copiar em massa ([Pexels](https://www.pexels.com/terms-of-service/), [Pixabay](https://pixabay.com/service/terms/)). No futuro: busca ao vivo com a chave da própria pessoa, sem re-hospedar |
| Coverr, Mixkit | A API do Coverr proíbe uso comercial; o Mixkit proíbe robôs e repasse |
| ESA | O aviso de copyright proíbe uso comercial sem autorização escrita, o que conflita com a CC BY-SA IGO |
| Openverse | Não tem vídeo (só imagem e áudio) |
| Datasets do HF "abertos" | O `OpenVid-1M` se diz CC BY 4.0, mas manda seguir as licenças das fontes (YouTube): inutilizável. O `finevideo` tem acesso fechado e obrigações de remoção |
| Gameplay (Minecraft, Subway Surfers) | As regras da Mojang cobrem vídeo da **sua** jogada, não um acervo distribuído; a SYBO só permite uso pessoal não comercial |
| Gameplay de jogos livres (SuperTuxKart, Luanti) | Pode ser distribuído, mas os assets são **CC BY-SA**. Um clipe BY-SA dentro da tela dividida provavelmente faz o reel inteiro sair BY-SA. Fica para o balde marcado, se um dia entrar. O SuperTuxKart tem modo de corrida automática (`--profile-time`), que permitiria gravar sem jogar |

**NASA:** o material é geralmente de domínio público ([regras](https://www.nasa.gov/nasa-brand-center/images-and-media/)). O coletor:
- descarta o áudio, porque a trilha pode ser licenciada;
- pula itens com crédito de terceiros na descrição;
- não usa o logo da NASA nem sugere endosso.

## Onde hospedar: Hugging Face Datasets

| Opção | Funciona no navegador? | Veredito |
|---|---|---|
| **Hugging Face Datasets** | **Sim**: o `resolve/main/...` libera acesso para outros sites (CORS) | **Escolhido.** Público, versionado, com cartão listando as licenças |
| Junto do app (`app/public/acervo/`) | Sim, sem CORS | O app tenta aqui primeiro (`app/src/acervo.ts`) |
| Google Drive | **Não** para servir ao app: sem CORS e com cota não documentada | Só como **caixa de entrada colaborativa**: `processar_drive.py` baixa, corta e manda para revisão (ver [contribuir_acervo.md](contribuir_acervo.md)) |
| GitHub Releases | **Não**: o redirecionamento sai sem CORS | Só para scripts |

## O coletor

`ferramentas/acervo/coletar.py` usa só a biblioteca padrão do Python e o ffmpeg; a folha de contato usa o Pillow. A publicação é com `huggingface.py` (abaixo).

```bash
python ferramentas/acervo/coletar.py                         # coleta o plano inteiro
python ferramentas/acervo/coletar.py --categorias ceu agua --escala 0.5
python ferramentas/acervo/coletar.py --folha                  # app/public/acervo/folha.png
python ferramentas/acervo/coletar.py --aprovar ceu-01 agua-02
python ferramentas/acervo/coletar.py --rejeitar pov-03        # apaga e não baixa de novo
python ferramentas/acervo/coletar.py --restaurar              # num clone novo: refaz os aprovados
```

**Como funciona:**
- Para o Commons, baixa a **versão recodificada mais leve com pelo menos 720p**, não o original (que pode ter centenas de MB). Para a NASA, baixa o `~medium.mp4`.
- Respeita o tempo de espera do servidor (429) e corta 15 s em 720×1280 sem áudio.
- Grava em `acervo.json`: crédito, licença, link da origem, sha256 e as modificações.
- O git guarda só o `acervo.json`; os `.mp4` são refeitos com `--restaurar`. O app mostra só clipes com `revisado: true` cujo arquivo existe, e avisa quando um clipe é CC BY-SA.

**Por que a revisão humana é obrigatória:** a licença no Commons diz o que o autor declarou, não o que a imagem mostra. Na primeira coleta, por termos soltos, só 6 de 18 clipes passaram. A busca trouxe:
- um desenho animado de terceiros marcado como CC BY;
- microscopia para "slime";
- um protesto para "máquinas";
- o rosto de uma pessoa numa campanha de saúde.

## Publicação no Hugging Face Datasets

Para servir o acervo de forma pública e sem depender de hospedar os arquivos `.mp4` pesados no repositório git, usamos o Hugging Face Datasets:

```bash
# Gera o README.md formatado com dataset card e YAML frontmatter para o HF
python ferramentas/acervo/huggingface.py --card

# Exporta os clipes aprovados e o manifesto para uma pasta de publicação
python ferramentas/acervo/huggingface.py --exportar pasta_hf/

# Publica diretamente no repositório (requer huggingface_hub instalado e autenticado)
python ferramentas/acervo/huggingface.py --upload --repo usuario/prensa-acervo
```

O aplicativo (`app/src/acervo.ts`) tenta primeiro carregar os arquivos da pasta local (`./acervo/`), e recorre automaticamente à URL pública do Hugging Face Datasets (`resolve/main`) caso os `.mp4` não estejam no servidor local. Uma vez selecionado, o vídeo fica salvo no `CacheStorage` do navegador para funcionar offline.

## Próximos passos

- **Gravar o satisfying clássico** (areia, sabão, tinta, slime) em CC0 e publicar no mesmo dataset.
- **Mais animações geradas:** simulação de fluido e corrida de bolinhas com física.
- Internet Archive (Prelinger, domínio público) como segunda fonte.
- Trilhas de áudio livres (phonk e lo-fi) catalogadas no mesmo manifesto.
- **Busca ao vivo no Pexels e no Pixabay** com a chave da própria pessoa, sem re-hospedar.
- **Exportar um `CREDITOS.txt`** junto do vídeo.
