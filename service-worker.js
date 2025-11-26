// Service Worker - Development Mode (Pass-through)
// This version doesn't cache anything and just passes requests through
// This prevents errors during development

self.addEventListener('install', event => {
  console.log('[SW] Installing in pass-through mode');
  // Skip waiting to activate immediately
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  console.log('[SW] Activating in pass-through mode');
  event.waitUntil(
    // Clear all caches
    caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  // Just pass through to the network, don't cache anything
  event.respondWith(fetch(event.request));
});
