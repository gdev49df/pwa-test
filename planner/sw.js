// при изменении файлов меняй версию, чтобы кэш обновился
const CACHE = 'ddx-v46';
const FILES = [
  './',
  './index.html',
  './styles.css',
  './config.js',
  './lib.js',
  './core.js',
  './hubs.js',
  './extra.js',
  './capture.js',
  './account.js',
  './onboard.js',
  './smooth.js',
  './manifest.json',
  './fonts/inter-cyrillic.woff2',
  './fonts/inter-latin.woff2',
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
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith('ddx-') && k !== CACHE).map((k) => caches.delete(k))))
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
      .catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});

// пуш с сервера: показываем уведомление, даже когда приложение закрыто
self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (x) { d = { title: 'DDX Planner', body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.title || 'DDX Planner', { body: d.body || '', tag: d.tag || 'ddx', icon: 'icons/icon-192.png', badge: 'icons/icon-192.png' }));
});

// нажатие на уведомление открывает приложение
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) { if ('focus' in c) return c.focus(); }
      return self.clients.openWindow('./');
    })
  );
});
