// Service worker di Cassetto.
// - Navigazioni (index.html): network-first, così dopo un deploy si carica sempre l'index nuovo
//   che punta ad asset esistenti; offline si ripiega sulla copia in cache.
// - Asset con hash (/assets/*): cache-first, sono immutabili.
// - Altri file dello stesso origin: stale-while-revalidate.
// Versione cache: aggiornala a ogni rilascio. Niente skipWaiting né reload automatico:
// la nuova versione prende il controllo al prossimo avvio, quando le schede aperte sono chiuse.
const CACHE_NAME = 'cassetto-v16';
const INDEX_URL = new URL('./index.html', self.location).href;
const APP_SHELL = ['./', './index.html', './manifest.webmanifest', './icons/icon-192.svg', './fonts/fonts.css', './fonts/plus-jakarta-sans-latin.woff2', './fonts/plus-jakarta-sans-latin-ext.woff2'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      // cache: 'reload' evita di precachare un index vecchio preso dalla cache HTTP.
      .then((cache) => Promise.all(APP_SHELL.map((u) => cache.add(new Request(u, { cache: 'reload' })).catch(() => {}))))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('cassetto-') && k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

async function putInCache(request, response) {
  if (!response || response.status !== 200 || response.type === 'opaque') return;
  try {
    const cache = await caches.open(CACHE_NAME);
    await cache.put(request, response);
  } catch {
    /* quota piena o richiesta non cacheabile */
  }
}

async function networkFirstNavigation(event) {
  try {
    const response = await fetch(event.request, { cache: 'no-store' });
    if (response.ok) {
      const copy = response.clone();
      event.waitUntil(putInCache(INDEX_URL, copy));
    }
    return response;
  } catch {
    const cache = await caches.open(CACHE_NAME);
    return (await cache.match(INDEX_URL)) || (await cache.match(event.request)) || Response.error();
  }
}

async function cacheFirstAsset(event) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(event.request);
  if (cached) return cached;
  const response = await fetch(event.request);
  if (response.ok) event.waitUntil(putInCache(event.request, response.clone()));
  return response;
}

async function staleWhileRevalidate(event) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(event.request);
  const network = fetch(event.request)
    .then((response) => {
      if (response.ok) event.waitUntil(putInCache(event.request, response.clone()));
      return response;
    })
    .catch(() => cached || Response.error());
  if (cached) {
    event.waitUntil(network.catch(() => {}));
    return cached;
  }
  return network;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.endsWith('/sw.js')) return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirstNavigation(event));
  } else if (url.pathname.includes('/assets/')) {
    event.respondWith(cacheFirstAsset(event));
  } else {
    event.respondWith(staleWhileRevalidate(event));
  }
});

// Periodic Background Sync (best-effort, solo dove supportato dal browser).
function notifyClients() {
  return self.clients.matchAll().then((clients) => {
    clients.forEach((c) => c.postMessage({ type: 'PERIODIC_SYNC' }));
  });
}
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'cassetto-check') event.waitUntil(notifyClients());
});
self.addEventListener('sync', (event) => {
  if (event.tag === 'cassetto-check') event.waitUntil(notifyClients());
});
