import { describe, test, expect, beforeEach, vi } from 'vitest';
import { AIController } from '../../js/aiController.js';
import { PHASES } from '../../js/gameEngine.js';

// Mock UI.js
vi.mock('../../js/ui.js', () => ({
  updateStatus: vi.fn(),
  showModal: vi.fn(),
  closeModal: vi.fn(),
  updateMoveHistoryUI: vi.fn(),
  renderEvalGraph: vi.fn(),
  drawEngineArrow: vi.fn(),
}));

// Mock aiEngine.js
const mockEval = vi.fn().mockResolvedValue(0);
vi.mock('../../js/aiEngine.js', () => ({
  evaluatePosition: (board: any, color: any) => mockEval(board, color),
  getBestMove: vi.fn(),
  getParamsForElo: vi.fn(() => ({ maxDepth: 4, elo: 2500 })),
  convertBoardToInt: vi.fn(() => new Int32Array(81)),
}));

// Mock Worker
class MockWorker {
  _onmessage: ((e: any) => void) | null = null;
  set onmessage(handler: any) {
    this._onmessage = handler;
  }
  get onmessage() {
    return this._onmessage;
  }
  postMessage = vi.fn();
  terminate = vi.fn();
  addEventListener = vi.fn();
  removeEventListener = vi.fn();
}

// @ts-ignore
global.Worker = MockWorker;

// Mock fetch for opening book
global.fetch = vi.fn().mockResolvedValue({
  ok: true,
  json: () => Promise.resolve({ positions: {} }),
});

// Mock navigator.hardwareConcurrency safely
Object.defineProperty(global.navigator, 'hardwareConcurrency', {
  value: 4,
  configurable: true,
});

