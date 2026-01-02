const CACHE_NAME = 'schach9x9-v1';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './style.css',
  './coordinates.css',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './js/main.js',
  './js/App.js',
  './js/config.js',
  './js/utils.js',
  './js/logger.js',
  './js/sounds.js',
  './js/storage.js',
  './js/ui.js',
  './js/effects.js',
  './js/arrows.js',
  './js/tutorial.js',
  './js/rulesEngine.js', // Case sensitive check needed? File is RulesEngine.js
  './js/RulesEngine.js',
  './js/TimeManager.js',
  './js/ai-worker.js',
  './js/aiController.js',
  './js/gameController.js',
  './js/gameEngine.js', // Legacy
  './js/aiEngine.js', // Legacy
  './js/moveController.js', // Legacy
  './js/tutorController.js',
  './js/statisticsManager.js',
  './js/ai/Evaluation.js',
  './js/ai/MoveGenerator.js',
  './js/ai/MoveOrdering.js',
  './js/ai/OpeningBook.js',
  './js/ai/Search.js',
  './js/ai/TranspositionTable.js',
  './js/input/KeyboardManager.js',
  './js/move/GameStateManager.js',
  './js/move/MoveExecutor.js',
  './js/move/MoveValidator.js',
  './js/shop/ShopManager.js',
  './js/tutor/HintGenerator.js',
  './js/tutor/MoveAnalyzer.js',
  './js/tutor/TacticsDetector.js',
  './js/ui/BoardRenderer.js',
  './js/ui/GameStatusUI.js',
  './js/ui/OverlayManager.js',
  './js/ui/ShopUI.js',
  './js/ui/TooltipManager.js',
  './js/ui/TutorUI.js',
  './js/utils/PGNGenerator.js',
];

// Install event: Cache core assets
self.addEventListener('install', event => {
  console.log('[SW] Installing Service Worker...');
  event.waitUntil(
    caches
      .open(CACHE_NAME)
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
    caches
      .keys()
      .then(keyList => {
        return Promise.all(
          keyList.map(key => {
            if (key !== CACHE_NAME) {
              console.log('[SW] Removing old cache', key);
              return caches.delete(key);
            }
          })
        );
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

        caches.open(CACHE_NAME).then(cache => {
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
