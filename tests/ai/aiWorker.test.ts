/**
 * Focused tests for js/ai/aiWorker.ts — the AI Web Worker message protocol.
 *
 * aiWorker had only 40 % function coverage — the three self.onmessage handler
 * closures were never exercised. The worker is normally instantiated by the
 * browser, but its protocol is pure: it registers a single async onmessage
 * handler that dispatches on `type` and posts results back via
 * workerSelf.postMessage. We stub `self` (capturing postMessage), auto-mock
 * the aiEngine entry points, and drive each message type directly — locking
 * the whole protocol without a real Worker.
 */

import { describe, test, expect, vi, beforeEach } from 'vitest';

// Capture postMessage calls and remember the registered handler.
const posted: any[] = [];
const workerStub: any = {
  onmessage: null as ((e: { data: any }) => Promise<void>) | null,
  postMessage: (msg: any) => {
    posted.push(msg);
  },
};
vi.stubGlobal('self', workerStub);
// Run the heartbeat callback once so the in-handler closures are exercised.
vi.stubGlobal('setInterval', (cb: () => void) => {
  cb();
  return 0 as unknown as ReturnType<typeof setInterval>;
});
vi.stubGlobal('clearInterval', () => {});

// Auto-mock aiEngine; the namespace import below resolves to the mocked module
// (vitest hoists vi.mock above imports), so we can configure return values.
vi.mock('../../js/aiEngine.js');
import * as aiEngine from '../../js/aiEngine.js';

// NOTE: config.js is intentionally NOT mocked — it only holds constants and
// harmless setters, and aiEngine.js imports many of its symbols at load time;
// a partial mock would crash the aiEngine import.
vi.mock('../../js/logger.js', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

// Importing the worker registers self.onmessage on our stub.
await import('../../js/ai/aiWorker.js');

function send(type: string, data: any, id = 'req-1') {
  return workerStub.onmessage!({ data: { type, data, id } });
}

beforeEach(() => {
  posted.length = 0;
  vi.clearAllMocks();
  // Re-arm default resolved values after clearAllMocks.
  // The aiEngine namespace import resolves to the auto-mock; cast to any so the
  // vitest mock helpers (mockResolvedValue etc.) type-check against tsc.
  const ai = aiEngine as any;
  ai.getBestMoveDetailed.mockResolvedValue({
    bestMove: { from: { r: 0, c: 0 }, to: { r: 1, c: 1 } },
    score: 123,
  });
  ai.evaluatePosition.mockResolvedValue(42);
  ai.getTopMoves.mockResolvedValue([{ from: { r: 0, c: 0 }, to: { r: 1, c: 1 }, score: 1 }]);
  ai.analyzePosition.mockReturnValue({ summary: 'ok' });
  // Exercise the progress callbacks registered inside the handlers.
  ai.setProgressCallback.mockImplementation((cb: (p: any) => void) => {
    cb({ depth: 1, score: 0 });
  });
});

describe('aiWorker protocol', () => {
  test('loadBook with valid book data does not warn', async () => {
    const logger = (await import('../../js/logger.js')).logger;
    await send('loadBook', { book: { metadata: { name: 'test' } } });
    expect(logger.warn).not.toHaveBeenCalled();
  });

  test('loadBook without book data logs a warning and does nothing', async () => {
    const logger = (await import('../../js/logger.js')).logger;
    await send('loadBook', null);
    expect(logger.warn).toHaveBeenCalled();
  });

  test('setBoardShape processes without throwing', async () => {
    await expect(send('setBoardShape', { shape: 'cross' as any })).resolves.toBeUndefined();
  });

  test('evaluatePosition posts the computed score', async () => {
    await send('evaluatePosition', { board: [], forColor: 'white' });
    expect(aiEngine.evaluatePosition).toHaveBeenCalledWith([], 'white');
    expect(posted.some(m => m.type === 'positionScore' && m.data === 42)).toBe(true);
  });

  test('getBestMove posts a bestMove result from the engine', async () => {
    await send('getBestMove', {
      board: [],
      color: 'white',
      depth: 3,
      config: { personality: 'NORMAL' },
      personality: 'NORMAL',
      moveNumber: 1,
    });
    expect(aiEngine.getBestMoveDetailed).toHaveBeenCalled();
    const best = posted.find(m => m.type === 'bestMove');
    expect(best).toBeDefined();
    expect(best.id).toBe('req-1');
    expect(best.data.bestMove).toEqual({ from: { r: 0, c: 0 }, to: { r: 1, c: 1 } });
  });

  test('getBestMove posts null on engine failure', async () => {
    (aiEngine as any).getBestMoveDetailed.mockRejectedValueOnce(new Error('boom'));
    const logger = (await import('../../js/logger.js')).logger;
    await send('getBestMove', { board: [], color: 'white', depth: 1 });
    expect(logger.error).toHaveBeenCalled();
    const best = posted.find(m => m.type === 'bestMove');
    expect(best.data).toBeNull();
  });

  test('getTopMoves posts top moves from the engine', async () => {
    await send('getTopMoves', { board: [], color: 'white', count: 1, depth: 2 });
    expect(aiEngine.getTopMoves).toHaveBeenCalled();
    expect(posted.some(m => m.type === 'topMoves')).toBe(true);
  });

  test('getTopMoves posts empty array on failure', async () => {
    (aiEngine as any).getTopMoves.mockRejectedValueOnce(new Error('boom'));
    await send('getTopMoves', { board: [], color: 'white', count: 1, depth: 2 });
    const top = posted.find(m => m.type === 'topMoves');
    expect(top.data).toEqual([]);
  });

  test('analyze posts the analysis result', async () => {
    await send('analyze', { board: [], color: 'white' });
    expect(aiEngine.analyzePosition).toHaveBeenCalledWith([], 'white');
    const analysis = posted.find(m => m.type === 'analysis');
    expect(analysis).toBeDefined();
    expect(analysis.data).toEqual({ summary: 'ok' });
  });

  test('search posts a bestMove result (legacy shape, spread into message)', async () => {
    await send('search', { board: [], color: 'white', depth: 2, personality: 'NORMAL' });
    expect(aiEngine.getBestMoveDetailed).toHaveBeenCalled();
    const best = posted.find(m => m.type === 'bestMove');
    expect(best).toBeDefined();
  });

  test('unknown message type logs a warning', async () => {
    const logger = (await import('../../js/logger.js')).logger;
    await send('definitely-not-a-real-type', {});
    expect(logger.warn).toHaveBeenCalled();
  });
});
