#!/usr/bin/env node
// Motor de render: cena HTML (função do tempo) -> quadros JPEG no Chrome headless (CDP) -> MP4 (ffmpeg).
//
//   node motores/render/render.mjs exemplos/ola-mundo --saida saida/ola.mp4
//   node motores/render/render.mjs cena.html --teste 0.5,2,4 --zonas     # só esses instantes, numa folha de contato
//   node motores/render/render.mjs --help
//
// Contrato da cena (window.DURACAO, window.seek(t), window.pronto): motores/render/CONTRATO.md
//
// Cada processo Chrome fotografa uma fatia contígua de quadros e manda os JPEG direto (stdin) para o
// seu ffmpeg; quadro com a mesma chave de estado do anterior reaproveita a foto. No fim: concat sem
// reencode e, se houver, o áudio. Também importável: import { renderizar } from './render.mjs'
import { createServer } from 'node:http'
import { readFile, writeFile, rm, mkdtemp, mkdir } from 'node:fs/promises'
import { extname, join, dirname, resolve, basename, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { spawn } from 'node:child_process'
import { existsSync, statSync } from 'node:fs'
import { totalmem, cpus, tmpdir } from 'node:os'
import { chromium } from 'playwright-core'

const AQUI = dirname(fileURLToPath(import.meta.url))
const FONTES = resolve(AQUI, '..', '..', 'fontes') // servidas em /_fontes/ para qualquer cena

// o JPEG do Chrome é faixa cheia (0–255, matriz BT.601): sem converter, o mp4 sai yuvj420p "pc",
// que app e player tratam de jeitos diferentes. Convertemos para faixa de TV + BT.709 e marcamos.
// accurate_rnd: sem ele o swscale escurece as cores em até 4 níveis (medido com cores sólidas)
const MARCA_COR = 'setparams=range=tv:colorspace=bt709:color_primaries=bt709:color_trc=bt709'
export const PARA_TV = 'scale=in_range=pc:out_range=tv:in_color_matrix=bt601:out_color_matrix=bt709:flags=accurate_rnd+full_chroma_int,' +
  'format=yuv420p,' + MARCA_COR

// zona segura de Reels/TikTok/Shorts em 1080x1920: o que fica FORA dela, como [x, y, w, h]
// (topo, faixa de baixo com legenda/descrição, margem esquerda, botões da direita)
export const ZONAS_9x16 = [[0, 0, 1080, 288], [0, 1248, 1080, 672], [0, 288, 120, 960], [888, 288, 192, 552], [780, 840, 300, 408]]

export const PADRAO = {
  fps: 30, largura: 1080, altura: 1920, q: 90, crf: 19, preset: 'veryfast',
  dedup: true, verificar: false, zonas: false, audio: null, teste: null, chrome: null, log: console.log,
}

// 4 processos com 16 GB+, 2 com 8 GB+, 1 abaixo (medido: ~5,5 GB de pico com 4 em 1080x1920)
export function workersPadrao() {
  const gb = totalmem() / 2 ** 30
  return Math.min(gb >= 15 ? 4 : gb >= 7 ? 2 : 1, Math.max(1, cpus().length >> 1))
}

const TIPOS = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.gif': 'image/gif', '.ttf': 'font/ttf', '.otf': 'font/otf', '.woff': 'font/woff', '.woff2': 'font/woff2',
  '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg', '.mp4': 'video/mp4', '.webm': 'video/webm', '.txt': 'text/plain',
}

// servidor estático mínimo (fetch de json/áudio não funciona via file://); /_fontes/ aponta para fontes/ do repo
async function servir(raiz) {
  const srv = createServer(async (req, res) => {
    try {
      let rel = decodeURIComponent(new URL(req.url, 'http://x').pathname)
      let base = raiz
      if (rel.startsWith('/_fontes/')) { base = FONTES; rel = rel.slice('/_fontes'.length) }
      const caminho = resolve(base, '.' + rel)
      if (caminho !== base && !caminho.startsWith(base + sep)) throw new Error('fora da raiz')
      const corpo = await readFile(caminho)
      res.writeHead(200, { 'content-type': TIPOS[extname(caminho).toLowerCase()] ?? 'application/octet-stream' })
      res.end(corpo)
    } catch { res.writeHead(404); res.end() }
  })
  await new Promise(r => srv.listen(0, '127.0.0.1', r)) // porta livre qualquer
  return srv
}

