// Cena das Receitas do Bistrô: fotos com movimento (Ken Burns), gancho palavra a palavra,
// rótulo no estilo da etiqueta dos potes e cartão final com a tampa dourada girando.
// Contrato do motor (motores/render/CONTRATO.md): a tela é 100% função de t, sem relógio nem estado.
// O vídeo a desenhar vem de window.VIDEO (definido na página de cada vídeo) e de videos.json.

const W = 1080, H = 1920
const TR = 0.5                                           // duração das transições (s)

const lim = x => Math.min(1, Math.max(0, x))
const fase = (t, ini, dur) => lim((t - ini) / dur)
const suave = x => x * x * (3 - 2 * x)
const saida = x => 1 - (1 - x) ** 3                      // easeOutCubic
const volta = x => 1 + 2.7 * (x - 1) ** 3 + 1.7 * (x - 1) ** 2 // easeOutBack
const mix = (a, b, p) => a + (b - a) * p
const r = (x, c = 3) => +x.toFixed(c)

const el = (tag, cls, pai, txt) => {
  const e = document.createElement(tag)
  if (cls) e.className = cls
  if (txt != null) e.textContent = txt
  pai.appendChild(e)
  return e
}

async function montar() {
  const dados = await (await fetch('videos.json')).json()
  const v = dados.videos[window.VIDEO], m = dados.marca
  const palco = document.getElementById('palco')

  let ini = 0
  const planos = v.planos.map((p, i) => {
    const caixa = el('div', 'plano', palco)
    caixa.style.zIndex = 10 + i * 2
    // zoom < 1: a foto não cobre a altura; a mesma foto desfocada preenche e a borda some num degradê
    if (Math.max(...p.zoom) < 1) el('img', 'fundo', caixa).src = `fotos/borrada/${p.foto}.jpg`
    const img = el('img', Math.max(...p.zoom) < 1 ? 'menor' : null, caixa)
    img.src = `fotos/${p.foto}.jpg`
    const veu = el('div', 'veu', caixa)
    const o = { ...p, i, ini, caixa, img, veu }
    ini += p.dur
    if (p.gancho) {
      o.gancho = el('div', 'gancho', palco)
      o.gancho.style.zIndex = 11 + i * 2
      o.palavras = []
      p.gancho.split('\n').forEach(l => {
        const linha = el('div', 'linha', o.gancho)
        l.split(' ').forEach((w, k) => {
          if (k) linha.appendChild(document.createTextNode(' '))
          o.palavras.push(el('span', null, linha, w))
        })
      })
    }
    if (p.rotulo) {
      o.rotulo = el('div', 'rotulo', palco)
      o.rotulo.style.zIndex = 11 + i * 2
      el('div', 'etq', o.rotulo, p.rotulo)
      if (p.sub) el('div', 'sub', o.rotulo, p.sub)
    }
    return o
  })

  // cartão final
  const fim = { ini, dur: v.final }
  fim.caixa = el('div', null, palco); fim.caixa.id = 'final'; fim.caixa.style.zIndex = 100
  fim.tampa = el('div', null, fim.caixa); fim.tampa.id = 'tampa'
  const selo = el('div', null, fim.tampa); selo.id = 'selo'
  el('div', 'orn', selo, '❦')
  el('div', 'n1', selo, m.nome)
  el('div', 'n2', selo, m.numero)
  fim.linha = el('div', null, fim.caixa, m.linha); fim.linha.id = 'linha'
  fim.chamada = el('div', null, fim.caixa); fim.chamada.id = 'chamada'
  el('div', null, fim.chamada, m.chamada)
  fim.contato = el('div', null, fim.caixa, m.contato); fim.contato.id = 'contato'

  await document.fonts.load('800 100px "Barlow Condensed"')
  await document.fonts.load('italic 700 100px Georgia')
  await document.fonts.load('700 100px Georgia')
  await document.fonts.ready
  await Promise.all([...document.images].map(i => i.decode()))

  // gancho que não cabe na largura da zona segura encolhe
  planos.forEach(p => {
    if (!p.gancho) return
    let fs = 112
    while (fs > 60 && [...p.gancho.children].some(l => l.scrollWidth > 760)) p.gancho.style.fontSize = `${(fs -= 4)}px`
  })

  return { planos, fim, duracao: fim.ini + fim.dur }
}

