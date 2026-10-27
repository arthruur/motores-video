// Gera o vídeo de unboxing de maquiagem com o motor de render do repositório.
//   node receitas/unboxing/gerar.mjs                  → saida/unboxing/unboxing-maquiagem.mp4 (com os efeitos sonoros)
//   node receitas/unboxing/gerar.mjs --mudo           sem som
//   node receitas/unboxing/gerar.mjs --teste          folha de contato: um instante assentado de cada cena e alguns rasgos
//   node receitas/unboxing/gerar.mjs --teste 4.5,8.1  só esses instantes (com --zonas, a zona segura)
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const aqui = dirname(fileURLToPath(import.meta.url))
const repo = resolve(aqui, '../..')
const saida = join(repo, 'saida', 'unboxing')
mkdirSync(saida, { recursive: true })

const args = process.argv.slice(2)
const pagina = join(aqui, '_unboxing.html')
writeFileSync(pagina, `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><title>unboxing</title><link rel="stylesheet" href="cena.css"></head>
<body><div id="palco"></div><script src="desenhos.js"></script><script src="cena.js"></script></body></html>
`)

// início de cada cena (a próxima começa quando o rasgo da anterior começa)
const D = JSON.parse(readFileSync(join(aqui, 'produtos.json'), 'utf8'))
const T = D.tempos
const durs = [T.capa, T.abertura, ...D.produtos.map(() => T.produto), T.final]
const inis = durs.reduce((l, d, k) => [...l, k ? l[k - 1] + durs[k - 1] - T.rasgo : 0], [])

const q = args.indexOf('--quadro')
if (q >= 0) {
  // um quadro em tamanho real (a folha de contato reduz), para conferir detalhe: saida/unboxing/quadro-<t>.png
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
  const ts = args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1]
    : [...inis.map((t, k) => t + durs[k] - T.rasgo - 0.15), inis[2] - T.rasgo * 0.45 + T.rasgo, inis[4] + T.rasgo * 0.3].map(t => t.toFixed(2)).join(',')
  opc.push('--teste', ts, '--saida', join(saida, 'unboxing-teste.png'))
  if (args.includes('--zonas')) opc.push('--zonas')
} else {
  if (!args.includes('--mudo')) {
    run('python', [join(aqui, 'som', 'mixar.py')])
    opc.push('--audio', join(saida, 'som-unboxing.wav'))
  }
  opc.push('--saida', join(saida, 'unboxing-maquiagem.mp4'))
}
run(process.execPath, [join(repo, 'motores/render/render.mjs'), pagina, ...opc])
