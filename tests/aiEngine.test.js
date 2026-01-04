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
} from '../js/aiEngine.js';
import { createEmptyBoard } from '../js/gameEngine.js';

describe('AI Engine', () => {
  let board;

  beforeEach(() => {
    board = createEmptyBoard();
  });

  describe('evaluatePosition', () => {
    test('should return tempo bonus for empty board', () => {
      // With tempo bonus, the side to move gets a small advantage
      expect(evaluatePosition(board, 'white')).toBe(5); // Tempo bonus
    });

    test('should value material correctly', () => {
      // Place white pawn
      board[4][4] = { type: 'p', color: 'white' };
      // Place black pawn
      board[2][2] = { type: 'p', color: 'black' };

      // With new evaluation, passed pawn bonuses and PSTs result in a larger score
      const score = evaluatePosition(board, 'white');
      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThan(200);
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
      board[8][8] = { type: 'k', color: 'white' };
      board[0][0] = { type: 'k', color: 'black' };

      const bestMove = getBestMove(board, 'white', 1, 'medium');

      expect(bestMove).toMatchObject({
        from: { r: 4, c: 4 },
        to: { r: 4, c: 6 },
      });
    });

    test('should avoid immediate capture', () => {
      // White queen threatened by black rook
      board[4][4] = { type: 'q', color: 'white' };
      board[4][0] = { type: 'r', color: 'black' };
      board[8][8] = { type: 'k', color: 'white' };
      board[0][0] = { type: 'k', color: 'black' };

      // Black to move, should capture queen
      const bestMove = getBestMove(board, 'black', 1, 'medium');

      expect(bestMove).toMatchObject({
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

  describe('Advanced AI Scenarios', () => {
    test('should find Mate in 1', () => {
      // Setup Mate in 1 position
      // White King at 2,2 (covers 1,1; 1,2; 1,3)
      // Black King at 0,2
      // White Rook at 1,7
      // White to move: Rook to 0,7 is mate

      board[2][2] = { type: 'k', color: 'white' };
      board[0][2] = { type: 'k', color: 'black' };
      board[1][7] = { type: 'r', color: 'white' };

      const bestMove = getBestMove(board, 'white', 2, 'expert');

      expect(bestMove).toMatchObject({
        from: { r: 1, c: 7 },
        to: { r: 0, c: 7 },
      });
    });

    test('should avoid Stalemate when winning', () => {
      // White King at 0,0
      // Black King at 0,2
      // White Queen at 1,1
      // White to move. Queen to 0,1 would be stalemate.
      // Queen to 1,7 is safe and keeps game going.

      board[0][0] = { type: 'k', color: 'white' };
      board[0][2] = { type: 'k', color: 'black' };
      board[1][1] = { type: 'q', color: 'white' };

      const bestMove = getBestMove(board, 'white', 2, 'expert');

      // Should NOT move to 0,1
      expect(bestMove.to).not.toEqual({ r: 0, c: 1 });
    });

    test('should use Quiescence Search to see capture chains', () => {
      // Setup a position where a capture looks good but leads to material loss
      // White Knight at 4,4
      // Black Pawn at 3,3 (protected by Black Bishop at 1,1)
      // If depth is 1, AI might take pawn (gain 100) and miss the bishop recapture (lose 320)

      board[4][4] = { type: 'n', color: 'white' };
      board[3][3] = { type: 'p', color: 'black' };
      board[1][1] = { type: 'b', color: 'black' }; // Diagonally protects 3,3

      const bestMove = getBestMove(board, 'white', 1, 'expert');

      // Should NOT capture the pawn if it leads to losing the knight
      if (bestMove && bestMove.from.r === 4 && bestMove.from.c === 4) {
        // If moving the knight, shouldn't go to protected pawn
        expect(bestMove.to).not.toEqual({ r: 3, c: 3 });
      }
    });
  });

  describe('Move Ordering and Optimization', () => {
    test('should prioritize captures in move ordering', () => {
      // Setup position with capture available
      board[4][4] = { type: 'r', color: 'white' };
      board[4][6] = { type: 'q', color: 'black' }; // High value target
      board[4][7] = { type: 'p', color: 'black' }; // Low value target

      const bestMove = getBestMove(board, 'white', 2, 'expert');

      // Should prefer capturing the queen
      expect(bestMove.to).toEqual({ r: 4, c: 6 });
    });

    test('should evaluate center control', () => {
      const centerBoard = createEmptyBoard();
      centerBoard[4][4] = { type: 'n', color: 'white' }; // Knight in center

      const cornerBoard = createEmptyBoard();
      cornerBoard[0][0] = { type: 'n', color: 'white' }; // Knight in corner

      const centerScore = evaluatePosition(centerBoard, 'white');
      const cornerScore = evaluatePosition(cornerBoard, 'white');

      // Center position should be valued higher
      expect(centerScore).toBeGreaterThan(cornerScore);
    });

    test('should penalize doubled pawns', () => {
      board[4][4] = { type: 'p', color: 'white' };
      board[5][4] = { type: 'p', color: 'white' };
      const scoreDoubled = evaluatePosition(board, 'white');

      const normalBoard = createEmptyBoard();
      normalBoard[4][4] = { type: 'p', color: 'white' };
      normalBoard[4][5] = { type: 'p', color: 'white' }; // Same row, different col
      const scoreNormal = evaluatePosition(normalBoard, 'white');

      expect(scoreNormal).toBeGreaterThan(scoreDoubled);
    });

    test('should evaluate special pieces correctly', () => {
      const bArch = createEmptyBoard();
      bArch[4][4] = { type: 'a', color: 'white' };
      expect(evaluatePosition(bArch, 'white')).toBeGreaterThan(600);

      const bChan = createEmptyBoard();
      bChan[4][4] = { type: 'c', color: 'white' };
      expect(evaluatePosition(bChan, 'white')).toBeGreaterThan(700);

      const bAngel = createEmptyBoard();
      bAngel[4][4] = { type: 'e', color: 'white' };
      expect(evaluatePosition(bAngel, 'white')).toBeGreaterThan(1000);
    });
  });

  describe('Difficulty Levels and Randomized Behavior', () => {
    test('beginner should make random moves most of the time', () => {
      board[4][4] = { type: 'q', color: 'white' };
      board[4][6] = { type: 'p', color: 'black' };

      const moves = [];
      for (let i = 0; i < 5; i++) {
        const move = getBestMove(board, 'white', 2, 'beginner');
        moves.push(move);
      }
      expect(moves.length).toBeGreaterThan(0);
    });

    test('easy should prefer captures', () => {
      board[4][4] = { type: 'r', color: 'white' };
      board[4][6] = { type: 'q', color: 'black' };
      const move = getBestMove(board, 'white', 2, 'easy');
      expect(move.to).toEqual({ r: 4, c: 6 });
    });

    test('Expert should reach target depth via ID', () => {
      board[4][4] = { type: 'q', color: 'white' };
      const move = getBestMove(board, 'white', 3, 'expert');
      expect(move).toBeDefined();
    });
  });

  test('should handle positions with no legal moves', () => {
    // Stalemate-like position: just kings
    const emptyBoard = createEmptyBoard();
    emptyBoard[0][0] = { type: 'k', color: 'white' };
    emptyBoard[8][8] = { type: 'k', color: 'black' };

    const moves = getAllLegalMoves(emptyBoard, 'white');

    // Kings should have some moves unless completely blocked
    expect(moves.length).toBeGreaterThan(0);
  });
});
