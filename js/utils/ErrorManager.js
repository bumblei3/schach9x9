/**
 * ErrorManager.js
 * Centralized error handling and reporting.
 */
import { logger } from '../logger.js';
import { notificationUI } from '../ui/NotificationUI.js';

class ErrorManager {
  constructor() {
    this.initialized = false;
  }

  init() {
    if (this.initialized) return;

    // Global Error Handler
    window.onerror = (message, source, lineno, colno, error) => {
      this.handleError(error || new Error(message), {
        context: 'Global',
        meta: { source, lineno, colno },
      });
      return true; // Prevent default browser console spam if handled
    };

    // Unhandled Promise Rejections
    window.onunhandledrejection = event => {
      this.handleError(event.reason, {
        context: 'Promise',
        meta: { type: 'unhandledRejection' },
      });
    };

    this.initialized = true;
    logger.info('ErrorManager initialized');
  }

  /**
   * Handle an error
   * @param {Error|string} error
   * @param {Object} options
   */
  handleError(error, options = {}) {
    const context = options.context || 'App';
    const isCritical = options.critical || false;

    // Log to internal logger
    logger.error(`[${context}]`, error);

    if (isCritical) {
      this.showCriticalError(error);
    } else {
      // Show toast for non-critical errors
      // Debounce slightly to avoid spamming toasts in loops
      const msg = error.message || String(error);
      notificationUI.show(msg, 'error', `Fehler (${context})`);
    }
  }

  /**
   * Report a warning (non-blocking issue)
   */
  warning(message, context = 'App') {
    logger.warn(`[${context}]`, message);
    notificationUI.show(message, 'warning', `Warnung (${context})`);
  }

  /**
   * Show Critical Error Modal (Game Over state)
   */
  showCriticalError(error) {
    const errorOverlay = document.getElementById('error-overlay');
    // const msgElement = document.getElementById('error-message'); // Unused

    // Fallback if overlay doesn't exist
    if (!errorOverlay) {
      alert(`KRITISCHER FEHLER:\n${error.message}`);
      return;
    }

    // Enhance error message
    const displayMsg = error.message || 'Unbekannter Fehler';
    if (error.stack) {
      // Simplified stack for display - logic removed as unused variable caused lint error
      // const stackLines = error.stack.split('\n').slice(0, 3).join('\n');
      console.error('Full Stack:', error.stack); // Still log full stack to console
    }

    // Update Modal Content (if structure matches new design)
    // We will inject the new structure dynamically if needed or assume index.html update
    const contentContainer = errorOverlay.querySelector('div');

    // Inject premium error HTML if not present
    if (!contentContainer.classList.contains('critical-error-content')) {
      contentContainer.innerHTML = `
        <div class="critical-error-content" style="background: var(--bg-panel); padding: 2rem; border-radius: 16px; max-width: 500px; text-align: center;">
             <div class="error-icon-large">💥</div>
             <h2 class="error-title">Kritischer Fehler</h2>
             <p class="error-description">
               Ein unerwartetes Problem ist aufgetreten und das Spiel wurde gestoppt.
             </p>
             <div class="error-details-box" id="error-details-content"></div>
             <div style="display: flex; gap: 10px; justify-content: center; margin-top: 1rem;">
               <button class="btn-primary" onclick="location.reload()">Neustarten</button>
               <button class="btn-secondary" onclick="navigator.clipboard.writeText(document.getElementById('error-details-content').innerText); alert('Kopiert!')">Kopieren</button>
             </div>
        </div>
      `;
    }

    const detailsBox = document.getElementById('error-details-content');
    if (detailsBox) {
      detailsBox.textContent = `${displayMsg}\n\n${error.stack || ''}`;
    }

    errorOverlay.style.display = 'flex';
  }
}

export const errorManager = new ErrorManager();