describe('AIController Coverage Boost', () => {
  let controller: AIController;
  let mockGame: any;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    mockEval.mockResolvedValue(0);

    mockGame = {
      board: Array(9)
        .fill(null)
        .map(() => Array(9).fill(null)),
      phase: PHASES.PLAY,
      turn: 'black',
      difficulty: 'medium',
      moveHistory: Array(60).fill({}),
      positionHistory: [],
      points: 15,
      drawOffered: true,
      drawOfferedBy: 'white',
      halfMoveClock: 0,
      mode: 'standard',
      lastMove: null,
      resign: vi.fn(),
      offerDraw: vi.fn(),
      acceptDraw: vi.fn(),
      declineDraw: vi.fn(),
      executeMove: vi.fn(),
      calculateMaterialAdvantage: vi.fn().mockReturnValue(0),
      isInsufficientMaterial: vi.fn().mockReturnValue(false),
      getBoardHash: vi.fn().mockReturnValue('mock-hash'),
      log: vi.fn(),
      arrowRenderer: { clearArrows: vi.fn(), drawArrow: vi.fn() },
      findKing: vi.fn().mockReturnValue({ r: 0, c: 4 }),
      getAllLegalMoves: vi.fn().mockReturnValue([]),
      renderBoard: vi.fn(),
    };

    // Setup DOM
    document.body.innerHTML = `
            <div id="spinner-overlay" class="hidden"></div>
            <div id="analysis-engine-info"></div>
            <div id="ai-best-move"></div>
            <div id="ai-depth"></div>
            <div id="ai-nodes"></div>
            <div id="progress-fill"></div>
            <div class="cell" data-r="6" data-c="4" data-piece="p" data-color="black"></div>
            <div class="cell" data-r="4" data-c="4"></div>
            <div class="cell" data-r="1" data-c="1"></div>
            <div class="cell" data-r="2" data-c="2"></div>
        `;

    controller = new AIController(mockGame);
  });

  test('aiEvaluateDrawOffer - accept insufficient material', async () => {
    mockGame.isInsufficientMaterial.mockReturnValue(true);
    await controller.aiEvaluateDrawOffer();
    expect(mockGame.acceptDraw).toHaveBeenCalled();
  });

  test('aiEvaluateDrawOffer - accept losing position', async () => {
    mockEval.mockResolvedValue(-300);
    await controller.aiEvaluateDrawOffer();
    expect(mockGame.acceptDraw).toHaveBeenCalled();
  });

  test('aiEvaluateDrawOffer - decline winning position', async () => {
    mockEval.mockResolvedValue(300);
    await controller.aiEvaluateDrawOffer();
    expect(mockGame.declineDraw).toHaveBeenCalled();
  });

  test('aiShouldOfferDraw - offer if bad but not hopeless', async () => {
    mockEval.mockResolvedValue(-200);
    mockGame.drawOffered = false;
    mockGame.moveHistory = Array(25).fill({});
    const result = await controller.aiShouldOfferDraw();
    expect(result).toBe(true);
  });

  test('aiShouldOfferDraw - offer on repetition', async () => {
    mockGame.drawOffered = false;
    mockGame.getBoardHash.mockReturnValue('hash1');
    mockGame.positionHistory = ['hash1', 'hash1'];
    const result = await controller.aiShouldOfferDraw();
    expect(result).toBe(true);
  });

  test('aiShouldResign - resign if hopelessly lost', async () => {
    mockEval.mockResolvedValue(-2000);
    expect(await controller.aiShouldResign()).toBe(true);
  });

  test('analyzePosition - starts workers if needed', () => {
    controller.analysisActive = true;
    controller.analyzePosition();
    expect(controller.aiWorkers.length).toBe(4);
  });

  test('updateAIProgress - updates DOM and engine arrow', async () => {
    const data = {
      depth: 8,
      maxDepth: 10,
      nodes: 12345,
      bestMove: { from: { r: 6, c: 4 }, to: { r: 4, c: 4 } },
    };
    controller.updateAIProgress(data);
    expect(document.getElementById('ai-depth')?.textContent).toContain('8/10');
  });

  test('aiMove - handles successful worker results', async () => {
    controller.initWorkerPool();
    const worker = controller.aiWorkers[0] as any;
    mockEval.mockResolvedValue(0);

    // Start aiMove
    const movePromise = controller.aiMove();

    // Wait for workers to be initialized and onmessage assigned
    while (!worker.onmessage) {
      await new Promise(r => setTimeout(r, 0));
    }

    // Simulate worker response
    worker.onmessage({
      data: {
        type: 'bestMove',
        data: {
          move: { from: { r: 6, c: 4 }, to: { r: 4, c: 4 } },
          pv: [{ from: { r: 6, c: 4 }, to: { r: 4, c: 4 } }],
        },
      },
    });

    await movePromise;
    expect(mockGame.executeMove).toHaveBeenCalled();
  });

  test('aiMove - fallback on timeout', async () => {
    vi.useFakeTimers();
    mockGame.getAllLegalMoves.mockReturnValue([{ from: { r: 1, c: 1 }, to: { r: 2, c: 2 } }]);

    // Start move.
    const movePromise = controller.aiMove();

    // Flush microtasks to reach evaluations
    for (let i = 0; i < 30; i++) await Promise.resolve();

    // Advance time past 30s
    vi.advanceTimersByTime(31000);

    // Run any pending timers.
    vi.runAllTimers();

    // Final flush.
    for (let i = 0; i < 10; i++) await Promise.resolve();

    await movePromise;
    expect(mockGame.executeMove).toHaveBeenCalled();
    vi.useRealTimers();
  });

  test('getAlgebraicNotation - correct formats', () => {
    expect(controller.getAlgebraicNotation({ from: { r: 8, c: 0 }, to: { r: 0, c: 8 } })).toBe(
      'a1-i9'
    );
  });

  test('toggleAnalysisMode - toggles active state', () => {
    expect(controller.toggleAnalysisMode()).toBe(true);
    expect(controller.toggleAnalysisMode()).toBe(false);
  });

  test('updateAnalysisStats - formats nodes correctly', () => {
    controller.updateAnalysisStats({ depth: 5, maxDepth: 10, nodes: 1000000 });
    expect(document.getElementById('analysis-engine-info')?.textContent).toContain('Tiefe: 5/10');
  });
});
