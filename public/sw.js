// File: public/sw.js
const CACHE_NAME = 'ecobots-cache-v5';
const SCOPE_BASE = self.registration.scope;
const OFFLINE_PATHS = [
  'index.html',
  'home.html',
  'missoes.html',
  'missao.html',
  'missao_batalha.html',
  'missao_foto.html',
  'missao_qr.html',
  'missao_corrida.html',
  'missao_p2p.html',
  'inventario.html',
  'caminhos.html',
  'perfil.html',
  'css/bulma.min.css',
  'css/app.css',
  'js/base_config.js',
  'js/common_prelogin.js',
  'js/common_app.js',
  'js/home.js',
  'js/inventario.js',
  'js/missao.js',
  'js/missao_batalha.js',
  'js/missao_foto.js',
  'js/missao_qr.js',
  'js/missao_corrida.js',
  'js/missao_p2p.js',
  'js/missoes_batalha.js',
  'js/missoes_corrida.js',
  'js/missoes_foto.js',
  'js/missoes_qr.js',
  'js/missoes_p2p.js'
];

function toAbsolute(path) {
  return new URL(path, SCOPE_BASE).toString();
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(OFFLINE_PATHS.map(toAbsolute)))
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
