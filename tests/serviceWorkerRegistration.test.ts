import { afterEach, describe, expect, test, vi } from 'vitest';
import {
  registerServiceWorker,
  shouldRegisterServiceWorker,
  type ServiceWorkerEnvironment,
} from '../js/serviceWorkerRegistration.js';

const PROD_BROWSER: ServiceWorkerEnvironment = {
  prod: true,
  hasServiceWorker: true,
  webdriver: false,
  disabledByQuery: false,
};

/** Replace `navigator` with just the two members the module reads. */
function stubNavigator(options: { webdriver?: boolean; register?: () => Promise<unknown> }): void {
  vi.stubGlobal('navigator', {
    webdriver: options.webdriver ?? false,
    serviceWorker: { register: options.register ?? vi.fn() },
  });
}

/** Capture the `load` handler the module registers on `window`. */
function captureLoadHandler(): Array<() => void> {
  const handlers: Array<() => void> = [];
  vi.spyOn(window, 'addEventListener').mockImplementation((type: string, cb: unknown) => {
    if (type === 'load') handlers.push(cb as () => void);
  });
  return handlers;
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('shouldRegisterServiceWorker', () => {
  test('registers in a production build in a real browser', () => {
    expect(shouldRegisterServiceWorker(PROD_BROWSER)).toBe(true);
  });

  test('never registers in the Vite dev server', () => {
    // The dev server serves unbundled, changing modules; a worker here would
    // cache them and go stale on every reload.
    expect(shouldRegisterServiceWorker({ ...PROD_BROWSER, prod: false })).toBe(false);
  });

  test('never registers when the browser has no ServiceWorker API', () => {
    // Insecure context (plain http on a non-localhost host): registration would
    // throw, so the guard must short-circuit first.
    expect(shouldRegisterServiceWorker({ ...PROD_BROWSER, hasServiceWorker: false })).toBe(false);
  });

  test('never registers in an automation context', () => {
    // Playwright and Lighthouse drive the browser via WebDriver. This is the
    // guard that replaces the old "comment it out so E2E stays quiet" state.
    expect(shouldRegisterServiceWorker({ ...PROD_BROWSER, webdriver: true })).toBe(false);
  });

  test('never registers when the URL carries ?disable-sw', () => {
    expect(shouldRegisterServiceWorker({ ...PROD_BROWSER, disabledByQuery: true })).toBe(false);
  });

  test('is a conjunction: any single veto is enough', () => {
    const vetoes: Array<Partial<ServiceWorkerEnvironment>> = [
      { prod: false },
      { hasServiceWorker: false },
      { webdriver: true },
      { disabledByQuery: true },
    ];
    for (const veto of vetoes) {
      expect(shouldRegisterServiceWorker({ ...PROD_BROWSER, ...veto })).toBe(false);
    }
  });
});

describe('registerServiceWorker', () => {
  test('registers on load in a production build', async () => {
    const register = vi.fn(() => Promise.resolve({} as ServiceWorkerRegistration));
    stubNavigator({ register });
    const handlers = captureLoadHandler();

    registerServiceWorker(PROD_BROWSER);

    expect(handlers).toHaveLength(1);
    handlers[0]();
    await vi.waitFor(() => expect(register).toHaveBeenCalledWith('service-worker.js'));
  });

  test('registers nothing when any veto applies', () => {
    const register = vi.fn();
    stubNavigator({ register });
    const addEventListener = vi.spyOn(window, 'addEventListener').mockImplementation(() => {});

    const vetoes: Array<Partial<ServiceWorkerEnvironment>> = [
      { prod: false },
      { hasServiceWorker: false },
      { webdriver: true },
      { disabledByQuery: true },
    ];
    for (const veto of vetoes) {
      registerServiceWorker({ ...PROD_BROWSER, ...veto });
    }

    expect(addEventListener).not.toHaveBeenCalled();
    expect(register).not.toHaveBeenCalled();
  });

  test('reads environment from globals when no env is passed (dev build is a no-op)', () => {
    const register = vi.fn();
    stubNavigator({ register });
    const addEventListener = vi.spyOn(window, 'addEventListener').mockImplementation(() => {});

    // No explicit env → readServiceWorkerEnvironment() runs with import.meta.env.PROD
    // (false under Vitest), so registration is skipped without touching the DOM.
    registerServiceWorker();

    expect(addEventListener).not.toHaveBeenCalled();
    expect(register).not.toHaveBeenCalled();
  });

  test('logs a warning and stays alive when registration fails', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    stubNavigator({ register: vi.fn(() => Promise.reject(new Error('no service worker'))) });
    const handlers = captureLoadHandler();

    registerServiceWorker(PROD_BROWSER);
    handlers[0]();

    await vi.waitFor(() => expect(warn).toHaveBeenCalled());
  });

  test('does nothing when navigator has no serviceWorker support', () => {
    vi.stubGlobal('navigator', { webdriver: false });
    const addEventListener = vi.spyOn(window, 'addEventListener').mockImplementation(() => {});

    registerServiceWorker(PROD_BROWSER);

    expect(addEventListener).not.toHaveBeenCalled();
  });
});
