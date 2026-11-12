// старый воркер привычек жил в корне. привычки переехали в /habits/,
// поэтому этот воркер чистит кэш и сам удаляется
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((k) => Promise.all(k.map((x) => caches.delete(x))))
      .then(() => self.registration.unregister())
  );
});