function desenhar(cena, t) {
  const chave = []
  for (const p of cena.planos) {
    const fimP = p.ini + p.dur + TR                        // fica visível até a próxima terminar de entrar
    const vis = t >= p.ini && t < fimP + 0.001
    p.caixa.style.display = vis ? 'block' : 'none'
    if (p.gancho) p.gancho.style.display = vis ? 'block' : 'none'
    if (p.rotulo) p.rotulo.style.display = vis ? 'block' : 'none'
    if (!vis) { chave.push(0); continue }

    // Ken Burns: zoom e foco andam juntos ao longo do plano
    const k = suave(fase(t, p.ini, p.dur + TR))
    const entra = p.i === 0 ? 1 : suave(fase(t, p.ini, TR))
    const iw = p.img.naturalWidth, ih = p.img.naturalHeight
    const z = mix(p.zoom[0], p.zoom[1], k) * mix(1.06, 1, entra)
    const S = Math.max(W / iw, H / ih) * z
    const fx = mix(p.foco[0][0], p.foco[1][0], k), fy = mix(p.foco[0][1], p.foco[1][1], k)
    // o foco vai para o ponto alvo da tela; a foto nunca deixa borda (ou, se menor, nunca sai do quadro)
    const prende = (v, tam, tela) => tam >= tela ? Math.min(0, Math.max(tela - tam, v)) : Math.max(0, Math.min(tela - tam, v))
    const x = prende(W / 2 - fx * iw * S, iw * S, W)
    const y = prende((p.alvo ?? H / 2) - fy * ih * S, ih * S, H)
    p.img.style.transform = `translate(${r(x, 1)}px,${r(y, 1)}px) scale(${r(S, 4)})`
    chave.push(r(x, 1), r(y, 1), r(S, 4))

    // entrada: círculo que abre do centro ou fusão
    if (p.i > 0 && p.trans === 'circulo') {
      p.caixa.style.clipPath = entra < 1 ? `circle(${r(entra * 1150, 1)}px at 540px 900px)` : 'none'
      p.caixa.style.opacity = 1
    } else {
      p.caixa.style.clipPath = 'none'
      p.caixa.style.opacity = entra
    }
    chave.push(entra)

    const sai = suave(fase(t, p.ini + p.dur - 0.3, 0.3))  // textos saem antes da troca
    if (p.gancho) {
      const t0 = p.ini + (p.i === 0 ? 0.15 : TR * 0.6)
      p.palavras.forEach((s, j) => {
        const q = saida(fase(t, t0 + j * 0.09, 0.45))
        s.style.opacity = r(q)
        s.style.transform = `translateY(${r((1 - q) * 60, 1)}px)`
        chave.push(r(q))
      })
      p.gancho.style.opacity = r(1 - sai)
      p.gancho.style.transform = `translateY(${r(-sai * 30, 1)}px)`
      chave.push(r(sai))
    }
    if (p.rotulo) {
      const q = fase(t, p.ini + (p.i === 0 ? 0.1 : TR * 0.7), 0.55)
      const e = volta(q)
      p.rotulo.style.opacity = r(lim(q * 3) * (1 - sai))
      p.rotulo.style.transform = `translate(-50%, ${r(-sai * 30, 1)}px) scale(${r(mix(0.55, 1, e))}) rotate(${r(mix(-9, -2, saida(q)), 2)}deg)`
      chave.push(r(q), r(sai))
    }
  }

  // cartão final: abre em círculo a partir da tampa, a tampa gira e pousa, os textos sobem
  const f = cena.fim
  const vf = t >= f.ini
  f.caixa.style.display = vf ? 'block' : 'none'
  if (vf) {
    const a = suave(fase(t, f.ini, TR))
    f.caixa.style.clipPath = a < 1 ? `circle(${r(a * 1500, 1)}px at 500px 640px)` : 'none'
    const g = fase(t, f.ini + 0.15, 0.9)
    f.tampa.style.transform = `scale(${r(mix(0.2, 1, volta(g)))}) rotate(${r(mix(-220, 0, saida(g)), 1)}deg)`
    f.tampa.style.opacity = r(lim(g * 4))
    const sobe = (e, t0, tx = '') => {
      const q = saida(fase(t, t0, 0.5))
      e.style.opacity = r(q)
      e.style.transform = `${tx}translateY(${r((1 - q) * 50, 1)}px)`
      return r(q)
    }
    chave.push(r(a), r(g),
      sobe(f.linha, f.ini + 0.75),
      sobe(f.chamada, f.ini + 0.95, 'translateX(-50%) '),
      sobe(f.contato, f.ini + 1.15))
  }
  return chave.join('|')
}

;(async () => {
  const cena = await montar()
  window.DURACAO = cena.duracao
  window.seek = t => desenhar(cena, t)
  window.seek(0)
  window.pronto = true
})()
