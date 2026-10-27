// Gera os edits de Canudos com o motor de render do repositório e a trilha sintetizada de trilha.js.
//   node receitas/canudos/gerar.mjs              todos os roteiros → saida/canudos/canudos-<nome>.mp4
//   node receitas/canudos/gerar.mjs a            só esse
//   node receitas/canudos/gerar.mjs a --teste    folha de contato em vez de MP4 (vai para a pasta temporária)
// Tudo o que é intermediário (página da cena, trilha .wav) fica numa pasta temporária apagada no fim:
// em saida/canudos só fica o MP4 final.
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'

const aqui = dirname(fileURLToPath(import.meta.url))
const repo = resolve(aqui, '../..')
const saida = join(repo, 'saida', 'canudos')
mkdirSync(saida, { recursive: true })

const args = process.argv.slice(2)
const teste = args.includes('--teste')
const { videos } = JSON.parse(readFileSync(join(aqui, 'roteiros.json'), 'utf8'))
const nomes = args.filter(a => !a.startsWith('--'))
const lista = nomes.length ? nomes : Object.keys(videos)

// tempos de cada plano, na mesma conta de cena.js
function linhaDoTempo(v) {
  const seg = 60 / v.bpm
  let ini = 0
  const planos = v.planos.map(p => { const o = { ini, dur: p.b * seg, secao: p.secao, flash: !!p.flash }; ini += o.dur; return o })
  return { bpm: v.bpm, planos, duracao: ini }
}

async function trilha(roteiro, wav) {
  const nav = await chromium.launch({ channel: 'chrome' }).catch(() => chromium.launch({ channel: 'msedge' }))
  const pag = await nav.newPage()
  await pag.addScriptTag({ path: join(aqui, 'trilha.js') })
  const b64 = await pag.evaluate(r => window.trilhaWav(r), roteiro)
  await nav.close()
  writeFileSync(wav, Buffer.from(b64, 'base64'))
}

const ffmpeg = a => { const r = spawnSync('ffmpeg', ['-y', '-hide_banner', '-v', 'error', ...a], { stdio: 'inherit' }); if (r.status) process.exit(r.status) }

const tmp = mkdtempSync(join(tmpdir(), 'canudos-'))
try {
  for (const nome of lista) {
    if (!videos[nome]) { console.error(`roteiro "${nome}" não existe em roteiros.json`); process.exit(1) }
    const v = videos[nome], tl = linhaDoTempo(v)
    const pagina = join(aqui, `_${nome}.html`)
    writeFileSync(pagina, `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><title>${nome}</title><link rel="stylesheet" href="cena.css"></head>
<body><div id="palco"></div><script>window.VIDEO = ${JSON.stringify(nome)}</script><script src="cena.js"></script></body></html>
`)
    const opc = ['--raiz', aqui]
    console.log(`\n== ${nome}: ${v.titulo} (${tl.duracao.toFixed(1)} s)`)
    if (teste) {
      const ts = tl.planos.map(p => (p.ini + p.dur * 0.7).toFixed(2))
      const png = join(tmpdir(), `canudos-${nome}-teste.png`)
      opc.push('--teste', ts.join(','), '--zonas', '--saida', png)
    } else {
      const bruto = join(tmp, `${nome}.wav`), wav = join(tmp, `${nome}-14lufs.wav`)
      await trilha(tl, bruto)
      ffmpeg(['-i', bruto, '-af', 'loudnorm=I=-14:TP=-1.5:LRA=11,aresample=48000', wav])
      opc.push('--crf', '26', '--preset', 'medium', '--audio', wav, '--saida', join(saida, `canudos-${nome}.mp4`))
    }
    const r = spawnSync(process.execPath, [join(repo, 'motores/render/render.mjs'), pagina, ...opc], { stdio: 'inherit' })
    rmSync(pagina, { force: true })
    if (r.status) process.exit(r.status)
  }
} finally {
  rmSync(tmp, { recursive: true, force: true })
}
