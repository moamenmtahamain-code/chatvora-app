const CACHE_NAME = 'lan-portal-v1';
const OFFLINE_URL = '/';
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(['/','/index.html','/style.css','/app.js']))
  );
});
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((r) => r || fetch(event.request))
  );
});
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});
