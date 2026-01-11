/**
 * main.ts
 * Application entry point.
 */

const init = async () => {
  try {
    const { App } = await import('./App.js');
    const app = new App();
    (window as any).app = app;
    app.initDOM();
  } catch (e) {
    console.error('[Main] Initialization failed:', e);
  }
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// Register Service Worker for PWA (DISABLED in E2E to avoid interference)
if ('serviceWorker' in navigator && !window.location.search.includes('disable-sw')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('service-worker.js')
      .then(registration => {
        console.log('SW registered: ', registration);
      })
      .catch(err => {
        console.log('SW registration failed: ', err);
      });
  });
}
