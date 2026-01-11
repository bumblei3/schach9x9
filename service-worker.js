const CACHE_NAME = 'schach9x9-v7';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './style.css',
  './css/base.css',
  './css/themes.css',
  './css/layout.css',
  './css/board.css',
  './css/components.css',
  './css/shop.css',
  './css/animations.css',
  './css/debug.css',
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
  './js/RulesEngine.js',
  './js/TimeManager.js',
  './js/ai-worker.js',
  './js/aiController.js',
  './js/gameController.js',
  './js/gameEngine.js',
  './js/aiEngine.js',
  './js/moveController.js',
  './js/tutorController.js',
  './js/statisticsManager.js',
  './js/battleChess3D.js',
  './js/pieces3D.js',
  './js/battleAnimations.js',
  './js/puzzleManager.js',
  './js/puzzleGenerator.js',
  './js/debug.js',
  './js/chess-pieces.js',
  './js/assets/pieces/index.js',
  './js/assets/pieces/classic.js',
  './js/assets/pieces/modern.js',
  './js/assets/pieces/pixel.js',
  './js/assets/pieces/infernale.js',
  './js/assets/pieces/wood.js',
  './js/assets/pieces/neon.js',
  './js/assets/pieces/minimalist.js',
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
  './opening-book.json',
  './opening-book-8x8.json',
  './engine-wasm/pkg/engine_wasm_bg.wasm',
  './engine-wasm/pkg/engine_wasm.js',
];

// ...

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
          // Fallback for missing resources or return simple error response to avoid "Failed to convert value to Response"
          // This is critical for preventing the TypeError in console
          return new Response('Network error and not in cache', {
            status: 408,
            headers: { 'Content-Type': 'text/plain' },
          });
        });
      })
  );
});
