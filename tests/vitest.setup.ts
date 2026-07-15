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
