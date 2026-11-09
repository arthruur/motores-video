# Piloto · A Despensa do Sertão

Primeiro teste do formato **explicativo** da série (referência: reels do *Engenharia do Sertão*): um cenário fixo, um narrador em 2ª pessoa e o **Mangaio como o "você"** que faz cada passo. A Dona Mandioca entra uma vez com o bordão. Duração: ~64 s.

```powershell
python receitas/novela-da-caatinga/episodios/despensa-do-sertao/voz.py          # 1x (Gemini TTS, 2 pedidos)
node receitas/novela-da-caatinga/episodios/despensa-do-sertao/gerar.mjs --teste  # folha de contato
node receitas/novela-da-caatinga/episodios/despensa-do-sertao/gerar.mjs          # → saida/novela-da-caatinga/despensa-do-sertao.mp4
```

| Arquivo | O que faz |
|---|---|
| `roteiro.json` | Beats da narração (texto + rótulo do topo) e a fala da Dona Mandioca |
| `voz.py` | Narração em **uma tomada** (1 pedido de cota) + a fala dela; tempo de cada palavra; limites de cada beat |
| `som.py` | Corta a narração antes do beat "goma", encaixa a fala dela, grava `linha.json` e mixa (kit de sons, −14 LUFS) |
| `cena.js` | Cenário provisório em vetor, Mangaio (`mangaio-rig.svg`), Dona Mandioca (rig da demo), objetos, legenda e rótulos |
| `fundo.png` (opcional) | Cenário vazio gerado no Qwen-Image a partir das artes aprovadas; se existir, substitui o vetor |

**Divisão IA × vetor:** IA só na voz (TTS, rotular como IA ao publicar) e, quando entrar, no `fundo.png`. Personagens, objetos e efeitos são vetor/procedurais.

## Fatos do roteiro (conferir antes de publicar)

| Fala | Base | Cuidado |
|---|---|---|
| Na terra a mandioca espera até 2 anos | Colheita entre ~8 e 24 meses; a raiz fica "guardada" na roça | — |
| Arrancada, estraga em 3 dias | Deterioração fisiológica pós-colheita em 24–72 h (estrias azul-escuras, as "estrias" do desenho) | — |
| Mandioca brava tem caldo venenoso (manipueira) | Glicosídeos cianogênicos; a manipueira é tóxica e poluente | Vale para a **brava**, não para o aipim/macaxeira |
| Tipiti: puxa, estica e espreme | Trançado que estreita quando esticado | — |
| No fundo do caldo assenta a goma (a da tapioca) | A fécula decanta da manipueira | Em muitas casas a goma vem também da lavagem da massa |
| O fogo tira a água e o veneno vai embora no calor | O ácido cianídrico é volátil; a torra seca a farinha | — |
| Dura meses no saco | Farinha seca (baixa umidade) guarda por meses | Não usar número exato |
