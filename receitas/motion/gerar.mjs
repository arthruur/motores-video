// Gera os vídeos das Receitas do Bistrô com o motor de render do repositório.
//   node receitas/motion/gerar.mjs                 todos os vídeos de videos.json
//   node receitas/motion/gerar.mjs linha pesto     só esses
//   node receitas/motion/gerar.mjs linha --teste   folha de contato em vez de MP4
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const aqui = dirname(fileURLToPath(import.meta.url))
const repo = resolve(aqui, '../..')
const saida = join(repo, 'saida', 'receitas-bistro')
mkdirSync(saida, { recursive: true })

const args = process.argv.slice(2)
const teste = args.includes('--teste')
const { videos } = JSON.parse(readFileSync(join(aqui, 'videos.json'), 'utf8'))
const nomes = args.filter(a => !a.startsWith('--'))
const lista = nomes.length ? nomes : Object.keys(videos)

for (const nome of lista) {
  if (!videos[nome]) { console.error(`vídeo "${nome}" não existe em videos.json`); process.exit(1) }
  const v = videos[nome]
  const pagina = join(aqui, `_${nome}.html`)
  writeFileSync(pagina, `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><title>${nome}</title><link rel="stylesheet" href="cena.css"></head>
<body><div id="palco"></div><script>window.VIDEO = ${JSON.stringify(nome)}</script><script src="cena.js"></script></body></html>
`)
  const opc = ['--raiz', aqui]
  if (teste) {
    // um instante no meio de cada plano e dois no cartão final
    let t = 0
    const ts = v.planos.map(p => { const m = t + p.dur * 0.6; t += p.dur; return m.toFixed(2) })
    ts.push((t + 0.4).toFixed(2), (t + v.final - 0.2).toFixed(2))
    opc.push('--teste', ts.join(','), '--zonas', '--saida', join(saida, `${nome}-teste.png`))
  } else {
    opc.push('--saida', join(saida, `${nome}.mp4`))
  }
  console.log(`\n== ${nome}`)
  const r = spawnSync(process.execPath, [join(repo, 'motores/render/render.mjs'), pagina, ...opc], { stdio: 'inherit' })
  if (r.status) process.exit(r.status)
}
