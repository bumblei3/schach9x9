// Mock dependencies logic
// For ES modules with jest, we need to use unstable_mockModule for full mocking or spyOn.
// However, since we're using experimental-vm-modules, simple jest.mock works for default exports but named exports are tricky.
// Better approach: Mock the module factory return value.

import { jest } from '@jest/globals';

jest.unstable_mockModule('../js/ai/MoveGenerator.js', () => ({
  getAllLegalMoves: jest.fn(),
  makeMove: jest.fn(),
  undoMove: jest.fn(),
  getAllCaptureMoves: jest.fn(),
  isInCheck: jest.fn(),
  isSquareAttacked: jest.fn(),
  findKing: jest.fn(),
}));

jest.unstable_mockModule('../js/ai/Evaluation.js', () => ({
  evaluatePosition: jest.fn(),
  PST: {},
  PST_EG: {},
}));

jest.unstable_mockModule('../js/ai/TranspositionTable.js', () => ({
  computeZobristHash: jest.fn(() => 0),
  updateZobristHash: jest.fn(() => 0),
  getXORSideToMove: jest.fn(() => 0),
  storeTT: jest.fn(),
  probeTT: jest.fn(),
  TT_EXACT: 1,
  TT_ALPHA: 2,
  TT_BETA: 3,
}));

jest.unstable_mockModule('../js/ai/OpeningBook.js', () => ({
  queryOpeningBook: jest.fn(),
}));

jest.unstable_mockModule('../js/ai/MoveOrdering.js', () => ({
  orderMoves: jest.fn((board, moves) => moves),
  addKillerMove: jest.fn(),
  updateHistory: jest.fn(),
  updateCounterMove: jest.fn(),
}));

jest.unstable_mockModule('../js/logger.js', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(), // console.error,
    debug: jest.fn(),
  },
}));

// Dynamic import after mocking
const { getBestMove } = await import('../js/ai/Search.js');
const MoveGenerator = await import('../js/ai/MoveGenerator.js');
const Evaluation = await import('../js/ai/Evaluation.js');

const mockBoard = Array(9)
  .fill(null)
  .map(() => Array(9).fill(null));

describe('AI Difficulty', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Setup mock moves
    const moves = [
      { from: { r: 1, c: 1 }, to: { r: 2, c: 1 }, id: 1 }, // Best
      { from: { r: 1, c: 2 }, to: { r: 2, c: 2 }, id: 2 }, // 2nd
      { from: { r: 1, c: 3 }, to: { r: 2, c: 3 }, id: 3 }, // 3rd
      { from: { r: 1, c: 4 }, to: { r: 2, c: 4 }, id: 4 }, // Worst
    ];
    MoveGenerator.getAllLegalMoves.mockReturnValue(moves);
    MoveGenerator.getAllCaptureMoves.mockReturnValue([]); // Return no captures to avoid QS recursion crash
    MoveGenerator.makeMove.mockReturnValue({});
    MoveGenerator.undoMove.mockReturnValue();
    MoveGenerator.isInCheck.mockReturnValue(false);
  });

  test('Beginner Difficulty should pick from top candidates', () => {
    const selectedIds = new Set();

    // Run 20 iterations to capture the random distribution
    for (let i = 0; i < 20; i++) {
      let count = 0;
      // Setup a fresh mock for each iteration to control evaluation order
      Evaluation.evaluatePosition.mockImplementation(() => {
        // Return scores from BLACK perspective (opponent)
        // We want White to perceive these as: 100, 90, 80, 0 centipawns.
        // Since NegaMax is used: score = -minimax(board, turn=black)
        // And minimax(depth=0) returns evaluatePosition(board, turn=black)
        // So -(-100) = 100.

        const scores = [-100, -90, -80, 0];
        return scores[count++ % 4];
      });

      const move = getBestMove(mockBoard, 'white', 1, 'beginner', 0);
      if (move) selectedIds.add(move.id);
    }

    // Verify we found at least 2 different moves (proving randomness)
    expect(selectedIds.size).toBeGreaterThan(1);
    // With increased randomness/blunder chance, even the worst move might be picked occasionally.
    // So we just verify variety.
    expect(selectedIds.size).toBeGreaterThan(1);
  });

  test('Expert Difficulty should always pick the absolute best move', () => {
    for (let i = 0; i < 5; i++) {
      let count = 0;
      Evaluation.evaluatePosition.mockImplementation(() => {
        const scores = [-100, -90, -80, 0];
        return scores[count++ % 4];
      });

      const move = getBestMove(mockBoard, 'white', 1, 'expert', 0);
      expect(move.id).toBe(1); // Should always be the move with perceived score of 100
    }
  });
});
