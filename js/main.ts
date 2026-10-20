/**
 * main.ts
 * Application entry point.
 */

import { registerServiceWorker } from './serviceWorkerRegistration.js';

const init = async () => {
  try {
    const { App } = await import('./App.js');
    const app = new App();
    (window as unknown as Record<string, unknown>).app = app;
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

// Register the Service Worker for PWA/offline support. Guarded internally:
// dev server, `?disable-sw`, and automation contexts (Playwright, Lighthouse)
// are all skipped, which is what the old commented-out block could not express.
registerServiceWorker();
