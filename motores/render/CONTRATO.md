# Contrato da cena

O motor de render não sabe nada sobre o que a cena desenha. Ele abre uma página HTML no Chrome headless, pede um instante de cada vez e fotografa. Para isso, a página precisa cumprir três regras.

## As três definições

| O que | Tipo | Para quê |
|---|---|---|
| `window.DURACAO` | número (segundos, > 0) | Quantos quadros existem: `ceil(DURACAO × fps)`. |
| `window.seek(t)` | função `(t: número) => chave?` | Deixa a tela exatamente como ela é no instante `t`. Pode ser `async`. |
| `window.pronto` | `true` | Avisa que fontes, imagens e dados já carregaram. O motor espera até 30 s. |

Defina `DURACAO` e `seek` **antes** de `pronto = true`.

```html
<script>
function seek(t) {
  const p = Math.min(1, t / 2)               // 0 → 1 nos primeiros 2 s
  caixa.style.transform = `translateX(${(p * 600).toFixed(1)}px)`
  return p.toFixed(3)                        // chave de estado (opcional)
}
;(async () => {
  await document.fonts.ready
  window.DURACAO = 5
  window.seek = seek
  seek(0)
  window.pronto = true
})()
</script>
```

## Regra de ouro: a tela é 100% função de `t`

O motor divide os quadros entre vários processos Chrome (cada um pega uma fatia contígua) e pode pedir os instantes em qualquer ordem. Então:

- **Nada de relógio.** Sem CSS `animation`/`transition`, `setTimeout`, `requestAnimationFrame`, `Date.now()`, `<video>` tocando ou GIF animado. Tudo o que muda é calculado dentro de `seek(t)`.
- **Sem estado entre chamadas.** `seek(3)` depois de `seek(5)` tem que dar o mesmo que `seek(3)` direto.
- **Aleatório só com semente.** Se quiser variação, use um gerador com semente fixa.
- **Carregue tudo antes de `pronto`.** Fonte que chega atrasada faz o começo do vídeo sair com a fonte reserva. Use `await document.fonts.load('800 100px "Minha Fonte"')` e espere as imagens (`img.decode()`).

## Chave de estado (pulo de quadros)

Se `seek(t)` **retorna** um valor (string ou número) e ele é igual ao do quadro anterior, o motor não fotografa de novo: reenvia a foto anterior ao ffmpeg. Em cenas com pausas isso economiza muito (no exemplo `ola-mundo`, 62 de 180 quadros).

- A chave deve mudar **sempre** que algo visível mudar. Monte-a com os mesmos números que você aplica no estilo, já arredondados (arredondar evita que diferenças invisíveis, como 0,30000001, gerem fotos novas).
- Retornar `undefined`/`null` desliga o pulo para aquele quadro.
- Para conferir, rode com `--verificar`: o motor fotografa também os quadros pulados e conta quantos saíram diferentes (precisa dar 0).
- `--sem-dedup` desliga o pulo de vez.

## Tamanho e unidades

O viewport é o tamanho do vídeo: 1080×1920 por padrão (`--tamanho LxA` muda; os dois números precisam ser pares por causa do yuv420p). Escreva a cena em pixels desse tamanho.

### Zona segura (9:16)

Em Reels, TikTok e Shorts a interface cobre parte da tela. Em 1080×1920, o que fica de fora da zona segura é:

| Região | x, y, largura, altura |
|---|---|
| Topo | 0, 0, 1080, 288 |
| Faixa de baixo (descrição, legenda do app) | 0, 1248, 1080, 672 |
| Margem esquerda | 0, 288, 120, 960 |
| Botões da direita (alto) | 888, 288, 192, 552 |
| Botões da direita (baixo) | 780, 840, 300, 408 |

`--teste t1,t2,... --zonas` gera uma folha de contato com essas áreas em vermelho. Em outros tamanhos as zonas são escaladas na proporção.

## Arquivos da cena

O motor sobe um servidor estático local cuja raiz é a pasta da cena (ou `--raiz`). Assim `fetch('dados.json')`, imagens e áudio funcionam como num site. Duas regras:

- Nada fora da raiz é servido (`../` é bloqueado).
- As fontes do repositório (pasta `fontes/`) ficam em `/_fontes/`, para qualquer cena:
  `@font-face { font-family: 'Barlow Condensed'; src: url('/_fontes/BarlowCondensed-ExtraBold.ttf'); }`

## O que sai

- MP4 H.264, `yuv420p`, **faixa de TV com BT.709 marcado** (o JPEG do Chrome é faixa cheia BT.601; o motor converte com arredondamento preciso para as cores sólidas não escurecerem). `-crf 19` e preset `veryfast` por padrão.
- Com `--audio`, o áudio vira AAC 160 kb/s e é completado com silêncio (`apad`) ou cortado para ter **exatamente** a duração do vídeo.
- Áudio e legenda queimada não fazem parte da cena: ficam para os motores de voz e de legenda.
