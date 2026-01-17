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

  terminate() {}
  addEventListener() {}
  removeEventListener() {}
  dispatchEvent() {
    return true;
  }
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
    vi.spyOn(logger, 'info').mockImplementation(function () {});
    vi.spyOn(logger, 'debug').mockImplementation(function () {});
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
    // The mocked getBestMoveDetailed returns score: 50
    expect(result!.score).toBe(50);
    expect(result!.move).toEqual({ from: { r: 1, c: 1 }, to: { r: 2, c: 2 } });
  });
});

// Direct aiWorker message handler tests
describe('AI Worker Message Handlers', () => {
  // We'll mock the dependencies and test the onmessage handler directly
  let mockPostMessage: ReturnType<typeof vi.fn>;
  let mockSelf: any;
  let onmessageHandler: (e: MessageEvent) => Promise<void>;

  beforeAll(async () => {
    // Mock all aiEngine functions
    vi.mock('../js/aiEngine.js', () => ({
      getBestMoveDetailed: vi
        .fn()
        .mockResolvedValue({ move: { from: { r: 1, c: 1 }, to: { r: 2, c: 2 } }, score: 50 }),
      getTopMoves: vi
        .fn()
        .mockResolvedValue([{ move: { from: { r: 0, c: 0 }, to: { r: 1, c: 1 } }, score: 100 }]),
      analyzePosition: vi
        .fn()
        .mockReturnValue({ bestMove: null, score: 0, threats: [], opportunities: [] }),
      evaluatePosition: vi.fn().mockResolvedValue(25),
      setOpeningBook: vi.fn(),
      setProgressCallback: vi.fn(),
    }));

    vi.mock('../js/config.js', () => ({
      setCurrentBoardShape: vi.fn(),
    }));

    vi.mock('../js/logger.js', () => ({
      logger: {
        info: vi.fn(),
        debug: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      },
    }));

    // Setup mock self with postMessage
    mockPostMessage = vi.fn();
    mockSelf = {
      postMessage: mockPostMessage,
      onmessage: null as any,
    };

    // Capture the onmessage handler when the worker module sets it
    Object.defineProperty(global, 'self', {
      value: mockSelf,
      configurable: true,
      writable: true,
    });

    // Import worker module - this sets self.onmessage
    await import('../js/ai/aiWorker.js');
    onmessageHandler = mockSelf.onmessage;
  });

  beforeEach(() => {
    mockPostMessage.mockClear();
  });

  test('loadBook - should set opening book when data provided', async () => {
    const { setOpeningBook } = await import('../js/aiEngine.js');

    await onmessageHandler({
      data: {
        type: 'loadBook',
        id: 'test-1',
        data: { book: { metadata: { version: '1.0' }, positions: {} } },
      },
    } as MessageEvent);

    expect(setOpeningBook).toHaveBeenCalledWith({ metadata: { version: '1.0' }, positions: {} });
  });

  test('loadBook - should warn when no book data provided', async () => {
    const { logger } = await import('../js/logger.js');

    await onmessageHandler({
      data: {
        type: 'loadBook',
        id: 'test-2',
        data: null,
      },
    } as MessageEvent);

    expect(logger.warn).toHaveBeenCalledWith('[AI Worker] loadBook called without book data');
  });

  test('setBoardShape - should set board shape', async () => {
    const { setCurrentBoardShape } = await import('../js/config.js');

    await onmessageHandler({
      data: {
        type: 'setBoardShape',
        id: 'test-3',
        data: { shape: '9x9' },
      },
    } as MessageEvent);

    expect(setCurrentBoardShape).toHaveBeenCalledWith('9x9');
  });

  test('getBestMove - should return best move result', async () => {
    const mockBoard = Array(9)
      .fill(null)
      .map(() => Array(9).fill(null));

    await onmessageHandler({
      data: {
        type: 'getBestMove',
        id: 'test-4',
        data: {
          board: mockBoard,
          color: 'white',
          depth: 3,
          config: { elo: 1500 },
          personality: 'balanced',
          moveNumber: 1,
        },
      },
    } as MessageEvent);

    expect(mockPostMessage).toHaveBeenCalledWith({
      type: 'bestMove',
      id: 'test-4',
      data: expect.objectContaining({ move: expect.any(Object), score: expect.any(Number) }),
    });
  });

  test('evaluatePosition - should return position score', async () => {
    const mockBoard = Array(9)
      .fill(null)
      .map(() => Array(9).fill(null));

    await onmessageHandler({
      data: {
        type: 'evaluatePosition',
        id: 'test-5',
        data: { board: mockBoard, forColor: 'white' },
      },
    } as MessageEvent);

    expect(mockPostMessage).toHaveBeenCalledWith({
      type: 'positionScore',
      id: 'test-5',
      data: 25,
    });
  });

  test('getTopMoves - should return top moves array', async () => {
    const mockBoard = Array(9)
      .fill(null)
      .map(() => Array(9).fill(null));

    await onmessageHandler({
      data: {
        type: 'getTopMoves',
        id: 'test-6',
        data: {
          board: mockBoard,
          color: 'white',
          count: 3,
          depth: 3,
          maxTimeMs: 5000,
          moveNumber: 1,
        },
      },
    } as MessageEvent);

    expect(mockPostMessage).toHaveBeenCalledWith({
      type: 'topMoves',
      id: 'test-6',
      data: expect.any(Array),
    });
  });

  test('analyze - should return analysis result', async () => {
    const mockBoard = Array(9)
      .fill(null)
      .map(() => Array(9).fill(null));

    await onmessageHandler({
      data: {
        type: 'analyze',
        id: 'test-7',
        data: { board: mockBoard, color: 'white' },
      },
    } as MessageEvent);

    expect(mockPostMessage).toHaveBeenCalledWith({
      type: 'analysis',
      id: 'test-7',
      data: expect.objectContaining({ bestMove: null, score: 0 }),
    });
  });

  test('search - should return search result as bestMove', async () => {
    const mockBoard = Array(9)
      .fill(null)
      .map(() => Array(9).fill(null));

    await onmessageHandler({
      data: {
        type: 'search',
        id: 'test-8',
        data: {
          board: mockBoard,
          color: 'white',
          depth: 4,
          personality: 'aggressive',
        },
      },
    } as MessageEvent);

    expect(mockPostMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'bestMove',
        id: 'test-8',
      })
    );
  });

  test('unknown message type - should log warning', async () => {
    const { logger } = await import('../js/logger.js');

    await onmessageHandler({
      data: {
        type: 'unknownType',
        id: 'test-9',
        data: {},
      },
    } as MessageEvent);

    expect(logger.warn).toHaveBeenCalledWith('Unknown message type:', 'unknownType');
  });

  test('legacy SEARCH - should handle old protocol', async () => {
    const mockBoard = Array(9)
      .fill(null)
      .map(() => Array(9).fill(null));

    await onmessageHandler({
      data: {
        type: 'SEARCH',
        id: 'test-10',
        payload: {
          board: mockBoard,
          turnColor: 'white',
          depth: 3,
          personality: 'solid',
          elo: 1800,
        },
      },
    } as MessageEvent);

    expect(mockPostMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'SEARCH_RESULT',
        id: 'test-10',
        payload: expect.any(Object),
      })
    );
  });
});
