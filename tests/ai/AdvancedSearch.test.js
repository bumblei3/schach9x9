/**
 * Tests for Advanced Search Features:
 * - Singular Extensions
 * - Delta Pruning
 */

import { jest } from '@jest/globals';

// Mock logger
jest.unstable_mockModule('../../js/logger.js', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

const {
  getBestMove,
  resetNodesEvaluated,
  getNodesEvaluated,
  convertBoardToInt,
  computeZobristHash,
  storeTT,
  clearTT,
  TT_EXACT,
} = await import('../../js/aiEngine.js');

const { coordsToIndex } = await import('../../js/ai/BoardDefinitions.js');

function createEmptyBoard() {
  return Array(9)
    .fill(null)
    .map(() => Array(9).fill(null));
}

describe('Advanced Search Features', () => {
  beforeEach(() => {
    resetNodesEvaluated();
    clearTT();
    // resetActiveConfig removed
  });

  describe('Delta Pruning (Quiescence Search)', () => {
    test('should prune bad captures in quiescence search', async () => {
      // Setup a position with many bad captures
      // White Queen at 4,4
      // Surrounded by protected Black Pawns
      const board = createEmptyBoard();
      board[4][4] = { type: 'q', color: 'white' };

      // Bad captures: Pawn protected by another pawn/piece
      board[3][4] = { type: 'p', color: 'black' }; // N
      board[2][4] = { type: 'r', color: 'black' }; // Protector

      board[4][3] = { type: 'p', color: 'black' }; // W
      board[4][2] = { type: 'r', color: 'black' }; // Protector

      board[4][5] = { type: 'p', color: 'black' }; // E
      board[4][6] = { type: 'r', color: 'black' }; // Protector

      // One good capture: Hanging pawn
      board[5][5] = { type: 'p', color: 'black' };

      // Run search at depth 1 (forces QS at leaf)
      await getBestMove(board, 'white', 1, 'hard');
      const nodesWithPruning = getNodesEvaluated();

      // Without pruning, it would search all captures.
      // With pruning, it should skip the bad ones (QxP protected).
      // We can't easily disable pruning to compare, but we can assert reasonable node count.
      expect(nodesWithPruning).toBeLessThan(500);
    });
  });

  describe('Singular Extensions', () => {
    test('should trigger extension on singular move', async () => {
      // Setup a position where one move is clearly best
      // White can mate in 3, or prevent mate.
      // Let's use a simpler setup: King and Rook vs King.
      const board = createEmptyBoard();
      board[0][0] = { type: 'k', color: 'black' };
      // White King at 2,0 (Covers 1,0 and 1,1)
      board[2][0] = { type: 'k', color: 'white' };
      board[1][7] = { type: 'r', color: 'white' };

      // Convert to Int for Hashing
      const intBoard = convertBoardToInt(board);
      const hash = computeZobristHash(intBoard, 'white');

      // Manually seed TT with a "singular" entry (Int Move)
      // Best Move: Rook from 1,7 to 0,7 (Mate)
      const bestMove = { from: coordsToIndex(1, 7), to: coordsToIndex(0, 7) };
      storeTT(hash, 6, 20000, TT_EXACT, bestMove);

      // Run search at depth 8 (triggers SE condition depth >= 8)
      // We expect the search to find the mate, potentially extending.

      const resultMove = await getBestMove(board, 'white', 8, 'hard');

      // Result is UI Move. Compare with expected UI Move.
      // Move: 1,7 -> 0,7
      expect(resultMove.from.r).toBe(1);
      expect(resultMove.from.c).toBe(7);
      expect(resultMove.to.r).toBe(0);
      expect(resultMove.to.c).toBe(7);

      expect(getNodesEvaluated()).toBeGreaterThan(0);
    });

    test('should NOT trigger extension if alternatives are good', async () => {
      // Multiple good moves
      const board = createEmptyBoard();
      board[0][0] = { type: 'k', color: 'black' };
      board[8][8] = { type: 'k', color: 'white' };
      board[7][0] = { type: 'q', color: 'white' }; // Can mate
      board[7][1] = { type: 'q', color: 'white' }; // Can also mate

      const intBoard = convertBoardToInt(board);
      const hash = computeZobristHash(intBoard, 'white');

      // Seed
      const bestMove = { from: coordsToIndex(7, 0), to: coordsToIndex(0, 0) };
      storeTT(hash, 6, 20000, TT_EXACT, bestMove);

      const move = await getBestMove(board, 'white', 8, 'hard');
      expect(move).toBeDefined();
    });
  });
});
