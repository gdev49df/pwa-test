// при изменении файлов меняй версию, чтобы кэш обновился
const CACHE = 'notes-v2';
const FILES = [
  './',
  './index.html',
  './app.js',
  './manifest.json',
  '../fonts/unbounded-cyrillic.woff2',
  '../fonts/unbounded-latin.woff2',
  '../fonts/onest-cyrillic.woff2',
  '../fonts/onest-latin.woff2',
  '../fonts/literata-cyrillic.woff2',
  '../fonts/literata-latin.woff2',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// сначала сеть, если нет интернета — кэш
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
