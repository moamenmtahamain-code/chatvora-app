import { precacheAndRoute } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { NetworkFirst, CacheFirst, StaleWhileRevalidate } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { skipWaiting, clientsClaim } from 'workbox-core';

skipWaiting();
clientsClaim();

precacheAndRoute(self.__WB_MANIFEST);

registerRoute(
  ({ request }) => request.mode === 'navigate',
  new NetworkFirst({
    cacheName: 'chatvora-pages',
    plugins: [
      new ExpirationPlugin({ maxEntries: 50, maxAgeSeconds: 7 * 24 * 60 * 60 }),
    ],
  })
);

registerRoute(
  ({ request }) =>
    request.destination === 'script' ||
    request.destination === 'style' ||
    request.destination === 'font',
  new CacheFirst({
    cacheName: 'chatvora-static',
    plugins: [
      new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 30 * 24 * 60 * 60 }),
    ],
  })
);

registerRoute(
  ({ request }) => request.destination === 'image',
  new CacheFirst({
    cacheName: 'chatvora-images',
    plugins: [
      new ExpirationPlugin({ maxEntries: 60, maxAgeSeconds: 30 * 24 * 60 * 60 }),
    ],
  })
);

registerRoute(
  ({ url }) => url.pathname.startsWith('/api/'),
  new NetworkFirst({
    cacheName: 'chatvora-api',
    networkTimeoutSeconds: 10,
    plugins: [
      new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 24 * 60 * 60 }),
    ],
  })
);

registerRoute(
  ({ request }) =>
    request.destination === 'document' && !request.mode === 'navigate',
  new StaleWhileRevalidate({
    cacheName: 'chatvora-documents',
    plugins: [
      new ExpirationPlugin({ maxEntries: 50, maxAgeSeconds: 7 * 24 * 60 * 60 }),
    ],
  })
);
