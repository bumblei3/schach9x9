import { describe, expect, test, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { getBestMoveDetailed } from '../js/aiEngine.js';
import { logger } from '../js/logger.js';

// Mock Worker class
class MockWorker {
  scriptUrl: string | URL;
  onmessage: ((ev: MessageEvent) => any) | null = null;

  constructor(scriptUrl: string | URL) {
    this.scriptUrl = scriptUrl;
    this.postMessage = this.postMessage.bind(this);
  }

  postMessage(data: any) {
    // Simulate async worker response
    setTimeout(() => {
      if (data.type === 'SEARCH' || data.type === 'getBestMove') {
        const { id } = data;
        // Return dummy result
        if (this.onmessage) {
          this.onmessage({
            data: {
              type: 'SEARCH_RESULT',
              id,
              payload: {
                move: { from: 1, to: 2, promotion: 0 },
                score: 100,
                nodes: 50,
              },
            },
          } as MessageEvent);
        }
      }
    }, 10);
  }

  terminate() { }
  addEventListener() { }
  removeEventListener() { }
  dispatchEvent() { return true; }
  onerror = null;
  onmessageerror = null;
}

describe('AI Engine Worker Integration', () => {
  let originalWorker: any;
  let originalWindow: any;
  let uiBoard: any[][];

  beforeAll(() => {
    originalWorker = (global as any).Worker;
    originalWindow = (global as any).window;
    (global as any).Worker = MockWorker;
    (global as any).window = {}; // Mock window existence

    // Silence logs
    vi.spyOn(logger, 'info').mockImplementation(function () { });
    vi.spyOn(logger, 'debug').mockImplementation(function () { });
  });

  afterAll(() => {
    (global as any).Worker = originalWorker;
    (global as any).window = originalWindow;
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    uiBoard = Array(9)
      .fill(null)
      .map(() => Array(9).fill(null));
  });

  test('should use Worker when available', async () => {
    const result = await getBestMoveDetailed(uiBoard as any, 'white', 1, {} as any);
    expect(result).toBeDefined();
    expect(result!.score).toBe(100);
    // The move comes from our mock, confirming worker was used
    expect(result!.move).toEqual({
      from: { r: 0, c: 1 }, // 1 -> row 0 col 1
      to: { r: 0, c: 2 }, // 2 -> row 0 col 2
      promotion: undefined,
    });
  });
});
