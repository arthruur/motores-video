// Cena do edit de Canudos: fotos de 1897 em P&B com granulado, cortes secos na batida,
// flash e tremor no drop, texto em caixa alta palavra a palavra.
// Contrato do motor (motores/render/CONTRATO.md): a tela é 100% função de t, sem relógio nem estado.
// O roteiro vem de window.VIDEO (definido na página de cada vídeo) e de roteiros.json.

const W = 1080, H = 1920
const GRAOS = 4, GRAO_FPS = 12                           // quadros de granulado que se alternam

const lim = x => Math.min(1, Math.max(0, x))
const fase = (t, ini, dur) => lim((t - ini) / dur)
const suave = x => x * x * (3 - 2 * x)
const saida = x => 1 - (1 - x) ** 3                      // easeOutCubic
const mix = (a, b, p) => a + (b - a) * p
const r = (x, c = 3) => +x.toFixed(c)

const el = (tag, cls, pai, txt) => {
  const e = document.createElement(tag)
  if (cls) e.className = cls
  if (txt != null) e.textContent = txt
  pai.appendChild(e)
  return e
}

// texto quebrado em palavras, para entrarem uma a uma
function palavras(pai, cls, txt) {
  const caixa = el('div', cls, pai)
  const ps = txt.split(' ').map((w, k) => {
    if (k) caixa.appendChild(document.createTextNode(' '))
    return el('span', null, caixa, w)
  })
  return { caixa, ps }
}

function granulado(semente) {
  const c = document.createElement('canvas')
  c.width = W / 2; c.height = H / 2
  const g = c.getContext('2d'), img = g.createImageData(c.width, c.height)
  let s = semente
  for (let i = 0; i < img.data.length; i += 4) {
    s = (s * 16807) % 2147483647
    const v = s % 256
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v
    img.data[i + 3] = 255
  }
  g.putImageData(img, 0, 0)
  c.className = 'grao'
  return c
}

async function montar() {
  const dados = await (await fetch('roteiros.json')).json()
  const v = dados.videos[window.VIDEO]
  const seg = 60 / v.bpm
  const palco = document.getElementById('palco')

  let ini = 0
  const planos = v.planos.map((p, i) => {
    const o = { ...p, i, ini, dur: p.b * seg }
    ini += o.dur
    o.caixa = el('div', 'plano', palco)
    if (p.foto) {
      if (Math.min(...p.zoom) < 1) el('img', 'fundo', o.caixa).src = `fotos/${p.foto}.jpg`
      o.img = el('img', 'foto', o.caixa)
      o.img.src = `fotos/${p.foto}.jpg`
    }
    o.texto = el('div', 'texto', o.caixa)
    if (p.texto) o.t1 = palavras(o.texto, 'titulo', p.texto)
    if (p.texto2) { o.t2 = palavras(o.texto, 'titulo', p.texto2); o.t2.caixa.style.display = 'none' }
    if (p.citacao) o.t1 = palavras(o.texto, 'citacao', p.citacao)
    if (p.sub) o.sub = el('div', 'sub', o.texto, p.sub)
    if (p.credito) o.credito = el('div', 'credito', o.caixa, dados.creditos[window.VIDEO])
    return o
  })

  const vinheta = el('div', null, palco); vinheta.id = 'vinheta'
  const graos = Array.from({ length: GRAOS }, (_, k) => palco.appendChild(granulado(9871 + k * 7919)))
  const flash = el('div', null, palco); flash.id = 'flash'

  await document.fonts.load('800 100px "Barlow Condensed"')
  await document.fonts.load('italic 700 100px Georgia')
  await document.fonts.ready
  await Promise.all([...document.images].map(i => i.decode()))

  // título que não cabe em 4 linhas na largura da zona segura encolhe
  planos.forEach(p => {
    for (const t of [p.t1, p.t2]) {
      if (!t) continue
      const caixa = t.caixa, d = p.citacao ? 64 : 136
      let fs = d
      caixa.style.fontSize = `${fs}px`
      const lh = parseFloat(getComputedStyle(caixa).lineHeight)
      while (fs > 48 && caixa.scrollHeight > lh * (p.citacao ? 5 : 3) + 2) {
        caixa.style.fontSize = `${(fs -= 4)}px`
      }
    }
    p.caixa.style.display = 'none'
  })

  return { planos, graos, flash, seg, duracao: ini }
}

