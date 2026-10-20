import { describe, expect, test } from 'vitest';
import {
  shouldRegisterServiceWorker,
  type ServiceWorkerEnvironment,
} from '../js/serviceWorkerRegistration.js';

const PROD_BROWSER: ServiceWorkerEnvironment = {
  prod: true,
  hasServiceWorker: true,
  webdriver: false,
  disabledByQuery: false,
};

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
    // Insecure context (plain http on a non-localhost host): registration
    // would throw, so the guard must short-circuit first.
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
