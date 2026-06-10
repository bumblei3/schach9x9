/**
 * ErrorManager.ts
 * Centralized error handling and reporting.
 */
import { logger } from '../logger.js';
import { notificationUI } from '../ui/NotificationUI.js';

class ErrorManager {
  private initialized: boolean = false;

  constructor() {
    this.initialized = false;
  }

  init(): void {
    if (this.initialized) return;

    // Global Error Handler
    window.onerror = (message, source, lineno, colno, error) => {
      this.handleError(error || new Error(String(message)), {
        context: 'Global',
        meta: { source, lineno, colno },
      });
      return true; // Prevent default browser console spam if handled
    };

    // Unhandled Promise Rejections
    window.onunhandledrejection = (event: PromiseRejectionEvent) => {
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
   * @param error
   * @param options
   */
  handleError(error: unknown, options: { context?: string; critical?: boolean; meta?: Record<string, unknown> } = {}): void {
    const context = options.context || 'App';
    const isCritical = options.critical || false;

    // Log to internal logger
    logger.error(`[${context}]`, error);

    if (isCritical) {
      this.showCriticalError(error);
    } else {
      // Show toast for non-critical errors
      const msg = error instanceof Error ? error.message : String(error);
      notificationUI.show(msg, 'error', `Fehler (${context})`);
    }
  }

  /**
   * Report a warning (non-blocking issue)
   */
  warning(message: string, context: string = 'App'): void {
    logger.warn(`[${context}]`, message);
    notificationUI.show(message, 'warning', `Warnung (${context})`);
  }

  /**
   * Show Critical Error Modal (Game Over state)
   */
  showCriticalError(error: unknown): void {
    const errorOverlay = document.getElementById('error-overlay');

    // Fallback if overlay doesn't exist
    if (!errorOverlay) {
      alert(`KRITISCHER FEHLER:\n${error instanceof Error ? error.message : String(error)}`);
      return;
    }

    // Enhance error message
    const displayMsg = error instanceof Error ? error.message : 'Unbekannter Fehler';
    if (error instanceof Error && error.stack) {
      logger.context('ErrorManager').error('Full Stack:', error.stack);
    }

    const contentContainer = errorOverlay.querySelector('div');
    if (!contentContainer) return;

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
      detailsBox.textContent = `${displayMsg}\n\n${error instanceof Error && error.stack ? error.stack : ''}`;
    }

    errorOverlay.classList.remove('hidden');
  }
}

export const errorManager = new ErrorManager();
