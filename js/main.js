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
});
