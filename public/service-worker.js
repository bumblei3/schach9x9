// Install event: precache the app shell.
//
// The list has to match what the build actually ships. `BUILD_PRECACHE` is
// empty here and gets filled by a small Vite plugin (see vite.config.ts) that
// reads the emitted `dist/index.html` and rewrites this file in `dist/` — so
// the hashed `assets/*` entries can never go stale. The stable files in
// `SHELL_PRECACHE` live in `public/` and keep their names across builds.
const SHELL_PRECACHE = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './opening-book.json',
  './opening-book-8x8.json',
];
const BUILD_PRECACHE = [];

const CACHE_NAME = 'schach9x9-v9';

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async cache => {
      // One entry per `add()`: `addAll` rejects as a whole, so a single missing
      // file used to leave the cache completely empty (that is what happened
      // with the old `/style.css` entry — the file is bundled into
      // `assets/main-*.css` and never shipped under that name).
      const failures = [];
      for (const url of [...SHELL_PRECACHE, ...BUILD_PRECACHE]) {
        try {
          await cache.add(url);
        } catch (err) {
          failures.push(url);
          console.warn('[SW] precache fehlgeschlagen:', url, err);
        }
      }
      if (failures.length > 0) {
        console.warn('[SW] precache unvollstaendig, fehlen:', failures.join(', '));
      }
    })
  );
  self.skipWaiting();
});

// Fetch event: Network-First strategy
self.addEventListener('fetch', event => {
  // Skip cross-origin requests
  if (!event.request.url.startsWith(self.location.origin)) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Check if we received a valid response
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }

        // Clone the response
        const responseToCache = response.clone();

        caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, responseToCache);
        });

        return response;
      })
      .catch(() => {
        // If network fails, try to serve from cache
        return caches.match(event.request).then(response => {
          if (response) {
            return response;
          }
          // Fallback for missing resources
          return new Response('Network error and not in cache', {
            status: 408,
            headers: { 'Content-Type': 'text/plain' },
          });
        });
      })
  );
});

// Activate event: Clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});
