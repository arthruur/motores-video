// Prensa: funciona offline depois da 1ª visita e recebe vídeos pelo menu Compartilhar (Android).
const CACHE = 'prensa-v2';

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(['./', './index.html', './manifest.webmanifest', './icone.svg'])));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith('prensa-') && k !== CACHE).map((k) => caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  // menu Compartilhar do Android: guarda o vídeo e abre o app
  if (e.request.method === 'POST' && url.pathname.endsWith('/receber')) {
    e.respondWith((async () => {
      const dados = await e.request.formData();
      const video = dados.get('video');
      const link = [dados.get('link'), dados.get('texto'), dados.get('titulo')].map(String).join(' ').match(/https?:\/\/\S+/)?.[0];
      if ((!video || typeof video === 'string') && link) return Response.redirect(`./?link=${encodeURIComponent(link)}`, 303);
      if (video && typeof video !== 'string') {
        const c = await caches.open('prensa-recebido');
        await c.put('./recebido', new Response(video, { headers: { 'Content-Type': video.type, 'X-Nome': encodeURIComponent(video.name || 'video.mp4') } }));
      }
      return Response.redirect('./?recebido=1', 303);
    })());
    return;
  }
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  // rede primeiro (versão nova), cache se estiver offline
  e.respondWith(
    fetch(e.request)
      .then((r) => {
        if (r.ok) { const copia = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copia)); }
        return r;
      })
      .catch(() => caches.match(e.request).then((r) => r || caches.match('./index.html'))),
  );
});
