/**
 * Strukturiertes Logging-System für Schach 9x9
 *
 * Unterstützt verschiedene Log-Levels: ERROR, WARN, INFO, DEBUG
 * Kann für Production-Mode deaktiviert werden
 * Konfiguration wird in localStorage gespeichert
 */

const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3,
};

const LOG_STYLES = {
  ERROR: 'color: #ff4444; font-weight: bold',
  WARN: 'color: #ffaa00; font-weight: bold',
  INFO: 'color: #4488ff',
  DEBUG: 'color: #888888',
};

class Logger {
  constructor() {
    // Check if localStorage is available
    this.hasLocalStorage = typeof localStorage !== 'undefined';

    // Load settings from localStorage or use defaults
    const savedLevel = this.hasLocalStorage ? localStorage.getItem('logLevel') : null;
    this.level = savedLevel !== null ? parseInt(savedLevel, 10) : LOG_LEVELS.DEBUG;

    const savedEnabled = this.hasLocalStorage ? localStorage.getItem('loggingEnabled') : null;
    this.enabled = savedEnabled !== null ? savedEnabled === 'true' : true;
  }

  /**
   * Set the log level
   * @param {number} level - One of LOG_LEVELS (ERROR, WARN, INFO, DEBUG)
   */
  setLevel(level) {
    this.level = level;
    if (this.hasLocalStorage) {
      localStorage.setItem('logLevel', level.toString());
    }
  }

  /**
   * Enable or disable logging
   * @param {boolean} enabled
   */
  setEnabled(enabled) {
    this.enabled = enabled;
    if (this.hasLocalStorage) {
      localStorage.setItem('loggingEnabled', enabled.toString());
    }
  }

  /**
   * Internal log method
   * @private
   */
  _log(level, levelName, args) {
    if (!this.enabled || level > this.level) {
      return;
    }

    const timestamp = new Date().toISOString().substring(11, 23);
    const prefix = `%c[${levelName}] ${timestamp}`;

    console.log(prefix, LOG_STYLES[levelName], ...args);
  }

  /**
   * Log error message
   */
  error(...args) {
    this._log(LOG_LEVELS.ERROR, 'ERROR', args);
  }

  /**
   * Log warning message
   */
  warn(...args) {
    this._log(LOG_LEVELS.WARN, 'WARN', args);
  }

  /**
   * Log info message
   */
  info(...args) {
    this._log(LOG_LEVELS.INFO, 'INFO', args);
  }

  /**
   * Log debug message
   */
  debug(...args) {
    this._log(LOG_LEVELS.DEBUG, 'DEBUG', args);
  }

  /**
   * Create a child logger with a specific context
   * @param {string} context - Context name (e.g., 'AI', 'UI', 'Game')
   * @returns {Object} Child logger with context
   */
  context(context) {
    return {
      error: (...args) => this.error(`[${context}]`, ...args),
      warn: (...args) => this.warn(`[${context}]`, ...args),
      info: (...args) => this.info(`[${context}]`, ...args),
      debug: (...args) => this.debug(`[${context}]`, ...args),
    };
  }
}

// Create singleton instance
export const logger = new Logger();

// Export LOG_LEVELS for configuration
export { LOG_LEVELS };

// For production, you can set:
// logger.setLevel(LOG_LEVELS.WARN);
// or
// logger.setEnabled(false);
