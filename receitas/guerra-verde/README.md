# Guerra Verde: "Do alerta à operação"

Vídeo vertical (1080×1920, ~60 s, com narração, legenda e som) no formato "passo a passo" para recomendar a série *Operação Guerra Verde*. Ele mostra o caminho de uma fiscalização do Ibama: uma árvore cai, a câmera se afasta até o mapa da Amazônia, um satélite do INPE passa, o DETER carimba o alerta, a equipe planeja a rota, vai de estrada, rio e helicóptero, autua em campo e inutiliza a máquina. No fim, de volta ao mapa, entra a chamada da série. Tudo é desenhado à mão sobre papel kraft: traço de nanquim que treme, aguada de aquarela em musgo e ocre e escrita à mão. Nenhuma cena da série é usada, então o vídeo não esbarra no Content ID.

```bash
python receitas/guerra-verde/som/baixar.py       # sons do Wikimedia Commons (uma vez)
python receitas/guerra-verde/preparar.py         # texturas + narração de cada cena + tempos.json
node receitas/guerra-verde/gerar.mjs             # → saida/guerra-verde/do-alerta-a-operacao.mp4 (com som)
node receitas/guerra-verde/gerar.mjs --mudo      # sem som
node receitas/guerra-verde/gerar.mjs --teste     # folha de contato (prévia em segundos)
node receitas/guerra-verde/gerar.mjs --quadro 17.8   # um quadro em tamanho real
```

- O texto falado, as palavras-chave e as transições ficam em `roteiro.json`:
  - Cada cena tem `fala`, `marcas` e `transicao`. As `marcas` são as palavras que disparam a animação: a árvore tomba no "cai" e o carimbo bate no "alerta". A `transicao` pode ser `zoom` (a cena encolhe até um ponto da seguinte) ou `funde`.
  - Em `voz` ficam o provedor, a voz e as opções dele. Hoje é o ElevenLabs (voz George, modelo `eleven_v3`, idioma `pt`), com a chave lida do `.env` na raiz. No plano gratuito do ElevenLabs só as vozes padrão da conta funcionam pela API, o uso não pode ser comercial e o crédito ao ElevenLabs é obrigatório. Para trocar pela sua voz, use o provedor `gravacao`.
- `preparar.py` sintetiza a fala de cada cena separadamente e monta o `tempos.json`. Cada cena dura o que a fala pede, e as marcas viram instantes. Só sintetiza de novo a fala que mudou.
- `pronuncia.json` guarda a grafia que a voz recebe ("HBO Max" → "agá bê ó Max"). A legenda continua com o texto do roteiro.
- `desenhos.js` tem os filtros (traço, aquarela, giz), as formas à mão (copa, toco, rodas, setas) e os desenhos do satélite, da caminhonete, do barco e do helicóptero.
- `cena.js` e `cena.css` têm a coreografia (contrato em `motores/render/CONTRATO.md`), a legenda palavra a palavra e o rótulo "narração gerada por IA".
- `som/mixar.py` põe narração, efeitos, ambiente e música nos tempos da animação e normaliza para −14 LUFS:
  - Os efeitos são lápis, papel, carimbo, o estalo e o tombo da árvore, motosserra, carro, barco, helicóptero e o bipe do satélite (sintetizado).
  - O ambiente é a floresta amazônica gravada por Félix Blume (CC0). A música é *The Long Dark*, de Scott Buckley (CC BY 3.0).
  - Música e floresta baixam 6 dB enquanto a voz fala.
- **Quadro oficial (opcional).** Ponha um still de divulgação da série em `quadro-oficial.jpg` e a cena final o mostra solto, com borda de papel rasgado, no lugar da arvorezinha.

## Créditos que vão na descrição do post

- Música: "The Long Dark", Scott Buckley (CC BY 3.0).
- Motor de barco: Work With Sounds (CC BY 4.0).
- Floresta: Félix Blume (CC0).
- Narração: voz sintética do ElevenLabs (obrigatório no plano gratuito, que também não permite uso comercial).

Os demais sons são CC0 ou de domínio público. A lista completa está em `som/creditos.json`, `receitas/promo/som/creditos.json` e `receitas/unboxing/som/creditos.json`.

## Conferir antes de publicar

- Se *Operação Guerra Verde* ainda está na HBO Max e se tem 10 episódios (cena final).
- O Decreto 6.514/2008, art. 111, que permite destruir ou inutilizar instrumentos da infração quando não dá para retirá-los (cena da máquina).
- Se a narração for sintética, mantenha o rótulo "narração gerada por IA" e marque o conteúdo como gerado por IA na plataforma.
