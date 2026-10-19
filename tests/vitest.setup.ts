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

// jsdom in this Vitest version lacks localStorage; many UI modules
// (BoardRenderer skin, SoundManager, GameController save/load) call it.
// Provide an in-memory mock so tests don't crash with
// "Cannot read properties of undefined (reading 'getItem')".
// Use vi.fn() so tests can spy on setItem/getItem calls.
if (typeof localStorage === 'undefined') {
  const storage = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', {
    value: {
      getItem: vi.fn((key: string) => storage.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => void storage.set(key, String(value))),
      removeItem: vi.fn((key: string) => void storage.delete(key)),
      clear: vi.fn(() => storage.clear()),
      key: vi.fn((index: number) => [...storage.keys()][index] ?? null),
      get length() { return storage.size; },
    },
    writable: true,
    configurable: true,
  });
}
