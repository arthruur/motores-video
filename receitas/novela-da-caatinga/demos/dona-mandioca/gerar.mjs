// Demo de animação da Dona Mandioca com o motor de render do repositório.
//   node receitas/novela-da-caatinga/demos/dona-mandioca/gerar.mjs           → saida/novela-da-caatinga/demo-dona-mandioca.mp4 (com som)
//   node receitas/novela-da-caatinga/demos/dona-mandioca/gerar.mjs --mudo    sem som
//   node receitas/novela-da-caatinga/demos/dona-mandioca/gerar.mjs --teste   folha de contato → demo-dona-mandioca-contato.png
//   node receitas/novela-da-caatinga/demos/dona-mandioca/gerar.mjs --teste 4.5,8   só esses instantes
// Antes: montar.py (vistas.js, a partir do rig) e som.py (som da demo). O gerar chama os dois.
// A raiz do servidor é a pasta da série, para a cena ler texturas/ e fontes/.
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
const CONTATO = '1.0,2.6,4.3,5.1,5.9,7.0,8.6,10.2,11.95,12.75,13.75,14.75,16.85,16.98,18.6,20.0,22.6,23.3,24.1,25.0,25.8,26.6,27.5,28.9,30.4,31.6,34.2,35.0,37.5,39.2'
run('python', [join(aqui, 'montar.py')])
const opc = ['--raiz', serie]
const i = args.indexOf('--teste')
if (i >= 0) {
  const ts = args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : CONTATO
  opc.push('--teste', ts, '--saida', join(saida, 'demo-dona-mandioca-contato.png'))
} else {
  if (!args.includes('--mudo')) {
    run('python', [join(aqui, 'som.py')])
    opc.push('--audio', join(saida, 'demo-dona-mandioca-som.wav'))
  }
  opc.push('--saida', join(saida, 'demo-dona-mandioca.mp4'))
}
run(process.execPath, [join(repo, 'motores/render/render.mjs'), join(aqui, 'index.html'), ...opc])
