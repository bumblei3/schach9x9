/**
 * AI Worker Additional Branch Coverage Tests
 * Targets untested branches in js/ai/aiWorker.ts
 */

import { describe, expect, test, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { logger } from '../../js/logger.js';

// Mock Worker class
class MockWorker {
  scriptUrl: string | URL;
  onmessage: ((ev: MessageEvent) => any) | null = null;

  constructor(scriptUrl: string | URL) {
    this.scriptUrl = scriptUrl;
    this.postMessage = this.postMessage.bind(this);
  }

  postMessage(data: any) {
    setTimeout(() => {
      if (data.type === 'SEARCH' || data.type === 'getBestMove') {
        const { id } = data;
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
  dispatchEvent() { return true; }
  onerror = null;
  onmessageerror = null;
}

describe('AI Worker - Branch Coverage for Untested Paths', () => {
  let originalWorker: any;
  let originalWindow: any;
  let mockPostMessage: ReturnType<typeof vi.fn>;
  let mockSelf: any;
  let onmessageHandler: (e: MessageEvent) => Promise<void>;

  beforeAll(async () => {
    originalWorker = (global as any).Worker;
    originalWindow = (global as any).window;
    (global as any).Worker = MockWorker;
    (global as any).window = {};

    vi.spyOn(logger, 'info').mockImplementation(() => {});
    vi.spyOn(logger, 'debug').mockImplementation(() => {});
    vi.spyOn(logger, 'warn').mockImplementation(() => {});
    vi.spyOn(logger, 'error').mockImplementation(() => {});

    vi.mock('../../js/aiEngine.js', () => ({
      getBestMoveDetailed: vi.fn().mockResolvedValue({ 
        move: { from: { r: 1, c: 1 }, to: { r: 2, c: 2 } }, 
        score: 50 
      }),
      getTopMoves: vi.fn().mockResolvedValue([{ 
        move: { from: { r: 0, c: 0 }, to: { r: 1, c: 1 } }, 
        score: 100 
      }]),
      analyzePosition: vi.fn().mockResolvedValue({ 
        bestMove: null, 
        score: 0, 
        threats: [], 
        opportunities: [] 
      }),
      evaluatePosition: vi.fn().mockResolvedValue(25),
      setOpeningBook: vi.fn(),
      setProgressCallback: vi.fn(),
    }));

    vi.mock('../../js/config.js', () => ({
      setCurrentBoardShape: vi.fn(),
      getCurrentBoardShape: vi.fn(() => 'standard'),
    }));

    vi.mock('../../js/logger.js', () => ({
      logger: {
        info: vi.fn(),
        debug: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      },
    }));

    mockPostMessage = vi.fn();
    mockSelf = {
      postMessage: mockPostMessage,
      onmessage: null as any,
    };

    Object.defineProperty(global, 'self', {
      value: mockSelf,
      configurable: true,
      writable: true,
    });

    await import('../../js/ai/aiWorker.js');
    onmessageHandler = mockSelf.onmessage;
  });

  afterAll(() => {
    (global as any).Worker = undefined;
    (global as any).window = undefined;
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('setBoardShape - missing branches', () => {
    test('should skip setting board shape when data is null', async () => {
      const { setCurrentBoardShape } = await import('../../js/config.js');
      
      await onmessageHandler({
        data: {
          type: 'setBoardShape',
          id: 'test-shape-null',
          data: null,
        },
      } as MessageEvent);

      expect(setCurrentBoardShape).not.toHaveBeenCalled();
    });

    test('should skip setting board shape when data.shape is undefined', async () => {
      const { setCurrentBoardShape } = await import('../../js/config.js');
      
      await onmessageHandler({
        data: {
          type: 'setBoardShape',
          id: 'test-shape-undef',
          data: {},
        },
      } as MessageEvent);

      expect(setCurrentBoardShape).not.toHaveBeenCalled();
    });

    test('should skip setting board shape when data.shape is empty string', async () => {
      const { setCurrentBoardShape } = await import('../../js/config.js');
      
      await onmessageHandler({
        data: {
          type: 'setBoardShape',
          id: 'test-shape-empty',
          data: { shape: '' },
        },
      } as MessageEvent);

      expect(setCurrentBoardShape).not.toHaveBeenCalled();
    });
  });

  describe('getBestMove - error handling', () => {
    test('should post null result when getBestMoveDetailed throws', async () => {
      const { getBestMoveDetailed } = await import('../../js/aiEngine.js');
      (getBestMoveDetailed as any).mockRejectedValueOnce(new Error('Worker search failed'));

      const mockBoard = Array(9).fill(null).map(() => Array(9).fill(null));
      
      await onmessageHandler({
        data: {
          type: 'getBestMove',
          id: 'test-getbestmove-error',
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

      expect(mockPostMessage).toHaveBeenCalledWith(expect.objectContaining({
        type: 'bestMove',
        id: 'test-getbestmove-error',
        data: null,
      }));
    });
  });

  describe('getTopMoves - error handling', () => {
    test('should post empty array when getTopMoves throws', async () => {
      const { getTopMoves } = await import('../../js/aiEngine.js');
      (getTopMoves as any).mockRejectedValueOnce(new Error('Top moves failed'));

      const mockBoard = Array(9).fill(null).map(() => Array(9).fill(null));
      
      await onmessageHandler({
        data: {
          type: 'getTopMoves',
          id: 'test-gettopmoves-error',
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

      expect(mockPostMessage).toHaveBeenCalledWith(expect.objectContaining({
        type: 'topMoves',
        id: 'test-gettopmoves-error',
        data: [],
      }));
    });
  });

  describe('search - error handling', () => {
    test('should post null bestMove when getBestMoveDetailed throws in search', async () => {
      const { getBestMoveDetailed } = await import('../../js/aiEngine.js');
      (getBestMoveDetailed as any).mockRejectedValueOnce(new Error('Search failed'));

      const mockBoard = Array(9).fill(null).map(() => Array(9).fill(null));
      
      await onmessageHandler({
        data: {
          type: 'search',
          id: 'test-search-error',
          data: {
            board: mockBoard,
            color: 'white',
            depth: 4,
            personality: 'aggressive',
          },
        },
      } as MessageEvent);

      expect(mockPostMessage).toHaveBeenCalledWith(expect.objectContaining({
        type: 'bestMove',
        id: 'test-search-error',
        bestMove: null,
      }));
    });
  });

  describe('analyze - success path', () => {
    test('should call setProgressCallback and analyzePosition', async () => {
      const { analyzePosition, setProgressCallback } = await import('../../js/aiEngine.js');
      (analyzePosition as any).mockResolvedValueOnce({ 
        bestMove: { from: { r: 3, c: 3 }, to: { r: 4, c: 4 } }, 
        score: 75, 
        threats: [], 
        opportunities: [] 
      });

      const mockBoard = Array(9).fill(null).map(() => Array(9).fill(null));
      
      await onmessageHandler({
        data: {
          type: 'analyze',
          id: 'test-analyze-success',
          data: { board: mockBoard, color: 'white' },
        },
      } as MessageEvent);

      expect(setProgressCallback).toHaveBeenCalled();
      expect(analyzePosition).toHaveBeenCalledWith(mockBoard, 'white');
      expect(mockPostMessage).toHaveBeenCalledWith(expect.objectContaining({
        type: 'analysis',
        id: 'test-analyze-success',
      }));
    });
  });

  describe('legacy SEARCH protocol - all branches', () => {
    test('should handle legacy SEARCH with all fields', async () => {
      const mockBoard = Array(9).fill(null).map(() => Array(9).fill(null));
      
      await onmessageHandler({
        data: {
          type: 'SEARCH',
          id: 'test-legacy-full',
          payload: {
            board: mockBoard,
            turnColor: 'black',
            depth: 5,
            personality: 'solid',
            elo: 2000,
          },
        },
      } as MessageEvent);

      expect(mockPostMessage).toHaveBeenCalledWith(expect.objectContaining({
        type: 'SEARCH_RESULT',
        id: 'test-legacy-full',
        payload: expect.any(Object),
      }));
    });
  });

  describe('default case - unknown message type', () => {
    test('should warn for unknown message type', async () => {
      const { logger } = await import('../../js/logger.js');
      
      await onmessageHandler({
        data: {
          type: 'completelyUnknownType123',
          id: 'test-unknown',
          data: {},
        },
      } as MessageEvent);

      expect(logger.warn).toHaveBeenCalledWith('Unknown message type:', 'completelyUnknownType123');
    });
  });

  describe('loadBook - edge cases', () => {
    test('should warn when data is undefined', async () => {
      const { logger } = await import('../../js/logger.js');
      
      await onmessageHandler({
        data: {
          type: 'loadBook',
          id: 'test-loadbook-undef',
          data: undefined,
        },
      } as MessageEvent);

      expect(logger.warn).toHaveBeenCalledWith('[AI Worker] loadBook called without book data');
    });

    test('should warn when data.book is undefined', async () => {
      const { logger } = await import('../../js/logger.js');
      
      await onmessageHandler({
        data: {
          type: 'loadBook',
          id: 'test-loadbook-nobook',
          data: { book: undefined },
        },
      } as MessageEvent);

      expect(logger.warn).toHaveBeenCalledWith('[AI Worker] loadBook called without book data');
    });
  });

  describe('evaluatePosition - success path with score', () => {
    test('should return numeric score', async () => {
      const { evaluatePosition } = await import('../../js/aiEngine.js');
      (evaluatePosition as any).mockResolvedValueOnce(150);

      const mockBoard = Array(9).fill(null).map(() => Array(9).fill(null));
      
      await onmessageHandler({
        data: {
          type: 'evaluatePosition',
          id: 'test-eval-score',
          data: { board: mockBoard, forColor: 'black' },
        },
      } as MessageEvent);

      expect(mockPostMessage).toHaveBeenCalledWith(expect.objectContaining({
        type: 'positionScore',
        id: 'test-eval-score',
        data: 150,
      }));
    });
  });

  describe('progress callback - getBestMove', () => {
    test('should call progress callback during getBestMove', async () => {
      const { setProgressCallback } = await import('../../js/aiEngine.js');
      
      await onmessageHandler({
        data: {
          type: 'getBestMove',
          id: 'test-progress',
          data: {
            board: Array(9).fill(null).map(() => Array(9).fill(null)),
            color: 'white',
            depth: 2,
            config: { elo: 1200 },
            personality: 'balanced',
          },
        },
      } as MessageEvent);

      expect(setProgressCallback).toHaveBeenCalled();
    });
  });

  describe('analyze - missing depth/topMovesCount params', () => {
    test('should call analyzePosition without extra params', async () => {
      const { analyzePosition } = await import('../../js/aiEngine.js');
      (analyzePosition as any).mockResolvedValueOnce({ 
        bestMove: null, 
        score: 0, 
        threats: [], 
        opportunities: [] 
      });

      const mockBoard = Array(9).fill(null).map(() => Array(9).fill(null));
      
      await onmessageHandler({
        data: {
          type: 'analyze',
          id: 'test-analyze-simple',
          data: { board: mockBoard, color: 'white' },
        },
      } as MessageEvent);

      expect(analyzePosition).toHaveBeenCalledWith(mockBoard, 'white');
      expect(mockPostMessage).toHaveBeenCalledWith(expect.objectContaining({
        type: 'analysis',
        id: 'test-analyze-simple',
      }));
    });
  });
});

