// Piloto "A Despensa do Sertão" com o motor de render do repositório.
//   python receitas/novela-da-caatinga/episodios/despensa-do-sertao/voz.py      (1x: narração e fala, Gemini TTS)
//   node receitas/novela-da-caatinga/episodios/despensa-do-sertao/gerar.mjs           → saida/novela-da-caatinga/despensa-do-sertao.mp4
//   node receitas/novela-da-caatinga/episodios/despensa-do-sertao/gerar.mjs --teste   folha de contato
//   node receitas/novela-da-caatinga/episodios/despensa-do-sertao/gerar.mjs --teste 4.5,8   só esses instantes
// O gerar roda som.py (linha.json + trilha). A raiz do servidor é a pasta da série (texturas/, fontes/, arte/, demos/).
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

const CONTATO = '1.2,3.0,4.6,5.8,7.6,10.0,10.8,12.0,13.6,16.4,19.6,22.0,23.6,25.4,27.6,29.6,32.6,35.0,36.8,39.2,42.6,46.6,49.6,52.6,55.0,57.6,60.4,63.0'
run('python', [join(aqui, 'som.py')])
const opc = ['--raiz', serie]
const i = args.indexOf('--teste')
if (i >= 0) {
  const ts = args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : CONTATO
  opc.push('--teste', ts, '--saida', join(saida, 'despensa-do-sertao-contato.png'))
  if (args.includes('--zonas')) opc.push('--zonas')
} else {
  opc.push('--audio', join(saida, 'despensa-do-sertao-som.wav'), '--saida', join(saida, 'despensa-do-sertao.mp4'))
}
run(process.execPath, [join(repo, 'motores/render/render.mjs'), join(aqui, 'index.html'), ...opc])
