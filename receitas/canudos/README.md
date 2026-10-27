# Canudos: edits épicos

Dois edits verticais (1080×1920) sobre a Guerra de Canudos, só com fotos reais e trilha sintetizada, feitos com o motor de render do repositório.

```bash
python receitas/canudos/baixar.py              # fotos/ (uma vez)
node receitas/canudos/gerar.mjs                # todos → saida/canudos/canudos-<nome>.mp4
node receitas/canudos/gerar.mjs a              # só um
node receitas/canudos/gerar.mjs a --teste      # folha de contato (prévia em segundos, na pasta temporária)
```

- **a**, "Canudos não se rendeu" (30 s, 96 BPM): do Conselheiro às quatro expedições, ao 2 de outubro e à frase de Euclides.
- **b**, "O sertão vai virar mar" (33 s, 80 BPM): das ruínas que saem do açude na seca até 1897, e de volta.

- `roteiros.json`: tudo o que se edita. Cada plano tem `foto`, duração `b` em batidas, `zoom` e `foco` (como nas Receitas do Bistrô), `secao` (`tensao`, `batida`, `drop`, `calmo`, `fim`, que comanda a trilha), `texto`/`sub`/`citacao`, `texto2` com `b2` (troca o título no meio do plano), `flash`, `tremor`, `cor`, `virapb` e `brilho`.
- `cena.js` / `cena.css`: P&B com granulado, vinheta, cortes secos na batida (contrato em `motores/render/CONTRATO.md`).
- `trilha.js`: trilha sintetizada no Web Audio, seguindo as seções do roteiro. Sem direitos de terceiros. Para usar uma música comercial, poste com o som da biblioteca do próprio app.
- O que é intermediário (página da cena, .wav) fica numa pasta temporária apagada no fim. Em `saida/canudos` só ficam os MP4.

Pesquisa, fontes dos fatos e as músicas candidatas: documento "Canudos: edit épico — pesquisa e roteiros".

## Créditos das imagens

| Arquivo | Imagem | Fonte | Licença |
|---|---|---|---|
| conselheiro | Caricatura do Conselheiro, Angelo Agostini, *Revista Illustrada*, 1897 | [Commons](https://commons.wikimedia.org/wiki/File:Conselheiro_Revista_Ilustrada.jpg) | Domínio público |
| vila | Vista do arraial de Canudos | [Commons](https://commons.wikimedia.org/wiki/File:Canudos_village.jpg) | Domínio público |
| mapa | Plano de operações de guerra no Estado da Bahia, 1897 | [Commons](https://commons.wikimedia.org/wiki/File:Canudos_(Cartogr%C3%A1fico)_%E2%80%94_plano_de_opera%C3%A7%C3%B5es_de_Guerra_no_Estado_da_Bahia.jpg) / Biblioteca Nacional | Domínio público |
| tropa | 40º Batalhão de Infantaria, Flávio de Barros, 1897 | [Commons](https://commons.wikimedia.org/wiki/File:40th_infantry_batallion_canudos_1897.jpg) | Domínio público |
| incendio | Ataque e incêndio de Canudos, Flávio de Barros, 1897 | [Brasiliana Fotográfica](https://brasilianafotografica.bn.gov.br/brasiliana/handle/20.500.12156.1/4862) | Domínio público. Crédito: Flávio de Barros / Acervo Museu da República / IMS |
| prisioneiros | 400 jagunços prisioneiros, Flávio de Barros, 1897 | [Brasiliana Fotográfica](https://brasilianafotografica.bn.gov.br/brasiliana/handle/20.500.12156.1/4860) | Idem |
| ruinas | Ruínas da Igreja Nova, Flávio de Barros, 1897 | [Commons](https://commons.wikimedia.org/wiki/File:Ruins_church_in_canudos_1897.jpg) | Domínio público |
| seca | Ruínas na seca do açude, 2013, Rita Barreto / Bahiatursa | [Commons](https://commons.wikimedia.org/wiki/File:XXX_Celebra%C3%A7%C3%A3o_Popular_de_Canudos_(Ruinas_e_Seca_no_A%C3%A7ude)._Foto_Rita_Barreto_-_Bahiatursa_(10157922225).jpg) | CC BY-SA 2.0 |
| acude | Açude de Cocorobó, A. Duarte | [Commons](https://commons.wikimedia.org/wiki/File:Dam_Cocorob%C3%B3_A%C3%A7ude_Cocorob%C3%B3_(23798031281).jpg) | CC BY-SA 2.0 |
