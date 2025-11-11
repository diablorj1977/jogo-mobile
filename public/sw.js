const CACHE_NAME = 'ecobots-cache-v1';
const OFFLINE_URLS = [
  '/index.html',
  '/home.html',
  '/missoes.html',
  '/inventario.html',
  '/caminhos.html',
  '/perfil.html',
  '/css/bulma.min.css',
  '/css/app.css',
  '/js/common_prelogin.js',
  '/js/common_app.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(OFFLINE_URLS))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.map((key) => {
      if (key !== CACHE_NAME) {
        return caches.delete(key);
      }
      return null;
    })))
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') {
    return;
  }
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
