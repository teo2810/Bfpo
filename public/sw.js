// Service worker di Cassetto.
// Strategia: cache-first per l'app shell (funziona offline dopo il primo caricamento),
// network-first con fallback cache per tutto il resto dello stesso origin.
// Versione cache: aggiornala a ogni rilascio. Niente skipWaiting né reload automatico:
// la nuova versione prende il controllo al prossimo avvio, quando le schede aperte sono chiuse.
const CACHE_NAME = 'cassetto-v3';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).catch(() => {})
  );
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
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone)).catch(() => {});
          }
          return response;
        })
        .catch(() => cached || (request.mode === 'navigate' ? caches.match('./index.html') : Response.error()));
      if (cached) {
        event.waitUntil(fetchPromise.catch(() => {}));
        return cached;
      }
      return fetchPromise;
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
