#!/usr/bin/env node
// Empacota um módulo do Mangaio (app/src/mangaio/*.ts) num script só, global `Mangaio`, para as cenas HTML
// de cenas/ (renderizadas pelo motores/render). O `?raw` do Vite vira texto aqui também.
//
//   node ferramentas/mangaio/empacotar.mjs danca cenas/mangaio_danca/mangaio_bundle.js
//   node ferramentas/mangaio/empacotar.mjs aventura cenas/mangaio/mangaio_bundle.js
import { readFile } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
// o esbuild vem com o Vite do app (app/node_modules)
const { build } = createRequire(resolve(RAIZ, 'app/package.json'))('esbuild')
const [modulo = 'danca', saida = `cenas/mangaio_${modulo}/mangaio_bundle.js`] = process.argv.slice(2)

const cru = {
  name: 'cru',
  setup(b) {
    b.onResolve({ filter: /\?raw$/ }, (a) => ({ path: resolve(a.resolveDir, a.path.slice(0, -4)), namespace: 'cru' }))
    b.onLoad({ filter: /.*/, namespace: 'cru' }, async (a) => ({ contents: await readFile(a.path, 'utf8'), loader: 'text' }))
  },
}

await build({
  entryPoints: [resolve(RAIZ, 'app/src/mangaio', `${modulo}.ts`)],
  outfile: resolve(RAIZ, saida),
  bundle: true, format: 'iife', globalName: 'Mangaio', target: 'es2022', plugins: [cru], logLevel: 'info',
})
