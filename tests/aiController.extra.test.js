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
  constructor() {
    this.onmessage = null;
  }
  postMessage = vi.fn();
  terminate = vi.fn();
}
global.Worker = vi.fn().mockImplementation(function () {
  return new MockWorker();
});

// Mock fetch
global.fetch = vi.fn(() =>
  Promise.resolve({ ok: true, json: () => Promise.resolve({ e2e4: ['e2e5'] }) })
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
}));

const { AIController } = await import('../js/aiController.js');
const aiEngine = await import('../js/aiEngine.js');

describe('AIController Ultimate Precision V5 - Updated', () => {
  let game, controller;

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
    controller = new AIController(game);
    vi.clearAllMocks();
  });

  test('aiMove - should resign based on material and score', async () => {
    aiEngine.evaluatePosition.mockResolvedValue(-2000);
    game.calculateMaterialAdvantage.mockReturnValue(-20);
    await controller.aiMove();
    expect(game.resign).toHaveBeenCalledWith('black');
  });

  test('aiSetupPieces - affordable piece logic', () => {
    game.points = 1;
    controller.aiSetupPieces();
    expect(game.placeShopPiece).toHaveBeenCalled();
  });
});
