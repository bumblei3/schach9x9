/**
 * main.ts
 * Application entry point.
 */

import { registerServiceWorker } from './serviceWorkerRegistration.js';

// Stylesheets für Ansichten, die auf der Startseite nicht vorkommen (Shop,
// Analyse, Promotion, Debug Console) liegen in css/views.css. Als eigener Chunk
// nachladen, statt sie in das render-blockierende Haupt-Stylesheet zu legen —
// das hat den ersten Paint um 0,26 s beschleunigt (Median aus 5 Läufen,
// tools/lighthouse-local.mjs). Module-Skripte sind deferred, also läuft das
// parallel zum ersten Paint und nicht danach.
void import('../css/views.css');

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
