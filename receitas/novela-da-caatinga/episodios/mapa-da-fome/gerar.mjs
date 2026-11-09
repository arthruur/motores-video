// Episódio "O Mapa da Fome" com o motor de render do repositório.
//   python .../mapa-da-fome/voz.py (1x, Gemini TTS) e mapa.py (1x, malha do IBGE)
//   node receitas/novela-da-caatinga/episodios/mapa-da-fome/gerar.mjs           → saida/novela-da-caatinga/mapa-da-fome.mp4
//   node receitas/novela-da-caatinga/episodios/mapa-da-fome/gerar.mjs --teste   folha de contato
//   node receitas/novela-da-caatinga/episodios/mapa-da-fome/gerar.mjs --teste 4.5,8   só esses instantes
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

const CONTATO = '1.5,4.0,7.4,9.0,12.5,15.5,17.6,19.5,23.5,26.5,29.5,33.0,35.4,37.0,39.5,42.0,44.5,46.5,49.5,52.0,55.0,58.5,61.0,64.5'
run('python', [join(aqui, 'som.py')])
const opc = ['--raiz', serie]
const i = args.indexOf('--teste')
if (i >= 0) {
  const ts = args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : CONTATO
  opc.push('--teste', ts, '--saida', join(saida, 'mapa-da-fome-contato.png'))
  if (args.includes('--zonas')) opc.push('--zonas')
} else {
  opc.push('--audio', join(saida, 'mapa-da-fome-som.wav'), '--saida', join(saida, 'mapa-da-fome.mp4'))
}
run(process.execPath, [join(repo, 'motores/render/render.mjs'), join(aqui, 'index.html'), ...opc])
