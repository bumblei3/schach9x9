const CACHE_NAME = 'schach9x9-v2';
const ASSETS = [
  '/',
  '/index.html',
  '/main.js',
  '/gameEngine.js',
  '/aiEngine.js',
  '/ai-worker.js',
  '/ui.js',
  '/chess-pieces.js',
  '/sounds.js',
  '/arrows.js',
  '/tutorial.js',
  '/logger.js',
  '/config.js',
  '/utils.js',
  '/style.css',
  '/coordinates.css',
  '/manifest.json',
  '/opening-book.json',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(ASSETS).catch(err => {
        console.error('Failed to cache assets:', err);
      });
    })
  );
  // Skip waiting to activate immediately
  self.skipWaiting();
});

self.addEventListener('fetch', event => {
  // Network-first strategy for better updates
  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Cache the response for offline use
        const responseClone = response.clone();
        caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, responseClone);
        });
        return response;
      })
      .catch(() => {
        // Fallback to cache if network fails
        return caches.match(event.request);
      })
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches
      .keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});
