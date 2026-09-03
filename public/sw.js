// Service worker di Cassetto.
// Strategia: cache-first per l'app shell (funziona offline dopo il primo caricamento),
// network-first con fallback cache per tutto il resto dello stesso origin.
const CACHE_NAME = 'cassetto-v1';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(request).then((cached) => {
      const fetchPromise = fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => cached);
      return cached || fetchPromise;
    })
  );
});

// Periodic Background Sync (best-effort, solo dove supportato dal browser).
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'cassetto-check') {
    event.waitUntil(
      self.clients.matchAll().then((clients) => {
        clients.forEach((c) => c.postMessage({ type: 'PERIODIC_SYNC' }));
      })
    );
  }
});

self.addEventListener('sync', (event) => {
  if (event.tag === 'cassetto-check') {
    event.waitUntil(
      self.clients.matchAll().then((clients) => {
        clients.forEach((c) => c.postMessage({ type: 'PERIODIC_SYNC' }));
      })
    );
  }
});
