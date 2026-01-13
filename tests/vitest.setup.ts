import { TextDecoder, TextEncoder } from 'util';
import { vi } from 'vitest';

global.TextDecoder = TextDecoder as any;
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
