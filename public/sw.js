// Ledger service worker: the app shell works offline, and API reads fall back
// to the last response seen so the screens still show saved data.
const VERSION = 'ledger-v4';
const SHELL = [
  '/',
  '/index.html',
  '/landing.css',
  '/landing.js',
  '/hero.webp',
  '/app',
  '/app.html',
  '/styles.css',
  '/app.js',
  '/manifest.webmanifest',
  '/fonts/anek-latin.woff2',
  '/fonts/anek-latin-ext.woff2',
  '/icons/icon.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];
const SHELL_CACHE = `${VERSION}-shell`;
const API_CACHE = `${VERSION}-api`;

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  // API reads: network first, last good response when offline
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(API_CACHE).then((cache) => cache.put(request, copy));
          }
          return res;
        })
        .catch(() => caches.match(request).then((hit) => hit || Response.json({ error: 'Offline and no saved data for this view' }, { status: 503 })))
    );
    return;
  }

  // Page navigations: network first so updates land; offline, the cached page
  // (landing or app), falling back to the app shell
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match(request, { ignoreSearch: true }).then((hit) => hit || caches.match('/app'))));
    return;
  }

  // Static files: network first (the server is local, so edits show up at once),
  // cached copy when offline
  event.respondWith(
    fetch(request)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(SHELL_CACHE).then((cache) => cache.put(request, copy));
        }
        return res;
      })
      .catch(() => caches.match(request))
  );
});
