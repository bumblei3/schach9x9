/**
 * main.js
 * Application entry point.
 */
import { App } from './App.js';

// Initialize the application
const app = new App();

// Export for legacy access if needed (optional)
window.app = app;

// Initialize DOM listeners
document.addEventListener('DOMContentLoaded', () => {
  app.initDOM();

  // Register Service Worker for PWA
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('service-worker.js')
        .then(registration => {
          console.log('SW registered: ', registration);
        })
        .catch(registrationError => {
          console.log('SW registration failed: ', registrationError);
        });
    });
  }
});
