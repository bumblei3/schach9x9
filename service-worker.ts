const CACHE_NAME = 'schach9x9-v8';

// @ts-ignore
const swSelf = self as unknown as ServiceWorkerGlobalScope;

// Fetch event: Network-First strategy
swSelf.addEventListener('fetch', (_event: FetchEvent) => {
  const fetchEvent = _event;

  // Skip cross-origin requests
  if (!fetchEvent.request.url.startsWith(swSelf.location.origin)) {
    return;
  }

  fetchEvent.respondWith(
    fetch(fetchEvent.request)
      .then(response => {
        // Check if we received a valid response
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }

        // Clone the response
        const responseToCache = response.clone();

        caches.open(CACHE_NAME).then(cache => {
          cache.put(fetchEvent.request, responseToCache);
        });

        return response;
      })
      .catch(() => {
        // If network fails, try to serve from cache
        return caches.match(fetchEvent.request).then(response => {
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