function entrar(t, ps, t0) {
  const chave = []
  ps.forEach((s, j) => {
    const q = saida(fase(t, t0 + j * 0.07, 0.22))
    s.style.opacity = r(q)
    s.style.transform = `scale(${r(mix(1.35, 1, q))})`
    chave.push(r(q))
  })
  return chave
}

function desenhar(cena, t) {
  const chave = []
  const atual = cena.planos.find(p => t >= p.ini && t < p.ini + p.dur) ?? cena.planos.at(-1)
  for (const p of cena.planos) p.caixa.style.display = p === atual ? 'block' : 'none'
  const p = atual
  chave.push(p.i)

  // Ken Burns com o mesmo enquadramento das Receitas do Bistrô, mais tremor no drop
  if (p.img) {
    const k = suave(fase(t, p.ini, p.dur))
    const iw = p.img.naturalWidth, ih = p.img.naturalHeight
    const z = mix(p.zoom[0], p.zoom[1], k)
    const S = Math.max(W / iw, H / ih) * z
    const fx = mix(p.foco[0][0], p.foco[1][0], k), fy = mix(p.foco[0][1], p.foco[1][1], k)
    const prende = (v, tam, tela) => tam >= tela ? Math.min(0, Math.max(tela - tam, v)) : Math.max(0, Math.min(tela - tam, v))
    let x = prende(W / 2 - fx * iw * S, iw * S, W)
    let y = prende(H / 2 - fy * ih * S, ih * S, H)
    let extra = 1
    if (p.tremor) {
      const a = 1 - fase(t, p.ini, 0.4)
      x += 22 * a * Math.sin(t * 97); y += 22 * a * Math.cos(t * 83)
      extra = 1 + 0.04 * a                               // cobre a borda que o tremor abriria
    }
    p.img.style.transform = `translate(${r(x, 1)}px,${r(y, 1)}px) scale(${r(S * extra, 4)})`
    // P&B com leve sépia; "virapb" sai da cor para o P&B na primeira metade do plano
    const pb = p.cor ? 0.15 : p.virapb ? suave(fase(t, p.ini, p.dur * 0.5)) : 1
    p.img.style.filter = `grayscale(${r(pb)}) sepia(${r(pb * 0.18)}) contrast(${r(1 + 0.18 * pb)}) brightness(${r((1 - 0.12 * pb) * (p.brilho ?? 1))})`
    chave.push(r(x, 1), r(y, 1), r(S * extra, 4), r(pb))
  }

  // textos: entram palavra a palavra logo depois do corte; texto2 troca o título no meio do plano
  const t0 = p.ini + 0.08
  if (p.t1) {
    const troca = p.t2 && t >= p.ini + p.b2 * cena.seg
    p.t1.caixa.style.display = troca ? 'none' : 'block'
    if (troca) {
      p.t2.caixa.style.display = 'block'
      chave.push(...entrar(t, p.t2.ps, p.ini + p.b2 * cena.seg))
    } else {
      if (p.t2) p.t2.caixa.style.display = 'none'
      chave.push(...entrar(t, p.t1.ps, t0))
    }
  }
  if (p.sub) {
    const q = saida(fase(t, t0 + 0.35, 0.4))
    p.sub.style.opacity = r(q)
    p.sub.style.transform = `translateY(${r((1 - q) * 24, 1)}px)`
    chave.push(r(q))
  }
  if (p.credito) {
    const q = fase(t, p.ini + 1.2, 0.6)
    p.credito.style.opacity = r(q * 0.75)
    chave.push(r(q))
  }

  // flash branco no corte (e na troca de texto)
  let f = 0
  if (p.flash) f = 1 - fase(t, p.ini, 0.16)
  if (p.t2) { const tb = p.ini + p.b2 * cena.seg; if (t >= tb) f = Math.max(f, 1 - fase(t, tb, 0.16)) }
  cena.flash.style.opacity = r(f * 0.85)
  chave.push(r(f))

  const g = Math.floor(t * GRAO_FPS) % GRAOS
  cena.graos.forEach((c, k) => { c.style.display = k === g ? 'block' : 'none' })
  chave.push(g)
  return chave.join('|')
}

;(async () => {
  const cena = await montar()
  window.DURACAO = cena.duracao
  window.seek = t => desenhar(cena, t)
  window.seek(0)
  window.pronto = true
})()
