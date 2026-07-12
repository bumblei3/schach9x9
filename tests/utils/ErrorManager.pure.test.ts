import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';

// Stub the two external dependencies so ErrorManager can be exercised as pure logic.
vi.mock('../../js/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    context: () => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn() }),
  },
}));

vi.mock('../../js/ui/NotificationUI.js', () => ({
  notificationUI: {
    show: vi.fn(),
  },
}));

const { errorManager } = await import('../../js/utils/ErrorManager.js');
const { notificationUI } = await import('../../js/ui/NotificationUI.js');
const loggerMod = await import('../../js/logger.js');

describe('ErrorManager.handleError', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.body.innerHTML = '';
  });

  test('logs and shows a toast for a non-critical Error', () => {
    errorManager.handleError(new Error('boom'), { context: 'Test' });
    expect((notificationUI as any).show).toHaveBeenCalledWith('boom', 'error', 'Fehler (Test)');
    expect((loggerMod as any).logger.error).toHaveBeenCalled();
  });

  test('stringifies non-Error values for the toast', () => {
    errorManager.handleError('a plain string failure', { context: 'App' });
    expect((notificationUI as any).show).toHaveBeenCalledWith(
      'a plain string failure',
      'error',
      'Fehler (App)'
    );
  });

  test('routes critical errors to showCriticalError (no toast)', () => {
    // No overlay -> showCriticalError falls back to alert
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    errorManager.handleError(new Error('critical fail'), { context: 'Core', critical: true });
    expect(alertSpy).toHaveBeenCalled();
    expect((notificationUI as any).show).not.toHaveBeenCalled();
    alertSpy.mockRestore();
  });

  test('defaults context to "App" when omitted', () => {
    errorManager.handleError(new Error('x'));
    expect((notificationUI as any).show).toHaveBeenCalledWith('x', 'error', 'Fehler (App)');
  });
});

describe('ErrorManager.warning', () => {
  beforeEach(() => vi.clearAllMocks());

  test('logs a warning and shows a warning toast', () => {
    errorManager.warning('careful now', 'Load');
    expect((loggerMod as any).logger.warn).toHaveBeenCalled();
    expect((notificationUI as any).show).toHaveBeenCalledWith(
      'careful now',
      'warning',
      'Warnung (Load)'
    );
  });

  test('defaults the context to "App"', () => {
    errorManager.warning('default ctx');
    expect((notificationUI as any).show).toHaveBeenCalledWith(
      'default ctx',
      'warning',
      'Warnung (App)'
    );
  });
});

describe('ErrorManager.showCriticalError — DOM overlay branches', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.body.innerHTML = '';
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  test('falls back to alert when the #error-overlay element is missing', () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    errorManager.showCriticalError(new Error('no overlay'));
    expect(alertSpy).toHaveBeenCalledWith(expect.stringContaining('KRITISCHER FEHLER'));
    alertSpy.mockRestore();
  });

  test('renders the critical-error content when overlay + container exist', () => {
    document.body.innerHTML = `
      <div id="error-overlay" class="hidden">
        <div></div>
      </div>`;
    errorManager.showCriticalError(new Error('kaboom'));
    const content = document.querySelector('.critical-error-content');
    expect(content).not.toBeNull();
    const details = document.getElementById('error-details-content');
    expect(details!.textContent).toContain('kaboom');
    expect(document.getElementById('error-overlay')!.classList.contains('hidden')).toBe(false);
  });

  test('re-injects content into the container (innerHTML replaces existing markup)', () => {
    document.body.innerHTML = `
      <div id="error-overlay" class="hidden">
        <div><div class="critical-error-content">existing</div></div>
      </div>`;
    errorManager.showCriticalError(new Error('kaboom'));
    const content = document.querySelector('.critical-error-content');
    // The container's innerHTML is replaced by the standard template, so the
    // old "existing" text is gone and the standard heading is present.
    expect(content).not.toBeNull();
    expect(content!.textContent).toContain('Kritischer Fehler');
    expect(content!.textContent).not.toContain('existing');
  });

  test('returns early when the overlay has no inner <div> container', () => {
    document.body.innerHTML = '<div id="error-overlay" class="hidden"></div>';
    // Should not throw even though querySelector('div') is null
    expect(() => errorManager.showCriticalError(new Error('x'))).not.toThrow();
  });

  test('renders "Unbekannter Fehler" for non-Error critical failures', () => {
    document.body.innerHTML = `
      <div id="error-overlay" class="hidden">
        <div></div>
      </div>`;
    errorManager.showCriticalError('plain critical string');
    const details = document.getElementById('error-details-content');
    // showCriticalError uses a fixed fallback message for non-Error values
    expect(details!.textContent).toContain('Unbekannter Fehler');
  });
});

describe('ErrorManager.init', () => {
  test('installs global handlers without throwing (idempotent)', () => {
    // init guards on `initialized`, so calling twice is safe
    expect(() => {
      errorManager.init();
      errorManager.init();
    }).not.toThrow();
    // handlers were wired (best-effort: ensure the global hooks are functions)
    expect(typeof (window as any).onerror).toBe('function');
    expect(typeof (window as any).onunhandledrejection).toBe('function');
  });
});
