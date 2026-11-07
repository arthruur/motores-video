// Demo de animação do Mangaio com o motor de render do repositório.
//   node receitas/novela-da-caatinga/demos/mangaio/gerar.mjs            → saida/novela-da-caatinga/demo-mangaio.mp4 (com som)
//   node receitas/novela-da-caatinga/demos/mangaio/gerar.mjs --mudo     sem som
//   node receitas/novela-da-caatinga/demos/mangaio/gerar.mjs --teste    folha de contato → demo-mangaio-contato.png
//   node receitas/novela-da-caatinga/demos/mangaio/gerar.mjs --teste 4.5,8   só esses instantes
// A raiz do servidor é a pasta da série, para a cena ler arte/banco/cesto/, texturas/ e fontes/.
import { mkdirSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const aqui = dirname(fileURLToPath(import.meta.url))
const serie = resolve(aqui, '../..')
const repo = resolve(serie, '../..')
const saida = join(repo, 'saida', 'novela-da-caatinga')
mkdirSync(saida, { recursive: true })
const args = process.argv.slice(2)
const run = (cmd, a) => { const r = spawnSync(cmd, a, { stdio: 'inherit' }); if (r.status) process.exit(r.status ?? 1) }

// um instante de cada beat da reel
const CONTATO = '0.95,2.05,3.5,5.3,6.8,8.4,9.1,9.8,10.5,11.3,12.0,14.8,16.2,19.2,21.6,23.4,25.35,26.4,27.55,29.7,30.9,32.1,33.0,34.7'
const opc = ['--raiz', serie]
const i = args.indexOf('--teste')
if (i >= 0) {
  const ts = args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : CONTATO
  opc.push('--teste', ts, '--saida', join(saida, 'demo-mangaio-contato.png'))
} else {
  if (!args.includes('--mudo')) {
    run('python', [join(aqui, 'som.py')])
    opc.push('--audio', join(saida, 'demo-mangaio-som.wav'))
  }
  opc.push('--saida', join(saida, 'demo-mangaio.mp4'))
}
run(process.execPath, [join(repo, 'motores/render/render.mjs'), join(aqui, 'index.html'), ...opc])
