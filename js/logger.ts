/**
 * Strukturiertes Logging-System für Schach 9x9
 *
 * Unterstützt verschiedene Log-Levels: ERROR, WARN, INFO, DEBUG
 * Kann für Production-Mode deaktiviert werden
 * Konfiguration wird in localStorage gespeichert
 */

export const LOG_LEVELS = {
    ERROR: 0,
    WARN: 1,
    INFO: 2,
    DEBUG: 3,
} as const;

export type LogLevel = (typeof LOG_LEVELS)[keyof typeof LOG_LEVELS];
export type LogLevelName = keyof typeof LOG_LEVELS;

const LOG_STYLES: Record<LogLevelName, string> = {
    ERROR: 'color: #ff4444; font-weight: bold',
    WARN: 'color: #ffaa00; font-weight: bold',
    INFO: 'color: #4488ff',
    DEBUG: 'color: #888888',
};

export interface ContextLogger {
    error: (...args: unknown[]) => void;
    warn: (...args: unknown[]) => void;
    info: (...args: unknown[]) => void;
    debug: (...args: unknown[]) => void;
}

class Logger {
    private level: LogLevel;
    private enabled: boolean;
    private readonly hasLocalStorage: boolean;

    constructor() {
        // Check if localStorage is available
        this.hasLocalStorage = typeof localStorage !== 'undefined';

        // Load settings from localStorage or use defaults
        const savedLevel = this.hasLocalStorage ? localStorage.getItem('logLevel') : null;
        this.level = savedLevel !== null ? (parseInt(savedLevel, 10) as LogLevel) : LOG_LEVELS.DEBUG;

        const savedEnabled = this.hasLocalStorage ? localStorage.getItem('loggingEnabled') : null;
        this.enabled = savedEnabled !== null ? savedEnabled === 'true' : true;
    }

    /**
     * Set the log level
     * @param level - One of LOG_LEVELS (ERROR, WARN, INFO, DEBUG)
     */
    setLevel(level: LogLevel): void {
        this.level = level;
        if (this.hasLocalStorage) {
            localStorage.setItem('logLevel', level.toString());
        }
    }

    /**
     * Enable or disable logging
     */
    setEnabled(enabled: boolean): void {
        this.enabled = enabled;
        if (this.hasLocalStorage) {
            localStorage.setItem('loggingEnabled', enabled.toString());
        }
    }

    /**
     * Internal log method
     */
    private _log(level: LogLevel, levelName: LogLevelName, args: unknown[]): void {
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
    error(...args: unknown[]): void {
        this._log(LOG_LEVELS.ERROR, 'ERROR', args);
    }

    /**
     * Log warning message
     */
    warn(...args: unknown[]): void {
        this._log(LOG_LEVELS.WARN, 'WARN', args);
    }

    /**
     * Log info message
     */
    info(...args: unknown[]): void {
        this._log(LOG_LEVELS.INFO, 'INFO', args);
    }

    /**
     * Log debug message
     */
    debug(...args: unknown[]): void {
        this._log(LOG_LEVELS.DEBUG, 'DEBUG', args);
    }

    /**
     * Create a child logger with a specific context
     * @param context - Context name (e.g., 'AI', 'UI', 'Game')
     * @returns Child logger with context
     */
    context(context: string): ContextLogger {
        return {
            error: (...args: unknown[]) => this.error(`[${context}]`, ...args),
            warn: (...args: unknown[]) => this.warn(`[${context}]`, ...args),
            info: (...args: unknown[]) => this.info(`[${context}]`, ...args),
            debug: (...args: unknown[]) => this.debug(`[${context}]`, ...args),
        };
    }
}

// Create singleton instance
export const logger = new Logger();

// For production, you can set:
// logger.setLevel(LOG_LEVELS.WARN);
// or
// logger.setEnabled(false);
