// Gera o vídeo "Do alerta à operação" (Guerra Verde) com o motor de render do repositório.
//   node receitas/guerra-verde/gerar.mjs                  → saida/guerra-verde/do-alerta-a-operacao.mp4 (narração + efeitos + música)
//   node receitas/guerra-verde/gerar.mjs --mudo           sem som
//   node receitas/guerra-verde/gerar.mjs --teste          folha de contato: um instante assentado de cada cena e os zooms
//   node receitas/guerra-verde/gerar.mjs --teste 4.5,8.1  só esses instantes (com --zonas, a zona segura)
//   node receitas/guerra-verde/gerar.mjs --quadro 11.85   um quadro em tamanho real
// Antes: python receitas/guerra-verde/preparar.py (texturas, narração e tempos.json) e som/baixar.py (uma vez).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const aqui = dirname(fileURLToPath(import.meta.url))
const repo = resolve(aqui, '../..')
const saida = join(repo, 'saida', 'guerra-verde')
mkdirSync(saida, { recursive: true })

const args = process.argv.slice(2)
const pagina = join(aqui, '_cena.html')
writeFileSync(pagina, `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><title>guerra verde</title><link rel="stylesheet" href="cena.css"></head>
<body><div id="palco"></div><script src="desenhos.js"></script><script src="cena.js"></script></body></html>
`)
const T = JSON.parse(readFileSync(join(aqui, 'tempos.json'), 'utf8'))

const q = args.indexOf('--quadro')
if (q >= 0) {
  // um quadro em tamanho real (a folha de contato reduz), para conferir detalhe: saida/guerra-verde/quadro-<t>.png
  const t = args[q + 1]
  const pq = join(aqui, '_quadro.html')
  writeFileSync(pq, readFileSync(pagina, 'utf8').replace('<script src="desenhos.js">', `<script>window.INICIO = ${Number(t)}</script><script src="desenhos.js">`))
  const mp4 = join(saida, '_quadro.mp4')
  spawnSync(process.execPath, [join(repo, 'motores/render/render.mjs'), pq, '--raiz', aqui, '--saida', mp4], { stdio: 'ignore' })
  spawnSync('ffmpeg', ['-v', 'error', '-y', '-i', mp4, '-frames:v', '1', join(saida, `quadro-${t}.png`)], { stdio: 'inherit' })
  console.log(join(saida, `quadro-${t}.png`))
  process.exit(0)
}
const run = (cmd, a) => { const r = spawnSync(cmd, a, { stdio: 'inherit' }); if (r.status) process.exit(r.status ?? 1) }
const opc = ['--raiz', aqui]
const i = args.indexOf('--teste')
if (i >= 0) {
  // cada cena perto do fim (antes da transição) e o meio de cada zoom
  const padrao = [...T.cenas.map(c => c.ini + c.dur - (c.transicao?.dur ?? 0) - 0.2),
    ...T.cenas.filter(c => c.transicao?.tipo === 'zoom').map(c => c.ini + c.dur - c.transicao.dur * 0.5)]
  const ts = args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : padrao.sort((a, b) => a - b).map(t => t.toFixed(2)).join(',')
  opc.push('--teste', ts, '--saida', join(saida, 'teste.png'))
  if (args.includes('--zonas')) opc.push('--zonas')
} else {
  if (!args.includes('--mudo')) {
    run('python', [join(aqui, 'som', 'mixar.py')])
    opc.push('--audio', join(saida, 'som.wav'))
  }
  opc.push('--saida', join(saida, 'do-alerta-a-operacao.mp4'))
}
run(process.execPath, [join(repo, 'motores/render/render.mjs'), pagina, ...opc])
