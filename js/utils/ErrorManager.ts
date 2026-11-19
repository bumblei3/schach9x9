/**
 * ErrorManager.ts
 * Centralized error handling and reporting.
 */
import { logger } from '../logger.js';
import { notificationUI } from '../ui/NotificationUI.js';
import { t } from '../i18n.js';

const RECENT_ERROR_LIMIT = 8;

class ErrorManager {
  private initialized: boolean = false;
  private recent: string[] = [];

  constructor() {
    this.initialized = false;
  }

  /**
   * Last client errors, oldest first. The issue reporter attaches these.
   * Each line is already shortened.
   */
  recentErrors(): string[] {
    return this.recent.slice();
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
  handleError(
    error: unknown,
    options: { context?: string; critical?: boolean; meta?: Record<string, unknown> } = {}
  ): void {
    const context = options.context || 'App';
    const isCritical = options.critical || false;

    this.remember(context, error);

    // Log to internal logger
    logger.error(`[${context}]`, error);

    if (isCritical) {
      this.showCriticalError(error);
    } else {
      // Show toast for non-critical errors
      const msg = error instanceof Error ? error.message : String(error);
      notificationUI.show(msg, 'error', t('error.title', { context }));
    }
  }

  /**
   * Report a warning (non-blocking issue)
   */
  warning(message: string, context: string = 'App'): void {
    logger.warn(`[${context}]`, message);
    notificationUI.show(message, 'warning', t('error.warningTitle', { context }));
  }

  /**
   * Show Critical Error Modal (Game Over state)
   */
  showCriticalError(error: unknown): void {
    const errorOverlay = document.getElementById('error-overlay');

    // Fallback if overlay doesn't exist
    if (!errorOverlay) {
      alert(t('error.criticalAlert', { message: error instanceof Error ? error.message : String(error) }));
      return;
    }

    // Enhance error message
    const displayMsg = error instanceof Error ? error.message : t('error.unknown');
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
               <button class="btn-primary" data-action="reload">Neustarten</button>
               <button class="btn-secondary" data-action="copy">Kopieren</button>
             </div>
        </div>
      `;
    }

    const detailsBox = document.getElementById('error-details-content');
    if (detailsBox) {
      detailsBox.textContent = `${displayMsg}\n\n${error instanceof Error && error.stack ? error.stack : ''}`;
    }

    // Wire up buttons (CSP-compliant: no inline onclick handlers).
    const reloadBtn = contentContainer.querySelector('[data-action="reload"]');
    const copyBtn = contentContainer.querySelector('[data-action="copy"]');
    if (reloadBtn) {
      reloadBtn.addEventListener('click', () => location.reload());
    }
    if (copyBtn) {
      copyBtn.addEventListener('click', () => {
        const details = document.getElementById('error-details-content');
        if (details) {
          navigator.clipboard.writeText(details.innerText).then(() => alert('Kopiert!')).catch(() => {});
        }
      });
    }

    errorOverlay.classList.remove('hidden');
  }

  private remember(context: string, error: unknown): void {
    const message = error instanceof Error ? error.message : String(error);
    const stack =
      error instanceof Error && error.stack ? error.stack.split('\n').slice(0, 3).join(' | ') : '';
    const line = (stack ? `[${context}] ${message} | ${stack}` : `[${context}] ${message}`)
      .replace(/\s+/g, ' ')
      .slice(0, 400);
    this.recent.push(line);
    if (this.recent.length > RECENT_ERROR_LIMIT) {
      this.recent.splice(0, this.recent.length - RECENT_ERROR_LIMIT);
    }
  }
}

export const errorManager = new ErrorManager();
