/* ============================================================
   sw.js — My-Class-Track service worker
   Versioned cache. Cache-first for static assets, network-first
   for the page shell. Cleans old caches on activate.
   ============================================================ */

const VERSION = 'v1.4.0';
const CACHE = `mct-cache-${VERSION}`;

const PRECACHE = [
  './',
  './index.html',
  './offline.html',
  './manifest.webmanifest',
  './src/styles.css',
  './src/app.js',
  './src/ui.js',
  './src/jalali.js',
  './src/store.js',
  './src/prefs.js',
  './src/timer.js',
  './src/reports.js',
  './src/media.js',
  './src/reminders.js',
  './src/pages/members.js',
  './src/pages/settings.js',
  './src/pages/attendance.js',
  './src/pages/door.js',
  './src/pages/payment.js',
  './src/pages/homework.js',
  './src/pages/home.js',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/icon-192.svg',
  './icons/icon-512.svg',
  './icons/icon-maskable.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then(async (cache) => {
      // Add entries individually: one missing/renamed file must not abort the
      // whole install, otherwise the app loses offline support entirely.
      await Promise.all(PRECACHE.map((url) => cache.add(url).catch(() => null)));
    }).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

const OFFLINE_URL = './offline.html';

/** Only cache complete, same-origin responses — never opaque or error replies. */
function cacheIfUsable(cache, request, response) {
  if (response && response.status === 200 && response.type !== 'opaque') {
    cache.put(request, response.clone());
  }
  return response;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // let CDN font requests pass through

  const isPage = request.mode === 'navigate' || (request.headers.get('accept') || '').includes('text/html');

  if (isPage) {
    // network-first for the page shell, fall back to cache when offline
    event.respondWith(
      fetch(request)
        .then((response) => caches.open(CACHE).then((cache) => cacheIfUsable(cache, request, response)))
        .catch(async () => {
          const cached = await caches.match(request);
          if (cached) return cached;
          const shell = await caches.match('./index.html');
          if (shell) return shell;
          return caches.match(OFFLINE_URL);
        }),
    );
    return;
  }

  // cache-first for static assets
  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request).then((response) =>
      caches.open(CACHE).then((cache) => cacheIfUsable(cache, request, response)))),
  );
});