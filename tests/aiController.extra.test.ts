import { describe, test, expect, beforeEach, vi } from 'vitest';
import { PHASES } from '../js/gameEngine.js';

// Setup JSDOM body
document.body.innerHTML = `
    <div id="spinner-overlay" style="display: none;"></div>
    <div id="ai-depth"></div>
    <div id="ai-nodes"></div>
    <div id="ai-best-move"></div>
    <div id="progress-fill"></div>
    <div id="eval-bar"></div>
    <div id="eval-score"></div>
    <div id="top-moves-content"></div>
    <div id="ai-status"></div>
`;

// Mock Worker before any imports
class MockWorker {
  onmessage: any;
  listeners: any;
  constructor() {
    this.onmessage = null;
    this.listeners = {};
  }
  postMessage = vi.fn();
  terminate = vi.fn();
  addEventListener = vi.fn((event, handler) => {
    this.listeners[event] = handler;
  });
  removeEventListener = vi.fn();
}
global.Worker = vi.fn().mockImplementation(function () {
  return new MockWorker();
});

// Mock fetch
global.fetch = vi.fn(() =>
  Promise.resolve({ ok: true, json: () => Promise.resolve({ e2e4: ['e2e5'] }) } as any)
);

// Mocks
vi.mock('../js/ui.js', () => ({
  updateStatus: vi.fn(),
  updateCapturedUI: vi.fn(),
  updateMoveHistoryUI: vi.fn(),
  renderBoard: vi.fn(),
  showModal: vi.fn(),
}));

vi.mock('../js/aiEngine.js', () => ({
  evaluatePosition: vi.fn().mockResolvedValue(0),
  getBestMove: vi.fn(),
  getParamsForElo: vi.fn(() => ({ maxDepth: 4, elo: 2500 })),
  convertBoardToInt: vi.fn(),
}));

const { AIController } = await import('../js/aiController.js');
const aiEngine = await import('../js/aiEngine.js');

describe('AIController Ultimate Precision V5 - Updated', () => {
  let game: any, controller: any;

  beforeEach(() => {
    game = {
      board: Array(9)
        .fill(null)
        .map(() => Array(9).fill(null)),
      phase: PHASES.PLAY,
      turn: 'black',
      difficulty: 'medium',
      moveHistory: [],
      positionHistory: [],
      blackCorridor: { rowStart: 0, colStart: 3 },
      points: 15,
      drawOffered: false,
      drawOfferedBy: 'white',
      mode: 'pve',
      placeKing: vi.fn(),
      placeShopPiece: vi.fn(() => game.points--),
      finishSetupPhase: vi.fn(),
      resign: vi.fn(),
      offerDraw: vi.fn(),
      acceptDraw: vi.fn(),
      declineDraw: vi.fn(),
      executeMove: vi.fn(),
      log: vi.fn(),
      isInsufficientMaterial: vi.fn(() => false),
      getBoardHash: vi.fn(() => 'hash'),
      calculateMaterialAdvantage: vi.fn(() => 0),
      renderBoard: vi.fn(),
      showModal: vi.fn(),
      continuousAnalysis: false,
      analysisMode: false,
      getAllLegalMoves: vi.fn(() => []),
      arrowRenderer: { clearArrows: vi.fn(), drawArrow: vi.fn() },
      halfMoveClock: 0,
      findKing: vi.fn(() => ({ r: 1, c: 4 })),
    };
    controller = new AIController(game as any);
    vi.clearAllMocks();
  });

  test('aiMove - should resign based on material and score', async () => {
    (aiEngine.evaluatePosition as any).mockResolvedValue(-2000);
    (game.calculateMaterialAdvantage as any).mockReturnValue(20); // White +20
    await controller.aiMove();
    expect(game.resign).toHaveBeenCalledWith('black');
  });

  test('aiMove - should NOT resign in upgrade mode despite material disadvantage', async () => {
    game.mode = 'upgrade';
    (aiEngine.evaluatePosition as any).mockResolvedValue(-2000); // Standard resign is -1500, but logic says -3000 for upgrade
    (game.calculateMaterialAdvantage as any).mockReturnValue(20); // 20 material diff (would trigger >15 normal logic)

    // Start aiMove but don't await immediately, as it waits for workers
    const movePromise = controller.aiMove();

    // Wait a tick for workers to initialize
    await new Promise(resolve => setTimeout(resolve, 0));

    // Simulate worker response to resolve the move promise
    if (controller.aiWorkers.length > 0) {
      const worker = controller.aiWorkers[0];
      // Simulate 'bestMove' message to resolve the promise
      if (worker.listeners && worker.listeners['message']) {
        worker.listeners['message']({
          data: {
            type: 'bestMove',
            data: { move: { from: { r: 1, c: 4 }, to: { r: 2, c: 4 } } },
          },
        });
      }
    }

    await movePromise;

    expect(game.resign).not.toHaveBeenCalled();
    expect(game.log).not.toHaveBeenCalledWith(expect.stringContaining('gibt auf'));
  });

  test('aiMove - SHOULD resign in upgrade mode if score is terrible', async () => {
    game.mode = 'upgrade';
    (aiEngine.evaluatePosition as any).mockResolvedValue(-3001); // Threshold is -3000

    await controller.aiMove();

    expect(game.resign).toHaveBeenCalledWith('black');
  });
  test('aiSetupPieces - affordable piece logic', () => {
    game.points = 1;
    controller.aiSetupPieces();
    expect(game.placeShopPiece).toHaveBeenCalled();
  });

  test('aiSetupUpgrades - skips upgrades in upgrade mode', () => {
    game.mode = 'upgrade';
    // Mock shopManager
    game.gameController = {
      shopManager: {
        aiPerformUpgrades: vi.fn(),
      },
    };

    controller.aiSetupUpgrades();
    expect(game.gameController.shopManager.aiPerformUpgrades).not.toHaveBeenCalled();
  });

  test('aiSetupUpgrades - performs upgrades in other modes', () => {
    game.mode = 'upgrade8x8';
    // Mock shopManager
    game.gameController = {
      shopManager: {
        aiPerformUpgrades: vi.fn(),
      },
    };

    controller.aiSetupUpgrades();
    expect(game.gameController.shopManager.aiPerformUpgrades).toHaveBeenCalled();
  });
});