// pasta -> pasta/cena.html (ou index.html); arquivo .html -> ele mesmo
export function acharCena(entrada) {
  const p = resolve(entrada)
  if (!existsSync(p)) throw new Error(`não achei ${entrada}`)
  if (statSync(p).isDirectory()) {
    const html = ['cena.html', 'index.html'].map(n => join(p, n)).find(existsSync)
    if (!html) throw new Error(`a pasta ${entrada} não tem cena.html nem index.html`)
    return html
  }
  return p
}

function ffmpeg(a, rotulo, cwd) {
  const p = spawn('ffmpeg', ['-y', '-v', 'error', ...a], { cwd, stdio: ['pipe', 'inherit', 'inherit'] })
  p.fim = new Promise((ok, erro) => {
    p.on('error', e => erro(new Error(`não consegui rodar o ffmpeg (está no PATH?): ${e.message}`)))
    p.on('close', c => (c === 0 ? ok() : erro(new Error(`ffmpeg saiu com ${c} (${rotulo})`))))
  })
  p.stdin.on('error', () => {}) // se o ffmpeg morrer, o erro aparece no p.fim
  return p
}
const enviar = async (ff, buf) => { if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r)) }
const esperar = (cmd, a, cwd) => { const p = spawn(cmd, a, { cwd, stdio: ['ignore', 'inherit', 'inherit'] })
  return new Promise((ok, erro) => { p.on('error', erro); p.on('close', c => (c === 0 ? ok() : erro(new Error(`${cmd} saiu com ${c}`)))) }) }

// abre um Chrome com a cena pronta (processo próprio: abas no mesmo Chrome quase não escalam)
async function abrir(url, o) {
  const args = ['--hide-scrollbars', '--mute-audio']
  const lanc = x => chromium.launch({ ...x, args })
  const nav = o.chrome ? await lanc({ executablePath: o.chrome })
    : await lanc({ channel: 'chrome' }).catch(() => lanc({ channel: 'msedge' }))
      .catch(() => { throw new Error('não achei Chrome nem Edge instalados; use --chrome <executável>') })
  const pag = await nav.newPage({ viewport: { width: o.largura, height: o.altura } })
  const erros = []
  pag.on('pageerror', e => { erros.push(e.message); console.error('erro na página:', e.message) })
  await pag.goto(url)
  try { await pag.waitForFunction(() => window.pronto === true, null, { timeout: 30000 }) } catch {
    await nav.close()
    throw new Error('a cena não ficou pronta em 30 s (window.pronto === true; ver motores/render/CONTRATO.md)' +
      (erros.length ? ': ' + erros[0] : ''))
  }
  const dur = await pag.evaluate(() => window.DURACAO)
  const temSeek = await pag.evaluate(() => typeof window.seek === 'function')
  if (!(dur > 0) || !temSeek) { await nav.close(); throw new Error('a cena precisa definir window.DURACAO (> 0) e window.seek(t)') }
  const cdp = await pag.context().newCDPSession(pag)
  // o Playwright não liga optimizeForSpeed; pelo CDP a foto cai de ~1 s para ~80 ms
  const foto = async () => Buffer.from((await cdp.send('Page.captureScreenshot',
    { format: 'jpeg', quality: o.q, optimizeForSpeed: true })).data, 'base64')
  const seek = t => pag.evaluate(t => window.seek(t), t)
  return { nav, pag, foto, seek, dur, versao: nav.version() }
}

const marcarZonas = (L, A) => ZONAS_9x16.map(([x, y, w, h]) => {
  const sx = L / 1080, sy = A / 1920
  return `drawbox=x=${Math.round(x * sx)}:y=${Math.round(y * sy)}:w=${Math.round(w * sx)}:h=${Math.round(h * sy)}:color=red@0.3:t=fill`
}).join(',')

