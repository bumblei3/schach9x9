import { getBestMoveDetailed } from '../js/aiEngine.js';
import { logger } from '../js/logger.js';

// Mock Worker class
class MockWorker {
  constructor(scriptUrl) {
    this.scriptUrl = scriptUrl;
    this.onmessage = null;
    this.postMessage = this.postMessage.bind(this);
  }

  postMessage(data) {
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
          });
        }
      }
    }, 10);
  }
}

describe('AI Engine Worker Integration', () => {
  let originalWorker;
  let originalWindow;
  let uiBoard;

  beforeAll(() => {
    originalWorker = global.Worker;
    originalWindow = global.window;
    global.Worker = MockWorker;
    global.window = {}; // Mock window existence

    // Silence logs
    vi.spyOn(logger, 'info').mockImplementation(function () {});
    vi.spyOn(logger, 'debug').mockImplementation(function () {});
  });

  afterAll(() => {
    global.Worker = originalWorker;
    global.window = originalWindow;
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    uiBoard = Array(9)
      .fill(null)
      .map(() => Array(9).fill(null));
  });

  test('should use Worker when available', async () => {
    const result = await getBestMoveDetailed(uiBoard, 'white', 1, 'expert');
    expect(result).toBeDefined();
    expect(result.score).toBe(100);
    // The move comes from our mock, confirming worker was used
    expect(result.move).toEqual({
      from: { r: 0, c: 1 }, // 1 -> row 0 col 1
      to: { r: 0, c: 2 }, // 2 -> row 0 col 2
      promotion: undefined,
    });
  });
});
