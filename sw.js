const version = 'v23';
const cachePrefix = `stat-fighter-${self.registration.scope}-`;
const cacheName = `${cachePrefix}${version}`;
// Pages request the half-size copies in assets/web/. Only the full-size originals in assets/ are
// precached; once they are, every assets/web/<file> request is answered with assets/<file>.
const webTier = new URL('assets/web/', self.registration.scope);
const files = [
  './journey/methods.js', './journey/convert.js', './journey/protocol.js', './journey/content.js', './journey/core.js', './journey/journey.js', './journey/journey.css', './journey/arcade.css',
  './journey/screens/title.js', './journey/screens/world.js', './journey/screens/select.js', './journey/screens/card.js', './journey/screens/arena.js', './journey/screens/scores.js', './journey/screens/convert.js',
  './assets/fonts/PressStart2P-Regular.ttf', './assets/maverick-arcade-v2.webp', './assets/earth-world-v1.webp', './assets/sunset-airfield-v1.webp',
  './assets/mirror-arcade-v2.webp', './assets/mirror-stage-v1.webp', './assets/iwan-arcade-v1.webp', './assets/iwan-stage-v1.webp', './assets/nova-arcade-v1.webp', './assets/nova-stage-v1.webp',
  './assets/volt-arcade-v1.webp', './assets/volt-stage-v1.webp', './assets/vector-arcade-v1.webp', './assets/vector-stage-v1.webp',
  './assets/rook-arcade-v1.webp', './assets/rook-stage-v1.webp',
  './assets/echo-arcade-v1.webp', './assets/echo-stage-v1.webp',
  './assets/pip-arcade-v1.webp', './assets/pip-stage-v1.webp',
  './assets/chi-arcade-v1.webp', './assets/chi-stage-v1.webp',
  './assets/harbor-arcade-v1.webp', './assets/harbor-stage-v1.webp',
  './assets/aegis-arcade-v1.webp', './assets/aegis-stage-v1.webp',
  './assets/bastion-arcade-v1.webp', './assets/bastion-stage-v1.webp',
  './assets/tess-arcade-v1.webp', './assets/tess-stage-v1.webp',
  './assets/ratio-arcade-v1.webp', './assets/ratio-stage-v1.webp',
  './assets/null-arcade-v1.webp',
  './assets/anchor-arcade-v1.webp', './assets/anchor-stage-v1.webp',
  './assets/switch-arcade-v1.webp', './assets/switch-stage-v1.webp',
  './assets/parry-arcade-v1.webp', './assets/parry-stage-v1.webp',
  './assets/jab-arcade-v1.webp', './assets/jab-stage-v1.webp',
  './assets/scatter-arcade-v1.webp', './assets/scatter-stage-v1.webp',
  './assets/bell-arcade-v1.webp', './assets/bell-stage-v1.webp',
  './assets/towel-arcade-v1.webp', './assets/towel-stage-v1.webp',
  // Thumbnail tier (small, precached directly).
  './assets/thumb/aegis-arcade-v1.webp', './assets/thumb/anchor-arcade-v1.webp', './assets/thumb/bastion-arcade-v1.webp', './assets/thumb/bell-arcade-v1.webp', './assets/thumb/chi-arcade-v1.webp', './assets/thumb/echo-arcade-v1.webp', './assets/thumb/harbor-arcade-v1.webp', './assets/thumb/iwan-arcade-v1.webp', './assets/thumb/jab-arcade-v1.webp', './assets/thumb/maverick-arcade-v2.webp', './assets/thumb/mirror-arcade-v2.webp', './assets/thumb/nova-arcade-v1.webp', './assets/thumb/null-arcade-v1.webp', './assets/thumb/parry-arcade-v1.webp', './assets/thumb/pip-arcade-v1.webp', './assets/thumb/ratio-arcade-v1.webp', './assets/thumb/rook-arcade-v1.webp', './assets/thumb/scatter-arcade-v1.webp', './assets/thumb/switch-arcade-v1.webp', './assets/thumb/tess-arcade-v1.webp', './assets/thumb/towel-arcade-v1.webp', './assets/thumb/vector-arcade-v1.webp', './assets/thumb/volt-arcade-v1.webp',
  './index.html', './style.css', './app.js', './stats.js', './manifest.webmanifest',
  './assets/icon-192.png', './assets/icon-512.png', './assets/icon-maskable.png', './assets/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(cacheName).then((cache) =>
    cache.addAll(files.map((file) => new Request(file, { cache: 'reload' })))));
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter((name) => name.startsWith(cachePrefix) && name !== cacheName)
      .map((name) => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET' || !request.url.startsWith(self.registration.scope)) return;
  event.respondWith((async () => {
    const cache = await caches.open(cacheName);
    if (request.mode === 'navigate') {
      const url = new URL(request.url);
      const base = new URL(self.registration.scope);
      if (url.pathname === base.pathname || url.pathname === new URL('index.html', base).pathname) {
        return (await cache.match('./index.html')) || fetch(request);
      }
    }
    const url = new URL(request.url);
    if (url.pathname.startsWith(webTier.pathname)) {
      const full = await cache.match(new URL('assets/' + url.pathname.slice(webTier.pathname.length), self.registration.scope).href);
      if (full) return full;
    }
    return (await cache.match(request)) || fetch(request);
  })());
});
