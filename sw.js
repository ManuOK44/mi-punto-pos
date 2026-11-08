/* Mi Punto POS — archivos para trabajar sin conexión.
   Los datos de productos y ventas permanecen en el almacenamiento local de la app. */
const CACHE = 'mi-punto-pos-cache-v2';
const PREFIX = 'mi-punto-pos-cache-';
const FILES = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png'];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(FILES))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key.startsWith(PREFIX) && key !== CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || !url.pathname.startsWith(self.registration.scope.replace(self.location.origin, ''))) return;

  // Abrir la app incluso sin señal. Cuando hay red, recuperar la versión publicada.
  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      const cached = await caches.match('./index.html');
      if (self.navigator && self.navigator.onLine === false && cached) return cached;
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 3000);
        let response;
        try { response = await fetch(request, {signal: controller.signal}); }
        finally { clearTimeout(timeout); }
        if (response.ok) {
          const cache = await caches.open(CACHE);
          await cache.put('./index.html', response.clone());
        }
        return response;
      } catch (error) {
        if (cached) return cached;
        return Response.error();
      }
    })());
    return;
  }

  // Iconos y manifest se sirven desde el teléfono si no hay red.
  event.respondWith((async () => {
    const cached = await caches.match(request);
    if (cached) return cached;
    try {
      const response = await fetch(request);
      if (response.ok) {
        const cache = await caches.open(CACHE);
        await cache.put(request, response.clone());
      }
      return response;
    } catch (error) {
      return Response.error();
    }
  })());
});
