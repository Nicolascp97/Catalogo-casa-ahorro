/* ============================================================
   Casa Ahorro — Service Worker (PWA offline)
   - cache-first para estáticos (CSS/JS/logo)
   - network-first para datos (productos.json, config.json)
   Versionar CACHE para invalidar cuando se actualicen los estáticos.
   ============================================================ */
const CACHE = 'casa-ahorro-v1';

// Estáticos base de la app (app shell)
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/style.css',
  '/script.js',
  '/logo.png',
  '/manifest.json',
];

// Datos que deben priorizar la red (para ver cambios del admin pronto)
const NETWORK_FIRST = ['productos.json', 'config.json'];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
      .catch(() => { /* si falla algún asset, no bloquear la instalación */ })
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Solo gestionamos peticiones de nuestro propio origen.
  if (url.origin !== self.location.origin) return;

  // Nunca cachear el panel admin ni la API.
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/admin')) return;

  const isData = NETWORK_FIRST.some(name => url.pathname.endsWith(name));

  if (isData) {
    // network-first: intenta red, cae al caché si no hay conexión
    event.respondWith(
      fetch(req)
        .then(res => {
          const clone = res.clone();
          caches.open(CACHE).then(cache => cache.put(req, clone));
          return res;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  // cache-first: sirve del caché y actualiza en segundo plano
  event.respondWith(
    caches.match(req).then(cached => {
      const network = fetch(req)
        .then(res => {
          if (res && res.status === 200) {
            const clone = res.clone();
            caches.open(CACHE).then(cache => cache.put(req, clone));
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
