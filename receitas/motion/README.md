# Receitas do Bistrô: vídeos motion

Vídeos verticais (1080×1920) de divulgação dos potes do Bistrô 153, feitos com o motor de render do repositório.

```bash
node receitas/motion/gerar.mjs                  # todos os vídeos → saida/receitas-bistro/*.mp4
node receitas/motion/gerar.mjs pesto            # só um
node receitas/motion/gerar.mjs linha --teste    # folha de contato (prévia em segundos)
```

- `videos.json`: tudo o que se edita. Em `marca` ficam o nome, a chamada e o @. Cada vídeo é uma lista de planos:
  - `foto`: número da foto em `fotos/`.
  - `dur`: duração em segundos.
  - `zoom` [início, fim]: abaixo de 1, a foto fica menor e a sobra é preenchida com a versão desfocada.
  - `foco` [[x,y] início, [x,y] fim]: ponto da foto, de 0 a 1, que vai para o centro.
  - `alvo`: altura da tela, em px, onde o foco fica.
  - `gancho` ou `rotulo` + `sub`: os textos.
  - `trans`: `circulo` ou `fade`.
- `cena.js` / `cena.css`: o desenho, em função de `t` (contrato em `motores/render/CONTRATO.md`).
- `fotos/` vem dos HEIC de `receitas/` (2400 px), e `fotos/borrada/` são as versões desfocadas para o fundo.

Os vídeos saem sem som: a ideia é pôr a trilha no próprio Instagram/TikTok, com um áudio da biblioteca da rede.