// folha de contato: os instantes pedidos lado a lado (até 6 por linha), com o tempo escrito embaixo
async function folhaDeContato(url, o) {
  const { nav, foto, seek, dur } = await abrir(url, o)
  try {
    const ts = o.teste.filter(t => t >= 0 && t <= dur)
    if (ts.length < o.teste.length) o.log(`aviso: instantes fora de 0–${dur}s ignorados`)
    if (!ts.length) throw new Error('nenhum instante válido em --teste')
    const col = Math.min(ts.length, 6), lin = Math.ceil(ts.length / col)
    // cada foto ganha o seu instante t como pts, para o drawtext escrever o tempo certo
    // (settb antes: com -framerate 1 a base de tempo é 1 s e o pts sairia truncado: 2,8 -> 2)
    const pts = ts.reduceRight((acc, t, i) => `if(eq(N\\,${i})\\,${t}\\,${acc})`, '0')
    const larg = Math.round(o.largura / 4)
    const ff = ffmpeg(['-f', 'image2pipe', '-c:v', 'mjpeg', '-framerate', '1', '-i', '-', '-vf',
      `settb=1/90000,setpts=(${pts})/TB,${PARA_TV},` + (o.zonas ? marcarZonas(o.largura, o.altura) + ',' : '') +
      `scale=${larg}:-2,pad=iw:ih+44:0:0:black,` +
      `drawtext=fontfile=BarlowCondensed-ExtraBold.ttf:text='%{eif\\:trunc(t+0.005)\\:d}.%{eif\\:mod(round(t*100),100)\\:d\\:2} s':x=(w-tw)/2:y=h-38:fontsize=30:fontcolor=white,` +
      `tile=${col}x${lin}:padding=6:color=black`,
      '-frames:v', '1', o.saida], 'folha de contato', FONTES)
    for (const t of ts) { await seek(t); await enviar(ff, await foto()) }
    ff.stdin.end(); await ff.fim
    return { saida: o.saida, instantes: ts, duracao_s: dur }
  } finally { await nav.close() }
}

/**
 * Renderiza uma cena HTML em MP4 (ou, com `teste`, numa folha de contato PNG).
 * @param {string} entrada pasta com cena.html/index.html, ou o arquivo .html
 * @param {object} opcoes ver PADRAO; `saida` é obrigatória
 * @returns {Promise<object>} medições (quadros, fotos, tempos em s, workers, ...)
 */
export async function renderizar(entrada, opcoes = {}) {
  const o = { ...PADRAO, ...opcoes }
  if (!o.saida) throw new Error('falta a saída (--saida arquivo.mp4)')
  o.saida = resolve(o.saida)
  if (o.audio) { o.audio = resolve(o.audio); if (!existsSync(o.audio)) throw new Error(`não achei o áudio ${o.audio}`) }
  const html = acharCena(entrada)
  const raiz = resolve(o.raiz ?? dirname(html))
  await mkdir(dirname(o.saida), { recursive: true })
  const srv = await servir(raiz)
  const url = `http://127.0.0.1:${srv.address().port}/` + html.slice(raiz.length + 1).split(sep).map(encodeURIComponent).join('/')
  try {
    if (o.teste) return await folhaDeContato(url, o)
    return await renderVideo(url, o)
  } finally { srv.close() }
}

