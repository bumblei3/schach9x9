import { TextDecoder, TextEncoder } from 'util';
import { vi } from 'vitest';

global.TextDecoder = TextDecoder;
global.TextEncoder = TextEncoder;

// Global Fetch Mock
global.fetch = vi.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({}),
    text: () => Promise.resolve(''),
  } as Response)
);

// Global Worker Mock removed to avoid conflict with specific test mocks
// Tests that need Worker should mock it individually or use a shared mock helper

// Global Window Mocks
global.alert = vi.fn();
global.confirm = vi.fn(() => true);

// jsdom lacks window.matchMedia; UI code (ShopUI bottom-sheet, DOMHandler
// responsive checks) calls it. Provide a no-op that reports "not matched"
// so tests run in a desktop-like context without crashing.
if (!window.matchMedia) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

// localStorage must be an in-memory mock in every environment, not just when
// the global happens to be undefined.
//
// Node >= 22 exposes an experimental `localStorage` on globalThis as an
// accessor: in the jsdom test environment `typeof localStorage === 'object'`
// even though plain Node reports `undefined`. Depending on the host made this
// suite environment-dependent in two ways:
//   1. a `typeof localStorage === 'undefined'` guard skipped the mock, so
//      js/storage.ts talked to a real (throwing) storage instead of the
//      in-memory one, and
//   2. `vi.spyOn(localStorage, 'setItem')` recorded 0 calls, because every
//      `localStorage` access goes through the getter and yields a fresh
//      object, so the spied function was never the one being called.
//
// Define the mock unconditionally (the property is configurable, so this
// replaces Node's accessor) and make it a vi.fn() so tests can still spy.
const storage = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', {
  value: {
    getItem: vi.fn((key: string) => storage.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => void storage.set(key, String(value))),
    removeItem: vi.fn((key: string) => void storage.delete(key)),
    clear: vi.fn(() => storage.clear()),
    key: vi.fn((index: number) => [...storage.keys()][index] ?? null),
    get length() {
      return storage.size;
    },
  },
  writable: true,
  configurable: true,
});
