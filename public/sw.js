// Service worker: lets Starwake be installed as an app and play offline.
//
// "Network first": when online you always get the newest version of the
// game; every file fetched is also saved, and that saved copy is used
// when there is no connection.

const CACHE = 'starwake-v1';
const FILES = [
  '/',
  '/style.css',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/apple-touch-icon.png',
  '/src/art.js',
  '/src/audio.js',
  '/src/background.js',
  '/src/bosses.js',
  '/src/config.js',
  '/src/enemies.js',
  '/src/fx.js',
  '/src/game.js',
  '/src/input.js',
  '/src/main.js',
  '/src/player.js',
  '/src/powerups.js',
  '/src/stage.js',
  '/src/stage1.js',
  '/src/terrain.js',
  '/src/ui.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(FILES))
      .catch(() => {}) // a missing file shouldn't stop the app installing
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(() =>
        caches.match(req, { ignoreSearch: true })
          .then((hit) => hit || (req.mode === 'navigate' ? caches.match('/') : undefined))
          .then((hit) => hit || Response.error()),
      ),
  );
});
