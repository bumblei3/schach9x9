import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
/**
 * Enhanced Tests for Logger System
 */

import { logger, LOG_LEVELS } from '../js/logger.js';

describe('Logger Enhanced', () => {
  let consoleSpy: any;
  let originalLevel: any;
  let originalEnabled: any;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(function () {});
    // Save original state
    originalLevel = (logger as any).level;
    originalEnabled = (logger as any).enabled;

    logger.setEnabled(true);
    logger.setLevel(LOG_LEVELS.DEBUG);
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    // Restore original state
    (logger as any).level = originalLevel;
    (logger as any).enabled = originalEnabled;
  });

  describe('setLevel', () => {
    test('should set log level', () => {
      logger.setLevel(LOG_LEVELS.ERROR);
      expect((logger as any).level).toBe(LOG_LEVELS.ERROR);
    });

    test('should filter debug logs when level is WARN', () => {
      logger.setLevel(LOG_LEVELS.WARN);

      logger.debug('debug message');

      expect(consoleSpy).not.toHaveBeenCalled();
    });

    test('should allow error logs when level is WARN', () => {
      logger.setLevel(LOG_LEVELS.WARN);

      logger.error('error message');

      expect(consoleSpy).toHaveBeenCalled();
    });
  });

  describe('setEnabled', () => {
    test('should disable logging when set to false', () => {
      logger.setEnabled(false);

      logger.error('test');

      expect(consoleSpy).not.toHaveBeenCalled();
    });

    test('should enable logging when set to true', () => {
      logger.setEnabled(true);

      logger.info('test');
      expect(consoleSpy).toHaveBeenCalled();
    });
  });

  describe('log methods', () => {
    test('error should call console.log', () => {
      logger.error('error message');
      expect(consoleSpy).toHaveBeenCalled();
    });

    test('warn should call console.log', () => {
      logger.warn('warn message');
      expect(consoleSpy).toHaveBeenCalled();
    });

    test('info should call console.log', () => {
      logger.info('info message');
      expect(consoleSpy).toHaveBeenCalled();
    });

    test('debug should call console.log', () => {
      logger.debug('debug message');
      expect(consoleSpy).toHaveBeenCalled();
    });
  });

  describe('context', () => {
    test('should create child logger with context', () => {
      const aiLogger = logger.context('AI');

      expect(aiLogger).toBeDefined();
      expect(typeof aiLogger.error).toBe('function');
      expect(typeof aiLogger.warn).toBe('function');
      expect(typeof aiLogger.info).toBe('function');
      expect(typeof aiLogger.debug).toBe('function');
    });

    test('context logger should log messages', () => {
      const uiLogger = logger.context('UI');

      uiLogger.info('test message');

      expect(consoleSpy).toHaveBeenCalled();
    });

    test('context logger respects parent level', () => {
      logger.setLevel(LOG_LEVELS.ERROR);
      const gameLogger = logger.context('Game');

      gameLogger.debug('test');

      expect(consoleSpy).not.toHaveBeenCalled();
    });

    test('context logger respects parent enabled state', () => {
      logger.setEnabled(false);
      const moveLogger = logger.context('Move');

      moveLogger.error('test');

      expect(consoleSpy).not.toHaveBeenCalled();
    });
  });

  describe('LOG_LEVELS constants', () => {
    test('ERROR should be 0', () => {
      expect(LOG_LEVELS.ERROR).toBe(0);
    });

    test('WARN should be 1', () => {
      expect(LOG_LEVELS.WARN).toBe(1);
    });

    test('INFO should be 2', () => {
      expect(LOG_LEVELS.INFO).toBe(2);
    });

    test('DEBUG should be 3', () => {
      expect(LOG_LEVELS.DEBUG).toBe(3);
    });
  });
});
