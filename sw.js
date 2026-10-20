// Service worker do Hábitos: guarda o app pra funcionar offline. Os seus dados ficam no navegador, não aqui.
const CACHE = 'habitos-v8';
const FONTS = CACHE + '-fontes';
const ASSETS = ['./', './index.html', './manifest.webmanifest', './icon.svg', './icon-192.png', './icon-512.png', './icon-maskable.png'];
// Com internet ruim, espera a rede no máximo isso antes de abrir o que está guardado.
const WAIT_MS = 2500;
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE && k !== FONTS).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
// Arquivos do app: tenta a versão nova na rede; se ela demorar ou falhar, usa a guardada.
// Só guarda respostas que deram certo e vieram deste endereço (Wi-Fi de hotel que redireciona pra uma página de login não entra).
function fresh(e, req, key) {
  const net = fetch(req).then(r => { if (r.ok && new URL(r.url || req.url).origin === location.origin) { const copy = r.clone(); e.waitUntil(caches.open(CACHE).then(c => c.put(key, copy))); } return r; });
  e.waitUntil(net.catch(() => {}));
  const late = new Promise(res => setTimeout(res, WAIT_MS)).then(() => caches.match(key));
  const fromCache = () => caches.match(key).then(m => m || net);
  return Promise.race([net.catch(fromCache), late.then(m => m || net)]).then(r => r || fromCache());
}
self.addEventListener('fetch', e => {
  const req = e.request; if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === location.origin) {
    e.respondWith(fresh(e, req, req.mode === 'navigate' ? './index.html' : req));
  } else if (/fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) {
    e.respondWith(caches.open(FONTS).then(async c => {
      const hit = await c.match(req);
      const net = fetch(req).then(r => { if (r.ok || r.type === 'opaque') c.put(req, r.clone()); return r; }).catch(() => hit);
      return hit || net;
    }));
  }
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window' }).then(cs => cs.length ? cs[0].focus() : self.clients.openWindow('./#hoje')));
});
