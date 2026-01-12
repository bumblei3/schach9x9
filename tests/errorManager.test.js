import { jest } from '@jest/globals';
import { errorManager } from '../js/utils/ErrorManager.js';
import { notificationUI } from '../js/ui/NotificationUI.js';
import { logger } from '../js/logger.js';

// Use spyOn for notificationUI
jest.spyOn(notificationUI, 'show').mockImplementation(() => {});

// Spy on logger instead of mocking entire module to avoid ESM issues
jest.spyOn(logger, 'error').mockImplementation(() => {});
jest.spyOn(logger, 'warn').mockImplementation(() => {});
jest.spyOn(logger, 'info').mockImplementation(() => {});

describe('ErrorManager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    document.body.innerHTML = `
      <div id="error-overlay">
        <div class="content"></div>
      </div>
    `;
    // Reset initialized state if possible or assume singleton per test
  });

  test('should handle critical errors by showing overlay', () => {
    const error = new Error('Critical Failure');
    errorManager.handleError(error, { critical: true });

    expect(logger.error).toHaveBeenCalled();
    const overlay = document.getElementById('error-overlay');
    expect(overlay.style.display).toBe('flex');
    expect(overlay.style.display).toBe('flex');
    const details = document.getElementById('error-details-content');
    expect(details.textContent).toContain('Critical Failure');
  });

  test('should handle non-critical errors by showing toast', () => {
    const error = new Error('Minor Glitch');
    errorManager.handleError(error, { critical: false });

    expect(logger.error).toHaveBeenCalled();
    expect(notificationUI.show).toHaveBeenCalledWith(
      'Minor Glitch',
      'error',
      expect.stringContaining('Fehler')
    );
  });

  test('should handle warnings by showing toast', () => {
    errorManager.warning('Disk Full');

    expect(logger.warn).toHaveBeenCalled();
    expect(notificationUI.show).toHaveBeenCalledWith(
      'Disk Full',
      'warning',
      expect.stringContaining('Warnung')
    );
  });

  test('should default to "App" context if not provided', () => {
    const error = new Error('Generic Error');
    errorManager.handleError(error);

    expect(logger.error).toHaveBeenCalledWith('[App]', error);
  });

  test('should use provided context', () => {
    const error = new Error('Network Error');
    errorManager.handleError(error, { context: 'Network' });

    expect(logger.error).toHaveBeenCalledWith('[Network]', error);
  });

  test('should use alert fallback if overlay is missing', () => {
    // Remove overlay
    document.body.innerHTML = '';
    const alertSpy = jest.spyOn(window, 'alert').mockImplementation(() => {});

    const error = new Error('Critical No UI');
    errorManager.handleError(error, { critical: true });

    expect(alertSpy).toHaveBeenCalledWith(expect.stringContaining('KRITISCHER FEHLER'));
    expect(alertSpy).toHaveBeenCalledWith(expect.stringContaining('Critical No UI'));

    alertSpy.mockRestore();
  });

  test('should initialize global handlers', () => {
    // Mock window.onerror
    const originalOnError = window.onerror;
    const originalOnUnhandledRejection = window.onunhandledrejection;

    window.onerror = null;
    window.onunhandledrejection = null;

    errorManager.init();

    expect(window.onerror).toBeDefined();
    expect(window.onunhandledrejection).toBeDefined();
    expect(logger.info).toHaveBeenCalledWith('ErrorManager initialized');

    // Test the handlers
    const errorSpy = jest.spyOn(errorManager, 'handleError');

    // Test onerror
    if (window.onerror) {
      // @ts-ignore
      window.onerror('Script Error', 'script.js', 10, 20, new Error('Script Error'));
      expect(errorSpy).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({ context: 'Global' })
      );
    }

    // Test onunhandledrejection
    if (window.onunhandledrejection) {
      const event = {
        type: 'unhandledrejection',
        promise: Promise.resolve(), // Just a dummy promise
        reason: new Error('Async Fail'),
      };

      window.onunhandledrejection(event);
      expect(errorSpy).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({ context: 'Promise' })
      );
    }

    // Cleanup
    window.onerror = originalOnError;
    window.onunhandledrejection = originalOnUnhandledRejection;
  });
});