async function renderVideo(url, o) {
  const t0 = Date.now()
  const tmp = await mkdtemp(join(tmpdir(), 'motores-render-'))
  let cancelado = false, fotos = 0, conferidos = 0, divergentes = 0, versao = null
  const procs = new Set()
  // um worker: fatia contígua [ini, fim) dos quadros -> tmp/segN.mp4
  async function worker(w, W) {
    const { nav, foto, seek, dur, versao: v } = await abrir(url, o)
    versao = v
    try {
      const n = Math.ceil(dur * o.fps - 1e-6), fatia = Math.ceil(n / W)
      const ini = Math.min(n, w * fatia), fim = Math.min(n, ini + fatia)
      if (ini >= fim) return { dur, n, vazio: true }
      const ff = ffmpeg(['-f', 'image2pipe', '-c:v', 'mjpeg', '-framerate', String(o.fps), '-i', '-',
        '-vf', PARA_TV, '-c:v', 'libx264', '-preset', o.preset, '-crf', String(o.crf), '-pix_fmt', 'yuv420p',
        '-r', String(o.fps), `seg${w}.mp4`], `seg${w}`, tmp)
      procs.add(ff)
      let ultimo = null, chaveAnt
      for (let i = ini; i < fim && !cancelado; i++) {
        const chave = await seek(i / o.fps)
        const igual = o.dedup && ultimo && chave != null && chave === chaveAnt
        if (!igual) { ultimo = await foto(); fotos++ }
        else if (o.verificar) {
          conferidos++
          if (!(await foto()).equals(ultimo)) { divergentes++; console.warn(`quadro ${i}: chave igual, imagem diferente`) }
        }
        chaveAnt = chave
        await enviar(ff, ultimo)
        if (w === 0 && (i - ini) % 150 === 0) o.log(`worker 0: quadro ${i - ini}/${fim - ini} (${((Date.now() - t0) / 1000).toFixed(0)}s)`)
      }
      ff.stdin.end(); await ff.fim
      return { dur, n }
    } finally { await nav.close() }
  }
  try {
    const W = Math.max(1, o.workers ?? workersPadrao())
    const res = await Promise.all(Array.from({ length: W }, (_, w) => worker(w, W).catch(e => {
      cancelado = true; for (const p of procs) p.kill(); throw e })))
    const { n, dur } = res[0]
    const tCaptura = Date.now()
    const segs = res.map((r, w) => (r.vazio ? null : `file 'seg${w}.mp4'`)).filter(Boolean)
    await writeFile(join(tmp, 'segs.txt'), segs.join('\n'))
    const cenas = o.audio ? join(tmp, 'cenas.mp4') : o.saida
    await esperar('ffmpeg', ['-y', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', 'segs.txt', '-c', 'copy',
      ...(o.audio ? [] : ['-movflags', '+faststart']), cenas], tmp)
    if (o.audio) {
      // apad + atrim: o áudio fica exatamente com a duração do vídeo (sem cortar o fim da cena)
      const d = (n / o.fps).toFixed(3)
      await esperar('ffmpeg', ['-y', '-v', 'error', '-i', cenas, '-i', o.audio, '-map', '0:v', '-map', '1:a',
        '-af', `apad=whole_dur=${d},atrim=end=${d}`, '-c:v', 'copy', '-c:a', 'aac', '-b:a', '160k',
        '-movflags', '+faststart', o.saida], tmp)
    }
    const tFim = Date.now()
    const seg = ms => +(ms / 1000).toFixed(1)
    return {
      saida: o.saida, duracao_s: dur, quadros: n, fotos, workers: W, fps: o.fps, largura: o.largura, altura: o.altura,
      dedup: o.dedup, ...(o.verificar ? { verificados: conferidos, divergentes } : {}),
      tempos: { captura_e_encode_s: seg(tCaptura - t0), juntar_s: seg(tFim - tCaptura), total_s: seg(tFim - t0) },
      chrome: versao, maquina: `${cpus()[0].model.trim()}, ${cpus().length} threads, ${Math.round(totalmem() / 2 ** 30)} GB de RAM`,
    }
  } finally { await rm(tmp, { recursive: true, force: true }) }
}

// ---------------------------------------------------------------- linha de comando
const AJUDA = `Uso: node motores/render/render.mjs <pasta-ou-cena.html> [opções]

Renderiza uma cena HTML (contrato em motores/render/CONTRATO.md) em MP4 H.264
yuv420p (faixa de TV, BT.709), no Chrome headless, sem GPU dedicada.

Opções:
  --saida <arq>        arquivo de saída (padrão: saida/<nome>.mp4, ou saida/<nome>-teste.png com --teste)
  --audio <arq>        áudio para juntar (completado com silêncio até o fim do vídeo)
  --fps <n>            quadros por segundo (padrão 30)
  --tamanho <LxA>      viewport da cena (padrão 1080x1920)
  --workers <n>        processos Chrome em paralelo (padrão pela RAM: ${workersPadrao()} nesta máquina)
  --q <n>              qualidade do JPEG capturado, 1–100 (padrão 90)
  --crf <n>            qualidade do x264 (padrão 19; menor = melhor e maior)
  --preset <nome>      preset do x264 (padrão veryfast)
  --sem-dedup          fotografa todos os quadros, mesmo com a chave de estado repetida
  --verificar          fotografa também os quadros pulados e confere se são iguais
  --teste <t1,t2,...>  só esses instantes (s), numa folha de contato PNG
  --zonas              na folha de contato, marca em vermelho o que fica fora da zona segura 9:16
  --raiz <pasta>       raiz do servidor estático (padrão: a pasta da cena)
  --chrome <arq>       executável do Chrome/Chromium (padrão: Chrome instalado, ou Edge)
  --json               imprime as medições em JSON
  -h, --help           esta ajuda

Exemplos:
  node motores/render/render.mjs exemplos/ola-mundo --saida saida/ola-mundo.mp4
  node motores/render/render.mjs exemplos/ola-mundo --teste 0.5,1.5,3,5 --zonas`

