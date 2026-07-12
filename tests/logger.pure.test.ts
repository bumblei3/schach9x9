import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { logger, LOG_LEVELS } from '../js/logger.js';

describe('logger — level / enabled filtering', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    logger.setEnabled(true);
    logger.setLevel(LOG_LEVELS.DEBUG);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('DEBUG level logs everything', () => {
    logger.debug('dbg');
    logger.info('inf');
    logger.warn('wrn');
    logger.error('err');
    expect(console.log).toHaveBeenCalledTimes(4);
  });

  test('ERROR level suppresses everything below ERROR', () => {
    logger.setLevel(LOG_LEVELS.ERROR);
    logger.debug('dbg');
    logger.info('inf');
    logger.warn('wrn');
    logger.error('err');
    expect(console.log).toHaveBeenCalledTimes(1);
  });

  test('disabled logger emits nothing at any level', () => {
    logger.setEnabled(false);
    logger.setLevel(LOG_LEVELS.DEBUG);
    logger.error('err');
    logger.debug('dbg');
    expect(console.log).not.toHaveBeenCalled();
  });

  test('INFO level logs info/warn/error but not debug', () => {
    logger.setLevel(LOG_LEVELS.INFO);
    logger.debug('dbg');
    logger.info('inf');
    logger.warn('wrn');
    logger.error('err');
    expect(console.log).toHaveBeenCalledTimes(3);
  });

  test('WARN level logs warn/error but not info/debug', () => {
    logger.setLevel(LOG_LEVELS.WARN);
    logger.debug('dbg');
    logger.info('inf');
    logger.warn('wrn');
    logger.error('err');
    expect(console.log).toHaveBeenCalledTimes(2);
  });

  test('log output includes the level prefix and styled args', () => {
    logger.error('boom');
    const [prefix, style, ...rest] = (console.log as any).mock.calls[0];
    expect(prefix).toContain('[ERROR]');
    expect(style).toBe('color: #ff4444; font-weight: bold');
    expect(rest).toEqual(['boom']);
  });
});

describe('logger.context — child loggers', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    logger.setEnabled(true);
    logger.setLevel(LOG_LEVELS.DEBUG);
  });
  afterEach(() => vi.restoreAllMocks());

  test('prefixes messages with the context tag', () => {
    const child = logger.context('AI');
    child.error('failed');
    child.debug('thinking');
    const errCall = (console.log as any).mock.calls[0];
    const dbgCall = (console.log as any).mock.calls[1];
    expect(errCall[2]).toBe('[AI]');
    expect(errCall[3]).toBe('failed');
    expect(dbgCall[2]).toBe('[AI]');
    expect(dbgCall[3]).toBe('thinking');
  });

  test('child logger honors the level filter of the parent', () => {
    logger.setLevel(LOG_LEVELS.WARN);
    const child = logger.context('UI');
    child.debug('hidden');
    child.warn('shown');
    expect(console.log).toHaveBeenCalledTimes(1);
    expect((console.log as any).mock.calls[0][3]).toBe('shown');
  });
});

describe('logger — localStorage persistence', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  test('setLevel writes to localStorage when available', async () => {
    const store: Record<string, string> = {};
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => (k in store ? store[k] : null),
      setItem: (k: string, v: string) => {
        store[k] = v;
      },
      removeItem: (k: string) => {
        delete store[k];
      },
    });
    vi.resetModules();
    const mod = await import('../js/logger.js');
    mod.logger.setLevel(LOG_LEVELS.WARN);
    expect(store['logLevel']).toBe(String(LOG_LEVELS.WARN));
  });

  test('setEnabled writes to localStorage when available', async () => {
    const store: Record<string, string> = {};
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => (k in store ? store[k] : null),
      setItem: (k: string, v: string) => {
        store[k] = v;
      },
      removeItem: (k: string) => {
        delete store[k];
      },
    });
    vi.resetModules();
    const mod = await import('../js/logger.js');
    mod.logger.setEnabled(false);
    expect(store['loggingEnabled']).toBe('false');
  });

  test('does not throw when localStorage is unavailable (SSR/no-DOM)', async () => {
    vi.stubGlobal('localStorage', undefined);
    vi.resetModules();
    expect(() => import('../js/logger.js')).not.toThrow();
    const mod = await import('../js/logger.js');
    // These must not touch localStorage
    expect(() => mod.logger.setLevel(LOG_LEVELS.ERROR)).not.toThrow();
    expect(() => mod.logger.setEnabled(false)).not.toThrow();
  });
});
