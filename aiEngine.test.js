/**
 * Tests for AI Engine
 */

import {
  getBestMove,
  evaluatePosition,
  computeZobristHash,
  getAllLegalMoves,
  getTTSize,
  setTTMaxSize,
  testStoreTT,
  testProbeTT,
  clearTT,
} from './aiEngine.js';
import { createEmptyBoard, BOARD_SIZE } from './gameEngine.js';
import { AI_PIECE_VALUES } from './config.js';

describe('AI Engine', () => {
  let board;

  beforeEach(() => {
    board = createEmptyBoard();
  });

  describe('evaluatePosition', () => {
    test('should return 0 for empty board', () => {
      expect(evaluatePosition(board, 'white')).toBe(0);
    });

    test('should value material correctly', () => {
      // Place white pawn
      board[4][4] = { type: 'p', color: 'white' };
      // Place black pawn
      board[2][2] = { type: 'p', color: 'black' };

      // White perspective: material equal, but position bonus differs
      // Center pawn (4,4) gets 10 bonus
      // Extended center pawn (2,2) gets 5 bonus
      // Material: 100 each
      // White: 100 + 10 = 110
      // Black: 100 + 5 = 105
      // Score: 110 - 105 = 5
      expect(evaluatePosition(board, 'white')).toBe(5);
    });

    test('should favor material advantage', () => {
      board[4][4] = { type: 'q', color: 'white' }; // 900 + 10 = 910
      board[0][0] = { type: 'r', color: 'black' }; // 500 - 5 (edge) = 495

      const score = evaluatePosition(board, 'white');
      expect(score).toBeGreaterThan(300);
    });
  });

  describe('getAllLegalMoves', () => {
    test('should find moves for a single piece', () => {
      board[4][4] = { type: 'r', color: 'white' };
      const moves = getAllLegalMoves(board, 'white');
      // Rook at 4,4 on 9x9 board:
      // Up: 4, Down: 4, Left: 4, Right: 4 = 16 moves
      expect(moves.length).toBe(16);
    });
  });

  describe('getBestMove', () => {
    test('should find a simple capture', () => {
      // White rook can capture black pawn
      board[4][4] = { type: 'r', color: 'white' };
      board[4][6] = { type: 'p', color: 'black' };

      const bestMove = getBestMove(board, 'white', 1, 'medium');

      expect(bestMove).toEqual({
        from: { r: 4, c: 4 },
        to: { r: 4, c: 6 },
      });
    });

    test('should avoid immediate capture', () => {
      // White queen threatened by black rook
      board[4][4] = { type: 'q', color: 'white' };
      board[4][0] = { type: 'r', color: 'black' };

      // Black to move, should capture queen
      const bestMove = getBestMove(board, 'black', 1, 'medium');

      expect(bestMove).toEqual({
        from: { r: 4, c: 0 },
        to: { r: 4, c: 4 },
      });
    });
  });

  describe('Zobrist Hashing', () => {
    test('should produce same hash for same position', () => {
      board[0][0] = { type: 'r', color: 'white' };
      const hash1 = computeZobristHash(board, 'white');
      const hash2 = computeZobristHash(board, 'white');
      expect(hash1).toBe(hash2);
    });

    test('should produce different hash for different position', () => {
      board[0][0] = { type: 'r', color: 'white' };
      const hash1 = computeZobristHash(board, 'white');

      board[0][1] = { type: 'p', color: 'black' };
      const hash2 = computeZobristHash(board, 'white');

      expect(hash1).not.toBe(hash2);
    });

    test('should produce different hash for different turn', () => {
      board[0][0] = { type: 'r', color: 'white' };
      const hash1 = computeZobristHash(board, 'white');
      const hash2 = computeZobristHash(board, 'black');

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('Transposition Table (LRU)', () => {
    beforeEach(() => {
      clearTT();
    });

    test('should evict oldest entry when full', () => {
      setTTMaxSize(3);

      // Add 3 entries
      testStoreTT(1, 1, 100, 0, null);
      testStoreTT(2, 1, 200, 0, null);
      testStoreTT(3, 1, 300, 0, null);

      expect(getTTSize()).toBe(3);

      // Add 4th entry, should evict oldest (1)
      testStoreTT(4, 1, 400, 0, null);

      expect(getTTSize()).toBe(3);
      expect(testProbeTT(1, 1, -Infinity, Infinity)).toBeNull(); // 1 should be gone
      expect(testProbeTT(2, 1, -Infinity, Infinity)).not.toBeNull(); // 2 should be there
      expect(testProbeTT(4, 1, -Infinity, Infinity)).not.toBeNull(); // 4 should be there
    });

    test('should update MRU on access', () => {
      setTTMaxSize(3);

      testStoreTT(1, 1, 100, 0, null);
      testStoreTT(2, 1, 200, 0, null);
      testStoreTT(3, 1, 300, 0, null);

      // Access 1 (making it MRU)
      testProbeTT(1, 1, -Infinity, Infinity);

      // Add 4th entry.
      // If 1 was updated to MRU, then 2 should be the LRU now (since 1 was accessed after 2 and 3).
      // Wait:
      // Insert 1 -> [1]
      // Insert 2 -> [1, 2]
      // Insert 3 -> [1, 2, 3]
      // Access 1 -> [2, 3, 1] (1 moved to end)
      // Insert 4 -> [3, 1, 4] (2 evicted)

      testStoreTT(4, 1, 400, 0, null);

      expect(testProbeTT(2, 1, -Infinity, Infinity)).toBeNull(); // 2 should be evicted
      expect(testProbeTT(1, 1, -Infinity, Infinity)).not.toBeNull(); // 1 should still be there
    });
  });
});
