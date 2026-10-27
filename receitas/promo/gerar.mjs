// Gera os promos do Bistrô 153: uma página por peça de pecas.json → MP4 (24 fps) → som (efeitos).
//   node receitas/promo/gerar.mjs                  todas as peças
//   node receitas/promo/gerar.mjs manga linha      só essas
//   node receitas/promo/gerar.mjs manga --teste    folha de contato
//   --com-trilha                                    põe também a trilha de forró (padrão: só efeitos)
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const aqui = dirname(fileURLToPath(import.meta.url))
const repo = resolve(aqui, '../..')
const saida = join(repo, 'saida', 'receitas-bistro')
mkdirSync(saida, { recursive: true })
const args = process.argv.slice(2)
const { pecas } = JSON.parse(readFileSync(join(aqui, 'pecas.json'), 'utf8'))
const nomes = args.filter(a => !a.startsWith('--'))
const roda = (cmd, a) => { const r = spawnSync(cmd, a, { stdio: 'inherit' }); if (r.status) process.exit(r.status) }

for (const nome of nomes.length ? nomes : Object.keys(pecas)) {
  if (!pecas[nome]) { console.error(`peça "${nome}" não existe em pecas.json`); process.exit(1) }
  const pagina = join(aqui, `_${nome}.html`)
  writeFileSync(pagina, `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><title>${nome} · Receitas do Bistrô</title><link rel="stylesheet" href="promo.css"></head>
<body><div id="palco"></div><script>window.PECA = ${JSON.stringify(nome)}</script><script src="kit.js"></script><script src="promo.js"></script></body></html>
`)
  console.log(`\n== ${nome}`)
  const render = [join(repo, 'motores/render/render.mjs'), pagina, '--raiz', resolve(aqui, '..'), '--fps', '24']
  if (args.includes('--teste')) {
    const fim = pecas[nome].tipo === 'linha' ? 14.85 : 13
    roda(process.execPath, [...render, '--teste', [1.7, 3.4, 6.3, fim - 4.5, fim - 2.6, fim - 0.2].join(','), '--saida', join(saida, `promo-${nome}-teste.png`)])
    continue
  }
  roda(process.execPath, [...render, '--saida', join(saida, `promo-${nome}.mp4`)])
  roda('python', [join(aqui, 'som', 'mixar.py'), nome, ...(args.includes('--com-trilha') ? [] : ['--sem-trilha'])])
}
