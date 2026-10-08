# Acervo de vídeos de retenção: plano e coletor

A receita "Estímulo duplo" põe um vídeo sem som embaixo da fala. A Prensa oferece duas fontes para esse vídeo, e nenhuma exige gameplay de terceiros:

1. **Animações geradas na hora** (`app/src/retencao.ts`): Pêndulos, Bolinhas, Tinta e Encaixe. São desenhadas quadro a quadro, sem download e sem direito autoral de ninguém. É o padrão.
2. **Acervo de vídeos reais com licença livre**: clipes de 15 s em 9:16, coletados automaticamente e **revisados por uma pessoa** antes de aparecer no app.

Pesquisa de licenças e APIs feita em 08/10/2026. Isto não é parecer jurídico.

## De onde pode vir (e de onde não)

| Fonte | Pode re-hospedar no acervo? | Por quê |
|---|---|---|
| **Wikimedia Commons** | **Sim**, quando a licença é CC0, domínio público ou CC BY (com crédito ao autor). CC BY-SA só com `--aceitar-sa`, e aí o reel herda a BY-SA | [Reuso fora da Wikimedia](https://commons.wikimedia.org/wiki/Commons:Reusing_content_outside_Wikimedia). API sem chave, que libera acesso para outros sites (CORS) |
| Internet Archive | Só item a item (CC0, domínio público, CC BY). O IA não garante o status | [Ajuda do IA](https://help.archive.org/help/rights/). Ainda não está no coletor |
| Pexels, Pixabay | **Não.** Os termos proíbem distribuir o arquivo sozinho, copiar em massa e montar um serviço concorrente | [Pexels](https://www.pexels.com/terms-of-service/), [Pixabay](https://pixabay.com/service/terms/). Uso possível no futuro: **busca ao vivo** com a chave da própria pessoa, baixando do CDN deles só para o reel dela, com "Videos provided by Pexels/Pixabay" na tela |
| Coverr, Mixkit | Não | A API do Coverr proíbe uso comercial e não traz autor; o Mixkit proíbe robôs e repasse a terceiros |
| Gameplay (Minecraft, Subway Surfers) | **Não** | As regras da Mojang cobrem vídeo da **sua** jogada, não um acervo distribuído por um app ([Mojang](https://www.minecraft.net/en-us/usage-guidelines)). Os termos da SYBO são "personal non-commercial use only". Quem quiser usa a própria gravação, pelo botão "Ou envie o seu" |

## Onde hospedar (e por que não o Google Drive)

| Opção | Funciona no navegador? | Veredito |
|---|---|---|
| Google Drive | **Não**: o link de download não libera acesso para outros sites (CORS) e a cota por arquivo não é documentada (relatos de bloqueio de cerca de 24 h) | Não usar |
| GitHub Releases | **Não**: o redirecionamento sai sem o cabeçalho de CORS | Só para scripts |
| Hugging Face Datasets | **Sim** | Boa opção para um acervo grande e público, com dataset card listando as licenças |
| **Junto do app** (mesma origem) | **Sim**, sem CORS | **O que a Prensa usa hoje**: `app/public/acervo/` vai junto no build e funciona offline |

## O coletor

`ferramentas/acervo/coletar.py` usa só a biblioteca padrão do Python e o ffmpeg; a folha de contato usa o Pillow.

```bash
python ferramentas/acervo/coletar.py --por-categoria 3     # busca, corta e grava (revisado: false)
python ferramentas/acervo/coletar.py --folha               # app/public/acervo/folha.png, um quadro por clipe
python ferramentas/acervo/coletar.py --aprovar areia-01 natureza-02
python ferramentas/acervo/coletar.py --rejeitar slime-01   # apaga e não baixa de novo
python ferramentas/acervo/coletar.py --restaurar           # num clone novo: refaz os aprovados
```

**Como funciona:**
- Busca no Commons por categoria (areia, slime, tinta, bolinhas, máquinas, cerâmica, natureza, viagem, cozinha).
- **Rejeita** sozinho o que tem licença fora da lista, campo de restrições preenchido (pessoas, marcas) ou não é vídeo.
- Baixa cada arquivo uma vez, respeitando o tempo de espera que o servidor pede (429), e corta 15 s em 720×1280 sem áudio.
- Grava em `acervo.json`: crédito, licença, link da origem, sha256 e o que foi modificado.
- O **git guarda só o `acervo.json`**; os `.mp4` são refeitos com `--restaurar`. O app mostra só clipes com `revisado: true` cujo arquivo existe.

**Por que a revisão humana é obrigatória:** na primeira coleta (08/10/2026), de 18 clipes, só 6 foram aprovados. A busca trouxe:
- um desenho animado de terceiros marcado como CC BY;
- imagens de microscopia para "slime";
- uma tela de software para "tinta";
- um protesto para "máquinas";
- o rosto de uma pessoa numa campanha de saúde para "cerâmica".

A licença no Commons diz o que o autor declarou, não o que a imagem mostra.

**Aprovados nessa coleta:** areia cinética sendo cortada, gelo visto da órbita (NASA), motores hidráulicos, duas cachoeiras e um túnel de metrô. Os créditos estão no `app/public/acervo/acervo.json`.

## Próximos passos

- Mais termos de busca e categorias; o Internet Archive como segunda fonte.
- Publicar o acervo maior como dataset no Hugging Face, com o mesmo `acervo.json` como manifesto.
- Busca ao vivo no Pexels e no Pixabay com a chave da pessoa (sem re-hospedar).
- Exportar um `CREDITOS.txt` junto do vídeo.
