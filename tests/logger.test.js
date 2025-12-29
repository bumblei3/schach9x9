import { jest } from '@jest/globals';
import { logger, LOG_LEVELS } from '../js/logger.js';

// Mock console
const originalConsole = global.console;
global.console = {
  ...originalConsole,
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};

describe('Logger', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    logger.setEnabled(true);
    logger.setLevel(LOG_LEVELS.DEBUG);
  });

  describe('basic logging', () => {
    test('should log info messages', () => {
      logger.info('Test info message');
      expect(console.log).toHaveBeenCalled();
      const call = console.log.mock.calls[0][0];
      expect(call).toContain('[INFO]');
    });

    test('should log debug messages', () => {
      logger.debug('Test debug message');
      expect(console.log).toHaveBeenCalled();
      const call = console.log.mock.calls[0][0];
      expect(call).toContain('[DEBUG]');
    });

    test('should log warning messages', () => {
      logger.warn('Test warning');
      expect(console.log).toHaveBeenCalled();
      const call = console.log.mock.calls[0][0];
      expect(call).toContain('[WARN]');
    });

    test('should log error messages', () => {
      logger.error('Test error');
      expect(console.log).toHaveBeenCalled();
      const call = console.log.mock.calls[0][0];
      expect(call).toContain('[ERROR]');
    });

    test('should pass multiple arguments to log methods', () => {
      logger.info('Message', { key: 'value' }, 123);
      expect(console.log).toHaveBeenCalled();
      const calls = console.log.mock.calls[0];
      expect(calls.length).toBeGreaterThan(2); // style + message + args
    });
  });

  describe('log level settings', () => {
    test('should respect log level settings', () => {
      logger.setLevel(LOG_LEVELS.ERROR);
      logger.info('This should not log');
      logger.error('This should log');

      // Only one call should be made (the error)
      expect(console.log).toHaveBeenCalledTimes(1);
      const call = console.log.mock.calls[0][0];
      expect(call).toContain('[ERROR]');
    });

    test('should log at ERROR level only errors', () => {
      logger.setLevel(LOG_LEVELS.ERROR);
      logger.debug('No');
      logger.info('No');
      logger.warn('No');
      logger.error('Yes');

      expect(console.log).toHaveBeenCalledTimes(1);
    });

    test('should log at WARN level warnings and errors', () => {
      logger.setLevel(LOG_LEVELS.WARN);
      logger.debug('No');
      logger.info('No');
      logger.warn('Yes1');
      logger.error('Yes2');

      expect(console.log).toHaveBeenCalledTimes(2);
    });

    test('should log at INFO level info, warnings, and errors', () => {
      logger.setLevel(LOG_LEVELS.INFO);
      logger.debug('No');
      logger.info('Yes1');
      logger.warn('Yes2');
      logger.error('Yes3');

      expect(console.log).toHaveBeenCalledTimes(3);
    });

    test('should log at DEBUG level all messages', () => {
      logger.setLevel(LOG_LEVELS.DEBUG);
      logger.debug('Yes1');
      logger.info('Yes2');
      logger.warn('Yes3');
      logger.error('Yes4');

      expect(console.log).toHaveBeenCalledTimes(4);
    });
  });

  describe('enable/disable logging', () => {
    test('should enable and disable logging', () => {
      logger.setEnabled(false);
      logger.info('Should not log');
      expect(console.log).not.toHaveBeenCalled();

      logger.setEnabled(true);
      logger.info('Should log');
      expect(console.log).toHaveBeenCalled();
    });

    test('should not log when disabled regardless of level', () => {
      logger.setEnabled(false);
      logger.error('Should not log even error');
      logger.warn('Should not log warn');
      logger.info('Should not log info');
      logger.debug('Should not log debug');

      expect(console.log).not.toHaveBeenCalled();
    });
  });

  describe('context logger', () => {
    test('should create context logger', () => {
      const contextLogger = logger.context('TestModule');
      contextLogger.info('Test from context');
      expect(console.log).toHaveBeenCalled();
      const call = console.log.mock.calls[0];
      expect(call[2]).toBe('[TestModule]');
    });

    test('should create context logger for all log levels', () => {
      const contextLogger = logger.context('AI');

      contextLogger.debug('Debug msg');
      expect(console.log.mock.calls[0][2]).toBe('[AI]');

      contextLogger.info('Info msg');
      expect(console.log.mock.calls[1][2]).toBe('[AI]');

      contextLogger.warn('Warn msg');
      expect(console.log.mock.calls[2][2]).toBe('[AI]');

      contextLogger.error('Error msg');
      expect(console.log.mock.calls[3][2]).toBe('[AI]');
    });

    test('should pass additional arguments through context logger', () => {
      const contextLogger = logger.context('Game');
      contextLogger.info('Message', { data: 'value' }, 456);

      const calls = console.log.mock.calls[0];
      expect(calls[2]).toBe('[Game]');
      expect(calls[3]).toBe('Message');
      expect(calls[4]).toEqual({ data: 'value' });
      expect(calls[5]).toBe(456);
    });

    test('should respect enabled/disabled state in context logger', () => {
      logger.setEnabled(false);
      const contextLogger = logger.context('UI');
      contextLogger.info('Should not log');

      expect(console.log).not.toHaveBeenCalled();
    });

    test('should respect log level in context logger', () => {
      logger.setLevel(LOG_LEVELS.ERROR);
      const contextLogger = logger.context('Test');

      contextLogger.debug('No');
      contextLogger.info('No');
      contextLogger.warn('No');
      contextLogger.error('Yes');

      expect(console.log).toHaveBeenCalledTimes(1);
    });
  });

  describe('timestamp formatting', () => {
    test('should format timestamps correctly', () => {
      logger.info('Test with timestamp');
      const call = console.log.mock.calls[0][0];
      expect(call).toMatch(/\d{2}:\d{2}:\d{2}\.\d{3}/); // HH:MM:SS.mmm format
    });

    test('should include timestamp in all log levels', () => {
      logger.debug('Debug');
      logger.info('Info');
      logger.warn('Warn');
      logger.error('Error');

      for (let i = 0; i < 4; i++) {
        const call = console.log.mock.calls[i][0];
        expect(call).toMatch(/\d{2}:\d{2}:\d{2}\.\d{3}/);
      }
    });
  });

  describe('localStorage integration', () => {
    test('should handle missing localStorage gracefully', () => {
      // Logger is already initialized, so we test that it doesn't crash
      logger.setLevel(LOG_LEVELS.INFO);
      logger.setEnabled(true);

      // Should still work even if localStorage is not available
      logger.info('Test message');
      expect(console.log).toHaveBeenCalled();
    });

    test('should persist log level setting', () => {
      if (typeof localStorage !== 'undefined') {
        logger.setLevel(LOG_LEVELS.WARN);
        // In a real scenario, localStorage would persist this
        // We're just testing the method doesn't crash
        expect(logger.level).toBe(LOG_LEVELS.WARN);
      }
    });

    test('should persist enabled setting', () => {
      if (typeof localStorage !== 'undefined') {
        logger.setEnabled(false);
        // In a real scenario, localStorage would persist this
        // We're just testing the method doesn't crash
        expect(logger.enabled).toBe(false);
      }
    });
  });
});
