# Guia para agentes de IA

Este arquivo é para o agente (Antigravity, Claude Code, Codex…) que abrir este repositório. Leia antes de mexer em qualquer coisa.

## O que é

Motores locais para fazer vídeo vertical (1080×1920, 30 fps) com código: uma cena é uma página HTML que o `motores/render` fotografa quadro a quadro. Não há editor de vídeo nem timeline gráfica: a animação é código, e a tela é **função pura do tempo** `t`.

Leia nesta ordem:
1. `README.md`: instalação (Python 3.10+, Node 20+, Chrome ou Edge, `ffmpeg` com libass) e mapa do repositório.
2. `motores/render/CONTRATO.md`: as três regras de uma cena (`window.DURACAO`, `window.seek(t)`, `window.pronto`). **Sem CSS animation/transition, setTimeout, requestAnimationFrame, Date.now() ou aleatório sem semente.** Quebrar isso faz o vídeo tremer ou sair errado.
3. `exemplos/explicativo/`: o exemplo de ponta a ponta (roteiro → voz → cena → render → legenda → mixagem). É o melhor modelo para copiar.
4. `receitas/guerra-verde/`: uma peça real, desenhada à mão, em que cada animação dispara numa palavra da narração.

## Regras do repositório

- Trabalhe numa branch própria; não faça commit direto na `main`.
- Cada vídeo novo ganha a sua pasta (em `receitas/<nome>/` ou num diretório do próprio autor), com um `README.md` que diga como gerar.
- O que é gerado vai para `saida/` (fora do git). Vídeos brutos de entrada também ficam fora do git (ponha em `entrada/` e confira o `.gitignore`).
- Chaves de API ficam no `.env` da raiz, nunca no código.
- Gere uma **folha de contato** (prévia em PNG) antes do render completo, para conferir rápido.
- Escreva em português, como o resto do projeto.

## Receita: animar uma narração que já foi gravada

O caso comum de quem já tem a aula ou explicação gravada e quer só a animação por cima ou no lugar da imagem.

1. **Extrair o áudio** do vídeo: `ffmpeg -i entrada/aula.mp4 -vn -ac 1 -ar 48000 entrada/aula.wav`.
2. **Ter o texto da fala.** Se o autor não tem o roteiro, faça um rascunho pelo Whisper (`motores/voz/audio.py`, função `transcrever`) e **peça para o autor revisar** (termos técnicos, fórmulas, nomes). O texto revisado manda; o reconhecimento só empresta os tempos.
3. **Tempos por palavra:** `python -m motores.voz.cli alinhar entrada/aula.wav texto.txt --json saida/aula/palavras.json` (use `--vad` se houver ruído ou silêncio longo, e `--dica` se houver termos raros).
4. **Dividir em cenas e marcar gatilhos**: as palavras em que algo acontece na tela ("a bola **cai**", "a força **dobra**"). Siga o formato de `exemplos/explicativo/roteiro.json` (`gatilhos`) ou as `marcas` de `receitas/guerra-verde/roteiro.json`.
5. **Escrever a cena** (HTML/SVG/Canvas) cumprindo o contrato: cada elemento entra no instante do seu gatilho. Para física, calcule a posição pela equação (por exemplo, `y = y0 + v0·t - g·t²/2` com o `t` local da cena) em vez de interpolar à mão: fica fiel e determinístico.
6. **Render** com `node motores/render/render.mjs` (veja `motores/render/README.md`) e **junte o áudio original** com ffmpeg. A voz gravada não passa por TTS: o exemplo explicativo aceita `-p gravacao`, e o motor de voz tem `--arquivo` e `--limpar` para esse provedor.
7. **Legenda** (opcional): `motores/legenda/gerar.py` lê o mesmo `palavras.json`.

Se a narração for do próprio autor, não precisa de rótulo de IA na voz. Se algum trecho usar voz sintética, mantenha o rótulo "narração gerada por IA".
