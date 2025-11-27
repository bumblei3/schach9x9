const CACHE_NAME = 'schach9x9-v1';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './style.css',
  './coordinates.css',
  './main.js',
  './gameController.js',
  './gameEngine.js',
  './aiEngine.js',
  './aiController.js',
  './moveController.js',
  './tutorController.js',
  './chess-pieces.js',
  './config.js',
  './utils.js',
  './logger.js',
  './ui.js',
  './sounds.js',
  './arrows.js',
  './tutorial.js',
  './ai-worker.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

// Install event: Cache core assets
self.addEventListener('install', event => {
  console.log('[SW] Installing Service Worker...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] Caching app shell');
        return cache.addAll(ASSETS_TO_CACHE);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate event: Clean up old caches
self.addEventListener('activate', event => {
  console.log('[SW] Activating Service Worker...');
  event.waitUntil(
    caches.keys().then(keyList => {
      return Promise.all(keyList.map(key => {
        if (key !== CACHE_NAME) {
          console.log('[SW] Removing old cache', key);
          return caches.delete(key);
        }
      }));
    })
      .then(() => self.clients.claim())
  );
});

// Fetch event: Network-First strategy for HTML/JS (to get updates), Cache-First for others
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

        caches.open(CACHE_NAME)
          .then(cache => {
            cache.put(event.request, responseToCache);
          });

        return response;
      })
      .catch(() => {
        // If network fails, try to serve from cache
        return caches.match(event.request);
      })
  );
});
