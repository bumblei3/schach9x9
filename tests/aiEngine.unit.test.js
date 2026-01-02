import { jest } from '@jest/globals';

// Use unstable_mockModule for ESM mocking
jest.unstable_mockModule('../js/ai/Search.js', () => ({
  getBestMove: jest.fn(() => ({ from: { r: 6, c: 4 }, to: { r: 4, c: 4 } })),
  analyzePosition: jest.fn(() => Promise.resolve({ score: 100, topMoves: [] })),
  getNodesEvaluated: jest.fn(() => 500),
  resetNodesEvaluated: jest.fn(),
  setProgressCallback: jest.fn(),
}));

jest.unstable_mockModule('../js/ai/Evaluation.js', () => ({
  evaluatePosition: jest.fn(() => 100),
  PST: {},
  PST_EG: {},
}));

// Dynamic imports are required for mocked modules in ESM
const aiEngine = await import('../js/aiEngine.js');
const { Game } = await import('../js/gameEngine.js');

describe('AIEngine Wrapper', () => {
  let game;

  beforeEach(async () => {
    game = new Game();
    jest.clearAllMocks();
  });

  test('should call getBestMove correctly', async () => {
    const result = await aiEngine.getBestMove(game.board, 'white', 'hard', 3);
    expect(result).toBeDefined();
    expect(result.from).toEqual({ r: 6, c: 4 });
  });

  test('should call evaluatePosition correctly', () => {
    const score = aiEngine.evaluatePosition(game.board, 'white');
    expect(score).toBe(100);
  });

  test('should call analyzePosition correctly', async () => {
    const analysis = await aiEngine.analyzePosition(game.board, 'white', 3);
    expect(analysis).toBeDefined();
    expect(analysis.score).toBe(100);
  });

  test('should handle nodes evaluated tracking', () => {
    aiEngine.resetNodesEvaluated();
    const nodes = aiEngine.getNodesEvaluated();
    expect(nodes).toBe(500);
  });
});