export function lerArgs(argv) {
  const sim = new Set(['--sem-dedup', '--verificar', '--zonas', '--json', '-h', '--help'])
  const o = {}, pos = []
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (!a.startsWith('-')) { pos.push(a); continue }
    if (sim.has(a)) { o[a.replace(/^-+/, '')] = true; continue }
    if (i + 1 >= argv.length) throw new Error(`falta o valor de ${a}`)
    o[a.slice(2)] = argv[++i]
  }
  return { o, pos }
}

async function cli() {
  const { o, pos } = lerArgs(process.argv.slice(2))
  if (o.help || o.h || !pos.length) { console.log(AJUDA); process.exit(pos.length || o.help || o.h ? 0 : 1) }
  const num = (k, min) => { if (o[k] == null) return undefined; const v = +o[k]
    if (!Number.isFinite(v) || v < min) throw new Error(`--${k} inválido: ${o[k]}`); return v }
  const opcoes = { audio: o.audio, fps: num('fps', 1), workers: num('workers', 1), q: num('q', 1), crf: num('crf', 0),
    preset: o.preset, dedup: !o['sem-dedup'], verificar: !!o.verificar, zonas: !!o.zonas, raiz: o.raiz, chrome: o.chrome }
  if (o.tamanho) {
    const m = /^(\d+)x(\d+)$/.exec(o.tamanho)
    if (!m || m[1] % 2 || m[2] % 2) throw new Error('--tamanho deve ser LxA com números pares, ex.: 1080x1920')
    Object.assign(opcoes, { largura: +m[1], altura: +m[2] })
  }
  if (o.teste) opcoes.teste = o.teste.split(',').map(Number).filter(Number.isFinite)
  for (const k of Object.keys(opcoes)) if (opcoes[k] === undefined) delete opcoes[k]
  const html = acharCena(pos[0])
  const nome = /^(cena|index)$/.test(basename(html, '.html')) ? basename(dirname(html)) : basename(html, '.html')
  opcoes.saida = o.saida ?? join('saida', opcoes.teste ? `${nome}-teste.png` : `${nome}.mp4`)
  // --teste com --saida x.mp4: a folha vai para x-teste.png
  if (opcoes.teste && !/\.png$/i.test(opcoes.saida)) opcoes.saida = opcoes.saida.replace(/\.[^.\\/]*$/, '') + '-teste.png'
  if (o.json) opcoes.log = () => {}
  const r = await renderizar(pos[0], opcoes)
  if (o.json) return console.log(JSON.stringify(r, null, 1))
  if (opcoes.teste) return console.log(`folha de contato: ${r.saida} (${r.instantes.join(', ')} s)`)
  console.log(`vídeo: ${r.saida} (${r.duracao_s}s, ${r.quadros} quadros, ${r.fotos} fotos, ${r.workers} workers)`)
  console.log(`tempo: captura+encode ${r.tempos.captura_e_encode_s}s · juntar ${r.tempos.juntar_s}s · total ${r.tempos.total_s}s`)
  if (r.verificados != null) console.log(`verificação: ${r.verificados} quadros pulados fotografados, ${r.divergentes} diferentes`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  cli().catch(e => { console.error('erro:', e.message); process.exit(1) })
}
