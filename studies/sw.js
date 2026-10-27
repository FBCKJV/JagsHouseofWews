/* Chapter Studies offline support. Network first, so a new export shows up on the next
   load; whatever was opened before is kept for when there's no connection.
   Only touches caches named "wews-studies-*" (other apps on this site have their own). */
const CACHE = 'wews-studies-v1.17';
const SHELL = ['./', 'index.html', 'app.css', 'app.js', 'manifest.json', 'data/books.json',
  '../img/logo-96.jpg', '../img/logo-256.jpg', '../img/icon-192.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k.startsWith('wews-studies-') && k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const ours = url.origin === location.origin && url.pathname.startsWith(new URL('./', location).pathname);
  const kjvText = /\/KJVBible\/bible\/[^/]+\.json$/.test(url.pathname);
  if (!ours && !kjvText) return;
  e.respondWith(
    fetch(req).then(res => {
      if (res.ok) {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy));
      }
      return res;
    }).catch(() => caches.match(req, { ignoreSearch: true }).then(hit => hit || Response.error()))
  );
});
