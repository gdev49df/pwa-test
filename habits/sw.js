// при изменении файлов сайта меняй версию, чтобы кэш обновился
const CACHE = 'habits-v4';
const FILES = [
  './',
  './index.html',
  './app.js',
  './manifest.json',
  '../theme.css',
  '../fonts/oswald-cyrillic.woff2',
  '../fonts/oswald-latin.woff2',
  '../fonts/intertight-cyrillic.woff2',
  '../fonts/intertight-latin.woff2',
  '../fonts/fira-600-cyrillic.woff2',
  '../fonts/fira-600-latin.woff2',
  '../fonts/rc-400-cyrillic.woff2',
  '../fonts/rc-400-latin.woff2',
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
