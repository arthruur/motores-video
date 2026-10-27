// Grava a trilha "Baião do Mangaio" (trilha.js) em som/baiao-mangaio.wav, renderizada no Chrome sem tela.
//   node receitas/mangaio/trilha.mjs
import { chromium } from 'playwright-core'
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const aqui = dirname(fileURLToPath(import.meta.url))
const nav = await chromium.launch({ channel: 'chrome' }).catch(() => chromium.launch({ channel: 'msedge' }))
const pag = await nav.newPage()
await pag.goto(pathToFileURL(join(aqui, 'trilha.html')).href)
const b64 = await pag.evaluate(() => window.trilhaWav())
await nav.close()
mkdirSync(join(aqui, 'som'), { recursive: true })
writeFileSync(join(aqui, 'som', 'baiao-mangaio.wav'), Buffer.from(b64, 'base64'))
console.log('som/baiao-mangaio.wav')
