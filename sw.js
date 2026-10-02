/* Silverleaf Behaviour Tracker — service worker
 * Cache-first app shell so the app opens fully offline once installed.
 * Bump VERSION whenever index.html changes so phones pick up the update. */
const VERSION = 'sbt-v4';
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png',
  './apple-touch-icon.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return; // sync POSTs go straight to the network

  if (req.mode === 'navigate') {
    const path = new URL(req.url).pathname;
    // Teacher app (/ or /index.html): serve the cached shell instantly, refresh it in the background
    if (/\/(index\.html)?$/.test(path)) {
      e.respondWith(
        caches.match('./index.html').then((cached) => {
          const fresh = fetch(req).then((res) => {
            if (res && res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put('./index.html', copy)); }
            return res;
          }).catch(() => cached);
          return cached || fresh;
        })
      );
      return;
    }
    // Any other page (e.g. dashboard.html): network first, cached copy only when offline
    e.respondWith(
      fetch(req).then((res) => {
        if (res && res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); }
        return res;
      }).catch(() => caches.match(req))
    );
    return;
  }

  // Everything else (icons, fonts): cache-first, then network + cache
  e.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        if (res && res.ok && (req.url.startsWith(self.location.origin) || req.url.includes('fonts.g'))) {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put(req, copy));
        }
        return res;
      }).catch(() => cached);
    })
  );
});
