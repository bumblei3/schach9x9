/**
 * Behaviour of the shipped Service Worker (`public/service-worker.js`).
 *
 * That file is plain JavaScript in `public/`: it is copied verbatim into
 * `dist/` and never bundled, which is why it is not covered by any other test.
 * These tests drive the real artifact with a mocked ServiceWorkerGlobalScope,
 * so the offline strategy that actually ships is the thing under test.
 *
 * Note: `service-worker.ts` at the repo root used to duplicate this logic
 * (without the `activate` cleanup, so the two copies had already drifted).
 * It was dead — never a Vite build input — and has been removed.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

type Handler = (event: any) => void;

interface MockResponse {
  status: number;
  type: string;
  body: string;
  clone: () => MockResponse;
}

function response(body: string, status = 200, type = 'basic'): MockResponse {
  return {
    status,
    type,
    body,
    clone: () => response(body, status, type),
  };
}

interface SwEnv {
  handlers: Map<string, Handler>;
  fetchMock: ReturnType<typeof vi.fn>;
  caches: {
    open: ReturnType<typeof vi.fn>;
    match: ReturnType<typeof vi.fn>;
    keys: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  store: Map<string, MockResponse>;
  load: (event: any) => Promise<MockResponse>;
}

/**
 * Build a ServiceWorkerGlobalScope double and import the real worker file.
 * The worker registers its listeners at module top level, so the doubles must
 * be installed before the dynamic import.
 */
async function loadWorker(): Promise<SwEnv> {
  const handlers = new Map<string, Handler>();
  const store = new Map<string, MockResponse>();

  const cache = {
    put: vi.fn((request: Request, value: MockResponse) => {
      store.set(request.url, value);
      return Promise.resolve();
    }),
    match: vi.fn((request: Request) => Promise.resolve(store.get(request.url))),
  };

  const caches = {
    open: vi.fn(() => Promise.resolve(cache)),
    match: vi.fn((request: Request) => Promise.resolve(store.get(request.url))),
    keys: vi.fn(() => Promise.resolve(['schach9x9-v8', 'schach9x9-v7'])),
    delete: vi.fn((_name: string) => Promise.resolve(true)),
  };

  const fetchMock = vi.fn(() => Promise.resolve(response('fresh')));

  const selfMock = {
    location: { origin: 'https://example.test' },
    addEventListener: vi.fn((type: string, handler: Handler) => {
      handlers.set(type, handler);
    }),
  };

  vi.stubGlobal('self', selfMock);
  vi.stubGlobal('fetch', fetchMock);
  vi.stubGlobal('caches', caches);
  vi.stubGlobal('console', { log: vi.fn(), warn: vi.fn(), error: vi.fn() });

  // Importing runs the top-level addEventListener calls. The specifier is
  // widened on purpose: `public/service-worker.js` has no exports, so TS would
  // otherwise reject it as "not a module".
  await import('../public/service-worker.js' as string);

  const load = async (event: any): Promise<MockResponse> => {
    let resolved: MockResponse | undefined;
    event.respondWith = (value: MockResponse | Promise<MockResponse>) => {
      resolved = value as MockResponse;
    };
    handlers.get('fetch')?.(event);
    return (await resolved) as MockResponse;
  };

  return { handlers, fetchMock, caches, store, load };
}

describe('shipped service-worker.js', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('serves the network response first and caches it (Network-First)', async () => {
    const env = await loadWorker();
    const event = { request: new Request('https://example.test/index.html') };

    const served = await env.load(event);

    expect(served.body).toBe('fresh');
    expect(env.fetchMock).toHaveBeenCalledTimes(1);
    // The successful response is written into the cache for the offline path.
    expect(env.store.get('https://example.test/index.html')?.body).toBe('fresh');
  });

  it('falls back to the cache when the network fails', async () => {
    const env = await loadWorker();
    const url = 'https://example.test/index.html';

    // Prime the cache the way a previous online visit would have.
    env.store.set(url, response('cached'));

    env.fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    const event = { request: new Request(url) };

    const served = await env.load(event);

    expect(served.body).toBe('cached');
  });

  it('returns a 408 when neither network nor cache can answer', async () => {
    const env = await loadWorker();
    env.fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));

    const served = await env.load({
      request: new Request('https://example.test/never-seen.js'),
    });

    expect(served.status).toBe(408);
  });

  it('leaves cross-origin requests alone', async () => {
    const env = await loadWorker();
    let responded = false;
    env.handlers.get('fetch')?.({
      request: new Request('https://fonts.example/font.woff2'),
      respondWith: () => {
        responded = true;
      },
    });

    expect(responded).toBe(false);
    expect(env.fetchMock).not.toHaveBeenCalled();
  });

  it('does not cache non-200 or non-basic responses', async () => {
    const env = await loadWorker();
    env.fetchMock.mockResolvedValueOnce(response('Not Found', 404));

    const served = await env.load({
      request: new Request('https://example.test/missing'),
    });

    expect(served.status).toBe(404);
    expect(env.store.size).toBe(0);
  });

  it('deletes stale caches on activate', async () => {
    const env = await loadWorker();

    let finished = false;
    env.handlers.get('activate')?.({
      waitUntil: (promise: Promise<unknown>) => {
        promise.then(() => {
          finished = true;
        });
      },
    });

    // Allow the deletion promises to settle.
    await vi.waitFor(() => expect(finished).toBe(true));

    expect(env.caches.delete).toHaveBeenCalledTimes(1);
    expect(env.caches.delete).toHaveBeenCalledWith('schach9x9-v7');
  });
});
