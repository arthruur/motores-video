// Gera um capítulo da Novela da Caatinga com o motor de render do repositório.
//   node receitas/novela-da-caatinga/gerar.mjs                → saida/novela-da-caatinga/<roteiro.saida> (com som)
//   node receitas/novela-da-caatinga/gerar.mjs --mudo         sem som
//   node receitas/novela-da-caatinga/gerar.mjs --teste        folha de contato (um instante de cada fala)
//   node receitas/novela-da-caatinga/gerar.mjs --teste 4.5,8  só esses instantes
// Antes: python receitas/novela-da-caatinga/preparar.py (vozes e tempos.json).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const aqui = dirname(fileURLToPath(import.meta.url))
const repo = resolve(aqui, '../..')
const saida = join(repo, 'saida', 'novela-da-caatinga')
mkdirSync(saida, { recursive: true })
const args = process.argv.slice(2)
const R = JSON.parse(readFileSync(join(aqui, 'roteiro.json'), 'utf8'))
const T = JSON.parse(readFileSync(join(aqui, 'tempos.json'), 'utf8'))
const pagina = join(aqui, '_cena.html')
writeFileSync(pagina, `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><title>novela da caatinga</title><link rel="stylesheet" href="cena.css"></head>
<body><div id="palco"></div><script src="personagens.js"></script><script src="cena.js"></script></body></html>
`)
const run = (cmd, a) => { const r = spawnSync(cmd, a, { stdio: 'inherit' }); if (r.status) process.exit(r.status ?? 1) }
const opc = ['--raiz', aqui]
const i = args.indexOf('--teste')
if (i >= 0) {
  const padrao = T.cenas.flatMap(c => c.falas.length ? c.falas.map(f => c.ini + f.ini + f.dur * 0.6) : [c.ini + c.dur * 0.6])
  const ts = args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : padrao.map(t => t.toFixed(2)).join(',')
  opc.push('--teste', ts, '--saida', join(saida, 'teste.png'))
} else {
  if (!args.includes('--mudo')) {
    run('python', [join(aqui, 'som', 'mixar.py')])
    opc.push('--audio', join(saida, 'som.wav'))
  }
  opc.push('--saida', join(saida, R.saida))
}
run(process.execPath, [join(repo, 'motores/render/render.mjs'), pagina, ...opc])
