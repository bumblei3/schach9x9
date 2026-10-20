/**
 * Service Worker registration (PWA / offline).
 *
 * `public/service-worker.js` ships to `dist/` and the manifest is linked from
 * `index.html`, but the registration call was commented out in `main.ts`
 * ("DISABLED in E2E to avoid interference"). The shipped app therefore never
 * activated the worker, and the "PWA/Offline-fähig" claim in `STATUS.md` was
 * not true — offline play only worked if the browser happened to have a cache
 * from a previous visit of a *different* build.
 *
 * The guards below restore registration without reintroducing the E2E
 * interference that got it commented out in the first place:
 *
 *  - `PROD`: never register in the Vite dev server, where the worker would
 *    cache dev assets and go stale on every reload.
 *  - `?disable-sw`: explicit escape hatch, same switch the commented code used.
 *  - `navigator.webdriver`: Playwright and Lighthouse both drive the browser
 *    through WebDriver, so this is `true` in every CI browser context.
 *    Registering there is exactly what caused the original interference, and
 *    it is the reason this guard exists rather than a URL flag E2E would have
 *    to opt into.
 */

export interface ServiceWorkerEnvironment {
  /** True in a production build (`vite build`), false in `vite dev`. */
  prod: boolean;
  /** `navigator.serviceWorker` is available (secure context). */
  hasServiceWorker: boolean;
  /** Browser is driven by an automation tool (Playwright, Lighthouse). */
  webdriver: boolean;
  /** `?disable-sw` is present in the URL. */
  disabledByQuery: boolean;
}

/** Read the registration environment. Separated so the predicate is testable. */
export function readServiceWorkerEnvironment(): ServiceWorkerEnvironment {
  const search = typeof window !== 'undefined' ? window.location.search : '';
  const nav = typeof navigator !== 'undefined' ? navigator : undefined;

  return {
    prod: import.meta.env.PROD,
    hasServiceWorker: nav !== undefined && 'serviceWorker' in nav,
    webdriver: nav !== undefined && nav.webdriver === true,
    disabledByQuery: search.includes('disable-sw'),
  };
}

/** Whether the service worker should be registered in this environment. */
export function shouldRegisterServiceWorker(env: ServiceWorkerEnvironment): boolean {
  if (!env.prod) return false;
  if (!env.hasServiceWorker) return false;
  if (env.webdriver) return false;
  if (env.disabledByQuery) return false;
  return true;
}

/**
 * Register the service worker.
 *
 * No-op unless `shouldRegisterServiceWorker()` passes, so callers can invoke
 * this unconditionally at startup.
 */
export function registerServiceWorker(): void {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return;
  if (!('serviceWorker' in navigator)) return;
  if (!shouldRegisterServiceWorker(readServiceWorkerEnvironment())) return;

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('service-worker.js').catch((err: unknown) => {
      console.warn('[SW] Registrierung fehlgeschlagen:', err);
    });
  });
}
