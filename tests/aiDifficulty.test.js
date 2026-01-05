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
  computeZobristHash: jest.fn(() => 0n),
  updateZobristHash: jest.fn(() => 0n),
  getZobristKey: jest.fn(() => 0n),
  getXORSideToMove: jest.fn(() => 0n),
  storeTT: jest.fn(),
  probeTT: jest.fn(() => null),
  getTTMove: jest.fn(() => null),
  clearTT: jest.fn(),
  getTTSize: jest.fn(() => 0),
  setTTMaxSize: jest.fn(),
  getTTStats: jest.fn(() => ({})),
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
  clearMoveOrdering: jest.fn(),
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
const TranspositionTable = await import('../js/ai/TranspositionTable.js');

const mockBoard = new Int8Array(81).fill(0);

describe('AI Difficulty', () => {
  const move1 = { from: 10, to: 20 }; // Best
  const move2 = { from: 11, to: 21 }; // 2nd
  const move3 = { from: 12, to: 22 }; // 3rd
  const move4 = { from: 13, to: 23 }; // Worst

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup mock moves
    const moves = [move1, move2, move3, move4];
    MoveGenerator.getAllLegalMoves.mockReturnValue(moves);
    MoveGenerator.getAllCaptureMoves.mockReturnValue([]);
    MoveGenerator.makeMove.mockImplementation(() => ({ piece: 1, captured: 0 }));
    MoveGenerator.undoMove.mockReturnValue();
    MoveGenerator.isInCheck.mockReturnValue(false);

    // Mock TranspositionTable constants
    TranspositionTable.getZobristKey.mockReturnValue(0n);
    TranspositionTable.getXORSideToMove.mockReturnValue(0n);
  });

  test('Beginner Difficulty should pick from top candidates', async () => {
    const selectedKeys = new Set();

    // Run 20 iterations to capture the random distribution
    for (let i = 0; i < 20; i++) {
      let count = 0;
      // Setup a fresh mock for each iteration to control evaluation order
      Evaluation.evaluatePosition.mockImplementation(() => {
        const scores = [-100, -90, -80, 0];
        return scores[count++ % 4];
      });

      const move = await getBestMove(mockBoard, 'white', 1, 'beginner', {});
      if (move) selectedKeys.add(`${move.from.r},${move.from.c}->${move.to.r},${move.to.c}`);
    }

    // Verify we found at least 2 different moves (proving randomness)
    expect(selectedKeys.size).toBeGreaterThan(1);
  });

  test('Expert Difficulty should always pick the absolute best move from TT', async () => {
    TranspositionTable.getTTMove.mockReturnValue(move1);

    for (let i = 0; i < 5; i++) {
      let count = 0;
      Evaluation.evaluatePosition.mockImplementation(() => {
        const scores = [-100, -90, -80, 0];
        return scores[count++ % 4];
      });

      const move = await getBestMove(mockBoard, 'white', 1, 'expert', {});
      // move1 is {from: 10, to: 20}. 10 is row 1, col 1. 20 is row 2, col 2.
      expect(move.from.r).toBe(1);
      expect(move.from.c).toBe(1);
      expect(move.to.r).toBe(2);
      expect(move.to.c).toBe(2);
    }
  });
});
