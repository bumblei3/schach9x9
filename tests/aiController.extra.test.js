import { jest } from '@jest/globals';
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
  postMessage = jest.fn();
  terminate = jest.fn();
}
global.Worker = jest.fn().mockImplementation(() => new MockWorker());

// Mock fetch
global.fetch = jest.fn(() =>
  Promise.resolve({ ok: true, json: () => Promise.resolve({ e2e4: ['e2e5'] }) })
);

// Mocks
jest.unstable_mockModule('../js/ui.js', () => ({
  updateStatus: jest.fn(),
  updateCapturedUI: jest.fn(),
  updateMoveHistoryUI: jest.fn(),
  renderBoard: jest.fn(),
  showModal: jest.fn(),
}));

jest.unstable_mockModule('../js/aiEngine.js', () => ({
  evaluatePosition: jest.fn().mockResolvedValue(0),
  getBestMove: jest.fn(),
  getParamsForElo: jest.fn(() => ({ maxDepth: 4, elo: 2500 })),
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
      placeKing: jest.fn(),
      placeShopPiece: jest.fn(() => game.points--),
      finishSetupPhase: jest.fn(),
      resign: jest.fn(),
      offerDraw: jest.fn(),
      acceptDraw: jest.fn(),
      declineDraw: jest.fn(),
      executeMove: jest.fn(),
      log: jest.fn(),
      isInsufficientMaterial: jest.fn(() => false),
      getBoardHash: jest.fn(() => 'hash'),
      calculateMaterialAdvantage: jest.fn(() => 0),
      renderBoard: jest.fn(),
      showModal: jest.fn(),
      continuousAnalysis: false,
      analysisMode: false,
      getAllLegalMoves: jest.fn(() => []),
      arrowRenderer: { clearArrows: jest.fn(), drawArrow: jest.fn() },
      halfMoveClock: 0,
      findKing: jest.fn(() => ({ r: 1, c: 4 })),
    };
    controller = new AIController(game);
    jest.clearAllMocks();
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
